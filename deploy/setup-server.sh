#!/bin/bash
# ===========================================
# STUDERA.APP - Script de configuration serveur
# ===========================================
# Usage: ssh root@IP_SERVEUR 'bash -s' < setup-server.sh
# ===========================================

set -e

echo "🚀 Configuration du serveur Studera..."

# Mise à jour du système
echo "📦 Mise à jour du système..."
apt update && apt upgrade -y

# Installation des dépendances
echo "📦 Installation des dépendances..."
apt install -y \
    apt-transport-https \
    ca-certificates \
    curl \
    gnupg \
    lsb-release \
    git \
    ufw \
    fail2ban

# Installation de Docker
echo "🐳 Installation de Docker..."
if ! command -v docker &> /dev/null; then
    curl -fsSL https://download.docker.com/linux/ubuntu/gpg | gpg --dearmor -o /usr/share/keyrings/docker-archive-keyring.gpg
    echo "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/docker-archive-keyring.gpg] https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable" | tee /etc/apt/sources.list.d/docker.list > /dev/null
    apt update
    apt install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin
    systemctl enable docker
    systemctl start docker
fi

# Configuration du firewall
echo "🔒 Configuration du firewall..."
ufw default deny incoming
ufw default allow outgoing
ufw allow ssh
ufw allow http
ufw allow https
ufw --force enable

# Configuration de fail2ban
echo "🔒 Configuration de fail2ban..."
systemctl enable fail2ban
systemctl start fail2ban

# Créer l'utilisateur deploy
echo "👤 Création de l'utilisateur deploy..."
if ! id "deploy" &>/dev/null; then
    useradd -m -s /bin/bash -G docker deploy
    mkdir -p /home/deploy/.ssh
    cp /root/.ssh/authorized_keys /home/deploy/.ssh/ 2>/dev/null || true
    chown -R deploy:deploy /home/deploy/.ssh
    chmod 700 /home/deploy/.ssh
    chmod 600 /home/deploy/.ssh/authorized_keys 2>/dev/null || true
fi

# Créer le répertoire de l'application
echo "📁 Création du répertoire de l'application..."
mkdir -p /opt/studera
chown deploy:deploy /opt/studera

# Configurer les limites système pour Docker
echo "⚙️ Configuration des limites système..."
cat >> /etc/sysctl.conf << 'EOF'
# Docker optimizations
vm.max_map_count=262144
net.core.somaxconn=65535
EOF
sysctl -p

echo ""
echo "✅ Serveur configuré avec succès!"
echo ""
echo "📋 Prochaines étapes:"
echo "   1. Transférer le code: rsync -avz --exclude 'node_modules' --exclude '.git' ./ deploy@IP:/opt/studera/"
echo "   2. Se connecter: ssh deploy@IP"
echo "   3. Déployer: cd /opt/studera && docker compose -f docker-compose.prod.yml up -d --build"
echo ""
