"""
Tâches asynchrones pour l'IA (Claude, OpenAI)
"""
from celery import Task
from app.celery_app import celery_app
from typing import Dict, List, Any
import anthropic
import openai
from app.core.config import settings


class AITask(Task):
    """Classe de base pour les tâches IA avec retry automatique"""
    autoretry_for = (Exception,)
    retry_kwargs = {"max_retries": 3}
    retry_backoff = True


@celery_app.task(base=AITask, bind=True, name="app.tasks.ai_tasks.generate_quiz_from_content")
def generate_quiz_from_content(
    self, 
    content: str, 
    subject: str, 
    difficulty: str = "medium",
    num_questions: int = 10
) -> Dict[str, Any]:
    """
    Génère un quiz à partir d'un contenu avec Claude
    
    Args:
        content: Contenu à analyser
        subject: Matière/sujet
        difficulty: Difficulté (easy, medium, hard)
        num_questions: Nombre de questions
    
    Returns:
        Dict avec les questions générées
    """
    try:
        client = anthropic.Anthropic(api_key=settings.ANTHROPIC_API_KEY)
        
        prompt = f"""Tu es un professeur expert. Génère {num_questions} questions de quiz 
de niveau {difficulty} basées sur ce contenu de {subject}:

{content}

Format JSON requis:
{{
    "questions": [
        {{
            "question": "Question ici?",
            "options": ["A", "B", "C", "D"],
            "correct_answer": 0,
            "explanation": "Explication de la réponse",
            "difficulty": "{difficulty}",
            "points": 10
        }}
    ]
}}"""

        message = client.messages.create(
            model=settings.AI_MODEL_CLAUDE,
            max_tokens=settings.AI_MAX_TOKENS,
            temperature=settings.AI_TEMPERATURE,
            messages=[{"role": "user", "content": prompt}]
        )
        
        import json
        result = json.loads(message.content[0].text)
        
        return {
            "success": True,
            "questions": result.get("questions", []),
            "total_questions": len(result.get("questions", [])),
            "task_id": self.request.id
        }
        
    except Exception as e:
        return {
            "success": False,
            "error": str(e),
            "task_id": self.request.id
        }


@celery_app.task(base=AITask, bind=True, name="app.tasks.ai_tasks.generate_flashcards_from_content")
def generate_flashcards_from_content(
    self,
    content: str,
    subject: str,
    num_flashcards: int = 20
) -> Dict[str, Any]:
    """
    Génère des flashcards à partir d'un contenu
    
    Args:
        content: Contenu à analyser
        subject: Matière/sujet
        num_flashcards: Nombre de flashcards
    
    Returns:
        Dict avec les flashcards générées
    """
    try:
        client = anthropic.Anthropic(api_key=settings.ANTHROPIC_API_KEY)
        
        prompt = f"""Tu es un professeur expert. Génère {num_flashcards} flashcards 
pour réviser ce contenu de {subject}:

{content}

Format JSON requis:
{{
    "flashcards": [
        {{
            "front": "Question/Concept",
            "back": "Réponse/Explication",
            "hint": "Indice optionnel",
            "difficulty": "easy|medium|hard"
        }}
    ]
}}"""

        message = client.messages.create(
            model=settings.AI_MODEL_CLAUDE,
            max_tokens=settings.AI_MAX_TOKENS,
            temperature=settings.AI_TEMPERATURE,
            messages=[{"role": "user", "content": prompt}]
        )
        
        import json
        result = json.loads(message.content[0].text)
        
        return {
            "success": True,
            "flashcards": result.get("flashcards", []),
            "total_flashcards": len(result.get("flashcards", [])),
            "task_id": self.request.id
        }
        
    except Exception as e:
        return {
            "success": False,
            "error": str(e),
            "task_id": self.request.id
        }


@celery_app.task(base=AITask, bind=True, name="app.tasks.ai_tasks.summarize_content")
def summarize_content(
    self,
    content: str,
    max_length: int = 500
) -> Dict[str, Any]:
    """
    Résume un contenu avec l'IA
    
    Args:
        content: Contenu à résumer
        max_length: Longueur maximale du résumé
    
    Returns:
        Dict avec le résumé
    """
    try:
        client = anthropic.Anthropic(api_key=settings.ANTHROPIC_API_KEY)
        
        prompt = f"""Résume ce contenu en maximum {max_length} mots. 
Sois clair, concis et garde les points essentiels:

{content}"""

        message = client.messages.create(
            model=settings.AI_MODEL_CLAUDE,
            max_tokens=max_length * 2,
            temperature=0.5,
            messages=[{"role": "user", "content": prompt}]
        )
        
        return {
            "success": True,
            "summary": message.content[0].text,
            "task_id": self.request.id
        }
        
    except Exception as e:
        return {
            "success": False,
            "error": str(e),
            "task_id": self.request.id
        }


@celery_app.task(base=AITask, bind=True, name="app.tasks.ai_tasks.analyze_study_progress")
def analyze_study_progress(
    self,
    user_id: int,
    subject_id: int,
    notes_content: List[str],
    quiz_results: List[Dict]
) -> Dict[str, Any]:
    """
    Analyse les progrès d'apprentissage avec l'IA
    
    Args:
        user_id: ID utilisateur
        subject_id: ID matière
        notes_content: Contenus des notes
        quiz_results: Résultats des quiz
    
    Returns:
        Dict avec l'analyse et recommandations
    """
    try:
        client = anthropic.Anthropic(api_key=settings.ANTHROPIC_API_KEY)
        
        prompt = f"""Analyse les progrès d'apprentissage de cet étudiant:

Notes prises: {len(notes_content)} notes
Résultats quiz: {len(quiz_results)} quiz passés
Scores moyens: {sum(q.get('score', 0) for q in quiz_results) / len(quiz_results) if quiz_results else 0}%

Fournis:
1. Points forts (3-5 items)
2. Points faibles (3-5 items)
3. Recommandations d'étude (5-7 items)
4. Prochaines étapes

Format JSON."""

        message = client.messages.create(
            model=settings.AI_MODEL_CLAUDE,
            max_tokens=2000,
            temperature=0.7,
            messages=[{"role": "user", "content": prompt}]
        )
        
        import json
        result = json.loads(message.content[0].text)
        
        return {
            "success": True,
            "analysis": result,
            "task_id": self.request.id
        }
        
    except Exception as e:
        return {
            "success": False,
            "error": str(e),
            "task_id": self.request.id
        }
