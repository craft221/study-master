/**
 * Service Anti-Triche - Client API
 * Surveille les comportements suspects pendant les quiz et duels
 */

import api from '@/lib/api'

// Types
export interface StartSessionResponse {
  session_id: string
  message: string
}

export interface ViolationResponse {
  type: string
  severity: string
  message: string
}

export interface ValidateQuizResponse {
  is_valid: boolean
  violations_count: number
  penalty_xp: number
  is_disqualified: boolean
  warning_message: string | null
  adjusted_score: number | null
  violations: ViolationResponse[]
}

export interface UserReputation {
  trust_score: number
  risk_level: 'low' | 'medium' | 'high'
  violation_count: number
  disqualification_count: number
}

// Service API
export const antiCheatService = {
  /**
   * Démarre une session de surveillance anti-triche
   */
  startSession: async (quizId: number, duelId?: number): Promise<StartSessionResponse> => {
    const response = await api.post('/anti-cheat/session/start', {
      quiz_id: quizId,
      duel_id: duelId
    })
    return response.data
  },

  /**
   * Enregistre une réponse avec son timing
   */
  recordAnswer: async (
    sessionId: string,
    questionId: number,
    answerId: number,
    timeTakenMs: number,
    questionIndex: number
  ): Promise<ViolationResponse | null> => {
    const response = await api.post('/anti-cheat/answer', {
      session_id: sessionId,
      question_id: questionId,
      answer_id: answerId,
      time_taken_ms: timeTakenMs,
      question_index: questionIndex
    })
    return response.data
  },

  /**
   * Enregistre un événement de surveillance
   */
  recordEvent: async (
    sessionId: string,
    eventType: string,
    details?: Record<string, any>
  ): Promise<ViolationResponse | null> => {
    const response = await api.post('/anti-cheat/event', {
      session_id: sessionId,
      event_type: eventType,
      details
    })
    return response.data
  },

  /**
   * Valide la complétion d'un quiz
   */
  validateQuiz: async (
    sessionId: string,
    totalQuestions: number,
    score: number,
    totalTimeSeconds: number
  ): Promise<ValidateQuizResponse> => {
    const response = await api.post('/anti-cheat/validate', {
      session_id: sessionId,
      total_questions: totalQuestions,
      score,
      total_time_seconds: totalTimeSeconds
    })
    return response.data
  },

  /**
   * Récupère la réputation anti-triche de l'utilisateur
   */
  getMyReputation: async (): Promise<UserReputation> => {
    const response = await api.get('/anti-cheat/reputation')
    return response.data
  },

  /**
   * Récupère la réputation d'un autre utilisateur
   */
  getUserReputation: async (userId: number): Promise<UserReputation> => {
    const response = await api.get(`/anti-cheat/reputation/${userId}`)
    return response.data
  }
}

export default antiCheatService
