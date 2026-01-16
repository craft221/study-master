# backend/Dockerfile
FROM python:3.11-slim

# Cache buster - change to force rebuild: v2-20260115
ARG CACHEBUST=1

# Installer les dépendances système pour psycopg2, NumPy, compilation C++, OCR, PDF et Office
RUN echo "Cache bust: $CACHEBUST" && apt-get update && \
    apt-get install -y --no-install-recommends \
        gcc g++ libpq-dev libffi-dev build-essential \
        tesseract-ocr tesseract-ocr-fra tesseract-ocr-eng \
        poppler-utils \
        libglib2.0-0 \
        curl \
        # LibreOffice pour conversion Word/Excel/PPT → PDF
        libreoffice-writer libreoffice-calc libreoffice-impress \
        libreoffice-common \
        # Fonts pour un bon rendu des documents
        fonts-liberation fonts-dejavu-core && \
    # Nettoyer le cache apt pour réduire la taille de l'image
    apt-get clean && \
    rm -rf /var/lib/apt/lists/* /tmp/* /var/tmp/*

# Créer un utilisateur non-root pour la sécurité avec un home directory pour LibreOffice
RUN groupadd -r appgroup && useradd -r -g appgroup -m -d /home/appuser appuser

WORKDIR /app

# Copier requirements et installer les packages Python
COPY requirements.txt .
RUN pip install --upgrade pip
RUN pip install --no-cache-dir -r requirements.txt

# Copier tout le code backend
COPY . .

# Créer les répertoires d'upload
RUN mkdir -p /app/uploads/documents /app/uploads/note-images

# Créer les répertoires de cache pour LibreOffice
RUN mkdir -p /home/appuser/.cache/dconf /home/appuser/.config/libreoffice

# Rendre le script entrypoint exécutable
RUN chmod +x /app/entrypoint.sh

# Changer le propriétaire des fichiers vers l'utilisateur non-root
RUN chown -R appuser:appgroup /app /home/appuser

# Passer à l'utilisateur non-root
USER appuser

# Exposer le port
EXPOSE 8000

# Utiliser entrypoint pour les migrations et seeding au démarrage
ENTRYPOINT ["/app/entrypoint.sh"]
