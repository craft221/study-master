"""
Script pour créer toutes les tables de la base de données
"""
import asyncio
from app.core.database import engine, Base
from app.models import (
    user, subject, note, flashcard, quiz,
    study_session, collaboration, gamification, group_message
)


async def init_db():
    """Crée toutes les tables"""
    print("🔧 Création des tables de la base de données...")
    
    async with engine.begin() as conn:
        # Drop all tables (attention en production!)
        # await conn.run_sync(Base.metadata.drop_all)
        
        # Create all tables
        await conn.run_sync(Base.metadata.create_all)
    
    print("✅ Tables créées avec succès!")
    print("\n📊 Tables créées:")
    print("- users")
    print("- subjects")
    print("- notes")
    print("- flashcards")
    print("- quizzes")
    print("- quiz_questions")
    print("- quiz_attempts")
    print("- study_sessions")
    print("- schedules")
    print("- achievements")
    print("- user_achievements")
    print("- leaderboards")
    print("- study_groups")
    print("- group_members")
    print("- group_messages")
    print("- duels")
    print("- shared_notes")
    print("- note_comments")


if __name__ == "__main__":
    asyncio.run(init_db())
