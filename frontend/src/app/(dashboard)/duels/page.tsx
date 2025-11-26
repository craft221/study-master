'use client'

import { useState, useEffect } from 'react'
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
  Loader2, Star, Zap, User, AlertCircle, Crown, Target
} from 'lucide-react'
import api from '@/lib/api'
import { useToast } from '@/hooks/use-toast'
import { useRouter } from 'next/navigation'

interface Duel {
  id: number
  challenger_id: number
  opponent_id: number
  subject_id: number | null
  quiz_id: number | null
  status: string
  challenger_score: number | null
  opponent_score: number | null
  winner_id: number | null
  stakes_xp: number
  duration_minutes: number
  created_at: string
  completed_at: string | null
  challenger: {
    id: number
    username: string
    avatar_url: string | null
    level: number
  }
  opponent: {
    id: number
    username: string
    avatar_url: string | null
    level: number
  }
  quiz: {
    id: number
    title: string
  } | null
}

interface Quiz {
  id: number
  title: string
  subject_id: number
}

interface User {
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
  const [quizzes, setQuizzes] = useState<Quiz[]>([])
  const [users, setUsers] = useState<User[]>([])
  const [currentUserId, setCurrentUserId] = useState<number | null>(null)

  // Create duel dialog
  const [createDialogOpen, setCreateDialogOpen] = useState(false)
  const [selectedOpponent, setSelectedOpponent] = useState('')
  const [selectedQuiz, setSelectedQuiz] = useState('')
  const [stakesXP, setStakesXP] = useState(50)
  const [creating, setCreating] = useState(false)

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    try {
      setLoading(true)
      const [duelsRes, pendingRes, quizzesRes, usersRes, profileRes] = await Promise.all([
        api.get('/duels/'),
        api.get('/duels/pending'),
        api.get('/quizzes/'),
        api.get('/users/'),
        api.get('/users/me')
      ])

      setDuels(duelsRes.data)
      setPendingDuels(pendingRes.data)
      setQuizzes(quizzesRes.data)
      setUsers(usersRes.data.filter((u: User) => u.id !== profileRes.data.id))
      setCurrentUserId(profileRes.data.id)
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
  }

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
      await api.post('/duels/', {
        opponent_id: parseInt(selectedOpponent),
        quiz_id: parseInt(selectedQuiz),
        stakes_xp: stakesXP
      })

      toast({
        title: 'Défi envoyé !',
        description: 'Votre adversaire a reçu votre défi',
      })

      setCreateDialogOpen(false)
      setSelectedOpponent('')
      setSelectedQuiz('')
      setStakesXP(50)
      fetchData()
    } catch (error) {
      console.error('Create duel error:', error)
      toast({
        title: 'Erreur',
        description: 'Impossible de créer le défi',
        variant: 'destructive'
      })
    } finally {
      setCreating(false)
    }
  }

  const handleAcceptDuel = async (duelId: number) => {
    try {
      await api.post(`/duels/${duelId}/accept`)
      toast({
        title: 'Défi accepté !',
        description: 'Que le meilleur gagne !',
      })
      fetchData()
    } catch (error) {
      console.error('Accept error:', error)
      toast({
        title: 'Erreur',
        description: 'Impossible d\'accepter le défi',
        variant: 'destructive'
      })
    }
  }

  const handleDeclineDuel = async (duelId: number) => {
    try {
      await api.post(`/duels/${duelId}/decline`)
      toast({
        title: 'Défi refusé',
        description: 'Le défi a été décliné',
      })
      fetchData()
    } catch (error) {
      console.error('Decline error:', error)
      toast({
        title: 'Erreur',
        description: 'Impossible de refuser le défi',
        variant: 'destructive'
      })
    }
  }

  const startDuel = (quizId: number, duelId: number) => {
    router.push(`/quizzes/${quizId}?duel_id=${duelId}`)
  }

  const getStatusBadge = (status: string) => {
    const variants: Record<string, any> = {
      pending: { variant: 'secondary', icon: Clock, text: 'En attente', color: 'text-yellow-600' },
      accepted: { variant: 'default', icon: Play, text: 'Accepté', color: 'text-blue-600' },
      in_progress: { variant: 'default', icon: Swords, text: 'En cours', color: 'text-purple-600' },
      completed: { variant: 'outline', icon: CheckCircle2, text: 'Terminé', color: 'text-green-600' },
      declined: { variant: 'destructive', icon: XCircle, text: 'Refusé', color: 'text-red-600' },
      cancelled: { variant: 'secondary', icon: XCircle, text: 'Annulé', color: 'text-gray-600' }
    }

    const config = variants[status.toLowerCase()] || variants.pending
    const Icon = config.icon

    return (
      <Badge variant={config.variant} className="gap-1">
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

  const activeDuels = duels.filter(d => ['accepted', 'in_progress'].includes(d.status.toLowerCase()))
  const completedDuels = duels.filter(d => d.status.toLowerCase() === 'completed')
  const wonDuels = completedDuels.filter(d => d.winner_id === currentUserId)

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Swords className="h-8 w-8 text-orange-500" />
            Duels
          </h1>
          <p className="text-muted-foreground mt-1">
            Défiez vos amis et gagnez de l'XP !
          </p>
        </div>

        <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button size="lg" className="gap-2">
              <Target className="h-5 w-5" />
              Lancer un défi
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
                  onChange={(e) => setStakesXP(parseInt(e.target.value))}
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
          </DialogContent>
        </Dialog>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Duels actifs</CardTitle>
            <Swords className="h-4 w-4 text-purple-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{activeDuels.length}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Demandes</CardTitle>
            <AlertCircle className="h-4 w-4 text-yellow-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{pendingDuels.length}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Victoires</CardTitle>
            <Trophy className="h-4 w-4 text-yellow-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{wonDuels.length}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Taux de victoire</CardTitle>
            <Star className="h-4 w-4 text-orange-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {completedDuels.length > 0
                ? Math.round((wonDuels.length / completedDuels.length) * 100)
                : 0}%
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="active" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="pending">
            Demandes ({pendingDuels.length})
          </TabsTrigger>
          <TabsTrigger value="active">
            Actifs ({activeDuels.length})
          </TabsTrigger>
          <TabsTrigger value="history">
            Historique
          </TabsTrigger>
        </TabsList>

        {/* Pending Duels */}
        <TabsContent value="pending" className="space-y-4">
          {pendingDuels.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <Clock className="h-12 w-12 text-muted-foreground mb-4" />
                <p className="text-muted-foreground">Aucune demande de duel</p>
              </CardContent>
            </Card>
          ) : (
            pendingDuels.map(duel => (
              <Card key={duel.id}>
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="p-3 rounded-full bg-orange-100 dark:bg-orange-950">
                        <User className="h-6 w-6 text-orange-600" />
                      </div>
                      <div>
                        <h3 className="font-semibold text-lg">
                          {duel.challenger.username} vous défie !
                        </h3>
                        <p className="text-sm text-muted-foreground">
                          Quiz: {duel.quiz?.title} • Enjeux: {duel.stakes_xp} XP
                        </p>
                        <div className="flex gap-2 mt-2">
                          <Badge variant="outline">Niveau {duel.challenger.level}</Badge>
                          {getStatusBadge(duel.status)}
                        </div>
                      </div>
                    </div>

                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        onClick={() => handleDeclineDuel(duel.id)}
                      >
                        <XCircle className="h-4 w-4 mr-2" />
                        Refuser
                      </Button>
                      <Button onClick={() => handleAcceptDuel(duel.id)}>
                        <CheckCircle2 className="h-4 w-4 mr-2" />
                        Accepter
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>

        {/* Active Duels */}
        <TabsContent value="active" className="space-y-4">
          {activeDuels.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <Swords className="h-12 w-12 text-muted-foreground mb-4" />
                <p className="text-muted-foreground">Aucun duel actif</p>
              </CardContent>
            </Card>
          ) : (
            activeDuels.map(duel => {
              const isChallenger = duel.challenger_id === currentUserId
              const opponent = isChallenger ? duel.opponent : duel.challenger

              return (
                <Card key={duel.id}>
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className="p-3 rounded-full bg-purple-100 dark:bg-purple-950">
                          <Swords className="h-6 w-6 text-purple-600" />
                        </div>
                        <div>
                          <h3 className="font-semibold text-lg">
                            Duel contre {opponent.username}
                          </h3>
                          <p className="text-sm text-muted-foreground">
                            Quiz: {duel.quiz?.title} • Enjeux: {duel.stakes_xp} XP
                          </p>
                          <div className="flex gap-2 mt-2">
                            <Badge variant="outline">Niveau {opponent.level}</Badge>
                            {getStatusBadge(duel.status)}
                          </div>
                        </div>
                      </div>

                      {duel.quiz && (
                        <Button onClick={() => startDuel(duel.quiz!.id, duel.id)}>
                          <Play className="h-4 w-4 mr-2" />
                          Commencer
                        </Button>
                      )}
                    </div>
                  </CardContent>
                </Card>
              )
            })
          )}
        </TabsContent>

        {/* History */}
        <TabsContent value="history" className="space-y-4">
          {completedDuels.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <Trophy className="h-12 w-12 text-muted-foreground mb-4" />
                <p className="text-muted-foreground">Aucun duel terminé</p>
              </CardContent>
            </Card>
          ) : (
            completedDuels.map(duel => {
              const isChallenger = duel.challenger_id === currentUserId
              const isWinner = duel.winner_id === currentUserId
              const opponent = isChallenger ? duel.opponent : duel.challenger
              const myScore = isChallenger ? duel.challenger_score : duel.opponent_score
              const opponentScore = isChallenger ? duel.opponent_score : duel.challenger_score

              return (
                <Card key={duel.id} className={isWinner ? 'border-yellow-500/50' : ''}>
                  <CardContent className="p-6">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        {isWinner ? (
                          <div className="p-3 rounded-full bg-yellow-100 dark:bg-yellow-950">
                            <Crown className="h-6 w-6 text-yellow-600" />
                          </div>
                        ) : (
                          <div className="p-3 rounded-full bg-gray-100 dark:bg-gray-800">
                            <Trophy className="h-6 w-6 text-gray-400" />
                          </div>
                        )}
                        <div>
                          <h3 className="font-semibold text-lg flex items-center gap-2">
                            Duel contre {opponent.username}
                            {isWinner && (
                              <Badge variant="outline" className="text-yellow-600 border-yellow-600">
                                <Crown className="h-3 w-3 mr-1" />
                                Victoire
                              </Badge>
                            )}
                          </h3>
                          <p className="text-sm text-muted-foreground">
                            Quiz: {duel.quiz?.title}
                          </p>
                          <div className="flex gap-4 mt-2">
                            <div className="text-sm">
                              <span className="text-muted-foreground">Votre score:</span>{' '}
                              <span className="font-bold">{myScore}</span>
                            </div>
                            <div className="text-sm">
                              <span className="text-muted-foreground">Score adverse:</span>{' '}
                              <span className="font-bold">{opponentScore}</span>
                            </div>
                            <div className="text-sm">
                              <span className="text-muted-foreground">XP:</span>{' '}
                              <span className={`font-bold ${isWinner ? 'text-green-600' : 'text-red-600'}`}>
                                {isWinner ? '+' : '-'}{isWinner ? duel.stakes_xp : Math.round(duel.stakes_xp / 2)}
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {new Date(duel.completed_at || duel.created_at).toLocaleDateString()}
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
