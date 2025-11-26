import api from '@/lib/api'
import {
  User,
  UserUpdate,
  PasswordChange,
  UserActivityResponse,
} from '@/types/user'

export const usersService = {
  // Get current user profile
  getMe: async (): Promise<User> => {
    const response = await api.get('/users/me/profile')
    return response.data
  },

  // Update current user profile
  updateMe: async (data: UserUpdate): Promise<User> => {
    const response = await api.put('/users/me', data)
    return response.data
  },

  // Change password
  changePassword: async (data: PasswordChange): Promise<void> => {
    await api.put('/users/me/password', data)
  },

  // Upload avatar
  uploadAvatar: async (file: File): Promise<User> => {
    const formData = new FormData()
    formData.append('file', file)
    const response = await api.post('/users/me/avatar', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    })
    return response.data
  },

  // Get user activity
  getActivity: async (days: number = 30): Promise<UserActivityResponse> => {
    const response = await api.get('/users/me/activity', {
      params: { days },
    })
    return response.data
  },

  // Delete account
  deleteAccount: async (): Promise<void> => {
    await api.delete('/users/me')
  },
}
