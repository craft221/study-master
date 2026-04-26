"""
Translation lookup helpers for gamification content.

Given a user's preferred language, returns the localized name/description
for an Achievement or a quest template (quest_type + difficulty).
Falls back to FR (the canonical source) if a translation row is missing.
"""

from typing import Iterable, Optional, Tuple, Dict

from sqlalchemy import select
from sqlalchemy.orm import Session
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.gamification import Achievement, AchievementTranslation
from app.models.daily_quest import QuestTemplateTranslation


_FALLBACK_LANG = "fr"


def get_achievement_translation(
    db: Session,
    achievement: Achievement,
    language: str,
) -> Tuple[str, str]:
    """Return (name, description) for the given achievement in `language`.
    Falls back to FR translation row, then to the achievement's own columns."""
    row = (
        db.query(AchievementTranslation)
        .filter_by(achievement_id=achievement.id, language=language)
        .first()
    )
    if row:
        return row.name, row.description

    if language != _FALLBACK_LANG:
        row = (
            db.query(AchievementTranslation)
            .filter_by(achievement_id=achievement.id, language=_FALLBACK_LANG)
            .first()
        )
        if row:
            return row.name, row.description

    # Last resort: original columns
    return achievement.name, achievement.description


def bulk_achievement_translations(
    db: Session,
    achievements: Iterable[Achievement],
    language: str,
) -> Dict[int, Tuple[str, str]]:
    """Batch lookup. Returns {achievement_id: (name, description)}."""
    ids = [a.id for a in achievements]
    if not ids:
        return {}

    rows = (
        db.query(AchievementTranslation)
        .filter(AchievementTranslation.achievement_id.in_(ids))
        .filter(AchievementTranslation.language.in_([language, _FALLBACK_LANG]))
        .all()
    )
    primary: Dict[int, Tuple[str, str]] = {}
    fallback: Dict[int, Tuple[str, str]] = {}
    for r in rows:
        if r.language == language:
            primary[r.achievement_id] = (r.name, r.description)
        elif r.language == _FALLBACK_LANG:
            fallback[r.achievement_id] = (r.name, r.description)

    result: Dict[int, Tuple[str, str]] = {}
    for ach in achievements:
        if ach.id in primary:
            result[ach.id] = primary[ach.id]
        elif ach.id in fallback:
            result[ach.id] = fallback[ach.id]
        else:
            result[ach.id] = (ach.name, ach.description)
    return result


def get_quest_template_translation(
    db: Session,
    quest_type: str,
    difficulty: str,
    language: str,
) -> Optional[Tuple[str, str]]:
    """Return (title, description_template) for a quest template, or None.
    description_template may contain a `{target}` placeholder."""
    row = (
        db.query(QuestTemplateTranslation)
        .filter_by(quest_type=quest_type, difficulty=difficulty, language=language)
        .first()
    )
    if row:
        return row.title, row.description

    if language != _FALLBACK_LANG:
        row = (
            db.query(QuestTemplateTranslation)
            .filter_by(
                quest_type=quest_type,
                difficulty=difficulty,
                language=_FALLBACK_LANG,
            )
            .first()
        )
        if row:
            return row.title, row.description

    return None


# ----- Async variants (for FastAPI endpoints using AsyncSession) -----


async def async_bulk_achievement_translations(
    db: AsyncSession,
    achievement_ids: Iterable[int],
    language: str,
) -> Dict[int, Tuple[str, str]]:
    """Async batch lookup. Returns {achievement_id: (name, description)}.
    Falls back to FR per achievement if the requested language row is missing."""
    ids = list(achievement_ids)
    if not ids:
        return {}

    result = await db.execute(
        select(AchievementTranslation)
        .where(AchievementTranslation.achievement_id.in_(ids))
        .where(AchievementTranslation.language.in_([language, _FALLBACK_LANG]))
    )
    rows = result.scalars().all()

    primary: Dict[int, Tuple[str, str]] = {}
    fallback: Dict[int, Tuple[str, str]] = {}
    for r in rows:
        if r.language == language:
            primary[r.achievement_id] = (r.name, r.description)
        elif r.language == _FALLBACK_LANG:
            fallback[r.achievement_id] = (r.name, r.description)

    out: Dict[int, Tuple[str, str]] = {}
    for aid in ids:
        if aid in primary:
            out[aid] = primary[aid]
        elif aid in fallback:
            out[aid] = fallback[aid]
    return out


async def async_get_quest_template_translation(
    db: AsyncSession,
    quest_type: str,
    difficulty: str,
    language: str,
) -> Optional[Tuple[str, str]]:
    """Async variant for quest templates."""
    result = await db.execute(
        select(QuestTemplateTranslation).where(
            QuestTemplateTranslation.quest_type == quest_type,
            QuestTemplateTranslation.difficulty == difficulty,
            QuestTemplateTranslation.language == language,
        )
    )
    row = result.scalar_one_or_none()
    if row:
        return row.title, row.description

    if language != _FALLBACK_LANG:
        result = await db.execute(
            select(QuestTemplateTranslation).where(
                QuestTemplateTranslation.quest_type == quest_type,
                QuestTemplateTranslation.difficulty == difficulty,
                QuestTemplateTranslation.language == _FALLBACK_LANG,
            )
        )
        row = result.scalar_one_or_none()
        if row:
            return row.title, row.description
    return None
