'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Swords, Trophy, Clock, CheckCircle2, XCircle, Play,
  Loader2, User, ArrowLeft, Zap, Target
} from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import duelsService, { Duel, DuelStatus } from '@/services/duels'
import api from '@/lib/api'
import { useTranslation } from '@/contexts/LanguageContext'

export default function DuelDetailPage() {
  const params = useParams()
  const router = useRouter()
  const { toast } = useToast()
  const { t } = useTranslation()
  const [loading, setLoading] = useState(true)
  const [duel, setDuel] = useState<Duel | null>(null)
  const [currentUserId, setCurrentUserId] = useState<number | null>(null)
  const [actionLoading, setActionLoading] = useState(false)

  const duelId = parseInt(params.id as string)

  useEffect(() => {
    const fetchData = async () => {
      if (isNaN(duelId)) {
        toast({
          title: t('common.error'),
          description: t('duels.invalidDuelId'),
          variant: 'destructive'
        })
        router.push('/duels')
        return
      }
      try {
        setLoading(true)
        const [duelRes, profileRes] = await Promise.all([
          duelsService.getById(duelId),
          api.get('/users/me')
        ])
        setDuel(duelRes)
        setCurrentUserId(profileRes.data.id)
      } catch (error) {
        console.error('Error fetching duel:', error)
        toast({
          title: t('common.error'),
          description: t('duels.loadDuelError'),
          variant: 'destructive'
        })
        router.push('/duels')
      } finally {
        setLoading(false)
      }
    }

    if (duelId) {
      fetchData()
    }
  }, [duelId, toast, router, t])

  // Auto-refresh every 10s for active duels (waiting for opponent)
  useEffect(() => {
    if (!duel || !['accepted', 'in_progress'].includes(duel.status)) return

    const interval = setInterval(async () => {
      try {
        const updated = await duelsService.getById(duelId)
        setDuel(updated)
      } catch {
        // Silently fail on polling errors
      }
    }, 10000)

    return () => clearInterval(interval)
  }, [duel?.status, duelId])

  const handleAccept = async () => {
    try {
      setActionLoading(true)
      await duelsService.accept(duelId)
      toast({
        title: t('duels.challengeAccepted'),
        description: t('duels.bestManWins'),
      })
      router.push('/duels')
    } catch (error: any) {
      toast({
        title: t('common.error'),
        description: error.response?.data?.detail || t('duels.acceptError'),
        variant: 'destructive'
      })
    } finally {
      setActionLoading(false)
    }
  }

  const handleDecline = async () => {
    if (!confirm(t('duels.confirmDeclineChallenge'))) return
    try {
      setActionLoading(true)
      await duelsService.decline(duelId)
      toast({
        title: t('duels.challengeDeclined'),
        description: t('duels.challengeDeclinedDesc'),
      })
      router.push('/duels')
    } catch (error: any) {
      toast({
        title: t('common.error'),
        description: error.response?.data?.detail || t('duels.declineError'),
        variant: 'destructive'
      })
    } finally {
      setActionLoading(false)
    }
  }

  const startDuel = () => {
    if (duel?.quiz?.id) {
      router.push(`/quizzes/${duel.quiz.id}?duel_id=${duel.id}`)
    }
  }

  const getStatusBadge = (status: DuelStatus) => {
    const variants: Record<DuelStatus, { icon: any, text: string, className: string }> = {
      pending: { icon: Clock, text: t('common.pending'), className: 'bg-yellow-100 text-yellow-800' },
      accepted: { icon: CheckCircle2, text: t('common.accepted'), className: 'bg-blue-100 text-blue-800' },
      in_progress: { icon: Swords, text: t('common.inProgress'), className: 'bg-purple-100 text-purple-800' },
      completed: { icon: Trophy, text: t('common.completed'), className: 'bg-green-100 text-green-800' },
      declined: { icon: XCircle, text: t('common.declined'), className: 'bg-red-100 text-red-800' },
      cancelled: { icon: XCircle, text: t('common.cancelled'), className: 'bg-gray-100 text-gray-800' }
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

  if (!duel) {
    return (
      <div className="container mx-auto p-6">
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <XCircle className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground mb-4">{t('duels.duelNotFound')}</p>
            <Button onClick={() => router.push('/duels')}>
              <ArrowLeft className="h-4 w-4 mr-2" />
              {t('duels.backToDuels')}
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  const isChallenger = duel.challenger_id === currentUserId
  const isOpponent = duel.opponent_id === currentUserId
  const canAcceptOrDecline = isOpponent && duel.status === 'pending'

  // Vérifier si l'utilisateur actuel a déjà joué (use has_played fields if available, fallback to score)
  const hasCurrentUserPlayed = isChallenger
    ? (duel.challenger_has_played ?? duel.challenger_score !== null)
    : (duel.opponent_has_played ?? duel.opponent_score !== null)

  // Vérifier si l'adversaire a joué
  const hasOpponentPlayed = isChallenger
    ? (duel.opponent_has_played ?? duel.opponent_score !== null)
    : (duel.challenger_has_played ?? duel.challenger_score !== null)

  // L'utilisateur peut commencer seulement s'il n'a pas encore joué
  const canStart = (duel.status === 'accepted' || duel.status === 'in_progress') && duel.quiz && !hasCurrentUserPlayed

  // Score de l'utilisateur actuel
  const currentUserScore = isChallenger ? duel.challenger_score : duel.opponent_score

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => router.push('/duels')}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Swords className="h-6 w-6 text-orange-500" />
            {t('duels.duelNumber', { id: duel.id })}
          </h1>
          <p className="text-muted-foreground">
            {isChallenger ? t('duels.youLaunchedThis') : t('duels.youWereChallenged')}
          </p>
        </div>
      </div>

      {/* Duel Card */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Target className="h-5 w-5" />
              {duel.quiz?.title || t('duels.quiz')}
            </CardTitle>
            {getStatusBadge(duel.status)}
          </div>
          <CardDescription>
            {t('duels.stakesLabel', { xp: duel.stakes_xp })}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Players */}
          <div className="flex items-center justify-center gap-8">
            {/* Challenger */}
            <div className="flex flex-col items-center">
              <div className="p-4 rounded-full bg-blue-100 dark:bg-blue-950 mb-2">
                <User className="h-8 w-8 text-blue-600" />
              </div>
              <p className="font-semibold">{duel.challenger?.username || t('duels.challenger')}</p>
              <Badge variant="outline">{t('common.level')} {duel.challenger?.level || '?'}</Badge>
              {duel.challenger_score !== null && (
                <p className="text-lg font-bold mt-2">{duel.challenger_score}%</p>
              )}
            </div>

            {/* VS */}
            <div className="flex flex-col items-center">
              <Swords className="h-10 w-10 text-orange-500" />
              <p className="text-sm text-muted-foreground mt-1">VS</p>
            </div>

            {/* Opponent */}
            <div className="flex flex-col items-center">
              <div className="p-4 rounded-full bg-red-100 dark:bg-red-950 mb-2">
                <User className="h-8 w-8 text-red-600" />
              </div>
              <p className="font-semibold">{duel.opponent?.username || t('duels.opponentLabel')}</p>
              <Badge variant="outline">{t('common.level')} {duel.opponent?.level || '?'}</Badge>
              {duel.opponent_score !== null && (
                <p className="text-lg font-bold mt-2">{duel.opponent_score}%</p>
              )}
            </div>
          </div>

          {/* Stakes info */}
          <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
            <Zap className="h-4 w-4 text-yellow-500" />
            {t('duels.stakesExplanation', { stakes: duel.stakes_xp, loss: Math.round(duel.stakes_xp / 2) })}
          </div>

          {/* Actions */}
          <div className="flex justify-center gap-4">
            {canAcceptOrDecline && (
              <>
                <Button
                  variant="outline"
                  onClick={handleDecline}
                  disabled={actionLoading}
                >
                  {actionLoading ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <XCircle className="h-4 w-4 mr-2" />
                  )}
                  {t('common.decline')}
                </Button>
                <Button onClick={handleAccept} disabled={actionLoading}>
                  {actionLoading ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <CheckCircle2 className="h-4 w-4 mr-2" />
                  )}
                  {t('duels.acceptChallenge')}
                </Button>
              </>
            )}

            {canStart && (
              <Button size="lg" onClick={startDuel}>
                <Play className="h-5 w-5 mr-2" />
                {t('duels.startQuiz')}
              </Button>
            )}

            {/* L'utilisateur a déjà joué mais le duel n'est pas terminé */}
            {hasCurrentUserPlayed && duel.status !== 'completed' && (
              <div className="text-center space-y-2">
                <CheckCircle2 className="h-12 w-12 text-green-500 mx-auto" />
                <p className="text-lg font-bold">{t('duels.alreadyPlayed')}</p>
                <p className="text-2xl font-bold text-primary">{currentUserScore}%</p>
                {!hasOpponentPlayed ? (
                  <p className="text-sm text-muted-foreground">
                    <Clock className="h-4 w-4 inline mr-1" />
                    {t('duels.waitingForOpponentLong')}
                  </p>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    {t('duels.calculatingResults')}
                  </p>
                )}
              </div>
            )}

            {duel.status === 'completed' && (
              <div className="text-center">
                <Trophy className="h-12 w-12 text-yellow-500 mx-auto mb-2" />
                <p className="text-lg font-bold">
                  {duel.winner_id === null
                    ? t('duels.draw')
                    : duel.winner_id === currentUserId
                      ? t('duels.youWon')
                      : t('duels.youLost')}
                </p>
                {duel.winner_id === currentUserId && (
                  <p className="text-green-500 font-semibold">+{duel.stakes_xp} XP</p>
                )}
                {duel.winner_id !== null && duel.winner_id !== currentUserId && (
                  <p className="text-red-500 font-semibold">-{Math.round(duel.stakes_xp / 2)} XP</p>
                )}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Back button */}
      <div className="flex justify-center">
        <Button variant="outline" onClick={() => router.push('/duels')}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          {t('duels.backToDuels')}
        </Button>
      </div>
    </div>
  )
}
