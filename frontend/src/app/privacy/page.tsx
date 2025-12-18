import Link from 'next/link'
import { BookOpen, ArrowLeft, Shield, Eye, Lock, Server, UserCheck, Mail } from 'lucide-react'

export const metadata = {
  title: 'Politique de Confidentialité - Study Master',
  description: 'Découvrez comment Study Master protège vos données personnelles et respecte votre vie privée.',
}

export default function PrivacyPage() {
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
          <div className="flex items-center space-x-3 mb-6">
            <div className="bg-primary-100 p-3 rounded-xl">
              <Shield className="h-8 w-8 text-primary-600" />
            </div>
            <h1 className="text-4xl md:text-5xl font-extrabold text-gray-900">
              Politique de{' '}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary-600 to-purple-600">
                Confidentialité
              </span>
            </h1>
          </div>
          <p className="text-xl text-gray-600">
            Dernière mise à jour : Décembre 2024
          </p>
        </div>
      </section>

      {/* Content */}
      <section className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto space-y-8">
          {/* Introduction */}
          <div className="bg-white rounded-2xl shadow-lg p-8">
            <p className="text-gray-600 leading-relaxed">
              Chez Study Master, nous accordons une importance primordiale à la protection de vos données
              personnelles. Cette politique de confidentialité explique comment nous collectons, utilisons,
              stockons et protégeons vos informations lorsque vous utilisez notre plateforme d'apprentissage.
            </p>
          </div>

          {/* Section 1 */}
          <div className="bg-white rounded-2xl shadow-lg p-8">
            <div className="flex items-center space-x-3 mb-4">
              <div className="bg-blue-100 w-10 h-10 rounded-lg flex items-center justify-center">
                <Eye className="h-5 w-5 text-blue-600" />
              </div>
              <h2 className="text-2xl font-bold text-gray-900">1. Données collectées</h2>
            </div>
            <div className="space-y-4 text-gray-600">
              <p>Nous collectons les types de données suivants :</p>
              <div className="space-y-3">
                <div className="bg-gray-50 p-4 rounded-lg">
                  <h3 className="font-semibold text-gray-900 mb-2">Données d'identification</h3>
                  <ul className="list-disc list-inside space-y-1">
                    <li>Nom et prénom</li>
                    <li>Adresse email</li>
                    <li>Photo de profil (optionnelle)</li>
                    <li>Nom d'utilisateur</li>
                  </ul>
                </div>
                <div className="bg-gray-50 p-4 rounded-lg">
                  <h3 className="font-semibold text-gray-900 mb-2">Données d'apprentissage</h3>
                  <ul className="list-disc list-inside space-y-1">
                    <li>Notes et documents créés</li>
                    <li>Flashcards et quiz</li>
                    <li>Statistiques de révision</li>
                    <li>Progression et scores</li>
                    <li>Temps d'étude</li>
                  </ul>
                </div>
                <div className="bg-gray-50 p-4 rounded-lg">
                  <h3 className="font-semibold text-gray-900 mb-2">Données techniques</h3>
                  <ul className="list-disc list-inside space-y-1">
                    <li>Adresse IP</li>
                    <li>Type de navigateur et appareil</li>
                    <li>Pages visitées et interactions</li>
                    <li>Cookies et identifiants de session</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>

          {/* Section 2 */}
          <div className="bg-white rounded-2xl shadow-lg p-8">
            <div className="flex items-center space-x-3 mb-4">
              <div className="bg-green-100 w-10 h-10 rounded-lg flex items-center justify-center">
                <UserCheck className="h-5 w-5 text-green-600" />
              </div>
              <h2 className="text-2xl font-bold text-gray-900">2. Utilisation des données</h2>
            </div>
            <div className="space-y-4 text-gray-600">
              <p>Vos données sont utilisées pour :</p>
              <ul className="space-y-3">
                <li className="flex items-start space-x-3">
                  <span className="text-primary-600 font-bold mt-1">•</span>
                  <span><strong className="text-gray-900">Fournir nos services</strong> : Créer et gérer votre compte, synchroniser vos données entre appareils, personnaliser votre expérience d'apprentissage</span>
                </li>
                <li className="flex items-start space-x-3">
                  <span className="text-primary-600 font-bold mt-1">•</span>
                  <span><strong className="text-gray-900">Améliorer l'algorithme FSRS</strong> : Optimiser les intervalles de révision basés sur vos performances pour maximiser votre mémorisation</span>
                </li>
                <li className="flex items-start space-x-3">
                  <span className="text-primary-600 font-bold mt-1">•</span>
                  <span><strong className="text-gray-900">Générer du contenu IA</strong> : Créer des flashcards, quiz et résumés personnalisés à partir de vos notes</span>
                </li>
                <li className="flex items-start space-x-3">
                  <span className="text-primary-600 font-bold mt-1">•</span>
                  <span><strong className="text-gray-900">Gamification</strong> : Calculer votre XP, niveaux, succès et classements</span>
                </li>
                <li className="flex items-start space-x-3">
                  <span className="text-primary-600 font-bold mt-1">•</span>
                  <span><strong className="text-gray-900">Communication</strong> : Envoyer des notifications importantes, rappels de révision et mises à jour du service</span>
                </li>
                <li className="flex items-start space-x-3">
                  <span className="text-primary-600 font-bold mt-1">•</span>
                  <span><strong className="text-gray-900">Amélioration continue</strong> : Analyser l'utilisation pour améliorer nos fonctionnalités</span>
                </li>
              </ul>
            </div>
          </div>

          {/* Section 3 */}
          <div className="bg-white rounded-2xl shadow-lg p-8">
            <div className="flex items-center space-x-3 mb-4">
              <div className="bg-purple-100 w-10 h-10 rounded-lg flex items-center justify-center">
                <Lock className="h-5 w-5 text-purple-600" />
              </div>
              <h2 className="text-2xl font-bold text-gray-900">3. Protection des données</h2>
            </div>
            <div className="space-y-4 text-gray-600">
              <p>Nous mettons en œuvre des mesures de sécurité robustes :</p>
              <div className="grid md:grid-cols-2 gap-4">
                <div className="bg-gray-50 p-4 rounded-lg">
                  <h3 className="font-semibold text-gray-900 mb-2">Chiffrement</h3>
                  <p>Toutes les communications sont chiffrées via HTTPS/TLS. Les mots de passe sont hashés avec des algorithmes sécurisés.</p>
                </div>
                <div className="bg-gray-50 p-4 rounded-lg">
                  <h3 className="font-semibold text-gray-900 mb-2">Accès restreint</h3>
                  <p>L'accès aux données est strictement limité au personnel autorisé et nécessaire.</p>
                </div>
                <div className="bg-gray-50 p-4 rounded-lg">
                  <h3 className="font-semibold text-gray-900 mb-2">Sauvegardes</h3>
                  <p>Vos données sont sauvegardées régulièrement pour prévenir toute perte.</p>
                </div>
                <div className="bg-gray-50 p-4 rounded-lg">
                  <h3 className="font-semibold text-gray-900 mb-2">Surveillance</h3>
                  <p>Nos systèmes sont surveillés 24/7 pour détecter toute activité suspecte.</p>
                </div>
              </div>
            </div>
          </div>

          {/* Section 4 */}
          <div className="bg-white rounded-2xl shadow-lg p-8">
            <div className="flex items-center space-x-3 mb-4">
              <div className="bg-red-100 w-10 h-10 rounded-lg flex items-center justify-center">
                <Server className="h-5 w-5 text-red-600" />
              </div>
              <h2 className="text-2xl font-bold text-gray-900">4. Partage des données</h2>
            </div>
            <div className="space-y-4 text-gray-600">
              <p className="font-semibold text-gray-900">
                Nous ne vendons jamais vos données personnelles.
              </p>
              <p>Vos données peuvent être partagées uniquement dans les cas suivants :</p>
              <ul className="space-y-3">
                <li className="flex items-start space-x-3">
                  <span className="text-primary-600 font-bold mt-1">•</span>
                  <span><strong className="text-gray-900">Services tiers essentiels</strong> : Hébergement cloud, services d'authentification, traitement des paiements (pour les fonctionnalités premium)</span>
                </li>
                <li className="flex items-start space-x-3">
                  <span className="text-primary-600 font-bold mt-1">•</span>
                  <span><strong className="text-gray-900">IA Claude (Anthropic)</strong> : Vos notes peuvent être envoyées de manière sécurisée pour générer du contenu IA, sans stockage permanent côté Anthropic</span>
                </li>
                <li className="flex items-start space-x-3">
                  <span className="text-primary-600 font-bold mt-1">•</span>
                  <span><strong className="text-gray-900">Obligations légales</strong> : En cas de demande légale valide des autorités compétentes</span>
                </li>
                <li className="flex items-start space-x-3">
                  <span className="text-primary-600 font-bold mt-1">•</span>
                  <span><strong className="text-gray-900">Avec votre consentement</strong> : Pour les fonctionnalités sociales que vous activez (groupes d'étude, classements publics)</span>
                </li>
              </ul>
            </div>
          </div>

          {/* Section 5 */}
          <div className="bg-white rounded-2xl shadow-lg p-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">5. Vos droits</h2>
            <div className="space-y-4 text-gray-600">
              <p>Conformément au RGPD et aux réglementations applicables, vous disposez des droits suivants :</p>
              <div className="grid md:grid-cols-2 gap-4">
                <div className="border-l-4 border-primary-500 pl-4">
                  <h3 className="font-semibold text-gray-900">Droit d'accès</h3>
                  <p className="text-sm">Obtenir une copie de vos données personnelles</p>
                </div>
                <div className="border-l-4 border-primary-500 pl-4">
                  <h3 className="font-semibold text-gray-900">Droit de rectification</h3>
                  <p className="text-sm">Corriger vos données inexactes ou incomplètes</p>
                </div>
                <div className="border-l-4 border-primary-500 pl-4">
                  <h3 className="font-semibold text-gray-900">Droit à l'effacement</h3>
                  <p className="text-sm">Supprimer votre compte et toutes vos données</p>
                </div>
                <div className="border-l-4 border-primary-500 pl-4">
                  <h3 className="font-semibold text-gray-900">Droit à la portabilité</h3>
                  <p className="text-sm">Exporter vos données dans un format standard</p>
                </div>
                <div className="border-l-4 border-primary-500 pl-4">
                  <h3 className="font-semibold text-gray-900">Droit d'opposition</h3>
                  <p className="text-sm">Vous opposer à certains traitements</p>
                </div>
                <div className="border-l-4 border-primary-500 pl-4">
                  <h3 className="font-semibold text-gray-900">Droit de limitation</h3>
                  <p className="text-sm">Limiter le traitement de vos données</p>
                </div>
              </div>
              <p className="mt-4">
                Pour exercer ces droits, contactez-nous à{' '}
                <a href="mailto:privacy@studymaster.app" className="text-primary-600 hover:text-primary-700 font-medium">
                  privacy@studymaster.app
                </a>
              </p>
            </div>
          </div>

          {/* Section 6 */}
          <div className="bg-white rounded-2xl shadow-lg p-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">6. Cookies</h2>
            <div className="space-y-4 text-gray-600">
              <p>Nous utilisons des cookies pour :</p>
              <ul className="space-y-2">
                <li className="flex items-start space-x-3">
                  <span className="text-primary-600 font-bold mt-1">•</span>
                  <span><strong className="text-gray-900">Cookies essentiels</strong> : Authentification, sécurité, préférences de session</span>
                </li>
                <li className="flex items-start space-x-3">
                  <span className="text-primary-600 font-bold mt-1">•</span>
                  <span><strong className="text-gray-900">Cookies de performance</strong> : Analyser l'utilisation pour améliorer le service</span>
                </li>
                <li className="flex items-start space-x-3">
                  <span className="text-primary-600 font-bold mt-1">•</span>
                  <span><strong className="text-gray-900">Cookies de préférences</strong> : Mémoriser vos choix (langue, thème, etc.)</span>
                </li>
              </ul>
              <p>
                Vous pouvez gérer vos préférences de cookies dans les paramètres de votre navigateur.
              </p>
            </div>
          </div>

          {/* Section 7 */}
          <div className="bg-white rounded-2xl shadow-lg p-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">7. Conservation des données</h2>
            <div className="space-y-4 text-gray-600">
              <p>Vos données sont conservées :</p>
              <ul className="space-y-2">
                <li className="flex items-start space-x-3">
                  <span className="text-primary-600 font-bold mt-1">•</span>
                  <span><strong className="text-gray-900">Compte actif</strong> : Tant que votre compte existe</span>
                </li>
                <li className="flex items-start space-x-3">
                  <span className="text-primary-600 font-bold mt-1">•</span>
                  <span><strong className="text-gray-900">Après suppression</strong> : 30 jours pour permettre la récupération, puis suppression définitive</span>
                </li>
                <li className="flex items-start space-x-3">
                  <span className="text-primary-600 font-bold mt-1">•</span>
                  <span><strong className="text-gray-900">Données de facturation</strong> : Conservées selon les obligations légales (généralement 10 ans)</span>
                </li>
              </ul>
            </div>
          </div>

          {/* Section 8 */}
          <div className="bg-white rounded-2xl shadow-lg p-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">8. Mineurs</h2>
            <div className="space-y-4 text-gray-600">
              <p>
                Study Master est destiné aux étudiants de tous âges. Pour les utilisateurs de moins de 16 ans
                (ou l'âge de consentement numérique applicable dans votre pays), le consentement d'un parent
                ou tuteur légal est requis.
              </p>
            </div>
          </div>

          {/* Section 9 */}
          <div className="bg-white rounded-2xl shadow-lg p-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">9. Modifications</h2>
            <div className="space-y-4 text-gray-600">
              <p>
                Cette politique peut être mise à jour occasionnellement. En cas de modification significative,
                nous vous en informerons par email ou via une notification dans l'application. Nous vous
                encourageons à consulter régulièrement cette page.
              </p>
            </div>
          </div>

          {/* Contact */}
          <div className="bg-gradient-to-r from-primary-600 to-purple-600 rounded-2xl p-8 text-white">
            <div className="flex items-center space-x-3 mb-4">
              <Mail className="h-6 w-6" />
              <h2 className="text-2xl font-bold">Questions ?</h2>
            </div>
            <p className="text-primary-50 mb-4">
              Pour toute question concernant cette politique de confidentialité ou vos données personnelles,
              n'hésitez pas à nous contacter.
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
                Formulaire de contact
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t bg-gray-50 py-8 mt-12">
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
