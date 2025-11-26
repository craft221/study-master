/**
 * Group Content Service
 * API calls for sharing content within study groups
 */

import api from '@/lib/api'

export interface SharedNote {
  id: number
  note_id: number
  note_title: string
  note_content: string
  shared_by_user_id: number
  shared_by_username: string
  shared_at: string
  subject_name?: string
}

export interface SharedFlashcardDeck {
  id: number
  deck_id: number
  deck_name: string
  card_count: number
  shared_by_user_id: number
  shared_by_username: string
  shared_at: string
}

export interface GroupSession {
  id: number
  title: string
  description: string
  session_type: 'pomodoro' | 'study' | 'revision' | 'exam_prep'
  start_time: string
  duration_minutes: number
  created_by_user_id: number
  created_by_username: string
  participants: Array<{
    user_id: number
    username: string
    joined_at: string
  }>
  status: 'scheduled' | 'active' | 'completed' | 'cancelled'
}

export interface GroupQuiz {
  id: number
  quiz_id: number
  quiz_title: string
  question_count: number
  shared_by_user_id: number
  shared_by_username: string
  shared_at: string
  completed_by_count: number
}

// ============================================
// SHARED NOTES
// ============================================

/**
 * Share a note with the group
 */
export async function shareNoteWithGroup(groupId: number, noteId: number) {
  const response = await api.post(`/study-groups/${groupId}/share-note`, {
    note_id: noteId
  })
  return response.data
}

/**
 * Get all notes shared in the group
 */
export async function getSharedNotes(groupId: number): Promise<SharedNote[]> {
  const response = await api.get(`/study-groups/${groupId}/shared-notes`)
  return response.data
}

/**
 * Remove a shared note from the group
 */
export async function unshareNote(groupId: number, sharedNoteId: number) {
  await api.delete(`/study-groups/${groupId}/shared-notes/${sharedNoteId}`)
}

// ============================================
// SHARED FLASHCARDS
// ============================================

/**
 * Share a flashcard deck with the group
 */
export async function shareFlashcardsWithGroup(groupId: number, deckId: number) {
  const response = await api.post(`/study-groups/${groupId}/share-flashcards`, {
    deck_id: deckId
  })
  return response.data
}

/**
 * Get all flashcard decks shared in the group
 */
export async function getSharedFlashcards(groupId: number): Promise<SharedFlashcardDeck[]> {
  const response = await api.get(`/study-groups/${groupId}/shared-flashcards`)
  return response.data
}

/**
 * Copy shared flashcards to own collection
 */
export async function copySharedFlashcards(groupId: number, sharedDeckId: number) {
  const response = await api.post(`/study-groups/${groupId}/copy-flashcards/${sharedDeckId}`)
  return response.data
}

// ============================================
// GROUP SESSIONS
// ============================================

/**
 * Create a group study session
 */
export async function createGroupSession(groupId: number, sessionData: {
  title: string
  description?: string
  session_type: string
  start_time: string
  duration_minutes: number
}) {
  const response = await api.post(`/study-groups/${groupId}/sessions`, sessionData)
  return response.data
}

/**
 * Get all group sessions
 */
export async function getGroupSessions(groupId: number): Promise<GroupSession[]> {
  const response = await api.get(`/study-groups/${groupId}/sessions`)
  return response.data
}

/**
 * Join a group session
 */
export async function joinGroupSession(groupId: number, sessionId: number) {
  const response = await api.post(`/study-groups/${groupId}/sessions/${sessionId}/join`)
  return response.data
}

/**
 * Leave a group session
 */
export async function leaveGroupSession(groupId: number, sessionId: number) {
  await api.post(`/study-groups/${groupId}/sessions/${sessionId}/leave`)
}

/**
 * Cancel a group session (creator only)
 */
export async function cancelGroupSession(groupId: number, sessionId: number) {
  await api.delete(`/study-groups/${groupId}/sessions/${sessionId}`)
}

// ============================================
// SHARED QUIZZES
// ============================================

/**
 * Share a quiz with the group
 */
export async function shareQuizWithGroup(groupId: number, quizId: number) {
  const response = await api.post(`/study-groups/${groupId}/share-quiz`, {
    quiz_id: quizId
  })
  return response.data
}

/**
 * Get all quizzes shared in the group
 */
export async function getSharedQuizzes(groupId: number): Promise<GroupQuiz[]> {
  const response = await api.get(`/study-groups/${groupId}/shared-quizzes`)
  return response.data
}

// ============================================
// GROUP ACTIVITIES
// ============================================

export interface GroupActivity {
  id: number
  activity_type: 'note_shared' | 'flashcard_shared' | 'session_created' | 'quiz_shared' | 'member_joined'
  user_id: number
  username: string
  description: string
  created_at: string
  metadata?: any
}

/**
 * Get recent group activities
 */
export async function getGroupActivities(groupId: number, limit: number = 20): Promise<GroupActivity[]> {
  const response = await api.get(`/study-groups/${groupId}/activities`, {
    params: { limit }
  })
  return response.data
}
