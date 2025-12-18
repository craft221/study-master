import Link from 'next/link'
import { BookOpen, ArrowLeft, Target, Heart, Lightbulb, Globe, Users, Sparkles } from 'lucide-react'

export const metadata = {
  title: 'À propos - Study Master',
  description: 'Découvrez Study Master, la plateforme d\'apprentissage intelligente qui révolutionne la façon d\'étudier grâce à l\'IA et la gamification.',
}

export default function AboutPage() {
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
              <span>Retour</span>
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="container mx-auto px-4 py-16">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-4xl md:text-5xl font-extrabold text-gray-900 mb-6">
            À propos de{' '}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary-600 to-purple-600">
              Study Master
            </span>
          </h1>
          <p className="text-xl text-gray-600 mb-8">
            Une plateforme née de la passion pour l'éducation et la technologie,
            conçue pour aider les étudiants du monde entier à atteindre leur plein potentiel.
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
              <h2 className="text-2xl font-bold text-gray-900">Notre Histoire</h2>
            </div>
            <div className="prose prose-lg text-gray-600 space-y-4">
              <p>
                Study Master est né d'un constat simple : les méthodes d'apprentissage traditionnelles
                ne sont plus adaptées aux besoins des étudiants d'aujourd'hui. Face à la quantité
                croissante d'informations à assimiler et aux distractions numériques, nous avions
                besoin d'une nouvelle approche.
              </p>
              <p>
                En combinant les dernières avancées en intelligence artificielle, les techniques
                de mémorisation scientifiquement prouvées comme la répétition espacée (algorithme FSRS),
                et les mécanismes de gamification qui ont fait le succès d'applications comme Duolingo,
                nous avons créé une plateforme qui rend l'apprentissage efficace ET motivant.
              </p>
              <p>
                Développé par un étudiant pour les étudiants, Study Master comprend vos défis
                quotidiens et vous accompagne vers la réussite académique.
              </p>
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
              <h2 className="text-2xl font-bold">Notre Mission</h2>
            </div>
            <p className="text-xl text-primary-50">
              Démocratiser l'accès à des outils d'apprentissage de qualité et permettre à chaque
              étudiant, où qu'il soit dans le monde, d'atteindre ses objectifs académiques grâce
              à la technologie.
            </p>
          </div>
        </div>
      </section>

      {/* Nos Valeurs */}
      <section className="container mx-auto px-4 py-12">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-2xl font-bold text-gray-900 mb-8 text-center">Nos Valeurs</h2>
          <div className="grid md:grid-cols-2 gap-6">
            <div className="bg-white rounded-xl shadow-lg p-6">
              <div className="bg-blue-100 w-12 h-12 rounded-xl flex items-center justify-center mb-4">
                <Sparkles className="h-6 w-6 text-blue-600" />
              </div>
              <h3 className="text-lg font-bold text-gray-900 mb-2">Innovation</h3>
              <p className="text-gray-600">
                Nous utilisons les technologies les plus avancées, notamment l'IA Claude,
                pour offrir une expérience d'apprentissage unique et personnalisée.
              </p>
            </div>

            <div className="bg-white rounded-xl shadow-lg p-6">
              <div className="bg-green-100 w-12 h-12 rounded-xl flex items-center justify-center mb-4">
                <Globe className="h-6 w-6 text-green-600" />
              </div>
              <h3 className="text-lg font-bold text-gray-900 mb-2">Accessibilité</h3>
              <p className="text-gray-600">
                Nous croyons que l'éducation de qualité doit être accessible à tous,
                c'est pourquoi nous proposons une version gratuite complète.
              </p>
            </div>

            <div className="bg-white rounded-xl shadow-lg p-6">
              <div className="bg-purple-100 w-12 h-12 rounded-xl flex items-center justify-center mb-4">
                <Users className="h-6 w-6 text-purple-600" />
              </div>
              <h3 className="text-lg font-bold text-gray-900 mb-2">Communauté</h3>
              <p className="text-gray-600">
                L'apprentissage est plus efficace ensemble. Nos fonctionnalités sociales
                encouragent l'entraide et la collaboration entre étudiants.
              </p>
            </div>

            <div className="bg-white rounded-xl shadow-lg p-6">
              <div className="bg-red-100 w-12 h-12 rounded-xl flex items-center justify-center mb-4">
                <Heart className="h-6 w-6 text-red-600" />
              </div>
              <h3 className="text-lg font-bold text-gray-900 mb-2">Passion</h3>
              <p className="text-gray-600">
                Chaque fonctionnalité est conçue avec soin pour vous aider à réussir.
                Votre succès est notre plus grande motivation.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Fonctionnalités Clés */}
      <section className="container mx-auto px-4 py-12">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-2xl font-bold text-gray-900 mb-8 text-center">Ce qui nous rend uniques</h2>
          <div className="bg-white rounded-2xl shadow-lg p-8">
            <ul className="space-y-4">
              <li className="flex items-start space-x-3">
                <span className="text-primary-600 font-bold">✓</span>
                <span className="text-gray-600">
                  <strong className="text-gray-900">IA Claude intégrée</strong> - Génération automatique de flashcards, quiz et résumés à partir de vos notes
                </span>
              </li>
              <li className="flex items-start space-x-3">
                <span className="text-primary-600 font-bold">✓</span>
                <span className="text-gray-600">
                  <strong className="text-gray-900">Algorithme FSRS</strong> - Répétition espacée scientifiquement optimisée, 30% plus efficace que les méthodes traditionnelles
                </span>
              </li>
              <li className="flex items-start space-x-3">
                <span className="text-primary-600 font-bold">✓</span>
                <span className="text-gray-600">
                  <strong className="text-gray-900">Gamification complète</strong> - XP, niveaux, succès, classements et défis pour rester motivé
                </span>
              </li>
              <li className="flex items-start space-x-3">
                <span className="text-primary-600 font-bold">✓</span>
                <span className="text-gray-600">
                  <strong className="text-gray-900">Focus Rooms</strong> - Salles d'étude virtuelles pour étudier ensemble en temps réel
                </span>
              </li>
              <li className="flex items-start space-x-3">
                <span className="text-primary-600 font-bold">✓</span>
                <span className="text-gray-600">
                  <strong className="text-gray-900">Spark</strong> - Votre mascotte IA personnelle qui vous accompagne et vous encourage
                </span>
              </li>
              <li className="flex items-start space-x-3">
                <span className="text-primary-600 font-bold">✓</span>
                <span className="text-gray-600">
                  <strong className="text-gray-900">Multi-plateforme</strong> - Disponible sur web et mobile, avec synchronisation en temps réel
                </span>
              </li>
            </ul>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="container mx-auto px-4 py-12">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">
            Prêt à transformer votre façon d'apprendre ?
          </h2>
          <p className="text-gray-600 mb-8">
            Rejoignez la communauté Study Master et commencez votre parcours vers la réussite.
          </p>
          <Link
            href="/register"
            className="bg-primary-600 text-white px-8 py-4 rounded-lg hover:bg-primary-700 transition font-semibold text-lg inline-block shadow-lg"
          >
            Commencer gratuitement
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t bg-gray-50 py-8">
        <div className="container mx-auto px-4">
          <div className="text-center text-gray-600">
            <p>© 2025 Study Master. Tous droits réservés.</p>
            <div className="flex items-center justify-center space-x-6 mt-4">
              <Link href="/about" className="hover:text-gray-900 transition">À propos</Link>
              <Link href="/contact" className="hover:text-gray-900 transition">Contact</Link>
              <Link href="/privacy" className="hover:text-gray-900 transition">Confidentialité</Link>
              <Link href="/terms" className="hover:text-gray-900 transition">CGU</Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  )
}
