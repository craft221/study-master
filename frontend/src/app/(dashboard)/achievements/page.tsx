'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Trophy, Star, Zap, Users, BookOpen, Brain, Swords, Flame, Lock, CheckCircle2 } from 'lucide-react'
import api from '@/lib/api'

interface Achievement {
  id: number
  name: string
  description: string
  category: string
  rarity: string
  icon: string
  xp_reward: number
  requirement_value: number
  requirement_type: string
  is_active: boolean
  created_at: string
}

interface UserAchievement {
  id: number
  user_id: number
  achievement_id: number
  unlocked_at: string
  progress: number
  achievement: Achievement
}

interface UserStats {
  total_notes: number
  total_flashcards: number
  total_flashcards_reviewed: number
  total_quizzes: number
  completed_quiz_attempts: number
  current_streak: number
  total_xp: number
  level: number
}

export default function AchievementsPage() {
  const [userAchievements, setUserAchievements] = useState<UserAchievement[]>([])
  const [allAchievements, setAllAchievements] = useState<Achievement[]>([])
  const [userStats, setUserStats] = useState<UserStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [selectedCategory, setSelectedCategory] = useState<string>('all')

  useEffect(() => {
    fetchAchievements()
  }, [])

  const fetchAchievements = async () => {
    try {
      setLoading(true)

      // D'abord vérifier et débloquer les nouveaux achievements
      try {
        await api.post('/achievements/check-progress')
      } catch (e) {
        // Ignorer les erreurs de check-progress
        console.log('Check progress:', e)
      }

      // Puis récupérer les données
      const [userAchsRes, allAchsRes, statsRes] = await Promise.all([
        api.get('/achievements/user/me'),
        api.get('/achievements/'),
        api.get('/users/me/stats')
      ])

      // L'API retourne { achievements: [...], total: ... }
      setUserAchievements(userAchsRes.data.achievements || [])
      setAllAchievements(allAchsRes.data.achievements || [])
      setUserStats(statsRes.data)
    } catch (error) {
      console.error('Error fetching achievements:', error)
    } finally {
      setLoading(false)
    }
  }

  const getCategoryIcon = (category: string) => {
    const icons: Record<string, any> = {
      learning: BookOpen,
      streak: Flame,
      mastery: Brain,
      social: Users,
      special: Star,
      duels: Swords,
      study_time: Zap
    }
    return icons[category.toLowerCase()] || Trophy
  }

  const getRarityColor = (rarity: string) => {
    const colors: Record<string, string> = {
      common: 'text-gray-400 border-gray-400',
      rare: 'text-blue-400 border-blue-400',
      epic: 'text-purple-400 border-purple-400',
      legendary: 'text-yellow-400 border-yellow-400'
    }
    return colors[rarity.toLowerCase()] || 'text-gray-400 border-gray-400'
  }

  const getRarityBgColor = (rarity: string) => {
    const colors: Record<string, string> = {
      common: 'bg-gray-500/10',
      rare: 'bg-blue-500/10',
      epic: 'bg-purple-500/10',
      legendary: 'bg-yellow-500/10'
    }
    return colors[rarity.toLowerCase()] || 'bg-gray-500/10'
  }

  const isUnlocked = (achievementId: number) => {
    return userAchievements.some(ua => ua.achievement_id === achievementId)
  }

  const getUserProgress = (achievement: Achievement) => {
    // Si déjà débloqué, retourner 100%
    const userAch = userAchievements.find(ua => ua.achievement_id === achievement.id)
    if (userAch) return achievement.requirement_value

    // Sinon calculer la progression réelle basée sur les stats
    if (!userStats) return 0

    const reqType = achievement.requirement_type
    let currentValue = 0

    switch (reqType) {
      case 'notes_created':
        currentValue = userStats.total_notes || 0
        break
      case 'flashcards_created':
        currentValue = userStats.total_flashcards || 0
        break
      case 'flashcards_reviewed':
        currentValue = userStats.total_flashcards_reviewed || 0
        break
      case 'quizzes_taken':
        currentValue = userStats.completed_quiz_attempts || 0
        break
      case 'streak_days':
        currentValue = userStats.current_streak || 0
        break
      case 'xp':
        currentValue = userStats.total_xp || 0
        break
      case 'level':
        currentValue = userStats.level || 1
        break
      default:
        currentValue = 0
    }

    return Math.min(currentValue, achievement.requirement_value)
  }

  const categories = [
    { value: 'all', label: 'Tous', icon: Trophy },
    { value: 'learning', label: 'Apprentissage', icon: BookOpen },
    { value: 'streak', label: 'Série', icon: Flame },
    { value: 'mastery', label: 'Maîtrise', icon: Brain },
    { value: 'social', label: 'Social', icon: Users },
    { value: 'special', label: 'Spécial', icon: Star }
  ]

  const filteredAchievements = selectedCategory === 'all'
    ? allAchievements
    : allAchievements.filter(a => a.category?.toLowerCase() === selectedCategory.toLowerCase())

  // Dédupliquer les achievements par achievement_id (au cas où il y aurait des doublons en DB)
  const uniqueUnlockedIds = new Set(userAchievements.map(ua => ua.achievement_id))
  const unlockedCount = uniqueUnlockedIds.size
  const totalCount = allAchievements.length
  // Calculer XP uniquement pour les achievements uniques
  const seenAchievementIds = new Set<number>()
  const totalXP = userAchievements.reduce((sum, ua) => {
    if (seenAchievementIds.has(ua.achievement_id)) return sum
    seenAchievementIds.add(ua.achievement_id)
    return sum + (ua.achievement?.xp_reward || 0)
  }, 0)

  if (loading) {
    return (
      <div className="container mx-auto p-6">
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
        </div>
      </div>
    )
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header Stats */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Trophy className="h-8 w-8 text-yellow-500" />
            Succès & Achievements
          </h1>
          <p className="text-muted-foreground mt-1">
            Débloquez des badges en progressant dans vos études
          </p>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Succès Débloqués</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{unlockedCount} / {totalCount}</div>
            <Progress value={totalCount > 0 ? (unlockedCount / totalCount) * 100 : 0} className="mt-2" />
            <p className="text-xs text-muted-foreground mt-2">
              {totalCount > 0 ? Math.round((unlockedCount / totalCount) * 100) : 0}% complété
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">XP Gagné</CardTitle>
            <Zap className="h-4 w-4 text-yellow-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalXP} XP</div>
            <p className="text-xs text-muted-foreground mt-2">
              Grâce aux achievements
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Rareté</CardTitle>
            <Star className="h-4 w-4 text-purple-500" />
          </CardHeader>
          <CardContent>
            <div className="flex gap-2 mt-1">
              {['common', 'rare', 'epic', 'legendary'].map(rarity => {
                const count = userAchievements.filter(
                  ua => ua.achievement?.rarity?.toLowerCase() === rarity
                ).length
                return (
                  <Badge key={rarity} variant="outline" className={getRarityColor(rarity)}>
                    {count}
                  </Badge>
                )
              })}
            </div>
            <p className="text-xs text-muted-foreground mt-2">Par niveau de rareté</p>
          </CardContent>
        </Card>
      </div>

      {/* Category Tabs */}
      <Tabs value={selectedCategory} onValueChange={setSelectedCategory} className="w-full">
        <TabsList className="grid grid-cols-6 w-full">
          {categories.map(cat => {
            const Icon = cat.icon
            return (
              <TabsTrigger key={cat.value} value={cat.value} className="flex items-center gap-2">
                <Icon className="h-4 w-4" />
                <span className="hidden sm:inline">{cat.label}</span>
              </TabsTrigger>
            )
          })}
        </TabsList>

        <TabsContent value={selectedCategory} className="mt-6">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {filteredAchievements.map(achievement => {
              const unlocked = isUnlocked(achievement.id)
              const progress = getUserProgress(achievement)
              const progressPercent = (progress / achievement.requirement_value) * 100
              const Icon = getCategoryIcon(achievement.category)

              return (
                <Card
                  key={achievement.id}
                  className={`relative overflow-hidden transition-all hover:shadow-lg ${
                    unlocked ? getRarityBgColor(achievement.rarity) : 'opacity-60'
                  }`}
                >
                  {/* Rarity Border */}
                  <div className={`absolute top-0 left-0 right-0 h-1 ${
                    unlocked ? getRarityColor(achievement.rarity).replace('text-', 'bg-').replace(' border-', '') : 'bg-gray-300'
                  }`} />

                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        <div className={`p-3 rounded-lg ${
                          unlocked
                            ? getRarityBgColor(achievement.rarity)
                            : 'bg-gray-100 dark:bg-gray-800'
                        }`}>
                          {unlocked ? (
                            <Icon className={`h-6 w-6 ${getRarityColor(achievement.rarity).split(' ')[0]}`} />
                          ) : (
                            <Lock className="h-6 w-6 text-gray-400" />
                          )}
                        </div>
                        <div>
                          <CardTitle className="text-lg flex items-center gap-2">
                            {achievement.name}
                            {unlocked && (
                              <CheckCircle2 className="h-5 w-5 text-green-500" />
                            )}
                          </CardTitle>
                          <div className="flex gap-2 mt-1">
                            <Badge variant="outline" className={getRarityColor(achievement.rarity)}>
                              {achievement.rarity}
                            </Badge>
                            <Badge variant="secondary">
                              {achievement.xp_reward} XP
                            </Badge>
                          </div>
                        </div>
                      </div>
                    </div>
                  </CardHeader>

                  <CardContent>
                    <CardDescription className="mb-4">
                      {achievement.description}
                    </CardDescription>

                    {!unlocked && (
                      <div className="space-y-2">
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">Progression</span>
                          <span className="font-medium">
                            {progress} / {achievement.requirement_value}
                          </span>
                        </div>
                        <Progress value={progressPercent} className="h-2" />
                        <p className="text-xs text-muted-foreground">
                          {Math.round(progressPercent)}% complété
                        </p>
                      </div>
                    )}

                    {unlocked && (
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-green-600 dark:text-green-400 font-medium flex items-center gap-1">
                          <CheckCircle2 className="h-4 w-4" />
                          Débloqué
                        </span>
                        <span className="text-muted-foreground text-xs">
                          {new Date(
                            userAchievements.find(ua => ua.achievement_id === achievement.id)?.unlocked_at || ''
                          ).toLocaleDateString()}
                        </span>
                      </div>
                    )}
                  </CardContent>
                </Card>
              )
            })}
          </div>

          {filteredAchievements.length === 0 && (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <Trophy className="h-12 w-12 text-muted-foreground mb-4" />
                <p className="text-muted-foreground">Aucun achievement dans cette catégorie</p>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}
