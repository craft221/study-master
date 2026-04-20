"""
Service OCR pour extraction de texte depuis PDF
Utilise pytesseract + pdf2image + PyMuPDF pour l'extraction OCR
Avec détection avancée de layout, extraction d'images intégrées et post-traitement IA

IMPORTANT (senior note):
pytesseract, PIL, fitz et convert_from_path sont des operations SYNCHRONES
CPU-bound. Les appeler directement dans des fonctions `async` bloque l'event
loop FastAPI entier pendant le traitement — un seul gros PDF peut freezer
tout le backend.

Les methodes publiques (extract_text_from_pdf, extract_text_from_image) sont
donc wrappees pour :
  1. Valider taille et nombre de pages en amont (garde-fou DoS)
  2. Deleguer le travail CPU-bound a un thread pool via asyncio.to_thread
     (libere l'event loop pour d'autres requetes HTTP)
"""
import os
import re
import asyncio
import tempfile
import logging
from typing import Optional, Dict, Any, List, Tuple
from pathlib import Path
import pytesseract
from pdf2image import convert_from_path, pdfinfo_from_path
from PIL import Image, ImageEnhance, ImageFilter
import io

# PyMuPDF pour extraction d'images intégrées
try:
    import fitz  # PyMuPDF
    PYMUPDF_AVAILABLE = True
except ImportError:
    PYMUPDF_AVAILABLE = False
    fitz = None

logger = logging.getLogger(__name__)


# ============================================================
# Garde-fous anti-DoS pour les uploads OCR
# ============================================================
# Ces limites sont conservatrices pour un VPS 4GB/2CPU. A ajuster selon
# la capacite (cf resource.limits dans docker-compose.prod.yml).
MAX_PDF_SIZE_BYTES = 20 * 1024 * 1024   # 20 MB (un PDF >20MB = 99% junk)
MAX_IMAGE_SIZE_BYTES = 10 * 1024 * 1024 # 10 MB pour une image
MAX_PDF_PAGES = 50                       # Cap : OCR sur les 50 premieres pages
MAX_IMAGE_DIMENSION = 8000               # 8000px max par cote (evite les bombs)


class OCRSizeLimitError(ValueError):
    """Leve quand un fichier depasse les limites autorisees."""
    pass


class OCRService:
    """Service pour extraction de texte depuis PDF via OCR avec layout intelligent"""

    # Langues supportées (alignées avec le backend - 10 langues)
    SUPPORTED_LANGUAGES = {
        'fra': {'name': 'Français', 'tesseract': 'fra'},
        'eng': {'name': 'English', 'tesseract': 'eng'},
        'spa': {'name': 'Español', 'tesseract': 'spa'},
        'por': {'name': 'Português', 'tesseract': 'por'},
        'ara': {'name': 'العربية', 'tesseract': 'ara', 'rtl': True},
        'deu': {'name': 'Deutsch', 'tesseract': 'deu'},
        'ita': {'name': 'Italiano', 'tesseract': 'ita'},
        'zho': {'name': '中文', 'tesseract': 'chi_sim'},  # Chinois simplifié
        'jpn': {'name': '日本語', 'tesseract': 'jpn'},
        'kor': {'name': '한국어', 'tesseract': 'kor'},
    }

    # Combinaisons populaires
    LANGUAGE_COMBINATIONS = [
        'fra', 'eng', 'spa', 'por', 'ara', 'deu', 'ita', 'zho', 'jpn', 'kor',
        'fra+eng', 'spa+por', 'deu+eng', 'fra+spa', 'ara+fra', 'ara+eng',
        'zho+eng', 'jpn+eng', 'kor+eng'
    ]

    def __init__(self):
        """Initialiser le service OCR"""
        # Configuration pytesseract (ajuster selon l'installation)
        # pytesseract.pytesseract.tesseract_cmd = r'C:\Program Files\Tesseract-OCR\tesseract.exe'
        self.ai_service = None  # Lazy loading pour éviter import circulaire
        
    def _get_tesseract_lang(self, language: str) -> str:
        """Convertir le code langue en code Tesseract"""
        # Gérer les combinaisons (ex: fra+eng)
        langs = language.split('+')
        tesseract_langs = []
        for lang in langs:
            lang = lang.strip()
            if lang in self.SUPPORTED_LANGUAGES:
                tesseract_langs.append(self.SUPPORTED_LANGUAGES[lang]['tesseract'])
            else:
                tesseract_langs.append(lang)  # Utiliser tel quel si non trouvé
        return '+'.join(tesseract_langs)

    async def _extract_embedded_images(
        self,
        pdf_bytes: bytes,
        min_width: int = 100,
        min_height: int = 100
    ) -> List[Dict[str, Any]]:
        """
        Extraire les images intégrées dans un PDF avec PyMuPDF

        Args:
            pdf_bytes: Contenu du PDF en bytes
            min_width: Largeur minimale des images à extraire
            min_height: Hauteur minimale des images à extraire

        Returns:
            Liste de dictionnaires avec les images et leurs métadonnées
        """
        if not PYMUPDF_AVAILABLE:
            logger.warning("PyMuPDF not available, skipping embedded image extraction")
            return []

        extracted_images = []

        try:
            # Ouvrir le PDF depuis les bytes
            pdf_document = fitz.open(stream=pdf_bytes, filetype="pdf")

            for page_num in range(len(pdf_document)):
                page = pdf_document.load_page(page_num)

                # Obtenir la liste des images sur cette page
                image_list = page.get_images(full=True)

                for img_index, img_info in enumerate(image_list):
                    try:
                        # Extraire l'image
                        xref = img_info[0]  # xref de l'image
                        base_image = pdf_document.extract_image(xref)

                        if base_image:
                            image_bytes = base_image["image"]
                            image_ext = base_image["ext"]
                            width = base_image.get("width", 0)
                            height = base_image.get("height", 0)

                            # Filtrer les petites images (logos, icônes, etc.)
                            if width >= min_width and height >= min_height:
                                # Convertir en PIL Image
                                pil_image = Image.open(io.BytesIO(image_bytes))

                                # Obtenir la position de l'image sur la page
                                img_rect = page.get_image_rects(xref)
                                position = img_rect[0] if img_rect else None

                                extracted_images.append({
                                    'page': page_num + 1,
                                    'index': img_index + 1,
                                    'image': pil_image,
                                    'width': width,
                                    'height': height,
                                    'format': image_ext,
                                    'position': {
                                        'x': position.x0 if position else 0,
                                        'y': position.y0 if position else 0
                                    } if position else None
                                })

                                logger.info(
                                    f"Extracted image from page {page_num + 1}: "
                                    f"{width}x{height} ({image_ext})"
                                )

                    except Exception as e:
                        logger.warning(f"Failed to extract image {img_index} from page {page_num}: {e}")
                        continue

            pdf_document.close()
            logger.info(f"Total embedded images extracted: {len(extracted_images)}")

        except Exception as e:
            logger.error(f"Error extracting embedded images: {e}")

        return extracted_images

    async def _ocr_embedded_images(
        self,
        images: List[Dict[str, Any]],
        language: str,
        detect_layout: bool = True
    ) -> List[Dict[str, Any]]:
        """
        Effectuer l'OCR sur les images extraites

        Args:
            images: Liste des images extraites avec métadonnées
            language: Langue pour l'OCR

        Returns:
            Liste avec le texte extrait de chaque image
        """
        results = []
        tesseract_lang = self._get_tesseract_lang(language)

        for img_data in images:
            try:
                image = img_data['image']

                # Prétraitement de l'image
                processed_image = await self._preprocess_image_advanced(image)

                # Détecter le layout si demandé
                layout_type = 'single_column'
                if detect_layout:
                    layout_type = self._detect_layout_type(processed_image)

                psm_config = self._get_psm_for_layout(layout_type)

                # OCR sur l'image
                text = pytesseract.image_to_string(
                    processed_image,
                    lang=tesseract_lang,
                    config=psm_config
                )

                # Calculer la confiance
                details = pytesseract.image_to_data(
                    processed_image,
                    lang=tesseract_lang,
                    output_type=pytesseract.Output.DICT
                )

                confidences = [
                    float(conf) for conf in details['conf']
                    if conf != '-1' and float(conf) > 0
                ]
                avg_confidence = sum(confidences) / len(confidences) if confidences else 0.0

                if text.strip():  # Ne garder que les images avec du texte
                    results.append({
                        'page': img_data['page'],
                        'image_index': img_data['index'],
                        'text': text.strip(),
                        'confidence': round(avg_confidence, 2),
                        'size': f"{img_data['width']}x{img_data['height']}",
                        'layout_type': layout_type
                    })

            except Exception as e:
                logger.warning(f"OCR failed for embedded image: {e}")
                continue

        return results

    def _detect_layout_type(self, image: Image.Image) -> str:
        """
        Détecter le type de layout de l'image
        Returns: 'single_column', 'multi_column', 'table', 'mixed'
        """
        try:
            # Utiliser Tesseract pour analyser la structure
            osd = pytesseract.image_to_osd(image, output_type=pytesseract.Output.DICT)

            # Analyser les blocs de texte
            data = pytesseract.image_to_data(
                image,
                output_type=pytesseract.Output.DICT,
                config='--psm 0'  # Orientation and script detection
            )

            # Compter les blocs par position horizontale
            block_positions = {}
            for i, block_num in enumerate(data.get('block_num', [])):
                if block_num > 0 and data['text'][i].strip():
                    left = data['left'][i]
                    # Grouper par colonne (zones de 200px)
                    col = left // 200
                    block_positions[col] = block_positions.get(col, 0) + 1

            num_columns = len(block_positions)

            if num_columns >= 3:
                return 'table'
            elif num_columns == 2:
                return 'multi_column'
            else:
                return 'single_column'

        except Exception as e:
            logger.warning(f"Layout detection failed: {e}")
            return 'single_column'

    def _get_psm_for_layout(self, layout_type: str) -> str:
        """
        Retourner le PSM (Page Segmentation Mode) optimal pour le type de layout

        PSM modes:
        0 = OSD only
        1 = Automatic page segmentation with OSD
        3 = Fully automatic page segmentation (default)
        4 = Single column of text
        6 = Single uniform block of text
        11 = Sparse text
        12 = Sparse text with OSD
        """
        psm_map = {
            'single_column': '--psm 4',  # Single column - préserve l'ordre vertical
            'multi_column': '--psm 1',   # Auto avec OSD - détecte les colonnes
            'table': '--psm 6',          # Block uniforme - meilleur pour les tables
            'mixed': '--psm 3',          # Auto complet
        }
        return psm_map.get(layout_type, '--psm 3')

    async def _extract_table_structure(
        self,
        image: Image.Image,
        language: str
    ) -> Optional[str]:
        """
        Extraire les tables avec préservation de la structure
        Retourne le texte formaté en Markdown
        """
        try:
            # Utiliser TSV output pour préserver la structure
            tsv_data = pytesseract.image_to_data(
                image,
                lang=language,
                output_type=pytesseract.Output.DICT,
                config='--psm 6'  # Uniform block
            )

            # Organiser par lignes (basé sur top position)
            rows = {}
            for i in range(len(tsv_data['text'])):
                text = tsv_data['text'][i].strip()
                if text:
                    top = tsv_data['top'][i]
                    left = tsv_data['left'][i]
                    # Grouper par ligne (tolérance de 20px)
                    row_key = top // 20
                    if row_key not in rows:
                        rows[row_key] = []
                    rows[row_key].append((left, text))

            # Trier les lignes et les colonnes
            sorted_rows = sorted(rows.items())
            markdown_table = []

            for row_key, cells in sorted_rows:
                # Trier les cellules par position horizontale
                sorted_cells = sorted(cells, key=lambda x: x[0])
                row_text = ' | '.join([cell[1] for cell in sorted_cells])
                markdown_table.append(f"| {row_text} |")

            if markdown_table:
                # Ajouter le séparateur après la première ligne (header)
                if len(markdown_table) > 1:
                    num_cols = markdown_table[0].count('|') - 1
                    separator = '|' + '---|' * num_cols
                    markdown_table.insert(1, separator)

                return '\n'.join(markdown_table)

            return None

        except Exception as e:
            logger.warning(f"Table extraction failed: {e}")
            return None

    async def extract_text_from_pdf(
        self,
        pdf_file: bytes,
        language: str = 'fra+eng',
        detect_layout: bool = True,
        ai_post_process: bool = False
    ) -> Dict[str, Any]:
        """
        Extraire le texte d'un fichier PDF via OCR avec détection de layout

        Args:
            pdf_file: Contenu du PDF en bytes
            language: Langue(s) pour l'OCR
            detect_layout: Activer la détection automatique de layout
            ai_post_process: Activer le post-traitement IA

        Returns:
            Dict avec extracted_text, page_count, confidence

        Raises:
            OCRSizeLimitError: si le PDF depasse MAX_PDF_SIZE_BYTES ou MAX_PDF_PAGES
        """
        # ------------------------------------------------------------
        # Garde-fous DoS : valider AVANT toute operation couteuse
        # ------------------------------------------------------------
        if len(pdf_file) > MAX_PDF_SIZE_BYTES:
            raise OCRSizeLimitError(
                f"PDF trop volumineux: {len(pdf_file)} bytes "
                f"(max {MAX_PDF_SIZE_BYTES} bytes = {MAX_PDF_SIZE_BYTES // (1024*1024)} MB)"
            )

        extracted_text = []
        page_count = 0
        total_confidence = 0.0
        tesseract_lang = self._get_tesseract_lang(language)

        try:
            # Créer un fichier temporaire pour le PDF
            with tempfile.NamedTemporaryFile(suffix='.pdf', delete=False) as temp_pdf:
                temp_pdf.write(pdf_file)
                temp_pdf_path = temp_pdf.name

            try:
                # Pre-check : nombre de pages AVANT la rasterisation (pdfinfo = cheap)
                pdf_info = await asyncio.to_thread(pdfinfo_from_path, temp_pdf_path)
                total_pages_in_pdf = pdf_info.get("Pages", 0)
                if total_pages_in_pdf > MAX_PDF_PAGES:
                    raise OCRSizeLimitError(
                        f"PDF trop long: {total_pages_in_pdf} pages "
                        f"(max {MAX_PDF_PAGES}). Segmentez le document."
                    )

                # Convertir PDF en images (300 DPI pour qualité optimale)
                # CPU-bound : delegue a un thread pour ne pas bloquer l'event loop
                images = await asyncio.to_thread(
                    convert_from_path, temp_pdf_path, dpi=300
                )
                page_count = len(images)

                # OCR sur chaque page
                for i, image in enumerate(images):
                    # Prétraitement de l'image
                    processed_image = await self._preprocess_image_advanced(image)

                    # Détecter le type de layout
                    layout_type = 'single_column'
                    if detect_layout:
                        layout_type = self._detect_layout_type(processed_image)

                    logger.info(f"Page {i+1}: Layout détecté = {layout_type}")

                    # Configuration Tesseract selon le layout
                    psm_config = self._get_psm_for_layout(layout_type)

                    # Extraction selon le type de layout
                    # pytesseract.image_to_string est CPU-bound (bloquant) :
                    # on delegue a un thread pour ne pas bloquer l'event loop.
                    if layout_type == 'table':
                        # Essayer d'extraire la structure de table
                        table_text = await self._extract_table_structure(
                            processed_image, tesseract_lang
                        )
                        if table_text:
                            text = table_text
                        else:
                            text = await asyncio.to_thread(
                                pytesseract.image_to_string,
                                processed_image,
                                lang=tesseract_lang,
                                config=psm_config
                            )
                    elif layout_type == 'multi_column':
                        # Pour les colonnes, extraire avec préservation de l'ordre
                        text = await self._extract_columns(
                            processed_image, tesseract_lang
                        )
                    else:
                        # Extraction standard
                        text = await asyncio.to_thread(
                            pytesseract.image_to_string,
                            processed_image,
                            lang=tesseract_lang,
                            config=psm_config
                        )

                    # Obtenir les détails avec confidence (egalement CPU-bound)
                    details = await asyncio.to_thread(
                        pytesseract.image_to_data,
                        processed_image,
                        lang=tesseract_lang,
                        output_type=pytesseract.Output.DICT
                    )

                    # Calculer confidence moyenne
                    confidences = [
                        float(conf) for conf in details['conf']
                        if conf != '-1' and float(conf) > 0
                    ]
                    page_confidence = sum(confidences) / len(confidences) if confidences else 0.0
                    total_confidence += page_confidence

                    extracted_text.append({
                        'page': i + 1,
                        'text': text.strip(),
                        'confidence': round(page_confidence, 2),
                        'layout_type': layout_type
                    })

                # Extraire et OCR les images intégrées dans le PDF
                embedded_images_text = []
                if PYMUPDF_AVAILABLE:
                    logger.info("Extracting embedded images from PDF...")
                    embedded_images = await self._extract_embedded_images(pdf_file)

                    if embedded_images:
                        logger.info(f"Found {len(embedded_images)} embedded images, running OCR...")
                        embedded_results = await self._ocr_embedded_images(
                            embedded_images, language, detect_layout
                        )

                        # Ajouter le texte des images aux pages correspondantes
                        for result in embedded_results:
                            page_num = result['page']
                            # Trouver la page correspondante
                            for page_data in extracted_text:
                                if page_data['page'] == page_num:
                                    # Ajouter le texte de l'image intégrée
                                    if result['text']:
                                        page_data['text'] += f"\n\n[Image intégrée {result['image_index']}]\n{result['text']}"
                                        # Ajouter aux métadonnées
                                        if 'embedded_images' not in page_data:
                                            page_data['embedded_images'] = []
                                        page_data['embedded_images'].append({
                                            'index': result['image_index'],
                                            'text': result['text'],
                                            'confidence': result['confidence'],
                                            'size': result['size']
                                        })
                                    break

                            embedded_images_text.append(result)

                        logger.info(f"Extracted text from {len(embedded_results)} embedded images")

                # Texte complet
                full_text = '\n\n--- Page Break ---\n\n'.join(
                    page['text'] for page in extracted_text
                )

                # Confidence moyenne globale
                avg_confidence = round(
                    total_confidence / page_count, 2
                ) if page_count > 0 else 0.0

                # Post-traitement IA optionnel
                if ai_post_process and avg_confidence < 85:
                    full_text = await self._ai_post_process(full_text, language)

                return {
                    'success': True,
                    'full_text': full_text,
                    'pages': extracted_text,
                    'page_count': page_count,
                    'average_confidence': avg_confidence,
                    'language': language,
                    'embedded_images_count': len(embedded_images_text),
                    'embedded_images': embedded_images_text
                }

            finally:
                # Nettoyer le fichier temporaire
                if os.path.exists(temp_pdf_path):
                    os.unlink(temp_pdf_path)

        except OCRSizeLimitError:
            # Propager : la route API doit retourner HTTP 413 (Payload Too Large)
            raise
        except Exception as e:
            logger.error(f"OCR extraction failed: {e}")
            return {
                'success': False,
                'error': str(e),
                'full_text': '',
                'pages': [],
                'page_count': 0,
                'average_confidence': 0.0
            }

    async def _extract_columns(
        self,
        image: Image.Image,
        language: str
    ) -> str:
        """
        Extraire le texte de documents multi-colonnes en préservant l'ordre de lecture
        """
        try:
            # Obtenir les données avec positions
            data = pytesseract.image_to_data(
                image,
                lang=language,
                output_type=pytesseract.Output.DICT,
                config='--psm 1'  # Auto with OSD
            )

            # Organiser par blocs
            blocks = {}
            for i in range(len(data['text'])):
                block_num = data['block_num'][i]
                if block_num > 0:
                    if block_num not in blocks:
                        blocks[block_num] = {
                            'left': data['left'][i],
                            'top': data['top'][i],
                            'texts': []
                        }
                    if data['text'][i].strip():
                        blocks[block_num]['texts'].append(data['text'][i])

            # Déterminer les colonnes (grouper par position left)
            width = image.width
            mid_point = width // 2

            left_column = []
            right_column = []

            for block_num, block_data in blocks.items():
                text = ' '.join(block_data['texts'])
                if text.strip():
                    if block_data['left'] < mid_point:
                        left_column.append((block_data['top'], text))
                    else:
                        right_column.append((block_data['top'], text))

            # Trier par position verticale
            left_column.sort(key=lambda x: x[0])
            right_column.sort(key=lambda x: x[0])

            # Combiner: d'abord colonne gauche, puis colonne droite
            result = []
            result.extend([text for _, text in left_column])
            result.append('\n--- Colonne suivante ---\n')
            result.extend([text for _, text in right_column])

            return '\n'.join(result)

        except Exception as e:
            logger.warning(f"Column extraction failed: {e}, falling back to standard")
            return pytesseract.image_to_string(image, lang=language, config='--psm 3')
    
    async def extract_text_from_image(
        self,
        image_file: bytes,
        language: str = 'fra+eng',
        detect_layout: bool = True,
        ai_post_process: bool = False
    ) -> Dict[str, Any]:
        """
        Extraire le texte d'une image via OCR

        Args:
            image_file: Contenu de l'image en bytes
            language: Langue(s) pour l'OCR
            detect_layout: Activer la détection automatique de layout
            ai_post_process: Activer le post-traitement IA

        Returns:
            Dict avec extracted_text, confidence

        Raises:
            OCRSizeLimitError: si l'image depasse MAX_IMAGE_SIZE_BYTES ou MAX_IMAGE_DIMENSION
        """
        # ------------------------------------------------------------
        # Garde-fous DoS : valider AVANT toute operation couteuse
        # ------------------------------------------------------------
        if len(image_file) > MAX_IMAGE_SIZE_BYTES:
            raise OCRSizeLimitError(
                f"Image trop volumineuse: {len(image_file)} bytes "
                f"(max {MAX_IMAGE_SIZE_BYTES} bytes = {MAX_IMAGE_SIZE_BYTES // (1024*1024)} MB)"
            )

        try:
            # Charger l'image
            image = Image.open(io.BytesIO(image_file))

            # Anti-decompression-bomb : rejete les images > MAX_IMAGE_DIMENSION px
            if max(image.size) > MAX_IMAGE_DIMENSION:
                raise OCRSizeLimitError(
                    f"Image trop grande: {image.size[0]}x{image.size[1]}px "
                    f"(max {MAX_IMAGE_DIMENSION}px par cote)"
                )

            tesseract_lang = self._get_tesseract_lang(language)

            # Prétraitement avancé
            processed_image = await self._preprocess_image_advanced(image)

            # Détecter le layout si activé
            layout_type = 'single_column'
            if detect_layout:
                layout_type = self._detect_layout_type(processed_image)

            # Configuration selon le layout
            psm_config = self._get_psm_for_layout(layout_type)

            # Extraction selon le type
            # pytesseract est CPU-bound : delegue a un thread pour liberer l'event loop.
            if layout_type == 'table':
                table_text = await self._extract_table_structure(processed_image, tesseract_lang)
                text = table_text if table_text else await asyncio.to_thread(
                    pytesseract.image_to_string,
                    processed_image, lang=tesseract_lang, config=psm_config
                )
            elif layout_type == 'multi_column':
                text = await self._extract_columns(processed_image, tesseract_lang)
            else:
                text = await asyncio.to_thread(
                    pytesseract.image_to_string,
                    processed_image,
                    lang=tesseract_lang,
                    config=psm_config
                )

            # Obtenir confidence (CPU-bound egalement)
            details = await asyncio.to_thread(
                pytesseract.image_to_data,
                processed_image,
                lang=tesseract_lang,
                output_type=pytesseract.Output.DICT
            )

            confidences = [
                float(conf) for conf in details['conf']
                if conf != '-1' and float(conf) > 0
            ]
            avg_confidence = sum(confidences) / len(confidences) if confidences else 0.0

            # Post-traitement IA si activé et confidence faible
            if ai_post_process and avg_confidence < 85:
                text = await self._ai_post_process(text.strip(), language)

            return {
                'success': True,
                'text': text.strip(),
                'confidence': round(avg_confidence, 2),
                'language': language,
                'layout_type': layout_type
            }

        except OCRSizeLimitError:
            # Propager : la route API doit retourner HTTP 413 (Payload Too Large)
            raise
        except Exception as e:
            logger.error(f"Image OCR failed: {e}")
            return {
                'success': False,
                'error': str(e),
                'text': '',
                'confidence': 0.0
            }

    async def _preprocess_image_advanced(
        self,
        image: Image.Image
    ) -> Image.Image:
        """
        Prétraitement avancé pour améliorer la qualité OCR

        Techniques appliquées:
        1. Conversion en niveaux de gris
        2. Augmentation du contraste
        3. Netteté (sharpening)
        4. Débruitage léger
        """
        try:
            # Convertir en RGB si nécessaire (pour les images RGBA ou P)
            if image.mode in ('RGBA', 'P'):
                image = image.convert('RGB')

            # Convertir en niveaux de gris
            gray = image.convert('L')

            # Augmenter le contraste
            enhancer = ImageEnhance.Contrast(gray)
            contrasted = enhancer.enhance(1.5)

            # Augmenter la netteté
            sharpener = ImageEnhance.Sharpness(contrasted)
            sharpened = sharpener.enhance(2.0)

            # Débruitage léger avec filtre médian
            denoised = sharpened.filter(ImageFilter.MedianFilter(size=3))

            return denoised

        except Exception as e:
            logger.warning(f"Image preprocessing failed: {e}, using original")
            return image

    async def _ai_post_process(
        self,
        text: str,
        language: str
    ) -> str:
        """
        Post-traitement IA pour corriger les erreurs OCR courantes

        Utilise Claude pour:
        1. Corriger les erreurs de reconnaissance (0/O, l/1, etc.)
        2. Restaurer la ponctuation manquante
        3. Corriger l'orthographe contextuelle
        4. Préserver la structure (paragraphes, listes)
        """
        if not text or len(text.strip()) < 50:
            return text

        try:
            # Lazy loading du service IA
            if self.ai_service is None:
                from app.services.ai_service import ai_service
                self.ai_service = ai_service

            # Déterminer la langue principale pour le prompt
            lang_name = self.SUPPORTED_LANGUAGES.get(
                language.split('+')[0], {}
            ).get('name', 'Français')

            prompt = f"""Tu es un expert en correction de texte OCR. Voici un texte extrait par OCR qui peut contenir des erreurs de reconnaissance.

INSTRUCTIONS:
1. Corrige les erreurs OCR courantes (0↔O, l↔1, rn↔m, etc.)
2. Restaure la ponctuation manquante ou incorrecte
3. Corrige l'orthographe en tenant compte du contexte
4. Préserve EXACTEMENT la structure (paragraphes, listes, sauts de ligne)
5. Ne modifie PAS le sens du texte
6. Ne traduis PAS le texte
7. Le texte est en {lang_name}

TEXTE OCR À CORRIGER:
---
{text[:4000]}
---

TEXTE CORRIGÉ (même structure, erreurs corrigées):"""

            # Appeler Claude pour la correction
            corrected = await self.ai_service.generate_text(
                prompt=prompt,
                max_tokens=4500,
                temperature=0.1  # Basse température pour plus de précision
            )

            if corrected and len(corrected.strip()) > len(text) * 0.5:
                logger.info(f"AI post-processing: {len(text)} -> {len(corrected)} chars")
                return corrected.strip()
            else:
                logger.warning("AI post-processing returned invalid result, using original")
                return text

        except Exception as e:
            logger.error(f"AI post-processing failed: {e}")
            return text

    def get_supported_languages(self) -> Dict[str, Any]:
        """Retourner les langues supportées avec détails"""
        return {
            'languages': self.SUPPORTED_LANGUAGES,
            'combinations': self.LANGUAGE_COMBINATIONS
        }

    def get_language_list(self) -> List[str]:
        """Retourner la liste simple des codes langue"""
        return list(self.SUPPORTED_LANGUAGES.keys())


# Instance globale du service
ocr_service = OCRService()
