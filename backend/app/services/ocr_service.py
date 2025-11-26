"""
Service OCR pour extraction de texte depuis PDF
Utilise pytesseract + pdf2image pour l'extraction OCR
"""
import os
import tempfile
from typing import Optional, Dict, Any
from pathlib import Path
import pytesseract
from pdf2image import convert_from_path
from PIL import Image
import io


class OCRService:
    """Service pour extraction de texte depuis PDF via OCR"""
    
    def __init__(self):
        """Initialiser le service OCR"""
        # Configuration pytesseract (ajuster selon l'installation)
        # pytesseract.pytesseract.tesseract_cmd = r'C:\Program Files\Tesseract-OCR\tesseract.exe'
        self.supported_languages = ['fra', 'eng']  # Français et Anglais
        
    async def extract_text_from_pdf(
        self,
        pdf_file: bytes,
        language: str = 'fra+eng'
    ) -> Dict[str, Any]:
        """
        Extraire le texte d'un fichier PDF via OCR
        
        Args:
            pdf_file: Contenu du PDF en bytes
            language: Langue(s) pour l'OCR (fra, eng, fra+eng)
            
        Returns:
            Dict avec extracted_text, page_count, confidence
        """
        extracted_text = []
        page_count = 0
        total_confidence = 0.0
        
        try:
            # Créer un fichier temporaire pour le PDF
            with tempfile.NamedTemporaryFile(suffix='.pdf', delete=False) as temp_pdf:
                temp_pdf.write(pdf_file)
                temp_pdf_path = temp_pdf.name
            
            try:
                # Convertir PDF en images
                images = convert_from_path(temp_pdf_path, dpi=300)
                page_count = len(images)
                
                # OCR sur chaque page
                for i, image in enumerate(images):
                    # Extraire le texte
                    text = pytesseract.image_to_string(
                        image, 
                        lang=language,
                        config='--psm 3'  # Page segmentation mode
                    )
                    
                    # Obtenir les détails avec confidence
                    details = pytesseract.image_to_data(
                        image, 
                        lang=language, 
                        output_type=pytesseract.Output.DICT
                    )
                    
                    # Calculer confidence moyenne
                    confidences = [
                        float(conf) for conf in details['conf'] 
                        if conf != '-1'
                    ]
                    page_confidence = sum(confidences) / len(confidences) if confidences else 0.0
                    total_confidence += page_confidence
                    
                    extracted_text.append({
                        'page': i + 1,
                        'text': text.strip(),
                        'confidence': round(page_confidence, 2)
                    })
                
                # Texte complet
                full_text = '\n\n--- Page Break ---\n\n'.join(
                    page['text'] for page in extracted_text
                )
                
                # Confidence moyenne globale
                avg_confidence = round(
                    total_confidence / page_count, 2
                ) if page_count > 0 else 0.0
                
                return {
                    'success': True,
                    'full_text': full_text,
                    'pages': extracted_text,
                    'page_count': page_count,
                    'average_confidence': avg_confidence,
                    'language': language
                }
                
            finally:
                # Nettoyer le fichier temporaire
                if os.path.exists(temp_pdf_path):
                    os.unlink(temp_pdf_path)
                    
        except Exception as e:
            return {
                'success': False,
                'error': str(e),
                'full_text': '',
                'pages': [],
                'page_count': 0,
                'average_confidence': 0.0
            }
    
    async def extract_text_from_image(
        self,
        image_file: bytes,
        language: str = 'fra+eng'
    ) -> Dict[str, Any]:
        """
        Extraire le texte d'une image via OCR
        
        Args:
            image_file: Contenu de l'image en bytes
            language: Langue(s) pour l'OCR
            
        Returns:
            Dict avec extracted_text, confidence
        """
        try:
            # Charger l'image
            image = Image.open(io.BytesIO(image_file))
            
            # Extraire le texte
            text = pytesseract.image_to_string(
                image,
                lang=language,
                config='--psm 3'
            )
            
            # Obtenir confidence
            details = pytesseract.image_to_data(
                image,
                lang=language,
                output_type=pytesseract.Output.DICT
            )
            
            confidences = [
                float(conf) for conf in details['conf']
                if conf != '-1'
            ]
            avg_confidence = sum(confidences) / len(confidences) if confidences else 0.0
            
            return {
                'success': True,
                'text': text.strip(),
                'confidence': round(avg_confidence, 2),
                'language': language
            }
            
        except Exception as e:
            return {
                'success': False,
                'error': str(e),
                'text': '',
                'confidence': 0.0
            }
    
    async def preprocess_image_for_ocr(
        self,
        image: Image.Image
    ) -> Image.Image:
        """
        Prétraiter une image pour améliorer la qualité OCR
        
        Args:
            image: Image PIL
            
        Returns:
            Image prétraitée
        """
        # Convertir en niveaux de gris
        image = image.convert('L')
        
        # Augmenter le contraste (optionnel)
        from PIL import ImageEnhance
        enhancer = ImageEnhance.Contrast(image)
        image = enhancer.enhance(2.0)
        
        # Binarisation (seuil adaptatif)
        # Ceci pourrait être amélioré avec OpenCV pour de meilleurs résultats
        
        return image
    
    def get_supported_languages(self) -> list:
        """Retourner les langues supportées"""
        return self.supported_languages


# Instance globale du service
ocr_service = OCRService()
