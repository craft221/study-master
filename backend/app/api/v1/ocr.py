from fastapi import APIRouter, Depends, HTTPException, status, UploadFile, File, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_
from typing import Optional
from datetime import datetime

from app.core.database import get_db
from app.core.security import get_current_user
from app.models.user import User
from app.models.note import Note
from app.models.subject import Subject
from app.services.ocr_service import ocr_service

router = APIRouter()


@router.post("/upload-pdf")
async def upload_pdf_and_extract_text(
    file: UploadFile = File(...),
    subject_id: Optional[int] = None,
    create_note: bool = False,
    language: str = Query("fra+eng", description="OCR language (fra, eng, fra+eng)"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Upload un PDF et extrait le texte via OCR
    Optionnellement, créer une note automatiquement
    """
    # Vérifier le type de fichier
    if not file.filename.lower().endswith('.pdf'):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Only PDF files are supported"
        )
    
    # Limiter la taille (50 MB max)
    MAX_FILE_SIZE = 50 * 1024 * 1024  # 50 MB
    file_content = await file.read()
    
    if len(file_content) > MAX_FILE_SIZE:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail="File size exceeds 50 MB limit"
        )
    
    # Extraire le texte via OCR
    result = await ocr_service.extract_text_from_pdf(
        pdf_file=file_content,
        language=language
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

        # XP bonus - utiliser les objets sous-jacents
        if current_user.gamification:
            current_user.gamification.total_xp += 15
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
    language: str = Query("fra+eng", description="OCR language"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Upload une image et extrait le texte via OCR
    """
    # Vérifier le type de fichier
    allowed_extensions = ['.jpg', '.jpeg', '.png', '.bmp', '.tiff', '.gif']
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
    
    # Extraire le texte
    result = await ocr_service.extract_text_from_image(
        image_file=file_content,
        language=language
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
        "character_count": len(result['text']),
        "word_count": len(result['text'].split())
    }


@router.get("/languages")
async def get_supported_languages(
    current_user: User = Depends(get_current_user)
):
    """Récupérer les langues supportées pour l'OCR"""
    languages = ocr_service.get_supported_languages()
    
    return {
        "supported_languages": languages,
        "combinations": [
            "fra",
            "eng",
            "fra+eng"
        ]
    }


@router.get("/stats")
async def get_ocr_stats(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Statistiques d'utilisation OCR de l'utilisateur"""
    # Compter les notes créées via OCR (basé sur les tags)
    query = select(Note).where(
        and_(
            Note.user_id == current_user.id,
            Note.tags.ilike('%pdf-import%')
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
