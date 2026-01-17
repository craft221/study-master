'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Save, X, Plus, Trash2, ChevronDown, ChevronUp, Clock, Award, Languages, CloudOff } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useLanguage } from '@/contexts/LanguageContext'
import { useOfflineContext } from '@/components/providers/OfflineProvider'
import { offlineStorage, STORES } from '@/lib/offlineStorage'
import { syncService, generateTempId } from '@/services/syncService'

const LANGUAGE_OPTIONS: { code: string; label: string; flag: string }[] = [
  { code: 'fr', label: 'Français', flag: '🇫🇷' },
  { code: 'en', label: 'English', flag: '🇬🇧' },
  { code: 'es', label: 'Español', flag: '🇪🇸' },
]
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Badge } from '@/components/ui/badge'
import api from '@/lib/api'
import { useToast } from '@/hooks/use-toast'

interface Subject {
  id: number
  name: string
  color: string
}

type QuestionType = 'multiple_choice' | 'true_false' | 'short_answer'
type QuizDifficulty = 'easy' | 'medium' | 'hard'

interface Question {
  question: string
  type: QuestionType
  options?: string[]
  correct_answer: string
  explanation?: string
  points: number
}

export default function NewQuizPage() {
  const router = useRouter()
  const { toast } = useToast()
  const { locale, t } = useLanguage()
  const { isOnline } = useOfflineContext()

  const [loading, setLoading] = useState(false)
  const [subjects, setSubjects] = useState<Subject[]>([])
  const [selectedSubject, setSelectedSubject] = useState('')
  const [expandedQuestions, setExpandedQuestions] = useState<number[]>([0])
  const [language, setLanguage] = useState<string>(locale || 'fr')

  // Quiz Info
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [difficulty, setDifficulty] = useState<QuizDifficulty>('medium')
  const [passingScore, setPassingScore] = useState(60)
  const [isTimed, setIsTimed] = useState(false)
  const [timeLimitMinutes, setTimeLimitMinutes] = useState(30)
  const [showCorrectAnswers, setShowCorrectAnswers] = useState(true)
  const [randomizeQuestions, setRandomizeQuestions] = useState(false)
  const [randomizeOptions, setRandomizeOptions] = useState(false)

  const [questions, setQuestions] = useState<Question[]>([
    {
      question: '',
      type: 'multiple_choice',
      options: ['', '', '', ''],
      correct_answer: '',
      explanation: '',
      points: 10
    }
  ])

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

  const addQuestion = () => {
    const newIndex = questions.length
    setQuestions([
      ...questions,
      {
        question: '',
        type: 'multiple_choice',
        options: ['', '', '', ''],
        correct_answer: '',
        explanation: '',
        points: 10
      }
    ])
    setExpandedQuestions([...expandedQuestions, newIndex])
  }

  const removeQuestion = (index: number) => {
    if (questions.length === 1) {
      toast({
        title: t('newQuizPage.warning'),
        description: t('newQuizPage.atLeastOneQuestion'),
        variant: 'destructive'
      })
      return
    }
    setQuestions(questions.filter((_, i) => i !== index))
    setExpandedQuestions(expandedQuestions.filter(i => i !== index).map(i => i > index ? i - 1 : i))
  }

  const updateQuestion = (index: number, field: keyof Question, value: any) => {
    const updated = [...questions]
    updated[index] = { ...updated[index], [field]: value }

    // Si on change le type de question, adapter les champs
    if (field === 'type') {
      if (value === 'true_false') {
        updated[index].options = ['Vrai', 'Faux']
      } else if (value === 'multiple_choice' && updated[index].options?.length !== 4) {
        updated[index].options = ['', '', '', '']
      } else if (value === 'short_answer') {
        updated[index].options = undefined
      }
    }

    setQuestions(updated)
  }

  const updateOption = (questionIndex: number, optionIndex: number, value: string) => {
    const updated = [...questions]
    if (updated[questionIndex].options) {
      updated[questionIndex].options![optionIndex] = value
    }
    setQuestions(updated)
  }

  const addOption = (questionIndex: number) => {
    const updated = [...questions]
    if (updated[questionIndex].options) {
      updated[questionIndex].options!.push('')
    }
    setQuestions(updated)
  }

  const removeOption = (questionIndex: number, optionIndex: number) => {
    const updated = [...questions]
    if (updated[questionIndex].options && updated[questionIndex].options!.length > 2) {
      updated[questionIndex].options!.splice(optionIndex, 1)
    }
    setQuestions(updated)
  }

  const toggleExpand = (index: number) => {
    setExpandedQuestions(prev =>
      prev.includes(index)
        ? prev.filter(i => i !== index)
        : [...prev, index]
    )
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!selectedSubject || !title) {
      toast({
        title: t('newQuizPage.missingFields'),
        description: t('newQuizPage.fillSubjectAndTitle'),
        variant: 'destructive'
      })
      return
    }

    // Valider les questions
    const validQuestions = questions.filter(q => {
      if (!q.question.trim() || !q.correct_answer.trim()) return false
      if (q.type === 'multiple_choice' || q.type === 'true_false') {
        return q.options && q.options.some(opt => opt.trim())
      }
      return true
    })

    if (validQuestions.length === 0) {
      toast({
        title: t('newQuizPage.noValidQuestion'),
        description: t('newQuizPage.addCompleteQuestion'),
        variant: 'destructive'
      })
      return
    }

    setLoading(true)
    try {
      const payload = {
        subject_id: parseInt(selectedSubject),
        title,
        description: description || null,
        quiz_type: 'practice',
        difficulty,
        questions: validQuestions.map(q => ({
          question: q.question,
          type: q.type,
          options: q.type !== 'short_answer' ? q.options?.filter(opt => opt.trim()) : undefined,
          correct_answer: q.correct_answer,
          explanation: q.explanation || null,
          points: q.points
        })),
        passing_score: passingScore,
        time_limit_minutes: isTimed ? timeLimitMinutes : null,
        is_timed: isTimed,
        show_correct_answers: showCorrectAnswers,
        randomize_questions: randomizeQuestions,
        randomize_options: randomizeOptions,
        allow_multiple_attempts: true,
        is_ai_generated: false,
        language: language
      }

      if (isOnline) {
        // Mode en ligne: créer directement sur le serveur
        const response = await api.post('/quizzes/', payload)

        toast({
          title: t('newQuizPage.quizCreated'),
          description: t('newQuizPage.quizCreatedWith', { title, count: validQuestions.length }),
        })
        router.push(`/quizzes/${response.data.id}`)
      } else {
        // Mode hors-ligne: créer localement avec un ID temporaire
        const tempId = generateTempId()
        const now = new Date().toISOString()

        // Trouver les infos du subject pour l'affichage local
        const subject = subjects.find(s => s.id.toString() === selectedSubject)

        const offlineQuiz = {
          id: tempId,
          _tempId: tempId,
          ...payload,
          subject: subject ? { id: subject.id, name: subject.name, color: subject.color } : null,
          question_count: validQuestions.length,
          total_points: validQuestions.reduce((sum, q) => sum + q.points, 0),
          attempt_count: 0,
          best_score: null,
          average_score: null,
          created_at: now,
          updated_at: now,
          _isOffline: true,
        }

        // Sauvegarder dans IndexedDB
        await offlineStorage.saveQuiz(offlineQuiz)

        // Ajouter à la queue de synchronisation
        await syncService.queueAction(
          STORES.QUIZZES,
          'create',
          '/api/v1/quizzes/',
          'POST',
          { ...payload, _tempId: tempId }
        )

        toast({
          title: t('newQuizPage.quizCreatedOffline'),
          description: t('newQuizPage.quizWillSync', { title }),
        })
        router.push('/quizzes')
      }
    } catch (error: any) {
      console.error('Erreur:', error)
      toast({
        title: t('common.error'),
        description: error.response?.data?.detail || t('common.error'),
        variant: 'destructive'
      })
    } finally {
      setLoading(false)
    }
  }

  const totalPoints = questions.reduce((sum, q) => sum + q.points, 0)

  return (
    <div className="max-w-6xl mx-auto px-3 sm:px-4 lg:px-6 py-4 sm:py-6 space-y-4 sm:space-y-6">
      {/* Offline Banner */}
      {!isOnline && (
        <div className="bg-orange-50 dark:bg-orange-900/30 border border-orange-200 dark:border-orange-800 rounded-lg p-3 sm:p-4">
          <div className="flex items-start gap-2 sm:gap-3">
            <CloudOff className="h-4 w-4 sm:h-5 sm:w-5 text-orange-600 dark:text-orange-400 shrink-0 mt-0.5" />
            <div className="min-w-0">
              <p className="font-medium text-orange-900 dark:text-orange-100 text-sm sm:text-base">
                {t('newQuizPage.offlineMode')}
              </p>
              <p className="text-xs sm:text-sm text-orange-700 dark:text-orange-300">
                {t('newQuizPage.offlineSaveMessage')}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4">
        <div className="flex items-start sm:items-center gap-2 sm:gap-3 min-w-0">
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold text-gray-900 dark:text-white">{t('newQuizPage.title')}</h1>
              {!isOnline && (
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400 shrink-0">
                  <CloudOff className="w-3 h-3 mr-1" />
                  <span className="hidden sm:inline">{t('newQuizPage.offline')}</span>
                </span>
              )}
            </div>
            <p className="text-gray-600 dark:text-gray-400 mt-0.5 sm:mt-1 text-sm sm:text-base">{t('newQuizPage.subtitle')}</p>
          </div>
        </div>
        <Button variant="outline" onClick={() => router.back()} className="self-end sm:self-auto shrink-0">
          <X className="h-4 w-4 sm:mr-2" />
          <span className="hidden sm:inline">{t('newQuizPage.cancel')}</span>
        </Button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-6">
        {/* Quiz Info */}
        <Card>
          <CardHeader className="p-4 sm:p-6">
            <CardTitle className="text-base sm:text-lg">{t('newQuizPage.quizInfo')}</CardTitle>
          </CardHeader>
          <CardContent className="p-4 sm:p-6 pt-0 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
              <div className="sm:col-span-2">
                <Label htmlFor="title" className="text-sm">
                  {t('newQuizPage.titleLabel')} <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="title"
                  placeholder={t('newQuizPage.titlePlaceholder')}
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  required
                  className="mt-1.5"
                />
              </div>

              <div className="sm:col-span-2">
                <Label htmlFor="description" className="text-sm">{t('newQuizPage.descriptionLabel')}</Label>
                <Textarea
                  id="description"
                  placeholder={t('newQuizPage.descriptionPlaceholder')}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={2}
                  className="mt-1.5"
                />
              </div>

              <div>
                <Label htmlFor="subject" className="text-sm">
                  {t('newQuizPage.subjectLabel')} <span className="text-red-500">*</span>
                </Label>
                <Select value={selectedSubject} onValueChange={setSelectedSubject}>
                  <SelectTrigger className="mt-1.5">
                    <SelectValue placeholder={t('newQuizPage.selectSubject')} />
                  </SelectTrigger>
                  <SelectContent>
                    {subjects.map((subject) => (
                      <SelectItem key={subject.id} value={subject.id.toString()}>
                        <div className="flex items-center gap-2">
                          <div
                            className="w-3 h-3 rounded-full shrink-0"
                            style={{ backgroundColor: subject.color }}
                          />
                          <span className="truncate">{subject.name}</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="difficulty" className="text-sm">{t('newQuizPage.difficultyLabel')}</Label>
                <Select value={difficulty} onValueChange={(value) => setDifficulty(value as QuizDifficulty)}>
                  <SelectTrigger className="mt-1.5">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="easy">
                      <Badge variant="secondary">{t('newQuizPage.easy')}</Badge>
                    </SelectItem>
                    <SelectItem value="medium">
                      <Badge variant="default">{t('newQuizPage.medium')}</Badge>
                    </SelectItem>
                    <SelectItem value="hard">
                      <Badge variant="destructive">{t('newQuizPage.hard')}</Badge>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Language Selector */}
              <div className="sm:col-span-2">
                <Label className="flex items-center gap-1.5 sm:gap-2 mb-2 text-sm">
                  <Languages className="h-4 w-4" />
                  {t('newQuizPage.languageLabel')}
                </Label>
                <div className="grid grid-cols-3 gap-2 sm:flex sm:gap-3">
                  {LANGUAGE_OPTIONS.map((lang) => (
                    <button
                      key={lang.code}
                      type="button"
                      onClick={() => setLanguage(lang.code)}
                      className={`flex items-center justify-center gap-1 sm:gap-2 px-2 sm:px-4 py-2 rounded-lg border-2 transition text-sm ${
                        language === lang.code
                          ? 'border-primary bg-primary/10 text-primary dark:bg-primary/20'
                          : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600 text-gray-600 dark:text-gray-400'
                      }`}
                    >
                      <span className="text-base sm:text-lg">{lang.flag}</span>
                      <span className="font-medium text-xs sm:text-sm">{lang.label}</span>
                    </button>
                  ))}
                </div>
                <p className="mt-1.5 sm:mt-2 text-[10px] sm:text-xs text-gray-500 dark:text-gray-400">
                  {t('newQuizPage.languageNotice')}
                </p>
              </div>

              <div>
                <Label htmlFor="passingScore" className="text-sm flex items-center gap-1">
                  {t('newQuizPage.passingScore')} <Award className="inline h-3.5 w-3.5 sm:h-4 sm:w-4" />
                </Label>
                <Input
                  id="passingScore"
                  type="number"
                  min="0"
                  max="100"
                  value={passingScore}
                  onChange={(e) => setPassingScore(parseInt(e.target.value) || 60)}
                  className="mt-1.5"
                />
              </div>

              <div className="flex items-center space-x-2 sm:space-x-3">
                <Switch
                  id="timed"
                  checked={isTimed}
                  onCheckedChange={setIsTimed}
                />
                <Label htmlFor="timed" className="flex items-center gap-1.5 sm:gap-2 text-sm cursor-pointer">
                  <Clock className="h-4 w-4" />
                  {t('newQuizPage.timedQuiz')}
                </Label>
              </div>

              {isTimed && (
                <div>
                  <Label htmlFor="timeLimit" className="text-sm">{t('newQuizPage.timeLimit')}</Label>
                  <Input
                    id="timeLimit"
                    type="number"
                    min="1"
                    max="480"
                    value={timeLimitMinutes}
                    onChange={(e) => setTimeLimitMinutes(parseInt(e.target.value) || 30)}
                    className="mt-1.5"
                  />
                </div>
              )}
            </div>

            <div className="space-y-3 pt-4 border-t border-gray-200 dark:border-gray-700">
              <div className="flex items-center justify-between gap-2">
                <Label htmlFor="showAnswers" className="text-sm cursor-pointer flex-1">{t('newQuizPage.showCorrectAnswers')}</Label>
                <Switch
                  id="showAnswers"
                  checked={showCorrectAnswers}
                  onCheckedChange={setShowCorrectAnswers}
                />
              </div>

              <div className="flex items-center justify-between gap-2">
                <Label htmlFor="randomizeQ" className="text-sm cursor-pointer flex-1">{t('newQuizPage.shuffleQuestions')}</Label>
                <Switch
                  id="randomizeQ"
                  checked={randomizeQuestions}
                  onCheckedChange={setRandomizeQuestions}
                />
              </div>

              <div className="flex items-center justify-between gap-2">
                <Label htmlFor="randomizeO" className="text-sm cursor-pointer flex-1">{t('newQuizPage.shuffleOptions')}</Label>
                <Switch
                  id="randomizeO"
                  checked={randomizeOptions}
                  onCheckedChange={setRandomizeOptions}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Questions */}
        <div className="space-y-3 sm:space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 sm:gap-4">
            <div>
              <h2 className="text-lg sm:text-xl font-semibold">{t('newQuizPage.questionsTitle')} ({questions.length})</h2>
              <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400">{t('newQuizPage.totalPoints', { count: totalPoints })}</p>
            </div>
            <Button type="button" onClick={addQuestion} variant="outline" size="sm" className="self-start sm:self-auto">
              <Plus className="h-4 w-4 mr-1.5 sm:mr-2" />
              <span className="text-sm">{t('newQuizPage.addQuestion')}</span>
            </Button>
          </div>

          {questions.map((question, qIndex) => {
            const isExpanded = expandedQuestions.includes(qIndex)
            const isValid = question.question.trim() && question.correct_answer.trim()

            return (
              <Card
                key={qIndex}
                className={`border-l-4 ${isValid ? 'border-l-green-500' : 'border-l-gray-300 dark:border-l-gray-600'}`}
              >
                <CardHeader className="p-3 sm:p-6">
                  <div className="flex items-start sm:items-center justify-between gap-2">
                    <CardTitle className="text-sm sm:text-lg flex flex-wrap items-center gap-1.5 sm:gap-2">
                      <span>{t('newQuizPage.question')} {qIndex + 1}</span>
                      <Badge variant="outline" className="text-xs">{question.points} {t('newQuizPage.pts')}</Badge>
                      {isValid && (
                        <span className="text-[10px] sm:text-xs font-normal text-green-600">✓ <span className="hidden sm:inline">{t('newQuizPage.valid')}</span></span>
                      )}
                    </CardTitle>
                    <div className="flex items-center gap-1 shrink-0">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => toggleExpand(qIndex)}
                        className="h-8 w-8 p-0"
                      >
                        {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => removeQuestion(qIndex)}
                        className="h-8 w-8 p-0"
                      >
                        <Trash2 className="h-4 w-4 text-red-500" />
                      </Button>
                    </div>
                  </div>
                </CardHeader>

                {isExpanded && (
                  <CardContent className="p-3 sm:p-6 pt-0 space-y-3 sm:space-y-4">
                    <div className="grid grid-cols-1 gap-3 sm:gap-4">
                      <div>
                        <Label className="text-sm">
                          {t('newQuizPage.questionLabel')} <span className="text-red-500">*</span>
                        </Label>
                        <Textarea
                          placeholder={t('newQuizPage.questionPlaceholder')}
                          value={question.question}
                          onChange={(e) => updateQuestion(qIndex, 'question', e.target.value)}
                          rows={2}
                          required
                          className="mt-1.5"
                        />
                      </div>

                      <div>
                        <Label className="text-sm">{t('newQuizPage.typeLabel')}</Label>
                        <Select
                          value={question.type}
                          onValueChange={(value) => updateQuestion(qIndex, 'type', value as QuestionType)}
                        >
                          <SelectTrigger className="mt-1.5">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="multiple_choice">{t('newQuizPage.multipleChoice')}</SelectItem>
                            <SelectItem value="true_false">{t('newQuizPage.trueFalse')}</SelectItem>
                            <SelectItem value="short_answer">{t('newQuizPage.shortAnswer')}</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    {/* Options for MCQ and True/False */}
                    {question.type !== 'short_answer' && question.options && (
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <Label className="text-sm">{t('newQuizPage.optionsLabel')}</Label>
                          {question.type === 'multiple_choice' && (
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => addOption(qIndex)}
                              className="h-7 text-xs"
                            >
                              <Plus className="h-3 w-3 mr-1" />
                              <span className="hidden sm:inline">{t('newQuizPage.addOption')}</span>
                              <span className="sm:hidden">+</span>
                            </Button>
                          )}
                        </div>
                        <div className="space-y-2">
                          {question.options.map((option, oIndex) => (
                            <div key={oIndex} className="flex items-center gap-1.5 sm:gap-2">
                              <span className="text-xs sm:text-sm font-medium w-6 sm:w-8 shrink-0">{String.fromCharCode(65 + oIndex)}.</span>
                              <Input
                                placeholder={`Option ${oIndex + 1}`}
                                value={option}
                                onChange={(e) => updateOption(qIndex, oIndex, e.target.value)}
                                disabled={question.type === 'true_false'}
                                className="text-sm"
                              />
                              {question.type === 'multiple_choice' && question.options!.length > 2 && (
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => removeOption(qIndex, oIndex)}
                                  className="h-8 w-8 p-0 shrink-0"
                                >
                                  <X className="h-4 w-4 text-red-500" />
                                </Button>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                      <div>
                        <Label className="text-sm">
                          {t('newQuizPage.correctAnswer')} <span className="text-red-500">*</span>
                        </Label>
                        {question.type === 'short_answer' ? (
                          <Input
                            placeholder={t('newQuizPage.correctAnswer')}
                            value={question.correct_answer}
                            onChange={(e) => updateQuestion(qIndex, 'correct_answer', e.target.value)}
                            required
                            className="mt-1.5"
                          />
                        ) : (
                          <Select
                            value={question.correct_answer}
                            onValueChange={(value) => updateQuestion(qIndex, 'correct_answer', value)}
                          >
                            <SelectTrigger className="mt-1.5">
                              <SelectValue placeholder={t('newQuizPage.selectCorrectAnswer')} />
                            </SelectTrigger>
                            <SelectContent>
                              {question.options?.map((option, idx) => (
                                <SelectItem key={idx} value={option}>
                                  {String.fromCharCode(65 + idx)}. {option}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        )}
                      </div>

                      <div>
                        <Label className="text-sm">{t('newQuizPage.pointsLabel')}</Label>
                        <Input
                          type="number"
                          min="1"
                          max="100"
                          value={question.points}
                          onChange={(e) => updateQuestion(qIndex, 'points', parseInt(e.target.value) || 10)}
                          className="mt-1.5"
                        />
                      </div>
                    </div>

                    <div>
                      <Label className="text-sm">{t('newQuizPage.explanationLabel')}</Label>
                      <Textarea
                        placeholder={t('newQuizPage.explanationPlaceholder')}
                        value={question.explanation || ''}
                        onChange={(e) => updateQuestion(qIndex, 'explanation', e.target.value)}
                        rows={2}
                        className="mt-1.5"
                      />
                    </div>
                  </CardContent>
                )}
              </Card>
            )
          })}
        </div>

        {/* Actions - Sticky on mobile */}
        <div className="sticky bottom-0 left-0 right-0 sm:static bg-white dark:bg-gray-900 sm:bg-transparent border-t border-gray-200 dark:border-gray-700 sm:border-0 p-3 sm:p-0 -mx-3 sm:mx-0 flex flex-col sm:flex-row items-stretch sm:items-center justify-end gap-2 sm:gap-4">
          <Button type="button" variant="outline" onClick={() => router.back()} className="order-2 sm:order-1">
            {t('newQuizPage.cancel')}
          </Button>
          <Button type="submit" disabled={loading || !selectedSubject || !title} className="order-1 sm:order-2">
            {loading ? (
              <span className="text-sm">{t('newQuizPage.creating')}</span>
            ) : (
              <>
                <Save className="h-4 w-4 mr-1.5 sm:mr-2" />
                <span className="text-sm">{t('newQuizPage.createQuiz', { count: questions.filter(q => q.question && q.correct_answer).length })}</span>
              </>
            )}
          </Button>
        </div>
      </form>
    </div>
  )
}
