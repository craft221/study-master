"""
Traductions des messages Spark pour les notifications
=====================================================

Messages émotionnels style Duolingo avec Spark l'écureuil
Supporte: français (fr), anglais (en), espagnol (es), arabe (ar)

Intégré avec le système i18n existant (app/core/i18n.py)
"""

from typing import Dict, List, Tuple
import random

from app.core.i18n import normalize_language_code, SUPPORTED_LANGUAGES

# Langues supportées pour les notifications Spark (aligné avec le frontend i18n)
SPARK_SUPPORTED_LANGUAGES = ["fr", "en", "es", "ar"]


def get_spark_language(lang: str) -> str:
    """
    Normalise et valide la langue pour les messages Spark.
    Utilise le système i18n existant puis vérifie le support Spark.

    Args:
        lang: Code de langue brut (peut être "fr-FR", "en-US", etc.)

    Returns:
        Code de langue supporté par Spark (fr, en, es, ar) ou "fr" par défaut
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
        "ar": [
            "مرحبًا، أنا سبارك! 🐿️ سلسلتك التي مدتها {streak} أيام تثير إعجابي! هل نواصل معًا؟",
            "أهلاً بطلي! سلسلتك التي مدتها {streak} أيام رائعة. جلسة دراسية صغيرة بعد الظهر؟ 📚",
            "مرحبًا! 🌟 {streak} أيام متتالية، أنت رائع! أنتظرك لنذاكر معًا!",
            "أهلاً! شعلتك التي مدتها {streak} أيام تتوهج! 🔥 حافظ عليها اليوم!",
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
        "ar": [
            "حسنًا... 😟 لم تذاكر بعد اليوم! سلسلتك التي مدتها {streak} أيام ستختفي!",
            "تنبيه! 🚨 سبارك هنا! سلسلتك التي مدتها {streak} أيام في خطر! تعال بسرعة!",
            "بدأت أقلق... 😰 {streak} أيام من العمل ستضيع إذا لم تعد!",
            "هل نسيتني؟ 🥺 سلسلتك التي مدتها {streak} أيام تبكي في الزاوية...",
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
        "ar": [
            "طوارئ كاملة! 😱 لم يتبق سوى ساعات قليلة! أيامك الـ {streak} ستختفي!",
            "أنا في حالة هلع! 🆘 سلسلتك التي مدتها {streak} أيام تموت! عُد الآن!",
            "الفرصة الأخيرة! 😭 لا أريد أن أرى سلسلتك التي مدتها {streak} أيام تنهار!",
            "هل هذه النهاية؟! 💔 لا لا لا! أنقذ أيامك الـ {streak} قبل فوات الأوان!",
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
        "ar": {
            "normal": "تحية من سبارك! 🐿️",
            "worried": "سبارك قلق عليك! 😟",
            "urgent": "سبارك يائس! 😱🔥",
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
        "ar": [
            "💔 {streak} يومًا... كل هذا العمل... لا أصدق...",
            "*ينتحب* 😭 {streak} يومًا معًا، ذهبت أدراج الرياح... أنا محطم...",
            "لا... ليس {streak} يومًا... سبارك يحتاج لحظة... 😢💔",
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
        "ar": [
            "😢 لا... سلسلتك التي مدتها {streak} أيام اختفت... أنا حزين جدًا...",
            "*يشهق* {streak} أيام متتالية... كانت جميلة ما دامت... 😿",
            "شعلتك التي مدتها {streak} أيام انطفأت... 🕯️ سبارك يعبس في زاويته...",
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
        "ar": [
            "أوه... سلسلتك التي مدتها {streak} أيام انتهت. هل نبدأ من جديد؟ 🌱",
            "حسنًا... {streak} أيام كانت جيدة! مستعد لبداية جديدة؟ 💪",
            "سلسلتك التي مدتها {streak} أيام طارت... لكن سبارك يؤمن بك! 🐿️",
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
        "ar": {
            "long": "سبارك محطم 💔😭",
            "medium": "سبارك حزين 😢",
            "short": "ضاعت السلسلة... 😔",
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
        "ar": {
            7: "🐿️✨ أسبوع! سبارك يرقص رقصة النصر! أنت رائع!",
            14: "⚡🔥 أسبوعان! أنا فخور جدًا بك! *يقفز فرحًا*",
            30: "🏆🎊 شهر كامل! سبارك يبكي من الفرح! أنت بطلي!",
            60: "💎👑 شهران! *ينفجر سعادة* أنت آلة!",
            100: "🌟🏅 مئة يوم! سبارك بلا كلام... أنت أسطورة حية!",
            365: "👑🎆🌟 سنة!!! لا أصدق!!! أنت الأفضل على الإطلاق!!!",
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
        "ar": {
            7: "سبارك يحتفل! 🎉🐿️",
            14: "سبارك في السحاب! ✨",
            30: "سبارك يفيض فخرًا! 🏆",
            60: "سبارك في نشوة! 💎",
            100: "سبارك يبكي من الفرح! 👑",
            365: "سبارك في الجنة! 🌟",
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
        "ar": [
            "😱 {count} بطاقة في انتظارك! سبارك يخشى أن تهرب!",
            "رائع! {count} بطاقة! إنها كثيرة لكن سبارك يؤمن بك! 💪",
            "🌋 {count} بطاقة تنفجر! تعال وروضها معي!",
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
        "ar": [
            "مرحبًا! {count} بطاقة تريد التحدث معك! 🎴",
            "بطاقاتك الـ {count} تشتاق إليك! تعال والعب! 🐿️",
            "سبارك حضّر {count} بطاقة من أجلك! 💝",
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
        "ar": [
            "أهلاً! {count} بطاقات صغيرة تنتظرك! 🌸",
            "جلسة قصيرة من {count} بطاقة، ما رأيك؟ 🐿️",
            "لدى سبارك {count} بطاقة ليريك إياها! تعال شاهد! ✨",
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
        "ar": {
            "high": "سبارك يحتاجك! 📚🐿️",
            "medium": "مراجعات اليوم! 📚",
            "low": "تذكير صغير من سبارك! 🐿️",
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

    # ============================================
    # ACHIEVEMENTS DÉBLOQUÉS
    # ============================================
    ACHIEVEMENT_UNLOCKED: Dict[str, Dict[str, str]] = {
        "fr": {
            "title": "Succès débloqué ! 🏆",
            "message": "Tu as débloqué '{name}' ! +{xp} XP",
        },
        "en": {
            "title": "Achievement unlocked! 🏆",
            "message": "You unlocked '{name}'! +{xp} XP",
        },
        "es": {
            "title": "¡Logro desbloqueado! 🏆",
            "message": "¡Desbloqueaste '{name}'! +{xp} XP",
        },
        "ar": {
            "title": "تم فتح إنجاز! 🏆",
            "message": "لقد فتحت '{name}'! +{xp} نقطة خبرة",
        },
    }

    # ============================================
    # LEVEL UP
    # ============================================
    LEVEL_UP: Dict[str, Dict[str, str]] = {
        "fr": {
            "title": "Niveau {level} atteint ! 🎉",
            "message": "Félicitations ! Tu es maintenant niveau {level} !",
        },
        "en": {
            "title": "Level {level} reached! 🎉",
            "message": "Congratulations! You're now level {level}!",
        },
        "es": {
            "title": "¡Nivel {level} alcanzado! 🎉",
            "message": "¡Felicidades! ¡Ahora eres nivel {level}!",
        },
        "ar": {
            "title": "وصلت إلى المستوى {level}! 🎉",
            "message": "تهانينا! أنت الآن في المستوى {level}!",
        },
    }

    # ============================================
    # DUELS
    # ============================================
    DUEL_CHALLENGE: Dict[str, Dict[str, str]] = {
        "fr": {
            "title": "Nouveau défi ! ⚔️",
            "message": "{challenger} vous défie ! Enjeux: {xp} XP",
        },
        "en": {
            "title": "New challenge! ⚔️",
            "message": "{challenger} challenges you! Stakes: {xp} XP",
        },
        "es": {
            "title": "¡Nuevo desafío! ⚔️",
            "message": "¡{challenger} te desafía! Apuesta: {xp} XP",
        },
        "ar": {
            "title": "تحدٍ جديد! ⚔️",
            "message": "{challenger} يتحداك! الرهان: {xp} نقطة خبرة",
        },
    }

    # ============================================
    # FOCUS ROOMS
    # ============================================
    FOCUS_ROOM_INVITE: Dict[str, Dict[str, str]] = {
        "fr": {
            "title": "Invitation Focus Room 📚",
            "message": "{inviter} t'invite à rejoindre la salle '{room}'",
        },
        "en": {
            "title": "Focus Room Invitation 📚",
            "message": "{inviter} invites you to join the room '{room}'",
        },
        "es": {
            "title": "Invitación Focus Room 📚",
            "message": "{inviter} te invita a unirte a la sala '{room}'",
        },
        "ar": {
            "title": "دعوة لغرفة التركيز 📚",
            "message": "{inviter} يدعوك للانضمام إلى غرفة '{room}'",
        },
    }

    FOCUS_ROOM_INVITE_ACCEPTED: Dict[str, Dict[str, str]] = {
        "fr": {
            "title": "Invitation acceptée ! 🎉",
            "message": "{invitee} a rejoint ta salle '{room}'",
        },
        "en": {
            "title": "Invitation accepted! 🎉",
            "message": "{invitee} joined your room '{room}'",
        },
        "es": {
            "title": "¡Invitación aceptada! 🎉",
            "message": "{invitee} se unió a tu sala '{room}'",
        },
        "ar": {
            "title": "تم قبول الدعوة! 🎉",
            "message": "{invitee} انضم إلى غرفتك '{room}'",
        },
    }

    # ============================================
    # ÉVÉNEMENTS CALENDRIER
    # ============================================
    EVENT_REMINDER: Dict[str, Dict[str, str]] = {
        "fr": {
            "title_exam": "Examen {time} !",
            "title_deadline": "Date limite {time} !",
            "title_default": "{type} {time}",
            "message_exam": "'{event}' commence le {date} à {hour}",
            "message_deadline": "'{event}' expire le {date} à {hour}",
            "message_default": "'{event}' commence à {hour}",
        },
        "en": {
            "title_exam": "Exam {time}!",
            "title_deadline": "Deadline {time}!",
            "title_default": "{type} {time}",
            "message_exam": "'{event}' starts on {date} at {hour}",
            "message_deadline": "'{event}' expires on {date} at {hour}",
            "message_default": "'{event}' starts at {hour}",
        },
        "es": {
            "title_exam": "¡Examen {time}!",
            "title_deadline": "¡Fecha límite {time}!",
            "title_default": "{type} {time}",
            "message_exam": "'{event}' comienza el {date} a las {hour}",
            "message_deadline": "'{event}' expira el {date} a las {hour}",
            "message_default": "'{event}' comienza a las {hour}",
        },
        "ar": {
            "title_exam": "امتحان {time}!",
            "title_deadline": "موعد نهائي {time}!",
            "title_default": "{type} {time}",
            "message_exam": "'{event}' يبدأ في {date} الساعة {hour}",
            "message_deadline": "'{event}' ينتهي في {date} الساعة {hour}",
            "message_default": "'{event}' يبدأ الساعة {hour}",
        },
    }

    EVENT_TYPE_LABELS: Dict[str, Dict[str, str]] = {
        "fr": {"exam": "Examen", "class": "Cours", "deadline": "Date limite", "study": "Session d'étude", "meeting": "Réunion", "other": "Événement"},
        "en": {"exam": "Exam", "class": "Class", "deadline": "Deadline", "study": "Study session", "meeting": "Meeting", "other": "Event"},
        "es": {"exam": "Examen", "class": "Clase", "deadline": "Fecha límite", "study": "Sesión de estudio", "meeting": "Reunión", "other": "Evento"},
        "ar": {
            "exam": "امتحان",
            "class": "حصة",
            "deadline": "موعد نهائي",
            "study": "جلسة دراسية",
            "meeting": "اجتماع",
            "other": "حدث",
        },
    }

    # ============================================
    # LIGUES - PROMOTIONS / RÉLÉGATIONS
    # ============================================
    LEAGUE_TIER_NAMES: Dict[str, Dict[str, str]] = {
        "fr": {"bronze": "Bronze", "silver": "Argent", "gold": "Or", "diamond": "Diamant", "master": "Maître"},
        "en": {"bronze": "Bronze", "silver": "Silver", "gold": "Gold", "diamond": "Diamond", "master": "Master"},
        "es": {"bronze": "Bronce", "silver": "Plata", "gold": "Oro", "diamond": "Diamante", "master": "Maestro"},
        "ar": {
            "bronze": "البرونزي",
            "silver": "الفضي",
            "gold": "الذهبي",
            "diamond": "الماسي",
            "master": "الخبير",
        },
    }

    LEAGUE_PROMOTION: Dict[str, Dict[str, str]] = {
        "fr": {
            "title": "🎉 PROMOTION ! Ligue {to_tier} !",
            "message": "Félicitations ! Tu passes de la ligue {from_tier} à la ligue {to_tier} ! Spark est tellement fier de toi ! 🐿️⭐",
        },
        "en": {
            "title": "🎉 PROMOTION! {to_tier} League!",
            "message": "Congratulations! You're moving from {from_tier} to {to_tier} league! Spark is so proud of you! 🐿️⭐",
        },
        "es": {
            "title": "🎉 ¡PROMOCIÓN! ¡Liga {to_tier}!",
            "message": "¡Felicidades! ¡Pasas de la liga {from_tier} a la liga {to_tier}! ¡Spark está muy orgulloso de ti! 🐿️⭐",
        },
        "ar": {
            "title": "🎉 ترقية! دوري {to_tier}!",
            "message": "تهانينا! تنتقل من دوري {from_tier} إلى دوري {to_tier}! سبارك فخور بك جدًا! 🐿️⭐",
        },
    }

    LEAGUE_DEMOTION: Dict[str, Dict[str, str]] = {
        "fr": {
            "title": "😔 Rétrogradation - Ligue {to_tier}",
            "message": "Tu redescends en ligue {to_tier}... Mais ne t'inquiète pas ! Spark croit en toi pour remonter ! 🐿️💪",
        },
        "en": {
            "title": "😔 Demotion - {to_tier} League",
            "message": "You're moving back to {to_tier} league... But don't worry! Spark believes in you to climb back up! 🐿️💪",
        },
        "es": {
            "title": "😔 Descenso - Liga {to_tier}",
            "message": "Bajas a la liga {to_tier}... ¡Pero no te preocupes! ¡Spark cree en ti para volver a subir! 🐿️💪",
        },
        "ar": {
            "title": "😔 تنزيل - دوري {to_tier}",
            "message": "تنزل إلى دوري {to_tier}... لكن لا تقلق! سبارك يؤمن بقدرتك على الصعود! 🐿️💪",
        },
    }

    # ============================================
    # RAPPELS D'INACTIVITÉ (réengagement)
    # ============================================
    INACTIVITY_REMINDER: Dict[str, Dict[str, Dict[str, str]]] = {
        "fr": {
            "3_days": {
                "title": "🐿️ Spark s'ennuie sans toi !",
                "message": "Hé, ça fait 3 jours qu'on ne s'est pas vus ! Ta série est en jeu... Reviens vite pour une petite session ! 📚",
                "email_subject": "🐿️ Spark s'ennuie sans toi !",
            },
            "7_days": {
                "title": "😢 Spark te cherche partout...",
                "message": "Une semaine sans toi... Tes flashcards s'accumulent et Spark est triste ! Juste 5 minutes aujourd'hui ? 🥺",
                "email_subject": "Ça fait une semaine... tu reviens ? 📚",
            },
            "14_days": {
                "title": "💔 Spark ne t'oublie pas !",
                "message": "2 semaines déjà ! Tes amis continuent de progresser. Reviens montrer de quoi tu es capable ! 💪",
                "email_subject": "Tu nous manques sur Studera !",
            },
            "30_days": {
                "title": "🐿️ Spark t'attend toujours...",
                "message": "Un mois sans étudier... Mais il n'est jamais trop tard pour reprendre ! Spark est toujours là pour toi 🐿️❤️",
                "email_subject": "Il n'est jamais trop tard pour reprendre ! 🐿️",
            },
        },
        "en": {
            "3_days": {
                "title": "🐿️ Spark misses you!",
                "message": "Hey, it's been 3 days! Your streak is at risk... Come back for a quick study session! 📚",
                "email_subject": "🐿️ Spark misses you!",
            },
            "7_days": {
                "title": "😢 Spark is looking for you...",
                "message": "A whole week without you... Your flashcards are piling up and Spark is sad! Just 5 minutes today? 🥺",
                "email_subject": "It's been a week... coming back? 📚",
            },
            "14_days": {
                "title": "💔 Spark hasn't forgotten you!",
                "message": "2 weeks already! Your friends keep progressing. Come back and show what you can do! 💪",
                "email_subject": "We miss you on Studera!",
            },
            "30_days": {
                "title": "🐿️ Spark is still waiting...",
                "message": "A month without studying... But it's never too late to start again! Spark is always here for you 🐿️❤️",
                "email_subject": "It's never too late to come back! 🐿️",
            },
        },
        "es": {
            "3_days": {
                "title": "🐿️ ¡Spark te extraña!",
                "message": "¡Oye, llevas 3 días sin conectarte! Tu racha está en peligro... ¡Vuelve para una sesión rápida! 📚",
                "email_subject": "🐿️ ¡Spark te extraña!",
            },
            "7_days": {
                "title": "😢 Spark te busca...",
                "message": "Una semana sin ti... ¡Tus flashcards se acumulan y Spark está triste! ¿Solo 5 minutos hoy? 🥺",
                "email_subject": "Ha pasado una semana... ¿vuelves? 📚",
            },
            "14_days": {
                "title": "💔 ¡Spark no te olvida!",
                "message": "¡2 semanas ya! Tus amigos siguen progresando. ¡Vuelve a demostrar lo que vales! 💪",
                "email_subject": "¡Te echamos de menos en Studera!",
            },
            "30_days": {
                "title": "🐿️ Spark te sigue esperando...",
                "message": "Un mes sin estudiar... ¡Pero nunca es tarde para retomar! Spark siempre estará aquí para ti 🐿️❤️",
                "email_subject": "¡Nunca es tarde para volver! 🐿️",
            },
        },
        "ar": {
            "3_days": {
                "title": "🐿️ سبارك يفتقدك!",
                "message": "مرحبًا، مرت 3 أيام منذ آخر لقاء لنا! سلسلتك في خطر... عُد بسرعة لجلسة قصيرة! 📚",
                "email_subject": "🐿️ سبارك يفتقدك!",
            },
            "7_days": {
                "title": "😢 سبارك يبحث عنك...",
                "message": "أسبوع كامل بدونك... بطاقاتك تتراكم وسبارك حزين! فقط 5 دقائق اليوم؟ 🥺",
                "email_subject": "مر أسبوع... هل ستعود؟ 📚",
            },
            "14_days": {
                "title": "💔 سبارك لم ينساك!",
                "message": "أسبوعان مرّا! أصدقاؤك يواصلون التقدم. عُد وأظهر ما تستطيع! 💪",
                "email_subject": "نشتاق إليك في ستوديرا!",
            },
            "30_days": {
                "title": "🐿️ سبارك لا يزال ينتظر...",
                "message": "شهر بدون دراسة... لكن لم يفت الأوان أبدًا للبدء من جديد! سبارك دائمًا هنا من أجلك 🐿️❤️",
                "email_subject": "لم يفت الأوان للعودة! 🐿️",
            },
        },
    }

    @classmethod
    def get_inactivity_reminder(cls, lang: str, days_absent: int) -> Dict[str, str]:
        """Obtient le message de rappel d'inactivité selon le nombre de jours d'absence"""
        lang = get_spark_language(lang)
        messages = cls.INACTIVITY_REMINDER.get(lang, cls.INACTIVITY_REMINDER["fr"])

        if days_absent >= 30:
            return messages["30_days"]
        elif days_absent >= 14:
            return messages["14_days"]
        elif days_absent >= 7:
            return messages["7_days"]
        else:
            return messages["3_days"]

    @classmethod
    def get_achievement_unlocked(cls, lang: str, name: str, xp: int) -> Tuple[str, str]:
        """Obtient message et titre pour achievement débloqué"""
        lang = get_spark_language(lang)
        data = cls.ACHIEVEMENT_UNLOCKED.get(lang, cls.ACHIEVEMENT_UNLOCKED["fr"])
        return data["message"].format(name=name, xp=xp), data["title"]

    @classmethod
    def get_level_up(cls, lang: str, level: int) -> Tuple[str, str]:
        """Obtient message et titre pour level up"""
        lang = get_spark_language(lang)
        data = cls.LEVEL_UP.get(lang, cls.LEVEL_UP["fr"])
        return data["message"].format(level=level), data["title"].format(level=level)

    @classmethod
    def get_duel_challenge(cls, lang: str, challenger: str, xp: int) -> Tuple[str, str]:
        """Obtient message et titre pour défi de duel"""
        lang = get_spark_language(lang)
        data = cls.DUEL_CHALLENGE.get(lang, cls.DUEL_CHALLENGE["fr"])
        return data["message"].format(challenger=challenger, xp=xp), data["title"]

    @classmethod
    def get_focus_room_invite(cls, lang: str, inviter: str, room: str) -> Tuple[str, str]:
        """Obtient message et titre pour invitation focus room"""
        lang = get_spark_language(lang)
        data = cls.FOCUS_ROOM_INVITE.get(lang, cls.FOCUS_ROOM_INVITE["fr"])
        return data["message"].format(inviter=inviter, room=room), data["title"]

    @classmethod
    def get_focus_room_invite_accepted(cls, lang: str, invitee: str, room: str) -> Tuple[str, str]:
        """Obtient message et titre pour invitation acceptée"""
        lang = get_spark_language(lang)
        data = cls.FOCUS_ROOM_INVITE_ACCEPTED.get(lang, cls.FOCUS_ROOM_INVITE_ACCEPTED["fr"])
        return data["message"].format(invitee=invitee, room=room), data["title"]

    @classmethod
    def get_event_type_label(cls, lang: str, event_type: str) -> str:
        """Obtient le label traduit pour un type d'événement"""
        lang = get_spark_language(lang)
        labels = cls.EVENT_TYPE_LABELS.get(lang, cls.EVENT_TYPE_LABELS["fr"])
        return labels.get(event_type, labels["other"])

    @classmethod
    def get_tier_name(cls, lang: str, tier: str) -> str:
        """Obtient le nom traduit d'une ligue"""
        lang = get_spark_language(lang)
        names = cls.LEAGUE_TIER_NAMES.get(lang, cls.LEAGUE_TIER_NAMES["fr"])
        return names.get(tier, tier.capitalize())

    @classmethod
    def get_league_promotion(cls, lang: str, from_tier: str, to_tier: str) -> Tuple[str, str]:
        """Obtient message et titre pour promotion de ligue"""
        lang = get_spark_language(lang)
        data = cls.LEAGUE_PROMOTION.get(lang, cls.LEAGUE_PROMOTION["fr"])
        from_name = cls.get_tier_name(lang, from_tier)
        to_name = cls.get_tier_name(lang, to_tier)
        return data["message"].format(from_tier=from_name, to_tier=to_name), data["title"].format(to_tier=to_name)

    @classmethod
    def get_league_demotion(cls, lang: str, from_tier: str, to_tier: str) -> Tuple[str, str]:
        """Obtient message et titre pour rétrogradation de ligue"""
        lang = get_spark_language(lang)
        data = cls.LEAGUE_DEMOTION.get(lang, cls.LEAGUE_DEMOTION["fr"])
        from_name = cls.get_tier_name(lang, from_tier)
        to_name = cls.get_tier_name(lang, to_tier)
        return data["message"].format(from_tier=from_name, to_tier=to_name), data["title"].format(to_tier=to_name)


# Instance globale pour faciliter l'import
spark_messages = SparkNotificationMessages()

# Export de la fonction de normalisation pour les autres modules
__all__ = ["SparkNotificationMessages", "spark_messages", "get_spark_language", "SPARK_SUPPORTED_LANGUAGES"]
