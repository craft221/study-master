'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import {
  ArrowLeft,
  BookOpen,
  Clock,
  Copy,
  Flag,
  Loader2,
  Tag,
  Users
} from 'lucide-react'
import api from '@/lib/api'
import { useToast } from '@/hooks/use-toast'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import MarkdownRenderer from '@/components/MarkdownRenderer'

interface PublicNote {
  id: number
  title: string
  content: string
  tags: string[]
  language: string
  subject?: {
    id: number
    name: string
    color?: string
  }
  author?: {
    id: number
    username: string
    avatar_url?: string
  }
  created_at?: string
}

export default function PublicNoteViewPage() {
  const params = useParams()
  const router = useRouter()
  const { toast } = useToast()
  const noteId = params.id as string

  const [note, setNote] = useState<PublicNote | null>(null)
  const [loading, setLoading] = useState(true)
  const [duplicating, setDuplicating] = useState(false)

  useEffect(() => {
    fetchNote()
  }, [noteId])

  const fetchNote = async () => {
    try {
      const response = await api.get(`/explore/notes/${noteId}`)
      setNote(response.data)
    } catch (error) {
      toast({
        title: 'Erreur',
        description: 'Note non trouvee ou non publique',
        variant: 'destructive'
      })
      router.push('/explore')
    } finally {
      setLoading(false)
    }
  }

  const duplicateNote = async () => {
    setDuplicating(true)
    try {
      const response = await api.post('/explore/duplicate', {
        content_type: 'notes',
        content_id: parseInt(noteId)
      })
      toast({
        title: 'Note dupliquee !',
        description: response.data.message
      })
      router.push(`/notes/${response.data.new_content_id}`)
    } catch (error: any) {
      toast({
        title: 'Erreur',
        description: error.response?.data?.detail || 'Impossible de dupliquer',
        variant: 'destructive'
      })
    } finally {
      setDuplicating(false)
    }
  }

  const reportNote = async () => {
    try {
      await api.post('/explore/report', {
        content_type: 'notes',
        content_id: parseInt(noteId),
        reason: 'inappropriate'
      })
      toast({
        title: 'Signalement envoye',
        description: 'Notre equipe va examiner ce contenu'
      })
    } catch (error: any) {
      toast({
        title: 'Erreur',
        description: error.response?.data?.detail || 'Impossible de signaler',
        variant: 'destructive'
      })
    }
  }

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return ''
    const date = new Date(dateStr)
    return date.toLocaleDateString('fr-FR', {
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    })
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
      </div>
    )
  }

  if (!note) return null

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => router.push('/explore')}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <BookOpen className="h-6 w-6 text-blue-500" />
            Note publique
          </h1>
        </div>
      </div>

      {/* Note Card */}
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between">
            <div>
              <CardTitle className="text-2xl">{note.title}</CardTitle>
              <div className="flex items-center gap-3 mt-2 text-sm text-muted-foreground">
                <span className="flex items-center gap-1">
                  <Users className="h-4 w-4" />
                  {note.author?.username || 'Anonyme'}
                </span>
                <span className="flex items-center gap-1">
                  <Clock className="h-4 w-4" />
                  {formatDate(note.created_at)}
                </span>
              </div>
            </div>
            {note.subject && (
              <Badge
                style={{ backgroundColor: note.subject.color || '#6366f1' }}
                className="text-white"
              >
                {note.subject.name}
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Content */}
          <div className="prose max-w-none dark:prose-invert">
            <MarkdownRenderer content={note.content} />
          </div>

          {/* Tags */}
          {note.tags && note.tags.length > 0 && (
            <div className="pt-4 border-t">
              <h3 className="text-sm font-medium mb-2">Tags</h3>
              <div className="flex flex-wrap gap-2">
                {note.tags.map((tag, index) => (
                  <Badge key={index} variant="secondary" className="gap-1">
                    <Tag className="h-3 w-3" />
                    {tag}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center gap-3 pt-4 border-t">
            <Button onClick={duplicateNote} disabled={duplicating}>
              {duplicating ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Copy className="h-4 w-4 mr-2" />
              )}
              Dupliquer dans mes notes
            </Button>
            <Button
              variant="outline"
              className="text-orange-500 hover:text-orange-600"
              onClick={reportNote}
            >
              <Flag className="h-4 w-4 mr-2" />
              Signaler
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
