from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_
from typing import Optional, List
from datetime import datetime
import base64

from app.core.database import get_db
from app.core.security import get_current_user
from app.models.user import User
from app.models.note import Note
from app.models.subject import Subject
from app.services.ocr_service import ocr_service, OCRSizeLimitError
from app.tasks.ocr_tasks import process_ocr_async
from app.celery_app import celery_app

router = APIRouter()


@router.post("/upload-pdf")
async def upload_pdf_and_extract_text(
    file: UploadFile = File(...),
    subject_id: Optional[int] = None,
    create_note: bool = False,
    language: str = Query("fra+eng", description="OCR language code(s)"),
    detect_layout: bool = Query(True, description="Auto-detect tables and columns"),
    ai_post_process: bool = Query(False, description="Use AI to correct OCR errors"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Upload un PDF et extrait le texte via OCR

    Features:
    - Support de 10 langues (fra, eng, spa, por, ara, deu, ita, zho, jpn, kor)
    - Détection automatique de layout (tables, colonnes)
    - Post-traitement IA optionnel pour corriger les erreurs
    - Création automatique de note
    """
    # Vérifier le type de fichier
    if not file.filename.lower().endswith('.pdf'):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Only PDF files are supported"
        )

    # Limiter la taille (20 MB max - aligne sur ocr_service.MAX_PDF_SIZE_BYTES)
    MAX_FILE_SIZE = 20 * 1024 * 1024  # 20 MB
    file_content = await file.read()

    if len(file_content) > MAX_FILE_SIZE:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail="File size exceeds 20 MB limit"
        )

    # Extraire le texte via OCR avec les nouvelles options
    try:
        result = await ocr_service.extract_text_from_pdf(
            pdf_file=file_content,
            language=language,
            detect_layout=detect_layout,
            ai_post_process=ai_post_process
        )
    except OCRSizeLimitError as e:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail=str(e)
        )

    if not result['success']:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"OCR extraction failed: {result.get('error', 'Unknown error')}"
        )
    
    # Si demandé, créer une note automatiquement
    note_id = None
    if create_note and result['full_text']:
        # Vérifier le sujet si fourni
        if subject_id:
            subject = await db.get(Subject, subject_id)
            if not subject or subject.user_id != current_user.id:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="Subject not found"
                )
        
        # Créer la note
        new_note = Note(
            user_id=current_user.id,
            subject_id=subject_id,
            title=f"Note depuis PDF: {file.filename}",
            content=result['full_text'],
            tags=f"pdf-import,ocr,confidence-{result['average_confidence']}"
        )

        db.add(new_note)

        # Attribuer XP via le service centralisé (gère level up + notifications)
        from app.services.xp_service import award_xp
        await award_xp(
            user=current_user,
            amount=15,
            reason="Import PDF avec OCR",
            event_type="pdf_imported",
            db=db
        )

        if current_user.stats:
            current_user.stats.total_notes_created += 1

        await db.commit()
        await db.refresh(new_note)

        note_id = new_note.id
    
    return {
        "success": True,
        "filename": file.filename,
        "extracted_text": result['full_text'],
        "pages": result['pages'],
        "page_count": result['page_count'],
        "average_confidence": result['average_confidence'],
        "language": language,
        "note_created": create_note,
        "note_id": note_id,
        "character_count": len(result['full_text']),
        "word_count": len(result['full_text'].split())
    }


@router.post("/upload-image")
async def upload_image_and_extract_text(
    file: UploadFile = File(...),
    language: str = Query("fra+eng", description="OCR language code(s)"),
    detect_layout: bool = Query(True, description="Auto-detect tables and columns"),
    ai_post_process: bool = Query(False, description="Use AI to correct OCR errors"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Upload une image et extrait le texte via OCR

    Features:
    - Support de 10 langues
    - Détection automatique de layout (tables, colonnes)
    - Post-traitement IA optionnel
    """
    # Vérifier le type de fichier
    allowed_extensions = ['.jpg', '.jpeg', '.png', '.bmp', '.tiff', '.gif', '.webp']
    if not any(file.filename.lower().endswith(ext) for ext in allowed_extensions):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Unsupported file type. Allowed: {', '.join(allowed_extensions)}"
        )

    # Limiter la taille (10 MB max)
    MAX_FILE_SIZE = 10 * 1024 * 1024
    file_content = await file.read()

    if len(file_content) > MAX_FILE_SIZE:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail="File size exceeds 10 MB limit"
        )

    # Extraire le texte avec les nouvelles options
    try:
        result = await ocr_service.extract_text_from_image(
            image_file=file_content,
            language=language,
            detect_layout=detect_layout,
            ai_post_process=ai_post_process
        )
    except OCRSizeLimitError as e:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail=str(e)
        )

    if not result['success']:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"OCR extraction failed: {result.get('error', 'Unknown error')}"
        )

    return {
        "success": True,
        "filename": file.filename,
        "extracted_text": result['text'],
        "confidence": result['confidence'],
        "language": language,
        "layout_type": result.get('layout_type', 'unknown'),
        "character_count": len(result['text']),
        "word_count": len(result['text'].split())
    }


@router.get("/languages")
async def get_supported_languages(
    current_user: User = Depends(get_current_user)
):
    """
    Récupérer les langues supportées pour l'OCR

    Returns:
    - 10 langues individuelles alignées avec le backend
    - Combinaisons populaires pour documents multilingues
    """
    lang_data = ocr_service.get_supported_languages()

    return {
        "languages": lang_data['languages'],
        "combinations": lang_data['combinations'],
        "tips": {
            "single_language": "Utilisez une seule langue pour de meilleurs résultats si le document est monolingue",
            "multi_language": "Utilisez fra+eng pour des documents mixtes français/anglais",
            "rtl_languages": "L'arabe (ara) est supporté avec lecture droite-à-gauche",
            "asian_languages": "Chinois (zho), Japonais (jpn) et Coréen (kor) sont supportés"
        }
    }


@router.get("/stats")
async def get_ocr_stats(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Statistiques d'utilisation OCR de l'utilisateur"""
    # Compter les notes créées via OCR (basé sur les tags)
    # Note: tags est un champ JSON, on utilise cast pour chercher
    from sqlalchemy import cast, String
    query = select(Note).where(
        and_(
            Note.user_id == current_user.id,
            cast(Note.tags, String).ilike('%ocr%')
        )
    )

    result = await db.execute(query)
    ocr_notes = result.scalars().all()

    total_imported = len(ocr_notes)
    total_words = sum(len(note.content.split()) for note in ocr_notes)

    return {
        "total_pdf_imports": total_imported,
        "total_words_extracted": total_words,
        "notes_created_from_ocr": total_imported,
        "average_words_per_import": round(total_words / total_imported, 2) if total_imported > 0 else 0
    }


# =============================================================================
# ENDPOINTS ASYNCHRONES (Celery)
# =============================================================================

@router.post("/async/upload-pdf")
async def upload_pdf_async(
    file: UploadFile = File(...),
    subject_id: Optional[int] = None,
    create_note: bool = False,
    note_title: Optional[str] = None,
    language: str = Query("fra+eng", description="OCR language code(s)"),
    detect_layout: bool = Query(True, description="Auto-detect tables and columns"),
    ai_post_process: bool = Query(False, description="Use AI to correct OCR errors"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Upload un PDF et lance l'OCR en arrière-plan avec Celery

    Retourne immédiatement un task_id pour suivre la progression.
    Utilisez GET /ocr/task/{task_id} pour vérifier le status.

    Recommandé pour:
    - PDF de plus de 5 pages
    - Quand le post-traitement IA est activé
    - Documents volumineux
    """
    # Vérifier le type de fichier
    if not file.filename.lower().endswith('.pdf'):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Only PDF files are supported"
        )

    # Limiter la taille (20 MB max - aligne sur ocr_service.MAX_PDF_SIZE_BYTES)
    MAX_FILE_SIZE = 20 * 1024 * 1024
    file_content = await file.read()

    if len(file_content) > MAX_FILE_SIZE:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail="File size exceeds 20 MB limit"
        )

    # Vérifier le sujet si fourni
    if subject_id:
        subject = await db.get(Subject, subject_id)
        if not subject or subject.user_id != current_user.id:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Subject not found"
            )

    # Encoder le contenu en base64 pour Celery
    file_content_b64 = base64.b64encode(file_content).decode('utf-8')

    # Lancer la tâche Celery
    task = process_ocr_async.delay(
        file_content_b64=file_content_b64,
        file_type="pdf",
        language=language,
        detect_layout=detect_layout,
        ai_post_process=ai_post_process,
        user_id=current_user.id if create_note else None,
        create_note=create_note,
        subject_id=subject_id,
        note_title=note_title or f"Note OCR: {file.filename}"
    )

    return {
        "success": True,
        "task_id": task.id,
        "status": "PENDING",
        "message": "OCR processing started in background",
        "filename": file.filename,
        "check_status_url": f"/api/v1/ocr/task/{task.id}"
    }


@router.post("/async/upload-image")
async def upload_image_async(
    file: UploadFile = File(...),
    language: str = Query("fra+eng", description="OCR language code(s)"),
    detect_layout: bool = Query(True, description="Auto-detect tables and columns"),
    ai_post_process: bool = Query(False, description="Use AI to correct OCR errors"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Upload une image et lance l'OCR en arrière-plan avec Celery

    Retourne immédiatement un task_id pour suivre la progression.
    """
    allowed_extensions = ['.jpg', '.jpeg', '.png', '.bmp', '.tiff', '.gif', '.webp']
    if not any(file.filename.lower().endswith(ext) for ext in allowed_extensions):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Unsupported file type. Allowed: {', '.join(allowed_extensions)}"
        )

    MAX_FILE_SIZE = 10 * 1024 * 1024
    file_content = await file.read()

    if len(file_content) > MAX_FILE_SIZE:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail="File size exceeds 10 MB limit"
        )

    # Encoder en base64
    file_content_b64 = base64.b64encode(file_content).decode('utf-8')

    # Lancer la tâche Celery
    task = process_ocr_async.delay(
        file_content_b64=file_content_b64,
        file_type="image",
        language=language,
        detect_layout=detect_layout,
        ai_post_process=ai_post_process,
        user_id=None,
        create_note=False
    )

    return {
        "success": True,
        "task_id": task.id,
        "status": "PENDING",
        "message": "OCR processing started in background",
        "filename": file.filename,
        "check_status_url": f"/api/v1/ocr/task/{task.id}"
    }


@router.get("/task/{task_id}")
async def get_task_status(
    task_id: str,
    current_user: User = Depends(get_current_user)
):
    """
    Vérifier le status d'une tâche OCR asynchrone

    States possibles:
    - PENDING: En attente de traitement
    - PROCESSING: En cours de traitement (avec progress %)
    - SUCCESS: Terminé avec succès
    - FAILURE: Échec

    Quand status=SUCCESS, le résultat complet est dans 'result'.
    """
    task = celery_app.AsyncResult(task_id)

    response = {
        "task_id": task_id,
        "status": task.status,
    }

    if task.status == "PENDING":
        response["progress"] = 0
        response["message"] = "En attente de traitement..."

    elif task.status == "PROCESSING":
        meta = task.info or {}
        response["progress"] = meta.get("progress", 0)
        response["message"] = meta.get("status", "Traitement en cours...")
        response["current_page"] = meta.get("current_page")
        response["total_pages"] = meta.get("total_pages")

    elif task.status == "SUCCESS":
        response["progress"] = 100
        response["message"] = "Terminé"
        response["result"] = task.result

    elif task.status == "FAILURE":
        response["progress"] = 0
        response["message"] = "Échec du traitement"
        response["error"] = str(task.result) if task.result else "Unknown error"

    return response


@router.delete("/task/{task_id}")
async def cancel_task(
    task_id: str,
    current_user: User = Depends(get_current_user)
):
    """Annuler une tâche OCR en cours"""
    task = celery_app.AsyncResult(task_id)

    if task.status in ["PENDING", "PROCESSING"]:
        task.revoke(terminate=True)
        return {"success": True, "message": "Task cancelled"}

    return {"success": False, "message": f"Cannot cancel task with status: {task.status}"}
