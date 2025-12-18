'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import {
  BookOpen,
  Plus,
  Search,
  Filter,
  Tag,
  Clock,
  Star,
  MoreVertical,
  Trash2,
  Edit,
  Eye,
  CloudOff,
  RefreshCw
} from 'lucide-react'
import api from '@/lib/api'
import { useOfflineNotes } from '@/hooks/useOffline'
import { offlineStorage, STORES } from '@/lib/offlineStorage'
import { syncService } from '@/services/syncService'
import { useOfflineContext } from '@/components/providers/OfflineProvider'

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
  created_at: string
  updated_at: string
}

export default function NotesPage() {
  // Utiliser le hook offline pour les notes
  const { data: notesData, loading, error, isFromCache, refetch } = useOfflineNotes()
  const { isOnline } = useOfflineContext()
  const [notes, setNotes] = useState<Note[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedSubject, setSelectedSubject] = useState<string>('all')
  const [showFavorites, setShowFavorites] = useState(false)

  // Mettre à jour les notes quand les données arrivent
  useEffect(() => {
    if (notesData) {
      setNotes(Array.isArray(notesData) ? notesData : [])
    }
  }, [notesData])

  const filteredNotes = notes.filter((note) => {
    const matchesSearch = note.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      note.content.toLowerCase().includes(searchQuery.toLowerCase())
    const matchesSubject = selectedSubject === 'all' || note.subject_id === selectedSubject
    const matchesFavorite = !showFavorites || note.is_favorite
    return matchesSearch && matchesSubject && matchesFavorite
  })

  const toggleFavorite = async (noteId: string) => {
    const note = notes.find(n => n.id === noteId)
    if (!note) return

    // Mise à jour optimiste
    const updatedNote = { ...note, is_favorite: !note.is_favorite }
    setNotes(notes.map(n => n.id === noteId ? updatedNote : n))

    try {
      if (isOnline) {
        await api.post(`/notes/${noteId}/favorite`)
      } else {
        // Queue pour sync offline
        await syncService.queueAction(
          STORES.NOTES,
          'update',
          `/api/v1/notes/${noteId}/favorite`,
          'POST',
          {}
        )
      }
      // Mettre à jour le cache local
      await offlineStorage.saveNote(updatedNote)
    } catch (error) {
      // Rollback en cas d'erreur
      setNotes(notes.map(n => n.id === noteId ? note : n))
      console.error('Erreur lors de la mise à jour du favori:', error)
    }
  }

  const deleteNote = async (noteId: string) => {
    if (!confirm('Êtes-vous sûr de vouloir supprimer cette note?')) return

    const noteToDelete = notes.find(n => n.id === noteId)
    // Mise à jour optimiste
    setNotes(notes.filter(note => note.id !== noteId))

    try {
      if (isOnline) {
        await api.delete(`/notes/${noteId}`)
      } else {
        // Queue pour sync offline
        await syncService.queueAction(
          STORES.NOTES,
          'delete',
          `/api/v1/notes/${noteId}`,
          'DELETE',
          { id: noteId }
        )
      }
      // Supprimer du cache local
      await offlineStorage.deleteNote(Number(noteId))
    } catch (error) {
      // Rollback en cas d'erreur
      if (noteToDelete) {
        setNotes([...notes, noteToDelete])
      }
      console.error('Erreur lors de la suppression:', error)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Mes Notes</h1>
            {isFromCache && (
              <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400">
                <CloudOff className="w-3 h-3 mr-1" />
                Données en cache
              </span>
            )}
          </div>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            {notes.length} notes au total
            {isFromCache && !isOnline && ' • Mode hors-ligne'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {isFromCache && isOnline && (
            <button
              onClick={() => refetch()}
              className="inline-flex items-center justify-center px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition"
              title="Actualiser les données"
            >
              <RefreshCw className="h-4 w-4" />
            </button>
          )}
          <Link
            href="/notes/new"
            className="inline-flex items-center justify-center px-6 py-3 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition font-semibold"
          >
            <Plus className="h-5 w-5 mr-2" />
            Nouvelle note
          </Link>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
        <div className="flex flex-col md:flex-row gap-4">
          {/* Search */}
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
            <input
              type="text"
              placeholder="Rechercher dans vos notes..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            />
          </div>

          {/* Favorites Filter */}
          <button
            onClick={() => setShowFavorites(!showFavorites)}
            className={`px-4 py-2 rounded-lg border transition ${
              showFavorites
                ? 'bg-yellow-50 border-yellow-500 text-yellow-700'
                : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'
            }`}
          >
            <Star className={`h-5 w-5 ${showFavorites ? 'fill-yellow-400' : ''}`} />
          </button>
        </div>
      </div>

      {/* Notes Grid */}
      {filteredNotes.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center">
          <BookOpen className="h-16 w-16 text-gray-400 mx-auto mb-4" />
          <h3 className="text-xl font-semibold text-gray-900 mb-2">
            {searchQuery ? 'Aucune note trouvée' : 'Aucune note pour le moment'}
          </h3>
          <p className="text-gray-600 mb-6">
            {searchQuery
              ? 'Essayez de modifier vos critères de recherche'
              : 'Commencez par créer votre première note d\'étude'}
          </p>
          {!searchQuery && (
            <Link
              href="/notes/new"
              className="inline-flex items-center justify-center px-6 py-3 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition font-semibold"
            >
              <Plus className="h-5 w-5 mr-2" />
              Créer ma première note
            </Link>
          )}
        </div>
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredNotes.map((note) => (
            <div
              key={note.id}
              className="bg-white rounded-xl shadow-sm border border-gray-200 hover:shadow-md transition group"
            >
              <div className="p-6">
                {/* Header */}
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    {note.subject && (
                      <div className="flex items-center space-x-2 mb-2">
                        <span
                          className="px-3 py-1 rounded-full text-xs font-medium"
                          style={{
                            backgroundColor: `${note.subject.color}20`,
                            color: note.subject.color,
                          }}
                        >
                          {note.subject.name}
                        </span>
                      </div>
                    )}
                    <h3 className="text-lg font-semibold text-gray-900 mb-2 line-clamp-2">
                      {note.title}
                    </h3>
                  </div>
                  <button
                    onClick={() => toggleFavorite(note.id)}
                    className="text-gray-400 hover:text-yellow-500 transition"
                  >
                    <Star
                      className={`h-5 w-5 ${
                        note.is_favorite ? 'fill-yellow-400 text-yellow-400' : ''
                      }`}
                    />
                  </button>
                </div>

                {/* Content Preview */}
                <p className="text-gray-600 text-sm mb-4 line-clamp-3">
                  {note.content.substring(0, 150)}...
                </p>

                {/* Tags */}
                {note.tags && note.tags.length > 0 && (
                  <div className="flex flex-wrap gap-2 mb-4">
                    {note.tags.slice(0, 3).map((tag, index) => (
                      <span
                        key={index}
                        className="inline-flex items-center px-2 py-1 rounded-md bg-gray-100 text-gray-700 text-xs"
                      >
                        <Tag className="h-3 w-3 mr-1" />
                        {tag}
                      </span>
                    ))}
                    {note.tags.length > 3 && (
                      <span className="text-xs text-gray-500">+{note.tags.length - 3}</span>
                    )}
                  </div>
                )}

                {/* Footer */}
                <div className="flex items-center justify-between pt-4 border-t border-gray-200">
                  <div className="flex items-center text-xs text-gray-500">
                    <Clock className="h-4 w-4 mr-1" />
                    {new Date(note.updated_at).toLocaleDateString('fr-FR')}
                  </div>
                  <div className="flex items-center space-x-2">
                    <Link
                      href={`/notes/${note.id}`}
                      className="p-2 text-gray-600 hover:text-primary-600 hover:bg-gray-100 rounded-lg transition"
                    >
                      <Eye className="h-4 w-4" />
                    </Link>
                    <Link
                      href={`/notes/${note.id}?edit=true`}
                      className="p-2 text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition"
                    >
                      <Edit className="h-4 w-4" />
                    </Link>
                    <button
                      onClick={() => deleteNote(note.id)}
                      className="p-2 text-gray-600 hover:text-red-600 hover:bg-red-50 rounded-lg transition"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
