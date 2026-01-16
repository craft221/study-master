'use client'

import Link from 'next/link'
import { BookOpen, ArrowLeft, Mail, MessageSquare, Clock, Send } from 'lucide-react'
import { useState } from 'react'
import { useLanguage } from '@/contexts/LanguageContext'

export default function ContactPage() {
  const { t, messages } = useLanguage()
  const contact = (messages as any).contact

  const [formData, setFormData] = useState({
    name: '',
    email: '',
    subject: '',
    message: ''
  })
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isSubmitted, setIsSubmitted] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)

    // Simuler l'envoi (à remplacer par un vrai endpoint)
    await new Promise(resolve => setTimeout(resolve, 1000))

    setIsSubmitted(true)
    setIsSubmitting(false)
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    setFormData(prev => ({
      ...prev,
      [e.target.name]: e.target.value
    }))
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50">
      {/* Navbar */}
      <nav className="border-b bg-white/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <Link href="/" className="flex items-center space-x-2">
              <BookOpen className="h-8 w-8 text-primary-600" />
              <span className="text-2xl font-bold text-gray-900">Studera</span>
            </Link>
            <Link
              href="/"
              className="text-gray-600 hover:text-gray-900 font-medium transition flex items-center space-x-2"
            >
              <ArrowLeft className="h-4 w-4" />
              <span>{t('contact.nav.back')}</span>
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="container mx-auto px-4 py-16">
        <div className="max-w-4xl mx-auto text-center">
          <h1 className="text-4xl md:text-5xl font-extrabold text-gray-900 mb-6">
            {t('contact.hero.title1')}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary-600 to-purple-600">
              {t('contact.hero.title2')}
            </span>
          </h1>
          <p className="text-xl text-gray-600">
            {t('contact.hero.subtitle')}
          </p>
        </div>
      </section>

      {/* Contact Content */}
      <section className="container mx-auto px-4 py-12">
        <div className="max-w-5xl mx-auto">
          <div className="grid md:grid-cols-3 gap-8">
            {/* Contact Info */}
            <div className="space-y-6">
              <div className="bg-white rounded-xl shadow-lg p-6">
                <div className="bg-primary-100 w-12 h-12 rounded-xl flex items-center justify-center mb-4">
                  <Mail className="h-6 w-6 text-primary-600" />
                </div>
                <h3 className="text-lg font-bold text-gray-900 mb-2">{t('contact.info.email.title')}</h3>
                <p className="text-gray-600 mb-2">{t('contact.info.email.description')}</p>
                <a
                  href="mailto:contact@studera.app"
                  className="text-primary-600 hover:text-primary-700 font-medium"
                >
                  contact@studera.app
                </a>
              </div>

              <div className="bg-white rounded-xl shadow-lg p-6">
                <div className="bg-green-100 w-12 h-12 rounded-xl flex items-center justify-center mb-4">
                  <MessageSquare className="h-6 w-6 text-green-600" />
                </div>
                <h3 className="text-lg font-bold text-gray-900 mb-2">{t('contact.info.support.title')}</h3>
                <p className="text-gray-600 mb-2">{t('contact.info.support.description')}</p>
                <a
                  href="mailto:support@studera.app"
                  className="text-primary-600 hover:text-primary-700 font-medium"
                >
                  support@studera.app
                </a>
              </div>

              <div className="bg-white rounded-xl shadow-lg p-6">
                <div className="bg-purple-100 w-12 h-12 rounded-xl flex items-center justify-center mb-4">
                  <Clock className="h-6 w-6 text-purple-600" />
                </div>
                <h3 className="text-lg font-bold text-gray-900 mb-2">{t('contact.info.response.title')}</h3>
                <p className="text-gray-600" dangerouslySetInnerHTML={{ __html: t('contact.info.response.description') }} />
              </div>
            </div>

            {/* Contact Form */}
            <div className="md:col-span-2">
              <div className="bg-white rounded-2xl shadow-lg p-8">
                {isSubmitted ? (
                  <div className="text-center py-12">
                    <div className="bg-green-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                      <Send className="h-8 w-8 text-green-600" />
                    </div>
                    <h3 className="text-2xl font-bold text-gray-900 mb-2">{t('contact.form.success.title')}</h3>
                    <p className="text-gray-600 mb-6">
                      {t('contact.form.success.message')}
                    </p>
                    <button
                      onClick={() => {
                        setIsSubmitted(false)
                        setFormData({ name: '', email: '', subject: '', message: '' })
                      }}
                      className="text-primary-600 hover:text-primary-700 font-medium"
                    >
                      {t('contact.form.success.sendAnother')}
                    </button>
                  </div>
                ) : (
                  <>
                    <h2 className="text-2xl font-bold text-gray-900 mb-6">{t('contact.form.title')}</h2>
                    <form onSubmit={handleSubmit} className="space-y-6">
                      <div className="grid md:grid-cols-2 gap-6">
                        <div>
                          <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-2">
                            {t('contact.form.name')} *
                          </label>
                          <input
                            type="text"
                            id="name"
                            name="name"
                            required
                            value={formData.name}
                            onChange={handleChange}
                            className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-primary-500 focus:border-transparent transition"
                            placeholder={t('contact.form.namePlaceholder')}
                          />
                        </div>
                        <div>
                          <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
                            {t('contact.form.email')} *
                          </label>
                          <input
                            type="email"
                            id="email"
                            name="email"
                            required
                            value={formData.email}
                            onChange={handleChange}
                            className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-primary-500 focus:border-transparent transition"
                            placeholder={t('contact.form.emailPlaceholder')}
                          />
                        </div>
                      </div>

                      <div>
                        <label htmlFor="subject" className="block text-sm font-medium text-gray-700 mb-2">
                          {t('contact.form.subject')} *
                        </label>
                        <select
                          id="subject"
                          name="subject"
                          required
                          value={formData.subject}
                          onChange={handleChange}
                          className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-primary-500 focus:border-transparent transition"
                        >
                          <option value="">{t('contact.form.subjectSelect')}</option>
                          {contact?.form?.subjects?.map((subject: { value: string; label: string }, i: number) => (
                            <option key={i} value={subject.value}>{subject.label}</option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label htmlFor="message" className="block text-sm font-medium text-gray-700 mb-2">
                          {t('contact.form.message')} *
                        </label>
                        <textarea
                          id="message"
                          name="message"
                          required
                          rows={6}
                          value={formData.message}
                          onChange={handleChange}
                          className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-primary-500 focus:border-transparent transition resize-none"
                          placeholder={t('contact.form.messagePlaceholder')}
                        />
                      </div>

                      <button
                        type="submit"
                        disabled={isSubmitting}
                        className="w-full bg-primary-600 text-white py-4 rounded-lg hover:bg-primary-700 transition font-semibold text-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2"
                      >
                        {isSubmitting ? (
                          <>
                            <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                            <span>{t('contact.form.sending')}</span>
                          </>
                        ) : (
                          <>
                            <Send className="h-5 w-5" />
                            <span>{t('contact.form.submit')}</span>
                          </>
                        )}
                      </button>
                    </form>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* FAQ Quick Links */}
      <section className="container mx-auto px-4 py-12">
        <div className="max-w-4xl mx-auto">
          <div className="bg-gradient-to-r from-primary-600 to-purple-600 rounded-2xl p-8 text-white text-center">
            <h2 className="text-2xl font-bold mb-4">{t('contact.faq.title')}</h2>
            <p className="text-primary-50 mb-6">
              {t('contact.faq.description')}
            </p>
            <div className="flex flex-wrap items-center justify-center gap-4">
              <Link
                href="/terms"
                className="bg-white/20 hover:bg-white/30 px-6 py-2 rounded-lg transition font-medium"
              >
                {t('contact.faq.terms')}
              </Link>
              <Link
                href="/privacy"
                className="bg-white/20 hover:bg-white/30 px-6 py-2 rounded-lg transition font-medium"
              >
                {t('contact.faq.privacy')}
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t bg-gray-50 py-8">
        <div className="container mx-auto px-4">
          <div className="text-center text-gray-600">
            <p>{t('contact.footer.copyright')}</p>
            <div className="flex items-center justify-center space-x-6 mt-4">
              <Link href="/about" className="hover:text-gray-900 transition">{t('contact.footer.about')}</Link>
              <Link href="/contact" className="hover:text-gray-900 transition">{t('contact.footer.contact')}</Link>
              <Link href="/privacy" className="hover:text-gray-900 transition">{t('contact.footer.privacy')}</Link>
              <Link href="/terms" className="hover:text-gray-900 transition">{t('contact.footer.terms')}</Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  )
}
