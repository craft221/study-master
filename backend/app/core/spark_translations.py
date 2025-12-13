"""
Traductions des messages Spark pour les notifications
=====================================================

Messages émotionnels style Duolingo avec Spark l'écureuil
Supporte: français (fr), anglais (en), espagnol (es)

Intégré avec le système i18n existant (app/core/i18n.py)
"""

from typing import Dict, List, Tuple
import random

from app.core.i18n import normalize_language_code, SUPPORTED_LANGUAGES

# Langues supportées pour les notifications Spark (aligné avec le frontend i18n)
SPARK_SUPPORTED_LANGUAGES = ["fr", "en", "es"]


def get_spark_language(lang: str) -> str:
    """
    Normalise et valide la langue pour les messages Spark.
    Utilise le système i18n existant puis vérifie le support Spark.

    Args:
        lang: Code de langue brut (peut être "fr-FR", "en-US", etc.)

    Returns:
        Code de langue supporté par Spark (fr, en, es) ou "fr" par défaut
    """
    # Normaliser avec le système i18n existant
    normalized = normalize_language_code(lang)

    # Si la langue normalisée est supportée par Spark, l'utiliser
    if normalized in SPARK_SUPPORTED_LANGUAGES:
        return normalized

    # Sinon, fallback sur français
    return "fr"


class SparkNotificationMessages:
    """Messages Spark traduits pour les notifications"""

    # ============================================
    # RAPPELS DE STREAK - 14H (encourageants)
    # ============================================
    STREAK_REMINDER_14H: Dict[str, List[str]] = {
        "fr": [
            "Hé, c'est moi Spark ! 🐿️ Ta série de {streak} jours m'impressionne ! On continue ensemble ?",
            "Salut champion ! Ta série de {streak} jours est magnifique. Une petite session cet après-midi ? 📚",
            "Hey ! 🌟 {streak} jours de suite, tu gères ! Je t'attends pour qu'on révise ensemble !",
            "Coucou ! Ta flamme de {streak} jours brille fort ! 🔥 Garde-la vivante aujourd'hui !",
        ],
        "en": [
            "Hey, it's me Spark! 🐿️ Your {streak}-day streak impresses me! Shall we continue together?",
            "Hi champion! Your {streak}-day streak is amazing. A little study session this afternoon? 📚",
            "Hey! 🌟 {streak} days in a row, you rock! I'm waiting to study with you!",
            "Hello! Your {streak}-day flame burns bright! 🔥 Keep it alive today!",
        ],
        "es": [
            "¡Hola, soy Spark! 🐿️ ¡Tu racha de {streak} días me impresiona! ¿Continuamos juntos?",
            "¡Hola campeón! Tu racha de {streak} días es increíble. ¿Una sesión de estudio esta tarde? 📚",
            "¡Hey! 🌟 ¡{streak} días seguidos, lo estás haciendo genial! ¡Te espero para estudiar!",
            "¡Hola! ¡Tu llama de {streak} días brilla con fuerza! 🔥 ¡Mantenla viva hoy!",
        ],
    }

    # ============================================
    # RAPPELS DE STREAK - 19H (inquiets)
    # ============================================
    STREAK_REMINDER_19H_NORMAL: Dict[str, List[str]] = {
        "fr": [
            "Euh... 😟 Tu n'as pas encore étudié aujourd'hui ! Ta série de {streak} jours va disparaître !",
            "ALERTE ! 🚨 Spark ici ! Ta série de {streak} jours est en DANGER ! Viens vite !",
            "Je commence à m'inquiéter... 😰 {streak} jours de travail vont s'envoler si tu ne reviens pas !",
            "Tu m'as oublié ? 🥺 Ta série de {streak} jours pleure dans son coin...",
        ],
        "en": [
            "Umm... 😟 You haven't studied today yet! Your {streak}-day streak is going to disappear!",
            "ALERT! 🚨 Spark here! Your {streak}-day streak is in DANGER! Come quick!",
            "I'm starting to worry... 😰 {streak} days of work will vanish if you don't come back!",
            "Did you forget me? 🥺 Your {streak}-day streak is crying in the corner...",
        ],
        "es": [
            "Eh... 😟 ¡Aún no has estudiado hoy! ¡Tu racha de {streak} días va a desaparecer!",
            "¡ALERTA! 🚨 ¡Spark aquí! ¡Tu racha de {streak} días está en PELIGRO! ¡Ven rápido!",
            "Estoy empezando a preocuparme... 😰 ¡{streak} días de trabajo desaparecerán si no vuelves!",
            "¿Me olvidaste? 🥺 Tu racha de {streak} días llora en una esquina...",
        ],
    }

    # ============================================
    # RAPPELS DE STREAK - URGENT (< 2h)
    # ============================================
    STREAK_REMINDER_URGENT: Dict[str, List[str]] = {
        "fr": [
            "URGENCE TOTALE ! 😱 Plus que quelques heures ! Tes {streak} jours vont DISPARAÎTRE !",
            "JE PANIQUE ! 🆘 Ta série de {streak} jours va mourir ! REVIENS MAINTENANT !",
            "DERNIÈRE CHANCE ! 😭 Je ne veux pas voir ta série de {streak} jours s'effondrer !",
            "C'EST LA FIN ?! 💔 Non non non ! Sauve tes {streak} jours avant qu'il soit trop tard !",
        ],
        "en": [
            "TOTAL EMERGENCY! 😱 Only a few hours left! Your {streak} days are going to DISAPPEAR!",
            "I'M PANICKING! 🆘 Your {streak}-day streak is dying! COME BACK NOW!",
            "LAST CHANCE! 😭 I don't want to see your {streak}-day streak crumble!",
            "IS THIS THE END?! 💔 No no no! Save your {streak} days before it's too late!",
        ],
        "es": [
            "¡EMERGENCIA TOTAL! 😱 ¡Solo quedan unas horas! ¡Tus {streak} días van a DESAPARECER!",
            "¡ESTOY EN PÁNICO! 🆘 ¡Tu racha de {streak} días va a morir! ¡VUELVE AHORA!",
            "¡ÚLTIMA OPORTUNIDAD! 😭 ¡No quiero ver tu racha de {streak} días derrumbarse!",
            "¿¡ES EL FIN!? 💔 ¡No no no! ¡Salva tus {streak} días antes de que sea tarde!",
        ],
    }

    # ============================================
    # TITRES DE RAPPELS
    # ============================================
    STREAK_REMINDER_TITLES: Dict[str, Dict[str, str]] = {
        "fr": {
            "normal": "Coucou de Spark ! 🐿️",
            "worried": "Spark s'inquiète pour toi ! 😟",
            "urgent": "Spark est DÉSESPÉRÉ ! 😱🔥",
        },
        "en": {
            "normal": "Hello from Spark! 🐿️",
            "worried": "Spark is worried about you! 😟",
            "urgent": "Spark is DESPERATE! 😱🔥",
        },
        "es": {
            "normal": "¡Hola de Spark! 🐿️",
            "worried": "¡Spark está preocupado por ti! 😟",
            "urgent": "¡Spark está DESESPERADO! 😱🔥",
        },
    }

    # ============================================
    # STREAK PERDU
    # ============================================
    STREAK_LOST_LONG: Dict[str, List[str]] = {  # >= 30 jours
        "fr": [
            "💔 {streak} jours... Tout ce travail... Je ne peux pas y croire...",
            "*sanglote* 😭 {streak} jours ensemble, partis en fumée... Je suis dévasté...",
            "Non... pas {streak} jours... Spark a besoin d'un moment... 😢💔",
        ],
        "en": [
            "💔 {streak} days... All that work... I can't believe it...",
            "*sobs* 😭 {streak} days together, gone up in smoke... I'm devastated...",
            "No... not {streak} days... Spark needs a moment... 😢💔",
        ],
        "es": [
            "💔 {streak} días... Todo ese trabajo... No puedo creerlo...",
            "*solloza* 😭 {streak} días juntos, se fueron en humo... Estoy devastado...",
            "No... no {streak} días... Spark necesita un momento... 😢💔",
        ],
    }

    STREAK_LOST_MEDIUM: Dict[str, List[str]] = {  # >= 7 jours
        "fr": [
            "😢 Oh non... Ta série de {streak} jours a disparu... Je suis tellement triste...",
            "*renifle* {streak} jours de suite... C'était beau tant que ça a duré... 😿",
            "Ta flamme de {streak} jours s'est éteinte... 🕯️ Spark boude dans son coin...",
        ],
        "en": [
            "😢 Oh no... Your {streak}-day streak is gone... I'm so sad...",
            "*sniffles* {streak} days in a row... It was beautiful while it lasted... 😿",
            "Your {streak}-day flame went out... 🕯️ Spark is sulking in the corner...",
        ],
        "es": [
            "😢 Oh no... Tu racha de {streak} días desapareció... Estoy muy triste...",
            "*olfatea* {streak} días seguidos... Fue hermoso mientras duró... 😿",
            "Tu llama de {streak} días se apagó... 🕯️ Spark está haciendo pucheros en la esquina...",
        ],
    }

    STREAK_LOST_SHORT: Dict[str, List[str]] = {  # < 7 jours
        "fr": [
            "Oups... Ta série de {streak} jours est partie. On recommence ? 🌱",
            "Bon... {streak} jours c'était bien ! Prêt pour un nouveau départ ? 💪",
            "Ta série de {streak} jours s'est envolée... Mais Spark croit en toi ! 🐿️",
        ],
        "en": [
            "Oops... Your {streak}-day streak is gone. Shall we start again? 🌱",
            "Well... {streak} days was good! Ready for a fresh start? 💪",
            "Your {streak}-day streak flew away... But Spark believes in you! 🐿️",
        ],
        "es": [
            "Ups... Tu racha de {streak} días se fue. ¿Empezamos de nuevo? 🌱",
            "Bueno... ¡{streak} días estuvo bien! ¿Listo para un nuevo comienzo? 💪",
            "Tu racha de {streak} días voló... ¡Pero Spark cree en ti! 🐿️",
        ],
    }

    STREAK_LOST_TITLES: Dict[str, Dict[str, str]] = {
        "fr": {
            "long": "Spark est DÉVASTÉ 💔😭",
            "medium": "Spark est triste 😢",
            "short": "Streak perdu... 😔",
        },
        "en": {
            "long": "Spark is DEVASTATED 💔😭",
            "medium": "Spark is sad 😢",
            "short": "Streak lost... 😔",
        },
        "es": {
            "long": "Spark está DEVASTADO 💔😭",
            "medium": "Spark está triste 😢",
            "short": "Racha perdida... 😔",
        },
    }

    # ============================================
    # MILESTONES DE STREAK
    # ============================================
    STREAK_MILESTONE_MESSAGES: Dict[str, Dict[int, str]] = {
        "fr": {
            7: "🐿️✨ UNE SEMAINE ! Spark fait la danse de la victoire ! Tu es INCROYABLE !",
            14: "⚡🔥 DEUX SEMAINES ! Je suis tellement FIER de toi ! *saute de joie*",
            30: "🏆🎊 UN MOIS ENTIER ! Spark pleure de joie ! Tu es mon HÉROS !",
            60: "💎👑 DEUX MOIS ! *explose de bonheur* Tu es une MACHINE !",
            100: "🌟🏅 CENT JOURS ! Spark ne trouve plus les mots... Tu es une LÉGENDE VIVANTE !",
            365: "👑🎆🌟 UN AN !!! JE N'EN REVIENS PAS !!! TU ES LE/LA MEILLEUR(E) DE TOUS LES TEMPS !!!",
        },
        "en": {
            7: "🐿️✨ ONE WEEK! Spark is doing a victory dance! You're AMAZING!",
            14: "⚡🔥 TWO WEEKS! I'm so PROUD of you! *jumps for joy*",
            30: "🏆🎊 A WHOLE MONTH! Spark is crying with joy! You're my HERO!",
            60: "💎👑 TWO MONTHS! *explodes with happiness* You're a MACHINE!",
            100: "🌟🏅 ONE HUNDRED DAYS! Spark is speechless... You're a LIVING LEGEND!",
            365: "👑🎆🌟 ONE YEAR!!! I CAN'T BELIEVE IT!!! YOU'RE THE BEST OF ALL TIME!!!",
        },
        "es": {
            7: "🐿️✨ ¡UNA SEMANA! ¡Spark está bailando de victoria! ¡Eres INCREÍBLE!",
            14: "⚡🔥 ¡DOS SEMANAS! ¡Estoy tan ORGULLOSO de ti! *salta de alegría*",
            30: "🏆🎊 ¡UN MES ENTERO! ¡Spark llora de alegría! ¡Eres mi HÉROE!",
            60: "💎👑 ¡DOS MESES! *explota de felicidad* ¡Eres una MÁQUINA!",
            100: "🌟🏅 ¡CIEN DÍAS! Spark no encuentra palabras... ¡Eres una LEYENDA VIVIENTE!",
            365: "👑🎆🌟 ¡¡¡UN AÑO!!! ¡¡¡NO PUEDO CREERLO!!! ¡¡¡ERES EL/LA MEJOR DE TODOS LOS TIEMPOS!!!",
        },
    }

    STREAK_MILESTONE_TITLES: Dict[str, Dict[int, str]] = {
        "fr": {
            7: "Spark fait la fête ! 🎉🐿️",
            14: "Spark est aux anges ! ✨",
            30: "Spark EXPLOSE de fierté ! 🏆",
            60: "Spark est EN EXTASE ! 💎",
            100: "Spark PLEURE de joie ! 👑",
            365: "SPARK EST EN APOTHÉOSE ! 🌟",
        },
        "en": {
            7: "Spark is celebrating! 🎉🐿️",
            14: "Spark is on cloud nine! ✨",
            30: "Spark BURSTS with pride! 🏆",
            60: "Spark is ECSTATIC! 💎",
            100: "Spark is CRYING with joy! 👑",
            365: "SPARK IS IN HEAVEN! 🌟",
        },
        "es": {
            7: "¡Spark está de fiesta! 🎉🐿️",
            14: "¡Spark está en las nubes! ✨",
            30: "¡Spark EXPLOTA de orgullo! 🏆",
            60: "¡Spark está EN ÉXTASIS! 💎",
            100: "¡Spark LLORA de alegría! 👑",
            365: "¡SPARK ESTÁ EN EL PARAÍSO! 🌟",
        },
    }

    # ============================================
    # RAPPELS FLASHCARDS
    # ============================================
    FLASHCARD_REMINDER_HIGH: Dict[str, List[str]] = {  # >= 50 cartes
        "fr": [
            "😱 {count} cartes t'attendent ! Spark a peur qu'elles s'enfuient !",
            "Wow ! {count} flashcards ! C'est beaucoup mais Spark croit en toi ! 💪",
            "🌋 {count} cartes en éruption ! Viens les dompter avec moi !",
        ],
        "en": [
            "😱 {count} cards are waiting for you! Spark is afraid they'll run away!",
            "Wow! {count} flashcards! It's a lot but Spark believes in you! 💪",
            "🌋 {count} cards erupting! Come tame them with me!",
        ],
        "es": [
            "😱 ¡{count} tarjetas te esperan! ¡Spark tiene miedo de que se escapen!",
            "¡Wow! ¡{count} flashcards! ¡Es mucho pero Spark cree en ti! 💪",
            "🌋 ¡{count} tarjetas en erupción! ¡Ven a domarlas conmigo!",
        ],
    }

    FLASHCARD_REMINDER_MEDIUM: Dict[str, List[str]] = {  # >= 20 cartes
        "fr": [
            "Hey ! {count} flashcards veulent te parler ! 🎴",
            "Tes {count} cartes s'ennuient de toi ! Viens jouer ! 🐿️",
            "Spark a préparé {count} cartes rien que pour toi ! 💝",
        ],
        "en": [
            "Hey! {count} flashcards want to talk to you! 🎴",
            "Your {count} cards miss you! Come play! 🐿️",
            "Spark prepared {count} cards just for you! 💝",
        ],
        "es": [
            "¡Hey! ¡{count} flashcards quieren hablar contigo! 🎴",
            "¡Tus {count} tarjetas te extrañan! ¡Ven a jugar! 🐿️",
            "¡Spark preparó {count} tarjetas solo para ti! 💝",
        ],
    }

    FLASHCARD_REMINDER_LOW: Dict[str, List[str]] = {  # < 20 cartes
        "fr": [
            "Coucou ! {count} petites cartes t'attendent ! 🌸",
            "Une mini session de {count} cartes, ça te dit ? 🐿️",
            "Spark a {count} flashcards à te montrer ! Viens voir ! ✨",
        ],
        "en": [
            "Hi! {count} little cards are waiting for you! 🌸",
            "A mini session of {count} cards, what do you say? 🐿️",
            "Spark has {count} flashcards to show you! Come see! ✨",
        ],
        "es": [
            "¡Hola! ¡{count} pequeñas tarjetas te esperan! 🌸",
            "¿Una mini sesión de {count} tarjetas, qué dices? 🐿️",
            "¡Spark tiene {count} flashcards para mostrarte! ¡Ven a ver! ✨",
        ],
    }

    FLASHCARD_REMINDER_TITLES: Dict[str, Dict[str, str]] = {
        "fr": {
            "high": "Spark a besoin de toi ! 📚🐿️",
            "medium": "Révisions du jour ! 📚",
            "low": "Petit rappel de Spark ! 🐿️",
        },
        "en": {
            "high": "Spark needs you! 📚🐿️",
            "medium": "Today's reviews! 📚",
            "low": "Little reminder from Spark! 🐿️",
        },
        "es": {
            "high": "¡Spark te necesita! 📚🐿️",
            "medium": "¡Repasos del día! 📚",
            "low": "¡Pequeño recordatorio de Spark! 🐿️",
        },
    }

    @classmethod
    def get_streak_reminder_14h(cls, lang: str, streak: int) -> str:
        """Obtient un message de rappel 14h"""
        lang = get_spark_language(lang)
        messages = cls.STREAK_REMINDER_14H.get(lang, cls.STREAK_REMINDER_14H["fr"])
        return random.choice(messages).format(streak=streak)

    @classmethod
    def get_streak_reminder_19h(cls, lang: str, streak: int, is_urgent: bool = False) -> str:
        """Obtient un message de rappel 19h"""
        lang = get_spark_language(lang)
        if is_urgent:
            messages = cls.STREAK_REMINDER_URGENT.get(lang, cls.STREAK_REMINDER_URGENT["fr"])
        else:
            messages = cls.STREAK_REMINDER_19H_NORMAL.get(lang, cls.STREAK_REMINDER_19H_NORMAL["fr"])
        return random.choice(messages).format(streak=streak)

    @classmethod
    def get_streak_reminder_title(cls, lang: str, is_evening: bool, is_urgent: bool) -> str:
        """Obtient le titre du rappel de streak"""
        lang = get_spark_language(lang)
        titles = cls.STREAK_REMINDER_TITLES.get(lang, cls.STREAK_REMINDER_TITLES["fr"])
        if is_urgent:
            return titles["urgent"]
        elif is_evening:
            return titles["worried"]
        return titles["normal"]

    @classmethod
    def get_streak_lost_message(cls, lang: str, streak: int) -> Tuple[str, str]:
        """Obtient message et titre pour streak perdu"""
        lang = get_spark_language(lang)
        titles = cls.STREAK_LOST_TITLES.get(lang, cls.STREAK_LOST_TITLES["fr"])

        if streak >= 30:
            messages = cls.STREAK_LOST_LONG.get(lang, cls.STREAK_LOST_LONG["fr"])
            title = titles["long"]
        elif streak >= 7:
            messages = cls.STREAK_LOST_MEDIUM.get(lang, cls.STREAK_LOST_MEDIUM["fr"])
            title = titles["medium"]
        else:
            messages = cls.STREAK_LOST_SHORT.get(lang, cls.STREAK_LOST_SHORT["fr"])
            title = titles["short"]

        return random.choice(messages).format(streak=streak), title

    @classmethod
    def get_streak_milestone(cls, lang: str, streak: int) -> Tuple[str, str]:
        """Obtient message et titre pour milestone de streak"""
        lang = get_spark_language(lang)
        messages = cls.STREAK_MILESTONE_MESSAGES.get(lang, cls.STREAK_MILESTONE_MESSAGES["fr"])
        titles = cls.STREAK_MILESTONE_TITLES.get(lang, cls.STREAK_MILESTONE_TITLES["fr"])

        # Messages de fallback par langue
        fallback_messages = {
            "fr": f"Spark est impressionné ! {streak} jours de suite ! 🐿️🔥",
            "en": f"Spark is impressed! {streak} days in a row! 🐿️🔥",
            "es": f"¡Spark está impresionado! ¡{streak} días seguidos! 🐿️🔥",
        }
        fallback_titles = {
            "fr": f"🎉 Série de {streak} jours !",
            "en": f"🎉 {streak}-day streak!",
            "es": f"🎉 ¡Racha de {streak} días!",
        }

        message = messages.get(streak, fallback_messages.get(lang, fallback_messages["fr"]))
        title = titles.get(streak, fallback_titles.get(lang, fallback_titles["fr"]))

        return message, title

    @classmethod
    def get_flashcard_reminder(cls, lang: str, count: int) -> Tuple[str, str]:
        """Obtient message et titre pour rappel flashcards"""
        lang = get_spark_language(lang)
        titles = cls.FLASHCARD_REMINDER_TITLES.get(lang, cls.FLASHCARD_REMINDER_TITLES["fr"])

        if count >= 50:
            messages = cls.FLASHCARD_REMINDER_HIGH.get(lang, cls.FLASHCARD_REMINDER_HIGH["fr"])
            title = titles["high"]
        elif count >= 20:
            messages = cls.FLASHCARD_REMINDER_MEDIUM.get(lang, cls.FLASHCARD_REMINDER_MEDIUM["fr"])
            title = titles["medium"]
        else:
            messages = cls.FLASHCARD_REMINDER_LOW.get(lang, cls.FLASHCARD_REMINDER_LOW["fr"])
            title = titles["low"]

        return random.choice(messages).format(count=count), title


# Instance globale pour faciliter l'import
spark_messages = SparkNotificationMessages()

# Export de la fonction de normalisation pour les autres modules
__all__ = ["SparkNotificationMessages", "spark_messages", "get_spark_language", "SPARK_SUPPORTED_LANGUAGES"]
