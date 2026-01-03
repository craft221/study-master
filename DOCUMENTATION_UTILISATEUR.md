# Study Master - Documentation Utilisateur

## Table des Matieres

1. [Introduction](#introduction)
2. [Premiers Pas](#premiers-pas)
3. [Fonctionnalites](#fonctionnalites)
4. [Guide Detaille](#guide-detaille)
5. [Mode Hors-ligne](#mode-hors-ligne)
6. [FAQ](#faq)

---

## Introduction

**Study Master** est une plateforme d'apprentissage intelligente qui combine la puissance de l'IA avec des techniques de memorisation prouvees scientifiquement (repetition espacee FSRS).

### Principales Fonctionnalites

- **Notes intelligentes** avec support LaTeX pour les formules mathematiques
- **Flashcards** avec algorithme de repetition espacee (FSRS)
- **Quiz interactifs** generes par IA
- **Mode Examen** pour les sessions de revision concentrees
- **Gamification** avec XP, niveaux, achievements et classements
- **Duels** pour defier vos amis
- **Mode hors-ligne** complet

---

## Premiers Pas

### 1. Creer un Compte

1. Accedez a la page d'inscription
2. Remplissez le formulaire:
   - Email valide
   - Nom d'utilisateur (3-30 caracteres, lettres, chiffres, underscore)
   - Mot de passe securise (8+ caracteres, majuscule, minuscule, chiffre)
3. Validez votre email via le lien recu

### 2. Premiere Connexion

Apres connexion, vous arrivez sur le **Dashboard** qui affiche:
- Votre niveau et XP actuels
- Votre streak (jours consecutifs d'etude)
- Vos statistiques d'apprentissage
- Les flashcards a reviser aujourd'hui
- Vos activites recentes

### 3. Creer votre Premiere Matiere

1. Allez dans **Matieres** > **Nouvelle Matiere**
2. Donnez un nom (ex: "Mathematiques")
3. Choisissez une couleur et une icone
4. Sauvegardez

---

## Fonctionnalites

### Notes

Les notes sont le coeur de votre apprentissage. Creez des notes riches avec:

#### Creer une Note

1. Naviguez vers **Notes** > **Nouvelle Note**
2. Remplissez:
   - **Titre**: Un titre descriptif
   - **Matiere**: Selectionnez la matiere concernee
   - **Contenu**: Ecrivez votre note avec support Markdown et LaTeX

#### Support LaTeX

Pour les formules mathematiques:
- Formule en ligne: `$E = mc^2$`
- Formule en bloc: `$$\int_0^1 x^2 dx$$`
- Fractions: `$\frac{a}{b}$`
- Exposants: `$x^2$`
- Indices: `$x_i$`
- Racines: `$\sqrt{x}$`

#### Insertion d'Images

Trois methodes pour inserer des images dans vos notes:

| Methode | Comment faire |
|---------|---------------|
| **Ctrl+V** | Faites une capture d'ecran (Win+Shift+S) puis collez |
| **Drag & Drop** | Glissez une image depuis l'explorateur de fichiers |
| **Bouton Upload** | Cliquez sur le bouton vert "Image" dans l'editeur |

**Formats supportes**: JPG, PNG, GIF, WebP, BMP
**Taille maximale**: 10 MB par image

L'image est automatiquement uploadee et inseree au format Markdown.

#### Visibilite

- **Privee**: Visible uniquement par vous
- **Publique**: Partagee dans la section Explore

---

### Flashcards

Les flashcards utilisent l'algorithme **FSRS** (Free Spaced Repetition Scheduler) pour optimiser votre memorisation.

#### Creer un Deck

1. Allez dans **Flashcards** > **Nouveau Deck**
2. Nommez votre deck
3. Selectionnez une matiere
4. Ajoutez vos cartes (recto/verso)

#### Generation IA

Depuis une note, cliquez sur **Generer des Flashcards** pour creer automatiquement des cartes basees sur le contenu.

#### Revision

Lors de la revision, evaluez votre reponse:
- **A revoir** (Rouge): Vous ne saviez pas - la carte reviendra bientot
- **Difficile** (Orange): Vous avez hesite - intervalle court
- **Bien** (Bleu): Vous saviez - intervalle moyen
- **Facile** (Vert): Parfait - intervalle long

L'algorithme FSRS calcule automatiquement le meilleur moment pour revoir chaque carte.

#### Statistiques

Consultez vos statistiques de revision:
- Taux de retention
- Cartes revues aujourd'hui
- Temps moyen par carte
- Progression par difficulte

---

### Quiz

Testez vos connaissances avec des quiz interactifs.

#### Types de Quiz

1. **Quiz manuels**: Creez vos propres questions
2. **Quiz IA**: Generes automatiquement depuis vos notes
3. **Quiz publics**: Participez aux quiz de la communaute

#### Creer un Quiz

1. Allez dans **Quiz** > **Nouveau Quiz**
2. Selectionnez une matiere
3. Ajoutez des questions (QCM, Vrai/Faux, Reponse courte)
4. Definissez le temps limite et les points

#### Mode Quiz

- **Chronometre**: Temps limite par question ou pour le quiz entier
- **Indices**: Utilisez vos indices (limite par quiz)
- **Score**: Points bases sur la rapidite et l'exactitude

#### Anti-Triche

Le systeme detecte automatiquement:
- Reponses trop rapides
- Changements d'onglet excessifs
- Copier-coller
- Comportements suspects

En cas de triche detectee, des penalites XP peuvent etre appliquees.

---

### Mode Examen

Le Mode Examen est concu pour des sessions de revision concentrees sans distractions.

#### Demarrer une Session

1. Allez dans **Mode Examen**
2. Selectionnez une matiere ou toutes les matieres
3. Choisissez la duree
4. Cliquez sur **Demarrer**

#### Pendant la Session

- Interface epuree sans distractions
- Timer visible
- Liste des taches a accomplir
- Statistiques en temps reel

#### Taches

Creez des taches pour structurer votre session:
- Reviser les flashcards du chapitre 3
- Relire les notes sur les integrales
- Faire 10 exercices pratiques

Marquez-les comme **En cours** ou **Terminee** pour suivre votre progression.

#### Disponible Hors-ligne

Le Mode Examen fonctionne entierement sans connexion Internet. Vos sessions et taches seront synchronisees automatiquement a la reconnexion.

---

### Gamification

Study Master utilise la gamification pour vous motiver.

#### XP (Points d'Experience)

Gagnez des XP en:
- Creant des notes (+10 XP)
- Revisant des flashcards (+5-15 XP par carte)
- Completant des quiz (+10-50 XP selon le score)
- Maintenant votre streak (+5-50 XP/jour)
- Gagnant des duels (+25-100 XP)

#### Niveaux

Votre niveau est calcule par: `Niveau = sqrt(XP / 100)`

| Niveau | XP Requis |
|--------|-----------|
| 1 | 0 |
| 2 | 400 |
| 3 | 900 |
| 5 | 2,500 |
| 10 | 10,000 |

#### Streaks

Etudiez chaque jour pour maintenir votre streak:
- Le streak augmente de 1 chaque jour d'activite
- Si vous manquez un jour, le streak revient a 0
- Bonus XP croissant avec le streak (jusqu'a +50 XP/jour)

#### Achievements (Succes)

Debloquez des succes pour des accomplissements speciaux:

| Achievement | Condition |
|-------------|-----------|
| Premier pas | Creer votre premiere note |
| Collectionneur | Creer 10 flashcards |
| Quizz Master | Completer 10 quiz |
| Semaine parfaite | 7 jours de streak |
| Marathonien | 30 jours de streak |
| Savant | Atteindre niveau 10 |

#### Classements

Comparez-vous aux autres utilisateurs:
- **Global**: Classement par XP total
- **Hebdomadaire**: XP gagne cette semaine
- **Amis**: Classement parmi vos amis

---

### Duels

Defiez vos amis dans des quiz competitifs.

#### Lancer un Duel

1. Allez dans **Duels** > **Nouveau Duel**
2. Selectionnez un adversaire
3. Choisissez une matiere et les enjeux (XP)
4. Envoyez le defi

#### Regles

- Memes questions pour les deux joueurs
- Temps limite identique
- Score base sur exactitude et rapidite
- Le gagnant remporte les XP mises en jeu

#### Anti-Triche en Duel

Le systeme compare automatiquement:
- Les temps de reponse
- Les patterns de reponses
- La coherence entre les joueurs

---

### Planning / Calendrier

Organisez vos sessions d'etude.

#### Creer un Evenement

1. Allez dans **Planning**
2. Cliquez sur un creneau ou **Nouvel Evenement**
3. Remplissez:
   - Titre
   - Date et heure
   - Matiere (optionnel)
   - Rappel (optionnel)

#### Vues

- **Jour**: Vue detaillee d'une journee
- **Semaine**: Vue hebdomadaire
- **Mois**: Vue mensuelle avec indicateurs

#### Rappels

Recevez des rappels:
- Notification push
- Email
- Dans l'application

---

### Explore

Decouvrez le contenu partage par la communaute.

#### Parcourir

- Notes publiques
- Quiz publics
- Decks de flashcards partages

#### Importer

Importez du contenu de qualite dans votre compte:
1. Trouvez un contenu interessant
2. Cliquez sur **Importer**
3. Le contenu est copie dans votre compte

#### Partager

Partagez votre travail:
1. Ouvrez une note/quiz/deck
2. Changez la visibilite en **Publique**
3. Votre contenu apparait dans Explore

---

### Mascotte (Studie)

Studie est votre compagnon d'apprentissage IA.

#### Interactions

Studie peut:
- Vous encourager
- Vous rappeler de reviser
- Celebrer vos achievements
- Donner des conseils personnalises

#### Personnalisation

Changez l'apparence de Studie dans les parametres.

---

## Mode Hors-ligne

Study Master fonctionne meme sans connexion Internet.

### Fonctionnalites Disponibles Hors-ligne

| Fonctionnalite | Disponible | Notes |
|----------------|------------|-------|
| Voir les notes | Oui | Notes en cache |
| Creer des notes | Oui | Sync automatique |
| Voir les flashcards | Oui | Decks en cache |
| Creer des flashcards | Oui | Sync automatique |
| Reviser les flashcards | Oui | Statistiques locales |
| Voir le planning | Oui | Evenements en cache |
| Creer des evenements | Oui | Sync automatique |
| Mode Examen | Oui | Complet |
| Quiz (existants) | Oui | Quiz en cache |
| Generation IA | Non | Necessite connexion |
| Duels | Non | Temps reel requis |

### Comment ca Marche

1. **Cache automatique**: Vos donnees sont stockees localement (IndexedDB)
2. **IDs temporaires**: Les creations hors-ligne utilisent des IDs temporaires
3. **File de synchronisation**: Les actions sont mises en file d'attente
4. **Sync automatique**: A la reconnexion, tout est synchronise

### Indicateurs

- **Icone nuage barre**: Mode hors-ligne actif
- **Badge orange**: Donnees en attente de sync
- **Badge vert**: Tout est synchronise

### Forcer la Synchronisation

1. Verifiez votre connexion
2. Allez dans **Parametres** > **Synchronisation**
3. Cliquez sur **Synchroniser maintenant**

---

## Parametres

### Profil

- Modifier votre nom d'affichage
- Changer votre avatar
- Mettre a jour votre email
- Modifier votre mot de passe

### Notifications

Configurez vos preferences:
- Rappels de revision
- Notifications de streak
- Defis de duels
- Nouveaux achievements

### Confidentialite

- Profil public/prive
- Apparaitre dans les classements
- Autoriser les invitations de duel

### Theme

- Mode clair
- Mode sombre
- Automatique (systeme)

### Abonnement

Gerez votre abonnement:
- **Gratuit**: Fonctionnalites de base
- **Premium**: IA illimitee, pas de pubs, fonctionnalites avancees

---

## Raccourcis Clavier

| Raccourci | Action |
|-----------|--------|
| `Ctrl + N` | Nouvelle note |
| `Ctrl + S` | Sauvegarder |
| `Ctrl + F` | Rechercher |
| `Espace` | Retourner flashcard |
| `1-4` | Evaluer flashcard |
| `Esc` | Fermer modal |

---

## FAQ

### Questions Generales

**Q: Study Master est-il gratuit?**
R: Oui, les fonctionnalites de base sont gratuites. Un abonnement Premium existe pour des fonctionnalites avancees.

**Q: Mes donnees sont-elles securisees?**
R: Oui, nous utilisons le chiffrement SSL, les mots de passe sont hashes avec bcrypt, et nous ne partageons jamais vos donnees.

**Q: Puis-je exporter mes donnees?**
R: Oui, allez dans Parametres > Donnees > Exporter pour telecharger vos notes et flashcards.

### Flashcards

**Q: Comment fonctionne l'algorithme FSRS?**
R: FSRS (Free Spaced Repetition Scheduler) optimise les intervalles de revision bases sur votre performance. Les cartes bien connues apparaissent moins souvent, celles mal connues plus souvent.

**Q: Pourquoi une carte revient tout le temps?**
R: Si vous evaluez souvent "A revoir", l'algorithme diminue l'intervalle. Essayez d'ameliorer votre comprehension du sujet.

### Mode Hors-ligne

**Q: Que se passe-t-il si je cree du contenu hors-ligne et en ligne simultanement?**
R: Le systeme utilise des IDs temporaires et resout les conflits lors de la synchronisation. Vos donnees ne sont jamais perdues.

**Q: Combien de donnees sont stockees localement?**
R: Environ 50-100 Mo selon votre usage. Vous pouvez vider le cache dans Parametres > Stockage.

### Gamification

**Q: Comment recuperer mon streak perdu?**
R: Malheureusement, les streaks ne peuvent pas etre recuperes. C'est ce qui les rend precieux!

**Q: Les XP peuvent-ils etre perdus?**
R: Oui, la triche detectee entraine des penalites XP. Le fair-play est recompense.

---

## Support

### Contacter le Support

- Email: support@study-master.com
- In-app: Parametres > Aide > Contacter le support

### Signaler un Bug

1. Allez dans Parametres > Aide > Signaler un bug
2. Decrivez le probleme en detail
3. Ajoutez des captures d'ecran si possible

### Communaute

- Discord: [Lien vers Discord]
- Forum: [Lien vers Forum]

---

## Changelog

### Version 1.0.0

- Lancement initial
- Notes avec LaTeX
- Flashcards FSRS
- Quiz et duels
- Gamification complete
- Mode hors-ligne

---

*Derniere mise a jour: Decembre 2025*

*Study Master - Apprendre plus intelligemment*
