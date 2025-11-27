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
  CheckCircle
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

interface AIQuota {
  subscription_type: string
  max_requests_per_day: number
  requests_used_today: number
  requests_remaining: number
  total_requests_all_time: number
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

      setQuota(quotaRes.data)
      setNotes(notesRes.data.notes || [])
    } catch (error: any) {
      console.error('Error fetching data:', error)
      toast({
        title: 'Erreur',
        description: 'Impossible de charger les données',
        variant: 'destructive'
      })
    } finally {
      setLoading(false)
    }
  }

  const handleGenerateFlashcards = async () => {
    if (!selectedNoteId) {
      toast({
        title: 'Note manquante',
        description: 'Veuillez sélectionner une note',
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
        title: 'Flashcards générées',
        description: `${response.data.count} flashcards créées avec succès! +10 XP`,
      })

      // Rafraîchir le quota
      const quotaRes = await api.get('/ai/quota')
      setQuota(quotaRes.data)

      router.push('/flashcards')
    } catch (error: any) {
      toast({
        title: 'Erreur',
        description: error.response?.data?.detail || 'Erreur lors de la génération',
        variant: 'destructive'
      })
    } finally {
      setProcessing(false)
    }
  }

  const handleGenerateQuiz = async () => {
    if (!selectedNoteId) {
      toast({
        title: 'Note manquante',
        description: 'Veuillez sélectionner une note',
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
        title: 'Quiz généré',
        description: `Quiz créé avec succès! +15 XP`,
      })

      // Rafraîchir le quota
      const quotaRes = await api.get('/ai/quota')
      setQuota(quotaRes.data)

      router.push(`/quizzes/${response.data.quiz.id}`)
    } catch (error: any) {
      toast({
        title: 'Erreur',
        description: error.response?.data?.detail || 'Erreur lors de la génération',
        variant: 'destructive'
      })
    } finally {
      setProcessing(false)
    }
  }

  const handleSummarizeNote = async () => {
    if (!selectedNoteId) {
      toast({
        title: 'Note manquante',
        description: 'Veuillez sélectionner une note',
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
        title: 'Résumé généré',
        description: `Résumé de ${response.data.word_count} mots créé`,
      })

      // Afficher le résumé dans une alerte
      alert(`Résumé de "${response.data.note_title}":\n\n${response.data.summary}`)

      // Rafraîchir le quota
      const quotaRes = await api.get('/ai/quota')
      setQuota(quotaRes.data)
    } catch (error: any) {
      toast({
        title: 'Erreur',
        description: error.response?.data?.detail || 'Erreur lors du résumé',
        variant: 'destructive'
      })
    } finally {
      setProcessing(false)
    }
  }

  const handleExtractKeywords = async () => {
    if (!selectedNoteId) {
      toast({
        title: 'Note manquante',
        description: 'Veuillez sélectionner une note',
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
        title: 'Mots-clés extraits',
        description: `${response.data.keywords.length} mots-clés trouvés`,
      })

      // Afficher les mots-clés
      alert(`Mots-clés de "${response.data.note_title}":\n\n${response.data.keywords.join(', ')}`)

      // Rafraîchir le quota
      const quotaRes = await api.get('/ai/quota')
      setQuota(quotaRes.data)
    } catch (error: any) {
      toast({
        title: 'Erreur',
        description: error.response?.data?.detail || 'Erreur lors de l\'extraction',
        variant: 'destructive'
      })
    } finally {
      setProcessing(false)
    }
  }

  const handleExplainConcept = async () => {
    if (!concept.trim()) {
      toast({
        title: 'Concept manquant',
        description: 'Veuillez entrer un concept à expliquer',
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
        title: 'Explication générée',
      })

      // Afficher l'explication
      alert(`Explication de "${response.data.concept}":\n\n${response.data.explanation}`)

      // Rafraîchir le quota
      const quotaRes = await api.get('/ai/quota')
      setQuota(quotaRes.data)
    } catch (error: any) {
      toast({
        title: 'Erreur',
        description: error.response?.data?.detail || 'Erreur lors de l\'explication',
        variant: 'destructive'
      })
    } finally {
      setProcessing(false)
    }
  }

  const getSubscriptionColor = (type: string) => {
    const colors: Record<string, string> = {
      free: 'bg-gray-100 text-gray-800',
      premium: 'bg-blue-100 text-blue-800',
      premium_plus: 'bg-purple-100 text-purple-800',
      institutional: 'bg-green-100 text-green-800'
    }
    return colors[type.toLowerCase()] || colors.free
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
    <div className="container mx-auto p-6 max-w-7xl">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-2">
          <div className="p-3 bg-gradient-to-br from-purple-500 to-pink-500 rounded-lg">
            <Sparkles className="h-8 w-8 text-white" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Hub IA</h1>
            <p className="text-gray-600">Transformez vos notes avec l'intelligence artificielle</p>
          </div>
        </div>
      </div>

      {/* Quota Card */}
      {quota && (
        <Card className="mb-6 border-2 border-purple-200 bg-gradient-to-br from-purple-50 to-pink-50">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Zap className="h-5 w-5 text-purple-600" />
                  Quota IA
                </CardTitle>
                <CardDescription>Utilisation quotidienne de l'IA</CardDescription>
              </div>
              <Badge className={getSubscriptionColor(quota.subscription_type)}>
                {quota.subscription_type.toUpperCase()}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <div className="flex justify-between text-sm mb-2">
                <span className="text-gray-600">
                  {quota.requests_used_today} / {quota.max_requests_per_day} requêtes utilisées
                </span>
                <span className="font-semibold text-purple-600">
                  {quota.requests_remaining} restantes
                </span>
              </div>
              <Progress value={quotaPercentage} className="h-3" />
            </div>

            <div className="grid grid-cols-2 gap-4 pt-2">
              <div className="text-center p-3 bg-white rounded-lg">
                <div className="text-2xl font-bold text-purple-600">
                  {quota.total_requests_all_time}
                </div>
                <div className="text-xs text-gray-600">Requêtes totales</div>
              </div>
              <div className="text-center p-3 bg-white rounded-lg">
                <div className="text-2xl font-bold text-green-600">
                  {quota.requests_remaining}
                </div>
                <div className="text-xs text-gray-600">Restantes aujourd'hui</div>
              </div>
            </div>

            {!quota.can_use && (
              <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg">
                <AlertCircle className="h-5 w-5 text-red-600" />
                <span className="text-sm text-red-700">
                  Quota quotidien atteint. Revenez demain ou passez à Premium!
                </span>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* AI Features Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="generate">Générer</TabsTrigger>
          <TabsTrigger value="analyze">Analyser</TabsTrigger>
          <TabsTrigger value="explain">Expliquer</TabsTrigger>
        </TabsList>

        {/* Generate Tab */}
        <TabsContent value="generate" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Generate Flashcards */}
            <Card className="hover:shadow-lg transition-shadow">
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-blue-100 rounded-lg">
                      <CreditCard className="h-6 w-6 text-blue-600" />
                    </div>
                    <div>
                      <CardTitle>Générer des Flashcards</CardTitle>
                      <CardDescription>Créez des flashcards depuis vos notes</CardDescription>
                    </div>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label>Note source</Label>
                  <Select value={selectedNoteId} onValueChange={setSelectedNoteId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Sélectionner une note" />
                    </SelectTrigger>
                    <SelectContent>
                      {notes.map((note) => (
                        <SelectItem key={note.id} value={note.id.toString()}>
                          {note.title}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label>Nombre de flashcards (1-20)</Label>
                  <Input
                    type="number"
                    min="1"
                    max="20"
                    value={flashcardCount}
                    onChange={(e) => setFlashcardCount(parseInt(e.target.value) || 10)}
                  />
                </div>

                <div>
                  <Label>Difficulté</Label>
                  <Select value={difficulty} onValueChange={(v) => setDifficulty(v as Difficulty)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="easy">Facile</SelectItem>
                      <SelectItem value="medium">Moyen</SelectItem>
                      <SelectItem value="hard">Difficile</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <Button
                  onClick={handleGenerateFlashcards}
                  disabled={processing || !quota?.can_use || !selectedNoteId}
                  className="w-full"
                >
                  {processing ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Génération en cours...
                    </>
                  ) : (
                    <>
                      <Sparkles className="h-4 w-4 mr-2" />
                      Générer les Flashcards
                    </>
                  )}
                </Button>
              </CardContent>
            </Card>

            {/* Generate Quiz */}
            <Card className="hover:shadow-lg transition-shadow">
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-green-100 rounded-lg">
                      <Brain className="h-6 w-6 text-green-600" />
                    </div>
                    <div>
                      <CardTitle>Générer un Quiz</CardTitle>
                      <CardDescription>Créez un quiz depuis vos notes</CardDescription>
                    </div>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label>Note source</Label>
                  <Select value={selectedNoteId} onValueChange={setSelectedNoteId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Sélectionner une note" />
                    </SelectTrigger>
                    <SelectContent>
                      {notes.map((note) => (
                        <SelectItem key={note.id} value={note.id.toString()}>
                          {note.title}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label>Nombre de questions (5-20)</Label>
                  <Input
                    type="number"
                    min="5"
                    max="20"
                    value={quizQuestionCount}
                    onChange={(e) => setQuizQuestionCount(parseInt(e.target.value) || 10)}
                  />
                </div>

                <div>
                  <Label>Difficulté</Label>
                  <Select value={difficulty} onValueChange={(v) => setDifficulty(v as Difficulty)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="easy">Facile</SelectItem>
                      <SelectItem value="medium">Moyen</SelectItem>
                      <SelectItem value="hard">Difficile</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <Button
                  onClick={handleGenerateQuiz}
                  disabled={processing || !quota?.can_use || !selectedNoteId}
                  className="w-full"
                >
                  {processing ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Génération en cours...
                    </>
                  ) : (
                    <>
                      <Sparkles className="h-4 w-4 mr-2" />
                      Générer le Quiz
                    </>
                  )}
                </Button>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Analyze Tab */}
        <TabsContent value="analyze" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Summarize Note */}
            <Card className="hover:shadow-lg transition-shadow">
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-yellow-100 rounded-lg">
                    <FileText className="h-6 w-6 text-yellow-600" />
                  </div>
                  <div>
                    <CardTitle>Résumer une Note</CardTitle>
                    <CardDescription>Créez un résumé concis</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label>Note à résumer</Label>
                  <Select value={selectedNoteId} onValueChange={setSelectedNoteId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Sélectionner une note" />
                    </SelectTrigger>
                    <SelectContent>
                      {notes.map((note) => (
                        <SelectItem key={note.id} value={note.id.toString()}>
                          {note.title}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label>Longueur max (mots): {summaryMaxLength}</Label>
                  <Input
                    type="range"
                    min="50"
                    max="1000"
                    step="50"
                    value={summaryMaxLength}
                    onChange={(e) => setSummaryMaxLength(parseInt(e.target.value))}
                  />
                </div>

                <Button
                  onClick={handleSummarizeNote}
                  disabled={processing || !quota?.can_use || !selectedNoteId}
                  className="w-full"
                >
                  {processing ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Résumé en cours...
                    </>
                  ) : (
                    <>
                      <FileText className="h-4 w-4 mr-2" />
                      Résumer la Note
                    </>
                  )}
                </Button>
              </CardContent>
            </Card>

            {/* Extract Keywords */}
            <Card className="hover:shadow-lg transition-shadow">
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-orange-100 rounded-lg">
                    <Key className="h-6 w-6 text-orange-600" />
                  </div>
                  <div>
                    <CardTitle>Extraire des Mots-clés</CardTitle>
                    <CardDescription>Identifiez les concepts clés</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label>Note source</Label>
                  <Select value={selectedNoteId} onValueChange={setSelectedNoteId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Sélectionner une note" />
                    </SelectTrigger>
                    <SelectContent>
                      {notes.map((note) => (
                        <SelectItem key={note.id} value={note.id.toString()}>
                          {note.title}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label>Nombre de mots-clés (3-20)</Label>
                  <Input
                    type="number"
                    min="3"
                    max="20"
                    value={keywordsMax}
                    onChange={(e) => setKeywordsMax(parseInt(e.target.value) || 10)}
                  />
                </div>

                <Button
                  onClick={handleExtractKeywords}
                  disabled={processing || !quota?.can_use || !selectedNoteId}
                  className="w-full"
                >
                  {processing ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Extraction en cours...
                    </>
                  ) : (
                    <>
                      <Key className="h-4 w-4 mr-2" />
                      Extraire les Mots-clés
                    </>
                  )}
                </Button>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Explain Tab */}
        <TabsContent value="explain" className="space-y-6">
          <Card className="hover:shadow-lg transition-shadow max-w-2xl mx-auto">
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="p-2 bg-indigo-100 rounded-lg">
                  <Lightbulb className="h-6 w-6 text-indigo-600" />
                </div>
                <div>
                  <CardTitle>Expliquer un Concept</CardTitle>
                  <CardDescription>Obtenez une explication pédagogique</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label>Concept à expliquer</Label>
                <Input
                  placeholder="Ex: La photosynthèse, Les intégrales, etc."
                  value={concept}
                  onChange={(e) => setConcept(e.target.value)}
                />
              </div>

              <div>
                <Label>Contexte (optionnel)</Label>
                <Textarea
                  placeholder="Ajoutez du contexte pour une explication plus précise..."
                  value={conceptContext}
                  onChange={(e) => setConceptContext(e.target.value)}
                  rows={3}
                />
              </div>

              <div>
                <Label>Niveau de connaissance</Label>
                <Select value={conceptLevel} onValueChange={(v) => setConceptLevel(v as KnowledgeLevel)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="beginner">Débutant</SelectItem>
                    <SelectItem value="intermediate">Intermédiaire</SelectItem>
                    <SelectItem value="advanced">Avancé</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <Button
                onClick={handleExplainConcept}
                disabled={processing || !quota?.can_use || !concept.trim()}
                className="w-full"
              >
                {processing ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Explication en cours...
                  </>
                ) : (
                  <>
                    <Lightbulb className="h-4 w-4 mr-2" />
                    Expliquer le Concept
                  </>
                )}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Features Overview */}
      <Card className="mt-6 bg-gradient-to-br from-blue-50 to-purple-50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Fonctionnalités IA Disponibles
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div className="flex items-start gap-3 p-3 bg-white rounded-lg">
              <CheckCircle className="h-5 w-5 text-green-600 mt-0.5" />
              <div>
                <div className="font-semibold text-sm">Génération de Flashcards</div>
                <div className="text-xs text-gray-600">1-20 cartes par note</div>
              </div>
            </div>
            <div className="flex items-start gap-3 p-3 bg-white rounded-lg">
              <CheckCircle className="h-5 w-5 text-green-600 mt-0.5" />
              <div>
                <div className="font-semibold text-sm">Génération de Quiz</div>
                <div className="text-xs text-gray-600">5-20 questions variées</div>
              </div>
            </div>
            <div className="flex items-start gap-3 p-3 bg-white rounded-lg">
              <CheckCircle className="h-5 w-5 text-green-600 mt-0.5" />
              <div>
                <div className="font-semibold text-sm">Résumé de Notes</div>
                <div className="text-xs text-gray-600">Résumés concis et précis</div>
              </div>
            </div>
            <div className="flex items-start gap-3 p-3 bg-white rounded-lg">
              <CheckCircle className="h-5 w-5 text-green-600 mt-0.5" />
              <div>
                <div className="font-semibold text-sm">Extraction de Mots-clés</div>
                <div className="text-xs text-gray-600">3-20 mots-clés pertinents</div>
              </div>
            </div>
            <div className="flex items-start gap-3 p-3 bg-white rounded-lg">
              <CheckCircle className="h-5 w-5 text-green-600 mt-0.5" />
              <div>
                <div className="font-semibold text-sm">Explication de Concepts</div>
                <div className="text-xs text-gray-600">Explications pédagogiques</div>
              </div>
            </div>
            <div className="flex items-start gap-3 p-3 bg-white rounded-lg">
              <CheckCircle className="h-5 w-5 text-green-600 mt-0.5" />
              <div>
                <div className="font-semibold text-sm">Support LaTeX</div>
                <div className="text-xs text-gray-600">Formules mathématiques</div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
