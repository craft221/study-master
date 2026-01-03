'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Save, X, Plus, Trash2, ChevronDown, ChevronUp, CloudOff, Languages } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useLanguage } from '@/contexts/LanguageContext'

const LANGUAGE_OPTIONS = [
  { code: 'fr', label: 'Français', flag: '🇫🇷' },
  { code: 'en', label: 'English', flag: '🇬🇧' },
  { code: 'es', label: 'Español', flag: '🇪🇸' },
]
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import api from '@/lib/api'
import { useToast } from '@/hooks/use-toast'
import { useOfflineContext } from '@/components/providers/OfflineProvider'
import { offlineStorage, STORES } from '@/lib/offlineStorage'
import { syncService, generateTempId } from '@/services/syncService'

interface Subject {
  id: number
  name: string
  color: string
}

interface FlashcardInput {
  front: string
  back: string
  hint?: string
  explanation?: string
}

export default function NewFlashcardDeckPage() {
  const router = useRouter()
  const { toast } = useToast()
  const { isOnline } = useOfflineContext()
  const { locale, t } = useLanguage()

  const [loading, setLoading] = useState(false)
  const [subjects, setSubjects] = useState<Subject[]>([])
  const [selectedSubject, setSelectedSubject] = useState('')
  const [deckName, setDeckName] = useState('')
  const [tags, setTags] = useState('')
  const [language, setLanguage] = useState(locale || 'fr')
  const [expandedCards, setExpandedCards] = useState<number[]>([0])

  const [flashcards, setFlashcards] = useState<FlashcardInput[]>([
    { front: '', back: '', hint: '', explanation: '' }
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

  const addFlashcard = () => {
    const newIndex = flashcards.length
    setFlashcards([...flashcards, { front: '', back: '', hint: '', explanation: '' }])
    setExpandedCards([...expandedCards, newIndex])
  }

  const removeFlashcard = (index: number) => {
    if (flashcards.length === 1) {
      toast({
        title: t('newFlashcardPage.warning'),
        description: t('newFlashcardPage.atLeastOneCard'),
        variant: 'destructive'
      })
      return
    }
    setFlashcards(flashcards.filter((_, i) => i !== index))
    setExpandedCards(expandedCards.filter(i => i !== index).map(i => i > index ? i - 1 : i))
  }

  const updateFlashcard = (index: number, field: keyof FlashcardInput, value: string) => {
    const updated = [...flashcards]
    updated[index] = { ...updated[index], [field]: value }
    setFlashcards(updated)
  }

  const toggleExpand = (index: number) => {
    setExpandedCards(prev =>
      prev.includes(index)
        ? prev.filter(i => i !== index)
        : [...prev, index]
    )
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!selectedSubject || !deckName) {
      toast({
        title: t('newFlashcardPage.missingFields'),
        description: t('newFlashcardPage.fillSubjectAndName'),
        variant: 'destructive'
      })
      return
    }

    const validCards = flashcards.filter(card => card.front.trim() && card.back.trim())

    if (validCards.length === 0) {
      toast({
        title: t('newFlashcardPage.noValidCard'),
        description: t('newFlashcardPage.addCompleteCard'),
        variant: 'destructive'
      })
      return
    }

    setLoading(true)
    try {
      if (isOnline) {
        // Mode en ligne: créer directement sur le serveur
        const promises = validCards.map(card =>
          api.post('/flashcards/', {
            subject_id: parseInt(selectedSubject),
            deck_name: deckName,
            front: card.front,
            back: card.back,
            hint: card.hint || null,
            explanation: card.explanation || null,
            tags: tags || null,
            is_ai_generated: false,
            language: language
          })
        )

        await Promise.all(promises)

        toast({
          title: t('newFlashcardPage.deckCreated'),
          description: t('newFlashcardPage.deckCreatedWith', { count: validCards.length, name: deckName }),
        })
        router.push('/flashcards')
      } else {
        // Mode hors-ligne: créer localement avec des IDs temporaires
        const now = new Date().toISOString()
        const subject = subjects.find(s => s.id.toString() === selectedSubject)
        const deckTempId = generateTempId()

        // Créer un deck local
        const offlineDeck = {
          id: deckTempId,
          _tempId: deckTempId,
          name: deckName,
          subject_id: parseInt(selectedSubject),
          subject: subject ? { id: subject.id, name: subject.name, color: subject.color } : null,
          card_count: validCards.length,
          mastered_count: 0,
          tags: tags || null,
          language: language,
          created_at: now,
          updated_at: now,
          _isOffline: true,
        }

        // Sauvegarder le deck dans IndexedDB
        await offlineStorage.saveDeck(offlineDeck)

        // Créer chaque flashcard localement
        for (const card of validCards) {
          const cardTempId = generateTempId()
          const offlineCard = {
            id: cardTempId,
            _tempId: cardTempId,
            deck_id: deckTempId,
            deck_name: deckName,
            subject_id: parseInt(selectedSubject),
            front: card.front,
            back: card.back,
            hint: card.hint || null,
            explanation: card.explanation || null,
            tags: tags || null,
            is_ai_generated: false,
            language: language,
            ease_factor: 2.5,
            interval: 0,
            repetitions: 0,
            next_review: now,
            created_at: now,
            updated_at: now,
            _isOffline: true,
          }

          // Sauvegarder la carte
          await offlineStorage.put(STORES.FLASHCARDS, offlineCard)

          // Ajouter à la queue de synchronisation
          await syncService.queueAction(
            STORES.FLASHCARDS,
            'create',
            '/api/v1/flashcards/',
            'POST',
            {
              subject_id: parseInt(selectedSubject),
              deck_name: deckName,
              front: card.front,
              back: card.back,
              hint: card.hint || null,
              explanation: card.explanation || null,
              tags: tags || null,
              is_ai_generated: false,
              language: language,
              _tempId: cardTempId,
            }
          )
        }

        toast({
          title: t('newFlashcardPage.deckCreatedOffline'),
          description: t('newFlashcardPage.deckWillSync', { count: validCards.length }),
        })
        router.push('/flashcards')
      }
    } catch (error: any) {
      console.error('Error:', error)
      toast({
        title: t('common.error'),
        description: error.response?.data?.detail || t('newFlashcardPage.error'),
        variant: 'destructive'
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-5xl mx-auto p-6 space-y-6">
      {/* Offline Banner */}
      {!isOnline && (
        <div className="bg-orange-50 dark:bg-orange-900/30 border border-orange-200 dark:border-orange-800 rounded-lg p-4">
          <div className="flex items-center gap-3">
            <CloudOff className="h-5 w-5 text-orange-600 dark:text-orange-400" />
            <div>
              <p className="font-medium text-orange-900 dark:text-orange-100">
                {t('newFlashcardPage.offlineMode')}
              </p>
              <p className="text-sm text-orange-700 dark:text-orange-300">
                {t('newFlashcardPage.offlineSaveMessage')}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">{t('newFlashcardPage.title')}</h1>
            <p className="text-gray-600 mt-1">{t('newFlashcardPage.subtitle')}</p>
          </div>
          {!isOnline && (
            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400">
              <CloudOff className="w-3 h-3 mr-1" />
              {t('newFlashcardPage.offline')}
            </span>
          )}
        </div>
        <Button
          variant="outline"
          onClick={() => router.back()}
        >
          <X className="h-4 w-4 mr-2" />
          {t('newFlashcardPage.cancel')}
        </Button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Deck Info */}
        <Card>
          <CardHeader>
            <CardTitle>{t('newFlashcardPage.deckInfo')}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="deckName">
                  {t('newFlashcardPage.deckName')} <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="deckName"
                  placeholder={t('newFlashcardPage.deckNamePlaceholder')}
                  value={deckName}
                  onChange={(e) => setDeckName(e.target.value)}
                  required
                />
              </div>

              <div>
                <Label htmlFor="subject">
                  {t('newFlashcardPage.subjectLabel')} <span className="text-red-500">*</span>
                </Label>
                <Select value={selectedSubject} onValueChange={setSelectedSubject}>
                  <SelectTrigger>
                    <SelectValue placeholder={t('newFlashcardPage.selectSubject')} />
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
            </div>

            <div>
              <Label htmlFor="tags">{t('newFlashcardPage.tagsLabel')}</Label>
              <Input
                id="tags"
                placeholder={t('newFlashcardPage.tagsPlaceholder')}
                value={tags}
                onChange={(e) => setTags(e.target.value)}
              />
            </div>

            {/* Language Selector */}
            <div>
              <Label className="flex items-center gap-2 mb-2">
                <Languages className="h-4 w-4" />
                {t('newFlashcardPage.languageLabel')}
              </Label>
              <div className="flex gap-3">
                {LANGUAGE_OPTIONS.map((lang) => (
                  <button
                    key={lang.code}
                    type="button"
                    onClick={() => setLanguage(lang.code)}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg border-2 transition ${
                      language === lang.code
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
                {t('newFlashcardPage.languageNotice')}
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Flashcards */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold">{t('newFlashcardPage.cardsTitle')} ({flashcards.length})</h2>
            <Button
              type="button"
              onClick={addFlashcard}
              variant="outline"
            >
              <Plus className="h-4 w-4 mr-2" />
              {t('newFlashcardPage.addCard')}
            </Button>
          </div>

          {flashcards.map((card, index) => {
            const isExpanded = expandedCards.includes(index)
            const isValid = card.front.trim() && card.back.trim()

            return (
              <Card
                key={index}
                className={`border-l-4 ${isValid ? 'border-l-green-500' : 'border-l-gray-300'}`}
              >
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg flex items-center gap-2">
                      {t('newFlashcardPage.card')} {index + 1}
                      {isValid && (
                        <span className="text-xs font-normal text-green-600">✓ {t('newFlashcardPage.valid')}</span>
                      )}
                    </CardTitle>
                    <div className="flex items-center gap-2">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => toggleExpand(index)}
                      >
                        {isExpanded ? (
                          <ChevronUp className="h-4 w-4" />
                        ) : (
                          <ChevronDown className="h-4 w-4" />
                        )}
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => removeFlashcard(index)}
                      >
                        <Trash2 className="h-4 w-4 text-red-500" />
                      </Button>
                    </div>
                  </div>
                </CardHeader>

                {isExpanded && (
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <Label>
                          {t('newFlashcardPage.questionFront')} <span className="text-red-500">*</span>
                        </Label>
                        <Textarea
                          placeholder={t('newFlashcardPage.questionPlaceholder')}
                          value={card.front}
                          onChange={(e) => updateFlashcard(index, 'front', e.target.value)}
                          rows={3}
                          className="resize-none"
                          required
                        />
                      </div>

                      <div>
                        <Label>
                          {t('newFlashcardPage.answerBack')} <span className="text-red-500">*</span>
                        </Label>
                        <Textarea
                          placeholder={t('newFlashcardPage.answerPlaceholder')}
                          value={card.back}
                          onChange={(e) => updateFlashcard(index, 'back', e.target.value)}
                          rows={3}
                          className="resize-none"
                          required
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <Label>{t('newFlashcardPage.hintOptional')}</Label>
                        <Input
                          placeholder={t('newFlashcardPage.hintPlaceholder')}
                          value={card.hint || ''}
                          onChange={(e) => updateFlashcard(index, 'hint', e.target.value)}
                        />
                      </div>

                      <div>
                        <Label>{t('newFlashcardPage.explanationOptional')}</Label>
                        <Input
                          placeholder={t('newFlashcardPage.explanationPlaceholder')}
                          value={card.explanation || ''}
                          onChange={(e) => updateFlashcard(index, 'explanation', e.target.value)}
                        />
                      </div>
                    </div>
                  </CardContent>
                )}
              </Card>
            )
          })}
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-4">
          <Button
            type="button"
            variant="outline"
            onClick={() => router.back()}
          >
            {t('newFlashcardPage.cancel')}
          </Button>
          <Button
            type="submit"
            disabled={loading || !selectedSubject || !deckName}
          >
            {loading ? (
              <>{t('newFlashcardPage.creating')}</>
            ) : (
              <>
                <Save className="h-4 w-4 mr-2" />
                {t('newFlashcardPage.createDeck')} ({flashcards.filter(c => c.front && c.back).length})
              </>
            )}
          </Button>
        </div>
      </form>
    </div>
  )
}
