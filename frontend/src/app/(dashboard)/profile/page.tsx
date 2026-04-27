'use client'

import { useState, useEffect } from 'react'
import dynamic from 'next/dynamic'
import { User, Mail, MapPin, GraduationCap, Calendar, Award, Trophy, Zap, BookOpen, Brain, Clock, Edit, Save, X, Lock } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { Progress } from '@/components/ui/progress'
import api from '@/lib/api'
import { useToast } from '@/hooks/use-toast'
import { useTranslation } from '@/contexts/LanguageContext'

// Imports dynamiques pour éviter les erreurs d'hydratation
const UniversitySelect = dynamic(() => import('@/components/ui/UniversitySelect'), {
  ssr: false,
  loading: () => (
    <div className="h-10 w-full rounded-md border border-input bg-background animate-pulse" />
  )
})

const MajorCombobox = dynamic(
  () => import('@/components/ui/combobox').then(mod => ({ default: mod.MajorCombobox })),
  {
    ssr: false,
    loading: () => (
      <div className="h-10 w-full rounded-md border border-input bg-background animate-pulse" />
    )
  }
)

interface UserProfile {
  id: number
  username: string
  email: string
  full_name?: string
  bio?: string
  avatar_url?: string
  university?: string
  major?: string
  promotion?: string
  country?: string
  city?: string
  language?: string
  theme?: string
  notifications_enabled: boolean
  email_notifications: boolean

  // Gamification
  total_xp: number
  level: number
  current_streak: number
  longest_streak: number

  // Stats
  total_study_time_minutes: number
  total_notes_created: number
  total_flashcards_created: number
  total_quizzes_completed: number

  // AI
  ai_requests_today: number
  total_ai_requests: number

  created_at: string
}

interface UserStats {
  user_id: number
  username: string
  total_xp: number
  level: number
  xp_progress: number
  xp_needed_for_next_level: number
  current_streak: number
  longest_streak: number
  total_subjects: number
  total_notes: number
  total_flashcards: number
  flashcards_due_today: number
  total_flashcards_reviewed: number
  total_quizzes: number
  completed_quiz_attempts: number
  average_quiz_score: number
  notes_this_week: number
  flashcards_reviewed_this_week: number
  quizzes_taken_this_week: number
  member_since: string
  last_login: string
}

export default function ProfilePage() {
  const { toast } = useToast()
  const { t, locale } = useTranslation()
  const localeMap: Record<string, string> = { fr: 'fr-FR', en: 'en-US', es: 'es-ES', ar: 'ar-SA' }

  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [stats, setStats] = useState<UserStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [activeTab, setActiveTab] = useState('info')

  // Edit form
  const [editForm, setEditForm] = useState({
    full_name: '',
    bio: '',
    university: '',
    major: '',
    promotion: '',
    country: '',
    city: '',
    language: 'fr',
    theme: 'light',
    notifications_enabled: true,
    email_notifications: true
  })

  // Password change
  const [passwordForm, setPasswordForm] = useState({
    current_password: '',
    new_password: '',
    confirm_password: ''
  })

  useEffect(() => {
    fetchProfile()
    fetchStats()
  }, [])

  const fetchProfile = async () => {
    try {
      setLoading(true)
      const response = await api.get('/users/me/profile')
      setProfile(response.data)
      setEditForm({
        full_name: response.data.full_name || '',
        bio: response.data.bio || '',
        university: response.data.university || '',
        major: response.data.major || '',
        promotion: response.data.promotion || '',
        country: response.data.country || '',
        city: response.data.city || '',
        language: response.data.language || 'fr',
        theme: response.data.theme || 'light',
        notifications_enabled: response.data.notifications_enabled ?? true,
        email_notifications: response.data.email_notifications ?? true
      })
    } catch (error) {
      console.error('Error fetching profile:', error)
      toast({
        title: t('common.error'),
        description: t('profile.loadError'),
        variant: 'destructive'
      })
    } finally {
      setLoading(false)
    }
  }

  const fetchStats = async () => {
    try {
      const response = await api.get('/users/me/stats')
      setStats(response.data)
    } catch (error) {
      console.error('Error fetching stats:', error)
    }
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      const response = await api.put('/users/me', editForm)
      setProfile(response.data)
      setEditing(false)
      toast({
        title: t('profile.profileUpdated'),
        description: t('profile.infoSaved'),
      })
    } catch (error: any) {
      toast({
        title: t('common.error'),
        description: error.response?.data?.detail || t('profile.updateError'),
        variant: 'destructive'
      })
    } finally {
      setSaving(false)
    }
  }

  const handlePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault()

    if (passwordForm.new_password !== passwordForm.confirm_password) {
      toast({
        title: t('common.error'),
        description: t('auth.passwordsDoNotMatch'),
        variant: 'destructive'
      })
      return
    }

    try {
      await api.post('/users/me/password', {
        current_password: passwordForm.current_password,
        new_password: passwordForm.new_password,
        confirm_password: passwordForm.confirm_password
      })

      toast({
        title: t('profile.passwordChanged'),
        description: t('profile.passwordChangedDesc'),
      })

      setPasswordForm({
        current_password: '',
        new_password: '',
        confirm_password: ''
      })
    } catch (error: any) {
      toast({
        title: t('common.error'),
        description: error.response?.data?.detail || t('profile.passwordChangeError'),
        variant: 'destructive'
      })
    }
  }

  if (loading || !profile) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto" />
          <p className="mt-4 text-gray-600">{t('profile.loadingProfile')}</p>
        </div>
      </div>
    )
  }

  const xpProgress = stats ? (stats.xp_progress / stats.xp_needed_for_next_level) * 100 : 0

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-4">
          <div className="w-20 h-20 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white text-3xl font-bold">
            {profile.username.charAt(0).toUpperCase()}
          </div>
          <div>
            <h1 className="text-3xl font-bold text-gray-900">{profile.username}</h1>
            <p className="text-gray-600">{profile.email}</p>
            <div className="flex items-center gap-2 mt-1">
              <Badge variant="default">{t('profile.levelBadge', { level: profile.level })}</Badge>
              <Badge variant="secondary">{t('profile.xpBadge', { count: profile.total_xp })}</Badge>
              {profile.current_streak > 0 && (
                <Badge variant="outline">
                  <Zap className="h-3 w-3 mr-1 text-orange-500" />
                  {t('profile.daysBadge', { count: profile.current_streak })}
                </Badge>
              )}
            </div>
          </div>
        </div>

        {!editing ? (
          <Button onClick={() => setEditing(true)}>
            <Edit className="h-4 w-4 mr-2" />
            {t('common.edit')}
          </Button>
        ) : (
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setEditing(false)}>
              <X className="h-4 w-4 mr-2" />
              {t('common.cancel')}
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              <Save className="h-4 w-4 mr-2" />
              {saving ? t('profile.saving') : t('common.save')}
            </Button>
          </div>
        )}
      </div>

      {/* XP Progress */}
      {stats && (
        <Card>
          <CardContent className="pt-6">
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="font-medium">{t('profile.xpProgress', { level: stats.level + 1 })}</span>
                <span className="text-gray-600">
                  {stats.xp_progress} / {stats.xp_needed_for_next_level} XP
                </span>
              </div>
              <Progress value={xpProgress} className="h-3" />
            </div>
          </CardContent>
        </Card>
      )}

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="info">{t('profile.tabInfo')}</TabsTrigger>
          <TabsTrigger value="stats">{t('profile.tabStats')}</TabsTrigger>
          <TabsTrigger value="settings">{t('profile.tabSettings')}</TabsTrigger>
        </TabsList>

        {/* Info Tab */}
        <TabsContent value="info" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>{t('profile.personalInfo')}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {editing ? (
                <>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="full_name">{t('profile.fullName')}</Label>
                      <Input
                        id="full_name"
                        value={editForm.full_name}
                        onChange={(e) => setEditForm({ ...editForm, full_name: e.target.value })}
                      />
                    </div>
                    <div>
                      <Label htmlFor="university">{t('profile.university')}</Label>
                      <UniversitySelect
                        value={editForm.university}
                        onChange={(value) => setEditForm({ ...editForm, university: value })}
                      />
                    </div>
                    <div>
                      <Label htmlFor="major">{t('profile.major')}</Label>
                      <MajorCombobox
                        value={editForm.major}
                        onChange={(value) => setEditForm({ ...editForm, major: value })}
                      />
                    </div>
                    <div>
                      <Label htmlFor="promotion">{t('profile.promotion')}</Label>
                      <Input
                        id="promotion"
                        value={editForm.promotion}
                        onChange={(e) => setEditForm({ ...editForm, promotion: e.target.value })}
                      />
                    </div>
                    <div>
                      <Label htmlFor="country">{t('profile.country')}</Label>
                      <Input
                        id="country"
                        value={editForm.country}
                        onChange={(e) => setEditForm({ ...editForm, country: e.target.value })}
                      />
                    </div>
                    <div>
                      <Label htmlFor="city">{t('profile.city')}</Label>
                      <Input
                        id="city"
                        value={editForm.city}
                        onChange={(e) => setEditForm({ ...editForm, city: e.target.value })}
                      />
                    </div>
                  </div>
                  <div>
                    <Label htmlFor="bio">{t('profile.bio')}</Label>
                    <Textarea
                      id="bio"
                      rows={3}
                      value={editForm.bio}
                      onChange={(e) => setEditForm({ ...editForm, bio: e.target.value })}
                      placeholder={t('profile.bioPlaceholder')}
                    />
                  </div>
                </>
              ) : (
                <div className="space-y-4">
                  {profile.full_name && (
                    <div className="flex items-center gap-3">
                      <User className="h-5 w-5 text-gray-400" />
                      <div>
                        <p className="text-sm text-gray-600">{t('profile.fullName')}</p>
                        <p className="font-medium">{profile.full_name}</p>
                      </div>
                    </div>
                  )}
                  {profile.bio && (
                    <div className="flex items-start gap-3">
                      <BookOpen className="h-5 w-5 text-gray-400" />
                      <div>
                        <p className="text-sm text-gray-600">{t('profile.bio')}</p>
                        <p className="font-medium">{profile.bio}</p>
                      </div>
                    </div>
                  )}
                  {profile.university && (
                    <div className="flex items-center gap-3">
                      <GraduationCap className="h-5 w-5 text-gray-400" />
                      <div>
                        <p className="text-sm text-gray-600">{t('profile.university')}</p>
                        <p className="font-medium">{profile.university}</p>
                      </div>
                    </div>
                  )}
                  {profile.major && (
                    <div className="flex items-center gap-3">
                      <BookOpen className="h-5 w-5 text-gray-400" />
                      <div>
                        <p className="text-sm text-gray-600">{t('profile.major')}</p>
                        <p className="font-medium">{profile.major}</p>
                      </div>
                    </div>
                  )}
                  {(profile.city || profile.country) && (
                    <div className="flex items-center gap-3">
                      <MapPin className="h-5 w-5 text-gray-400" />
                      <div>
                        <p className="text-sm text-gray-600">{t('profile.location')}</p>
                        <p className="font-medium">
                          {[profile.city, profile.country].filter(Boolean).join(', ')}
                        </p>
                      </div>
                    </div>
                  )}
                  <div className="flex items-center gap-3">
                    <Calendar className="h-5 w-5 text-gray-400" />
                    <div>
                      <p className="text-sm text-gray-600">{t('profile.memberSince')}</p>
                      <p className="font-medium">
                        {new Date(profile.created_at).toLocaleDateString(localeMap[locale] || 'fr-FR', {
                          day: 'numeric',
                          month: 'long',
                          year: 'numeric'
                        })}
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Gamification Stats */}
          <Card>
            <CardHeader>
              <CardTitle>{t('profile.gamification')}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="text-center">
                  <Trophy className="h-8 w-8 mx-auto text-yellow-500 mb-2" />
                  <p className="text-2xl font-bold">{profile.level}</p>
                  <p className="text-sm text-gray-600">{t('profile.level')}</p>
                </div>
                <div className="text-center">
                  <Award className="h-8 w-8 mx-auto text-blue-500 mb-2" />
                  <p className="text-2xl font-bold">{profile.total_xp}</p>
                  <p className="text-sm text-gray-600">{t('profile.xpTotal')}</p>
                </div>
                <div className="text-center">
                  <Zap className="h-8 w-8 mx-auto text-orange-500 mb-2" />
                  <p className="text-2xl font-bold">{profile.current_streak}</p>
                  <p className="text-sm text-gray-600">{t('profile.currentStreak')}</p>
                </div>
                <div className="text-center">
                  <Zap className="h-8 w-8 mx-auto text-purple-500 mb-2" />
                  <p className="text-2xl font-bold">{profile.longest_streak}</p>
                  <p className="text-sm text-gray-600">{t('profile.longestStreak')}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Stats Tab */}
        <TabsContent value="stats" className="space-y-4">
          {stats && (
            <>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-medium flex items-center gap-2">
                      <BookOpen className="h-4 w-4 text-blue-500" />
                      {t('profile.notesCard')}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-3xl font-bold">{stats.total_notes}</p>
                    <p className="text-xs text-gray-600 mt-1">
                      {t('profile.notesThisWeek', { count: stats.notes_this_week })}
                    </p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-medium flex items-center gap-2">
                      <Brain className="h-4 w-4 text-purple-500" />
                      {t('profile.flashcardsCard')}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-3xl font-bold">{stats.total_flashcards}</p>
                    <p className="text-xs text-gray-600 mt-1">
                      {t('profile.flashcardsDueToday', { count: stats.flashcards_due_today })}
                    </p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-medium flex items-center gap-2">
                      <Trophy className="h-4 w-4 text-yellow-500" />
                      {t('profile.quizCard')}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-3xl font-bold">{stats.completed_quiz_attempts}</p>
                    <p className="text-xs text-gray-600 mt-1">
                      {t('profile.averageScore', { score: stats.average_quiz_score.toFixed(1) })}
                    </p>
                  </CardContent>
                </Card>
              </div>

              <Card>
                <CardHeader>
                  <CardTitle>{t('profile.weeklyActivity')}</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div>
                      <div className="flex justify-between text-sm mb-2">
                        <span>{t('profile.notesCreatedThisWeek')}</span>
                        <span className="font-medium">{stats.notes_this_week}</span>
                      </div>
                      <Progress value={(stats.notes_this_week / 10) * 100} />
                    </div>
                    <div>
                      <div className="flex justify-between text-sm mb-2">
                        <span>{t('profile.flashcardsThisWeek')}</span>
                        <span className="font-medium">{stats.flashcards_reviewed_this_week}</span>
                      </div>
                      <Progress value={(stats.flashcards_reviewed_this_week / 50) * 100} />
                    </div>
                    <div>
                      <div className="flex justify-between text-sm mb-2">
                        <span>{t('profile.quizThisWeek')}</span>
                        <span className="font-medium">{stats.quizzes_taken_this_week}</span>
                      </div>
                      <Progress value={(stats.quizzes_taken_this_week / 5) * 100} />
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>{t('profile.globalStats')}</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                    <div>
                      <p className="text-sm text-gray-600">{t('profile.subjects')}</p>
                      <p className="text-2xl font-bold">{stats.total_subjects}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600">{t('profile.reviews')}</p>
                      <p className="text-2xl font-bold">{stats.total_flashcards_reviewed}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600">{t('profile.quizzesCreated')}</p>
                      <p className="text-2xl font-bold">{stats.total_quizzes}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600">{t('profile.aiRequests')}</p>
                      <p className="text-2xl font-bold">{profile.total_ai_requests}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </>
          )}
        </TabsContent>

        {/* Settings Tab */}
        <TabsContent value="settings" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>{t('profile.preferences')}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <Label htmlFor="notifications">{t('profile.notifications')}</Label>
                  <p className="text-sm text-gray-600">{t('profile.notifInApp')}</p>
                </div>
                <Switch
                  id="notifications"
                  checked={editing ? editForm.notifications_enabled : profile.notifications_enabled}
                  onCheckedChange={(checked) =>
                    editing && setEditForm({ ...editForm, notifications_enabled: checked })
                  }
                  disabled={!editing}
                />
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <Label htmlFor="email_notifs">{t('profile.emailNotifications')}</Label>
                  <p className="text-sm text-gray-600">{t('profile.emailNotifDesc')}</p>
                </div>
                <Switch
                  id="email_notifs"
                  checked={editing ? editForm.email_notifications : profile.email_notifications}
                  onCheckedChange={(checked) =>
                    editing && setEditForm({ ...editForm, email_notifications: checked })
                  }
                  disabled={!editing}
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Lock className="h-5 w-5" />
                {t('profile.changePassword')}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handlePasswordChange} className="space-y-4">
                <div>
                  <Label htmlFor="current_password">{t('profile.currentPassword')}</Label>
                  <Input
                    id="current_password"
                    type="password"
                    value={passwordForm.current_password}
                    onChange={(e) =>
                      setPasswordForm({ ...passwordForm, current_password: e.target.value })
                    }
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="new_password">{t('auth.newPassword')}</Label>
                  <Input
                    id="new_password"
                    type="password"
                    minLength={8}
                    value={passwordForm.new_password}
                    onChange={(e) =>
                      setPasswordForm({ ...passwordForm, new_password: e.target.value })
                    }
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="confirm_password">{t('profile.confirmPasswordLabel')}</Label>
                  <Input
                    id="confirm_password"
                    type="password"
                    value={passwordForm.confirm_password}
                    onChange={(e) =>
                      setPasswordForm({ ...passwordForm, confirm_password: e.target.value })
                    }
                    required
                  />
                </div>
                <Button type="submit">
                  <Lock className="h-4 w-4 mr-2" />
                  {t('profile.changePassword')}
                </Button>
              </form>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
