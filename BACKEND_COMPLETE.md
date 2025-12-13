# Backend Study Master - Documentation Technique Compl&egrave;te v3.0

## Vue d'Ensemble

Le backend Study Master est une API RESTful construite avec **FastAPI** et **PostgreSQL**, offrant plus de **150 endpoints** pour une plateforme d'apprentissage intelligente compl&egrave;te.

---

## Architecture Technique

```
backend/
├── app/
│   ├── api/v1/               # Endpoints API
│   │   ├── auth.py           # Authentification JWT
│   │   ├── subjects.py       # Gestion mati&egrave;res
│   │   ├── notes.py          # Notes hi&eacute;rarchiques
│   │   ├── flashcards.py     # Flashcards FSRS
│   │   ├── quizzes.py        # Quiz adaptatifs
│   │   ├── users.py          # Profils utilisateurs
│   │   ├── ai.py             # IA Hub (Claude Sonnet 4.5)
│   │   ├── spark.py          # Spark Intelligence
│   │   ├── study_sessions.py # Sessions Pomodoro
│   │   ├── schedules.py      # Emploi du temps
│   │   ├── achievements.py   # Succ&egrave;s/Badges
│   │   ├── leaderboards.py   # Classements
│   │   ├── study_groups.py   # Groupes d'&eacute;tude
│   │   ├── focus_rooms.py    # Focus Rooms (Body Doubling)
│   │   ├── duels.py          # D&eacute;fis PvP
│   │   ├── ocr.py            # OCR PDF/Images
│   │   ├── export.py         # Export PDF
│   │   ├── payments.py       # Paiements multi-provider
│   │   └── webhooks.py       # Webhooks paiement
│   ├── models/               # Mod&egrave;les SQLAlchemy
│   │   ├── user.py           # User, Subscription, Preferences
│   │   ├── subject.py        # Subject
│   │   ├── note.py           # Note (hi&eacute;rarchique)
│   │   ├── flashcard.py      # Flashcard, FlashcardReview
│   │   ├── quiz.py           # Quiz, QuizAttempt
│   │   ├── gamification.py   # Achievement, Duel, Leaderboard
│   │   ├── study_group.py    # StudyGroup, StudyGroupMember
│   │   ├── focus_room.py     # FocusRoom, FocusSession, etc.
│   │   ├── spark.py          # SparkConversation, SparkMessage, Memory
│   │   ├── payment.py        # Plan, Transaction, Invoice
│   │   └── schedule.py       # Schedule
│   ├── schemas/              # Sch&eacute;mas Pydantic
│   ├── services/             # Services m&eacute;tier
│   │   ├── ai_service.py     # Service Claude Anthropic
│   │   ├── cache_service.py  # Cache Redis async
│   │   ├── fsrs_service.py   # Algorithme FSRS
│   │   ├── payment_service.py# Orchestration paiements
│   │   ├── stripe_service.py # Int&eacute;gration Stripe
│   │   ├── paypal_service.py # Int&eacute;gration PayPal
│   │   ├── flutterwave_service.py # Mobile Money
│   │   ├── ocr_service.py    # Service OCR
│   │   └── pdf_service.py    # Export PDF
│   └── core/                 # Configuration
│       ├── config.py         # Settings (Pydantic)
│       ├── database.py       # AsyncSession PostgreSQL
│       ├── security.py       # JWT, hashing
│       ├── payment_security.py # S&eacute;curit&eacute; paiements
│       └── datetime_utils.py # Utilitaires timezone
├── alembic/                  # Migrations DB
└── tests/                    # Tests pytest
```

---

## Mod&egrave;les de Donn&eacute;es (25+ Tables)

### Utilisateurs & Abonnements
| Table | Description | Champs cl&eacute;s |
|-------|-------------|-------------|
| `users` | Utilisateurs | email, hashed_password, total_xp, level, streak_count |
| `user_subscriptions` | Abonnements | subscription_type, ai_requests_limit, expires_at |
| `user_preferences` | Pr&eacute;f&eacute;rences | theme, language, notification_settings |

### Contenu &Eacute;ducatif
| Table | Description | Champs cl&eacute;s |
|-------|-------------|-------------|
| `subjects` | Mati&egrave;res | name, color, icon, is_favorite |
| `notes` | Notes | title, content, parent_id (hi&eacute;rarchie) |
| `flashcards` | Flashcards | front, back, stability, difficulty (FSRS) |
| `flashcard_reviews` | R&eacute;visions | rating, review_time, scheduled_days |
| `quizzes` | Quiz | title, questions (JSON), time_limit |
| `quiz_attempts` | Tentatives | score, answers, completed_at |

### Gamification
| Table | Description | Champs cl&eacute;s |
|-------|-------------|-------------|
| `achievements` | Badges | name, category, rarity, xp_reward |
| `user_achievements` | D&eacute;bloqu&eacute;s | user_id, achievement_id, unlocked_at |
| `duels` | D&eacute;fis | challenger_id, opponent_id, stakes_xp |

### Social & Collaboration
| Table | Description | Champs cl&eacute;s |
|-------|-------------|-------------|
| `study_groups` | Groupes | name, is_private, max_members |
| `study_group_members` | Membres | role (ADMIN/MODERATOR/MEMBER) |

### Focus Rooms (7 tables)
| Table | Description | Champs cl&eacute;s |
|-------|-------------|-------------|
| `focus_rooms` | Salles | name, room_type, max_participants |
| `focus_sessions` | Sessions | user_id, room_id, duration_minutes |
| `focus_goals` | Objectifs | description, target_minutes |
| `focus_breaks` | Pauses | break_type, duration |
| `focus_reactions` | R&eacute;actions | emoji, target_user_id |
| `focus_achievements` | Succ&egrave;s | achievement_type, metadata |
| `focus_room_invites` | Invitations | invited_email, status |

### Spark Intelligence (3 tables)
| Table | Description | Champs cl&eacute;s |
|-------|-------------|-------------|
| `spark_conversations` | Conversations | title, context, is_active |
| `spark_messages` | Messages | role, content, tokens_used |
| `spark_memories` | M&eacute;moire | memory_type, content, importance |

### Paiements (4 tables)
| Table | Description | Champs cl&eacute;s |
|-------|-------------|-------------|
| `subscription_plans` | Plans | name, prices (multi-devise), features |
| `transactions` | Transactions | amount, currency, provider, status |
| `invoices` | Factures | invoice_number, pdf_url |
| `promo_codes` | Codes promo | code, discount_percent, valid_until |

---

## Endpoints API (150+)

### Authentication (6 endpoints)
```
POST   /api/v1/auth/register          # Inscription
POST   /api/v1/auth/login             # Connexion (JWT)
POST   /api/v1/auth/refresh           # Refresh token
GET    /api/v1/auth/me                # Profil actuel
POST   /api/v1/auth/logout            # D&eacute;connexion
POST   /api/v1/auth/forgot-password   # R&eacute;cup&eacute;ration
```

### Subjects (8 endpoints)
```
POST   /api/v1/subjects/              # Cr&eacute;er mati&egrave;re
GET    /api/v1/subjects/              # Lister mati&egrave;res
GET    /api/v1/subjects/{id}          # D&eacute;tails
PUT    /api/v1/subjects/{id}          # Modifier
DELETE /api/v1/subjects/{id}          # Supprimer
GET    /api/v1/subjects/{id}/stats    # Statistiques
POST   /api/v1/subjects/{id}/favorite # Favori
POST   /api/v1/subjects/{id}/archive  # Archiver
```

### Notes (12 endpoints)
```
POST   /api/v1/notes/                 # Cr&eacute;er note
GET    /api/v1/notes/                 # Lister (pagination)
GET    /api/v1/notes/{id}             # D&eacute;tails
PUT    /api/v1/notes/{id}             # Modifier
DELETE /api/v1/notes/{id}             # Supprimer
GET    /api/v1/notes/search           # Recherche full-text
POST   /api/v1/notes/{id}/favorite    # Favori
POST   /api/v1/notes/{id}/pin         # &Eacute;pingler
POST   /api/v1/notes/{id}/archive     # Archiver
GET    /api/v1/notes/{id}/children    # Notes enfants
GET    /api/v1/notes/{id}/history     # Historique versions
POST   /api/v1/notes/{id}/share       # Partager
```

### Flashcards FSRS (12 endpoints)
```
POST   /api/v1/flashcards/            # Cr&eacute;er flashcard
GET    /api/v1/flashcards/            # Lister
GET    /api/v1/flashcards/{id}        # D&eacute;tails
PUT    /api/v1/flashcards/{id}        # Modifier
DELETE /api/v1/flashcards/{id}        # Supprimer
POST   /api/v1/flashcards/{id}/review # R&eacute;viser (FSRS)
GET    /api/v1/flashcards/due         # Cartes &agrave; r&eacute;viser
GET    /api/v1/flashcards/stats       # Statistiques
POST   /api/v1/flashcards/{id}/suspend# Suspendre
GET    /api/v1/flashcards/fsrs/params # Param&egrave;tres FSRS
PUT    /api/v1/flashcards/fsrs/params # Modifier FSRS
POST   /api/v1/flashcards/fsrs/optimize # Optimiser
```

### Quizzes (10 endpoints)
```
POST   /api/v1/quizzes/               # Cr&eacute;er quiz
GET    /api/v1/quizzes/               # Lister
GET    /api/v1/quizzes/{id}           # D&eacute;tails
PUT    /api/v1/quizzes/{id}           # Modifier
DELETE /api/v1/quizzes/{id}           # Supprimer
POST   /api/v1/quizzes/{id}/attempt   # D&eacute;marrer tentative
POST   /api/v1/quizzes/attempts/{id}/submit # Soumettre
GET    /api/v1/quizzes/attempts/{id}/results # R&eacute;sultats
POST   /api/v1/quizzes/{id}/publish   # Publier
GET    /api/v1/quizzes/{id}/leaderboard # Classement
```

### AI Hub (8 endpoints)
```
POST   /api/v1/ai/generate-flashcards # G&eacute;n&eacute;rer flashcards
POST   /api/v1/ai/generate-quiz       # G&eacute;n&eacute;rer quiz
POST   /api/v1/ai/summarize           # R&eacute;sumer note
POST   /api/v1/ai/extract-keywords    # Extraire mots-cl&eacute;s
POST   /api/v1/ai/explain-concept     # Expliquer concept
POST   /api/v1/ai/improve-note        # Am&eacute;liorer note
GET    /api/v1/ai/quota               # V&eacute;rifier quota
GET    /api/v1/ai/subscription-details # D&eacute;tails abonnement
```

### Spark Intelligence (10 endpoints)
```
POST   /api/v1/spark/conversations    # Nouvelle conversation
GET    /api/v1/spark/conversations    # Lister conversations
GET    /api/v1/spark/conversations/{id} # D&eacute;tails
POST   /api/v1/spark/conversations/{id}/message # Envoyer message
DELETE /api/v1/spark/conversations/{id} # Supprimer
GET    /api/v1/spark/memories         # M&eacute;moire long-terme
POST   /api/v1/spark/memories         # Ajouter m&eacute;moire
GET    /api/v1/spark/daily-briefing   # Briefing quotidien
GET    /api/v1/spark/insights         # Insights proactifs
POST   /api/v1/spark/analyze-progress # Analyser progr&egrave;s
```

### Focus Rooms (15 endpoints)
```
POST   /api/v1/focus-rooms/           # Cr&eacute;er salle
GET    /api/v1/focus-rooms/           # Lister salles
GET    /api/v1/focus-rooms/public     # Salles publiques
GET    /api/v1/focus-rooms/{id}       # D&eacute;tails
PUT    /api/v1/focus-rooms/{id}       # Modifier
DELETE /api/v1/focus-rooms/{id}       # Supprimer
POST   /api/v1/focus-rooms/{id}/join  # Rejoindre
POST   /api/v1/focus-rooms/{id}/leave # Quitter
POST   /api/v1/focus-rooms/{id}/start-session # D&eacute;marrer session
POST   /api/v1/focus-rooms/{id}/end-session   # Terminer session
POST   /api/v1/focus-rooms/{id}/goals # D&eacute;finir objectif
POST   /api/v1/focus-rooms/{id}/break # Prendre pause
POST   /api/v1/focus-rooms/{id}/react # Envoyer r&eacute;action
POST   /api/v1/focus-rooms/{id}/invite# Inviter
GET    /api/v1/focus-rooms/stats      # Statistiques
WebSocket /ws/focus-rooms/{id}        # Temps r&eacute;el
```

### Study Groups (10 endpoints)
```
POST   /api/v1/study-groups/          # Cr&eacute;er groupe
GET    /api/v1/study-groups/          # Rechercher
GET    /api/v1/study-groups/{id}      # D&eacute;tails
PUT    /api/v1/study-groups/{id}      # Modifier
DELETE /api/v1/study-groups/{id}      # Supprimer
POST   /api/v1/study-groups/{id}/join # Rejoindre
POST   /api/v1/study-groups/{id}/leave # Quitter
POST   /api/v1/study-groups/{id}/invite # Inviter
PUT    /api/v1/study-groups/{id}/members/{user_id} # Modifier r&ocirc;le
DELETE /api/v1/study-groups/{id}/members/{user_id} # Expulser
```

### Payments (12 endpoints)
```
GET    /api/v1/payments/plans         # Lister plans
GET    /api/v1/payments/plans/{id}    # D&eacute;tails plan
POST   /api/v1/payments/create-checkout # Cr&eacute;er session
POST   /api/v1/payments/verify        # V&eacute;rifier paiement
GET    /api/v1/payments/transactions  # Historique
GET    /api/v1/payments/transactions/{id} # D&eacute;tails transaction
GET    /api/v1/payments/subscription  # Mon abonnement
POST   /api/v1/payments/cancel        # Annuler abonnement
POST   /api/v1/payments/promo/apply   # Appliquer code promo
GET    /api/v1/payments/invoices      # Factures
GET    /api/v1/payments/invoices/{id}/download # T&eacute;l&eacute;charger PDF
POST   /api/v1/webhooks/{provider}    # Webhooks (Stripe/PayPal/Flutterwave)
```

### Gamification (15 endpoints)
```
GET    /api/v1/achievements/          # Tous les achievements
GET    /api/v1/achievements/user/me   # Mes achievements
POST   /api/v1/achievements/check     # V&eacute;rifier progression
GET    /api/v1/leaderboards/          # Classement g&eacute;n&eacute;ral
GET    /api/v1/leaderboards/weekly    # Classement hebdo
GET    /api/v1/leaderboards/university # Par universit&eacute;
POST   /api/v1/duels/                 # Cr&eacute;er d&eacute;fi
GET    /api/v1/duels/                 # Mes duels
GET    /api/v1/duels/pending          # D&eacute;fis en attente
POST   /api/v1/duels/{id}/accept      # Accepter
POST   /api/v1/duels/{id}/decline     # Refuser
POST   /api/v1/duels/{id}/complete    # Terminer
GET    /api/v1/users/stats            # Mes statistiques
GET    /api/v1/users/activity         # Activit&eacute; r&eacute;cente
GET    /api/v1/users/streaks          # S&eacute;ries
```

---

## Algorithme FSRS (Free Spaced Repetition Scheduler)

### Pourquoi FSRS ?
- **30% plus efficace** que SM-2 pour la r&eacute;tention
- **Param&egrave;tres adaptatifs** par utilisateur
- **Pr&eacute;diction pr&eacute;cise** de la probabilit&eacute; d'oubli

### Param&egrave;tres FSRS
```python
class FSRSParameters:
    w: list[float]  # 19 param&egrave;tres optimisables
    request_retention: float = 0.9  # R&eacute;tention cible (90%)
    maximum_interval: int = 36500   # Intervalle max (100 ans)

# Param&egrave;tres par d&eacute;faut (optimis&eacute;s sur millions de r&eacute;visions)
DEFAULT_W = [
    0.4072, 1.1829, 3.1262, 15.4722,  # Stabilit&eacute; initiale
    7.2102, 0.5316, 1.0651, 0.0234,   # Difficult&eacute;
    1.616, 0.1544, 1.0824, 1.9813,    # Facteurs de r&eacute;cup&eacute;ration
    0.0953, 0.2975, 2.2042, 0.2407,   # Oubli
    2.9466, 0.5034, 0.6567            # Autres
]
```

### Calcul de la prochaine r&eacute;vision
```python
def schedule_review(card: Flashcard, rating: Rating) -> SchedulingInfo:
    # Calculer la retrievability (probabilit&eacute; de rappel)
    retrievability = (1 + elapsed_days / (9 * stability)) ** -1

    # Mettre &agrave; jour la difficult&eacute; et stabilit&eacute;
    if rating == Rating.AGAIN:
        new_stability = stability * w[11] * (difficulty ** -w[12])
    else:
        new_stability = stability * (1 + exp(w[8]) *
                        (11 - difficulty) * stability ** -w[9])

    # Calculer l'intervalle optimal
    interval = (new_stability / FACTOR) *
               (request_retention ** (1 / DECAY) - 1)
```

---

## Syst&egrave;me de Paiements Multi-Provider

### Providers Support&eacute;s
| Provider | R&eacute;gions | M&eacute;thodes |
|----------|---------|----------|
| **Stripe** | International | Cartes, Apple Pay, Google Pay |
| **PayPal** | International | PayPal, Cartes |
| **Flutterwave** | Afrique | Mobile Money, Cartes locales |

### Devises Support&eacute;es (12)
```python
class Currency(Enum):
    EUR = "eur"    # Euro
    USD = "usd"    # Dollar US
    GBP = "gbp"    # Livre Sterling
    XOF = "xof"    # Franc CFA BCEAO
    XAF = "xaf"    # Franc CFA BEAC
    NGN = "ngn"    # Naira
    GHS = "ghs"    # Cedi
    KES = "kes"    # Shilling Kenyan
    ZAR = "zar"    # Rand
    MAD = "mad"    # Dirham Marocain
    TND = "tnd"    # Dinar Tunisien
    EGP = "egp"    # Livre Egyptienne
```

### Tarification (Option 3 - 55% marge)
| Plan | Quota IA/jour | Prix USD | Prix XOF |
|------|--------------|----------|----------|
| FREE | 5 | $0 | 0 FCFA |
| PREMIUM | 30 | $5.99/mois | 3,500 FCFA |
| PREMIUM+ | 60 | $11.99/mois | 7,000 FCFA |
| INSTITUTIONAL | 200 | $39.99/mois | 24,000 FCFA |

### S&eacute;curit&eacute; Paiements
- **Rate limiting**: 5 tentatives / 5 minutes
- **V&eacute;rification signatures**: Webhooks sign&eacute;s
- **D&eacute;tection fraude**: Analyse activit&eacute; suspecte
- **Logs sanitiz&eacute;s**: Masquage donn&eacute;es sensibles

---

## Cache Redis

### Configuration
```python
class CacheService:
    # TTL par type de contenu
    TTL_AI_RESPONSE = 86400      # 24h pour r&eacute;ponses IA
    TTL_USER_STATS = 300         # 5min pour stats
    TTL_LEADERBOARD = 60         # 1min pour classements

    async def get_cached_ai_response(
        self,
        prompt_hash: str
    ) -> Optional[str]:
        """Cache par hash du contenu"""

    async def cache_with_semantic_key(
        self,
        content: str,
        response: str
    ):
        """Cache s&eacute;mantique pour requ&ecirc;tes similaires"""
```

### Taux de Cache Estim&eacute;
- **~70%** pour r&eacute;sum&eacute;s de notes (contenu similaire)
- **~60%** pour g&eacute;n&eacute;ration flashcards
- **~50%** pour explications concepts

---

## Syst&egrave;me de Quotas IA

### Quotas par Plan
```python
AI_QUOTAS = {
    SubscriptionType.FREE: 5,           # 5 req/jour
    SubscriptionType.PREMIUM: 30,       # 30 req/jour
    SubscriptionType.PREMIUM_PLUS: 60,  # 60 req/jour
    SubscriptionType.INSTITUTIONAL: 200 # 200 req/jour
}
```

### Gestion des D&eacute;passements
```python
@router.post("/ai/generate-flashcards")
async def generate_flashcards(request: Request):
    # V&eacute;rifier quota
    if user.ai_requests_today >= quota:
        raise HTTPException(
            status_code=429,
            detail={
                "code": "QUOTA_EXCEEDED",
                "used_requests": user.ai_requests_today,
                "max_requests": quota,
                "reset_time": "00:00",
                "upgrade_available": can_upgrade,
                "upgrade_benefits": get_upgrade_options(user)
            }
        )
```

---

## WebSocket (Temps R&eacute;el)

### Focus Rooms
```python
@websocket("/ws/focus-rooms/{room_id}")
async def focus_room_websocket(websocket: WebSocket, room_id: int):
    await manager.connect(websocket, room_id)

    # &Eacute;v&eacute;nements support&eacute;s
    events = [
        "user_joined",      # Utilisateur rejoint
        "user_left",        # Utilisateur part
        "session_started",  # Session d&eacute;marr&eacute;e
        "session_ended",    # Session termin&eacute;e
        "goal_completed",   # Objectif atteint
        "break_started",    # Pause d&eacute;marr&eacute;e
        "reaction",         # R&eacute;action emoji
        "stats_update"      # Mise &agrave; jour stats
    ]
```

---

## S&eacute;curit&eacute;

### Authentification JWT
```python
# Access token: 30 minutes
# Refresh token: 7 jours
# Algorithme: HS256

def create_access_token(user_id: int) -> str:
    payload = {
        "sub": str(user_id),
        "exp": datetime.utcnow() + timedelta(minutes=30),
        "type": "access"
    }
    return jwt.encode(payload, SECRET_KEY, algorithm="HS256")
```

### Protection OWASP
- **SQL Injection**: SQLAlchemy ORM
- **XSS**: Validation Pydantic
- **CSRF**: Tokens JWT (pas de cookies)
- **Rate Limiting**: Slowapi + custom
- **Password Hashing**: bcrypt (12 rounds)

---

## Tests

### Structure
```
tests/
├── conftest.py           # Fixtures pytest
├── test_auth.py          # Tests authentification
├── test_notes.py         # Tests notes
├── test_flashcards.py    # Tests flashcards + FSRS
├── test_payments.py      # Tests paiements
└── test_ai.py            # Tests IA (mock)
```

### Couverture
```bash
pytest --cov=app --cov-report=html
# Objectif: >80% couverture
```

---

## D&eacute;ploiement

### Docker
```yaml
# docker-compose.yml
services:
  backend:
    build: ./backend
    environment:
      - DATABASE_URL=postgresql+asyncpg://...
      - REDIS_URL=redis://redis:6379
      - ANTHROPIC_API_KEY=${ANTHROPIC_API_KEY}
    depends_on:
      - postgres
      - redis

  postgres:
    image: postgres:15-alpine

  redis:
    image: redis:7-alpine
```

### Variables d'Environnement
```env
# Base
DATABASE_URL=postgresql+asyncpg://user:pass@host/db
REDIS_URL=redis://localhost:6379
SECRET_KEY=your-secret-key

# IA
ANTHROPIC_API_KEY=sk-ant-...

# Paiements
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
PAYPAL_CLIENT_ID=...
PAYPAL_CLIENT_SECRET=...
FLUTTERWAVE_SECRET_KEY=...
```

---

## R&eacute;sum&eacute;

### Stats Backend
- **150+ endpoints** REST API
- **25+ tables** PostgreSQL
- **3 providers** paiement
- **12 devises** support&eacute;es
- **FSRS** (30% plus efficace que SM-2)
- **Cache Redis** (~70% hit rate)
- **WebSocket** temps r&eacute;el

### Technologies
- FastAPI 0.100+
- SQLAlchemy 2.0 (async)
- PostgreSQL 15
- Redis 7
- Anthropic Claude Sonnet 4.5
- Stripe / PayPal / Flutterwave

Le backend est **production-ready** avec une architecture scalable et s&eacute;curis&eacute;e.
