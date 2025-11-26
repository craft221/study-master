import api from '@/lib/api'

export interface FlashcardGenerateRequest {
  note_id: number
  count?: number
  difficulty?: 'easy' | 'medium' | 'hard'
}

export interface QuizGenerateRequest {
  note_id: number
  num_questions?: number
  difficulty?: 'easy' | 'medium' | 'hard'
  include_multiple_choice?: boolean
  include_true_false?: boolean
  include_short_answer?: boolean
}

export interface SummarizeNoteRequest {
  note_id: number
  max_length?: number
}

export interface SummarizeNoteResponse {
  summary: string
  note_title: string
  word_count: number
  ai_requests_remaining: number
}

export interface ExtractKeywordsRequest {
  note_id: number
  max_keywords?: number
}

export interface ExtractKeywordsResponse {
  keywords: string[]
  note_title: string
  ai_requests_remaining: number
}

export interface ExplainConceptRequest {
  concept: string
  context?: string
  detail_level?: 'simple' | 'detailed' | 'expert'
}

export interface ExplainConceptResponse {
  explanation: string
  examples: string[]
  related_concepts: string[]
  ai_requests_remaining: number
}

export interface AIQuotaResponse {
  requests_today: number
  daily_limit: number
  requests_remaining: number
  subscription_type: string
  next_reset: string
}

export const aiService = {
  // Generate flashcards from note content
  generateFlashcards: async (
    data: FlashcardGenerateRequest
  ): Promise<any> => {
    const response = await api.post('/ai/generate-flashcards', data)
    return response.data
  },

  // Generate quiz from note content
  generateQuiz: async (data: QuizGenerateRequest): Promise<any> => {
    const response = await api.post('/ai/generate-quiz', data)
    return response.data
  },

  // Summarize note content
  summarizeNote: async (
    data: SummarizeNoteRequest
  ): Promise<SummarizeNoteResponse> => {
    const response = await api.post('/ai/summarize-note', data)
    return response.data
  },

  // Extract keywords from note
  extractKeywords: async (
    data: ExtractKeywordsRequest
  ): Promise<ExtractKeywordsResponse> => {
    const response = await api.post('/ai/extract-keywords', data)
    return response.data
  },

  // Get explanation of a concept
  explainConcept: async (
    data: ExplainConceptRequest
  ): Promise<ExplainConceptResponse> => {
    const response = await api.post('/ai/explain-concept', data)
    return response.data
  },

  // Get AI quota information
  getQuota: async (): Promise<AIQuotaResponse> => {
    const response = await api.get('/ai/quota')
    return response.data
  },

  // Chat with AI (existing)
  chat: async (message: string, context?: string): Promise<any> => {
    const response = await api.post('/ai/chat', { message, context })
    return response.data
  },

  // Index note for RAG (existing)
  indexNote: async (noteId: number): Promise<any> => {
    const response = await api.post(`/ai/index-note/${noteId}`)
    return response.data
  },

  // Get RAG stats (existing)
  getRagStats: async (): Promise<any> => {
    const response = await api.get('/ai/rag/stats')
    return response.data
  },
}
