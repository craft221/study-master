'use client'

import { useState, useEffect } from 'react'
import { Brain, Share2, Loader2, Play } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { useToast } from '@/hooks/use-toast'
import { getSharedQuizzes, shareQuizWithGroup, type GroupQuiz } from '@/services/groupContent'
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
  question_count: number
}

export default function GroupQuizzesTab({ groupId, currentUserId }: GroupQuizzesTabProps) {
  const { toast } = useToast()
  const [loading, setLoading] = useState(true)
  const [sharedQuizzes, setSharedQuizzes] = useState<GroupQuiz[]>([])
  const [myQuizzes, setMyQuizzes] = useState<Quiz[]>([])
  const [selectedQuizId, setSelectedQuizId] = useState<string>('')
  const [sharing, setSharing] = useState(false)
  const [dialogOpen, setDialogOpen] = useState(false)

  useEffect(() => {
    fetchData()
  }, [groupId])

  const fetchData = async () => {
    try {
      setLoading(true)
      const [quizzesData, myQuizzesData] = await Promise.all([
        getSharedQuizzes(groupId),
        api.get('/quizzes', { params: { page: 1, page_size: 100 } })
      ])
      setSharedQuizzes(quizzesData)
      setMyQuizzes(myQuizzesData.data.quizzes || [])
    } catch (error: any) {
      console.error('Error fetching quizzes:', error)
      toast({
        title: 'Erreur',
        description: 'Impossible de charger les quiz',
        variant: 'destructive'
      })
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
    <div className="space-y-4">
      {/* Header with Share Button */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Quiz partagés</h3>
          <p className="text-sm text-gray-500">{sharedQuizzes.length} quiz disponible(s)</p>
        </div>

        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Share2 className="h-4 w-4 mr-2" />
              Partager un quiz
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
                  {myQuizzes.map((quiz) => (
                    <SelectItem key={quiz.id} value={quiz.id.toString()}>
                      {quiz.title}
                      <span className="text-xs text-gray-500 ml-2">
                        ({quiz.question_count} questions)
                      </span>
                    </SelectItem>
                  ))}
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
          <CardContent className="py-12 text-center">
            <Brain className="h-12 w-12 mx-auto mb-4 text-gray-400" />
            <p className="text-gray-500">Aucun quiz partagé</p>
            <p className="text-sm text-gray-400 mt-1">
              Soyez le premier à partager un quiz!
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {sharedQuizzes.map((quiz) => (
            <Card key={quiz.id} className="hover:shadow-md transition-shadow">
              <CardContent className="p-4">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <Brain className="h-5 w-5 text-green-600" />
                      <h4 className="font-semibold text-gray-900">{quiz.quiz_title}</h4>
                      <Badge variant="secondary">{quiz.question_count} questions</Badge>
                    </div>
                    <div className="flex items-center gap-4 text-xs text-gray-500 mb-2">
                      <span>Partagé par {quiz.shared_by_username}</span>
                      <span>•</span>
                      <span>{formatDate(quiz.shared_at)}</span>
                    </div>
                    <div className="text-sm text-gray-600">
                      <span className="font-medium">{quiz.completed_by_count}</span> membre(s) ont complété ce quiz
                    </div>
                  </div>

                  <div className="flex items-center gap-2 ml-4">
                    <Button
                      size="sm"
                      onClick={() => window.open(`/quizzes/${quiz.quiz_id}`, '_blank')}
                    >
                      <Play className="h-4 w-4 mr-2" />
                      Démarrer
                    </Button>
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
