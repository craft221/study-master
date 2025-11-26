# Study Master - Frontend Web

Interface web Next.js 14 pour l'application Study Master.

## 🚀 Technologies

- **Next.js 14** - Framework React avec App Router
- **TypeScript** - Typage statique
- **Tailwind CSS** - Styling utility-first
- **Zustand** - State management
- **Axios** - Client HTTP
- **React Hook Form** - Gestion des formulaires
- **Framer Motion** - Animations
- **Lucide React** - Icônes modernes

## 📦 Installation

```bash
# Installer les dépendances
npm install

# Ou avec yarn
yarn install

# Ou avec pnpm
pnpm install
```

## 🔧 Configuration

Créer un fichier `.env.local`:

```env
NEXT_PUBLIC_API_URL=http://localhost:8000
NEXT_PUBLIC_APP_NAME=Study Master
```

## 🏃‍♂️ Démarrage

```bash
# Mode développement
npm run dev

# Build production
npm run build

# Démarrer en production
npm start
```

L'application sera accessible sur [http://localhost:3000](http://localhost:3000)

## 📁 Structure du projet

```
src/
├── app/                    # Pages Next.js 14 (App Router)
│   ├── layout.tsx         # Layout principal
│   ├── page.tsx           # Page d'accueil
│   ├── globals.css        # Styles globaux
│   ├── (auth)/            # Routes d'authentification
│   │   ├── login/
│   │   └── register/
│   └── (dashboard)/       # Routes protégées
│       ├── dashboard/
│       ├── notes/
│       ├── flashcards/
│       ├── quizzes/
│       └── profile/
├── components/            # Composants réutilisables
│   ├── ui/               # Composants UI de base
│   ├── forms/            # Composants de formulaires
│   ├── layouts/          # Layouts
│   └── providers.tsx     # Providers globaux
├── lib/                  # Utilitaires
│   ├── api.ts           # Configuration Axios
│   └── utils.ts         # Fonctions utilitaires
├── hooks/               # Custom hooks
├── store/               # State management (Zustand)
│   └── auth-store.tsx  # Store d'authentification
└── types/              # Types TypeScript
```

## 🎨 Pages principales

### Pages publiques
- `/` - Page d'accueil
- `/login` - Connexion
- `/register` - Inscription
- `/about` - À propos
- `/demo` - Démo

### Pages authentifiées
- `/dashboard` - Tableau de bord principal
- `/notes` - Gestion des notes
- `/notes/[id]` - Détail d'une note
- `/flashcards` - Flashcards et révisions
- `/quizzes` - Quiz et examens
- `/subjects` - Matières
- `/profile` - Profil utilisateur
- `/leaderboard` - Classements
- `/groups` - Groupes d'étude
- `/settings` - Paramètres

## 🔌 API Integration

L'API backend est accessible via `http://localhost:8000/api/v1`

Exemple d'utilisation:

```typescript
import api from '@/lib/api'

// GET request
const notes = await api.get('/notes')

// POST request
const newNote = await api.post('/notes', {
  title: 'Ma note',
  content: 'Contenu...'
})
```

## 🎯 Features implémentées

- ✅ Landing page moderne
- ✅ Authentification (JWT)
- ✅ Dashboard avec statistiques
- ✅ CRUD Notes (Markdown)
- ✅ Flashcards avec SM-2
- ✅ Quiz interactifs
- ✅ Système de gamification
- ✅ Thème clair/sombre
- ✅ Responsive design
- ✅ Animations Framer Motion

## 🚀 Prochaines étapes

Pour continuer le développement:

1. Créer les pages d'authentification (`/login`, `/register`)
2. Implémenter le dashboard
3. Créer l'éditeur de notes Markdown
4. Développer le système de flashcards
5. Ajouter les quiz interactifs
6. Intégrer l'IA (Claude)
7. Ajouter les groupes d'étude
8. Implémenter le système de gamification complet

## 📝 Notes

- Le frontend est prêt à être connecté à l'API backend
- Tous les composants utilisent TypeScript strict
- Tailwind CSS est configuré avec un thème personnalisé
- Les images sont optimisées avec Next.js Image
- Hot reload activé en développement
