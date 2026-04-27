'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import {
  Sparkles,
  CreditCard,
  Brain,
  FileText,
  Key,
  Lightbulb,
  Calendar,
  Zap,
  TrendingUp,
  AlertCircle,
  Loader2,
  ChevronRight,
  CheckCircle,
  Crown,
  Star,
  Building,
  Gift,
  Clock,
  BarChart3,
  ArrowUpRight
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import api from '@/lib/api'
import { useToast } from '@/hooks/use-toast'
import { useTranslation } from '@/contexts/LanguageContext'

interface SubscriptionInfo {
  name: string
  description: string
  features: string[]
  color: string
  icon: string
  is_premium: boolean
  starts_at: string | null
  ends_at: string | null
  auto_renew: boolean
}

interface QuotaInfo {
  max_requests_per_day: number
  requests_used_today: number
  requests_remaining: number
  usage_percentage: number
  can_use: boolean
}

interface UsageStats {
  quiz_generations: number
  flashcard_generations: number
  note_summaries: number
  explanations: number
}

interface AIQuota {
  subscription_type: string
  subscription_info: SubscriptionInfo
  quota: QuotaInfo
  usage_stats: UsageStats
  total_requests_all_time: number
  // Rétrocompatibilité
  max_requests_per_day: number
  requests_used_today: number
  requests_remaining: number
  can_use: boolean
}

interface Note {
  id: number
  title: string
  subject_id: number
  subject_name: string
  content_preview: string
}

type Difficulty = 'easy' | 'medium' | 'hard'
type KnowledgeLevel = 'beginner' | 'intermediate' | 'advanced'

export default function AIHubPage() {
  const router = useRouter()
  const { toast } = useToast()
  const { t, locale } = useTranslation()

  const [loading, setLoading] = useState(true)
  const [quota, setQuota] = useState<AIQuota | null>(null)
  const [notes, setNotes] = useState<Note[]>([])
  const [processing, setProcessing] = useState(false)
  const [activeTab, setActiveTab] = useState('generate')

  // Form states
  const [selectedNoteId, setSelectedNoteId] = useState<string>('')
  const [flashcardCount, setFlashcardCount] = useState(10)
  const [quizQuestionCount, setQuizQuestionCount] = useState(10)
  const [difficulty, setDifficulty] = useState<Difficulty>('medium')
  const [summaryMaxLength, setSummaryMaxLength] = useState(300)
  const [keywordsMax, setKeywordsMax] = useState(10)
  const [concept, setConcept] = useState('')
  const [conceptContext, setConceptContext] = useState('')
  const [conceptLevel, setConceptLevel] = useState<KnowledgeLevel>('intermediate')

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    try {
      setLoading(true)
      const [quotaRes, notesRes] = await Promise.all([
        api.get('/ai/quota'),
        api.get('/notes/', { params: { page: 1, page_size: 100 } })
      ])

      console.log('[AI Hub] Quota data:', quotaRes.data)
      setQuota(quotaRes.data)
      setNotes(notesRes.data.notes || [])
    } catch (error: any) {
      console.error('Error fetching data:', error)
      toast({
        title: t('common.error'),
        description: t('ai.loadError'),
        variant: 'destructive'
      })
    } finally {
      setLoading(false)
    }
  }

  const handleGenerateFlashcards = async () => {
    if (!selectedNoteId) {
      toast({
        title: t('ai.missingNote'),
        description: t('ai.pleaseSelectNote'),
        variant: 'destructive'
      })
      return
    }

    try {
      setProcessing(true)
      const response = await api.post('/ai/generate-flashcards', {
        note_id: parseInt(selectedNoteId),
        count: flashcardCount,
        difficulty
      })

      toast({
        title: t('ai.flashcardsGenerated'),
        description: t('ai.flashcardsCreatedSuccess', { count: response.data.count }),
      })

      // Rafraîchir le quota
      const quotaRes = await api.get('/ai/quota')
      setQuota(quotaRes.data)

      router.push('/flashcards')
    } catch (error: any) {
      toast({
        title: t('common.error'),
        description: error.response?.data?.detail || t('ai.generationError'),
        variant: 'destructive'
      })
    } finally {
      setProcessing(false)
    }
  }

  const handleGenerateQuiz = async () => {
    if (!selectedNoteId) {
      toast({
        title: t('ai.missingNote'),
        description: t('ai.pleaseSelectNote'),
        variant: 'destructive'
      })
      return
    }

    try {
      setProcessing(true)
      const response = await api.post('/ai/generate-quiz', {
        note_id: parseInt(selectedNoteId),
        question_count: quizQuestionCount,
        question_types: ['multiple_choice', 'true_false', 'short_answer'],
        difficulty
      })

      toast({
        title: t('ai.quizGenerated'),
        description: t('ai.quizCreatedSuccess'),
      })

      // Rafraîchir le quota
      const quotaRes = await api.get('/ai/quota')
      setQuota(quotaRes.data)

      router.push(`/quizzes/${response.data.quiz.id}`)
    } catch (error: any) {
      toast({
        title: t('common.error'),
        description: error.response?.data?.detail || t('ai.generationError'),
        variant: 'destructive'
      })
    } finally {
      setProcessing(false)
    }
  }

  const handleSummarizeNote = async () => {
    if (!selectedNoteId) {
      toast({
        title: t('ai.missingNote'),
        description: t('ai.pleaseSelectNote'),
        variant: 'destructive'
      })
      return
    }

    try {
      setProcessing(true)
      const response = await api.post('/ai/summarize-note', {
        note_id: parseInt(selectedNoteId),
        max_length: summaryMaxLength
      })

      toast({
        title: t('ai.summaryGenerated'),
        description: t('ai.summaryCreatedWords', { count: response.data.word_count }),
      })

      // Afficher le résumé dans une alerte
      alert(`${t('ai.summaryOf', { title: response.data.note_title })}:\n\n${response.data.summary}`)

      // Rafraîchir le quota
      const quotaRes = await api.get('/ai/quota')
      setQuota(quotaRes.data)
    } catch (error: any) {
      toast({
        title: t('common.error'),
        description: error.response?.data?.detail || t('ai.summaryError'),
        variant: 'destructive'
      })
    } finally {
      setProcessing(false)
    }
  }

  const handleExtractKeywords = async () => {
    if (!selectedNoteId) {
      toast({
        title: t('ai.missingNote'),
        description: t('ai.pleaseSelectNote'),
        variant: 'destructive'
      })
      return
    }

    try {
      setProcessing(true)
      const response = await api.post('/ai/extract-keywords', {
        note_id: parseInt(selectedNoteId),
        max_keywords: keywordsMax
      })

      toast({
        title: t('ai.keywordsExtracted'),
        description: t('ai.keywordsFound', { count: response.data.keywords.length }),
      })

      // Afficher les mots-clés
      alert(`${t('ai.keywordsOf', { title: response.data.note_title })}:\n\n${response.data.keywords.join(', ')}`)

      // Rafraîchir le quota
      const quotaRes = await api.get('/ai/quota')
      setQuota(quotaRes.data)
    } catch (error: any) {
      toast({
        title: t('common.error'),
        description: error.response?.data?.detail || t('ai.extractionError'),
        variant: 'destructive'
      })
    } finally {
      setProcessing(false)
    }
  }

  const handleExplainConcept = async () => {
    if (!concept.trim()) {
      toast({
        title: t('ai.missingConcept'),
        description: t('ai.pleaseEnterConcept'),
        variant: 'destructive'
      })
      return
    }

    try {
      setProcessing(true)
      const response = await api.post('/ai/explain-concept', {
        concept: concept.trim(),
        context: conceptContext.trim() || null,
        level: conceptLevel
      })

      toast({
        title: t('ai.explanationGenerated'),
      })

      // Afficher l'explication
      alert(`${t('ai.explanationOf', { concept: response.data.concept })}:\n\n${response.data.explanation}`)

      // Rafraîchir le quota
      const quotaRes = await api.get('/ai/quota')
      setQuota(quotaRes.data)
    } catch (error: any) {
      toast({
        title: t('common.error'),
        description: error.response?.data?.detail || t('ai.explanationError'),
        variant: 'destructive'
      })
    } finally {
      setProcessing(false)
    }
  }

  const getSubscriptionColor = (type: string) => {
    const colors: Record<string, string> = {
      free: 'bg-gray-100 text-gray-800 border-gray-300',
      premium: 'bg-blue-100 text-blue-800 border-blue-300',
      premium_plus: 'bg-purple-100 text-purple-800 border-purple-300',
      institutional: 'bg-green-100 text-green-800 border-green-300'
    }
    return colors[type.toLowerCase()] || colors.free
  }

  const getSubscriptionIcon = (icon: string) => {
    switch (icon) {
      case 'crown':
        return <Crown className="h-5 w-5" />
      case 'star':
        return <Star className="h-5 w-5" />
      case 'building':
        return <Building className="h-5 w-5" />
      default:
        return <Gift className="h-5 w-5" />
    }
  }

  const getSubscriptionGradient = (type: string) => {
    const gradients: Record<string, string> = {
      free: 'from-gray-50 to-gray-100 border-gray-200',
      premium: 'from-blue-50 to-indigo-100 border-blue-200',
      premium_plus: 'from-purple-50 to-pink-100 border-purple-200',
      institutional: 'from-green-50 to-emerald-100 border-green-200'
    }
    return gradients[type.toLowerCase()] || gradients.free
  }

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return null
    const localeMap: Record<string, string> = { fr: 'fr-FR', en: 'en-US', es: 'es-ES', ar: 'ar-SA' }
    return new Date(dateStr).toLocaleDateString(localeMap[locale] || 'fr-FR', {
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    })
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

  const quotaPercentage = quota ? (quota.requests_used_today / quota.max_requests_per_day) * 100 : 0

  return (
    <div className="container mx-auto px-3 py-4 sm:p-6 max-w-7xl">
      {/* Header */}
      <div className="mb-4 sm:mb-6">
        <div className="flex items-center gap-2 sm:gap-3 mb-2">
          <div className="p-2 sm:p-3 bg-gradient-to-br from-purple-500 to-pink-500 rounded-lg flex-shrink-0">
            <Sparkles className="h-6 w-6 sm:h-8 sm:w-8 text-white" />
          </div>
          <div className="min-w-0">
            <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold text-gray-900 dark:text-white">{t('ai.title')}</h1>
            <p className="text-sm sm:text-base text-gray-600 dark:text-gray-400 truncate">{t('ai.subtitle')}</p>
          </div>
        </div>
      </div>

      {/* Subscription & Quota Section */}
      {quota && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4 lg:gap-6 mb-4 sm:mb-6">
          {/* Subscription Card */}
          <Card className={`border-2 bg-gradient-to-br ${getSubscriptionGradient(quota.subscription_type)} sm:col-span-2 lg:col-span-1`}>
            <CardHeader className="p-3 sm:p-4 pb-2 sm:pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
                  {quota.subscription_info && getSubscriptionIcon(quota.subscription_info.icon)}
                  {t('ai.mySubscription')}
                </CardTitle>
              </div>
            </CardHeader>
            <CardContent className="p-3 sm:p-4 pt-0 space-y-3 sm:space-y-4">
              <div className="flex flex-wrap items-center gap-2 sm:gap-3">
                <Badge className={`${getSubscriptionColor(quota.subscription_type)} text-sm sm:text-base px-2 sm:px-3 py-0.5 sm:py-1 border`}>
                  {quota.subscription_info?.name || quota.subscription_type.toUpperCase()}
                </Badge>
                {quota.subscription_info?.is_premium && (
                  <span className="text-xs text-green-600 font-medium flex items-center gap-1">
                    <CheckCircle className="h-3 w-3" />
                    {t('ai.active')}
                  </span>
                )}
              </div>

              {quota.subscription_info && (
                <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400 line-clamp-2">
                  {quota.subscription_info.description}
                </p>
              )}

              {quota.subscription_info?.features && (
                <ul className="space-y-1 hidden sm:block">
                  {quota.subscription_info.features.slice(0, 3).map((feature, idx) => (
                    <li key={idx} className="text-xs text-gray-600 dark:text-gray-400 flex items-center gap-2">
                      <CheckCircle className="h-3 w-3 text-green-500 flex-shrink-0" />
                      <span className="truncate">{feature}</span>
                    </li>
                  ))}
                </ul>
              )}

              {quota.subscription_info?.ends_at && (
                <div className="flex items-center gap-2 text-xs text-gray-500 pt-2 border-t">
                  <Clock className="h-3 w-3 flex-shrink-0" />
                  <span className="truncate">{t('ai.expiresOn', { date: formatDate(quota.subscription_info.ends_at) || '' })}</span>
                </div>
              )}

              {/* Bouton Upgrade */}
              <div className="pt-3 sm:pt-4 border-t border-gray-200 dark:border-gray-700">
                <button
                  type="button"
                  onClick={() => router.push('/pricing')}
                  className="w-full py-2.5 sm:py-3 px-3 sm:px-4 bg-gradient-to-r from-blue-600 to-purple-600 text-white font-bold rounded-lg shadow-lg hover:from-blue-700 hover:to-purple-700 transition-all transform hover:scale-[1.02] text-sm sm:text-base flex items-center justify-center gap-2"
                >
                  <Crown className="h-4 w-4" />
                  {t('ai.upgradeToPremium')}
                  <ArrowUpRight className="h-4 w-4" />
                </button>
              </div>
            </CardContent>
          </Card>

          {/* Quota Card */}
          <Card className="border-2 border-purple-200 dark:border-purple-800 bg-gradient-to-br from-purple-50 to-pink-50 dark:from-purple-900/20 dark:to-pink-900/20">
            <CardHeader className="p-3 sm:p-4 pb-2 sm:pb-3">
              <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
                <Zap className="h-4 w-4 sm:h-5 sm:w-5 text-purple-600" />
                {t('ai.dailyQuota')}
              </CardTitle>
              <CardDescription className="text-xs sm:text-sm">{t('ai.usageToday')}</CardDescription>
            </CardHeader>
            <CardContent className="p-3 sm:p-4 pt-0 space-y-3 sm:space-y-4">
              <div>
                <div className="flex justify-between text-xs sm:text-sm mb-2">
                  <span className="text-gray-600 dark:text-gray-400">
                    {quota.quota?.requests_used_today || quota.requests_used_today} / {quota.quota?.max_requests_per_day || quota.max_requests_per_day}
                  </span>
                  <span className="font-semibold text-purple-600">
                    {quota.quota?.requests_remaining || quota.requests_remaining} {t('ai.remaining')}
                  </span>
                </div>
                <Progress
                  value={quota.quota?.usage_percentage || quotaPercentage}
                  className="h-2 sm:h-3"
                />
              </div>

              <div className="grid grid-cols-2 gap-2 sm:gap-3">
                <div className="text-center p-2 sm:p-3 bg-white dark:bg-gray-800 rounded-lg">
                  <div className="text-lg sm:text-xl font-bold text-purple-600">
                    {quota.quota?.max_requests_per_day || quota.max_requests_per_day}
                  </div>
                  <div className="text-[10px] sm:text-xs text-gray-600 dark:text-gray-400">{t('ai.limitPerDay')}</div>
                </div>
                <div className="text-center p-2 sm:p-3 bg-white dark:bg-gray-800 rounded-lg">
                  <div className="text-lg sm:text-xl font-bold text-green-600">
                    {quota.quota?.requests_remaining || quota.requests_remaining}
                  </div>
                  <div className="text-[10px] sm:text-xs text-gray-600 dark:text-gray-400">{t('ai.available')}</div>
                </div>
              </div>

              {!(quota.quota?.can_use ?? quota.can_use) && (
                <div
                  onClick={() => router.push('/pricing')}
                  className="flex items-center gap-2 p-2 sm:p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg cursor-pointer hover:bg-red-100 dark:hover:bg-red-900/30 transition-colors"
                >
                  <AlertCircle className="h-4 w-4 sm:h-5 sm:w-5 text-red-600 flex-shrink-0" />
                  <span className="text-xs text-red-700 dark:text-red-400">
                    {t('ai.quotaReached')} <span className="underline font-semibold">{t('ai.goToPremium')} →</span>
                  </span>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Usage Stats Card */}
          <Card className="border-2 border-indigo-200 dark:border-indigo-800 bg-gradient-to-br from-indigo-50 to-blue-50 dark:from-indigo-900/20 dark:to-blue-900/20">
            <CardHeader className="p-3 sm:p-4 pb-2 sm:pb-3">
              <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
                <BarChart3 className="h-4 w-4 sm:h-5 sm:w-5 text-indigo-600" />
                {t('ai.usageStats')}
              </CardTitle>
              <CardDescription className="text-xs sm:text-sm">{t('ai.totalRequests', { count: quota.total_requests_all_time })}</CardDescription>
            </CardHeader>
            <CardContent className="p-3 sm:p-4 pt-0">
              <div className="grid grid-cols-2 sm:grid-cols-1 gap-2 sm:space-y-2">
                <div className="flex items-center justify-between p-2 bg-white dark:bg-gray-800 rounded-lg">
                  <div className="flex items-center gap-1.5 sm:gap-2">
                    <div className="p-1 sm:p-1.5 bg-blue-100 dark:bg-blue-900/30 rounded">
                      <CreditCard className="h-3 w-3 sm:h-4 sm:w-4 text-blue-600" />
                    </div>
                    <span className="text-xs sm:text-sm text-gray-700 dark:text-gray-300 hidden sm:inline">{t('nav.flashcards')}</span>
                    <span className="text-xs text-gray-700 dark:text-gray-300 sm:hidden">{t('ai.mobileFlash')}</span>
                  </div>
                  <span className="font-semibold text-blue-600 text-sm">
                    {quota.usage_stats?.flashcard_generations || 0}
                  </span>
                </div>

                <div className="flex items-center justify-between p-2 bg-white dark:bg-gray-800 rounded-lg">
                  <div className="flex items-center gap-1.5 sm:gap-2">
                    <div className="p-1 sm:p-1.5 bg-green-100 dark:bg-green-900/30 rounded">
                      <Brain className="h-3 w-3 sm:h-4 sm:w-4 text-green-600" />
                    </div>
                    <span className="text-xs sm:text-sm text-gray-700 dark:text-gray-300 hidden sm:inline">{t('nav.quizzes')}</span>
                    <span className="text-xs text-gray-700 dark:text-gray-300 sm:hidden">{t('ai.mobileQuiz')}</span>
                  </div>
                  <span className="font-semibold text-green-600 text-sm">
                    {quota.usage_stats?.quiz_generations || 0}
                  </span>
                </div>

                <div className="flex items-center justify-between p-2 bg-white dark:bg-gray-800 rounded-lg">
                  <div className="flex items-center gap-1.5 sm:gap-2">
                    <div className="p-1 sm:p-1.5 bg-yellow-100 dark:bg-yellow-900/30 rounded">
                      <FileText className="h-3 w-3 sm:h-4 sm:w-4 text-yellow-600" />
                    </div>
                    <span className="text-xs sm:text-sm text-gray-700 dark:text-gray-300 hidden sm:inline">{t('ai.summaries')}</span>
                    <span className="text-xs text-gray-700 dark:text-gray-300 sm:hidden">{t('ai.mobileSummaries')}</span>
                  </div>
                  <span className="font-semibold text-yellow-600 text-sm">
                    {quota.usage_stats?.note_summaries || 0}
                  </span>
                </div>

                <div className="flex items-center justify-between p-2 bg-white dark:bg-gray-800 rounded-lg">
                  <div className="flex items-center gap-1.5 sm:gap-2">
                    <div className="p-1 sm:p-1.5 bg-indigo-100 dark:bg-indigo-900/30 rounded">
                      <Lightbulb className="h-3 w-3 sm:h-4 sm:w-4 text-indigo-600" />
                    </div>
                    <span className="text-xs sm:text-sm text-gray-700 dark:text-gray-300 hidden sm:inline">{t('ai.explanations')}</span>
                    <span className="text-xs text-gray-700 dark:text-gray-300 sm:hidden">{t('ai.mobileExplanations')}</span>
                  </div>
                  <span className="font-semibold text-indigo-600 text-sm">
                    {quota.usage_stats?.explanations || 0}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* AI Features Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4 sm:space-y-6">
        <TabsList className="grid w-full grid-cols-3 h-auto p-1">
          <TabsTrigger value="generate" className="text-xs sm:text-sm py-2 sm:py-2.5 flex items-center justify-center gap-1 sm:gap-2">
            <Sparkles className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
            <span className="hidden sm:inline">{t('ai.generate')}</span>
            <span className="sm:hidden">{t('ai.mobileGenerate')}</span>
          </TabsTrigger>
          <TabsTrigger value="analyze" className="text-xs sm:text-sm py-2 sm:py-2.5 flex items-center justify-center gap-1 sm:gap-2">
            <FileText className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
            <span className="hidden sm:inline">{t('ai.analyze')}</span>
            <span className="sm:hidden">{t('ai.mobileAnalyze')}</span>
          </TabsTrigger>
          <TabsTrigger value="explain" className="text-xs sm:text-sm py-2 sm:py-2.5 flex items-center justify-center gap-1 sm:gap-2">
            <Lightbulb className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
            <span className="hidden sm:inline">{t('ai.explain')}</span>
            <span className="sm:hidden">{t('ai.mobileExplain')}</span>
          </TabsTrigger>
        </TabsList>

        {/* Generate Tab */}
        <TabsContent value="generate" className="space-y-4 sm:space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 sm:gap-4 lg:gap-6">
            {/* Generate Flashcards */}
            <Card className="hover:shadow-lg transition-shadow">
              <CardHeader className="p-3 sm:p-4 lg:p-6 pb-2 sm:pb-3">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2 sm:gap-3">
                    <div className="p-1.5 sm:p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg flex-shrink-0">
                      <CreditCard className="h-5 w-5 sm:h-6 sm:w-6 text-blue-600" />
                    </div>
                    <div className="min-w-0">
                      <CardTitle className="text-base sm:text-lg">{t('ai.generateFlashcards')}</CardTitle>
                      <CardDescription className="text-xs sm:text-sm truncate">{t('ai.createFlashcardsFromNotes')}</CardDescription>
                    </div>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-3 sm:p-4 lg:p-6 pt-0 space-y-3 sm:space-y-4">
                <div>
                  <Label className="text-xs sm:text-sm">{t('ai.sourceNote')}</Label>
                  <Select value={selectedNoteId} onValueChange={setSelectedNoteId}>
                    <SelectTrigger className="mt-1 h-9 sm:h-10 text-sm">
                      <SelectValue placeholder={t('ai.selectNote')} />
                    </SelectTrigger>
                    <SelectContent>
                      {notes.map((note) => (
                        <SelectItem key={note.id} value={note.id.toString()} className="text-sm">
                          {note.title}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid grid-cols-2 gap-2 sm:gap-3">
                  <div>
                    <Label className="text-xs sm:text-sm">{t('ai.flashcardCount')}</Label>
                    <Input
                      type="number"
                      min="1"
                      max="20"
                      value={flashcardCount}
                      onChange={(e) => setFlashcardCount(parseInt(e.target.value) || 10)}
                      className="mt-1 h-9 sm:h-10 text-sm"
                    />
                  </div>

                  <div>
                    <Label className="text-xs sm:text-sm">{t('ai.difficulty')}</Label>
                    <Select value={difficulty} onValueChange={(v) => setDifficulty(v as Difficulty)}>
                      <SelectTrigger className="mt-1 h-9 sm:h-10 text-sm">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="easy" className="text-sm">{t('ai.easy')}</SelectItem>
                        <SelectItem value="medium" className="text-sm">{t('ai.medium')}</SelectItem>
                        <SelectItem value="hard" className="text-sm">{t('ai.hard')}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <Button
                  onClick={handleGenerateFlashcards}
                  disabled={processing || !quota?.can_use || !selectedNoteId}
                  className="w-full h-9 sm:h-10 text-sm"
                >
                  {processing ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-1.5 sm:mr-2 animate-spin" />
                      <span className="hidden sm:inline">{t('ai.generating')}</span>
                      <span className="sm:hidden">...</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="h-4 w-4 mr-1.5 sm:mr-2" />
                      <span className="hidden sm:inline">{t('ai.generateFlashcardsBtn')}</span>
                      <span className="sm:hidden">{t('ai.mobileGenerate')}</span>
                    </>
                  )}
                </Button>
              </CardContent>
            </Card>

            {/* Generate Quiz */}
            <Card className="hover:shadow-lg transition-shadow">
              <CardHeader className="p-3 sm:p-4 lg:p-6 pb-2 sm:pb-3">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2 sm:gap-3">
                    <div className="p-1.5 sm:p-2 bg-green-100 dark:bg-green-900/30 rounded-lg flex-shrink-0">
                      <Brain className="h-5 w-5 sm:h-6 sm:w-6 text-green-600" />
                    </div>
                    <div className="min-w-0">
                      <CardTitle className="text-base sm:text-lg">{t('ai.generateQuiz')}</CardTitle>
                      <CardDescription className="text-xs sm:text-sm truncate">{t('ai.createQuizFromNotes')}</CardDescription>
                    </div>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-3 sm:p-4 lg:p-6 pt-0 space-y-3 sm:space-y-4">
                <div>
                  <Label className="text-xs sm:text-sm">{t('ai.sourceNote')}</Label>
                  <Select value={selectedNoteId} onValueChange={setSelectedNoteId}>
                    <SelectTrigger className="mt-1 h-9 sm:h-10 text-sm">
                      <SelectValue placeholder={t('ai.selectNote')} />
                    </SelectTrigger>
                    <SelectContent>
                      {notes.map((note) => (
                        <SelectItem key={note.id} value={note.id.toString()} className="text-sm">
                          {note.title}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid grid-cols-2 gap-2 sm:gap-3">
                  <div>
                    <Label className="text-xs sm:text-sm">{t('ai.questionCount')}</Label>
                    <Input
                      type="number"
                      min="5"
                      max="20"
                      value={quizQuestionCount}
                      onChange={(e) => setQuizQuestionCount(parseInt(e.target.value) || 10)}
                      className="mt-1 h-9 sm:h-10 text-sm"
                    />
                  </div>

                  <div>
                    <Label className="text-xs sm:text-sm">{t('ai.difficulty')}</Label>
                    <Select value={difficulty} onValueChange={(v) => setDifficulty(v as Difficulty)}>
                      <SelectTrigger className="mt-1 h-9 sm:h-10 text-sm">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="easy" className="text-sm">{t('ai.easy')}</SelectItem>
                        <SelectItem value="medium" className="text-sm">{t('ai.medium')}</SelectItem>
                        <SelectItem value="hard" className="text-sm">{t('ai.hard')}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <Button
                  onClick={handleGenerateQuiz}
                  disabled={processing || !quota?.can_use || !selectedNoteId}
                  className="w-full h-9 sm:h-10 text-sm"
                >
                  {processing ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-1.5 sm:mr-2 animate-spin" />
                      <span className="hidden sm:inline">{t('ai.generating')}</span>
                      <span className="sm:hidden">...</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="h-4 w-4 mr-1.5 sm:mr-2" />
                      <span className="hidden sm:inline">{t('ai.generateQuizBtn')}</span>
                      <span className="sm:hidden">{t('ai.mobileGenerate')}</span>
                    </>
                  )}
                </Button>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Analyze Tab */}
        <TabsContent value="analyze" className="space-y-4 sm:space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 sm:gap-4 lg:gap-6">
            {/* Summarize Note */}
            <Card className="hover:shadow-lg transition-shadow">
              <CardHeader className="p-3 sm:p-4 lg:p-6 pb-2 sm:pb-3">
                <div className="flex items-center gap-2 sm:gap-3">
                  <div className="p-1.5 sm:p-2 bg-yellow-100 dark:bg-yellow-900/30 rounded-lg flex-shrink-0">
                    <FileText className="h-5 w-5 sm:h-6 sm:w-6 text-yellow-600" />
                  </div>
                  <div className="min-w-0">
                    <CardTitle className="text-base sm:text-lg">{t('ai.summarizeNote')}</CardTitle>
                    <CardDescription className="text-xs sm:text-sm truncate">{t('ai.createConciseSummary')}</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-3 sm:p-4 lg:p-6 pt-0 space-y-3 sm:space-y-4">
                <div>
                  <Label className="text-xs sm:text-sm">{t('ai.noteToSummarize')}</Label>
                  <Select value={selectedNoteId} onValueChange={setSelectedNoteId}>
                    <SelectTrigger className="mt-1 h-9 sm:h-10 text-sm">
                      <SelectValue placeholder={t('ai.selectNote')} />
                    </SelectTrigger>
                    <SelectContent>
                      {notes.map((note) => (
                        <SelectItem key={note.id} value={note.id.toString()} className="text-sm">
                          {note.title}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label className="text-xs sm:text-sm">{t('ai.maxLength', { count: summaryMaxLength })}</Label>
                  <Input
                    type="range"
                    min="50"
                    max="1000"
                    step="50"
                    value={summaryMaxLength}
                    onChange={(e) => setSummaryMaxLength(parseInt(e.target.value))}
                    className="mt-1"
                  />
                </div>

                <Button
                  onClick={handleSummarizeNote}
                  disabled={processing || !quota?.can_use || !selectedNoteId}
                  className="w-full h-9 sm:h-10 text-sm"
                >
                  {processing ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-1.5 sm:mr-2 animate-spin" />
                      <span className="hidden sm:inline">{t('ai.summarizing')}</span>
                      <span className="sm:hidden">...</span>
                    </>
                  ) : (
                    <>
                      <FileText className="h-4 w-4 mr-1.5 sm:mr-2" />
                      <span className="hidden sm:inline">{t('ai.summarizeBtn')}</span>
                      <span className="sm:hidden">{t('ai.mobileSummarize')}</span>
                    </>
                  )}
                </Button>
              </CardContent>
            </Card>

            {/* Extract Keywords */}
            <Card className="hover:shadow-lg transition-shadow">
              <CardHeader className="p-3 sm:p-4 lg:p-6 pb-2 sm:pb-3">
                <div className="flex items-center gap-2 sm:gap-3">
                  <div className="p-1.5 sm:p-2 bg-orange-100 dark:bg-orange-900/30 rounded-lg flex-shrink-0">
                    <Key className="h-5 w-5 sm:h-6 sm:w-6 text-orange-600" />
                  </div>
                  <div className="min-w-0">
                    <CardTitle className="text-base sm:text-lg">{t('ai.extractKeywords')}</CardTitle>
                    <CardDescription className="text-xs sm:text-sm truncate">{t('ai.identifyKeyConcepts')}</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-3 sm:p-4 lg:p-6 pt-0 space-y-3 sm:space-y-4">
                <div>
                  <Label className="text-xs sm:text-sm">{t('ai.sourceNote')}</Label>
                  <Select value={selectedNoteId} onValueChange={setSelectedNoteId}>
                    <SelectTrigger className="mt-1 h-9 sm:h-10 text-sm">
                      <SelectValue placeholder={t('ai.selectNote')} />
                    </SelectTrigger>
                    <SelectContent>
                      {notes.map((note) => (
                        <SelectItem key={note.id} value={note.id.toString()} className="text-sm">
                          {note.title}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label className="text-xs sm:text-sm">{t('ai.keywordCount')}</Label>
                  <Input
                    type="number"
                    min="3"
                    max="20"
                    value={keywordsMax}
                    onChange={(e) => setKeywordsMax(parseInt(e.target.value) || 10)}
                    className="mt-1 h-9 sm:h-10 text-sm"
                  />
                </div>

                <Button
                  onClick={handleExtractKeywords}
                  disabled={processing || !quota?.can_use || !selectedNoteId}
                  className="w-full h-9 sm:h-10 text-sm"
                >
                  {processing ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-1.5 sm:mr-2 animate-spin" />
                      <span className="hidden sm:inline">{t('ai.extracting')}</span>
                      <span className="sm:hidden">...</span>
                    </>
                  ) : (
                    <>
                      <Key className="h-4 w-4 mr-1.5 sm:mr-2" />
                      <span className="hidden sm:inline">{t('ai.extractBtn')}</span>
                      <span className="sm:hidden">{t('ai.mobileExtract')}</span>
                    </>
                  )}
                </Button>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Explain Tab */}
        <TabsContent value="explain" className="space-y-4 sm:space-y-6">
          <Card className="hover:shadow-lg transition-shadow max-w-2xl mx-auto">
            <CardHeader className="p-3 sm:p-4 lg:p-6 pb-2 sm:pb-3">
              <div className="flex items-center gap-2 sm:gap-3">
                <div className="p-1.5 sm:p-2 bg-indigo-100 dark:bg-indigo-900/30 rounded-lg flex-shrink-0">
                  <Lightbulb className="h-5 w-5 sm:h-6 sm:w-6 text-indigo-600" />
                </div>
                <div className="min-w-0">
                  <CardTitle className="text-base sm:text-lg">{t('ai.explainConcept')}</CardTitle>
                  <CardDescription className="text-xs sm:text-sm truncate">{t('ai.getPedagogicalExplanation')}</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-3 sm:p-4 lg:p-6 pt-0 space-y-3 sm:space-y-4">
              <div>
                <Label className="text-xs sm:text-sm">{t('ai.conceptToExplain')}</Label>
                <Input
                  placeholder={t('ai.conceptPlaceholder')}
                  value={concept}
                  onChange={(e) => setConcept(e.target.value)}
                  className="mt-1 h-9 sm:h-10 text-sm"
                />
              </div>

              <div>
                <Label className="text-xs sm:text-sm">{t('ai.context')}</Label>
                <Textarea
                  placeholder={t('ai.contextPlaceholder')}
                  value={conceptContext}
                  onChange={(e) => setConceptContext(e.target.value)}
                  rows={3}
                  className="mt-1 text-sm resize-none"
                />
              </div>

              <div>
                <Label className="text-xs sm:text-sm">{t('ai.knowledgeLevel')}</Label>
                <Select value={conceptLevel} onValueChange={(v) => setConceptLevel(v as KnowledgeLevel)}>
                  <SelectTrigger className="mt-1 h-9 sm:h-10 text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="beginner" className="text-sm">{t('ai.beginner')}</SelectItem>
                    <SelectItem value="intermediate" className="text-sm">{t('ai.intermediate')}</SelectItem>
                    <SelectItem value="advanced" className="text-sm">{t('ai.advanced')}</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <Button
                onClick={handleExplainConcept}
                disabled={processing || !quota?.can_use || !concept.trim()}
                className="w-full h-9 sm:h-10 text-sm"
              >
                {processing ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-1.5 sm:mr-2 animate-spin" />
                    <span className="hidden sm:inline">{t('ai.explaining')}</span>
                    <span className="sm:hidden">...</span>
                  </>
                ) : (
                  <>
                    <Lightbulb className="h-4 w-4 mr-1.5 sm:mr-2" />
                    <span className="hidden sm:inline">{t('ai.explainBtn')}</span>
                    <span className="sm:hidden">{t('ai.mobileExplain')}</span>
                  </>
                )}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Features Overview */}
      <Card className="mt-4 sm:mt-6 bg-gradient-to-br from-blue-50 to-purple-50 dark:from-blue-900/20 dark:to-purple-900/20">
        <CardHeader className="p-3 sm:p-4 lg:p-6 pb-2 sm:pb-3">
          <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
            <TrendingUp className="h-4 w-4 sm:h-5 sm:w-5" />
            {t('ai.availableFeatures')}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-3 sm:p-4 lg:p-6 pt-0">
          <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 gap-2 sm:gap-3 lg:gap-4">
            <div className="flex items-start gap-2 sm:gap-3 p-2 sm:p-3 bg-white dark:bg-gray-800 rounded-lg">
              <CheckCircle className="h-4 w-4 sm:h-5 sm:w-5 text-green-600 mt-0.5 flex-shrink-0" />
              <div className="min-w-0">
                <div className="font-semibold text-xs sm:text-sm truncate">{t('ai.flashcardGeneration')}</div>
                <div className="text-[10px] sm:text-xs text-gray-600 dark:text-gray-400 line-clamp-2">{t('ai.flashcardGenerationDesc')}</div>
              </div>
            </div>
            <div className="flex items-start gap-2 sm:gap-3 p-2 sm:p-3 bg-white dark:bg-gray-800 rounded-lg">
              <CheckCircle className="h-4 w-4 sm:h-5 sm:w-5 text-green-600 mt-0.5 flex-shrink-0" />
              <div className="min-w-0">
                <div className="font-semibold text-xs sm:text-sm truncate">{t('ai.quizGeneration')}</div>
                <div className="text-[10px] sm:text-xs text-gray-600 dark:text-gray-400 line-clamp-2">{t('ai.quizGenerationDesc')}</div>
              </div>
            </div>
            <div className="flex items-start gap-2 sm:gap-3 p-2 sm:p-3 bg-white dark:bg-gray-800 rounded-lg">
              <CheckCircle className="h-4 w-4 sm:h-5 sm:w-5 text-green-600 mt-0.5 flex-shrink-0" />
              <div className="min-w-0">
                <div className="font-semibold text-xs sm:text-sm truncate">{t('ai.noteSummary')}</div>
                <div className="text-[10px] sm:text-xs text-gray-600 dark:text-gray-400 line-clamp-2">{t('ai.noteSummaryDesc')}</div>
              </div>
            </div>
            <div className="flex items-start gap-2 sm:gap-3 p-2 sm:p-3 bg-white dark:bg-gray-800 rounded-lg">
              <CheckCircle className="h-4 w-4 sm:h-5 sm:w-5 text-green-600 mt-0.5 flex-shrink-0" />
              <div className="min-w-0">
                <div className="font-semibold text-xs sm:text-sm truncate">{t('ai.keywordExtraction')}</div>
                <div className="text-[10px] sm:text-xs text-gray-600 dark:text-gray-400 line-clamp-2">{t('ai.keywordExtractionDesc')}</div>
              </div>
            </div>
            <div className="flex items-start gap-2 sm:gap-3 p-2 sm:p-3 bg-white dark:bg-gray-800 rounded-lg">
              <CheckCircle className="h-4 w-4 sm:h-5 sm:w-5 text-green-600 mt-0.5 flex-shrink-0" />
              <div className="min-w-0">
                <div className="font-semibold text-xs sm:text-sm truncate">{t('ai.conceptExplanation')}</div>
                <div className="text-[10px] sm:text-xs text-gray-600 dark:text-gray-400 line-clamp-2">{t('ai.conceptExplanationDesc')}</div>
              </div>
            </div>
            <div className="flex items-start gap-2 sm:gap-3 p-2 sm:p-3 bg-white dark:bg-gray-800 rounded-lg">
              <CheckCircle className="h-4 w-4 sm:h-5 sm:w-5 text-green-600 mt-0.5 flex-shrink-0" />
              <div className="min-w-0">
                <div className="font-semibold text-xs sm:text-sm truncate">{t('ai.latexSupport')}</div>
                <div className="text-[10px] sm:text-xs text-gray-600 dark:text-gray-400 line-clamp-2">{t('ai.latexSupportDesc')}</div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
