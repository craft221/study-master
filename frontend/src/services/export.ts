import api from '@/lib/api'

export const exportService = {
  // Export single note to PDF
  exportNote: async (
    noteId: number,
    includeMetadata: boolean = true
  ): Promise<Blob> => {
    const response = await api.get(`/export/note/${noteId}`, {
      params: { include_metadata: includeMetadata },
      responseType: 'blob',
    })
    return response.data
  },

  // Export multiple notes to single PDF
  exportNotesBatch: async (noteIds: number[]): Promise<Blob> => {
    const response = await api.post(
      '/export/notes/batch',
      { note_ids: noteIds },
      { responseType: 'blob' }
    )
    return response.data
  },

  // Export all notes from a subject
  exportSubjectNotes: async (subjectId: number): Promise<Blob> => {
    const response = await api.get(`/export/subject/${subjectId}/notes`, {
      responseType: 'blob',
    })
    return response.data
  },

  // Export flashcards from subject
  exportFlashcards: async (subjectId: number): Promise<Blob> => {
    const response = await api.get(`/export/flashcards/${subjectId}`, {
      responseType: 'blob',
    })
    return response.data
  },

  // Export selected flashcards
  exportFlashcardsBatch: async (flashcardIds: number[]): Promise<Blob> => {
    const response = await api.post(
      '/export/flashcards/batch',
      { flashcard_ids: flashcardIds },
      { responseType: 'blob' }
    )
    return response.data
  },

  // Get export statistics
  getStats: async (): Promise<any> => {
    const response = await api.get('/export/stats')
    return response.data
  },

  // Helper to download blob as file
  downloadBlob: (blob: Blob, filename: string) => {
    const url = window.URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = filename
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    window.URL.revokeObjectURL(url)
  },
}
