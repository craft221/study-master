'use client'

import Link from 'next/link'
import { BookOpen, ArrowLeft, Target, Heart, Lightbulb, Globe, Users, Sparkles } from 'lucide-react'
import { useLanguage } from '@/contexts/LanguageContext'

export default function AboutPage() {
  const { t, messages } = useLanguage()
  const about = (messages as any).about

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50">
      {/* Navbar */}
      <nav className="border-b bg-white/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <Link href="/" className="flex items-center space-x-2">
              <BookOpen className="h-8 w-8 text-primary-600" />
              <span className="text-2xl font-bold text-gray-900">Study Master</span>
            </Link>
            <Link
              href="/"
              className="text-gray-600 hover:text-gray-900 font-medium transition flex items-center space-x-2"
            >
              <ArrowLeft className="h-4 w-4" />
              <span>{t('about.nav.back')}</span>
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="container mx-auto px-4 py-16">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-4xl md:text-5xl font-extrabold text-gray-900 mb-6">
            {t('about.hero.title')}{' '}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary-600 to-purple-600">
              Study Master
            </span>
          </h1>
          <p className="text-xl text-gray-600 mb-8">
            {t('about.hero.subtitle')}
          </p>
        </div>
      </section>

      {/* Notre Histoire */}
      <section className="container mx-auto px-4 py-12">
        <div className="max-w-4xl mx-auto">
          <div className="bg-white rounded-2xl shadow-lg p-8 md:p-12">
            <div className="flex items-center space-x-3 mb-6">
              <div className="bg-primary-100 p-3 rounded-xl">
                <Lightbulb className="h-6 w-6 text-primary-600" />
              </div>
              <h2 className="text-2xl font-bold text-gray-900">{t('about.story.title')}</h2>
            </div>
            <div className="prose prose-lg text-gray-600 space-y-4">
              <p>{t('about.story.p1')}</p>
              <p>{t('about.story.p2')}</p>
              <p>{t('about.story.p3')}</p>
            </div>
          </div>
        </div>
      </section>

      {/* Notre Mission */}
      <section className="container mx-auto px-4 py-12">
        <div className="max-w-4xl mx-auto">
          <div className="bg-gradient-to-r from-primary-600 to-purple-600 rounded-2xl shadow-lg p-8 md:p-12 text-white">
            <div className="flex items-center space-x-3 mb-6">
              <div className="bg-white/20 p-3 rounded-xl">
                <Target className="h-6 w-6 text-white" />
              </div>
              <h2 className="text-2xl font-bold">{t('about.mission.title')}</h2>
            </div>
            <p className="text-xl text-primary-50">
              {t('about.mission.description')}
            </p>
          </div>
        </div>
      </section>

      {/* Nos Valeurs */}
      <section className="container mx-auto px-4 py-12">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-2xl font-bold text-gray-900 mb-8 text-center">{t('about.values.title')}</h2>
          <div className="grid md:grid-cols-2 gap-6">
            <div className="bg-white rounded-xl shadow-lg p-6">
              <div className="bg-blue-100 w-12 h-12 rounded-xl flex items-center justify-center mb-4">
                <Sparkles className="h-6 w-6 text-blue-600" />
              </div>
              <h3 className="text-lg font-bold text-gray-900 mb-2">{t('about.values.innovation.title')}</h3>
              <p className="text-gray-600">
                {t('about.values.innovation.description')}
              </p>
            </div>

            <div className="bg-white rounded-xl shadow-lg p-6">
              <div className="bg-green-100 w-12 h-12 rounded-xl flex items-center justify-center mb-4">
                <Globe className="h-6 w-6 text-green-600" />
              </div>
              <h3 className="text-lg font-bold text-gray-900 mb-2">{t('about.values.accessibility.title')}</h3>
              <p className="text-gray-600">
                {t('about.values.accessibility.description')}
              </p>
            </div>

            <div className="bg-white rounded-xl shadow-lg p-6">
              <div className="bg-purple-100 w-12 h-12 rounded-xl flex items-center justify-center mb-4">
                <Users className="h-6 w-6 text-purple-600" />
              </div>
              <h3 className="text-lg font-bold text-gray-900 mb-2">{t('about.values.community.title')}</h3>
              <p className="text-gray-600">
                {t('about.values.community.description')}
              </p>
            </div>

            <div className="bg-white rounded-xl shadow-lg p-6">
              <div className="bg-red-100 w-12 h-12 rounded-xl flex items-center justify-center mb-4">
                <Heart className="h-6 w-6 text-red-600" />
              </div>
              <h3 className="text-lg font-bold text-gray-900 mb-2">{t('about.values.passion.title')}</h3>
              <p className="text-gray-600">
                {t('about.values.passion.description')}
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Fonctionnalités Clés */}
      <section className="container mx-auto px-4 py-12">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-2xl font-bold text-gray-900 mb-8 text-center">{t('about.features.title')}</h2>
          <div className="bg-white rounded-2xl shadow-lg p-8">
            <ul className="space-y-4">
              {about?.features?.list?.map((item: { title: string; description: string }, i: number) => (
                <li key={i} className="flex items-start space-x-3">
                  <span className="text-primary-600 font-bold">✓</span>
                  <span className="text-gray-600">
                    <strong className="text-gray-900">{item.title}</strong> - {item.description}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="container mx-auto px-4 py-12">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">
            {t('about.cta.title')}
          </h2>
          <p className="text-gray-600 mb-8">
            {t('about.cta.subtitle')}
          </p>
          <Link
            href="/register"
            className="bg-primary-600 text-white px-8 py-4 rounded-lg hover:bg-primary-700 transition font-semibold text-lg inline-block shadow-lg"
          >
            {t('about.cta.button')}
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t bg-gray-50 py-8">
        <div className="container mx-auto px-4">
          <div className="text-center text-gray-600">
            <p>{t('about.footer.copyright')}</p>
            <div className="flex items-center justify-center space-x-6 mt-4">
              <Link href="/about" className="hover:text-gray-900 transition">{t('about.footer.about')}</Link>
              <Link href="/contact" className="hover:text-gray-900 transition">{t('about.footer.contact')}</Link>
              <Link href="/privacy" className="hover:text-gray-900 transition">{t('about.footer.privacy')}</Link>
              <Link href="/terms" className="hover:text-gray-900 transition">{t('about.footer.terms')}</Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  )
}
