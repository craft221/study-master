'use client'

import { useState, useEffect, useCallback } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Swords, Trophy, Clock, CheckCircle2, XCircle, Play,
  Loader2, Star, Zap, User, AlertCircle, Crown, Target,
  TrendingUp, TrendingDown, Users, Link2, Copy, Share2, Sparkles
} from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import { useRouter } from 'next/navigation'
import duelsService, { Duel, DuelStatus, DuelStats, RecommendedOpponent } from '@/services/duels'
import api from '@/lib/api'

interface Quiz {
  id: number
  title: string
  subject_id: number
}

interface UserOption {
  id: number
  username: string
  level: number
}

export default function DuelsPage() {
  const { toast } = useToast()
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [duels, setDuels] = useState<Duel[]>([])
  const [pendingDuels, setPendingDuels] = useState<Duel[]>([])
  const [stats, setStats] = useState<DuelStats | null>(null)
  const [quizzes, setQuizzes] = useState<Quiz[]>([])
  const [users, setUsers] = useState<UserOption[]>([])
  const [currentUserId, setCurrentUserId] = useState<number | null>(null)

  // Recommended opponents
  const [recommendedOpponents, setRecommendedOpponents] = useState<RecommendedOpponent[]>([])

  // Create duel dialog
  const [createDialogOpen, setCreateDialogOpen] = useState(false)
  const [selectedOpponent, setSelectedOpponent] = useState('')
  const [selectedQuiz, setSelectedQuiz] = useState('')
  const [stakesXP, setStakesXP] = useState(50)
  const [creating, setCreating] = useState(false)

  // Invite link dialog
  const [inviteDialogOpen, setInviteDialogOpen] = useState(false)
  const [inviteLink, setInviteLink] = useState('')
  const [creatingInvite, setCreatingInvite] = useState(false)

  const fetchData = useCallback(async () => {
    try {
      setLoading(true)

      // Récupérer les données en parallèle
      const [duelsRes, pendingRes, statsRes, quizzesRes, usersRes, profileRes, recommendedRes] = await Promise.all([
        duelsService.getAll(),
        duelsService.getPending(),
        duelsService.getMyStats(),
        api.get('/quizzes/'),
        api.get('/users/'),
        api.get('/users/me'),
        duelsService.getRecommendedOpponents(5)
      ])

      setDuels(duelsRes.duels)
      setPendingDuels(pendingRes)
      setStats(statsRes)
      setQuizzes(quizzesRes.data)
      setUsers(usersRes.data.filter((u: UserOption) => u.id !== profileRes.data.id))
      setCurrentUserId(profileRes.data.id)
      setRecommendedOpponents(recommendedRes.recommendations)
    } catch (error) {
      console.error('Error fetching data:', error)
      toast({
        title: 'Erreur',
        description: 'Impossible de charger les duels',
        variant: 'destructive'
      })
    } finally {
      setLoading(false)
    }
  }, [toast])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const handleCreateDuel = async () => {
    if (!selectedOpponent || !selectedQuiz) {
      toast({
        title: 'Attention',
        description: 'Sélectionnez un adversaire et un quiz',
        variant: 'destructive'
      })
      return
    }

    try {
      setCreating(true)
      await duelsService.create({
        opponent_id: parseInt(selectedOpponent),
        quiz_id: parseInt(selectedQuiz),
        stakes_xp: stakesXP
      })

      toast({
        title: 'Défi envoyé ! ⚔️',
        description: 'Votre adversaire a reçu votre défi',
      })

      setCreateDialogOpen(false)
      setSelectedOpponent('')
      setSelectedQuiz('')
      setStakesXP(50)
      fetchData()
    } catch (error: any) {
      console.error('Create duel error:', error)
      toast({
        title: 'Erreur',
        description: error.response?.data?.detail || 'Impossible de créer le défi',
        variant: 'destructive'
      })
    } finally {
      setCreating(false)
    }
  }

  const handleAcceptDuel = async (duelId: number) => {
    try {
      await duelsService.accept(duelId)
      toast({
        title: 'Défi accepté ! 🎯',
        description: 'Que le meilleur gagne !',
      })
      fetchData()
    } catch (error: any) {
      console.error('Accept error:', error)
      toast({
        title: 'Erreur',
        description: error.response?.data?.detail || 'Impossible d\'accepter le défi',
        variant: 'destructive'
      })
    }
  }

  const handleDeclineDuel = async (duelId: number) => {
    try {
      await duelsService.decline(duelId)
      toast({
        title: 'Défi refusé',
        description: 'Le défi a été décliné',
      })
      fetchData()
    } catch (error: any) {
      console.error('Decline error:', error)
      toast({
        title: 'Erreur',
        description: error.response?.data?.detail || 'Impossible de refuser le défi',
        variant: 'destructive'
      })
    }
  }

  const startDuel = (quizId: number, duelId: number) => {
    router.push(`/quizzes/${quizId}?duel_id=${duelId}`)
  }

  // Défier un adversaire recommandé
  const handleChallengeRecommended = (opponent: RecommendedOpponent) => {
    setSelectedOpponent(opponent.id.toString())
    setCreateDialogOpen(true)
  }

  // Créer un lien d'invitation
  const handleCreateInviteLink = async () => {
    if (!selectedQuiz) {
      toast({
        title: 'Attention',
        description: 'Sélectionnez un quiz pour le duel',
        variant: 'destructive'
      })
      return
    }

    try {
      setCreatingInvite(true)
      const result = await duelsService.createInviteLink({
        quiz_id: parseInt(selectedQuiz),
        stakes_xp: stakesXP
      })

      const fullUrl = `${window.location.origin}${result.invite_url}`
      setInviteLink(fullUrl)
      setInviteDialogOpen(true)

      toast({
        title: 'Lien créé ! 🔗',
        description: 'Partagez-le avec votre adversaire',
      })
    } catch (error: any) {
      console.error('Create invite link error:', error)
      toast({
        title: 'Erreur',
        description: error.response?.data?.detail || 'Impossible de créer le lien',
        variant: 'destructive'
      })
    } finally {
      setCreatingInvite(false)
    }
  }

  // Copier le lien d'invitation
  const copyInviteLink = () => {
    navigator.clipboard.writeText(inviteLink)
    toast({
      title: 'Copié ! 📋',
      description: 'Le lien a été copié dans le presse-papiers',
    })
  }

  // Badge de qualité du match
  const getMatchQualityBadge = (quality: string) => {
    const config = {
      excellent: { className: 'bg-green-100 text-green-800', text: 'Match parfait' },
      good: { className: 'bg-blue-100 text-blue-800', text: 'Bon match' },
      fair: { className: 'bg-yellow-100 text-yellow-800', text: 'Match équilibré' }
    }
    const c = config[quality as keyof typeof config] || config.fair
    return <Badge className={c.className}>{c.text}</Badge>
  }

  // Badge de statut avec couleurs appropriées
  const getStatusBadge = (status: DuelStatus) => {
    const variants: Record<DuelStatus, { variant: 'default' | 'secondary' | 'outline' | 'destructive', icon: any, text: string, className: string }> = {
      pending: { variant: 'secondary', icon: Clock, text: 'En attente', className: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300' },
      accepted: { variant: 'default', icon: CheckCircle2, text: 'Accepté', className: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300' },
      in_progress: { variant: 'default', icon: Swords, text: 'En cours', className: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300' },
      completed: { variant: 'outline', icon: Trophy, text: 'Terminé', className: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300' },
      declined: { variant: 'destructive', icon: XCircle, text: 'Refusé', className: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300' },
      cancelled: { variant: 'secondary', icon: XCircle, text: 'Annulé', className: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300' }
    }

    const config = variants[status] || variants.pending
    const Icon = config.icon

    return (
      <Badge className={`gap-1 ${config.className}`}>
        <Icon className="h-3 w-3" />
        {config.text}
      </Badge>
    )
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

  // Filtrer les duels par statut
  // Actifs = accepté ou en cours (les deux joueurs peuvent jouer)
  const activeDuels = duels.filter(d => ['accepted', 'in_progress'].includes(d.status))
  // Envoyés = pending où je suis le challenger (en attente de réponse)
  const sentDuels = duels.filter(d => d.status === 'pending' && d.challenger_id === currentUserId)
  const completedDuels = duels.filter(d => d.status === 'completed')

  return (
    <div className="space-y-3 sm:space-y-4 lg:space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold flex items-center gap-2">
            <Swords className="h-5 w-5 sm:h-6 sm:w-6 lg:h-8 lg:w-8 text-orange-500" />
            Duels
          </h1>
          <p className="text-muted-foreground mt-1 text-sm sm:text-base">
            Défiez vos amis et gagnez de l'XP !
          </p>
        </div>

        <div className="flex gap-2">
          <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
            <DialogTrigger asChild>
              <Button size="default" className="gap-1 sm:gap-2 text-sm sm:text-base px-3 sm:px-4">
                <Target className="h-4 w-4 sm:h-5 sm:w-5" />
                <span className="hidden sm:inline">Lancer un défi</span>
                <span className="sm:hidden">Défier</span>
              </Button>
            </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Créer un duel</DialogTitle>
              <DialogDescription>
                Choisissez un adversaire et un quiz pour le défi
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="opponent">Adversaire</Label>
                <Select value={selectedOpponent} onValueChange={setSelectedOpponent}>
                  <SelectTrigger id="opponent">
                    <SelectValue placeholder="Sélectionner un adversaire" />
                  </SelectTrigger>
                  <SelectContent>
                    {users.map(user => (
                      <SelectItem key={user.id} value={user.id.toString()}>
                        {user.username} (Niveau {user.level})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="quiz">Quiz</Label>
                <Select value={selectedQuiz} onValueChange={setSelectedQuiz}>
                  <SelectTrigger id="quiz">
                    <SelectValue placeholder="Sélectionner un quiz" />
                  </SelectTrigger>
                  <SelectContent>
                    {quizzes.map(quiz => (
                      <SelectItem key={quiz.id} value={quiz.id.toString()}>
                        {quiz.title}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="stakes">Enjeux XP</Label>
                <Input
                  id="stakes"
                  type="number"
                  min={10}
                  max={500}
                  step={10}
                  value={stakesXP}
                  onChange={(e) => setStakesXP(parseInt(e.target.value) || 50)}
                />
                <p className="text-xs text-muted-foreground">
                  Le gagnant remporte {stakesXP} XP, le perdant en perd {Math.round(stakesXP / 2)}
                </p>
              </div>
            </div>

            <Button onClick={handleCreateDuel} disabled={creating} className="w-full">
              {creating ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Swords className="h-4 w-4 mr-2" />
              )}
              Envoyer le défi
            </Button>

            <div className="relative my-4">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-background px-2 text-muted-foreground">ou</span>
              </div>
            </div>

            <Button
              variant="outline"
              onClick={handleCreateInviteLink}
              disabled={creatingInvite || !selectedQuiz}
              className="w-full gap-2"
            >
              {creatingInvite ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Link2 className="h-4 w-4" />
              )}
              Créer un lien d'invitation
            </Button>
            <p className="text-xs text-muted-foreground text-center">
              Partagez le lien pour défier n'importe qui
            </p>
          </DialogContent>
        </Dialog>
        </div>
      </div>

      {/* Invite Link Dialog */}
      <Dialog open={inviteDialogOpen} onOpenChange={setInviteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Share2 className="h-5 w-5 text-primary" />
              Lien d'invitation créé !
            </DialogTitle>
            <DialogDescription>
              Partagez ce lien avec la personne que vous voulez défier. Il expire dans 24 heures.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="flex gap-2">
              <Input
                value={inviteLink}
                readOnly
                className="font-mono text-sm"
              />
              <Button onClick={copyInviteLink} variant="outline" size="icon">
                <Copy className="h-4 w-4" />
              </Button>
            </div>

            <div className="flex gap-2">
              <Button
                variant="outline"
                className="flex-1 gap-2"
                onClick={() => {
                  const text = `Je te défie en duel ! 🎯\n\nClique ici pour accepter: ${inviteLink}`
                  navigator.clipboard.writeText(text)
                  toast({ title: 'Message copié !', description: 'Prêt à partager' })
                }}
              >
                <Copy className="h-4 w-4" />
                Copier le message
              </Button>
            </div>

            <p className="text-sm text-muted-foreground text-center">
              Enjeux: <span className="font-bold text-primary">{stakesXP} XP</span>
            </p>
          </div>

          <Button onClick={() => setInviteDialogOpen(false)} className="w-full">
            Fermer
          </Button>
        </DialogContent>
      </Dialog>

      {/* Recommended Opponents */}
      {recommendedOpponents.length > 0 && (
        <Card>
          <CardHeader className="p-3 sm:p-4 lg:p-6">
            <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
              <Sparkles className="h-4 w-4 sm:h-5 sm:w-5 text-yellow-500" />
              Adversaires recommandés
            </CardTitle>
            <CardDescription className="text-xs sm:text-sm">
              Joueurs avec un niveau similaire
            </CardDescription>
          </CardHeader>
          <CardContent className="p-3 sm:p-4 lg:p-6 pt-0">
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2 sm:gap-3">
              {recommendedOpponents.map(opponent => (
                <div
                  key={opponent.id}
                  className="flex flex-col items-center p-2 sm:p-4 rounded-lg border bg-card hover:bg-accent transition-colors"
                >
                  <div className="p-2 sm:p-3 rounded-full bg-primary/10 mb-1 sm:mb-2">
                    <User className="h-4 w-4 sm:h-6 sm:w-6 text-primary" />
                  </div>
                  <h4 className="font-semibold text-center text-xs sm:text-sm truncate max-w-full">{opponent.username}</h4>
                  <div className="flex items-center gap-1 text-[10px] sm:text-sm text-muted-foreground">
                    <Star className="h-2.5 w-2.5 sm:h-3 sm:w-3" />
                    Niv. {opponent.level}
                  </div>
                  <div className="text-[10px] sm:text-xs text-muted-foreground mb-1 sm:mb-2 hidden sm:block">
                    {opponent.total_xp} XP ({opponent.xp_difference > 0 ? '+' : ''}{opponent.xp_difference})
                  </div>
                  <div className="hidden sm:block">{getMatchQualityBadge(opponent.match_quality)}</div>
                  <Button
                    size="sm"
                    className="mt-2 sm:mt-3 w-full text-xs sm:text-sm h-7 sm:h-9"
                    onClick={() => handleChallengeRecommended(opponent)}
                    disabled={opponent.has_pending_duel}
                  >
                    {opponent.has_pending_duel ? 'En cours' : 'Défier'}
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-3 lg:gap-4">
        <Card className="p-0">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 p-3 sm:p-4 pb-1 sm:pb-2">
            <CardTitle className="text-xs sm:text-sm font-medium">Actifs</CardTitle>
            <Swords className="h-3 w-3 sm:h-4 sm:w-4 text-purple-500" />
          </CardHeader>
          <CardContent className="p-3 sm:p-4 pt-0">
            <div className="text-lg sm:text-2xl font-bold">{activeDuels.length}</div>
          </CardContent>
        </Card>

        <Card className="p-0">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 p-3 sm:p-4 pb-1 sm:pb-2">
            <CardTitle className="text-xs sm:text-sm font-medium">Demandes</CardTitle>
            <AlertCircle className="h-3 w-3 sm:h-4 sm:w-4 text-yellow-500" />
          </CardHeader>
          <CardContent className="p-3 sm:p-4 pt-0">
            <div className="text-lg sm:text-2xl font-bold">{pendingDuels.length}</div>
          </CardContent>
        </Card>

        <Card className="p-0">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 p-3 sm:p-4 pb-1 sm:pb-2">
            <CardTitle className="text-xs sm:text-sm font-medium">Victoires</CardTitle>
            <Trophy className="h-3 w-3 sm:h-4 sm:w-4 text-yellow-500" />
          </CardHeader>
          <CardContent className="p-3 sm:p-4 pt-0">
            <div className="text-lg sm:text-2xl font-bold">{stats?.wins || 0}</div>
            <p className="text-[10px] sm:text-xs text-muted-foreground">
              {stats?.win_rate || 0}%
            </p>
          </CardContent>
        </Card>

        <Card className="p-0">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 p-3 sm:p-4 pb-1 sm:pb-2">
            <CardTitle className="text-xs sm:text-sm font-medium">XP Net</CardTitle>
            {(stats?.net_xp || 0) >= 0 ? (
              <TrendingUp className="h-3 w-3 sm:h-4 sm:w-4 text-green-500" />
            ) : (
              <TrendingDown className="h-3 w-3 sm:h-4 sm:w-4 text-red-500" />
            )}
          </CardHeader>
          <CardContent className="p-3 sm:p-4 pt-0">
            <div className={`text-lg sm:text-2xl font-bold ${(stats?.net_xp || 0) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {(stats?.net_xp || 0) >= 0 ? '+' : ''}{stats?.net_xp || 0}
            </div>
            <p className="text-[10px] sm:text-xs text-muted-foreground hidden sm:block">
              +{stats?.xp_won || 0} / -{stats?.xp_lost || 0}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="active" className="w-full">
        <TabsList className="grid w-full grid-cols-4 h-auto">
          <TabsTrigger value="pending" className="text-xs sm:text-sm px-1 sm:px-3 py-2">
            <span className="hidden sm:inline">Demandes</span>
            <span className="sm:hidden">📥</span>
            <span className="ml-1">({pendingDuels.length})</span>
          </TabsTrigger>
          <TabsTrigger value="sent" className="text-xs sm:text-sm px-1 sm:px-3 py-2">
            <span className="hidden sm:inline">Envoyés</span>
            <span className="sm:hidden">📤</span>
            <span className="ml-1">({sentDuels.length})</span>
          </TabsTrigger>
          <TabsTrigger value="active" className="text-xs sm:text-sm px-1 sm:px-3 py-2">
            <span className="hidden sm:inline">Actifs</span>
            <span className="sm:hidden">⚔️</span>
            <span className="ml-1">({activeDuels.length})</span>
          </TabsTrigger>
          <TabsTrigger value="history" className="text-xs sm:text-sm px-1 sm:px-3 py-2">
            <span className="hidden sm:inline">Historique</span>
            <span className="sm:hidden">📜</span>
            <span className="ml-1">({completedDuels.length})</span>
          </TabsTrigger>
        </TabsList>

        {/* Pending Duels */}
        <TabsContent value="pending" className="space-y-2 sm:space-y-4">
          {pendingDuels.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-8 sm:py-12">
                <Clock className="h-10 w-10 sm:h-12 sm:w-12 text-muted-foreground mb-3 sm:mb-4" />
                <p className="text-muted-foreground text-sm sm:text-base">Aucune demande de duel</p>
              </CardContent>
            </Card>
          ) : (
            pendingDuels.map(duel => (
              <Card key={duel.id}>
                <CardContent className="p-3 sm:p-6">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                    <div className="flex items-center gap-3 sm:gap-4">
                      <div className="p-2 sm:p-3 rounded-full bg-orange-100 dark:bg-orange-950 flex-shrink-0">
                        <User className="h-4 w-4 sm:h-6 sm:w-6 text-orange-600" />
                      </div>
                      <div className="min-w-0">
                        <h3 className="font-semibold text-sm sm:text-lg truncate">
                          {duel.challenger?.username || 'Utilisateur'} vous défie !
                        </h3>
                        <p className="text-xs sm:text-sm text-muted-foreground truncate">
                          {duel.quiz?.title || 'Quiz'} • {duel.stakes_xp} XP
                        </p>
                        <div className="flex flex-wrap gap-1 sm:gap-2 mt-1 sm:mt-2">
                          <Badge variant="outline" className="text-xs">Niv. {duel.challenger?.level || '?'}</Badge>
                          {getStatusBadge(duel.status)}
                        </div>
                      </div>
                    </div>

                    <div className="flex gap-2 justify-end">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDeclineDuel(duel.id)}
                        className="text-xs sm:text-sm"
                      >
                        <XCircle className="h-3 w-3 sm:h-4 sm:w-4 sm:mr-2" />
                        <span className="hidden sm:inline">Refuser</span>
                      </Button>
                      <Button size="sm" onClick={() => handleAcceptDuel(duel.id)} className="text-xs sm:text-sm">
                        <CheckCircle2 className="h-3 w-3 sm:h-4 sm:w-4 sm:mr-2" />
                        <span className="hidden sm:inline">Accepter</span>
                        <span className="sm:hidden">OK</span>
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>

        {/* Sent Duels - Duels envoyés en attente de réponse */}
        <TabsContent value="sent" className="space-y-2 sm:space-y-4">
          {sentDuels.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-8 sm:py-12">
                <Clock className="h-10 w-10 sm:h-12 sm:w-12 text-muted-foreground mb-3 sm:mb-4" />
                <p className="text-muted-foreground text-sm sm:text-base">Aucun défi en attente</p>
                <p className="text-xs sm:text-sm text-muted-foreground mt-2">
                  Lancez un défi !
                </p>
              </CardContent>
            </Card>
          ) : (
            sentDuels.map(duel => (
              <Card key={duel.id}>
                <CardContent className="p-3 sm:p-6">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                    <div className="flex items-center gap-3 sm:gap-4">
                      <div className="p-2 sm:p-3 rounded-full bg-blue-100 dark:bg-blue-950 flex-shrink-0">
                        <Clock className="h-4 w-4 sm:h-6 sm:w-6 text-blue-600" />
                      </div>
                      <div className="min-w-0">
                        <h3 className="font-semibold text-sm sm:text-lg truncate">
                          Défi à {duel.opponent?.username || 'Adversaire'}
                        </h3>
                        <p className="text-xs sm:text-sm text-muted-foreground truncate">
                          {duel.quiz?.title || 'Quiz'} • {duel.stakes_xp} XP
                        </p>
                        <div className="flex flex-wrap gap-1 sm:gap-2 mt-1 sm:mt-2">
                          <Badge variant="outline" className="text-xs">Niv. {duel.opponent?.level || '?'}</Badge>
                          <Badge variant="secondary" className="text-blue-600 text-xs">
                            <Clock className="h-2.5 w-2.5 sm:h-3 sm:w-3 mr-1" />
                            Attente
                          </Badge>
                        </div>
                      </div>
                    </div>

                    <Button
                      variant="outline"
                      size="sm"
                      className="text-xs sm:text-sm"
                      onClick={async () => {
                        try {
                          await duelsService.cancel(duel.id)
                          toast({
                            title: 'Défi annulé',
                            description: 'Le défi a été annulé'
                          })
                          fetchData()
                        } catch (error: any) {
                          toast({
                            title: 'Erreur',
                            description: error.response?.data?.detail || 'Impossible d\'annuler le défi',
                            variant: 'destructive'
                          })
                        }
                      }}
                    >
                      <XCircle className="h-3 w-3 sm:h-4 sm:w-4 sm:mr-2" />
                      <span className="hidden sm:inline">Annuler</span>
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>

        {/* Active Duels */}
        <TabsContent value="active" className="space-y-2 sm:space-y-4">
          {activeDuels.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-8 sm:py-12">
                <Swords className="h-10 w-10 sm:h-12 sm:w-12 text-muted-foreground mb-3 sm:mb-4" />
                <p className="text-muted-foreground text-sm sm:text-base">Aucun duel actif</p>
              </CardContent>
            </Card>
          ) : (
            activeDuels.map(duel => {
              const isChallenger = duel.challenger_id === currentUserId
              const opponent = isChallenger ? duel.opponent : duel.challenger

              // Vérifier si l'utilisateur actuel a joué
              const currentUserHasPlayed = isChallenger
                ? duel.challenger_has_played
                : duel.opponent_has_played

              // Vérifier si l'adversaire a joué
              const opponentHasPlayed = isChallenger
                ? duel.opponent_has_played
                : duel.challenger_has_played

              // Récupérer les scores
              const myScore = isChallenger ? duel.challenger_score : duel.opponent_score
              const opponentScore = isChallenger ? duel.opponent_score : duel.challenger_score

              return (
                <Card key={duel.id}>
                  <CardContent className="p-3 sm:p-6">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                      <div className="flex items-start sm:items-center gap-3 sm:gap-4">
                        <div className="p-2 sm:p-3 rounded-full bg-purple-100 dark:bg-purple-950 flex-shrink-0">
                          <Swords className="h-4 w-4 sm:h-6 sm:w-6 text-purple-600" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <h3 className="font-semibold text-sm sm:text-lg truncate">
                            vs {opponent?.username || 'Adversaire'}
                          </h3>
                          <p className="text-xs sm:text-sm text-muted-foreground truncate">
                            {duel.quiz?.title || 'Quiz'} • {duel.stakes_xp} XP
                          </p>
                          <div className="flex flex-wrap gap-1 sm:gap-2 mt-1 sm:mt-2">
                            <Badge variant="outline" className="text-xs">Niv. {opponent?.level || '?'}</Badge>
                            {getStatusBadge(duel.status)}
                          </div>

                          {/* Afficher les scores si l'utilisateur a joué */}
                          {currentUserHasPlayed && (
                            <div className="flex flex-wrap gap-2 sm:gap-4 mt-2 sm:mt-3 p-2 sm:p-3 bg-muted/50 rounded-lg text-xs sm:text-sm">
                              <div>
                                <span className="text-muted-foreground">Vous:</span>{' '}
                                <span className="font-bold text-primary">{myScore ?? '?'}</span>
                              </div>
                              {opponentHasPlayed ? (
                                <div>
                                  <span className="text-muted-foreground">Adverse:</span>{' '}
                                  <span className="font-bold">{opponentScore ?? '?'}</span>
                                </div>
                              ) : (
                                <div className="text-muted-foreground flex items-center gap-1">
                                  <Clock className="h-2.5 w-2.5 sm:h-3 sm:w-3" />
                                  <span className="hidden sm:inline">{opponent?.username || 'Adversaire'} n'a pas joué</span>
                                  <span className="sm:hidden">En attente</span>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      </div>

                      {duel.quiz && (
                        <div className="flex flex-col items-end gap-2">
                          {!currentUserHasPlayed ? (
                            <Button size="sm" onClick={() => startDuel(duel.quiz!.id, duel.id)} className="text-xs sm:text-sm">
                              <Play className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2" />
                              Jouer
                            </Button>
                          ) : (
                            <Badge variant="secondary" className="text-green-600 bg-green-100 dark:bg-green-900/30 text-xs">
                              <CheckCircle2 className="h-2.5 w-2.5 sm:h-3 sm:w-3 mr-1" />
                              Joué
                            </Badge>
                          )}
                          {currentUserHasPlayed && !opponentHasPlayed && (
                            <p className="text-[10px] sm:text-xs text-muted-foreground">
                              Attente adversaire...
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              )
            })
          )}
        </TabsContent>

        {/* History */}
        <TabsContent value="history" className="space-y-2 sm:space-y-4">
          {completedDuels.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-8 sm:py-12">
                <Trophy className="h-10 w-10 sm:h-12 sm:w-12 text-muted-foreground mb-3 sm:mb-4" />
                <p className="text-muted-foreground text-sm sm:text-base">Aucun duel terminé</p>
              </CardContent>
            </Card>
          ) : (
            completedDuels.map(duel => {
              const isChallenger = duel.challenger_id === currentUserId
              const isWinner = duel.winner_id === currentUserId
              const isDraw = duel.winner_id === null
              const opponent = isChallenger ? duel.opponent : duel.challenger
              const myScore = isChallenger ? duel.challenger_score : duel.opponent_score
              const opponentScore = isChallenger ? duel.opponent_score : duel.challenger_score

              return (
                <Card key={duel.id} className={isWinner ? 'border-yellow-500/50' : isDraw ? 'border-blue-500/50' : ''}>
                  <CardContent className="p-3 sm:p-6">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 sm:gap-4">
                      <div className="flex items-center gap-3 sm:gap-4">
                        {isWinner ? (
                          <div className="p-2 sm:p-3 rounded-full bg-yellow-100 dark:bg-yellow-950 flex-shrink-0">
                            <Crown className="h-4 w-4 sm:h-6 sm:w-6 text-yellow-600" />
                          </div>
                        ) : isDraw ? (
                          <div className="p-2 sm:p-3 rounded-full bg-blue-100 dark:bg-blue-950 flex-shrink-0">
                            <Star className="h-4 w-4 sm:h-6 sm:w-6 text-blue-600" />
                          </div>
                        ) : (
                          <div className="p-2 sm:p-3 rounded-full bg-gray-100 dark:bg-gray-800 flex-shrink-0">
                            <Trophy className="h-4 w-4 sm:h-6 sm:w-6 text-gray-400" />
                          </div>
                        )}
                        <div className="min-w-0">
                          <h3 className="font-semibold text-sm sm:text-lg flex flex-wrap items-center gap-1 sm:gap-2">
                            <span className="truncate">vs {opponent?.username || 'Adversaire'}</span>
                            {isWinner && (
                              <Badge variant="outline" className="text-yellow-600 border-yellow-600 text-xs">
                                <Crown className="h-2.5 w-2.5 sm:h-3 sm:w-3 mr-0.5 sm:mr-1" />
                                <span className="hidden sm:inline">Victoire</span>
                                <span className="sm:hidden">W</span>
                              </Badge>
                            )}
                            {isDraw && (
                              <Badge variant="outline" className="text-blue-600 border-blue-600 text-xs">
                                <Star className="h-2.5 w-2.5 sm:h-3 sm:w-3 mr-0.5 sm:mr-1" />
                                <span className="hidden sm:inline">Égalité</span>
                                <span className="sm:hidden">=</span>
                              </Badge>
                            )}
                          </h3>
                          <p className="text-xs sm:text-sm text-muted-foreground truncate">
                            {duel.quiz?.title || 'Quiz'}
                          </p>
                          <div className="flex flex-wrap gap-2 sm:gap-4 mt-1 sm:mt-2 text-xs sm:text-sm">
                            <div>
                              <span className="text-muted-foreground">Vous:</span>{' '}
                              <span className="font-bold">{myScore ?? '?'}</span>
                            </div>
                            <div>
                              <span className="text-muted-foreground">Adv:</span>{' '}
                              <span className="font-bold">{opponentScore ?? '?'}</span>
                            </div>
                            <div>
                              <span className={`font-bold ${isWinner ? 'text-green-600' : isDraw ? 'text-blue-600' : 'text-red-600'}`}>
                                {isDraw ? '0' : (isWinner ? `+${duel.stakes_xp}` : `-${Math.round(duel.stakes_xp / 2)}`)} XP
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                      <div className="text-xs sm:text-sm text-muted-foreground text-right">
                        {new Date(duel.ended_at || duel.created_at).toLocaleDateString()}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )
            })
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}
