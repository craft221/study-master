"""
Tests pour les optimisations de Phase 2
=======================================

Tests pour valider:
1. Fonction escape_like_pattern centralisée
2. Service de cache pour recherches
3. Cache warming
4. Indexes DB (vérification que les fichiers existent)
"""

import pytest
import hashlib
from unittest.mock import MagicMock, AsyncMock, patch


class TestSQLEscapingCentralized:
    """Tests pour la fonction escape_like_pattern centralisée"""

    def test_escape_like_pattern_basic(self):
        """Test de base de la fonction escape_like_pattern"""
        from app.core.sql_utils import escape_like_pattern

        # Test caractères spéciaux SQL LIKE
        assert escape_like_pattern("%") == "\\%"
        assert escape_like_pattern("_") == "\\_"
        assert escape_like_pattern("\\") == "\\\\"

    def test_escape_like_pattern_combinations(self):
        """Test des combinaisons de caractères"""
        from app.core.sql_utils import escape_like_pattern

        assert escape_like_pattern("%test%") == "\\%test\\%"
        assert escape_like_pattern("test_name") == "test\\_name"
        assert escape_like_pattern("100%_done") == "100\\%\\_done"

    def test_escape_like_pattern_normal_strings(self):
        """Test que les chaînes normales ne changent pas"""
        from app.core.sql_utils import escape_like_pattern

        assert escape_like_pattern("normal search") == "normal search"
        assert escape_like_pattern("hello world") == "hello world"
        assert escape_like_pattern("test123") == "test123"

    def test_escape_like_pattern_empty(self):
        """Test chaîne vide"""
        from app.core.sql_utils import escape_like_pattern

        assert escape_like_pattern("") == ""
        assert escape_like_pattern(None) == ""

    def test_build_search_pattern(self):
        """Test de la fonction build_search_pattern"""
        from app.core.sql_utils import build_search_pattern

        assert build_search_pattern("test") == "%test%"
        assert build_search_pattern(" test ") == "%test%"  # Strip
        assert build_search_pattern("100%") == "%100\\%%"


class TestSearchCacheService:
    """Tests pour le service de cache de recherche"""

    def test_generate_search_key_basic(self):
        """Test génération de clé basique"""
        from app.services.search_cache_service import SearchCacheService

        service = SearchCacheService()

        key = service._generate_search_key(
            prefix="search:notes",
            user_id=123,
            query="test",
            page=1,
            page_size=20
        )

        assert "cache:search:notes" in key
        assert "u:123" in key
        assert "p:1:20" in key
        # Query hash should be present
        assert "q:" in key

    def test_generate_search_key_with_filters(self):
        """Test génération de clé avec filtres"""
        from app.services.search_cache_service import SearchCacheService

        service = SearchCacheService()

        key1 = service._generate_search_key(
            prefix="search:notes",
            user_id=1,
            page=1,
            page_size=20,
            subject_id=5,
            is_favorite=True
        )

        key2 = service._generate_search_key(
            prefix="search:notes",
            user_id=1,
            page=1,
            page_size=20,
            subject_id=5,
            is_favorite=True
        )

        # Mêmes paramètres = même clé
        assert key1 == key2

        key3 = service._generate_search_key(
            prefix="search:notes",
            user_id=1,
            page=1,
            page_size=20,
            subject_id=6,  # Différent
            is_favorite=True
        )

        # Paramètres différents = clé différente
        assert key1 != key3

    def test_generate_search_key_query_hash(self):
        """Test que les queries différentes génèrent des clés différentes"""
        from app.services.search_cache_service import SearchCacheService

        service = SearchCacheService()

        key1 = service._generate_search_key(
            prefix="search:notes",
            user_id=1,
            query="python",
            page=1,
            page_size=20
        )

        key2 = service._generate_search_key(
            prefix="search:notes",
            user_id=1,
            query="javascript",
            page=1,
            page_size=20
        )

        assert key1 != key2

    def test_search_metrics_initialization(self):
        """Test initialisation des métriques"""
        from app.services.search_cache_service import SearchCacheService

        service = SearchCacheService()
        metrics = service.get_search_metrics()

        assert "notes" in metrics
        assert "flashcards" in metrics
        assert "quizzes" in metrics
        assert "explore" in metrics

        for search_type in metrics:
            assert metrics[search_type]["hits"] == 0
            assert metrics[search_type]["misses"] == 0

    def test_reset_metrics(self):
        """Test reset des métriques"""
        from app.services.search_cache_service import SearchCacheService

        service = SearchCacheService()

        # Simuler des métriques
        service._search_metrics["notes"]["hits"] = 100
        service._search_metrics["notes"]["misses"] = 50

        # Reset
        service.reset_metrics()

        metrics = service.get_search_metrics()
        assert metrics["notes"]["hits"] == 0
        assert metrics["notes"]["misses"] == 0


class TestSearchCachePrefixes:
    """Tests pour les préfixes de cache de recherche"""

    def test_search_cache_prefix_values(self):
        """Test que tous les préfixes sont définis"""
        from app.services.search_cache_service import SearchCachePrefix

        assert SearchCachePrefix.NOTES_SEARCH == "search:notes"
        assert SearchCachePrefix.NOTES_LIST == "search:notes:list"
        assert SearchCachePrefix.FLASHCARDS_SEARCH == "search:flashcards"
        assert SearchCachePrefix.QUIZZES_SEARCH == "search:quizzes"
        assert SearchCachePrefix.EXPLORE_PUBLIC == "search:explore"
        assert SearchCachePrefix.EXPLORE_TRENDING == "search:explore:trending"

    def test_search_cache_ttl_values(self):
        """Test que les TTL sont raisonnables"""
        from app.services.search_cache_service import SearchCacheTTL

        assert SearchCacheTTL.USER_SEARCH == 120  # 2 minutes
        assert SearchCacheTTL.PUBLIC_SEARCH == 300  # 5 minutes
        assert SearchCacheTTL.TRENDING == 600  # 10 minutes
        assert SearchCacheTTL.POPULAR_SUBJECTS == 1800  # 30 minutes


class TestIndexesMigration:
    """Tests pour vérifier que la migration des indexes existe"""

    def test_migration_file_exists(self):
        """Vérifie que le fichier de migration existe"""
        import os
        migration_path = "C:\\Users\\HP\\Downloads\\study-master\\study-master\\backend\\alembic\\versions\\add_performance_indexes.py"

        assert os.path.exists(migration_path), "Migration file should exist"

    def test_migration_contains_required_indexes(self):
        """Vérifie que la migration contient les indexes critiques"""
        migration_path = "C:\\Users\\HP\\Downloads\\study-master\\study-master\\backend\\alembic\\versions\\add_performance_indexes.py"

        with open(migration_path, "r", encoding="utf-8") as f:
            content = f.read()

        # Indexes critiques qui doivent être présents
        critical_indexes = [
            "idx_notes_user_id",
            "idx_flashcards_user_next_review",  # Critical pour spaced repetition
            "idx_quizzes_share_code",
            "idx_quizzes_public_popular",
            "idx_users_is_active",
            "pg_trgm",  # Extension pour text search
        ]

        for index in critical_indexes:
            assert index in content, f"Critical index {index} should be in migration"

    def test_migration_has_upgrade_and_downgrade(self):
        """Vérifie que la migration a upgrade et downgrade"""
        migration_path = "C:\\Users\\HP\\Downloads\\study-master\\study-master\\backend\\alembic\\versions\\add_performance_indexes.py"

        with open(migration_path, "r", encoding="utf-8") as f:
            content = f.read()

        assert "def upgrade()" in content
        assert "def downgrade()" in content
        assert "DROP INDEX" in content  # Downgrade should drop indexes


class TestSQLEscapingInAllFiles:
    """Tests pour vérifier que escape_like_pattern est utilisé partout"""

    def test_study_groups_uses_escape(self):
        """Vérifie que study_groups.py utilise escape_like_pattern"""
        filepath = "C:\\Users\\HP\\Downloads\\study-master\\study-master\\backend\\app\\api\\v1\\study_groups.py"

        with open(filepath, "r", encoding="utf-8") as f:
            content = f.read()

        assert "from app.core.sql_utils import escape_like_pattern" in content
        assert "safe_search = escape_like_pattern" in content

    def test_documents_uses_escape(self):
        """Vérifie que documents.py utilise escape_like_pattern"""
        filepath = "C:\\Users\\HP\\Downloads\\study-master\\study-master\\backend\\app\\api\\v1\\documents.py"

        with open(filepath, "r", encoding="utf-8") as f:
            content = f.read()

        assert "from app.core.sql_utils import escape_like_pattern" in content
        assert "safe_search = escape_like_pattern" in content

    def test_flashcards_uses_escape(self):
        """Vérifie que flashcards.py utilise escape_like_pattern"""
        filepath = "C:\\Users\\HP\\Downloads\\study-master\\study-master\\backend\\app\\api\\v1\\flashcards.py"

        with open(filepath, "r", encoding="utf-8") as f:
            content = f.read()

        assert "from app.core.sql_utils import escape_like_pattern" in content
        assert "escape_like_pattern" in content

    def test_focus_room_service_uses_escape(self):
        """Vérifie que focus_room_service.py utilise escape_like_pattern"""
        filepath = "C:\\Users\\HP\\Downloads\\study-master\\study-master\\backend\\app\\services\\focus_room_service.py"

        with open(filepath, "r", encoding="utf-8") as f:
            content = f.read()

        assert "from app.core.sql_utils import escape_like_pattern" in content
        assert "safe_search = escape_like_pattern" in content

    def test_users_uses_escape(self):
        """Vérifie que users.py utilise escape_like_pattern"""
        filepath = "C:\\Users\\HP\\Downloads\\study-master\\study-master\\backend\\app\\api\\v1\\users.py"

        with open(filepath, "r", encoding="utf-8") as f:
            content = f.read()

        assert "from app.core.sql_utils import escape_like_pattern" in content
        assert "escape_like_pattern(q)" in content


class TestCacheWarmingIntegration:
    """Tests pour le cache warming"""

    def test_main_imports_search_cache(self):
        """Vérifie que main.py importe search_cache"""
        filepath = "C:\\Users\\HP\\Downloads\\study-master\\study-master\\backend\\app\\main.py"

        with open(filepath, "r", encoding="utf-8") as f:
            content = f.read()

        assert "from app.services.search_cache_service import search_cache" in content

    def test_main_has_cache_warming(self):
        """Vérifie que main.py a le cache warming au démarrage"""
        filepath = "C:\\Users\\HP\\Downloads\\study-master\\study-master\\backend\\app\\main.py"

        with open(filepath, "r", encoding="utf-8") as f:
            content = f.read()

        assert "warm_caches" in content
        assert "warm_all_caches" in content
        assert "Cache warming" in content

    def test_main_has_cache_endpoints(self):
        """Vérifie que main.py a les nouveaux endpoints de cache"""
        filepath = "C:\\Users\\HP\\Downloads\\study-master\\study-master\\backend\\app\\main.py"

        with open(filepath, "r", encoding="utf-8") as f:
            content = f.read()

        assert "cache/search-metrics" in content
        assert "cache/warm" in content
        assert "invalidate_explore_cache" in content


class TestSQLUtilsModule:
    """Tests pour le module sql_utils"""

    def test_sql_utils_module_exists(self):
        """Vérifie que le module sql_utils existe"""
        import os
        module_path = "C:\\Users\\HP\\Downloads\\study-master\\study-master\\backend\\app\\core\\sql_utils.py"

        assert os.path.exists(module_path), "sql_utils.py should exist"

    def test_sql_utils_has_both_functions(self):
        """Vérifie que le module a les deux fonctions"""
        filepath = "C:\\Users\\HP\\Downloads\\study-master\\study-master\\backend\\app\\core\\sql_utils.py"

        with open(filepath, "r", encoding="utf-8") as f:
            content = f.read()

        assert "def escape_like_pattern" in content
        assert "def build_search_pattern" in content

    def test_sql_utils_has_documentation(self):
        """Vérifie que les fonctions sont documentées"""
        filepath = "C:\\Users\\HP\\Downloads\\study-master\\study-master\\backend\\app\\core\\sql_utils.py"

        with open(filepath, "r", encoding="utf-8") as f:
            content = f.read()

        assert '"""' in content  # Docstrings
        assert "Args:" in content
        assert "Returns:" in content


class TestSearchCacheServiceModule:
    """Tests pour le module search_cache_service"""

    def test_search_cache_service_exists(self):
        """Vérifie que le module search_cache_service existe"""
        import os
        module_path = "C:\\Users\\HP\\Downloads\\study-master\\study-master\\backend\\app\\services\\search_cache_service.py"

        assert os.path.exists(module_path), "search_cache_service.py should exist"

    def test_search_cache_service_has_global_instance(self):
        """Vérifie que le module a une instance globale"""
        filepath = "C:\\Users\\HP\\Downloads\\study-master\\study-master\\backend\\app\\services\\search_cache_service.py"

        with open(filepath, "r", encoding="utf-8") as f:
            content = f.read()

        assert "search_cache = SearchCacheService()" in content

    def test_search_cache_service_has_decorators(self):
        """Vérifie que le module a les décorateurs"""
        filepath = "C:\\Users\\HP\\Downloads\\study-master\\study-master\\backend\\app\\services\\search_cache_service.py"

        with open(filepath, "r", encoding="utf-8") as f:
            content = f.read()

        assert "def cached_search" in content
        assert "def invalidate_on_change" in content

    def test_search_cache_service_has_warming_methods(self):
        """Vérifie que le service a les méthodes de warming"""
        filepath = "C:\\Users\\HP\\Downloads\\study-master\\study-master\\backend\\app\\services\\search_cache_service.py"

        with open(filepath, "r", encoding="utf-8") as f:
            content = f.read()

        assert "async def warm_trending_cache" in content
        assert "async def warm_popular_subjects_cache" in content
        assert "async def warm_public_content_cache" in content
        assert "async def warm_all_caches" in content
