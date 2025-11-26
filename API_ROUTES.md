# 📡 Study Master - Routes API Complètes

## Base URL: `http://localhost:8000`

---

## 🔐 Authentication (4 routes)

| Méthode | Route | Description |
|---------|-------|-------------|
| POST | `/api/v1/auth/register` | Créer un nouveau compte |
| POST | `/api/v1/auth/login` | Se connecter (obtenir JWT) |
| GET | `/api/v1/auth/me` | Profil utilisateur connecté |
| POST | `/api/v1/auth/refresh` | Rafraîchir access token |

---

## 📚 Subjects - Matières (8 routes)

| Méthode | Route | Description |
|---------|-------|-------------|
| POST | `/api/v1/subjects/` | Créer une matière |
| GET | `/api/v1/subjects/` | Liste matières (pagination) |
| GET | `/api/v1/subjects/{id}` | Détails d'une matière |
| PUT | `/api/v1/subjects/{id}` | Modifier matière |
| DELETE | `/api/v1/subjects/{id}` | Supprimer matière |
| GET | `/api/v1/subjects/{id}/stats` | Statistiques matière |
| POST | `/api/v1/subjects/{id}/favorite` | Toggle favori |
| POST | `/api/v1/subjects/{id}/archive` | Toggle archive |

---

## 📝 Notes (11 routes)

| Méthode | Route | Description |
|---------|-------|-------------|
| POST | `/api/v1/notes/` | Créer note |
| GET | `/api/v1/notes/` | Liste notes (filtres, pagination) |
| GET | `/api/v1/notes/{id}` | Détails note |
| PUT | `/api/v1/notes/{id}` | Modifier note |
| DELETE | `/api/v1/notes/{id}` | Supprimer note |
| GET | `/api/v1/notes/search` | Recherche full-text |
| POST | `/api/v1/notes/{id}/favorite` | Toggle favori |
| POST | `/api/v1/notes/{id}/pin` | Toggle épinglé |
| POST | `/api/v1/notes/{id}/archive` | Toggle archive |
| GET | `/api/v1/notes/{id}/children` | Notes enfants (hiérarchie) |
| GET | `/api/v1/notes/{id}/history` | Historique versions |

---

## 🎴 Flashcards (10 routes)

| Méthode | Route | Description |
|---------|-------|-------------|
| POST | `/api/v1/flashcards/` | Créer flashcard |
| GET | `/api/v1/flashcards/` | Liste flashcards |
| GET | `/api/v1/flashcards/{id}` | Détails |
| PUT | `/api/v1/flashcards/{id}` | Modifier |
| DELETE | `/api/v1/flashcards/{id}` | Supprimer |
| POST | `/api/v1/flashcards/{id}/review` | Réviser (SM-2) |
| GET | `/api/v1/flashcards/due` | Cartes dues |
| GET | `/api/v1/flashcards/stats` | Stats révision |
| POST | `/api/v1/flashcards/{id}/favorite` | Toggle favori |
| POST | `/api/v1/flashcards/{id}/suspend` | Suspendre |

---

## 📋 Quizzes (10 routes)

| Méthode | Route | Description |
|---------|-------|-------------|
| POST | `/api/v1/quizzes/` | Créer quiz |
| GET | `/api/v1/quizzes/` | Liste quizzes |
| GET | `/api/v1/quizzes/{id}` | Détails |
| PUT | `/api/v1/quizzes/{id}` | Modifier |
| DELETE | `/api/v1/quizzes/{id}` | Supprimer |
| POST | `/api/v1/quizzes/{id}/attempt` | Commencer tentative |
| POST | `/api/v1/quizzes/attempts/{id}/submit` | Soumettre réponses |
| GET | `/api/v1/quizzes/attempts/{id}/results` | Résultats détaillés |
| POST | `/api/v1/quizzes/{id}/publish` | Publier quiz |
| GET | `/api/v1/quizzes/{id}/attempts` | Historique |

---

## 👤 Users - Profil (7 routes)

| Méthode | Route | Description |
|---------|-------|-------------|
| GET | `/api/v1/users/profile` | Profil complet |
| PUT | `/api/v1/users/profile` | Modifier profil |
| GET | `/api/v1/users/stats` | Statistiques |
| POST | `/api/v1/users/change-password` | Changer MDP |
| POST | `/api/v1/users/upload-avatar` | Upload avatar |
| GET | `/api/v1/users/activity` | Activité récente |
| DELETE | `/api/v1/users/delete-account` | Supprimer compte |

---

## 🤖 AI - Intelligence Artificielle (6 routes)

| Méthode | Route | Description |
|---------|-------|-------------|
| POST | `/api/v1/ai/generate-flashcards` | Générer flashcards |
| POST | `/api/v1/ai/generate-quiz` | Générer quiz |
| POST | `/api/v1/ai/summarize` | Résumer note |
| POST | `/api/v1/ai/extract-keywords` | Extraire mots-clés |
| POST | `/api/v1/ai/explain-concept` | Expliquer concept |
| GET | `/api/v1/ai/quota` | Vérifier quota |

**Modèle**: Claude Sonnet 4 (`claude-sonnet-4-20250514`)

---

## ⏱️ Study Sessions - Pomodoro (8 routes)

| Méthode | Route | Description |
|---------|-------|-------------|
| POST | `/api/v1/study-sessions/` | Créer session |
| GET | `/api/v1/study-sessions/` | Liste sessions |
| GET | `/api/v1/study-sessions/{id}` | Détails |
| PUT | `/api/v1/study-sessions/{id}/start` | Démarrer |
| PUT | `/api/v1/study-sessions/{id}/complete` | Terminer |
| DELETE | `/api/v1/study-sessions/{id}` | Supprimer |
| GET | `/api/v1/study-sessions/stats` | Statistiques |

**Fonctionnalités**:
- Timer Pomodoro configurable
- Tracking productivité (1-5)
- Focus score automatique
- XP dynamique
- Détection meilleure heure

---

## 📅 Schedules - Emploi du Temps (7 routes)

| Méthode | Route | Description |
|---------|-------|-------------|
| POST | `/api/v1/schedules/` | Créer événement |
| GET | `/api/v1/schedules/` | Liste événements |
| GET | `/api/v1/schedules/week` | Vue semaine |
| GET | `/api/v1/schedules/upcoming` | Prochains événements |
| GET | `/api/v1/schedules/{id}` | Détails |
| PUT | `/api/v1/schedules/{id}` | Modifier |
| DELETE | `/api/v1/schedules/{id}` | Supprimer |

**Types**: class, exam, homework, revision, other

---

## 🏆 Achievements - Succès (6 routes)

| Méthode | Route | Description |
|---------|-------|-------------|
| GET | `/api/v1/achievements/` | Tous achievements |
| GET | `/api/v1/achievements/{id}` | Détails |
| GET | `/api/v1/achievements/user/me` | Mes achievements |
| GET | `/api/v1/achievements/user/{id}` | Achievements user |
| POST | `/api/v1/achievements/unlock/{id}` | Débloquer |
| POST | `/api/v1/achievements/check-progress` | Vérification auto |

**Catégories**: STUDY_TIME, NOTES, FLASHCARDS, QUIZZES, STREAK, LEVEL, SOCIAL, SPECIAL

**Raretés**: COMMON, RARE, EPIC, LEGENDARY

---

## 🥇 Leaderboards - Classements (4 routes)

| Méthode | Route | Description |
|---------|-------|-------------|
| GET | `/api/v1/leaderboards/` | Classement général |
| GET | `/api/v1/leaderboards/university` | Classement université |
| GET | `/api/v1/leaderboards/promotion` | Classement promotion |

**Types**: xp, streak, notes, flashcards, quizzes, study_time

**Périodes**: daily, weekly, monthly, all_time

---

## 👥 Study Groups - Groupes d'étude (8 routes)

| Méthode | Route | Description |
|---------|-------|-------------|
| POST | `/api/v1/study-groups/` | Créer groupe |
| GET | `/api/v1/study-groups/` | Rechercher groupes |
| GET | `/api/v1/study-groups/{id}` | Détails + membres |
| PUT | `/api/v1/study-groups/{id}` | Modifier |
| POST | `/api/v1/study-groups/{id}/join` | Rejoindre |
| POST | `/api/v1/study-groups/{id}/leave` | Quitter |
| DELETE | `/api/v1/study-groups/{id}` | Supprimer |

**Rôles**: ADMIN, MODERATOR, MEMBER

**Filtres**: recherche, sujet, université, promotion, publics/privés

---

## ⚔️ Duels - Défis (7 routes)

| Méthode | Route | Description |
|---------|-------|-------------|
| POST | `/api/v1/duels/` | Créer défi |
| GET | `/api/v1/duels/` | Mes duels |
| GET | `/api/v1/duels/pending` | Défis en attente |
| GET | `/api/v1/duels/{id}` | Détails |
| POST | `/api/v1/duels/{id}/accept` | Accepter |
| POST | `/api/v1/duels/{id}/decline` | Refuser |
| POST | `/api/v1/duels/{id}/complete` | Terminer |
| DELETE | `/api/v1/duels/{id}` | Annuler |

**Statuts**: PENDING, ACTIVE, COMPLETED, CANCELLED

**Fonctionnalités**:
- Mise en XP
- Basé sur quiz
- Score automatique
- Transfert XP

---

## 📄 OCR - Extraction Texte (4 routes)

| Méthode | Route | Description |
|---------|-------|-------------|
| POST | `/api/v1/ocr/upload-pdf` | Upload PDF + OCR |
| POST | `/api/v1/ocr/upload-image` | Upload image + OCR |
| GET | `/api/v1/ocr/languages` | Langues supportées |
| GET | `/api/v1/ocr/stats` | Stats OCR |

**Langues**: fra, eng, fra+eng

**Limites**:
- PDF: 50 MB max
- Image: 10 MB max

**Formats images**: JPG, PNG, BMP, TIFF, GIF

---

## 📤 Export PDF (7 routes)

| Méthode | Route | Description |
|---------|-------|-------------|
| GET | `/api/v1/export/note/{id}` | Exporter note |
| POST | `/api/v1/export/notes/batch` | Exporter sélection |
| GET | `/api/v1/export/subject/{id}/notes` | Toutes notes matière |
| GET | `/api/v1/export/flashcards/{subject_id}` | Flashcards matière |
| POST | `/api/v1/export/flashcards/batch` | Sélection flashcards |
| GET | `/api/v1/export/stats` | Stats exports |

**Fonctionnalités**:
- Formatage professionnel
- Support Markdown
- Métadonnées
- Multi-notes compilation
- Export recto-verso flashcards

---

## 📊 Résumé Global

| Module | Endpoints | Status |
|--------|-----------|--------|
| Authentication | 4 | ✅ |
| Subjects | 8 | ✅ |
| Notes | 11 | ✅ |
| Flashcards | 10 | ✅ |
| Quizzes | 10 | ✅ |
| Users | 7 | ✅ |
| AI | 6 | ✅ |
| Study Sessions | 8 | ✅ |
| Schedules | 7 | ✅ |
| Achievements | 6 | ✅ |
| Leaderboards | 4 | ✅ |
| Study Groups | 8 | ✅ |
| Duels | 7 | ✅ |
| OCR | 4 | ✅ |
| Export PDF | 7 | ✅ |
| **TOTAL** | **94** | **✅ 100%** |

---

## 🔒 Headers Requis

```http
Authorization: Bearer YOUR_ACCESS_TOKEN
Content-Type: application/json
```

---

## 📖 Documentation Interactive

**Swagger UI**: http://localhost:8000/docs

Tous les endpoints avec:
- ✅ Schémas de requêtes
- ✅ Schémas de réponses
- ✅ Exemples
- ✅ Test interactif
- ✅ Codes d'erreur

---

## ✨ Fonctionnalités Clés

### 🤖 Intelligence Artificielle
- Claude Sonnet 4
- Génération automatique
- Quotas par abonnement

### 🎴 Spaced Repetition
- Algorithme SM-2
- Optimisation mémoire
- Cartes dues intelligentes

### 🏆 Gamification Complète
- XP et niveaux
- Achievements
- Classements
- Duels

### 📊 Analytics
- Stats détaillées
- Productivité
- Focus score
- Temps d'étude

### 👥 Social
- Groupes d'étude
- Rôles et permissions
- Collaboration

### 📄 Document Processing
- OCR multi-langues
- Export PDF pro
- Formatage Markdown

---

## 🎉 Backend 100% Complet !

Toutes les fonctionnalités sont implémentées et opérationnelles ! 🚀
