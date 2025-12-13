# Study Master - Enterprise Deployment Guide

## Table of Contents
1. [Prerequisites](#prerequisites)
2. [Architecture Overview](#architecture-overview)
3. [Deployment Options](#deployment-options)
4. [Quick Start (Docker Swarm)](#quick-start-docker-swarm)
5. [Kubernetes Deployment](#kubernetes-deployment)
6. [Cloud Provider Guides](#cloud-provider-guides)
7. [Security Configuration](#security-configuration)
8. [Monitoring & Alerting](#monitoring--alerting)
9. [Backup & Recovery](#backup--recovery)
10. [Scaling Guide](#scaling-guide)
11. [Troubleshooting](#troubleshooting)

---

## Prerequisites

### Required Tools
```bash
# Docker & Docker Compose
docker --version  # >= 24.0
docker compose version  # >= 2.20

# Kubernetes (if using K8s)
kubectl version  # >= 1.28
helm version    # >= 3.12

# Cloud CLIs (optional)
aws --version   # AWS
gcloud --version  # GCP
az --version    # Azure
```

### Hardware Requirements

| Component | Minimum | Recommended | Enterprise |
|-----------|---------|-------------|------------|
| CPU | 4 cores | 8 cores | 16+ cores |
| RAM | 8 GB | 16 GB | 32+ GB |
| Storage | 50 GB SSD | 200 GB SSD | 500+ GB NVMe |
| Bandwidth | 100 Mbps | 1 Gbps | 10 Gbps |

---

## Architecture Overview

```
                                    ┌─────────────────┐
                                    │   CloudFlare    │
                                    │   (CDN + WAF)   │
                                    └────────┬────────┘
                                             │
                                    ┌────────▼────────┐
                                    │  Load Balancer  │
                                    │  (Traefik/NGINX)│
                                    └────────┬────────┘
                         ┌───────────────────┼───────────────────┐
                         │                   │                   │
                ┌────────▼────────┐ ┌────────▼────────┐ ┌────────▼────────┐
                │    Frontend     │ │    Frontend     │ │    Frontend     │
                │    (Next.js)    │ │    (Next.js)    │ │    (Next.js)    │
                └────────┬────────┘ └────────┬────────┘ └────────┬────────┘
                         │                   │                   │
                         └───────────────────┼───────────────────┘
                                             │
                         ┌───────────────────┼───────────────────┐
                         │                   │                   │
                ┌────────▼────────┐ ┌────────▼────────┐ ┌────────▼────────┐
                │     Backend     │ │     Backend     │ │     Backend     │
                │    (FastAPI)    │ │    (FastAPI)    │ │    (FastAPI)    │
                └────────┬────────┘ └────────┬────────┘ └────────┬────────┘
                         │                   │                   │
              ┌──────────┴──────────┬────────┴───────┬──────────┴──────────┐
              │                     │                │                     │
     ┌────────▼────────┐   ┌────────▼────────┐   ┌───▼───┐   ┌────────────▼────────────┐
     │   PostgreSQL    │   │      Redis      │   │ Celery│   │   Object Storage (S3)   │
     │   (Primary +    │   │   (Cluster)     │   │Workers│   │                         │
     │    Replicas)    │   │                 │   │       │   │                         │
     └─────────────────┘   └─────────────────┘   └───────┘   └─────────────────────────┘
```

---

## Deployment Options

### Option 1: Docker Swarm (Recommended for small-medium scale)
- Simpler to set up
- Built-in orchestration
- Good for 1-10 servers

### Option 2: Kubernetes (Recommended for enterprise)
- Industry standard
- Advanced scaling
- Multi-cloud support

### Option 3: Managed Services
- AWS ECS/EKS
- Google Cloud Run/GKE
- Azure Container Apps/AKS

---

## Quick Start (Docker Swarm)

### 1. Initialize Swarm
```bash
# On the manager node
docker swarm init --advertise-addr <MANAGER_IP>

# On worker nodes (use the token from init output)
docker swarm join --token <TOKEN> <MANAGER_IP>:2377
```

### 2. Create Secrets
```bash
# Generate secrets
echo "$(openssl rand -hex 32)" | docker secret create secret_key -
echo "postgresql+asyncpg://user:pass@postgres:5432/studymaster" | docker secret create database_url -
echo "sk-your-openai-key" | docker secret create openai_api_key -
```

### 3. Configure Environment
```bash
cd infrastructure/docker
cp production.env.example .env

# Edit .env with your values
nano .env
```

### 4. Deploy Stack
```bash
docker stack deploy -c docker-compose.prod.yml studymaster
```

### 5. Verify Deployment
```bash
docker stack services studymaster
docker service logs studymaster_backend
```

---

## Kubernetes Deployment

### 1. Create Cluster

#### AWS EKS
```bash
eksctl create cluster \
  --name study-master \
  --region us-east-1 \
  --nodegroup-name workers \
  --node-type t3.large \
  --nodes 3 \
  --nodes-min 2 \
  --nodes-max 10
```

#### GKE
```bash
gcloud container clusters create study-master \
  --zone us-central1-a \
  --num-nodes 3 \
  --machine-type e2-standard-4 \
  --enable-autoscaling \
  --min-nodes 2 \
  --max-nodes 10
```

### 2. Install Prerequisites
```bash
# Install NGINX Ingress Controller
kubectl apply -f https://raw.githubusercontent.com/kubernetes/ingress-nginx/main/deploy/static/provider/cloud/deploy.yaml

# Install cert-manager for SSL
kubectl apply -f https://github.com/cert-manager/cert-manager/releases/download/v1.13.0/cert-manager.yaml

# Create cluster issuer for Let's Encrypt
kubectl apply -f - <<EOF
apiVersion: cert-manager.io/v1
kind: ClusterIssuer
metadata:
  name: letsencrypt-prod
spec:
  acme:
    server: https://acme-v02.api.letsencrypt.org/directory
    email: admin@studymaster.com
    privateKeySecretRef:
      name: letsencrypt-prod
    solvers:
    - http01:
        ingress:
          class: nginx
EOF
```

### 3. Create Secrets
```bash
kubectl create namespace study-master

kubectl create secret generic study-master-secrets \
  --namespace study-master \
  --from-literal=database-url='postgresql+asyncpg://...' \
  --from-literal=redis-url='redis://redis:6379/0' \
  --from-literal=secret-key='your-secret-key' \
  --from-literal=openai-api-key='sk-...'
```

### 4. Deploy Application
```bash
# Using Kustomize
kubectl apply -k infrastructure/kubernetes/overlays/production

# Verify deployment
kubectl get pods -n study-master
kubectl get services -n study-master
kubectl get ingress -n study-master
```

### 5. Configure DNS
Point your domain to the Load Balancer IP:
```bash
kubectl get ingress -n study-master -o jsonpath='{.items[0].status.loadBalancer.ingress[0].ip}'
```

---

## Cloud Provider Guides

### AWS Recommended Architecture

| Service | Purpose | Configuration |
|---------|---------|---------------|
| EKS | Kubernetes | t3.large nodes, 3-10 nodes |
| RDS PostgreSQL | Database | db.r6g.large, Multi-AZ |
| ElastiCache Redis | Caching | cache.r6g.large, cluster mode |
| S3 | File storage | Standard + IA lifecycle |
| CloudFront | CDN | Global edge locations |
| WAF | Security | AWS Managed Rules |
| Route 53 | DNS | Health checks enabled |

**Estimated Cost**: $500-2000/month depending on traffic

### GCP Recommended Architecture

| Service | Purpose | Configuration |
|---------|---------|---------------|
| GKE | Kubernetes | e2-standard-4, 3-10 nodes |
| Cloud SQL | Database | db-n1-standard-4, HA |
| Memorystore | Redis | 5GB, standard tier |
| Cloud Storage | Files | Standard + Nearline |
| Cloud CDN | CDN | Global load balancer |
| Cloud Armor | WAF | OWASP rules |

**Estimated Cost**: $400-1800/month

### Azure Recommended Architecture

| Service | Purpose | Configuration |
|---------|---------|---------------|
| AKS | Kubernetes | D4s_v3, 3-10 nodes |
| Azure Database | PostgreSQL | GP_Gen5_4, HA |
| Azure Cache | Redis | C3 Premium |
| Blob Storage | Files | Hot + Cool tiers |
| Azure CDN | CDN | Verizon Premium |
| Azure WAF | Security | OWASP 3.2 |

**Estimated Cost**: $450-1900/month

---

## Security Configuration

### 1. SSL/TLS
SSL certificates are automatically managed by cert-manager. Ensure:
- TLS 1.3 is enforced
- HSTS is enabled
- Certificate renewal is monitored

### 2. Rate Limiting
Configure in `backend/app/middleware/security.py`:
```python
RateLimitMiddleware(
    app,
    requests_per_minute=60,
    requests_per_hour=1000,
    burst_size=20
)
```

### 3. WAF Rules (CloudFlare/AWS WAF)
Enable these managed rules:
- OWASP Core Rule Set
- SQL Injection protection
- XSS protection
- Rate limiting
- Bot protection

### 4. Network Security
```bash
# Kubernetes Network Policies
kubectl apply -f - <<EOF
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: backend-policy
  namespace: study-master
spec:
  podSelector:
    matchLabels:
      app: backend
  policyTypes:
  - Ingress
  - Egress
  ingress:
  - from:
    - podSelector:
        matchLabels:
          app: frontend
    - podSelector:
        matchLabels:
          app: ingress-nginx
  egress:
  - to:
    - podSelector:
        matchLabels:
          app: postgres
    - podSelector:
        matchLabels:
          app: redis
EOF
```

---

## Monitoring & Alerting

### Prometheus Metrics
Access Prometheus at `https://prometheus.yourdomain.com`

Key metrics to monitor:
- `http_requests_total` - Request rate
- `http_request_duration_seconds` - Latency
- `up` - Service availability
- `container_memory_usage_bytes` - Memory usage
- `container_cpu_usage_seconds_total` - CPU usage

### Grafana Dashboards
Access Grafana at `https://grafana.yourdomain.com`

Pre-configured dashboards:
1. **Study Master Overview** - Business metrics
2. **Backend Performance** - API metrics
3. **Infrastructure** - K8s/Docker metrics

### Alert Examples
```yaml
# High error rate
- alert: HighErrorRate
  expr: rate(http_requests_total{status=~"5.."}[5m]) > 0.05
  for: 5m
  labels:
    severity: critical

# Service down
- alert: ServiceDown
  expr: up == 0
  for: 1m
  labels:
    severity: critical
```

### PagerDuty/Slack Integration
Configure in Alertmanager:
```yaml
receivers:
- name: 'slack'
  slack_configs:
  - api_url: 'https://hooks.slack.com/services/...'
    channel: '#alerts'
```

---

## Backup & Recovery

### Automated Backups
Backups run automatically via the backup service:
- **Daily**: Last 7 days retained
- **Weekly**: Last 4 weeks retained
- **Monthly**: Last 6 months retained

### Manual Backup
```bash
# Run backup script
docker exec -it studymaster_backup_1 /backup.sh full

# Or using kubectl
kubectl exec -it deploy/backup -n study-master -- /backup.sh full
```

### Restore Process
```bash
# 1. Stop the application
kubectl scale deployment backend --replicas=0 -n study-master

# 2. Restore database
pg_restore -h postgres -U studymaster -d studymaster /backups/latest.dump

# 3. Restart application
kubectl scale deployment backend --replicas=3 -n study-master
```

### Disaster Recovery
1. **RTO (Recovery Time Objective)**: < 1 hour
2. **RPO (Recovery Point Objective)**: < 24 hours

For multi-region DR, configure:
- Database replication across regions
- S3 cross-region replication
- DNS failover

---

## Scaling Guide

### Horizontal Scaling
```bash
# Scale backend
kubectl scale deployment backend --replicas=10 -n study-master

# Or configure HPA
kubectl patch hpa backend-hpa -n study-master -p '{"spec":{"maxReplicas":20}}'
```

### Vertical Scaling
Update resource limits in `infrastructure/kubernetes/overlays/production/resources-patch.yaml`

### Database Scaling
1. **Read replicas**: Add PostgreSQL read replicas for read-heavy workloads
2. **Connection pooling**: Use PgBouncer
3. **Partitioning**: Consider table partitioning for large tables

### Redis Scaling
1. **Cluster mode**: Enable Redis Cluster for horizontal scaling
2. **Read replicas**: Add replicas for read-heavy caching

---

## Troubleshooting

### Common Issues

#### 1. Pods not starting
```bash
kubectl describe pod <pod-name> -n study-master
kubectl logs <pod-name> -n study-master
```

#### 2. Database connection issues
```bash
# Check database connectivity
kubectl exec -it deploy/backend -n study-master -- \
  python -c "from app.database import engine; print(engine.url)"
```

#### 3. High memory usage
```bash
# Check memory usage
kubectl top pods -n study-master

# Restart with higher limits
kubectl patch deployment backend -n study-master -p \
  '{"spec":{"template":{"spec":{"containers":[{"name":"backend","resources":{"limits":{"memory":"4Gi"}}}]}}}}'
```

#### 4. SSL certificate issues
```bash
# Check certificate status
kubectl get certificates -n study-master
kubectl describe certificate studymaster-tls -n study-master
```

### Logs
```bash
# Backend logs
kubectl logs -f deploy/backend -n study-master

# All logs
kubectl logs -l app.kubernetes.io/part-of=study-master -n study-master

# Celery worker logs
kubectl logs -f deploy/celery-worker -n study-master
```

### Health Checks
```bash
# Backend health
curl https://api.studymaster.com/health

# Frontend health
curl https://studymaster.com/
```

---

## Support

For enterprise support, contact: support@studymaster.com

---

*Last updated: December 2024*
