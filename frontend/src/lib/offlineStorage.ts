/**
 * IndexedDB Storage Layer pour Study Master
 * Gère le stockage local des données pour le mode hors ligne
 */

const DB_NAME = 'StudyMasterDB';
const DB_VERSION = 1;

// Stores (tables) de la base de données
const STORES = {
  NOTES: 'notes',
  FLASHCARD_DECKS: 'flashcard_decks',
  FLASHCARDS: 'flashcards',
  SCHEDULES: 'schedules',
  STUDY_SESSIONS: 'study_sessions',
  USER_PROFILE: 'user_profile',
  GAMIFICATION: 'gamification',
  SUBJECTS: 'subjects',
  STUDY_GROUPS: 'study_groups',
  PENDING_SYNC: 'pending_sync',
  METADATA: 'metadata',
} as const;

type StoreName = typeof STORES[keyof typeof STORES];

interface SyncAction {
  id?: number;
  store: StoreName;
  action: 'create' | 'update' | 'delete';
  data: any;
  timestamp: number;
  endpoint: string;
  method: string;
  retries: number;
}

interface CacheMetadata {
  key: string;
  lastSync: number;
  expiresAt: number;
  etag?: string;
}

class OfflineStorage {
  private db: IDBDatabase | null = null;
  private isInitialized = false;
  private initPromise: Promise<void> | null = null;

  /**
   * Initialiser la base de données IndexedDB
   */
  async init(): Promise<void> {
    if (this.isInitialized) return;
    if (this.initPromise) return this.initPromise;

    this.initPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onerror = () => {
        console.error('[OfflineStorage] Erreur d\'ouverture:', request.error);
        reject(request.error);
      };

      request.onsuccess = () => {
        this.db = request.result;
        this.isInitialized = true;
        console.log('[OfflineStorage] Base de données initialisée');
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        this.createStores(db);
      };
    });

    return this.initPromise;
  }

  /**
   * Créer les stores (tables) de la base de données
   */
  private createStores(db: IDBDatabase): void {
    // Notes
    if (!db.objectStoreNames.contains(STORES.NOTES)) {
      const notesStore = db.createObjectStore(STORES.NOTES, { keyPath: 'id' });
      notesStore.createIndex('user_id', 'user_id', { unique: false });
      notesStore.createIndex('subject_id', 'subject_id', { unique: false });
      notesStore.createIndex('updated_at', 'updated_at', { unique: false });
    }

    // Flashcard Decks
    if (!db.objectStoreNames.contains(STORES.FLASHCARD_DECKS)) {
      const decksStore = db.createObjectStore(STORES.FLASHCARD_DECKS, { keyPath: 'id' });
      decksStore.createIndex('user_id', 'user_id', { unique: false });
      decksStore.createIndex('subject_id', 'subject_id', { unique: false });
    }

    // Flashcards
    if (!db.objectStoreNames.contains(STORES.FLASHCARDS)) {
      const cardsStore = db.createObjectStore(STORES.FLASHCARDS, { keyPath: 'id' });
      cardsStore.createIndex('deck_id', 'deck_id', { unique: false });
      cardsStore.createIndex('next_review', 'next_review', { unique: false });
    }

    // Schedules (Calendrier)
    if (!db.objectStoreNames.contains(STORES.SCHEDULES)) {
      const schedulesStore = db.createObjectStore(STORES.SCHEDULES, { keyPath: 'id' });
      schedulesStore.createIndex('user_id', 'user_id', { unique: false });
      schedulesStore.createIndex('start_time', 'start_time', { unique: false });
    }

    // Study Sessions
    if (!db.objectStoreNames.contains(STORES.STUDY_SESSIONS)) {
      const sessionsStore = db.createObjectStore(STORES.STUDY_SESSIONS, { keyPath: 'id' });
      sessionsStore.createIndex('user_id', 'user_id', { unique: false });
      sessionsStore.createIndex('created_at', 'created_at', { unique: false });
    }

    // User Profile
    if (!db.objectStoreNames.contains(STORES.USER_PROFILE)) {
      db.createObjectStore(STORES.USER_PROFILE, { keyPath: 'id' });
    }

    // Gamification Data
    if (!db.objectStoreNames.contains(STORES.GAMIFICATION)) {
      const gamificationStore = db.createObjectStore(STORES.GAMIFICATION, { keyPath: 'key' });
      gamificationStore.createIndex('type', 'type', { unique: false });
    }

    // Subjects
    if (!db.objectStoreNames.contains(STORES.SUBJECTS)) {
      db.createObjectStore(STORES.SUBJECTS, { keyPath: 'id' });
    }

    // Study Groups
    if (!db.objectStoreNames.contains(STORES.STUDY_GROUPS)) {
      const groupsStore = db.createObjectStore(STORES.STUDY_GROUPS, { keyPath: 'id' });
      groupsStore.createIndex('is_member', 'is_member', { unique: false });
    }

    // Pending Sync Actions
    if (!db.objectStoreNames.contains(STORES.PENDING_SYNC)) {
      const syncStore = db.createObjectStore(STORES.PENDING_SYNC, { keyPath: 'id', autoIncrement: true });
      syncStore.createIndex('timestamp', 'timestamp', { unique: false });
      syncStore.createIndex('store', 'store', { unique: false });
    }

    // Metadata (pour tracking des syncs)
    if (!db.objectStoreNames.contains(STORES.METADATA)) {
      db.createObjectStore(STORES.METADATA, { keyPath: 'key' });
    }
  }

  /**
   * Obtenir une transaction pour un store
   */
  private getTransaction(storeName: StoreName, mode: IDBTransactionMode = 'readonly'): IDBObjectStore {
    if (!this.db) throw new Error('Base de données non initialisée');
    const transaction = this.db.transaction(storeName, mode);
    return transaction.objectStore(storeName);
  }

  /**
   * Ajouter ou mettre à jour un élément
   */
  async put<T>(storeName: StoreName, data: T): Promise<T> {
    await this.init();

    return new Promise((resolve, reject) => {
      const store = this.getTransaction(storeName, 'readwrite');
      const request = store.put(data);

      request.onsuccess = () => resolve(data);
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Ajouter ou mettre à jour plusieurs éléments
   */
  async putMany<T>(storeName: StoreName, items: T[]): Promise<void> {
    await this.init();

    // Protection contre les données non-tableau
    if (!Array.isArray(items)) {
      console.warn(`[OfflineStorage] putMany appelé avec un non-tableau pour ${storeName}:`, typeof items);
      return;
    }

    if (items.length === 0) {
      return;
    }

    return new Promise((resolve, reject) => {
      if (!this.db) return reject(new Error('DB non initialisée'));

      const transaction = this.db.transaction(storeName, 'readwrite');
      const store = transaction.objectStore(storeName);

      items.forEach(item => store.put(item));

      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error);
    });
  }

  /**
   * Récupérer un élément par sa clé
   */
  async get<T>(storeName: StoreName, key: IDBValidKey): Promise<T | undefined> {
    await this.init();

    return new Promise((resolve, reject) => {
      const store = this.getTransaction(storeName);
      const request = store.get(key);

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Récupérer tous les éléments d'un store
   */
  async getAll<T>(storeName: StoreName): Promise<T[]> {
    await this.init();

    return new Promise((resolve, reject) => {
      const store = this.getTransaction(storeName);
      const request = store.getAll();

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Récupérer des éléments par index
   */
  async getByIndex<T>(storeName: StoreName, indexName: string, value: IDBValidKey): Promise<T[]> {
    await this.init();

    return new Promise((resolve, reject) => {
      const store = this.getTransaction(storeName);
      const index = store.index(indexName);
      const request = index.getAll(value);

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Supprimer un élément
   */
  async delete(storeName: StoreName, key: IDBValidKey): Promise<void> {
    await this.init();

    return new Promise((resolve, reject) => {
      const store = this.getTransaction(storeName, 'readwrite');
      const request = store.delete(key);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Vider un store
   */
  async clear(storeName: StoreName): Promise<void> {
    await this.init();

    return new Promise((resolve, reject) => {
      const store = this.getTransaction(storeName, 'readwrite');
      const request = store.clear();

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Compter les éléments d'un store
   */
  async count(storeName: StoreName): Promise<number> {
    await this.init();

    return new Promise((resolve, reject) => {
      const store = this.getTransaction(storeName);
      const request = store.count();

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  // ============================================
  // Méthodes spécifiques pour chaque entité
  // ============================================

  // --- Notes ---
  async saveNotes(notes: any[]): Promise<void> {
    await this.putMany(STORES.NOTES, notes);
    await this.updateMetadata(STORES.NOTES);
  }

  async getNotes(): Promise<any[]> {
    return this.getAll(STORES.NOTES);
  }

  async getNote(id: number): Promise<any> {
    return this.get(STORES.NOTES, id);
  }

  async saveNote(note: any): Promise<any> {
    return this.put(STORES.NOTES, note);
  }

  async deleteNote(id: number): Promise<void> {
    return this.delete(STORES.NOTES, id);
  }

  // --- Flashcard Decks ---
  async saveDecks(decks: any[]): Promise<void> {
    await this.putMany(STORES.FLASHCARD_DECKS, decks);
    await this.updateMetadata(STORES.FLASHCARD_DECKS);
  }

  async getDecks(): Promise<any[]> {
    return this.getAll(STORES.FLASHCARD_DECKS);
  }

  async getDeck(id: number): Promise<any> {
    return this.get(STORES.FLASHCARD_DECKS, id);
  }

  async saveDeck(deck: any): Promise<any> {
    return this.put(STORES.FLASHCARD_DECKS, deck);
  }

  // --- Flashcards ---
  async saveFlashcards(cards: any[]): Promise<void> {
    await this.putMany(STORES.FLASHCARDS, cards);
  }

  async getFlashcards(deckId?: number): Promise<any[]> {
    if (deckId) {
      return this.getByIndex(STORES.FLASHCARDS, 'deck_id', deckId);
    }
    return this.getAll(STORES.FLASHCARDS);
  }

  async getFlashcardsForReview(): Promise<any[]> {
    const allCards = await this.getAll<any>(STORES.FLASHCARDS);
    const now = new Date().toISOString();
    return allCards.filter(card => !card.next_review || card.next_review <= now);
  }

  // --- Schedules ---
  async saveSchedules(schedules: any[]): Promise<void> {
    await this.putMany(STORES.SCHEDULES, schedules);
    await this.updateMetadata(STORES.SCHEDULES);
  }

  async getSchedules(): Promise<any[]> {
    return this.getAll(STORES.SCHEDULES);
  }

  async getUpcomingSchedules(): Promise<any[]> {
    const schedules = await this.getAll<any>(STORES.SCHEDULES);
    const now = new Date().toISOString();
    return schedules
      .filter(s => s.start_time >= now)
      .sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime());
  }

  // --- Study Sessions ---
  async saveStudySessions(sessions: any[]): Promise<void> {
    await this.putMany(STORES.STUDY_SESSIONS, sessions);
    await this.updateMetadata(STORES.STUDY_SESSIONS);
  }

  async getStudySessions(): Promise<any[]> {
    return this.getAll(STORES.STUDY_SESSIONS);
  }

  // --- User Profile ---
  async saveUserProfile(profile: any): Promise<void> {
    await this.put(STORES.USER_PROFILE, profile);
    await this.updateMetadata(STORES.USER_PROFILE);
  }

  async getUserProfile(): Promise<any> {
    const profiles = await this.getAll<any>(STORES.USER_PROFILE);
    return profiles[0] || null;
  }

  // --- Gamification ---
  async saveGamificationData(key: string, data: any): Promise<void> {
    await this.put(STORES.GAMIFICATION, { key, ...data, type: key });
  }

  async getGamificationData(key: string): Promise<any> {
    return this.get(STORES.GAMIFICATION, key);
  }

  // --- Subjects ---
  async saveSubjects(subjects: any[]): Promise<void> {
    await this.putMany(STORES.SUBJECTS, subjects);
    await this.updateMetadata(STORES.SUBJECTS);
  }

  async getSubjects(): Promise<any[]> {
    return this.getAll(STORES.SUBJECTS);
  }

  // --- Study Groups ---
  async saveStudyGroups(groups: any[]): Promise<void> {
    await this.putMany(STORES.STUDY_GROUPS, groups);
    await this.updateMetadata(STORES.STUDY_GROUPS);
  }

  async getStudyGroups(): Promise<any[]> {
    return this.getAll(STORES.STUDY_GROUPS);
  }

  async getStudyGroup(id: number): Promise<any> {
    return this.get(STORES.STUDY_GROUPS, id);
  }

  // ============================================
  // Gestion de la synchronisation
  // ============================================

  /**
   * Ajouter une action de synchronisation en attente
   */
  async addPendingSync(action: Omit<SyncAction, 'id' | 'timestamp' | 'retries'>): Promise<void> {
    const syncAction: Omit<SyncAction, 'id'> = {
      ...action,
      timestamp: Date.now(),
      retries: 0,
    };
    await this.put(STORES.PENDING_SYNC, syncAction);
  }

  /**
   * Récupérer toutes les actions de synchronisation en attente
   */
  async getPendingSyncs(): Promise<SyncAction[]> {
    return this.getAll(STORES.PENDING_SYNC);
  }

  /**
   * Supprimer une action de synchronisation
   */
  async removePendingSync(id: number): Promise<void> {
    return this.delete(STORES.PENDING_SYNC, id);
  }

  /**
   * Incrémenter le nombre de tentatives d'une action
   */
  async incrementSyncRetry(id: number): Promise<void> {
    const action = await this.get<SyncAction>(STORES.PENDING_SYNC, id);
    if (action) {
      action.retries++;
      await this.put(STORES.PENDING_SYNC, action);
    }
  }

  // ============================================
  // Métadonnées et utilitaires
  // ============================================

  /**
   * Mettre à jour les métadonnées d'un store
   */
  async updateMetadata(storeName: StoreName): Promise<void> {
    const metadata: CacheMetadata = {
      key: storeName,
      lastSync: Date.now(),
      expiresAt: Date.now() + (24 * 60 * 60 * 1000), // 24 heures
    };
    await this.put(STORES.METADATA, metadata);
  }

  /**
   * Vérifier si le cache d'un store est valide
   */
  async isCacheValid(storeName: StoreName): Promise<boolean> {
    const metadata = await this.get<CacheMetadata>(STORES.METADATA, storeName);
    if (!metadata) return false;
    return Date.now() < metadata.expiresAt;
  }

  /**
   * Obtenir la date de dernière synchronisation
   */
  async getLastSyncTime(storeName: StoreName): Promise<number | null> {
    const metadata = await this.get<CacheMetadata>(STORES.METADATA, storeName);
    return metadata?.lastSync || null;
  }

  /**
   * Vider toutes les données
   */
  async clearAll(): Promise<void> {
    await Promise.all(
      Object.values(STORES).map(store => this.clear(store))
    );
    console.log('[OfflineStorage] Toutes les données ont été supprimées');
  }

  /**
   * Obtenir des statistiques sur le stockage
   */
  async getStorageStats(): Promise<Record<string, number>> {
    const stats: Record<string, number> = {};

    for (const store of Object.values(STORES)) {
      stats[store] = await this.count(store);
    }

    return stats;
  }

  /**
   * Exporter toutes les données (pour debug)
   */
  async exportAll(): Promise<Record<string, any[]>> {
    const data: Record<string, any[]> = {};

    for (const store of Object.values(STORES)) {
      data[store] = await this.getAll(store);
    }

    return data;
  }
}

// Instance singleton
export const offlineStorage = new OfflineStorage();

// Exporter les constantes
export { STORES, DB_NAME, DB_VERSION };
export type { StoreName, SyncAction, CacheMetadata };
