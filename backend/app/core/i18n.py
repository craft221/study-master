"""
Internationalisation (i18n) - Instructions de langue pour l'IA
==============================================================

Ce module fournit les instructions de langue pour Claude AI.
Les prompts restent en français, seule l'instruction de langue change.
"""

from typing import Dict

# Langues supportées
SUPPORTED_LANGUAGES = ["fr", "en", "es", "pt", "ar", "de", "it", "zh", "ja", "ko"]

# Instructions de langue pour Claude (à ajouter au system prompt)
LANGUAGE_INSTRUCTIONS: Dict[str, str] = {
    "fr": "IMPORTANT: Tu DOIS répondre UNIQUEMENT en français. Tout le contenu généré doit être en français.",
    "en": "IMPORTANT: You MUST respond ONLY in English. All generated content must be in English.",
    "es": "IMPORTANTE: DEBES responder ÚNICAMENTE en español. Todo el contenido generado debe estar en español.",
    "pt": "IMPORTANTE: Você DEVE responder APENAS em português. Todo o conteúdo gerado deve estar em português.",
    "ar": "مهم: يجب عليك الرد باللغة العربية فقط. يجب أن يكون كل المحتوى المُنشأ باللغة العربية.",
    "de": "WICHTIG: Du MUSST NUR auf Deutsch antworten. Alle generierten Inhalte müssen auf Deutsch sein.",
    "it": "IMPORTANTE: DEVI rispondere SOLO in italiano. Tutti i contenuti generati devono essere in italiano.",
    "zh": "重要：你必须只用中文回答。所有生成的内容必须是中文。",
    "ja": "重要：日本語でのみ回答してください。生成されるすべてのコンテンツは日本語である必要があります。",
    "ko": "중요: 반드시 한국어로만 응답해야 합니다. 생성된 모든 콘텐츠는 한국어여야 합니다.",
}

# Noms des langues pour l'affichage
LANGUAGE_NAMES: Dict[str, Dict[str, str]] = {
    "fr": {"native": "Français", "en": "French"},
    "en": {"native": "English", "en": "English"},
    "es": {"native": "Español", "en": "Spanish"},
    "pt": {"native": "Português", "en": "Portuguese"},
    "ar": {"native": "العربية", "en": "Arabic"},
    "de": {"native": "Deutsch", "en": "German"},
    "it": {"native": "Italiano", "en": "Italian"},
    "zh": {"native": "中文", "en": "Chinese"},
    "ja": {"native": "日本語", "en": "Japanese"},
    "ko": {"native": "한국어", "en": "Korean"},
}


def get_language_instruction(lang: str) -> str:
    """
    Retourne l'instruction de langue pour Claude AI.

    Args:
        lang: Code de langue (fr, en, es, etc.)

    Returns:
        Instruction à ajouter au system prompt
    """
    return LANGUAGE_INSTRUCTIONS.get(lang, LANGUAGE_INSTRUCTIONS["fr"])


def get_language_name(lang: str, display_lang: str = "native") -> str:
    """
    Retourne le nom d'une langue.

    Args:
        lang: Code de langue
        display_lang: "native" pour le nom natif, "en" pour le nom anglais

    Returns:
        Nom de la langue
    """
    lang_info = LANGUAGE_NAMES.get(lang, LANGUAGE_NAMES["fr"])
    return lang_info.get(display_lang, lang_info["native"])


def is_supported_language(lang: str) -> bool:
    """Vérifie si une langue est supportée."""
    return lang in SUPPORTED_LANGUAGES


def get_default_language() -> str:
    """Retourne la langue par défaut."""
    return "fr"


def normalize_language_code(lang: str) -> str:
    """
    Normalise un code de langue (ex: "fr-FR" -> "fr", "en-US" -> "en").

    Args:
        lang: Code de langue potentiellement avec région

    Returns:
        Code de langue normalisé (2 lettres)
    """
    if not lang:
        return get_default_language()

    # Extraire le code de langue principal (avant le tiret)
    base_lang = lang.split("-")[0].lower()

    # Vérifier si supporté, sinon retourner défaut
    if base_lang in SUPPORTED_LANGUAGES:
        return base_lang

    return get_default_language()


# Instructions spécifiques par type de contenu (optionnel, pour affiner)
CONTENT_TYPE_INSTRUCTIONS: Dict[str, Dict[str, str]] = {
    "flashcards": {
        "fr": "Les questions et réponses des flashcards doivent être claires et concises en français.",
        "en": "Flashcard questions and answers must be clear and concise in English.",
    },
    "quiz": {
        "fr": "Les questions du quiz et toutes les options de réponse doivent être en français.",
        "en": "Quiz questions and all answer options must be in English.",
    },
    "summary": {
        "fr": "Le résumé doit être rédigé dans un français clair et académique.",
        "en": "The summary must be written in clear, academic English.",
    },
    "explanation": {
        "fr": "L'explication doit être pédagogique et en français simple.",
        "en": "The explanation must be educational and in simple English.",
    },
    "mascot": {
        "fr": "Spark parle en français de manière amicale et encourageante.",
        "en": "Spark speaks in English in a friendly and encouraging way.",
    },
}


def get_content_instruction(content_type: str, lang: str) -> str:
    """
    Retourne une instruction spécifique au type de contenu.

    Args:
        content_type: Type de contenu (flashcards, quiz, summary, etc.)
        lang: Code de langue

    Returns:
        Instruction spécifique ou chaîne vide si non disponible
    """
    type_instructions = CONTENT_TYPE_INSTRUCTIONS.get(content_type, {})
    return type_instructions.get(lang, type_instructions.get("fr", ""))


def build_system_prompt_with_language(base_prompt: str, lang: str, content_type: str = None) -> str:
    """
    Construit un system prompt complet avec les instructions de langue.

    Args:
        base_prompt: Le prompt système de base
        lang: Code de langue de l'utilisateur
        content_type: Type de contenu (optionnel, pour instruction spécifique)

    Returns:
        System prompt complet avec instructions de langue
    """
    lang_instruction = get_language_instruction(lang)

    # Ajouter instruction spécifique au type si disponible
    content_instruction = ""
    if content_type:
        content_instruction = get_content_instruction(content_type, lang)
        if content_instruction:
            content_instruction = f"\n{content_instruction}"

    return f"{base_prompt}\n\n{lang_instruction}{content_instruction}"
