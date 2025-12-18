import os
import uuid
import logging
from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException, status, Query, UploadFile, File
from fastapi.responses import FileResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, and_, or_
from sqlalchemy.orm import selectinload
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
from app.services.xp_service import award_xp

logger = logging.getLogger(__name__)

router = APIRouter()

# Configuration pour l'upload d'images
UPLOAD_DIR = Path("/app/uploads/note-images")

# Extensions d'images autorisées
ALLOWED_IMAGE_EXTENSIONS = {'.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp'}
MAX_IMAGE_SIZE = 10 * 1024 * 1024  # 10 MB


def is_allowed_image(filename: str) -> bool:
    """Vérifie si le fichier est une image autorisée"""
    if not filename:
        return False
    ext = '.' + filename.rsplit('.', 1)[-1].lower() if '.' in filename else ''
    return ext in ALLOWED_IMAGE_EXTENSIONS


def format_file_size(size_bytes: int) -> str:
    """Formate la taille en bytes vers une chaîne lisible"""
    for unit in ['B', 'KB', 'MB', 'GB']:
        if size_bytes < 1024:
            return f"{size_bytes:.1f} {unit}"
        size_bytes /= 1024
    return f"{size_bytes:.1f} TB"


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
    
    # Exclude fields that don't exist in the Note model
    note_dict = note_data.model_dump(exclude={"note_type", "visibility"})

    # Handle visibility -> is_public conversion
    is_public = False
    if note_data.visibility:
        is_public = note_data.visibility.value == "public"

    new_note = Note(
        user_id=current_user.id,
        is_public=is_public,
        **note_dict
    )

    db.add(new_note)

    subject.total_notes_count += 1

    # Ajouter XP via le service centralisé
    await award_xp(
        user=current_user,
        amount=10,
        reason="Création d'une note",
        event_type="note_created"
    )

    # Incrémenter le compteur de notes via stats
    if current_user.stats:
        current_user.stats.total_notes_created += 1

    await db.commit()
    await db.refresh(new_note, ["subject"])

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
    
    query = select(Note).where(Note.user_id == current_user.id).options(
        selectinload(Note.subject)
    )

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

    # Count query sans le selectinload
    count_base = select(Note).where(Note.user_id == current_user.id)
    if subject_id:
        count_base = count_base.where(Note.subject_id == subject_id)
    if note_type:
        count_base = count_base.where(Note.note_type == note_type)
    if tags:
        tag_list = [t.strip() for t in tags.split(",")]
        count_base = count_base.where(Note.tags.overlap(tag_list))
    if is_pinned is not None:
        count_base = count_base.where(Note.is_pinned == is_pinned)
    if is_favorite is not None:
        count_base = count_base.where(Note.is_favorite == is_favorite)
    if is_archived is not None:
        count_base = count_base.where(Note.is_archived == is_archived)
    if parent_id is not None:
        count_base = count_base.where(Note.parent_id == parent_id)

    count_query = select(func.count()).select_from(count_base.subquery())
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
        ).options(selectinload(Note.subject))
    )
    note = result.scalar_one_or_none()

    if not note:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Note non trouvée"
        )

    return note


@router.get("/{note_id}/with-children", response_model=NoteWithChildren)
async def get_note_with_children(
    note_id: int,
    max_depth: int = Query(3, ge=1, le=5),
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Récupérer une note avec toutes ses notes enfants (hiérarchie)

    OPTIMISATION: Charge toute la hiérarchie en UNE SEULE requête
    au lieu de faire N+1 requêtes récursives.
    """

    # Étape 1: Charger la note parente
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

    # Étape 2: Charger TOUS les descendants en UNE SEULE requête
    # On utilise une CTE (Common Table Expression) récursive pour PostgreSQL
    # ou on charge tous les enfants potentiels et on construit l'arbre en Python

    # Méthode batch: charger toutes les notes de l'utilisateur qui pourraient être des enfants
    # puis construire l'arbre en mémoire (beaucoup plus efficace que N+1)
    result = await db.execute(
        select(Note).where(
            and_(
                Note.user_id == current_user.id,
                Note.parent_id.isnot(None)  # Seulement les notes avec parent
            )
        ).order_by(Note.order, Note.created_at)
    )
    all_child_notes = result.scalars().all()

    # Créer un index par parent_id pour accès O(1)
    children_by_parent: dict = {}
    for child_note in all_child_notes:
        if child_note.parent_id not in children_by_parent:
            children_by_parent[child_note.parent_id] = []
        children_by_parent[child_note.parent_id].append(child_note)

    # Fonction récursive qui utilise les données déjà chargées (pas de DB)
    def build_hierarchy(parent_id: int, depth: int = 0) -> List[Note]:
        if depth >= max_depth:
            return []

        children = children_by_parent.get(parent_id, [])
        for child in children:
            child.children = build_hierarchy(child.id, depth + 1)

        return children

    # Construire la hiérarchie sans requêtes supplémentaires
    note.children = build_hierarchy(note.id)

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
        ).options(selectinload(Note.subject))
    )
    note = result.scalar_one_or_none()

    if not note:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Note non trouvée"
        )

    # Exclure les champs qui n'existent pas dans le modèle
    update_data = note_data.model_dump(exclude_unset=True, exclude={"note_type", "visibility"})
    for field, value in update_data.items():
        if hasattr(note, field):
            setattr(note, field, value)

    await db.commit()
    await db.refresh(note, ["subject"])

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


def escape_like_pattern(pattern: str) -> str:
    """
    Échappe les caractères spéciaux SQL LIKE pour éviter les injections.

    Les caractères spéciaux dans LIKE sont:
    - % : correspond à n'importe quelle séquence de caractères
    - _ : correspond à un seul caractère
    - \ : caractère d'échappement

    On les échappe avec un backslash.
    """
    # Échapper le backslash en premier (sinon on échappe nos propres échappements)
    pattern = pattern.replace("\\", "\\\\")
    # Échapper les caractères spéciaux LIKE
    pattern = pattern.replace("%", "\\%")
    pattern = pattern.replace("_", "\\_")
    return pattern


@router.get("/search", response_model=NoteListResponse)
async def search_notes(
    q: str = Query(..., min_length=2, max_length=100, description="Recherche"),
    subject_id: Optional[int] = None,
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    """Rechercher dans les notes"""

    # Échapper les caractères spéciaux SQL LIKE pour éviter les injections
    # et les attaques DoS par patterns malicieux
    safe_query = escape_like_pattern(q.strip())
    search_pattern = f"%{safe_query}%"

    query = select(Note).where(
        and_(
            Note.user_id == current_user.id,
            or_(
                Note.title.ilike(search_pattern),
                Note.content.ilike(search_pattern),
                # Pour les tags, on utilise la recherche exacte (déjà sécurisée par l'ORM)
                Note.tags.any(q.strip())
            )
        )
    ).options(selectinload(Note.subject))

    if subject_id:
        query = query.where(Note.subject_id == subject_id)

    # Count query sans selectinload (utilise le même search_pattern sécurisé)
    count_base = select(Note).where(
        and_(
            Note.user_id == current_user.id,
            or_(
                Note.title.ilike(search_pattern),
                Note.content.ilike(search_pattern),
                Note.tags.any(q.strip())
            )
        )
    )
    if subject_id:
        count_base = count_base.where(Note.subject_id == subject_id)

    count_query = select(func.count()).select_from(count_base.subquery())
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
        ).options(selectinload(Note.subject))
    )
    note = result.scalar_one_or_none()

    if not note:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Note non trouvée"
        )

    note.is_favorite = not note.is_favorite
    await db.commit()
    await db.refresh(note, ["subject"])

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
        ).options(selectinload(Note.subject))
    )
    note = result.scalar_one_or_none()

    if not note:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Note non trouvée"
        )

    note.is_pinned = not note.is_pinned
    await db.commit()
    await db.refresh(note, ["subject"])

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
        ).options(selectinload(Note.subject))
    )
    note = result.scalar_one_or_none()

    if not note:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Note non trouvée"
        )

    note.is_archived = not note.is_archived
    await db.commit()
    await db.refresh(note, ["subject"])

    return note


# ==================== Image Upload Endpoints ====================

@router.post("/upload-image")
async def upload_note_image(
    file: UploadFile = File(..., description="Image à uploader (JPG, PNG, GIF, WebP)"),
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Uploader une image pour l'insérer dans une note.

    Supporte le collage (paste) et le drag & drop depuis le frontend.
    Types supportés: JPG, PNG, GIF, WebP, BMP
    Taille max: 10 MB

    Retourne l'URL de l'image pour insertion dans le contenu Markdown.
    """

    # Vérifier le type de fichier
    filename = file.filename or "image.png"

    # Gérer les fichiers collés sans extension (blob)
    content_type = file.content_type or ""
    if not is_allowed_image(filename):
        # Essayer de détecter l'extension depuis le content-type
        content_type_to_ext = {
            "image/jpeg": ".jpg",
            "image/jpg": ".jpg",
            "image/png": ".png",
            "image/gif": ".gif",
            "image/webp": ".webp",
            "image/bmp": ".bmp"
        }
        ext = content_type_to_ext.get(content_type)
        if ext:
            filename = f"pasted_image{ext}"
        else:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Type d'image non supporté. Extensions autorisées: {', '.join(ALLOWED_IMAGE_EXTENSIONS)}"
            )

    # Lire le contenu pour vérifier la taille
    content = await file.read()
    file_size = len(content)

    if file_size > MAX_IMAGE_SIZE:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Image trop volumineuse. Taille max: {format_file_size(MAX_IMAGE_SIZE)}"
        )

    if file_size == 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Le fichier est vide"
        )

    # Extraire l'extension
    file_extension = '.' + filename.rsplit('.', 1)[-1].lower()

    # Générer un nom de fichier unique
    stored_filename = f"{uuid.uuid4().hex}{file_extension}"

    # Créer les répertoires si nécessaires
    try:
        UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
    except PermissionError:
        logger.warning(f"Cannot create {UPLOAD_DIR}, using /tmp fallback")
        UPLOAD_DIR_FALLBACK = Path("/tmp/note-images")
        UPLOAD_DIR_FALLBACK.mkdir(parents=True, exist_ok=True)

    user_upload_dir = UPLOAD_DIR / str(current_user.id)
    try:
        user_upload_dir.mkdir(parents=True, exist_ok=True)
    except PermissionError:
        user_upload_dir = Path("/tmp/note-images") / str(current_user.id)
        user_upload_dir.mkdir(parents=True, exist_ok=True)

    # Chemin complet du fichier
    file_path = user_upload_dir / stored_filename

    # Sauvegarder le fichier
    try:
        with open(file_path, "wb") as f:
            f.write(content)
        logger.info(f"Image note sauvegardée: {file_path}")
    except Exception as e:
        logger.error(f"Erreur lors de la sauvegarde de l'image: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Erreur lors de la sauvegarde de l'image"
        )

    # Construire l'URL de l'image
    image_url = f"/api/v1/notes/images/{current_user.id}/{stored_filename}"

    # Format Markdown pour insertion
    markdown_image = f"![Image]({image_url})"

    logger.info(f"Image uploadée: {stored_filename} par utilisateur {current_user.id}")

    return {
        "success": True,
        "url": image_url,
        "markdown": markdown_image,
        "filename": stored_filename,
        "original_filename": filename,
        "size": file_size,
        "size_formatted": format_file_size(file_size)
    }


@router.get("/images/{user_id}/{filename}")
async def get_note_image(
    user_id: int,
    filename: str
):
    """
    Récupérer une image de note.

    Les images sont publiques pour permettre l'affichage dans les notes partagées.
    """

    # Sécurité: vérifier que le filename ne contient pas de path traversal
    if ".." in filename or "/" in filename or "\\" in filename:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Nom de fichier invalide"
        )

    # Construire le chemin du fichier
    file_path = UPLOAD_DIR / str(user_id) / filename

    if not file_path.exists():
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Image non trouvée"
        )

    # Déterminer le content-type
    ext = filename.rsplit('.', 1)[-1].lower() if '.' in filename else ''
    content_types = {
        'jpg': 'image/jpeg',
        'jpeg': 'image/jpeg',
        'png': 'image/png',
        'gif': 'image/gif',
        'webp': 'image/webp',
        'bmp': 'image/bmp'
    }
    media_type = content_types.get(ext, 'application/octet-stream')

    return FileResponse(
        path=str(file_path),
        media_type=media_type,
        headers={"Cache-Control": "public, max-age=31536000"}  # Cache 1 an
    )


@router.delete("/images/{filename}")
async def delete_note_image(
    filename: str,
    current_user: User = Depends(get_current_active_user)
):
    """
    Supprimer une image de note.

    Seul le propriétaire peut supprimer ses images.
    """

    # Sécurité: vérifier que le filename ne contient pas de path traversal
    if ".." in filename or "/" in filename or "\\" in filename:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Nom de fichier invalide"
        )

    # Construire le chemin du fichier (dans le dossier de l'utilisateur)
    file_path = UPLOAD_DIR / str(current_user.id) / filename

    if not file_path.exists():
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Image non trouvée"
        )

    try:
        os.remove(file_path)
        logger.info(f"Image supprimée: {filename} par utilisateur {current_user.id}")
    except Exception as e:
        logger.error(f"Erreur lors de la suppression de l'image: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Erreur lors de la suppression"
        )

    return {"success": True, "message": "Image supprimée"}