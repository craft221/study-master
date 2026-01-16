'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  GraduationCap, Plus, Calendar, Clock, Target, Trophy, Flame,
  ChevronRight, ChevronLeft, Loader2, Play, Pause, CheckCircle,
  AlertTriangle, BarChart3, Brain, BookOpen, Sparkles, Lock,
  Bell, BellOff, Settings, Trash2, ArrowRight, X, Check, CloudOff, RefreshCw
} from 'lucide-react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Checkbox } from '@/components/ui/checkbox'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useToast } from '@/hooks/use-toast'
import { useTranslation } from '@/contexts/LanguageContext'
import examModeService, {
  ExamSession,
  ExamSessionDetail,
  StudyDay,
  StudyTask,
  DayProgress,
  ExamModeStats,
  PremiumStatus,
  ExamSessionCreate,
  DifficultyLevel,
  StudyTaskType,
  StudyTaskStatus,
  KeyPointsAnalysis,
  WeakPointsAnalysis,
  PersonalizedAdvice,
  AISummary
} from '@/services/examMode'
import { cn } from '@/lib/utils'
import api from '@/lib/api'
import subjectsService from '@/services/subjects'
import notesService from '@/services/notes'
import { useOfflineContext } from '@/components/providers/OfflineProvider'
import { offlineStorage, STORES } from '@/lib/offlineStorage'
import { syncService } from '@/services/syncService'

interface Subject {
  id: number
  name: string
  color: string
}

interface Note {
  id: number
  title: string
  subject_id: number | null
  subject_name?: string
}

interface Document {
  id: number
  title: string
  original_filename: string
  file_type: string
  file_size: number
  file_size_formatted: string
  subject_id: number
}

// Wizard Steps
const WIZARD_STEPS = ['info', 'content', 'schedule', 'preview'] as const
type WizardStep = typeof WIZARD_STEPS[number]

const DIFFICULTY_LABELS: Record<DifficultyLevel, { label: string; description: string; color: string }> = {
  easy: { label: 'Facile', description: 'Révision légère, bases solides', color: 'text-green-500' },
  medium: { label: 'Moyen', description: 'Équilibre lecture/exercices', color: 'text-yellow-500' },
  hard: { label: 'Difficile', description: 'Préparation intensive', color: 'text-red-500' }
}

const STUDY_TIMES = [
  { value: 'morning', label: 'Matin (6h-12h)' },
  { value: 'afternoon', label: 'Après-midi (12h-18h)' },
  { value: 'evening', label: 'Soir (18h-22h)' },
  { value: 'night', label: 'Nuit (22h-6h)' }
]

export default function ExamModePage() {
  const router = useRouter()
  const { toast } = useToast()
  const { t } = useTranslation()
  const { isOnline } = useOfflineContext()

  // Data states
  const [loading, setLoading] = useState(true)
  const [isFromCache, setIsFromCache] = useState(false)
  const [sessions, setSessions] = useState<ExamSession[]>([])
  const [activeSession, setActiveSession] = useState<ExamSessionDetail | null>(null)
  const [todayProgress, setTodayProgress] = useState<DayProgress | null>(null)
  const [stats, setStats] = useState<ExamModeStats | null>(null)
  const [premiumStatus, setPremiumStatus] = useState<PremiumStatus | null>(null)
  const [subjects, setSubjects] = useState<Subject[]>([])
  const [notes, setNotes] = useState<Note[]>([])
  const [documents, setDocuments] = useState<Document[]>([])

  // Wizard states
  const [wizardOpen, setWizardOpen] = useState(false)
  const [wizardStep, setWizardStep] = useState<WizardStep>('info')
  const [creating, setCreating] = useState(false)
  const [formData, setFormData] = useState<ExamSessionCreate & { document_ids: number[] }>({
    exam_name: '',
    exam_description: '',
    exam_date: '',
    exam_time: '',
    subject_id: undefined,
    note_ids: [],
    document_ids: [],
    study_hours_per_day: 2,
    preferred_study_times: ['morning', 'afternoon'],
    include_weekends: true,
    difficulty_level: 'medium',
    notifications_enabled: true,
    reminder_time: '09:00'
  })

  // Task action states
  const [actionLoading, setActionLoading] = useState<number | null>(null)

  // Tab state
  const [activeTab, setActiveTab] = useState<'dashboard' | 'sessions' | 'stats' | 'ai'>('dashboard')

  // AI states
  const [aiLoading, setAiLoading] = useState<string | null>(null)
  const [aiSummary, setAiSummary] = useState<AISummary | null>(null)
  const [keyPoints, setKeyPoints] = useState<KeyPointsAnalysis | null>(null)
  const [weakPoints, setWeakPoints] = useState<WeakPointsAnalysis | null>(null)
  const [advice, setAdvice] = useState<PersonalizedAdvice | null>(null)

  // Load initial data
  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    setLoading(true)
    setIsFromCache(false)

    try {
      if (isOnline) {
        // Mode en ligne: charger depuis l'API et mettre en cache
        const [sessionsRes, premiumRes, subjectsRes, notesRes, docsRes] = await Promise.all([
          examModeService.getSessions(),
          examModeService.getPremiumStatus(),
          subjectsService.getSubjects(),
          notesService.getNotes(),
          api.get('/documents/')
        ])

        setSessions(sessionsRes.sessions)
        setPremiumStatus(premiumRes)
        setSubjects(subjectsRes)
        setNotes(notesRes)
        setDocuments(docsRes.data.documents || [])

        // Sauvegarder en cache
        await offlineStorage.saveExamSessions(sessionsRes.sessions)
        await offlineStorage.saveSubjects(subjectsRes)
        await offlineStorage.saveNotes(notesRes)

        // Load active session details if exists
        const active = sessionsRes.sessions.find(s => s.status === 'active')
        if (active) {
          const details = await examModeService.getSession(active.id)
          setActiveSession(details)
          // Sauvegarder les détails de la session active
          await offlineStorage.saveExamSession(details)
          // Sauvegarder les tâches
          if (details.today_tasks) {
            await offlineStorage.saveExamTasks(details.today_tasks)
          }
          if (details.study_days) {
            const allTasks = details.study_days.flatMap((day: any) => day.tasks || [])
            if (allTasks.length > 0) {
              await offlineStorage.saveExamTasks(allTasks)
            }
          }

          try {
            const progress = await examModeService.getTodayProgress()
            setTodayProgress(progress)
          } catch {}
        }

        // Load stats
        try {
          const statsRes = await examModeService.getStats()
          setStats(statsRes)
        } catch {}
      } else {
        // Mode hors-ligne: charger depuis le cache
        setIsFromCache(true)

        const [cachedSessions, cachedSubjects, cachedNotes] = await Promise.all([
          offlineStorage.getExamSessions(),
          offlineStorage.getSubjects(),
          offlineStorage.getNotes()
        ])

        setSessions(cachedSessions || [])
        setSubjects(cachedSubjects || [])
        setNotes(cachedNotes || [])

        // Charger la session active depuis le cache
        const active = cachedSessions?.find((s: any) => s.status === 'active')
        if (active) {
          // Essayer de récupérer les détails complets
          const cachedDetails = await offlineStorage.getExamSession(active.id)
          if (cachedDetails) {
            setActiveSession(cachedDetails)
          } else {
            setActiveSession(active)
          }
        }
      }
    } catch (error) {
      console.error('Error loading exam mode data:', error)
      // Fallback au cache en cas d'erreur
      try {
        const cachedSessions = await offlineStorage.getExamSessions()
        if (cachedSessions && cachedSessions.length > 0) {
          setIsFromCache(true)
          setSessions(cachedSessions)
          const active = cachedSessions.find((s: any) => s.status === 'active')
          if (active) {
            setActiveSession(active)
          }
        }
      } catch {}
    } finally {
      setLoading(false)
    }
  }

  const handleCreateSession = async () => {
    const hasContent = formData.note_ids.length > 0 || formData.document_ids.length > 0
    if (!formData.exam_name || !formData.exam_date || !hasContent) {
      toast({
        title: t('exam_mode.validation_error') || 'Erreur',
        description: t('exam_mode.fill_required_fields') || 'Veuillez remplir tous les champs et sélectionner du contenu',
        variant: 'destructive'
      })
      return
    }

    setCreating(true)
    try {
      const newSession = await examModeService.createSession(formData)
      setSessions(prev => [newSession, ...prev])
      setActiveSession(newSession)
      setWizardOpen(false)
      resetWizard()

      toast({
        title: t('exam_mode.created_success') || 'Session créée !',
        description: t('exam_mode.plan_generated') || 'Votre plan de révision a été généré.'
      })

      // Start the session automatically
      await examModeService.startSession(newSession.id)
      fetchData()
    } catch (error: any) {
      toast({
        title: t('common.error') || 'Erreur',
        description: error.response?.data?.detail || t('exam_mode.create_error'),
        variant: 'destructive'
      })
    } finally {
      setCreating(false)
    }
  }

  const resetWizard = () => {
    setWizardStep('info')
    setFormData({
      exam_name: '',
      exam_description: '',
      exam_date: '',
      exam_time: '',
      subject_id: undefined,
      note_ids: [],
      document_ids: [],
      study_hours_per_day: 2,
      preferred_study_times: ['morning', 'afternoon'],
      include_weekends: true,
      difficulty_level: 'medium',
      notifications_enabled: true,
      reminder_time: '09:00'
    })
  }

  const handleStartTask = async (taskId: number) => {
    setActionLoading(taskId)
    try {
      if (isOnline) {
        await examModeService.startTask(taskId)
        toast({ title: t('exam_mode.task_started') || 'Tâche démarrée !' })
      } else {
        // Mode offline: mise à jour optimiste locale
        if (activeSession) {
          const updatedTasks = activeSession.today_tasks.map(task =>
            task.id === taskId ? { ...task, status: 'in_progress' as StudyTaskStatus } : task
          )
          setActiveSession({ ...activeSession, today_tasks: updatedTasks })

          // Sauvegarder dans IndexedDB
          const task = activeSession.today_tasks.find(t => t.id === taskId)
          if (task) {
            await offlineStorage.saveExamTask({ ...task, status: 'in_progress' })
          }

          // Queue pour sync
          await syncService.queueAction(
            STORES.EXAM_TASKS,
            'update',
            `/api/v1/exam-mode/tasks/${taskId}/start`,
            'POST',
            { task_id: taskId }
          )
        }
        toast({ title: t('exam_mode.task_started') || 'Tâche démarrée (sera synchronisée)' })
      }
      if (isOnline) fetchData()
    } catch (error) {
      toast({ title: t('common.error'), variant: 'destructive' })
    } finally {
      setActionLoading(null)
    }
  }

  const handleCompleteTask = async (taskId: number, score?: number) => {
    setActionLoading(taskId)
    try {
      if (isOnline) {
        await examModeService.completeTask(taskId, score)
        toast({ title: t('exam_mode.task_completed') || 'Tâche terminée !', description: '+10 XP' })
      } else {
        // Mode offline: mise à jour optimiste locale
        if (activeSession) {
          const updatedTasks = activeSession.today_tasks.map(task =>
            task.id === taskId ? { ...task, status: 'completed' as StudyTaskStatus, score } : task
          )
          setActiveSession({
            ...activeSession,
            today_tasks: updatedTasks,
            tasks_completed: activeSession.tasks_completed + 1
          })

          // Sauvegarder dans IndexedDB
          const task = activeSession.today_tasks.find(t => t.id === taskId)
          if (task) {
            await offlineStorage.saveExamTask({ ...task, status: 'completed', score })
          }

          // Queue pour sync
          await syncService.queueAction(
            STORES.EXAM_TASKS,
            'update',
            `/api/v1/exam-mode/tasks/${taskId}/complete`,
            'POST',
            { task_id: taskId, score }
          )
        }
        toast({ title: t('exam_mode.task_completed') || 'Tâche terminée (sera synchronisée)' })
      }
      if (isOnline) fetchData()
    } catch (error) {
      toast({ title: t('common.error'), variant: 'destructive' })
    } finally {
      setActionLoading(null)
    }
  }

  const handleSkipTask = async (taskId: number) => {
    setActionLoading(taskId)
    try {
      if (isOnline) {
        await examModeService.skipTask(taskId)
        toast({ title: t('exam_mode.task_skipped') || 'Tâche passée' })
      } else {
        // Mode offline: mise à jour optimiste locale
        if (activeSession) {
          const updatedTasks = activeSession.today_tasks.map(task =>
            task.id === taskId ? { ...task, status: 'skipped' as StudyTaskStatus } : task
          )
          setActiveSession({ ...activeSession, today_tasks: updatedTasks })

          // Sauvegarder dans IndexedDB
          const task = activeSession.today_tasks.find(t => t.id === taskId)
          if (task) {
            await offlineStorage.saveExamTask({ ...task, status: 'skipped' })
          }

          // Queue pour sync
          await syncService.queueAction(
            STORES.EXAM_TASKS,
            'update',
            `/api/v1/exam-mode/tasks/${taskId}/skip`,
            'POST',
            { task_id: taskId }
          )
        }
        toast({ title: t('exam_mode.task_skipped') || 'Tâche passée (sera synchronisée)' })
      }
      if (isOnline) fetchData()
    } catch (error) {
      toast({ title: t('common.error'), variant: 'destructive' })
    } finally {
      setActionLoading(null)
    }
  }

  const handleDeleteSession = async (sessionId: number) => {
    try {
      await examModeService.deleteSession(sessionId)
      setSessions(prev => prev.filter(s => s.id !== sessionId))
      if (activeSession?.id === sessionId) {
        setActiveSession(null)
        setTodayProgress(null)
      }
      toast({ title: t('exam_mode.session_deleted') || 'Session supprimée' })
    } catch (error) {
      toast({ title: t('common.error'), variant: 'destructive' })
    }
  }

  // AI Functions - BETA: Accessible à tous
  const loadAISummary = async () => {
    if (!activeSession) return
    setAiLoading('summary')
    try {
      const data = await examModeService.getAISummary(activeSession.id)
      setAiSummary(data)
    } catch (error: any) {
      toast({
        title: t('common.error'),
        description: error.response?.data?.detail?.message || 'Erreur lors du chargement',
        variant: 'destructive'
      })
    } finally {
      setAiLoading(null)
    }
  }

  const loadKeyPoints = async () => {
    if (!activeSession) return
    setAiLoading('keypoints')
    try {
      const data = await examModeService.getKeyPointsAnalysis(activeSession.id)
      setKeyPoints(data)
    } catch (error: any) {
      toast({
        title: t('common.error'),
        description: error.response?.data?.detail?.message || 'Erreur lors du chargement',
        variant: 'destructive'
      })
    } finally {
      setAiLoading(null)
    }
  }

  const loadWeakPoints = async () => {
    if (!activeSession) return
    setAiLoading('weakpoints')
    try {
      const data = await examModeService.getWeakPointsAnalysis(activeSession.id)
      setWeakPoints(data)
    } catch (error: any) {
      toast({
        title: t('common.error'),
        description: error.response?.data?.detail?.message || 'Erreur lors du chargement',
        variant: 'destructive'
      })
    } finally {
      setAiLoading(null)
    }
  }

  const loadAdvice = async () => {
    if (!activeSession) return
    setAiLoading('advice')
    try {
      const data = await examModeService.getPersonalizedAdvice(activeSession.id)
      setAdvice(data)
    } catch (error: any) {
      toast({
        title: t('common.error'),
        description: error.response?.data?.detail?.message || 'Erreur lors du chargement',
        variant: 'destructive'
      })
    } finally {
      setAiLoading(null)
    }
  }

  const handleGenerateTaskContent = async (taskId: number) => {
    // BETA: Vérification premium désactivée
    setActionLoading(taskId)
    try {
      const result = await examModeService.generateTaskContent(taskId)
      toast({
        title: result.generated ? t('exam_mode.content_generated') || 'Contenu généré !' : t('exam_mode.content_linked') || 'Contenu lié',
        description: result.message
      })
      fetchData()
    } catch (error: any) {
      toast({
        title: t('common.error'),
        description: error.response?.data?.detail?.message || 'Erreur',
        variant: 'destructive'
      })
    } finally {
      setActionLoading(null)
    }
  }

  const handleGeneratePracticeExam = async () => {
    if (!activeSession) return
    setAiLoading('practice')
    try {
      const result = await examModeService.generatePracticeExam(activeSession.id, 60)
      toast({
        title: t('exam_mode.practice_exam_generated') || 'Examen blanc généré !',
        description: `${result.question_count} questions - ${result.duration_minutes} minutes`
      })
    } catch (error: any) {
      toast({
        title: t('common.error'),
        description: error.response?.data?.detail || 'Erreur',
        variant: 'destructive'
      })
    } finally {
      setAiLoading(null)
    }
  }

  const handleAdaptPlan = async () => {
    if (!activeSession) return
    setAiLoading('adapt')
    try {
      const result = await examModeService.adaptStudyPlan(activeSession.id)
      if (result.status === 'adapted') {
        toast({
          title: t('exam_mode.plan_adapted') || 'Plan adapté !',
          description: `${result.adaptations.length} adaptation(s) appliquée(s)`
        })
        fetchData()
      } else {
        toast({
          title: t('exam_mode.no_adaptation') || 'Pas de modification nécessaire',
          description: t('exam_mode.plan_optimal') || 'Votre plan est déjà optimal'
        })
      }
    } catch (error: any) {
      toast({
        title: t('common.error'),
        description: error.response?.data?.detail || 'Erreur',
        variant: 'destructive'
      })
    } finally {
      setAiLoading(null)
    }
  }

  const getTaskIcon = (type: StudyTaskType) => {
    const icons: Record<StudyTaskType, JSX.Element> = {
      read: <BookOpen className="w-4 h-4" />,
      flashcards: <Brain className="w-4 h-4" />,
      quiz: <Target className="w-4 h-4" />,
      review: <ChevronRight className="w-4 h-4" />,
      practice_exam: <GraduationCap className="w-4 h-4" />,
      summary: <BookOpen className="w-4 h-4" />,
      weak_points: <AlertTriangle className="w-4 h-4" />
    }
    return icons[type] || <BookOpen className="w-4 h-4" />
  }

  const filteredNotes = formData.subject_id
    ? notes.filter(n => Number(n.subject_id) === Number(formData.subject_id))
    : notes

  const filteredDocuments = formData.subject_id
    ? documents.filter(d => Number(d.subject_id) === Number(formData.subject_id))
    : documents

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    )
  }

  return (
    <div className="space-y-6 p-6">
      {/* Offline Banner */}
      {!isOnline && (
        <div className="bg-orange-50 dark:bg-orange-900/30 border border-orange-200 dark:border-orange-800 rounded-lg p-4">
          <div className="flex items-center gap-3">
            <CloudOff className="h-5 w-5 text-orange-600 dark:text-orange-400" />
            <div>
              <p className="font-medium text-orange-900 dark:text-orange-100">
                Mode hors-ligne
              </p>
              <p className="text-sm text-orange-700 dark:text-orange-300">
                Vous pouvez voir vos sessions et marquer vos tâches. Les actions seront synchronisées au retour de la connexion.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-bold flex items-center gap-3">
              <GraduationCap className="w-8 h-8 text-primary" />
              {t('exam_mode.title') || 'Exam Mode'}
            </h1>
            {isFromCache && (
              <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">
                <CloudOff className="w-3 h-3 mr-1" />
                Cache
              </span>
            )}
            {!isOnline && (
              <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400">
                <CloudOff className="w-3 h-3 mr-1" />
                Hors-ligne
              </span>
            )}
          </div>
          <p className="text-muted-foreground mt-1">
            {t('exam_mode.subtitle') || 'Préparation intelligente aux examens'}
            {isFromCache && ' (depuis le cache)'}
          </p>
        </div>

        <div className="flex gap-2">
          {!isOnline ? (
            <Button variant="outline" disabled className="gap-2">
              <CloudOff className="w-4 h-4" />
              Créer (hors-ligne)
            </Button>
          ) : premiumStatus && !premiumStatus.can_create_exam ? (
            <Button variant="outline" disabled className="gap-2">
              <Lock className="w-4 h-4" />
              {t('exam_mode.limit_reached') || 'Limite atteinte'}
            </Button>
          ) : (
            <Button onClick={() => setWizardOpen(true)} className="gap-2">
              <Plus className="w-4 h-4" />
              {t('exam_mode.new_exam') || 'Nouvel examen'}
            </Button>
          )}
        </div>
      </div>

      {/* BETA: Bannière premium masquée - tous les utilisateurs ont accès aux fonctionnalités */}

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)}>
        <TabsList>
          <TabsTrigger value="dashboard" className="gap-2">
            <Target className="w-4 h-4" />
            {t('exam_mode.dashboard') || 'Dashboard'}
          </TabsTrigger>
          <TabsTrigger value="sessions" className="gap-2">
            <Calendar className="w-4 h-4" />
            {t('exam_mode.my_exams') || 'Mes examens'}
          </TabsTrigger>
          <TabsTrigger value="stats" className="gap-2">
            <BarChart3 className="w-4 h-4" />
            {t('exam_mode.statistics') || 'Statistiques'}
          </TabsTrigger>
          <TabsTrigger value="ai" className="gap-2">
            <Sparkles className="w-4 h-4" />
            {t('exam_mode.ai_insights') || 'IA Insights'}
            {/* BETA: Cadenas masqué - tous ont accès */}
          </TabsTrigger>
        </TabsList>

        {/* Dashboard Tab */}
        <TabsContent value="dashboard" className="space-y-6 mt-6">
          {activeSession ? (
            <>
              {/* Active session card */}
              <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-transparent">
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle className="flex items-center gap-2">
                        <GraduationCap className="w-5 h-5" />
                        {activeSession.exam_name}
                      </CardTitle>
                      <CardDescription className="mt-1">
                        {activeSession.exam_description}
                      </CardDescription>
                    </div>
                    <div className="flex items-center gap-2">
                      {activeSession.days_until_exam <= 3 && (
                        <Badge variant="destructive" className="animate-pulse">
                          J-{activeSession.days_until_exam}
                        </Badge>
                      )}
                      <Badge variant="outline">
                        {new Date(activeSession.exam_date).toLocaleDateString('fr-FR', {
                          weekday: 'short',
                          day: 'numeric',
                          month: 'short'
                        })}
                      </Badge>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Progress bar */}
                  <div>
                    <div className="flex justify-between text-sm mb-2">
                      <span>{t('exam_mode.progress') || 'Progression'}</span>
                      <span className="font-medium">{Math.round(activeSession.progress_percentage)}%</span>
                    </div>
                    <Progress value={activeSession.progress_percentage} className="h-3" />
                  </div>

                  {/* Stats grid */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="text-center p-3 bg-muted/50 rounded-lg">
                      <div className="text-2xl font-bold text-primary">{activeSession.days_until_exam}</div>
                      <div className="text-xs text-muted-foreground">{t('exam_mode.days_left') || 'Jours restants'}</div>
                    </div>
                    <div className="text-center p-3 bg-muted/50 rounded-lg">
                      <div className="text-2xl font-bold text-green-500">{activeSession.tasks_completed}</div>
                      <div className="text-xs text-muted-foreground">{t('exam_mode.tasks_done') || 'Tâches faites'}</div>
                    </div>
                    <div className="text-center p-3 bg-muted/50 rounded-lg">
                      <div className="text-2xl font-bold text-blue-500">
                        {Math.round(activeSession.predicted_score || 0)}%
                      </div>
                      <div className="text-xs text-muted-foreground">{t('exam_mode.prediction') || 'Prédiction'}</div>
                    </div>
                    <div className="text-center p-3 bg-muted/50 rounded-lg">
                      <div className="text-2xl font-bold text-orange-500">
                        {examModeService.formatDuration(activeSession.total_study_minutes)}
                      </div>
                      <div className="text-xs text-muted-foreground">{t('exam_mode.study_time') || 'Temps étudié'}</div>
                    </div>
                  </div>

                  {/* Motivation message */}
                  {todayProgress && (
                    <div className={cn(
                      "p-4 rounded-lg border",
                      todayProgress.is_on_track ? "bg-green-500/10 border-green-500/20" : "bg-yellow-500/10 border-yellow-500/20"
                    )}>
                      <p className="text-sm font-medium">{todayProgress.motivation_message}</p>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Today's tasks */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Clock className="w-5 h-5" />
                    {t('exam_mode.today_tasks') || "Tâches d'aujourd'hui"}
                  </CardTitle>
                  {todayProgress && (
                    <CardDescription>
                      {todayProgress.tasks_remaining} {t('exam_mode.remaining') || 'restantes'} -
                      {' '}{examModeService.formatDuration(todayProgress.estimated_time_remaining)} {t('exam_mode.estimated') || 'estimé'}
                    </CardDescription>
                  )}
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {activeSession.today_tasks.length > 0 ? (
                      activeSession.today_tasks.map((task) => (
                        <div
                          key={task.id}
                          className={cn(
                            "flex items-center justify-between p-4 rounded-lg border",
                            task.status === 'completed' && "bg-green-500/5 border-green-500/20",
                            task.status === 'in_progress' && "bg-blue-500/5 border-blue-500/20",
                            task.status === 'skipped' && "bg-gray-500/5 border-gray-500/20"
                          )}
                        >
                          <div className="flex items-center gap-3">
                            <div className={cn(
                              "p-2 rounded-full",
                              task.status === 'completed' ? "bg-green-500/20 text-green-500" :
                              task.status === 'in_progress' ? "bg-blue-500/20 text-blue-500" :
                              "bg-muted text-muted-foreground"
                            )}>
                              {getTaskIcon(task.task_type)}
                            </div>
                            <div>
                              <p className="font-medium">{task.title}</p>
                              <p className="text-sm text-muted-foreground">
                                {examModeService.getTaskTypeLabel(task.task_type)} - {task.estimated_minutes}min
                              </p>
                            </div>
                          </div>

                          <div className="flex items-center gap-2">
                            {task.status === 'pending' && (
                              <>
                                <Button
                                  size="sm"
                                  onClick={() => handleStartTask(task.id)}
                                  disabled={actionLoading === task.id}
                                >
                                  {actionLoading === task.id ? (
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                  ) : (
                                    <Play className="w-4 h-4" />
                                  )}
                                </Button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => handleSkipTask(task.id)}
                                  disabled={actionLoading === task.id}
                                >
                                  <X className="w-4 h-4" />
                                </Button>
                              </>
                            )}
                            {task.status === 'in_progress' && (
                              <Button
                                size="sm"
                                variant="default"
                                onClick={() => handleCompleteTask(task.id)}
                                disabled={actionLoading === task.id}
                              >
                                {actionLoading === task.id ? (
                                  <Loader2 className="w-4 h-4 animate-spin" />
                                ) : (
                                  <Check className="w-4 h-4 mr-1" />
                                )}
                                {t('exam_mode.finish') || 'Terminer'}
                              </Button>
                            )}
                            {task.status === 'completed' && (
                              <CheckCircle className="w-5 h-5 text-green-500" />
                            )}
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="text-center py-8 text-muted-foreground">
                        <CheckCircle className="w-12 h-12 mx-auto mb-2 text-green-500" />
                        <p>{t('exam_mode.all_done_today') || 'Toutes les tâches du jour sont terminées !'}</p>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* Calendar view of study days */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Calendar className="w-5 h-5" />
                    {t('exam_mode.study_plan') || 'Plan de révision'}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-7 gap-2">
                    {activeSession.study_days.slice(0, 14).map((day) => (
                      <div
                        key={day.id}
                        className={cn(
                          "p-2 rounded-lg text-center border transition-colors",
                          day.is_today && "ring-2 ring-primary",
                          day.is_completed && "bg-green-500/10 border-green-500/20",
                          day.is_past && !day.is_completed && "bg-red-500/10 border-red-500/20",
                          day.is_rest_day && "bg-muted/50"
                        )}
                      >
                        <div className="text-xs text-muted-foreground">
                          {new Date(day.study_date).toLocaleDateString('fr-FR', { weekday: 'short' })}
                        </div>
                        <div className="font-bold">
                          {new Date(day.study_date).getDate()}
                        </div>
                        {!day.is_rest_day && (
                          <div className="text-xs mt-1">
                            {day.is_completed ? (
                              <CheckCircle className="w-3 h-3 mx-auto text-green-500" />
                            ) : (
                              <span className="text-muted-foreground">{day.tasks_total}t</span>
                            )}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </>
          ) : (
            /* No active session */
            <Card className="border-dashed">
              <CardContent className="flex flex-col items-center justify-center py-12">
                <GraduationCap className="w-16 h-16 text-muted-foreground mb-4" />
                <h3 className="text-xl font-semibold mb-2">
                  {t('exam_mode.no_active_session') || 'Aucun examen en cours'}
                </h3>
                <p className="text-muted-foreground text-center max-w-md mb-6">
                  {t('exam_mode.start_description') || 'Créez une session de révision pour un examen à venir et laissez-nous générer un plan personnalisé.'}
                </p>
                <Button onClick={() => setWizardOpen(true)} size="lg" className="gap-2">
                  <Plus className="w-5 h-5" />
                  {t('exam_mode.create_first') || 'Créer ma première session'}
                </Button>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Sessions Tab */}
        <TabsContent value="sessions" className="space-y-4 mt-6">
          {sessions.length > 0 ? (
            sessions.map((session) => (
              <Card key={session.id} className={cn(
                session.status === 'active' && "border-primary/50"
              )}>
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle className="flex items-center gap-2">
                        {session.exam_name}
                        {session.status === 'active' && (
                          <Badge variant="default">{t('exam_mode.active') || 'Actif'}</Badge>
                        )}
                        {session.status === 'completed' && (
                          <Badge variant="secondary">{t('exam_mode.completed') || 'Terminé'}</Badge>
                        )}
                        {session.status === 'paused' && (
                          <Badge variant="outline">{t('exam_mode.paused') || 'En pause'}</Badge>
                        )}
                      </CardTitle>
                      <CardDescription>
                        {new Date(session.exam_date).toLocaleDateString('fr-FR', {
                          weekday: 'long',
                          day: 'numeric',
                          month: 'long',
                          year: 'numeric'
                        })}
                        {session.subject_name && ` - ${session.subject_name}`}
                      </CardDescription>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleDeleteSession(session.id)}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-4">
                    <div className="flex-1">
                      <Progress value={session.progress_percentage} className="h-2" />
                    </div>
                    <span className="text-sm font-medium">{Math.round(session.progress_percentage)}%</span>
                  </div>
                  <div className="flex items-center gap-4 mt-3 text-sm text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <CheckCircle className="w-4 h-4" />
                      {session.tasks_completed}/{session.tasks_total} tâches
                    </span>
                    <span className="flex items-center gap-1">
                      <Clock className="w-4 h-4" />
                      {examModeService.formatDuration(session.total_study_minutes)}
                    </span>
                    {session.predicted_score && (
                      <span className="flex items-center gap-1">
                        <Target className="w-4 h-4" />
                        {Math.round(session.predicted_score)}% prédit
                      </span>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))
          ) : (
            <div className="text-center py-12 text-muted-foreground">
              <Calendar className="w-12 h-12 mx-auto mb-2" />
              <p>{t('exam_mode.no_sessions') || 'Aucune session de révision'}</p>
            </div>
          )}
        </TabsContent>

        {/* Stats Tab */}
        <TabsContent value="stats" className="mt-6">
          {stats ? (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <Card>
                <CardContent className="p-6 text-center">
                  <div className="text-3xl font-bold text-primary">{stats.total_exams_prepared}</div>
                  <p className="text-sm text-muted-foreground">{t('exam_mode.exams_prepared') || 'Examens préparés'}</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-6 text-center">
                  <div className="text-3xl font-bold text-green-500">{stats.total_exams_completed}</div>
                  <p className="text-sm text-muted-foreground">{t('exam_mode.exams_completed') || 'Examens terminés'}</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-6 text-center">
                  <div className="text-3xl font-bold text-blue-500">{stats.total_study_hours.toFixed(1)}h</div>
                  <p className="text-sm text-muted-foreground">{t('exam_mode.hours_studied') || 'Heures étudiées'}</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-6 text-center">
                  <div className="text-3xl font-bold text-orange-500">{stats.xp_earned_from_exam_mode}</div>
                  <p className="text-sm text-muted-foreground">{t('exam_mode.xp_earned') || 'XP gagnés'}</p>
                </CardContent>
              </Card>
              {stats.best_score_achieved && (
                <Card>
                  <CardContent className="p-6 text-center">
                    <div className="text-3xl font-bold text-yellow-500">{stats.best_score_achieved}%</div>
                    <p className="text-sm text-muted-foreground">{t('exam_mode.best_score') || 'Meilleur score'}</p>
                  </CardContent>
                </Card>
              )}
              <Card>
                <CardContent className="p-6 text-center">
                  <div className="text-3xl font-bold text-purple-500">{stats.longest_streak_days}</div>
                  <p className="text-sm text-muted-foreground">{t('exam_mode.longest_streak') || 'Plus longue série'}</p>
                </CardContent>
              </Card>
            </div>
          ) : (
            <div className="text-center py-12 text-muted-foreground">
              <BarChart3 className="w-12 h-12 mx-auto mb-2" />
              <p>{t('exam_mode.no_stats') || 'Pas encore de statistiques'}</p>
            </div>
          )}
        </TabsContent>

        {/* AI Insights Tab - BETA: Accessible à tous */}
        <TabsContent value="ai" className="mt-6 space-y-6">
          {!activeSession ? (
            /* No active session */
            <Card className="border-dashed">
              <CardContent className="flex flex-col items-center justify-center py-12">
                <GraduationCap className="w-16 h-16 text-muted-foreground mb-4" />
                <h3 className="text-xl font-semibold mb-2">
                  {t('exam_mode.no_active_for_ai') || 'Aucun examen actif'}
                </h3>
                <p className="text-muted-foreground text-center max-w-md">
                  {t('exam_mode.create_for_ai') || 'Créez une session de révision pour accéder aux analyses IA.'}
                </p>
              </CardContent>
            </Card>
          ) : (
            /* AI Features */
            <>
              {/* Quick Actions */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <Button
                  variant="outline"
                  className="h-auto py-4 flex-col gap-2"
                  onClick={loadAISummary}
                  disabled={aiLoading === 'summary'}
                >
                  {aiLoading === 'summary' ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <Sparkles className="w-5 h-5 text-purple-500" />
                  )}
                  <span className="text-sm">{t('exam_mode.ai_summary') || 'Résumé IA'}</span>
                </Button>

                <Button
                  variant="outline"
                  className="h-auto py-4 flex-col gap-2"
                  onClick={loadKeyPoints}
                  disabled={aiLoading === 'keypoints'}
                >
                  {aiLoading === 'keypoints' ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <Target className="w-5 h-5 text-blue-500" />
                  )}
                  <span className="text-sm">{t('exam_mode.key_points') || 'Points clés'}</span>
                </Button>

                <Button
                  variant="outline"
                  className="h-auto py-4 flex-col gap-2"
                  onClick={loadWeakPoints}
                  disabled={aiLoading === 'weakpoints'}
                >
                  {aiLoading === 'weakpoints' ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <AlertTriangle className="w-5 h-5 text-orange-500" />
                  )}
                  <span className="text-sm">{t('exam_mode.weak_points') || 'Points faibles'}</span>
                </Button>

                <Button
                  variant="outline"
                  className="h-auto py-4 flex-col gap-2"
                  onClick={loadAdvice}
                  disabled={aiLoading === 'advice'}
                >
                  {aiLoading === 'advice' ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <Brain className="w-5 h-5 text-green-500" />
                  )}
                  <span className="text-sm">{t('exam_mode.advice') || 'Conseils'}</span>
                </Button>
              </div>

              {/* AI Actions */}
              <div className="flex flex-wrap gap-3">
                <Button
                  variant="secondary"
                  onClick={handleGeneratePracticeExam}
                  disabled={aiLoading === 'practice'}
                  className="gap-2"
                >
                  {aiLoading === 'practice' ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <GraduationCap className="w-4 h-4" />
                  )}
                  {t('exam_mode.generate_practice_exam') || 'Générer un examen blanc'}
                </Button>

                <Button
                  variant="secondary"
                  onClick={handleAdaptPlan}
                  disabled={aiLoading === 'adapt'}
                  className="gap-2"
                >
                  {aiLoading === 'adapt' ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Settings className="w-4 h-4" />
                  )}
                  {t('exam_mode.adapt_plan') || 'Adapter le plan'}
                </Button>
              </div>

              {/* AI Summary */}
              {aiSummary && (
                <Card className="border-purple-500/20 bg-gradient-to-br from-purple-500/5 to-transparent">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Sparkles className="w-5 h-5 text-purple-500" />
                      {t('exam_mode.ai_summary') || 'Résumé IA'}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-3 gap-4">
                      <div className="text-center p-3 bg-muted/50 rounded-lg">
                        <div className="text-2xl font-bold text-blue-500">{aiSummary.prediction.predicted_score}%</div>
                        <div className="text-xs text-muted-foreground">{t('exam_mode.predicted_score') || 'Score prédit'}</div>
                      </div>
                      <div className="text-center p-3 bg-muted/50 rounded-lg">
                        <div className="text-2xl font-bold text-green-500">{aiSummary.progress_percentage}%</div>
                        <div className="text-xs text-muted-foreground">{t('exam_mode.progress') || 'Progression'}</div>
                      </div>
                      <div className="text-center p-3 bg-muted/50 rounded-lg">
                        <div className="text-2xl font-bold text-primary">{aiSummary.days_until_exam}</div>
                        <div className="text-xs text-muted-foreground">{t('exam_mode.days_left') || 'Jours restants'}</div>
                      </div>
                    </div>

                    <div className={cn(
                      "p-4 rounded-lg",
                      aiSummary.readiness_status === 'ready' ? "bg-green-500/10 border border-green-500/20" :
                      aiSummary.readiness_status === 'preparing' ? "bg-yellow-500/10 border border-yellow-500/20" :
                      "bg-blue-500/10 border border-blue-500/20"
                    )}>
                      <p className="text-sm font-medium">{aiSummary.motivation_message}</p>
                    </div>

                    {aiSummary.top_recommendations.length > 0 && (
                      <div>
                        <h4 className="font-medium mb-2">{t('exam_mode.top_recommendations') || 'Recommandations principales'}</h4>
                        <ul className="space-y-1">
                          {aiSummary.top_recommendations.map((rec, idx) => (
                            <li key={idx} className="text-sm text-muted-foreground flex items-start gap-2">
                              <ChevronRight className="w-4 h-4 mt-0.5 text-primary shrink-0" />
                              {rec}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}

              {/* Key Points */}
              {keyPoints && (
                <Card className="border-blue-500/20">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Target className="w-5 h-5 text-blue-500" />
                      {t('exam_mode.key_points_analysis') || 'Analyse des points clés'}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {/* Concepts clés */}
                    {keyPoints.concepts_cles?.length > 0 && (
                      <div>
                        <h4 className="font-medium mb-2">{t('exam_mode.key_concepts') || 'Concepts clés'}</h4>
                        <div className="space-y-2">
                          {keyPoints.concepts_cles.map((concept, idx) => (
                            <div key={idx} className="p-3 bg-muted/50 rounded-lg">
                              <div className="flex items-center justify-between mb-1">
                                <span className="font-medium">{concept.nom}</span>
                                <Badge variant="outline">Importance: {concept.importance}/10</Badge>
                              </div>
                              <p className="text-sm text-muted-foreground">{concept.definition}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Formules */}
                    {keyPoints.formules_memoriser?.length > 0 && (
                      <div>
                        <h4 className="font-medium mb-2">{t('exam_mode.formulas') || 'Formules à mémoriser'}</h4>
                        <div className="grid grid-cols-2 gap-2">
                          {keyPoints.formules_memoriser.map((formula, idx) => (
                            <div key={idx} className="p-3 bg-blue-500/5 border border-blue-500/20 rounded-lg">
                              <p className="font-medium text-sm">{formula.titre}</p>
                              <p className="font-mono text-sm mt-1">{formula.formule}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Priorités */}
                    {keyPoints.priorites_revision?.length > 0 && (
                      <div>
                        <h4 className="font-medium mb-2">{t('exam_mode.revision_priorities') || 'Priorités de révision'}</h4>
                        <div className="space-y-1">
                          {keyPoints.priorites_revision.map((prio, idx) => (
                            <div key={idx} className="flex items-center gap-2 text-sm">
                              <Badge variant={idx === 0 ? "default" : idx === 1 ? "secondary" : "outline"}>
                                {idx + 1}
                              </Badge>
                              <span>{prio.sujet}</span>
                              <span className="text-muted-foreground">- {prio.raison}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}

              {/* Weak Points */}
              {weakPoints && (
                <Card className="border-orange-500/20">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <AlertTriangle className="w-5 h-5 text-orange-500" />
                      {t('exam_mode.weak_points_analysis') || 'Détection des points faibles'}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {/* Performance summary */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                      <div className="text-center p-3 bg-muted/50 rounded-lg">
                        <div className="text-xl font-bold">{weakPoints.performance_summary.tasks_analyzed}</div>
                        <div className="text-xs text-muted-foreground">Tâches analysées</div>
                      </div>
                      <div className="text-center p-3 bg-muted/50 rounded-lg">
                        <div className="text-xl font-bold">{weakPoints.performance_summary.average_score}%</div>
                        <div className="text-xs text-muted-foreground">Score moyen</div>
                      </div>
                      <div className="text-center p-3 bg-muted/50 rounded-lg">
                        <div className="text-xl font-bold text-red-500">{weakPoints.performance_summary.low_score_count}</div>
                        <div className="text-xs text-muted-foreground">Scores faibles</div>
                      </div>
                      <div className="text-center p-3 bg-muted/50 rounded-lg">
                        <div className="text-xl font-bold text-orange-500">{weakPoints.performance_summary.time_issues_count}</div>
                        <div className="text-xs text-muted-foreground">Problèmes de temps</div>
                      </div>
                    </div>

                    {/* Weak points list */}
                    {weakPoints.weak_points?.length > 0 ? (
                      <div className="space-y-2">
                        {weakPoints.weak_points.map((wp, idx) => (
                          <div
                            key={idx}
                            className={cn(
                              "p-3 rounded-lg border",
                              wp.severite === 'haute' ? "bg-red-500/10 border-red-500/20" :
                              wp.severite === 'moyenne' ? "bg-orange-500/10 border-orange-500/20" :
                              "bg-yellow-500/10 border-yellow-500/20"
                            )}
                          >
                            <div className="flex items-center justify-between">
                              <span className="font-medium">{wp.subject}</span>
                              <div className="flex items-center gap-2">
                                <span className="text-sm">{wp.score_moyen}%</span>
                                <Badge variant={wp.severite === 'haute' ? 'destructive' : 'outline'}>
                                  {wp.severite}
                                </Badge>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-center py-4 text-muted-foreground">
                        <CheckCircle className="w-8 h-8 mx-auto mb-2 text-green-500" />
                        <p>{t('exam_mode.no_weak_points') || 'Aucun point faible détecté !'}</p>
                      </div>
                    )}

                    {/* Recommendations */}
                    {weakPoints.recommendations?.length > 0 && (
                      <div>
                        <h4 className="font-medium mb-2">{t('exam_mode.recommendations') || 'Recommandations'}</h4>
                        <ul className="space-y-1">
                          {weakPoints.recommendations.map((rec, idx) => (
                            <li key={idx} className="text-sm text-muted-foreground flex items-start gap-2">
                              <ChevronRight className="w-4 h-4 mt-0.5 text-orange-500 shrink-0" />
                              {rec}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}

              {/* Personalized Advice */}
              {advice && (
                <Card className="border-green-500/20">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Brain className="w-5 h-5 text-green-500" />
                      {t('exam_mode.personalized_advice') || 'Conseils personnalisés'}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {/* Strategy */}
                    <div className="p-4 bg-green-500/10 border border-green-500/20 rounded-lg">
                      <h4 className="font-medium mb-1">{t('exam_mode.global_strategy') || 'Stratégie globale'}</h4>
                      <p className="text-sm">{advice.strategie_globale}</p>
                    </div>

                    {/* Focus */}
                    {advice.focus_prioritaire?.length > 0 && (
                      <div>
                        <h4 className="font-medium mb-2">{t('exam_mode.priority_focus') || 'Focus prioritaire'}</h4>
                        <div className="flex flex-wrap gap-2">
                          {advice.focus_prioritaire.map((focus, idx) => (
                            <Badge key={idx} variant="secondary">{focus}</Badge>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Methods */}
                    {advice.methodes_recommandees?.length > 0 && (
                      <div>
                        <h4 className="font-medium mb-2">{t('exam_mode.recommended_methods') || 'Méthodes recommandées'}</h4>
                        <div className="space-y-2">
                          {advice.methodes_recommandees.map((method, idx) => (
                            <div key={idx} className="p-3 bg-muted/50 rounded-lg">
                              <p className="font-medium text-sm">{method.methode}</p>
                              <p className="text-xs text-muted-foreground mt-1">{method.pourquoi}</p>
                              <p className="text-xs text-primary mt-1">{method.comment}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Planning */}
                    {advice.planning_suggere && (
                      <div>
                        <h4 className="font-medium mb-2">{t('exam_mode.suggested_planning') || 'Planning suggéré'}</h4>
                        <div className="grid grid-cols-3 gap-2 text-sm">
                          <div className="p-3 bg-muted/50 rounded-lg">
                            <p className="font-medium text-xs text-muted-foreground mb-1">Aujourd'hui</p>
                            <p>{advice.planning_suggere.aujourd_hui}</p>
                          </div>
                          <div className="p-3 bg-muted/50 rounded-lg">
                            <p className="font-medium text-xs text-muted-foreground mb-1">Cette semaine</p>
                            <p>{advice.planning_suggere.cette_semaine}</p>
                          </div>
                          <div className="p-3 bg-muted/50 rounded-lg">
                            <p className="font-medium text-xs text-muted-foreground mb-1">Avant l'examen</p>
                            <p>{advice.planning_suggere.avant_examen}</p>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Motivation */}
                    {advice.message_motivation && (
                      <div className="p-4 bg-gradient-to-r from-green-500/10 to-blue-500/10 rounded-lg border">
                        <p className="text-sm font-medium text-center">{advice.message_motivation}</p>
                      </div>
                    )}

                    {/* Learning style */}
                    {advice.context?.learning_style && (
                      <div className="text-sm text-muted-foreground text-center">
                        Style d'apprentissage détecté : <span className="font-medium text-primary">{advice.context.learning_style}</span>
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}
            </>
          )}
        </TabsContent>
      </Tabs>

      {/* Creation Wizard Dialog */}
      <Dialog open={wizardOpen} onOpenChange={setWizardOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <GraduationCap className="w-5 h-5" />
              {t('exam_mode.create_session') || 'Créer une session de révision'}
            </DialogTitle>
            <DialogDescription>
              {wizardStep === 'info' && (t('exam_mode.step1_desc') || "Informations sur l'examen")}
              {wizardStep === 'content' && (t('exam_mode.step2_desc') || 'Sélection du contenu à réviser')}
              {wizardStep === 'schedule' && (t('exam_mode.step3_desc') || 'Configuration du planning')}
              {wizardStep === 'preview' && (t('exam_mode.step4_desc') || 'Aperçu et confirmation')}
            </DialogDescription>
          </DialogHeader>

          {/* Progress indicator */}
          <div className="flex items-center justify-between px-2 py-4">
            {WIZARD_STEPS.map((step, index) => (
              <div key={step} className="flex items-center">
                <div className={cn(
                  "w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium",
                  WIZARD_STEPS.indexOf(wizardStep) >= index
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground"
                )}>
                  {index + 1}
                </div>
                {index < WIZARD_STEPS.length - 1 && (
                  <div className={cn(
                    "w-12 h-1 mx-2",
                    WIZARD_STEPS.indexOf(wizardStep) > index
                      ? "bg-primary"
                      : "bg-muted"
                  )} />
                )}
              </div>
            ))}
          </div>

          {/* Step 1: Basic Info */}
          {wizardStep === 'info' && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="exam_name">{t('exam_mode.exam_name') || "Nom de l'examen"} *</Label>
                <Input
                  id="exam_name"
                  value={formData.exam_name}
                  onChange={(e) => setFormData({ ...formData, exam_name: e.target.value })}
                  placeholder="Ex: Partiel de Mathématiques"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="exam_description">{t('exam_mode.description') || 'Description'}</Label>
                <Textarea
                  id="exam_description"
                  value={formData.exam_description}
                  onChange={(e) => setFormData({ ...formData, exam_description: e.target.value })}
                  placeholder="Description optionnelle..."
                  rows={2}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="exam_date">{t('exam_mode.exam_date') || "Date de l'examen"} *</Label>
                  <Input
                    id="exam_date"
                    type="date"
                    value={formData.exam_date}
                    onChange={(e) => setFormData({ ...formData, exam_date: e.target.value })}
                    min={new Date().toISOString().split('T')[0]}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="exam_time">{t('exam_mode.exam_time') || "Heure de l'examen"}</Label>
                  <Input
                    id="exam_time"
                    type="time"
                    value={formData.exam_time}
                    onChange={(e) => setFormData({ ...formData, exam_time: e.target.value })}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>{t('exam_mode.subject') || 'Matière'}</Label>
                <Select
                  value={formData.subject_id?.toString() || ''}
                  onValueChange={(v) => setFormData({ ...formData, subject_id: parseInt(v), note_ids: [], document_ids: [] })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={t('exam_mode.select_subject') || 'Sélectionner une matière'} />
                  </SelectTrigger>
                  <SelectContent>
                    {subjects.map((subject) => (
                      <SelectItem key={subject.id} value={subject.id.toString()}>
                        {subject.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}

          {/* Step 2: Content Selection */}
          {wizardStep === 'content' && (
            <div className="space-y-4">
              <div className="p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                <p className="text-sm text-blue-700 dark:text-blue-300">
                  Sélectionnez au moins une note OU un document pour créer votre session de révision.
                </p>
              </div>

              {/* Notes Selection */}
              <div className="space-y-2">
                <Label className="text-base font-medium">{t('exam_mode.select_notes') || 'Notes'}</Label>
                <p className="text-sm text-muted-foreground">
                  {t('exam_mode.select_notes_desc') || 'Notes que vous avez prises sur la plateforme'}
                </p>
              </div>

              <div className="max-h-[200px] overflow-y-auto border rounded-lg">
                {filteredNotes.length > 0 ? (
                  filteredNotes.map((note) => (
                    <div
                      key={note.id}
                      className={cn(
                        "flex items-center gap-3 p-3 border-b last:border-0 cursor-pointer hover:bg-muted/50",
                        formData.note_ids.includes(note.id) && "bg-primary/5"
                      )}
                      onClick={() => {
                        const newIds = formData.note_ids.includes(note.id)
                          ? formData.note_ids.filter(id => id !== note.id)
                          : [...formData.note_ids, note.id]
                        setFormData({ ...formData, note_ids: newIds })
                      }}
                    >
                      <Checkbox checked={formData.note_ids.includes(note.id)} />
                      <div className="flex-1">
                        <p className="font-medium">{note.title}</p>
                        {note.subject_name && (
                          <p className="text-xs text-muted-foreground">{note.subject_name}</p>
                        )}
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="p-6 text-center text-muted-foreground">
                    <BookOpen className="w-6 h-6 mx-auto mb-2 opacity-50" />
                    <p className="text-sm">{t('exam_mode.no_notes') || 'Aucune note pour cette matière'}</p>
                  </div>
                )}
              </div>

              {formData.note_ids.length > 0 && (
                <div className="text-sm text-muted-foreground">
                  {formData.note_ids.length} {t('exam_mode.notes_selected') || 'note(s) sélectionnée(s)'}
                </div>
              )}

              {/* Documents Selection */}
              <div className="pt-4 border-t space-y-2">
                <Label className="text-base font-medium">{t('exam_mode.documents') || 'Documents (PDF, Word...)'}</Label>
                <p className="text-sm text-muted-foreground">
                  {t('exam_mode.documents_hint') || 'Documents que vous avez uploadés pour cette matière'}
                </p>
              </div>

              <div className="max-h-[200px] overflow-y-auto border rounded-lg">
                {filteredDocuments.length > 0 ? (
                  filteredDocuments.map((doc) => (
                    <div
                      key={doc.id}
                      className={cn(
                        "flex items-center gap-3 p-3 border-b last:border-0 cursor-pointer hover:bg-muted/50",
                        formData.document_ids.includes(doc.id) && "bg-primary/5"
                      )}
                      onClick={() => {
                        const newIds = formData.document_ids.includes(doc.id)
                          ? formData.document_ids.filter(id => id !== doc.id)
                          : [...formData.document_ids, doc.id]
                        setFormData({ ...formData, document_ids: newIds })
                      }}
                    >
                      <Checkbox checked={formData.document_ids.includes(doc.id)} />
                      <div className="flex-1">
                        <p className="font-medium">{doc.title || doc.original_filename}</p>
                        <p className="text-xs text-muted-foreground">
                          {doc.file_type.toUpperCase()} • {doc.file_size_formatted}
                        </p>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="p-6 text-center text-muted-foreground">
                    <BookOpen className="w-6 h-6 mx-auto mb-2 opacity-50" />
                    <p className="text-sm">Aucun document pour cette matière</p>
                    <p className="text-xs mt-1">Uploadez des documents via la page Documents</p>
                  </div>
                )}
              </div>

              {formData.document_ids.length > 0 && (
                <div className="text-sm text-muted-foreground">
                  {formData.document_ids.length} document(s) sélectionné(s)
                </div>
              )}

              {/* Summary */}
              <div className="pt-2 border-t">
                <div className="flex items-center gap-4 text-sm">
                  <span className={cn(
                    "font-medium",
                    (formData.note_ids.length > 0 || formData.document_ids.length > 0) ? "text-green-600" : "text-orange-600"
                  )}>
                    Total: {formData.note_ids.length} note(s), {formData.document_ids.length} document(s)
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Step 3: Schedule Configuration */}
          {wizardStep === 'schedule' && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>{t('exam_mode.hours_per_day') || "Heures d'étude par jour"}</Label>
                <Select
                  value={formData.study_hours_per_day?.toString() || "2"}
                  onValueChange={(v) => setFormData({ ...formData, study_hours_per_day: parseFloat(v) })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {[0.5, 1, 1.5, 2, 2.5, 3, 4, 5, 6].map((h) => (
                      <SelectItem key={h} value={h.toString()}>
                        {h}h par jour
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>{t('exam_mode.preferred_times') || 'Moments préférés'}</Label>
                <div className="grid grid-cols-2 gap-2">
                  {STUDY_TIMES.map((time) => (
                    <div
                      key={time.value}
                      className={cn(
                        "flex items-center gap-2 p-3 border rounded-lg cursor-pointer",
                        formData.preferred_study_times?.includes(time.value) && "border-primary bg-primary/5"
                      )}
                      onClick={() => {
                        const current = formData.preferred_study_times || []
                        const newTimes = current.includes(time.value)
                          ? current.filter(t => t !== time.value)
                          : [...current, time.value]
                        setFormData({ ...formData, preferred_study_times: newTimes })
                      }}
                    >
                      <Checkbox checked={formData.preferred_study_times?.includes(time.value)} />
                      <span>{time.label}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <Label>{t('exam_mode.difficulty') || 'Niveau de difficulté'}</Label>
                <div className="grid grid-cols-3 gap-2">
                  {(Object.keys(DIFFICULTY_LABELS) as DifficultyLevel[]).map((level) => (
                    <div
                      key={level}
                      className={cn(
                        "p-3 border rounded-lg cursor-pointer text-center",
                        formData.difficulty_level === level && "border-primary bg-primary/5"
                      )}
                      onClick={() => setFormData({ ...formData, difficulty_level: level })}
                    >
                      <p className={cn("font-medium", DIFFICULTY_LABELS[level].color)}>
                        {DIFFICULTY_LABELS[level].label}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {DIFFICULTY_LABELS[level].description}
                      </p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex items-center justify-between p-3 border rounded-lg">
                <div>
                  <p className="font-medium">{t('exam_mode.include_weekends') || 'Inclure les weekends'}</p>
                  <p className="text-sm text-muted-foreground">
                    {t('exam_mode.include_weekends_desc') || 'Réviser aussi le samedi et dimanche'}
                  </p>
                </div>
                <Checkbox
                  checked={formData.include_weekends}
                  onCheckedChange={(checked) => setFormData({ ...formData, include_weekends: checked as boolean })}
                />
              </div>

              <div className="flex items-center justify-between p-3 border rounded-lg">
                <div>
                  <p className="font-medium">{t('exam_mode.notifications') || 'Notifications'}</p>
                  <p className="text-sm text-muted-foreground">
                    {t('exam_mode.notifications_desc') || 'Recevoir des rappels quotidiens'}
                  </p>
                </div>
                <Checkbox
                  checked={formData.notifications_enabled}
                  onCheckedChange={(checked) => setFormData({ ...formData, notifications_enabled: checked as boolean })}
                />
              </div>

              {formData.notifications_enabled && (
                <div className="space-y-2">
                  <Label>{t('exam_mode.reminder_time') || 'Heure du rappel'}</Label>
                  <Input
                    type="time"
                    value={formData.reminder_time}
                    onChange={(e) => setFormData({ ...formData, reminder_time: e.target.value })}
                  />
                </div>
              )}
            </div>
          )}

          {/* Step 4: Preview */}
          {wizardStep === 'preview' && (
            <div className="space-y-4">
              <div className="p-4 border rounded-lg space-y-3">
                <h4 className="font-semibold">{t('exam_mode.summary') || 'Récapitulatif'}</h4>

                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-muted-foreground">{t('exam_mode.exam_name')}</p>
                    <p className="font-medium">{formData.exam_name}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">{t('exam_mode.exam_date')}</p>
                    <p className="font-medium">
                      {formData.exam_date && new Date(formData.exam_date).toLocaleDateString('fr-FR', {
                        weekday: 'long',
                        day: 'numeric',
                        month: 'long'
                      })}
                    </p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">{t('exam_mode.content_count') || 'Contenu'}</p>
                    <p className="font-medium">
                      {formData.note_ids.length} notes
                      {formData.document_ids.length > 0 && `, ${formData.document_ids.length} documents`}
                    </p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">{t('exam_mode.hours_per_day')}</p>
                    <p className="font-medium">{formData.study_hours_per_day}h / jour</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">{t('exam_mode.difficulty')}</p>
                    <p className={cn("font-medium", DIFFICULTY_LABELS[formData.difficulty_level || 'medium'].color)}>
                      {DIFFICULTY_LABELS[formData.difficulty_level || 'medium'].label}
                    </p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">{t('exam_mode.notifications')}</p>
                    <p className="font-medium">
                      {formData.notifications_enabled ? `Activées (${formData.reminder_time})` : 'Désactivées'}
                    </p>
                  </div>
                </div>
              </div>

              <div className="p-4 bg-primary/5 border border-primary/20 rounded-lg">
                <p className="text-sm text-center">
                  {t('exam_mode.plan_will_generate') || 'Un plan de révision personnalisé sera généré automatiquement avec des tâches quotidiennes adaptées à vos objectifs.'}
                </p>
              </div>
            </div>
          )}

          <DialogFooter className="flex justify-between">
            <div>
              {wizardStep !== 'info' && (
                <Button
                  variant="outline"
                  onClick={() => {
                    const currentIndex = WIZARD_STEPS.indexOf(wizardStep)
                    setWizardStep(WIZARD_STEPS[currentIndex - 1])
                  }}
                >
                  <ChevronLeft className="w-4 h-4 mr-1" />
                  {t('common.back') || 'Retour'}
                </Button>
              )}
            </div>
            <div className="flex gap-2">
              <Button variant="ghost" onClick={() => { setWizardOpen(false); resetWizard() }}>
                {t('common.cancel') || 'Annuler'}
              </Button>
              {wizardStep !== 'preview' ? (
                <Button
                  onClick={() => {
                    const currentIndex = WIZARD_STEPS.indexOf(wizardStep)
                    setWizardStep(WIZARD_STEPS[currentIndex + 1])
                  }}
                  disabled={
                    (wizardStep === 'info' && (!formData.exam_name || !formData.exam_date)) ||
                    (wizardStep === 'content' && formData.note_ids.length === 0 && formData.document_ids.length === 0)
                  }
                >
                  {t('common.next') || 'Suivant'}
                  <ChevronRight className="w-4 h-4 ml-1" />
                </Button>
              ) : (
                <Button onClick={handleCreateSession} disabled={creating}>
                  {creating ? (
                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  ) : (
                    <Check className="w-4 h-4 mr-2" />
                  )}
                  {t('exam_mode.create') || 'Créer la session'}
                </Button>
              )}
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
