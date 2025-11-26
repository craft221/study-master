'use client'

import { useState, useEffect, useRef } from 'react'
import {
  User as UserIcon,
  Mail,
  Phone,
  MapPin,
  Building,
  GraduationCap,
  Lock,
  Activity,
  AlertTriangle,
  Camera,
  Save,
  Eye,
  EyeOff,
} from 'lucide-react'
import { usersService } from '@/services/users'
import { User, UserUpdate, PasswordChange } from '@/types/user'
import { toast } from 'react-hot-toast'

type Tab = 'profile' | 'security' | 'activity' | 'danger'

export default function ProfilePage() {
  const [activeTab, setActiveTab] = useState<Tab>('profile')
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [activities, setActivities] = useState<any[]>([])
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Profile form
  const [profileForm, setProfileForm] = useState<UserUpdate>({})

  // Password form
  const [passwordForm, setPasswordForm] = useState<PasswordChange>({
    current_password: '',
    new_password: '',
  })
  const [showPasswords, setShowPasswords] = useState({
    current: false,
    new: false,
  })

  useEffect(() => {
    loadProfile()
  }, [])

  useEffect(() => {
    if (activeTab === 'activity' && user) {
      loadActivity()
    }
  }, [activeTab, user])

  const loadProfile = async () => {
    try {
      setLoading(true)
      const userData = await usersService.getMe()
      setUser(userData)
      setProfileForm({
        email: userData.email,
        full_name: userData.full_name || '',
        bio: userData.bio || '',
        university: userData.university || '',
        major: userData.major || '',
        promotion: userData.promotion || '',
        student_id: userData.student_id || '',
        phone: userData.phone || '',
        country: userData.country || '',
        city: userData.city || '',
        language: userData.language || 'fr',
        theme: userData.theme || 'light',
        notifications_enabled: userData.notifications_enabled ?? true,
      })
    } catch (error: any) {
      toast.error('Erreur lors du chargement du profil')
    } finally {
      setLoading(false)
    }
  }

  const loadActivity = async () => {
    try {
      const response = await usersService.getActivity(30)
      setActivities(response.activities)
    } catch (error: any) {
      toast.error('Erreur lors du chargement de l\'activité')
    }
  }

  const handleProfileSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      setSaving(true)
      const updatedUser = await usersService.updateMe(profileForm)
      setUser(updatedUser)
      toast.success('Profil mis à jour avec succès')
    } catch (error: any) {
      toast.error(error.response?.data?.detail || 'Erreur lors de la mise à jour')
    } finally {
      setSaving(false)
    }
  }

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (file.size > 5 * 1024 * 1024) {
      toast.error('L\'image ne doit pas dépasser 5 Mo')
      return
    }

    try {
      setSaving(true)
      const updatedUser = await usersService.uploadAvatar(file)
      setUser(updatedUser)
      toast.success('Avatar mis à jour')
    } catch (error: any) {
      toast.error('Erreur lors de l\'upload de l\'avatar')
    } finally {
      setSaving(false)
    }
  }

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (passwordForm.new_password.length < 8) {
      toast.error('Le mot de passe doit contenir au moins 8 caractères')
      return
    }

    try {
      setSaving(true)
      await usersService.changePassword(passwordForm)
      toast.success('Mot de passe modifié avec succès')
      setPasswordForm({ current_password: '', new_password: '' })
    } catch (error: any) {
      toast.error(error.response?.data?.detail || 'Erreur lors du changement de mot de passe')
    } finally {
      setSaving(false)
    }
  }

  const handleDeleteAccount = async () => {
    if (
      !confirm(
        'Êtes-vous absolument sûr de vouloir supprimer votre compte ? Cette action est irréversible.'
      )
    )
      return

    const confirmation = prompt('Tapez "SUPPRIMER" pour confirmer :')
    if (confirmation !== 'SUPPRIMER') return

    try {
      await usersService.deleteAccount()
      toast.success('Compte supprimé')
      localStorage.removeItem('access_token')
      localStorage.removeItem('refresh_token')
      window.location.href = '/login'
    } catch (error: any) {
      toast.error('Erreur lors de la suppression du compte')
    }
  }

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto p-6">
        <div className="text-center text-gray-500">Chargement...</div>
      </div>
    )
  }

  if (!user) return null

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-primary-600 to-primary-700 rounded-xl p-8 text-white">
        <div className="flex items-center space-x-6">
          <div className="relative">
            {user.avatar_url ? (
              <img
                src={user.avatar_url}
                alt={user.username}
                className="w-24 h-24 rounded-full border-4 border-white shadow-lg object-cover"
              />
            ) : (
              <div className="w-24 h-24 rounded-full bg-white/20 flex items-center justify-center border-4 border-white shadow-lg">
                <UserIcon className="h-12 w-12" />
              </div>
            )}
            <button
              onClick={() => fileInputRef.current?.click()}
              className="absolute bottom-0 right-0 bg-white text-primary-600 p-2 rounded-full shadow-lg hover:bg-gray-100 transition"
            >
              <Camera className="h-4 w-4" />
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleAvatarChange}
              className="hidden"
            />
          </div>
          <div>
            <h1 className="text-3xl font-bold">{user.username}</h1>
            <p className="text-white/80 mt-1">{user.email}</p>
            <div className="flex items-center space-x-4 mt-3">
              <div className="bg-white/20 px-4 py-2 rounded-lg">
                <span className="font-bold">Niveau {user.level}</span>
              </div>
              <div className="bg-white/20 px-4 py-2 rounded-lg">
                <span className="font-bold">{user.total_xp} XP</span>
              </div>
              <div className="bg-white/20 px-4 py-2 rounded-lg">
                <span className="font-bold">🔥 {user.current_streak} jours</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200">
        <div className="border-b border-gray-200">
          <div className="flex space-x-8 px-6">
            {[
              { id: 'profile', label: 'Profil', icon: UserIcon },
              { id: 'security', label: 'Sécurité', icon: Lock },
              { id: 'activity', label: 'Activité', icon: Activity },
              { id: 'danger', label: 'Zone de danger', icon: AlertTriangle },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as Tab)}
                className={`flex items-center space-x-2 py-4 px-2 border-b-2 transition ${
                  activeTab === tab.id
                    ? 'border-primary-600 text-primary-600 font-semibold'
                    : 'border-transparent text-gray-600 hover:text-gray-900'
                }`}
              >
                <tab.icon className="h-5 w-5" />
                <span>{tab.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Tab Content */}
        <div className="p-6">
          {/* Profile Tab */}
          {activeTab === 'profile' && (
            <form onSubmit={handleProfileSubmit} className="space-y-6">
              <div className="grid md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    <Mail className="h-4 w-4 inline mr-2" />
                    Email
                  </label>
                  <input
                    type="email"
                    value={profileForm.email}
                    onChange={(e) =>
                      setProfileForm({ ...profileForm, email: e.target.value })
                    }
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Nom complet
                  </label>
                  <input
                    type="text"
                    value={profileForm.full_name}
                    onChange={(e) =>
                      setProfileForm({ ...profileForm, full_name: e.target.value })
                    }
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    <Phone className="h-4 w-4 inline mr-2" />
                    Téléphone
                  </label>
                  <input
                    type="tel"
                    value={profileForm.phone}
                    onChange={(e) =>
                      setProfileForm({ ...profileForm, phone: e.target.value })
                    }
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Numéro étudiant
                  </label>
                  <input
                    type="text"
                    value={profileForm.student_id}
                    onChange={(e) =>
                      setProfileForm({ ...profileForm, student_id: e.target.value })
                    }
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    <Building className="h-4 w-4 inline mr-2" />
                    Université
                  </label>
                  <input
                    type="text"
                    value={profileForm.university}
                    onChange={(e) =>
                      setProfileForm({ ...profileForm, university: e.target.value })
                    }
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    <GraduationCap className="h-4 w-4 inline mr-2" />
                    Filière
                  </label>
                  <input
                    type="text"
                    value={profileForm.major}
                    onChange={(e) =>
                      setProfileForm({ ...profileForm, major: e.target.value })
                    }
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Promotion
                  </label>
                  <input
                    type="text"
                    value={profileForm.promotion}
                    onChange={(e) =>
                      setProfileForm({ ...profileForm, promotion: e.target.value })
                    }
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    <MapPin className="h-4 w-4 inline mr-2" />
                    Ville
                  </label>
                  <input
                    type="text"
                    value={profileForm.city}
                    onChange={(e) =>
                      setProfileForm({ ...profileForm, city: e.target.value })
                    }
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Pays
                  </label>
                  <input
                    type="text"
                    value={profileForm.country}
                    onChange={(e) =>
                      setProfileForm({ ...profileForm, country: e.target.value })
                    }
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Langue
                  </label>
                  <select
                    value={profileForm.language}
                    onChange={(e) =>
                      setProfileForm({ ...profileForm, language: e.target.value })
                    }
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  >
                    <option value="fr">Français</option>
                    <option value="en">English</option>
                    <option value="es">Español</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Bio
                </label>
                <textarea
                  rows={4}
                  value={profileForm.bio}
                  onChange={(e) =>
                    setProfileForm({ ...profileForm, bio: e.target.value })
                  }
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  placeholder="Parlez-nous de vous..."
                />
              </div>

              <div className="flex items-center">
                <input
                  type="checkbox"
                  id="notifications"
                  checked={profileForm.notifications_enabled}
                  onChange={(e) =>
                    setProfileForm({
                      ...profileForm,
                      notifications_enabled: e.target.checked,
                    })
                  }
                  className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
                />
                <label
                  htmlFor="notifications"
                  className="ml-2 block text-sm text-gray-700"
                >
                  Activer les notifications
                </label>
              </div>

              <div className="flex justify-end">
                <button
                  type="submit"
                  disabled={saving}
                  className="flex items-center space-x-2 px-6 py-3 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition font-semibold disabled:opacity-50"
                >
                  <Save className="h-5 w-5" />
                  <span>{saving ? 'Enregistrement...' : 'Enregistrer'}</span>
                </button>
              </div>
            </form>
          )}

          {/* Security Tab */}
          {activeTab === 'security' && (
            <form onSubmit={handlePasswordSubmit} className="space-y-6 max-w-md">
              <div>
                <h3 className="text-lg font-bold text-gray-900 mb-4">
                  Changer le mot de passe
                </h3>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Mot de passe actuel
                    </label>
                    <div className="relative">
                      <input
                        type={showPasswords.current ? 'text' : 'password'}
                        value={passwordForm.current_password}
                        onChange={(e) =>
                          setPasswordForm({
                            ...passwordForm,
                            current_password: e.target.value,
                          })
                        }
                        required
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                      />
                      <button
                        type="button"
                        onClick={() =>
                          setShowPasswords({
                            ...showPasswords,
                            current: !showPasswords.current,
                          })
                        }
                        className="absolute right-3 top-1/2 -translate-y-1/2"
                      >
                        {showPasswords.current ? (
                          <EyeOff className="h-5 w-5 text-gray-500" />
                        ) : (
                          <Eye className="h-5 w-5 text-gray-500" />
                        )}
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Nouveau mot de passe
                    </label>
                    <div className="relative">
                      <input
                        type={showPasswords.new ? 'text' : 'password'}
                        value={passwordForm.new_password}
                        onChange={(e) =>
                          setPasswordForm({
                            ...passwordForm,
                            new_password: e.target.value,
                          })
                        }
                        required
                        minLength={8}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                      />
                      <button
                        type="button"
                        onClick={() =>
                          setShowPasswords({
                            ...showPasswords,
                            new: !showPasswords.new,
                          })
                        }
                        className="absolute right-3 top-1/2 -translate-y-1/2"
                      >
                        {showPasswords.new ? (
                          <EyeOff className="h-5 w-5 text-gray-500" />
                        ) : (
                          <Eye className="h-5 w-5 text-gray-500" />
                        )}
                      </button>
                    </div>
                    <p className="text-xs text-gray-500 mt-1">
                      Minimum 8 caractères
                    </p>
                  </div>

                  <button
                    type="submit"
                    disabled={saving}
                    className="w-full px-6 py-3 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition font-semibold disabled:opacity-50"
                  >
                    {saving ? 'Modification...' : 'Modifier le mot de passe'}
                  </button>
                </div>
              </div>
            </form>
          )}

          {/* Activity Tab */}
          {activeTab === 'activity' && (
            <div className="space-y-4">
              <h3 className="text-lg font-bold text-gray-900 mb-4">
                Activité récente (30 derniers jours)
              </h3>
              {activities.length === 0 ? (
                <p className="text-gray-500">Aucune activité récente</p>
              ) : (
                <div className="space-y-3">
                  {activities.map((activity, index) => (
                    <div
                      key={index}
                      className="p-4 bg-gray-50 rounded-lg border border-gray-200"
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-medium text-gray-900">
                            {activity.activity_type}
                          </p>
                          <p className="text-sm text-gray-600">
                            {activity.description}
                          </p>
                        </div>
                        <span className="text-xs text-gray-500">
                          {new Date(activity.created_at).toLocaleDateString('fr-FR')}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Danger Zone Tab */}
          {activeTab === 'danger' && (
            <div className="space-y-6">
              <div className="bg-red-50 border-2 border-red-200 rounded-lg p-6">
                <div className="flex items-start space-x-3">
                  <AlertTriangle className="h-6 w-6 text-red-600 mt-1" />
                  <div className="flex-1">
                    <h3 className="text-lg font-bold text-red-900 mb-2">
                      Supprimer le compte
                    </h3>
                    <p className="text-sm text-red-700 mb-4">
                      Une fois votre compte supprimé, toutes vos données seront
                      définitivement perdues. Cette action est irréversible.
                    </p>
                    <button
                      onClick={handleDeleteAccount}
                      className="px-6 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 transition font-semibold"
                    >
                      Supprimer mon compte
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
