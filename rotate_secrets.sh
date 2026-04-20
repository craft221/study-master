#!/bin/bash
# ============================================================
# STUDERA - Script de rotation des mots de passe de production
# ============================================================
# A executer UNIQUEMENT sur la VPS (pas en local).
# Usage: bash rotate_secrets.sh
# ============================================================

set -e  # stop au premier echec

cd ~/study-master

echo "=========================================="
echo "  ROTATION DES SECRETS - STUDERA PROD"
echo "=========================================="
echo ""

# --- Verifications pre-flight ---
if [ ! -f "backend/.env" ]; then
    echo "ERREUR: backend/.env introuvable. Es-tu dans ~/study-master ?"
    exit 1
fi

if [ ! -f "docker-compose.prod.yml" ]; then
    echo "ERREUR: docker-compose.prod.yml introuvable."
    exit 1
fi

# --- Etape 0 : Backup Postgres ---
echo "[0/7] Backup Postgres en cours..."
BACKUP_FILE=~/backup_avant_rotation_$(date +%Y%m%d_%H%M%S).sql.gz
docker compose -f docker-compose.prod.yml exec -T postgres pg_dump -U studymaster studymaster_db | gzip > "$BACKUP_FILE"
BACKUP_SIZE=$(ls -lh "$BACKUP_FILE" | awk '{print $5}')
echo "    Backup cree: $BACKUP_FILE ($BACKUP_SIZE)"
echo ""

# --- Etape 1 : Generer les 3 passwords ---
echo "[1/7] Generation des nouveaux passwords..."
POSTGRES_NEW=$(openssl rand -base64 32 | tr -d '/+=' | cut -c1-32)
REDIS_NEW=$(openssl rand -base64 32 | tr -d '/+=' | cut -c1-32)
FLOWER_NEW=$(openssl rand -base64 24 | tr -d '/+=' | cut -c1-24)
echo "    Passwords generes (voir fichier ~/nouveaux_passwords.txt)"
echo ""

# --- Sauvegarde des passwords dans un fichier local (lisible par root uniquement) ---
cat > ~/nouveaux_passwords.txt <<EOF
==============================================
NOUVEAUX PASSWORDS - A STOCKER DANS TON PASSWORD MANAGER
Puis SUPPRIMER ce fichier: rm ~/nouveaux_passwords.txt
Genere le: $(date)
==============================================

POSTGRES: $POSTGRES_NEW
REDIS:    $REDIS_NEW
FLOWER:   $FLOWER_NEW

==============================================
EOF
chmod 600 ~/nouveaux_passwords.txt

# --- Etape 2 : ALTER USER Postgres ---
echo "[2/7] Mise a jour du password Postgres dans la DB..."
docker compose -f docker-compose.prod.yml exec -T postgres psql -U studymaster -d studymaster_db <<SQL
ALTER USER studymaster WITH PASSWORD '$POSTGRES_NEW';
SQL
echo "    Password Postgres change dans la DB."
echo ""

# --- Etape 3 : Backup puis mise a jour du .env ---
echo "[3/7] Mise a jour de backend/.env..."
cp backend/.env backend/.env.backup_$(date +%Y%m%d_%H%M%S)

# Remplacer dans DATABASE_URL
sed -i "s|postgresql+asyncpg://studymaster:studymaster123@|postgresql+asyncpg://studymaster:$POSTGRES_NEW@|g" backend/.env

# Remplacer REDIS_PASSWORD
sed -i "s|^REDIS_PASSWORD=.*|REDIS_PASSWORD=$REDIS_NEW|g" backend/.env

# Remplacer dans REDIS_URL / CELERY_BROKER_URL / CELERY_RESULT_BACKEND si presents
sed -i "s|redispassword123|$REDIS_NEW|g" backend/.env

# Ajouter les variables manquantes a la fin (si pas deja presentes)
grep -q "^POSTGRES_USER=" backend/.env || echo "POSTGRES_USER=studymaster" >> backend/.env
grep -q "^POSTGRES_PASSWORD=" backend/.env || echo "POSTGRES_PASSWORD=$POSTGRES_NEW" >> backend/.env
grep -q "^POSTGRES_DB=" backend/.env || echo "POSTGRES_DB=studymaster_db" >> backend/.env
grep -q "^FLOWER_PASSWORD=" backend/.env || echo "FLOWER_PASSWORD=$FLOWER_NEW" >> backend/.env

# Mise a jour si elles existaient deja
sed -i "s|^POSTGRES_PASSWORD=.*|POSTGRES_PASSWORD=$POSTGRES_NEW|g" backend/.env
sed -i "s|^FLOWER_PASSWORD=.*|FLOWER_PASSWORD=$FLOWER_NEW|g" backend/.env

echo "    backend/.env mis a jour."
echo ""

# --- Etape 4 : Generer le hash bcrypt Flower ---
echo "[4/7] Generation du hash bcrypt pour Flower..."
FLOWER_HASH=$(docker run --rm caddy:2-alpine caddy hash-password --plaintext "$FLOWER_NEW" 2>/dev/null)
echo "    Hash genere: $FLOWER_HASH"
echo ""

# --- Etape 5 : Mise a jour du Caddyfile ---
echo "[5/7] Mise a jour du Caddyfile..."
cp Caddyfile Caddyfile.backup_$(date +%Y%m%d_%H%M%S)

# Supprimer la ligne du plaintext password
sed -i '/# Login: admin \/ Password: StuderaFlower2024!/d' Caddyfile

# Remplacer l'ancien hash par le nouveau
OLD_HASH='$2a$14$rMCwpPGJxGv9O7rjCNxnYOVPHIFBi.Rk8RWiVvPNQsJxNmhQXKV5S'
# Echapper les caracteres speciaux pour sed
OLD_HASH_ESCAPED=$(printf '%s\n' "$OLD_HASH" | sed 's/[[\.*^$/]/\\&/g')
NEW_HASH_ESCAPED=$(printf '%s\n' "$FLOWER_HASH" | sed 's/[[\.*^$/]/\\&/g')
sed -i "s|$OLD_HASH_ESCAPED|$NEW_HASH_ESCAPED|g" Caddyfile

echo "    Caddyfile mis a jour."
echo ""

# --- Etape 6 : Mise a jour du docker-compose.prod.yml ---
echo "[6/7] Mise a jour du docker-compose.prod.yml..."
cp docker-compose.prod.yml docker-compose.prod.yml.backup_$(date +%Y%m%d_%H%M%S)

# Remplacer les defaults par des variables obligatoires
sed -i 's|\${POSTGRES_PASSWORD:-studymaster123}|\${POSTGRES_PASSWORD:?POSTGRES_PASSWORD required in .env}|g' docker-compose.prod.yml
sed -i 's|\${REDIS_PASSWORD:-redispassword123}|\${REDIS_PASSWORD:?REDIS_PASSWORD required in .env}|g' docker-compose.prod.yml

echo "    docker-compose.prod.yml mis a jour."
echo ""

# --- Etape 7 : Redemarrage ---
echo "[7/7] Redemarrage des services..."
docker compose -f docker-compose.prod.yml down
docker compose -f docker-compose.prod.yml up -d
echo "    Attente 30s pour healthchecks..."
sleep 30

echo ""
echo "=========================================="
echo "  ETAT DES SERVICES"
echo "=========================================="
docker compose -f docker-compose.prod.yml ps

echo ""
echo "=========================================="
echo "  TESTS"
echo "=========================================="

# Test Postgres
echo -n "Test Postgres: "
if docker compose -f docker-compose.prod.yml exec -T postgres psql -U studymaster -d studymaster_db -c 'SELECT 1' > /dev/null 2>&1; then
    echo "OK"
else
    echo "ECHEC - verifie les logs"
fi

# Test Redis
echo -n "Test Redis: "
if docker compose -f docker-compose.prod.yml exec -T redis redis-cli -a "$REDIS_NEW" ping 2>/dev/null | grep -q PONG; then
    echo "OK"
else
    echo "ECHEC - verifie les logs"
fi

# Test Backend
echo -n "Test Backend health: "
if curl -sf http://localhost:8000/api/v1/health > /dev/null; then
    echo "OK"
else
    echo "ECHEC - verifie les logs"
fi

echo ""
echo "=========================================="
echo "  ROTATION TERMINEE"
echo "=========================================="
echo ""
echo "PROCHAINES ETAPES MANUELLES :"
echo ""
echo "1. NOTE TES PASSWORDS dans un gestionnaire (Bitwarden/1Password/KeePass):"
echo "   cat ~/nouveaux_passwords.txt"
echo ""
echo "2. PUIS SUPPRIME le fichier:"
echo "   rm ~/nouveaux_passwords.txt"
echo ""
echo "3. TESTE Flower dans un navigateur:"
echo "   https://flower.studera.app"
echo "   - admin / ancien password -> doit echouer"
echo "   - admin / nouveau password -> doit marcher"
echo ""
echo "4. TESTE ton app: https://studera.app (login, navigation)"
echo ""
echo "5. SUR TA MACHINE LOCALE (Windows), commit les fichiers modifies:"
echo "   Les modifs Caddyfile + docker-compose.prod.yml doivent etre appliquees localement aussi."
echo "   Le script n'a touche qu'a la VPS."
echo ""
echo "BACKUPS CREES (garde-les qq jours puis supprime):"
ls -lh ~/backup_avant_rotation_*.sql.gz 2>/dev/null
ls -lh backend/.env.backup_* Caddyfile.backup_* docker-compose.prod.yml.backup_* 2>/dev/null
echo ""
