/**
 * Service Study Groups - API Client pour les groupes d'étude
 */

import api from '@/lib/api'

export type MemberRole = 'owner' | 'admin' | 'member'

export interface GroupMember {
  id: number
  user_id: number
  username: string
  avatar_url: string | null
  role: MemberRole
  joined_at: string
  contribution_score: number
}

export interface StudyGroup {
  id: number
  name: string
  description: string | null
  creator_id: number
  subject_id: number | null
  is_private: boolean
  invite_code: string | null
  max_members: number
  current_members: number
  university: string | null
  promotion: string | null
  total_study_hours: number
  total_shared_notes: number
  created_at: string
  updated_at: string
  members?: GroupMember[]
}

export interface StudyGroupCreate {
  name: string
  description?: string
  subject_id?: number
  is_private?: boolean
  max_members?: number
}

export interface StudyGroupUpdate {
  name?: string
  description?: string
  subject_id?: number
  is_private?: boolean
  max_members?: number
}

export interface StudyGroupListResponse {
  groups: StudyGroup[]
  total: number
  page: number
  page_size: number
}

export type InvitationStatus = 'pending' | 'accepted' | 'declined' | 'expired'

export interface StudyGroupInvitation {
  id: number
  group_id: number
  group_name: string
  inviter_id: number
  inviter_username: string
  inviter_avatar: string | null
  invitee_id: number
  invitee_username: string
  status: InvitationStatus
  message: string | null
  created_at: string
  expires_at: string
  responded_at: string | null
}

export const studyGroupsService = {
  /**
   * Créer un nouveau groupe d'étude
   */
  create: async (data: StudyGroupCreate): Promise<StudyGroup> => {
    const response = await api.post('/study-groups/', data)
    return response.data
  },

  /**
   * Récupérer tous les groupes avec filtres
   */
  getAll: async (params?: {
    page?: number
    page_size?: number
    search?: string
    only_my_groups?: boolean
    subject_id?: number
  }): Promise<StudyGroupListResponse> => {
    const response = await api.get('/study-groups/', { params })
    return response.data
  },

  /**
   * Récupérer un groupe par ID
   */
  getById: async (groupId: number): Promise<StudyGroup> => {
    const response = await api.get(`/study-groups/${groupId}`)
    return response.data
  },

  /**
   * Mettre à jour un groupe
   */
  update: async (groupId: number, data: StudyGroupUpdate): Promise<StudyGroup> => {
    const response = await api.put(`/study-groups/${groupId}`, data)
    return response.data
  },

  /**
   * Rejoindre un groupe
   */
  join: async (groupId: number): Promise<{ success: boolean; message: string }> => {
    const response = await api.post(`/study-groups/${groupId}/join`)
    return response.data
  },

  /**
   * Quitter un groupe
   */
  leave: async (groupId: number): Promise<void> => {
    await api.post(`/study-groups/${groupId}/leave`)
  },

  /**
   * Supprimer un groupe (créateur uniquement)
   */
  delete: async (groupId: number): Promise<void> => {
    await api.delete(`/study-groups/${groupId}`)
  },

  /**
   * Récupérer mes groupes uniquement
   */
  getMyGroups: async (): Promise<StudyGroupListResponse> => {
    const response = await api.get('/study-groups/', { params: { only_my_groups: true } })
    return response.data
  },

  // ==================== INVITATIONS ====================

  /**
   * Inviter un utilisateur dans un groupe
   */
  inviteUser: async (groupId: number, inviteeId: number, message?: string): Promise<StudyGroupInvitation> => {
    const response = await api.post(`/study-groups/${groupId}/invite`, { invitee_id: inviteeId, message })
    return response.data
  },

  /**
   * Récupérer mes invitations reçues en attente
   */
  getMyInvitations: async (): Promise<StudyGroupInvitation[]> => {
    const response = await api.get('/study-groups/invitations/received')
    return response.data
  },

  /**
   * Accepter une invitation
   */
  acceptInvitation: async (invitationId: number): Promise<GroupMember> => {
    const response = await api.post(`/study-groups/invitations/${invitationId}/accept`)
    return response.data
  },

  /**
   * Refuser une invitation
   */
  declineInvitation: async (invitationId: number): Promise<void> => {
    await api.post(`/study-groups/invitations/${invitationId}/decline`)
  }
}

export default studyGroupsService
