'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  BookOpen,
  Target,
  CreditCard,
  Brain,
  Sparkles,
  Trophy,
  ChevronRight,
  ChevronLeft,
  Check,
  Plus,
  X,
  Rocket,
  GraduationCap,
  Calendar,
  Zap
} from 'lucide-react'
import api from '@/lib/api'
import { useLanguage } from '@/contexts/LanguageContext'

interface Subject {
  id: number
  name: string
  color: string
  icon: string
}

interface OnboardingWizardProps {
  onComplete: () => void
  userName?: string
}

const SUBJECT_COLORS = [
  '#3B82F6', // blue
  '#10B981', // green
  '#F59E0B', // amber
  '#EF4444', // red
  '#8B5CF6', // purple
  '#EC4899', // pink
  '#06B6D4', // cyan
  '#F97316', // orange
]

const SUBJECT_ICONS = ['📚', '🔬', '🧮', '🌍', '💻', '🎨', '📖', '⚗️', '📐', '🎵']

export default function OnboardingWizard({ onComplete, userName = 'Étudiant' }: OnboardingWizardProps) {
  const { t } = useLanguage()
  const [currentStep, setCurrentStep] = useState(0)
  const [subjects, setSubjects] = useState<Subject[]>([])
  const [newSubjectName, setNewSubjectName] = useState('')
  const [selectedColor, setSelectedColor] = useState(SUBJECT_COLORS[0])
  const [selectedIcon, setSelectedIcon] = useState(SUBJECT_ICONS[0])
  const [isCreating, setIsCreating] = useState(false)
  const [showSubjectForm, setShowSubjectForm] = useState(false)

  const steps = [
    {
      id: 'welcome',
      title: t('onboarding.welcome.title') || `Bienvenue sur Studera, ${userName} ! 🎉`,
      subtitle: t('onboarding.welcome.subtitle') || 'Ta plateforme d\'apprentissage intelligente',
      description: t('onboarding.welcome.description') || 'En quelques étapes, tu vas configurer ton espace d\'étude personnalisé et découvrir les fonctionnalités qui vont transformer ta façon d\'apprendre.',
      icon: Rocket,
      color: 'from-primary-500 to-purple-600'
    },
    {
      id: 'subjects',
      title: t('onboarding.subjects.title') || 'Crée tes matières 📚',
      subtitle: t('onboarding.subjects.subtitle') || 'Tout commence par là !',
      description: t('onboarding.subjects.description') || 'Les matières sont le cœur de Studera. Elles organisent tes notes, flashcards, quiz et tout ton contenu. Crée au moins une matière pour commencer.',
      icon: Target,
      color: 'from-blue-500 to-cyan-500'
    },
    {
      id: 'features',
      title: t('onboarding.features.title') || 'Découvre les outils 🛠️',
      subtitle: t('onboarding.features.subtitle') || 'Tout ce dont tu as besoin',
      description: t('onboarding.features.description') || 'Studera regroupe tous les outils pour réussir tes études.',
      icon: Sparkles,
      color: 'from-purple-500 to-pink-500'
    },
    {
      id: 'gamification',
      title: t('onboarding.gamification.title') || 'Apprends en t\'amusant 🎮',
      subtitle: t('onboarding.gamification.subtitle') || 'XP, niveaux et récompenses',
      description: t('onboarding.gamification.description') || 'Gagne de l\'XP à chaque action, monte en niveau, débloque des achievements et défie tes amis en duel !',
      icon: Trophy,
      color: 'from-amber-500 to-orange-500'
    },
    {
      id: 'ready',
      title: t('onboarding.ready.title') || 'Tu es prêt ! 🚀',
      subtitle: t('onboarding.ready.subtitle') || 'Commence ton aventure',
      description: t('onboarding.ready.description') || 'Ton espace est configuré. Il est temps de créer ta première note ou tes premières flashcards !',
      icon: GraduationCap,
      color: 'from-green-500 to-emerald-500'
    }
  ]

  const features = [
    { icon: BookOpen, name: t('onboarding.feature.notes') || 'Notes', desc: t('onboarding.feature.notesDesc') || 'Prends des notes avec support Markdown et LaTeX' },
    { icon: CreditCard, name: t('onboarding.feature.flashcards') || 'Flashcards', desc: t('onboarding.feature.flashcardsDesc') || 'Mémorise avec la répétition espacée' },
    { icon: Brain, name: t('onboarding.feature.quizzes') || 'Quiz', desc: t('onboarding.feature.quizzesDesc') || 'Teste tes connaissances' },
    { icon: Sparkles, name: t('onboarding.feature.ai') || 'IA Spark', desc: t('onboarding.feature.aiDesc') || 'Un assistant IA pour t\'aider' },
    { icon: Calendar, name: t('onboarding.feature.calendar') || 'Calendrier', desc: t('onboarding.feature.calendarDesc') || 'Planifie tes révisions' },
    { icon: Zap, name: t('onboarding.feature.pomodoro') || 'Pomodoro', desc: t('onboarding.feature.pomodoroDesc') || 'Sessions d\'étude minutées' },
  ]

  const createSubject = async () => {
    if (!newSubjectName.trim()) return

    setIsCreating(true)
    try {
      const response = await api.post('/subjects/', {
        name: newSubjectName.trim(),
        color: selectedColor,
        icon: selectedIcon
      })
      setSubjects([...subjects, response.data])
      setNewSubjectName('')
      setShowSubjectForm(false)
      setSelectedColor(SUBJECT_COLORS[(subjects.length + 1) % SUBJECT_COLORS.length])
      setSelectedIcon(SUBJECT_ICONS[(subjects.length + 1) % SUBJECT_ICONS.length])
    } catch (error) {
      console.error('Error creating subject:', error)
    } finally {
      setIsCreating(false)
    }
  }

  const canProceed = () => {
    if (currentStep === 1) {
      return subjects.length > 0
    }
    return true
  }

  const handleNext = () => {
    if (currentStep < steps.length - 1 && canProceed()) {
      setCurrentStep(currentStep + 1)
    }
  }

  const handlePrev = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1)
    }
  }

  const handleComplete = async () => {
    // Marquer l'onboarding comme terminé
    localStorage.setItem('onboarding_completed', 'true')

    // Donner des XP pour avoir complété l'onboarding
    try {
      await api.post('/achievements/check-progress')
    } catch (e) {
      // Ignorer les erreurs
    }

    onComplete()
  }

  const currentStepData = steps[currentStep]
  const StepIcon = currentStepData.icon

  return (
    <div className="fixed inset-0 z-[100] bg-gray-900/80 backdrop-blur-sm flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden"
      >
        {/* Progress Bar */}
        <div className="h-1 bg-gray-200 dark:bg-gray-700">
          <motion.div
            className="h-full bg-gradient-to-r from-primary-500 to-purple-500"
            initial={{ width: 0 }}
            animate={{ width: `${((currentStep + 1) / steps.length) * 100}%` }}
            transition={{ duration: 0.3 }}
          />
        </div>

        {/* Header avec icône */}
        <div className={`bg-gradient-to-r ${currentStepData.color} p-6 sm:p-8`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-white/20 rounded-xl">
                <StepIcon className="h-8 w-8 text-white" />
              </div>
              <div>
                <p className="text-white/80 text-sm font-medium">
                  {t('onboarding.step') || 'Étape'} {currentStep + 1}/{steps.length}
                </p>
                <h2 className="text-xl sm:text-2xl font-bold text-white">
                  {currentStepData.title}
                </h2>
              </div>
            </div>
            {/* Skip button - only on first steps */}
            {currentStep < 2 && (
              <button
                onClick={handleComplete}
                className="text-white/70 hover:text-white text-sm underline"
              >
                {t('onboarding.skip') || 'Passer'}
              </button>
            )}
          </div>
          <p className="mt-3 text-white/90 text-sm sm:text-base">
            {currentStepData.subtitle}
          </p>
        </div>

        {/* Content */}
        <div className="p-6 sm:p-8 overflow-y-auto max-h-[50vh]">
          <AnimatePresence mode="wait">
            <motion.div
              key={currentStep}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.2 }}
            >
              {/* Step 0: Welcome */}
              {currentStep === 0 && (
                <div className="text-center">
                  <p className="text-gray-600 dark:text-gray-300 mb-6">
                    {currentStepData.description}
                  </p>
                  <div className="grid grid-cols-3 gap-4 mt-6">
                    <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-xl">
                      <BookOpen className="h-8 w-8 text-blue-500 mx-auto mb-2" />
                      <p className="text-sm font-medium text-gray-700 dark:text-gray-300">Organise</p>
                    </div>
                    <div className="p-4 bg-purple-50 dark:bg-purple-900/20 rounded-xl">
                      <Brain className="h-8 w-8 text-purple-500 mx-auto mb-2" />
                      <p className="text-sm font-medium text-gray-700 dark:text-gray-300">Apprends</p>
                    </div>
                    <div className="p-4 bg-amber-50 dark:bg-amber-900/20 rounded-xl">
                      <Trophy className="h-8 w-8 text-amber-500 mx-auto mb-2" />
                      <p className="text-sm font-medium text-gray-700 dark:text-gray-300">Progresse</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Step 1: Create Subjects */}
              {currentStep === 1 && (
                <div>
                  <p className="text-gray-600 dark:text-gray-300 mb-4">
                    {currentStepData.description}
                  </p>

                  {/* Liste des matières créées */}
                  {subjects.length > 0 && (
                    <div className="mb-4 space-y-2">
                      {subjects.map((subject) => (
                        <div
                          key={subject.id}
                          className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg"
                        >
                          <span className="text-xl">{subject.icon}</span>
                          <span
                            className="w-3 h-3 rounded-full"
                            style={{ backgroundColor: subject.color }}
                          />
                          <span className="font-medium text-gray-800 dark:text-gray-200">
                            {subject.name}
                          </span>
                          <Check className="h-5 w-5 text-green-500 ml-auto" />
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Formulaire de création */}
                  {showSubjectForm ? (
                    <div className="bg-gray-50 dark:bg-gray-700/50 rounded-xl p-4">
                      <div className="flex items-center gap-2 mb-3">
                        <input
                          type="text"
                          value={newSubjectName}
                          onChange={(e) => setNewSubjectName(e.target.value)}
                          placeholder={t('onboarding.subjectPlaceholder') || "Ex: Mathématiques, Physique, Histoire..."}
                          className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                          autoFocus
                          onKeyDown={(e) => e.key === 'Enter' && createSubject()}
                        />
                      </div>

                      {/* Color picker */}
                      <div className="mb-3">
                        <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">{t('onboarding.chooseColor') || 'Couleur'}</p>
                        <div className="flex gap-2">
                          {SUBJECT_COLORS.map((color) => (
                            <button
                              key={color}
                              onClick={() => setSelectedColor(color)}
                              className={`w-8 h-8 rounded-full transition-transform ${
                                selectedColor === color ? 'scale-110 ring-2 ring-offset-2 ring-gray-400' : ''
                              }`}
                              style={{ backgroundColor: color }}
                            />
                          ))}
                        </div>
                      </div>

                      {/* Icon picker */}
                      <div className="mb-4">
                        <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">{t('onboarding.chooseIcon') || 'Icône'}</p>
                        <div className="flex gap-2 flex-wrap">
                          {SUBJECT_ICONS.map((icon) => (
                            <button
                              key={icon}
                              onClick={() => setSelectedIcon(icon)}
                              className={`w-10 h-10 rounded-lg flex items-center justify-center text-xl transition-all ${
                                selectedIcon === icon
                                  ? 'bg-primary-100 dark:bg-primary-900/30 ring-2 ring-primary-500'
                                  : 'bg-gray-100 dark:bg-gray-600 hover:bg-gray-200 dark:hover:bg-gray-500'
                              }`}
                            >
                              {icon}
                            </button>
                          ))}
                        </div>
                      </div>

                      <div className="flex gap-2">
                        <button
                          onClick={() => setShowSubjectForm(false)}
                          className="px-4 py-2 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg transition"
                        >
                          {t('common.cancel') || 'Annuler'}
                        </button>
                        <button
                          onClick={createSubject}
                          disabled={!newSubjectName.trim() || isCreating}
                          className="flex-1 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                        >
                          {isCreating ? (
                            <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                          ) : (
                            <>
                              <Check className="h-4 w-4" />
                              {t('onboarding.createSubject') || 'Créer'}
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button
                      onClick={() => setShowSubjectForm(true)}
                      className="w-full p-4 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-xl text-gray-500 dark:text-gray-400 hover:border-primary-500 hover:text-primary-500 transition flex items-center justify-center gap-2"
                    >
                      <Plus className="h-5 w-5" />
                      {t('onboarding.addSubject') || 'Ajouter une matière'}
                    </button>
                  )}

                  {subjects.length === 0 && (
                    <p className="text-center text-amber-600 dark:text-amber-400 text-sm mt-4">
                      ⚠️ {t('onboarding.needSubject') || 'Tu dois créer au moins une matière pour continuer'}
                    </p>
                  )}
                </div>
              )}

              {/* Step 2: Features */}
              {currentStep === 2 && (
                <div>
                  <p className="text-gray-600 dark:text-gray-300 mb-6">
                    {currentStepData.description}
                  </p>
                  <div className="grid grid-cols-2 gap-3">
                    {features.map((feature, index) => (
                      <motion.div
                        key={feature.name}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: index * 0.1 }}
                        className="p-4 bg-gray-50 dark:bg-gray-700/50 rounded-xl"
                      >
                        <feature.icon className="h-6 w-6 text-primary-500 mb-2" />
                        <h4 className="font-semibold text-gray-800 dark:text-gray-200 text-sm">
                          {feature.name}
                        </h4>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                          {feature.desc}
                        </p>
                      </motion.div>
                    ))}
                  </div>
                </div>
              )}

              {/* Step 3: Gamification */}
              {currentStep === 3 && (
                <div className="text-center">
                  <p className="text-gray-600 dark:text-gray-300 mb-6">
                    {currentStepData.description}
                  </p>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-4 bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-900/20 dark:to-orange-900/20 rounded-xl">
                      <Zap className="h-10 w-10 text-amber-500 mx-auto mb-2" />
                      <p className="font-bold text-2xl text-amber-600 dark:text-amber-400">+10 XP</p>
                      <p className="text-xs text-gray-600 dark:text-gray-400">{t('onboarding.xpPerNote') || 'par note créée'}</p>
                    </div>
                    <div className="p-4 bg-gradient-to-br from-purple-50 to-pink-50 dark:from-purple-900/20 dark:to-pink-900/20 rounded-xl">
                      <Trophy className="h-10 w-10 text-purple-500 mx-auto mb-2" />
                      <p className="font-bold text-2xl text-purple-600 dark:text-purple-400">44</p>
                      <p className="text-xs text-gray-600 dark:text-gray-400">{t('onboarding.achievementsToUnlock') || 'achievements à débloquer'}</p>
                    </div>
                  </div>
                  <div className="mt-4 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-xl">
                    <p className="text-sm text-blue-700 dark:text-blue-300">
                      💡 {t('onboarding.tip') || 'Astuce'}: {t('onboarding.streakTip') || 'Connecte-toi chaque jour pour maintenir ton streak et gagner des bonus !'}
                    </p>
                  </div>
                </div>
              )}

              {/* Step 4: Ready */}
              {currentStep === 4 && (
                <div className="text-center">
                  <p className="text-gray-600 dark:text-gray-300 mb-6">
                    {currentStepData.description}
                  </p>
                  <div className="p-6 bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 rounded-xl mb-4">
                    <div className="w-16 h-16 bg-green-500 rounded-full flex items-center justify-center mx-auto mb-4">
                      <Check className="h-8 w-8 text-white" />
                    </div>
                    <h3 className="text-lg font-bold text-green-700 dark:text-green-400 mb-2">
                      {t('onboarding.allSet') || 'Tout est prêt !'}
                    </h3>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      {subjects.length > 0
                        ? `${t('onboarding.createdSubjects') || 'Tu as créé'} ${subjects.length} ${t('onboarding.subjectsCount') || 'matière(s)'}`
                        : t('onboarding.noSubjectsYet') || 'Tu pourras créer des matières plus tard'
                      }
                    </p>
                  </div>
                  <div className="flex flex-col gap-2 text-sm text-gray-500 dark:text-gray-400">
                    <p>✨ {t('onboarding.suggestion1') || 'Commence par créer une note dans une de tes matières'}</p>
                    <p>🎯 {t('onboarding.suggestion2') || 'Consulte tes quêtes journalières pour gagner des XP'}</p>
                    <p>🤖 {t('onboarding.suggestion3') || 'Demande à Spark si tu as besoin d\'aide !'}</p>
                  </div>
                </div>
              )}
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Footer - Navigation */}
        <div className="px-6 sm:px-8 py-4 border-t border-gray-200 dark:border-gray-700 flex items-center justify-between bg-gray-50 dark:bg-gray-800/50">
          <button
            onClick={handlePrev}
            disabled={currentStep === 0}
            className="flex items-center gap-2 px-4 py-2 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg transition disabled:opacity-30 disabled:cursor-not-allowed"
          >
            <ChevronLeft className="h-4 w-4" />
            {t('common.previous') || 'Précédent'}
          </button>

          {/* Step indicators */}
          <div className="flex gap-2">
            {steps.map((_, index) => (
              <div
                key={index}
                className={`w-2 h-2 rounded-full transition-all ${
                  index === currentStep
                    ? 'bg-primary-500 w-6'
                    : index < currentStep
                    ? 'bg-primary-300'
                    : 'bg-gray-300 dark:bg-gray-600'
                }`}
              />
            ))}
          </div>

          {currentStep < steps.length - 1 ? (
            <button
              onClick={handleNext}
              disabled={!canProceed()}
              className="flex items-center gap-2 px-6 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {t('common.next') || 'Suivant'}
              <ChevronRight className="h-4 w-4" />
            </button>
          ) : (
            <button
              onClick={handleComplete}
              className="flex items-center gap-2 px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition"
            >
              {t('onboarding.start') || 'Commencer'}
              <Rocket className="h-4 w-4" />
            </button>
          )}
        </div>
      </motion.div>
    </div>
  )
}
