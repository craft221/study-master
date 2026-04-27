"""
Seed achievement_translations and quest_template_translations.

Idempotent: re-running this script upserts (achievement_id, language) and
(quest_type, difficulty, language) rows. Safe to run multiple times.

Usage:
    cd backend
    python seed_translations.py            # interactive
    python seed_translations.py --no-prompt
"""

import sys
from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker

from app.core.config import settings
from app.models.gamification import Achievement, AchievementTranslation
from app.models.daily_quest import (
    QuestTemplateTranslation,
    QuestType,
    QuestDifficulty,
)


# Map of FR achievement name -> {fr, en, es, ar} translation tuple
# Source: seed_achievements.py (FR is canonical here)
ACHIEVEMENT_TRANSLATIONS = {
    "Première Note": {
        "fr": ("Première Note", "Crée ta première note"),
        "en": ("First Note", "Create your first note"),
        "es": ("Primera Nota", "Crea tu primera nota"),
        "ar": ("أول ملاحظة", "أنشئ أول ملاحظة لك"),
    },
    "Écrivain Amateur": {
        "fr": ("Écrivain Amateur", "Crée 10 notes"),
        "en": ("Amateur Writer", "Create 10 notes"),
        "es": ("Escritor Amateur", "Crea 10 notas"),
        "ar": ("كاتب هاوٍ", "أنشئ 10 ملاحظات"),
    },
    "Écrivain Confirmé": {
        "fr": ("Écrivain Confirmé", "Crée 50 notes"),
        "en": ("Established Writer", "Create 50 notes"),
        "es": ("Escritor Consolidado", "Crea 50 notas"),
        "ar": ("كاتب متمرس", "أنشئ 50 ملاحظة"),
    },
    "Écrivain Expert": {
        "fr": ("Écrivain Expert", "Crée 100 notes"),
        "en": ("Expert Writer", "Create 100 notes"),
        "es": ("Escritor Experto", "Crea 100 notas"),
        "ar": ("كاتب خبير", "أنشئ 100 ملاحظة"),
    },
    "Bibliothécaire Légendaire": {
        "fr": ("Bibliothécaire Légendaire", "Crée 500 notes"),
        "en": ("Legendary Librarian", "Create 500 notes"),
        "es": ("Bibliotecario Legendario", "Crea 500 notas"),
        "ar": ("أمين مكتبة أسطوري", "أنشئ 500 ملاحظة"),
    },
    "Première Flashcard": {
        "fr": ("Première Flashcard", "Crée ta première flashcard"),
        "en": ("First Flashcard", "Create your first flashcard"),
        "es": ("Primera Flashcard", "Crea tu primera flashcard"),
        "ar": ("أول بطاقة", "أنشئ أول بطاقة لك"),
    },
    "Collectionneur de Cartes": {
        "fr": ("Collectionneur de Cartes", "Crée 25 flashcards"),
        "en": ("Card Collector", "Create 25 flashcards"),
        "es": ("Coleccionista de Cartas", "Crea 25 flashcards"),
        "ar": ("جامع البطاقات", "أنشئ 25 بطاقة"),
    },
    "Maître des Flashcards": {
        "fr": ("Maître des Flashcards", "Crée 100 flashcards"),
        "en": ("Flashcard Master", "Create 100 flashcards"),
        "es": ("Maestro de Flashcards", "Crea 100 flashcards"),
        "ar": ("سيد البطاقات", "أنشئ 100 بطاقة"),
    },
    "Légende des Flashcards": {
        "fr": ("Légende des Flashcards", "Crée 500 flashcards"),
        "en": ("Flashcard Legend", "Create 500 flashcards"),
        "es": ("Leyenda de las Flashcards", "Crea 500 flashcards"),
        "ar": ("أسطورة البطاقات", "أنشئ 500 بطاقة"),
    },
    "Premier Quiz": {
        "fr": ("Premier Quiz", "Complète ton premier quiz"),
        "en": ("First Quiz", "Complete your first quiz"),
        "es": ("Primer Cuestionario", "Completa tu primer cuestionario"),
        "ar": ("أول اختبار", "أكمل أول اختبار لك"),
    },
    "Amateur de Quiz": {
        "fr": ("Amateur de Quiz", "Complète 10 quiz"),
        "en": ("Quiz Enthusiast", "Complete 10 quizzes"),
        "es": ("Aficionado a los Cuestionarios", "Completa 10 cuestionarios"),
        "ar": ("هاوي الاختبارات", "أكمل 10 اختبارات"),
    },
    "Expert en Quiz": {
        "fr": ("Expert en Quiz", "Complète 50 quiz"),
        "en": ("Quiz Expert", "Complete 50 quizzes"),
        "es": ("Experto en Cuestionarios", "Completa 50 cuestionarios"),
        "ar": ("خبير الاختبارات", "أكمل 50 اختبارًا"),
    },
    "Maître des Quiz": {
        "fr": ("Maître des Quiz", "Complète 100 quiz"),
        "en": ("Quiz Master", "Complete 100 quizzes"),
        "es": ("Maestro de Cuestionarios", "Completa 100 cuestionarios"),
        "ar": ("سيد الاختبارات", "أكمل 100 اختبار"),
    },
    "Premier Jour": {
        "fr": ("Premier Jour", "Connecte-toi 1 jour de suite"),
        "en": ("First Day", "Log in 1 day in a row"),
        "es": ("Primer Día", "Inicia sesión 1 día seguido"),
        "ar": ("اليوم الأول", "سجل دخولك ليوم متتالٍ"),
    },
    "Semaine de Feu": {
        "fr": ("Semaine de Feu", "Connecte-toi 7 jours d'affilée"),
        "en": ("Week of Fire", "Log in 7 days in a row"),
        "es": ("Semana de Fuego", "Inicia sesión 7 días seguidos"),
        "ar": ("أسبوع من اللهب", "سجل دخولك 7 أيام متتالية"),
    },
    "Deux Semaines Intenses": {
        "fr": ("Deux Semaines Intenses", "Connecte-toi 14 jours d'affilée"),
        "en": ("Two Intense Weeks", "Log in 14 days in a row"),
        "es": ("Dos Semanas Intensas", "Inicia sesión 14 días seguidos"),
        "ar": ("أسبوعان مكثفان", "سجل دخولك 14 يومًا متتاليًا"),
    },
    "Mois de Détermination": {
        "fr": ("Mois de Détermination", "Connecte-toi 30 jours d'affilée"),
        "en": ("Month of Determination", "Log in 30 days in a row"),
        "es": ("Mes de Determinación", "Inicia sesión 30 días seguidos"),
        "ar": ("شهر من العزيمة", "سجل دخولك 30 يومًا متتاليًا"),
    },
    "Engagement Trimestriel": {
        "fr": ("Engagement Trimestriel", "Connecte-toi 90 jours d'affilée"),
        "en": ("Quarterly Commitment", "Log in 90 days in a row"),
        "es": ("Compromiso Trimestral", "Inicia sesión 90 días seguidos"),
        "ar": ("التزام ربع سنوي", "سجل دخولك 90 يومًا متتاليًا"),
    },
    "Année de Persévérance": {
        "fr": ("Année de Persévérance", "Connecte-toi 365 jours d'affilée"),
        "en": ("Year of Perseverance", "Log in 365 days in a row"),
        "es": ("Año de Perseverancia", "Inicia sesión 365 días seguidos"),
        "ar": ("عام من المثابرة", "سجل دخولك 365 يومًا متتاليًا"),
    },
    "Score Parfait": {
        "fr": ("Score Parfait", "Obtiens 100% à un quiz"),
        "en": ("Perfect Score", "Get 100% on a quiz"),
        "es": ("Puntuación Perfecta", "Obtén 100% en un cuestionario"),
        "ar": ("نتيجة مثالية", "احصل على 100% في اختبار"),
    },
    "Perfectionniste": {
        "fr": ("Perfectionniste", "Obtiens 100% à 10 quiz"),
        "en": ("Perfectionist", "Get 100% on 10 quizzes"),
        "es": ("Perfeccionista", "Obtén 100% en 10 cuestionarios"),
        "ar": ("ساعٍ للكمال", "احصل على 100% في 10 اختبارات"),
    },
    "Sans Faute": {
        "fr": ("Sans Faute", "Obtiens 100% à 50 quiz"),
        "en": ("Flawless", "Get 100% on 50 quizzes"),
        "es": ("Sin Errores", "Obtén 100% en 50 cuestionarios"),
        "ar": ("بلا أخطاء", "احصل على 100% في 50 اختبارًا"),
    },
    "Niveau 5": {
        "fr": ("Niveau 5", "Atteins le niveau 5"),
        "en": ("Level 5", "Reach level 5"),
        "es": ("Nivel 5", "Alcanza el nivel 5"),
        "ar": ("المستوى 5", "صل إلى المستوى 5"),
    },
    "Niveau 10": {
        "fr": ("Niveau 10", "Atteins le niveau 10"),
        "en": ("Level 10", "Reach level 10"),
        "es": ("Nivel 10", "Alcanza el nivel 10"),
        "ar": ("المستوى 10", "صل إلى المستوى 10"),
    },
    "Niveau 25": {
        "fr": ("Niveau 25", "Atteins le niveau 25"),
        "en": ("Level 25", "Reach level 25"),
        "es": ("Nivel 25", "Alcanza el nivel 25"),
        "ar": ("المستوى 25", "صل إلى المستوى 25"),
    },
    "Niveau 50": {
        "fr": ("Niveau 50", "Atteins le niveau 50"),
        "en": ("Level 50", "Reach level 50"),
        "es": ("Nivel 50", "Alcanza el nivel 50"),
        "ar": ("المستوى 50", "صل إلى المستوى 50"),
    },
    "1000 XP": {
        "fr": ("1000 XP", "Accumule 1000 XP"),
        "en": ("1,000 XP", "Earn 1,000 XP"),
        "es": ("1000 XP", "Acumula 1000 XP"),
        "ar": ("1000 نقطة خبرة", "اجمع 1000 نقطة خبرة"),
    },
    "10 000 XP": {
        "fr": ("10 000 XP", "Accumule 10 000 XP"),
        "en": ("10,000 XP", "Earn 10,000 XP"),
        "es": ("10 000 XP", "Acumula 10 000 XP"),
        "ar": ("10000 نقطة خبرة", "اجمع 10000 نقطة خبرة"),
    },
    "100 000 XP": {
        "fr": ("100 000 XP", "Accumule 100 000 XP"),
        "en": ("100,000 XP", "Earn 100,000 XP"),
        "es": ("100 000 XP", "Acumula 100 000 XP"),
        "ar": ("100000 نقطة خبرة", "اجمع 100000 نقطة خبرة"),
    },
    "Premier Duel": {
        "fr": ("Premier Duel", "Participe à ton premier duel"),
        "en": ("First Duel", "Take part in your first duel"),
        "es": ("Primer Duelo", "Participa en tu primer duelo"),
        "ar": ("أول مبارزة", "شارك في أول مبارزة لك"),
    },
    "Duelliste": {
        "fr": ("Duelliste", "Participe à 10 duels"),
        "en": ("Duelist", "Take part in 10 duels"),
        "es": ("Duelista", "Participa en 10 duelos"),
        "ar": ("مبارز", "شارك في 10 مبارزات"),
    },
    "Champion de Duels": {
        "fr": ("Champion de Duels", "Gagne 25 duels"),
        "en": ("Duel Champion", "Win 25 duels"),
        "es": ("Campeón de Duelos", "Gana 25 duelos"),
        "ar": ("بطل المبارزات", "اربح 25 مبارزة"),
    },
    "Légende des Duels": {
        "fr": ("Légende des Duels", "Gagne 100 duels"),
        "en": ("Duel Legend", "Win 100 duels"),
        "es": ("Leyenda de los Duelos", "Gana 100 duelos"),
        "ar": ("أسطورة المبارزات", "اربح 100 مبارزة"),
    },
    "Première Victoire": {
        "fr": ("Première Victoire", "Gagne ton premier duel"),
        "en": ("First Victory", "Win your first duel"),
        "es": ("Primera Victoria", "Gana tu primer duelo"),
        "ar": ("أول انتصار", "اربح أول مبارزة لك"),
    },
    "Bienvenue!": {
        "fr": ("Bienvenue!", "Crée ton compte Studera"),
        "en": ("Welcome!", "Create your Studera account"),
        "es": ("¡Bienvenido!", "Crea tu cuenta Studera"),
        "ar": ("مرحبًا!", "أنشئ حسابك على Studera"),
    },
    "Import PDF": {
        "fr": ("Import PDF", "Importe ton premier PDF"),
        "en": ("PDF Import", "Import your first PDF"),
        "es": ("Importar PDF", "Importa tu primer PDF"),
        "ar": ("استيراد PDF", "استورد أول ملف PDF لك"),
    },
    "Scanner Pro": {
        "fr": ("Scanner Pro", "Importe 10 PDFs"),
        "en": ("Pro Scanner", "Import 10 PDFs"),
        "es": ("Escáner Pro", "Importa 10 PDF"),
        "ar": ("ماسح ضوئي محترف", "استورد 10 ملفات PDF"),
    },
    "Explorateur": {
        "fr": ("Explorateur", "Visite 10 sections différentes"),
        "en": ("Explorer", "Visit 10 different sections"),
        "es": ("Explorador", "Visita 10 secciones diferentes"),
        "ar": ("مستكشف", "زر 10 أقسام مختلفة"),
    },
    "Quête Journalière": {
        "fr": ("Quête Journalière", "Complète ta première quête journalière"),
        "en": ("Daily Quest", "Complete your first daily quest"),
        "es": ("Misión Diaria", "Completa tu primera misión diaria"),
        "ar": ("مهمة يومية", "أكمل أول مهمة يومية لك"),
    },
    "Quêteur Assidu": {
        "fr": ("Quêteur Assidu", "Complète 30 quêtes journalières"),
        "en": ("Diligent Quester", "Complete 30 daily quests"),
        "es": ("Buscador Diligente", "Completa 30 misiones diarias"),
        "ar": ("ساعٍ مجتهد", "أكمل 30 مهمة يومية"),
    },
    "Maître des Quêtes": {
        "fr": ("Maître des Quêtes", "Complète 100 quêtes journalières"),
        "en": ("Quest Master", "Complete 100 daily quests"),
        "es": ("Maestro de Misiones", "Completa 100 misiones diarias"),
        "ar": ("سيد المهام", "أكمل 100 مهمة يومية"),
    },
    "Session d'Étude": {
        "fr": ("Session d'Étude", "Étudie pendant 60 minutes"),
        "en": ("Study Session", "Study for 60 minutes"),
        "es": ("Sesión de Estudio", "Estudia durante 60 minutos"),
        "ar": ("جلسة دراسة", "ادرس لمدة 60 دقيقة"),
    },
    "Étudiant Dévoué": {
        "fr": ("Étudiant Dévoué", "Étudie pendant 600 minutes"),
        "en": ("Dedicated Student", "Study for 600 minutes"),
        "es": ("Estudiante Dedicado", "Estudia durante 600 minutos"),
        "ar": ("طالب مخلص", "ادرس لمدة 600 دقيقة"),
    },
    "Scholar": {
        "fr": ("Scholar", "Étudie pendant 6000 minutes"),
        "en": ("Scholar", "Study for 6,000 minutes"),
        "es": ("Erudito", "Estudia durante 6000 minutos"),
        "ar": ("عالم", "ادرس لمدة 6000 دقيقة"),
    },
}


# Quest template translations: keyed by (quest_type.value, difficulty.value)
# Each value: {fr: (title, description), en: (...), es: (...), ar: (...)}
# Source: backend/app/models/daily_quest.py QUEST_CONFIG
QUEST_TEMPLATE_TRANSLATIONS = {
    # ----- EASY -----
    ("review_flashcards", "easy"): {
        "fr": ("Révision rapide", "Révise {target} flashcards"),
        "en": ("Quick Review", "Review {target} flashcards"),
        "es": ("Repaso rápido", "Repasa {target} flashcards"),
        "ar": ("مراجعة سريعة", "راجع {target} بطاقة"),
    },
    ("study_minutes", "easy"): {
        "fr": ("Mini session", "Étudie pendant {target} minutes"),
        "en": ("Mini Session", "Study for {target} minutes"),
        "es": ("Mini sesión", "Estudia durante {target} minutos"),
        "ar": ("جلسة قصيرة", "ادرس لمدة {target} دقيقة"),
    },
    ("earn_xp", "easy"): {
        "fr": ("Gagne de l'XP", "Gagne {target} XP aujourd'hui"),
        "en": ("Earn XP", "Earn {target} XP today"),
        "es": ("Gana XP", "Gana {target} XP hoy"),
        "ar": ("اكسب نقاط الخبرة", "اكسب {target} نقطة خبرة اليوم"),
    },
    ("maintain_streak", "easy"): {
        "fr": ("Garde la flamme", "Maintiens ton streak {target} jour"),
        "en": ("Keep the Flame", "Keep your streak going {target} day"),
        "es": ("Mantén la llama", "Mantén tu racha {target} día"),
        "ar": ("حافظ على الشعلة", "حافظ على سلسلتك {target} يوم"),
    },
    # ----- MEDIUM -----
    ("review_flashcards", "medium"): {
        "fr": ("Session de révision", "Révise {target} flashcards"),
        "en": ("Review Session", "Review {target} flashcards"),
        "es": ("Sesión de repaso", "Repasa {target} flashcards"),
        "ar": ("جلسة مراجعة", "راجع {target} بطاقة"),
    },
    ("complete_quiz", "medium"): {
        "fr": ("Quiz time", "Complète {target} quiz"),
        "en": ("Quiz Time", "Complete {target} quiz"),
        "es": ("Hora del cuestionario", "Completa {target} cuestionario"),
        "ar": ("وقت الاختبار", "أكمل {target} اختبار"),
    },
    ("study_minutes", "medium"): {
        "fr": ("Focus session", "Étudie pendant {target} minutes"),
        "en": ("Focus Session", "Study for {target} minutes"),
        "es": ("Sesión de concentración", "Estudia durante {target} minutos"),
        "ar": ("جلسة تركيز", "ادرس لمدة {target} دقيقة"),
    },
    ("create_notes", "medium"): {
        "fr": ("Prends des notes", "Crée {target} notes"),
        "en": ("Take Notes", "Create {target} notes"),
        "es": ("Toma notas", "Crea {target} notas"),
        "ar": ("دوّن ملاحظاتك", "أنشئ {target} ملاحظة"),
    },
    ("join_focus_room", "medium"): {
        "fr": ("Étudie en groupe", "Rejoins {target} Focus Room"),
        "en": ("Study Together", "Join {target} Focus Room"),
        "es": ("Estudia en grupo", "Únete a {target} Focus Room"),
        "ar": ("ادرس مع الآخرين", "انضم إلى {target} غرفة تركيز"),
    },
    # ----- HARD -----
    ("review_flashcards", "hard"): {
        "fr": ("Maître des cartes", "Révise {target} flashcards"),
        "en": ("Card Master", "Review {target} flashcards"),
        "es": ("Maestro de las cartas", "Repasa {target} flashcards"),
        "ar": ("سيد البطاقات", "راجع {target} بطاقة"),
    },
    ("perfect_quiz", "hard"): {
        "fr": ("Score parfait", "Obtiens 100% à {target} quiz"),
        "en": ("Perfect Score", "Get 100% on {target} quiz"),
        "es": ("Puntuación perfecta", "Obtén 100% en {target} cuestionario"),
        "ar": ("نتيجة مثالية", "احصل على 100% في {target} اختبار"),
    },
    ("win_duel", "hard"): {
        "fr": ("Champion", "Gagne {target} duel"),
        "en": ("Champion", "Win {target} duel"),
        "es": ("Campeón", "Gana {target} duelo"),
        "ar": ("بطل", "اربح {target} مبارزة"),
    },
    ("study_minutes", "hard"): {
        "fr": ("Marathon d'étude", "Étudie pendant {target} minutes"),
        "en": ("Study Marathon", "Study for {target} minutes"),
        "es": ("Maratón de estudio", "Estudia durante {target} minutos"),
        "ar": ("ماراثون دراسة", "ادرس لمدة {target} دقيقة"),
    },
    ("earn_xp", "hard"): {
        "fr": ("XP Hunter", "Gagne {target} XP"),
        "en": ("XP Hunter", "Earn {target} XP"),
        "es": ("Cazador de XP", "Gana {target} XP"),
        "ar": ("صياد نقاط الخبرة", "اكسب {target} نقطة خبرة"),
    },
}


def upsert_achievement_translations(db: Session) -> int:
    count = 0
    achievements = db.query(Achievement).all()
    for ach in achievements:
        translations = ACHIEVEMENT_TRANSLATIONS.get(ach.name)
        if not translations:
            print(f"  [warn] No translation entry for achievement: {ach.name!r}")
            continue
        for lang, (name, desc) in translations.items():
            existing = (
                db.query(AchievementTranslation)
                .filter_by(achievement_id=ach.id, language=lang)
                .first()
            )
            if existing:
                existing.name = name
                existing.description = desc
            else:
                db.add(
                    AchievementTranslation(
                        achievement_id=ach.id,
                        language=lang,
                        name=name,
                        description=desc,
                    )
                )
                count += 1
    db.commit()
    return count


def upsert_quest_template_translations(db: Session) -> int:
    count = 0
    for (qtype, diff), translations in QUEST_TEMPLATE_TRANSLATIONS.items():
        for lang, (title, desc) in translations.items():
            existing = (
                db.query(QuestTemplateTranslation)
                .filter_by(quest_type=qtype, difficulty=diff, language=lang)
                .first()
            )
            if existing:
                existing.title = title
                existing.description = desc
            else:
                db.add(
                    QuestTemplateTranslation(
                        quest_type=qtype,
                        difficulty=diff,
                        language=lang,
                        title=title,
                        description=desc,
                    )
                )
                count += 1
    db.commit()
    return count


def main(prompt: bool = True) -> None:
    if prompt:
        print("\nThis will seed/upsert translation tables for:")
        print(f"  - {len(ACHIEVEMENT_TRANSLATIONS)} achievement names × 4 languages")
        print(
            f"  - {len(QUEST_TEMPLATE_TRANSLATIONS)} quest templates × 4 languages"
        )
        ans = input("Continue? [y/N]: ").strip().lower()
        if ans not in ("y", "yes"):
            print("Aborted.")
            return

    # Build a synchronous engine from the configured async URL.
    # The app uses AsyncSession everywhere; for one-shot seeding we want a sync
    # session, so we strip the async driver suffix.
    db_url = str(settings.DATABASE_URL)
    sync_url = (
        db_url.replace("+asyncpg", "")
        .replace("postgresql+asyncpg", "postgresql")
        .replace("sqlite+aiosqlite", "sqlite")
    )
    engine = create_engine(sync_url, pool_pre_ping=True)
    SessionLocalSync = sessionmaker(bind=engine, autocommit=False, autoflush=False)

    db: Session = SessionLocalSync()
    try:
        n_ach = upsert_achievement_translations(db)
        print(f"  [+] {n_ach} new achievement translation rows")
        n_q = upsert_quest_template_translations(db)
        print(f"  [+] {n_q} new quest template translation rows")
        print("Done.")
    finally:
        db.close()
        engine.dispose()


if __name__ == "__main__":
    main(prompt="--no-prompt" not in sys.argv)
