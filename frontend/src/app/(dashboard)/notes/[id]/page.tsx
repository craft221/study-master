'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
import {
  BookOpen,
  Edit,
  Save,
  X,
  Trash2,
  Star,
  Share2,
  Download,
  Clock,
  Tag,
  Sparkles,
  CreditCard,
  Brain,
  Globe,
  Lock
} from 'lucide-react'
import api from '@/lib/api'
import { toast } from 'react-hot-toast'
import MarkdownRenderer from '@/components/MarkdownRenderer'
import SmartNoteEditor from '@/components/SmartNoteEditor'

interface Subject {
  id: string
  name: string
  color: string
}

interface Note {
  id: string
  title: string
  content: string
  subject_id: string
  subject?: Subject | null
  tags: string[]
  is_favorite: boolean
  is_public: boolean
  language: string
  created_at: string
  updated_at: string
}

export default function NoteDetailPage() {
  const params = useParams()
  const router = useRouter()
  const searchParams = useSearchParams()
  const noteId = params.id as string
  const isEditing = searchParams.get('edit') === 'true'

  const [note, setNote] = useState<Note | null>(null)
  const [loading, setLoading] = useState(true)
  const [editMode, setEditMode] = useState(isEditing)
  const [editedContent, setEditedContent] = useState('')
  const [editedTitle, setEditedTitle] = useState('')

  useEffect(() => {
    fetchNote()
  }, [noteId])

  const fetchNote = async () => {
    try {
      const response = await api.get(`/notes/${noteId}`)
      const noteData = response.data
      setNote(noteData)
      setEditedContent(noteData.content || '')
      setEditedTitle(noteData.title)
    } catch (error) {
      toast.error('Erreur lors du chargement de la note')
      router.push('/notes')
    } finally {
      setLoading(false)
    }
  }

  const handleSave = async () => {
    try {
      const response = await api.put(`/notes/${noteId}`, {
        title: editedTitle,
        content: editedContent,
      })
      setNote(response.data)
      setEditMode(false)
      toast.success('Note mise à jour avec succès!')
    } catch (error) {
      toast.error('Erreur lors de la sauvegarde')
    }
  }

  const handleDelete = async () => {
    if (!confirm('Êtes-vous sûr de vouloir supprimer cette note?')) return

    try {
      await api.delete(`/notes/${noteId}`)
      toast.success('Note supprimée')
      router.push('/notes')
    } catch (error) {
      toast.error('Erreur lors de la suppression')
    }
  }

  const toggleFavorite = async () => {
    try {
      await api.post(`/notes/${noteId}/favorite`)
      setNote(note ? { ...note, is_favorite: !note.is_favorite } : null)
    } catch (error) {
      toast.error('Erreur')
    }
  }

  const togglePublic = async () => {
    try {
      const newPublicState = !note?.is_public
      await api.patch(`/explore/notes/${noteId}/visibility`, {
        is_public: newPublicState
      })
      setNote(note ? { ...note, is_public: newPublicState } : null)
      toast.success(newPublicState ? 'Note rendue publique!' : 'Note rendue privée')
    } catch (error) {
      toast.error('Erreur lors du changement de visibilité')
    }
  }

  const generateFlashcards = async () => {
    try {
      toast.loading('Génération de flashcards...', { id: 'gen-flash' })
      const response = await api.post('/ai/generate-flashcards', {
        note_id: parseInt(noteId as string),
        count: 10,
        difficulty: 'medium'
      })
      toast.success(`${response.data.flashcards.length} flashcards créées!`, { id: 'gen-flash' })
      router.push('/flashcards')
    } catch (error: any) {
      toast.error(error.response?.data?.detail || 'Erreur lors de la génération', { id: 'gen-flash' })
    }
  }

  const generateQuiz = async () => {
    try {
      toast.loading('Génération du quiz...', { id: 'gen-quiz' })
      const response = await api.post('/ai/generate-quiz', {
        note_id: parseInt(noteId as string),
        question_count: 5,
        difficulty: 'medium'
      })
      toast.success('Quiz créé!', { id: 'gen-quiz' })
      router.push(`/quizzes/${response.data.quiz?.id || ''}`)
    } catch (error: any) {
      toast.error(error.response?.data?.detail || 'Erreur lors de la génération', { id: 'gen-quiz' })
    }
  }

  const exportPDF = async () => {
    try {
      toast.loading('Exportation en PDF...', { id: 'export' })
      const response = await api.post(`/export/notes/${noteId}/pdf`, {}, {
        responseType: 'blob'
      })
      const url = window.URL.createObjectURL(new Blob([response.data]))
      const link = document.createElement('a')
      link.href = url
      link.setAttribute('download', `${note?.title || 'note'}.pdf`)
      document.body.appendChild(link)
      link.click()
      link.remove()
      toast.success('PDF téléchargé!', { id: 'export' })
    } catch (error) {
      toast.error('Erreur lors de l\'exportation', { id: 'export' })
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    )
  }

  if (!note) return null

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <div className="flex items-start justify-between mb-4">
          <div className="flex-1">
            {editMode ? (
              <input
                type="text"
                value={editedTitle}
                onChange={(e) => setEditedTitle(e.target.value)}
                className="w-full text-3xl font-bold text-gray-900 border-b-2 border-primary-500 focus:outline-none pb-2"
              />
            ) : (
              <h1 className="text-3xl font-bold text-gray-900">{note.title}</h1>
            )}
            <div className="flex items-center space-x-3 mt-3">
              {note.subject && (
                <span
                  className="px-3 py-1 rounded-full text-sm font-medium"
                  style={{
                    backgroundColor: `${note.subject.color}20`,
                    color: note.subject.color,
                  }}
                >
                  {note.subject.name}
                </span>
              )}
              <span className="text-sm text-gray-500 flex items-center">
                <Clock className="h-4 w-4 mr-1" />
                {new Date(note.updated_at).toLocaleDateString('fr-FR', {
                  day: 'numeric',
                  month: 'long',
                  year: 'numeric',
                })}
              </span>
            </div>
          </div>
          <button
            onClick={toggleFavorite}
            className="p-2 hover:bg-gray-100 rounded-lg transition"
          >
            <Star
              className={`h-6 w-6 ${
                note.is_favorite ? 'fill-yellow-400 text-yellow-400' : 'text-gray-400'
              }`}
            />
          </button>
        </div>

        {/* Actions */}
        <div className="flex flex-wrap gap-2 pt-4 border-t border-gray-200">
          {editMode ? (
            <>
              <button
                onClick={handleSave}
                className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition flex items-center space-x-2"
              >
                <Save className="h-4 w-4" />
                <span>Enregistrer</span>
              </button>
              <button
                onClick={() => {
                  setEditMode(false)
                  setEditedContent(note.content || '')
                  setEditedTitle(note.title)
                }}
                className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition flex items-center space-x-2"
              >
                <X className="h-4 w-4" />
                <span>Annuler</span>
              </button>
            </>
          ) : (
            <>
              <button
                onClick={() => setEditMode(true)}
                className="px-4 py-2 bg-blue-50 text-blue-700 rounded-lg hover:bg-blue-100 transition flex items-center space-x-2"
              >
                <Edit className="h-4 w-4" />
                <span>Modifier</span>
              </button>
              <button
                onClick={exportPDF}
                className="px-4 py-2 bg-green-50 text-green-700 rounded-lg hover:bg-green-100 transition flex items-center space-x-2"
              >
                <Download className="h-4 w-4" />
                <span>Exporter PDF</span>
              </button>
              <button
                onClick={handleDelete}
                className="px-4 py-2 bg-red-50 text-red-700 rounded-lg hover:bg-red-100 transition flex items-center space-x-2"
              >
                <Trash2 className="h-4 w-4" />
                <span>Supprimer</span>
              </button>
              <button
                onClick={togglePublic}
                className={`px-4 py-2 rounded-lg transition flex items-center space-x-2 ${
                  note.is_public
                    ? 'bg-green-50 text-green-700 hover:bg-green-100'
                    : 'bg-gray-50 text-gray-700 hover:bg-gray-100'
                }`}
              >
                {note.is_public ? (
                  <>
                    <Globe className="h-4 w-4" />
                    <span>Publique</span>
                  </>
                ) : (
                  <>
                    <Lock className="h-4 w-4" />
                    <span>Rendre publique</span>
                  </>
                )}
              </button>
            </>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6 overflow-hidden">
        {editMode ? (
          <SmartNoteEditor
            value={editedContent}
            onChange={setEditedContent}
            placeholder="Modifie ta note ici..."
          />
        ) : (
          <div className="prose max-w-none latex-preview overflow-x-auto">
            <MarkdownRenderer content={note.content} />
          </div>
        )}
      </div>

      {/* Tags */}
      {note.tags && note.tags.length > 0 && !editMode && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h3 className="text-sm font-medium text-gray-700 mb-3">Tags</h3>
          <div className="flex flex-wrap gap-2">
            {note.tags.map((tag, index) => (
              <span
                key={index}
                className="inline-flex items-center px-3 py-1 rounded-full bg-gray-100 text-gray-700 text-sm"
              >
                <Tag className="h-3 w-3 mr-1" />
                {tag}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* AI Actions */}
      {!editMode && (
        <div className="bg-gradient-to-r from-purple-50 to-blue-50 rounded-xl border border-purple-200 p-6">
          <div className="flex items-start space-x-4">
            <div className="p-3 bg-white rounded-lg shadow-sm">
              <Sparkles className="h-6 w-6 text-purple-600" />
            </div>
            <div className="flex-1">
              <h3 className="font-semibold text-gray-900 mb-2">Actions IA</h3>
              <p className="text-sm text-gray-600 mb-4">
                Utilisez l'IA pour créer du contenu d'apprentissage à partir de cette note.
              </p>
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={generateFlashcards}
                  className="px-4 py-2 bg-white border border-purple-300 text-purple-700 rounded-lg hover:bg-purple-50 transition text-sm font-medium flex items-center space-x-2"
                >
                  <CreditCard className="h-4 w-4" />
                  <span>Générer des flashcards</span>
                </button>
                <button
                  onClick={generateQuiz}
                  className="px-4 py-2 bg-white border border-purple-300 text-purple-700 rounded-lg hover:bg-purple-50 transition text-sm font-medium flex items-center space-x-2"
                >
                  <Brain className="h-4 w-4" />
                  <span>Créer un quiz</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

