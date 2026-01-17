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
import { useLanguage } from '@/contexts/LanguageContext'
import HelpTooltip from '@/components/ui/HelpTooltip'

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
  const { t } = useLanguage()
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
    if (!confirm(t('notesPage.confirmDelete'))) return

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
    <div className="space-y-3 sm:space-y-4 lg:space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4">
        <div>
          <div className="flex items-center gap-2 sm:gap-3">
            <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold text-gray-900 dark:text-white">{t('notesPage.title')}</h1>
            {isFromCache && (
              <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400">
                <CloudOff className="w-3 h-3 mr-1" />
                {t('notesPage.cachedData')}
              </span>
            )}
          </div>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            {t('notesPage.totalNotes', { count: notes.length })}
            {isFromCache && !isOnline && ` • ${t('notesPage.offlineMode')}`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {isFromCache && isOnline && (
            <button
              onClick={() => refetch()}
              className="inline-flex items-center justify-center p-2 sm:px-4 sm:py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition"
            >
              <RefreshCw className="h-4 w-4" />
            </button>
          )}
          <Link
            href="/notes/new"
            className="inline-flex items-center justify-center px-4 py-2 sm:px-6 sm:py-3 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition font-semibold text-sm sm:text-base"
          >
            <Plus className="h-4 w-4 sm:h-5 sm:w-5 mr-1 sm:mr-2" />
            <span className="hidden sm:inline">{t('notesPage.newNote')}</span>
            <span className="sm:hidden">Créer</span>
          </Link>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-3 sm:p-4">
        <div className="flex flex-col sm:flex-row gap-2 sm:gap-4">
          {/* Search */}
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
            <input
              type="text"
              placeholder={t('notesPage.searchPlaceholder')}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            />
            <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
              <HelpTooltip content={t('tooltips.notes.search')} size="sm" />
            </div>
          </div>

          {/* Favorites Filter */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowFavorites(!showFavorites)}
              className={`px-4 py-2 rounded-lg border transition flex items-center gap-1 ${
                showFavorites
                  ? 'bg-yellow-50 dark:bg-yellow-900/30 border-yellow-500 text-yellow-700 dark:text-yellow-400'
                  : 'bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-600'
              }`}
            >
              <Star className={`h-5 w-5 ${showFavorites ? 'fill-yellow-400' : ''}`} />
            </button>
            <HelpTooltip content={t('tooltips.notes.favorites')} size="sm" />
          </div>
        </div>
      </div>

      {/* Notes Grid */}
      {filteredNotes.length === 0 ? (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6 sm:p-12 text-center">
          <div className="w-16 h-16 sm:w-20 sm:h-20 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center mx-auto mb-3 sm:mb-4">
            <BookOpen className="h-8 w-8 sm:h-10 sm:w-10 text-blue-600 dark:text-blue-400" />
          </div>
          <h3 className="text-lg sm:text-xl font-semibold text-gray-900 dark:text-white mb-2">
            {searchQuery ? t('notesPage.noNotesFound') : t('notesPage.noNotesYet')}
          </h3>
          <p className="text-gray-600 dark:text-gray-400 mb-2 text-sm sm:text-base">
            {searchQuery
              ? t('notesPage.tryDifferentSearch')
              : t('notesPage.createFirstNote')}
          </p>
          {!searchQuery && (
            <>
              <p className="text-sm text-gray-500 dark:text-gray-500 mb-4 sm:mb-6 max-w-md mx-auto">
                {t('tooltips.emptyStates.notes')}
              </p>
              <Link
                href="/notes/new"
                className="inline-flex items-center justify-center px-4 py-2 sm:px-6 sm:py-3 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition font-semibold text-sm sm:text-base"
              >
                <Plus className="h-4 w-4 sm:h-5 sm:w-5 mr-1 sm:mr-2" />
                {t('notesPage.createMyFirstNote')}
              </Link>
            </>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4 lg:gap-6">
          {filteredNotes.map((note) => (
            <div
              key={note.id}
              className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 hover:shadow-md transition group"
            >
              <div className="p-3 sm:p-4 lg:p-6">
                {/* Header */}
                <div className="flex items-start justify-between mb-2 sm:mb-4">
                  <div className="flex-1 min-w-0">
                    {note.subject && (
                      <div className="flex items-center space-x-2 mb-2">
                        <span
                          className="px-2 sm:px-3 py-0.5 sm:py-1 rounded-full text-xs font-medium truncate max-w-[150px]"
                          style={{
                            backgroundColor: `${note.subject.color}20`,
                            color: note.subject.color,
                          }}
                        >
                          {note.subject.name}
                        </span>
                      </div>
                    )}
                    <h3 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-white mb-1 sm:mb-2 line-clamp-2">
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
                <p className="text-gray-600 dark:text-gray-400 text-xs sm:text-sm mb-2 sm:mb-4 line-clamp-2 sm:line-clamp-3">
                  {note.content.substring(0, 150)}...
                </p>

                {/* Tags */}
                {note.tags && note.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1 sm:gap-2 mb-2 sm:mb-4">
                    {note.tags.slice(0, 2).map((tag, index) => (
                      <span
                        key={index}
                        className="inline-flex items-center px-1.5 sm:px-2 py-0.5 sm:py-1 rounded-md bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 text-xs"
                      >
                        <Tag className="h-2.5 w-2.5 sm:h-3 sm:w-3 mr-0.5 sm:mr-1" />
                        <span className="truncate max-w-[60px] sm:max-w-none">{tag}</span>
                      </span>
                    ))}
                    {note.tags.length > 2 && (
                      <span className="text-xs text-gray-500 dark:text-gray-400">+{note.tags.length - 2}</span>
                    )}
                  </div>
                )}

                {/* Footer */}
                <div className="flex items-center justify-between pt-2 sm:pt-4 border-t border-gray-200 dark:border-gray-700">
                  <div className="flex items-center text-xs text-gray-500 dark:text-gray-400">
                    <Clock className="h-3 w-3 sm:h-4 sm:w-4 mr-1" />
                    {new Date(note.updated_at).toLocaleDateString('fr-FR')}
                  </div>
                  <div className="flex items-center space-x-1 sm:space-x-2">
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
