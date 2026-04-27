'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import dynamic from 'next/dynamic'
import {
  User,
  Mail,
  Lock,
  Bell,
  Palette,
  Trash2,
  Save,
  Camera,
  MapPin,
  Phone,
  GraduationCap,
  Crown,
  AlertTriangle
} from 'lucide-react'
import toast from 'react-hot-toast'
import api from '@/lib/api'
import { wsService } from '@/services/websocket'
import { useTranslation } from '@/contexts/LanguageContext'
import { LanguageSelector } from '@/components/ui/LanguageSelector'

// Imports dynamiques pour éviter les erreurs d'hydratation
const UniversitySelect = dynamic(() => import('@/components/ui/UniversitySelect'), {
  ssr: false,
  loading: () => (
    <div className="h-11 w-full rounded-lg border border-gray-300 bg-gray-50 animate-pulse" />
  )
})

const MajorCombobox = dynamic(
  () => import('@/components/ui/combobox').then(mod => ({ default: mod.MajorCombobox })),
  {
    ssr: false,
    loading: () => (
      <div className="h-11 w-full rounded-lg border border-gray-300 bg-gray-50 animate-pulse" />
    )
  }
)

interface UserProfile {
  id: number
  email: string
  username: string
  full_name: string | null
  bio: string | null
  avatar_url: string | null
  university: string | null
  major: string | null
  promotion: string | null
  student_id: string | null
  phone: string | null
  country: string | null
  city: string | null
  language: string | null
  theme: string | null
  notifications_enabled: boolean
  email_notifications: boolean
  subscription_type: string
  is_verified: boolean
}

export default function SettingsPage() {
  const router = useRouter()
  const { t } = useTranslation()
  const [activeTab, setActiveTab] = useState('profile')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [profileData, setProfileData] = useState({
    full_name: '',
    bio: '',
    university: '',
    major: '',
    promotion: '',
    student_id: '',
    phone: '',
    country: '',
    city: '',
  })
  const [accountData, setAccountData] = useState({
    email: '',
    username: '',
  })
  const [preferencesData, setPreferencesData] = useState({
    language: 'fr',
    theme: 'light',
    notifications_enabled: true,
  })
  const [passwordData, setPasswordData] = useState({
    current_password: '',
    new_password: '',
    confirm_password: '',
  })
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [notifPrefs, setNotifPrefs] = useState({
    email_enabled: true,
    push_enabled: true,
    in_app_enabled: true,
    duel_notifications: true,
    calendar_notifications: true,
    streak_notifications: true,
    study_reminders: true,
    achievement_notifications: true,
    social_notifications: true,
    quiet_hours_start: 22,
    quiet_hours_end: 8,
    email_digest: false,
    email_digest_hour: 18,
  })

  useEffect(() => {
    fetchProfile()
    fetchNotifPrefs()
  }, [])

  const fetchProfile = async () => {
    try {
      const response = await api.get('/users/me/profile')
      const data = response.data
      setProfile(data)

      setProfileData({
        full_name: data.full_name || '',
        bio: data.bio || '',
        university: data.university || '',
        major: data.major || '',
        promotion: data.promotion || '',
        student_id: data.student_id || '',
        phone: data.phone || '',
        country: data.country || '',
        city: data.city || '',
      })

      setAccountData({
        email: data.email,
        username: data.username,
      })

      setPreferencesData({
        language: data.language || 'fr',
        theme: data.theme || 'light',
        notifications_enabled: data.notifications_enabled ?? true,
      })
    } catch (error) {
      console.error('Erreur lors de la récupération du profil:', error)
      toast.error(t('settings.loadError'))
    } finally {
      setLoading(false)
    }
  }

  const fetchNotifPrefs = async () => {
    try {
      const response = await api.get('/notifications/preferences')
      const data = response.data
      setNotifPrefs({
        email_enabled: data.email_enabled ?? true,
        push_enabled: data.push_enabled ?? true,
        in_app_enabled: data.in_app_enabled ?? true,
        duel_notifications: data.duel_notifications ?? true,
        calendar_notifications: data.calendar_notifications ?? true,
        streak_notifications: data.streak_notifications ?? true,
        study_reminders: data.study_reminders ?? true,
        achievement_notifications: data.achievement_notifications ?? true,
        social_notifications: data.social_notifications ?? true,
        quiet_hours_start: data.quiet_hours_start ?? 22,
        quiet_hours_end: data.quiet_hours_end ?? 8,
        email_digest: data.email_digest ?? false,
        email_digest_hour: data.email_digest_hour ?? 18,
      })
    } catch (error) {
      // Si pas encore de préférences, garder les valeurs par défaut
      console.log('Notification preferences not yet created')
    }
  }

  const handleSaveNotifPrefs = async () => {
    setSaving(true)
    try {
      await api.patch('/notifications/preferences', notifPrefs)
      toast.success(t('settings.saveChanges'))
      fetchNotifPrefs()
    } catch (error: any) {
      toast.error(error.response?.data?.detail || t('errors.generic'))
    } finally {
      setSaving(false)
    }
  }

  const handleSaveProfile = async () => {
    setSaving(true)
    try {
      await api.put('/users/me', profileData)
      toast.success(t('settings.profileUpdatedSuccess'))
      fetchProfile()
    } catch (error: any) {
      toast.error(error.response?.data?.detail || t('settings.profileUpdateError'))
    } finally {
      setSaving(false)
    }
  }

  const handleSaveAccount = async () => {
    setSaving(true)
    try {
      await api.put('/users/me', {
        email: accountData.email,
      })
      toast.success(t('settings.accountUpdatedSuccess'))
      fetchProfile()
    } catch (error: any) {
      toast.error(error.response?.data?.detail || t('settings.profileUpdateError'))
    } finally {
      setSaving(false)
    }
  }

  const handleSavePreferences = async () => {
    setSaving(true)
    try {
      await api.put('/users/me', preferencesData)
      toast.success(t('settings.preferencesUpdated'))

      // Appliquer le thème immédiatement
      if (preferencesData.theme === 'dark') {
        document.documentElement.classList.add('dark')
        localStorage.setItem('darkMode', 'true')
      } else {
        document.documentElement.classList.remove('dark')
        localStorage.setItem('darkMode', 'false')
      }

      fetchProfile()
    } catch (error: any) {
      toast.error(error.response?.data?.detail || t('settings.profileUpdateError'))
    } finally {
      setSaving(false)
    }
  }

  const handleChangePassword = async () => {
    if (passwordData.new_password !== passwordData.confirm_password) {
      toast.error(t('settings.passwordsDoNotMatch'))
      return
    }

    if (passwordData.new_password.length < 8) {
      toast.error(t('settings.passwordMin8'))
      return
    }

    setSaving(true)
    try {
      await api.put('/users/me/password', {
        current_password: passwordData.current_password,
        new_password: passwordData.new_password,
        confirm_password: passwordData.confirm_password,
      })
      toast.success(t('settings.passwordChangedSuccess'))
      setPasswordData({ current_password: '', new_password: '', confirm_password: '' })
    } catch (error: any) {
      toast.error(error.response?.data?.detail || t('settings.passwordChangeError'))
    } finally {
      setSaving(false)
    }
  }

  const handleDeleteAccount = async () => {
    setSaving(true)
    try {
      await api.delete('/users/me')
      toast.success(t('settings.accountDeleted'))
      wsService.disconnect()
      localStorage.clear()
      router.push('/login')
    } catch (error: any) {
      toast.error(error.response?.data?.detail || t('settings.deleteError'))
    } finally {
      setSaving(false)
      setShowDeleteConfirm(false)
    }
  }

  const tabs = [
    { id: 'profile', name: t('profile.title'), icon: User },
    { id: 'account', name: t('settings.account'), icon: Mail },
    { id: 'preferences', name: t('settings.appearance'), icon: Palette },
    { id: 'notifications', name: t('settings.notifications'), icon: Bell },
    { id: 'security', name: t('auth.password'), icon: Lock },
  ]

  if (loading) {
    return (
      <div className="animate-pulse space-y-6">
        <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-1/4"></div>
        <div className="h-64 bg-gray-200 dark:bg-gray-700 rounded"></div>
      </div>
    )
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">{t('settings.title')}</h1>
        <p className="mt-2 text-gray-600 dark:text-gray-400">
          {t('profile.editProfile')}
        </p>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200 dark:border-gray-700">
        <nav className="flex space-x-8">
          {tabs.map((tab) => {
            const Icon = tab.icon
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`
                  flex items-center space-x-2 py-4 px-1 border-b-2 font-medium text-sm transition-colors
                  ${
                    activeTab === tab.id
                      ? 'border-primary-500 text-primary-600 dark:text-primary-400'
                      : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
                  }
                `}
              >
                <Icon className="w-5 h-5" />
                <span>{tab.name}</span>
              </button>
            )
          })}
        </nav>
      </div>

      {/* Content */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6">
        {/* Profile Tab */}
        {activeTab === 'profile' && (
          <div className="space-y-6">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">{t('profile.title')}</h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  {t('settings.fullName')}
                </label>
                <input
                  type="text"
                  value={profileData.full_name}
                  onChange={(e) => setProfileData({ ...profileData, full_name: e.target.value })}
                  className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-primary-500"
                  placeholder={t('settings.fullNamePlaceholder')}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  <Phone className="w-4 h-4 inline mr-1" />
                  {t('settings.phone')}
                </label>
                <input
                  type="tel"
                  value={profileData.phone}
                  onChange={(e) => setProfileData({ ...profileData, phone: e.target.value })}
                  className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-primary-500"
                  placeholder={t('settings.phonePlaceholder')}
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                {t('settings.bio')}
              </label>
              <textarea
                value={profileData.bio}
                onChange={(e) => setProfileData({ ...profileData, bio: e.target.value })}
                rows={4}
                className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-primary-500"
                placeholder={t('settings.bioPlaceholder')}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  <GraduationCap className="w-4 h-4 inline mr-1" />
                  {t('settings.university')}
                </label>
                <UniversitySelect
                  value={profileData.university}
                  onChange={(value) => setProfileData({ ...profileData, university: value })}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  {t('settings.major')}
                </label>
                <MajorCombobox
                  value={profileData.major}
                  onChange={(value) => setProfileData({ ...profileData, major: value })}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  {t('settings.promotion')}
                </label>
                <input
                  type="text"
                  value={profileData.promotion}
                  onChange={(e) => setProfileData({ ...profileData, promotion: e.target.value })}
                  className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-primary-500"
                  placeholder={t('settings.promotionPlaceholder')}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  {t('settings.studentId')}
                </label>
                <input
                  type="text"
                  value={profileData.student_id}
                  onChange={(e) => setProfileData({ ...profileData, student_id: e.target.value })}
                  className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-primary-500"
                  placeholder={t('settings.studentIdPlaceholder')}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  <MapPin className="w-4 h-4 inline mr-1" />
                  {t('settings.country')}
                </label>
                <input
                  type="text"
                  value={profileData.country}
                  onChange={(e) => setProfileData({ ...profileData, country: e.target.value })}
                  className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-primary-500"
                  placeholder={t('settings.countryPlaceholder')}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  {t('settings.city')}
                </label>
                <input
                  type="text"
                  value={profileData.city}
                  onChange={(e) => setProfileData({ ...profileData, city: e.target.value })}
                  className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-primary-500"
                  placeholder={t('settings.cityPlaceholder')}
                />
              </div>
            </div>

            <div className="pt-4">
              <button
                onClick={handleSaveProfile}
                disabled={saving}
                className="bg-primary-600 hover:bg-primary-700 text-white px-6 py-3 rounded-lg font-medium flex items-center space-x-2 disabled:opacity-50"
              >
                <Save className="w-5 h-5" />
                <span>{saving ? t('settings.savingButton') : t('settings.saveChanges')}</span>
              </button>
            </div>
          </div>
        )}

        {/* Account Tab */}
        {activeTab === 'account' && (
          <div className="space-y-6">
            <div>
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white">{t('settings.accountInfo')}</h2>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                {t('settings.manageLogin')}
              </p>
            </div>

            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
              <div className="flex items-start space-x-3">
                <Crown className="w-5 h-5 text-blue-600 dark:text-blue-400 mt-0.5" />
                <div>
                  <p className="font-medium text-blue-900 dark:text-blue-100">
                    {t('settings.subscriptionLabel', { type: profile?.subscription_type === 'premium' ? t('settings.subscriptionPremium') : t('settings.subscriptionFree') })}
                  </p>
                  <p className="text-sm text-blue-700 dark:text-blue-300 mt-1">
                    {profile?.subscription_type === 'free'
                      ? t('settings.upgradeMessage')
                      : t('settings.thanksForSupport')}
                  </p>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  {t('settings.username')}
                </label>
                <input
                  type="text"
                  value={accountData.username}
                  disabled
                  className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-gray-100 dark:bg-gray-900 text-gray-500 dark:text-gray-400 cursor-not-allowed"
                />
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  {t('settings.usernameCannotChange')}
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  {t('settings.email')}
                </label>
                <input
                  type="email"
                  value={accountData.email}
                  onChange={(e) => setAccountData({ ...accountData, email: e.target.value })}
                  className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-primary-500"
                />
              </div>
            </div>

            <div className="pt-4">
              <button
                onClick={handleSaveAccount}
                disabled={saving}
                className="bg-primary-600 hover:bg-primary-700 text-white px-6 py-3 rounded-lg font-medium flex items-center space-x-2 disabled:opacity-50"
              >
                <Save className="w-5 h-5" />
                <span>{saving ? t('settings.savingButton') : t('settings.saveButton')}</span>
              </button>
            </div>
          </div>
        )}

        {/* Preferences Tab */}
        {activeTab === 'preferences' && (
          <div className="space-y-6">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">{t('settings.appearance')}</h2>

            <div className="space-y-4">
              <div>
                <LanguageSelector variant="select" showLabel={true} />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  <Palette className="w-4 h-4 inline mr-1" />
                  {t('settings.theme')}
                </label>
                <select
                  value={preferencesData.theme}
                  onChange={(e) => setPreferencesData({ ...preferencesData, theme: e.target.value })}
                  className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-primary-500"
                >
                  <option value="light">{t('settings.lightTheme')}</option>
                  <option value="dark">{t('settings.darkTheme')}</option>
                  <option value="auto">{t('settings.systemTheme')}</option>
                </select>
              </div>

              <div className="flex items-center justify-between py-4 border-t border-gray-200 dark:border-gray-700">
                <div>
                  <p className="font-medium text-gray-900 dark:text-white">
                    <Bell className="w-4 h-4 inline mr-1" />
                    {t('settings.notifications')}
                  </p>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    {t('settings.pushNotifications')}
                  </p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={preferencesData.notifications_enabled}
                    onChange={(e) => setPreferencesData({ ...preferencesData, notifications_enabled: e.target.checked })}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary-300 dark:peer-focus:ring-primary-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-primary-600"></div>
                </label>
              </div>
            </div>

            <div className="pt-4">
              <button
                onClick={handleSavePreferences}
                disabled={saving}
                className="bg-primary-600 hover:bg-primary-700 text-white px-6 py-3 rounded-lg font-medium flex items-center space-x-2 disabled:opacity-50"
              >
                <Save className="w-5 h-5" />
                <span>{saving ? t('common.loading') : t('settings.saveChanges')}</span>
              </button>
            </div>
          </div>
        )}

        {/* Notifications Tab */}
        {activeTab === 'notifications' && (
          <div className="space-y-6">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">{t('settings.notifications')}</h2>

            {/* Canaux */}
            <div className="space-y-1">
              <h3 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">{t('settings.notifChannels')}</h3>
              <div className="space-y-3 mt-3">
                {([
                  { key: 'email_enabled', label: t('settings.channelEmail'), desc: t('settings.channelEmailDesc') },
                  { key: 'push_enabled', label: t('settings.channelPush'), desc: t('settings.channelPushDesc') },
                  { key: 'in_app_enabled', label: t('settings.channelInApp'), desc: t('settings.channelInAppDesc') },
                ] as const).map(({ key, label, desc }) => (
                  <div key={key} className="flex items-center justify-between py-3 border-b border-gray-100 dark:border-gray-700">
                    <div>
                      <p className="font-medium text-gray-900 dark:text-white">{label}</p>
                      <p className="text-sm text-gray-500 dark:text-gray-400">{desc}</p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={notifPrefs[key]}
                        onChange={(e) => setNotifPrefs({ ...notifPrefs, [key]: e.target.checked })}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary-300 dark:peer-focus:ring-primary-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-primary-600"></div>
                    </label>
                  </div>
                ))}
              </div>
            </div>

            {/* Catégories */}
            <div className="space-y-1">
              <h3 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">{t('settings.notifCategories')}</h3>
              <div className="space-y-3 mt-3">
                {([
                  { key: 'duel_notifications', label: t('settings.catDuels'), desc: t('settings.catDuelsDesc') },
                  { key: 'calendar_notifications', label: t('settings.catCalendar'), desc: t('settings.catCalendarDesc') },
                  { key: 'streak_notifications', label: t('settings.catStreak'), desc: t('settings.catStreakDesc') },
                  { key: 'study_reminders', label: t('settings.catReviews'), desc: t('settings.catReviewsDesc') },
                  { key: 'achievement_notifications', label: t('settings.catAchievements'), desc: t('settings.catAchievementsDesc') },
                  { key: 'social_notifications', label: t('settings.catSocial'), desc: t('settings.catSocialDesc') },
                ] as const).map(({ key, label, desc }) => (
                  <div key={key} className="flex items-center justify-between py-3 border-b border-gray-100 dark:border-gray-700">
                    <div>
                      <p className="font-medium text-gray-900 dark:text-white">{label}</p>
                      <p className="text-sm text-gray-500 dark:text-gray-400">{desc}</p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={notifPrefs[key]}
                        onChange={(e) => setNotifPrefs({ ...notifPrefs, [key]: e.target.checked })}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary-300 dark:peer-focus:ring-primary-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-primary-600"></div>
                    </label>
                  </div>
                ))}
              </div>
            </div>

            {/* Email Digest */}
            <div className="space-y-1">
              <h3 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">{t('settings.dailyDigest')}</h3>
              <div className="mt-3">
                <div className="flex items-center justify-between py-3 border-b border-gray-100 dark:border-gray-700">
                  <div>
                    <p className="font-medium text-gray-900 dark:text-white">{t('settings.emailDigest')}</p>
                    <p className="text-sm text-gray-500 dark:text-gray-400">{t('settings.emailDigestDesc')}</p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={notifPrefs.email_digest}
                      onChange={(e) => setNotifPrefs({ ...notifPrefs, email_digest: e.target.checked })}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary-300 dark:peer-focus:ring-primary-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-primary-600"></div>
                  </label>
                </div>
                {notifPrefs.email_digest && (
                  <div className="py-3">
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      {t('settings.digestSendTime')}
                    </label>
                    <select
                      value={notifPrefs.email_digest_hour}
                      onChange={(e) => setNotifPrefs({ ...notifPrefs, email_digest_hour: parseInt(e.target.value) })}
                      className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-primary-500"
                    >
                      {Array.from({ length: 24 }, (_, i) => (
                        <option key={i} value={i}>{String(i).padStart(2, '0')}:00</option>
                      ))}
                    </select>
                  </div>
                )}
              </div>
            </div>

            {/* Heures de silence */}
            <div className="space-y-1">
              <h3 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">{t('settings.quietHours')}</h3>
              <p className="text-sm text-gray-500 dark:text-gray-400">{t('settings.quietHoursDesc')}</p>
              <div className="grid grid-cols-2 gap-4 mt-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">{t('settings.quietStart')}</label>
                  <select
                    value={notifPrefs.quiet_hours_start}
                    onChange={(e) => setNotifPrefs({ ...notifPrefs, quiet_hours_start: parseInt(e.target.value) })}
                    className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-primary-500"
                  >
                    {Array.from({ length: 24 }, (_, i) => (
                      <option key={i} value={i}>{String(i).padStart(2, '0')}:00</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">{t('settings.quietEnd')}</label>
                  <select
                    value={notifPrefs.quiet_hours_end}
                    onChange={(e) => setNotifPrefs({ ...notifPrefs, quiet_hours_end: parseInt(e.target.value) })}
                    className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-primary-500"
                  >
                    {Array.from({ length: 24 }, (_, i) => (
                      <option key={i} value={i}>{String(i).padStart(2, '0')}:00</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            <div className="pt-4">
              <button
                onClick={handleSaveNotifPrefs}
                disabled={saving}
                className="bg-primary-600 hover:bg-primary-700 text-white px-6 py-3 rounded-lg font-medium flex items-center space-x-2 disabled:opacity-50"
              >
                <Save className="w-5 h-5" />
                <span>{saving ? t('common.loading') : t('settings.saveChanges')}</span>
              </button>
            </div>
          </div>
        )}

        {/* Security Tab */}
        {activeTab === 'security' && (
          <div className="space-y-8">
            <div>
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white">{t('auth.password')}</h2>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                {t('settings.changePassword')}
              </p>
            </div>

            {/* Change Password */}
            <div className="space-y-4">
              <h3 className="font-medium text-gray-900 dark:text-white">{t('settings.changePassword')}</h3>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  {t('settings.currentPassword')}
                </label>
                <input
                  type="password"
                  value={passwordData.current_password}
                  onChange={(e) => setPasswordData({ ...passwordData, current_password: e.target.value })}
                  className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-primary-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  {t('settings.newPassword')}
                </label>
                <input
                  type="password"
                  value={passwordData.new_password}
                  onChange={(e) => setPasswordData({ ...passwordData, new_password: e.target.value })}
                  className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-primary-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  {t('settings.confirmNewPassword')}
                </label>
                <input
                  type="password"
                  value={passwordData.confirm_password}
                  onChange={(e) => setPasswordData({ ...passwordData, confirm_password: e.target.value })}
                  className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-primary-500"
                />
              </div>

              <button
                onClick={handleChangePassword}
                disabled={saving || !passwordData.current_password || !passwordData.new_password}
                className="bg-primary-600 hover:bg-primary-700 text-white px-6 py-2 rounded-lg font-medium disabled:opacity-50"
              >
                {saving ? t('common.loading') : t('settings.changePassword')}
              </button>
            </div>

            {/* Delete Account */}
            <div className="pt-6 border-t border-gray-200 dark:border-gray-700">
              <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-6">
                <div className="flex items-start space-x-3">
                  <AlertTriangle className="w-6 h-6 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <h3 className="font-semibold text-red-900 dark:text-red-100 mb-2">
                      {t('common.warning')}
                    </h3>
                    <p className="text-sm text-red-700 dark:text-red-300 mb-4">
                      {t('settings.deleteAccountWarning')}
                    </p>

                    {!showDeleteConfirm ? (
                      <button
                        onClick={() => setShowDeleteConfirm(true)}
                        className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg font-medium flex items-center space-x-2"
                      >
                        <Trash2 className="w-4 h-4" />
                        <span>{t('settings.deleteAccount')}</span>
                      </button>
                    ) : (
                      <div className="space-y-3">
                        <p className="text-sm font-medium text-red-900 dark:text-red-100">
                          {t('common.confirm')}?
                        </p>
                        <div className="flex space-x-3">
                          <button
                            onClick={handleDeleteAccount}
                            disabled={saving}
                            className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg font-medium disabled:opacity-50"
                          >
                            {saving ? t('common.loading') : t('common.yes')}
                          </button>
                          <button
                            onClick={() => setShowDeleteConfirm(false)}
                            className="bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-900 dark:text-gray-100 px-4 py-2 rounded-lg font-medium"
                          >
                            {t('common.cancel')}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
