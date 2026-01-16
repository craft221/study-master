"""
Service d'export PDF professionnel pour les notes
Utilise ReportLab pour générer des PDFs formatés
"""
from typing import List, Optional, Dict, Any
from datetime import datetime
import io

from app.core.datetime_utils import utc_now
from reportlab.lib.pagesizes import A4, letter
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import inch, cm
from reportlab.lib.enums import TA_LEFT, TA_CENTER, TA_JUSTIFY
from reportlab.lib.colors import HexColor, black, white, grey
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, PageBreak,
    Table, TableStyle, Image as RLImage, KeepTogether
)
from reportlab.lib import colors
import markdown
from bs4 import BeautifulSoup


class PDFExportService:
    """Service pour exporter des notes en PDF formaté professionnel"""
    
    def __init__(self):
        """Initialiser le service d'export PDF"""
        self.styles = getSampleStyleSheet()
        self._setup_custom_styles()
    
    def _setup_custom_styles(self):
        """Configurer les styles personnalisés"""
        # Style titre principal
        self.styles.add(ParagraphStyle(
            name='CustomTitle',
            parent=self.styles['Heading1'],
            fontSize=24,
            textColor=HexColor('#1E40AF'),
            spaceAfter=30,
            alignment=TA_CENTER,
            fontName='Helvetica-Bold'
        ))
        
        # Style sous-titre
        self.styles.add(ParagraphStyle(
            name='CustomSubtitle',
            parent=self.styles['Heading2'],
            fontSize=18,
            textColor=HexColor('#3B82F6'),
            spaceBefore=20,
            spaceAfter=12,
            fontName='Helvetica-Bold'
        ))
        
        # Style section
        self.styles.add(ParagraphStyle(
            name='CustomSection',
            parent=self.styles['Heading3'],
            fontSize=14,
            textColor=HexColor('#4B5563'),
            spaceBefore=15,
            spaceAfter=8,
            fontName='Helvetica-Bold'
        ))
        
        # Style paragraphe
        self.styles.add(ParagraphStyle(
            name='CustomBody',
            parent=self.styles['BodyText'],
            fontSize=11,
            textColor=black,
            alignment=TA_JUSTIFY,
            spaceAfter=12,
            leading=16
        ))
        
        # Style code
        self.styles.add(ParagraphStyle(
            name='CustomCode',
            parent=self.styles['Code'],
            fontSize=9,
            textColor=HexColor('#1F2937'),
            backColor=HexColor('#F3F4F6'),
            leftIndent=20,
            rightIndent=20,
            spaceBefore=10,
            spaceAfter=10,
            fontName='Courier'
        ))
        
        # Style metadata
        self.styles.add(ParagraphStyle(
            name='Metadata',
            parent=self.styles['Normal'],
            fontSize=9,
            textColor=grey,
            alignment=TA_CENTER,
            spaceAfter=20
        ))
    
    async def export_note_to_pdf(
        self,
        note_data: Dict[str, Any],
        include_metadata: bool = True,
        include_toc: bool = False
    ) -> bytes:
        """
        Exporter une note en PDF
        
        Args:
            note_data: Données de la note (title, content, subject_name, created_at, etc.)
            include_metadata: Inclure les métadonnées
            include_toc: Inclure une table des matières
            
        Returns:
            Contenu du PDF en bytes
        """
        buffer = io.BytesIO()
        
        # Créer le document
        doc = SimpleDocTemplate(
            buffer,
            pagesize=A4,
            rightMargin=2*cm,
            leftMargin=2*cm,
            topMargin=2*cm,
            bottomMargin=2*cm,
            title=note_data.get('title', 'Note'),
            author=note_data.get('author', 'Studera')
        )
        
        # Construire le contenu
        story = []
        
        # En-tête avec titre
        title = note_data.get('title', 'Sans titre')
        story.append(Paragraph(title, self.styles['CustomTitle']))
        story.append(Spacer(1, 0.3*inch))
        
        # Métadonnées
        if include_metadata:
            metadata_lines = []
            
            if 'subject_name' in note_data:
                metadata_lines.append(f"Matière: {note_data['subject_name']}")
            
            if 'author' in note_data:
                metadata_lines.append(f"Auteur: {note_data['author']}")
            
            if 'created_at' in note_data:
                created = note_data['created_at']
                if isinstance(created, datetime):
                    created_str = created.strftime('%d/%m/%Y à %H:%M')
                else:
                    created_str = str(created)
                metadata_lines.append(f"Créé le: {created_str}")
            
            if 'tags' in note_data and note_data['tags']:
                metadata_lines.append(f"Tags: {note_data['tags']}")
            
            metadata_text = ' | '.join(metadata_lines)
            story.append(Paragraph(metadata_text, self.styles['Metadata']))
            story.append(Spacer(1, 0.3*inch))
        
        # Contenu de la note
        content = note_data.get('content', '')
        
        # Convertir Markdown en HTML
        html_content = markdown.markdown(
            content,
            extensions=['extra', 'codehilite', 'tables']
        )
        
        # Parser le HTML et convertir en éléments ReportLab
        soup = BeautifulSoup(html_content, 'html.parser')
        
        for element in soup.find_all(['h1', 'h2', 'h3', 'h4', 'p', 'pre', 'ul', 'ol', 'blockquote']):
            if element.name == 'h1':
                story.append(Paragraph(element.get_text(), self.styles['CustomSubtitle']))
            elif element.name == 'h2':
                story.append(Paragraph(element.get_text(), self.styles['CustomSection']))
            elif element.name in ['h3', 'h4']:
                story.append(Paragraph(element.get_text(), self.styles['Heading4']))
            elif element.name == 'pre':
                # Bloc de code
                code_text = element.get_text()
                story.append(Paragraph(
                    code_text.replace('\n', '<br/>'),
                    self.styles['CustomCode']
                ))
            elif element.name == 'blockquote':
                # Citation
                quote_text = element.get_text()
                story.append(Spacer(1, 0.1*inch))
                story.append(Paragraph(
                    f"<i>{quote_text}</i>",
                    self.styles['CustomBody']
                ))
                story.append(Spacer(1, 0.1*inch))
            elif element.name in ['ul', 'ol']:
                # Liste
                for li in element.find_all('li'):
                    bullet = '•' if element.name == 'ul' else f"{li.find_previous_siblings('li').__len__() + 1}."
                    story.append(Paragraph(
                        f"{bullet} {li.get_text()}",
                        self.styles['CustomBody']
                    ))
            elif element.name == 'p':
                # Paragraphe normal
                text = element.get_text().strip()
                if text:
                    story.append(Paragraph(text, self.styles['CustomBody']))
        
        # Pied de page
        story.append(Spacer(1, 0.5*inch))
        story.append(Paragraph(
            f"Exporté le {utc_now().strftime('%d/%m/%Y à %H:%M')} | Studera",
            self.styles['Metadata']
        ))
        
        # Générer le PDF
        doc.build(story)
        
        # Récupérer les bytes
        pdf_bytes = buffer.getvalue()
        buffer.close()
        
        return pdf_bytes
    
    async def export_multiple_notes_to_pdf(
        self,
        notes: List[Dict[str, Any]],
        title: str = "Compilation de Notes"
    ) -> bytes:
        """
        Exporter plusieurs notes dans un seul PDF
        
        Args:
            notes: Liste de notes à exporter
            title: Titre du document
            
        Returns:
            Contenu du PDF en bytes
        """
        buffer = io.BytesIO()
        
        doc = SimpleDocTemplate(
            buffer,
            pagesize=A4,
            rightMargin=2*cm,
            leftMargin=2*cm,
            topMargin=2*cm,
            bottomMargin=2*cm,
            title=title
        )
        
        story = []
        
        # Page de titre
        story.append(Paragraph(title, self.styles['CustomTitle']))
        story.append(Spacer(1, 0.3*inch))
        story.append(Paragraph(
            f"{len(notes)} note(s) • Exporté le {utc_now().strftime('%d/%m/%Y')}",
            self.styles['Metadata']
        ))
        story.append(PageBreak())
        
        # Ajouter chaque note
        for i, note in enumerate(notes):
            # Exporter la note
            note_title = note.get('title', f'Note {i+1}')
            story.append(Paragraph(note_title, self.styles['CustomSubtitle']))
            story.append(Spacer(1, 0.2*inch))
            
            # Métadonnées courtes
            if 'subject_name' in note:
                story.append(Paragraph(
                    f"Matière: {note['subject_name']}",
                    self.styles['Metadata']
                ))
            
            story.append(Spacer(1, 0.2*inch))
            
            # Contenu
            content = note.get('content', '')
            html_content = markdown.markdown(content)
            soup = BeautifulSoup(html_content, 'html.parser')
            
            for para in soup.find_all('p'):
                text = para.get_text().strip()
                if text:
                    story.append(Paragraph(text, self.styles['CustomBody']))
            
            # Séparateur entre notes
            if i < len(notes) - 1:
                story.append(PageBreak())
        
        # Générer
        doc.build(story)
        
        pdf_bytes = buffer.getvalue()
        buffer.close()
        
        return pdf_bytes
    
    async def export_flashcards_to_pdf(
        self,
        flashcards: List[Dict[str, Any]],
        title: str = "Flashcards"
    ) -> bytes:
        """
        Exporter des flashcards en PDF (recto-verso)
        
        Args:
            flashcards: Liste de flashcards
            title: Titre du document
            
        Returns:
            PDF en bytes
        """
        buffer = io.BytesIO()
        
        doc = SimpleDocTemplate(
            buffer,
            pagesize=A4,
            rightMargin=2*cm,
            leftMargin=2*cm,
            topMargin=2*cm,
            bottomMargin=2*cm,
            title=title
        )
        
        story = []
        
        # Titre
        story.append(Paragraph(title, self.styles['CustomTitle']))
        story.append(Paragraph(
            f"{len(flashcards)} flashcard(s)",
            self.styles['Metadata']
        ))
        story.append(Spacer(1, 0.5*inch))
        
        # Chaque flashcard
        for i, card in enumerate(flashcards):
            # Numéro de carte
            story.append(Paragraph(
                f"Flashcard #{i+1}",
                self.styles['CustomSection']
            ))
            story.append(Spacer(1, 0.1*inch))
            
            # Question (recto)
            story.append(Paragraph("Question:", self.styles['Heading4']))
            story.append(Paragraph(
                card.get('front', ''),
                self.styles['CustomBody']
            ))
            story.append(Spacer(1, 0.2*inch))
            
            # Réponse (verso)
            story.append(Paragraph("Réponse:", self.styles['Heading4']))
            story.append(Paragraph(
                card.get('back', ''),
                self.styles['CustomBody']
            ))
            story.append(Spacer(1, 0.4*inch))
            
            # Ligne de séparation
            if i < len(flashcards) - 1:
                story.append(Spacer(1, 0.2*inch))
        
        doc.build(story)
        
        pdf_bytes = buffer.getvalue()
        buffer.close()
        
        return pdf_bytes


# Instance globale du service
pdf_export_service = PDFExportService()
