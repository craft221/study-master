# Study Master Mobile 📱

Application mobile React Native pour Study Master - Votre compagnon d'étude intelligent.

## 🚀 Technologies

- **React Native** avec Expo SDK 51
- **Expo Router** - Navigation file-based
- **TypeScript** - Typage strict
- **Zustand** - State management
- **React Query** - Data fetching & caching
- **Reanimated 3** - Animations fluides
- **Expo Notifications** - Push notifications

## 📁 Structure du projet

```
frontend-mobile/
├── app/                    # Routes (Expo Router)
│   ├── (auth)/            # Écrans d'authentification
│   │   ├── login.tsx
│   │   └── register.tsx
│   ├── (tabs)/            # Navigation par onglets
│   │   ├── index.tsx      # Dashboard
│   │   ├── flashcards.tsx
│   │   ├── study.tsx      # Session Pomodoro
│   │   ├── quizzes.tsx
│   │   └── profile.tsx
│   ├── _layout.tsx        # Layout racine
│   └── index.tsx          # Point d'entrée
├── src/
│   ├── components/        # Composants réutilisables
│   │   ├── ui/           # Composants UI de base
│   │   │   ├── Button.tsx
│   │   │   ├── Card.tsx
│   │   │   └── Input.tsx
│   │   └── mascot/       # Spark le mascot
│   │       └── Spark.tsx
│   ├── constants/         # Configuration
│   │   ├── config.ts     # API URLs, limites
│   │   └── theme.ts      # Design system complet
│   ├── hooks/             # Hooks personnalisés
│   │   └── useTheme.ts
│   ├── services/          # Services API
│   │   └── api.ts        # Client Axios avec auth
│   ├── stores/            # State management
│   │   └── authStore.ts
│   └── types/             # Types TypeScript
│       └── index.ts
└── assets/                # Images, fonts, sons
```

## 🎨 Design System

Le design est cohérent avec l'application web :

- **Couleurs primaires** : Sky Blue (#0ea5e9)
- **Couleurs accent** : Orange (Spark), Purple (AI), Green (succès)
- **Typographie** : Police système native
- **Animations** : Springs Reanimated pour des transitions fluides

## ⚡ Fonctionnalités

### Implémentées ✅
- [x] Authentification (login/register)
- [x] Dashboard avec statistiques
- [x] Liste des flashcards par deck
- [x] Sessions d'étude Pomodoro
- [x] Liste des quiz
- [x] Profil utilisateur
- [x] Thème clair/sombre automatique
- [x] Mascotte Spark animée

### Implémentées ✅
- [x] Révision de flashcards (spaced repetition avec swipe)
- [x] Jouer un quiz (avec feedback animé)
- [x] Génération IA de flashcards/quiz
- [x] Duels en temps réel
- [x] Focus Rooms (salles d'étude collaboratives)
- [x] Notifications push
- [x] Mode hors ligne avec sync
- [x] Leaderboard
- [x] Achievements

### À venir 🚧
- [ ] Calendrier d'événements
- [ ] Scan de documents IA
- [ ] Partage de notes entre utilisateurs

## 🛠️ Installation

### Prérequis
- Node.js 18+
- npm ou yarn
- Expo CLI (`npm install -g expo-cli`)
- Expo Go app sur votre téléphone

### Étapes

```bash
# Aller dans le dossier
cd frontend-mobile

# Installer les dépendances
npm install

# Démarrer en développement
npm start
```

### Configuration API

Modifier `src/constants/config.ts` pour pointer vers votre backend :

```typescript
const DEV_API_URL = 'http://VOTRE_IP:8000/api/v1';
```

Pour trouver votre IP :
- Windows : `ipconfig`
- Mac/Linux : `ifconfig` ou `ip addr`

## 📱 Lancer sur appareil

1. Installer **Expo Go** depuis l'App Store / Play Store
2. Scanner le QR code affiché dans le terminal
3. L'app se charge automatiquement

## 🏗️ Build pour production

```bash
# Configuration EAS
npm install -g eas-cli
eas login
eas build:configure

# Build Android
eas build --platform android

# Build iOS
eas build --platform ios
```

## 🐿️ Spark - La Mascotte

Spark est un écureuil interactif qui accompagne l'utilisateur :

- **Humeurs** : happy, excited, sad, thinking, encouraging, sleeping
- **Niveaux** : Baby → Junior → Expert → Sage → Legendary
- **Accessoires** : Lunettes, chapeau diplômé, couronne, cape éclair
- **Animations** : Float, wave, celebration, sleep

## 🔐 Sécurité

- Tokens JWT stockés avec `expo-secure-store`
- Refresh token automatique
- Authentification biométrique (Face ID / Touch ID)

## 📄 Licence

Projet privé - Study Master © 2024
