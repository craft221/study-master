/**
 * FSRS (Free Spaced Repetition Scheduler) - React Native Implementation
 * =====================================================================
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
  w0: number;  w1: number;  w2: number;  w3: number;
  w4: number;  w5: number;  w6: number;
  w7: number;  w8: number;  w9: number;  w10: number;  w11: number;
  w12: number; w13: number; w14: number; w15: number;
  w16: number;
  requestRetention: number;
  maximumInterval: number;
  learningSteps: number[];
  relearningSteps: number[];
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
  w0: 0.4, w1: 0.6, w2: 2.4, w3: 5.8,
  w4: 4.93, w5: 0.94, w6: 0.86,
  w7: 0.01, w8: 1.49, w9: 0.14, w10: 0.94, w11: 2.18,
  w12: 0.05, w13: 0.34, w14: 1.26, w15: 0.29,
  w16: 2.61,
  requestRetention: 0.9,
  maximumInterval: 36500,
  learningSteps: [1, 10],
  relearningSteps: [10],
  enableFuzz: true,
  fuzzFactor: 0.05,
};

// ============== FSRS SCHEDULER CLASS ==============

export class FSRSScheduler {
  private params: FSRSParameters;

  constructor(params?: Partial<FSRSParameters>) {
    this.params = { ...DEFAULT_PARAMETERS, ...params };
  }

  getRetrievability(card: FSRSCard, now: Date = new Date()): number {
    if (card.stability <= 0 || card.lastReview === null) {
      return card.state === State.NEW ? 1.0 : 0.0;
    }

    const elapsed = (now.getTime() - card.lastReview.getTime()) / (1000 * 60 * 60 * 24);
    if (elapsed <= 0) return 1.0;

    const decayConstant = 19 / 81;
    const retrievability = Math.pow(
      1 + (decayConstant * elapsed) / card.stability,
      -1 / decayConstant
    );

    return Math.max(0.0, Math.min(1.0, retrievability));
  }

  schedule(card: FSRSCard, rating: Rating, now: Date = new Date()): { card: FSRSCard; log: ReviewLog } {
    let elapsedDays = 0;
    if (card.lastReview !== null) {
      elapsedDays = Math.max(0, Math.floor((now.getTime() - card.lastReview.getTime()) / (1000 * 60 * 60 * 24)));
    }

    const newCard: FSRSCard = {
      ...card,
      elapsedDays,
      retrievability: this.getRetrievability(card, now),
    };

    let updatedCard: FSRSCard;
    if (newCard.state === State.NEW) {
      updatedCard = this.handleNewCard(newCard, rating, now);
    } else if (newCard.state === State.LEARNING || newCard.state === State.RELEARNING) {
      updatedCard = this.handleLearningCard(newCard, rating, now);
    } else {
      updatedCard = this.handleReviewCard(newCard, rating, now);
    }

    updatedCard.reps += 1;
    updatedCard.lastReview = now;

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

  private handleNewCard(card: FSRSCard, rating: Rating, now: Date): FSRSCard {
    const newCard = { ...card };
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
    } else {
      newCard.state = State.REVIEW;
      newCard.scheduledDays = this.nextInterval(newCard.stability * 2);
      newCard.due = new Date(now.getTime() + newCard.scheduledDays * 24 * 60 * 60 * 1000);
    }

    return newCard;
  }

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
          newCard.difficulty, newCard.stability, newCard.retrievability, rating
        );
      } else {
        newCard.stability = this.initStability(rating);
      }

      newCard.scheduledDays = this.nextInterval(newCard.stability);
      newCard.due = new Date(now.getTime() + newCard.scheduledDays * 24 * 60 * 60 * 1000);
    } else {
      newCard.state = State.REVIEW;

      if (newCard.stability > 0) {
        newCard.stability = this.nextRecallStability(
          newCard.difficulty, newCard.stability, newCard.retrievability, rating
        );
      } else {
        newCard.stability = this.initStability(rating);
      }

      newCard.stability *= 1.5;
      newCard.scheduledDays = this.nextInterval(newCard.stability);
      newCard.due = new Date(now.getTime() + newCard.scheduledDays * 24 * 60 * 60 * 1000);
    }

    newCard.difficulty = this.nextDifficulty(newCard.difficulty, rating);
    return newCard;
  }

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
        newCard.difficulty, newCard.stability, retrievability, rating
      );

      newCard.scheduledDays = this.nextInterval(newCard.stability);
      newCard.due = new Date(now.getTime() + newCard.scheduledDays * 24 * 60 * 60 * 1000);
    }

    newCard.difficulty = this.nextDifficulty(newCard.difficulty, rating);
    return newCard;
  }

  private initDifficulty(rating: Rating): number {
    const difficulty = this.params.w4 - Math.exp(this.params.w5 * (rating - 1)) + 1;
    return Math.max(1.0, Math.min(10.0, difficulty));
  }

  private initStability(rating: Rating): number {
    const stabilityMap: Record<Rating, number> = {
      [Rating.AGAIN]: this.params.w0,
      [Rating.HARD]: this.params.w1,
      [Rating.GOOD]: this.params.w2,
      [Rating.EASY]: this.params.w3,
    };
    return stabilityMap[rating];
  }

  private nextDifficulty(difficulty: number, rating: Rating): number {
    const d0Ref = this.initDifficulty(Rating.GOOD);
    const delta = -this.params.w5 * (rating - 3);
    const newDifficulty = this.params.w6 * d0Ref + (1 - this.params.w6) * (difficulty + delta);
    return Math.max(1.0, Math.min(10.0, newDifficulty));
  }

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

  private applyFuzz(value: number): number {
    const fuzzRange = value * this.params.fuzzFactor;
    return value + (Math.random() * 2 - 1) * fuzzRange;
  }

  getSchedulingOptions(card: FSRSCard, now: Date = new Date()): SchedulingOptions {
    const options: Record<string, SchedulingOption> = {};

    for (const rating of [Rating.AGAIN, Rating.HARD, Rating.GOOD, Rating.EASY]) {
      const cardCopy: FSRSCard = { ...card };
      const { card: newCard } = this.schedule(cardCopy, rating, now);

      const ratingName = Rating[rating].toLowerCase();
      options[ratingName] = {
        intervalDays: newCard.scheduledDays,
        due: newCard.due?.toISOString() || null,
        stability: Math.round(newCard.stability * 100) / 100,
        difficulty: Math.round(newCard.difficulty * 100) / 100,
        state: State[newCard.state],
        display: formatIntervalDisplay(newCard.scheduledDays),
      };
    }

    return options as SchedulingOptions;
  }
}

// ============== UTILITY FUNCTIONS ==============

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

  // Si stabilité et difficulté FSRS existent
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

  const difficulty = Math.max(1.0, Math.min(10.0, 11 - (easeFactor * 3)));
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

// Export singleton instance
export const fsrsScheduler = new FSRSScheduler();

export default FSRSScheduler;
