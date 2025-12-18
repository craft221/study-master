'use client'

import Link from 'next/link'
import { useState, useEffect } from 'react'
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
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <BookOpen className="h-8 w-8 text-primary-600" />
              <span className="text-2xl font-bold text-gray-900">Study Master</span>
            </div>

            {/* Badge en direct */}
            <div className="hidden md:flex items-center space-x-2 bg-green-50 border border-green-200 px-3 py-1.5 rounded-full">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
              </span>
              <span className="text-green-700 text-sm font-medium">{studentsOnline ?? '--'} étudiants en ligne</span>
            </div>

            <div className="flex items-center space-x-4">
              <Link
                href="/login"
                className="text-gray-600 hover:text-gray-900 font-medium transition"
              >
                Connexion
              </Link>
              <Link
                href="/register"
                className="bg-primary-600 text-white px-6 py-2.5 rounded-xl hover:bg-primary-700 transition font-semibold shadow-lg shadow-primary-500/25"
              >
                Commencer gratuitement
              </Link>
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="container mx-auto px-4 pt-16 pb-24">
        <div className="text-center max-w-5xl mx-auto">
          {/* Badge Nouveau */}
          <div className="inline-flex items-center space-x-2 bg-primary-50 border border-primary-200 px-4 py-2 rounded-full mb-8">
            <Flame className="h-4 w-4 text-orange-500" />
            <span className="text-primary-700 text-sm font-medium">Nouveau — Rejoins la beta gratuite</span>
          </div>

          <h1 className="text-5xl md:text-7xl font-black mb-6 leading-tight text-gray-900">
            Arrête de galérer.
            <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary-600 via-purple-600 to-pink-600">
              Commence à dominer.
            </span>
          </h1>

          <p className="text-xl md:text-2xl text-gray-600 mb-8 max-w-3xl mx-auto leading-relaxed">
            <strong className="text-gray-900">Anki + Quizlet + Notion + Duolingo</strong> — combinés en une seule app gratuite.
            <br />
            <span className="text-primary-600">Avec une IA qui te connaît et des salles d'étude en groupe.</span>
          </p>

          {/* CTA Principal */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-12">
            <Link
              href="/register"
              className="group bg-primary-600 text-white px-8 py-4 rounded-2xl hover:bg-primary-700 transition-all font-bold text-lg flex items-center space-x-3 shadow-2xl shadow-primary-500/30 hover:shadow-primary-500/50 hover:scale-105"
            >
              <span>Créer mon compte gratuit</span>
              <ArrowRight className="h-5 w-5 group-hover:translate-x-1 transition-transform" />
            </Link>
            <Link
              href="#features"
              className="flex items-center space-x-2 text-gray-500 hover:text-gray-900 transition font-medium"
            >
              <Play className="h-5 w-5" />
              <span>Voir les fonctionnalités</span>
            </Link>
          </div>

          {/* Trust Badges */}
          <div className="flex flex-wrap items-center justify-center gap-6 text-sm text-gray-500">
            <div className="flex items-center space-x-2">
              <CheckCircle2 className="h-4 w-4 text-green-500" />
              <span>100% gratuit pour commencer</span>
            </div>
            <div className="flex items-center space-x-2">
              <CheckCircle2 className="h-4 w-4 text-green-500" />
              <span>Pas de carte bancaire requise</span>
            </div>
            <div className="flex items-center space-x-2">
              <CheckCircle2 className="h-4 w-4 text-green-500" />
              <span>Prêt en 30 secondes</span>
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
              <div className="text-gray-500 text-sm">Beta ouverte</div>
            </div>
            <div>
              <div className="text-3xl font-bold text-primary-600">FSRS</div>
              <div className="text-gray-500 text-sm">Algorithme #1 mondial</div>
            </div>
            <div>
              <div className="text-3xl font-bold text-purple-600">Claude AI</div>
              <div className="text-gray-500 text-sm">IA la plus avancée</div>
            </div>
            <div>
              <div className="text-3xl font-bold text-pink-600">∞</div>
              <div className="text-gray-500 text-sm">Toutes les matières</div>
            </div>
          </div>
        </div>
      </section>

      {/* Problème / Solution */}
      <section className="container mx-auto px-4 py-24">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-5xl font-bold mb-4 text-gray-900">
              Tu connais ce sentiment ?
            </h2>
            <p className="text-xl text-gray-600">
              Des heures à réviser... pour tout oublier le jour de l'exam.
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-8">
            {/* Problèmes */}
            <div className="bg-red-50 border border-red-200 rounded-3xl p-8">
              <h3 className="text-xl font-bold text-red-700 mb-6 flex items-center gap-2">
                <X className="h-6 w-6" />
                Sans Study Master
              </h3>
              <ul className="space-y-4">
                {[
                  "Tu révises pendant des heures mais tu oublies tout",
                  "Tu procrastines seul dans ta chambre",
                  "Tu utilises 10 apps différentes (Anki, Notion, Quizlet...)",
                  "Tu ne sais pas si tu es prêt pour l'exam",
                  "Zéro motivation après 2 jours"
                ].map((item, i) => (
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
                Avec Study Master
              </h3>
              <ul className="space-y-4">
                {[
                  "Tu mémorises 2x plus vite avec l'algorithme FSRS",
                  "Tu étudies avec d'autres en Focus Rooms (comme à la biblio)",
                  "Tout en un seul endroit : notes, flashcards, quiz, IA",
                  "L'IA te dit exactement quoi réviser",
                  "Gamification addictive : XP, streaks, duels, classements"
                ].map((item, i) => (
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
            Ce qu'aucune autre app ne fait
          </h2>
          <p className="text-xl text-gray-600">
            3 fonctionnalités uniques qui changent tout
          </p>
        </div>

        <div className="grid lg:grid-cols-3 gap-8 max-w-6xl mx-auto">
          {/* Exam Mode - THE KILLER FEATURE */}
          <div className="group bg-white border-2 border-primary-200 rounded-3xl p-8 hover:border-primary-400 hover:shadow-2xl transition-all hover:scale-105 shadow-md relative overflow-hidden">
            {/* Badge populaire */}
            <div className="absolute top-4 right-4 bg-primary-600 text-white text-xs font-bold px-3 py-1 rounded-full">
              ⭐ #1
            </div>
            <div className="bg-gradient-to-r from-primary-500 to-indigo-600 w-16 h-16 rounded-2xl flex items-center justify-center mb-6">
              <GraduationCap className="h-8 w-8 text-white" />
            </div>
            <h3 className="text-2xl font-bold mb-3 text-gray-900">Exam Mode</h3>
            <p className="text-gray-600 mb-4">
              Entre la date de ton exam, l'IA génère un <strong>plan de révision personnalisé</strong> jour par jour avec prédiction de score.
            </p>
            <div className="space-y-2 text-sm">
              <div className="flex items-center gap-2 text-primary-600">
                <Calendar className="h-4 w-4" />
                <span>Planning auto-généré par IA</span>
              </div>
              <div className="flex items-center gap-2 text-indigo-600">
                <BarChart3 className="h-4 w-4" />
                <span>Prédiction de ta note finale</span>
              </div>
              <div className="flex items-center gap-2 text-purple-600">
                <Target className="h-4 w-4" />
                <span>Détecte tes points faibles</span>
              </div>
            </div>
          </div>

          {/* Spark AI */}
          <div className="group bg-white border border-gray-200 rounded-3xl p-8 hover:border-purple-300 hover:shadow-xl transition-all hover:scale-105 shadow-sm">
            <div className="bg-gradient-to-r from-purple-500 to-purple-600 w-16 h-16 rounded-2xl flex items-center justify-center mb-6">
              <Sparkles className="h-8 w-8 text-white" />
            </div>
            <h3 className="text-2xl font-bold mb-3 text-gray-900">Spark — Ton tuteur IA</h3>
            <p className="text-gray-600 mb-4">
              Un assistant IA avec une vraie personnalité qui te connaît, t'encourage et t'explique tout.
            </p>
            <div className="text-purple-600 text-sm flex items-center gap-2">
              <Brain className="h-4 w-4" />
              <span>Propulsé par Claude (meilleure IA du marché)</span>
            </div>
          </div>

          {/* Focus Rooms */}
          <div className="group bg-white border border-gray-200 rounded-3xl p-8 hover:border-blue-300 hover:shadow-xl transition-all hover:scale-105 shadow-sm">
            <div className="bg-gradient-to-r from-blue-500 to-blue-600 w-16 h-16 rounded-2xl flex items-center justify-center mb-6">
              <Users className="h-8 w-8 text-white" />
            </div>
            <h3 className="text-2xl font-bold mb-3 text-gray-900">Focus Rooms</h3>
            <p className="text-gray-600 mb-4">
              Étudie en groupe virtuel, comme à la bibliothèque. Voir d'autres bosser te motive à bosser.
            </p>
            <div className="flex items-center gap-2 text-blue-600 text-sm">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-500"></span>
              </span>
              <span>{studentsOnline ?? '--'} personnes étudient maintenant</span>
            </div>
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
                <span className="text-primary-700 text-sm font-medium">Fonctionnalité phare</span>
              </div>
              <h2 className="text-3xl md:text-5xl font-bold mb-6 text-gray-900">
                Exam Mode :<br />
                <span className="text-primary-600">Ton coach IA personnel</span>
              </h2>
              <p className="text-xl text-gray-600 mb-8">
                Tu as un exam dans 2 semaines ? Entre la date, sélectionne tes notes, et l'IA te génère un <strong>plan de révision sur-mesure</strong>.
              </p>

              <div className="space-y-4 mb-8">
                <div className="flex items-start gap-4">
                  <div className="bg-primary-100 p-2 rounded-lg">
                    <Calendar className="h-5 w-5 text-primary-600" />
                  </div>
                  <div>
                    <h4 className="font-bold text-gray-900">Plan jour par jour</h4>
                    <p className="text-gray-600">Tâches quotidiennes : lecture, quiz, flashcards, révision ciblée</p>
                  </div>
                </div>
                <div className="flex items-start gap-4">
                  <div className="bg-green-100 p-2 rounded-lg">
                    <BarChart3 className="h-5 w-5 text-green-600" />
                  </div>
                  <div>
                    <h4 className="font-bold text-gray-900">Prédiction de score</h4>
                    <p className="text-gray-600">L'IA prédit ta note basée sur ta progression réelle</p>
                  </div>
                </div>
                <div className="flex items-start gap-4">
                  <div className="bg-orange-100 p-2 rounded-lg">
                    <Target className="h-5 w-5 text-orange-600" />
                  </div>
                  <div>
                    <h4 className="font-bold text-gray-900">Détection des faiblesses</h4>
                    <p className="text-gray-600">Analyse tes erreurs et adapte le plan automatiquement</p>
                  </div>
                </div>
                <div className="flex items-start gap-4">
                  <div className="bg-purple-100 p-2 rounded-lg">
                    <Sparkles className="h-5 w-5 text-purple-600" />
                  </div>
                  <div>
                    <h4 className="font-bold text-gray-900">Examen blanc généré</h4>
                    <p className="text-gray-600">Quiz complet basé sur tes notes pour te tester avant le jour J</p>
                  </div>
                </div>
              </div>

              <Link
                href="/register"
                className="inline-flex items-center space-x-2 bg-primary-600 text-white px-8 py-4 rounded-xl hover:bg-primary-700 transition font-bold shadow-lg shadow-primary-500/25"
              >
                <span>Essayer Exam Mode gratuitement</span>
                <ArrowRight className="h-5 w-5" />
              </Link>
            </div>

            {/* Visual mockup */}
            <div className="bg-white rounded-2xl shadow-2xl border border-gray-200 p-6 relative">
              <div className="absolute -top-3 -right-3 bg-green-500 text-white text-xs font-bold px-3 py-1 rounded-full">
                Live Preview
              </div>

              {/* Header mockup */}
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h3 className="font-bold text-gray-900">Partiel Mathématiques</h3>
                  <p className="text-sm text-gray-500">Dans 12 jours</p>
                </div>
                <div className="text-right">
                  <div className="text-2xl font-bold text-primary-600">78%</div>
                  <p className="text-xs text-gray-500">Score prédit</p>
                </div>
              </div>

              {/* Progress bar */}
              <div className="mb-6">
                <div className="flex justify-between text-sm mb-2">
                  <span className="text-gray-600">Progression</span>
                  <span className="font-medium">65%</span>
                </div>
                <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
                  <div className="h-full bg-gradient-to-r from-primary-500 to-primary-600 rounded-full" style={{width: '65%'}}></div>
                </div>
              </div>

              {/* Today's tasks */}
              <div className="space-y-3">
                <p className="text-sm font-medium text-gray-700">Tâches d'aujourd'hui</p>
                <div className="flex items-center gap-3 p-3 bg-green-50 border border-green-200 rounded-lg">
                  <CheckCircle2 className="h-5 w-5 text-green-500" />
                  <span className="text-sm">Lecture: Intégrales (Chapitre 4)</span>
                </div>
                <div className="flex items-center gap-3 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                  <Brain className="h-5 w-5 text-blue-500" />
                  <span className="text-sm">Quiz: Dérivées (15 questions)</span>
                </div>
                <div className="flex items-center gap-3 p-3 bg-gray-50 border border-gray-200 rounded-lg">
                  <Zap className="h-5 w-5 text-gray-400" />
                  <span className="text-sm text-gray-500">Flashcards: Formules clés</span>
                </div>
              </div>

              {/* Motivation message */}
              <div className="mt-6 p-4 bg-gradient-to-r from-primary-50 to-purple-50 rounded-lg border border-primary-100">
                <p className="text-sm text-primary-700 font-medium">
                  💪 Tu es dans les temps ! Continue comme ça et tu vas cartonner.
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
              Pourquoi changer ?
            </h2>
            <p className="text-xl text-gray-600">
              Study Master vs. ce que tu utilises probablement
            </p>
          </div>

          <div className="overflow-x-auto bg-white rounded-2xl shadow-sm border border-gray-200">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-4 px-4 text-gray-600 font-medium">Fonctionnalité</th>
                  <th className="py-4 px-4 text-center">
                    <div className="bg-primary-600 text-white px-4 py-2 rounded-xl font-bold">
                      Study Master
                    </div>
                  </th>
                  <th className="py-4 px-4 text-center text-gray-500">Anki</th>
                  <th className="py-4 px-4 text-center text-gray-500">Quizlet</th>
                  <th className="py-4 px-4 text-center text-gray-500">Notion</th>
                </tr>
              </thead>
              <tbody className="text-center">
                {[
                  { feature: "⭐ Plan de révision IA (Exam Mode)", us: true, anki: false, quizlet: false, notion: false, highlight: true },
                  { feature: "Prédiction de score à l'examen", us: true, anki: false, quizlet: false, notion: false, highlight: true },
                  { feature: "Flashcards FSRS (meilleur algo)", us: true, anki: true, quizlet: false, notion: false },
                  { feature: "Génération IA de contenu", us: true, anki: false, quizlet: true, notion: true },
                  { feature: "Quiz adaptatifs", us: true, anki: false, quizlet: true, notion: false },
                  { feature: "Focus Rooms (étude en groupe)", us: true, anki: false, quizlet: false, notion: false },
                  { feature: "Assistant IA personnalisé", us: true, anki: false, quizlet: false, notion: false },
                  { feature: "Duels PvP", us: true, anki: false, quizlet: true, notion: false },
                  { feature: "Gamification complète", us: true, anki: false, quizlet: true, notion: false },
                  { feature: "Notes + Flashcards + Quiz", us: true, anki: false, quizlet: false, notion: false },
                  { feature: "100% gratuit pour commencer", us: true, anki: true, quizlet: false, notion: true },
                ].map((row, i) => (
                  <tr key={i} className={`border-b border-gray-100 hover:bg-gray-50 ${(row as any).highlight ? 'bg-primary-50/50' : ''}`}>
                    <td className={`text-left py-4 px-4 ${(row as any).highlight ? 'text-gray-900 font-semibold' : 'text-gray-700'}`}>{row.feature}</td>
                    <td className="py-4 px-4">
                      {row.us ? (
                        <CheckCircle2 className="h-6 w-6 text-green-500 mx-auto" />
                      ) : (
                        <X className="h-6 w-6 text-red-400 mx-auto" />
                      )}
                    </td>
                    <td className="py-4 px-4">
                      {row.anki ? (
                        <CheckCircle2 className="h-6 w-6 text-gray-400 mx-auto" />
                      ) : (
                        <X className="h-6 w-6 text-red-300 mx-auto" />
                      )}
                    </td>
                    <td className="py-4 px-4">
                      {row.quizlet ? (
                        <CheckCircle2 className="h-6 w-6 text-gray-400 mx-auto" />
                      ) : (
                        <X className="h-6 w-6 text-red-300 mx-auto" />
                      )}
                    </td>
                    <td className="py-4 px-4">
                      {row.notion ? (
                        <CheckCircle2 className="h-6 w-6 text-gray-400 mx-auto" />
                      ) : (
                        <X className="h-6 w-6 text-red-300 mx-auto" />
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* Toutes les Features */}
      <section className="container mx-auto px-4 py-24">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-5xl font-bold mb-4 text-gray-900">
            Tout ce dont tu as besoin
          </h2>
          <p className="text-xl text-gray-600">
            Plus de 15 fonctionnalités pour réussir tes exams
          </p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 max-w-6xl mx-auto">
          {[
            { icon: Brain, title: "IA Générative", desc: "Crée flashcards et quiz depuis tes notes", color: "primary" },
            { icon: Zap, title: "Flashcards FSRS", desc: "Mémorise 2x plus vite, scientifiquement prouvé", color: "yellow" },
            { icon: Target, title: "Quiz Adaptatifs", desc: "Questions qui s'adaptent à ton niveau", color: "green" },
            { icon: Users, title: "Focus Rooms", desc: "Étudie en groupe virtuel", color: "blue" },
            { icon: Sparkles, title: "Spark AI", desc: "Ton tuteur personnel disponible 24/7", color: "purple" },
            { icon: Swords, title: "Duels", desc: "Défie tes amis en quiz", color: "orange" },
            { icon: Trophy, title: "Classements", desc: "Compare-toi aux autres étudiants", color: "yellow" },
            { icon: Flame, title: "Streaks", desc: "Garde ta série de jours d'étude", color: "red" },
            { icon: BookOpen, title: "Notes Markdown", desc: "Éditeur puissant avec LaTeX", color: "blue" },
            { icon: Clock, title: "Pomodoro", desc: "Timer intégré pour tes sessions", color: "green" },
            { icon: TrendingUp, title: "Statistiques", desc: "Suis ta progression en détail", color: "primary" },
            { icon: Shield, title: "Mode Examen", desc: "Plan de révision IA personnalisé", color: "purple" },
          ].map((feature, i) => (
            <div
              key={i}
              className="bg-white border border-gray-200 rounded-2xl p-6 hover:shadow-lg hover:border-gray-300 transition-all shadow-sm"
            >
              <div className={`p-3 rounded-lg mb-4 inline-block ${
                feature.color === 'primary' ? 'bg-primary-100' :
                feature.color === 'purple' ? 'bg-purple-100' :
                feature.color === 'green' ? 'bg-green-100' :
                feature.color === 'blue' ? 'bg-blue-100' :
                feature.color === 'yellow' ? 'bg-yellow-100' :
                feature.color === 'orange' ? 'bg-orange-100' :
                'bg-red-100'
              }`}>
                <feature.icon className={`h-6 w-6 ${
                  feature.color === 'primary' ? 'text-primary-600' :
                  feature.color === 'purple' ? 'text-purple-600' :
                  feature.color === 'green' ? 'text-green-600' :
                  feature.color === 'blue' ? 'text-blue-600' :
                  feature.color === 'yellow' ? 'text-yellow-600' :
                  feature.color === 'orange' ? 'text-orange-600' :
                  'text-red-600'
                }`} />
              </div>
              <h3 className="font-bold text-lg mb-1 text-gray-900">{feature.title}</h3>
              <p className="text-gray-600 text-sm">{feature.desc}</p>
            </div>
          ))}
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
                Prêt à cartonner ?
              </h2>
              <p className="text-xl mb-8 text-primary-100 max-w-2xl mx-auto">
                Rejoins les étudiants qui ont décidé d'arrêter de galérer.
                <br />
                <strong className="text-white">C'est gratuit. Pour toujours.</strong>
              </p>

              <Link
                href="/register"
                className="group inline-flex items-center space-x-3 bg-white text-primary-600 px-10 py-5 rounded-2xl hover:bg-gray-100 transition-all font-bold text-xl shadow-2xl hover:scale-105"
              >
                <span>Créer mon compte gratuit</span>
                <ArrowRight className="h-6 w-6 group-hover:translate-x-1 transition-transform" />
              </Link>

              <p className="mt-6 text-primary-200 text-sm">
                ⚡ Inscription en 30 secondes • Pas de carte bancaire
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* FAQ Rapide */}
      <section className="container mx-auto px-4 py-24">
        <div className="max-w-3xl mx-auto">
          <h2 className="text-3xl font-bold text-center mb-12 text-gray-900">Questions fréquentes</h2>

          <div className="space-y-4">
            {[
              {
                q: "C'est vraiment gratuit ?",
                a: "Oui ! Tu as accès à toutes les fonctionnalités de base gratuitement, pour toujours. Le plan Premium débloque plus de requêtes IA et des fonctionnalités avancées."
              },
              {
                q: "C'est quoi l'algorithme FSRS ?",
                a: "FSRS (Free Spaced Repetition Scheduler) est l'algorithme de mémorisation le plus avancé au monde. Il est 30% plus efficace que l'ancien algorithme d'Anki. Tu révises moins, tu retiens plus."
              },
              {
                q: "Je peux l'utiliser pour n'importe quelle matière ?",
                a: "Absolument ! Médecine, droit, langues, sciences, histoire... Study Master fonctionne pour toutes les matières. L'IA s'adapte à ton domaine."
              },
              {
                q: "Mes données sont sécurisées ?",
                a: "Oui. Tes données sont chiffrées et stockées de manière sécurisée. On ne vend jamais tes données à des tiers."
              }
            ].map((faq, i) => (
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
      <footer className="border-t border-gray-200 bg-white py-12">
        <div className="container mx-auto px-4">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="flex items-center space-x-2">
              <BookOpen className="h-6 w-6 text-primary-600" />
              <span className="text-xl font-bold text-gray-900">Study Master</span>
            </div>

            <div className="flex items-center space-x-6 text-gray-500 text-sm">
              <Link href="/about" className="hover:text-gray-900 transition">À propos</Link>
              <Link href="/contact" className="hover:text-gray-900 transition">Contact</Link>
              <Link href="/privacy" className="hover:text-gray-900 transition">Confidentialité</Link>
              <Link href="/terms" className="hover:text-gray-900 transition">CGU</Link>
            </div>

            <p className="text-gray-400 text-sm">
              © 2025 Study Master. Fait avec 💜 pour les étudiants.
            </p>
          </div>
        </div>
      </footer>
    </div>
  )
}
