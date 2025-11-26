from fastapi import APIRouter, Depends, HTTPException, status, Query, Response
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_
from typing import List, Optional
from datetime import datetime

from app.core.database import get_db
from app.core.security import get_current_user
from app.models.user import User
from app.models.note import Note
from app.models.flashcard import Flashcard
from app.models.subject import Subject
from app.services.pdf_export_service import pdf_export_service

router = APIRouter()


@router.get("/note/{note_id}")
async def export_note_to_pdf(
    note_id: int,
    include_metadata: bool = Query(True, description="Include note metadata"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Exporter une note spécifique en PDF"""
    # Récupérer la note
    note = await db.get(Note, note_id)
    
    if not note or note.user_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Note not found"
        )
    
    # Récupérer le sujet
    subject_name = None
    if note.subject_id:
        subject = await db.get(Subject, note.subject_id)
        if subject:
            subject_name = subject.name
    
    # Préparer les données
    note_data = {
        'title': note.title,
        'content': note.content,
        'subject_name': subject_name,
        'author': current_user.username,
        'created_at': note.created_at,
        'tags': note.tags
    }
    
    # Générer le PDF
    pdf_bytes = await pdf_export_service.export_note_to_pdf(
        note_data=note_data,
        include_metadata=include_metadata
    )
    
    # Retourner le PDF
    filename = f"note_{note.id}_{note.title[:30].replace(' ', '_')}.pdf"
    
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={
            "Content-Disposition": f'attachment; filename="{filename}"'
        }
    )


@router.post("/notes/batch")
async def export_multiple_notes_to_pdf(
    note_ids: List[int],
    title: str = Query("Compilation de Notes", description="PDF document title"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Exporter plusieurs notes dans un seul PDF"""
    if not note_ids:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No note IDs provided"
        )
    
    if len(note_ids) > 50:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Maximum 50 notes per export"
        )
    
    # Récupérer les notes
    query = select(Note).where(
        and_(
            Note.id.in_(note_ids),
            Note.user_id == current_user.id
        )
    ).order_by(Note.created_at.desc())
    
    result = await db.execute(query)
    notes = result.scalars().all()
    
    if not notes:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No notes found"
        )
    
    # Préparer les données
    notes_data = []
    for note in notes:
        subject_name = None
        if note.subject_id:
            subject = await db.get(Subject, note.subject_id)
            if subject:
                subject_name = subject.name
        
        notes_data.append({
            'title': note.title,
            'content': note.content,
            'subject_name': subject_name,
            'created_at': note.created_at
        })
    
    # Générer le PDF
    pdf_bytes = await pdf_export_service.export_multiple_notes_to_pdf(
        notes=notes_data,
        title=title
    )
    
    filename = f"compilation_{len(notes)}_notes_{datetime.now().strftime('%Y%m%d')}.pdf"
    
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={
            "Content-Disposition": f'attachment; filename="{filename}"'
        }
    )


@router.get("/subject/{subject_id}/notes")
async def export_subject_notes_to_pdf(
    subject_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Exporter toutes les notes d'une matière en PDF"""
    # Vérifier le sujet
    subject = await db.get(Subject, subject_id)
    
    if not subject or subject.user_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Subject not found"
        )
    
    # Récupérer toutes les notes du sujet
    query = select(Note).where(
        and_(
            Note.subject_id == subject_id,
            Note.user_id == current_user.id
        )
    ).order_by(Note.created_at.desc())
    
    result = await db.execute(query)
    notes = result.scalars().all()
    
    if not notes:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No notes found for this subject"
        )
    
    # Préparer les données
    notes_data = []
    for note in notes:
        notes_data.append({
            'title': note.title,
            'content': note.content,
            'subject_name': subject.name,
            'created_at': note.created_at
        })
    
    # Générer le PDF
    title = f"Notes - {subject.name}"
    pdf_bytes = await pdf_export_service.export_multiple_notes_to_pdf(
        notes=notes_data,
        title=title
    )
    
    filename = f"notes_{subject.name.replace(' ', '_')}_{datetime.now().strftime('%Y%m%d')}.pdf"
    
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={
            "Content-Disposition": f'attachment; filename="{filename}"'
        }
    )


@router.get("/flashcards/{subject_id}")
async def export_flashcards_to_pdf(
    subject_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Exporter les flashcards d'une matière en PDF"""
    # Vérifier le sujet
    subject = await db.get(Subject, subject_id)
    
    if not subject or subject.user_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Subject not found"
        )
    
    # Récupérer les flashcards
    query = select(Flashcard).where(
        and_(
            Flashcard.subject_id == subject_id,
            Flashcard.user_id == current_user.id
        )
    ).order_by(Flashcard.created_at.desc())
    
    result = await db.execute(query)
    flashcards = result.scalars().all()
    
    if not flashcards:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No flashcards found for this subject"
        )
    
    # Préparer les données
    flashcards_data = []
    for card in flashcards:
        flashcards_data.append({
            'front': card.front,
            'back': card.back,
            'hint': card.hint
        })
    
    # Générer le PDF
    title = f"Flashcards - {subject.name}"
    pdf_bytes = await pdf_export_service.export_flashcards_to_pdf(
        flashcards=flashcards_data,
        title=title
    )
    
    filename = f"flashcards_{subject.name.replace(' ', '_')}_{datetime.now().strftime('%Y%m%d')}.pdf"
    
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={
            "Content-Disposition": f'attachment; filename="{filename}"'
        }
    )


@router.post("/flashcards/batch")
async def export_flashcard_batch_to_pdf(
    flashcard_ids: List[int],
    title: str = Query("Flashcards", description="PDF title"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Exporter une sélection de flashcards en PDF"""
    if not flashcard_ids:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No flashcard IDs provided"
        )
    
    # Récupérer les flashcards
    query = select(Flashcard).where(
        and_(
            Flashcard.id.in_(flashcard_ids),
            Flashcard.user_id == current_user.id
        )
    )
    
    result = await db.execute(query)
    flashcards = result.scalars().all()
    
    if not flashcards:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No flashcards found"
        )
    
    # Préparer les données
    flashcards_data = []
    for card in flashcards:
        flashcards_data.append({
            'front': card.front,
            'back': card.back,
            'hint': card.hint
        })
    
    # Générer le PDF
    pdf_bytes = await pdf_export_service.export_flashcards_to_pdf(
        flashcards=flashcards_data,
        title=title
    )
    
    filename = f"flashcards_{len(flashcards)}cards_{datetime.now().strftime('%Y%m%d')}.pdf"
    
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={
            "Content-Disposition": f'attachment; filename="{filename}"'
        }
    )


@router.get("/stats")
async def get_export_stats(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Statistiques d'export PDF de l'utilisateur"""
    # Compter les notes et flashcards exportables
    notes_query = select(Note).where(Note.user_id == current_user.id)
    notes_result = await db.execute(notes_query)
    total_notes = len(notes_result.scalars().all())
    
    flashcards_query = select(Flashcard).where(Flashcard.user_id == current_user.id)
    flashcards_result = await db.execute(flashcards_query)
    total_flashcards = len(flashcards_result.scalars().all())
    
    return {
        "total_exportable_notes": total_notes,
        "total_exportable_flashcards": total_flashcards,
        "export_formats": ["PDF"],
        "features": [
            "Single note export",
            "Multiple notes compilation",
            "Subject-based export",
            "Flashcard export",
            "Professional formatting",
            "Metadata inclusion"
        ]
    }
