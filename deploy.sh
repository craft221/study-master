#!/bin/bash
# ============================================
# STUDERA.APP - Script de Deploiement
# ============================================
# Usage: ./deploy.sh [command]
# Commands: setup, deploy, update, logs, backup
# ============================================

set -e

# Couleurs pour output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Variables
APP_DIR="/opt/studera"
BACKUP_DIR="/opt/backups"

# Fonctions utilitaires
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# ==================== SETUP INITIAL ====================
setup() {
    log_info "Configuration initiale du serveur..."

    # Mise a jour systeme
    log_info "Mise a jour du systeme..."
    apt update && apt upgrade -y

    # Installer Docker
    if ! command -v docker &> /dev/null; then
        log_info "Installation de Docker..."
        curl -fsSL https://get.docker.com | sh
    else
        log_info "Docker deja installe"
    fi

    # Installer Docker Compose
    if ! command -v docker compose &> /dev/null; then
        log_info "Installation de Docker Compose..."
        apt install docker-compose-plugin -y
    else
        log_info "Docker Compose deja installe"
    fi

    # Creer dossiers
    log_info "Creation des dossiers..."
    mkdir -p $APP_DIR
    mkdir -p $BACKUP_DIR

    # Installer fail2ban pour securite
    log_info "Installation de fail2ban..."
    apt install fail2ban -y
    systemctl enable fail2ban
    systemctl start fail2ban

    # Configurer firewall
    log_info "Configuration du firewall..."
    apt install ufw -y
    ufw default deny incoming
    ufw default allow outgoing
    ufw allow ssh
    ufw allow 80/tcp
    ufw allow 443/tcp
    ufw --force enable

    log_success "Setup termine!"
    log_info "Prochaine etape: Copier le code dans $APP_DIR et lancer './deploy.sh deploy'"
}

# ==================== DEPLOIEMENT ====================
deploy() {
    log_info "Deploiement de Studera..."

    cd $APP_DIR

    # Verifier que .env existe
    if [ ! -f "backend/.env" ]; then
        log_error "backend/.env n'existe pas!"
        log_info "Copier .env.production vers backend/.env et remplir les valeurs"
        exit 1
    fi

    # Arreter les anciens containers
    log_info "Arret des anciens containers..."
    docker compose -f docker-compose.prod.yml down || true

    # Nettoyer les images non utilisees
    log_info "Nettoyage des images inutilisees..."
    docker system prune -f

    # Build et lancer
    log_info "Build et lancement des containers..."
    docker compose -f docker-compose.prod.yml up -d --build

    # Attendre que les services soient prets
    log_info "Attente du demarrage des services..."
    sleep 30

    # Verifier la sante des services
    log_info "Verification des services..."
    docker compose -f docker-compose.prod.yml ps

    # Executer les migrations
    log_info "Execution des migrations de base de donnees..."
    docker compose -f docker-compose.prod.yml exec -T backend alembic upgrade head

    log_success "Deploiement termine!"
    log_info "Studera est accessible sur https://studera.app"
}

# ==================== MISE A JOUR ====================
update() {
    log_info "Mise a jour de Studera..."

    cd $APP_DIR

    # Backup avant mise a jour
    backup

    # Pull les dernieres modifications (si Git)
    if [ -d ".git" ]; then
        log_info "Pull des dernieres modifications..."
        git pull origin main
    fi

    # Rebuild et relancer
    log_info "Rebuild des containers..."
    docker compose -f docker-compose.prod.yml up -d --build

    # Migrations
    log_info "Execution des migrations..."
    docker compose -f docker-compose.prod.yml exec -T backend alembic upgrade head

    log_success "Mise a jour terminee!"
}

# ==================== LOGS ====================
logs() {
    cd $APP_DIR
    SERVICE=${1:-""}

    if [ -z "$SERVICE" ]; then
        log_info "Logs de tous les services..."
        docker compose -f docker-compose.prod.yml logs -f --tail=100
    else
        log_info "Logs de $SERVICE..."
        docker compose -f docker-compose.prod.yml logs -f --tail=100 $SERVICE
    fi
}

# ==================== BACKUP ====================
backup() {
    log_info "Sauvegarde de la base de donnees..."

    TIMESTAMP=$(date +%Y%m%d_%H%M%S)
    BACKUP_FILE="$BACKUP_DIR/studera_db_$TIMESTAMP.sql"

    cd $APP_DIR

    # Backup PostgreSQL
    docker compose -f docker-compose.prod.yml exec -T postgres pg_dump -U studymaster studymaster_db > $BACKUP_FILE

    # Compresser
    gzip $BACKUP_FILE

    # Garder seulement les 7 derniers backups
    cd $BACKUP_DIR
    ls -t studera_db_*.sql.gz | tail -n +8 | xargs -r rm

    log_success "Backup cree: ${BACKUP_FILE}.gz"
}

# ==================== RESTORE ====================
restore() {
    BACKUP_FILE=$1

    if [ -z "$BACKUP_FILE" ]; then
        log_error "Usage: ./deploy.sh restore <backup_file.sql.gz>"
        log_info "Backups disponibles:"
        ls -la $BACKUP_DIR
        exit 1
    fi

    log_warning "Cette operation va REMPLACER toutes les donnees!"
    read -p "Continuer? (y/N) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi

    cd $APP_DIR

    # Decompresser si necessaire
    if [[ $BACKUP_FILE == *.gz ]]; then
        gunzip -k $BACKUP_FILE
        BACKUP_FILE="${BACKUP_FILE%.gz}"
    fi

    # Restore
    docker compose -f docker-compose.prod.yml exec -T postgres psql -U studymaster studymaster_db < $BACKUP_FILE

    log_success "Restore termine!"
}

# ==================== STATUS ====================
status() {
    cd $APP_DIR
    log_info "Status des services:"
    docker compose -f docker-compose.prod.yml ps
    echo ""
    log_info "Utilisation des ressources:"
    docker stats --no-stream
}

# ==================== SHELL ====================
shell() {
    SERVICE=${1:-"backend"}
    cd $APP_DIR
    log_info "Connexion au shell de $SERVICE..."
    docker compose -f docker-compose.prod.yml exec $SERVICE /bin/sh
}

# ==================== MAIN ====================
case "$1" in
    setup)
        setup
        ;;
    deploy)
        deploy
        ;;
    update)
        update
        ;;
    logs)
        logs $2
        ;;
    backup)
        backup
        ;;
    restore)
        restore $2
        ;;
    status)
        status
        ;;
    shell)
        shell $2
        ;;
    *)
        echo "Usage: ./deploy.sh {setup|deploy|update|logs|backup|restore|status|shell}"
        echo ""
        echo "Commands:"
        echo "  setup   - Configuration initiale du serveur (Docker, firewall, etc.)"
        echo "  deploy  - Premier deploiement complet"
        echo "  update  - Mise a jour (backup + rebuild)"
        echo "  logs    - Afficher les logs (optionnel: nom du service)"
        echo "  backup  - Sauvegarde de la base de donnees"
        echo "  restore - Restaurer un backup"
        echo "  status  - Voir le status des services"
        echo "  shell   - Ouvrir un shell dans un container"
        exit 1
        ;;
esac
