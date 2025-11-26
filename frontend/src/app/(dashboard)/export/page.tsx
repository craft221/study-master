'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { FileDown, FileText, BookOpen, Download, Loader2, CheckCircle2 } from 'lucide-react'
import api from '@/lib/api'
import { useToast } from '@/hooks/use-toast'

interface Note {
  id: number
  title: string
  subject_id: number
  subject_name: string
  created_at: string
}

interface Subject {
  id: number
  name: string
  notes_count: number
}

interface Flashcard {
  id: number
  deck_name: string
  subject_id: number
  cards_count: number
}

export default function ExportPage() {
  const { toast } = useToast()
  const [loading, setLoading] = useState(true)
  const [exporting, setExporting] = useState(false)

  // Notes
  const [notes, setNotes] = useState<Note[]>([])
  const [selectedNotes, setSelectedNotes] = useState<number[]>([])
  const [selectedSubjectForNotes, setSelectedSubjectForNotes] = useState<string>('')

  // Flashcards
  const [flashcards, setFlashcards] = useState<Flashcard[]>([])
  const [selectedFlashcards, setSelectedFlashcards] = useState<number[]>([])
  const [selectedSubjectForFlashcards, setSelectedSubjectForFlashcards] = useState<string>('')

  // Subjects
  const [subjects, setSubjects] = useState<Subject[]>([])

  // Options
  const [includeMetadata, setIncludeMetadata] = useState(true)

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    try {
      setLoading(true)
      const [notesRes, subjectsRes, flashcardsRes] = await Promise.all([
        api.get('/notes/'),
        api.get('/subjects/'),
        api.get('/flashcards/')
      ])

      setNotes(notesRes.data)
      setSubjects(subjectsRes.data)
      setFlashcards(flashcardsRes.data)
    } catch (error) {
      console.error('Error fetching data:', error)
      toast({
        title: 'Erreur',
        description: 'Impossible de charger les données',
        variant: 'destructive'
      })
    } finally {
      setLoading(false)
    }
  }

  const handleExportNote = async (noteId: number) => {
    try {
      setExporting(true)
      const response = await api.get(`/export/note/${noteId}`, {
        params: { include_metadata: includeMetadata },
        responseType: 'blob'
      })

      const note = notes.find(n => n.id === noteId)
      const blob = new Blob([response.data], { type: 'application/pdf' })
      const url = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `${note?.title || 'note'}.pdf`
      link.click()
      window.URL.revokeObjectURL(url)

      toast({
        title: 'Succès',
        description: 'Note exportée en PDF',
      })
    } catch (error) {
      console.error('Export error:', error)
      toast({
        title: 'Erreur',
        description: 'Impossible d\'exporter la note',
        variant: 'destructive'
      })
    } finally {
      setExporting(false)
    }
  }

  const handleExportNotesBatch = async () => {
    if (selectedNotes.length === 0) {
      toast({
        title: 'Attention',
        description: 'Sélectionnez au moins une note',
        variant: 'destructive'
      })
      return
    }

    try {
      setExporting(true)
      const response = await api.post('/export/notes/batch', {
        note_ids: selectedNotes,
        include_metadata: includeMetadata
      }, {
        responseType: 'blob'
      })

      const blob = new Blob([response.data], { type: 'application/pdf' })
      const url = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `notes_export_${new Date().toISOString().split('T')[0]}.pdf`
      link.click()
      window.URL.revokeObjectURL(url)

      toast({
        title: 'Succès',
        description: `${selectedNotes.length} notes exportées en PDF`,
      })
      setSelectedNotes([])
    } catch (error) {
      console.error('Export error:', error)
      toast({
        title: 'Erreur',
        description: 'Impossible d\'exporter les notes',
        variant: 'destructive'
      })
    } finally {
      setExporting(false)
    }
  }

  const handleExportSubjectNotes = async (subjectId: number) => {
    try {
      setExporting(true)
      const response = await api.get(`/export/subject/${subjectId}/notes`, {
        params: { include_metadata: includeMetadata },
        responseType: 'blob'
      })

      const subject = subjects.find(s => s.id === subjectId)
      const blob = new Blob([response.data], { type: 'application/pdf' })
      const url = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `${subject?.name || 'subject'}_notes.pdf`
      link.click()
      window.URL.revokeObjectURL(url)

      toast({
        title: 'Succès',
        description: 'Notes de la matière exportées',
      })
    } catch (error) {
      console.error('Export error:', error)
      toast({
        title: 'Erreur',
        description: 'Impossible d\'exporter les notes de la matière',
        variant: 'destructive'
      })
    } finally {
      setExporting(false)
    }
  }

  const handleExportFlashcards = async (subjectId: number) => {
    try {
      setExporting(true)
      const response = await api.get(`/export/flashcards/${subjectId}`, {
        params: { include_metadata: includeMetadata },
        responseType: 'blob'
      })

      const subject = subjects.find(s => s.id === subjectId)
      const blob = new Blob([response.data], { type: 'application/pdf' })
      const url = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `${subject?.name || 'flashcards'}_flashcards.pdf`
      link.click()
      window.URL.revokeObjectURL(url)

      toast({
        title: 'Succès',
        description: 'Flashcards exportées',
      })
    } catch (error) {
      console.error('Export error:', error)
      toast({
        title: 'Erreur',
        description: 'Impossible d\'exporter les flashcards',
        variant: 'destructive'
      })
    } finally {
      setExporting(false)
    }
  }

  const toggleNoteSelection = (noteId: number) => {
    setSelectedNotes(prev =>
      prev.includes(noteId)
        ? prev.filter(id => id !== noteId)
        : [...prev, noteId]
    )
  }

  const toggleAllNotes = () => {
    if (selectedNotes.length === notes.length) {
      setSelectedNotes([])
    } else {
      setSelectedNotes(notes.map(n => n.id))
    }
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

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <FileDown className="h-8 w-8 text-blue-500" />
          Export PDF
        </h1>
        <p className="text-muted-foreground mt-1">
          Exportez vos notes et flashcards en PDF
        </p>
      </div>

      {/* Export Options */}
      <Card>
        <CardHeader>
          <CardTitle>Options d'export</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center space-x-2">
            <Checkbox
              id="metadata"
              checked={includeMetadata}
              onCheckedChange={(checked) => setIncludeMetadata(checked as boolean)}
            />
            <Label htmlFor="metadata" className="cursor-pointer">
              Inclure les métadonnées (date, tags, statistiques)
            </Label>
          </div>
        </CardContent>
      </Card>

      {/* Export Tabs */}
      <Tabs defaultValue="notes" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="notes">
            <FileText className="h-4 w-4 mr-2" />
            Notes
          </TabsTrigger>
          <TabsTrigger value="subject">
            <BookOpen className="h-4 w-4 mr-2" />
            Par Matière
          </TabsTrigger>
          <TabsTrigger value="flashcards">
            <Download className="h-4 w-4 mr-2" />
            Flashcards
          </TabsTrigger>
        </TabsList>

        {/* Notes Tab */}
        <TabsContent value="notes" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Sélectionner des notes</CardTitle>
                  <CardDescription>Exportez une ou plusieurs notes en PDF</CardDescription>
                </div>
                {selectedNotes.length > 0 && (
                  <Button onClick={handleExportNotesBatch} disabled={exporting}>
                    {exporting ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <Download className="h-4 w-4 mr-2" />
                    )}
                    Exporter ({selectedNotes.length})
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center space-x-2 pb-3 border-b">
                <Checkbox
                  id="select-all"
                  checked={selectedNotes.length === notes.length && notes.length > 0}
                  onCheckedChange={toggleAllNotes}
                />
                <Label htmlFor="select-all" className="cursor-pointer font-medium">
                  Tout sélectionner ({notes.length} notes)
                </Label>
              </div>

              <div className="space-y-2 max-h-96 overflow-y-auto">
                {notes.map(note => (
                  <div
                    key={note.id}
                    className="flex items-center justify-between p-3 rounded-lg border hover:bg-accent"
                  >
                    <div className="flex items-center space-x-3 flex-1">
                      <Checkbox
                        id={`note-${note.id}`}
                        checked={selectedNotes.includes(note.id)}
                        onCheckedChange={() => toggleNoteSelection(note.id)}
                      />
                      <Label htmlFor={`note-${note.id}`} className="cursor-pointer flex-1">
                        <div>
                          <p className="font-medium">{note.title}</p>
                          <p className="text-sm text-muted-foreground">
                            {note.subject_name} • {new Date(note.created_at).toLocaleDateString()}
                          </p>
                        </div>
                      </Label>
                    </div>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleExportNote(note.id)}
                      disabled={exporting}
                    >
                      {exporting ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Download className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                ))}
              </div>

              {notes.length === 0 && (
                <div className="text-center py-8 text-muted-foreground">
                  <FileText className="h-12 w-12 mx-auto mb-3 opacity-20" />
                  <p>Aucune note disponible</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Subject Tab */}
        <TabsContent value="subject" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Exporter par matière</CardTitle>
              <CardDescription>Exportez toutes les notes d'une matière</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid gap-3">
                {subjects.map(subject => (
                  <div
                    key={subject.id}
                    className="flex items-center justify-between p-4 rounded-lg border"
                  >
                    <div>
                      <h3 className="font-medium">{subject.name}</h3>
                      <p className="text-sm text-muted-foreground">
                        {subject.notes_count} notes disponibles
                      </p>
                    </div>
                    <Button
                      onClick={() => handleExportSubjectNotes(subject.id)}
                      disabled={exporting || subject.notes_count === 0}
                    >
                      {exporting ? (
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      ) : (
                        <Download className="h-4 w-4 mr-2" />
                      )}
                      Exporter Notes
                    </Button>
                  </div>
                ))}
              </div>

              {subjects.length === 0 && (
                <div className="text-center py-8 text-muted-foreground">
                  <BookOpen className="h-12 w-12 mx-auto mb-3 opacity-20" />
                  <p>Aucune matière disponible</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Flashcards Tab */}
        <TabsContent value="flashcards" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Exporter des flashcards</CardTitle>
              <CardDescription>Exportez vos flashcards par matière</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid gap-3">
                {subjects.map(subject => {
                  const flashcardCount = flashcards.filter(f => f.subject_id === subject.id).length

                  return (
                    <div
                      key={subject.id}
                      className="flex items-center justify-between p-4 rounded-lg border"
                    >
                      <div>
                        <h3 className="font-medium">{subject.name}</h3>
                        <p className="text-sm text-muted-foreground">
                          {flashcardCount} decks disponibles
                        </p>
                      </div>
                      <Button
                        onClick={() => handleExportFlashcards(subject.id)}
                        disabled={exporting || flashcardCount === 0}
                      >
                        {exporting ? (
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        ) : (
                          <Download className="h-4 w-4 mr-2" />
                        )}
                        Exporter Flashcards
                      </Button>
                    </div>
                  )
                })}
              </div>

              {subjects.length === 0 && (
                <div className="text-center py-8 text-muted-foreground">
                  <BookOpen className="h-12 w-12 mx-auto mb-3 opacity-20" />
                  <p>Aucune matière disponible</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
