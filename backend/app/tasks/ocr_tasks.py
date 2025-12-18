"""
Tâches asynchrones pour l'OCR avec Celery
Support: layout detection, AI post-processing, 10 langues
"""
import os
import io
import tempfile
import logging
from celery import Task
from app.celery_app import celery_app
from typing import Dict, Any, Optional, List
import pytesseract
from PIL import Image, ImageEnhance, ImageFilter
from pdf2image import convert_from_path
from app.core.config import settings

logger = logging.getLogger(__name__)

# Mapping des langues (aligné avec ocr_service.py)
LANGUAGE_MAP = {
    'fra': 'fra', 'eng': 'eng', 'spa': 'spa', 'por': 'por',
    'ara': 'ara', 'deu': 'deu', 'ita': 'ita',
    'zho': 'chi_sim', 'jpn': 'jpn', 'kor': 'kor',
}


class OCRTask(Task):
    """Classe de base pour les tâches OCR avec retry automatique"""
    autoretry_for = (Exception,)
    retry_kwargs = {"max_retries": 2}
    retry_backoff = True

    # Services lazy-loaded
    _ai_service = None

    @property
    def ai_service(self):
        if self._ai_service is None:
            from app.services.ai_service import ai_service
            self._ai_service = ai_service
        return self._ai_service


def get_tesseract_lang(language: str) -> str:
    """Convertir le code langue en code Tesseract"""
    langs = language.split('+')
    tesseract_langs = []
    for lang in langs:
        lang = lang.strip()
        tesseract_langs.append(LANGUAGE_MAP.get(lang, lang))
    return '+'.join(tesseract_langs)


def preprocess_image(image: Image.Image) -> Image.Image:
    """Prétraitement pour améliorer l'OCR"""
    try:
        if image.mode in ('RGBA', 'P'):
            image = image.convert('RGB')
        gray = image.convert('L')
        contrasted = ImageEnhance.Contrast(gray).enhance(1.5)
        sharpened = ImageEnhance.Sharpness(contrasted).enhance(2.0)
        denoised = sharpened.filter(ImageFilter.MedianFilter(size=3))
        return denoised
    except Exception:
        return image


def detect_layout_type(image: Image.Image) -> str:
    """Détecter le type de layout (single_column, multi_column, table)"""
    try:
        data = pytesseract.image_to_data(
            image, output_type=pytesseract.Output.DICT, config='--psm 0'
        )
        block_positions = {}
        for i, block_num in enumerate(data.get('block_num', [])):
            if block_num > 0 and data['text'][i].strip():
                col = data['left'][i] // 200
                block_positions[col] = block_positions.get(col, 0) + 1

        num_columns = len(block_positions)
        if num_columns >= 3:
            return 'table'
        elif num_columns == 2:
            return 'multi_column'
        return 'single_column'
    except Exception:
        return 'single_column'


def get_psm_config(layout_type: str) -> str:
    """Retourner la config PSM optimale pour le layout"""
    return {
        'single_column': '--psm 4',
        'multi_column': '--psm 1',
        'table': '--psm 6',
    }.get(layout_type, '--psm 3')


def extract_table_as_markdown(image: Image.Image, language: str) -> Optional[str]:
    """Extraire une table et la formater en Markdown"""
    try:
        data = pytesseract.image_to_data(
            image, lang=language,
            output_type=pytesseract.Output.DICT, config='--psm 6'
        )
        rows = {}
        for i in range(len(data['text'])):
            text = data['text'][i].strip()
            if text:
                row_key = data['top'][i] // 20
                if row_key not in rows:
                    rows[row_key] = []
                rows[row_key].append((data['left'][i], text))

        sorted_rows = sorted(rows.items())
        markdown_table = []
        for _, cells in sorted_rows:
            sorted_cells = sorted(cells, key=lambda x: x[0])
            row_text = ' | '.join([cell[1] for cell in sorted_cells])
            markdown_table.append(f"| {row_text} |")

        if markdown_table and len(markdown_table) > 1:
            num_cols = markdown_table[0].count('|') - 1
            separator = '|' + '---|' * num_cols
            markdown_table.insert(1, separator)
            return '\n'.join(markdown_table)
        return None
    except Exception:
        return None


def extract_columns(image: Image.Image, language: str) -> str:
    """Extraire le texte de colonnes multiples en préservant l'ordre"""
    try:
        data = pytesseract.image_to_data(
            image, lang=language,
            output_type=pytesseract.Output.DICT, config='--psm 1'
        )
        blocks = {}
        for i in range(len(data['text'])):
            block_num = data['block_num'][i]
            if block_num > 0:
                if block_num not in blocks:
                    blocks[block_num] = {'left': data['left'][i], 'top': data['top'][i], 'texts': []}
                if data['text'][i].strip():
                    blocks[block_num]['texts'].append(data['text'][i])

        mid_point = image.width // 2
        left_col, right_col = [], []

        for block_data in blocks.values():
            text = ' '.join(block_data['texts'])
            if text.strip():
                if block_data['left'] < mid_point:
                    left_col.append((block_data['top'], text))
                else:
                    right_col.append((block_data['top'], text))

        left_col.sort(key=lambda x: x[0])
        right_col.sort(key=lambda x: x[0])

        result = [text for _, text in left_col]
        if right_col:
            result.append('\n--- Colonne suivante ---\n')
            result.extend([text for _, text in right_col])
        return '\n'.join(result)
    except Exception:
        return pytesseract.image_to_string(image, lang=language, config='--psm 3')


@celery_app.task(base=OCRTask, bind=True, name="app.tasks.ocr_tasks.process_ocr_async")
def process_ocr_async(
    self,
    file_content_b64: str,
    file_type: str,
    language: str = "fra+eng",
    detect_layout: bool = True,
    ai_post_process: bool = False,
    user_id: Optional[int] = None,
    create_note: bool = False,
    subject_id: Optional[int] = None,
    note_title: Optional[str] = None
) -> Dict[str, Any]:
    """
    Tâche OCR asynchrone complète avec toutes les fonctionnalités

    Args:
        file_content_b64: Contenu du fichier encodé en base64
        file_type: 'pdf' ou 'image'
        language: Code(s) langue pour l'OCR
        detect_layout: Activer la détection de layout
        ai_post_process: Activer le post-traitement IA
        user_id: ID utilisateur (pour création de note)
        create_note: Créer une note automatiquement
        subject_id: ID de la matière
        note_title: Titre de la note
    """
    import base64

    task_id = self.request.id
    tesseract_lang = get_tesseract_lang(language)

    try:
        # Décoder le contenu
        file_content = base64.b64decode(file_content_b64)

        self.update_state(state="PROCESSING", meta={
            "status": "Préparation du fichier...",
            "progress": 5,
            "task_id": task_id
        })

        if file_type == "pdf":
            result = _process_pdf_ocr(
                self, file_content, tesseract_lang, language,
                detect_layout, ai_post_process
            )
        else:
            result = _process_image_ocr(
                self, file_content, tesseract_lang, language,
                detect_layout, ai_post_process
            )

        if not result['success']:
            return result

        # Créer la note si demandé
        note_id = None
        if create_note and user_id and result.get('full_text'):
            note_id = _create_note_from_ocr(
                user_id, result['full_text'], subject_id, note_title,
                result.get('average_confidence', 0)
            )

        result['note_id'] = note_id
        result['task_id'] = task_id

        self.update_state(state="SUCCESS", meta={
            "status": "Terminé",
            "progress": 100,
            "task_id": task_id
        })

        return result

    except Exception as e:
        logger.error(f"OCR task failed: {e}")
        return {
            "success": False,
            "error": str(e),
            "task_id": task_id
        }


def _process_pdf_ocr(
    task: OCRTask,
    pdf_content: bytes,
    tesseract_lang: str,
    language: str,
    detect_layout: bool,
    ai_post_process: bool
) -> Dict[str, Any]:
    """Traiter un PDF avec OCR"""
    extracted_pages = []
    total_confidence = 0.0

    # Créer fichier temporaire
    with tempfile.NamedTemporaryFile(suffix='.pdf', delete=False) as temp_pdf:
        temp_pdf.write(pdf_content)
        temp_pdf_path = temp_pdf.name

    try:
        task.update_state(state="PROCESSING", meta={
            "status": "Conversion PDF en images...",
            "progress": 10
        })

        images = convert_from_path(temp_pdf_path, dpi=300)
        page_count = len(images)

        for i, image in enumerate(images):
            progress = 10 + int((i / page_count) * 70)
            task.update_state(state="PROCESSING", meta={
                "status": f"OCR page {i+1}/{page_count}...",
                "progress": progress,
                "current_page": i + 1,
                "total_pages": page_count
            })

            # Prétraitement
            processed = preprocess_image(image)

            # Détection layout
            layout_type = 'single_column'
            if detect_layout:
                layout_type = detect_layout_type(processed)

            psm_config = get_psm_config(layout_type)

            # Extraction selon le layout
            if layout_type == 'table':
                text = extract_table_as_markdown(processed, tesseract_lang)
                if not text:
                    text = pytesseract.image_to_string(processed, lang=tesseract_lang, config=psm_config)
            elif layout_type == 'multi_column':
                text = extract_columns(processed, tesseract_lang)
            else:
                text = pytesseract.image_to_string(processed, lang=tesseract_lang, config=psm_config)

            # Confidence
            details = pytesseract.image_to_data(
                processed, lang=tesseract_lang, output_type=pytesseract.Output.DICT
            )
            confidences = [float(c) for c in details['conf'] if c != '-1' and float(c) > 0]
            page_conf = sum(confidences) / len(confidences) if confidences else 0.0
            total_confidence += page_conf

            extracted_pages.append({
                'page': i + 1,
                'text': text.strip(),
                'confidence': round(page_conf, 2),
                'layout_type': layout_type
            })

        full_text = '\n\n--- Page Break ---\n\n'.join(p['text'] for p in extracted_pages)
        avg_confidence = round(total_confidence / page_count, 2) if page_count > 0 else 0.0

        # Post-traitement IA
        if ai_post_process and avg_confidence < 85 and full_text:
            task.update_state(state="PROCESSING", meta={
                "status": "Correction IA en cours...",
                "progress": 85
            })
            full_text = _ai_post_process_sync(full_text, language)

        return {
            'success': True,
            'full_text': full_text,
            'pages': extracted_pages,
            'page_count': page_count,
            'average_confidence': avg_confidence,
            'language': language
        }

    finally:
        if os.path.exists(temp_pdf_path):
            os.unlink(temp_pdf_path)


def _process_image_ocr(
    task: OCRTask,
    image_content: bytes,
    tesseract_lang: str,
    language: str,
    detect_layout: bool,
    ai_post_process: bool
) -> Dict[str, Any]:
    """Traiter une image avec OCR"""
    task.update_state(state="PROCESSING", meta={
        "status": "Analyse de l'image...",
        "progress": 20
    })

    image = Image.open(io.BytesIO(image_content))
    processed = preprocess_image(image)

    # Détection layout
    layout_type = 'single_column'
    if detect_layout:
        layout_type = detect_layout_type(processed)

    task.update_state(state="PROCESSING", meta={
        "status": f"Extraction du texte ({layout_type})...",
        "progress": 50
    })

    psm_config = get_psm_config(layout_type)

    # Extraction selon le layout
    if layout_type == 'table':
        text = extract_table_as_markdown(processed, tesseract_lang)
        if not text:
            text = pytesseract.image_to_string(processed, lang=tesseract_lang, config=psm_config)
    elif layout_type == 'multi_column':
        text = extract_columns(processed, tesseract_lang)
    else:
        text = pytesseract.image_to_string(processed, lang=tesseract_lang, config=psm_config)

    # Confidence
    details = pytesseract.image_to_data(
        processed, lang=tesseract_lang, output_type=pytesseract.Output.DICT
    )
    confidences = [float(c) for c in details['conf'] if c != '-1' and float(c) > 0]
    avg_confidence = sum(confidences) / len(confidences) if confidences else 0.0

    # Post-traitement IA
    if ai_post_process and avg_confidence < 85 and text:
        task.update_state(state="PROCESSING", meta={
            "status": "Correction IA en cours...",
            "progress": 80
        })
        text = _ai_post_process_sync(text, language)

    return {
        'success': True,
        'full_text': text.strip(),
        'text': text.strip(),
        'confidence': round(avg_confidence, 2),
        'average_confidence': round(avg_confidence, 2),
        'layout_type': layout_type,
        'language': language
    }


def _ai_post_process_sync(text: str, language: str) -> str:
    """Post-traitement IA synchrone (pour Celery)"""
    if not text or len(text.strip()) < 50:
        return text

    try:
        import asyncio
        from app.services.ai_service import ai_service

        lang_names = {
            'fra': 'Français', 'eng': 'English', 'spa': 'Español',
            'por': 'Português', 'ara': 'Arabe', 'deu': 'Deutsch',
            'ita': 'Italiano', 'zho': 'Chinois', 'jpn': 'Japonais', 'kor': 'Coréen'
        }
        lang_name = lang_names.get(language.split('+')[0], 'Français')

        prompt = f"""Tu es un expert en correction de texte OCR. Corrige les erreurs sans modifier le sens.

INSTRUCTIONS:
1. Corrige les erreurs OCR (0↔O, l↔1, rn↔m, etc.)
2. Restaure la ponctuation
3. Corrige l'orthographe contextuelle
4. Préserve la structure exacte
5. Le texte est en {lang_name}

TEXTE:
{text[:4000]}

TEXTE CORRIGÉ:"""

        # Exécuter la coroutine de manière synchrone
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        try:
            corrected = loop.run_until_complete(
                ai_service.generate_text(prompt=prompt, max_tokens=4500, temperature=0.1)
            )
        finally:
            loop.close()

        if corrected and len(corrected.strip()) > len(text) * 0.5:
            return corrected.strip()
        return text

    except Exception as e:
        logger.error(f"AI post-processing failed: {e}")
        return text


def _create_note_from_ocr(
    user_id: int,
    content: str,
    subject_id: Optional[int],
    title: Optional[str],
    confidence: float
) -> Optional[int]:
    """Créer une note depuis le résultat OCR"""
    try:
        import asyncio
        from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
        from sqlalchemy.orm import sessionmaker
        from app.models.note import Note
        from app.models.user import User
        from app.core.config import settings

        # Créer une session sync pour Celery
        from sqlalchemy import create_engine
        from sqlalchemy.orm import Session

        # Convertir l'URL async en sync
        sync_url = settings.DATABASE_URL.replace('postgresql+asyncpg', 'postgresql')
        engine = create_engine(sync_url)

        with Session(engine) as db:
            note = Note(
                user_id=user_id,
                subject_id=subject_id,
                title=title or "Note OCR",
                content=content,
                tags=f"ocr,confidence-{int(confidence)}"
            )
            db.add(note)

            # XP bonus
            user = db.query(User).filter(User.id == user_id).first()
            if user and user.gamification:
                user.gamification.total_xp += 15
            if user and user.stats:
                user.stats.total_notes_created += 1

            db.commit()
            db.refresh(note)
            return note.id

    except Exception as e:
        logger.error(f"Failed to create note: {e}")
        return None


# === Tâches Legacy (gardées pour compatibilité) ===

@celery_app.task(base=OCRTask, bind=True, name="app.tasks.ocr_tasks.extract_text_from_image")
def extract_text_from_image(
    self,
    image_path: str,
    language: str = "fra"
) -> Dict[str, Any]:
    """Legacy: Extrait le texte d'une image"""
    try:
        image = Image.open(image_path)
        processed = preprocess_image(image)
        text = pytesseract.image_to_string(processed, lang=get_tesseract_lang(language))
        return {
            "success": True,
            "text": text,
            "word_count": len(text.split()),
            "char_count": len(text),
            "language": language,
            "task_id": self.request.id
        }
    except Exception as e:
        return {"success": False, "error": str(e), "task_id": self.request.id}


@celery_app.task(base=OCRTask, bind=True, name="app.tasks.ocr_tasks.extract_text_from_pdf")
def extract_text_from_pdf(
    self,
    pdf_path: str,
    language: str = "fra",
    max_pages: int = 50
) -> Dict[str, Any]:
    """Legacy: Extrait le texte d'un PDF"""
    try:
        self.update_state(state="PROCESSING", meta={"status": "Converting PDF..."})
        images = convert_from_path(pdf_path, dpi=300)[:max_pages]

        all_text = []
        for i, image in enumerate(images):
            self.update_state(state="PROCESSING", meta={"status": f"Page {i+1}/{len(images)}"})
            processed = preprocess_image(image)
            text = pytesseract.image_to_string(processed, lang=get_tesseract_lang(language))
            all_text.append(f"--- Page {i+1} ---\n{text}\n")

        full_text = "\n".join(all_text)
        return {
            "success": True,
            "text": full_text,
            "total_pages": len(images),
            "word_count": len(full_text.split()),
            "task_id": self.request.id
        }
    except Exception as e:
        return {"success": False, "error": str(e), "task_id": self.request.id}


@celery_app.task(base=OCRTask, bind=True, name="app.tasks.ocr_tasks.process_document_with_ocr")
def process_document_with_ocr(
    self,
    file_path: str,
    file_type: str,
    language: str = "fra"
) -> Dict[str, Any]:
    """Legacy: Traite un document"""
    if file_type == "pdf":
        return extract_text_from_pdf(file_path, language)
    return extract_text_from_image(file_path, language)
