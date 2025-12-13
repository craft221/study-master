"""
Tests pour le service OCR
"""
import pytest
import io
from unittest.mock import patch, MagicMock, AsyncMock
from PIL import Image

from app.services.ocr_service import OCRService, ocr_service


class TestOCRServiceInit:
    """Tests pour l'initialisation du service OCR"""

    def test_ocr_service_initialization(self):
        """Le service OCR s'initialise correctement"""
        service = OCRService()

        assert service.supported_languages == ['fra', 'eng']

    def test_get_supported_languages(self):
        """Retourne les langues supportées"""
        service = OCRService()

        languages = service.get_supported_languages()

        assert 'fra' in languages
        assert 'eng' in languages

    def test_global_ocr_service_exists(self):
        """Le service global existe"""
        assert ocr_service is not None
        assert isinstance(ocr_service, OCRService)


class TestExtractTextFromImage:
    """Tests pour l'extraction de texte depuis une image"""

    @pytest.mark.asyncio
    async def test_extract_text_from_image_success(self):
        """Extraction réussie depuis une image"""
        service = OCRService()

        # Créer une fausse image
        img = Image.new('RGB', (100, 100), color='white')
        img_bytes = io.BytesIO()
        img.save(img_bytes, format='PNG')
        img_bytes.seek(0)

        with patch('app.services.ocr_service.pytesseract') as mock_tesseract:
            mock_tesseract.image_to_string.return_value = "Texte extrait de l'image"
            mock_tesseract.image_to_data.return_value = {
                'conf': ['95.5', '90.2', '88.0', '-1']
            }
            mock_tesseract.Output = MagicMock()
            mock_tesseract.Output.DICT = 'dict'

            result = await service.extract_text_from_image(img_bytes.read())

            assert result['success'] == True
            assert result['text'] == "Texte extrait de l'image"
            assert result['confidence'] > 0

    @pytest.mark.asyncio
    async def test_extract_text_from_image_with_language(self):
        """Extraction avec langue spécifique"""
        service = OCRService()

        img = Image.new('RGB', (100, 100), color='white')
        img_bytes = io.BytesIO()
        img.save(img_bytes, format='PNG')
        img_bytes.seek(0)

        with patch('app.services.ocr_service.pytesseract') as mock_tesseract:
            mock_tesseract.image_to_string.return_value = "French text"
            mock_tesseract.image_to_data.return_value = {'conf': ['90']}
            mock_tesseract.Output = MagicMock()

            result = await service.extract_text_from_image(
                img_bytes.read(),
                language='fra'
            )

            assert result['language'] == 'fra'

    @pytest.mark.asyncio
    async def test_extract_text_from_image_error(self):
        """Gestion des erreurs d'extraction"""
        service = OCRService()

        # Données invalides (pas une image)
        invalid_data = b"not an image"

        result = await service.extract_text_from_image(invalid_data)

        assert result['success'] == False
        assert 'error' in result
        assert result['text'] == ''

    @pytest.mark.asyncio
    async def test_extract_text_from_image_empty_confidence(self):
        """Gestion des confidences vides"""
        service = OCRService()

        img = Image.new('RGB', (100, 100), color='white')
        img_bytes = io.BytesIO()
        img.save(img_bytes, format='PNG')
        img_bytes.seek(0)

        with patch('app.services.ocr_service.pytesseract') as mock_tesseract:
            mock_tesseract.image_to_string.return_value = ""
            mock_tesseract.image_to_data.return_value = {'conf': ['-1', '-1']}
            mock_tesseract.Output = MagicMock()

            result = await service.extract_text_from_image(img_bytes.read())

            assert result['success'] == True
            assert result['confidence'] == 0.0


class TestExtractTextFromPDF:
    """Tests pour l'extraction de texte depuis un PDF"""

    @pytest.mark.asyncio
    async def test_extract_text_from_pdf_success(self):
        """Extraction réussie depuis un PDF"""
        service = OCRService()

        # Mock du contenu PDF
        fake_pdf = b"%PDF-1.4 fake pdf content"

        with patch('app.services.ocr_service.convert_from_path') as mock_convert:
            # Créer une fausse image pour chaque page
            fake_image = Image.new('RGB', (100, 100), color='white')
            mock_convert.return_value = [fake_image, fake_image]  # 2 pages

            with patch('app.services.ocr_service.pytesseract') as mock_tesseract:
                mock_tesseract.image_to_string.return_value = "Page text"
                mock_tesseract.image_to_data.return_value = {'conf': ['85.0', '90.0']}
                mock_tesseract.Output = MagicMock()

                with patch('tempfile.NamedTemporaryFile'):
                    with patch('os.path.exists', return_value=True):
                        with patch('os.unlink'):
                            result = await service.extract_text_from_pdf(fake_pdf)

                            assert result['success'] == True
                            assert result['page_count'] == 2
                            assert len(result['pages']) == 2
                            assert result['average_confidence'] > 0

    @pytest.mark.asyncio
    async def test_extract_text_from_pdf_with_language(self):
        """Extraction PDF avec langue spécifique"""
        service = OCRService()

        fake_pdf = b"%PDF-1.4"

        with patch('app.services.ocr_service.convert_from_path') as mock_convert:
            fake_image = Image.new('RGB', (100, 100))
            mock_convert.return_value = [fake_image]

            with patch('app.services.ocr_service.pytesseract') as mock_tesseract:
                mock_tesseract.image_to_string.return_value = "Text"
                mock_tesseract.image_to_data.return_value = {'conf': ['80']}
                mock_tesseract.Output = MagicMock()

                with patch('tempfile.NamedTemporaryFile'):
                    with patch('os.path.exists', return_value=True):
                        with patch('os.unlink'):
                            result = await service.extract_text_from_pdf(
                                fake_pdf,
                                language='eng'
                            )

                            assert result['language'] == 'eng'

    @pytest.mark.asyncio
    async def test_extract_text_from_pdf_error(self):
        """Gestion des erreurs PDF"""
        service = OCRService()

        # Simuler une erreur
        with patch('tempfile.NamedTemporaryFile') as mock_temp:
            mock_temp.side_effect = Exception("Erreur de traitement")

            result = await service.extract_text_from_pdf(b"fake pdf")

            assert result['success'] == False
            assert 'error' in result
            assert result['page_count'] == 0

    @pytest.mark.asyncio
    async def test_extract_text_from_pdf_empty(self):
        """PDF vide ou sans texte"""
        service = OCRService()

        fake_pdf = b"%PDF-1.4"

        with patch('app.services.ocr_service.convert_from_path') as mock_convert:
            mock_convert.return_value = []  # Aucune page

            with patch('tempfile.NamedTemporaryFile'):
                with patch('os.path.exists', return_value=True):
                    with patch('os.unlink'):
                        result = await service.extract_text_from_pdf(fake_pdf)

                        assert result['success'] == True
                        assert result['page_count'] == 0
                        assert result['average_confidence'] == 0.0


class TestPreprocessImage:
    """Tests pour le prétraitement d'images"""

    @pytest.mark.asyncio
    async def test_preprocess_image(self):
        """Prétraitement d'une image"""
        service = OCRService()

        # Créer une image couleur
        img = Image.new('RGB', (100, 100), color='red')

        result = await service.preprocess_image_for_ocr(img)

        # L'image doit être en niveaux de gris
        assert result.mode == 'L'

    @pytest.mark.asyncio
    async def test_preprocess_image_grayscale_input(self):
        """Prétraitement d'une image déjà en niveaux de gris"""
        service = OCRService()

        # Image déjà en niveaux de gris
        img = Image.new('L', (100, 100), color=128)

        result = await service.preprocess_image_for_ocr(img)

        assert result.mode == 'L'

    @pytest.mark.asyncio
    async def test_preprocess_enhances_contrast(self):
        """Le prétraitement augmente le contraste"""
        service = OCRService()

        img = Image.new('RGB', (100, 100), color='gray')

        with patch('PIL.ImageEnhance.Contrast') as mock_enhancer:
            mock_instance = MagicMock()
            mock_instance.enhance.return_value = img.convert('L')
            mock_enhancer.return_value = mock_instance

            await service.preprocess_image_for_ocr(img)

            mock_instance.enhance.assert_called_once_with(2.0)


class TestOCRConfidenceCalculation:
    """Tests pour le calcul de confiance OCR"""

    @pytest.mark.asyncio
    async def test_confidence_calculation_mixed_values(self):
        """Calcul de confiance avec valeurs mixtes"""
        service = OCRService()

        img = Image.new('RGB', (100, 100))
        img_bytes = io.BytesIO()
        img.save(img_bytes, format='PNG')
        img_bytes.seek(0)

        with patch('app.services.ocr_service.pytesseract') as mock_tesseract:
            mock_tesseract.image_to_string.return_value = "Text"
            # Mélange de bonnes valeurs et de -1 (invalides)
            mock_tesseract.image_to_data.return_value = {
                'conf': ['95', '80', '-1', '70', '-1', '85']
            }
            mock_tesseract.Output = MagicMock()

            result = await service.extract_text_from_image(img_bytes.read())

            # La moyenne devrait être calculée sur 95, 80, 70, 85 = 82.5
            assert result['confidence'] == 82.5

    @pytest.mark.asyncio
    async def test_confidence_all_invalid(self):
        """Confiance quand toutes les valeurs sont invalides"""
        service = OCRService()

        img = Image.new('RGB', (100, 100))
        img_bytes = io.BytesIO()
        img.save(img_bytes, format='PNG')
        img_bytes.seek(0)

        with patch('app.services.ocr_service.pytesseract') as mock_tesseract:
            mock_tesseract.image_to_string.return_value = ""
            mock_tesseract.image_to_data.return_value = {
                'conf': ['-1', '-1', '-1']
            }
            mock_tesseract.Output = MagicMock()

            result = await service.extract_text_from_image(img_bytes.read())

            assert result['confidence'] == 0.0


class TestOCRServiceIntegration:
    """Tests d'intégration pour le service OCR"""

    @pytest.mark.asyncio
    async def test_full_workflow_image(self):
        """Workflow complet pour une image"""
        service = OCRService()

        # Créer une image de test
        img = Image.new('RGB', (200, 100), color='white')
        img_bytes = io.BytesIO()
        img.save(img_bytes, format='PNG')
        img_bytes.seek(0)

        with patch('app.services.ocr_service.pytesseract') as mock_tesseract:
            mock_tesseract.image_to_string.return_value = "Hello World"
            mock_tesseract.image_to_data.return_value = {'conf': ['95', '92']}
            mock_tesseract.Output = MagicMock()

            # Extraire le texte
            result = await service.extract_text_from_image(img_bytes.read())

            # Vérifications
            assert result['success'] == True
            assert 'Hello World' in result['text']
            assert result['confidence'] > 90

    @pytest.mark.asyncio
    async def test_different_image_formats(self):
        """Test avec différents formats d'image"""
        service = OCRService()

        formats = ['PNG', 'JPEG', 'BMP']

        for fmt in formats:
            img = Image.new('RGB', (100, 100), color='white')
            img_bytes = io.BytesIO()

            # JPEG ne supporte pas le mode RGBA
            if fmt == 'JPEG':
                img = img.convert('RGB')

            img.save(img_bytes, format=fmt)
            img_bytes.seek(0)

            with patch('app.services.ocr_service.pytesseract') as mock_tesseract:
                mock_tesseract.image_to_string.return_value = f"Text from {fmt}"
                mock_tesseract.image_to_data.return_value = {'conf': ['90']}
                mock_tesseract.Output = MagicMock()

                result = await service.extract_text_from_image(img_bytes.read())

                assert result['success'] == True, f"Failed for format {fmt}"
