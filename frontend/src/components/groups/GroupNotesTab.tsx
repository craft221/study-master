'use client'

import { useState, useEffect } from 'react'
import { FileText, Share2, Trash2, Loader2, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { useToast } from '@/hooks/use-toast'
import { getSharedNotes, shareNoteWithGroup, unshareNote, type SharedNote } from '@/services/groupContent'
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

  useEffect(() => {
    fetchData()
  }, [groupId])

  const fetchData = async () => {
    try {
      setLoading(true)
      const [notesData, myNotesData] = await Promise.all([
        getSharedNotes(groupId),
        api.get('/notes', { params: { page: 1, page_size: 100 } })
      ])
      setSharedNotes(notesData)
      setMyNotes(myNotesData.data.notes)
    } catch (error: any) {
      console.error('Error fetching notes:', error)
      toast({
        title: 'Erreur',
        description: 'Impossible de charger les notes',
        variant: 'destructive'
      })
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
          <h3 className="text-lg font-semibold">Notes partagées</h3>
          <p className="text-sm text-gray-500">{sharedNotes.length} note(s) disponible(s)</p>
        </div>

        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Share2 className="h-4 w-4 mr-2" />
              Partager une note
            </Button>
          </DialogTrigger>
          <DialogContent>
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
                  {myNotes.map((note) => (
                    <SelectItem key={note.id} value={note.id.toString()}>
                      {note.title}
                    </SelectItem>
                  ))}
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
          <CardContent className="py-12 text-center">
            <FileText className="h-12 w-12 mx-auto mb-4 text-gray-400" />
            <p className="text-gray-500">Aucune note partagée</p>
            <p className="text-sm text-gray-400 mt-1">
              Soyez le premier à partager une note!
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {sharedNotes.map((note) => (
            <Card key={note.id} className="hover:shadow-md transition-shadow">
              <CardContent className="p-4">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <FileText className="h-5 w-5 text-blue-600" />
                      <h4 className="font-semibold text-gray-900">{note.note_title}</h4>
                      {note.subject_name && (
                        <Badge variant="outline">{note.subject_name}</Badge>
                      )}
                    </div>
                    <p className="text-sm text-gray-600 mb-3 line-clamp-2">
                      {note.note_content}
                    </p>
                    <div className="flex items-center gap-4 text-xs text-gray-500">
                      <span>Partagé par {note.shared_by_username}</span>
                      <span>•</span>
                      <span>{formatDate(note.shared_at)}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 ml-4">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => window.open(`/notes/${note.note_id}`, '_blank')}
                    >
                      Voir
                    </Button>
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
