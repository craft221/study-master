"""
SQL Utilities - Fonctions de sécurité SQL
==========================================

Fonctions utilitaires pour la sécurité des requêtes SQL.
"""


def escape_like_pattern(pattern: str) -> str:
    """
    SÉCURITÉ: Échappe les caractères spéciaux SQL LIKE pour éviter les injections.

    Les caractères spéciaux dans LIKE sont:
    - % : correspond à n'importe quelle séquence de caractères
    - _ : correspond à un seul caractère
    - \\ : caractère d'échappement

    On les échappe avec un backslash.

    Args:
        pattern: La chaîne de recherche à échapper

    Returns:
        La chaîne avec les caractères spéciaux échappés

    Examples:
        >>> escape_like_pattern("test%")
        'test\\\\%'
        >>> escape_like_pattern("user_name")
        'user\\\\_name'
        >>> escape_like_pattern("normal search")
        'normal search'
    """
    if not pattern:
        return ""
    # Échapper le backslash en premier (sinon on échappe nos propres échappements)
    pattern = pattern.replace("\\", "\\\\")
    # Échapper les caractères spéciaux LIKE
    pattern = pattern.replace("%", "\\%")
    pattern = pattern.replace("_", "\\_")
    return pattern


def build_search_pattern(query: str) -> str:
    """
    Construit un pattern de recherche LIKE sécurisé.

    Args:
        query: Terme de recherche brut

    Returns:
        Pattern LIKE avec wildcards (ex: "%escaped_query%")
    """
    safe_query = escape_like_pattern(query.strip())
    return f"%{safe_query}%"
