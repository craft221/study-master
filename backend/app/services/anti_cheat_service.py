"""
Service Anti-Triche pour Quiz et Duels
Détecte et prévient les comportements frauduleux
"""

import logging
from datetime import datetime, timedelta
from typing import Optional, List, Dict, Any
from enum import Enum
from dataclasses import dataclass
from collections import defaultdict

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, and_

from app.core.datetime_utils import utc_now
from app.services.cache_service import cache_service

logger = logging.getLogger(__name__)


class ViolationType(str, Enum):
    """Types de violations détectées"""
    # Violations de temps
    TOO_FAST_ANSWER = "too_fast_answer"  # Réponse trop rapide (< 1 seconde)
    TOO_FAST_QUIZ = "too_fast_quiz"  # Quiz terminé trop rapidement
    TIMEOUT_EXCEEDED = "timeout_exceeded"  # Temps dépassé

    # Violations de focus
    TAB_SWITCH = "tab_switch"  # Changement d'onglet
    WINDOW_BLUR = "window_blur"  # Perte de focus fenêtre
    COPY_PASTE = "copy_paste"  # Tentative de copier-coller

    # Violations de pattern
    IDENTICAL_ANSWERS = "identical_answers"  # Réponses identiques à un autre joueur
    PERFECT_SCORE_SUSPICIOUS = "perfect_score_suspicious"  # Score parfait avec timing suspect
    ANSWER_PATTERN = "answer_pattern"  # Pattern de réponse suspect (toujours A, B, C, D)

    # Violations de session
    MULTIPLE_SESSIONS = "multiple_sessions"  # Plusieurs sessions simultanées
    IP_CHANGE = "ip_change"  # Changement d'IP pendant le quiz
    DEVICE_CHANGE = "device_change"  # Changement d'appareil

    # Violations de duel
    DUEL_ABANDONMENT = "duel_abandonment"  # Abandon de duel
    SCORE_MANIPULATION = "score_manipulation"  # Tentative de manipulation de score


class SeverityLevel(str, Enum):
    """Niveaux de sévérité des violations"""
    LOW = "low"  # Avertissement, pas de pénalité
    MEDIUM = "medium"  # Pénalité légère
    HIGH = "high"  # Pénalité sévère
    CRITICAL = "critical"  # Disqualification immédiate


@dataclass
class Violation:
    """Représente une violation détectée"""
    type: ViolationType
    severity: SeverityLevel
    timestamp: datetime
    details: Dict[str, Any]
    user_id: int
    quiz_id: Optional[int] = None
    duel_id: Optional[int] = None


@dataclass
class AntiCheatResult:
    """Résultat de l'analyse anti-triche"""
    is_valid: bool
    violations: List[Violation]
    penalty_xp: int = 0
    is_disqualified: bool = False
    warning_message: Optional[str] = None
    adjusted_score: Optional[float] = None


class AntiCheatService:
    """Service de détection et prévention de triche"""

    # Seuils de détection
    MIN_ANSWER_TIME_MS = 800  # Temps minimum pour lire et répondre (ms)
    MIN_QUIZ_TIME_PER_QUESTION_S = 3  # Temps minimum par question (secondes)
    MAX_TAB_SWITCHES = 3  # Nombre max de changements d'onglet tolérés
    MAX_FOCUS_LOSSES = 5  # Nombre max de pertes de focus tolérées
    SIMILARITY_THRESHOLD = 0.85  # Seuil de similarité des réponses pour détecter la copie

    # Pénalités XP
    PENALTIES = {
        SeverityLevel.LOW: 0,
        SeverityLevel.MEDIUM: 10,
        SeverityLevel.HIGH: 50,
        SeverityLevel.CRITICAL: 100
    }

    def __init__(self):
        self._session_data: Dict[str, Dict] = {}

    async def start_session(
        self,
        user_id: int,
        quiz_id: int,
        duel_id: Optional[int] = None,
        ip_address: Optional[str] = None,
        user_agent: Optional[str] = None
    ) -> str:
        """Démarre une session de surveillance anti-triche"""
        import secrets
        session_id = secrets.token_urlsafe(16)

        session_data = {
            "user_id": user_id,
            "quiz_id": quiz_id,
            "duel_id": duel_id,
            "ip_address": ip_address,
            "user_agent": user_agent,
            "started_at": utc_now().isoformat(),
            "answers": [],
            "events": [],
            "tab_switches": 0,
            "focus_losses": 0,
            "violations": []
        }

        # Stocker dans Redis avec expiration de 2 heures
        cache_key = f"anticheat:session:{session_id}"
        await cache_service.set(cache_key, session_data, ttl=7200)

        # Vérifier les sessions multiples
        user_sessions_key = f"anticheat:user_sessions:{user_id}"
        existing_sessions = await cache_service.get(user_sessions_key) or []

        if len(existing_sessions) > 0:
            # Marquer comme session multiple potentielle
            await self._record_event(session_id, "multiple_session_warning", {
                "existing_sessions": len(existing_sessions)
            })

        existing_sessions.append(session_id)
        await cache_service.set(user_sessions_key, existing_sessions, ttl=7200)

        logger.info(f"Anti-cheat session started: {session_id} for user {user_id}")
        return session_id

    async def record_answer(
        self,
        session_id: str,
        question_id: int,
        answer_id: int,
        time_taken_ms: int,
        question_index: int
    ) -> Optional[Violation]:
        """Enregistre une réponse et vérifie les violations"""
        session = await self._get_session(session_id)
        if not session:
            return None

        answer_data = {
            "question_id": question_id,
            "answer_id": answer_id,
            "time_taken_ms": time_taken_ms,
            "question_index": question_index,
            "timestamp": utc_now().isoformat()
        }

        session["answers"].append(answer_data)
        await self._save_session(session_id, session)

        # Vérifier si la réponse est trop rapide
        if time_taken_ms < self.MIN_ANSWER_TIME_MS:
            violation = Violation(
                type=ViolationType.TOO_FAST_ANSWER,
                severity=SeverityLevel.MEDIUM,
                timestamp=utc_now(),
                details={
                    "time_taken_ms": time_taken_ms,
                    "min_expected_ms": self.MIN_ANSWER_TIME_MS,
                    "question_id": question_id
                },
                user_id=session["user_id"],
                quiz_id=session["quiz_id"],
                duel_id=session.get("duel_id")
            )
            await self._record_violation(session_id, violation)
            return violation

        return None

    async def record_event(
        self,
        session_id: str,
        event_type: str,
        details: Optional[Dict] = None
    ) -> Optional[Violation]:
        """Enregistre un événement (changement d'onglet, perte de focus, etc.)"""
        session = await self._get_session(session_id)
        if not session:
            return None

        await self._record_event(session_id, event_type, details or {})

        violation = None

        if event_type == "tab_switch":
            session["tab_switches"] = session.get("tab_switches", 0) + 1
            if session["tab_switches"] > self.MAX_TAB_SWITCHES:
                violation = Violation(
                    type=ViolationType.TAB_SWITCH,
                    severity=SeverityLevel.HIGH if session["tab_switches"] > self.MAX_TAB_SWITCHES * 2 else SeverityLevel.MEDIUM,
                    timestamp=utc_now(),
                    details={"count": session["tab_switches"]},
                    user_id=session["user_id"],
                    quiz_id=session["quiz_id"],
                    duel_id=session.get("duel_id")
                )
                await self._record_violation(session_id, violation)

        elif event_type == "window_blur":
            session["focus_losses"] = session.get("focus_losses", 0) + 1
            if session["focus_losses"] > self.MAX_FOCUS_LOSSES:
                violation = Violation(
                    type=ViolationType.WINDOW_BLUR,
                    severity=SeverityLevel.MEDIUM,
                    timestamp=utc_now(),
                    details={"count": session["focus_losses"]},
                    user_id=session["user_id"],
                    quiz_id=session["quiz_id"],
                    duel_id=session.get("duel_id")
                )
                await self._record_violation(session_id, violation)

        elif event_type == "copy_paste":
            violation = Violation(
                type=ViolationType.COPY_PASTE,
                severity=SeverityLevel.HIGH,
                timestamp=utc_now(),
                details=details or {},
                user_id=session["user_id"],
                quiz_id=session["quiz_id"],
                duel_id=session.get("duel_id")
            )
            await self._record_violation(session_id, violation)

        await self._save_session(session_id, session)
        return violation

    async def validate_quiz_completion(
        self,
        session_id: str,
        total_questions: int,
        score: float,
        total_time_seconds: int
    ) -> AntiCheatResult:
        """Valide la complétion d'un quiz et calcule les pénalités"""
        session = await self._get_session(session_id)
        if not session:
            return AntiCheatResult(
                is_valid=False,
                violations=[],
                warning_message="Session anti-triche invalide"
            )

        violations = []

        # 1. Vérifier le temps total
        min_expected_time = total_questions * self.MIN_QUIZ_TIME_PER_QUESTION_S
        if total_time_seconds < min_expected_time:
            violations.append(Violation(
                type=ViolationType.TOO_FAST_QUIZ,
                severity=SeverityLevel.HIGH,
                timestamp=utc_now(),
                details={
                    "total_time_seconds": total_time_seconds,
                    "min_expected_seconds": min_expected_time,
                    "questions_count": total_questions
                },
                user_id=session["user_id"],
                quiz_id=session["quiz_id"],
                duel_id=session.get("duel_id")
            ))

        # 2. Analyser les patterns de réponse
        answers = session.get("answers", [])
        if answers:
            # Vérifier si toutes les réponses sont trop rapides
            fast_answers = [a for a in answers if a.get("time_taken_ms", 0) < self.MIN_ANSWER_TIME_MS]
            if len(fast_answers) > len(answers) * 0.5:  # Plus de 50% des réponses trop rapides
                violations.append(Violation(
                    type=ViolationType.ANSWER_PATTERN,
                    severity=SeverityLevel.HIGH,
                    timestamp=utc_now(),
                    details={
                        "fast_answers_count": len(fast_answers),
                        "total_answers": len(answers),
                        "percentage": round(len(fast_answers) / len(answers) * 100, 1)
                    },
                    user_id=session["user_id"],
                    quiz_id=session["quiz_id"],
                    duel_id=session.get("duel_id")
                ))

        # 3. Vérifier le score parfait avec timing suspect
        if score == 100 and total_time_seconds < min_expected_time * 1.5:
            violations.append(Violation(
                type=ViolationType.PERFECT_SCORE_SUSPICIOUS,
                severity=SeverityLevel.MEDIUM,
                timestamp=utc_now(),
                details={
                    "score": score,
                    "time_seconds": total_time_seconds
                },
                user_id=session["user_id"],
                quiz_id=session["quiz_id"],
                duel_id=session.get("duel_id")
            ))

        # 4. Ajouter les violations précédemment enregistrées
        stored_violations = session.get("violations", [])
        for v_data in stored_violations:
            violations.append(Violation(
                type=ViolationType(v_data["type"]),
                severity=SeverityLevel(v_data["severity"]),
                timestamp=datetime.fromisoformat(v_data["timestamp"]),
                details=v_data["details"],
                user_id=v_data["user_id"],
                quiz_id=v_data.get("quiz_id"),
                duel_id=v_data.get("duel_id")
            ))

        # Calculer les pénalités
        total_penalty = 0
        is_disqualified = False

        for violation in violations:
            total_penalty += self.PENALTIES.get(violation.severity, 0)
            if violation.severity == SeverityLevel.CRITICAL:
                is_disqualified = True

        # Disqualifier si trop de violations graves
        high_severity_count = len([v for v in violations if v.severity in [SeverityLevel.HIGH, SeverityLevel.CRITICAL]])
        if high_severity_count >= 3:
            is_disqualified = True

        # Ajuster le score si pénalités
        adjusted_score = score
        if total_penalty > 0 and not is_disqualified:
            # Réduire le score proportionnellement aux pénalités
            penalty_factor = min(0.5, total_penalty / 100)  # Max 50% de réduction
            adjusted_score = max(0, score * (1 - penalty_factor))

        # Générer le message d'avertissement
        warning_message = None
        if violations:
            if is_disqualified:
                warning_message = "Comportement suspect détecté. Résultat invalidé."
            elif high_severity_count > 0:
                warning_message = f"Attention: {high_severity_count} comportement(s) suspect(s) détecté(s)."
            else:
                warning_message = "Quelques anomalies mineures détectées."

        # Nettoyer la session
        await self._end_session(session_id)

        logger.info(
            f"Quiz validation: user={session['user_id']}, "
            f"violations={len(violations)}, penalty={total_penalty}XP, "
            f"disqualified={is_disqualified}"
        )

        return AntiCheatResult(
            is_valid=not is_disqualified,
            violations=violations,
            penalty_xp=total_penalty,
            is_disqualified=is_disqualified,
            warning_message=warning_message,
            adjusted_score=adjusted_score
        )

    async def compare_duel_answers(
        self,
        session_id_1: str,
        session_id_2: str
    ) -> Optional[Violation]:
        """Compare les réponses de deux joueurs pour détecter la copie"""
        session_1 = await self._get_session(session_id_1)
        session_2 = await self._get_session(session_id_2)

        if not session_1 or not session_2:
            return None

        answers_1 = session_1.get("answers", [])
        answers_2 = session_2.get("answers", [])

        if not answers_1 or not answers_2:
            return None

        # Comparer les réponses
        matching = 0
        total = min(len(answers_1), len(answers_2))

        for i in range(total):
            if answers_1[i].get("answer_id") == answers_2[i].get("answer_id"):
                matching += 1

        similarity = matching / total if total > 0 else 0

        if similarity >= self.SIMILARITY_THRESHOLD:
            # Vérifier aussi les timings
            time_diffs = []
            for i in range(total):
                t1 = answers_1[i].get("time_taken_ms", 0)
                t2 = answers_2[i].get("time_taken_ms", 0)
                time_diffs.append(abs(t1 - t2))

            avg_time_diff = sum(time_diffs) / len(time_diffs) if time_diffs else 0

            # Si les timings sont aussi similaires, c'est très suspect
            if avg_time_diff < 2000:  # Moins de 2 secondes d'écart moyen
                violation = Violation(
                    type=ViolationType.IDENTICAL_ANSWERS,
                    severity=SeverityLevel.CRITICAL,
                    timestamp=utc_now(),
                    details={
                        "similarity": round(similarity * 100, 1),
                        "matching_answers": matching,
                        "total_compared": total,
                        "avg_time_diff_ms": round(avg_time_diff)
                    },
                    user_id=session_1["user_id"],
                    quiz_id=session_1["quiz_id"],
                    duel_id=session_1.get("duel_id")
                )

                await self._record_violation(session_id_1, violation)
                # Aussi pour le second joueur
                violation_2 = Violation(
                    type=ViolationType.IDENTICAL_ANSWERS,
                    severity=SeverityLevel.CRITICAL,
                    timestamp=utc_now(),
                    details=violation.details,
                    user_id=session_2["user_id"],
                    quiz_id=session_2["quiz_id"],
                    duel_id=session_2.get("duel_id")
                )
                await self._record_violation(session_id_2, violation_2)

                return violation

        return None

    async def get_user_violation_history(
        self,
        user_id: int,
        days: int = 30
    ) -> Dict[str, Any]:
        """Récupère l'historique des violations d'un utilisateur"""
        cache_key = f"anticheat:history:{user_id}"
        history = await cache_service.get(cache_key) or {
            "violations": [],
            "total_penalty_xp": 0,
            "disqualification_count": 0
        }

        return history

    async def add_to_violation_history(
        self,
        user_id: int,
        violations: List[Violation],
        penalty_xp: int,
        was_disqualified: bool
    ):
        """Ajoute des violations à l'historique de l'utilisateur"""
        cache_key = f"anticheat:history:{user_id}"
        history = await cache_service.get(cache_key) or {
            "violations": [],
            "total_penalty_xp": 0,
            "disqualification_count": 0
        }

        for v in violations:
            history["violations"].append({
                "type": v.type.value,
                "severity": v.severity.value,
                "timestamp": v.timestamp.isoformat(),
                "quiz_id": v.quiz_id,
                "duel_id": v.duel_id
            })

        history["total_penalty_xp"] += penalty_xp
        if was_disqualified:
            history["disqualification_count"] += 1

        # Garder seulement les 30 derniers jours
        cutoff = (utc_now() - timedelta(days=30)).isoformat()
        history["violations"] = [
            v for v in history["violations"]
            if v["timestamp"] > cutoff
        ]

        # Stocker pour 30 jours
        await cache_service.set(cache_key, history, ttl=86400 * 30)

    async def check_user_reputation(self, user_id: int) -> Dict[str, Any]:
        """Vérifie la réputation anti-triche d'un utilisateur"""
        history = await self.get_user_violation_history(user_id)

        violation_count = len(history.get("violations", []))
        disqualifications = history.get("disqualification_count", 0)

        # Calculer un score de confiance
        trust_score = 100
        trust_score -= violation_count * 5
        trust_score -= disqualifications * 20
        trust_score = max(0, min(100, trust_score))

        # Déterminer le niveau de risque
        if trust_score >= 80:
            risk_level = "low"
        elif trust_score >= 50:
            risk_level = "medium"
        else:
            risk_level = "high"

        return {
            "trust_score": trust_score,
            "risk_level": risk_level,
            "violation_count": violation_count,
            "disqualification_count": disqualifications,
            "should_monitor_closely": risk_level == "high"
        }

    # Méthodes privées
    async def _get_session(self, session_id: str) -> Optional[Dict]:
        """Récupère les données de session"""
        cache_key = f"anticheat:session:{session_id}"
        return await cache_service.get(cache_key)

    async def _save_session(self, session_id: str, data: Dict):
        """Sauvegarde les données de session"""
        cache_key = f"anticheat:session:{session_id}"
        await cache_service.set(cache_key, data, ttl=7200)

    async def _record_event(self, session_id: str, event_type: str, details: Dict):
        """Enregistre un événement dans la session"""
        session = await self._get_session(session_id)
        if session:
            session["events"].append({
                "type": event_type,
                "details": details,
                "timestamp": utc_now().isoformat()
            })
            await self._save_session(session_id, session)

    async def _record_violation(self, session_id: str, violation: Violation):
        """Enregistre une violation dans la session"""
        session = await self._get_session(session_id)
        if session:
            session["violations"].append({
                "type": violation.type.value,
                "severity": violation.severity.value,
                "timestamp": violation.timestamp.isoformat(),
                "details": violation.details,
                "user_id": violation.user_id,
                "quiz_id": violation.quiz_id,
                "duel_id": violation.duel_id
            })
            await self._save_session(session_id, session)

            logger.warning(
                f"Violation recorded: type={violation.type.value}, "
                f"severity={violation.severity.value}, user={violation.user_id}"
            )

    async def _end_session(self, session_id: str):
        """Termine et nettoie une session"""
        session = await self._get_session(session_id)
        if session:
            user_id = session["user_id"]

            # Retirer de la liste des sessions actives
            user_sessions_key = f"anticheat:user_sessions:{user_id}"
            sessions = await cache_service.get(user_sessions_key) or []
            if session_id in sessions:
                sessions.remove(session_id)
                await cache_service.set(user_sessions_key, sessions, ttl=7200)

            # Supprimer la session
            cache_key = f"anticheat:session:{session_id}"
            await cache_service.delete(cache_key)


# Instance singleton
anti_cheat_service = AntiCheatService()
