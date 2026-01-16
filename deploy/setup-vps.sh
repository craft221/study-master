#!/bin/bash
# Script d'installation pour VPS OVH - Studera
# Exécuter avec: bash setup-vps.sh

set -e

echo "=========================================="
echo "  Installation Studera - VPS OVH"
echo "=========================================="

# Mise à jour du système
echo "[1/6] Mise à jour du système..."
sudo apt update -y && sudo apt upgrade -y

# Installation des dépendances
echo "[2/6] Installation des dépendances..."
sudo apt install -y \
    apt-transport-https \
    ca-certificates \
    curl \
    gnupg \
    lsb-release \
    git \
    ufw

# Installation de Docker
echo "[3/6] Installation de Docker..."
if ! command -v docker &> /dev/null; then
    curl -fsSL https://get.docker.com -o get-docker.sh
    sudo sh get-docker.sh
    sudo usermod -aG docker $USER
    rm get-docker.sh
else
    echo "Docker déjà installé"
fi

# Installation de Docker Compose
echo "[4/6] Installation de Docker Compose..."
if ! command -v docker-compose &> /dev/null; then
    sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
    sudo chmod +x /usr/local/bin/docker-compose
else
    echo "Docker Compose déjà installé"
fi

# Configuration du firewall
echo "[5/6] Configuration du firewall..."
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow ssh
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw --force enable

# Vérification
echo "[6/6] Vérification de l'installation..."
echo ""
echo "Docker version:"
docker --version
echo ""
echo "Docker Compose version:"
docker-compose --version
echo ""
echo "Firewall status:"
sudo ufw status
echo ""

echo "=========================================="
echo "  Installation terminée avec succès!"
echo "=========================================="
echo ""
echo "IMPORTANT: Déconnectez-vous et reconnectez-vous"
echo "pour que les permissions Docker s'appliquent:"
echo "  exit"
echo "  ssh ubuntu@51.210.244.130"
echo ""
