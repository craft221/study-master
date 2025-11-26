from fastapi import FastAPI, APIRouter
from fastapi.middleware.cors import CORSMiddleware
from app.core.config import settings

# Import routers
from app.api.v1.auth import router as auth_router
from app.api.v1.subjects import router as subjects_router
from app.api.v1.notes import router as notes_router
from app.api.v1.flashcards import router as flashcards_router
from app.api.v1.quizzes import router as quizzes_router
from app.api.v1.users import router as users_router
from app.api.v1.ai import router as ai_router
from app.api.v1.study_sessions import router as study_sessions_router
from app.api.v1.schedules import router as schedules_router
from app.api.v1.achievements import router as achievements_router
from app.api.v1.leaderboards import router as leaderboards_router
from app.api.v1.study_groups import router as study_groups_router
from app.api.v1.group_messages import router as group_messages_router
from app.api.v1.duels import router as duels_router
from app.api.v1.ocr import router as ocr_router
from app.api.v1.export import router as export_router

# Create FastAPI app
app = FastAPI(
    title=settings.APP_NAME,
    description="API pour Study Master - L'application ultime d'apprentissage avec IA",
    version=settings.APP_VERSION,
    docs_url="/docs",
    redoc_url="/redoc"
)

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=settings.CORS_ALLOW_CREDENTIALS,
    allow_methods=settings.CORS_ALLOW_METHODS,
    allow_headers=settings.CORS_ALLOW_HEADERS,
)

# Create main router
router = APIRouter()


@router.get("/health")
async def health_check():
    """Health check endpoint"""
    return {
        "status": "ok", 
        "message": "Study Master API is running",
        "version": "1.0.0"
    }


# Include all routers
app.include_router(router, prefix="/api/v1")
app.include_router(auth_router, prefix="/api/v1/auth", tags=["Authentication"])
app.include_router(subjects_router, prefix="/api/v1/subjects", tags=["Subjects"])
app.include_router(notes_router, prefix="/api/v1/notes", tags=["Notes"])
app.include_router(flashcards_router, prefix="/api/v1/flashcards", tags=["Flashcards"])
app.include_router(quizzes_router, prefix="/api/v1/quizzes", tags=["Quizzes"])
app.include_router(users_router, prefix="/api/v1/users", tags=["Users"])
app.include_router(ai_router, prefix="/api/v1/ai", tags=["AI - Intelligence Artificielle"])
app.include_router(study_sessions_router, prefix="/api/v1/study-sessions", tags=["Study Sessions - Pomodoro"])
app.include_router(schedules_router, prefix="/api/v1/schedules", tags=["Schedules - Emploi du Temps"])
app.include_router(achievements_router, prefix="/api/v1/achievements", tags=["Achievements - Succès"])
app.include_router(leaderboards_router, prefix="/api/v1/leaderboards", tags=["Leaderboards - Classements"])
app.include_router(study_groups_router, prefix="/api/v1/study-groups", tags=["Study Groups - Groupes d'étude"])
app.include_router(group_messages_router, prefix="/api/v1/study-groups", tags=["Study Groups - Messages"])
app.include_router(duels_router, prefix="/api/v1/duels", tags=["Duels - Défis"])
app.include_router(ocr_router, prefix="/api/v1/ocr", tags=["OCR - Extraction de Texte"])
app.include_router(export_router, prefix="/api/v1/export", tags=["Export PDF"])


@app.on_event("startup")
async def startup_event():
    """Événement au démarrage de l'application"""
    print("🚀 Study Master API démarrée !")
    print(f"📚 Documentation disponible sur: http://localhost:8000/docs")


@app.on_event("shutdown")
async def shutdown_event():
    """Événement à l'arrêt de l'application"""
    print("👋 Study Master API arrêtée")