# Study Master

**Plateforme d'apprentissage collaborative avec Intelligence Artificielle**

Une application complete d'etude avec gamification, generation de contenu par IA (Claude Sonnet 4.5), gestion de notes, flashcards FSRS, quiz, assistant pedagogique Spark, duels entre etudiants, Focus Rooms (body doubling virtuel), groupes d'etude, paiements multi-providers, et bien plus.

![Version](https://img.shields.io/badge/version-3.0.0-blue)
![License](https://img.shields.io/badge/license-MIT-green)
![Python](https://img.shields.io/badge/python-3.11-blue)
![Next.js](https://img.shields.io/badge/next.js-14-black)
![Claude](https://img.shields.io/badge/AI-Claude%20Sonnet%204.5-purple)

---

## Table des Matieres

- [Fonctionnalites Principales](#fonctionnalites-principales)
- [Nouveautes v3.0](#nouveautes-v30)
- [Architecture Technique](#architecture-technique)
- [Installation](#installation-et-demarrage)
- [Plans et Tarification](#plans-et-tarification)
- [API Endpoints](#api-endpoints)
- [Changelog](#changelog)

---

## Fonctionnalites Principales

### Gestion de Notes
- **Markdown complet** avec support LaTeX (`$...$` et `$$...$$`)
- **Hierarchie** de notes (parent/enfants jusqu'a 5 niveaux)
- **Tags, favoris, epinglage, archivage**
- **Recherche avancee** (titre, contenu, tags)
- **Galerie d'images** integree
- **Compteur de mots** et temps de lecture

### Flashcards avec FSRS (Free Spaced Repetition Scheduler)
**Algorithme moderne ~30% plus efficace que SM-2**

- **4 ratings**: Again (0), Hard (1), Good (2), Easy (3)
- **Etats**: NEW, LEARNING, REVIEW, RELEARNING
- **Stabilite** et **difficulte** calculees dynamiquement
- **Statistiques detaillees**: maitrise %, temps de reponse moyen
- **Decks** par matiere avec stats agregees
- **Generation IA** depuis vos notes
- **Suspension** et **favoris** de cartes

### Quiz Interactifs
- **3 types de questions**: QCM, Vrai/Faux, Reponse courte
- **Difficulte**: Facile, Moyen, Difficile
- **Mode chronometre** configurable
- **Feedback IA** apres chaque tentative (forces, faiblesses, recommandations)
- **Partage viral** avec codes uniques
- **Quiz publics** sans compte (conversion invites)
- **Leaderboard** par quiz
- **Generation IA** avec taxonomie de Bloom

### Hub IA (Claude Sonnet 4.5)
Propulse par **Claude Sonnet 4.5** avec prompts optimises:

| Fonctionnalite | Version | Details |
|----------------|---------|---------|
| Generation Flashcards | v2.1 | 40% definitions, 30% applications, 20% comparaisons, 10% analyse |
| Generation Quiz | v2.0 | Taxonomie Bloom, distracteurs plausibles |
| Resume Automatique | v2.0 | Markdown structure, preservation LaTeX |
| Extraction Mots-cles | v1.0 | 3-20 mots-cles |
| Explication Concepts | v1.0 | 3 niveaux: debutant/intermediaire/avance |

**Quotas IA par abonnement** (avec cache 70% hit rate):
| Plan | Requetes/jour | Prix |
|------|---------------|------|
| FREE | 5 | $0 |
| PREMIUM | 30 | $5.99/mois |
| PREMIUM+ | 60 | $11.99/mois |
| INSTITUTIONAL | 200 | $39.99/mois |

### Focus Rooms (Body Doubling Virtuel)
**Salles d'etude virtuelles pour etudier ensemble en temps reel**

- **Types**: Public, Sujet, Universite, Prive, Evenement
- **Categories**: Sciences, Humanites, Langues, Business, Tech, Medecine, Droit
- **Statuts participants**: FOCUSING, DEEP_WORK, BREAK, IDLE, AWAY
- **Milestones automatiques**: 30min, 1h, 2h, 3h (+XP bonus)
- **Deep Work Mode**: Sessions 90min sans distractions
- **XP Bonus Room**: +20% sur tout l'XP gagne
- **Feed d'activites** en temps reel (WebSocket)
- **Pokes** entre participants
- **Invitations** avec codes uniques
- **Leaderboard** temps de focus
- **Stats personnelles**: total minutes, sessions, streak focus

### Assistant Spark (Mascotte IA)
Spark est un ecureuil intelligent qui accompagne l'apprentissage:

- **5 Niveaux**: Baby (0-100 XP), Junior (100-500), Expert (500-1000), Sage (1000-5000), Legendary (5000+)
- **Humeurs dynamiques**: Happy, Excited, Sad, Thinking, Encouraging, Helpful
- **20+ Animations**: idle, wave, celebration, jump, sleep, explain
- **Accessoires deblocables**: chapeaux, lunettes, capes, glands dores
- **Conversations persistantes** avec memoire long-terme
- **Daily Briefing** personnalise chaque matin
- **Mode Tuteur** socratique
- **Insights proactifs** sur vos patterns d'etude
- **Notifications personnalisees**

### Groupes d'Etude Collaboratifs
- **Creation** de groupes publics/prives
- **Roles**: Owner, Admin, Member
- **Partage**: Notes, Flashcards, Quiz, Sessions
- **Messagerie temps reel** (WebSocket)
- **Reactions emoji** et **mentions** (@user)
- **Feed d'activite** du groupe

### Gamification Complete

#### XP et Niveaux
**Formule**: `Niveau = sqrt(XP_total / 100)`

| Action | XP |
|--------|-----|
| Creation note | +10 |
| Creation flashcard | +5 |
| Revision (Good/Easy) | +5 |
| Revision (Again/Hard) | +2 |
| Quiz complete | +20 base |
| Quiz reussi (>70%) | +10 bonus |
| Quiz parfait (>90%) | +20 bonus |
| Focus Room session | +XP selon duree + 20% bonus |
| Victoire duel | +mise XP |
| Defaite duel | -50% mise |

#### Streaks
- **Streak actuel**: jours consecutifs d'activite
- **Record de streak**: plus longue serie
- **Reset automatique** si inactivite 24h

#### Achievements
- **5 Categories**: Learning, Streak, Mastery, Social, Special
- **4 Raretes**: Common, Rare, Epic, Legendary
- **Deblocage automatique** + recompenses XP

### Duels PvP
- **Defier** n'importe quel utilisateur
- **Mise XP**: 10-500 XP
- **Quiz selectionne** par le challenger
- **Liens d'invitation** (expiration 24h)
- **Statistiques**: taux victoire, XP gagne/perdu
- **Adversaires recommandes** par niveau

### Classements
- **6 Types**: XP, Streak, Notes, Flashcards, Quiz, Focus Time
- **4 Periodes**: Daily, Weekly, Monthly, All-time
- **3 Portees**: Global, Universite, Promotion
- **Mise a jour temps reel** (WebSocket)

### Paiements Multi-Providers
**Support international complet**

#### Providers
| Provider | Methodes | Regions |
|----------|----------|---------|
| **Stripe** | Visa, Mastercard, Amex | International |
| **PayPal** | PayPal Balance, Cards | International |
| **Flutterwave** | Orange Money, Wave, MTN MoMo, M-Pesa | Afrique |

#### Devises Supportees
- **Internationales**: EUR, USD, GBP
- **Afrique Ouest (FCFA)**: XOF (Senegal, Cote d'Ivoire, Mali, etc.)
- **Afrique Centrale (FCFA)**: XAF (Cameroun, Gabon, Congo)
- **Autres**: NGN, GHS, KES, ZAR, MAD, TND, EGP

#### Securite Paiements
- Verification signatures webhook (HMAC-SHA256)
- Rate limiting (5 tentatives / 5 minutes)
- Detection anti-fraude (transactions dupliquees, activite suspecte)
- Logging securise (masquage donnees sensibles)
- Codes promo avec validation

### Autres Fonctionnalites

#### OCR (Reconnaissance de Texte)
- Upload images (JPG, PNG) et PDF
- Extraction texte automatique
- Creation note directe

#### Export PDF
- Notes individuelles ou par lot
- Flashcards par matiere
- Mise en forme professionnelle

#### Emploi du Temps
- Vues mois/semaine
- Types: Cours, Examen, Devoir, Revision
- Rappels intelligents automatiques
- Evenements recurrents

#### Mode Hors Ligne
- Detection automatique connexion
- Cache IndexedDB
- Synchronisation au retour online

#### Anti-Triche
- Monitoring quiz/duels
- Detection changements onglet
- Detection copy/paste, F12
- Validation timestamps

---

## Nouveautes v3.0

### Focus Rooms
Systeme complet de salles d'etude virtuelles avec:
- 7 modeles de donnees (FocusRoom, Participant, Session, Activity, Invitation, Poke, UserStats)
- WebSocket temps reel
- Deep Work mode 90min
- Milestones automatiques
- XP bonus room (+20%)

### Algorithme FSRS
Remplacement de SM-2 par FSRS pour les flashcards:
- ~30% moins de revisions necessaires
- Meilleure retention long-terme
- Parametres ajustables

### Paiements Multi-Providers
- Stripe (cartes internationales)
- PayPal
- Flutterwave (Mobile Money Afrique)
- 12 devises supportees
- Codes promo

### Spark Intelligence
- Conversations persistantes
- Memoire long-terme
- Daily Briefing personnalise
- Insights proactifs
- Notifications intelligentes

### Optimisation Couts IA
- Cache Redis avec 70% hit rate
- Quotas ajustes pour 55% marge
- Prix en USD

---

## Architecture Technique

### Stack Frontend
| Technologie | Version | Usage |
|-------------|---------|-------|
| Next.js | 14.2.15 | Framework React SSR |
| React | 18.3.1 | UI Library |
| TypeScript | 5.3.3 | Type Safety |
| Tailwind CSS | 3.4.1 | Styling |
| Shadcn/ui | - | Composants UI |
| Zustand | 4.5.0 | State Management |
| Framer Motion | 11.0.5 | Animations |
| Axios | 1.6.7 | HTTP Client |

### Stack Backend
| Technologie | Version | Usage |
|-------------|---------|-------|
| FastAPI | 0.109+ | Framework API |
| Python | 3.11 | Runtime |
| PostgreSQL | 15 | Database |
| SQLAlchemy | 2.0 | ORM (async) |
| Redis | 7 | Cache |
| Celery | - | Tasks async |
| Alembic | - | Migrations |

### Services Externes
| Service | Usage |
|---------|-------|
| Claude Sonnet 4.5 | Generation IA |
| Stripe | Paiements cartes |
| PayPal | Paiements PayPal |
| Flutterwave | Mobile Money Afrique |

### Architecture Donnees
```
16 modeles principaux
30+ sous-modeles
22 migrations Alembic
150+ endpoints API
```

---

## Installation et Demarrage

### Prerequis
- Docker Desktop
- Docker Compose
- Git

### Installation Rapide

```bash
# 1. Cloner
git clone <repository-url>
cd study-master

# 2. Configuration backend/.env
DATABASE_URL=postgresql+asyncpg://studymaster:studymaster123@postgres:5432/studymaster_db
SECRET_KEY=your-super-secret-key-change-this-in-production
ANTHROPIC_API_KEY=your-anthropic-api-key
REDIS_URL=redis://redis:6379/0
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
PAYPAL_CLIENT_ID=...
PAYPAL_CLIENT_SECRET=...
FLUTTERWAVE_SECRET_KEY=...

# 3. Demarrer
docker-compose up -d

# 4. Acceder
# Frontend: http://localhost:3000
# Backend API: http://localhost:8000
# API Docs: http://localhost:8000/docs
```

### Identifiants Test
- **Email**: `demo@example.com`
- **Mot de passe**: `Demo123!`

---

## Plans et Tarification

### Grille Tarifaire (Option 3 - 55% marge)

| Plan | Prix USD | Prix EUR | Prix XOF | Requetes IA/jour | Stockage |
|------|----------|----------|----------|------------------|----------|
| **FREE** | $0 | 0 | 0 | 5 | 100 MB |
| **PREMIUM** | $5.99/mois | 5.49 | 3,500 FCFA | 30 | 1 GB |
| **PREMIUM+** | $11.99/mois | 10.99 | 7,000 FCFA | 60 | 5 GB |
| **INSTITUTIONAL** | $39.99/mois | 36.99 | 24,000 FCFA | 200 | 50 GB |
| **PREMIUM ANNUEL** | $59.90/an | 54.90 | 35,000 FCFA | 30 | 1 GB |

### Fonctionnalites par Plan

| Fonctionnalite | FREE | PREMIUM | PREMIUM+ | INSTITUTIONAL |
|----------------|------|---------|----------|---------------|
| Notes | 50 max | Illimite | Illimite | Illimite |
| Flashcards | 500 max | Illimite | Illimite | Illimite |
| Quiz | 20 max | Illimite | Illimite | Illimite |
| Publicites | Oui | Non | Non | Non |
| Support | Standard | Prioritaire | VIP 24/7 | Dedie |
| Analytics | - | - | Avances | Avances |
| API Access | - | - | - | Oui |
| Export | Oui | Oui | Oui | Oui |
| Collaboration | - | Oui | Oui | Oui |

### Codes Promo Actifs
- `WELCOME20` - 20% reduction bienvenue
- `STUDENT10` - 10% reduction etudiant
- `LAUNCH50` - 50% reduction lancement

---

## API Endpoints

### Resume
| Domaine | Endpoints |
|---------|-----------|
| Auth | 4 |
| Users | 11 |
| Notes | 11 |
| Flashcards | 15 |
| Quiz | 13 |
| AI | 6 |
| Focus Rooms | 20+ |
| Study Groups | 20+ |
| Duels | 14 |
| Leaderboards | 3 |
| Achievements | 6 |
| Spark/Mascot | 15+ |
| Sessions | 7 |
| Schedules | 8 |
| Notifications | 8 |
| Payments | 15+ |
| Export | 6 |
| **Total** | **150+** |

### Documentation Interactive
- **Swagger UI**: http://localhost:8000/docs
- **ReDoc**: http://localhost:8000/redoc

---

## Structure du Projet

```
study-master/
├── frontend/                    # Next.js 14
│   ├── src/
│   │   ├── app/
│   │   │   ├── (auth)/         # Login, Register
│   │   │   ├── (dashboard)/    # 35+ pages
│   │   │   │   ├── dashboard/
│   │   │   │   ├── notes/
│   │   │   │   ├── flashcards/
│   │   │   │   ├── quizzes/
│   │   │   │   ├── ai/
│   │   │   │   ├── focus-rooms/
│   │   │   │   ├── groups/
│   │   │   │   ├── duels/
│   │   │   │   ├── pricing/
│   │   │   │   └── ...
│   │   │   └── play/[shareCode]/
│   │   ├── components/
│   │   │   ├── ui/             # Shadcn/ui
│   │   │   ├── focus-room/     # Focus Room components
│   │   │   ├── groups/         # Group components
│   │   │   └── Spark*.tsx      # Mascotte
│   │   ├── services/           # 21 API services
│   │   ├── hooks/              # 15+ custom hooks
│   │   ├── contexts/           # SparkContext, etc.
│   │   └── lib/                # Utils, API config
│
├── backend/                     # FastAPI
│   ├── app/
│   │   ├── api/v1/             # 25+ routers
│   │   ├── models/             # 16 modeles + sous-modeles
│   │   ├── schemas/            # Pydantic schemas
│   │   ├── services/           # 18 services metier
│   │   └── core/               # Config, DB, Security
│   └── alembic/                # 22 migrations
│
├── docker-compose.yml
└── README.md
```

---

## Changelog

### Version 3.0.0 (Decembre 2024)
**Major Release - Focus Rooms & Payments**

- **Focus Rooms**: Systeme complet de body doubling virtuel
  - 7 modeles de donnees
  - WebSocket temps reel
  - Deep Work mode
  - Milestones et XP bonus
- **FSRS**: Nouvel algorithme de repetition espacee (~30% plus efficace)
- **Paiements Multi-Providers**: Stripe, PayPal, Flutterwave
  - 12 devises supportees
  - Mobile Money Afrique
  - Codes promo
- **Spark Intelligence**: Conversations, memoire, briefing quotidien
- **Optimisation Couts**: Cache 70%, quotas ajustes, 55% marge
- **Securite Renforcee**: Anti-fraude, rate limiting, audit logs

### Version 2.0.0 (Decembre 2024)
- Documentation complete
- 150+ endpoints API
- Gamification complete
- Mascotte Spark
- Export PDF
- Anti-triche

### Version 1.0.0 (Novembre 2024)
- Version initiale
- Notes, Flashcards, Quiz
- Hub IA
- Groupes d'etude

---

## Contribution

```bash
# 1. Fork
# 2. Branch
git checkout -b feature/AmazingFeature
# 3. Commit
git commit -m 'feat: Add AmazingFeature'
# 4. Push
git push origin feature/AmazingFeature
# 5. Pull Request
```

---

## License

MIT License

---

## Auteurs

**Study Master Team**

Developpe avec Claude Code (Anthropic)

---

<p align="center">
  <strong>Study Master v3.0</strong><br>
  La plateforme d'apprentissage intelligente
</p>
