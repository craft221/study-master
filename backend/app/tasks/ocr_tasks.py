"""
Tâches asynchrones pour l'OCR
"""
from celery import Task
from app.celery_app import celery_app
from typing import Dict, Any
import pytesseract
from PIL import Image
import os
from pdf2image import convert_from_path
from app.core.config import settings


class OCRTask(Task):
    """Classe de base pour les tâches OCR avec retry automatique"""
    autoretry_for = (Exception,)
    retry_kwargs = {"max_retries": 2}
    retry_backoff = True


@celery_app.task(base=OCRTask, bind=True, name="app.tasks.ocr_tasks.extract_text_from_image")
def extract_text_from_image(
    self,
    image_path: str,
    language: str = "fra"
) -> Dict[str, Any]:
    """
    Extrait le texte d'une image avec OCR
    
    Args:
        image_path: Chemin vers l'image
        language: Langue (fra, eng, etc.)
    
    Returns:
        Dict avec le texte extrait
    """
    try:
        # Charger l'image
        image = Image.open(image_path)
        
        # OCR
        text = pytesseract.image_to_string(image, lang=language)
        
        # Statistiques
        word_count = len(text.split())
        char_count = len(text)
        
        return {
            "success": True,
            "text": text,
            "word_count": word_count,
            "char_count": char_count,
            "language": language,
            "task_id": self.request.id
        }
        
    except Exception as e:
        return {
            "success": False,
            "error": str(e),
            "task_id": self.request.id
        }


@celery_app.task(base=OCRTask, bind=True, name="app.tasks.ocr_tasks.extract_text_from_pdf")
def extract_text_from_pdf(
    self,
    pdf_path: str,
    language: str = "fra",
    max_pages: int = 50
) -> Dict[str, Any]:
    """
    Extrait le texte d'un PDF avec OCR
    
    Args:
        pdf_path: Chemin vers le PDF
        language: Langue (fra, eng, etc.)
        max_pages: Nombre max de pages à traiter
    
    Returns:
        Dict avec le texte extrait
    """
    try:
        # Convertir PDF en images
        self.update_state(state="PROCESSING", meta={"status": "Converting PDF to images..."})
        images = convert_from_path(pdf_path, dpi=300)
        
        if len(images) > max_pages:
            images = images[:max_pages]
        
        # OCR sur chaque page
        all_text = []
        for i, image in enumerate(images):
            self.update_state(
                state="PROCESSING", 
                meta={"status": f"Processing page {i+1}/{len(images)}..."}
            )
            
            text = pytesseract.image_to_string(image, lang=language)
            all_text.append(f"--- Page {i+1} ---\n{text}\n")
        
        full_text = "\n".join(all_text)
        
        return {
            "success": True,
            "text": full_text,
            "total_pages": len(images),
            "word_count": len(full_text.split()),
            "char_count": len(full_text),
            "language": language,
            "task_id": self.request.id
        }
        
    except Exception as e:
        return {
            "success": False,
            "error": str(e),
            "task_id": self.request.id
        }


@celery_app.task(base=OCRTask, bind=True, name="app.tasks.ocr_tasks.process_document_with_ocr")
def process_document_with_ocr(
    self,
    file_path: str,
    file_type: str,
    language: str = "fra"
) -> Dict[str, Any]:
    """
    Traite un document (image ou PDF) avec OCR
    
    Args:
        file_path: Chemin vers le fichier
        file_type: Type de fichier (image, pdf)
        language: Langue
    
    Returns:
        Dict avec le texte extrait
    """
    try:
        if file_type == "pdf":
            result = extract_text_from_pdf(file_path, language)
        else:  # image
            result = extract_text_from_image(file_path, language)
        
        return result
        
    except Exception as e:
        return {
            "success": False,
            "error": str(e),
            "task_id": self.request.id
        }
