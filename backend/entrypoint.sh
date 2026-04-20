#!/bin/bash
set -e

echo "🚀 Starting backend initialization..."

# Attendre que la base de données soit prête
echo "⏳ Waiting for database..."
sleep 5

# Exécuter les migrations Alembic
echo "📦 Running database migrations..."
alembic upgrade head || echo "⚠️ Migrations may have already been applied"

# Seeder les achievements si la table est vide
echo "🏆 Seeding achievements..."
python seed_achievements.py --no-prompt || echo "⚠️ Achievement seeding skipped or failed"

# Démarrer l'application
echo "✅ Starting FastAPI application..."
if [ $# -eq 0 ]; then
    echo "✅ Starting FastAPI application (default)..."
    exec uvicorn app.main:app --host 0.0.0.0 --port 8000
  else
    echo "✅ Starting custom command: $@"
    exec "$@"
  fi
