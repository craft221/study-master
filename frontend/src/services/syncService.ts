/**
 * Service de Synchronisation - Gère la sync entre IndexedDB et le serveur
 */

import { offlineStorage, STORES, SyncAction } from '@/lib/offlineStorage';
import api from '@/lib/api';

// Configuration
const MAX_RETRIES = 3;
const SYNC_INTERVAL = 30000; // 30 secondes

type SyncStatus = 'idle' | 'syncing' | 'error' | 'offline';

interface SyncResult {
  success: boolean;
  synced: number;
  failed: number;
  errors: string[];
}

interface SyncEventDetail {
  status: SyncStatus;
  result?: SyncResult;
  pendingCount?: number;
}

class SyncService {
  // Vérification SSR - navigator n'existe pas côté serveur
  private isOnline: boolean = typeof navigator !== 'undefined' ? navigator.onLine : true;
  private isSyncing: boolean = false;
  private syncInterval: NodeJS.Timeout | null = null;
  private listeners: Set<(event: SyncEventDetail) => void> = new Set();

  constructor() {
    this.setupEventListeners();
  }

  /**
   * Configurer les listeners d'événements réseau
   */
  private setupEventListeners(): void {
    if (typeof window === 'undefined') return;

    window.addEventListener('online', () => {
      console.log('[SyncService] Connexion rétablie');
      this.isOnline = true;
      this.notifyListeners({ status: 'idle' });
      this.syncAll();
    });

    window.addEventListener('offline', () => {
      console.log('[SyncService] Connexion perdue');
      this.isOnline = false;
      this.notifyListeners({ status: 'offline' });
    });

    // Écouter les messages du Service Worker
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.addEventListener('message', (event) => {
        if (event.data?.type === 'SYNC_SUCCESS') {
          console.log('[SyncService] Synchronisation SW réussie:', event.data);
          this.refreshLocalData();
        }
      });
    }
  }

  /**
   * Ajouter un listener pour les événements de synchronisation
   */
  addListener(callback: (event: SyncEventDetail) => void): () => void {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }

  /**
   * Notifier tous les listeners
   */
  private notifyListeners(event: SyncEventDetail): void {
    this.listeners.forEach(listener => listener(event));
  }

  /**
   * Vérifier l'état de la connexion
   */
  isConnected(): boolean {
    return this.isOnline;
  }

  /**
   * Démarrer la synchronisation automatique
   */
  startAutoSync(): void {
    if (this.syncInterval) return;

    this.syncInterval = setInterval(() => {
      if (this.isOnline && !this.isSyncing) {
        this.syncAll();
      }
    }, SYNC_INTERVAL);

    console.log('[SyncService] Synchronisation automatique démarrée');
  }

  /**
   * Arrêter la synchronisation automatique
   */
  stopAutoSync(): void {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = null;
      console.log('[SyncService] Synchronisation automatique arrêtée');
    }
  }

  /**
   * Synchroniser toutes les données
   */
  async syncAll(): Promise<SyncResult> {
    if (this.isSyncing) {
      console.log('[SyncService] Synchronisation déjà en cours');
      return { success: true, synced: 0, failed: 0, errors: [] };
    }

    if (!this.isOnline) {
      console.log('[SyncService] Hors ligne, synchronisation impossible');
      return { success: false, synced: 0, failed: 0, errors: ['Hors ligne'] };
    }

    // Vérifier si l'utilisateur est authentifié
    const token = typeof window !== 'undefined' ? localStorage.getItem('access_token') : null;
    if (!token) {
      console.log('[SyncService] Pas de token, synchronisation annulée');
      return { success: false, synced: 0, failed: 0, errors: ['Non authentifié'] };
    }

    this.isSyncing = true;
    this.notifyListeners({ status: 'syncing' });

    const result: SyncResult = {
      success: true,
      synced: 0,
      failed: 0,
      errors: [],
    };

    try {
      // 1. Envoyer les actions en attente
      const pendingResult = await this.syncPendingActions();
      result.synced += pendingResult.synced;
      result.failed += pendingResult.failed;
      result.errors.push(...pendingResult.errors);

      // 2. Récupérer les données fraîches du serveur
      await this.fetchFreshData();

      result.success = result.failed === 0;
    } catch (error) {
      console.error('[SyncService] Erreur lors de la synchronisation:', error);
      result.success = false;
      result.errors.push(error instanceof Error ? error.message : 'Erreur inconnue');
    } finally {
      this.isSyncing = false;
      this.notifyListeners({
        status: result.success ? 'idle' : 'error',
        result,
      });
    }

    return result;
  }

  /**
   * Synchroniser les actions en attente
   */
  private async syncPendingActions(): Promise<{ synced: number; failed: number; errors: string[] }> {
    const pendingActions = await offlineStorage.getPendingSyncs();
    let synced = 0;
    let failed = 0;
    const errors: string[] = [];

    // Trier par timestamp (les plus anciennes d'abord)
    pendingActions.sort((a, b) => a.timestamp - b.timestamp);

    for (const action of pendingActions) {
      if (action.retries >= MAX_RETRIES) {
        console.warn('[SyncService] Action abandonnée après trop de tentatives:', action);
        await offlineStorage.removePendingSync(action.id!);
        failed++;
        errors.push(`Action ${action.action} sur ${action.store} abandonnée`);
        continue;
      }

      try {
        await this.executeAction(action);
        await offlineStorage.removePendingSync(action.id!);
        synced++;
        console.log('[SyncService] Action synchronisée:', action);
      } catch (error) {
        console.error('[SyncService] Erreur de synchronisation:', error);
        await offlineStorage.incrementSyncRetry(action.id!);
        failed++;
        errors.push(`Erreur sur ${action.store}: ${error instanceof Error ? error.message : 'Erreur'}`);
      }
    }

    return { synced, failed, errors };
  }

  /**
   * Exécuter une action de synchronisation
   */
  private async executeAction(action: SyncAction): Promise<void> {
    const { endpoint, method, data } = action;

    switch (method.toUpperCase()) {
      case 'POST':
        await api.post(endpoint, data);
        break;
      case 'PUT':
        await api.put(endpoint, data);
        break;
      case 'PATCH':
        await api.patch(endpoint, data);
        break;
      case 'DELETE':
        await api.delete(endpoint);
        break;
      default:
        throw new Error(`Méthode non supportée: ${method}`);
    }
  }

  /**
   * Récupérer les données fraîches du serveur
   */
  private async fetchFreshData(): Promise<void> {
    // Vérifier si l'utilisateur est authentifié avant de faire les requêtes
    const token = typeof window !== 'undefined' ? localStorage.getItem('access_token') : null;
    if (!token) {
      console.log('[SyncService] Pas de token, skip fetchFreshData');
      return;
    }

    try {
      // Récupérer en parallèle les données essentielles
      const [
        userResponse,
        notesResponse,
        decksResponse,
        schedulesResponse,
        subjectsResponse,
        achievementsResponse,
      ] = await Promise.allSettled([
        api.get('/users/me'),
        api.get('/notes/'),
        api.get('/flashcards/decks'),
        api.get('/schedules/'),
        api.get('/subjects/'),
        api.get('/achievements/user/me'),
      ]);

      // Sauvegarder les données reçues
      if (userResponse.status === 'fulfilled') {
        await offlineStorage.saveUserProfile(userResponse.value.data);
      }

      if (notesResponse.status === 'fulfilled') {
        const notesData = notesResponse.value.data;
        const notes = Array.isArray(notesData) ? notesData : (notesData.notes || []);
        await offlineStorage.saveNotes(notes);
      }

      if (decksResponse.status === 'fulfilled') {
        const decksData = decksResponse.value.data;
        const decks = Array.isArray(decksData) ? decksData : (decksData.decks || []);
        await offlineStorage.saveDecks(decks);
      }

      if (schedulesResponse.status === 'fulfilled') {
        const schedulesData = schedulesResponse.value.data;
        // L'API schedules renvoie "events" et non "schedules"
        const schedules = Array.isArray(schedulesData) ? schedulesData : (schedulesData.events || schedulesData.schedules || []);
        await offlineStorage.saveSchedules(schedules);
      }

      if (subjectsResponse.status === 'fulfilled') {
        const subjectsData = subjectsResponse.value.data;
        const subjects = Array.isArray(subjectsData) ? subjectsData : (subjectsData.subjects || []);
        await offlineStorage.saveSubjects(subjects);
      }

      if (achievementsResponse.status === 'fulfilled') {
        const achievementsData = achievementsResponse.value.data;
        const achievements = Array.isArray(achievementsData) ? achievementsData : (achievementsData.achievements || []);
        await offlineStorage.saveGamificationData('achievements', achievements);
      }

      console.log('[SyncService] Données fraîches récupérées');
    } catch (error) {
      console.error('[SyncService] Erreur lors de la récupération des données:', error);
    }
  }

  /**
   * Rafraîchir les données locales après un événement du SW
   */
  private async refreshLocalData(): Promise<void> {
    if (this.isOnline) {
      await this.fetchFreshData();
    }
  }

  /**
   * Enregistrer une action pour synchronisation ultérieure
   */
  async queueAction(
    store: typeof STORES[keyof typeof STORES],
    action: 'create' | 'update' | 'delete',
    endpoint: string,
    method: string,
    data: any
  ): Promise<void> {
    await offlineStorage.addPendingSync({
      store,
      action,
      endpoint,
      method,
      data,
    });

    this.notifyListeners({
      status: this.isOnline ? 'idle' : 'offline',
      pendingCount: (await offlineStorage.getPendingSyncs()).length,
    });

    // Tenter de synchroniser immédiatement si en ligne
    if (this.isOnline) {
      this.syncAll();
    }
  }

  /**
   * Obtenir le nombre d'actions en attente
   */
  async getPendingCount(): Promise<number> {
    const pending = await offlineStorage.getPendingSyncs();
    return pending.length;
  }

  /**
   * Forcer une synchronisation complète
   */
  async forceSyncAll(): Promise<SyncResult> {
    // Vider le cache pour forcer le rechargement
    if (typeof caches !== 'undefined') {
      const cacheNames = await caches.keys();
      await Promise.all(
        cacheNames
          .filter(name => name.startsWith('study-master-api'))
          .map(name => caches.delete(name))
      );
    }

    return this.syncAll();
  }

  /**
   * Initialiser le service
   */
  async init(): Promise<void> {
    await offlineStorage.init();

    // Récupérer les données initiales si en ligne
    if (this.isOnline) {
      await this.fetchFreshData();
    }

    // Démarrer la synchronisation automatique
    this.startAutoSync();

    console.log('[SyncService] Service initialisé');
  }
}

// Instance singleton
export const syncService = new SyncService();

export default syncService;
