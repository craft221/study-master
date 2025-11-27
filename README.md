# 📚 Study Master

**L'application ultime d'apprentissage avec Intelligence Artificielle**

Une plateforme complète d'étude collaborative avec gamification, génération de contenu par IA, gestion de notes, flashcards, quiz, et bien plus.

![Version](https://img.shields.io/badge/version-1.0.0-blue)
![License](https://img.shields.io/badge/license-MIT-green)
![Python](https://img.shields.io/badge/python-3.11-blue)
![Next.js](https://img.shields.io/badge/next.js-14-black)

---

## ✨ Fonctionnalités Principales

### 📝 Gestion de Notes
- **Création et organisation** de notes avec support Markdown
- **Hiérarchie de notes** (notes parents/enfants)
- **Tags et favoris** pour une organisation optimale
- **Recherche avancée** dans le contenu
- **Épinglage** et archivage de notes

### 🎴 Flashcards (Répétition Espacée)
- **Création de decks** personnalisés
- **Système de révision** basé sur l'algorithme de répétition espacée
- **Indices et explications** pour chaque carte
- **Statistiques de progression** par deck
- **Génération automatique** par IA depuis vos notes

### 🧠 Quiz Interactifs
- **Trois types de questions**: QCM, Vrai/Faux, Réponse courte
- **Mode chronométré** avec limite de temps configurable
- **Correction instantanée** avec explications
- **Historique des tentatives** et progression
- **Génération automatique** par IA depuis vos notes

### ✨ Hub IA (Intelligence Artificielle)
Propulsé par **Google Gemini Pro**:
- 🎴 **Génération de flashcards** intelligentes (1-20 cartes)
- 🧠 **Génération de quiz** complets (5-20 questions)
- 📄 **Résumé automatique** de notes (50-1000 mots)
- 🔑 **Extraction de mots-clés** pertinents (3-20)
- 💡 **Explication de concepts** pédagogiques
- 📊 **Quota quotidien** selon l'abonnement (10-1000 requêtes/jour)

### 👥 Groupes d'Étude Collaboratifs
- **Création de groupes** publics ou privés
- **Chat en temps réel** avec réactions emoji
- **Mentions** (@utilisateur) et réponses aux messages
- **Partage de ressources**: notes, flashcards, quiz, sessions
- **Onglets organisés**: Messages, Notes, Flashcards, Sessions, Quiz, Activité

### ⏱️ Sessions Pomodoro
- **Timer Pomodoro** configurable (25/5 min par défaut)
- **Suivi automatique** du temps d'étude
- **Pause automatique** entre sessions
- **Statistiques** d'étude détaillées

### 🏆 Gamification
- **Système XP et Niveaux** (100 XP par niveau)
- **Séries quotidiennes** (streaks)
- **Succès et badges** à débloquer
- **Classements** globaux et par matière
- **Duels** entre étudiants

### 👤 Profil Utilisateur
- **Informations personnelles** éditables
- **Statistiques détaillées**: XP, niveau, streak, temps d'étude
- **Activité hebdomadaire**: notes, flashcards, quiz
- **Paramètres de notifications**
- **Changement de mot de passe**

### 📸 OCR (Reconnaissance de Texte)
- **Upload d'images** de documents
- **Extraction automatique** du texte
- **Conversion en notes** enrichies
- Support de multiples formats d'image

### 📅 Emploi du Temps
- **Gestion de l'emploi du temps** hebdomadaire
- **Création d'événements** et rappels
- **Synchronisation** avec les matières

---

## 🏗️ Architecture Technique

### Stack Technologique

#### Frontend
- **Framework**: Next.js 14 (App Router)
- **Langage**: TypeScript
- **UI**: Tailwind CSS + shadcn/ui
- **Animations**: Framer Motion
- **État**: React Hooks (useState, useEffect)
- **HTTP**: Axios
- **Icônes**: Lucide React

#### Backend
- **Framework**: FastAPI (Python 3.11)
- **Base de données**: PostgreSQL 15
- **ORM**: SQLAlchemy (async)
- **Cache**: Redis 7
- **Tasks async**: Celery + Flower
- **IA**: Google Gemini Pro API
- **Auth**: JWT (JSON Web Tokens)

#### DevOps
- **Containerisation**: Docker + Docker Compose
- **Proxy inversé**: Nginx (optionnel)
- **Monitoring**: Flower (Celery)

---

## 🚀 Installation et Démarrage

### Prérequis
- Docker Desktop
- Docker Compose
- Git

### Installation Rapide

1. **Cloner le repository**
```bash
git clone <repository-url>
cd study-master
```

2. **Configuration de l'environnement**

Créer un fichier `.env` dans `backend/`:
```env
# Database
DATABASE_URL=postgresql+asyncpg://studymaster:studymaster123@postgres:5432/studymaster_db

# Security
SECRET_KEY=your-super-secret-key-change-this-in-production
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=10080

# Google Gemini API (pour fonctionnalités IA)
GOOGLE_API_KEY=your-google-gemini-api-key

# Redis
REDIS_URL=redis://redis:6379/0

# Celery
CELERY_BROKER_URL=redis://redis:6379/1
CELERY_RESULT_BACKEND=redis://redis:6379/2
```

3. **Démarrer l'application**
```bash
docker-compose up -d
```

4. **Accéder à l'application**
- **Frontend**: http://localhost:3000
- **Backend API**: http://localhost:8000
- **Documentation API**: http://localhost:8000/docs
- **Flower (monitoring)**: http://localhost:5555

### Identifiants de Test
**Email**: `demo@example.com`
**Mot de passe**: `Demo123!`

---

## 📁 Structure du Projet

```
study-master/
├── frontend/                    # Application Next.js
│   ├── src/
│   │   ├── app/
│   │   │   ├── (auth)/         # Pages authentification
│   │   │   │   ├── login/
│   │   │   │   └── register/
│   │   │   ├── (dashboard)/    # Pages dashboard
│   │   │   │   ├── dashboard/  # Page d'accueil
│   │   │   │   ├── notes/      # Gestion des notes
│   │   │   │   ├── flashcards/ # Flashcards
│   │   │   │   ├── quizzes/    # Quiz
│   │   │   │   ├── ai/         # Hub IA
│   │   │   │   ├── profile/    # Profil utilisateur
│   │   │   │   ├── groups/     # Groupes d'étude
│   │   │   │   ├── sessions/   # Sessions Pomodoro
│   │   │   │   ├── subjects/   # Matières
│   │   │   │   ├── leaderboard/# Classements
│   │   │   │   ├── schedule/   # Emploi du temps
│   │   │   │   └── ocr/        # OCR
│   │   │   └── layout.tsx      # Layout avec navigation
│   │   ├── components/         # Composants React
│   │   │   ├── ui/             # Composants UI (shadcn)
│   │   │   └── groups/         # Composants groupes
│   │   ├── lib/                # Utilitaires
│   │   │   └── api.ts          # Client API Axios
│   │   └── hooks/              # Custom hooks
│   ├── public/                 # Assets statiques
│   └── package.json
│
├── backend/                     # API FastAPI
│   ├── app/
│   │   ├── api/
│   │   │   └── v1/             # Endpoints API v1
│   │   │       ├── auth.py     # Authentification
│   │   │       ├── users.py    # Utilisateurs
│   │   │       ├── subjects.py # Matières
│   │   │       ├── notes.py    # Notes
│   │   │       ├── flashcards.py # Flashcards
│   │   │       ├── quizzes.py  # Quiz
│   │   │       ├── ai.py       # IA (Gemini)
│   │   │       ├── study_groups.py # Groupes
│   │   │       ├── group_messages.py # Messages
│   │   │       ├── study_sessions.py # Sessions
│   │   │       ├── schedules.py # Emploi du temps
│   │   │       ├── leaderboards.py # Classements
│   │   │       ├── achievements.py # Succès
│   │   │       ├── duels.py    # Duels
│   │   │       ├── ocr.py      # OCR
│   │   │       └── export.py   # Export PDF
│   │   ├── models/             # Modèles SQLAlchemy
│   │   ├── schemas/            # Schémas Pydantic
│   │   ├── core/               # Configuration
│   │   │   ├── config.py       # Settings
│   │   │   ├── database.py     # DB connection
│   │   │   └── security.py     # JWT auth
│   │   ├── services/           # Services métier
│   │   │   └── ai_service.py   # Service IA
│   │   └── main.py             # Point d'entrée
│   └── requirements.txt
│
├── docker-compose.yml           # Configuration Docker
└── README.md                    # Ce fichier
```

---

## 🔌 API Endpoints Principaux

### Authentification
- `POST /api/v1/auth/register` - Inscription
- `POST /api/v1/auth/login` - Connexion
- `POST /api/v1/auth/refresh` - Refresh token

### Notes
- `GET /api/v1/notes/` - Liste des notes
- `POST /api/v1/notes/` - Créer une note
- `GET /api/v1/notes/{id}` - Détails d'une note
- `PUT /api/v1/notes/{id}` - Modifier une note
- `DELETE /api/v1/notes/{id}` - Supprimer une note

### Flashcards
- `GET /api/v1/flashcards/` - Liste des flashcards
- `POST /api/v1/flashcards/` - Créer une flashcard
- `POST /api/v1/flashcards/{id}/review` - Réviser une carte

### Quiz
- `GET /api/v1/quizzes/` - Liste des quiz
- `POST /api/v1/quizzes/` - Créer un quiz
- `POST /api/v1/quizzes/{id}/submit` - Soumettre les réponses

### Intelligence Artificielle
- `GET /api/v1/ai/quota` - Quota IA disponible
- `POST /api/v1/ai/generate-flashcards` - Générer flashcards
- `POST /api/v1/ai/generate-quiz` - Générer quiz
- `POST /api/v1/ai/summarize-note` - Résumer note
- `POST /api/v1/ai/extract-keywords` - Extraire mots-clés
- `POST /api/v1/ai/explain-concept` - Expliquer concept

### Groupes d'Étude
- `GET /api/v1/study-groups/` - Liste des groupes
- `POST /api/v1/study-groups/` - Créer un groupe
- `POST /api/v1/study-groups/{id}/join` - Rejoindre
- `GET /api/v1/study-groups/{id}/messages` - Messages du groupe
- `POST /api/v1/study-groups/{id}/messages` - Envoyer message
- `POST /api/v1/study-groups/{id}/messages/{msg_id}/reactions` - Ajouter réaction

### Utilisateur
- `GET /api/v1/users/me` - Profil actuel
- `PUT /api/v1/users/me` - Modifier profil
- `POST /api/v1/users/me/password` - Changer mot de passe
- `GET /api/v1/users/me/stats` - Statistiques utilisateur

Documentation complète: http://localhost:8000/docs

---

## 🎮 Système de Gamification

### XP et Niveaux
- **+10 XP** : Créer une note
- **+5 XP** : Créer une flashcard
- **+2 XP** : Envoyer un message
- **+1 XP** : Réagir à un message
- **+15 XP** : Générer un quiz IA
- **+10 XP** : Générer des flashcards IA
- **+50 XP** : Compléter un quiz avec 100%

**Niveau** = XP Total ÷ 100

### Streaks (Séries)
- Connexion quotidienne pour maintenir le streak
- Bonus XP pour les longues séries
- Affichage du streak actuel et record

### Succès (En développement)
- Badges à débloquer
- Objectifs variés (XP, notes, quiz, etc.)

---

## 🔒 Sécurité

- **JWT Authentication** avec refresh tokens
- **Hashing bcrypt** pour les mots de passe
- **CORS configuré** pour localhost
- **Rate limiting** sur les endpoints sensibles
- **Validation Pydantic** sur toutes les entrées
- **SQL injection protection** via SQLAlchemy ORM

---

## 📊 Quotas IA par Abonnement

| Abonnement | Requêtes/Jour | Prix |
|------------|---------------|------|
| FREE | 10 | Gratuit |
| PREMIUM | 200 | - |
| PREMIUM_PLUS | 500 | - |
| INSTITUTIONAL | 1000 | - |

---

## 🛠️ Commandes Utiles

### Docker
```bash
# Démarrer tous les services
docker-compose up -d

# Arrêter tous les services
docker-compose down

# Voir les logs
docker-compose logs -f backend
docker-compose logs -f frontend

# Rebuild après changement de code
docker-compose up -d --build

# Accéder au shell backend
docker-compose exec backend bash

# Exécuter les migrations
docker-compose exec backend alembic upgrade head
```

### Backend (dans le conteneur)
```bash
# Shell interactif Python
docker-compose exec backend python

# Créer une migration
docker-compose exec backend alembic revision --autogenerate -m "description"

# Tests
docker-compose exec backend pytest
```

---

## 🎯 Fonctionnalités Futures

- [ ] Mode hors ligne (PWA)
- [ ] Export PDF avancé avec templates
- [ ] Import depuis Notion, OneNote
- [ ] Synchronisation calendrier (Google Calendar, Outlook)
- [ ] Application mobile (React Native)
- [ ] Intégration avec GPT-4 en plus de Gemini
- [ ] Générateur de plans d'étude personnalisés
- [ ] Système de récompenses et challenges
- [ ] Marketplace de contenus éducatifs
- [ ] Analytics avancés avec graphiques

---

## 📝 Changelog

### Version 1.0.0 (2025-11-27)
#### ✨ Nouvelles fonctionnalités
- Création des pages manquantes: `/flashcards/new`, `/quizzes/new`, `/profile`
- Hub IA complet avec génération de contenu
- Composant Switch pour les toggles
- Quick Actions sur le dashboard
- Navigation mise à jour avec Hub IA et Profil

#### 🐛 Corrections
- Fix erreur Tabs `onValueChange is not a function`
- Fix AttributeError `author_id` → `user_id` dans l'API notes
- Amélioration du chaînage optionnel dans les composants

#### 📚 Documentation
- README complet créé
- Identifiants de test ajoutés
- Documentation API enrichie

---

## 🤝 Contribution

Les contributions sont les bienvenues!

1. Fork le projet
2. Créer une branche (`git checkout -b feature/AmazingFeature`)
3. Commit vos changements (`git commit -m 'feat: Add AmazingFeature'`)
4. Push vers la branche (`git push origin feature/AmazingFeature`)
5. Ouvrir une Pull Request

---

## 📄 License

Distribué sous licence MIT. Voir `LICENSE` pour plus d'informations.

---

## 👨‍💻 Auteurs

**Study Master Team**

Développé avec l'aide de Claude Code (Anthropic)

---

## 🙏 Remerciements

- [FastAPI](https://fastapi.tiangolo.com/) - Framework backend
- [Next.js](https://nextjs.org/) - Framework React
- [shadcn/ui](https://ui.shadcn.com/) - Composants UI
- [Tailwind CSS](https://tailwindcss.com/) - Framework CSS
- [Google Gemini](https://deepmind.google/technologies/gemini/) - IA générative
- [Lucide](https://lucide.dev/) - Icônes

---

## 📞 Support

Pour toute question ou problème:
- 📧 Email: support@studymaster.com
- 💬 Discord: [Rejoindre](https://discord.gg/studymaster)
- 🐛 Issues: [GitHub Issues](https://github.com/studymaster/issues)

---

<p align="center">
  Fait avec ❤️ par l'équipe Study Master
</p>

<p align="center">
  🤖 Generated with <a href="https://claude.com/claude-code">Claude Code</a>
</p>
