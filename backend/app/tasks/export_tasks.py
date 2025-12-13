"""
Tâches asynchrones pour l'export PDF
"""
from celery import Task
from app.celery_app import celery_app
from app.core.datetime_utils import utc_now
from typing import Dict, Any, List
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import cm
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, PageBreak
from reportlab.lib.enums import TA_CENTER, TA_JUSTIFY
from datetime import datetime
import os


class ExportTask(Task):
    """Classe de base pour les tâches d'export"""
    autoretry_for = (Exception,)
    retry_kwargs = {"max_retries": 2}
    retry_backoff = True


@celery_app.task(base=ExportTask, bind=True, name="app.tasks.export_tasks.export_notes_to_pdf")
def export_notes_to_pdf(
    self,
    notes: List[Dict[str, Any]],
    user_name: str,
    subject_name: str,
    output_path: str
) -> Dict[str, Any]:
    """
    Exporte des notes en PDF formaté
    
    Args:
        notes: Liste des notes à exporter
        user_name: Nom de l'utilisateur
        subject_name: Nom de la matière
        output_path: Chemin du fichier PDF de sortie
    
    Returns:
        Dict avec le statut et le chemin du PDF
    """
    try:
        # Créer le document PDF
        doc = SimpleDocTemplate(
            output_path,
            pagesize=A4,
            rightMargin=2*cm,
            leftMargin=2*cm,
            topMargin=2*cm,
            bottomMargin=2*cm
        )
        
        # Styles
        styles = getSampleStyleSheet()
        title_style = ParagraphStyle(
            'CustomTitle',
            parent=styles['Heading1'],
            fontSize=24,
            textColor='#2E3440',
            spaceAfter=30,
            alignment=TA_CENTER
        )
        
        subtitle_style = ParagraphStyle(
            'CustomSubtitle',
            parent=styles['Normal'],
            fontSize=12,
            textColor='#4C566A',
            spaceAfter=20,
            alignment=TA_CENTER
        )
        
        note_title_style = ParagraphStyle(
            'NoteTitle',
            parent=styles['Heading2'],
            fontSize=16,
            textColor='#5E81AC',
            spaceAfter=12
        )
        
        content_style = ParagraphStyle(
            'Content',
            parent=styles['Normal'],
            fontSize=11,
            textColor='#2E3440',
            alignment=TA_JUSTIFY,
            spaceAfter=12
        )
        
        # Construire le contenu
        story = []
        
        # Page de titre
        story.append(Paragraph(f"Notes de {subject_name}", title_style))
        story.append(Paragraph(
            f"Par {user_name} - {utc_now().strftime('%d/%m/%Y')}",
            subtitle_style
        ))
        story.append(Spacer(1, 2*cm))
        
        # Ajouter chaque note
        total_notes = len(notes)
        for i, note in enumerate(notes):
            self.update_state(
                state="PROCESSING",
                meta={"status": f"Processing note {i+1}/{total_notes}..."}
            )
            
            # Titre de la note
            story.append(Paragraph(note.get('title', 'Sans titre'), note_title_style))
            
            # Date de création
            created_at = note.get('created_at', '')
            if created_at:
                story.append(Paragraph(
                    f"<i>Créée le {created_at}</i>",
                    subtitle_style
                ))
            
            # Contenu
            content = note.get('content', '')
            # Nettoyer le Markdown basique
            content = content.replace('**', '<b>').replace('**', '</b>')
            content = content.replace('*', '<i>').replace('*', '</i>')
            
            paragraphs = content.split('\n\n')
            for para in paragraphs:
                if para.strip():
                    story.append(Paragraph(para, content_style))
            
            # Saut de page entre les notes (sauf la dernière)
            if i < len(notes) - 1:
                story.append(PageBreak())
        
        # Générer le PDF
        doc.build(story)
        
        return {
            "success": True,
            "pdf_path": output_path,
            "total_notes": len(notes),
            "file_size": os.path.getsize(output_path),
            "task_id": self.request.id
        }
        
    except Exception as e:
        return {
            "success": False,
            "error": str(e),
            "task_id": self.request.id
        }


@celery_app.task(base=ExportTask, bind=True, name="app.tasks.export_tasks.export_flashcards_to_pdf")
def export_flashcards_to_pdf(
    self,
    flashcards: List[Dict[str, Any]],
    user_name: str,
    subject_name: str,
    output_path: str
) -> Dict[str, Any]:
    """
    Exporte des flashcards en PDF
    
    Args:
        flashcards: Liste des flashcards
        user_name: Nom utilisateur
        subject_name: Nom matière
        output_path: Chemin sortie
    
    Returns:
        Dict avec le statut
    """
    try:
        doc = SimpleDocTemplate(output_path, pagesize=A4)
        styles = getSampleStyleSheet()
        story = []
        
        # Titre
        title_style = ParagraphStyle(
            'Title',
            parent=styles['Heading1'],
            fontSize=20,
            alignment=TA_CENTER
        )
        story.append(Paragraph(f"Flashcards - {subject_name}", title_style))
        story.append(Spacer(1, 1*cm))
        
        # Flashcards
        for i, card in enumerate(flashcards):
            story.append(Paragraph(f"<b>Question {i+1}:</b> {card.get('front', '')}", styles['Normal']))
            story.append(Spacer(1, 0.3*cm))
            story.append(Paragraph(f"<b>Réponse:</b> {card.get('back', '')}", styles['Normal']))
            story.append(Spacer(1, 0.5*cm))
        
        doc.build(story)
        
        return {
            "success": True,
            "pdf_path": output_path,
            "total_flashcards": len(flashcards),
            "task_id": self.request.id
        }
        
    except Exception as e:
        return {
            "success": False,
            "error": str(e),
            "task_id": self.request.id
        }
