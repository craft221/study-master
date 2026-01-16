"""
Script de seeding pour les achievements
Exécuter avec: python seed_achievements.py
"""

import asyncio
import sys
import os

# Ajouter le répertoire parent au path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from sqlalchemy import select
from app.core.database import AsyncSessionLocal
from app.models.gamification import Achievement, AchievementCategory, AchievementRarity


# Liste complète des achievements
ACHIEVEMENTS_DATA = [
    # ==================== LEARNING ====================
    {
        "name": "Première Note",
        "description": "Créer votre première note",
        "category": AchievementCategory.LEARNING,
        "rarity": AchievementRarity.COMMON,
        "icon": "📝",
        "xp_reward": 10,
        "requirement_type": "notes_created",
        "requirement_value": 1
    },
    {
        "name": "Écrivain Amateur",
        "description": "Créer 10 notes",
        "category": AchievementCategory.LEARNING,
        "rarity": AchievementRarity.COMMON,
        "icon": "✍️",
        "xp_reward": 25,
        "requirement_type": "notes_created",
        "requirement_value": 10
    },
    {
        "name": "Écrivain Confirmé",
        "description": "Créer 50 notes",
        "category": AchievementCategory.LEARNING,
        "rarity": AchievementRarity.RARE,
        "icon": "📚",
        "xp_reward": 100,
        "requirement_type": "notes_created",
        "requirement_value": 50
    },
    {
        "name": "Écrivain Expert",
        "description": "Créer 100 notes",
        "category": AchievementCategory.LEARNING,
        "rarity": AchievementRarity.EPIC,
        "icon": "🏆",
        "xp_reward": 250,
        "requirement_type": "notes_created",
        "requirement_value": 100
    },
    {
        "name": "Bibliothécaire Légendaire",
        "description": "Créer 500 notes",
        "category": AchievementCategory.LEARNING,
        "rarity": AchievementRarity.LEGENDARY,
        "icon": "👑",
        "xp_reward": 1000,
        "requirement_type": "notes_created",
        "requirement_value": 500
    },
    {
        "name": "Première Flashcard",
        "description": "Créer votre première flashcard",
        "category": AchievementCategory.LEARNING,
        "rarity": AchievementRarity.COMMON,
        "icon": "🃏",
        "xp_reward": 10,
        "requirement_type": "flashcards_created",
        "requirement_value": 1
    },
    {
        "name": "Collectionneur de Cartes",
        "description": "Créer 25 flashcards",
        "category": AchievementCategory.LEARNING,
        "rarity": AchievementRarity.COMMON,
        "icon": "🎴",
        "xp_reward": 30,
        "requirement_type": "flashcards_created",
        "requirement_value": 25
    },
    {
        "name": "Maître des Flashcards",
        "description": "Créer 100 flashcards",
        "category": AchievementCategory.LEARNING,
        "rarity": AchievementRarity.RARE,
        "icon": "🎯",
        "xp_reward": 100,
        "requirement_type": "flashcards_created",
        "requirement_value": 100
    },
    {
        "name": "Légende des Flashcards",
        "description": "Créer 500 flashcards",
        "category": AchievementCategory.LEARNING,
        "rarity": AchievementRarity.LEGENDARY,
        "icon": "⭐",
        "xp_reward": 500,
        "requirement_type": "flashcards_created",
        "requirement_value": 500
    },
    {
        "name": "Premier Quiz",
        "description": "Compléter votre premier quiz",
        "category": AchievementCategory.LEARNING,
        "rarity": AchievementRarity.COMMON,
        "icon": "❓",
        "xp_reward": 10,
        "requirement_type": "quizzes_completed",
        "requirement_value": 1
    },
    {
        "name": "Amateur de Quiz",
        "description": "Compléter 10 quiz",
        "category": AchievementCategory.LEARNING,
        "rarity": AchievementRarity.COMMON,
        "icon": "🧠",
        "xp_reward": 30,
        "requirement_type": "quizzes_completed",
        "requirement_value": 10
    },
    {
        "name": "Expert en Quiz",
        "description": "Compléter 50 quiz",
        "category": AchievementCategory.LEARNING,
        "rarity": AchievementRarity.RARE,
        "icon": "🎓",
        "xp_reward": 150,
        "requirement_type": "quizzes_completed",
        "requirement_value": 50
    },
    {
        "name": "Maître des Quiz",
        "description": "Compléter 100 quiz",
        "category": AchievementCategory.LEARNING,
        "rarity": AchievementRarity.EPIC,
        "icon": "🏅",
        "xp_reward": 300,
        "requirement_type": "quizzes_completed",
        "requirement_value": 100
    },

    # ==================== STREAK ====================
    {
        "name": "Premier Jour",
        "description": "Se connecter 1 jour consécutif",
        "category": AchievementCategory.STREAK,
        "rarity": AchievementRarity.COMMON,
        "icon": "🔥",
        "xp_reward": 5,
        "requirement_type": "streak_days",
        "requirement_value": 1
    },
    {
        "name": "Semaine de Feu",
        "description": "Maintenir un streak de 7 jours",
        "category": AchievementCategory.STREAK,
        "rarity": AchievementRarity.COMMON,
        "icon": "🔥",
        "xp_reward": 50,
        "requirement_type": "streak_days",
        "requirement_value": 7
    },
    {
        "name": "Deux Semaines Intenses",
        "description": "Maintenir un streak de 14 jours",
        "category": AchievementCategory.STREAK,
        "rarity": AchievementRarity.RARE,
        "icon": "💪",
        "xp_reward": 100,
        "requirement_type": "streak_days",
        "requirement_value": 14
    },
    {
        "name": "Mois de Détermination",
        "description": "Maintenir un streak de 30 jours",
        "category": AchievementCategory.STREAK,
        "rarity": AchievementRarity.EPIC,
        "icon": "🌟",
        "xp_reward": 300,
        "requirement_type": "streak_days",
        "requirement_value": 30
    },
    {
        "name": "Engagement Trimestriel",
        "description": "Maintenir un streak de 90 jours",
        "category": AchievementCategory.STREAK,
        "rarity": AchievementRarity.LEGENDARY,
        "icon": "💎",
        "xp_reward": 1000,
        "requirement_type": "streak_days",
        "requirement_value": 90
    },
    {
        "name": "Année de Persévérance",
        "description": "Maintenir un streak de 365 jours",
        "category": AchievementCategory.STREAK,
        "rarity": AchievementRarity.LEGENDARY,
        "icon": "👑",
        "xp_reward": 5000,
        "requirement_type": "streak_days",
        "requirement_value": 365
    },

    # ==================== MASTERY ====================
    {
        "name": "Score Parfait",
        "description": "Obtenir 100% à un quiz",
        "category": AchievementCategory.MASTERY,
        "rarity": AchievementRarity.RARE,
        "icon": "💯",
        "xp_reward": 50,
        "requirement_type": "perfect_quizzes",
        "requirement_value": 1
    },
    {
        "name": "Perfectionniste",
        "description": "Obtenir 100% à 10 quiz",
        "category": AchievementCategory.MASTERY,
        "rarity": AchievementRarity.EPIC,
        "icon": "🎯",
        "xp_reward": 200,
        "requirement_type": "perfect_quizzes",
        "requirement_value": 10
    },
    {
        "name": "Sans Faute",
        "description": "Obtenir 100% à 50 quiz",
        "category": AchievementCategory.MASTERY,
        "rarity": AchievementRarity.LEGENDARY,
        "icon": "🏆",
        "xp_reward": 1000,
        "requirement_type": "perfect_quizzes",
        "requirement_value": 50
    },
    {
        "name": "Niveau 5",
        "description": "Atteindre le niveau 5",
        "category": AchievementCategory.MASTERY,
        "rarity": AchievementRarity.COMMON,
        "icon": "⬆️",
        "xp_reward": 25,
        "requirement_type": "level_reached",
        "requirement_value": 5
    },
    {
        "name": "Niveau 10",
        "description": "Atteindre le niveau 10",
        "category": AchievementCategory.MASTERY,
        "rarity": AchievementRarity.RARE,
        "icon": "🌟",
        "xp_reward": 100,
        "requirement_type": "level_reached",
        "requirement_value": 10
    },
    {
        "name": "Niveau 25",
        "description": "Atteindre le niveau 25",
        "category": AchievementCategory.MASTERY,
        "rarity": AchievementRarity.EPIC,
        "icon": "💫",
        "xp_reward": 500,
        "requirement_type": "level_reached",
        "requirement_value": 25
    },
    {
        "name": "Niveau 50",
        "description": "Atteindre le niveau 50",
        "category": AchievementCategory.MASTERY,
        "rarity": AchievementRarity.LEGENDARY,
        "icon": "👑",
        "xp_reward": 2000,
        "requirement_type": "level_reached",
        "requirement_value": 50
    },
    {
        "name": "1000 XP",
        "description": "Accumuler 1000 XP au total",
        "category": AchievementCategory.MASTERY,
        "rarity": AchievementRarity.COMMON,
        "icon": "✨",
        "xp_reward": 25,
        "requirement_type": "total_xp",
        "requirement_value": 1000
    },
    {
        "name": "10 000 XP",
        "description": "Accumuler 10 000 XP au total",
        "category": AchievementCategory.MASTERY,
        "rarity": AchievementRarity.RARE,
        "icon": "💎",
        "xp_reward": 100,
        "requirement_type": "total_xp",
        "requirement_value": 10000
    },
    {
        "name": "100 000 XP",
        "description": "Accumuler 100 000 XP au total",
        "category": AchievementCategory.MASTERY,
        "rarity": AchievementRarity.LEGENDARY,
        "icon": "🌈",
        "xp_reward": 1000,
        "requirement_type": "total_xp",
        "requirement_value": 100000
    },

    # ==================== SOCIAL ====================
    {
        "name": "Premier Duel",
        "description": "Participer à votre premier duel",
        "category": AchievementCategory.SOCIAL,
        "rarity": AchievementRarity.COMMON,
        "icon": "⚔️",
        "xp_reward": 15,
        "requirement_type": "duels_participated",
        "requirement_value": 1
    },
    {
        "name": "Duelliste",
        "description": "Participer à 10 duels",
        "category": AchievementCategory.SOCIAL,
        "rarity": AchievementRarity.COMMON,
        "icon": "🤺",
        "xp_reward": 50,
        "requirement_type": "duels_participated",
        "requirement_value": 10
    },
    {
        "name": "Champion de Duels",
        "description": "Gagner 25 duels",
        "category": AchievementCategory.SOCIAL,
        "rarity": AchievementRarity.RARE,
        "icon": "🏆",
        "xp_reward": 150,
        "requirement_type": "duels_won",
        "requirement_value": 25
    },
    {
        "name": "Légende des Duels",
        "description": "Gagner 100 duels",
        "category": AchievementCategory.SOCIAL,
        "rarity": AchievementRarity.LEGENDARY,
        "icon": "👑",
        "xp_reward": 500,
        "requirement_type": "duels_won",
        "requirement_value": 100
    },
    {
        "name": "Première Victoire",
        "description": "Gagner votre premier duel",
        "category": AchievementCategory.SOCIAL,
        "rarity": AchievementRarity.COMMON,
        "icon": "🥇",
        "xp_reward": 20,
        "requirement_type": "duels_won",
        "requirement_value": 1
    },

    # ==================== SPECIAL ====================
    {
        "name": "Bienvenue!",
        "description": "Créer votre compte",
        "category": AchievementCategory.SPECIAL,
        "rarity": AchievementRarity.COMMON,
        "icon": "🎉",
        "xp_reward": 10,
        "requirement_type": "account_created",
        "requirement_value": 1
    },
    {
        "name": "Import PDF",
        "description": "Importer votre premier PDF avec OCR",
        "category": AchievementCategory.SPECIAL,
        "rarity": AchievementRarity.COMMON,
        "icon": "📄",
        "xp_reward": 15,
        "requirement_type": "pdf_imported",
        "requirement_value": 1
    },
    {
        "name": "Scanner Pro",
        "description": "Importer 10 PDF avec OCR",
        "category": AchievementCategory.SPECIAL,
        "rarity": AchievementRarity.RARE,
        "icon": "📑",
        "xp_reward": 75,
        "requirement_type": "pdf_imported",
        "requirement_value": 10
    },
    {
        "name": "Explorateur",
        "description": "Visiter toutes les sections de l'application",
        "category": AchievementCategory.SPECIAL,
        "rarity": AchievementRarity.RARE,
        "icon": "🧭",
        "xp_reward": 50,
        "requirement_type": "sections_visited",
        "requirement_value": 10
    },
    {
        "name": "Quête Journalière",
        "description": "Compléter votre première quête journalière",
        "category": AchievementCategory.SPECIAL,
        "rarity": AchievementRarity.COMMON,
        "icon": "📋",
        "xp_reward": 15,
        "requirement_type": "daily_quests_completed",
        "requirement_value": 1
    },
    {
        "name": "Quêteur Assidu",
        "description": "Compléter 30 quêtes journalières",
        "category": AchievementCategory.SPECIAL,
        "rarity": AchievementRarity.RARE,
        "icon": "🎯",
        "xp_reward": 100,
        "requirement_type": "daily_quests_completed",
        "requirement_value": 30
    },
    {
        "name": "Maître des Quêtes",
        "description": "Compléter 100 quêtes journalières",
        "category": AchievementCategory.SPECIAL,
        "rarity": AchievementRarity.EPIC,
        "icon": "🏅",
        "xp_reward": 300,
        "requirement_type": "daily_quests_completed",
        "requirement_value": 100
    },
    {
        "name": "Session d'Étude",
        "description": "Étudier pendant 1 heure au total",
        "category": AchievementCategory.SPECIAL,
        "rarity": AchievementRarity.COMMON,
        "icon": "⏱️",
        "xp_reward": 20,
        "requirement_type": "study_minutes",
        "requirement_value": 60
    },
    {
        "name": "Étudiant Dévoué",
        "description": "Étudier pendant 10 heures au total",
        "category": AchievementCategory.SPECIAL,
        "rarity": AchievementRarity.RARE,
        "icon": "📖",
        "xp_reward": 100,
        "requirement_type": "study_minutes",
        "requirement_value": 600
    },
    {
        "name": "Scholar",
        "description": "Étudier pendant 100 heures au total",
        "category": AchievementCategory.SPECIAL,
        "rarity": AchievementRarity.LEGENDARY,
        "icon": "🎓",
        "xp_reward": 1000,
        "requirement_type": "study_minutes",
        "requirement_value": 6000
    },
]


async def seed_achievements():
    """Insérer les achievements dans la base de données"""
    async with AsyncSessionLocal() as db:
        # Vérifier si des achievements existent déjà
        result = await db.execute(select(Achievement))
        existing = result.scalars().all()

        if existing:
            print(f"⚠️  {len(existing)} achievements existent déjà dans la base de données.")
            response = input("Voulez-vous les supprimer et réinsérer? (y/N): ")
            if response.lower() != 'y':
                print("Opération annulée.")
                return

            # Supprimer les achievements existants
            for achievement in existing:
                await db.delete(achievement)
            await db.commit()
            print("✓ Achievements existants supprimés.")

        # Insérer les nouveaux achievements
        count = 0
        for data in ACHIEVEMENTS_DATA:
            achievement = Achievement(**data)
            db.add(achievement)
            count += 1

        await db.commit()
        print(f"✅ {count} achievements insérés avec succès!")

        # Afficher un résumé par catégorie
        print("\n📊 Résumé par catégorie:")
        categories = {}
        for data in ACHIEVEMENTS_DATA:
            cat = data["category"].value
            categories[cat] = categories.get(cat, 0) + 1

        for cat, num in categories.items():
            print(f"   - {cat}: {num}")

        print("\n📊 Résumé par rareté:")
        rarities = {}
        for data in ACHIEVEMENTS_DATA:
            rar = data["rarity"].value
            rarities[rar] = rarities.get(rar, 0) + 1

        for rar, num in rarities.items():
            print(f"   - {rar}: {num}")


async def seed_achievements_no_prompt():
    """Version sans prompt pour Docker - insère seulement si la table est vide"""
    async with AsyncSessionLocal() as db:
        # Vérifier si des achievements existent déjà
        result = await db.execute(select(Achievement))
        existing = result.scalars().all()

        if existing:
            print(f"ℹ️  {len(existing)} achievements existent déjà. Aucune action nécessaire.")
            return

        # Insérer les nouveaux achievements
        count = 0
        for data in ACHIEVEMENTS_DATA:
            achievement = Achievement(**data)
            db.add(achievement)
            count += 1

        await db.commit()
        print(f"✅ {count} achievements insérés avec succès!")


if __name__ == "__main__":
    import argparse
    parser = argparse.ArgumentParser(description="Seed achievements database")
    parser.add_argument("--no-prompt", action="store_true", help="Run without interactive prompts")
    args = parser.parse_args()

    if args.no_prompt:
        asyncio.run(seed_achievements_no_prompt())
    else:
        asyncio.run(seed_achievements())
