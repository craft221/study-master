from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, and_, or_
from typing import Optional, List

from app.core.database import get_db
from app.core.security import get_current_active_user
from app.models.user import User
from app.models.subject import Subject
from app.models.note import Note
from app.schemas.note import (
    NoteCreate,
    NoteUpdate,
    NoteResponse,
    NoteListResponse,
    NoteWithChildren
)

router = APIRouter()


@router.post("/", response_model=NoteResponse, status_code=status.HTTP_201_CREATED)
async def create_note(
    note_data: NoteCreate,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    """Créer une nouvelle note"""
    
    result = await db.execute(
        select(Subject).where(
            and_(
                Subject.id == note_data.subject_id,
                Subject.user_id == current_user.id
            )
        )
    )
    subject = result.scalar_one_or_none()
    
    if not subject:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Matière non trouvée"
        )
    
    if note_data.parent_id:
        result = await db.execute(
            select(Note).where(
                and_(
                    Note.id == note_data.parent_id,
                    Note.user_id == current_user.id
                )
            )
        )
        parent_note = result.scalar_one_or_none()
        if not parent_note:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Note parente non trouvée"
            )
    
    new_note = Note(
        user_id=current_user.id,
        **note_data.model_dump()
    )
    
    new_note.word_count = new_note.calculate_word_count()
    new_note.read_time_minutes = new_note.calculate_read_time()
    
    db.add(new_note)
    
    subject.total_notes_count += 1
    current_user.total_xp += 10
    current_user.total_notes_created += 1
    
    await db.commit()
    await db.refresh(new_note)
    
    return new_note


@router.get("/", response_model=NoteListResponse)
async def list_notes(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    subject_id: Optional[int] = None,
    note_type: Optional[str] = None,
    tags: Optional[str] = None,
    is_pinned: Optional[bool] = None,
    is_favorite: Optional[bool] = None,
    is_archived: Optional[bool] = False,
    parent_id: Optional[int] = None,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    """Récupérer la liste des notes"""
    
    query = select(Note).where(Note.user_id == current_user.id)
    
    if subject_id:
        query = query.where(Note.subject_id == subject_id)
    if note_type:
        query = query.where(Note.note_type == note_type)
    if tags:
        tag_list = [t.strip() for t in tags.split(",")]
        query = query.where(Note.tags.overlap(tag_list))
    if is_pinned is not None:
        query = query.where(Note.is_pinned == is_pinned)
    if is_favorite is not None:
        query = query.where(Note.is_favorite == is_favorite)
    if is_archived is not None:
        query = query.where(Note.is_archived == is_archived)
    if parent_id is not None:
        query = query.where(Note.parent_id == parent_id)
    
    count_query = select(func.count()).select_from(query.subquery())
    total_result = await db.execute(count_query)
    total = total_result.scalar()
    
    query = query.offset((page - 1) * page_size).limit(page_size)
    query = query.order_by(
        Note.is_pinned.desc(),
        Note.is_favorite.desc(),
        Note.updated_at.desc()
    )
    
    result = await db.execute(query)
    notes = result.scalars().all()
    
    return {
        "notes": notes,
        "total": total,
        "page": page,
        "page_size": page_size
    }


@router.get("/{note_id}", response_model=NoteResponse)
async def get_note(
    note_id: int,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    """Récupérer les détails d'une note"""
    
    result = await db.execute(
        select(Note).where(
            and_(
                Note.id == note_id,
                Note.user_id == current_user.id
            )
        )
    )
    note = result.scalar_one_or_none()
    
    if not note:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Note non trouvée"
        )
    
    note.views_count += 1
    note.last_viewed_at = func.now()
    await db.commit()
    await db.refresh(note)
    
    return note


@router.get("/{note_id}/with-children", response_model=NoteWithChildren)
async def get_note_with_children(
    note_id: int,
    max_depth: int = Query(3, ge=1, le=5),
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    """Récupérer une note avec toutes ses notes enfants (hiérarchie)"""
    
    async def load_children(note_id: int, depth: int = 0) -> List[Note]:
        if depth >= max_depth:
            return []
        
        result = await db.execute(
            select(Note).where(
                and_(
                    Note.parent_id == note_id,
                    Note.user_id == current_user.id
                )
            ).order_by(Note.order, Note.created_at)
        )
        children = result.scalars().all()
        
        for child in children:
            child.children = await load_children(child.id, depth + 1)
        
        return children
    
    result = await db.execute(
        select(Note).where(
            and_(
                Note.id == note_id,
                Note.user_id == current_user.id
            )
        )
    )
    note = result.scalar_one_or_none()
    
    if not note:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Note non trouvée"
        )
    
    note.children = await load_children(note.id)
    
    return note


@router.put("/{note_id}", response_model=NoteResponse)
async def update_note(
    note_id: int,
    note_data: NoteUpdate,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    """Mettre à jour une note"""
    
    result = await db.execute(
        select(Note).where(
            and_(
                Note.id == note_id,
                Note.user_id == current_user.id
            )
        )
    )
    note = result.scalar_one_or_none()
    
    if not note:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Note non trouvée"
        )
    
    update_data = note_data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(note, field, value)
    
    if 'content' in update_data:
        note.word_count = note.calculate_word_count()
        note.read_time_minutes = note.calculate_read_time()
        note.version += 1
    
    await db.commit()
    await db.refresh(note)
    
    return note


@router.delete("/{note_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_note(
    note_id: int,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    """Supprimer une note"""
    
    result = await db.execute(
        select(Note).where(
            and_(
                Note.id == note_id,
                Note.user_id == current_user.id
            )
        )
    )
    note = result.scalar_one_or_none()
    
    if not note:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Note non trouvée"
        )
    
    result = await db.execute(
        select(Subject).where(Subject.id == note.subject_id)
    )
    subject = result.scalar_one_or_none()
    if subject:
        subject.total_notes_count = max(0, subject.total_notes_count - 1)
    
    await db.delete(note)
    await db.commit()
    
    return None


@router.get("/search", response_model=NoteListResponse)
async def search_notes(
    q: str = Query(..., min_length=2, description="Recherche"),
    subject_id: Optional[int] = None,
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    """Rechercher dans les notes"""
    
    search_pattern = f"%{q}%"
    
    query = select(Note).where(
        and_(
            Note.user_id == current_user.id,
            or_(
                Note.title.ilike(search_pattern),
                Note.content.ilike(search_pattern),
                Note.tags.any(q)
            )
        )
    )
    
    if subject_id:
        query = query.where(Note.subject_id == subject_id)
    
    count_query = select(func.count()).select_from(query.subquery())
    total_result = await db.execute(count_query)
    total = total_result.scalar()
    
    query = query.offset((page - 1) * page_size).limit(page_size)
    query = query.order_by(Note.updated_at.desc())
    
    result = await db.execute(query)
    notes = result.scalars().all()
    
    return {
        "notes": notes,
        "total": total,
        "page": page,
        "page_size": page_size
    }


@router.post("/{note_id}/favorite", response_model=NoteResponse)
async def toggle_favorite(
    note_id: int,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    """Marquer/Démarquer une note comme favorite"""
    
    result = await db.execute(
        select(Note).where(
            and_(
                Note.id == note_id,
                Note.user_id == current_user.id
            )
        )
    )
    note = result.scalar_one_or_none()
    
    if not note:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Note non trouvée"
        )
    
    note.is_favorite = not note.is_favorite
    await db.commit()
    await db.refresh(note)
    
    return note


@router.post("/{note_id}/pin", response_model=NoteResponse)
async def toggle_pin(
    note_id: int,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    """Épingler/Désépingler une note"""
    
    result = await db.execute(
        select(Note).where(
            and_(
                Note.id == note_id,
                Note.user_id == current_user.id
            )
        )
    )
    note = result.scalar_one_or_none()
    
    if not note:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Note non trouvée"
        )
    
    note.is_pinned = not note.is_pinned
    await db.commit()
    await db.refresh(note)
    
    return note


@router.post("/{note_id}/archive", response_model=NoteResponse)
async def toggle_archive(
    note_id: int,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    """Archiver/Désarchiver une note"""
    
    result = await db.execute(
        select(Note).where(
            and_(
                Note.id == note_id,
                Note.user_id == current_user.id
            )
        )
    )
    note = result.scalar_one_or_none()
    
    if not note:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Note non trouvée"
        )
    
    note.is_archived = not note.is_archived
    await db.commit()
    await db.refresh(note)
    
    return note