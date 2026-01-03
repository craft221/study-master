'use client'

import Link from 'next/link'
import { BookOpen, ArrowLeft, Shield, Eye, Lock, Server, UserCheck, Mail } from 'lucide-react'
import { useLanguage } from '@/contexts/LanguageContext'

export default function PrivacyPage() {
  const { t, messages } = useLanguage()
  const privacy = (messages as any).legal?.privacy

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
              <span>{t('legal.privacy.nav.back')}</span>
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="container mx-auto px-4 py-16">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center space-x-3 mb-6">
            <div className="bg-primary-100 p-3 rounded-xl">
              <Shield className="h-8 w-8 text-primary-600" />
            </div>
            <h1 className="text-4xl md:text-5xl font-extrabold text-gray-900">
              {t('legal.privacy.hero.title1')}{' '}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary-600 to-purple-600">
                {t('legal.privacy.hero.title2')}
              </span>
            </h1>
          </div>
          <p className="text-xl text-gray-600">
            {t('legal.privacy.hero.lastUpdate')}
          </p>
        </div>
      </section>

      {/* Content */}
      <section className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto space-y-8">
          {/* Introduction */}
          <div className="bg-white rounded-2xl shadow-lg p-8">
            <p className="text-gray-600 leading-relaxed">
              {t('legal.privacy.intro')}
            </p>
          </div>

          {/* Section 1 - Data Collected */}
          <div className="bg-white rounded-2xl shadow-lg p-8">
            <div className="flex items-center space-x-3 mb-4">
              <div className="bg-blue-100 w-10 h-10 rounded-lg flex items-center justify-center">
                <Eye className="h-5 w-5 text-blue-600" />
              </div>
              <h2 className="text-2xl font-bold text-gray-900">{t('legal.privacy.sections.dataCollected.title')}</h2>
            </div>
            <div className="space-y-4 text-gray-600">
              <p>{t('legal.privacy.sections.dataCollected.intro')}</p>
              <div className="space-y-3">
                {privacy?.sections?.dataCollected?.categories?.map((category: { title: string; items: string[] }, i: number) => (
                  <div key={i} className="bg-gray-50 p-4 rounded-lg">
                    <h3 className="font-semibold text-gray-900 mb-2">{category.title}</h3>
                    <ul className="list-disc list-inside space-y-1">
                      {category.items.map((item: string, j: number) => (
                        <li key={j}>{item}</li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Section 2 - Data Usage */}
          <div className="bg-white rounded-2xl shadow-lg p-8">
            <div className="flex items-center space-x-3 mb-4">
              <div className="bg-green-100 w-10 h-10 rounded-lg flex items-center justify-center">
                <UserCheck className="h-5 w-5 text-green-600" />
              </div>
              <h2 className="text-2xl font-bold text-gray-900">{t('legal.privacy.sections.dataUsage.title')}</h2>
            </div>
            <div className="space-y-4 text-gray-600">
              <p>{t('legal.privacy.sections.dataUsage.intro')}</p>
              <ul className="space-y-3">
                {privacy?.sections?.dataUsage?.uses?.map((use: { title: string; description: string }, i: number) => (
                  <li key={i} className="flex items-start space-x-3">
                    <span className="text-primary-600 font-bold mt-1">•</span>
                    <span><strong className="text-gray-900">{use.title}</strong>: {use.description}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* Section 3 - Data Protection */}
          <div className="bg-white rounded-2xl shadow-lg p-8">
            <div className="flex items-center space-x-3 mb-4">
              <div className="bg-purple-100 w-10 h-10 rounded-lg flex items-center justify-center">
                <Lock className="h-5 w-5 text-purple-600" />
              </div>
              <h2 className="text-2xl font-bold text-gray-900">{t('legal.privacy.sections.dataProtection.title')}</h2>
            </div>
            <div className="space-y-4 text-gray-600">
              <p>{t('legal.privacy.sections.dataProtection.intro')}</p>
              <div className="grid md:grid-cols-2 gap-4">
                {privacy?.sections?.dataProtection?.measures?.map((measure: { title: string; description: string }, i: number) => (
                  <div key={i} className="bg-gray-50 p-4 rounded-lg">
                    <h3 className="font-semibold text-gray-900 mb-2">{measure.title}</h3>
                    <p>{measure.description}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Section 4 - Data Sharing */}
          <div className="bg-white rounded-2xl shadow-lg p-8">
            <div className="flex items-center space-x-3 mb-4">
              <div className="bg-red-100 w-10 h-10 rounded-lg flex items-center justify-center">
                <Server className="h-5 w-5 text-red-600" />
              </div>
              <h2 className="text-2xl font-bold text-gray-900">{t('legal.privacy.sections.dataSharing.title')}</h2>
            </div>
            <div className="space-y-4 text-gray-600">
              <p className="font-semibold text-gray-900">
                {t('legal.privacy.sections.dataSharing.noSale')}
              </p>
              <p>{t('legal.privacy.sections.dataSharing.intro')}</p>
              <ul className="space-y-3">
                {privacy?.sections?.dataSharing?.cases?.map((caseItem: { title: string; description: string }, i: number) => (
                  <li key={i} className="flex items-start space-x-3">
                    <span className="text-primary-600 font-bold mt-1">•</span>
                    <span><strong className="text-gray-900">{caseItem.title}</strong>: {caseItem.description}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* Section 5 - Your Rights */}
          <div className="bg-white rounded-2xl shadow-lg p-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">{t('legal.privacy.sections.yourRights.title')}</h2>
            <div className="space-y-4 text-gray-600">
              <p>{t('legal.privacy.sections.yourRights.intro')}</p>
              <div className="grid md:grid-cols-2 gap-4">
                {privacy?.sections?.yourRights?.rights?.map((right: { title: string; description: string }, i: number) => (
                  <div key={i} className="border-l-4 border-primary-500 pl-4">
                    <h3 className="font-semibold text-gray-900">{right.title}</h3>
                    <p className="text-sm">{right.description}</p>
                  </div>
                ))}
              </div>
              <p className="mt-4">
                {t('legal.privacy.sections.yourRights.contact')}{' '}
                <a href="mailto:privacy@studymaster.app" className="text-primary-600 hover:text-primary-700 font-medium">
                  privacy@studymaster.app
                </a>
              </p>
            </div>
          </div>

          {/* Section 6 - Cookies */}
          <div className="bg-white rounded-2xl shadow-lg p-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">{t('legal.privacy.sections.cookies.title')}</h2>
            <div className="space-y-4 text-gray-600">
              <p>{t('legal.privacy.sections.cookies.intro')}</p>
              <ul className="space-y-2">
                {privacy?.sections?.cookies?.types?.map((type: { title: string; description: string }, i: number) => (
                  <li key={i} className="flex items-start space-x-3">
                    <span className="text-primary-600 font-bold mt-1">•</span>
                    <span><strong className="text-gray-900">{type.title}</strong>: {type.description}</span>
                  </li>
                ))}
              </ul>
              <p>{t('legal.privacy.sections.cookies.manage')}</p>
            </div>
          </div>

          {/* Section 7 - Data Retention */}
          <div className="bg-white rounded-2xl shadow-lg p-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">{t('legal.privacy.sections.dataRetention.title')}</h2>
            <div className="space-y-4 text-gray-600">
              <p>{t('legal.privacy.sections.dataRetention.intro')}</p>
              <ul className="space-y-2">
                {privacy?.sections?.dataRetention?.periods?.map((period: { title: string; duration: string }, i: number) => (
                  <li key={i} className="flex items-start space-x-3">
                    <span className="text-primary-600 font-bold mt-1">•</span>
                    <span><strong className="text-gray-900">{period.title}</strong>: {period.duration}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* Section 8 - Minors */}
          <div className="bg-white rounded-2xl shadow-lg p-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">{t('legal.privacy.sections.minors.title')}</h2>
            <div className="space-y-4 text-gray-600">
              <p>{t('legal.privacy.sections.minors.content')}</p>
            </div>
          </div>

          {/* Section 9 - Changes */}
          <div className="bg-white rounded-2xl shadow-lg p-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">{t('legal.privacy.sections.changes.title')}</h2>
            <div className="space-y-4 text-gray-600">
              <p>{t('legal.privacy.sections.changes.content')}</p>
            </div>
          </div>

          {/* Contact */}
          <div className="bg-gradient-to-r from-primary-600 to-purple-600 rounded-2xl p-8 text-white">
            <div className="flex items-center space-x-3 mb-4">
              <Mail className="h-6 w-6" />
              <h2 className="text-2xl font-bold">{t('legal.privacy.contact.title')}</h2>
            </div>
            <p className="text-primary-50 mb-4">
              {t('legal.privacy.contact.description')}
            </p>
            <div className="flex flex-wrap gap-4">
              <a
                href="mailto:privacy@studymaster.app"
                className="bg-white/20 hover:bg-white/30 px-6 py-2 rounded-lg transition font-medium"
              >
                privacy@studymaster.app
              </a>
              <Link
                href="/contact"
                className="bg-white/20 hover:bg-white/30 px-6 py-2 rounded-lg transition font-medium"
              >
                {t('legal.privacy.contact.form')}
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t bg-gray-50 py-8 mt-12">
        <div className="container mx-auto px-4">
          <div className="text-center text-gray-600">
            <p>{t('legal.privacy.footer.copyright')}</p>
            <div className="flex items-center justify-center space-x-6 mt-4">
              <Link href="/about" className="hover:text-gray-900 transition">{t('legal.privacy.footer.about')}</Link>
              <Link href="/contact" className="hover:text-gray-900 transition">{t('legal.privacy.footer.contact')}</Link>
              <Link href="/privacy" className="hover:text-gray-900 transition">{t('legal.privacy.footer.privacy')}</Link>
              <Link href="/terms" className="hover:text-gray-900 transition">{t('legal.privacy.footer.terms')}</Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  )
}
