/**
 * IndexedDB Storage Layer pour Studera
 * Gère le stockage local des données pour le mode hors ligne
 * Inclut support FSRS pour révisions offline
 */

import {
  FSRSScheduler,
  Rating,
  State,
  createFSRSCard,
  fsrsCardToApiFormat,
  type FSRSCard,
  type SchedulingOptions,
} from './fsrs';

const DB_NAME = 'StuderaDB';
const DB_VERSION = 5; // Incrémenté pour ajouter review_logs

// Stores (tables) de la base de données
const STORES = {
  NOTES: 'notes',
  FLASHCARD_DECKS: 'flashcard_decks',
  FLASHCARDS: 'flashcards',
  FLASHCARD_REVIEW_LOGS: 'flashcard_review_logs', // Logs FSRS pour sync
  QUIZZES: 'quizzes',
  SCHEDULES: 'schedules',
  STUDY_SESSIONS: 'study_sessions',
  USER_PROFILE: 'user_profile',
  GAMIFICATION: 'gamification',
  SUBJECTS: 'subjects',
  STUDY_GROUPS: 'study_groups',
  DOCUMENTS: 'documents',
  EXAM_SESSIONS: 'exam_sessions',
  EXAM_TASKS: 'exam_tasks',
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
      cardsStore.createIndex('state', 'state', { unique: false });
    }

    // Flashcard Review Logs (pour sync des révisions offline)
    if (!db.objectStoreNames.contains(STORES.FLASHCARD_REVIEW_LOGS)) {
      const logsStore = db.createObjectStore(STORES.FLASHCARD_REVIEW_LOGS, { keyPath: 'id', autoIncrement: true });
      logsStore.createIndex('flashcard_id', 'flashcard_id', { unique: false });
      logsStore.createIndex('synced', 'synced', { unique: false });
      logsStore.createIndex('reviewed_at', 'reviewed_at', { unique: false });
    }

    // Quizzes
    if (!db.objectStoreNames.contains(STORES.QUIZZES)) {
      const quizzesStore = db.createObjectStore(STORES.QUIZZES, { keyPath: 'id' });
      quizzesStore.createIndex('user_id', 'user_id', { unique: false });
      quizzesStore.createIndex('subject_id', 'subject_id', { unique: false });
      quizzesStore.createIndex('created_at', 'created_at', { unique: false });
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

    // Documents (métadonnées uniquement, pas les fichiers binaires)
    if (!db.objectStoreNames.contains(STORES.DOCUMENTS)) {
      const docsStore = db.createObjectStore(STORES.DOCUMENTS, { keyPath: 'id' });
      docsStore.createIndex('user_id', 'user_id', { unique: false });
      docsStore.createIndex('subject_id', 'subject_id', { unique: false });
      docsStore.createIndex('file_type', 'file_type', { unique: false });
    }

    // Exam Sessions (Mode Examen)
    if (!db.objectStoreNames.contains(STORES.EXAM_SESSIONS)) {
      const examStore = db.createObjectStore(STORES.EXAM_SESSIONS, { keyPath: 'id' });
      examStore.createIndex('user_id', 'user_id', { unique: false });
      examStore.createIndex('status', 'status', { unique: false });
      examStore.createIndex('exam_date', 'exam_date', { unique: false });
    }

    // Exam Tasks (Tâches du Mode Examen)
    if (!db.objectStoreNames.contains(STORES.EXAM_TASKS)) {
      const tasksStore = db.createObjectStore(STORES.EXAM_TASKS, { keyPath: 'id' });
      tasksStore.createIndex('session_id', 'session_id', { unique: false });
      tasksStore.createIndex('study_day_id', 'study_day_id', { unique: false });
      tasksStore.createIndex('status', 'status', { unique: false });
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

  async saveFlashcard(card: any): Promise<any> {
    return this.put(STORES.FLASHCARDS, card);
  }

  async getFlashcard(id: string | number): Promise<any> {
    return this.get(STORES.FLASHCARDS, id);
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
    return allCards.filter(card => !card.next_review_at || card.next_review_at <= now);
  }

  /**
   * Récupérer les cartes dues d'un deck spécifique
   */
  async getDueFlashcards(deckId: number | string): Promise<any[]> {
    const deckCards = await this.getByIndex<any>(STORES.FLASHCARDS, 'deck_id', deckId);
    const now = new Date().toISOString();
    return deckCards.filter(card => {
      // Nouvelle carte OU carte dont la date de révision est passée
      if (!card.next_review_at) return true;
      return card.next_review_at <= now;
    });
  }

  // ============================================
  // FSRS - Révisions Offline avec calcul local
  // ============================================

  private fsrsScheduler = new FSRSScheduler();

  /**
   * Convertir une flashcard de l'API vers le format FSRS
   */
  private flashcardToFSRS(card: any): FSRSCard {
    return createFSRSCard({
      stability: card.stability,
      difficulty: card.difficulty,
      easeFactor: card.ease_factor,
      interval: card.interval_days || card.interval,
      repetitions: card.repetitions || card.reps,
      status: card.state || card.status,
      lastReviewedAt: card.last_reviewed_at,
      nextReviewAt: card.next_review_at,
    });
  }

  /**
   * Prévisualiser les intervalles FSRS pour toutes les options
   */
  getSchedulingPreview(card: any): SchedulingOptions {
    const fsrsCard = this.flashcardToFSRS(card);
    return this.fsrsScheduler.getSchedulingOptions(fsrsCard);
  }

  /**
   * Réviser une flashcard en mode offline avec FSRS
   * Calcule localement et stocke pour synchronisation ultérieure
   */
  async reviewFlashcardOffline(
    cardId: string | number,
    quality: 0 | 1 | 2 | 3
  ): Promise<{
    success: boolean;
    updatedCard: any;
    schedulingInfo: {
      intervalDays: number;
      nextReview: string;
      stability: number;
      difficulty: number;
      state: string;
    };
  }> {
    // 1. Récupérer la carte
    const card = await this.getFlashcard(cardId);
    if (!card) {
      throw new Error(`Flashcard ${cardId} non trouvée dans le cache`);
    }

    // 2. Convertir en format FSRS
    const fsrsCard = this.flashcardToFSRS(card);

    // 3. Mapper quality (0-3) vers Rating FSRS
    const ratingMap: Record<number, Rating> = {
      0: Rating.AGAIN,
      1: Rating.HARD,
      2: Rating.GOOD,
      3: Rating.EASY,
    };
    const rating = ratingMap[quality];

    // 4. Calculer la prochaine révision avec FSRS
    const now = new Date();
    const { card: newFsrsCard, log } = this.fsrsScheduler.schedule(fsrsCard, rating, now);

    // 5. Convertir vers le format API
    const apiData = fsrsCardToApiFormat(newFsrsCard);

    // 6. Mettre à jour la carte dans IndexedDB
    const updatedCard = {
      ...card,
      stability: apiData.stability,
      difficulty: apiData.difficulty,
      interval_days: apiData.interval_days,
      repetitions: apiData.repetitions,
      lapses: apiData.lapses,
      state: apiData.state,
      last_reviewed_at: apiData.last_reviewed_at,
      next_review_at: apiData.next_review_at,
      retrievability: apiData.retrievability,
      _offlineReviewed: true,
      _lastOfflineReview: now.toISOString(),
    };
    await this.saveFlashcard(updatedCard);

    // 7. Enregistrer le log de révision pour synchronisation
    const reviewLog = {
      flashcard_id: cardId,
      deck_id: card.deck_id,
      rating: quality,
      reviewed_at: now.toISOString(),
      stability_before: fsrsCard.stability,
      stability_after: apiData.stability,
      difficulty_before: fsrsCard.difficulty,
      difficulty_after: apiData.difficulty,
      interval_days: apiData.interval_days,
      state_before: State[fsrsCard.state],
      state_after: apiData.state,
      retrievability: log.retrievability,
      synced: false,
    };
    await this.put(STORES.FLASHCARD_REVIEW_LOGS, reviewLog);

    console.log(`[FSRS Offline] Card ${cardId} reviewed: ${Rating[rating]} -> next in ${apiData.interval_days} days`);

    return {
      success: true,
      updatedCard,
      schedulingInfo: {
        intervalDays: apiData.interval_days,
        nextReview: apiData.next_review_at || '',
        stability: apiData.stability,
        difficulty: apiData.difficulty,
        state: apiData.state,
      },
    };
  }

  /**
   * Récupérer les logs de révision non synchronisés
   */
  async getUnsyncedReviewLogs(): Promise<any[]> {
    const allLogs = await this.getAll<any>(STORES.FLASHCARD_REVIEW_LOGS);
    return allLogs.filter(log => !log.synced);
  }

  /**
   * Marquer un log de révision comme synchronisé
   */
  async markReviewLogSynced(logId: number): Promise<void> {
    const log = await this.get<any>(STORES.FLASHCARD_REVIEW_LOGS, logId);
    if (log) {
      log.synced = true;
      await this.put(STORES.FLASHCARD_REVIEW_LOGS, log);
    }
  }

  /**
   * Supprimer les logs synchronisés anciens (nettoyage)
   */
  async cleanupSyncedReviewLogs(olderThanDays: number = 30): Promise<number> {
    const allLogs = await this.getAll<any>(STORES.FLASHCARD_REVIEW_LOGS);
    const cutoff = Date.now() - (olderThanDays * 24 * 60 * 60 * 1000);
    let cleaned = 0;

    for (const log of allLogs) {
      if (log.synced && new Date(log.reviewed_at).getTime() < cutoff) {
        await this.delete(STORES.FLASHCARD_REVIEW_LOGS, log.id);
        cleaned++;
      }
    }

    return cleaned;
  }

  /**
   * Statistiques FSRS pour un deck
   */
  async getDeckFSRSStats(deckId: number | string): Promise<{
    totalCards: number;
    newCards: number;
    learningCards: number;
    reviewCards: number;
    dueNow: number;
    averageStability: number;
    averageDifficulty: number;
  }> {
    const cards = await this.getByIndex<any>(STORES.FLASHCARDS, 'deck_id', deckId);
    const now = new Date().toISOString();

    let newCount = 0;
    let learningCount = 0;
    let reviewCount = 0;
    let dueCount = 0;
    let totalStability = 0;
    let totalDifficulty = 0;
    let nonNewCount = 0;

    for (const card of cards) {
      const state = (card.state || 'new').toLowerCase();

      if (state === 'new' || !card.stability) {
        newCount++;
      } else if (state === 'learning' || state === 'relearning') {
        learningCount++;
        nonNewCount++;
        totalStability += card.stability || 0;
        totalDifficulty += card.difficulty || 5;
      } else {
        reviewCount++;
        nonNewCount++;
        totalStability += card.stability || 0;
        totalDifficulty += card.difficulty || 5;
      }

      // Compter les cartes dues
      if (!card.next_review_at || card.next_review_at <= now) {
        dueCount++;
      }
    }

    return {
      totalCards: cards.length,
      newCards: newCount,
      learningCards: learningCount,
      reviewCards: reviewCount,
      dueNow: dueCount,
      averageStability: nonNewCount > 0 ? Math.round((totalStability / nonNewCount) * 100) / 100 : 0,
      averageDifficulty: nonNewCount > 0 ? Math.round((totalDifficulty / nonNewCount) * 100) / 100 : 5,
    };
  }

  // --- Quizzes ---
  async saveQuizzes(quizzes: any[]): Promise<void> {
    await this.putMany(STORES.QUIZZES, quizzes);
    await this.updateMetadata(STORES.QUIZZES);
  }

  async getQuizzes(): Promise<any[]> {
    return this.getAll(STORES.QUIZZES);
  }

  async getQuiz(id: string | number): Promise<any> {
    return this.get(STORES.QUIZZES, id);
  }

  async saveQuiz(quiz: any): Promise<any> {
    return this.put(STORES.QUIZZES, quiz);
  }

  async deleteQuiz(id: string | number): Promise<void> {
    return this.delete(STORES.QUIZZES, id);
  }

  async getQuizzesBySubject(subjectId: number): Promise<any[]> {
    return this.getByIndex(STORES.QUIZZES, 'subject_id', subjectId);
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

  async saveStudySession(session: any): Promise<any> {
    return this.put(STORES.STUDY_SESSIONS, session);
  }

  async getStudySessions(): Promise<any[]> {
    return this.getAll(STORES.STUDY_SESSIONS);
  }

  async getStudySession(id: string | number): Promise<any> {
    return this.get(STORES.STUDY_SESSIONS, id);
  }

  async deleteStudySession(id: string | number): Promise<void> {
    return this.delete(STORES.STUDY_SESSIONS, id);
  }

  async getTodayStudySessions(): Promise<any[]> {
    const sessions = await this.getAll<any>(STORES.STUDY_SESSIONS);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return sessions.filter(s => {
      const sessionDate = new Date(s.created_at || s.started_at);
      sessionDate.setHours(0, 0, 0, 0);
      return sessionDate.getTime() === today.getTime();
    });
  }

  async getTodayStudyStats(): Promise<{ total_sessions: number; total_minutes: number }> {
    const todaySessions = await this.getTodayStudySessions();
    const completedSessions = todaySessions.filter(s => s.status === 'completed' || s.completed_at);
    const totalMinutes = completedSessions.reduce((sum, s) => sum + (s.actual_duration_minutes || s.duration_minutes || 0), 0);
    return {
      total_sessions: completedSessions.length,
      total_minutes: totalMinutes,
    };
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

  // --- Documents (métadonnées) ---
  async saveDocuments(documents: any[]): Promise<void> {
    await this.putMany(STORES.DOCUMENTS, documents);
    await this.updateMetadata(STORES.DOCUMENTS);
  }

  async getDocuments(): Promise<any[]> {
    return this.getAll(STORES.DOCUMENTS);
  }

  async getDocument(id: number): Promise<any> {
    return this.get(STORES.DOCUMENTS, id);
  }

  async saveDocument(document: any): Promise<any> {
    return this.put(STORES.DOCUMENTS, document);
  }

  async deleteDocument(id: number): Promise<void> {
    return this.delete(STORES.DOCUMENTS, id);
  }

  async getDocumentsBySubject(subjectId: number): Promise<any[]> {
    return this.getByIndex(STORES.DOCUMENTS, 'subject_id', subjectId);
  }

  // --- Exam Sessions (Mode Examen) ---
  async saveExamSessions(sessions: any[]): Promise<void> {
    await this.putMany(STORES.EXAM_SESSIONS, sessions);
    await this.updateMetadata(STORES.EXAM_SESSIONS);
  }

  async getExamSessions(): Promise<any[]> {
    return this.getAll(STORES.EXAM_SESSIONS);
  }

  async getExamSession(id: number): Promise<any> {
    return this.get(STORES.EXAM_SESSIONS, id);
  }

  async saveExamSession(session: any): Promise<any> {
    return this.put(STORES.EXAM_SESSIONS, session);
  }

  async deleteExamSession(id: number): Promise<void> {
    return this.delete(STORES.EXAM_SESSIONS, id);
  }

  async getActiveExamSession(): Promise<any | null> {
    const sessions = await this.getAll<any>(STORES.EXAM_SESSIONS);
    return sessions.find(s => s.status === 'active') || null;
  }

  // --- Exam Tasks (Tâches Mode Examen) ---
  async saveExamTasks(tasks: any[]): Promise<void> {
    await this.putMany(STORES.EXAM_TASKS, tasks);
  }

  async getExamTasks(sessionId?: number): Promise<any[]> {
    if (sessionId) {
      return this.getByIndex(STORES.EXAM_TASKS, 'session_id', sessionId);
    }
    return this.getAll(STORES.EXAM_TASKS);
  }

  async getExamTask(id: number): Promise<any> {
    return this.get(STORES.EXAM_TASKS, id);
  }

  async saveExamTask(task: any): Promise<any> {
    return this.put(STORES.EXAM_TASKS, task);
  }

  async getTodayExamTasks(sessionId: number): Promise<any[]> {
    const tasks = await this.getByIndex<any>(STORES.EXAM_TASKS, 'session_id', sessionId);
    const today = new Date().toISOString().split('T')[0];
    return tasks.filter(t => {
      const taskDate = t.scheduled_date || t.study_date;
      return taskDate && taskDate.startsWith(today);
    });
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
