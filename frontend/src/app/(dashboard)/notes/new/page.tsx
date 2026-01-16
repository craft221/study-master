'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Save, X, Tag, Sparkles, Globe, Lock, CloudOff, Wifi, Languages } from 'lucide-react'
import { useLanguage } from '@/contexts/LanguageContext'
import api from '@/lib/api'
import { toast } from 'react-hot-toast'
import SmartNoteEditor from '@/components/SmartNoteEditor'
import { useOfflineContext } from '@/components/providers/OfflineProvider'
import { offlineStorage, STORES } from '@/lib/offlineStorage'
import { syncService, generateTempId } from '@/services/syncService'

interface Subject {
  id: string
  name: string
  color: string
}

const LANGUAGE_OPTIONS: { code: string; label: string; flag: string }[] = [
  { code: 'fr', label: 'Français', flag: '🇫🇷' },
  { code: 'en', label: 'English', flag: '🇬🇧' },
  { code: 'es', label: 'Español', flag: '🇪🇸' },
]

export default function NewNotePage() {
  const router = useRouter()
  const { isOnline } = useOfflineContext()
  const { locale, t } = useLanguage()
  const [loading, setLoading] = useState(false)
  const [subjects, setSubjects] = useState<Subject[]>([])
  const [formData, setFormData] = useState({
    title: '',
    content: '',  // Legacy field for backward compatibility
    subject_id: '',
    tags: [] as string[],
    visibility: 'private' as 'private' | 'public',
    language: (locale || 'fr') as string,
  })
  const [content, setContent] = useState('')
  const [tagInput, setTagInput] = useState('')

  useEffect(() => {
    fetchSubjects()
  }, [])

  const fetchSubjects = async () => {
    try {
      if (isOnline) {
        const response = await api.get('/subjects/')
        const subjectsData = response.data.subjects || []
        setSubjects(subjectsData)
        // Sauvegarder en cache
        await offlineStorage.saveSubjects(subjectsData)
      } else {
        // Charger depuis le cache
        const cachedSubjects = await offlineStorage.getSubjects()
        setSubjects(cachedSubjects || [])
      }
    } catch (error) {
      console.error('Erreur lors du chargement des matières:', error)
      // Essayer le cache en cas d'erreur
      const cachedSubjects = await offlineStorage.getSubjects()
      if (cachedSubjects && cachedSubjects.length > 0) {
        setSubjects(cachedSubjects)
      }
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    // Vérifier qu'il y a du contenu
    if (!formData.title || !content.trim() || !formData.subject_id) {
      toast.error(t('newNotePage.fillRequired'))
      return
    }

    // Préparer les données avec le contenu
    const submitData = {
      ...formData,
      content: content, // Envoyer le contenu directement
    }

    setLoading(true)
    try {
      if (isOnline) {
        // Mode en ligne: créer directement sur le serveur
        const response = await api.post('/notes/', submitData)
        toast.success(t('newNotePage.noteCreated'))
        router.push(`/notes/${response.data.id}`)
      } else {
        // Mode hors-ligne: créer localement avec un ID temporaire
        const tempId = generateTempId()
        const now = new Date().toISOString()

        // Trouver les infos du subject pour l'affichage local
        const subject = subjects.find(s => s.id === formData.subject_id)

        const offlineNote = {
          id: tempId,
          _tempId: tempId, // Marqueur pour la sync
          title: formData.title,
          content: content,
          subject_id: formData.subject_id,
          subject: subject ? { id: subject.id, name: subject.name, color: subject.color } : null,
          tags: formData.tags,
          visibility: formData.visibility,
          language: formData.language,
          is_favorite: false,
          created_at: now,
          updated_at: now,
          _isOffline: true, // Marqueur visuel
        }

        // Sauvegarder dans IndexedDB
        await offlineStorage.saveNote(offlineNote)

        // Ajouter à la queue de synchronisation
        await syncService.queueAction(
          STORES.NOTES,
          'create',
          '/api/v1/notes/',
          'POST',
          { ...submitData, _tempId: tempId }
        )

        toast.success(t('newNotePage.noteCreatedOffline'), {
          icon: '📦',
        })
        router.push('/notes')
      }
    } catch (error: any) {
      toast.error(error.response?.data?.detail || 'Erreur lors de la création')
    } finally {
      setLoading(false)
    }
  }

  const addTag = () => {
    if (tagInput.trim() && !formData.tags.includes(tagInput.trim())) {
      setFormData({
        ...formData,
        tags: [...formData.tags, tagInput.trim()],
      })
      setTagInput('')
    }
  }

  const removeTag = (tagToRemove: string) => {
    setFormData({
      ...formData,
      tags: formData.tags.filter((tag) => tag !== tagToRemove),
    })
  }

  const generateWithAI = async () => {
    if (!content.trim()) {
      toast.error(t('newNotePage.addContentFirst'))
      return
    }

    try {
      toast.loading(t('newNotePage.generatingFlashcards'), { duration: 3000 })
      const response = await api.post('/ai/generate-flashcards', {
        content: content,
        count: 10,
      })
      toast.success(t('newNotePage.flashcardsGenerated', { count: response.data.flashcards.length }))
    } catch (error) {
      toast.error(t('newNotePage.aiGenerationError'))
    }
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Offline Banner */}
      {!isOnline && (
        <div className="bg-orange-50 dark:bg-orange-900/30 border border-orange-200 dark:border-orange-800 rounded-lg p-4">
          <div className="flex items-center gap-3">
            <CloudOff className="h-5 w-5 text-orange-600 dark:text-orange-400" />
            <div>
              <p className="font-medium text-orange-900 dark:text-orange-100">
                {t('newNotePage.offlineMode')}
              </p>
              <p className="text-sm text-orange-700 dark:text-orange-300">
                {t('newNotePage.offlineSaveMessage')}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">{t('newNotePage.title')}</h1>
          {!isOnline && (
            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400">
              <CloudOff className="w-3 h-3 mr-1" />
              {t('newNotePage.offline')}
            </span>
          )}
        </div>
        <button
          onClick={() => router.back()}
          className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition flex items-center space-x-2"
        >
          <X className="h-5 w-5" />
          <span>{t('newNotePage.cancel')}</span>
        </button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Main Card */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 space-y-6">
          {/* Title */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {t('newNotePage.titleLabel')} <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              placeholder={t('newNotePage.titlePlaceholder')}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent text-lg"
              required
            />
          </div>

          {/* Subject */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {t('newNotePage.subjectLabel')} <span className="text-red-500">*</span>
            </label>
            <select
              value={formData.subject_id}
              onChange={(e) => setFormData({ ...formData, subject_id: e.target.value })}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              required
            >
              <option value="">{t('newNotePage.selectSubject')}</option>
              {subjects.map((subject) => (
                <option key={subject.id} value={subject.id}>
                  {subject.name}
                </option>
              ))}
            </select>
          </div>

          {/* Content - Smart Editor */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              {t('newNotePage.contentLabel')} <span className="text-red-500">*</span>
            </label>
            <SmartNoteEditor
              value={content}
              onChange={setContent}
              placeholder={t('newNotePage.contentPlaceholder')}
            />
          </div>

          {/* Tags */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {t('newNotePage.tagsLabel')}
            </label>
            <div className="flex items-center space-x-2 mb-2">
              <div className="flex-1 relative">
                <Tag className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                <input
                  type="text"
                  value={tagInput}
                  onChange={(e) => setTagInput(e.target.value)}
                  onKeyPress={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault()
                      addTag()
                    }
                  }}
                  placeholder={t('newNotePage.addTagPlaceholder')}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                />
              </div>
              <button
                type="button"
                onClick={addTag}
                className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition"
              >
                {t('newNotePage.addButton')}
              </button>
            </div>
            {formData.tags.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {formData.tags.map((tag) => (
                  <span
                    key={tag}
                    className="inline-flex items-center px-3 py-1 rounded-full bg-primary-100 text-primary-700 text-sm"
                  >
                    {tag}
                    <button
                      type="button"
                      onClick={() => removeTag(tag)}
                      className="ml-2 hover:text-primary-900"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Visibility */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {t('newNotePage.visibilityLabel')}
            </label>
            <div className="flex gap-4">
              <button
                type="button"
                onClick={() => setFormData({ ...formData, visibility: 'private' })}
                className={`flex-1 flex items-center justify-center gap-3 px-4 py-3 rounded-lg border-2 transition ${
                  formData.visibility === 'private'
                    ? 'border-primary-500 bg-primary-50 text-primary-700'
                    : 'border-gray-200 hover:border-gray-300 text-gray-600'
                }`}
              >
                <Lock className="h-5 w-5" />
                <div className="text-left">
                  <div className="font-medium">{t('newNotePage.private')}</div>
                  <div className="text-xs opacity-75">{t('newNotePage.privateDesc')}</div>
                </div>
              </button>
              <button
                type="button"
                onClick={() => setFormData({ ...formData, visibility: 'public' })}
                className={`flex-1 flex items-center justify-center gap-3 px-4 py-3 rounded-lg border-2 transition ${
                  formData.visibility === 'public'
                    ? 'border-green-500 bg-green-50 text-green-700'
                    : 'border-gray-200 hover:border-gray-300 text-gray-600'
                }`}
              >
                <Globe className="h-5 w-5" />
                <div className="text-left">
                  <div className="font-medium">{t('newNotePage.public')}</div>
                  <div className="text-xs opacity-75">{t('newNotePage.publicDesc')}</div>
                </div>
              </button>
            </div>
            {formData.visibility === 'public' && (
              <p className="mt-2 text-sm text-green-600 flex items-center gap-1">
                <Globe className="h-4 w-4" />
                {t('newNotePage.publicNotice')}
              </p>
            )}
          </div>

          {/* Language Selector */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              <div className="flex items-center gap-2">
                <Languages className="h-4 w-4" />
                {t('newNotePage.languageLabel')}
              </div>
            </label>
            <div className="flex gap-3">
              {LANGUAGE_OPTIONS.map((lang) => (
                <button
                  key={lang.code}
                  type="button"
                  onClick={() => setFormData({ ...formData, language: lang.code })}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg border-2 transition ${
                    formData.language === lang.code
                      ? 'border-primary-500 bg-primary-50 text-primary-700'
                      : 'border-gray-200 hover:border-gray-300 text-gray-600'
                  }`}
                >
                  <span className="text-lg">{lang.flag}</span>
                  <span className="font-medium">{lang.label}</span>
                </button>
              ))}
            </div>
            <p className="mt-2 text-xs text-gray-500">
              {t('newNotePage.languageNotice')}
            </p>
          </div>
        </div>

        {/* AI Actions */}
        <div className="bg-gradient-to-r from-purple-50 to-blue-50 rounded-xl border border-purple-200 p-6">
          <div className="flex items-start space-x-4">
            <div className="p-3 bg-white rounded-lg shadow-sm">
              <Sparkles className="h-6 w-6 text-purple-600" />
            </div>
            <div className="flex-1">
              <h3 className="font-semibold text-gray-900 mb-2">{t('newNotePage.aiActions')}</h3>
              <p className="text-sm text-gray-600 mb-4">
                {t('newNotePage.aiActionsDesc')}
              </p>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={generateWithAI}
                  className="px-4 py-2 bg-white border border-purple-300 text-purple-700 rounded-lg hover:bg-purple-50 transition text-sm font-medium"
                >
                  {t('newNotePage.generateFlashcards')}
                </button>
                <button
                  type="button"
                  className="px-4 py-2 bg-white border border-purple-300 text-purple-700 rounded-lg hover:bg-purple-50 transition text-sm font-medium"
                >
                  {t('newNotePage.createQuiz')}
                </button>
                <button
                  type="button"
                  className="px-4 py-2 bg-white border border-purple-300 text-purple-700 rounded-lg hover:bg-purple-50 transition text-sm font-medium"
                >
                  {t('newNotePage.summarize')}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-end space-x-4">
          <button
            type="button"
            onClick={() => router.back()}
            className="px-6 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition font-medium"
          >
            {t('newNotePage.cancel')}
          </button>
          <button
            type="submit"
            disabled={loading}
            className="px-6 py-3 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition font-semibold flex items-center space-x-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Save className="h-5 w-5" />
            <span>{loading ? t('newNotePage.saving') : t('newNotePage.saveNote')}</span>
          </button>
        </div>
      </form>
    </div>
  )
}
