#!/bin/bash
# ===========================================
# STUDERA.APP - Script de déploiement
# ===========================================
# Usage: ./deploy/deploy.sh IP_SERVEUR
# ===========================================

set -e

if [ -z "$1" ]; then
    echo "❌ Usage: ./deploy.sh IP_SERVEUR"
    echo "   Exemple: ./deploy.sh 164.92.xxx.xxx"
    exit 1
fi

SERVER_IP=$1
SERVER_USER="deploy"
APP_PATH="/opt/studera"

echo "🚀 Déploiement de Studera vers $SERVER_IP..."

# Synchroniser les fichiers
echo "📦 Synchronisation des fichiers..."
rsync -avz --progress \
    --exclude 'node_modules' \
    --exclude '.git' \
    --exclude '__pycache__' \
    --exclude '*.pyc' \
    --exclude '.env.local' \
    --exclude '.next' \
    --exclude 'venv' \
    --exclude '*.log' \
    ./ ${SERVER_USER}@${SERVER_IP}:${APP_PATH}/

# Déployer sur le serveur
echo "🐳 Déploiement Docker..."
ssh ${SERVER_USER}@${SERVER_IP} << 'ENDSSH'
cd /opt/studera

# Arrêter les conteneurs existants
echo "⏹️ Arrêt des conteneurs..."
docker compose -f docker-compose.prod.yml down || true

# Reconstruire et démarrer
echo "🔨 Build et démarrage..."
docker compose -f docker-compose.prod.yml up -d --build

# Attendre que les services soient prêts
echo "⏳ Attente des services..."
sleep 30

# Vérifier les services
echo "✅ Vérification des services..."
docker compose -f docker-compose.prod.yml ps

# Afficher les logs récents
echo "📋 Logs récents..."
docker compose -f docker-compose.prod.yml logs --tail=20
ENDSSH

echo ""
echo "✅ Déploiement terminé!"
echo ""
echo "🌐 URLs:"
echo "   Frontend: https://studera.app"
echo "   API: https://api.studera.app"
echo ""
