'use client'

import Link from 'next/link'
import { BookOpen, ArrowLeft, FileText, AlertTriangle, CheckCircle, XCircle, Scale, CreditCard } from 'lucide-react'
import { useLanguage } from '@/contexts/LanguageContext'

export default function TermsPage() {
  const { t, messages } = useLanguage()
  const terms = (messages as any).legal?.terms

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
              <span>{t('legal.terms.nav.back')}</span>
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="container mx-auto px-4 py-16">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center space-x-3 mb-6">
            <div className="bg-primary-100 p-3 rounded-xl">
              <FileText className="h-8 w-8 text-primary-600" />
            </div>
            <h1 className="text-4xl md:text-5xl font-extrabold text-gray-900">
              {t('legal.terms.hero.title1')}{' '}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary-600 to-purple-600">
                {t('legal.terms.hero.title2')}
              </span>
            </h1>
          </div>
          <p className="text-xl text-gray-600">
            {t('legal.terms.hero.lastUpdate')}
          </p>
        </div>
      </section>

      {/* Content */}
      <section className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto space-y-8">
          {/* Introduction */}
          <div className="bg-white rounded-2xl shadow-lg p-8">
            <p className="text-gray-600 leading-relaxed">
              {t('legal.terms.intro')}
            </p>
          </div>

          {/* Article 1 - Definitions */}
          <div className="bg-white rounded-2xl shadow-lg p-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">{t('legal.terms.articles.definitions.title')}</h2>
            <div className="space-y-3 text-gray-600">
              {terms?.articles?.definitions?.items?.map((item: { term: string; definition: string }, i: number) => (
                <p key={i}><strong className="text-gray-900">{item.term}</strong>: {item.definition}</p>
              ))}
            </div>
          </div>

          {/* Article 2 - Acceptance */}
          <div className="bg-white rounded-2xl shadow-lg p-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">{t('legal.terms.articles.acceptance.title')}</h2>
            <div className="space-y-4 text-gray-600">
              <p>{t('legal.terms.articles.acceptance.intro')}</p>
              <ul className="space-y-2">
                {terms?.articles?.acceptance?.items?.map((item: string, i: number) => (
                  <li key={i} className="flex items-start space-x-3">
                    <CheckCircle className="h-5 w-5 text-green-500 mt-0.5 flex-shrink-0" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* Article 3 - Services */}
          <div className="bg-white rounded-2xl shadow-lg p-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">{t('legal.terms.articles.services.title')}</h2>
            <div className="space-y-4 text-gray-600">
              <p>{t('legal.terms.articles.services.intro')}</p>
              <div className="grid md:grid-cols-2 gap-4">
                <div className="bg-gray-50 p-4 rounded-lg">
                  <h3 className="font-semibold text-gray-900 mb-2">{t('legal.terms.articles.services.free.title')}</h3>
                  <ul className="space-y-1 text-sm">
                    {terms?.articles?.services?.free?.items?.map((item: string, i: number) => (
                      <li key={i}>• {item}</li>
                    ))}
                  </ul>
                </div>
                <div className="bg-gradient-to-br from-primary-50 to-purple-50 p-4 rounded-lg border border-primary-200">
                  <h3 className="font-semibold text-gray-900 mb-2">{t('legal.terms.articles.services.premium.title')}</h3>
                  <ul className="space-y-1 text-sm">
                    {terms?.articles?.services?.premium?.items?.map((item: string, i: number) => (
                      <li key={i}>• {item}</li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          </div>

          {/* Article 4 - Account */}
          <div className="bg-white rounded-2xl shadow-lg p-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">{t('legal.terms.articles.account.title')}</h2>
            <div className="space-y-4 text-gray-600">
              <p>{t('legal.terms.articles.account.intro')}</p>
              <ul className="space-y-2">
                {terms?.articles?.account?.requirements?.map((item: string, i: number) => (
                  <li key={i}>• {item}</li>
                ))}
              </ul>
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mt-4">
                <div className="flex items-start space-x-3">
                  <AlertTriangle className="h-5 w-5 text-yellow-600 mt-0.5 flex-shrink-0" />
                  <div>
                    <h4 className="font-semibold text-yellow-800">{t('legal.terms.articles.account.important.title')}</h4>
                    <p className="text-yellow-700 text-sm">
                      {t('legal.terms.articles.account.important.content')}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Article 5 - Prohibited Uses */}
          <div className="bg-white rounded-2xl shadow-lg p-8">
            <div className="flex items-center space-x-3 mb-4">
              <div className="bg-red-100 w-10 h-10 rounded-lg flex items-center justify-center">
                <XCircle className="h-5 w-5 text-red-600" />
              </div>
              <h2 className="text-2xl font-bold text-gray-900">{t('legal.terms.articles.prohibited.title')}</h2>
            </div>
            <div className="space-y-4 text-gray-600">
              <p>{t('legal.terms.articles.prohibited.intro')}</p>
              <ul className="space-y-2">
                {terms?.articles?.prohibited?.items?.map((item: string, i: number) => (
                  <li key={i} className="flex items-start space-x-3">
                    <XCircle className="h-5 w-5 text-red-500 mt-0.5 flex-shrink-0" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
              <p className="text-sm mt-4 bg-red-50 p-3 rounded-lg text-red-700">
                {t('legal.terms.articles.prohibited.warning')}
              </p>
            </div>
          </div>

          {/* Article 6 - Intellectual Property */}
          <div className="bg-white rounded-2xl shadow-lg p-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">{t('legal.terms.articles.ip.title')}</h2>
            <div className="space-y-4 text-gray-600">
              <div className="bg-gray-50 p-4 rounded-lg">
                <h3 className="font-semibold text-gray-900 mb-2">{t('legal.terms.articles.ip.yourContent.title')}</h3>
                <p>{t('legal.terms.articles.ip.yourContent.description')}</p>
              </div>
              <div className="bg-gray-50 p-4 rounded-lg">
                <h3 className="font-semibold text-gray-900 mb-2">{t('legal.terms.articles.ip.ourContent.title')}</h3>
                <p>{t('legal.terms.articles.ip.ourContent.description')}</p>
              </div>
            </div>
          </div>

          {/* Article 7 - Premium Subscription */}
          <div className="bg-white rounded-2xl shadow-lg p-8">
            <div className="flex items-center space-x-3 mb-4">
              <div className="bg-green-100 w-10 h-10 rounded-lg flex items-center justify-center">
                <CreditCard className="h-5 w-5 text-green-600" />
              </div>
              <h2 className="text-2xl font-bold text-gray-900">{t('legal.terms.articles.premium.title')}</h2>
            </div>
            <div className="space-y-4 text-gray-600">
              {terms?.articles?.premium?.sections?.map((section: { title: string; content: string }, i: number) => (
                <div key={i}>
                  <h3 className="font-semibold text-gray-900">{section.title}</h3>
                  <p>{section.content}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Article 8 - Service Availability */}
          <div className="bg-white rounded-2xl shadow-lg p-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">{t('legal.terms.articles.availability.title')}</h2>
            <div className="space-y-4 text-gray-600">
              <p>{t('legal.terms.articles.availability.intro')}</p>
              <ul className="space-y-2">
                {terms?.articles?.availability?.items?.map((item: string, i: number) => (
                  <li key={i}>• {item}</li>
                ))}
              </ul>
              <p className="text-sm bg-blue-50 p-3 rounded-lg text-blue-700 mt-4">
                {t('legal.terms.articles.availability.compensation')}
              </p>
            </div>
          </div>

          {/* Article 9 - Liability */}
          <div className="bg-white rounded-2xl shadow-lg p-8">
            <div className="flex items-center space-x-3 mb-4">
              <div className="bg-purple-100 w-10 h-10 rounded-lg flex items-center justify-center">
                <Scale className="h-5 w-5 text-purple-600" />
              </div>
              <h2 className="text-2xl font-bold text-gray-900">{t('legal.terms.articles.liability.title')}</h2>
            </div>
            <div className="space-y-4 text-gray-600">
              <p>{t('legal.terms.articles.liability.intro')}</p>
              <ul className="space-y-2">
                {terms?.articles?.liability?.items?.map((item: string, i: number) => (
                  <li key={i}>• {item}</li>
                ))}
              </ul>
              <p className="mt-4">{t('legal.terms.articles.liability.exception')}</p>
            </div>
          </div>

          {/* Article 10 - Termination */}
          <div className="bg-white rounded-2xl shadow-lg p-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">{t('legal.terms.articles.termination.title')}</h2>
            <div className="space-y-4 text-gray-600">
              <div className="bg-gray-50 p-4 rounded-lg">
                <h3 className="font-semibold text-gray-900 mb-2">{t('legal.terms.articles.termination.byUser.title')}</h3>
                <p>{t('legal.terms.articles.termination.byUser.description')}</p>
              </div>
              <div className="bg-gray-50 p-4 rounded-lg">
                <h3 className="font-semibold text-gray-900 mb-2">{t('legal.terms.articles.termination.byUs.title')}</h3>
                <p>{t('legal.terms.articles.termination.byUs.description')}</p>
              </div>
            </div>
          </div>

          {/* Article 11 - Modifications */}
          <div className="bg-white rounded-2xl shadow-lg p-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">{t('legal.terms.articles.modifications.title')}</h2>
            <div className="space-y-4 text-gray-600">
              <p>{t('legal.terms.articles.modifications.content1')}</p>
              <p>{t('legal.terms.articles.modifications.content2')}</p>
            </div>
          </div>

          {/* Article 12 - Governing Law */}
          <div className="bg-white rounded-2xl shadow-lg p-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">{t('legal.terms.articles.governingLaw.title')}</h2>
            <div className="space-y-4 text-gray-600">
              <p>{t('legal.terms.articles.governingLaw.content1')}</p>
              <p>
                {t('legal.terms.articles.governingLaw.content2')}{' '}
                <a href="mailto:legal@studymaster.app" className="text-primary-600 hover:text-primary-700 font-medium">legal@studymaster.app</a>.
                {' '}{t('legal.terms.articles.governingLaw.content3')}
              </p>
            </div>
          </div>

          {/* Article 13 - Miscellaneous */}
          <div className="bg-white rounded-2xl shadow-lg p-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">{t('legal.terms.articles.miscellaneous.title')}</h2>
            <div className="space-y-4 text-gray-600">
              {terms?.articles?.miscellaneous?.items?.map((item: { title: string; description: string }, i: number) => (
                <p key={i}>
                  <strong className="text-gray-900">{item.title}:</strong> {item.description}
                </p>
              ))}
            </div>
          </div>

          {/* Contact */}
          <div className="bg-gradient-to-r from-primary-600 to-purple-600 rounded-2xl p-8 text-white">
            <h2 className="text-2xl font-bold mb-4">{t('legal.terms.contact.title')}</h2>
            <p className="text-primary-50 mb-4">
              {t('legal.terms.contact.description')}
            </p>
            <div className="flex flex-wrap gap-4">
              <a
                href="mailto:legal@studymaster.app"
                className="bg-white/20 hover:bg-white/30 px-6 py-2 rounded-lg transition font-medium"
              >
                legal@studymaster.app
              </a>
              <Link
                href="/contact"
                className="bg-white/20 hover:bg-white/30 px-6 py-2 rounded-lg transition font-medium"
              >
                {t('legal.terms.contact.form')}
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t bg-gray-50 py-8 mt-12">
        <div className="container mx-auto px-4">
          <div className="text-center text-gray-600">
            <p>{t('legal.terms.footer.copyright')}</p>
            <div className="flex items-center justify-center space-x-6 mt-4">
              <Link href="/about" className="hover:text-gray-900 transition">{t('legal.terms.footer.about')}</Link>
              <Link href="/contact" className="hover:text-gray-900 transition">{t('legal.terms.footer.contact')}</Link>
              <Link href="/privacy" className="hover:text-gray-900 transition">{t('legal.terms.footer.privacy')}</Link>
              <Link href="/terms" className="hover:text-gray-900 transition">{t('legal.terms.footer.terms')}</Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  )
}
