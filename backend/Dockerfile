# backend/Dockerfile
FROM python:3.11-slim

# Installer les dépendances système pour psycopg2, NumPy, compilation C++, OCR et PDF
RUN apt-get update && \
    apt-get install -y \
        gcc g++ libpq-dev libffi-dev build-essential \
        tesseract-ocr tesseract-ocr-fra tesseract-ocr-eng \
        poppler-utils \
        libglib2.0-0 \
        curl && \
    rm -rf /var/lib/apt/lists/*

# Créer un utilisateur non-root pour la sécurité
RUN groupadd -r appgroup && useradd -r -g appgroup appuser

WORKDIR /app

# Copier requirements et installer les packages Python
COPY requirements.txt .
RUN pip install --upgrade pip
RUN pip install --no-cache-dir -r requirements.txt

# Copier tout le code backend
COPY . .

# Créer les répertoires d'upload
RUN mkdir -p /app/uploads/documents /app/uploads/note-images

# Changer le propriétaire des fichiers vers l'utilisateur non-root
RUN chown -R appuser:appgroup /app

# Passer à l'utilisateur non-root
USER appuser

# Exposer le port
EXPOSE 8000

# Commande pour lancer FastAPI
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
