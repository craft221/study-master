'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Save, X, Plus, Trash2, ChevronDown, ChevronUp, CloudOff, Languages } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useLanguage } from '@/contexts/LanguageContext'

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
  const [language, setLanguage] = useState<string>(locale || 'fr')
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
    <div className="max-w-5xl mx-auto px-3 sm:px-4 lg:px-6 py-4 sm:py-6 space-y-4 sm:space-y-6">
      {/* Offline Banner */}
      {!isOnline && (
        <div className="bg-orange-50 dark:bg-orange-900/30 border border-orange-200 dark:border-orange-800 rounded-lg p-3 sm:p-4">
          <div className="flex items-start gap-2 sm:gap-3">
            <CloudOff className="h-4 w-4 sm:h-5 sm:w-5 text-orange-600 dark:text-orange-400 shrink-0 mt-0.5" />
            <div className="min-w-0">
              <p className="font-medium text-orange-900 dark:text-orange-100 text-sm sm:text-base">
                {t('newFlashcardPage.offlineMode')}
              </p>
              <p className="text-xs sm:text-sm text-orange-700 dark:text-orange-300">
                {t('newFlashcardPage.offlineSaveMessage')}
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
              <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold text-gray-900 dark:text-white">{t('newFlashcardPage.title')}</h1>
              {!isOnline && (
                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400 shrink-0">
                  <CloudOff className="w-3 h-3 mr-1" />
                  <span className="hidden sm:inline">{t('newFlashcardPage.offline')}</span>
                </span>
              )}
            </div>
            <p className="text-gray-600 dark:text-gray-400 mt-0.5 sm:mt-1 text-sm sm:text-base">{t('newFlashcardPage.subtitle')}</p>
          </div>
        </div>
        <Button
          variant="outline"
          onClick={() => router.back()}
          className="self-end sm:self-auto shrink-0"
        >
          <X className="h-4 w-4 sm:mr-2" />
          <span className="hidden sm:inline">{t('newFlashcardPage.cancel')}</span>
        </Button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-6">
        {/* Deck Info */}
        <Card>
          <CardHeader className="p-4 sm:p-6">
            <CardTitle className="text-base sm:text-lg">{t('newFlashcardPage.deckInfo')}</CardTitle>
          </CardHeader>
          <CardContent className="p-4 sm:p-6 pt-0 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
              <div>
                <Label htmlFor="deckName" className="text-sm">
                  {t('newFlashcardPage.deckName')} <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="deckName"
                  placeholder={t('newFlashcardPage.deckNamePlaceholder')}
                  value={deckName}
                  onChange={(e) => setDeckName(e.target.value)}
                  required
                  className="mt-1.5"
                />
              </div>

              <div>
                <Label htmlFor="subject" className="text-sm">
                  {t('newFlashcardPage.subjectLabel')} <span className="text-red-500">*</span>
                </Label>
                <Select value={selectedSubject} onValueChange={setSelectedSubject}>
                  <SelectTrigger className="mt-1.5">
                    <SelectValue placeholder={t('newFlashcardPage.selectSubject')} />
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
            </div>

            <div>
              <Label htmlFor="tags" className="text-sm">{t('newFlashcardPage.tagsLabel')}</Label>
              <Input
                id="tags"
                placeholder={t('newFlashcardPage.tagsPlaceholder')}
                value={tags}
                onChange={(e) => setTags(e.target.value)}
                className="mt-1.5"
              />
            </div>

            {/* Language Selector */}
            <div>
              <Label className="flex items-center gap-1.5 sm:gap-2 mb-2 text-sm">
                <Languages className="h-4 w-4" />
                {t('newFlashcardPage.languageLabel')}
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
                {t('newFlashcardPage.languageNotice')}
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Flashcards */}
        <div className="space-y-3 sm:space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 sm:gap-4">
            <h2 className="text-lg sm:text-xl font-semibold">{t('newFlashcardPage.cardsTitle')} ({flashcards.length})</h2>
            <Button
              type="button"
              onClick={addFlashcard}
              variant="outline"
              size="sm"
              className="self-start sm:self-auto"
            >
              <Plus className="h-4 w-4 mr-1.5 sm:mr-2" />
              <span className="text-sm">{t('newFlashcardPage.addCard')}</span>
            </Button>
          </div>

          {flashcards.map((card, index) => {
            const isExpanded = expandedCards.includes(index)
            const isValid = card.front.trim() && card.back.trim()

            return (
              <Card
                key={index}
                className={`border-l-4 ${isValid ? 'border-l-green-500' : 'border-l-gray-300 dark:border-l-gray-600'}`}
              >
                <CardHeader className="p-3 sm:p-6">
                  <div className="flex items-start sm:items-center justify-between gap-2">
                    <CardTitle className="text-sm sm:text-lg flex flex-wrap items-center gap-1.5 sm:gap-2">
                      <span>{t('newFlashcardPage.card')} {index + 1}</span>
                      {isValid && (
                        <span className="text-[10px] sm:text-xs font-normal text-green-600">✓ <span className="hidden sm:inline">{t('newFlashcardPage.valid')}</span></span>
                      )}
                    </CardTitle>
                    <div className="flex items-center gap-1 shrink-0">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => toggleExpand(index)}
                        className="h-8 w-8 p-0"
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
                        className="h-8 w-8 p-0"
                      >
                        <Trash2 className="h-4 w-4 text-red-500" />
                      </Button>
                    </div>
                  </div>
                </CardHeader>

                {isExpanded && (
                  <CardContent className="p-3 sm:p-6 pt-0 space-y-3 sm:space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                      <div>
                        <Label className="text-sm">
                          {t('newFlashcardPage.questionFront')} <span className="text-red-500">*</span>
                        </Label>
                        <Textarea
                          placeholder={t('newFlashcardPage.questionPlaceholder')}
                          value={card.front}
                          onChange={(e) => updateFlashcard(index, 'front', e.target.value)}
                          rows={3}
                          className="resize-none mt-1.5 text-sm"
                          required
                        />
                      </div>

                      <div>
                        <Label className="text-sm">
                          {t('newFlashcardPage.answerBack')} <span className="text-red-500">*</span>
                        </Label>
                        <Textarea
                          placeholder={t('newFlashcardPage.answerPlaceholder')}
                          value={card.back}
                          onChange={(e) => updateFlashcard(index, 'back', e.target.value)}
                          rows={3}
                          className="resize-none mt-1.5 text-sm"
                          required
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                      <div>
                        <Label className="text-sm">{t('newFlashcardPage.hintOptional')}</Label>
                        <Input
                          placeholder={t('newFlashcardPage.hintPlaceholder')}
                          value={card.hint || ''}
                          onChange={(e) => updateFlashcard(index, 'hint', e.target.value)}
                          className="mt-1.5"
                        />
                      </div>

                      <div>
                        <Label className="text-sm">{t('newFlashcardPage.explanationOptional')}</Label>
                        <Input
                          placeholder={t('newFlashcardPage.explanationPlaceholder')}
                          value={card.explanation || ''}
                          onChange={(e) => updateFlashcard(index, 'explanation', e.target.value)}
                          className="mt-1.5"
                        />
                      </div>
                    </div>
                  </CardContent>
                )}
              </Card>
            )
          })}
        </div>

        {/* Actions - Sticky on mobile */}
        <div className="sticky bottom-0 left-0 right-0 sm:static bg-white dark:bg-gray-900 sm:bg-transparent border-t border-gray-200 dark:border-gray-700 sm:border-0 p-3 sm:p-0 -mx-3 sm:mx-0 flex flex-col sm:flex-row items-stretch sm:items-center justify-end gap-2 sm:gap-4">
          <Button
            type="button"
            variant="outline"
            onClick={() => router.back()}
            className="order-2 sm:order-1"
          >
            {t('newFlashcardPage.cancel')}
          </Button>
          <Button
            type="submit"
            disabled={loading || !selectedSubject || !deckName}
            className="order-1 sm:order-2"
          >
            {loading ? (
              <span className="text-sm">{t('newFlashcardPage.creating')}</span>
            ) : (
              <>
                <Save className="h-4 w-4 mr-1.5 sm:mr-2" />
                <span className="text-sm">{t('newFlashcardPage.createDeck')} ({flashcards.filter(c => c.front && c.back).length})</span>
              </>
            )}
          </Button>
        </div>
      </form>
    </div>
  )
}
