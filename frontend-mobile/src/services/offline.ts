/**
 * Study Master - Offline Sync Service
 * Gestion du mode hors ligne et synchronisation des données
 * Utilise FSRS pour les révisions de flashcards
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo, { NetInfoState } from '@react-native-community/netinfo';
import * as SQLite from 'expo-sqlite';
import api from './api';
import type { Note, Flashcard, Subject, Quiz, FlashcardReview } from '@/types';
import {
  FSRSScheduler,
  Rating,
  State,
  createFSRSCard,
  fsrsCardToApiFormat,
  formatIntervalDisplay,
  type FSRSCard,
  type ReviewLog,
} from './fsrs';

// ============================================
// CONSTANTS
// ============================================

const QUEUE_KEY = '@study_master_sync_queue';
const LAST_SYNC_KEY = '@study_master_last_sync';
const OFFLINE_DATA_PREFIX = '@study_master_offline_';
const DB_NAME = 'studymaster_offline.db';

// ============================================
// TYPES
// ============================================

type SyncAction = 'create' | 'update' | 'delete';
type SyncEntity = 'note' | 'flashcard' | 'flashcard_review' | 'subject' | 'quiz_attempt';

interface SyncQueueItem {
  id: string;
  entity: SyncEntity;
  action: SyncAction;
  data: Record<string, unknown>;
  timestamp: number;
  retryCount: number;
}

interface SyncStatus {
  isOnline: boolean;
  lastSync: number | null;
  pendingChanges: number;
  isSyncing: boolean;
}

interface OfflineCache {
  subjects: Subject[];
  notes: Note[];
  flashcards: Flashcard[];
  lastUpdated: number;
}

// ============================================
// DATABASE SETUP
// ============================================

let db: SQLite.SQLiteDatabase | null = null;

async function initializeDatabase(): Promise<void> {
  db = await SQLite.openDatabaseAsync(DB_NAME);

  // Create tables
  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS subjects (
      id INTEGER PRIMARY KEY,
      data TEXT NOT NULL,
      updated_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS notes (
      id INTEGER PRIMARY KEY,
      subject_id INTEGER,
      data TEXT NOT NULL,
      updated_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS flashcards (
      id INTEGER PRIMARY KEY,
      subject_id INTEGER,
      data TEXT NOT NULL,
      updated_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS sync_queue (
      id TEXT PRIMARY KEY,
      entity TEXT NOT NULL,
      action TEXT NOT NULL,
      data TEXT NOT NULL,
      timestamp INTEGER NOT NULL,
      retry_count INTEGER DEFAULT 0
    );

    CREATE INDEX IF NOT EXISTS idx_notes_subject ON notes(subject_id);
    CREATE INDEX IF NOT EXISTS idx_flashcards_subject ON flashcards(subject_id);
    CREATE INDEX IF NOT EXISTS idx_sync_timestamp ON sync_queue(timestamp);
  `);
}

// ============================================
// OFFLINE SERVICE CLASS
// ============================================

class OfflineService {
  private isOnline: boolean = true;
  private isSyncing: boolean = false;
  private syncQueue: SyncQueueItem[] = [];
  private listeners: Set<(status: SyncStatus) => void> = new Set();
  private networkUnsubscribe: (() => void) | null = null;

  // Initialize the offline service
  async initialize(): Promise<void> {
    try {
      // Initialize database
      await initializeDatabase();

      // Load sync queue
      await this.loadSyncQueue();

      // Setup network listener
      this.setupNetworkListener();

      // Check initial connection
      const state = await NetInfo.fetch();
      this.isOnline = state.isConnected ?? false;

      // Initial sync if online
      if (this.isOnline) {
        await this.sync();
      }
    } catch (error) {
      console.error('Failed to initialize offline service:', error);
    }
  }

  // Setup network state listener
  private setupNetworkListener(): void {
    this.networkUnsubscribe = NetInfo.addEventListener((state: NetInfoState) => {
      const wasOffline = !this.isOnline;
      this.isOnline = state.isConnected ?? false;

      // Sync when coming back online
      if (wasOffline && this.isOnline) {
        console.log('Back online, syncing...');
        this.sync();
      }

      this.notifyListeners();
    });
  }

  // Load sync queue from database
  private async loadSyncQueue(): Promise<void> {
    if (!db) return;

    try {
      const result = await db.getAllAsync<{
        id: string;
        entity: string;
        action: string;
        data: string;
        timestamp: number;
        retry_count: number;
      }>('SELECT * FROM sync_queue ORDER BY timestamp ASC');

      this.syncQueue = result.map((row) => ({
        id: row.id,
        entity: row.entity as SyncEntity,
        action: row.action as SyncAction,
        data: JSON.parse(row.data),
        timestamp: row.timestamp,
        retryCount: row.retry_count,
      }));
    } catch (error) {
      console.error('Failed to load sync queue:', error);
    }
  }

  // Save sync queue item to database
  private async saveSyncQueueItem(item: SyncQueueItem): Promise<void> {
    if (!db) return;

    await db.runAsync(
      `INSERT OR REPLACE INTO sync_queue (id, entity, action, data, timestamp, retry_count)
       VALUES (?, ?, ?, ?, ?, ?)`,
      item.id,
      item.entity,
      item.action,
      JSON.stringify(item.data),
      item.timestamp,
      item.retryCount
    );
  }

  // Remove sync queue item from database
  private async removeSyncQueueItem(id: string): Promise<void> {
    if (!db) return;

    await db.runAsync('DELETE FROM sync_queue WHERE id = ?', id);
    this.syncQueue = this.syncQueue.filter((item) => item.id !== id);
  }

  // Add item to sync queue
  async addToQueue(
    entity: SyncEntity,
    action: SyncAction,
    data: Record<string, unknown>
  ): Promise<void> {
    const item: SyncQueueItem = {
      id: `${entity}_${action}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      entity,
      action,
      data,
      timestamp: Date.now(),
      retryCount: 0,
    };

    this.syncQueue.push(item);
    await this.saveSyncQueueItem(item);
    this.notifyListeners();

    // Try to sync immediately if online
    if (this.isOnline) {
      await this.sync();
    }
  }

  // Sync all pending changes
  async sync(): Promise<boolean> {
    if (!this.isOnline || this.isSyncing || this.syncQueue.length === 0) {
      return true;
    }

    this.isSyncing = true;
    this.notifyListeners();

    let allSuccessful = true;

    for (const item of [...this.syncQueue]) {
      try {
        await this.processSyncItem(item);
        await this.removeSyncQueueItem(item.id);
      } catch (error) {
        console.error(`Sync failed for ${item.entity}:`, error);
        allSuccessful = false;

        // Increment retry count
        item.retryCount++;
        if (item.retryCount >= 5) {
          // Remove after too many retries
          await this.removeSyncQueueItem(item.id);
        } else {
          await this.saveSyncQueueItem(item);
        }
      }
    }

    // Update last sync time
    if (allSuccessful) {
      await AsyncStorage.setItem(LAST_SYNC_KEY, Date.now().toString());
    }

    this.isSyncing = false;
    this.notifyListeners();

    return allSuccessful;
  }

  // Process a single sync item
  private async processSyncItem(item: SyncQueueItem): Promise<void> {
    const { entity, action, data } = item;

    switch (entity) {
      case 'note':
        await this.syncNote(action, data);
        break;
      case 'flashcard':
        await this.syncFlashcard(action, data);
        break;
      case 'flashcard_review':
        await this.syncFlashcardReview(data);
        break;
      case 'subject':
        await this.syncSubject(action, data);
        break;
      case 'quiz_attempt':
        await this.syncQuizAttempt(data);
        break;
    }
  }

  // Sync note
  private async syncNote(action: SyncAction, data: Record<string, unknown>): Promise<void> {
    switch (action) {
      case 'create':
        await api.post('/notes', data);
        break;
      case 'update':
        await api.put(`/notes/${data.id}`, data);
        break;
      case 'delete':
        await api.delete(`/notes/${data.id}`);
        break;
    }
  }

  // Sync flashcard
  private async syncFlashcard(action: SyncAction, data: Record<string, unknown>): Promise<void> {
    switch (action) {
      case 'create':
        await api.post('/flashcards', data);
        break;
      case 'update':
        await api.put(`/flashcards/${data.id}`, data);
        break;
      case 'delete':
        await api.delete(`/flashcards/${data.id}`);
        break;
    }
  }

  // Sync flashcard review avec données FSRS
  private async syncFlashcardReview(data: Record<string, unknown>): Promise<void> {
    const payload: Record<string, unknown> = {
      quality: data.quality,
      time_taken: data.time_taken,
      review_date: data.reviewed_at || new Date().toISOString(),
    };

    // Inclure les données FSRS si disponibles
    if (data.fsrs_data) {
      payload.fsrs_data = data.fsrs_data;
    }

    await api.post(`/flashcards/${data.flashcard_id}/review`, payload);
  }

  // Sync subject
  private async syncSubject(action: SyncAction, data: Record<string, unknown>): Promise<void> {
    switch (action) {
      case 'create':
        await api.post('/subjects', data);
        break;
      case 'update':
        await api.put(`/subjects/${data.id}`, data);
        break;
      case 'delete':
        await api.delete(`/subjects/${data.id}`);
        break;
    }
  }

  // Sync quiz attempt
  private async syncQuizAttempt(data: Record<string, unknown>): Promise<void> {
    await api.post(`/quizzes/${data.quiz_id}/submit`, {
      answers: data.answers,
      time_taken: data.time_taken,
    });
  }

  // ============================================
  // OFFLINE DATA CACHE
  // ============================================

  // Cache subjects
  async cacheSubjects(subjects: Subject[]): Promise<void> {
    if (!db) return;

    const now = Date.now();
    for (const subject of subjects) {
      await db.runAsync(
        `INSERT OR REPLACE INTO subjects (id, data, updated_at) VALUES (?, ?, ?)`,
        subject.id,
        JSON.stringify(subject),
        now
      );
    }
  }

  // Get cached subjects
  async getCachedSubjects(): Promise<Subject[]> {
    if (!db) return [];

    const result = await db.getAllAsync<{ data: string }>(
      'SELECT data FROM subjects ORDER BY id ASC'
    );

    return result.map((row) => JSON.parse(row.data));
  }

  // Cache notes
  async cacheNotes(notes: Note[]): Promise<void> {
    if (!db) return;

    const now = Date.now();
    for (const note of notes) {
      await db.runAsync(
        `INSERT OR REPLACE INTO notes (id, subject_id, data, updated_at) VALUES (?, ?, ?, ?)`,
        note.id,
        note.subject_id,
        JSON.stringify(note),
        now
      );
    }
  }

  // Get cached notes
  async getCachedNotes(subjectId?: number): Promise<Note[]> {
    if (!db) return [];

    if (subjectId) {
      const query = 'SELECT data FROM notes WHERE subject_id = ? ORDER BY id DESC';
      const result = await db.getAllAsync<{ data: string }>(query, subjectId);
      return result.map((row) => JSON.parse(row.data));
    }

    const query = 'SELECT data FROM notes ORDER BY id DESC';
    const result = await db.getAllAsync<{ data: string }>(query);
    return result.map((row) => JSON.parse(row.data));
  }

  // Cache flashcards
  async cacheFlashcards(flashcards: Flashcard[]): Promise<void> {
    if (!db) return;

    const now = Date.now();
    for (const flashcard of flashcards) {
      await db.runAsync(
        `INSERT OR REPLACE INTO flashcards (id, subject_id, data, updated_at) VALUES (?, ?, ?, ?)`,
        flashcard.id,
        flashcard.subject_id,
        JSON.stringify(flashcard),
        now
      );
    }
  }

  // Get cached flashcards
  async getCachedFlashcards(subjectId?: number): Promise<Flashcard[]> {
    if (!db) return [];

    if (subjectId) {
      const query = 'SELECT data FROM flashcards WHERE subject_id = ? ORDER BY id DESC';
      const result = await db.getAllAsync<{ data: string }>(query, subjectId);
      return result.map((row) => JSON.parse(row.data));
    }

    const query = 'SELECT data FROM flashcards ORDER BY id DESC';
    const result = await db.getAllAsync<{ data: string }>(query);
    return result.map((row) => JSON.parse(row.data));
  }

  // Get due flashcards (offline mode)
  async getCachedDueFlashcards(): Promise<Flashcard[]> {
    const flashcards = await this.getCachedFlashcards();
    const now = new Date();

    return flashcards.filter((f) => {
      if (!f.next_review_at) return f.status === 'new';
      return new Date(f.next_review_at) <= now;
    });
  }

  // Clear all cached data
  async clearCache(): Promise<void> {
    if (!db) return;

    await db.execAsync(`
      DELETE FROM subjects;
      DELETE FROM notes;
      DELETE FROM flashcards;
    `);
  }

  // ============================================
  // OFFLINE OPERATIONS
  // ============================================

  // Create note offline
  async createNoteOffline(note: Omit<Note, 'id' | 'created_at' | 'updated_at'>): Promise<Note> {
    const tempId = -Date.now(); // Negative ID for temp
    const now = new Date().toISOString();

    const newNote: Note = {
      ...note,
      id: tempId,
      created_at: now,
      updated_at: now,
    } as Note;

    // Cache locally
    await this.cacheNotes([newNote]);

    // Add to sync queue
    await this.addToQueue('note', 'create', note);

    return newNote;
  }

  // Update note offline
  async updateNoteOffline(id: number, updates: Partial<Note>): Promise<void> {
    const cached = await this.getCachedNotes();
    const note = cached.find((n) => n.id === id);

    if (note) {
      const updatedNote = { ...note, ...updates, updated_at: new Date().toISOString() };
      await this.cacheNotes([updatedNote]);
    }

    await this.addToQueue('note', 'update', { id, ...updates });
  }

  // Instance FSRS scheduler
  private fsrsScheduler = new FSRSScheduler();

  /**
   * Convertir une flashcard vers le format FSRS
   */
  private flashcardToFSRS(flashcard: Flashcard): FSRSCard {
    return createFSRSCard({
      stability: flashcard.stability,
      difficulty: flashcard.difficulty,
      easeFactor: flashcard.ease_factor,
      interval: flashcard.interval,
      repetitions: flashcard.repetitions,
      status: flashcard.status,
      lastReviewedAt: flashcard.last_reviewed_at,
      nextReviewAt: flashcard.next_review_at,
    });
  }

  /**
   * Review flashcard offline avec FSRS
   * Remplace l'ancien algorithme SM-2
   */
  async reviewFlashcardOffline(
    flashcardId: number,
    quality: number,
    timeTaken: number
  ): Promise<{
    success: boolean;
    intervalDays: number;
    intervalDisplay: string;
  }> {
    // Récupérer la flashcard
    const flashcards = await this.getCachedFlashcards();
    const flashcard = flashcards.find((f) => f.id === flashcardId);

    if (!flashcard) {
      console.error(`[FSRS Offline] Flashcard ${flashcardId} non trouvée`);
      return { success: false, intervalDays: 0, intervalDisplay: '' };
    }

    // Convertir en format FSRS
    const fsrsCard = this.flashcardToFSRS(flashcard);

    // Mapper quality (0-3) vers Rating FSRS
    const ratingMap: Record<number, Rating> = {
      0: Rating.AGAIN,
      1: Rating.HARD,
      2: Rating.GOOD,
      3: Rating.EASY,
    };
    const rating = ratingMap[quality] ?? Rating.GOOD;

    // Calculer avec FSRS
    const now = new Date();
    const { card: newFsrsCard, log } = this.fsrsScheduler.schedule(fsrsCard, rating, now);

    // Convertir vers format API
    const apiData = fsrsCardToApiFormat(newFsrsCard);

    // Mettre à jour la flashcard localement
    const updatedFlashcard: Flashcard = {
      ...flashcard,
      // Données FSRS
      stability: apiData.stability,
      difficulty: apiData.difficulty,
      interval: apiData.interval_days,
      repetitions: apiData.repetitions,
      status: apiData.state,
      next_review_at: apiData.next_review_at || undefined,
      last_reviewed_at: apiData.last_reviewed_at || undefined,
      // Statistiques
      total_reviews: flashcard.total_reviews + 1,
      correct_reviews: flashcard.correct_reviews + (quality >= 2 ? 1 : 0),
      incorrect_reviews: flashcard.incorrect_reviews + (quality < 2 ? 1 : 0),
    };

    await this.cacheFlashcards([updatedFlashcard]);

    console.log(`[FSRS Offline] Card ${flashcardId} reviewed: ${Rating[rating]} -> ${apiData.interval_days} days`);

    // Ajouter à la queue de sync avec données FSRS
    await this.addToQueue('flashcard_review', 'create', {
      flashcard_id: flashcardId,
      quality,
      time_taken: timeTaken,
      reviewed_at: now.toISOString(),
      // Données FSRS pour sync
      fsrs_data: {
        stability: apiData.stability,
        difficulty: apiData.difficulty,
        interval_days: apiData.interval_days,
        state: apiData.state,
        retrievability: log.retrievability,
      },
    });

    return {
      success: true,
      intervalDays: apiData.interval_days,
      intervalDisplay: formatIntervalDisplay(apiData.interval_days),
    };
  }

  /**
   * Prévisualiser les intervalles FSRS pour une flashcard
   */
  async getSchedulingPreview(flashcardId: number): Promise<{
    again: string;
    hard: string;
    good: string;
    easy: string;
  } | null> {
    const flashcards = await this.getCachedFlashcards();
    const flashcard = flashcards.find((f) => f.id === flashcardId);

    if (!flashcard) return null;

    const fsrsCard = this.flashcardToFSRS(flashcard);
    const options = this.fsrsScheduler.getSchedulingOptions(fsrsCard);

    return {
      again: options.again.display,
      hard: options.hard.display,
      good: options.good.display,
      easy: options.easy.display,
    };
  }

  // ============================================
  // STATUS & LISTENERS
  // ============================================

  // Get current sync status
  async getStatus(): Promise<SyncStatus> {
    const lastSync = await AsyncStorage.getItem(LAST_SYNC_KEY);

    return {
      isOnline: this.isOnline,
      lastSync: lastSync ? parseInt(lastSync, 10) : null,
      pendingChanges: this.syncQueue.length,
      isSyncing: this.isSyncing,
    };
  }

  // Check if online
  getIsOnline(): boolean {
    return this.isOnline;
  }

  // Subscribe to status changes
  subscribe(listener: (status: SyncStatus) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  // Notify all listeners
  private async notifyListeners(): Promise<void> {
    const status = await this.getStatus();
    this.listeners.forEach((listener) => listener(status));
  }

  // Cleanup
  cleanup(): void {
    if (this.networkUnsubscribe) {
      this.networkUnsubscribe();
    }
  }
}

// ============================================
// SINGLETON EXPORT
// ============================================

export const offlineService = new OfflineService();
export default offlineService;
