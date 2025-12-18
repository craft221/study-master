import Link from 'next/link'
import { BookOpen, ArrowLeft, FileText, AlertTriangle, CheckCircle, XCircle, Scale, CreditCard } from 'lucide-react'

export const metadata = {
  title: 'Conditions Générales d\'Utilisation - Study Master',
  description: 'Consultez les conditions générales d\'utilisation de Study Master, la plateforme d\'apprentissage intelligente.',
}

export default function TermsPage() {
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
              <FileText className="h-8 w-8 text-primary-600" />
            </div>
            <h1 className="text-4xl md:text-5xl font-extrabold text-gray-900">
              Conditions Générales{' '}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary-600 to-purple-600">
                d'Utilisation
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
              Bienvenue sur Study Master ! Ces Conditions Générales d'Utilisation (« CGU ») régissent
              votre accès et utilisation de la plateforme Study Master, incluant le site web,
              l'application mobile et tous les services associés. En utilisant Study Master,
              vous acceptez ces conditions dans leur intégralité.
            </p>
          </div>

          {/* Article 1 */}
          <div className="bg-white rounded-2xl shadow-lg p-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">Article 1 - Définitions</h2>
            <div className="space-y-3 text-gray-600">
              <p><strong className="text-gray-900">« Plateforme »</strong> : désigne le site web studymaster.app, l'application mobile Study Master et tous les services associés.</p>
              <p><strong className="text-gray-900">« Utilisateur »</strong> : désigne toute personne qui accède à la Plateforme et/ou crée un compte.</p>
              <p><strong className="text-gray-900">« Contenu »</strong> : désigne toutes les données, textes, notes, flashcards, quiz et autres éléments créés ou importés par l'Utilisateur.</p>
              <p><strong className="text-gray-900">« Services »</strong> : désigne l'ensemble des fonctionnalités offertes par la Plateforme.</p>
              <p><strong className="text-gray-900">« Compte Premium »</strong> : désigne l'abonnement payant donnant accès à des fonctionnalités avancées.</p>
            </div>
          </div>

          {/* Article 2 */}
          <div className="bg-white rounded-2xl shadow-lg p-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">Article 2 - Acceptation des conditions</h2>
            <div className="space-y-4 text-gray-600">
              <p>
                En créant un compte ou en utilisant la Plateforme, vous déclarez :
              </p>
              <ul className="space-y-2">
                <li className="flex items-start space-x-3">
                  <CheckCircle className="h-5 w-5 text-green-500 mt-0.5 flex-shrink-0" />
                  <span>Avoir lu et accepté les présentes CGU</span>
                </li>
                <li className="flex items-start space-x-3">
                  <CheckCircle className="h-5 w-5 text-green-500 mt-0.5 flex-shrink-0" />
                  <span>Avoir la capacité juridique de conclure un contrat (ou avoir l'autorisation d'un parent/tuteur si mineur)</span>
                </li>
                <li className="flex items-start space-x-3">
                  <CheckCircle className="h-5 w-5 text-green-500 mt-0.5 flex-shrink-0" />
                  <span>Fournir des informations exactes lors de l'inscription</span>
                </li>
                <li className="flex items-start space-x-3">
                  <CheckCircle className="h-5 w-5 text-green-500 mt-0.5 flex-shrink-0" />
                  <span>Respecter les lois applicables dans votre pays de résidence</span>
                </li>
              </ul>
            </div>
          </div>

          {/* Article 3 */}
          <div className="bg-white rounded-2xl shadow-lg p-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">Article 3 - Description des services</h2>
            <div className="space-y-4 text-gray-600">
              <p>Study Master offre une plateforme d'apprentissage incluant :</p>
              <div className="grid md:grid-cols-2 gap-4">
                <div className="bg-gray-50 p-4 rounded-lg">
                  <h3 className="font-semibold text-gray-900 mb-2">Fonctionnalités gratuites</h3>
                  <ul className="space-y-1 text-sm">
                    <li>• Création de notes et documents</li>
                    <li>• Flashcards avec répétition espacée (FSRS)</li>
                    <li>• Quiz et exercices</li>
                    <li>• Système de gamification (XP, niveaux)</li>
                    <li>• Timer Pomodoro</li>
                    <li>• Statistiques de base</li>
                  </ul>
                </div>
                <div className="bg-gradient-to-br from-primary-50 to-purple-50 p-4 rounded-lg border border-primary-200">
                  <h3 className="font-semibold text-gray-900 mb-2">Fonctionnalités Premium</h3>
                  <ul className="space-y-1 text-sm">
                    <li>• Génération IA illimitée (Claude AI)</li>
                    <li>• Focus Rooms (salles d'étude)</li>
                    <li>• Statistiques avancées</li>
                    <li>• Synchronisation multi-appareils</li>
                    <li>• Support prioritaire</li>
                    <li>• Fonctionnalités à venir en avant-première</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>

          {/* Article 4 */}
          <div className="bg-white rounded-2xl shadow-lg p-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">Article 4 - Création de compte</h2>
            <div className="space-y-4 text-gray-600">
              <p>Pour utiliser les Services, vous devez créer un compte en fournissant :</p>
              <ul className="space-y-2">
                <li>• Une adresse email valide</li>
                <li>• Un mot de passe sécurisé</li>
                <li>• Un nom d'utilisateur unique</li>
              </ul>
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mt-4">
                <div className="flex items-start space-x-3">
                  <AlertTriangle className="h-5 w-5 text-yellow-600 mt-0.5 flex-shrink-0" />
                  <div>
                    <h4 className="font-semibold text-yellow-800">Important</h4>
                    <p className="text-yellow-700 text-sm">
                      Vous êtes responsable de la confidentialité de vos identifiants de connexion.
                      Toute activité effectuée depuis votre compte est présumée être de votre fait.
                      En cas d'utilisation non autorisée, contactez-nous immédiatement.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Article 5 */}
          <div className="bg-white rounded-2xl shadow-lg p-8">
            <div className="flex items-center space-x-3 mb-4">
              <div className="bg-red-100 w-10 h-10 rounded-lg flex items-center justify-center">
                <XCircle className="h-5 w-5 text-red-600" />
              </div>
              <h2 className="text-2xl font-bold text-gray-900">Article 5 - Utilisations interdites</h2>
            </div>
            <div className="space-y-4 text-gray-600">
              <p>Il est strictement interdit de :</p>
              <ul className="space-y-2">
                <li className="flex items-start space-x-3">
                  <XCircle className="h-5 w-5 text-red-500 mt-0.5 flex-shrink-0" />
                  <span>Utiliser la Plateforme à des fins illégales ou frauduleuses</span>
                </li>
                <li className="flex items-start space-x-3">
                  <XCircle className="h-5 w-5 text-red-500 mt-0.5 flex-shrink-0" />
                  <span>Publier du contenu illicite, diffamatoire, haineux ou portant atteinte aux droits d'autrui</span>
                </li>
                <li className="flex items-start space-x-3">
                  <XCircle className="h-5 w-5 text-red-500 mt-0.5 flex-shrink-0" />
                  <span>Tenter de contourner les mesures de sécurité ou d'accéder aux données d'autres utilisateurs</span>
                </li>
                <li className="flex items-start space-x-3">
                  <XCircle className="h-5 w-5 text-red-500 mt-0.5 flex-shrink-0" />
                  <span>Utiliser des robots, scrapers ou outils automatisés pour extraire des données</span>
                </li>
                <li className="flex items-start space-x-3">
                  <XCircle className="h-5 w-5 text-red-500 mt-0.5 flex-shrink-0" />
                  <span>Revendre ou redistribuer les Services sans autorisation</span>
                </li>
                <li className="flex items-start space-x-3">
                  <XCircle className="h-5 w-5 text-red-500 mt-0.5 flex-shrink-0" />
                  <span>Créer plusieurs comptes pour contourner les limitations</span>
                </li>
                <li className="flex items-start space-x-3">
                  <XCircle className="h-5 w-5 text-red-500 mt-0.5 flex-shrink-0" />
                  <span>Perturber le fonctionnement de la Plateforme ou surcharger nos serveurs</span>
                </li>
              </ul>
              <p className="text-sm mt-4 bg-red-50 p-3 rounded-lg text-red-700">
                Tout manquement à ces règles peut entraîner la suspension ou la suppression définitive de votre compte,
                sans préavis ni remboursement.
              </p>
            </div>
          </div>

          {/* Article 6 */}
          <div className="bg-white rounded-2xl shadow-lg p-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">Article 6 - Propriété intellectuelle</h2>
            <div className="space-y-4 text-gray-600">
              <div className="bg-gray-50 p-4 rounded-lg">
                <h3 className="font-semibold text-gray-900 mb-2">Votre contenu</h3>
                <p>
                  Vous conservez tous les droits sur le Contenu que vous créez sur la Plateforme
                  (notes, flashcards, etc.). En utilisant les Services, vous nous accordez une licence
                  limitée pour stocker, afficher et traiter ce contenu uniquement dans le but de fournir les Services.
                </p>
              </div>
              <div className="bg-gray-50 p-4 rounded-lg">
                <h3 className="font-semibold text-gray-900 mb-2">Notre contenu</h3>
                <p>
                  Study Master, son logo, son interface, son code source, ses algorithmes (notamment FSRS)
                  et tout autre élément de la Plateforme sont protégés par le droit d'auteur et restent
                  la propriété exclusive de Study Master. Toute reproduction non autorisée est interdite.
                </p>
              </div>
            </div>
          </div>

          {/* Article 7 */}
          <div className="bg-white rounded-2xl shadow-lg p-8">
            <div className="flex items-center space-x-3 mb-4">
              <div className="bg-green-100 w-10 h-10 rounded-lg flex items-center justify-center">
                <CreditCard className="h-5 w-5 text-green-600" />
              </div>
              <h2 className="text-2xl font-bold text-gray-900">Article 7 - Abonnement Premium</h2>
            </div>
            <div className="space-y-4 text-gray-600">
              <h3 className="font-semibold text-gray-900">7.1 Tarification</h3>
              <p>
                Les tarifs des abonnements Premium sont affichés sur la Plateforme et peuvent être modifiés.
                Tout changement de prix sera communiqué à l'avance et n'affectera pas les abonnements en cours
                jusqu'à leur renouvellement.
              </p>

              <h3 className="font-semibold text-gray-900 mt-4">7.2 Paiement</h3>
              <p>
                Les paiements sont traités de manière sécurisée par nos partenaires (Stripe, PayPal, Mobile Money).
                Nous ne stockons pas vos informations bancaires complètes.
              </p>

              <h3 className="font-semibold text-gray-900 mt-4">7.3 Renouvellement</h3>
              <p>
                Les abonnements sont renouvelés automatiquement à la fin de chaque période de facturation,
                sauf annulation de votre part avant la date de renouvellement.
              </p>

              <h3 className="font-semibold text-gray-900 mt-4">7.4 Remboursement</h3>
              <p>
                Conformément au droit de rétractation applicable, vous disposez de 14 jours après votre
                premier achat pour demander un remboursement complet, sans avoir à justifier de motifs.
                Au-delà de ce délai, les abonnements ne sont pas remboursables sauf en cas de défaut avéré du service.
              </p>
            </div>
          </div>

          {/* Article 8 */}
          <div className="bg-white rounded-2xl shadow-lg p-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">Article 8 - Disponibilité du service</h2>
            <div className="space-y-4 text-gray-600">
              <p>
                Nous nous efforçons d'assurer une disponibilité maximale de la Plateforme. Cependant,
                nous ne garantissons pas un fonctionnement ininterrompu et nous nous réservons le droit de :
              </p>
              <ul className="space-y-2">
                <li>• Effectuer des maintenances programmées (avec notification préalable si possible)</li>
                <li>• Interrompre temporairement le service en cas d'urgence technique</li>
                <li>• Modifier ou arrêter certaines fonctionnalités</li>
              </ul>
              <p className="text-sm bg-blue-50 p-3 rounded-lg text-blue-700 mt-4">
                En cas d'interruption prolongée, les utilisateurs Premium pourront bénéficier d'une
                compensation proportionnelle.
              </p>
            </div>
          </div>

          {/* Article 9 */}
          <div className="bg-white rounded-2xl shadow-lg p-8">
            <div className="flex items-center space-x-3 mb-4">
              <div className="bg-purple-100 w-10 h-10 rounded-lg flex items-center justify-center">
                <Scale className="h-5 w-5 text-purple-600" />
              </div>
              <h2 className="text-2xl font-bold text-gray-900">Article 9 - Limitation de responsabilité</h2>
            </div>
            <div className="space-y-4 text-gray-600">
              <p>
                Study Master est fourni « en l'état ». Dans les limites autorisées par la loi :
              </p>
              <ul className="space-y-2">
                <li>• Nous ne garantissons pas que les Services répondront à tous vos besoins spécifiques</li>
                <li>• Nous ne sommes pas responsables des résultats académiques obtenus par les Utilisateurs</li>
                <li>• Nous ne sommes pas responsables des contenus créés ou partagés par les Utilisateurs</li>
                <li>• Notre responsabilité totale est limitée au montant payé au cours des 12 derniers mois</li>
              </ul>
              <p className="mt-4">
                Cette limitation ne s'applique pas en cas de faute intentionnelle ou de négligence grave de notre part,
                ni dans les cas où la loi interdit une telle limitation.
              </p>
            </div>
          </div>

          {/* Article 10 */}
          <div className="bg-white rounded-2xl shadow-lg p-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">Article 10 - Résiliation</h2>
            <div className="space-y-4 text-gray-600">
              <div className="bg-gray-50 p-4 rounded-lg">
                <h3 className="font-semibold text-gray-900 mb-2">Par l'Utilisateur</h3>
                <p>
                  Vous pouvez supprimer votre compte à tout moment depuis les paramètres de votre profil.
                  Vos données seront définitivement supprimées après un délai de 30 jours.
                </p>
              </div>
              <div className="bg-gray-50 p-4 rounded-lg">
                <h3 className="font-semibold text-gray-900 mb-2">Par Study Master</h3>
                <p>
                  Nous pouvons suspendre ou supprimer un compte en cas de violation des présentes CGU,
                  d'activité frauduleuse, ou sur demande d'une autorité compétente.
                </p>
              </div>
            </div>
          </div>

          {/* Article 11 */}
          <div className="bg-white rounded-2xl shadow-lg p-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">Article 11 - Modifications des CGU</h2>
            <div className="space-y-4 text-gray-600">
              <p>
                Nous pouvons modifier ces CGU à tout moment. Les modifications significatives seront
                communiquées par email et/ou notification dans l'application au moins 30 jours avant
                leur entrée en vigueur.
              </p>
              <p>
                Votre utilisation continue de la Plateforme après l'entrée en vigueur des modifications
                vaut acceptation des nouvelles CGU.
              </p>
            </div>
          </div>

          {/* Article 12 */}
          <div className="bg-white rounded-2xl shadow-lg p-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">Article 12 - Droit applicable et litiges</h2>
            <div className="space-y-4 text-gray-600">
              <p>
                Les présentes CGU sont régies par le droit applicable dans votre pays de résidence,
                sous réserve des dispositions impératives du droit international.
              </p>
              <p>
                En cas de litige, nous privilégions une résolution amiable. Vous pouvez nous contacter
                à <a href="mailto:legal@studymaster.app" className="text-primary-600 hover:text-primary-700 font-medium">legal@studymaster.app</a>.
                Si aucun accord n'est trouvé, les tribunaux compétents seront saisis conformément aux règles de procédure applicables.
              </p>
            </div>
          </div>

          {/* Article 13 */}
          <div className="bg-white rounded-2xl shadow-lg p-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">Article 13 - Divers</h2>
            <div className="space-y-4 text-gray-600">
              <p>
                <strong className="text-gray-900">Intégralité :</strong> Ces CGU constituent l'accord complet entre vous et Study Master.
              </p>
              <p>
                <strong className="text-gray-900">Nullité partielle :</strong> Si une clause est jugée invalide, les autres restent en vigueur.
              </p>
              <p>
                <strong className="text-gray-900">Non-renonciation :</strong> Le fait de ne pas exercer un droit ne constitue pas une renonciation à ce droit.
              </p>
              <p>
                <strong className="text-gray-900">Cession :</strong> Vous ne pouvez pas céder vos droits sans notre accord écrit. Nous pouvons céder nos obligations en cas de fusion ou acquisition.
              </p>
            </div>
          </div>

          {/* Contact */}
          <div className="bg-gradient-to-r from-primary-600 to-purple-600 rounded-2xl p-8 text-white">
            <h2 className="text-2xl font-bold mb-4">Questions sur ces conditions ?</h2>
            <p className="text-primary-50 mb-4">
              Si vous avez des questions concernant ces Conditions Générales d'Utilisation,
              n'hésitez pas à nous contacter.
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
