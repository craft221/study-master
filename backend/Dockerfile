# backend/Dockerfile
FROM python:3.11-slim

# Installer les dépendances système pour psycopg2, NumPy et compilation C++
RUN apt-get update && \
    apt-get install -y gcc g++ libpq-dev libffi-dev build-essential && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copier requirements et installer les packages Python
COPY requirements.txt .
RUN pip install --upgrade pip
RUN pip install --no-cache-dir -r requirements.txt

# Copier tout le code backend
COPY . .

# Exposer le port
EXPOSE 8000

# Commande pour lancer FastAPI
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
