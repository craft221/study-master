'use client'

import { useState, useEffect } from 'react'
import { Zap, Plus, Users, Calendar, Clock, Loader2, UserPlus, UserMinus, XCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { useToast } from '@/hooks/use-toast'
import {
  getGroupSessions,
  createGroupSession,
  joinGroupSession,
  leaveGroupSession,
  cancelGroupSession,
  type GroupSession
} from '@/services/groupContent'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

interface GroupSessionsTabProps {
  groupId: number
  currentUserId: number
}

export default function GroupSessionsTab({ groupId, currentUserId }: GroupSessionsTabProps) {
  const { toast } = useToast()
  const [loading, setLoading] = useState(true)
  const [sessions, setSessions] = useState<GroupSession[]>([])
  const [dialogOpen, setDialogOpen] = useState(false)
  const [creating, setCreating] = useState(false)

  // Form state
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [sessionType, setSessionType] = useState<string>('study')
  const [startTime, setStartTime] = useState('')
  const [duration, setDuration] = useState('60')

  useEffect(() => {
    fetchSessions()
  }, [groupId])

  const fetchSessions = async () => {
    try {
      setLoading(true)
      const data = await getGroupSessions(groupId)
      setSessions(data)
    } catch (error: any) {
      console.error('Error fetching sessions:', error)
      toast({
        title: 'Erreur',
        description: 'Impossible de charger les sessions',
        variant: 'destructive'
      })
    } finally {
      setLoading(false)
    }
  }

  const handleCreateSession = async () => {
    if (!title || !startTime) {
      toast({
        title: 'Erreur',
        description: 'Veuillez remplir tous les champs obligatoires',
        variant: 'destructive'
      })
      return
    }

    try {
      setCreating(true)
      await createGroupSession(groupId, {
        title,
        description,
        session_type: sessionType,
        start_time: new Date(startTime).toISOString(),
        duration_minutes: parseInt(duration)
      })

      toast({
        title: 'Session créée',
        description: 'La session d\'étude a été créée (+10 XP)',
      })

      // Reset form
      setTitle('')
      setDescription('')
      setSessionType('study')
      setStartTime('')
      setDuration('60')
      setDialogOpen(false)

      await fetchSessions()
    } catch (error: any) {
      console.error('Error creating session:', error)
      toast({
        title: 'Erreur',
        description: error.response?.data?.detail || 'Impossible de créer la session',
        variant: 'destructive'
      })
    } finally {
      setCreating(false)
    }
  }

  const handleJoinSession = async (sessionId: number) => {
    try {
      await joinGroupSession(groupId, sessionId)
      toast({
        title: 'Session rejointe',
        description: 'Vous avez rejoint la session (+5 XP)',
      })
      await fetchSessions()
    } catch (error: any) {
      console.error('Error joining session:', error)
      toast({
        title: 'Erreur',
        description: error.response?.data?.detail || 'Impossible de rejoindre la session',
        variant: 'destructive'
      })
    }
  }

  const handleLeaveSession = async (sessionId: number) => {
    try {
      await leaveGroupSession(groupId, sessionId)
      toast({
        title: 'Session quittée',
        description: 'Vous avez quitté la session',
      })
      await fetchSessions()
    } catch (error: any) {
      console.error('Error leaving session:', error)
      toast({
        title: 'Erreur',
        description: error.response?.data?.detail || 'Impossible de quitter la session',
        variant: 'destructive'
      })
    }
  }

  const handleCancelSession = async (sessionId: number) => {
    if (!confirm('Êtes-vous sûr de vouloir annuler cette session ?')) return

    try {
      await cancelGroupSession(groupId, sessionId)
      toast({
        title: 'Session annulée',
        description: 'La session a été annulée',
      })
      await fetchSessions()
    } catch (error: any) {
      console.error('Error cancelling session:', error)
      toast({
        title: 'Erreur',
        description: error.response?.data?.detail || 'Impossible d\'annuler la session',
        variant: 'destructive'
      })
    }
  }

  const getStatusBadge = (status: string) => {
    const variants: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
      scheduled: { label: 'Programmée', variant: 'default' },
      active: { label: 'En cours', variant: 'secondary' },
      completed: { label: 'Terminée', variant: 'outline' },
      cancelled: { label: 'Annulée', variant: 'destructive' }
    }
    const config = variants[status] || variants.scheduled
    return <Badge variant={config.variant}>{config.label}</Badge>
  }

  const getTypeBadge = (type: string) => {
    const types: Record<string, { label: string; color: string }> = {
      pomodoro: { label: 'Pomodoro', color: 'bg-red-100 text-red-700' },
      study: { label: 'Étude', color: 'bg-blue-100 text-blue-700' },
      revision: { label: 'Révision', color: 'bg-purple-100 text-purple-700' },
      exam_prep: { label: 'Prépa exam', color: 'bg-green-100 text-green-700' }
    }
    const config = types[type] || types.study
    return (
      <span className={`px-2 py-1 rounded-full text-xs font-medium ${config.color}`}>
        {config.label}
      </span>
    )
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('fr-FR', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const isParticipating = (session: GroupSession) => {
    return session.participants.some(p => p.user_id === currentUserId)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Header with Create Button */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Sessions d'étude</h3>
          <p className="text-sm text-gray-500">{sessions.length} session(s)</p>
        </div>

        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Créer une session
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Créer une session d'étude</DialogTitle>
              <DialogDescription>
                Planifiez une session d'étude collaborative
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="title">Titre *</Label>
                <Input
                  id="title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Ex: Révision Mathématiques"
                />
              </div>

              <div>
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Décrivez la session..."
                  rows={3}
                />
              </div>

              <div>
                <Label htmlFor="type">Type de session *</Label>
                <Select value={sessionType} onValueChange={setSessionType}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="study">Étude</SelectItem>
                    <SelectItem value="pomodoro">Pomodoro</SelectItem>
                    <SelectItem value="revision">Révision</SelectItem>
                    <SelectItem value="exam_prep">Préparation examen</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="startTime">Date et heure *</Label>
                <Input
                  id="startTime"
                  type="datetime-local"
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                />
              </div>

              <div>
                <Label htmlFor="duration">Durée (minutes) *</Label>
                <Input
                  id="duration"
                  type="number"
                  value={duration}
                  onChange={(e) => setDuration(e.target.value)}
                  min="15"
                  step="15"
                />
              </div>

              <Button
                onClick={handleCreateSession}
                disabled={creating}
                className="w-full"
              >
                {creating ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Création...
                  </>
                ) : (
                  <>
                    <Plus className="h-4 w-4 mr-2" />
                    Créer
                  </>
                )}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Sessions List */}
      {sessions.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Zap className="h-12 w-12 mx-auto mb-4 text-gray-400" />
            <p className="text-gray-500">Aucune session programmée</p>
            <p className="text-sm text-gray-400 mt-1">
              Créez la première session d'étude!
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {sessions.map((session) => {
            const participating = isParticipating(session)
            const isCreator = session.created_by_user_id === currentUserId

            return (
              <Card key={session.id} className="hover:shadow-md transition-shadow">
                <CardContent className="p-4">
                  <div className="space-y-3">
                    {/* Header */}
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <Zap className="h-5 w-5 text-yellow-600" />
                          <h4 className="font-semibold text-gray-900">{session.title}</h4>
                          {getTypeBadge(session.session_type)}
                          {getStatusBadge(session.status)}
                        </div>
                        {session.description && (
                          <p className="text-sm text-gray-600 mb-2">{session.description}</p>
                        )}
                      </div>
                    </div>

                    {/* Info */}
                    <div className="grid grid-cols-2 gap-3 text-sm text-gray-600">
                      <div className="flex items-center gap-2">
                        <Calendar className="h-4 w-4" />
                        <span>{formatDate(session.start_time)}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Clock className="h-4 w-4" />
                        <span>{session.duration_minutes} minutes</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Users className="h-4 w-4" />
                        <span>{session.participants.length} participant(s)</span>
                      </div>
                      <div className="text-xs">
                        Créé par {session.created_by_username}
                      </div>
                    </div>

                    {/* Participants */}
                    {session.participants.length > 0 && (
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs text-gray-500">Participants:</span>
                        {session.participants.slice(0, 5).map((p) => (
                          <span key={p.user_id} className="text-xs bg-gray-100 px-2 py-1 rounded">
                            {p.username}
                          </span>
                        ))}
                        {session.participants.length > 5 && (
                          <span className="text-xs text-gray-500">
                            +{session.participants.length - 5} autres
                          </span>
                        )}
                      </div>
                    )}

                    {/* Actions */}
                    <div className="flex items-center gap-2 pt-2 border-t">
                      {session.status === 'scheduled' && (
                        <>
                          {!participating ? (
                            <Button
                              size="sm"
                              onClick={() => handleJoinSession(session.id)}
                            >
                              <UserPlus className="h-4 w-4 mr-2" />
                              Rejoindre
                            </Button>
                          ) : (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleLeaveSession(session.id)}
                            >
                              <UserMinus className="h-4 w-4 mr-2" />
                              Quitter
                            </Button>
                          )}

                          {isCreator && (
                            <Button
                              size="sm"
                              variant="destructive"
                              onClick={() => handleCancelSession(session.id)}
                            >
                              <XCircle className="h-4 w-4 mr-2" />
                              Annuler
                            </Button>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
