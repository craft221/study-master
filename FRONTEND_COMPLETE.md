# Frontend Study Master - Documentation Technique Complete v3.0

## Vue d'Ensemble

Le frontend Study Master est une application **Next.js 14** avec **TypeScript** et **Tailwind CSS**, offrant une experience utilisateur moderne et reactive.

---

## Architecture Technique

```
frontend/
├── src/
│   ├── app/                      # App Router Next.js 14
│   │   ├── (auth)/               # Routes authentification
│   │   │   ├── login/
│   │   │   └── register/
│   │   ├── (dashboard)/          # Routes protegees
│   │   │   ├── dashboard/        # Tableau de bord
│   │   │   ├── subjects/         # Matieres
│   │   │   ├── notes/            # Notes
│   │   │   ├── flashcards/       # Flashcards FSRS
│   │   │   ├── quizzes/          # Quiz
│   │   │   ├── ai-hub/           # Hub IA
│   │   │   ├── spark/            # Spark Intelligence
│   │   │   ├── focus-rooms/      # Focus Rooms
│   │   │   ├── groups/           # Groupes d'etude
│   │   │   ├── duels/            # Defis PvP
│   │   │   ├── achievements/     # Succes/Badges
│   │   │   ├── leaderboard/      # Classements
│   │   │   ├── profile/          # Profil utilisateur
│   │   │   ├── settings/         # Parametres
│   │   │   └── pricing/          # Plans & Tarifs
│   │   ├── layout.tsx            # Layout principal
│   │   └── page.tsx              # Landing page
│   ├── components/               # Composants reutilisables
│   │   ├── ui/                   # Composants UI de base
│   │   ├── dashboard/            # Composants dashboard
│   │   ├── notes/                # Composants notes
│   │   ├── flashcards/           # Composants flashcards
│   │   ├── focus-rooms/          # Composants Focus Rooms
│   │   └── ...
│   ├── hooks/                    # Hooks React personnalises
│   ├── services/                 # Services API
│   ├── stores/                   # Zustand stores
│   ├── types/                    # Types TypeScript
│   └── utils/                    # Utilitaires
├── public/                       # Assets statiques
└── tailwind.config.js            # Configuration Tailwind
```

---

## Pages & Fonctionnalites

### Landing Page (`/`)
- Hero section animee
- Presentation des fonctionnalites
- Temoignages utilisateurs
- Call-to-action vers inscription
- Mode sombre/clair

### Dashboard (`/dashboard`)
- **Vue d'ensemble**
  - Statistiques quotidiennes
  - XP et niveau actuels
  - Streak actuel
  - Graphiques de progression
- **Actions rapides**
  - Cartes a reviser aujourd'hui
  - Quiz recommandes
  - Sessions Pomodoro
- **Activite recente**
  - Notes modifiees
  - Flashcards revisees
  - Quiz completes

### Notes (`/notes`)
- **Liste des notes**
  - Recherche full-text
  - Filtres par matiere, tags, date
  - Vue grille/liste
  - Tri multiple
- **Editeur de notes**
  - Markdown enrichi
  - Coloration syntaxique code
  - Support LaTeX
  - Images et medias
  - Sauvegarde automatique
- **Organisation**
  - Structure hierarchique (notes imbriquees)
  - Tags et categories
  - Favoris et epingles
  - Archive

### Flashcards FSRS (`/flashcards`)
- **Session de revision**
  - Interface "swipe" fluide
  - 4 niveaux de reponse (Again, Hard, Good, Easy)
  - Statistiques en temps reel
  - Animation de progression
- **Gestion des cartes**
  - Creation manuelle
  - Generation IA depuis notes
  - Import/Export Anki
  - Tags et categories
- **Statistiques FSRS**
  - Taux de retention
  - Cartes apprises vs en apprentissage
  - Prediction prochaines revisions
  - Heatmap d'activite

### Quizzes (`/quizzes`)
- **Types de questions**
  - QCM (choix unique/multiple)
  - Vrai/Faux
  - Reponse courte
  - Association
- **Mode examen**
  - Timer configurable
  - Melange des questions
  - Correction immediate ou differee
- **Resultats**
  - Score detaille
  - Corrections avec explications
  - Points faibles identifies
  - Recommandations IA

### AI Hub (`/ai-hub`)
- **Generation de contenu**
  - Flashcards depuis notes
  - Quiz depuis notes
  - Resumes automatiques
- **Assistance**
  - Explication de concepts
  - Amelioration de notes
  - Extraction mots-cles
- **Quota**
  - Affichage temps reel
  - Historique d'utilisation
  - Modal upgrade si epuise

### Spark Intelligence (`/spark`)
- **Interface conversationnelle**
  - Chat en temps reel
  - Historique des conversations
  - Contexte personnalise
- **Fonctionnalites**
  - Memoire long-terme
  - Briefing quotidien
  - Insights proactifs
  - Analyse de progression

### Focus Rooms (`/focus-rooms`)
- **Lobby**
  - Salles publiques disponibles
  - Filtres par type (Pomodoro, libre, silence)
  - Creation de salle privee
- **Salle de focus**
  - Participants en temps reel
  - Timer partage
  - Objectifs individuels
  - Reactions emoji
  - Chat minimal
- **Statistiques**
  - Temps total de focus
  - Sessions completees
  - Streaks de groupe

### Groups (`/groups`)
- **Decouverte**
  - Recherche de groupes
  - Filtres (universite, matiere, etc.)
  - Suggestions personnalisees
- **Gestion**
  - Creation de groupe
  - Invitations
  - Roles (Admin, Moderateur, Membre)
  - Parametres de confidentialite
- **Collaboration**
  - Partage de notes
  - Quiz de groupe
  - Discussion

### Duels (`/duels`)
- **Creation de defi**
  - Selection d'adversaire
  - Choix du quiz/matiere
  - Mise en XP
  - Duree limite
- **Interface de duel**
  - Questions simultanees
  - Timer partage
  - Score en direct
- **Resultats**
  - Vainqueur declare
  - XP gagne/perdu
  - Statistiques comparatives

### Achievements (`/achievements`)
- **Galerie des badges**
  - Categories (Etude, Social, Streaks, etc.)
  - Raretes (Common, Rare, Epic, Legendary)
  - Progression vers deblocage
- **Mes achievements**
  - Badges debloques
  - Date d'obtention
  - Partage sur profil

### Leaderboard (`/leaderboard`)
- **Classements**
  - Global
  - Par universite
  - Par promotion
  - Hebdomadaire/Mensuel/All-time
- **Metriques**
  - XP total
  - Streak actuel
  - Temps d'etude
  - Quiz completes

### Pricing (`/pricing`)
- **Comparatif des plans**
  - FREE, PREMIUM, PREMIUM+, INSTITUTIONAL
  - Fonctionnalites par plan
  - Quotas IA
- **Paiement**
  - Integration Stripe
  - PayPal
  - Mobile Money (Afrique)
- **Gestion abonnement**
  - Historique factures
  - Annulation
  - Changement de plan

### Profile (`/profile`)
- **Informations**
  - Avatar personnalise
  - Bio et liens
  - Universite/Promotion
- **Statistiques**
  - XP total et niveau
  - Streak record
  - Temps d'etude cumule
  - Badges obtenus
- **Activite**
  - Timeline des actions
  - Graphiques de progression

### Settings (`/settings`)
- **Compte**
  - Email et mot de passe
  - Suppression de compte
- **Preferences**
  - Theme (clair/sombre/systeme)
  - Langue
  - Notifications
- **Confidentialite**
  - Profil public/prive
  - Visibilite dans classements

---

## Composants Cles

### UpgradeModal
Modal affiche quand le quota IA est depasse.
```typescript
interface QuotaExceededError {
  message: string
  code: string
  subscription_type: string
  max_requests: number
  used_requests: number
  remaining: number
  reset_time: string
  upgrade_available: boolean
  next_plan: string | null
  upgrade_benefits: Record<string, UpgradeBenefit>
}
```

### FlashcardReview
Interface de revision avec algorithme FSRS.
```typescript
// Boutons de reponse
enum Rating {
  AGAIN = 1,  // Oublie completement
  HARD = 2,   // Difficile
  GOOD = 3,   // Correct
  EASY = 4    // Facile
}
```

### FocusRoomLive
Composant WebSocket pour les Focus Rooms.
```typescript
// Evenements temps reel
type FocusEvent =
  | { type: 'user_joined'; user: User }
  | { type: 'user_left'; userId: number }
  | { type: 'session_started'; session: FocusSession }
  | { type: 'reaction'; emoji: string; fromUser: number }
```

### NoteEditor
Editeur Markdown avance.
- Toolbar formatting
- Preview en temps reel
- Upload d'images
- Raccourcis clavier
- Sauvegarde automatique

---

## Services API

### authService
```typescript
export const authService = {
  login: (email: string, password: string) => api.post('/auth/login'),
  register: (data: RegisterData) => api.post('/auth/register'),
  refreshToken: () => api.post('/auth/refresh'),
  logout: () => api.post('/auth/logout'),
}
```

### aiService
```typescript
export const aiService = {
  generateFlashcards: (noteId: number) => api.post('/ai/generate-flashcards'),
  generateQuiz: (noteId: number, options: QuizOptions) => api.post('/ai/generate-quiz'),
  summarize: (noteId: number) => api.post('/ai/summarize'),
  explainConcept: (concept: string) => api.post('/ai/explain-concept'),
  getQuota: () => api.get('/ai/quota'),
}
```

### paymentService
```typescript
export const paymentService = {
  getPlans: () => api.get('/payments/plans'),
  createCheckout: (planId: number, currency: string) => api.post('/payments/create-checkout'),
  getSubscription: () => api.get('/payments/subscription'),
  cancelSubscription: () => api.post('/payments/cancel'),
  getInvoices: () => api.get('/payments/invoices'),
}
```

### focusRoomService
```typescript
export const focusRoomService = {
  getRooms: () => api.get('/focus-rooms'),
  createRoom: (data: CreateRoomData) => api.post('/focus-rooms'),
  joinRoom: (roomId: number) => api.post(`/focus-rooms/${roomId}/join`),
  leaveRoom: (roomId: number) => api.post(`/focus-rooms/${roomId}/leave`),
  startSession: (roomId: number) => api.post(`/focus-rooms/${roomId}/start-session`),
}
```

---

## State Management (Zustand)

### authStore
```typescript
interface AuthState {
  user: User | null
  isAuthenticated: boolean
  login: (credentials: Credentials) => Promise<void>
  logout: () => void
  refreshUser: () => Promise<void>
}
```

### notesStore
```typescript
interface NotesState {
  notes: Note[]
  currentNote: Note | null
  isLoading: boolean
  fetchNotes: (filters?: NoteFilters) => Promise<void>
  createNote: (data: CreateNoteData) => Promise<Note>
  updateNote: (id: number, data: UpdateNoteData) => Promise<void>
  deleteNote: (id: number) => Promise<void>
}
```

### flashcardsStore
```typescript
interface FlashcardsState {
  cards: Flashcard[]
  dueCards: Flashcard[]
  currentCard: Flashcard | null
  stats: ReviewStats
  fetchDueCards: () => Promise<void>
  reviewCard: (cardId: number, rating: Rating) => Promise<void>
}
```

---

## Hooks Personnalises

### useQuotaExceededHandler
Gestion automatique des depassements de quota.
```typescript
const { showModal, quotaError, handleError, UpgradeModalComponent } = useQuotaExceededHandler()

// Utilisation dans les appels API
try {
  await aiService.generateFlashcards(noteId)
} catch (error) {
  if (!handleError(error)) {
    // Autre erreur
  }
}
```

### useFocusRoom
WebSocket pour les Focus Rooms.
```typescript
const {
  participants,
  currentSession,
  sendReaction,
  startSession,
  endSession
} = useFocusRoom(roomId)
```

### useAuth
Authentification et gestion du token.
```typescript
const { user, isAuthenticated, login, logout, isLoading } = useAuth()
```

### useDarkMode
Theme clair/sombre.
```typescript
const { isDark, toggle, setTheme } = useDarkMode()
```

---

## Types TypeScript

### User
```typescript
interface User {
  id: number
  email: string
  first_name: string
  last_name: string
  avatar_url?: string
  total_xp: number
  level: number
  streak_count: number
  subscription_type: SubscriptionType
  created_at: string
}
```

### Note
```typescript
interface Note {
  id: number
  title: string
  content: string
  subject_id: number
  parent_id?: number
  tags: string[]
  is_favorite: boolean
  is_pinned: boolean
  is_archived: boolean
  created_at: string
  updated_at: string
}
```

### Flashcard (FSRS)
```typescript
interface Flashcard {
  id: number
  front: string
  back: string
  subject_id: number
  // Parametres FSRS
  stability: number
  difficulty: number
  elapsed_days: number
  scheduled_days: number
  reps: number
  lapses: number
  state: CardState
  due: string
  last_review?: string
}

enum CardState {
  NEW = 0,
  LEARNING = 1,
  REVIEW = 2,
  RELEARNING = 3
}
```

### FocusRoom
```typescript
interface FocusRoom {
  id: number
  name: string
  description?: string
  room_type: 'pomodoro' | 'free' | 'silent'
  max_participants: number
  is_private: boolean
  current_participants: number
  owner_id: number
  created_at: string
}

interface FocusSession {
  id: number
  user_id: number
  room_id: number
  start_time: string
  end_time?: string
  duration_minutes: number
  status: 'active' | 'paused' | 'completed'
}
```

### SubscriptionPlan
```typescript
interface SubscriptionPlan {
  id: number
  name: string
  display_name: string
  description: string
  prices: {
    EUR: number
    USD: number
    XOF: number
    // ... autres devises
  }
  features: string[]
  ai_requests_per_day: number
  storage_limit_mb: number
  is_popular: boolean
}
```

---

## Styles & UI

### Tailwind CSS
Configuration personnalisee avec:
- Couleurs primaires (orange/amber)
- Mode sombre natif
- Animations fluides
- Composants responsifs

### Composants UI
- Boutons (primary, secondary, ghost, danger)
- Inputs (text, select, checkbox, radio)
- Cards (elevation, hover effects)
- Modals (animated, backdrop blur)
- Toasts (success, error, warning, info)
- Skeletons (loading states)

### Icons
Lucide React pour les icones:
```typescript
import {
  Crown, Star, Zap, Clock, Sparkles,
  BookOpen, Brain, Target, Trophy, Users
} from 'lucide-react'
```

---

## Performance

### Optimisations Next.js
- **Server Components** par defaut
- **Client Components** uniquement si necessaire
- **Image Optimization** automatique
- **Code Splitting** par route

### Strategies de cache
- **SWR** pour les donnees frequentes
- **Optimistic Updates** pour UX fluide
- **Prefetching** des routes probables

### Bundle Size
- Tree shaking automatique
- Import dynamique des composants lourds
- Lazy loading des images

---

## Tests

### Structure
```
__tests__/
├── components/
│   ├── FlashcardReview.test.tsx
│   ├── NoteEditor.test.tsx
│   └── UpgradeModal.test.tsx
├── hooks/
│   └── useAuth.test.ts
└── services/
    └── aiService.test.ts
```

### Outils
- **Jest** - Framework de test
- **React Testing Library** - Tests composants
- **MSW** - Mock des API

---

## Deploiement

### Vercel (recommande)
```bash
# Deploiement automatique depuis GitHub
vercel --prod
```

### Variables d'environnement
```env
NEXT_PUBLIC_API_URL=https://api.studymaster.com
NEXT_PUBLIC_WS_URL=wss://api.studymaster.com
NEXT_PUBLIC_STRIPE_PUBLIC_KEY=pk_live_...
```

### Docker
```dockerfile
FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build
EXPOSE 3000
CMD ["npm", "start"]
```

---

## Resume

### Stats Frontend
- **30+ pages** avec App Router
- **50+ composants** reutilisables
- **10+ hooks** personnalises
- **TypeScript** strict
- **Responsive** mobile-first
- **Dark mode** natif

### Technologies
- Next.js 14 (App Router)
- TypeScript 5
- Tailwind CSS 3
- Zustand (state)
- SWR (data fetching)
- Lucide (icons)

Le frontend offre une **experience utilisateur moderne** et **performante** pour toutes les fonctionnalites de Study Master.
