'use client'

import Link from 'next/link'
import { useState, useEffect } from 'react'
import { useLanguage } from '@/contexts/LanguageContext'
import {
  ArrowRight,
  BookOpen,
  Brain,
  Trophy,
  Users,
  Zap,
  Target,
  Sparkles,
  Clock,
  Swords,
  CheckCircle2,
  X,
  Star,
  TrendingUp,
  Shield,
  Flame,
  Play,
  CreditCard,
  GraduationCap,
  Calendar,
  BarChart3
} from 'lucide-react'

export default function Home() {
  const { t, messages } = useLanguage()
  const landing = (messages as any).landing
  const [studentsOnline, setStudentsOnline] = useState<number | null>(null)
  const [mounted, setMounted] = useState(false)

  // Fix hydration: only show dynamic content after mount
  useEffect(() => {
    setMounted(true)
    setStudentsOnline(47)
  }, [])

  // Simuler des étudiants en ligne (effet de preuve sociale)
  useEffect(() => {
    if (!mounted) return
    const interval = setInterval(() => {
      setStudentsOnline(prev => {
        if (prev === null) return 47
        const change = Math.floor(Math.random() * 5) - 2
        return Math.max(30, Math.min(80, prev + change))
      })
    }, 5000)
    return () => clearInterval(interval)
  }, [mounted])

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50">
      {/* Navbar */}
      <nav className="border-b border-gray-200 bg-white/80 backdrop-blur-xl sticky top-0 z-50">
        <div className="container mx-auto px-3 sm:px-4 py-3 sm:py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-1.5 sm:space-x-2">
              <BookOpen className="h-6 w-6 sm:h-8 sm:w-8 text-primary-600" />
              <span className="text-xl sm:text-2xl font-bold text-gray-900">Studera</span>
            </div>

            {/* Badge en direct */}
            {mounted && (
              <div className="hidden lg:flex items-center space-x-2 bg-green-50 border border-green-200 px-3 py-1.5 rounded-full">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
                </span>
                <span className="text-green-700 text-sm font-medium">{t('landing.nav.studentsOnline', { count: studentsOnline ?? '--' })}</span>
              </div>
            )}

            <div className="flex items-center space-x-1 sm:space-x-4">
              <Link
                href="/login"
                className="text-gray-600 hover:text-gray-900 font-medium transition text-xs sm:text-base px-1 sm:px-0"
              >
                {t('landing.nav.login')}
              </Link>
              <Link
                href="/register"
                className="bg-primary-600 text-white px-2 sm:px-6 py-1.5 sm:py-2.5 rounded-lg sm:rounded-xl hover:bg-primary-700 transition font-semibold shadow-lg shadow-primary-500/25 text-xs sm:text-base whitespace-nowrap"
              >
                {t('landing.nav.startFree')}
              </Link>
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="container mx-auto px-4 pt-8 sm:pt-16 pb-16 sm:pb-24">
        <div className="text-center max-w-5xl mx-auto">
          {/* Badge Nouveau */}
          <div className="inline-flex items-center space-x-2 bg-primary-50 border border-primary-200 px-3 sm:px-4 py-1.5 sm:py-2 rounded-full mb-6 sm:mb-8">
            <Flame className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-orange-500" />
            <span className="text-primary-700 text-xs sm:text-sm font-medium">{t('landing.hero.badge')}</span>
          </div>

          <h1 className="text-3xl sm:text-5xl md:text-7xl font-black mb-4 sm:mb-6 leading-tight text-gray-900">
            {t('landing.hero.title1')}
            <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary-600 via-purple-600 to-pink-600">
              {t('landing.hero.title2')}
            </span>
          </h1>

          <p className="text-base sm:text-xl md:text-2xl text-gray-600 mb-6 sm:mb-8 max-w-3xl mx-auto leading-relaxed px-2">
            <strong className="text-gray-900">{t('landing.hero.subtitle')}</strong>
            <br />
            <span className="text-primary-600">{t('landing.hero.subtitleHighlight')}</span>
          </p>

          {/* CTA Principal */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-4 mb-8 sm:mb-12 px-4">
            <Link
              href="/register"
              className="group w-full sm:w-auto bg-primary-600 text-white px-6 sm:px-8 py-3.5 sm:py-4 rounded-xl sm:rounded-2xl hover:bg-primary-700 transition-all font-bold text-base sm:text-lg flex items-center justify-center space-x-2 sm:space-x-3 shadow-2xl shadow-primary-500/30 hover:shadow-primary-500/50 hover:scale-105"
            >
              <span>{t('landing.hero.cta')}</span>
              <ArrowRight className="h-4 w-4 sm:h-5 sm:w-5 group-hover:translate-x-1 transition-transform" />
            </Link>
            <Link
              href="#features"
              className="flex items-center space-x-2 text-gray-500 hover:text-gray-900 transition font-medium text-sm sm:text-base"
            >
              <Play className="h-4 w-4 sm:h-5 sm:w-5" />
              <span>{t('landing.hero.watchFeatures')}</span>
            </Link>
          </div>

          {/* Trust Badges */}
          <div className="flex flex-wrap items-center justify-center gap-3 sm:gap-6 text-xs sm:text-sm text-gray-500 px-2">
            <div className="flex items-center space-x-1.5 sm:space-x-2">
              <CheckCircle2 className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-green-500" />
              <span>{t('landing.hero.trust1')}</span>
            </div>
            <div className="flex items-center space-x-1.5 sm:space-x-2">
              <CheckCircle2 className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-green-500" />
              <span>{t('landing.hero.trust2')}</span>
            </div>
            <div className="flex items-center space-x-1.5 sm:space-x-2">
              <CheckCircle2 className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-green-500" />
              <span>{t('landing.hero.trust3')}</span>
            </div>
          </div>
        </div>
      </section>

      {/* Social Proof - Bannière */}
      <section className="border-y border-gray-200 bg-white py-6">
        <div className="container mx-auto px-4">
          <div className="flex flex-wrap items-center justify-center gap-8 md:gap-16 text-center">
            <div>
              <div className="text-3xl font-bold text-gray-900">🚀</div>
              <div className="text-gray-500 text-sm">{t('landing.socialProof.betaOpen')}</div>
            </div>
            <div>
              <div className="text-3xl font-bold text-primary-600">FSRS</div>
              <div className="text-gray-500 text-sm">{t('landing.socialProof.fsrs')}</div>
            </div>
            <div>
              <div className="text-3xl font-bold text-purple-600">Claude AI</div>
              <div className="text-gray-500 text-sm">{t('landing.socialProof.claudeAI')}</div>
            </div>
            <div>
              <div className="text-3xl font-bold text-pink-600">∞</div>
              <div className="text-gray-500 text-sm">{t('landing.socialProof.allSubjects')}</div>
            </div>
          </div>
        </div>
      </section>

      {/* Problème / Solution */}
      <section className="container mx-auto px-4 py-24">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-5xl font-bold mb-4 text-gray-900">
              {t('landing.problem.title')}
            </h2>
            <p className="text-xl text-gray-600">
              {t('landing.problem.subtitle')}
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-8">
            {/* Problèmes */}
            <div className="bg-red-50 border border-red-200 rounded-3xl p-8">
              <h3 className="text-xl font-bold text-red-700 mb-6 flex items-center gap-2">
                <X className="h-6 w-6" />
                {t('landing.problem.without')}
              </h3>
              <ul className="space-y-4">
                {landing?.problem?.problems?.map((item: string, i: number) => (
                  <li key={i} className="flex items-start gap-3 text-gray-700">
                    <X className="h-5 w-5 text-red-500 flex-shrink-0 mt-0.5" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Solutions */}
            <div className="bg-green-50 border border-green-200 rounded-3xl p-8">
              <h3 className="text-xl font-bold text-green-700 mb-6 flex items-center gap-2">
                <CheckCircle2 className="h-6 w-6" />
                {t('landing.problem.with')}
              </h3>
              <ul className="space-y-4">
                {landing?.problem?.solutions?.map((item: string, i: number) => (
                  <li key={i} className="flex items-start gap-3 text-gray-700">
                    <CheckCircle2 className="h-5 w-5 text-green-500 flex-shrink-0 mt-0.5" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* Killer Features */}
      <section id="features" className="container mx-auto px-4 py-24">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-5xl font-bold mb-4 text-gray-900">
            {t('landing.features.title')}
          </h2>
          <p className="text-xl text-gray-600">
            {t('landing.features.subtitle')}
          </p>
        </div>

        <div className="grid lg:grid-cols-3 gap-8 max-w-6xl mx-auto">
          {/* Exam Mode - THE KILLER FEATURE */}
          <div className="group bg-white border-2 border-primary-200 rounded-3xl p-8 hover:border-primary-400 hover:shadow-2xl transition-all hover:scale-105 shadow-md relative overflow-hidden">
            {/* Badge populaire */}
            <div className="absolute top-4 right-4 bg-primary-600 text-white text-xs font-bold px-3 py-1 rounded-full">
              ⭐ {t('landing.features.examMode.badge')}
            </div>
            <div className="bg-gradient-to-r from-primary-500 to-indigo-600 w-16 h-16 rounded-2xl flex items-center justify-center mb-6">
              <GraduationCap className="h-8 w-8 text-white" />
            </div>
            <h3 className="text-2xl font-bold mb-3 text-gray-900">{t('landing.features.examMode.title')}</h3>
            <p className="text-gray-600 mb-4">
              {t('landing.features.examMode.description')}
            </p>
            <div className="space-y-2 text-sm">
              <div className="flex items-center gap-2 text-primary-600">
                <Calendar className="h-4 w-4" />
                <span>{t('landing.features.examMode.feature1')}</span>
              </div>
              <div className="flex items-center gap-2 text-indigo-600">
                <BarChart3 className="h-4 w-4" />
                <span>{t('landing.features.examMode.feature2')}</span>
              </div>
              <div className="flex items-center gap-2 text-purple-600">
                <Target className="h-4 w-4" />
                <span>{t('landing.features.examMode.feature3')}</span>
              </div>
            </div>
          </div>

          {/* Spark AI */}
          <div className="group bg-white border border-gray-200 rounded-3xl p-8 hover:border-purple-300 hover:shadow-xl transition-all hover:scale-105 shadow-sm">
            <div className="bg-gradient-to-r from-purple-500 to-purple-600 w-16 h-16 rounded-2xl flex items-center justify-center mb-6">
              <Sparkles className="h-8 w-8 text-white" />
            </div>
            <h3 className="text-2xl font-bold mb-3 text-gray-900">{t('landing.features.spark.title')}</h3>
            <p className="text-gray-600 mb-4">
              {t('landing.features.spark.description')}
            </p>
            <div className="text-purple-600 text-sm flex items-center gap-2">
              <Brain className="h-4 w-4" />
              <span>{t('landing.features.spark.poweredBy')}</span>
            </div>
          </div>

          {/* Focus Rooms */}
          <div className="group bg-white border border-gray-200 rounded-3xl p-8 hover:border-blue-300 hover:shadow-xl transition-all hover:scale-105 shadow-sm">
            <div className="bg-gradient-to-r from-blue-500 to-blue-600 w-16 h-16 rounded-2xl flex items-center justify-center mb-6">
              <Users className="h-8 w-8 text-white" />
            </div>
            <h3 className="text-2xl font-bold mb-3 text-gray-900">{t('landing.features.focusRooms.title')}</h3>
            <p className="text-gray-600 mb-4">
              {t('landing.features.focusRooms.description')}
            </p>
            {mounted && (
              <div className="flex items-center gap-2 text-blue-600 text-sm">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500"></span>
                </span>
                <span>{studentsOnline ?? '--'} {t('landing.features.focusRooms.studying')}</span>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Section dédiée Exam Mode - plus de détails */}
      <section className="container mx-auto px-4 py-24 bg-gradient-to-b from-primary-50/50 to-white">
        <div className="max-w-6xl mx-auto">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div>
              <div className="inline-flex items-center space-x-2 bg-primary-100 border border-primary-200 px-4 py-2 rounded-full mb-6">
                <GraduationCap className="h-4 w-4 text-primary-600" />
                <span className="text-primary-700 text-sm font-medium">{t('landing.examModeDetail.badge')}</span>
              </div>
              <h2 className="text-3xl md:text-5xl font-bold mb-6 text-gray-900">
                {t('landing.examModeDetail.title')}<br />
                <span className="text-primary-600">{t('landing.examModeDetail.titleHighlight')}</span>
              </h2>
              <p className="text-xl text-gray-600 mb-8">
                {t('landing.examModeDetail.description')}
              </p>

              <div className="space-y-4 mb-8">
                <div className="flex items-start gap-4">
                  <div className="bg-primary-100 p-2 rounded-lg">
                    <Calendar className="h-5 w-5 text-primary-600" />
                  </div>
                  <div>
                    <h4 className="font-bold text-gray-900">{t('landing.examModeDetail.feature1Title')}</h4>
                    <p className="text-gray-600">{t('landing.examModeDetail.feature1Desc')}</p>
                  </div>
                </div>
                <div className="flex items-start gap-4">
                  <div className="bg-green-100 p-2 rounded-lg">
                    <BarChart3 className="h-5 w-5 text-green-600" />
                  </div>
                  <div>
                    <h4 className="font-bold text-gray-900">{t('landing.examModeDetail.feature2Title')}</h4>
                    <p className="text-gray-600">{t('landing.examModeDetail.feature2Desc')}</p>
                  </div>
                </div>
                <div className="flex items-start gap-4">
                  <div className="bg-orange-100 p-2 rounded-lg">
                    <Target className="h-5 w-5 text-orange-600" />
                  </div>
                  <div>
                    <h4 className="font-bold text-gray-900">{t('landing.examModeDetail.feature3Title')}</h4>
                    <p className="text-gray-600">{t('landing.examModeDetail.feature3Desc')}</p>
                  </div>
                </div>
                <div className="flex items-start gap-4">
                  <div className="bg-purple-100 p-2 rounded-lg">
                    <Sparkles className="h-5 w-5 text-purple-600" />
                  </div>
                  <div>
                    <h4 className="font-bold text-gray-900">{t('landing.examModeDetail.feature4Title')}</h4>
                    <p className="text-gray-600">{t('landing.examModeDetail.feature4Desc')}</p>
                  </div>
                </div>
              </div>

              <Link
                href="/register"
                className="inline-flex items-center space-x-2 bg-primary-600 text-white px-8 py-4 rounded-xl hover:bg-primary-700 transition font-bold shadow-lg shadow-primary-500/25"
              >
                <span>{t('landing.examModeDetail.cta')}</span>
                <ArrowRight className="h-5 w-5" />
              </Link>
            </div>

            {/* Visual mockup */}
            <div className="bg-white rounded-2xl shadow-2xl border border-gray-200 p-6 relative">
              <div className="absolute -top-3 -right-3 bg-green-500 text-white text-xs font-bold px-3 py-1 rounded-full">
                {t('landing.examModeDetail.preview')}
              </div>

              {/* Header mockup */}
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h3 className="font-bold text-gray-900">{t('landing.examModeDetail.previewExam')}</h3>
                  <p className="text-sm text-gray-500">{t('landing.examModeDetail.previewDays')}</p>
                </div>
                <div className="text-right">
                  <div className="text-2xl font-bold text-primary-600">78%</div>
                  <p className="text-xs text-gray-500">{t('landing.examModeDetail.previewScore')}</p>
                </div>
              </div>

              {/* Progress bar */}
              <div className="mb-6">
                <div className="flex justify-between text-sm mb-2">
                  <span className="text-gray-600">{t('landing.examModeDetail.previewProgress')}</span>
                  <span className="font-medium">65%</span>
                </div>
                <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
                  <div className="h-full bg-gradient-to-r from-primary-500 to-primary-600 rounded-full" style={{width: '65%'}}></div>
                </div>
              </div>

              {/* Today's tasks */}
              <div className="space-y-3">
                <p className="text-sm font-medium text-gray-700">{t('landing.examModeDetail.previewTasks')}</p>
                <div className="flex items-center gap-3 p-3 bg-green-50 border border-green-200 rounded-lg">
                  <CheckCircle2 className="h-5 w-5 text-green-500" />
                  <span className="text-sm">{t('landing.examModeDetail.previewTask1')}</span>
                </div>
                <div className="flex items-center gap-3 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                  <Brain className="h-5 w-5 text-blue-500" />
                  <span className="text-sm">{t('landing.examModeDetail.previewTask2')}</span>
                </div>
                <div className="flex items-center gap-3 p-3 bg-gray-50 border border-gray-200 rounded-lg">
                  <Zap className="h-5 w-5 text-gray-400" />
                  <span className="text-sm text-gray-500">{t('landing.examModeDetail.previewTask3')}</span>
                </div>
              </div>

              {/* Motivation message */}
              <div className="mt-6 p-4 bg-gradient-to-r from-primary-50 to-purple-50 rounded-lg border border-primary-100">
                <p className="text-sm text-primary-700 font-medium">
                  💪 {t('landing.examModeDetail.previewMotivation')}
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Comparaison Concurrents */}
      <section className="container mx-auto px-4 py-24">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-5xl font-bold mb-4 text-gray-900">
              {t('landing.comparison.title')}
            </h2>
            <p className="text-xl text-gray-600">
              {t('landing.comparison.subtitle')}
            </p>
          </div>

          <div className="overflow-x-auto bg-white rounded-2xl shadow-sm border border-gray-200">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-4 px-4 text-gray-600 font-medium">{t('landing.comparison.feature')}</th>
                  <th className="py-4 px-4 text-center">
                    <div className="bg-primary-600 text-white px-4 py-2 rounded-xl font-bold">
                      Studera
                    </div>
                  </th>
                  <th className="py-4 px-4 text-center text-gray-500">Anki</th>
                  <th className="py-4 px-4 text-center text-gray-500">Quizlet</th>
                  <th className="py-4 px-4 text-center text-gray-500">Notion</th>
                </tr>
              </thead>
              <tbody className="text-center">
                {landing?.comparison?.features?.map((feature: string, i: number) => {
                  const isHighlight = i === 0 || i === 1
                  const hasAnki = i === 2 || i === 10
                  const hasQuizlet = i === 3 || i === 4 || i === 7 || i === 8
                  const hasNotion = i === 3 || i === 10
                  return (
                    <tr key={i} className={`border-b border-gray-100 hover:bg-gray-50 ${isHighlight ? 'bg-primary-50/50' : ''}`}>
                      <td className={`text-left py-4 px-4 ${isHighlight ? 'text-gray-900 font-semibold' : 'text-gray-700'}`}>{i < 2 ? '⭐ ' : ''}{feature}</td>
                      <td className="py-4 px-4">
                        <CheckCircle2 className="h-6 w-6 text-green-500 mx-auto" />
                      </td>
                      <td className="py-4 px-4">
                        {hasAnki ? (
                          <CheckCircle2 className="h-6 w-6 text-gray-400 mx-auto" />
                        ) : (
                          <X className="h-6 w-6 text-red-300 mx-auto" />
                        )}
                      </td>
                      <td className="py-4 px-4">
                        {hasQuizlet ? (
                          <CheckCircle2 className="h-6 w-6 text-gray-400 mx-auto" />
                        ) : (
                          <X className="h-6 w-6 text-red-300 mx-auto" />
                        )}
                      </td>
                      <td className="py-4 px-4">
                        {hasNotion ? (
                          <CheckCircle2 className="h-6 w-6 text-gray-400 mx-auto" />
                        ) : (
                          <X className="h-6 w-6 text-red-300 mx-auto" />
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* Toutes les Features */}
      <section className="container mx-auto px-4 py-24">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-5xl font-bold mb-4 text-gray-900">
            {t('landing.allFeatures.title')}
          </h2>
          <p className="text-xl text-gray-600">
            {t('landing.allFeatures.subtitle')}
          </p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 max-w-6xl mx-auto">
          {(() => {
            const icons = [Brain, Zap, Target, Users, Sparkles, Swords, Trophy, Flame, BookOpen, Clock, TrendingUp, Shield]
            const colors = ['primary', 'yellow', 'green', 'blue', 'purple', 'orange', 'yellow', 'red', 'blue', 'green', 'primary', 'purple']
            const items = landing?.allFeatures?.items || []
            return items.map((item: {title: string, desc: string}, i: number) => {
              const IconComponent = icons[i]
              const color = colors[i]
              return (
                <div
                  key={i}
                  className="bg-white border border-gray-200 rounded-2xl p-6 hover:shadow-lg hover:border-gray-300 transition-all shadow-sm"
                >
                  <div className={`p-3 rounded-lg mb-4 inline-block ${
                    color === 'primary' ? 'bg-primary-100' :
                    color === 'purple' ? 'bg-purple-100' :
                    color === 'green' ? 'bg-green-100' :
                    color === 'blue' ? 'bg-blue-100' :
                    color === 'yellow' ? 'bg-yellow-100' :
                    color === 'orange' ? 'bg-orange-100' :
                    'bg-red-100'
                  }`}>
                    <IconComponent className={`h-6 w-6 ${
                      color === 'primary' ? 'text-primary-600' :
                      color === 'purple' ? 'text-purple-600' :
                      color === 'green' ? 'text-green-600' :
                      color === 'blue' ? 'text-blue-600' :
                      color === 'yellow' ? 'text-yellow-600' :
                      color === 'orange' ? 'text-orange-600' :
                      'text-red-600'
                    }`} />
                  </div>
                  <h3 className="font-bold text-lg mb-1 text-gray-900">{item.title}</h3>
                  <p className="text-gray-600 text-sm">{item.desc}</p>
                </div>
              )
            })
          })()}
        </div>
      </section>

      {/* CTA Final */}
      <section className="container mx-auto px-4 py-24">
        <div className="max-w-4xl mx-auto">
          <div className="bg-gradient-to-r from-primary-600 to-purple-600 rounded-3xl p-12 text-center relative overflow-hidden">
            {/* Background decoration */}
            <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full blur-3xl"></div>
            <div className="absolute bottom-0 left-0 w-64 h-64 bg-white/10 rounded-full blur-3xl"></div>

            <div className="relative">
              <h2 className="text-3xl md:text-5xl font-bold mb-4 text-white">
                {t('landing.cta.title')}
              </h2>
              <p className="text-xl mb-8 text-primary-100 max-w-2xl mx-auto">
                {t('landing.cta.subtitle')}
                <br />
                <strong className="text-white">{t('landing.cta.free')}</strong>
              </p>

              <Link
                href="/register"
                className="group inline-flex items-center space-x-3 bg-white text-primary-600 px-10 py-5 rounded-2xl hover:bg-gray-100 transition-all font-bold text-xl shadow-2xl hover:scale-105"
              >
                <span>{t('landing.cta.button')}</span>
                <ArrowRight className="h-6 w-6 group-hover:translate-x-1 transition-transform" />
              </Link>

              <p className="mt-6 text-primary-200 text-sm">
                ⚡ {t('landing.cta.note')}
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* FAQ Rapide */}
      <section className="container mx-auto px-4 py-24">
        <div className="max-w-3xl mx-auto">
          <h2 className="text-3xl font-bold text-center mb-12 text-gray-900">{t('landing.faq.title')}</h2>

          <div className="space-y-4">
            {landing?.faq?.questions?.map((faq: {q: string, a: string}, i: number) => (
              <details
                key={i}
                className="group bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-sm"
              >
                <summary className="flex items-center justify-between p-6 cursor-pointer hover:bg-gray-50">
                  <span className="font-semibold text-lg text-gray-900">{faq.q}</span>
                  <span className="text-primary-600 group-open:rotate-180 transition-transform">
                    <ArrowRight className="h-5 w-5 rotate-90" />
                  </span>
                </summary>
                <div className="px-6 pb-6 text-gray-600">
                  {faq.a}
                </div>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-gray-200 bg-white py-8 sm:py-12">
        <div className="container mx-auto px-4">
          <div className="flex flex-col items-center gap-4 sm:gap-6 text-center">
            <div className="flex items-center space-x-2">
              <BookOpen className="h-5 w-5 sm:h-6 sm:w-6 text-primary-600" />
              <span className="text-lg sm:text-xl font-bold text-gray-900">Studera</span>
            </div>

            <div className="flex flex-wrap items-center justify-center gap-4 sm:gap-6 text-gray-500 text-xs sm:text-sm">
              <Link href="/about" className="hover:text-gray-900 transition">{t('landing.footer.about')}</Link>
              <Link href="/contact" className="hover:text-gray-900 transition">{t('landing.footer.contact')}</Link>
              <Link href="/privacy" className="hover:text-gray-900 transition">{t('landing.footer.privacy')}</Link>
              <Link href="/terms" className="hover:text-gray-900 transition">{t('landing.footer.terms')}</Link>
            </div>

            <p className="text-gray-400 text-xs sm:text-sm">
              {t('landing.footer.copyright')}
            </p>
          </div>
        </div>
      </footer>
    </div>
  )
}
