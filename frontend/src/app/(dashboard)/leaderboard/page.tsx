'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Trophy, Medal, Star, TrendingUp, Users, Flame, Zap, FileText, Clock, Target, Loader2 } from 'lucide-react'
import api from '@/lib/api'
import { useToast } from '@/hooks/use-toast'

interface LeaderboardEntry {
  user_id: number
  username: string
  avatar_url: string | null
  score: number
  rank: number
  level: number
  streak: number
}

export default function LeaderboardPage() {
  const { toast } = useToast()
  const [loading, setLoading] = useState(true)
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([])
  const [leaderboardType, setLeaderboardType] = useState('xp')
  const [period, setPeriod] = useState('weekly')
  const [scope, setScope] = useState('global')
  const [currentUserRank, setCurrentUserRank] = useState<LeaderboardEntry | null>(null)

  useEffect(() => {
    fetchLeaderboard()
  }, [leaderboardType, period, scope])

  const fetchLeaderboard = async () => {
    try {
      setLoading(true)
      let endpoint = ''

      if (scope === 'global') {
        endpoint = `/leaderboards/?leaderboard_type=${leaderboardType}&period=${period}`
      } else if (scope === 'university') {
        endpoint = `/leaderboards/university?leaderboard_type=${leaderboardType}&period=${period}`
      } else if (scope === 'promotion') {
        endpoint = `/leaderboards/promotion?leaderboard_type=${leaderboardType}&period=${period}`
      }

      const response = await api.get(endpoint)
      setLeaderboard(response.data.entries || [])

      // Get current user position
      const me = await api.get('/users/me')
      const myEntry = response.data.entries?.find((e: LeaderboardEntry) => e.user_id === me.data.id)
      setCurrentUserRank(myEntry || null)
    } catch (error) {
      console.error('Error fetching leaderboard:', error)
      toast({
        title: 'Erreur',
        description: 'Impossible de charger le classement',
        variant: 'destructive'
      })
    } finally {
      setLoading(false)
    }
  }

  const getRankIcon = (rank: number) => {
    if (rank === 1) return <Trophy className="h-6 w-6 text-yellow-500" />
    if (rank === 2) return <Medal className="h-6 w-6 text-gray-400" />
    if (rank === 3) return <Medal className="h-6 w-6 text-orange-600" />
    return <span className="text-lg font-bold text-gray-600">#{rank}</span>
  }

  const getRankBadge = (rank: number) => {
    if (rank === 1) return 'bg-gradient-to-r from-yellow-400 to-yellow-600'
    if (rank === 2) return 'bg-gradient-to-r from-gray-300 to-gray-500'
    if (rank === 3) return 'bg-gradient-to-r from-orange-400 to-orange-600'
    return 'bg-white dark:bg-gray-800'
  }

  const getTypeIcon = (type: string) => {
    const icons: Record<string, any> = {
      xp: Zap,
      streak: Flame,
      notes: FileText,
      flashcards: Target,
      quizzes: Trophy,
      study_time: Clock
    }
    return icons[type] || Star
  }

  const getTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      xp: 'XP',
      streak: 'Série (jours)',
      notes: 'Notes créées',
      flashcards: 'Flashcards révisées',
      quizzes: 'Quiz complétés',
      study_time: 'Temps d\'étude (min)'
    }
    return labels[type] || 'Score'
  }

  if (loading) {
    return (
      <div className="container mx-auto p-6">
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-12 w-12 animate-spin text-primary" />
        </div>
      </div>
    )
  }

  const top3 = leaderboard.slice(0, 3)

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="text-center">
        <h1 className="text-3xl font-bold mb-2 flex items-center justify-center gap-2">
          <Trophy className="h-8 w-8 text-yellow-500" />
          Classements
        </h1>
        <p className="text-muted-foreground">
          Comparez votre progression avec les autres étudiants
        </p>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-4 justify-center">
        <Select value={leaderboardType} onValueChange={setLeaderboardType}>
          <SelectTrigger className="w-[180px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="xp">XP</SelectItem>
            <SelectItem value="streak">Série</SelectItem>
            <SelectItem value="notes">Notes</SelectItem>
            <SelectItem value="flashcards">Flashcards</SelectItem>
            <SelectItem value="quizzes">Quiz</SelectItem>
            <SelectItem value="study_time">Temps d'étude</SelectItem>
          </SelectContent>
        </Select>

        <Select value={period} onValueChange={setPeriod}>
          <SelectTrigger className="w-[180px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="daily">Aujourd'hui</SelectItem>
            <SelectItem value="weekly">Cette semaine</SelectItem>
            <SelectItem value="monthly">Ce mois</SelectItem>
            <SelectItem value="all_time">Tout temps</SelectItem>
          </SelectContent>
        </Select>

        <Select value={scope} onValueChange={setScope}>
          <SelectTrigger className="w-[180px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="global">🌍 Global</SelectItem>
            <SelectItem value="university">🎓 Université</SelectItem>
            <SelectItem value="promotion">👥 Promotion</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Top 3 Podium */}
      {top3.length >= 3 && (
        <div className="grid md:grid-cols-3 gap-6">
          {/* 2nd Place */}
          <Card className="md:order-1 md:mt-8">
            <CardContent className="p-6 text-center">
              <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-r from-gray-300 to-gray-500 rounded-full mb-4">
                <Medal className="h-8 w-8 text-white" />
              </div>
              <h3 className="font-bold text-lg mb-1">{top3[1].username}</h3>
              <p className="text-sm text-muted-foreground mb-3">Niveau {top3[1].level}</p>
              <div className="text-2xl font-bold mb-1">
                {top3[1].score.toLocaleString()}
              </div>
              <div className="text-sm text-muted-foreground">{getTypeLabel(leaderboardType)}</div>
            </CardContent>
          </Card>

          {/* 1st Place */}
          <Card className="bg-gradient-to-r from-yellow-400 to-yellow-600 md:order-2 transform md:scale-105 border-none">
            <CardContent className="p-6 text-center">
              <div className="inline-flex items-center justify-center w-20 h-20 bg-white rounded-full mb-4">
                <Trophy className="h-10 w-10 text-yellow-600" />
              </div>
              <h3 className="font-bold text-white text-xl mb-1">{top3[0].username}</h3>
              <p className="text-yellow-100 mb-3">Niveau {top3[0].level}</p>
              <div className="text-3xl font-bold text-white mb-1">
                {top3[0].score.toLocaleString()}
              </div>
              <div className="text-yellow-100">{getTypeLabel(leaderboardType)}</div>
              <div className="mt-4 flex items-center justify-center space-x-4 text-white">
                <div className="flex items-center">
                  <Flame className="h-4 w-4 mr-1" />
                  <span className="text-sm">{top3[0].streak}</span>
                </div>
                <div className="flex items-center">
                  <Star className="h-4 w-4 mr-1" />
                  <span className="text-sm">Niveau {top3[0].level}</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* 3rd Place */}
          <Card className="md:order-3 md:mt-8">
            <CardContent className="p-6 text-center">
              <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-r from-orange-400 to-orange-600 rounded-full mb-4">
                <Medal className="h-8 w-8 text-white" />
              </div>
              <h3 className="font-bold text-lg mb-1">{top3[2].username}</h3>
              <p className="text-sm text-muted-foreground mb-3">Niveau {top3[2].level}</p>
              <div className="text-2xl font-bold mb-1">
                {top3[2].score.toLocaleString()}
              </div>
              <div className="text-sm text-muted-foreground">{getTypeLabel(leaderboardType)}</div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Full Leaderboard */}
      <Card>
        <CardHeader>
          <CardTitle>Classement complet</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {leaderboard.map((entry) => {
              const TypeIcon = getTypeIcon(leaderboardType)

              return (
                <div
                  key={entry.user_id}
                  className={`p-4 rounded-lg transition-colors ${
                    entry.rank <= 3
                      ? getRankBadge(entry.rank)
                      : 'bg-gray-50 dark:bg-gray-900 hover:bg-gray-100 dark:hover:bg-gray-800'
                  }`}
                >
                  <div className="flex items-center gap-4">
                    {/* Rank */}
                    <div className="flex-shrink-0 w-12 flex items-center justify-center">
                      {getRankIcon(entry.rank)}
                    </div>

                    {/* Avatar */}
                    <div className="flex-shrink-0">
                      <div className={`w-12 h-12 rounded-full flex items-center justify-center font-bold text-lg ${
                        entry.rank <= 3 ? 'bg-white text-gray-900' : 'bg-primary text-primary-foreground'
                      }`}>
                        {entry.username.charAt(0).toUpperCase()}
                      </div>
                    </div>

                    {/* User Info */}
                    <div className="flex-1 min-w-0">
                      <h3 className={`font-semibold ${entry.rank <= 3 ? 'text-white' : ''}`}>
                        {entry.username}
                      </h3>
                      <p className={`text-sm ${entry.rank <= 3 ? 'text-white/80' : 'text-muted-foreground'}`}>
                        Niveau {entry.level}
                      </p>
                    </div>

                    {/* Stats */}
                    <div className="hidden md:flex items-center gap-6">
                      <div className="text-center">
                        <div className={`text-lg font-bold flex items-center gap-1 ${entry.rank <= 3 ? 'text-white' : ''}`}>
                          <TypeIcon className="h-4 w-4" />
                          {entry.score.toLocaleString()}
                        </div>
                        <div className={`text-xs ${entry.rank <= 3 ? 'text-white/80' : 'text-muted-foreground'}`}>
                          {getTypeLabel(leaderboardType)}
                        </div>
                      </div>

                      {entry.streak > 0 && (
                        <div className="text-center">
                          <div className={`text-lg font-bold flex items-center gap-1 ${entry.rank <= 3 ? 'text-white' : 'text-orange-600'}`}>
                            <Flame className="h-4 w-4" />
                            {entry.streak}
                          </div>
                          <div className={`text-xs ${entry.rank <= 3 ? 'text-white/80' : 'text-muted-foreground'}`}>
                            Série
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>

          {leaderboard.length === 0 && (
            <div className="text-center py-12 text-muted-foreground">
              <Trophy className="h-12 w-12 mx-auto mb-3 opacity-20" />
              <p>Aucune donnée pour ce classement</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Current User Position */}
      {currentUserRank && (
        <Card className="bg-gradient-to-r from-primary to-purple-600 text-white border-none">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center text-primary font-bold text-2xl">
                  #{currentUserRank.rank}
                </div>
                <div>
                  <h3 className="font-bold text-xl mb-1">Votre position</h3>
                  <p className="text-white/80">Niveau {currentUserRank.level}</p>
                </div>
              </div>
              <div className="text-right">
                <div className="text-3xl font-bold mb-1">
                  {currentUserRank.score.toLocaleString()}
                </div>
                <div className="text-white/80">{getTypeLabel(leaderboardType)}</div>
                <div className="mt-2 flex items-center justify-end gap-4">
                  <div className="flex items-center">
                    <Flame className="h-4 w-4 mr-1" />
                    <span className="text-sm">{currentUserRank.streak} jours</span>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Info Card */}
      <Card className="bg-blue-50 dark:bg-blue-950 border-blue-200 dark:border-blue-800">
        <CardContent className="p-6">
          <div className="flex items-start gap-4">
            <div className="p-3 bg-blue-100 dark:bg-blue-900 rounded-lg">
              <TrendingUp className="h-6 w-6 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <h3 className="font-semibold mb-2">Comment monter dans le classement?</h3>
              <ul className="space-y-1 text-sm text-muted-foreground">
                <li>• Complétez des quiz et obtenez de bons scores</li>
                <li>• Révisez vos flashcards quotidiennement</li>
                <li>• Créez et partagez des notes de qualité</li>
                <li>• Maintenez votre série d'apprentissage</li>
                <li>• Participez aux sessions d'étude en groupe</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
