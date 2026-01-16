/**
 * FSRS (Free Spaced Repetition Scheduler) - TypeScript Implementation
 * ====================================================================
 *
 * Un algorithme de répétition espacée moderne basé sur la recherche
 * scientifique en sciences cognitives et apprentissage automatique.
 *
 * FSRS offre une amélioration significative par rapport à SM-2:
 * - ~30% moins de révisions pour le même taux de rétention
 * - Adaptation personnalisée basée sur l'historique
 * - Modélisation précise de la mémoire avec stabilité et récupérabilité
 *
 * Référence: https://github.com/open-spaced-repetition/fsrs4anki
 *
 * Port TypeScript du backend Python (fsrs_service.py)
 */

// ============== ENUMS ==============

export enum Rating {
  AGAIN = 0,  // Échec complet - réapprendre
  HARD = 1,   // Difficile mais correct
  GOOD = 2,   // Correct avec effort normal
  EASY = 3,   // Facile, parfaitement mémorisé
}

export enum State {
  NEW = 0,        // Jamais révisée
  LEARNING = 1,   // En cours d'apprentissage initial
  REVIEW = 2,     // En révision normale (long terme)
  RELEARNING = 3, // Réapprentissage après un échec
}

// ============== INTERFACES ==============

export interface FSRSParameters {
  // Stabilités initiales pour chaque niveau de difficulté
  w0: number;  // Stabilité après "Again"
  w1: number;  // Stabilité après "Hard"
  w2: number;  // Stabilité après "Good"
  w3: number;  // Stabilité après "Easy"

  // Difficulté initiale
  w4: number;  // Difficulté de base

  // Modificateurs de difficulté
  w5: number;  // Impact de la note sur la difficulté
  w6: number;  // Mean reversion

  // Facteurs de stabilité après succès
  w7: number;   // Modificateur pour "Hard"
  w8: number;   // Multiplicateur de base
  w9: number;   // Impact difficulté sur croissance
  w10: number;  // Decay factor
  w11: number;  // Bonus pour "Easy"

  // Facteurs après échec
  w12: number;  // Multiplicateur après échec
  w13: number;  // Impact difficulté en réapprentissage
  w14: number;  // Bonus mémoire résiduelle
  w15: number;  // Bonus récupérabilité

  // Modificateur "Hard"
  w16: number;  // Pénalité Hard

  // Paramètres de planification
  requestRetention: number;  // Rétention cible (0.9 = 90%)
  maximumInterval: number;   // Intervalle max en jours

  // Étapes d'apprentissage (minutes)
  learningSteps: number[];
  relearningSteps: number[];

  // Fuzzing
  enableFuzz: boolean;
  fuzzFactor: number;
}

export interface FSRSCard {
  stability: number;
  difficulty: number;
  elapsedDays: number;
  scheduledDays: number;
  reps: number;
  lapses: number;
  state: State;
  lastReview: Date | null;
  due: Date | null;
  retrievability: number;
}

export interface ReviewLog {
  rating: Rating;
  state: string;
  stability: number;
  difficulty: number;
  elapsedDays: number;
  scheduledDays: number;
  retrievability: number;
  reviewedAt: string;
}

export interface SchedulingOption {
  intervalDays: number;
  due: string | null;
  stability: number;
  difficulty: number;
  state: string;
  display: string;
}

export interface SchedulingOptions {
  again: SchedulingOption;
  hard: SchedulingOption;
  good: SchedulingOption;
  easy: SchedulingOption;
}

// ============== DEFAULT PARAMETERS ==============

export const DEFAULT_PARAMETERS: FSRSParameters = {
  // Stabilités initiales (optimisées par ML)
  w0: 0.4,
  w1: 0.6,
  w2: 2.4,
  w3: 5.8,

  // Difficulté
  w4: 4.93,
  w5: 0.94,
  w6: 0.86,

  // Stabilité après succès
  w7: 0.01,
  w8: 1.49,
  w9: 0.14,
  w10: 0.94,
  w11: 2.18,

  // Stabilité après échec
  w12: 0.05,
  w13: 0.34,
  w14: 1.26,
  w15: 0.29,

  // Hard penalty
  w16: 2.61,

  // Planification
  requestRetention: 0.9,
  maximumInterval: 36500,

  // Étapes
  learningSteps: [1, 10],
  relearningSteps: [10],

  // Fuzzing
  enableFuzz: true,
  fuzzFactor: 0.05,
};

// ============== FSRS SCHEDULER CLASS ==============

export class FSRSScheduler {
  private params: FSRSParameters;

  constructor(params?: Partial<FSRSParameters>) {
    this.params = { ...DEFAULT_PARAMETERS, ...params };
  }

  /**
   * Calcule la récupérabilité actuelle (probabilité de rappel)
   */
  getRetrievability(card: FSRSCard, now: Date = new Date()): number {
    if (card.stability <= 0 || card.lastReview === null) {
      return card.state === State.NEW ? 1.0 : 0.0;
    }

    const elapsed = (now.getTime() - card.lastReview.getTime()) / (1000 * 60 * 60 * 24);
    if (elapsed <= 0) return 1.0;

    // Constante de décroissance pour rétention de 90%
    const decayConstant = 19 / 81;

    // Power law decay (Ebbinghaus modifié)
    const retrievability = Math.pow(
      1 + (decayConstant * elapsed) / card.stability,
      -1 / decayConstant
    );

    return Math.max(0.0, Math.min(1.0, retrievability));
  }

  /**
   * Planifie la prochaine révision
   */
  schedule(card: FSRSCard, rating: Rating, now: Date = new Date()): { card: FSRSCard; log: ReviewLog } {
    // Calculer les jours écoulés
    let elapsedDays = 0;
    if (card.lastReview !== null) {
      elapsedDays = Math.max(0, Math.floor((now.getTime() - card.lastReview.getTime()) / (1000 * 60 * 60 * 24)));
    }

    // Créer une copie de la carte
    const newCard: FSRSCard = {
      ...card,
      elapsedDays,
      retrievability: this.getRetrievability(card, now),
    };

    // Traiter selon l'état
    let updatedCard: FSRSCard;
    if (newCard.state === State.NEW) {
      updatedCard = this.handleNewCard(newCard, rating, now);
    } else if (newCard.state === State.LEARNING || newCard.state === State.RELEARNING) {
      updatedCard = this.handleLearningCard(newCard, rating, now);
    } else {
      updatedCard = this.handleReviewCard(newCard, rating, now);
    }

    // Mettre à jour les stats
    updatedCard.reps += 1;
    updatedCard.lastReview = now;

    // Créer le log
    const log: ReviewLog = {
      rating,
      state: State[updatedCard.state],
      stability: updatedCard.stability,
      difficulty: updatedCard.difficulty,
      elapsedDays,
      scheduledDays: updatedCard.scheduledDays,
      retrievability: newCard.retrievability,
      reviewedAt: now.toISOString(),
    };

    return { card: updatedCard, log };
  }

  /**
   * Traite une nouvelle carte
   */
  private handleNewCard(card: FSRSCard, rating: Rating, now: Date): FSRSCard {
    const newCard = { ...card };

    // Initialiser difficulté et stabilité
    newCard.difficulty = this.initDifficulty(rating);
    newCard.stability = this.initStability(rating);

    if (rating === Rating.AGAIN) {
      newCard.state = State.LEARNING;
      newCard.lapses += 1;
      newCard.scheduledDays = 0;
      newCard.due = new Date(now.getTime() + this.params.learningSteps[0] * 60 * 1000);
    } else if (rating === Rating.HARD) {
      newCard.state = State.LEARNING;
      newCard.scheduledDays = 0;
      newCard.due = new Date(now.getTime() + this.params.learningSteps[0] * 60 * 1000);
    } else if (rating === Rating.GOOD) {
      newCard.state = State.REVIEW;
      newCard.scheduledDays = this.nextInterval(newCard.stability);
      newCard.due = new Date(now.getTime() + newCard.scheduledDays * 24 * 60 * 60 * 1000);
    } else { // EASY
      newCard.state = State.REVIEW;
      newCard.scheduledDays = this.nextInterval(newCard.stability * 2);
      newCard.due = new Date(now.getTime() + newCard.scheduledDays * 24 * 60 * 60 * 1000);
    }

    return newCard;
  }

  /**
   * Traite une carte en apprentissage
   */
  private handleLearningCard(card: FSRSCard, rating: Rating, now: Date): FSRSCard {
    const newCard = { ...card };
    const steps = card.state === State.LEARNING
      ? this.params.learningSteps
      : this.params.relearningSteps;

    if (rating === Rating.AGAIN) {
      newCard.lapses += 1;
      newCard.scheduledDays = 0;
      newCard.due = new Date(now.getTime() + steps[0] * 60 * 1000);

      if (newCard.stability > 0) {
        newCard.stability = this.nextForgetStability(
          newCard.difficulty,
          newCard.stability,
          newCard.retrievability
        );
      }
    } else if (rating === Rating.HARD) {
      newCard.scheduledDays = 0;
      newCard.due = new Date(now.getTime() + steps[0] * 60 * 1000);
    } else if (rating === Rating.GOOD) {
      newCard.state = State.REVIEW;

      if (newCard.stability > 0) {
        newCard.stability = this.nextRecallStability(
          newCard.difficulty,
          newCard.stability,
          newCard.retrievability,
          rating
        );
      } else {
        newCard.stability = this.initStability(rating);
      }

      newCard.scheduledDays = this.nextInterval(newCard.stability);
      newCard.due = new Date(now.getTime() + newCard.scheduledDays * 24 * 60 * 60 * 1000);
    } else { // EASY
      newCard.state = State.REVIEW;

      if (newCard.stability > 0) {
        newCard.stability = this.nextRecallStability(
          newCard.difficulty,
          newCard.stability,
          newCard.retrievability,
          rating
        );
      } else {
        newCard.stability = this.initStability(rating);
      }

      newCard.stability *= 1.5;
      newCard.scheduledDays = this.nextInterval(newCard.stability);
      newCard.due = new Date(now.getTime() + newCard.scheduledDays * 24 * 60 * 60 * 1000);
    }

    // Mettre à jour la difficulté
    newCard.difficulty = this.nextDifficulty(newCard.difficulty, rating);

    return newCard;
  }

  /**
   * Traite une carte en révision
   */
  private handleReviewCard(card: FSRSCard, rating: Rating, now: Date): FSRSCard {
    const newCard = { ...card };
    const retrievability = this.getRetrievability(card, now);

    if (rating === Rating.AGAIN) {
      newCard.state = State.RELEARNING;
      newCard.lapses += 1;

      newCard.stability = this.nextForgetStability(
        newCard.difficulty,
        newCard.stability,
        retrievability
      );

      newCard.scheduledDays = 0;
      newCard.due = new Date(now.getTime() + this.params.relearningSteps[0] * 60 * 1000);
    } else {
      newCard.stability = this.nextRecallStability(
        newCard.difficulty,
        newCard.stability,
        retrievability,
        rating
      );

      newCard.scheduledDays = this.nextInterval(newCard.stability);
      newCard.due = new Date(now.getTime() + newCard.scheduledDays * 24 * 60 * 60 * 1000);
    }

    newCard.difficulty = this.nextDifficulty(newCard.difficulty, rating);

    return newCard;
  }

  /**
   * Difficulté initiale
   * D0(G) = w4 - e^(w5 * (G - 1)) + 1
   */
  private initDifficulty(rating: Rating): number {
    const difficulty = this.params.w4 - Math.exp(this.params.w5 * (rating - 1)) + 1;
    return Math.max(1.0, Math.min(10.0, difficulty));
  }

  /**
   * Stabilité initiale
   * S0(G) = w[G]
   */
  private initStability(rating: Rating): number {
    const stabilityMap: Record<Rating, number> = {
      [Rating.AGAIN]: this.params.w0,
      [Rating.HARD]: this.params.w1,
      [Rating.GOOD]: this.params.w2,
      [Rating.EASY]: this.params.w3,
    };
    return stabilityMap[rating];
  }

  /**
   * Nouvelle difficulté après révision
   * D'(D, G) = w6 * D0(3) + (1 - w6) * (D - w5 * (G - 3))
   */
  private nextDifficulty(difficulty: number, rating: Rating): number {
    const d0Ref = this.initDifficulty(Rating.GOOD);
    const delta = -this.params.w5 * (rating - 3);
    const newDifficulty = this.params.w6 * d0Ref + (1 - this.params.w6) * (difficulty + delta);
    return Math.max(1.0, Math.min(10.0, newDifficulty));
  }

  /**
   * Stabilité après rappel réussi
   * S'(D, S, R, G) = S * (e^w8 * (11 - D) * S^(-w9) * (e^(w10 * (1-R)) - 1) * penalty * bonus + 1)
   */
  private nextRecallStability(
    difficulty: number,
    stability: number,
    retrievability: number,
    rating: Rating
  ): number {
    const hardPenalty = rating === Rating.HARD ? this.params.w16 : 1.0;
    const easyBonus = rating === Rating.EASY ? this.params.w11 : 1.0;

    const sinc =
      Math.exp(this.params.w8) *
      (11 - difficulty) *
      Math.pow(stability, -this.params.w9) *
      (Math.exp(this.params.w10 * (1 - retrievability)) - 1) *
      hardPenalty *
      easyBonus;

    let newStability = stability * (sinc + 1);

    if (this.params.enableFuzz && newStability > 2.5) {
      newStability = this.applyFuzz(newStability);
    }

    const maxStability = this.params.maximumInterval / 2;
    return Math.max(0.1, Math.min(maxStability, newStability));
  }

  /**
   * Stabilité après oubli
   * S'(D, S, R) = w12 * D^(-w13) * ((S + 1)^w14 - 1) * e^(w15 * (1 - R))
   */
  private nextForgetStability(
    difficulty: number,
    stability: number,
    retrievability: number
  ): number {
    const newStability =
      this.params.w12 *
      Math.pow(difficulty, -this.params.w13) *
      (Math.pow(stability + 1, this.params.w14) - 1) *
      Math.exp(this.params.w15 * (1 - retrievability));

    return Math.max(0.1, Math.min(stability, newStability));
  }

  /**
   * Calcule l'intervalle optimal
   * I(S, R) = S / FACTOR * ln(R)
   */
  private nextInterval(stability: number): number {
    if (stability <= 0) return 1;

    const decayConstant = 19 / 81;

    let interval = (stability / decayConstant) *
      (Math.pow(1 / this.params.requestRetention, decayConstant) - 1);

    interval = Math.round(interval);

    if (this.params.enableFuzz && interval > 2) {
      interval = Math.round(this.applyFuzz(interval));
    }

    return Math.max(1, Math.min(this.params.maximumInterval, interval));
  }

  /**
   * Applique une variation aléatoire
   */
  private applyFuzz(value: number): number {
    const fuzzRange = value * this.params.fuzzFactor;
    return value + (Math.random() * 2 - 1) * fuzzRange;
  }

  /**
   * Obtient les prévisions pour toutes les options
   */
  getSchedulingOptions(card: FSRSCard, now: Date = new Date()): SchedulingOptions {
    const getOption = (rating: Rating): SchedulingOption => {
      const cardCopy: FSRSCard = { ...card };
      const { card: newCard } = this.schedule(cardCopy, rating, now);
      return {
        intervalDays: newCard.scheduledDays,
        due: newCard.due?.toISOString() || null,
        stability: Math.round(newCard.stability * 100) / 100,
        difficulty: Math.round(newCard.difficulty * 100) / 100,
        state: State[newCard.state],
        display: formatIntervalDisplay(newCard.scheduledDays),
      };
    };

    return {
      again: getOption(Rating.AGAIN),
      hard: getOption(Rating.HARD),
      good: getOption(Rating.GOOD),
      easy: getOption(Rating.EASY),
    };
  }
}

// ============== UTILITY FUNCTIONS ==============

/**
 * Formate un intervalle pour l'affichage
 */
export function formatIntervalDisplay(days: number): string {
  if (days === 0) return '< 10 min';
  if (days === 1) return '1 jour';
  if (days < 7) return `${days} jours`;
  if (days < 14) return '1 semaine';
  if (days < 30) {
    const weeks = Math.floor(days / 7);
    return `${weeks} semaines`;
  }
  if (days < 60) return '1 mois';
  if (days < 365) {
    const months = Math.floor(days / 30);
    return `${months} mois`;
  }
  if (days < 730) return '1 an';
  const years = Math.floor(days / 365);
  return `${years} ans`;
}

/**
 * Crée une carte FSRS depuis les données d'une flashcard existante
 */
export function createFSRSCard(data?: {
  stability?: number;
  difficulty?: number;
  easeFactor?: number;
  interval?: number;
  repetitions?: number;
  status?: string;
  lastReviewedAt?: string | Date | null;
  nextReviewAt?: string | Date | null;
}): FSRSCard {
  if (!data) {
    return {
      stability: 0,
      difficulty: 5.0,
      elapsedDays: 0,
      scheduledDays: 0,
      reps: 0,
      lapses: 0,
      state: State.NEW,
      lastReview: null,
      due: null,
      retrievability: 1.0,
    };
  }

  // Si stabilité et difficulté sont déjà FSRS
  if (data.stability !== undefined && data.difficulty !== undefined) {
    const stateMap: Record<string, State> = {
      'new': State.NEW,
      'learning': State.LEARNING,
      'review': State.REVIEW,
      'relearning': State.RELEARNING,
    };

    return {
      stability: data.stability,
      difficulty: data.difficulty,
      elapsedDays: 0,
      scheduledDays: data.interval || 0,
      reps: data.repetitions || 0,
      lapses: 0,
      state: stateMap[(data.status || 'new').toLowerCase()] || State.NEW,
      lastReview: data.lastReviewedAt ? new Date(data.lastReviewedAt) : null,
      due: data.nextReviewAt ? new Date(data.nextReviewAt) : null,
      retrievability: 1.0,
    };
  }

  // Convertir depuis SM-2
  const easeFactor = data.easeFactor || 2.5;
  const interval = data.interval || 0;
  const repetitions = data.repetitions || 0;

  // Convertir ease_factor (1.3-2.5+) vers difficulté (1-10)
  const difficulty = Math.max(1.0, Math.min(10.0, 11 - (easeFactor * 3)));

  // Estimer stabilité depuis interval
  const stability = interval > 0 ? Math.max(0.1, interval * 0.9) : 0.4;

  const stateMap: Record<string, State> = {
    'new': State.NEW,
    'learning': State.LEARNING,
    'review': State.REVIEW,
    'relearning': State.RELEARNING,
  };

  let state = stateMap[(data.status || 'new').toLowerCase()] || State.NEW;

  if (repetitions === 0) {
    state = State.NEW;
  }

  return {
    stability: repetitions === 0 ? 0 : stability,
    difficulty: repetitions === 0 ? 5.0 : difficulty,
    elapsedDays: 0,
    scheduledDays: interval,
    reps: repetitions,
    lapses: 0,
    state,
    lastReview: data.lastReviewedAt ? new Date(data.lastReviewedAt) : null,
    due: data.nextReviewAt ? new Date(data.nextReviewAt) : null,
    retrievability: 1.0,
  };
}

/**
 * Convertit une carte FSRS vers le format de l'API
 */
export function fsrsCardToApiFormat(card: FSRSCard): {
  stability: number;
  difficulty: number;
  interval_days: number;
  repetitions: number;
  lapses: number;
  state: string;
  last_reviewed_at: string | null;
  next_review_at: string | null;
  retrievability: number;
} {
  return {
    stability: card.stability,
    difficulty: card.difficulty,
    interval_days: card.scheduledDays,
    repetitions: card.reps,
    lapses: card.lapses,
    state: State[card.state].toLowerCase(),
    last_reviewed_at: card.lastReview?.toISOString() || null,
    next_review_at: card.due?.toISOString() || null,
    retrievability: card.retrievability,
  };
}

// ============== STATISTICS ==============

export interface DeckMetrics {
  totalCards: number;
  newCards: number;
  learningCards: number;
  reviewCards: number;
  averageStability: number;
  averageDifficulty: number;
  averageRetrievability: number;
  totalLapses: number;
  retentionEstimate: number;
}

/**
 * Calcule les métriques d'un deck
 */
export function calculateDeckMetrics(cards: FSRSCard[]): DeckMetrics {
  if (cards.length === 0) {
    return {
      totalCards: 0,
      newCards: 0,
      learningCards: 0,
      reviewCards: 0,
      averageStability: 0,
      averageDifficulty: 0,
      averageRetrievability: 0,
      totalLapses: 0,
      retentionEstimate: 0,
    };
  }

  const now = new Date();
  const scheduler = new FSRSScheduler();

  const newCount = cards.filter(c => c.state === State.NEW).length;
  const learningCount = cards.filter(c =>
    c.state === State.LEARNING || c.state === State.RELEARNING
  ).length;
  const reviewCount = cards.filter(c => c.state === State.REVIEW).length;

  const nonNewCards = cards.filter(c => c.state !== State.NEW);

  let avgStability = 0;
  let avgDifficulty = 5.0;
  let avgRetrievability = 1.0;

  if (nonNewCards.length > 0) {
    avgStability = nonNewCards.reduce((sum, c) => sum + c.stability, 0) / nonNewCards.length;
    avgDifficulty = nonNewCards.reduce((sum, c) => sum + c.difficulty, 0) / nonNewCards.length;
    avgRetrievability = nonNewCards.reduce((sum, c) =>
      sum + scheduler.getRetrievability(c, now), 0
    ) / nonNewCards.length;
  }

  const totalLapses = cards.reduce((sum, c) => sum + c.lapses, 0);

  return {
    totalCards: cards.length,
    newCards: newCount,
    learningCards: learningCount,
    reviewCards: reviewCount,
    averageStability: Math.round(avgStability * 100) / 100,
    averageDifficulty: Math.round(avgDifficulty * 100) / 100,
    averageRetrievability: Math.round(avgRetrievability * 1000) / 10,
    totalLapses,
    retentionEstimate: Math.round(avgRetrievability * 1000) / 10,
  };
}

/**
 * Prédit la charge de travail pour les N prochains jours
 */
export function predictWorkload(
  cards: FSRSCard[],
  daysAhead: number = 30
): Record<number, number> {
  const now = new Date();
  const workload: Record<number, number> = {};

  for (let i = 0; i <= daysAhead; i++) {
    workload[i] = 0;
  }

  for (const card of cards) {
    if (card.due === null) {
      workload[0] += 1;
    } else {
      const daysUntilDue = Math.floor(
        (card.due.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
      );

      if (daysUntilDue < 0) {
        workload[0] += 1;
      } else if (daysUntilDue <= daysAhead) {
        workload[daysUntilDue] += 1;
      }
    }
  }

  return workload;
}

// Export singleton instance
export const fsrsScheduler = new FSRSScheduler();

export default FSRSScheduler;
