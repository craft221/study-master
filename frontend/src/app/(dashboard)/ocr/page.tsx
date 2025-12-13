'use client'

import { useState, useCallback, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Upload, FileText, Image as ImageIcon, Loader2, CheckCircle2,
  AlertCircle, FileUp, Sparkles, Eye
} from 'lucide-react'
import api from '@/lib/api'
import { useToast } from '@/hooks/use-toast'
import { useRouter } from 'next/navigation'
import { useTranslation } from '@/contexts/LanguageContext'

interface Subject {
  id: number
  name: string
}

interface OCRResult {
  text: string
  confidence: number
  page_count?: number
  note_id?: number
}

export default function OCRPage() {
  const { toast } = useToast()
  const router = useRouter()
  const { t } = useTranslation()
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

  useEffect(() => {
    fetchSubjects()
  }, [])

  const fetchSubjects = async () => {
    try {
      const response = await api.get('/subjects/')
      setSubjects(response.data.subjects || [])
    } catch (error) {
      console.error('Error fetching subjects:', error)
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

  const handleFile = async (file: File) => {
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

    try {
      setLoading(true)
      setExtractedText('')
      setConfidence(0)
      setCreatedNoteId(null)

      const formData = new FormData()
      formData.append('file', file)
      formData.append('language', language)

      if (createNote && selectedSubject) {
        formData.append('subject_id', selectedSubject)
        formData.append('create_note', 'true')
        if (noteTitle) {
          formData.append('note_title', noteTitle)
        }
      }

      const endpoint = isPDF ? '/ocr/upload-pdf' : '/ocr/upload-image'
      const response = await api.post<OCRResult>(endpoint, formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      })

      setExtractedText(response.data.text)
      setConfidence(response.data.confidence)

      if (response.data.note_id) {
        setCreatedNoteId(response.data.note_id)
        toast({
          title: t('ocr.success'),
          description: t('ocr.textExtractedWithConfidence', { percent: Math.round(response.data.confidence * 100) }),
        })
      } else {
        toast({
          title: t('ocr.extractionSuccess'),
          description: t('ocr.textExtractedConfidence', { percent: Math.round(response.data.confidence * 100) }),
        })
      }
    } catch (error: any) {
      console.error('OCR error:', error)
      toast({
        title: t('ocr.extractionError'),
        description: error.response?.data?.detail || t('ocr.cannotExtractText'),
        variant: 'destructive'
      })
    } finally {
      setLoading(false)
    }
  }

  const goToNote = () => {
    if (createdNoteId) {
      router.push(`/notes/${createdNoteId}`)
    }
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <Sparkles className="h-8 w-8 text-purple-500" />
          {t('ocr.title')}
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
                disabled={loading}
              />
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
            </div>

            {/* Language Selection */}
            <div className="space-y-2">
              <Label>{t('ocr.documentLanguage')}</Label>
              <Select value={language} onValueChange={setLanguage} disabled={loading}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="fra">{t('ocr.french')}</SelectItem>
                  <SelectItem value="eng">{t('ocr.english')}</SelectItem>
                  <SelectItem value="fra+eng">{t('ocr.frenchEnglish')}</SelectItem>
                </SelectContent>
              </Select>
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
              <CardDescription className="flex items-center gap-2">
                <span>{t('ocr.confidence')}: {Math.round(confidence * 100)}%</span>
                {confidence > 0.8 ? (
                  <CheckCircle2 className="h-4 w-4 text-green-500" />
                ) : confidence > 0.5 ? (
                  <AlertCircle className="h-4 w-4 text-yellow-500" />
                ) : (
                  <AlertCircle className="h-4 w-4 text-red-500" />
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
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t('ocr.supportedFormats')}</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">
              PDF • JPG • PNG • BMP • TIFF • GIF
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t('ocr.maxSize')}</CardTitle>
            <ImageIcon className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground">
              {t('ocr.pdfMaxSize')} • {t('ocr.imageMaxSize')}
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
              {t('ocr.french')} • {t('ocr.english')} • {t('ocr.multiLanguage')}
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
