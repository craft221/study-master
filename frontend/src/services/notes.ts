import api from '@/lib/api'

export interface Note {
  id: number
  title: string
  content: string
  note_type: 'text' | 'markdown' | 'checklist' | 'kanban'
  tags: string[]
  subject_id: number | null
  parent_id: number | null
  is_pinned: boolean
  is_favorite: boolean
  is_archived: boolean
  user_id: number
  views_count: number
  last_viewed_at: string | null
  created_at: string
  updated_at: string
}

export const notesService = {
  // Search notes
  search: async (query: string): Promise<Note[]> => {
    const response = await api.get('/notes/search', { params: { query } })
    return response.data.notes || response.data
  },

  // Get note with children (hierarchical)
  getWithChildren: async (
    id: number,
    maxDepth?: number
  ): Promise<Note> => {
    const response = await api.get(`/notes/${id}/with-children`, {
      params: { max_depth: maxDepth },
    })
    return response.data
  },

  // Toggle pin
  togglePin: async (id: number): Promise<Note> => {
    const response = await api.post(`/notes/${id}/pin`)
    return response.data
  },

  // Toggle archive
  toggleArchive: async (id: number): Promise<Note> => {
    const response = await api.post(`/notes/${id}/archive`)
    return response.data
  },

  // Get all notes
  getAll: async (params?: {
    subject_id?: number
    note_type?: string
    tags?: string
    is_pinned?: boolean
    is_favorite?: boolean
    is_archived?: boolean
  }): Promise<Note[]> => {
    const response = await api.get('/notes/', { params })
    return response.data.notes || response.data
  },

  // Create note
  create: async (data: Partial<Note>): Promise<Note> => {
    const response = await api.post('/notes/', data)
    return response.data
  },

  // Update note
  update: async (id: number, data: Partial<Note>): Promise<Note> => {
    const response = await api.put(`/notes/${id}`, data)
    return response.data
  },

  // Delete note
  delete: async (id: number): Promise<void> => {
    await api.delete(`/notes/${id}`)
  },

  // Alias for getAll (compatibility)
  getNotes: async (params?: {
    subject_id?: number
    note_type?: string
    tags?: string
    is_pinned?: boolean
    is_favorite?: boolean
    is_archived?: boolean
  }): Promise<Note[]> => {
    const response = await api.get('/notes/', { params })
    return response.data.notes || response.data
  },
}

export default notesService
