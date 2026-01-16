# Studera.app - Guide Rapide DigitalOcean

## Etape 1: Services Externes (15 min)

### 1.1 Anthropic Claude (IA)
1. [console.anthropic.com](https://console.anthropic.com) → Creer compte
2. **Ajouter carte bancaire** (obligatoire)
3. Settings → **Spend Limits** → Mettre $50/mois max
4. API Keys → Create Key → Copier `sk-ant-xxx...`

### 1.2 Resend (Emails)
1. [resend.com](https://resend.com) → Creer compte gratuit
2. Domains → Add Domain → `studera.app`
3. **Ajouter dans Namecheap** les DNS fournis:
   - SPF (TXT)
   - DKIM (TXT)
4. API Keys → Create → Copier `re_xxx...`

### 1.3 VAPID (Push Notifications)
```bash
npx web-push generate-vapid-keys
# Copier Public Key et Private Key
```

---

## Etape 2: DigitalOcean (10 min)

### 2.1 Creer Droplet
1. [cloud.digitalocean.com](https://cloud.digitalocean.com)
2. Create → Droplets
3. **Region**: Frankfurt
4. **Image**: Ubuntu 24.04
5. **Size**: $24/mo (4GB / 2 CPU)
6. **SSH Key**: Ajouter votre cle SSH
7. Create → **Copier l'IP**

### 2.2 DNS Namecheap
Namecheap → studera.app → Advanced DNS:

| Type | Host | Value |
|------|------|-------|
| A | @ | [IP_DROPLET] |
| A | www | [IP_DROPLET] |
| A | api | [IP_DROPLET] |

---

## Etape 3: Deploiement (20 min)

### 3.1 Connexion SSH
```bash
ssh root@[IP_DROPLET]
```

### 3.2 Installation
```bash
# Cloner le projet
git clone https://github.com/VOTRE_REPO/studera.git /opt/studera
cd /opt/studera

# Rendre executable
chmod +x deploy.sh

# Setup serveur (Docker, firewall, etc.)
./deploy.sh setup
```

### 3.3 Configuration
```bash
# Copier template
cp backend/.env.production backend/.env

# Editer
nano backend/.env
```

**Remplir ces valeurs:**
```env
SECRET_KEY=           # openssl rand -hex 32
POSTGRES_PASSWORD=    # openssl rand -base64 24
REDIS_PASSWORD=       # openssl rand -base64 24
ANTHROPIC_API_KEY=    # sk-ant-xxx de Anthropic
RESEND_API_KEY=       # re_xxx de Resend
VAPID_PUBLIC_KEY=     # De web-push generate
VAPID_PRIVATE_KEY=    # De web-push generate
```

**Mettre a jour DATABASE_URL avec le mot de passe:**
```env
DATABASE_URL=postgresql+asyncpg://studymaster:[POSTGRES_PASSWORD]@postgres:5432/studymaster_db
```

### 3.4 Lancement
```bash
./deploy.sh deploy
```

---

## Etape 4: Verification

- [ ] https://studera.app → Frontend
- [ ] https://api.studera.app/docs → API Docs
- [ ] https://api.studera.app/api/v1/health → `{"status": "ok"}`

---

## Commandes Utiles

```bash
./deploy.sh status   # Status des services
./deploy.sh logs     # Voir les logs
./deploy.sh backup   # Sauvegarder la BDD
./deploy.sh update   # Mettre a jour
```

---

## En cas de probleme

```bash
# Voir les logs
./deploy.sh logs backend

# Redemarrer
cd /opt/studera
docker compose -f docker-compose.prod.yml restart

# Rebuild complet
docker compose -f docker-compose.prod.yml down
docker compose -f docker-compose.prod.yml up -d --build
```

---

**Temps total estime: ~45 minutes**
