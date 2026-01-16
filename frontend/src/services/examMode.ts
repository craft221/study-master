/**
 * Service Exam Mode - API Client pour la préparation aux examens
 */

import api from '@/lib/api'

// ==================== TYPES ====================

export type ExamSessionStatus = 'planning' | 'active' | 'paused' | 'completed' | 'abandoned'
export type StudyTaskType = 'read' | 'flashcards' | 'quiz' | 'review' | 'practice_exam' | 'summary' | 'weak_points'
export type StudyTaskStatus = 'pending' | 'in_progress' | 'completed' | 'skipped'
export type DifficultyLevel = 'easy' | 'medium' | 'hard'

export interface StudyTask {
  id: number
  task_type: StudyTaskType
  order: number
  title: string
  description: string | null
  note_id: number | null
  quiz_id: number | null
  flashcard_deck_id: number | null
  estimated_minutes: number
  actual_minutes: number
  target_score: number
  achieved_score: number | null
  items_count: number
  status: StudyTaskStatus
  created_at: string
  started_at: string | null
  completed_at: string | null
}

export interface StudyDay {
  id: number
  day_number: number
  study_date: string
  title: string
  description: string | null
  chapters: string[]
  note_ids: number[]
  is_review_day: boolean
  is_practice_exam_day: boolean
  is_rest_day: boolean
  estimated_minutes: number
  actual_minutes: number
  is_completed: boolean
  completed_at: string | null
  tasks_completed: number
  tasks_total: number
  score: number | null
  is_today: boolean
  is_past: boolean
  is_future: boolean
  progress_percentage: number
  tasks: StudyTask[]
}

export interface ExamSession {
  id: number
  user_id: number
  exam_name: string
  exam_description: string | null
  exam_date: string
  exam_time: string | null
  subject_id: number | null
  subject_name: string | null
  note_ids: number[]
  document_ids: number[]
  total_content_pages: number
  total_content_words: number
  study_hours_per_day: number
  preferred_study_times: string[]
  include_weekends: boolean
  difficulty_level: DifficultyLevel
  status: ExamSessionStatus
  current_day: number
  total_days: number
  tasks_completed: number
  tasks_total: number
  progress_percentage: number
  predicted_score: number | null
  confidence_level: number | null
  total_study_minutes: number
  total_flashcards_reviewed: number
  total_quizzes_taken: number
  average_quiz_score: number
  weak_points: string[]
  strong_points: string[]
  notifications_enabled: boolean
  reminder_time: string
  days_until_exam: number
  is_urgent: boolean
  is_overdue: boolean
  created_at: string
  updated_at: string
  started_at: string | null
  completed_at: string | null
}

export interface ExamSessionDetail extends ExamSession {
  study_days: StudyDay[]
  today_tasks: StudyTask[]
  upcoming_tasks: StudyTask[]
}

export interface ExamSessionListResponse {
  sessions: ExamSession[]
  total: number
  active_count: number
  completed_count: number
}

export interface ExamModeStats {
  total_exams_prepared: number
  total_exams_completed: number
  average_preparation_days: number
  average_predicted_score: number
  total_study_hours: number
  current_active_exams: number
  upcoming_exams_count: number
  best_score_achieved: number | null
  longest_streak_days: number
  xp_earned_from_exam_mode: number
}

export interface DayProgress {
  exam_session_id: number
  exam_name: string
  days_until_exam: number
  today: StudyDay
  tasks_remaining: number
  estimated_time_remaining: number
  streak_days: number
  is_on_track: boolean
  motivation_message: string
}

export interface Prediction {
  exam_session_id: number
  predicted_score: number
  confidence_level: number
  factors: Record<string, any>
  recommendations: string[]
}

export interface PremiumStatus {
  is_premium: boolean
  can_create_exam: boolean
  active_exams_count: number
  max_active_exams: number
  features_available: string[]
  features_locked: string[]
  upgrade_message: string | null
}

export interface WizardStep1 {
  subjects: Array<{ id: number; name: string; color: string; notes_count: number }>
  suggested_hours: number
}

export interface WizardStep2 {
  notes: Array<{ id: number; title: string; word_count: number; subject_name: string }>
  total_words: number
  estimated_pages: number
  suggested_days: number
}

export interface WizardStep3 {
  plan_preview: Array<{
    day_number: number
    study_date: string
    title: string
    is_review_day: boolean
    is_practice_exam_day: boolean
    tasks_count: number
    estimated_minutes: number
  }>
  total_days: number
  total_tasks: number
  estimated_hours: number
  predicted_readiness: number
}

export interface ExamSessionCreate {
  exam_name: string
  exam_description?: string
  exam_date: string
  exam_time?: string
  subject_id?: number
  note_ids: number[]
  document_ids?: number[]
  study_hours_per_day?: number
  preferred_study_times?: string[]
  include_weekends?: boolean
  difficulty_level?: DifficultyLevel
  notifications_enabled?: boolean
  reminder_time?: string
}

export interface ExamSessionUpdate {
  exam_name?: string
  exam_description?: string
  exam_date?: string
  exam_time?: string
  study_hours_per_day?: number
  preferred_study_times?: string[]
  include_weekends?: boolean
  difficulty_level?: DifficultyLevel
  notifications_enabled?: boolean
  reminder_time?: string
  status?: ExamSessionStatus
}

export interface ExamModeNotification {
  id: number
  notification_type: string
  title: string
  message: string
  exam_session_id: number
  exam_name: string | null
  is_read: boolean
  created_at: string
}

// ==================== TYPES IA ====================

export interface KeyPointsConcept {
  nom: string
  definition: string
  importance: number
}

export interface KeyPointsFormula {
  titre: string
  formule: string
  contexte: string
}

export interface KeyPointsLink {
  de: string
  vers: string
  relation: string
}

export interface KeyPointsPriority {
  sujet: string
  priorite: number
  raison: string
}

export interface KeyPointsTrap {
  piege: string
  prevention: string
}

export interface KeyPointsAnalysis {
  session_id: number
  exam_name: string
  concepts_cles: KeyPointsConcept[]
  formules_memoriser: KeyPointsFormula[]
  liens_conceptuels: KeyPointsLink[]
  priorites_revision: KeyPointsPriority[]
  pieges_courants: KeyPointsTrap[]
}

export interface WeakPoint {
  type: string
  subject: string
  score_moyen: number
  severite: 'haute' | 'moyenne' | 'basse'
}

export interface WeakPointsAnalysis {
  session_id: number
  exam_name: string
  weak_points: WeakPoint[]
  performance_summary: {
    tasks_analyzed: number
    average_score: number
    low_score_count: number
    time_issues_count: number
  }
  detailed_issues: {
    low_scores: Array<{ task: string; type: string; score: number; note: string | null }>
    time_issues: Array<{ task: string; estimated: number; actual: number }>
  }
  recommendations: string[]
}

export interface PersonalizedAdvice {
  session_id: number
  exam_name: string
  strategie_globale: string
  focus_prioritaire: string[]
  methodes_recommandees: Array<{
    methode: string
    pourquoi: string
    comment: string
  }>
  planning_suggere: {
    aujourd_hui: string
    cette_semaine: string
    avant_examen: string
  }
  message_motivation: string
  conseils_specifiques: string[]
  context: {
    days_left: number
    progress: number
    learning_style: string
  }
}

export interface PlanAdaptation {
  session_id: number
  exam_name: string
  status: 'adapted' | 'no_changes'
  progress_analysis: {
    current_progress: number
    expected_progress: number
    gap: number
    status: 'en_avance' | 'en_retard' | 'dans_les_temps'
  }
  adaptations: Array<{
    type: string
    action: string
    description: string
  }>
  new_tasks: Array<{
    day: number
    task: string
  }>
  days_affected: number
}

export interface GeneratedContent {
  success: boolean
  task_id: number
  generated: boolean
  quiz: { id: number; title: string; source: string } | null
  flashcard_deck: { id: number; title: string; source: string } | null
  message: string
}

export interface PracticeExamResult {
  success: boolean
  quiz_id: number
  title: string
  duration_minutes: number
  question_count: number
  message: string
}

export interface AISummary {
  session_id: number
  exam_name: string
  exam_date: string
  days_until_exam: number
  progress_percentage: number
  prediction: {
    predicted_score: number
    confidence_level: number
  }
  key_points_summary: KeyPointsConcept[]
  weak_points_summary: WeakPoint[]
  top_recommendations: string[]
  motivation_message: string
  readiness_status: 'ready' | 'preparing' | 'early_stage'
}

// ==================== SERVICE ====================

export const examModeService = {
  // === Sessions ===

  /**
   * Créer une nouvelle session d'examen
   */
  async createSession(data: ExamSessionCreate): Promise<ExamSessionDetail> {
    const response = await api.post('/exam-mode/', data)
    return response.data
  },

  /**
   * Récupérer toutes les sessions de l'utilisateur
   */
  async getSessions(status?: ExamSessionStatus): Promise<ExamSessionListResponse> {
    const params = status ? { status } : {}
    const response = await api.get('/exam-mode/', { params })
    return response.data
  },

  /**
   * Récupérer les sessions actives
   */
  async getActiveSessions(): Promise<ExamSession[]> {
    const response = await api.get('/exam-mode/active')
    return response.data
  },

  /**
   * Récupérer les détails d'une session
   */
  async getSession(sessionId: number): Promise<ExamSessionDetail> {
    const response = await api.get(`/exam-mode/${sessionId}`)
    return response.data
  },

  /**
   * Mettre à jour une session
   */
  async updateSession(sessionId: number, data: ExamSessionUpdate): Promise<ExamSession> {
    const response = await api.put(`/exam-mode/${sessionId}`, data)
    return response.data
  },

  /**
   * Supprimer une session
   */
  async deleteSession(sessionId: number): Promise<void> {
    await api.delete(`/exam-mode/${sessionId}`)
  },

  /**
   * Démarrer une session (passer de planning à active)
   */
  async startSession(sessionId: number): Promise<ExamSession> {
    const response = await api.post(`/exam-mode/${sessionId}/start`)
    return response.data
  },

  /**
   * Mettre en pause une session
   */
  async pauseSession(sessionId: number): Promise<ExamSession> {
    const response = await api.post(`/exam-mode/${sessionId}/pause`)
    return response.data
  },

  /**
   * Reprendre une session pausée
   */
  async resumeSession(sessionId: number): Promise<ExamSession> {
    const response = await api.post(`/exam-mode/${sessionId}/resume`)
    return response.data
  },

  /**
   * Abandonner une session
   */
  async abandonSession(sessionId: number): Promise<ExamSession> {
    const response = await api.post(`/exam-mode/${sessionId}/abandon`)
    return response.data
  },

  // === Tâches ===

  /**
   * Démarrer une tâche
   */
  async startTask(taskId: number): Promise<StudyTask> {
    const response = await api.post(`/exam-mode/tasks/${taskId}/start`)
    return response.data
  },

  /**
   * Compléter une tâche
   */
  async completeTask(taskId: number, score?: number, actualMinutes?: number): Promise<StudyTask> {
    const response = await api.post(`/exam-mode/tasks/${taskId}/complete`, {
      score,
      actual_minutes: actualMinutes
    })
    return response.data
  },

  /**
   * Passer une tâche
   */
  async skipTask(taskId: number, reason?: string): Promise<StudyTask> {
    const response = await api.post(`/exam-mode/tasks/${taskId}/skip`, { reason })
    return response.data
  },

  // === Progression ===

  /**
   * Récupérer la progression du jour
   */
  async getTodayProgress(): Promise<DayProgress | null> {
    const response = await api.get('/exam-mode/today')
    return response.data
  },

  /**
   * Récupérer la prédiction de réussite
   */
  async getPrediction(sessionId: number): Promise<Prediction> {
    const response = await api.get(`/exam-mode/${sessionId}/prediction`)
    return response.data
  },

  /**
   * Récupérer les statistiques globales
   */
  async getStats(): Promise<ExamModeStats> {
    const response = await api.get('/exam-mode/stats/me')
    return response.data
  },

  // === Wizard ===

  /**
   * Récupérer les données de l'étape 1 du wizard
   */
  async getWizardStep1(): Promise<WizardStep1> {
    const response = await api.get('/exam-mode/wizard/step1')
    return response.data
  },

  /**
   * Récupérer les données de l'étape 2 du wizard
   */
  async getWizardStep2(subjectId: number): Promise<WizardStep2> {
    const response = await api.get(`/exam-mode/wizard/step2/${subjectId}`)
    return response.data
  },

  // === Premium ===

  /**
   * Vérifier le statut premium
   */
  async getPremiumStatus(): Promise<PremiumStatus> {
    const response = await api.get('/exam-mode/premium-status')
    return response.data
  },

  // === Notifications ===

  /**
   * Récupérer les notifications Exam Mode
   */
  async getNotifications(sessionId?: number): Promise<ExamModeNotification[]> {
    const params = sessionId ? { session_id: sessionId } : {}
    const response = await api.get('/exam-mode/notifications', { params })
    return response.data
  },

  /**
   * Marquer une notification comme lue
   */
  async markNotificationRead(notificationId: number): Promise<void> {
    await api.post(`/exam-mode/notifications/${notificationId}/read`)
  },

  // === Helpers ===

  /**
   * Formater la durée en heures et minutes
   */
  formatDuration(minutes: number): string {
    if (minutes < 60) {
      return `${minutes}min`
    }
    const hours = Math.floor(minutes / 60)
    const mins = minutes % 60
    return mins > 0 ? `${hours}h ${mins}min` : `${hours}h`
  },

  /**
   * Obtenir la couleur du statut
   */
  getStatusColor(status: ExamSessionStatus): string {
    const colors: Record<ExamSessionStatus, string> = {
      planning: 'text-blue-500',
      active: 'text-green-500',
      paused: 'text-yellow-500',
      completed: 'text-purple-500',
      abandoned: 'text-gray-500'
    }
    return colors[status] || 'text-gray-500'
  },

  /**
   * Obtenir l'icône du type de tâche
   */
  getTaskTypeIcon(type: StudyTaskType): string {
    const icons: Record<StudyTaskType, string> = {
      read: '📖',
      flashcards: '🃏',
      quiz: '❓',
      review: '🔄',
      practice_exam: '📝',
      summary: '📋',
      weak_points: '🎯'
    }
    return icons[type] || '📚'
  },

  /**
   * Obtenir le label du type de tâche
   */
  getTaskTypeLabel(type: StudyTaskType): string {
    const labels: Record<StudyTaskType, string> = {
      read: 'Lecture',
      flashcards: 'Flashcards',
      quiz: 'Quiz',
      review: 'Révision',
      practice_exam: 'Examen blanc',
      summary: 'Résumé',
      weak_points: 'Points faibles'
    }
    return labels[type] || type
  },

  /**
   * Obtenir la couleur selon la progression
   */
  getProgressColor(progress: number): string {
    if (progress >= 80) return 'text-green-500'
    if (progress >= 50) return 'text-yellow-500'
    if (progress >= 25) return 'text-orange-500'
    return 'text-red-500'
  },

  /**
   * Obtenir le message d'urgence
   */
  getUrgencyMessage(daysUntilExam: number): { message: string; color: string } | null {
    if (daysUntilExam <= 0) {
      return { message: "C'est le jour J !", color: 'text-purple-500' }
    }
    if (daysUntilExam === 1) {
      return { message: 'Demain !', color: 'text-red-500' }
    }
    if (daysUntilExam <= 3) {
      return { message: `J-${daysUntilExam}`, color: 'text-orange-500' }
    }
    if (daysUntilExam <= 7) {
      return { message: `J-${daysUntilExam}`, color: 'text-yellow-500' }
    }
    return null
  },

  // ==================== FONCTIONNALITÉS IA (PREMIUM) ====================

  /**
   * Générer le contenu IA pour une tâche (quiz ou flashcards)
   * PREMIUM: Lie les ressources existantes ou génère avec IA
   */
  async generateTaskContent(taskId: number): Promise<GeneratedContent> {
    const response = await api.post(`/exam-mode/tasks/${taskId}/generate-content`)
    return response.data
  },

  /**
   * Analyse IA des points clés du contenu
   * PREMIUM: Identifie concepts, formules, liens conceptuels
   */
  async getKeyPointsAnalysis(sessionId: number): Promise<KeyPointsAnalysis> {
    const response = await api.get(`/exam-mode/${sessionId}/key-points`)
    return response.data
  },

  /**
   * Détection des points faibles basée sur les performances
   * PREMIUM: Analyse les résultats pour identifier les lacunes
   */
  async getWeakPointsAnalysis(sessionId: number): Promise<WeakPointsAnalysis> {
    const response = await api.get(`/exam-mode/${sessionId}/weak-points`)
    return response.data
  },

  /**
   * Conseils personnalisés de révision
   * PREMIUM: Stratégie, méthodes, planning adaptés au profil
   */
  async getPersonalizedAdvice(sessionId: number): Promise<PersonalizedAdvice> {
    const response = await api.get(`/exam-mode/${sessionId}/personalized-advice`)
    return response.data
  },

  /**
   * Adapter dynamiquement le plan d'étude
   * PREMIUM: Ajuste le plan selon la progression et les points faibles
   */
  async adaptStudyPlan(sessionId: number): Promise<PlanAdaptation> {
    const response = await api.post(`/exam-mode/${sessionId}/adapt-plan`)
    return response.data
  },

  /**
   * Générer un examen blanc complet
   * PREMIUM: Crée un examen basé sur tout le contenu avec focus points faibles
   */
  async generatePracticeExam(sessionId: number, durationMinutes: number = 60): Promise<PracticeExamResult> {
    const response = await api.post(`/exam-mode/${sessionId}/generate-practice-exam`, null, {
      params: { duration_minutes: durationMinutes }
    })
    return response.data
  },

  /**
   * Résumé IA complet de la session
   * PREMIUM: Combine toutes les analyses en un rapport
   */
  async getAISummary(sessionId: number): Promise<AISummary> {
    const response = await api.get(`/exam-mode/${sessionId}/ai-summary`)
    return response.data
  }
}

export default examModeService
