'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Save, X, Plus, Trash2, ChevronDown, ChevronUp, Clock, Award } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
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

  const [loading, setLoading] = useState(false)
  const [subjects, setSubjects] = useState<Subject[]>([])
  const [selectedSubject, setSelectedSubject] = useState('')
  const [expandedQuestions, setExpandedQuestions] = useState<number[]>([0])

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
      const response = await api.get('/subjects/')
      setSubjects(response.data)
    } catch (error) {
      console.error('Erreur lors du chargement des matières:', error)
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
        title: 'Attention',
        description: 'Vous devez avoir au moins une question',
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
        title: 'Champs manquants',
        description: 'Veuillez sélectionner une matière et donner un titre au quiz',
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
        title: 'Aucune question valide',
        description: 'Ajoutez au moins une question complète',
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
        is_ai_generated: false
      }

      const response = await api.post('/quizzes/', payload)

      toast({
        title: 'Quiz créé',
        description: `Quiz "${title}" créé avec ${validQuestions.length} question(s)`,
      })
      router.push(`/quizzes/${response.data.id}`)
    } catch (error: any) {
      console.error('Erreur:', error)
      toast({
        title: 'Erreur',
        description: error.response?.data?.detail || 'Erreur lors de la création du quiz',
        variant: 'destructive'
      })
    } finally {
      setLoading(false)
    }
  }

  const totalPoints = questions.reduce((sum, q) => sum + q.points, 0)

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Nouveau Quiz</h1>
          <p className="text-gray-600 mt-1">Créez un quiz pour tester vos connaissances</p>
        </div>
        <Button variant="outline" onClick={() => router.back()}>
          <X className="h-4 w-4 mr-2" />
          Annuler
        </Button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Quiz Info */}
        <Card>
          <CardHeader>
            <CardTitle>Informations du Quiz</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
                <Label htmlFor="title">
                  Titre <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="title"
                  placeholder="Ex: Quiz de révision - Chapitre 3"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  required
                />
              </div>

              <div className="md:col-span-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  placeholder="Description du quiz..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={2}
                />
              </div>

              <div>
                <Label htmlFor="subject">
                  Matière <span className="text-red-500">*</span>
                </Label>
                <Select value={selectedSubject} onValueChange={setSelectedSubject}>
                  <SelectTrigger>
                    <SelectValue placeholder="Sélectionner une matière" />
                  </SelectTrigger>
                  <SelectContent>
                    {subjects.map((subject) => (
                      <SelectItem key={subject.id} value={subject.id.toString()}>
                        <div className="flex items-center gap-2">
                          <div
                            className="w-3 h-3 rounded-full"
                            style={{ backgroundColor: subject.color }}
                          />
                          {subject.name}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="difficulty">Difficulté</Label>
                <Select value={difficulty} onValueChange={(value: QuizDifficulty) => setDifficulty(value)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="easy">
                      <Badge variant="secondary">Facile</Badge>
                    </SelectItem>
                    <SelectItem value="medium">
                      <Badge variant="default">Moyen</Badge>
                    </SelectItem>
                    <SelectItem value="hard">
                      <Badge variant="destructive">Difficile</Badge>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="passingScore">
                  Score de réussite (%) <Award className="inline h-4 w-4 ml-1" />
                </Label>
                <Input
                  id="passingScore"
                  type="number"
                  min="0"
                  max="100"
                  value={passingScore}
                  onChange={(e) => setPassingScore(parseInt(e.target.value) || 60)}
                />
              </div>

              <div className="flex items-center space-x-2">
                <Switch
                  id="timed"
                  checked={isTimed}
                  onCheckedChange={setIsTimed}
                />
                <Label htmlFor="timed" className="flex items-center gap-2">
                  <Clock className="h-4 w-4" />
                  Quiz chronométré
                </Label>
              </div>

              {isTimed && (
                <div>
                  <Label htmlFor="timeLimit">Temps limite (minutes)</Label>
                  <Input
                    id="timeLimit"
                    type="number"
                    min="1"
                    max="480"
                    value={timeLimitMinutes}
                    onChange={(e) => setTimeLimitMinutes(parseInt(e.target.value) || 30)}
                  />
                </div>
              )}
            </div>

            <div className="space-y-3 pt-4 border-t">
              <div className="flex items-center justify-between">
                <Label htmlFor="showAnswers">Afficher les réponses correctes après</Label>
                <Switch
                  id="showAnswers"
                  checked={showCorrectAnswers}
                  onCheckedChange={setShowCorrectAnswers}
                />
              </div>

              <div className="flex items-center justify-between">
                <Label htmlFor="randomizeQ">Mélanger les questions</Label>
                <Switch
                  id="randomizeQ"
                  checked={randomizeQuestions}
                  onCheckedChange={setRandomizeQuestions}
                />
              </div>

              <div className="flex items-center justify-between">
                <Label htmlFor="randomizeO">Mélanger les options (QCM)</Label>
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
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-semibold">Questions ({questions.length})</h2>
              <p className="text-sm text-gray-600">Total: {totalPoints} points</p>
            </div>
            <Button type="button" onClick={addQuestion} variant="outline">
              <Plus className="h-4 w-4 mr-2" />
              Ajouter une question
            </Button>
          </div>

          {questions.map((question, qIndex) => {
            const isExpanded = expandedQuestions.includes(qIndex)
            const isValid = question.question.trim() && question.correct_answer.trim()

            return (
              <Card
                key={qIndex}
                className={`border-l-4 ${isValid ? 'border-l-green-500' : 'border-l-gray-300'}`}
              >
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg flex items-center gap-2">
                      Question {qIndex + 1}
                      <Badge variant="outline">{question.points} pts</Badge>
                      {isValid && (
                        <span className="text-xs font-normal text-green-600">✓ Valide</span>
                      )}
                    </CardTitle>
                    <div className="flex items-center gap-2">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => toggleExpand(qIndex)}
                      >
                        {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => removeQuestion(qIndex)}
                      >
                        <Trash2 className="h-4 w-4 text-red-500" />
                      </Button>
                    </div>
                  </div>
                </CardHeader>

                {isExpanded && (
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="md:col-span-2">
                        <Label>
                          Question <span className="text-red-500">*</span>
                        </Label>
                        <Textarea
                          placeholder="Entrez votre question..."
                          value={question.question}
                          onChange={(e) => updateQuestion(qIndex, 'question', e.target.value)}
                          rows={2}
                          required
                        />
                      </div>

                      <div>
                        <Label>Type</Label>
                        <Select
                          value={question.type}
                          onValueChange={(value: QuestionType) => updateQuestion(qIndex, 'type', value)}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="multiple_choice">QCM</SelectItem>
                            <SelectItem value="true_false">Vrai/Faux</SelectItem>
                            <SelectItem value="short_answer">Réponse courte</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    {/* Options for MCQ and True/False */}
                    {question.type !== 'short_answer' && question.options && (
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <Label>Options</Label>
                          {question.type === 'multiple_choice' && (
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => addOption(qIndex)}
                            >
                              <Plus className="h-3 w-3 mr-1" />
                              Ajouter option
                            </Button>
                          )}
                        </div>
                        <div className="space-y-2">
                          {question.options.map((option, oIndex) => (
                            <div key={oIndex} className="flex items-center gap-2">
                              <span className="text-sm font-medium w-8">{String.fromCharCode(65 + oIndex)}.</span>
                              <Input
                                placeholder={`Option ${oIndex + 1}`}
                                value={option}
                                onChange={(e) => updateOption(qIndex, oIndex, e.target.value)}
                                disabled={question.type === 'true_false'}
                              />
                              {question.type === 'multiple_choice' && question.options!.length > 2 && (
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => removeOption(qIndex, oIndex)}
                                >
                                  <X className="h-4 w-4 text-red-500" />
                                </Button>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <Label>
                          Réponse correcte <span className="text-red-500">*</span>
                        </Label>
                        {question.type === 'short_answer' ? (
                          <Input
                            placeholder="Réponse correcte"
                            value={question.correct_answer}
                            onChange={(e) => updateQuestion(qIndex, 'correct_answer', e.target.value)}
                            required
                          />
                        ) : (
                          <Select
                            value={question.correct_answer}
                            onValueChange={(value) => updateQuestion(qIndex, 'correct_answer', value)}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Sélectionner la bonne réponse" />
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
                        <Label>Points</Label>
                        <Input
                          type="number"
                          min="1"
                          max="100"
                          value={question.points}
                          onChange={(e) => updateQuestion(qIndex, 'points', parseInt(e.target.value) || 10)}
                        />
                      </div>
                    </div>

                    <div>
                      <Label>Explication (optionnel)</Label>
                      <Textarea
                        placeholder="Expliquez pourquoi c'est la bonne réponse..."
                        value={question.explanation || ''}
                        onChange={(e) => updateQuestion(qIndex, 'explanation', e.target.value)}
                        rows={2}
                      />
                    </div>
                  </CardContent>
                )}
              </Card>
            )
          })}
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-4">
          <Button type="button" variant="outline" onClick={() => router.back()}>
            Annuler
          </Button>
          <Button type="submit" disabled={loading || !selectedSubject || !title}>
            {loading ? (
              <>Création en cours...</>
            ) : (
              <>
                <Save className="h-4 w-4 mr-2" />
                Créer le Quiz ({questions.filter(q => q.question && q.correct_answer).length} questions)
              </>
            )}
          </Button>
        </div>
      </form>
    </div>
  )
}
