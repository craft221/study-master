"""
API Endpoints pour la gestion des documents par matière
"""

import os
import uuid
import logging
import shutil
from pathlib import Path
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, status, Query, UploadFile, File, Form
from fastapi.responses import FileResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, and_

from app.core.database import get_db
from app.core.security import get_current_active_user
from app.models.user import User
from app.models.subject import Subject
from app.models.document import Document
from app.schemas.document import (
    DocumentResponse,
    DocumentListResponse,
    DocumentUpdate,
    DocumentUploadResponse,
    DocumentStatsResponse,
    ALLOWED_EXTENSIONS,
    MAX_FILE_SIZE,
    get_file_type_info,
    is_allowed_file,
    format_file_size
)
from app.services.xp_service import award_xp

logger = logging.getLogger(__name__)

router = APIRouter()

# Répertoire de stockage des documents
UPLOAD_DIR = Path("/app/uploads/documents")
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)


def get_file_icon(file_type: str) -> str:
    """Retourne une icône emoji selon le type de fichier"""
    icons = {
        "pdf": "📄",
        "word": "📝",
        "excel": "📊",
        "powerpoint": "📽️",
        "image": "🖼️",
        "other": "📁"
    }
    return icons.get(file_type, "📁")


def build_document_response(doc: Document, request_base_url: str = "") -> dict:
    """Construit la réponse pour un document avec les champs calculés"""
    return {
        "id": doc.id,
        "original_filename": doc.original_filename,
        "stored_filename": doc.stored_filename,
        "file_type": doc.file_type,
        "mime_type": doc.mime_type,
        "file_size": doc.file_size,
        "file_extension": doc.file_extension,
        "title": doc.title,
        "description": doc.description,
        "subject_id": doc.subject_id,
        "user_id": doc.user_id,
        "is_favorite": doc.is_favorite,
        "is_archived": doc.is_archived,
        "is_text_extracted": doc.is_text_extracted,
        "download_count": doc.download_count,
        "view_count": doc.view_count,
        "created_at": doc.created_at,
        "updated_at": doc.updated_at,
        "file_size_formatted": format_file_size(doc.file_size),
        "file_type_icon": get_file_icon(doc.file_type),
        "download_url": f"/api/v1/documents/{doc.id}/download"
    }


# ==================== Endpoints ====================

@router.post("/upload", response_model=DocumentUploadResponse, status_code=status.HTTP_201_CREATED)
async def upload_document(
    file: UploadFile = File(..., description="Fichier à uploader"),
    subject_id: int = Form(..., description="ID de la matière"),
    title: Optional[str] = Form(None, description="Titre personnalisé"),
    description: Optional[str] = Form(None, description="Description du document"),
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Uploader un document pour une matière.

    Types supportés: PDF, Word (.doc, .docx), Excel (.xls, .xlsx),
    PowerPoint (.ppt, .pptx), Images (jpg, png, gif, etc.)

    Taille max: 50 MB
    """

    # Vérifier que la matière existe et appartient à l'utilisateur
    result = await db.execute(
        select(Subject).where(
            and_(
                Subject.id == subject_id,
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

    # Vérifier le type de fichier
    if not file.filename or not is_allowed_file(file.filename):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Type de fichier non supporté. Extensions autorisées: {', '.join(ALLOWED_EXTENSIONS.keys())}"
        )

    # Lire le contenu pour vérifier la taille
    content = await file.read()
    file_size = len(content)

    if file_size > MAX_FILE_SIZE:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Fichier trop volumineux. Taille max: {format_file_size(MAX_FILE_SIZE)}"
        )

    if file_size == 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Le fichier est vide"
        )

    # Vérifier le quota de stockage de l'utilisateur
    # Calculer l'espace utilisé actuellement
    result = await db.execute(
        select(func.coalesce(func.sum(Document.file_size), 0))
        .where(Document.user_id == current_user.id)
    )
    current_storage_bytes = result.scalar() or 0
    current_storage_mb = current_storage_bytes / (1024 * 1024)

    # Récupérer la limite de stockage de l'abonnement
    storage_limit_mb = 100  # Défaut FREE
    if current_user.subscription:
        storage_limit_mb = current_user.subscription.storage_limit_mb or 100

    # Vérifier si l'upload dépasse le quota
    new_total_mb = current_storage_mb + (file_size / (1024 * 1024))
    if new_total_mb > storage_limit_mb:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Quota de stockage dépassé. Utilisé: {current_storage_mb:.1f} MB / {storage_limit_mb} MB. "
                   f"Passez à un plan supérieur pour plus d'espace."
        )

    # Extraire l'extension et les infos du type
    file_extension = '.' + file.filename.rsplit('.', 1)[1].lower()
    mime_type, file_type = get_file_type_info(file_extension)

    # Générer un nom de fichier unique
    stored_filename = f"{uuid.uuid4().hex}{file_extension}"

    # Créer le répertoire pour l'utilisateur si nécessaire
    user_upload_dir = UPLOAD_DIR / str(current_user.id)
    user_upload_dir.mkdir(parents=True, exist_ok=True)

    # Chemin complet du fichier
    file_path = user_upload_dir / stored_filename
    storage_path = f"{current_user.id}/{stored_filename}"

    # Sauvegarder le fichier
    try:
        with open(file_path, "wb") as f:
            f.write(content)
        logger.info(f"Document sauvegardé: {file_path}")
    except Exception as e:
        logger.error(f"Erreur lors de la sauvegarde du fichier: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Erreur lors de la sauvegarde du fichier"
        )

    # Créer l'entrée en base de données
    new_document = Document(
        original_filename=file.filename,
        stored_filename=stored_filename,
        file_type=file_type,
        mime_type=mime_type,
        file_size=file_size,
        file_extension=file_extension,
        storage_path=storage_path,
        title=title or file.filename.rsplit('.', 1)[0],  # Utiliser le nom du fichier comme titre par défaut
        description=description,
        subject_id=subject_id,
        user_id=current_user.id
    )

    db.add(new_document)

    # Mettre à jour le compteur de documents de la matière
    subject.total_documents_count += 1

    # Attribuer des XP
    xp_earned = 5
    await award_xp(
        user=current_user,
        amount=xp_earned,
        reason="Upload d'un document",
        event_type="document_uploaded"
    )

    await db.commit()
    await db.refresh(new_document)

    logger.info(f"Document créé: {new_document.id} pour matière {subject_id} par utilisateur {current_user.id}")

    return {
        "document": build_document_response(new_document),
        "message": "Document uploadé avec succès",
        "xp_earned": xp_earned
    }


@router.get("/", response_model=DocumentListResponse)
async def list_documents(
    subject_id: Optional[int] = Query(None, description="Filtrer par matière"),
    file_type: Optional[str] = Query(None, description="Filtrer par type (pdf, word, excel, etc.)"),
    is_favorite: Optional[bool] = Query(None, description="Filtrer les favoris"),
    is_archived: Optional[bool] = Query(False, description="Inclure les archivés"),
    search: Optional[str] = Query(None, description="Recherche dans le titre/description"),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    """Récupérer la liste des documents de l'utilisateur"""

    query = select(Document).where(Document.user_id == current_user.id)

    # Appliquer les filtres
    if subject_id is not None:
        query = query.where(Document.subject_id == subject_id)

    if file_type is not None:
        query = query.where(Document.file_type == file_type)

    if is_favorite is not None:
        query = query.where(Document.is_favorite == is_favorite)

    if is_archived is not None:
        query = query.where(Document.is_archived == is_archived)

    if search:
        search_filter = f"%{search}%"
        query = query.where(
            (Document.title.ilike(search_filter)) |
            (Document.original_filename.ilike(search_filter)) |
            (Document.description.ilike(search_filter))
        )

    # Compter le total
    count_query = select(func.count()).select_from(query.subquery())
    total_result = await db.execute(count_query)
    total = total_result.scalar()

    # Pagination et tri
    query = query.order_by(Document.is_favorite.desc(), Document.created_at.desc())
    query = query.offset((page - 1) * page_size).limit(page_size)

    result = await db.execute(query)
    documents = result.scalars().all()

    return {
        "documents": [build_document_response(doc) for doc in documents],
        "total": total,
        "page": page,
        "page_size": page_size
    }


@router.get("/subject/{subject_id}", response_model=DocumentListResponse)
async def get_subject_documents(
    subject_id: int,
    file_type: Optional[str] = Query(None, description="Filtrer par type"),
    is_archived: Optional[bool] = Query(False),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    """Récupérer tous les documents d'une matière spécifique"""

    # Vérifier que la matière existe et appartient à l'utilisateur
    result = await db.execute(
        select(Subject).where(
            and_(
                Subject.id == subject_id,
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

    query = select(Document).where(
        and_(
            Document.subject_id == subject_id,
            Document.user_id == current_user.id
        )
    )

    if file_type:
        query = query.where(Document.file_type == file_type)

    if is_archived is not None:
        query = query.where(Document.is_archived == is_archived)

    # Compter le total
    count_query = select(func.count()).select_from(query.subquery())
    total_result = await db.execute(count_query)
    total = total_result.scalar()

    # Pagination et tri
    query = query.order_by(Document.is_favorite.desc(), Document.created_at.desc())
    query = query.offset((page - 1) * page_size).limit(page_size)

    result = await db.execute(query)
    documents = result.scalars().all()

    return {
        "documents": [build_document_response(doc) for doc in documents],
        "total": total,
        "page": page,
        "page_size": page_size
    }


@router.get("/stats", response_model=DocumentStatsResponse)
async def get_document_stats(
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    """Récupérer les statistiques des documents de l'utilisateur"""

    # Total des documents
    result = await db.execute(
        select(func.count()).select_from(Document).where(Document.user_id == current_user.id)
    )
    total_documents = result.scalar() or 0

    # Taille totale
    result = await db.execute(
        select(func.sum(Document.file_size)).where(Document.user_id == current_user.id)
    )
    total_size = result.scalar() or 0

    # Documents par type
    result = await db.execute(
        select(Document.file_type, func.count()).where(
            Document.user_id == current_user.id
        ).group_by(Document.file_type)
    )
    by_type = {row[0]: row[1] for row in result.all()}

    # Documents par matière
    result = await db.execute(
        select(Subject.name, func.count(Document.id)).join(
            Document, Document.subject_id == Subject.id
        ).where(
            Document.user_id == current_user.id
        ).group_by(Subject.id, Subject.name)
    )
    by_subject = {row[0]: row[1] for row in result.all()}

    return {
        "total_documents": total_documents,
        "total_size_bytes": total_size,
        "total_size_formatted": format_file_size(total_size),
        "documents_by_type": by_type,
        "documents_by_subject": by_subject
    }


@router.get("/{document_id}", response_model=DocumentResponse)
async def get_document(
    document_id: int,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    """Récupérer les détails d'un document"""

    result = await db.execute(
        select(Document).where(
            and_(
                Document.id == document_id,
                Document.user_id == current_user.id
            )
        )
    )
    document = result.scalar_one_or_none()

    if not document:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Document non trouvé"
        )

    # Incrémenter le compteur de vues
    document.view_count += 1
    await db.commit()

    return build_document_response(document)


@router.get("/{document_id}/download")
async def download_document(
    document_id: int,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    """Télécharger un document"""

    result = await db.execute(
        select(Document).where(
            and_(
                Document.id == document_id,
                Document.user_id == current_user.id
            )
        )
    )
    document = result.scalar_one_or_none()

    if not document:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Document non trouvé"
        )

    # Construire le chemin du fichier
    file_path = UPLOAD_DIR / document.storage_path

    if not file_path.exists():
        logger.error(f"Fichier non trouvé sur le disque: {file_path}")
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Fichier non trouvé sur le serveur"
        )

    # Incrémenter le compteur de téléchargements
    document.download_count += 1
    await db.commit()

    return FileResponse(
        path=str(file_path),
        filename=document.original_filename,
        media_type=document.mime_type
    )


@router.put("/{document_id}", response_model=DocumentResponse)
async def update_document(
    document_id: int,
    document_data: DocumentUpdate,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    """Mettre à jour les métadonnées d'un document"""

    result = await db.execute(
        select(Document).where(
            and_(
                Document.id == document_id,
                Document.user_id == current_user.id
            )
        )
    )
    document = result.scalar_one_or_none()

    if not document:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Document non trouvé"
        )

    # Mettre à jour les champs
    update_data = document_data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(document, field, value)

    await db.commit()
    await db.refresh(document)

    return build_document_response(document)


@router.post("/{document_id}/favorite", response_model=DocumentResponse)
async def toggle_document_favorite(
    document_id: int,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    """Marquer/Démarquer un document comme favori"""

    result = await db.execute(
        select(Document).where(
            and_(
                Document.id == document_id,
                Document.user_id == current_user.id
            )
        )
    )
    document = result.scalar_one_or_none()

    if not document:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Document non trouvé"
        )

    document.is_favorite = not document.is_favorite
    await db.commit()
    await db.refresh(document)

    return build_document_response(document)


@router.delete("/{document_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_document(
    document_id: int,
    current_user: User = Depends(get_current_active_user),
    db: AsyncSession = Depends(get_db)
):
    """Supprimer un document"""

    result = await db.execute(
        select(Document).where(
            and_(
                Document.id == document_id,
                Document.user_id == current_user.id
            )
        )
    )
    document = result.scalar_one_or_none()

    if not document:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Document non trouvé"
        )

    # Supprimer le fichier physique
    file_path = UPLOAD_DIR / document.storage_path
    if file_path.exists():
        try:
            os.remove(file_path)
            logger.info(f"Fichier supprimé: {file_path}")
        except Exception as e:
            logger.error(f"Erreur lors de la suppression du fichier: {e}")

    # Mettre à jour le compteur de la matière
    result = await db.execute(
        select(Subject).where(Subject.id == document.subject_id)
    )
    subject = result.scalar_one_or_none()
    if subject and subject.total_documents_count > 0:
        subject.total_documents_count -= 1

    # Supprimer de la base de données
    await db.delete(document)
    await db.commit()

    logger.info(f"Document {document_id} supprimé par utilisateur {current_user.id}")

    return None
