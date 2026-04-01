"""
Service IA pour Exam Mode - Génération intelligente de contenu
==============================================================

Ce service utilise Claude Sonnet 4.5 pour:
1. Génération de quiz IA pour chaque tâche "quiz"
2. Analyse du contenu des notes pour identifier les points clés
3. Détection des points faibles basée sur les performances
4. Conseils personnalisés de révision
5. Adaptation dynamique du plan selon la progression

Modèle: Claude Sonnet 4.5 (claude-sonnet-4-5-20250929)
"""

import json
import logging
from datetime import date, timedelta
from app.core.datetime_utils import utc_now
from typing import List, Dict, Any, Optional, Tuple
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from sqlalchemy.orm import selectinload

from app.services.ai_service import ai_service, AIService
from app.services.cache_service import (
    cache_service, cached_ai_content, CachePrefix, CacheTTL
)
from app.core.i18n import build_system_prompt_with_language
from app.models.exam_mode import (
    ExamSession, StudyDay, StudyTask, StudyTaskType, StudyTaskStatus,
    TASK_DURATION_ESTIMATES
)
from app.models.note import Note
from app.models.quiz import Quiz, QuizQuestion, QuestionType
from app.models.flashcard import FlashcardDeck, Flashcard
from app.models.user import User

logger = logging.getLogger(__name__)


class ExamModeAIService:
    """
    Service IA dédié à Exam Mode

    Utilise Claude Sonnet 4.5 pour générer du contenu intelligent
    et adapter le plan d'étude en fonction des performances.
    """

    def __init__(self):
        self.ai_service = ai_service
        self.model = "claude-sonnet-4-5-20250929"  # Sonnet 4.5

    # ==================== 1. GÉNÉRATION DE QUIZ IA ====================

    async def generate_quiz_for_task(
        self,
        db: AsyncSession,
        task: StudyTask,
        user: User,
        lang: str = "fr"
    ) -> Optional[Quiz]:
        """
        Génère un quiz IA pour une tâche de type QUIZ

        Si la tâche a une note associée, génère un quiz basé sur cette note.
        Sinon, génère un quiz basé sur le contenu du jour.
        """
        if task.task_type != StudyTaskType.QUIZ:
            logger.warning(f"Task {task.id} is not a quiz task")
            return None

        # Récupérer le contenu à partir duquel générer le quiz
        content = await self._get_task_content(db, task)
        if not content:
            logger.warning(f"No content found for task {task.id}")
            return None

        note_title = content.get("title", "Quiz de révision")
        note_content = content.get("content", "")

        # Déterminer la difficulté basée sur le jour dans le plan
        study_day = task.study_day
        exam_session = study_day.exam_session

        progress_ratio = study_day.day_number / max(1, exam_session.total_days)
        if progress_ratio < 0.3:
            difficulty = "easy"
        elif progress_ratio < 0.7:
            difficulty = "medium"
        else:
            difficulty = "hard"

        # Nombre de questions adaptatif
        question_count = min(15, max(5, len(note_content.split()) // 200))

        try:
            # Utiliser le service AI existant pour générer le quiz
            quiz_data = await self.ai_service.generate_quiz_from_note(
                note_content=note_content,
                note_title=note_title,
                question_count=question_count,
                question_types=["multiple_choice", "true_false", "short_answer"],
                difficulty=difficulty,
                lang=lang
            )

            # Créer le quiz en base
            quiz = Quiz(
                user_id=user.id,
                title=f"Quiz - {note_title}",
                description=f"Quiz généré pour la préparation: {exam_session.exam_name}",
                subject_id=exam_session.subject_id,
                source_note_id=task.note_id,
                is_ai_generated=True,
                difficulty=difficulty,
                time_limit_minutes=question_count * 2,  # 2 min par question
                questions_data=[],  # Will be populated via QuizQuestion relation
            )
            db.add(quiz)
            await db.flush()

            # Ajouter les questions et construire questions_data
            questions_data_list = []
            for idx, q_data in enumerate(quiz_data.get("questions", [])):
                question = QuizQuestion(
                    quiz_id=quiz.id,
                    question=q_data.get("question", ""),
                    question_type=q_data.get("type", "multiple_choice"),
                    options=q_data.get("options", []),
                    correct_answer=str(q_data.get("correct_answer", "")),
                    explanation=q_data.get("explanation", ""),
                    points=q_data.get("points", 10),
                    order=idx + 1,
                )
                db.add(question)
                # Aussi stocker dans questions_data pour l'API publique
                questions_data_list.append({
                    "question": q_data.get("question", ""),
                    "type": q_data.get("type", "multiple_choice"),
                    "options": q_data.get("options", []),
                    "correct_answer": str(q_data.get("correct_answer", "")),
                    "explanation": q_data.get("explanation", ""),
                    "points": q_data.get("points", 10),
                })
            quiz.questions_data = questions_data_list

            # Lier le quiz à la tâche
            task.quiz_id = quiz.id
            task.items_count = len(quiz_data.get("questions", []))

            await db.commit()
            logger.info(f"Generated quiz {quiz.id} for task {task.id}")

            return quiz

        except Exception as e:
            logger.error(f"Error generating quiz for task {task.id}: {e}")
            await db.rollback()
            return None

    async def generate_flashcards_for_task(
        self,
        db: AsyncSession,
        task: StudyTask,
        user: User,
        lang: str = "fr"
    ) -> Optional[FlashcardDeck]:
        """
        Génère des flashcards IA pour une tâche de type FLASHCARDS
        """
        if task.task_type != StudyTaskType.FLASHCARDS:
            logger.warning(f"Task {task.id} is not a flashcards task")
            return None

        content = await self._get_task_content(db, task)
        if not content:
            logger.warning(f"No content found for task {task.id}")
            return None

        note_title = content.get("title", "Révision")
        note_content = content.get("content", "")

        # Nombre de cartes adaptatif
        card_count = min(20, max(5, len(note_content.split()) // 150))

        study_day = task.study_day
        exam_session = study_day.exam_session

        progress_ratio = study_day.day_number / max(1, exam_session.total_days)
        difficulty = "easy" if progress_ratio < 0.3 else "medium" if progress_ratio < 0.7 else "hard"

        try:
            flashcards_data = await self.ai_service.generate_flashcards_from_note(
                note_content=note_content,
                note_title=note_title,
                count=card_count,
                difficulty=difficulty,
                lang=lang
            )

            # Créer le deck
            deck = FlashcardDeck(
                user_id=user.id,
                name=f"Flashcards - {note_title}",
                description=f"Flashcards pour: {exam_session.exam_name}",
                subject_id=exam_session.subject_id,
                note_id=task.note_id,
                is_ai_generated=True,
                card_count=len(flashcards_data),
            )
            db.add(deck)
            await db.flush()

            # Ajouter les cartes
            for idx, card_data in enumerate(flashcards_data):
                card = Flashcard(
                    deck_id=deck.id,
                    deck_name=f"Flashcards - {note_title}",
                    user_id=user.id,
                    subject_id=exam_session.subject_id,
                    source_note_id=task.note_id,
                    front=card_data.get("front", ""),
                    back=card_data.get("back", ""),
                    hint=card_data.get("hint"),
                    explanation=card_data.get("explanation"),
                    is_ai_generated=True,
                )
                db.add(card)

            # Lier au task
            task.flashcard_deck_id = deck.id
            task.items_count = len(flashcards_data)

            await db.commit()
            logger.info(f"Generated flashcard deck {deck.id} for task {task.id}")

            return deck

        except Exception as e:
            logger.error(f"Error generating flashcards for task {task.id}: {e}")
            await db.rollback()
            return None

    async def _get_task_content(
        self,
        db: AsyncSession,
        task: StudyTask
    ) -> Optional[Dict[str, str]]:
        """Récupère le contenu associé à une tâche (notes + documents)"""

        # Si la tâche a une note directement associée
        if task.note_id:
            query = select(Note).where(Note.id == task.note_id)
            result = await db.execute(query)
            note = result.scalar_one_or_none()
            if note:
                return {"title": note.title, "content": note.content or ""}

        # Sinon, récupérer les notes du jour
        study_day = task.study_day
        if study_day.note_ids:
            query = select(Note).where(Note.id.in_(study_day.note_ids))
            result = await db.execute(query)
            notes = result.scalars().all()
            if notes:
                combined_content = "\n\n".join([
                    f"## {note.title}\n{note.content or ''}"
                    for note in notes
                ])
                return {
                    "title": f"Révision Jour {study_day.day_number}",
                    "content": combined_content
                }

        # Sinon, récupérer les notes ET documents de la session
        exam_session = study_day.exam_session
        content_parts = []

        # Récupérer les notes
        if exam_session.note_ids:
            query = select(Note).where(Note.id.in_(exam_session.note_ids))
            result = await db.execute(query)
            notes = result.scalars().all()
            for note in notes:
                content_parts.append(f"## {note.title}\n{note.content or ''}")

        # Récupérer les documents (utiliser le texte extrait)
        document_ids = getattr(exam_session, 'document_ids', None) or []
        if document_ids:
            from app.models.document import Document
            doc_query = select(Document).where(Document.id.in_(document_ids))
            doc_result = await db.execute(doc_query)
            documents = doc_result.scalars().all()
            for doc in documents:
                if doc.extracted_text:
                    doc_title = doc.title or doc.original_filename
                    content_parts.append(f"## Document: {doc_title}\n{doc.extracted_text}")

        if content_parts:
            return {
                "title": exam_session.exam_name,
                "content": "\n\n".join(content_parts)
            }

        return None

    # ==================== 2. ANALYSE DES POINTS CLÉS ====================

    async def analyze_key_points(
        self,
        db: AsyncSession,
        session: ExamSession,
        lang: str = "fr"
    ) -> Dict[str, Any]:
        """
        Analyse le contenu des notes pour identifier les points clés

        Retourne une structure avec:
        - concepts_cles: Liste des concepts importants
        - formules_importantes: Formules/définitions à mémoriser
        - liens_conceptuels: Relations entre concepts
        - priorite_revision: Ordre de priorité pour la révision

        CACHE: 6 heures (contenu stable mais peut évoluer)
        """

        # === CACHE CHECK ===
        cache_key = cache_service.generate_key(
            CachePrefix.EXAM_KEY_POINTS,
            session_id=session.id,
            lang=lang
        )
        cached_result = await cache_service.get(cache_key)
        if cached_result:
            logger.info(f"Cache HIT for key points analysis (session {session.id})")
            return cached_result

        # Récupérer tout le contenu (notes + documents)
        document_ids = getattr(session, 'document_ids', None) or []
        if not session.note_ids and not document_ids:
            return {"error": "Aucun contenu associé à cette session"}

        content_parts = []

        # Récupérer les notes
        if session.note_ids:
            query = select(Note).where(Note.id.in_(session.note_ids))
            result = await db.execute(query)
            notes = list(result.scalars().all())
            for note in notes:
                content_parts.append(f"=== {note.title} ===\n{note.content or ''}")

        # Récupérer les documents
        if document_ids:
            from app.models.document import Document
            doc_query = select(Document).where(Document.id.in_(document_ids))
            doc_result = await db.execute(doc_query)
            documents = doc_result.scalars().all()
            for doc in documents:
                if doc.extracted_text:
                    doc_title = doc.title or doc.original_filename
                    content_parts.append(f"=== Document: {doc_title} ===\n{doc.extracted_text}")

        if not content_parts:
            return {"error": "Contenu non trouvé"}

        # Combiner le contenu
        all_content = "\n\n".join(content_parts)

        # Limiter la taille pour l'API
        max_chars = 15000
        if len(all_content) > max_chars:
            all_content = all_content[:max_chars] + "...[contenu tronqué]"

        base_system_prompt = """Tu es le Professeur Expert, un pédagogue de renommée mondiale avec 30 ans d'expérience dans l'enseignement supérieur et la préparation aux examens.

## TON EXPERTISE
- Docteur en Sciences de l'Éducation, spécialiste de la métacognition et des stratégies d'apprentissage
- Auteur de "La Méthode des Points Clés" utilisée dans 50+ universités
- Expert en cartographie conceptuelle et en identification des savoirs essentiels
- Consultant pour les concours nationaux (agrégation, CAPES, médecine)

## TA MISSION
Analyser du contenu académique pour extraire UNIQUEMENT ce qui est CRITIQUE pour réussir un examen.
Tu dois distinguer:
- L'ESSENTIEL (ce qui sera forcément évalué)
- L'IMPORTANT (ce qui peut tomber)
- Le SECONDAIRE (contexte utile mais rarement évalué)

## TES PRINCIPES
1. PRÉCISION: Chaque concept doit être défini de manière exacte et mémorisable
2. HIÉRARCHISATION: Tout n'a pas la même importance - tu dois PRIORISER sans pitié
3. CONNEXION: Les concepts isolés s'oublient - tu montres les LIENS
4. ANTICIPATION: Tu identifies les pièges classiques des examinateurs
5. PRAGMATISME: Tu donnes ce qui SERT à l'examen, pas des digressions académiques"""

        system_prompt = build_system_prompt_with_language(base_system_prompt, lang)

        prompt = f"""## CONTEXTE DE L'EXAMEN
- **Matière**: {session.exam_name}
- **Date d'échéance**: {session.exam_date}
- **Niveau de difficulté**: {session.difficulty_level.value}

## CONTENU À ANALYSER
<notes_etudiant>
{all_content}
</notes_etudiant>

## TA TÂCHE
Effectue une analyse experte de ce contenu en suivant cette méthodologie:

### ÉTAPE 1: IDENTIFICATION DES CONCEPTS CLÉS
Pour chaque concept fondamental:
- Donne un **nom précis** (terminologie exacte du domaine)
- Fournis une **définition concise** (max 2 phrases, mémorisable)
- Attribue un **score d'importance** (1-10) avec cette échelle:
  * 10: Concept INCONTOURNABLE (présent dans 90%+ des examens)
  * 7-9: Concept MAJEUR (très probable à l'examen)
  * 4-6: Concept IMPORTANT (peut tomber)
  * 1-3: Concept SECONDAIRE (contexte/culture générale)
- Indique des **mots-clés associés** pour faciliter la mémorisation

### ÉTAPE 2: FORMULES ET DÉFINITIONS À MÉMORISER PAR CŒUR
Identifie ce qui doit être su EXACTEMENT (mot pour mot):
- Formules mathématiques (en LaTeX: $formule$)
- Définitions officielles/légales
- Théorèmes avec leurs conditions d'application
- Dates, chiffres clés, citations importantes
Pour chaque élément: précise le CONTEXTE D'UTILISATION (quand l'utiliser à l'examen)

### ÉTAPE 3: CARTE DES LIENS CONCEPTUELS
Montre comment les concepts s'articulent:
- Relations de CAUSALITÉ (A entraîne B)
- Relations de COMPOSITION (A fait partie de B)
- Relations d'OPPOSITION (A vs B)
- Relations de CONDITION (A si et seulement si B)

### ÉTAPE 4: MATRICE DE PRIORITÉ DE RÉVISION
Classe les sujets par ordre de priorité STRATÉGIQUE:
- Priorité 1: À maîtriser PARFAITEMENT (réviser en premier et revoir souvent)
- Priorité 2: À bien connaître (réviser sérieusement)
- Priorité 3: À survoler (comprendre sans approfondir)
Justifie chaque classement par rapport au TYPE D'EXAMEN probable.

### ÉTAPE 5: PIÈGES ET ERREURS CLASSIQUES
Identifie les erreurs que font 80% des étudiants:
- Confusions fréquentes entre concepts proches
- Erreurs de raisonnement typiques
- Oublis classiques
- Pièges de formulation des examinateurs
Pour chaque piège: donne la STRATÉGIE DE PRÉVENTION spécifique.

## FORMAT DE RÉPONSE (JSON STRICT)
```json
{{
  "concepts_cles": [
    {{
      "nom": "Nom exact du concept",
      "definition": "Définition précise et mémorisable en 1-2 phrases",
      "importance": 9,
      "mots_cles": ["mot1", "mot2", "mot3"],
      "exemple_application": "Exemple concret d'utilisation"
    }}
  ],
  "formules_memoriser": [
    {{
      "titre": "Nom de la formule/définition",
      "formule": "$formule_latex$ ou texte exact",
      "contexte": "Quand et comment l'utiliser à l'examen",
      "conditions": "Conditions d'application/validité"
    }}
  ],
  "liens_conceptuels": [
    {{
      "de": "Concept source",
      "vers": "Concept cible",
      "relation": "Type de relation (cause, composition, opposition, condition)",
      "explication": "Pourquoi ce lien est important à comprendre"
    }}
  ],
  "priorites_revision": [
    {{
      "sujet": "Nom du sujet/chapitre",
      "priorite": 1,
      "raison": "Justification stratégique basée sur le type d'examen",
      "temps_suggere": "Pourcentage du temps de révision à y consacrer"
    }}
  ],
  "pieges_courants": [
    {{
      "piege": "Description précise de l'erreur fréquente",
      "pourquoi_frequent": "Pourquoi les étudiants tombent dans ce piège",
      "prevention": "Stratégie concrète pour éviter cette erreur",
      "phrase_memoire": "Phrase mnémotechnique si applicable"
    }}
  ],
  "resume_strategique": "En 3-4 phrases: la stratégie globale pour réussir cet examen"
}}
```

IMPORTANT:
- Réponds UNIQUEMENT avec le JSON, sans texte avant ou après
- Assure-toi que le JSON est valide et parseable
- Limite-toi à 10 concepts clés max, 8 formules max, pour rester actionnable"""

        try:
            response = await self.ai_service._call_claude(prompt, system_prompt)
            result_text = self.ai_service._clean_json_response(response)
            analysis = json.loads(result_text)

            # Stocker dans la session pour référence
            session.strong_points = [c["nom"] for c in analysis.get("concepts_cles", [])[:5]]
            await db.commit()

            # === CACHE SET (6 heures) ===
            await cache_service.set(cache_key, analysis, ttl=CacheTTL.LONG * 6)  # 6h

            logger.info(f"Key points analysis completed for session {session.id}")
            return analysis

        except Exception as e:
            logger.error(f"Error analyzing key points: {e}")
            return {"error": str(e)}

    # ==================== 3. DÉTECTION DES POINTS FAIBLES ====================

    async def detect_weak_points(
        self,
        db: AsyncSession,
        session: ExamSession,
        user: User,
        lang: str = "fr"
    ) -> Dict[str, Any]:
        """
        Détecte les points faibles basés sur les performances aux quiz/flashcards

        Analyse:
        - Scores aux quiz par sujet
        - Taux de réussite aux flashcards
        - Temps passé vs prévu
        - Patterns d'erreurs
        """

        # Récupérer toutes les tâches complétées avec scores
        query = select(StudyTask).join(StudyDay).where(
            StudyDay.exam_session_id == session.id,
            StudyTask.status == StudyTaskStatus.COMPLETED,
            StudyTask.achieved_score.isnot(None)
        ).options(
            selectinload(StudyTask.study_day),
            selectinload(StudyTask.note)
        )
        result = await db.execute(query)
        completed_tasks = list(result.scalars().all())

        if not completed_tasks:
            return {
                "message": "Pas encore assez de données pour détecter les points faibles",
                "weak_points": [],
                "recommendations": ["Complétez plus de tâches pour obtenir une analyse"]
            }

        # Analyser les performances par type et par note
        performance_data = {
            "by_type": {},
            "by_note": {},
            "low_scores": [],
            "time_issues": []
        }

        for task in completed_tasks:
            # Par type
            task_type = task.task_type.value
            if task_type not in performance_data["by_type"]:
                performance_data["by_type"][task_type] = {"scores": [], "times": []}

            performance_data["by_type"][task_type]["scores"].append(task.achieved_score)
            if task.actual_minutes:
                performance_data["by_type"][task_type]["times"].append(
                    task.actual_minutes / task.estimated_minutes
                )

            # Par note
            if task.note_id and task.note:
                note_title = task.note.title
                if note_title not in performance_data["by_note"]:
                    performance_data["by_note"][note_title] = {"scores": [], "note_id": task.note_id}
                performance_data["by_note"][note_title]["scores"].append(task.achieved_score)

            # Identifier les scores faibles
            if task.achieved_score < 70:
                performance_data["low_scores"].append({
                    "task": task.title,
                    "type": task_type,
                    "score": task.achieved_score,
                    "note": task.note.title if task.note else None
                })

            # Identifier les problèmes de temps
            if task.actual_minutes and task.actual_minutes > task.estimated_minutes * 1.5:
                performance_data["time_issues"].append({
                    "task": task.title,
                    "estimated": task.estimated_minutes,
                    "actual": task.actual_minutes
                })

        # Identifier les points faibles
        weak_points = []

        # Notes avec scores moyens bas
        for note_title, data in performance_data["by_note"].items():
            avg_score = sum(data["scores"]) / len(data["scores"])
            if avg_score < 75:
                weak_points.append({
                    "type": "note",
                    "subject": note_title,
                    "score_moyen": round(avg_score, 1),
                    "severite": "haute" if avg_score < 60 else "moyenne"
                })

        # Types de tâches problématiques
        for task_type, data in performance_data["by_type"].items():
            if data["scores"]:
                avg_score = sum(data["scores"]) / len(data["scores"])
                if avg_score < 70:
                    weak_points.append({
                        "type": "task_type",
                        "subject": task_type,
                        "score_moyen": round(avg_score, 1),
                        "severite": "haute" if avg_score < 60 else "moyenne"
                    })

        # Générer des recommandations IA
        recommendations = await self._generate_weak_point_recommendations(
            weak_points, performance_data, lang
        )

        # Mettre à jour la session
        session.weak_points = [wp["subject"] for wp in weak_points[:5]]
        await db.commit()

        return {
            "weak_points": weak_points,
            "performance_summary": {
                "tasks_analyzed": len(completed_tasks),
                "average_score": round(
                    sum(t.achieved_score for t in completed_tasks) / len(completed_tasks), 1
                ),
                "low_score_count": len(performance_data["low_scores"]),
                "time_issues_count": len(performance_data["time_issues"])
            },
            "detailed_issues": {
                "low_scores": performance_data["low_scores"][:10],
                "time_issues": performance_data["time_issues"][:5]
            },
            "recommendations": recommendations
        }

    async def _generate_weak_point_recommendations(
        self,
        weak_points: List[Dict],
        performance_data: Dict,
        lang: str
    ) -> List[str]:
        """Génère des recommandations personnalisées pour les points faibles"""

        if not weak_points:
            return ["Continuez votre excellent travail!"]

        weak_subjects = [wp["subject"] for wp in weak_points[:5]]
        low_scores = performance_data.get("low_scores", [])[:5]

        base_system_prompt = """Tu es le Dr. Amélia Chen, neuroscientifique et spécialiste en sciences cognitives de l'apprentissage.

## TON EXPERTISE
- PhD en Neurosciences Cognitives (MIT)
- 15 ans de recherche sur la mémoire et l'acquisition des compétences
- Auteure de "Rewire Your Learning" - bestseller sur l'optimisation de l'apprentissage
- Consultante pour des programmes de rattrapage universitaires avec 94% de taux de réussite

## TA PHILOSOPHIE
"Les points faibles ne sont pas des échecs, ce sont des OPPORTUNITÉS DE CROISSANCE CIBLÉES."

Tu transformes les faiblesses en forces avec des stratégies basées sur la science:
- Répétition espacée (algorithme de Leitner)
- Pratique délibérée (focus sur les erreurs)
- Chunking (décomposition en micro-compétences)
- Interleaving (alternance des sujets difficiles)
- Retrieval practice (auto-évaluation active)

## TON APPROCHE
1. DIAGNOSTIC PRÉCIS: Identifier la CAUSE RACINE de chaque difficulté
2. PRESCRIPTION CIBLÉE: Une stratégie spécifique pour chaque type de faiblesse
3. ACTIONS CONCRÈTES: Des exercices pratiques, pas des conseils vagues
4. MESURE DU PROGRÈS: Comment savoir si on s'améliore"""

        system_prompt = build_system_prompt_with_language(base_system_prompt, lang)

        prompt = f"""## DIAGNOSTIC DE L'ÉTUDIANT

### Points faibles identifiés par l'analyse des performances:
<points_faibles>
{json.dumps(weak_points[:5], indent=2, ensure_ascii=False)}
</points_faibles>

### Historique des scores faibles récents:
<scores_recents>
{json.dumps(low_scores, indent=2, ensure_ascii=False)}
</scores_recents>

## TA MISSION
Génère un PLAN D'AMÉLIORATION SCIENTIFIQUE avec 5-7 recommandations.

### CRITÈRES POUR CHAQUE RECOMMANDATION:
1. **SPÉCIFIQUE**: Pas de "révisez plus" → plutôt "Faites 10 exercices type X chaque jour"
2. **MESURABLE**: L'étudiant doit pouvoir vérifier s'il l'a fait
3. **ACTIONNABLE**: Faisable immédiatement, sans ressources supplémentaires
4. **BASÉE SUR LA SCIENCE**: Explique POURQUOI ça fonctionne (quel mécanisme cognitif)
5. **TEMPORISÉE**: Indique la fréquence et la durée recommandées

### EXEMPLE DE BONNE RECOMMANDATION:
"Pour [sujet difficile]: Utilisez la technique du 'Feynman' - expliquez le concept à voix haute comme si vous l'enseigniez à un enfant de 10 ans. Faites-le 1x/jour pendant 5 minutes. Cela active la consolidation par production et révèle les lacunes cachées."

### EXEMPLE DE MAUVAISE RECOMMANDATION:
"Travaillez plus sur ce sujet" (trop vague, non actionnable)

## FORMAT DE RÉPONSE (JSON STRICT)
```json
{{
  "diagnostic_global": "Synthèse en 2-3 phrases du profil de difficultés de l'étudiant",
  "cause_principale": "La cause racine probable des difficultés (lacunes de base, méthode inefficace, manque de pratique, etc.)",
  "recommendations": [
    {{
      "action": "Description précise et actionnable de ce qu'il faut faire",
      "cible": "Quel point faible cette action adresse",
      "science": "Pourquoi ça fonctionne (mécanisme cognitif)",
      "frequence": "Quand et combien de fois le faire",
      "duree_estimee": "Temps nécessaire par session"
    }}
  ],
  "ordre_priorite": "Par quoi commencer et dans quel ordre attaquer les faiblesses",
  "signe_progres": "Comment l'étudiant saura qu'il s'améliore"
}}
```

IMPORTANT: Réponds UNIQUEMENT avec le JSON valide."""

        try:
            response = await self.ai_service._call_claude(prompt, system_prompt)
            result_text = self.ai_service._clean_json_response(response)
            result = json.loads(result_text)

            # Extraire les recommandations du nouveau format enrichi
            recommendations = result.get("recommendations", [])

            # Si le format est enrichi (liste de dicts), extraire les actions
            if recommendations and isinstance(recommendations[0], dict):
                return [rec.get("action", str(rec)) for rec in recommendations]

            return recommendations
        except Exception as e:
            logger.error(f"Error generating recommendations: {e}")
            return [
                f"Concentrez-vous sur: {', '.join(weak_subjects)}",
                "Refaites les quiz où vous avez eu moins de 70%",
                "Utilisez les flashcards pour renforcer la mémorisation",
                "Espacez vos sessions de révision (technique de répétition espacée)",
                "Testez-vous régulièrement plutôt que relire passivement"
            ]

    # ==================== 4. CONSEILS PERSONNALISÉS ====================

    async def get_personalized_advice(
        self,
        db: AsyncSession,
        session: ExamSession,
        user: User,
        lang: str = "fr"
    ) -> Dict[str, Any]:
        """
        Génère des conseils personnalisés de révision basés sur:
        - Progression actuelle
        - Points forts/faibles
        - Temps restant
        - Style d'apprentissage déduit
        """

        # Récupérer les statistiques
        days_left = session.days_until_exam
        progress = session.progress_percentage
        avg_score = session.average_quiz_score
        weak_points = session.weak_points or []
        strong_points = session.strong_points or []

        # Analyser le style d'apprentissage basé sur les performances
        query = select(StudyTask).join(StudyDay).where(
            StudyDay.exam_session_id == session.id,
            StudyTask.status == StudyTaskStatus.COMPLETED
        )
        result = await db.execute(query)
        completed_tasks = list(result.scalars().all())

        learning_style = self._deduce_learning_style(completed_tasks)

        base_system_prompt = """Tu es Coach Marcus, un préparateur mental et stratège d'examens d'élite.

## TON PARCOURS
- Ancien champion de mémoire (3x champion national)
- Coach de préparation aux concours les plus sélectifs (ENS, Polytechnique, Médecine)
- Formé plus de 5000 étudiants avec un taux de réussite de 89%
- Créateur de la méthode "Peak Performance Académique"

## TA PHILOSOPHIE
"La réussite n'est pas une question de talent, mais de STRATÉGIE + EXÉCUTION + MENTAL."

Tu combines trois dimensions:
1. **STRATÉGIE**: Le bon contenu, au bon moment, de la bonne façon
2. **TACTIQUE**: Des actions quotidiennes précises et optimisées
3. **MENTAL**: Confiance, motivation et gestion du stress

## TON STYLE DE COACHING
- DIRECT: Tu dis ce qui doit être fait, sans tourner autour du pot
- RÉALISTE: Tu adaptes tes conseils au temps disponible (pas de plan irréaliste)
- MOTIVANT: Tu inspires l'action, pas la paralysie
- PERSONNALISÉ: Tu tiens compte du profil unique de chaque étudiant

## TES SPÉCIALITÉS
- Optimisation du temps de révision (loi de Pareto appliquée aux études)
- Techniques de mémorisation avancées (palais de la mémoire, associations)
- Gestion du stress pré-examen
- Planification stratégique (countdown planning)
- Récupération et prévention du burnout"""

        system_prompt = build_system_prompt_with_language(base_system_prompt, lang)

        # Calculer l'urgence
        urgency_level = "critique" if days_left <= 3 else "haute" if days_left <= 7 else "normale" if days_left <= 14 else "confortable"

        prompt = f"""## PROFIL COMPLET DE L'ÉTUDIANT

### Informations sur l'examen
- **Examen**: {session.exam_name}
- **Date**: {session.exam_date}
- **Jours restants**: {days_left} jours
- **Niveau d'urgence**: {urgency_level.upper()}

### Progression actuelle
- **Avancement global**: {progress}% du plan complété
- **Tâches**: {len(completed_tasks)} / {session.tasks_total} terminées
- **Score moyen**: {avg_score}% aux évaluations

### Profil d'apprentissage
- **Style dominant**: {learning_style}
- **Points forts identifiés**: {', '.join(strong_points) if strong_points else 'Pas encore identifiés'}
- **Points à renforcer**: {', '.join(weak_points) if weak_points else 'Pas encore identifiés'}

### Contraintes
- **Disponibilité**: {session.study_hours_per_day}h d'étude par jour

## TA MISSION
Génère un PLAN DE COACHING PERSONNALISÉ adapté à ce profil spécifique.

### RÈGLES IMPORTANTES:
1. **ADAPTE AU TEMPS**: Si urgence critique/haute → focus sur l'essentiel, pas de perfectionnisme
2. **EXPLOITE LES FORCES**: Utilise le style d'apprentissage dominant
3. **CIBLE LES FAIBLESSES**: Mais de façon réaliste vu le temps restant
4. **SOIS CONCRET**: Pas de conseils génériques type "travaillez bien"

### STRUCTURE ATTENDUE:

#### 1. STRATÉGIE GLOBALE
Une approche en 1-2 phrases qui résume CE QUE l'étudiant doit faire globalement.
Exemples selon le contexte:
- Urgence critique: "Mode survie - focus exclusif sur les 20% qui rapportent 80% des points"
- Urgence haute: "Sprint final - consolidation des acquis + révision ciblée des points faibles"
- Normal: "Progression méthodique - approfondir puis réviser en cycles"

#### 2. FOCUS PRIORITAIRE (3-5 éléments)
Les 3-5 choses sur lesquelles se concentrer EN PRIORITÉ. Classées par importance.

#### 3. MÉTHODES RECOMMANDÉES
2-3 techniques d'étude adaptées au style d'apprentissage détecté.
Pour chaque méthode: POURQUOI elle convient à ce profil + COMMENT l'appliquer concrètement.

#### 4. PLANNING OPÉRATIONNEL
- **Aujourd'hui**: Action(s) spécifique(s) pour les prochaines 24h
- **Cette semaine**: Objectifs clairs pour les 7 prochains jours
- **D'ici l'examen**: Vision globale du chemin restant

#### 5. MESSAGE DE MOTIVATION
Un message PERSONNALISÉ (pas générique!) basé sur:
- La progression actuelle (si bonne → encourager, si en retard → remotiver)
- Le temps restant (réaliste mais positif)
- Les forces identifiées

## FORMAT DE RÉPONSE (JSON STRICT)
```json
{{
  "strategie_globale": "La stratégie en 1-2 phrases percutantes",
  "niveau_urgence": "{urgency_level}",
  "focus_prioritaire": [
    {{
      "priorite": 1,
      "element": "Description du focus",
      "pourquoi": "Justification stratégique"
    }}
  ],
  "methodes_recommandees": [
    {{
      "methode": "Nom de la technique",
      "adapte_car": "Pourquoi ça convient à ce profil",
      "comment_faire": "Instructions pratiques en 2-3 étapes",
      "duree_session": "Durée recommandée par session"
    }}
  ],
  "planning_suggere": {{
    "aujourd_hui": ["Action 1", "Action 2"],
    "cette_semaine": ["Objectif 1", "Objectif 2", "Objectif 3"],
    "avant_examen": "Vision globale du plan jusqu'à l'examen"
  }},
  "message_motivation": "Message personnalisé et authentique",
  "conseils_specifiques": [
    "Conseil actionnable 1 basé sur le profil",
    "Conseil actionnable 2 basé sur le profil",
    "Conseil actionnable 3 basé sur le profil"
  ],
  "alerte": "Avertissement si quelque chose est préoccupant (optionnel, null si tout va bien)"
}}
```

IMPORTANT: Réponds UNIQUEMENT avec le JSON valide, adapté au profil UNIQUE de cet étudiant."""

        try:
            response = await self.ai_service._call_claude(prompt, system_prompt)
            result_text = self.ai_service._clean_json_response(response)
            advice = json.loads(result_text)

            advice["context"] = {
                "days_left": days_left,
                "progress": progress,
                "learning_style": learning_style
            }

            logger.info(f"Generated personalized advice for session {session.id}")
            return advice

        except Exception as e:
            logger.error(f"Error generating advice: {e}")
            return {
                "error": str(e),
                "strategie_globale": "Continuez à suivre votre plan d'étude",
                "focus_prioritaire": weak_points if weak_points else ["Révision générale"],
                "message_motivation": "Vous faites du bon travail! Gardez le rythme!"
            }

    def _deduce_learning_style(self, tasks: List[StudyTask]) -> str:
        """Déduit le style d'apprentissage basé sur les performances"""

        if not tasks:
            return "non_determine"

        type_scores = {}
        for task in tasks:
            if task.achieved_score:
                t_type = task.task_type.value
                if t_type not in type_scores:
                    type_scores[t_type] = []
                type_scores[t_type].append(task.achieved_score)

        # Calculer les moyennes par type
        type_averages = {}
        for t_type, scores in type_scores.items():
            type_averages[t_type] = sum(scores) / len(scores)

        # Déterminer le style dominant
        if not type_averages:
            return "non_determine"

        best_type = max(type_averages, key=type_averages.get)

        style_mapping = {
            "quiz": "testeur",  # Apprend mieux par évaluation
            "flashcards": "memorisateur",  # Apprend par répétition
            "read": "lecteur",  # Apprend par lecture
            "summary": "synthetiseur",  # Apprend en résumant
            "practice_exam": "pratiquant"  # Apprend par la pratique
        }

        return style_mapping.get(best_type, "mixte")

    # ==================== 5. ADAPTATION DYNAMIQUE DU PLAN ====================

    async def adapt_study_plan(
        self,
        db: AsyncSession,
        session: ExamSession,
        user: User,
        lang: str = "fr"
    ) -> Dict[str, Any]:
        """
        Adapte dynamiquement le plan d'étude basé sur la progression

        Actions possibles:
        - Réallouer du temps aux points faibles
        - Ajouter des tâches de révision
        - Réduire le contenu si en retard
        - Intensifier si en avance
        """

        days_left = session.days_until_exam
        progress = session.progress_percentage
        expected_progress = (1 - days_left / max(1, session.total_days)) * 100

        # Analyser l'écart
        progress_gap = progress - expected_progress

        adaptations = []
        new_tasks = []

        # Récupérer les jours futurs
        today = utc_now().date()
        query = select(StudyDay).where(
            StudyDay.exam_session_id == session.id,
            StudyDay.study_date > today,
            StudyDay.is_completed == False
        ).order_by(StudyDay.study_date)
        result = await db.execute(query)
        future_days = list(result.scalars().all())

        if not future_days:
            return {
                "status": "no_changes",
                "message": "Pas de jours futurs à adapter",
                "adaptations": []
            }

        weak_points = session.weak_points or []

        # Cas 1: En retard (progress_gap < -15%)
        if progress_gap < -15:
            adaptations.append({
                "type": "retard",
                "action": "reduction_contenu",
                "description": "Focus sur l'essentiel - réduction du contenu secondaire"
            })

            # Marquer certains jours comme allégés
            for day in future_days[:-2]:  # Garder les derniers jours intacts
                if day.estimated_minutes > 60:
                    day.estimated_minutes = int(day.estimated_minutes * 0.7)
                    day.description = (day.description or "") + " [Allégé]"

        # Cas 2: Points faibles identifiés
        if weak_points and len(future_days) >= 2:
            adaptations.append({
                "type": "renforcement",
                "action": "ajout_revision_points_faibles",
                "description": f"Ajout de sessions sur: {', '.join(weak_points[:3])}"
            })

            # Ajouter des tâches de révision des points faibles
            for i, day in enumerate(future_days[:3]):
                task = StudyTask(
                    study_day_id=day.id,
                    user_id=user.id,
                    task_type=StudyTaskType.WEAK_POINTS,
                    order=100 + i,  # À la fin
                    title=f"Révision ciblée: {weak_points[i % len(weak_points)]}",
                    description="Session de renforcement sur les points faibles identifiés",
                    estimated_minutes=20,
                )
                db.add(task)
                new_tasks.append({
                    "day": day.day_number,
                    "task": task.title
                })
                day.tasks_total += 1

        # Cas 3: En avance (progress_gap > 20%)
        if progress_gap > 20:
            adaptations.append({
                "type": "avance",
                "action": "ajout_pratique",
                "description": "Ajout d'examens blancs supplémentaires"
            })

            # Ajouter un examen blanc
            if len(future_days) >= 3:
                middle_day = future_days[len(future_days) // 2]
                task = StudyTask(
                    study_day_id=middle_day.id,
                    user_id=user.id,
                    task_type=StudyTaskType.PRACTICE_EXAM,
                    order=50,
                    title="Examen blanc bonus",
                    description="Test supplémentaire pour consolider",
                    estimated_minutes=45,
                    target_score=85.0,
                )
                db.add(task)
                new_tasks.append({
                    "day": middle_day.day_number,
                    "task": task.title
                })
                middle_day.tasks_total += 1

        # Cas 4: Scores bas aux quiz
        if session.average_quiz_score and session.average_quiz_score < 70:
            adaptations.append({
                "type": "renforcement_quiz",
                "action": "revision_intensive",
                "description": "Sessions de révision intensive recommandées"
            })

        # Mettre à jour le total de tâches de la session
        session.tasks_total = sum(d.tasks_total for d in future_days) + session.tasks_completed

        await db.commit()

        return {
            "status": "adapted" if adaptations else "no_changes",
            "progress_analysis": {
                "current_progress": round(progress, 1),
                "expected_progress": round(expected_progress, 1),
                "gap": round(progress_gap, 1),
                "status": "en_avance" if progress_gap > 10 else "en_retard" if progress_gap < -10 else "dans_les_temps"
            },
            "adaptations": adaptations,
            "new_tasks": new_tasks,
            "days_affected": len([a for a in adaptations if a["type"] in ["retard", "renforcement"]])
        }

    # ==================== 6. GÉNÉRATION DE CONTENU POUR EXAMEN BLANC ====================

    async def generate_practice_exam(
        self,
        db: AsyncSession,
        session: ExamSession,
        user: User,
        duration_minutes: int = 60,
        lang: str = "fr"
    ) -> Optional[Quiz]:
        """
        Génère un examen blanc complet basé sur tout le contenu de la session
        """

        if not session.note_ids:
            return None

        # Récupérer toutes les notes
        query = select(Note).where(Note.id.in_(session.note_ids))
        result = await db.execute(query)
        notes = list(result.scalars().all())

        if not notes:
            return None

        # Combiner le contenu avec emphase sur les points faibles
        all_content = "\n\n".join([
            f"=== {note.title} ===\n{note.content or ''}"
            for note in notes
        ])

        weak_emphasis = ""
        if session.weak_points:
            weak_emphasis = f"\n\nPOINTS À PARTICULIÈREMENT TESTER: {', '.join(session.weak_points)}"

        # Calculer le nombre de questions basé sur la durée
        question_count = max(10, duration_minutes // 3)  # ~3 min par question

        base_system_prompt = """Tu es le Professeur Examinator, un concepteur d'examens de renommée internationale.

## TON EXPERTISE
- 25 ans d'expérience dans la conception d'examens pour des universités prestigieuses
- Expert en évaluation des compétences et taxonomie de Bloom
- Consultant pour des concours nationaux (CAPES, Agrégation, ECN, Barreau)
- Créateur de la méthode "Exam Design Excellence" utilisée dans 30+ pays

## TA PHILOSOPHIE D'ÉVALUATION
"Un bon examen ne piège pas - il RÉVÈLE le niveau de compréhension avec précision et équité."

## TES PRINCIPES DE CONCEPTION
1. **VALIDITÉ**: Chaque question teste ce qu'elle est censée tester
2. **FIABILITÉ**: Les résultats sont reproductibles et cohérents
3. **DISCRIMINATION**: Différencie clairement les niveaux de maîtrise
4. **ÉQUITÉ**: Pas de biais, formulations claires, pas de pièges linguistiques
5. **PROGRESSION**: Du plus accessible au plus exigeant

## TAXONOMIE DE BLOOM (niveaux cognitifs)
Tu utilises tous les niveaux pour une évaluation complète:
- **Connaître** (15%): Mémorisation de faits, définitions
- **Comprendre** (25%): Explication, interprétation
- **Appliquer** (25%): Utilisation dans un contexte nouveau
- **Analyser** (20%): Décomposition, comparaison
- **Évaluer** (10%): Jugement, argumentation
- **Créer** (5%): Synthèse, production originale

## TYPES DE QUESTIONS QUE TU MAÎTRISES
- QCM à réponse unique (avec distracteurs intelligents)
- QCM à réponses multiples
- Vrai/Faux avec justification obligatoire
- Questions à réponse courte (1-3 phrases)
- Questions de mise en relation
- Cas pratiques / Problèmes"""

        system_prompt = build_system_prompt_with_language(base_system_prompt, lang)

        # Déterminer la répartition selon le niveau
        if session.difficulty_level.value == "easy":
            distribution = "50% Connaître/Comprendre, 35% Appliquer, 15% Analyser"
        elif session.difficulty_level.value == "hard":
            distribution = "20% Connaître/Comprendre, 30% Appliquer, 30% Analyser, 20% Évaluer/Créer"
        else:
            distribution = "30% Connaître/Comprendre, 35% Appliquer, 25% Analyser, 10% Évaluer"

        prompt = f"""## MISSION: CRÉER UN EXAMEN BLANC PROFESSIONNEL

### Paramètres de l'examen
- **Intitulé**: {session.exam_name}
- **Durée totale**: {duration_minutes} minutes
- **Nombre de questions**: {question_count}
- **Niveau de difficulté**: {session.difficulty_level.value}
- **Distribution cognitive recommandée**: {distribution}

### Points à particulièrement évaluer (faiblesses détectées)
{weak_emphasis if weak_emphasis else "Aucune faiblesse spécifique détectée - évaluation équilibrée"}

### Contenu source à évaluer
<programme_a_evaluer>
{all_content[:12000]}
</programme_a_evaluer>

## CONSIGNES DE CONCEPTION

### 1. STRUCTURE DE L'EXAMEN
Respecte cette répartition:
- **40% QCM** (Questions à Choix Multiple)
  * 4 options (A, B, C, D)
  * UNE SEULE bonne réponse
  * Distracteurs crédibles (erreurs communes, pas absurdes)

- **30% VRAI/FAUX avec justification**
  * L'étudiant doit expliquer POURQUOI c'est vrai ou faux
  * Inclure des énoncés subtils (pas de "toujours" ou "jamais" évidents)

- **30% QUESTIONS OUVERTES COURTES**
  * Réponse attendue: 1-3 phrases ou un calcul
  * Tester la compréhension profonde, pas la mémorisation brute

### 2. PROGRESSION DE DIFFICULTÉ
- Questions 1-30%: Niveau ACCESSIBLE (tout le monde devrait réussir)
- Questions 31-70%: Niveau STANDARD (différencie les préparés des non-préparés)
- Questions 71-100%: Niveau EXIGEANT (départage les meilleurs)

### 3. QUALITÉ DES QUESTIONS

#### Pour les QCM:
```
EXEMPLE DE BON QCM:
Question: "Dans le modèle OSI, quelle couche est responsable du routage des paquets?"
A) Couche Transport
B) Couche Réseau ✓
C) Couche Liaison
D) Couche Session
→ Les distracteurs sont des vraies couches (crédibles) mais avec des fonctions différentes
```

```
EXEMPLE DE MAUVAIS QCM:
Question: "Le routage se fait à quelle couche?"
A) Couche 3 ✓
B) Je ne sais pas
C) Aucune
D) Toutes les couches
→ Options absurdes, question mal formulée
```

#### Pour les Vrai/Faux:
- Éviter les généralisations ("toujours", "jamais", "tous")
- Préférer des énoncés nuancés qui testent la compréhension

#### Pour les questions ouvertes:
- Commencer par un verbe d'action: "Expliquez...", "Calculez...", "Comparez..."
- Préciser le format attendu: "(en 2-3 phrases)" ou "(montrez votre raisonnement)"

### 4. EXPLICATIONS PÉDAGOGIQUES
Pour CHAQUE question, fournis:
- La réponse correcte
- Une explication DÉTAILLÉE de pourquoi c'est correct
- Les erreurs courantes sur ce point (si applicable)

### 5. BARÈME
- QCM: 2-3 points par question
- Vrai/Faux: 3-4 points (dont points pour la justification)
- Questions ouvertes: 5-8 points
- Total: environ 100 points

## FORMAT DE RÉPONSE (JSON STRICT)

```json
{{
  "title": "Examen blanc - {session.exam_name}",
  "duration_minutes": {duration_minutes},
  "total_points": 100,
  "difficulty_level": "{session.difficulty_level.value}",
  "instructions_candidat": "Instructions claires pour le candidat (temps, matériel autorisé, etc.)",
  "questions": [
    {{
      "numero": 1,
      "type": "multiple_choice",
      "niveau_bloom": "comprendre",
      "difficulte": "facile",
      "topic": "Sujet/chapitre évalué",
      "question": "Formulation claire et précise de la question",
      "options": ["Option A", "Option B", "Option C", "Option D"],
      "correct_answer": "A",
      "explanation": "Explication détaillée de la réponse correcte et pourquoi les autres sont incorrectes",
      "erreur_courante": "L'erreur que font souvent les étudiants sur ce point",
      "points": 3
    }},
    {{
      "numero": 2,
      "type": "true_false",
      "niveau_bloom": "analyser",
      "difficulte": "moyen",
      "topic": "Sujet évalué",
      "question": "Énoncé à évaluer comme vrai ou faux",
      "correct_answer": "Vrai",
      "expected_justification": "La justification attendue de l'étudiant",
      "explanation": "Explication complète",
      "points": 4
    }},
    {{
      "numero": 3,
      "type": "short_answer",
      "niveau_bloom": "appliquer",
      "difficulte": "difficile",
      "topic": "Sujet évalué",
      "question": "Question ouverte précise (avec consigne de format)",
      "expected_answer": "Les éléments clés attendus dans la réponse",
      "explanation": "Explication et critères de notation",
      "points": 6
    }}
  ],
  "grille_evaluation": {{
    "seuil_reussite": 50,
    "mention_bien": 70,
    "mention_tres_bien": 85
  }}
}}
```

IMPORTANT:
- Génère EXACTEMENT {question_count} questions
- Réponds UNIQUEMENT avec le JSON valide
- Assure une couverture ÉQUILIBRÉE de tout le programme
- Les questions doivent être RÉALISTES et PROFESSIONNELLES"""

        try:
            response = await self.ai_service._call_claude(prompt, system_prompt)
            result_text = self.ai_service._clean_json_response(response)
            exam_data = json.loads(result_text)

            # Créer le quiz en base
            quiz = Quiz(
                user_id=user.id,
                title=f"Examen blanc - {session.exam_name}",
                description=f"Examen blanc complet - {duration_minutes} minutes",
                subject_id=session.subject_id,
                is_ai_generated=True,
                difficulty=session.difficulty_level.value,
                time_limit_minutes=duration_minutes,
                quiz_type="exam",
                questions_data=[],
            )
            db.add(quiz)
            await db.flush()

            # Ajouter les questions
            questions_data_list = []
            for idx, q_data in enumerate(exam_data.get("questions", [])):
                q_type = q_data.get("type", "multiple_choice")
                question = QuizQuestion(
                    quiz_id=quiz.id,
                    question=q_data.get("question", ""),
                    question_type=q_type if q_type in ["multiple_choice", "true_false", "short_answer"] else "multiple_choice",
                    options=q_data.get("options", []),
                    correct_answer=str(q_data.get("correct_answer", "")),
                    explanation=q_data.get("explanation", ""),
                    points=q_data.get("points", 5),
                    order=idx + 1,
                )
                db.add(question)
                questions_data_list.append({
                    "question": q_data.get("question", ""),
                    "type": q_type if q_type in ["multiple_choice", "true_false", "short_answer"] else "multiple_choice",
                    "options": q_data.get("options", []),
                    "correct_answer": str(q_data.get("correct_answer", "")),
                    "explanation": q_data.get("explanation", ""),
                    "points": q_data.get("points", 5),
                })
            quiz.questions_data = questions_data_list

            await db.commit()
            logger.info(f"Generated practice exam {quiz.id} for session {session.id}")

            return quiz

        except Exception as e:
            logger.error(f"Error generating practice exam: {e}")
            await db.rollback()
            return None

    # ==================== 7. LIER RESSOURCES EXISTANTES ====================

    async def link_existing_resources(
        self,
        db: AsyncSession,
        task: StudyTask,
        user: User,
        lang: str = "fr"
    ) -> Dict[str, Any]:
        """
        Recherche et lie des quiz/flashcards existants à une tâche
        Si aucun n'existe, propose de générer avec IA

        Args:
            lang: Langue de l'utilisateur pour la génération IA
        """

        linked = {"quiz": None, "flashcard_deck": None, "generated": False}

        # Chercher des ressources existantes liées à la même note
        if task.note_id:
            # Chercher un quiz existant
            quiz_query = select(Quiz).where(
                Quiz.user_id == user.id,
                Quiz.source_note_id == task.note_id
            ).order_by(Quiz.created_at.desc())
            quiz_result = await db.execute(quiz_query)
            existing_quiz = quiz_result.scalar_one_or_none()

            if existing_quiz:
                task.quiz_id = existing_quiz.id
                linked["quiz"] = {
                    "id": existing_quiz.id,
                    "title": existing_quiz.title,
                    "source": "existing"
                }

            # Chercher des flashcards existantes
            deck_query = select(FlashcardDeck).where(
                FlashcardDeck.user_id == user.id,
                FlashcardDeck.note_id == task.note_id
            ).order_by(FlashcardDeck.created_at.desc())
            deck_result = await db.execute(deck_query)
            existing_deck = deck_result.scalar_one_or_none()

            if existing_deck:
                task.flashcard_deck_id = existing_deck.id
                linked["flashcard_deck"] = {
                    "id": existing_deck.id,
                    "title": existing_deck.name,
                    "source": "existing"
                }

        # Si pas de ressources existantes et tâche quiz/flashcards
        if task.task_type == StudyTaskType.QUIZ and not linked["quiz"]:
            # Générer avec IA dans la langue de l'utilisateur
            quiz = await self.generate_quiz_for_task(db, task, user, lang=lang)
            if quiz:
                linked["quiz"] = {
                    "id": quiz.id,
                    "title": quiz.title,
                    "source": "ai_generated"
                }
                linked["generated"] = True

        elif task.task_type == StudyTaskType.FLASHCARDS and not linked["flashcard_deck"]:
            deck = await self.generate_flashcards_for_task(db, task, user, lang=lang)
            if deck:
                linked["flashcard_deck"] = {
                    "id": deck.id,
                    "title": deck.name,
                    "source": "ai_generated"
                }
                linked["generated"] = True

        await db.commit()
        return linked


# Singleton
exam_mode_ai_service = ExamModeAIService()
