'use client'

import { useState, useEffect } from 'react'
import { Brain, Share2, Loader2, Play, Copy, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { useToast } from '@/hooks/use-toast'
import { getSharedQuizzes, shareQuizWithGroup, copySharedQuiz, unshareQuiz, type GroupQuiz } from '@/services/groupContent'
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
import api from '@/lib/api'

interface GroupQuizzesTabProps {
  groupId: number
  currentUserId: number
}

interface Quiz {
  id: number
  title: string
  total_questions: number
}

export default function GroupQuizzesTab({ groupId, currentUserId }: GroupQuizzesTabProps) {
  const { toast } = useToast()
  const [loading, setLoading] = useState(true)
  const [sharedQuizzes, setSharedQuizzes] = useState<GroupQuiz[]>([])
  const [myQuizzes, setMyQuizzes] = useState<Quiz[]>([])
  const [selectedQuizId, setSelectedQuizId] = useState<string>('')
  const [sharing, setSharing] = useState(false)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [copying, setCopying] = useState<number | null>(null)

  useEffect(() => {
    fetchData()
  }, [groupId])

  const fetchData = async () => {
    try {
      setLoading(true)

      // Charger les quiz partagés et mes quiz séparément pour éviter qu'un échec bloque l'autre
      const [quizzesResult, myQuizzesResult] = await Promise.allSettled([
        getSharedQuizzes(groupId),
        api.get('/quizzes/', { params: { page: 1, page_size: 100 } })
      ])

      if (quizzesResult.status === 'fulfilled') {
        setSharedQuizzes(quizzesResult.value)
      } else {
        console.error('Error fetching shared quizzes:', quizzesResult.reason)
      }

      if (myQuizzesResult.status === 'fulfilled') {
        const data = myQuizzesResult.value.data
        setMyQuizzes(Array.isArray(data) ? data : data?.quizzes || [])
      } else {
        console.error('Error fetching my quizzes:', myQuizzesResult.reason)
        toast({
          title: 'Erreur',
          description: 'Impossible de charger vos quiz',
          variant: 'destructive'
        })
      }
    } catch (error: any) {
      console.error('Error fetching quizzes:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleShareQuiz = async () => {
    if (!selectedQuizId) return

    try {
      setSharing(true)
      await shareQuizWithGroup(groupId, parseInt(selectedQuizId))

      toast({
        title: 'Quiz partagé',
        description: 'Le quiz a été partagé avec le groupe (+5 XP)',
      })

      setDialogOpen(false)
      setSelectedQuizId('')
      await fetchData()
    } catch (error: any) {
      console.error('Error sharing quiz:', error)
      toast({
        title: 'Erreur',
        description: error.response?.data?.detail || 'Impossible de partager le quiz',
        variant: 'destructive'
      })
    } finally {
      setSharing(false)
    }
  }

  const handleCopyQuiz = async (sharedQuizId: number, quizTitle: string) => {
    try {
      setCopying(sharedQuizId)
      await copySharedQuiz(groupId, sharedQuizId)

      toast({
        title: 'Quiz copié',
        description: `"${quizTitle}" a été ajouté à votre collection`,
      })
    } catch (error: any) {
      console.error('Error copying quiz:', error)
      toast({
        title: 'Erreur',
        description: error.response?.data?.detail || 'Impossible de copier le quiz',
        variant: 'destructive'
      })
    } finally {
      setCopying(null)
    }
  }

  const handleUnshareQuiz = async (sharedQuizId: number) => {
    if (!confirm('Êtes-vous sûr de vouloir retirer ce quiz ?')) return

    try {
      await unshareQuiz(groupId, sharedQuizId)

      toast({
        title: 'Quiz retiré',
        description: 'Le quiz a été retiré du groupe',
      })

      await fetchData()
    } catch (error: any) {
      console.error('Error unsharing quiz:', error)
      toast({
        title: 'Erreur',
        description: error.response?.data?.detail || 'Impossible de retirer le quiz',
        variant: 'destructive'
      })
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('fr-FR', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  return (
    <div className="space-y-3 sm:space-y-4">
      {/* Header with Share Button */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 sm:gap-4">
        <div>
          <h3 className="text-base sm:text-lg font-semibold">Quiz partagés</h3>
          <p className="text-xs sm:text-sm text-gray-500">{sharedQuizzes.length} quiz disponible(s)</p>
        </div>

        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button size="sm" className="w-full sm:w-auto">
              <Share2 className="h-4 w-4 mr-2" />
              <span className="hidden sm:inline">Partager un quiz</span>
              <span className="sm:hidden">Partager</span>
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Partager un quiz</DialogTitle>
              <DialogDescription>
                Sélectionnez un quiz à partager avec le groupe
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <Select value={selectedQuizId} onValueChange={setSelectedQuizId}>
                <SelectTrigger>
                  <SelectValue placeholder="Choisir un quiz" />
                </SelectTrigger>
                <SelectContent>
                  {myQuizzes.length === 0 ? (
                    <div className="py-3 px-2 text-sm text-muted-foreground text-center">
                      Aucun quiz trouvé. Créez d&apos;abord un quiz.
                    </div>
                  ) : (
                    myQuizzes.map((quiz) => (
                      <SelectItem key={quiz.id} value={quiz.id.toString()}>
                        {quiz.title}
                        <span className="text-xs text-gray-500 ml-2">
                          ({quiz.total_questions} questions)
                        </span>
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
              <Button
                onClick={handleShareQuiz}
                disabled={!selectedQuizId || sharing}
                className="w-full"
              >
                {sharing ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Partage en cours...
                  </>
                ) : (
                  <>
                    <Share2 className="h-4 w-4 mr-2" />
                    Partager
                  </>
                )}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Shared Quizzes List */}
      {sharedQuizzes.length === 0 ? (
        <Card>
          <CardContent className="py-8 sm:py-12 text-center">
            <Brain className="h-10 w-10 sm:h-12 sm:w-12 mx-auto mb-3 sm:mb-4 text-gray-400" />
            <p className="text-gray-500 text-sm sm:text-base">Aucun quiz partagé</p>
            <p className="text-xs sm:text-sm text-gray-400 mt-1">
              Soyez le premier à partager un quiz!
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3 sm:gap-4">
          {sharedQuizzes.map((quiz) => (
            <Card key={quiz.id} className="hover:shadow-md transition-shadow">
              <CardContent className="p-3 sm:p-4">
                <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2 mb-2">
                      <Brain className="h-4 w-4 sm:h-5 sm:w-5 text-green-600 flex-shrink-0" />
                      <h4 className="font-semibold text-gray-900 dark:text-white text-sm sm:text-base truncate">{quiz.quiz_title}</h4>
                      <Badge variant="secondary" className="text-xs">{quiz.question_count} questions</Badge>
                    </div>
                    <div className="flex flex-wrap items-center gap-2 sm:gap-4 text-xs text-gray-500 dark:text-gray-400 mb-2">
                      <span className="truncate">Partagé par {quiz.shared_by_username}</span>
                      <span className="hidden sm:inline">•</span>
                      <span>{formatDate(quiz.shared_at)}</span>
                    </div>
                    <div className="text-xs sm:text-sm text-gray-600 dark:text-gray-400">
                      <span className="font-medium">{quiz.completed_by_count}</span> membre(s) ont complété ce quiz
                    </div>
                  </div>

                  <div className="flex items-center gap-2 w-full sm:w-auto mt-2 sm:mt-0">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => window.open(`/quizzes/${quiz.quiz_id}`, '_blank')}
                      className="flex-1 sm:flex-none"
                    >
                      <Play className="h-4 w-4 mr-2" />
                      Démarrer
                    </Button>
                    {quiz.shared_by_user_id !== currentUserId && (
                      <Button
                        size="sm"
                        onClick={() => handleCopyQuiz(quiz.id, quiz.quiz_title)}
                        disabled={copying === quiz.id}
                        className="flex-1 sm:flex-none"
                      >
                        {copying === quiz.id ? (
                          <>
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            Copie...
                          </>
                        ) : (
                          <>
                            <Copy className="h-4 w-4 mr-2" />
                            Copier
                          </>
                        )}
                      </Button>
                    )}
                    {quiz.shared_by_user_id === currentUserId && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleUnshareQuiz(quiz.id)}
                      >
                        <Trash2 className="h-4 w-4 text-red-500" />
                      </Button>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
