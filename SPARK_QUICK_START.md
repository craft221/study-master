# 🚀 SPARK - GUIDE DE DÉMARRAGE RAPIDE

## ⚡ Pour Voir Spark MAINTENANT

### Étape 1 : Migration Base de Données (2 minutes)

```bash
# Aller dans le dossier backend
cd backend

# Lancer la migration
docker-compose exec backend alembic upgrade head

# OU si pas encore démarré:
docker-compose up -d
docker-compose exec backend alembic upgrade head
```

### Étape 2 : Vérifier la Migration

```bash
# Se connecter à PostgreSQL
docker-compose exec postgres psql -U studymaster -d studymaster_db

# Vérifier que les colonnes existent
\d users

# Vous devriez voir :
# - mascot_name
# - mascot_level
# - mascot_unlocked_accessories
# - mascot_current_accessory
# - mascot_last_interaction_date

# Quitter
\q
```

### Étape 3 : Redémarrer le Backend

```bash
# Redémarrer pour charger les nouveaux endpoints
docker-compose restart backend

# Vérifier les logs
docker-compose logs -f backend

# Vous devriez voir : "🐿️ Mascot endpoints loaded"
```

### Étape 4 : Lancer le Frontend

```bash
# Dans un nouveau terminal
cd frontend

# Installer les dépendances si besoin
npm install

# Lancer en mode dev
npm run dev
```

### Étape 5 : Tester !

1. **Ouvrir le navigateur** : `http://localhost:3000`

2. **Se connecter** (ou créer un compte)

3. **Aller sur le dashboard** : `http://localhost:3000/dashboard`

4. **SPARK DEVRAIT APPARAÎTRE** en bas à droite ! 🐿️⚡

---

## ✅ CE QUI DEVRAIT SE PASSER

### Au Chargement du Dashboard

1. **Spark apparaît** en bas à droite
2. **Après 1 seconde**, un message de bienvenue apparaît :
   - "Salut ! Spark est prêt à collecter des connaissances avec toi ! 🌰⚡"
   - OU variations aléatoires

### Interactions

1. **Cliquer sur Spark** :
   - Message aléatoire encourageant
   - Animation "wave" (salut)

2. **Hover sur Spark** :
   - Nom du niveau affiché ("Spark Bébé", "Spark Junior", etc.)
   - Agrandissement léger (scale 1.1)

3. **Animations automatiques** :
   - Queue qui bouge (tail-wag)
   - Oreilles qui bougent occasionnellement
   - Noisette qui flotte
   - Étincelles si niveau élevé

---

## 🎨 VISUELS

### Ce Que Tu Verras

- **Écureuil SVG haute qualité** :
  - Couleurs orange vif (#FF8C42)
  - Queue touffue animée
  - Grands yeux expressifs
  - Noisette dans les mains
  - Ombres et gradients pour profondeur

- **Bulle de Message** :
  - Fond coloré selon le mood
  - Message personnalisé
  - Triangle pointeur vers Spark

### Moods Disponibles

- 😊 **Happy** - Sourire doux, queue enroulée
- 🤩 **Excited** - Grand sourire, étincelles, queue dressée
- 😢 **Sad** - Moue, noisette cassée, couleurs désaturées
- 🤔 **Thinking** - Main sur le menton, queue en "?"
- 💪 **Encouraging** - Poing levé, aura d'énergie
- 😴 **Sleeping** - Yeux fermés, "Z Z Z", endormi

---

## 🧪 TESTER LES FONCTIONNALITÉS

### Test 1 : Message de Bienvenue

```javascript
// Console du navigateur (F12)
// Effacer le sessionStorage pour refaire le test
sessionStorage.removeItem('spark_welcome_shown');
location.reload();

// → Spark devrait dire "Salut !" après 1 seconde
```

### Test 2 : Clic sur Spark

1. Cliquer sur Spark
2. Un des messages suivants devrait apparaître :
   - "Besoin d'aide ? Je suis là ! 🐿️"
   - "Fun fact : Les écureuils oublient 25% de leurs cachettes..."
   - "Tu veux une noisette ? Fais un quiz ! 🌰"
   - etc.

### Test 3 : Endpoints API

```bash
# Récupérer un token JWT (après login)
TOKEN="votre_token_ici"

# Test GET /state
curl -X GET http://localhost:8000/api/v1/mascot/state \
  -H "Authorization: Bearer $TOKEN"

# Devrait retourner :
{
  "name": "Spark",
  "level": 1,
  "level_name": "Spark Bébé",
  "unlocked_accessories": [],
  "current_accessory": null,
  "total_accessories": 0,
  "user_xp": 0,
  "user_streak": 0
}

# Test POST /message
curl -X POST http://localhost:8000/api/v1/mascot/message \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "event": "welcome",
    "use_ai": false,
    "context": {}
  }'

# Devrait retourner un message de bienvenue

# Test GET /accessories
curl -X GET http://localhost:8000/api/v1/mascot/accessories \
  -H "Authorization: Bearer $TOKEN"

# Liste de 7 accessoires (tous verrouillés au départ)
```

### Test 4 : Niveaux de Spark

```sql
-- Dans PostgreSQL (simuler progression XP)
UPDATE users SET total_xp = 100 WHERE email = 'ton_email@example.com';
-- Niveau devrait passer à 2 (Spark Junior)

UPDATE users SET total_xp = 500;
-- Niveau 3 (Spark Expert)

UPDATE users SET total_xp = 1000;
-- Niveau 4 (Spark Sage)

UPDATE users SET total_xp = 5000;
-- Niveau 5 (Spark Légendaire) avec couronne d'étincelles
```

Rafraîchir la page pour voir le changement visuel !

### Test 5 : Accessoires

```sql
-- Débloquer l'accessoire "glasses" (10 jours de série)
UPDATE users SET current_streak = 10 WHERE email = 'ton_email@example.com';

-- Aller sur /dashboard et cliquer sur Spark
-- Vérifier /api/v1/mascot/check-new-unlocks
-- Devrait afficher : "🎉 Nouvel accessoire débloqué : Lunettes d'Érudit !"
```

---

## 🐛 DÉPANNAGE

### Spark n'apparaît pas

**Problème** : Rien en bas à droite

**Solutions** :
```bash
# 1. Vérifier la console navigateur (F12)
# Erreurs probables :
# - "Module not found: SparkWidget" → npm install
# - "Failed to fetch mascot state" → Backend pas démarré

# 2. Vérifier le token
localStorage.getItem('access_token')
# Doit retourner un token, sinon se reconnecter

# 3. Vérifier le backend
docker-compose logs backend | grep mascot
# Doit montrer les endpoints enregistrés

# 4. Tester l'endpoint directement
curl http://localhost:8000/api/v1/mascot/state \
  -H "Authorization: Bearer $TOKEN"
```

### Migration échoue

**Problème** : `alembic upgrade head` fail

**Solutions** :
```bash
# 1. Vérifier que Postgres tourne
docker-compose ps

# 2. Vérifier les logs Postgres
docker-compose logs postgres

# 3. Rollback si nécessaire
docker-compose exec backend alembic downgrade -1
docker-compose exec backend alembic upgrade head

# 4. Si l'erreur persiste, migration manuelle :
docker-compose exec postgres psql -U studymaster -d studymaster_db

ALTER TABLE users ADD COLUMN mascot_name VARCHAR(50) DEFAULT 'Spark';
ALTER TABLE users ADD COLUMN mascot_level INTEGER DEFAULT 1;
ALTER TABLE users ADD COLUMN mascot_unlocked_accessories JSON;
ALTER TABLE users ADD COLUMN mascot_current_accessory VARCHAR(50);
ALTER TABLE users ADD COLUMN mascot_last_interaction_date TIMESTAMP WITH TIME ZONE;

UPDATE users SET mascot_unlocked_accessories = '[]' WHERE mascot_unlocked_accessories IS NULL;

\q
```

### Animations ne fonctionnent pas

**Problème** : Spark statique, pas d'animations

**Solutions** :
```bash
# Vérifier que framer-motion est installé
cd frontend
npm list framer-motion

# Si absent :
npm install framer-motion

# Redémarrer le dev server
npm run dev
```

### SVG ne s'affiche pas

**Problème** : Spark est invisible ou cassé

**Solutions** :
```javascript
// Console navigateur
// Vérifier que SparkSVG charge
import SparkSVG from './components/SparkSVG';

// Vérifier les erreurs SVG dans l'inspecteur
// Elements > Chercher "svg" dans le DOM
```

---

## 📊 SWAGGER UI - TESTER LES ENDPOINTS

1. Ouvrir : `http://localhost:8000/docs`

2. Chercher la section : **"Mascot - Spark l'Écureuil ⚡🐿️"**

3. Cliquer sur **"Authorize"** en haut

4. Entrer ton token JWT : `Bearer votre_token_ici`

5. Tester tous les endpoints :
   - GET /api/v1/mascot/state
   - POST /api/v1/mascot/message
   - GET /api/v1/mascot/accessories
   - PATCH /api/v1/mascot/update
   - POST /api/v1/mascot/interaction
   - GET /api/v1/mascot/check-new-unlocks

---

## 🎉 SUCCÈS !

Si tu vois Spark bouger en bas à droite avec un message de bienvenue, **FÉLICITATIONS !** 🚀

Spark est maintenant **100% opérationnel** avec :
- ✅ Backend complet (6 endpoints)
- ✅ Frontend intégré (composants React)
- ✅ SVG haute qualité (animations fluides)
- ✅ Système d'évolution (5 niveaux)
- ✅ 7 accessoires déblocables
- ✅ Messages IA personnalisés (Sonnet 4.5)
- ✅ Base de données prête

---

## 📝 PROCHAINES ÉTAPES

### Pour Améliorer

1. **Créer de vrais assets** :
   - Engager un illustrateur
   - Suivre `SPARK_DESIGN_SPECIFICATIONS.md`
   - Remplacer SVG temporaire

2. **Ajouter événements** :
   - Quiz complété → `onQuizComplete(score, topic)`
   - Flashcards créées → `showMessage('flashcard_created')`
   - Achievement débloqué → `showMessage('achievement')`

3. **Messages IA** :
   - Ajouter `ANTHROPIC_API_KEY` dans `.env`
   - Activer `use_ai=true` pour personnalisation

4. **Page Paramètres Spark** :
   - Renommer Spark
   - Équiper accessoires
   - Voir progression

---

## 🆘 BESOIN D'AIDE ?

### Documentation

- **README Technique** : `SPARK_README.md`
- **Design Specs** : `SPARK_DESIGN_SPECIFICATIONS.md`
- **Exemples Code** : `SPARK_INTEGRATION_EXAMPLE.tsx`

### Debug

1. **Console navigateur** (F12) :
   ```javascript
   // Voir l'état de Spark
   localStorage.getItem('access_token')

   // Tester directement le hook
   import { useSpark } from '@/hooks/useSpark';
   ```

2. **Logs Backend** :
   ```bash
   docker-compose logs -f backend | grep -i spark
   ```

3. **Logs Postgres** :
   ```bash
   docker-compose exec postgres psql -U studymaster -d studymaster_db
   SELECT mascot_name, mascot_level, mascot_unlocked_accessories
   FROM users
   WHERE email = 'ton_email@example.com';
   ```

---

**Bon test avec Spark ! 🐿️⚡**

*Version 1.0 - 2025-12-02*
