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
  AlertTriangle
} from 'lucide-react'
import api from '@/lib/api'
import { toast } from 'react-hot-toast'

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
  const searchParams = useSearchParams()
  const subjectFromUrl = searchParams.get('subject')

  const [documents, setDocuments] = useState<Document[]>([])
  const [subjects, setSubjects] = useState<Subject[]>([])
  const [stats, setStats] = useState<DocumentStats | null>(null)
  const [storageQuota, setStorageQuota] = useState<StorageQuota | null>(null)
  const [loading, setLoading] = useState(true)
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

  const fetchData = async () => {
    try {
      const [docsRes, subjectsRes, statsRes] = await Promise.all([
        api.get('/documents/'),
        api.get('/subjects/'),
        api.get('/documents/stats')
      ])
      setDocuments(docsRes.data.documents || [])
      setSubjects(subjectsRes.data.subjects || [])
      setStats(statsRes.data)

      // Récupérer le quota de stockage séparément (peut échouer si pas d'abonnement)
      try {
        const subscriptionRes = await api.get('/payments/subscription')
        if (subscriptionRes.data) {
          setStorageQuota({
            storage_limit_mb: subscriptionRes.data.storage_limit_mb || 100,
            storage_used_mb: subscriptionRes.data.storage_used_mb || 0
          })
        }
      } catch (subError) {
        // Utiliser les valeurs par défaut (plan FREE) si pas d'abonnement
        console.log('Abonnement non trouvé, utilisation des valeurs par défaut')
        // Calculer le stockage utilisé à partir des stats
        const usedMb = stats ? Math.round((statsRes.data.total_size_bytes || 0) / (1024 * 1024)) : 0
        setStorageQuota({
          storage_limit_mb: 100, // Limite FREE par défaut
          storage_used_mb: usedMb
        })
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
    try {
      await api.post(`/documents/${docId}/favorite`)
      setDocuments(documents.map(doc =>
        doc.id === docId ? { ...doc, is_favorite: !doc.is_favorite } : doc
      ))
      toast.success('Favori mis à jour')
    } catch (error) {
      toast.error('Erreur lors de la mise à jour')
    }
  }

  const deleteDocument = async (docId: number) => {
    if (!confirm('Êtes-vous sûr de vouloir supprimer ce document?')) return

    try {
      await api.delete(`/documents/${docId}`)
      setDocuments(documents.filter(doc => doc.id !== docId))
      toast.success('Document supprimé')
      fetchData() // Refresh stats
    } catch (error) {
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
          <h1 className="text-3xl font-bold text-gray-900">Mes Documents</h1>
          <p className="text-gray-600 mt-1">
            {stats?.total_documents || 0} documents ({stats?.total_size_formatted || '0 B'})
          </p>
        </div>
        <button
          onClick={() => setShowUploadModal(true)}
          disabled={subjects.length === 0}
          className="inline-flex items-center justify-center px-6 py-3 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Upload className="h-5 w-5 mr-2" />
          Uploader un document
        </button>
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
                <div className="flex items-center space-x-2 pt-4 border-t border-gray-200">
                  <button
                    onClick={() => downloadDocument(doc)}
                    className="flex-1 px-3 py-2 bg-primary-50 text-primary-700 rounded-lg hover:bg-primary-100 transition text-sm font-medium flex items-center justify-center"
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
          ))}
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
