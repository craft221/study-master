'use client'

import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Trophy, Medal, Star, TrendingUp, Users, Flame, Zap, FileText, Clock, Target, Loader2, Wifi, WifiOff, Crown, ChevronUp, ChevronDown, Share2 } from 'lucide-react'
import api from '@/lib/api'
import toast from 'react-hot-toast'
import leaderboardsService, { LeaguePosition, LeagueEntry, LeagueInfo, LeagueTier } from '@/services/leaderboards'
import ShareModal from '@/components/ShareModal'
import { useLanguage } from '@/contexts/LanguageContext'

interface LeaderboardEntry {
  user_id: number
  username: string
  avatar_url: string | null
  score: number
  rank: number
  level: number
  streak: number
}

// Configuration des icônes et couleurs par ligue (sans les noms hardcodés - utilisent i18n)
const LEAGUE_STYLE_CONFIG: Record<LeagueTier, { icon: string; color: string; bgGradient: string; borderColor: string }> = {
  bronze: {
    icon: '🥉',
    color: 'text-orange-700',
    bgGradient: 'from-orange-400 to-orange-600',
    borderColor: 'border-orange-500'
  },
  silver: {
    icon: '🥈',
    color: 'text-gray-400',
    bgGradient: 'from-gray-300 to-gray-500',
    borderColor: 'border-gray-400'
  },
  gold: {
    icon: '🥇',
    color: 'text-yellow-500',
    bgGradient: 'from-yellow-400 to-yellow-600',
    borderColor: 'border-yellow-500'
  },
  diamond: {
    icon: '💎',
    color: 'text-cyan-400',
    bgGradient: 'from-cyan-400 to-blue-500',
    borderColor: 'border-cyan-400'
  },
  master: {
    icon: '👑',
    color: 'text-purple-500',
    bgGradient: 'from-purple-500 to-pink-600',
    borderColor: 'border-purple-500'
  }
}

export default function LeaderboardPage() {
  const { t, tArray } = useLanguage()
  const [loading, setLoading] = useState(true)
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([])

  // Helper pour obtenir le nom de la ligue traduit
  const getLeagueName = (tier: LeagueTier) => t(`leaderboard.leagueTiers.${tier}`)

  // Helper pour obtenir la config complète avec nom traduit
  const getLeagueConfig = (tier: LeagueTier) => ({
    ...LEAGUE_STYLE_CONFIG[tier],
    name: getLeagueName(tier)
  })
  const [leaderboardType, setLeaderboardType] = useState('xp')
  const [period, setPeriod] = useState('weekly')
  const [scope, setScope] = useState('global')
  const [currentUserRank, setCurrentUserRank] = useState<LeaderboardEntry | null>(null)
  const [wsConnected, setWsConnected] = useState(false)
  const [recentUpdates, setRecentUpdates] = useState<any[]>([])
  const wsRef = useRef<WebSocket | null>(null)

  // État pour les ligues
  const [activeTab, setActiveTab] = useState<'leaderboard' | 'leagues'>('leaderboard')
  const [myLeaguePosition, setMyLeaguePosition] = useState<LeaguePosition | null>(null)
  const [leagueEntries, setLeagueEntries] = useState<LeagueEntry[]>([])
  const [allLeagues, setAllLeagues] = useState<LeagueInfo[]>([])
  const [selectedLeagueTier, setSelectedLeagueTier] = useState<LeagueTier | null>(null)
  const [leagueLoading, setLeagueLoading] = useState(false)

  // État pour le partage
  const [showShareModal, setShowShareModal] = useState(false)
  const [shareData, setShareData] = useState<{ type: 'league_promotion' | 'weekly_stats'; data: any } | null>(null)

  // WebSocket pour le temps réel
  useEffect(() => {
    const token = localStorage.getItem('access_token')
    // Utiliser variable d'environnement pour l'URL WebSocket
    const wsBaseUrl = process.env.NEXT_PUBLIC_WS_URL ||
      (typeof window !== 'undefined' && window.location.protocol === 'https:'
        ? `wss://${window.location.host}`
        : 'ws://localhost:8000')
    const wsUrl = `${wsBaseUrl}/api/v1/ws/main-leaderboard${token ? `?token=${token}` : ''}`

    let pingInterval: NodeJS.Timeout | null = null

    const connect = () => {
      try {
        const ws = new WebSocket(wsUrl)
        wsRef.current = ws

        ws.onopen = () => {
          console.log('WebSocket classement connecté')
          setWsConnected(true)

          // S'abonner au type de classement actuel
          ws.send(JSON.stringify({
            type: 'subscribe',
            leaderboard_type: leaderboardType,
            period: period,
            scope: scope
          }))

          // Ping toutes les 30 secondes
          pingInterval = setInterval(() => {
            if (ws.readyState === WebSocket.OPEN) {
              ws.send(JSON.stringify({ type: 'ping' }))
            }
          }, 30000)
        }

        ws.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data)

            if (data.type === 'ranking_update') {
              // Mise à jour en temps réel
              const { user, data: updateData } = data

              // Ajouter aux updates récentes
              setRecentUpdates(prev => [{
                id: Date.now(),
                username: user.username,
                xp_gained: updateData.xp_gained,
                reason: updateData.reason,
                level_up: updateData.level_up
              }, ...prev].slice(0, 5))

              // Toast notification
              toast(`⚡ ${user.username} +${updateData.xp_gained} XP`, {
                icon: updateData.level_up ? '🎉' : '⬆️',
                duration: 3000
              })

              // Rafraîchir le classement après un court délai
              setTimeout(() => fetchLeaderboard(), 500)
            }
          } catch (e) {
            console.error('Erreur parsing WS:', e)
          }
        }

        ws.onclose = () => {
          setWsConnected(false)
          if (pingInterval) clearInterval(pingInterval)
          // Reconnexion après 5 secondes
          setTimeout(connect, 5000)
        }

        ws.onerror = () => {
          setWsConnected(false)
        }
      } catch (e) {
        console.error('Erreur connexion WS:', e)
      }
    }

    connect()

    return () => {
      if (pingInterval) clearInterval(pingInterval)
      if (wsRef.current) wsRef.current.close()
    }
  }, [])

  // Mettre à jour l'abonnement quand les filtres changent
  useEffect(() => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        type: 'subscribe',
        leaderboard_type: leaderboardType,
        period: period,
        scope: scope
      }))
    }
  }, [leaderboardType, period, scope])

  useEffect(() => {
    fetchLeaderboard()
  }, [leaderboardType, period, scope])

  // Charger les données de la ligue quand on passe sur l'onglet Ligues
  useEffect(() => {
    if (activeTab === 'leagues') {
      fetchLeagueData()
    }
  }, [activeTab])

  // Charger le classement d'une ligue spécifique
  useEffect(() => {
    if (selectedLeagueTier) {
      fetchLeagueLeaderboard(selectedLeagueTier)
    }
  }, [selectedLeagueTier])

  const fetchLeagueData = async () => {
    setLeagueLoading(true)
    try {
      const [positionData, leaguesData] = await Promise.all([
        leaderboardsService.getMyLeaguePosition(),
        leaderboardsService.getAllLeagues()
      ])
      setMyLeaguePosition(positionData)
      setAllLeagues(leaguesData)
      // Définir la ligue sélectionnée par défaut
      if (!selectedLeagueTier && positionData.tier) {
        setSelectedLeagueTier(positionData.tier)
      }
    } catch (error) {
      console.error('Erreur chargement ligues:', error)
      toast.error(t('leaderboard.loadError'))
    } finally {
      setLeagueLoading(false)
    }
  }

  const fetchLeagueLeaderboard = async (tier: LeagueTier) => {
    try {
      const response = await leaderboardsService.getLeagueLeaderboard(tier, 50)
      setLeagueEntries(response?.entries || [])
    } catch (error) {
      console.error('Erreur chargement classement ligue:', error)
      setLeagueEntries([])
    }
  }

  const handleShareLeague = () => {
    if (myLeaguePosition) {
      setShareData({
        type: 'league_promotion',
        data: {
          new_tier: myLeaguePosition.tier,
          previous_tier: myLeaguePosition.previous_tier || 'bronze'
        }
      })
      setShowShareModal(true)
    }
  }

  const fetchLeaderboard = async () => {
    try {
      setLoading(true)
      let endpoint = ''

      if (scope === 'global') {
        endpoint = `/leaderboards/?leaderboard_type=${leaderboardType}&period=${period}`
      } else if (scope === 'university') {
        endpoint = `/leaderboards/university?leaderboard_type=${leaderboardType}&period=${period}`
      }

      const response = await api.get(endpoint)
      setLeaderboard(response.data.entries || [])

      // Get current user position
      const me = await api.get('/users/me')
      const myEntry = response.data.entries?.find((e: LeaderboardEntry) => e.user_id === me.data.id)
      setCurrentUserRank(myEntry || null)
    } catch (error: any) {
      console.error('Error fetching leaderboard:', error)

      // Gérer l'erreur spécifique pour université non configurée
      // Si erreur 400 sur endpoint university, c'est que l'université n'est pas configurée
      if (error.response?.status === 400 && scope === 'university') {
        toast.error(t('leaderboard.universityNotConfigured'))
        // Revenir au classement global
        setScope('global')
        return
      }

      // Afficher le message d'erreur du serveur si disponible
      const serverMessage = error.response?.data?.detail
      if (serverMessage) {
        toast.error(serverMessage)
      } else {
        toast.error(t('leaderboard.loadError'))
      }
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
    <div className="container mx-auto px-3 sm:px-4 lg:px-6 py-4 sm:py-6 space-y-4 sm:space-y-6">
      {/* Header */}
      <div className="text-center">
        <div className="flex flex-col sm:flex-row items-center justify-center gap-2 sm:gap-3 mb-2">
          <div className="flex items-center gap-2">
            <Trophy className="h-6 w-6 sm:h-8 sm:w-8 text-yellow-500" />
            <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold">
              {t('leaderboard.title')}
            </h1>
          </div>
          {/* Indicateur temps réel */}
          <div className={`flex items-center gap-1.5 px-2 sm:px-2.5 py-1 rounded-full text-xs font-medium ${
            wsConnected
              ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
              : 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400'
          }`}>
            {wsConnected ? (
              <>
                <Wifi className="h-3 w-3" />
                <span className="hidden sm:inline">{t('leaderboard.online')}</span>
              </>
            ) : (
              <>
                <WifiOff className="h-3 w-3" />
                <span className="hidden sm:inline">{t('leaderboard.offline')}</span>
              </>
            )}
          </div>
        </div>
        <p className="text-sm sm:text-base text-muted-foreground">
          {t('leaderboard.subtitle')}
        </p>
      </div>

      {/* Onglets Classement / Ligues */}
      <div className="flex justify-center">
        <div className="inline-flex rounded-xl bg-gray-100 dark:bg-gray-800 p-1 gap-1 w-full sm:w-auto max-w-md">
          <button
            onClick={() => setActiveTab('leaderboard')}
            className={`flex-1 sm:flex-none px-3 sm:px-6 py-2 sm:py-2.5 rounded-lg font-medium transition-all text-sm sm:text-base ${
              activeTab === 'leaderboard'
                ? 'bg-white dark:bg-gray-700 shadow-md text-purple-600 dark:text-purple-400'
                : 'text-gray-600 dark:text-gray-400 hover:bg-white/50 dark:hover:bg-gray-700/50'
            }`}
          >
            <span className="flex items-center justify-center gap-1.5 sm:gap-2">
              <Trophy className="w-4 h-4" />
              <span className="truncate">{t('leaderboard.leaderboardTab')}</span>
            </span>
          </button>
          <button
            onClick={() => setActiveTab('leagues')}
            className={`flex-1 sm:flex-none px-3 sm:px-6 py-2 sm:py-2.5 rounded-lg font-medium transition-all text-sm sm:text-base ${
              activeTab === 'leagues'
                ? 'bg-white dark:bg-gray-700 shadow-md text-purple-600 dark:text-purple-400'
                : 'text-gray-600 dark:text-gray-400 hover:bg-white/50 dark:hover:bg-gray-700/50'
            }`}
          >
            <span className="flex items-center justify-center gap-1.5 sm:gap-2">
              <Crown className="w-4 h-4" />
              <span className="truncate">{t('leaderboard.leagues')}</span>
            </span>
          </button>
        </div>
      </div>

      {/* ===== ONGLET CLASSEMENT ===== */}
      {activeTab === 'leaderboard' && (
        <>
          {/* Activité en temps réel */}
          {recentUpdates.length > 0 && (
            <Card className="border-green-200 dark:border-green-800 bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-950/30 dark:to-emerald-950/30">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-3">
              <div className="relative">
                <Zap className="h-5 w-5 text-green-600" />
                <span className="absolute -top-1 -right-1 h-2 w-2 bg-green-500 rounded-full animate-ping"></span>
              </div>
              <span className="font-semibold text-green-700 dark:text-green-400">{t('leaderboard.liveActivity')}</span>
            </div>
            <div className="space-y-2">
              {recentUpdates.map((update, index) => (
                <div
                  key={update.id}
                  className={`flex items-center justify-between p-2 rounded-lg bg-white/70 dark:bg-gray-900/50 transition-all ${
                    index === 0 ? 'animate-pulse ring-2 ring-green-400' : ''
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full bg-green-100 dark:bg-green-900 flex items-center justify-center text-sm font-bold text-green-600">
                      {update.username.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <span className="font-medium text-sm">{update.username}</span>
                      <p className="text-xs text-muted-foreground">{update.reason}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5">
                    {update.level_up && (
                      <span className="text-xs bg-yellow-100 text-yellow-700 px-1.5 py-0.5 rounded-full">
                        🎉 Level Up!
                      </span>
                    )}
                    <span className="font-bold text-green-600 dark:text-green-400">
                      +{update.xp_gained} XP
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Filters */}
      <div className="grid grid-cols-3 gap-2 sm:flex sm:flex-wrap sm:gap-4 sm:justify-center">
        <Select value={leaderboardType} onValueChange={setLeaderboardType}>
          <SelectTrigger className="w-full sm:w-[160px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="xp">{t('leaderboard.xp')}</SelectItem>
            <SelectItem value="streak">{t('leaderboard.streak')}</SelectItem>
            <SelectItem value="notes">{t('leaderboard.notes')}</SelectItem>
            <SelectItem value="flashcards">{t('leaderboard.flashcards')}</SelectItem>
            <SelectItem value="quizzes">{t('leaderboard.quizzes')}</SelectItem>
            <SelectItem value="study_time">{t('leaderboard.studyTime')}</SelectItem>
          </SelectContent>
        </Select>

        <Select value={period} onValueChange={setPeriod}>
          <SelectTrigger className="w-full sm:w-[140px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="daily">{t('leaderboard.daily')}</SelectItem>
            <SelectItem value="weekly">{t('leaderboard.weekly')}</SelectItem>
            <SelectItem value="monthly">{t('leaderboard.monthly')}</SelectItem>
            <SelectItem value="all_time">{t('leaderboard.allTime')}</SelectItem>
          </SelectContent>
        </Select>

        <Select value={scope} onValueChange={setScope}>
          <SelectTrigger className="w-full sm:w-[150px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="global">🌍 {t('leaderboard.global')}</SelectItem>
            <SelectItem value="university">🎓 {t('leaderboard.myUniversity')}</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Top 3 Podium */}
      {top3.length >= 3 && (
        <div className="grid grid-cols-3 gap-2 sm:gap-4 lg:gap-6 items-end">
          {/* 2nd Place */}
          <Card className="order-1">
            <CardContent className="p-3 sm:p-6 text-center">
              <div className="inline-flex items-center justify-center w-10 h-10 sm:w-16 sm:h-16 bg-gradient-to-r from-gray-300 to-gray-500 rounded-full mb-2 sm:mb-4">
                <Medal className="h-5 w-5 sm:h-8 sm:w-8 text-white" />
              </div>
              <h3 className="font-bold text-sm sm:text-lg mb-0.5 sm:mb-1 truncate">{top3[1].username}</h3>
              <p className="text-xs sm:text-sm text-muted-foreground mb-1 sm:mb-3">Niv. {top3[1].level}</p>
              <div className="text-lg sm:text-2xl font-bold mb-0.5 sm:mb-1">
                {top3[1].score.toLocaleString()}
              </div>
              <div className="text-xs sm:text-sm text-muted-foreground hidden sm:block">{getTypeLabel(leaderboardType)}</div>
            </CardContent>
          </Card>

          {/* 1st Place */}
          <Card className="bg-gradient-to-r from-yellow-400 to-yellow-600 order-2 transform scale-105 sm:scale-110 border-none -mt-2 sm:-mt-4">
            <CardContent className="p-3 sm:p-6 text-center">
              <div className="inline-flex items-center justify-center w-12 h-12 sm:w-20 sm:h-20 bg-white rounded-full mb-2 sm:mb-4">
                <Trophy className="h-6 w-6 sm:h-10 sm:w-10 text-yellow-600" />
              </div>
              <h3 className="font-bold text-white text-sm sm:text-xl mb-0.5 sm:mb-1 truncate">{top3[0].username}</h3>
              <p className="text-yellow-100 text-xs sm:text-base mb-1 sm:mb-3">Niv. {top3[0].level}</p>
              <div className="text-xl sm:text-3xl font-bold text-white mb-0.5 sm:mb-1">
                {top3[0].score.toLocaleString()}
              </div>
              <div className="text-yellow-100 text-xs sm:text-base hidden sm:block">{getTypeLabel(leaderboardType)}</div>
              <div className="mt-2 sm:mt-4 flex items-center justify-center space-x-2 sm:space-x-4 text-white">
                <div className="flex items-center">
                  <Flame className="h-3 w-3 sm:h-4 sm:w-4 mr-0.5 sm:mr-1" />
                  <span className="text-xs sm:text-sm">{top3[0].streak}</span>
                </div>
                <div className="hidden sm:flex items-center">
                  <Star className="h-4 w-4 mr-1" />
                  <span className="text-sm">Niveau {top3[0].level}</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* 3rd Place */}
          <Card className="order-3">
            <CardContent className="p-3 sm:p-6 text-center">
              <div className="inline-flex items-center justify-center w-10 h-10 sm:w-16 sm:h-16 bg-gradient-to-r from-orange-400 to-orange-600 rounded-full mb-2 sm:mb-4">
                <Medal className="h-5 w-5 sm:h-8 sm:w-8 text-white" />
              </div>
              <h3 className="font-bold text-sm sm:text-lg mb-0.5 sm:mb-1 truncate">{top3[2].username}</h3>
              <p className="text-xs sm:text-sm text-muted-foreground mb-1 sm:mb-3">Niv. {top3[2].level}</p>
              <div className="text-lg sm:text-2xl font-bold mb-0.5 sm:mb-1">
                {top3[2].score.toLocaleString()}
              </div>
              <div className="text-xs sm:text-sm text-muted-foreground hidden sm:block">{getTypeLabel(leaderboardType)}</div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Full Leaderboard */}
      <Card>
        <CardHeader className="p-4 sm:p-6">
          <CardTitle className="text-base sm:text-lg">{t('leaderboard.fullLeaderboard')}</CardTitle>
        </CardHeader>
        <CardContent className="p-2 sm:p-6 pt-0">
          <div className="space-y-1.5 sm:space-y-2">
            {leaderboard.map((entry) => {
              const TypeIcon = getTypeIcon(leaderboardType)

              return (
                <div
                  key={entry.user_id}
                  className={`p-2.5 sm:p-4 rounded-lg transition-colors ${
                    entry.rank <= 3
                      ? getRankBadge(entry.rank)
                      : 'bg-gray-50 dark:bg-gray-900 hover:bg-gray-100 dark:hover:bg-gray-800'
                  }`}
                >
                  <div className="flex items-center gap-2 sm:gap-4">
                    {/* Rank */}
                    <div className="flex-shrink-0 w-8 sm:w-12 flex items-center justify-center">
                      {entry.rank <= 3 ? (
                        getRankIcon(entry.rank)
                      ) : (
                        <span className="text-sm sm:text-lg font-bold text-gray-600">#{entry.rank}</span>
                      )}
                    </div>

                    {/* Avatar */}
                    <div className="flex-shrink-0">
                      <div className={`w-9 h-9 sm:w-12 sm:h-12 rounded-full flex items-center justify-center font-bold text-sm sm:text-lg ${
                        entry.rank <= 3 ? 'bg-white text-gray-900' : 'bg-primary text-primary-foreground'
                      }`}>
                        {entry.username.charAt(0).toUpperCase()}
                      </div>
                    </div>

                    {/* User Info + Mobile Stats */}
                    <div className="flex-1 min-w-0">
                      <h3 className={`font-semibold text-sm sm:text-base truncate ${entry.rank <= 3 ? 'text-white' : ''}`}>
                        {entry.username}
                      </h3>
                      <div className="flex items-center gap-2 sm:gap-3">
                        <p className={`text-xs sm:text-sm ${entry.rank <= 3 ? 'text-white/80' : 'text-muted-foreground'}`}>
                          Niv. {entry.level}
                        </p>
                        {/* Mobile stats inline */}
                        <div className="flex sm:hidden items-center gap-2">
                          <span className={`text-xs font-bold ${entry.rank <= 3 ? 'text-white' : ''}`}>
                            {entry.score.toLocaleString()}
                          </span>
                          {entry.streak > 0 && (
                            <span className={`text-xs flex items-center ${entry.rank <= 3 ? 'text-white/80' : 'text-orange-600'}`}>
                              <Flame className="h-3 w-3 mr-0.5" />
                              {entry.streak}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Desktop Stats */}
                    <div className="hidden sm:flex items-center gap-6">
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
            <div className="text-center py-8 sm:py-12 text-muted-foreground">
              <Trophy className="h-10 w-10 sm:h-12 sm:w-12 mx-auto mb-3 opacity-20" />
              <p className="text-sm sm:text-base">{t('leaderboard.noData')}</p>
            </div>
          )}
        </CardContent>
      </Card>

          {/* Current User Position */}
          {currentUserRank && (
            <Card className="bg-gradient-to-r from-primary to-purple-600 text-white border-none">
              <CardContent className="p-4 sm:p-6">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                  <div className="flex items-center gap-3 sm:gap-4">
                    <div className="w-12 h-12 sm:w-16 sm:h-16 bg-white rounded-full flex items-center justify-center text-primary font-bold text-lg sm:text-2xl shrink-0">
                      #{currentUserRank.rank}
                    </div>
                    <div>
                      <h3 className="font-bold text-base sm:text-xl mb-0.5 sm:mb-1">{t('leaderboard.yourPosition')}</h3>
                      <p className="text-white/80 text-sm sm:text-base">{t('leaderboard.level')} {currentUserRank.level}</p>
                    </div>
                  </div>
                  <div className="flex sm:flex-col items-center sm:items-end gap-3 sm:gap-0 w-full sm:w-auto justify-between sm:justify-start">
                    <div className="sm:text-right">
                      <div className="text-xl sm:text-3xl font-bold sm:mb-1">
                        {currentUserRank.score.toLocaleString()}
                      </div>
                      <div className="text-white/80 text-xs sm:text-base hidden sm:block">{getTypeLabel(leaderboardType)}</div>
                    </div>
                    <div className="flex items-center gap-1 sm:mt-2">
                      <Flame className="h-4 w-4" />
                      <span className="text-sm">{currentUserRank.streak} {t('leaderboard.days')}</span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Info Card */}
          <Card className="bg-blue-50 dark:bg-blue-950 border-blue-200 dark:border-blue-800">
            <CardContent className="p-4 sm:p-6">
              <div className="flex items-start gap-3 sm:gap-4">
                <div className="p-2 sm:p-3 bg-blue-100 dark:bg-blue-900 rounded-lg shrink-0">
                  <TrendingUp className="h-5 w-5 sm:h-6 sm:w-6 text-blue-600 dark:text-blue-400" />
                </div>
                <div className="min-w-0">
                  <h3 className="font-semibold mb-1.5 sm:mb-2 text-sm sm:text-base">{t('leaderboard.howToClimb')}</h3>
                  <ul className="space-y-0.5 sm:space-y-1 text-xs sm:text-sm text-muted-foreground">
                    {tArray('leaderboard.howToClimbTips').map((tip, index) => (
                      <li key={index}>• {tip}</li>
                    ))}
                  </ul>
                </div>
              </div>
            </CardContent>
          </Card>
        </>
      )}

      {/* ===== ONGLET LIGUES ===== */}
      {activeTab === 'leagues' && (
        <>
          {leagueLoading ? (
            <div className="flex items-center justify-center h-64">
              <Loader2 className="h-12 w-12 animate-spin text-primary" />
            </div>
          ) : (
            <>
              {/* Ma position dans la ligue */}
              {myLeaguePosition && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                >
                  <Card className={`border-2 ${getLeagueConfig(myLeaguePosition.tier).borderColor} overflow-hidden`}>
                    <div className={`bg-gradient-to-r ${getLeagueConfig(myLeaguePosition.tier).bgGradient} p-4 sm:p-6 text-white`}>
                      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-4">
                        <div className="flex items-center gap-3 sm:gap-4">
                          <div className="text-3xl sm:text-5xl">{getLeagueConfig(myLeaguePosition.tier).icon}</div>
                          <div>
                            <h2 className="text-lg sm:text-2xl font-bold">Ligue {getLeagueConfig(myLeaguePosition.tier).name}</h2>
                            <p className="text-white/80 text-xs sm:text-base">Semaine {myLeaguePosition.weeks_in_tier} dans cette ligue</p>
                          </div>
                        </div>
                        <button
                          onClick={handleShareLeague}
                          className="flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-1.5 sm:py-2 bg-white/20 hover:bg-white/30 rounded-lg transition text-sm sm:text-base"
                        >
                          <Share2 className="w-4 h-4" />
                          <span className="hidden sm:inline">Partager</span>
                        </button>
                      </div>
                    </div>
                    <CardContent className="p-4 sm:p-6">
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 sm:gap-6">
                        {/* Rang actuel */}
                        <div className="text-center">
                          <div className="text-2xl sm:text-4xl font-bold text-purple-600">#{myLeaguePosition.rank}</div>
                          <div className="text-xs sm:text-sm text-muted-foreground">Rang actuel</div>
                          <div className="text-[10px] sm:text-xs text-gray-400">sur {myLeaguePosition.total_in_league}</div>
                        </div>

                        {/* XP hebdomadaire */}
                        <div className="text-center">
                          <div className="text-2xl sm:text-4xl font-bold text-green-600">{myLeaguePosition.weekly_xp.toLocaleString()}</div>
                          <div className="text-xs sm:text-sm text-muted-foreground">XP semaine</div>
                        </div>

                        {/* Zone de promotion/rétrogradation */}
                        <div className="text-center">
                          {myLeaguePosition.is_promotion_zone ? (
                            <div className="flex flex-col items-center">
                              <div className="flex items-center gap-0.5 sm:gap-1 text-lg sm:text-2xl font-bold text-green-500">
                                <ChevronUp className="w-5 h-5 sm:w-6 sm:h-6" />
                                <span className="hidden sm:inline">Promotion</span>
                                <span className="sm:hidden">Promo</span>
                              </div>
                              <div className="text-xs sm:text-sm text-green-600">Zone de promotion!</div>
                              {myLeaguePosition.next_tier && (
                                <div className="text-[10px] sm:text-xs text-gray-400 mt-0.5 sm:mt-1">
                                  Vers {getLeagueConfig(myLeaguePosition.next_tier).name} {getLeagueConfig(myLeaguePosition.next_tier).icon}
                                </div>
                              )}
                            </div>
                          ) : myLeaguePosition.is_demotion_zone ? (
                            <div className="flex flex-col items-center">
                              <div className="flex items-center gap-0.5 sm:gap-1 text-lg sm:text-2xl font-bold text-red-500">
                                <ChevronDown className="w-5 h-5 sm:w-6 sm:h-6" />
                                <span className="hidden sm:inline">Rétrogradation</span>
                                <span className="sm:hidden">Danger</span>
                              </div>
                              <div className="text-xs sm:text-sm text-red-600">Zone de danger!</div>
                              {myLeaguePosition.previous_tier && (
                                <div className="text-[10px] sm:text-xs text-gray-400 mt-0.5 sm:mt-1">
                                  Vers {getLeagueConfig(myLeaguePosition.previous_tier).name} {getLeagueConfig(myLeaguePosition.previous_tier).icon}
                                </div>
                              )}
                            </div>
                          ) : (
                            <div className="flex flex-col items-center">
                              <div className="text-lg sm:text-2xl font-bold text-gray-500">—</div>
                              <div className="text-xs sm:text-sm text-muted-foreground">Zone stable</div>
                            </div>
                          )}
                        </div>

                        {/* Meilleur rang */}
                        <div className="text-center">
                          <div className="text-xl sm:text-2xl">{getLeagueConfig(myLeaguePosition.highest_tier).icon}</div>
                          <div className="text-xs sm:text-sm text-muted-foreground">Meilleure ligue</div>
                          <div className="text-[10px] sm:text-xs font-medium">{getLeagueConfig(myLeaguePosition.highest_tier).name}</div>
                        </div>
                      </div>

                      {/* Barre de progression vers promotion/rétrogradation */}
                      <div className="mt-4 sm:mt-6">
                        <div className="flex justify-between text-[10px] sm:text-sm mb-1.5 sm:mb-2">
                          <span className="text-red-500">Rétrogradation</span>
                          <span className="text-green-500">Promotion</span>
                        </div>
                        <div className="h-2 sm:h-3 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                          <motion.div
                            initial={{ width: 0 }}
                            animate={{
                              width: `${Math.min(100, Math.max(0, (myLeaguePosition.rank / myLeaguePosition.total_in_league) * 100))}%`
                            }}
                            className={`h-full ${
                              myLeaguePosition.is_promotion_zone
                                ? 'bg-gradient-to-r from-green-400 to-green-600'
                                : myLeaguePosition.is_demotion_zone
                                ? 'bg-gradient-to-r from-red-400 to-red-600'
                                : 'bg-gradient-to-r from-yellow-400 to-yellow-600'
                            }`}
                            style={{ marginLeft: `${100 - (myLeaguePosition.rank / myLeaguePosition.total_in_league) * 100}%` }}
                          />
                        </div>
                        <div className="flex justify-between text-[10px] sm:text-xs text-gray-400 mt-1">
                          <span>#{myLeaguePosition.total_in_league}</span>
                          <span>Vous: #{myLeaguePosition.rank}</span>
                          <span>#1</span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              )}

              {/* Sélecteur de ligue */}
              <div className="w-full overflow-x-auto pb-2 -mx-3 px-3 sm:mx-0 sm:px-0 sm:overflow-visible">
                <div className="flex gap-1.5 sm:gap-2 justify-start sm:justify-center min-w-max sm:min-w-0 sm:flex-wrap">
                  {(['bronze', 'silver', 'gold', 'diamond', 'master'] as LeagueTier[]).map((tier) => (
                    <button
                      key={tier}
                      onClick={() => setSelectedLeagueTier(tier)}
                      className={`px-2.5 sm:px-4 py-1.5 sm:py-2 rounded-lg font-medium transition-all flex items-center gap-1 sm:gap-2 text-sm sm:text-base whitespace-nowrap ${
                        selectedLeagueTier === tier
                          ? `bg-gradient-to-r ${getLeagueConfig(tier).bgGradient} text-white shadow-lg scale-105`
                          : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'
                      }`}
                    >
                      <span>{getLeagueConfig(tier).icon}</span>
                      <span className="hidden sm:inline">{getLeagueConfig(tier).name}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Classement de la ligue sélectionnée */}
              {selectedLeagueTier && (
                <Card>
                  <CardHeader className="p-4 sm:p-6">
                    <CardTitle className="flex items-center gap-2 sm:gap-3 text-base sm:text-lg">
                      <span className="text-xl sm:text-2xl">{getLeagueConfig(selectedLeagueTier).icon}</span>
                      <span className="truncate">Ligue {getLeagueConfig(selectedLeagueTier).name}</span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-2 sm:p-6 pt-0">
                    <div className="space-y-1.5 sm:space-y-2">
                      {leagueEntries.map((entry, index) => {
                        const isCurrentUser = myLeaguePosition?.user_id === entry.user_id
                        const tierConfig = getLeagueConfig(selectedLeagueTier)

                        return (
                          <motion.div
                            key={entry.user_id}
                            initial={{ opacity: 0, x: -20 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: index * 0.03 }}
                            className={`p-2.5 sm:p-4 rounded-lg transition-all ${
                              isCurrentUser
                                ? `bg-gradient-to-r ${tierConfig.bgGradient} text-white`
                                : entry.is_promotion_zone
                                ? 'bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800'
                                : entry.is_demotion_zone
                                ? 'bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800'
                                : 'bg-gray-50 dark:bg-gray-900 hover:bg-gray-100 dark:hover:bg-gray-800'
                            }`}
                          >
                            <div className="flex items-center gap-2 sm:gap-4">
                              {/* Rank */}
                              <div className="flex-shrink-0 w-8 sm:w-12 flex items-center justify-center">
                                {entry.rank === 1 ? (
                                  <Trophy className={`h-5 w-5 sm:h-6 sm:w-6 ${isCurrentUser ? 'text-white' : 'text-yellow-500'}`} />
                                ) : entry.rank === 2 ? (
                                  <Medal className={`h-5 w-5 sm:h-6 sm:w-6 ${isCurrentUser ? 'text-white' : 'text-gray-400'}`} />
                                ) : entry.rank === 3 ? (
                                  <Medal className={`h-5 w-5 sm:h-6 sm:w-6 ${isCurrentUser ? 'text-white' : 'text-orange-600'}`} />
                                ) : (
                                  <span className={`text-sm sm:text-lg font-bold ${isCurrentUser ? 'text-white' : 'text-gray-600'}`}>
                                    #{entry.rank}
                                  </span>
                                )}
                              </div>

                              {/* Avatar */}
                              <div className="flex-shrink-0">
                                <div className={`w-9 h-9 sm:w-12 sm:h-12 rounded-full flex items-center justify-center font-bold text-sm sm:text-lg ${
                                  isCurrentUser ? 'bg-white text-gray-900' : 'bg-primary text-primary-foreground'
                                }`}>
                                  {entry.username.charAt(0).toUpperCase()}
                                </div>
                              </div>

                              {/* User Info + Mobile Stats */}
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
                                  <h3 className={`font-semibold text-sm sm:text-base truncate ${isCurrentUser ? 'text-white' : ''}`}>
                                    {entry.username}
                                  </h3>
                                  {isCurrentUser && (
                                    <span className="px-1.5 sm:px-2 py-0.5 bg-white/20 rounded-full text-[10px] sm:text-xs">Vous</span>
                                  )}
                                  {entry.is_promotion_zone && !isCurrentUser && (
                                    <ChevronUp className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-green-500" />
                                  )}
                                  {entry.is_demotion_zone && !isCurrentUser && (
                                    <ChevronDown className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-red-500" />
                                  )}
                                </div>
                                <div className="flex items-center gap-2 sm:gap-3">
                                  <p className={`text-xs sm:text-sm ${isCurrentUser ? 'text-white/80' : 'text-muted-foreground'}`}>
                                    Niv. {entry.level}
                                  </p>
                                  {/* Mobile stats inline */}
                                  <div className="flex sm:hidden items-center gap-2">
                                    <span className={`text-xs font-bold ${isCurrentUser ? 'text-white' : ''}`}>
                                      {entry.weekly_xp.toLocaleString()} XP
                                    </span>
                                    {entry.current_streak > 0 && (
                                      <span className={`text-xs flex items-center ${isCurrentUser ? 'text-white/80' : 'text-orange-600'}`}>
                                        <Flame className="h-3 w-3 mr-0.5" />
                                        {entry.current_streak}
                                      </span>
                                    )}
                                  </div>
                                </div>
                              </div>

                              {/* Desktop Stats */}
                              <div className="hidden sm:flex items-center gap-6">
                                <div className="text-center">
                                  <div className={`text-lg font-bold flex items-center gap-1 ${isCurrentUser ? 'text-white' : ''}`}>
                                    <Zap className="h-4 w-4" />
                                    {entry.weekly_xp.toLocaleString()}
                                  </div>
                                  <div className={`text-xs ${isCurrentUser ? 'text-white/80' : 'text-muted-foreground'}`}>
                                    XP semaine
                                  </div>
                                </div>

                                {entry.current_streak > 0 && (
                                  <div className="text-center">
                                    <div className={`text-lg font-bold flex items-center gap-1 ${isCurrentUser ? 'text-white' : 'text-orange-600'}`}>
                                      <Flame className="h-4 w-4" />
                                      {entry.current_streak}
                                    </div>
                                    <div className={`text-xs ${isCurrentUser ? 'text-white/80' : 'text-muted-foreground'}`}>
                                      Série
                                    </div>
                                  </div>
                                )}
                              </div>
                            </div>
                          </motion.div>
                        )
                      })}
                    </div>

                    {leagueEntries.length === 0 && (
                      <div className="text-center py-8 sm:py-12 text-muted-foreground">
                        <Crown className="h-10 w-10 sm:h-12 sm:w-12 mx-auto mb-3 opacity-20" />
                        <p className="text-sm sm:text-base">Aucun joueur dans cette ligue</p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}

              {/* Info sur les ligues */}
              <Card className="bg-gradient-to-r from-purple-50 to-indigo-50 dark:from-purple-950/30 dark:to-indigo-950/30 border-purple-200 dark:border-purple-800">
                <CardContent className="p-4 sm:p-6">
                  <div className="flex items-start gap-3 sm:gap-4">
                    <div className="p-2 sm:p-3 bg-purple-100 dark:bg-purple-900 rounded-lg shrink-0">
                      <Crown className="h-5 w-5 sm:h-6 sm:w-6 text-purple-600 dark:text-purple-400" />
                    </div>
                    <div className="min-w-0">
                      <h3 className="font-semibold mb-1.5 sm:mb-2 text-sm sm:text-base">Comment fonctionnent les ligues?</h3>
                      <ul className="space-y-0.5 sm:space-y-1 text-xs sm:text-sm text-muted-foreground">
                        <li>• Gagnez de l'XP chaque semaine pour monter</li>
                        <li>• Les top 3 sont promus à la ligue supérieure</li>
                        <li>• Les derniers risquent la rétrogradation</li>
                        <li>• Reset chaque lundi à minuit</li>
                        <li>• Plus de bonus dans les ligues élevées!</li>
                      </ul>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </>
          )}
        </>
      )}

      {/* Modal de partage */}
      {shareData && (
        <ShareModal
          isOpen={showShareModal}
          onClose={() => setShowShareModal(false)}
          shareType={shareData.type}
          title={shareData.type === 'league_promotion' ? 'Partagez votre ligue!' : 'Partagez vos stats!'}
          subtitle={myLeaguePosition ? `Ligue ${getLeagueConfig(myLeaguePosition.tier).name}` : undefined}
          data={shareData.data}
        />
      )}
    </div>
  )
}
