'use client'

import { useState, useCallback, useEffect, useRef } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Progress } from '@/components/ui/progress'
import {
  Upload, FileText, Image as ImageIcon, Loader2, CheckCircle2,
  AlertCircle, FileUp, Sparkles, Eye, Table2, Columns, Wand2, XCircle, Clock, CloudOff, WifiOff
} from 'lucide-react'
import api from '@/lib/api'
import { useToast } from '@/hooks/use-toast'
import { useRouter } from 'next/navigation'
import { useTranslation } from '@/contexts/LanguageContext'
import { useOfflineContext } from '@/components/providers/OfflineProvider'
import { offlineStorage } from '@/lib/offlineStorage'

interface Subject {
  id: number
  name: string
}

interface OCRResult {
  text: string
  extracted_text?: string
  confidence: number
  average_confidence?: number
  page_count?: number
  note_id?: number
  layout_type?: string
}

interface AsyncTaskStatus {
  task_id: string
  status: 'PENDING' | 'PROCESSING' | 'SUCCESS' | 'FAILURE'
  progress: number
  message: string
  current_page?: number
  total_pages?: number
  result?: OCRResult
  error?: string
}

// 10 langues supportées (alignées avec le backend)
const SUPPORTED_LANGUAGES = {
  'fra': { name: 'Français', flag: '🇫🇷' },
  'eng': { name: 'English', flag: '🇬🇧' },
  'spa': { name: 'Español', flag: '🇪🇸' },
  'por': { name: 'Português', flag: '🇵🇹' },
  'ara': { name: 'العربية', flag: '🇸🇦' },
  'deu': { name: 'Deutsch', flag: '🇩🇪' },
  'ita': { name: 'Italiano', flag: '🇮🇹' },
  'zho': { name: '中文', flag: '🇨🇳' },
  'jpn': { name: '日本語', flag: '🇯🇵' },
  'kor': { name: '한국어', flag: '🇰🇷' },
}

const LANGUAGE_COMBINATIONS = [
  { value: 'fra', label: '🇫🇷 Français' },
  { value: 'eng', label: '🇬🇧 English' },
  { value: 'fra+eng', label: '🇫🇷+🇬🇧 Français + English' },
  { value: 'spa', label: '🇪🇸 Español' },
  { value: 'por', label: '🇵🇹 Português' },
  { value: 'spa+por', label: '🇪🇸+🇵🇹 Español + Português' },
  { value: 'deu', label: '🇩🇪 Deutsch' },
  { value: 'deu+eng', label: '🇩🇪+🇬🇧 Deutsch + English' },
  { value: 'ita', label: '🇮🇹 Italiano' },
  { value: 'ara', label: '🇸🇦 العربية (Arabic)' },
  { value: 'ara+fra', label: '🇸🇦+🇫🇷 العربية + Français' },
  { value: 'zho', label: '🇨🇳 中文 (Chinese)' },
  { value: 'zho+eng', label: '🇨🇳+🇬🇧 中文 + English' },
  { value: 'jpn', label: '🇯🇵 日本語 (Japanese)' },
  { value: 'jpn+eng', label: '🇯🇵+🇬🇧 日本語 + English' },
  { value: 'kor', label: '🇰🇷 한국어 (Korean)' },
  { value: 'kor+eng', label: '🇰🇷+🇬🇧 한국어 + English' },
]

// Seuil pour utiliser le mode async (5 MB)
const ASYNC_SIZE_THRESHOLD = 5 * 1024 * 1024

export default function OCRPage() {
  const { toast } = useToast()
  const router = useRouter()
  const { t } = useTranslation()
  const { isOnline } = useOfflineContext()
  const [loading, setLoading] = useState(false)
  const [subjects, setSubjects] = useState<Subject[]>([])
  const [selectedSubject, setSelectedSubject] = useState<string>('')
  const [language, setLanguage] = useState('fra+eng')
  const [createNote, setCreateNote] = useState(true)
  const [noteTitle, setNoteTitle] = useState('')
  const [extractedText, setExtractedText] = useState('')
  const [confidence, setConfidence] = useState(0)
  const [createdNoteId, setCreatedNoteId] = useState<number | null>(null)
  const [dragActive, setDragActive] = useState(false)
  // Nouvelles options
  const [detectLayout, setDetectLayout] = useState(true)
  const [aiPostProcess, setAiPostProcess] = useState(false)
  const [layoutType, setLayoutType] = useState<string>('')
  // Async mode state
  const [asyncMode, setAsyncMode] = useState(false)
  const [taskId, setTaskId] = useState<string | null>(null)
  const [taskProgress, setTaskProgress] = useState(0)
  const [taskMessage, setTaskMessage] = useState('')
  const [currentPage, setCurrentPage] = useState<number | null>(null)
  const [totalPages, setTotalPages] = useState<number | null>(null)
  const pollingRef = useRef<NodeJS.Timeout | null>(null)

  useEffect(() => {
    fetchSubjects()
    // Cleanup polling on unmount
    return () => {
      if (pollingRef.current) {
        clearInterval(pollingRef.current)
      }
    }
  }, [])

  const fetchSubjects = async () => {
    try {
      if (isOnline) {
        const response = await api.get('/subjects/')
        const subjectsData = response.data.subjects || []
        setSubjects(subjectsData)
        // Cache pour utilisation offline
        await offlineStorage.saveSubjects(subjectsData)
      } else {
        // Charger depuis le cache en mode offline
        const cachedSubjects = await offlineStorage.getSubjects()
        setSubjects(cachedSubjects || [])
      }
    } catch (error) {
      console.error('Error fetching subjects:', error)
      // Essayer le cache en cas d'erreur
      const cachedSubjects = await offlineStorage.getSubjects()
      if (cachedSubjects && cachedSubjects.length > 0) {
        setSubjects(cachedSubjects)
      }
    }
  }

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true)
    } else if (e.type === 'dragleave') {
      setDragActive(false)
    }
  }, [])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setDragActive(false)

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFile(e.dataTransfer.files[0])
    }
  }, [])

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      handleFile(e.target.files[0])
    }
  }

  // Polling pour le mode async
  const pollTaskStatus = useCallback(async (taskIdToPoll: string) => {
    try {
      const response = await api.get<AsyncTaskStatus>(`/ocr/task/${taskIdToPoll}`)
      const status = response.data

      setTaskProgress(status.progress)
      setTaskMessage(status.message)
      if (status.current_page) setCurrentPage(status.current_page)
      if (status.total_pages) setTotalPages(status.total_pages)

      if (status.status === 'SUCCESS' && status.result) {
        // Stop polling
        if (pollingRef.current) {
          clearInterval(pollingRef.current)
          pollingRef.current = null
        }

        // Extract results
        const result = status.result
        const text = result.extracted_text || result.text || ''
        const conf = result.average_confidence || result.confidence || 0

        setExtractedText(text)
        setConfidence(conf)
        setLayoutType(result.layout_type || '')
        if (result.note_id) {
          setCreatedNoteId(result.note_id)
        }

        setLoading(false)
        setAsyncMode(false)
        setTaskId(null)

        toast({
          title: t('ocr.extractionSuccess'),
          description: `Extraction terminée avec ${Math.round(conf)}% de confiance`,
        })
      } else if (status.status === 'FAILURE') {
        // Stop polling
        if (pollingRef.current) {
          clearInterval(pollingRef.current)
          pollingRef.current = null
        }

        setLoading(false)
        setAsyncMode(false)
        setTaskId(null)

        toast({
          title: t('ocr.extractionError'),
          description: status.error || 'Erreur inconnue',
          variant: 'destructive'
        })
      }
    } catch (error) {
      console.error('Polling error:', error)
    }
  }, [t, toast])

  // Annuler une tâche async
  const cancelTask = async () => {
    if (!taskId) return

    try {
      await api.delete(`/ocr/task/${taskId}`)
      if (pollingRef.current) {
        clearInterval(pollingRef.current)
        pollingRef.current = null
      }
      setLoading(false)
      setAsyncMode(false)
      setTaskId(null)
      setTaskProgress(0)
      setTaskMessage('')

      toast({
        title: 'Annulé',
        description: 'Le traitement OCR a été annulé',
      })
    } catch (error) {
      console.error('Cancel error:', error)
    }
  }

  const handleFile = async (file: File) => {
    // Vérifier la connexion avant de traiter
    if (!isOnline) {
      toast({
        title: 'Hors-ligne',
        description: 'L\'extraction OCR nécessite une connexion internet',
        variant: 'destructive'
      })
      return
    }

    const isPDF = file.type === 'application/pdf'
    const isImage = file.type.startsWith('image/')

    if (!isPDF && !isImage) {
      toast({
        title: t('ocr.unsupportedFormat'),
        description: t('ocr.pleaseUploadPdfOrImage'),
        variant: 'destructive'
      })
      return
    }

    // Set default title from filename
    if (!noteTitle) {
      const filename = file.name.replace(/\.[^/.]+$/, '')
      setNoteTitle(filename)
    }

    // Déterminer si on utilise le mode async
    // Async si: fichier > 5MB OU AI post-processing activé (peut être lent)
    const useAsync = file.size > ASYNC_SIZE_THRESHOLD || aiPostProcess

    try {
      setLoading(true)
      setExtractedText('')
      setConfidence(0)
      setCreatedNoteId(null)
      setLayoutType('')
      setTaskProgress(0)
      setTaskMessage('')
      setCurrentPage(null)
      setTotalPages(null)

      const formData = new FormData()
      formData.append('file', file)

      // Construire les query params pour les nouvelles options
      const params = new URLSearchParams({
        language,
        detect_layout: detectLayout.toString(),
        ai_post_process: aiPostProcess.toString()
      })

      if (createNote && selectedSubject) {
        params.append('subject_id', selectedSubject)
        params.append('create_note', 'true')
        if (noteTitle) {
          params.append('note_title', noteTitle)
        }
      }

      if (useAsync) {
        // MODE ASYNC avec Celery
        setAsyncMode(true)
        const endpoint = isPDF ? '/ocr/async/upload-pdf' : '/ocr/async/upload-image'

        const response = await api.post(`${endpoint}?${params.toString()}`, formData, {
          headers: { 'Content-Type': 'multipart/form-data' }
        })

        const newTaskId = response.data.task_id
        setTaskId(newTaskId)
        setTaskMessage('En attente de traitement...')

        toast({
          title: 'Traitement lancé',
          description: 'Le fichier est en cours de traitement en arrière-plan',
        })

        // Démarrer le polling toutes les 2 secondes
        pollingRef.current = setInterval(() => {
          pollTaskStatus(newTaskId)
        }, 2000)

        // Premier poll immédiat
        setTimeout(() => pollTaskStatus(newTaskId), 500)

      } else {
        // MODE SYNC (petit fichier, pas d'IA)
        setAsyncMode(false)
        const endpoint = isPDF ? '/ocr/upload-pdf' : '/ocr/upload-image'
        const response = await api.post<OCRResult>(`${endpoint}?${params.toString()}`, formData, {
          headers: { 'Content-Type': 'multipart/form-data' }
        })

        // Backend returns extracted_text for PDF and text for image
        const text = response.data.extracted_text || response.data.text || ''
        const conf = response.data.average_confidence || response.data.confidence || 0
        setExtractedText(text)
        setConfidence(conf)
        setLayoutType(response.data.layout_type || '')

        if (response.data.note_id) {
          setCreatedNoteId(response.data.note_id)
          toast({
            title: t('ocr.success'),
            description: t('ocr.textExtractedWithConfidence', { percent: Math.round(conf) }),
          })
        } else {
          toast({
            title: t('ocr.extractionSuccess'),
            description: t('ocr.textExtractedConfidence', { percent: Math.round(conf) }),
          })
        }
        setLoading(false)
      }
    } catch (error: any) {
      console.error('OCR error:', error)
      setLoading(false)
      setAsyncMode(false)
      toast({
        title: t('ocr.extractionError'),
        description: error.response?.data?.detail || t('ocr.cannotExtractText'),
        variant: 'destructive'
      })
    }
  }

  const goToNote = () => {
    if (createdNoteId) {
      router.push(`/notes/${createdNoteId}`)
    }
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Offline Warning */}
      {!isOnline && (
        <div className="bg-orange-50 dark:bg-orange-900/30 border border-orange-200 dark:border-orange-800 rounded-lg p-4">
          <div className="flex items-center gap-3">
            <WifiOff className="h-6 w-6 text-orange-600 dark:text-orange-400" />
            <div>
              <h3 className="font-medium text-orange-900 dark:text-orange-100">
                Mode hors-ligne détecté
              </h3>
              <p className="text-sm text-orange-700 dark:text-orange-300">
                L'extraction OCR nécessite une connexion internet. Vous pourrez utiliser cette fonctionnalité une fois reconnecté.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <Sparkles className="h-8 w-8 text-purple-500" />
          {t('ocr.title')}
          {!isOnline && (
            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400">
              <CloudOff className="w-3 h-3 mr-1" />
              Hors-ligne
            </span>
          )}
        </h1>
        <p className="text-muted-foreground mt-1">
          {t('ocr.subtitle')}
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Upload Section */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Upload className="h-5 w-5" />
              {t('ocr.fileUpload')}
            </CardTitle>
            <CardDescription>
              {t('ocr.fileUploadDesc')}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Drag & Drop Zone */}
            <div
              className={`relative border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
                dragActive
                  ? 'border-primary bg-primary/5'
                  : loading
                    ? 'border-primary/50 bg-primary/5'
                    : 'border-muted-foreground/25 hover:border-primary/50'
              }`}
              onDragEnter={handleDrag}
              onDragLeave={handleDrag}
              onDragOver={handleDrag}
              onDrop={handleDrop}
            >
              <input
                type="file"
                id="file-upload"
                className="hidden"
                accept=".pdf,.jpg,.jpeg,.png,.bmp,.tiff,.gif"
                onChange={handleFileInput}
                disabled={loading || !isOnline}
              />

              {!isOnline ? (
                // Mode hors-ligne
                <div className="flex flex-col items-center gap-2 py-4">
                  <WifiOff className="h-12 w-12 text-orange-500" />
                  <p className="text-lg font-medium text-orange-600 dark:text-orange-400">
                    Fonctionnalité non disponible
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Reconnectez-vous pour utiliser l'extraction OCR
                  </p>
                </div>
              ) : asyncMode && loading ? (
                // Mode async avec progression
                <div className="flex flex-col items-center gap-4 py-4">
                  <div className="relative">
                    <Clock className="h-12 w-12 text-primary animate-pulse" />
                    <div className="absolute -bottom-1 -right-1 bg-primary text-primary-foreground rounded-full px-2 py-0.5 text-xs font-bold">
                      {taskProgress}%
                    </div>
                  </div>

                  <div className="w-full max-w-xs space-y-2">
                    <Progress value={taskProgress} className="h-2" />
                    <p className="text-sm font-medium text-primary">
                      {taskMessage}
                    </p>
                    {currentPage && totalPages && (
                      <p className="text-xs text-muted-foreground">
                        Page {currentPage} / {totalPages}
                      </p>
                    )}
                  </div>

                  <Button
                    variant="outline"
                    size="sm"
                    onClick={cancelTask}
                    className="mt-2"
                  >
                    <XCircle className="h-4 w-4 mr-2" />
                    Annuler
                  </Button>
                </div>
              ) : (
                // Mode normal ou sync loading
                <label htmlFor="file-upload" className="cursor-pointer">
                  <div className="flex flex-col items-center gap-2">
                    {loading ? (
                      <Loader2 className="h-12 w-12 text-primary animate-spin" />
                    ) : (
                      <FileUp className="h-12 w-12 text-muted-foreground" />
                    )}
                    <p className="text-lg font-medium">
                      {loading ? t('ocr.extracting') : t('ocr.clickOrDrag')}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {t('ocr.supportedFiles')}
                    </p>
                  </div>
                </label>
              )}
            </div>

            {/* Language Selection - 10 langues + combinaisons */}
            <div className="space-y-2">
              <Label>{t('ocr.documentLanguage')}</Label>
              <Select value={language} onValueChange={setLanguage} disabled={loading}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="max-h-[300px]">
                  {LANGUAGE_COMBINATIONS.map((lang) => (
                    <SelectItem key={lang.value} value={lang.value}>
                      {lang.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Advanced OCR Options */}
            <div className="space-y-3 pt-4 border-t">
              <Label className="text-sm font-medium">{t('ocr.advancedOptions') || 'Options avancées'}</Label>

              <div className="flex items-center space-x-2">
                <Checkbox
                  id="detect-layout"
                  checked={detectLayout}
                  onCheckedChange={(checked) => setDetectLayout(checked as boolean)}
                  disabled={loading}
                />
                <Label htmlFor="detect-layout" className="cursor-pointer flex items-center gap-2">
                  <Table2 className="h-4 w-4 text-blue-500" />
                  {t('ocr.detectLayout') || 'Détecter tables et colonnes'}
                </Label>
              </div>

              <div className="flex items-center space-x-2">
                <Checkbox
                  id="ai-post-process"
                  checked={aiPostProcess}
                  onCheckedChange={(checked) => setAiPostProcess(checked as boolean)}
                  disabled={loading}
                />
                <Label htmlFor="ai-post-process" className="cursor-pointer flex items-center gap-2">
                  <Wand2 className="h-4 w-4 text-purple-500" />
                  {t('ocr.aiPostProcess') || 'Correction IA des erreurs'}
                </Label>
              </div>

              {aiPostProcess && (
                <div className="pl-6 space-y-1">
                  <p className="text-xs text-muted-foreground">
                    {t('ocr.aiPostProcessDesc') || 'Utilise Claude pour corriger les erreurs OCR (consomme 1 requête IA)'}
                  </p>
                  <p className="text-xs text-blue-600 dark:text-blue-400 flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    Mode asynchrone activé automatiquement
                  </p>
                </div>
              )}
            </div>

            {/* Create Note Option */}
            <div className="space-y-4 pt-4 border-t">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="create-note"
                  checked={createNote}
                  onCheckedChange={(checked) => setCreateNote(checked as boolean)}
                  disabled={loading}
                />
                <Label htmlFor="create-note" className="cursor-pointer">
                  {t('ocr.createNoteAuto')}
                </Label>
              </div>

              {createNote && (
                <div className="space-y-3 pl-6">
                  <div className="space-y-2">
                    <Label htmlFor="note-title">{t('ocr.noteTitle')}</Label>
                    <Input
                      id="note-title"
                      placeholder={t('ocr.noteTitlePlaceholder')}
                      value={noteTitle}
                      onChange={(e) => setNoteTitle(e.target.value)}
                      disabled={loading}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="subject">{t('ocr.subject')}</Label>
                    <Select
                      value={selectedSubject}
                      onValueChange={setSelectedSubject}
                      disabled={loading}
                    >
                      <SelectTrigger id="subject">
                        <SelectValue placeholder={t('ocr.selectSubject')} />
                      </SelectTrigger>
                      <SelectContent>
                        {subjects.map(subject => (
                          <SelectItem key={subject.id} value={subject.id.toString()}>
                            {subject.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Preview Section */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Eye className="h-5 w-5" />
              {t('ocr.extractedText')}
            </CardTitle>
            {confidence > 0 && (
              <CardDescription className="flex items-center gap-2 flex-wrap">
                <span>{t('ocr.confidence')}: {Math.round(confidence)}%</span>
                {confidence > 80 ? (
                  <CheckCircle2 className="h-4 w-4 text-green-500" />
                ) : confidence > 50 ? (
                  <AlertCircle className="h-4 w-4 text-yellow-500" />
                ) : (
                  <AlertCircle className="h-4 w-4 text-red-500" />
                )}
                {layoutType && (
                  <span className="ml-2 px-2 py-0.5 bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 rounded text-xs flex items-center gap-1">
                    {layoutType === 'table' && <Table2 className="h-3 w-3" />}
                    {layoutType === 'multi_column' && <Columns className="h-3 w-3" />}
                    {layoutType === 'table' ? 'Table détectée' :
                     layoutType === 'multi_column' ? 'Colonnes détectées' :
                     layoutType === 'single_column' ? 'Colonne simple' : layoutType}
                  </span>
                )}
              </CardDescription>
            )}
          </CardHeader>
          <CardContent className="space-y-4">
            <Textarea
              value={extractedText}
              onChange={(e) => setExtractedText(e.target.value)}
              placeholder={t('ocr.textPlaceholder')}
              className="min-h-[400px] font-mono text-sm"
              disabled={loading}
            />

            {createdNoteId && (
              <div className="flex items-center justify-between p-4 bg-green-50 dark:bg-green-950 rounded-lg border border-green-200 dark:border-green-800">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400" />
                  <div>
                    <p className="font-medium text-green-900 dark:text-green-100">
                      {t('ocr.noteCreatedSuccess')}
                    </p>
                    <p className="text-sm text-green-700 dark:text-green-300">
                      {t('ocr.xpGained')}
                    </p>
                  </div>
                </div>
                <Button onClick={goToNote} variant="outline" size="sm">
                  {t('ocr.viewNote')}
                </Button>
              </div>
            )}

            {extractedText && !createdNoteId && createNote && selectedSubject && (
              <Button
                onClick={() => {
                  // Create note manually from extracted text
                  api.post('/notes/', {
                    title: noteTitle || 'Note OCR',
                    content: extractedText,
                    subject_id: parseInt(selectedSubject),
                    tags: ['ocr']
                  }).then(res => {
                    setCreatedNoteId(res.data.id)
                    toast({
                      title: t('ocr.noteCreated'),
                      description: t('ocr.noteCreatedFromText')
                    })
                  })
                }}
                className="w-full"
              >
                <FileText className="h-4 w-4 mr-2" />
                {t('ocr.createNoteNow')}
              </Button>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Info Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t('ocr.supportedFormats')}</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">
              PDF • JPG • PNG • BMP • TIFF • GIF • WebP
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t('ocr.supportedLanguages')}</CardTitle>
            <Sparkles className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">
              🇫🇷 🇬🇧 🇪🇸 🇵🇹 🇸🇦 🇩🇪 🇮🇹 🇨🇳 🇯🇵 🇰🇷
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              10 langues + combinaisons
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Détection intelligente</CardTitle>
            <Table2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">
              Tables • Colonnes • Layout automatique
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Correction IA</CardTitle>
            <Wand2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">
              Claude corrige les erreurs OCR automatiquement
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
