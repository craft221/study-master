# 🐿️⚡ SPARK - LA MASCOTTE DE STUDY MASTER

## Implémentation Complète - Documentation Technique

---

## 📋 VUE D'ENSEMBLE

**Spark** est l'écureuil mascotte de Study Master qui accompagne les étudiants dans leur parcours d'apprentissage. Cette implémentation complète comprend :

- ✅ Backend Python (FastAPI) avec IA (Claude Sonnet 4.5)
- ✅ Frontend React/TypeScript avec animations (Framer Motion)
- ✅ Système d'évolution (5 niveaux)
- ✅ 7 accessoires déblocables
- ✅ Messages personnalisés avec IA
- ✅ Intégration complète avec la gamification

---

## 🏗️ ARCHITECTURE

```
┌─────────────────────────────────────────────────────────────┐
│                    FRONTEND (Next.js + React)               │
│  ┌────────────────┐  ┌───────────────┐  ┌────────────────┐ │
│  │ Spark.tsx      │  │ useSpark()    │  │ SparkWidget    │ │
│  │ (Composant)    │  │ (Hook)        │  │ (Widget)       │ │
│  └────────────────┘  └───────────────┘  └────────────────┘ │
└───────────────────────────┬─────────────────────────────────┘
                            │ API Calls (REST)
                            ▼
┌─────────────────────────────────────────────────────────────┐
│              BACKEND (FastAPI + PostgreSQL)                 │
│  ┌──────────────────────────────────────────────────────┐  │
│  │ /api/v1/mascot/*                                     │  │
│  │  - GET  /state                                       │  │
│  │  - POST /message                                     │  │
│  │  - GET  /accessories                                 │  │
│  │  - PATCH /update                                     │  │
│  │  - POST /interaction                                 │  │
│  │  - GET  /check-new-unlocks                           │  │
│  └──────────────────────────────────────────────────────┘  │
│                            │                                 │
│  ┌──────────────────────────────────────────────────────┐  │
│  │ mascot_service.py                                    │  │
│  │  - Génération messages IA (Claude Sonnet 4.5)       │  │
│  │  - Messages prédéfinis (cache)                       │  │
│  │  - Gestion accessoires                               │  │
│  └──────────────────────────────────────────────────────┘  │
│                            │                                 │
│  ┌──────────────────────────────────────────────────────┐  │
│  │ User Model (SQLAlchemy)                              │  │
│  │  - mascot_name                                       │  │
│  │  - mascot_level                                      │  │
│  │  - mascot_unlocked_accessories (JSON)                │  │
│  │  - mascot_current_accessory                          │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

---

## 📁 FICHIERS CRÉÉS/MODIFIÉS

### Backend

#### Modèles
- ✅ **`backend/app/models/user.py`** (MODIFIÉ)
  - Ajout champs mascotte (nom, niveau, accessoires)
  - Méthodes `calculate_mascot_level()` et `get_unlockable_accessories()`

#### Services
- ✅ **`backend/app/services/mascot_service.py`** (CRÉÉ - 300+ lignes)
  - Génération de messages personnalisés avec Claude
  - Messages cachés pour économiser l'API
  - Gestion des accessoires
  - Indices pédagogiques

#### Schémas
- ✅ **`backend/app/schemas/mascot.py`** (CRÉÉ)
  - Schémas Pydantic pour validation
  - Request/Response models complets

#### Endpoints API
- ✅ **`backend/app/api/v1/mascot.py`** (CRÉÉ - 280+ lignes)
  - 6 endpoints REST complets
  - Gestion d'état, messages, accessoires

#### Configuration
- ✅ **`backend/app/main.py`** (MODIFIÉ)
  - Routeur mascotte enregistré
  - Tag "Mascot - Spark l'Écureuil ⚡🐿️"

### Frontend

#### Composants
- ✅ **`frontend/src/components/Spark.tsx`** (CRÉÉ - 400+ lignes)
  - Composant React animé avec Framer Motion
  - 6 moods, 9 animations
  - Support de 5 niveaux
  - 7 accessoires
  - Bulles de messages contextuelles

- ✅ **`frontend/src/components/SparkWidget.tsx`** (CRÉÉ)
  - Widget prêt à l'emploi
  - Utilise useSpark hook
  - Facile à intégrer partout

#### Hooks
- ✅ **`frontend/src/hooks/useSpark.ts`** (CRÉÉ - 300+ lignes)
  - Hook personnalisé pour gérer Spark
  - Gestion d'état, API calls
  - `useSparkEvents` pour événements auto

#### Types
- ✅ **`frontend/src/types/spark.ts`** (CRÉÉ)
  - Types TypeScript complets
  - Configurations des niveaux et accessoires

### Documentation

- ✅ **`SPARK_DESIGN_SPECIFICATIONS.md`** (CRÉÉ - 600+ lignes)
  - Spécifications complètes pour designers
  - Personnalité, design, animations
  - Accessoires, niveaux, guidelines

- ✅ **`SPARK_INTEGRATION_EXAMPLE.tsx`** (CRÉÉ)
  - 8 exemples d'intégration
  - Cas d'usage réels
  - Bonnes pratiques

- ✅ **`SPARK_README.md`** (CE FICHIER)
  - Documentation technique complète

---

## 🔌 API ENDPOINTS

Base URL : `http://localhost:8000/api/v1/mascot`

### 1. GET `/state`
Récupère l'état actuel de Spark

**Response:**
```json
{
  "name": "Spark",
  "level": 3,
  "level_name": "Spark Expert",
  "unlocked_accessories": ["glasses", "graduate_hat"],
  "current_accessory": "glasses",
  "total_accessories": 2,
  "user_xp": 750,
  "user_streak": 12
}
```

### 2. POST `/message`
Génère un message de Spark selon un événement

**Request:**
```json
{
  "event": "quiz_success",
  "use_ai": false,
  "context": {
    "score": 95,
    "topic": "Mathématiques"
  }
}
```

**Response:**
```json
{
  "message": "WOHOOO ! 95% ! Tu as tout explosé ! 🎉🌰",
  "mood": "excited",
  "animation": "celebration",
  "timestamp": "2025-12-02T14:30:00Z"
}
```

### 3. GET `/accessories`
Liste tous les accessoires (débloqués et verrouillés)

**Response:**
```json
{
  "accessories": [
    {
      "id": "graduate_hat",
      "name": "Chapeau de Diplômé",
      "description": "100 flashcards créées",
      "emoji": "🎓",
      "requirement": "100 flashcards",
      "is_unlocked": true
    },
    ...
  ],
  "unlocked_count": 2,
  "total_count": 7,
  "newly_unlocked": ["golden_acorn"]
}
```

### 4. PATCH `/update`
Met à jour le nom ou l'accessoire de Spark

**Request:**
```json
{
  "name": "Éclair",
  "current_accessory": "glasses"
}
```

**Response:**
```json
{
  "success": true,
  "name": "Éclair",
  "current_accessory": "glasses",
  "message": "Mascotte mise à jour avec succès !"
}
```

### 5. POST `/interaction`
Enregistre une interaction (clic sur Spark)

**Response:**
```json
{
  "message": "Prêt à ajouter des noisettes à ta collection ? 📚",
  "mood": "happy",
  "animation": "wave"
}
```

### 6. GET `/check-new-unlocks`
Vérifie les nouveaux débloquages

**Response:**
```json
{
  "has_new_unlocks": true,
  "newly_unlocked": ["golden_acorn"],
  "accessories_names": ["Noisette en Or"],
  "message": "🎉 Nouvel accessoire débloqué : Noisette en Or !",
  "mood": "excited",
  "animation": "celebration"
}
```

---

## 🎨 UTILISATION FRONTEND

### Exemple Basique - SparkWidget

```tsx
import SparkWidget from '@/components/SparkWidget';

export default function DashboardPage() {
  return (
    <div>
      {/* Votre contenu */}
      <h1>Tableau de Bord</h1>

      {/* Spark apparaît en bas à droite */}
      <SparkWidget position="bottom-right" />
    </div>
  );
}
```

### Exemple Avancé - Événements Personnalisés

```tsx
import { useSpark } from '@/hooks/useSpark';
import SparkWidget from '@/components/SparkWidget';

export default function QuizPage() {
  const { showMessage, checkNewUnlocks } = useSpark();

  const handleQuizComplete = async (score: number) => {
    // Message de Spark selon le score
    if (score >= 80) {
      await showMessage('quiz_success', { score });
    } else {
      await showMessage('quiz_failed', { score });
    }

    // Vérifier nouveaux déblocages
    await checkNewUnlocks();
  };

  return (
    <div>
      <QuizComponent onComplete={handleQuizComplete} />
      <SparkWidget />
    </div>
  );
}
```

### Exemple - Composant Spark Direct

```tsx
import Spark from '@/components/Spark';

export default function CustomExample() {
  return (
    <Spark
      mood="excited"
      animation="celebration"
      message="Bravo ! 🎉"
      level={3}
      accessory="glasses"
      onClick={() => console.log('Spark clicked!')}
      position="center"
    />
  );
}
```

---

## 🎯 ÉVÉNEMENTS DISPONIBLES

| Événement | Mood | Animation | Quand l'utiliser |
|-----------|------|-----------|------------------|
| `welcome` | happy | wave | Login, retour utilisateur |
| `quiz_success` | excited | celebration | Quiz réussi (≥80%) |
| `quiz_failed` | encouraging | pat | Quiz raté (<80%) |
| `streak` | excited | jump | Série active (multiples de 5) |
| `idle` | sad | sleep | Inactif 3+ jours |
| `new_accessory` | excited | showcase | Nouvel accessoire débloqué |
| `level_up` | excited | evolution | Changement de niveau |
| `flashcard_created` | happy | collect | Flashcards créées |
| `note_created` | thinking | read | Notes créées |
| `achievement` | excited | celebration | Achievement débloqué |

---

## 🎭 MOODS & ANIMATIONS

### Moods (États Émotionnels)
- `happy` 😊 - Par défaut, positif
- `excited` 🤩 - Succès, célébration
- `sad` 😢 - Échec, inactivité
- `thinking` 🤔 - Réflexion, IA en cours
- `encouraging` 💪 - Motivation après échec
- `sleeping` 😴 - Utilisateur inactif

### Animations
- `idle` - Au repos (loop)
- `wave` - Salut
- `celebration` - Célébration avec étincelles
- `jump` - Saut de joie
- `sleep` - Sommeil avec Z
- `think` - Réflexion
- `pat` - Tape amicale
- `collect` - Collecte noisette
- `read` - Lecture
- `showcase` - Présentation accessoire
- `evolution` - Transformation de niveau

---

## 🏆 SYSTÈME D'ACCESSOIRES

### Conditions de Déblocage

| Accessoire | Emoji | Condition |
|------------|-------|-----------|
| Chapeau de Diplômé | 🎓 | 100 flashcards créées |
| Lunettes d'Érudit | 👓 | 10 jours de série |
| Noisette en Or | 🌰✨ | 1000 XP |
| Cape d'Éclair | ⚡ | Niveau 10 |
| Mini Bibliothèque | 📚 | 50 notes créées |
| Trophée du Champion | 🏆 | 20 quiz complétés |
| Couronne Légendaire | 👑 | 30 jours de série |

### Équiper un Accessoire

```tsx
const { equipAccessory } = useSpark();

// Équiper les lunettes
await equipAccessory('glasses');

// Retirer l'accessoire
await equipAccessory('');
```

---

## 📊 NIVEAUX D'ÉVOLUTION

| Niveau | Nom | XP Requis | Emoji |
|--------|-----|-----------|-------|
| 1 | Spark Bébé | 0 - 99 | 🐿️ |
| 2 | Spark Junior | 100 - 499 | 🐿️✨ |
| 3 | Spark Expert | 500 - 999 | 🐿️⚡ |
| 4 | Spark Sage | 1000 - 4999 | 🐿️📚 |
| 5 | Spark Légendaire | 5000+ | 🐿️👑 |

**Évolution automatique** basée sur le total XP de l'utilisateur.

---

## 🧠 MESSAGES IA vs CACHÉS

### Messages Cachés (Rapides, Gratuits)
Utilisés pour événements fréquents :
- `welcome` - Login quotidien
- `idle` - Rappels d'inactivité
- Messages génériques

**Avantages** :
- Instantanés (pas d'API call)
- Gratuits (pas de consommation quota IA)
- Prévisibles

### Messages IA (Personnalisés, Consomment Quota)
Utilisés pour événements importants :
- Quiz avec contexte (score, sujet, tentatives)
- Analyses de progression
- Conseils pédagogiques personnalisés

**Avantages** :
- Ultra-personnalisés
- Comprennent le contexte utilisateur
- Empathiques et adaptés

**Activation** :
```tsx
await showMessage('quiz_failed', {
  score: 45,
  topic: 'Calcul intégral',
  attempts: 3
}, true); // true = utiliser l'IA
```

---

## 🚀 PROCHAINES ÉTAPES

### Pour Activer Complètement Spark :

1. **Créer les Assets Visuels**
   - Suivre `SPARK_DESIGN_SPECIFICATIONS.md`
   - Engager un designer/illustrateur
   - Formats : SVG, PNG, Lottie JSON

2. **Migration Base de Données**
   ```bash
   # Générer la migration Alembic
   cd backend
   alembic revision --autogenerate -m "Add mascot fields to users"
   alembic upgrade head
   ```

3. **Intégrer dans le Dashboard**
   - Copier le code de `SPARK_INTEGRATION_EXAMPLE.tsx`
   - Ajouter `<SparkWidget />` dans le layout principal
   - Ajouter événements dans les pages clés (quiz, flashcards, etc.)

4. **Tester**
   ```bash
   # Backend
   cd backend
   docker-compose up

   # Frontend
   cd frontend
   npm run dev

   # Tester les endpoints
   curl http://localhost:8000/docs
   # Aller à /api/v1/mascot/*
   ```

5. **Configurer l'IA (Optionnel)**
   - Ajouter `ANTHROPIC_API_KEY` dans `.env`
   - Activer `use_ai=true` pour messages personnalisés

---

## 🐛 TROUBLESHOOTING

### Spark n'apparaît pas
```tsx
// Vérifier que SparkWidget est importé
import SparkWidget from '@/components/SparkWidget';

// Vérifier le token d'authentification
localStorage.getItem('accessToken'); // Doit exister

// Vérifier la console pour erreurs API
```

### Messages ne s'affichent pas
```tsx
// Vérifier l'état dans useSpark
const { currentMessage } = useSpark();
console.log(currentMessage); // Doit contenir message, mood, animation
```

### Accessoires ne se débloquent pas
```python
# Backend : vérifier les conditions dans user.py
user.get_unlockable_accessories()  # Liste des accessoires débloquables

# Forcer la vérification
await checkNewUnlocks();
```

### Animations ne fonctionnent pas
```bash
# Installer framer-motion si manquant
npm install framer-motion

# Vérifier l'import
import { motion } from 'framer-motion';
```

---

## 📈 MÉTRIQUES DE SUCCÈS

### KPIs à Suivre

1. **Engagement avec Spark**
   - Nombre de clics sur Spark
   - Interactions par utilisateur/jour
   - Taux de lecture des messages

2. **Rétention**
   - Retour après message "idle"
   - Séries actives après message "streak"
   - Taux de désinstallation

3. **Gamification**
   - Accessoires débloqués/utilisateur
   - Progression vers niveau supérieur
   - Mentions de Spark dans feedback

4. **Performance**
   - Temps de chargement Spark
   - Consommation quota IA
   - Taux d'erreur API /mascot/*

---

## 🔐 SÉCURITÉ

### Validation Backend
- ✅ Tous les endpoints protégés par authentification
- ✅ Validation Pydantic sur toutes les requêtes
- ✅ Quotas IA respectés
- ✅ Pas d'injection SQL (SQLAlchemy ORM)

### Privacy
- ✅ Messages IA ne stockent pas de données personnelles
- ✅ Interactions avec Spark sont privées
- ✅ Pas de tracking externe

---

## 📞 SUPPORT

Pour questions techniques :
- **Backend** : Vérifier `/docs` Swagger UI
- **Frontend** : Consulter `SPARK_INTEGRATION_EXAMPLE.tsx`
- **Design** : Voir `SPARK_DESIGN_SPECIFICATIONS.md`

---

## 🎉 CONCLUSION

**Spark est maintenant entièrement implémenté !** 🚀

Toute l'infrastructure backend et frontend est prête. Il ne manque que :
1. Les assets visuels (design/illustrations)
2. La migration de base de données
3. L'intégration finale dans les pages

Spark apportera une dimension **émotionnelle et motivante** unique à Study Master, différenciant clairement la plateforme de la concurrence.

**Symbole** : 🐿️⚡ - Un écureuil qui collecte les connaissances, plein d'énergie et d'étincelles !

---

**Créé avec ❤️ pour Study Master**
**Version** : 1.0.0
**Date** : 2025-12-02
