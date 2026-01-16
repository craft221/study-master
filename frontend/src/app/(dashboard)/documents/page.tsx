'use client'

import { useEffect, useState, useRef } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import {
  FileText,
  Upload,
  Search,
  Star,
  Trash2,
  Download,
  Eye,
  ExternalLink,
  Filter,
  FolderOpen,
  File,
  Image,
  FileSpreadsheet,
  Presentation,
  Clock,
  X,
  ChevronDown,
  HardDrive,
  AlertTriangle,
  CloudOff,
  RefreshCw,
  Sparkles,
  Brain,
  HelpCircle,
  Loader2
} from 'lucide-react'
import api from '@/lib/api'
import { toast } from 'react-hot-toast'
import { offlineStorage, STORES } from '@/lib/offlineStorage'
import { syncService } from '@/services/syncService'
import { useOfflineContext } from '@/components/providers/OfflineProvider'

interface Subject {
  id: number
  name: string
  color: string
}

interface Document {
  id: number
  original_filename: string
  stored_filename: string
  file_type: string
  mime_type: string
  file_size: number
  file_extension: string
  title: string
  description: string | null
  subject_id: number
  user_id: number
  is_favorite: boolean
  is_archived: boolean
  is_text_extracted: boolean
  download_count: number
  view_count: number
  created_at: string
  updated_at: string
  file_size_formatted: string
  file_type_icon: string
  download_url: string
}

interface DocumentStats {
  total_documents: number
  total_size_bytes: number
  total_size_formatted: string
  documents_by_type: Record<string, number>
  documents_by_subject: Record<string, number>
}

interface StorageQuota {
  storage_limit_mb: number
  storage_used_mb: number
}

const FILE_TYPE_ICONS: Record<string, React.ReactNode> = {
  pdf: <FileText className="h-8 w-8 text-red-500" />,
  word: <FileText className="h-8 w-8 text-blue-500" />,
  excel: <FileSpreadsheet className="h-8 w-8 text-green-500" />,
  powerpoint: <Presentation className="h-8 w-8 text-orange-500" />,
  image: <Image className="h-8 w-8 text-purple-500" />,
  other: <File className="h-8 w-8 text-gray-500" />
}

const FILE_TYPE_COLORS: Record<string, string> = {
  pdf: 'bg-red-50 border-red-200',
  word: 'bg-blue-50 border-blue-200',
  excel: 'bg-green-50 border-green-200',
  powerpoint: 'bg-orange-50 border-orange-200',
  image: 'bg-purple-50 border-purple-200',
  other: 'bg-gray-50 border-gray-200'
}

export default function DocumentsPage() {
  const { isOnline } = useOfflineContext()
  const searchParams = useSearchParams()
  const subjectFromUrl = searchParams.get('subject')

  const [documents, setDocuments] = useState<Document[]>([])
  const [subjects, setSubjects] = useState<Subject[]>([])
  const [stats, setStats] = useState<DocumentStats | null>(null)
  const [storageQuota, setStorageQuota] = useState<StorageQuota | null>(null)
  const [loading, setLoading] = useState(true)
  const [isFromCache, setIsFromCache] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedSubject, setSelectedSubject] = useState<number | null>(
    subjectFromUrl ? Number(subjectFromUrl) : null
  )
  const [selectedFileType, setSelectedFileType] = useState<string | null>(null)
  const [showFavorites, setShowFavorites] = useState(false)
  const [showUploadModal, setShowUploadModal] = useState(false)
  const [uploadSubjectId, setUploadSubjectId] = useState<number | null>(
    subjectFromUrl ? Number(subjectFromUrl) : null
  )
  const [uploadTitle, setUploadTitle] = useState('')
  const [uploadDescription, setUploadDescription] = useState('')

  // États pour génération IA
  const [showAIModal, setShowAIModal] = useState(false)
  const [selectedDocForAI, setSelectedDocForAI] = useState<Document | null>(null)
  const [aiGenerating, setAiGenerating] = useState(false)
  const [aiType, setAiType] = useState<'flashcards' | 'quiz'>('flashcards')
  const [aiCount, setAiCount] = useState(10)
  const [aiDifficulty, setAiDifficulty] = useState<'easy' | 'medium' | 'hard'>('medium')
  // Options quiz supplémentaires
  const [quizIsTimed, setQuizIsTimed] = useState(false)
  const [quizTimeLimit, setQuizTimeLimit] = useState(30)
  const [quizQuestionTypes, setQuizQuestionTypes] = useState<string[]>(['multiple_choice', 'true_false'])

  // États pour tâches IA en arrière-plan
  const [aiTaskId, setAiTaskId] = useState<number | null>(null)
  const [aiTaskProgress, setAiTaskProgress] = useState(0)
  const [aiTaskStatus, setAiTaskStatus] = useState<string>('')
  const [aiTaskMessage, setAiTaskMessage] = useState<string>('')

  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (subjectFromUrl) {
      setSelectedSubject(Number(subjectFromUrl))
      setUploadSubjectId(Number(subjectFromUrl))
    }
  }, [subjectFromUrl])

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async (forceRefresh = false) => {
    try {
      if (isOnline || forceRefresh) {
        try {
          const [docsRes, subjectsRes, statsRes] = await Promise.all([
            api.get('/documents/'),
            api.get('/subjects/'),
            api.get('/documents/stats')
          ])
          const docsData = docsRes.data.documents || []
          const subjectsData = subjectsRes.data.subjects || []

          setDocuments(docsData)
          setSubjects(subjectsData)
          setStats(statsRes.data)
          setIsFromCache(false)

          // Sauvegarder en cache pour le mode offline
          await offlineStorage.saveDocuments(docsData)
          await offlineStorage.saveSubjects(subjectsData)

          // Calculer l'espace utilisé depuis les stats (plus fiable)
          const usedMb = Math.round((statsRes.data.total_size_bytes || 0) / (1024 * 1024))

          // Récupérer la limite de stockage depuis l'abonnement
          let storageLimitMb = 100 // Défaut FREE
          try {
            const subscriptionRes = await api.get('/payments/subscription')
            if (subscriptionRes.data?.storage_limit_mb) {
              storageLimitMb = subscriptionRes.data.storage_limit_mb
            }
          } catch (subError) {
            // Plan FREE par défaut si pas d'abonnement
            console.log('Abonnement non trouvé, utilisation du plan FREE (100 MB)')
          }

          setStorageQuota({
            storage_limit_mb: storageLimitMb,
            storage_used_mb: usedMb
          })
        } catch (error: any) {
          // Si erreur réseau, essayer le cache
          const cachedDocs = await offlineStorage.getDocuments()
          const cachedSubjects = await offlineStorage.getSubjects()

          if (cachedDocs && cachedDocs.length > 0) {
            setDocuments(cachedDocs)
            setSubjects(cachedSubjects || [])
            setIsFromCache(true)
            toast('Documents chargés depuis le cache', { icon: '📦' })
          } else {
            console.error('Erreur lors du chargement:', error)
            toast.error('Erreur lors du chargement des documents')
          }
        }
      } else {
        // Mode hors-ligne: charger depuis le cache
        const cachedDocs = await offlineStorage.getDocuments()
        const cachedSubjects = await offlineStorage.getSubjects()

        setDocuments(cachedDocs || [])
        setSubjects(cachedSubjects || [])
        setIsFromCache(true)
      }
    } catch (error) {
      console.error('Erreur lors du chargement:', error)
      toast.error('Erreur lors du chargement des documents')
    } finally {
      setLoading(false)
    }
  }

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (!uploadSubjectId) {
      toast.error('Veuillez sélectionner une matière')
      return
    }

    const formData = new FormData()
    formData.append('file', file)
    formData.append('subject_id', uploadSubjectId.toString())
    if (uploadTitle) formData.append('title', uploadTitle)
    if (uploadDescription) formData.append('description', uploadDescription)

    setUploading(true)
    try {
      const response = await api.post('/documents/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      })

      toast.success(`Document uploadé! +${response.data.xp_earned} XP`)
      setShowUploadModal(false)
      setUploadSubjectId(null)
      setUploadTitle('')
      setUploadDescription('')
      if (fileInputRef.current) fileInputRef.current.value = ''
      fetchData()
    } catch (error: any) {
      const message = error.response?.data?.detail || 'Erreur lors de l\'upload'
      // Vérifier si c'est une erreur de quota de stockage
      if (error.response?.status === 403 && message.includes('Quota de stockage')) {
        toast.error(
          <div>
            <span>{message}</span>
            <Link href="/pricing" className="block mt-1 text-primary-600 underline">
              Voir les plans
            </Link>
          </div>,
          { duration: 6000 }
        )
      } else {
        toast.error(message)
      }
    } finally {
      setUploading(false)
    }
  }

  const toggleFavorite = async (docId: number) => {
    const doc = documents.find(d => d.id === docId)
    if (!doc) return

    // Mise à jour optimiste
    const updatedDoc = { ...doc, is_favorite: !doc.is_favorite }
    setDocuments(documents.map(d => d.id === docId ? updatedDoc : d))

    try {
      if (isOnline) {
        await api.post(`/documents/${docId}/favorite`)
        toast.success('Favori mis à jour')
      } else {
        // Queue pour sync offline
        await syncService.queueAction(
          STORES.DOCUMENTS,
          'update',
          `/api/v1/documents/${docId}/favorite`,
          'POST',
          {}
        )
        toast.success('Favori mis à jour (sera synchronisé)')
      }
    } catch (error) {
      // Rollback en cas d'erreur
      setDocuments(documents.map(d => d.id === docId ? doc : d))
      toast.error('Erreur lors de la mise à jour')
    }
  }

  const deleteDocument = async (docId: number) => {
    if (!confirm('Êtes-vous sûr de vouloir supprimer ce document?')) return

    const docToDelete = documents.find(d => d.id === docId)
    // Mise à jour optimiste
    setDocuments(documents.filter(doc => doc.id !== docId))

    try {
      if (isOnline) {
        await api.delete(`/documents/${docId}`)
        toast.success('Document supprimé')
        fetchData() // Refresh stats
      } else {
        // Queue pour sync offline
        await syncService.queueAction(
          STORES.DOCUMENTS,
          'delete',
          `/api/v1/documents/${docId}`,
          'DELETE',
          { id: docId }
        )
        toast.success('Document supprimé (sera synchronisé)')
      }
    } catch (error) {
      // Rollback en cas d'erreur
      if (docToDelete) {
        setDocuments([...documents, docToDelete])
      }
      toast.error('Erreur lors de la suppression')
    }
  }

  const downloadDocument = async (doc: Document) => {
    try {
      const response = await api.get(`/documents/${doc.id}/download`, {
        responseType: 'blob'
      })

      const url = window.URL.createObjectURL(new Blob([response.data]))
      const link = document.createElement('a')
      link.href = url
      link.setAttribute('download', doc.original_filename)
      document.body.appendChild(link)
      link.click()
      link.remove()
      window.URL.revokeObjectURL(url)

      // Update download count locally
      setDocuments(documents.map(d =>
        d.id === doc.id ? { ...d, download_count: d.download_count + 1 } : d
      ))
    } catch (error) {
      toast.error('Erreur lors du téléchargement')
    }
  }

  const viewDocument = async (doc: Document) => {
    // Ouvrir le document dans un nouvel onglet
    // Types visualisables directement: PDF, images
    const viewableTypes = ['pdf', 'image']

    if (viewableTypes.includes(doc.file_type)) {
      try {
        // Récupérer le fichier avec authentification
        const response = await api.get(`/documents/${doc.id}/view`, {
          responseType: 'blob'
        })

        // Créer une URL blob pour l'affichage
        const blob = new Blob([response.data], { type: doc.mime_type })
        const blobUrl = window.URL.createObjectURL(blob)

        // Ouvrir dans un nouvel onglet
        window.open(blobUrl, '_blank')

        // Nettoyer l'URL après un délai (laisser le temps au navigateur de charger)
        setTimeout(() => {
          window.URL.revokeObjectURL(blobUrl)
        }, 60000) // 1 minute

        // Update view count locally
        setDocuments(documents.map(d =>
          d.id === doc.id ? { ...d, view_count: d.view_count + 1 } : d
        ))
      } catch (error) {
        toast.error('Erreur lors de l\'ouverture du document')
      }
    } else {
      // Pour les autres types (Word, Excel, etc.), télécharger
      toast('Ce type de fichier ne peut pas être visualisé directement. Téléchargement...', { icon: '📥' })
      downloadDocument(doc)
    }
  }

  const canViewInBrowser = (fileType: string): boolean => {
    return ['pdf', 'image'].includes(fileType)
  }

  // Vérifier si le document supporte la génération IA (PDF, images, Word, Excel, PowerPoint)
  const canGenerateAI = (fileType: string): boolean => {
    return ['pdf', 'image', 'word', 'excel', 'powerpoint'].includes(fileType)
  }

  // Ouvrir le modal de génération IA
  const openAIModal = (doc: Document, type: 'flashcards' | 'quiz') => {
    setSelectedDocForAI(doc)
    setAiType(type)
    setAiCount(type === 'flashcards' ? 10 : 10)
    setAiDifficulty('medium')
    setShowAIModal(true)
  }

  // Vérifier le statut d'une tâche IA
  const pollTaskStatus = async (taskId: number): Promise<any> => {
    return new Promise((resolve, reject) => {
      const poll = async () => {
        try {
          const response = await api.get(`/ai/task/${taskId}`)
          const task = response.data

          setAiTaskProgress(task.progress)
          setAiTaskStatus(task.status)
          setAiTaskMessage(task.progress_message || '')

          if (task.status === 'completed') {
            resolve(task)
          } else if (task.status === 'failed') {
            reject(new Error(task.error_message || 'La tâche a échoué'))
          } else {
            // Continuer à vérifier toutes les 2 secondes
            setTimeout(poll, 2000)
          }
        } catch (error) {
          reject(error)
        }
      }
      poll()
    })
  }

  // Générer flashcards ou quiz depuis un document (version async avec polling)
  const generateFromDocument = async () => {
    if (!selectedDocForAI) return

    setAiGenerating(true)
    setAiTaskProgress(0)
    setAiTaskStatus('pending')
    setAiTaskMessage('Lancement de la génération...')

    try {
      // Utiliser les endpoints async pour traitement en arrière-plan
      const endpoint = aiType === 'flashcards'
        ? '/ai/document/generate-flashcards-async'
        : '/ai/document/generate-quiz-async'

      const payload = aiType === 'flashcards'
        ? {
            document_id: selectedDocForAI.id,
            count: aiCount,
            difficulty: aiDifficulty,
            language: 'fra'
          }
        : {
            document_id: selectedDocForAI.id,
            question_count: aiCount,
            difficulty: aiDifficulty,
            language: 'fra',
            question_types: quizQuestionTypes,
            time_limit_minutes: quizIsTimed ? quizTimeLimit : null,
            quiz_type: 'practice'
          }

      // Lancer la tâche
      const startResponse = await api.post(endpoint, payload)
      const taskId = startResponse.data.task_id
      setAiTaskId(taskId)
      setAiTaskMessage('Tâche démarrée, traitement en cours...')

      // Polling pour suivre la progression
      const completedTask = await pollTaskStatus(taskId)

      // Succès!
      if (aiType === 'flashcards') {
        const count = completedTask.result_count || completedTask.flashcards?.length || 0
        toast.success(`${count} flashcards générées avec succès!`, {
          icon: '🎴',
          duration: 5000
        })
      } else {
        const quiz = completedTask.quiz
        toast.success(`Quiz "${quiz?.title || 'Quiz'}" créé avec ${completedTask.result_count || 0} questions!`, {
          icon: '📝',
          duration: 5000
        })
      }

      // Mettre à jour le document si le texte a été extrait
      setDocuments(documents.map(d =>
        d.id === selectedDocForAI.id ? { ...d, is_text_extracted: true } : d
      ))

      // Reset et fermer
      setShowAIModal(false)
      setSelectedDocForAI(null)
      setAiTaskId(null)

    } catch (error: any) {
      console.error('Erreur génération IA:', error)
      const message = error.response?.data?.detail || error.message || 'Erreur lors de la génération'
      toast.error(message)
    } finally {
      setAiGenerating(false)
      setAiTaskId(null)
      setAiTaskProgress(0)
      setAiTaskStatus('')
      setAiTaskMessage('')
    }
  }

  const filteredDocuments = documents.filter((doc) => {
    const matchesSearch = doc.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      doc.original_filename.toLowerCase().includes(searchQuery.toLowerCase())
    const matchesSubject = !selectedSubject || doc.subject_id === selectedSubject
    const matchesType = !selectedFileType || doc.file_type === selectedFileType
    const matchesFavorite = !showFavorites || doc.is_favorite
    return matchesSearch && matchesSubject && matchesType && matchesFavorite && !doc.is_archived
  })

  const getSubjectName = (subjectId: number) => {
    const subject = subjects.find(s => s.id === subjectId)
    return subject?.name || 'Inconnu'
  }

  const getSubjectColor = (subjectId: number) => {
    const subject = subjects.find(s => s.id === subjectId)
    return subject?.color || '#6B7280'
  }

  const formatStorageSize = (mb: number): string => {
    if (mb >= 1024) {
      return `${(mb / 1024).toFixed(1)} GB`
    }
    return `${mb.toFixed(0)} MB`
  }

  const getStoragePercentage = (): number => {
    if (!storageQuota || storageQuota.storage_limit_mb === 0) return 0
    return Math.min((storageQuota.storage_used_mb / storageQuota.storage_limit_mb) * 100, 100)
  }

  const getStorageBarColor = (): string => {
    const percentage = getStoragePercentage()
    if (percentage >= 90) return 'bg-red-500'
    if (percentage >= 75) return 'bg-yellow-500'
    return 'bg-primary-500'
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
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Mes Documents</h1>
            {isFromCache && (
              <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400">
                <CloudOff className="w-3 h-3 mr-1" />
                Cache
              </span>
            )}
          </div>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            {stats?.total_documents || documents.length} documents ({stats?.total_size_formatted || '0 B'})
            {isFromCache && !isOnline && ' • Mode hors-ligne'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {isFromCache && isOnline && (
            <button
              onClick={() => fetchData(true)}
              className="inline-flex items-center justify-center px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition"
              title="Actualiser les données"
            >
              <RefreshCw className="h-4 w-4" />
            </button>
          )}
          <button
            onClick={() => {
              if (!isOnline) {
                toast.error('Upload non disponible hors-ligne')
                return
              }
              setShowUploadModal(true)
            }}
            disabled={subjects.length === 0}
            className="inline-flex items-center justify-center px-6 py-3 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Upload className="h-5 w-5 mr-2" />
            Uploader un document
          </button>
        </div>
      </div>

      {/* Storage Quota Card */}
      {storageQuota && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-gray-100 rounded-lg">
                <HardDrive className="h-5 w-5 text-gray-600" />
              </div>
              <div>
                <h3 className="text-sm font-medium text-gray-900">Espace de stockage</h3>
                <p className="text-xs text-gray-500">
                  {formatStorageSize(storageQuota.storage_used_mb)} / {formatStorageSize(storageQuota.storage_limit_mb)} utilisé
                </p>
              </div>
            </div>
            {getStoragePercentage() >= 90 && (
              <div className="flex items-center text-red-600 text-sm">
                <AlertTriangle className="h-4 w-4 mr-1" />
                <span>Presque plein</span>
              </div>
            )}
            {getStoragePercentage() >= 75 && getStoragePercentage() < 90 && (
              <div className="flex items-center text-yellow-600 text-sm">
                <AlertTriangle className="h-4 w-4 mr-1" />
                <span>Espace limité</span>
              </div>
            )}
            {getStoragePercentage() < 75 && (
              <Link
                href="/pricing"
                className="text-sm text-primary-600 hover:text-primary-700 font-medium"
              >
                Augmenter
              </Link>
            )}
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2.5 overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-500 ${getStorageBarColor()}`}
              style={{ width: `${getStoragePercentage()}%` }}
            />
          </div>
          <div className="flex justify-between mt-2 text-xs text-gray-500">
            <span>{getStoragePercentage().toFixed(1)}% utilisé</span>
            <span>{formatStorageSize(storageQuota.storage_limit_mb - storageQuota.storage_used_mb)} disponible</span>
          </div>
        </div>
      )}

      {/* Stats Cards */}
      {stats && stats.total_documents > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
          {Object.entries(stats.documents_by_type).map(([type, count]) => (
            <div
              key={type}
              onClick={() => setSelectedFileType(selectedFileType === type ? null : type)}
              className={`p-4 rounded-xl border cursor-pointer transition ${
                selectedFileType === type
                  ? 'ring-2 ring-primary-500 ' + FILE_TYPE_COLORS[type]
                  : FILE_TYPE_COLORS[type] + ' hover:shadow-md'
              }`}
            >
              <div className="flex items-center space-x-3">
                {FILE_TYPE_ICONS[type]}
                <div>
                  <div className="text-2xl font-bold text-gray-900">{count}</div>
                  <div className="text-xs text-gray-600 capitalize">{type}</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Filters */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
        <div className="flex flex-col md:flex-row gap-4">
          {/* Search */}
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
            <input
              type="text"
              placeholder="Rechercher dans vos documents..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            />
          </div>

          {/* Subject Filter */}
          <div className="relative">
            <select
              value={selectedSubject || ''}
              onChange={(e) => setSelectedSubject(e.target.value ? Number(e.target.value) : null)}
              className="appearance-none px-4 py-2 pr-10 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent bg-white"
            >
              <option value="">Toutes les matières</option>
              {subjects.map(subject => (
                <option key={subject.id} value={subject.id}>{subject.name}</option>
              ))}
            </select>
            <ChevronDown className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
          </div>

          {/* Favorites Filter */}
          <button
            onClick={() => setShowFavorites(!showFavorites)}
            className={`px-4 py-2 rounded-lg border transition flex items-center space-x-2 ${
              showFavorites
                ? 'bg-yellow-50 border-yellow-500 text-yellow-700'
                : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'
            }`}
          >
            <Star className={`h-5 w-5 ${showFavorites ? 'fill-yellow-400' : ''}`} />
            <span className="hidden sm:inline">Favoris</span>
          </button>

          {/* Clear Filters */}
          {(searchQuery || selectedSubject || selectedFileType || showFavorites) && (
            <button
              onClick={() => {
                setSearchQuery('')
                setSelectedSubject(null)
                setSelectedFileType(null)
                setShowFavorites(false)
              }}
              className="px-4 py-2 text-gray-600 hover:text-gray-900 transition"
            >
              <X className="h-5 w-5" />
            </button>
          )}
        </div>
      </div>

      {/* Documents Grid */}
      {subjects.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center">
          <FolderOpen className="h-16 w-16 text-gray-400 mx-auto mb-4" />
          <h3 className="text-xl font-semibold text-gray-900 mb-2">
            Créez d'abord une matière
          </h3>
          <p className="text-gray-600 mb-6">
            Vous devez créer au moins une matière avant de pouvoir uploader des documents
          </p>
          <Link
            href="/subjects"
            className="inline-flex items-center justify-center px-6 py-3 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition font-semibold"
          >
            Créer une matière
          </Link>
        </div>
      ) : filteredDocuments.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center">
          <FileText className="h-16 w-16 text-gray-400 mx-auto mb-4" />
          <h3 className="text-xl font-semibold text-gray-900 mb-2">
            {searchQuery || selectedSubject || selectedFileType || showFavorites
              ? 'Aucun document trouvé'
              : 'Aucun document pour le moment'}
          </h3>
          <p className="text-gray-600 mb-6">
            {searchQuery || selectedSubject || selectedFileType || showFavorites
              ? 'Essayez de modifier vos filtres'
              : 'Uploadez vos premiers cours PDF, Word, Excel ou PowerPoint'}
          </p>
          {!searchQuery && !selectedSubject && !selectedFileType && !showFavorites && (
            <button
              onClick={() => setShowUploadModal(true)}
              className="inline-flex items-center justify-center px-6 py-3 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition font-semibold"
            >
              <Upload className="h-5 w-5 mr-2" />
              Uploader mon premier document
            </button>
          )}
        </div>
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {filteredDocuments.map((doc) => (
            <div
              key={doc.id}
              className={`bg-white rounded-xl shadow-sm border hover:shadow-md transition group ${FILE_TYPE_COLORS[doc.file_type]}`}
            >
              <div className="p-5">
                {/* Header */}
                <div className="flex items-start justify-between mb-4">
                  <div className="p-3 rounded-xl bg-white shadow-sm">
                    {FILE_TYPE_ICONS[doc.file_type]}
                  </div>
                  <button
                    onClick={() => toggleFavorite(doc.id)}
                    className="text-gray-400 hover:text-yellow-500 transition"
                  >
                    <Star
                      className={`h-5 w-5 ${
                        doc.is_favorite ? 'fill-yellow-400 text-yellow-400' : ''
                      }`}
                    />
                  </button>
                </div>

                {/* Title & Subject */}
                <div className="mb-3">
                  <h3 className="text-lg font-semibold text-gray-900 mb-1 line-clamp-2">
                    {doc.title}
                  </h3>
                  <span
                    className="inline-block px-2 py-1 rounded-full text-xs font-medium"
                    style={{
                      backgroundColor: `${getSubjectColor(doc.subject_id)}20`,
                      color: getSubjectColor(doc.subject_id)
                    }}
                  >
                    {getSubjectName(doc.subject_id)}
                  </span>
                </div>

                {/* File Info */}
                <div className="text-sm text-gray-500 mb-4">
                  <div className="flex items-center justify-between">
                    <span>{doc.file_size_formatted}</span>
                    <span className="uppercase">{doc.file_extension.replace('.', '')}</span>
                  </div>
                </div>

                {/* Stats */}
                <div className="flex items-center text-xs text-gray-500 mb-4 space-x-4">
                  <div className="flex items-center">
                    <Download className="h-3 w-3 mr-1" />
                    {doc.download_count}
                  </div>
                  <div className="flex items-center">
                    <Eye className="h-3 w-3 mr-1" />
                    {doc.view_count}
                  </div>
                  <div className="flex items-center">
                    <Clock className="h-3 w-3 mr-1" />
                    {new Date(doc.created_at).toLocaleDateString('fr-FR')}
                  </div>
                </div>

                {/* Actions */}
                <div className="space-y-2 pt-4 border-t border-gray-200">
                  {/* Boutons IA - uniquement pour PDF et images */}
                  {canGenerateAI(doc.file_type) && (
                    <div className="flex items-center space-x-2">
                      <button
                        onClick={() => openAIModal(doc, 'flashcards')}
                        className="flex-1 px-3 py-2 bg-purple-50 text-purple-700 rounded-lg hover:bg-purple-100 transition text-sm font-medium flex items-center justify-center"
                        title="Générer des flashcards avec l'IA"
                      >
                        <Brain className="h-4 w-4 mr-1" />
                        Flashcards
                      </button>
                      <button
                        onClick={() => openAIModal(doc, 'quiz')}
                        className="flex-1 px-3 py-2 bg-amber-50 text-amber-700 rounded-lg hover:bg-amber-100 transition text-sm font-medium flex items-center justify-center"
                        title="Générer un quiz avec l'IA"
                      >
                        <HelpCircle className="h-4 w-4 mr-1" />
                        Quiz
                      </button>
                    </div>
                  )}

                  {/* Boutons standards */}
                  <div className="flex items-center space-x-2">
                    {/* Bouton Ouvrir - uniquement pour PDF et images */}
                    {canViewInBrowser(doc.file_type) && (
                      <button
                        onClick={() => viewDocument(doc)}
                        className="flex-1 px-3 py-2 bg-green-50 text-green-700 rounded-lg hover:bg-green-100 transition text-sm font-medium flex items-center justify-center"
                      >
                        <ExternalLink className="h-4 w-4 mr-1" />
                        Ouvrir
                      </button>
                    )}
                    <button
                      onClick={() => downloadDocument(doc)}
                      className={`${canViewInBrowser(doc.file_type) ? 'flex-1' : 'flex-1'} px-3 py-2 bg-primary-50 text-primary-700 rounded-lg hover:bg-primary-100 transition text-sm font-medium flex items-center justify-center`}
                    >
                      <Download className="h-4 w-4 mr-1" />
                      Télécharger
                    </button>
                    <button
                      onClick={() => deleteDocument(doc.id)}
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

      {/* Modal Génération IA */}
      {showAIModal && selectedDocForAI && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6 my-8 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center space-x-3">
                <div className="p-2 bg-gradient-to-br from-purple-500 to-pink-500 rounded-lg">
                  <Sparkles className="h-6 w-6 text-white" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-gray-900">
                    Générer {aiType === 'flashcards' ? 'des Flashcards' : 'un Quiz'}
                  </h2>
                  <p className="text-sm text-gray-500 truncate max-w-[200px]">
                    {selectedDocForAI.title || selectedDocForAI.original_filename}
                  </p>
                </div>
              </div>
              <button
                onClick={() => {
                  setShowAIModal(false)
                  setSelectedDocForAI(null)
                }}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="h-6 w-6" />
              </button>
            </div>

            <div className="space-y-4">
              {/* Type de génération */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Type de contenu
                </label>
                <div className="flex space-x-2">
                  <button
                    onClick={() => setAiType('flashcards')}
                    className={`flex-1 py-3 px-4 rounded-lg border-2 transition flex items-center justify-center space-x-2 ${
                      aiType === 'flashcards'
                        ? 'border-purple-500 bg-purple-50 text-purple-700'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <Brain className="h-5 w-5" />
                    <span>Flashcards</span>
                  </button>
                  <button
                    onClick={() => setAiType('quiz')}
                    className={`flex-1 py-3 px-4 rounded-lg border-2 transition flex items-center justify-center space-x-2 ${
                      aiType === 'quiz'
                        ? 'border-amber-500 bg-amber-50 text-amber-700'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <HelpCircle className="h-5 w-5" />
                    <span>Quiz</span>
                  </button>
                </div>
              </div>

              {/* Nombre */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  {aiType === 'flashcards' ? 'Nombre de flashcards' : 'Nombre de questions'}
                </label>
                <input
                  type="range"
                  min={aiType === 'flashcards' ? 1 : 5}
                  max="20"
                  value={aiCount}
                  onChange={(e) => setAiCount(Number(e.target.value))}
                  className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                />
                <div className="flex justify-between text-sm text-gray-500 mt-1">
                  <span>{aiType === 'flashcards' ? '1' : '5'}</span>
                  <span className="font-bold text-primary-600">{aiCount}</span>
                  <span>20</span>
                </div>
              </div>

              {/* Difficulté */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Difficulté
                </label>
                <div className="flex space-x-2">
                  {(['easy', 'medium', 'hard'] as const).map((diff) => (
                    <button
                      key={diff}
                      onClick={() => setAiDifficulty(diff)}
                      className={`flex-1 py-2 px-3 rounded-lg border transition text-sm ${
                        aiDifficulty === diff
                          ? diff === 'easy'
                            ? 'border-green-500 bg-green-50 text-green-700'
                            : diff === 'medium'
                            ? 'border-yellow-500 bg-yellow-50 text-yellow-700'
                            : 'border-red-500 bg-red-50 text-red-700'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      {diff === 'easy' ? 'Facile' : diff === 'medium' ? 'Moyen' : 'Difficile'}
                    </button>
                  ))}
                </div>
              </div>

              {/* Options spécifiques au Quiz */}
              {aiType === 'quiz' && (
                <>
                  {/* Types de questions */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Types de questions
                    </label>
                    <div className="flex flex-wrap gap-2">
                      {[
                        { value: 'multiple_choice', label: 'Choix multiple', icon: '🔘' },
                        { value: 'true_false', label: 'Vrai/Faux', icon: '✓✗' },
                        { value: 'short_answer', label: 'Réponse courte', icon: '✏️' }
                      ].map((type) => (
                        <button
                          key={type.value}
                          type="button"
                          onClick={() => {
                            if (quizQuestionTypes.includes(type.value)) {
                              // Ne pas permettre de tout désélectionner
                              if (quizQuestionTypes.length > 1) {
                                setQuizQuestionTypes(quizQuestionTypes.filter(t => t !== type.value))
                              }
                            } else {
                              setQuizQuestionTypes([...quizQuestionTypes, type.value])
                            }
                          }}
                          className={`px-3 py-2 rounded-lg border-2 transition text-sm flex items-center gap-2 ${
                            quizQuestionTypes.includes(type.value)
                              ? 'border-primary-500 bg-primary-50 text-primary-700'
                              : 'border-gray-200 hover:border-gray-300 text-gray-600'
                          }`}
                        >
                          <span>{type.icon}</span>
                          <span>{type.label}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Limite de temps */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <label className="text-sm font-medium text-gray-700 flex items-center gap-2">
                        <Clock className="h-4 w-4" />
                        Quiz chronométré
                      </label>
                      <button
                        type="button"
                        onClick={() => setQuizIsTimed(!quizIsTimed)}
                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                          quizIsTimed ? 'bg-primary-600' : 'bg-gray-200'
                        }`}
                      >
                        <span
                          className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                            quizIsTimed ? 'translate-x-6' : 'translate-x-1'
                          }`}
                        />
                      </button>
                    </div>
                    {quizIsTimed && (
                      <div className="flex items-center gap-3 mt-2">
                        <input
                          type="number"
                          min="5"
                          max="180"
                          value={quizTimeLimit}
                          onChange={(e) => setQuizTimeLimit(Math.max(5, Math.min(180, parseInt(e.target.value) || 30)))}
                          className="w-20 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent text-center"
                        />
                        <span className="text-sm text-gray-600">minutes</span>
                      </div>
                    )}
                  </div>
                </>
              )}

              {/* Info OCR */}
              {!selectedDocForAI.is_text_extracted && !aiGenerating && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm text-blue-700">
                  <p className="flex items-center">
                    <Sparkles className="h-4 w-4 mr-2" />
                    Le texte sera extrait automatiquement du document (OCR)
                  </p>
                </div>
              )}

              {/* Barre de progression */}
              {aiGenerating && (
                <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-gray-700">
                      {aiTaskStatus === 'extracting_text' ? 'Extraction du texte...' :
                       aiTaskStatus === 'generating' ? 'Génération en cours...' :
                       aiTaskStatus === 'processing' ? 'Traitement...' :
                       'Démarrage...'}
                    </span>
                    <span className="text-sm font-bold text-primary-600">{aiTaskProgress}%</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-purple-500 to-pink-500 rounded-full transition-all duration-500 ease-out"
                      style={{ width: `${aiTaskProgress}%` }}
                    />
                  </div>
                  <p className="text-xs text-gray-500 text-center">
                    {aiTaskMessage || 'Veuillez patienter...'}
                  </p>
                  <p className="text-xs text-gray-400 text-center">
                    Les gros documents peuvent prendre quelques minutes
                  </p>
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="flex space-x-3 mt-6">
              <button
                onClick={() => {
                  if (!aiGenerating) {
                    setShowAIModal(false)
                    setSelectedDocForAI(null)
                  }
                }}
                disabled={aiGenerating}
                className="flex-1 px-4 py-3 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition font-medium disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {aiGenerating ? 'Traitement...' : 'Annuler'}
              </button>
              <button
                onClick={generateFromDocument}
                disabled={aiGenerating}
                className="flex-1 px-4 py-3 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-lg hover:from-purple-700 hover:to-pink-700 transition font-medium flex items-center justify-center disabled:opacity-50"
              >
                {aiGenerating ? (
                  <>
                    <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                    {aiTaskProgress > 0 ? `${aiTaskProgress}%` : 'Lancement...'}
                  </>
                ) : (
                  <>
                    <Sparkles className="h-5 w-5 mr-2" />
                    Générer
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Upload Modal */}
      {showUploadModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-gray-900">Uploader un document</h2>
              <button
                onClick={() => {
                  setShowUploadModal(false)
                  setUploadSubjectId(null)
                  setUploadTitle('')
                  setUploadDescription('')
                }}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="h-6 w-6" />
              </button>
            </div>

            <div className="space-y-4">
              {/* Subject Selection */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Matière <span className="text-red-500">*</span>
                </label>
                <select
                  value={uploadSubjectId || ''}
                  onChange={(e) => setUploadSubjectId(Number(e.target.value))}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  required
                >
                  <option value="">Sélectionner une matière</option>
                  {subjects.map(subject => (
                    <option key={subject.id} value={subject.id}>{subject.name}</option>
                  ))}
                </select>
              </div>

              {/* Title */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Titre (optionnel)
                </label>
                <input
                  type="text"
                  value={uploadTitle}
                  onChange={(e) => setUploadTitle(e.target.value)}
                  placeholder="Nom du document..."
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                />
              </div>

              {/* Description */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Description (optionnel)
                </label>
                <textarea
                  value={uploadDescription}
                  onChange={(e) => setUploadDescription(e.target.value)}
                  placeholder="Description du document..."
                  rows={2}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                />
              </div>

              {/* Storage Warning */}
              {storageQuota && getStoragePercentage() >= 90 && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                  <div className="flex items-center text-red-700">
                    <AlertTriangle className="h-4 w-4 mr-2 flex-shrink-0" />
                    <span className="text-sm">
                      Attention: votre espace de stockage est presque plein ({getStoragePercentage().toFixed(0)}%).
                      <Link href="/pricing" className="ml-1 underline font-medium">
                        Passez à un plan supérieur
                      </Link>
                    </span>
                  </div>
                </div>
              )}
              {storageQuota && getStoragePercentage() >= 75 && getStoragePercentage() < 90 && (
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                  <div className="flex items-center text-yellow-700">
                    <AlertTriangle className="h-4 w-4 mr-2 flex-shrink-0" />
                    <span className="text-sm">
                      Espace limité: {formatStorageSize(storageQuota.storage_limit_mb - storageQuota.storage_used_mb)} restant
                    </span>
                  </div>
                </div>
              )}

              {/* File Input */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Fichier <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <input
                    ref={fileInputRef}
                    type="file"
                    onChange={handleFileUpload}
                    accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.jpg,.jpeg,.png,.gif,.bmp,.webp,.txt,.csv,.md"
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-primary-50 file:text-primary-700 hover:file:bg-primary-100"
                    disabled={!uploadSubjectId || uploading}
                  />
                </div>
                <p className="text-xs text-gray-500 mt-2">
                  PDF, Word, Excel, PowerPoint, Images (max 50 MB)
                </p>
              </div>

              {uploading && (
                <div className="flex items-center justify-center py-4">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
                  <span className="ml-3 text-gray-600">Upload en cours...</span>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
