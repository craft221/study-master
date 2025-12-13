'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Loader2, Swords, User, Zap, CheckCircle2, XCircle, AlertCircle } from 'lucide-react'
import { useToast } from '@/hooks/use-toast'
import duelsService, { DuelInviteDetails } from '@/services/duels'

export default function JoinDuelPage() {
  const params = useParams()
  const router = useRouter()
  const { toast } = useToast()
  const code = params.code as string

  const [loading, setLoading] = useState(true)
  const [accepting, setAccepting] = useState(false)
  const [invite, setInvite] = useState<DuelInviteDetails | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchInvite = async () => {
      try {
        setLoading(true)
        const data = await duelsService.getInviteDetails(code)
        setInvite(data)
      } catch (err: any) {
        console.error('Error fetching invite:', err)
        setError(err.response?.data?.detail || 'Invitation invalide ou expirée')
      } finally {
        setLoading(false)
      }
    }

    if (code) {
      fetchInvite()
    }
  }, [code])

  const handleAccept = async () => {
    try {
      setAccepting(true)
      const duel = await duelsService.acceptInvite(code)

      toast({
        title: 'Défi accepté ! 🎯',
        description: 'Le duel a été créé. Que le meilleur gagne !',
      })

      // Rediriger vers la page du quiz ou des duels
      if (duel.quiz_id) {
        router.push(`/quizzes/${duel.quiz_id}?duel_id=${duel.id}`)
      } else {
        router.push('/duels')
      }
    } catch (err: any) {
      console.error('Error accepting invite:', err)
      toast({
        title: 'Erreur',
        description: err.response?.data?.detail || 'Impossible d\'accepter le défi',
        variant: 'destructive'
      })
    } finally {
      setAccepting(false)
    }
  }

  const handleDecline = () => {
    toast({
      title: 'Défi décliné',
      description: 'Vous avez refusé l\'invitation',
    })
    router.push('/duels')
  }

  if (loading) {
    return (
      <div className="container mx-auto p-6 flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <Loader2 className="h-12 w-12 animate-spin text-primary mx-auto mb-4" />
          <p className="text-muted-foreground">Chargement de l'invitation...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="container mx-auto p-6 flex items-center justify-center min-h-[60vh]">
        <Card className="max-w-md w-full">
          <CardContent className="pt-6">
            <div className="text-center">
              <div className="p-4 rounded-full bg-red-100 w-fit mx-auto mb-4">
                <AlertCircle className="h-12 w-12 text-red-600" />
              </div>
              <h2 className="text-xl font-bold mb-2">Invitation invalide</h2>
              <p className="text-muted-foreground mb-6">{error}</p>
              <Button onClick={() => router.push('/duels')} className="w-full">
                Retour aux duels
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (!invite) {
    return null
  }

  return (
    <div className="container mx-auto p-6 flex items-center justify-center min-h-[60vh]">
      <Card className="max-w-md w-full">
        <CardHeader className="text-center">
          <div className="p-4 rounded-full bg-orange-100 w-fit mx-auto mb-4">
            <Swords className="h-12 w-12 text-orange-600" />
          </div>
          <CardTitle className="text-2xl">Invitation au duel !</CardTitle>
          <CardDescription>
            Vous avez été invité à participer à un duel
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-6">
          {/* Challenger Info */}
          <div className="flex items-center gap-4 p-4 rounded-lg bg-muted">
            <div className="p-3 rounded-full bg-primary/10">
              <User className="h-6 w-6 text-primary" />
            </div>
            <div>
              <p className="font-semibold">{invite.challenger_username}</p>
              <p className="text-sm text-muted-foreground">vous défie</p>
            </div>
          </div>

          {/* Quiz Info */}
          {invite.quiz_title && (
            <div className="p-4 rounded-lg border">
              <p className="text-sm text-muted-foreground mb-1">Quiz</p>
              <p className="font-semibold">{invite.quiz_title}</p>
            </div>
          )}

          {/* Stakes */}
          <div className="flex items-center justify-center gap-2 p-4 rounded-lg bg-yellow-50 dark:bg-yellow-950/30">
            <Zap className="h-5 w-5 text-yellow-600" />
            <span className="font-semibold text-lg">{invite.stakes_xp} XP</span>
            <span className="text-muted-foreground">en jeu</span>
          </div>

          {/* Duration */}
          <div className="text-center text-sm text-muted-foreground">
            Durée du duel: {invite.duration_minutes} minutes
          </div>

          {/* Actions */}
          <div className="flex gap-3">
            <Button
              variant="outline"
              className="flex-1"
              onClick={handleDecline}
              disabled={accepting}
            >
              <XCircle className="h-4 w-4 mr-2" />
              Décliner
            </Button>
            <Button
              className="flex-1"
              onClick={handleAccept}
              disabled={accepting}
            >
              {accepting ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <CheckCircle2 className="h-4 w-4 mr-2" />
              )}
              Accepter le défi
            </Button>
          </div>

          <p className="text-xs text-muted-foreground text-center">
            Le gagnant remporte {invite.stakes_xp} XP, le perdant en perd {Math.round(invite.stakes_xp / 2)}
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
