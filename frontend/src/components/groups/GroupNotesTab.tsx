'use client'

import { useState, useEffect } from 'react'
import { FileText, Share2, Trash2, Loader2, Plus, Copy } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { useToast } from '@/hooks/use-toast'
import { getSharedNotes, shareNoteWithGroup, unshareNote, copySharedNote, type SharedNote } from '@/services/groupContent'
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

interface GroupNotesTabProps {
  groupId: number
  currentUserId: number
}

interface Note {
  id: number
  title: string
  subject_name?: string
}

export default function GroupNotesTab({ groupId, currentUserId }: GroupNotesTabProps) {
  const { toast } = useToast()
  const [loading, setLoading] = useState(true)
  const [sharedNotes, setSharedNotes] = useState<SharedNote[]>([])
  const [myNotes, setMyNotes] = useState<Note[]>([])
  const [selectedNoteId, setSelectedNoteId] = useState<string>('')
  const [sharing, setSharing] = useState(false)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [copying, setCopying] = useState<number | null>(null)

  useEffect(() => {
    fetchData()
  }, [groupId])

  const fetchData = async () => {
    try {
      setLoading(true)
      const [notesResult, myNotesResult] = await Promise.allSettled([
        getSharedNotes(groupId),
        api.get('/notes/', { params: { page: 1, page_size: 100 } })
      ])

      if (notesResult.status === 'fulfilled') {
        setSharedNotes(notesResult.value)
      } else {
        console.error('Error fetching shared notes:', notesResult.reason)
      }

      if (myNotesResult.status === 'fulfilled') {
        const data = myNotesResult.value.data
        setMyNotes(data?.notes || [])
      } else {
        console.error('Error fetching my notes:', myNotesResult.reason)
      }
    } catch (error: any) {
      console.error('Error fetching notes:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleShareNote = async () => {
    if (!selectedNoteId) return

    try {
      setSharing(true)
      await shareNoteWithGroup(groupId, parseInt(selectedNoteId))

      toast({
        title: 'Note partagée',
        description: 'La note a été partagée avec le groupe (+5 XP)',
      })

      setDialogOpen(false)
      setSelectedNoteId('')
      await fetchData()
    } catch (error: any) {
      console.error('Error sharing note:', error)
      toast({
        title: 'Erreur',
        description: error.response?.data?.detail || 'Impossible de partager la note',
        variant: 'destructive'
      })
    } finally {
      setSharing(false)
    }
  }

  const handleUnshareNote = async (sharedNoteId: number) => {
    if (!confirm('Êtes-vous sûr de vouloir retirer cette note ?')) return

    try {
      await unshareNote(groupId, sharedNoteId)

      toast({
        title: 'Note retirée',
        description: 'La note a été retirée du groupe',
      })

      await fetchData()
    } catch (error: any) {
      console.error('Error unsharing note:', error)
      toast({
        title: 'Erreur',
        description: error.response?.data?.detail || 'Impossible de retirer la note',
        variant: 'destructive'
      })
    }
  }

  const handleCopyNote = async (sharedNoteId: number, noteTitle: string) => {
    try {
      setCopying(sharedNoteId)
      await copySharedNote(groupId, sharedNoteId)

      toast({
        title: 'Note copiée',
        description: `"${noteTitle}" a été ajoutée à votre collection`,
      })
    } catch (error: any) {
      console.error('Error copying note:', error)
      toast({
        title: 'Erreur',
        description: error.response?.data?.detail || 'Impossible de copier la note',
        variant: 'destructive'
      })
    } finally {
      setCopying(null)
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
          <h3 className="text-base sm:text-lg font-semibold">Notes partagées</h3>
          <p className="text-xs sm:text-sm text-gray-500">{sharedNotes.length} note(s) disponible(s)</p>
        </div>

        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button size="sm" className="w-full sm:w-auto">
              <Share2 className="h-4 w-4 mr-2" />
              <span className="hidden sm:inline">Partager une note</span>
              <span className="sm:hidden">Partager</span>
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-[95vw] sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>Partager une note</DialogTitle>
              <DialogDescription>
                Sélectionnez une note à partager avec le groupe
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <Select value={selectedNoteId} onValueChange={setSelectedNoteId}>
                <SelectTrigger>
                  <SelectValue placeholder="Choisir une note" />
                </SelectTrigger>
                <SelectContent>
                  {myNotes.length === 0 ? (
                    <div className="py-3 px-2 text-sm text-muted-foreground text-center">
                      Aucune note trouvée. Créez d&apos;abord une note.
                    </div>
                  ) : (
                    myNotes.map((note) => (
                      <SelectItem key={note.id} value={note.id.toString()}>
                        {note.title}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
              <Button
                onClick={handleShareNote}
                disabled={!selectedNoteId || sharing}
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

      {/* Shared Notes List */}
      {sharedNotes.length === 0 ? (
        <Card>
          <CardContent className="py-8 sm:py-12 text-center">
            <FileText className="h-10 w-10 sm:h-12 sm:w-12 mx-auto mb-3 sm:mb-4 text-gray-400" />
            <p className="text-gray-500 text-sm sm:text-base">Aucune note partagée</p>
            <p className="text-xs sm:text-sm text-gray-400 mt-1">
              Soyez le premier à partager une note!
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3 sm:gap-4">
          {sharedNotes.map((note) => (
            <Card key={note.id} className="hover:shadow-md transition-shadow">
              <CardContent className="p-3 sm:p-4">
                <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2 mb-2">
                      <FileText className="h-4 w-4 sm:h-5 sm:w-5 text-blue-600 flex-shrink-0" />
                      <h4 className="font-semibold text-gray-900 dark:text-white text-sm sm:text-base truncate">{note.note_title}</h4>
                      {note.subject_name && (
                        <Badge variant="outline" className="text-xs">{note.subject_name}</Badge>
                      )}
                    </div>
                    <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400 mb-2 sm:mb-3 line-clamp-2">
                      {note.note_content}
                    </p>
                    <div className="flex flex-wrap items-center gap-2 sm:gap-4 text-xs text-gray-500 dark:text-gray-400">
                      <span className="truncate">Partagé par {note.shared_by_username}</span>
                      <span className="hidden sm:inline">•</span>
                      <span>{formatDate(note.shared_at)}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 w-full sm:w-auto sm:shrink-0 mt-2 sm:mt-0">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => window.open(`/notes/${note.note_id}`, '_blank')}
                      className="flex-1 sm:flex-none"
                    >
                      Voir
                    </Button>
                    {note.shared_by_user_id !== currentUserId && (
                      <Button
                        size="sm"
                        onClick={() => handleCopyNote(note.id, note.note_title)}
                        disabled={copying === note.id}
                        className="flex-1 sm:flex-none"
                      >
                        {copying === note.id ? (
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
                    {note.shared_by_user_id === currentUserId && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleUnshareNote(note.id)}
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
