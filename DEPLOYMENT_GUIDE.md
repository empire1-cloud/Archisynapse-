# Deployment Guide

## Prerequisites

- Docker and Docker Compose installed
- Kubernetes cluster (GKE, EKS, or AKS)
- kubectl configured
- PostgreSQL 14+
- Redis 7+

---

## Local Development Setup

### 1. Clone Repository

```bash
git clone https://github.com/cantstop113/Archisynapse-.git
cd Archisynapse-
```

### 2. Install Dependencies

```bash
npm install
pip install -r requirements.txt
```

### 3. Environment Configuration

Create `.env.local`:

```bash
NODE_ENV=development
API_PORT=3000
DATABASE_URL=postgresql://user:password@localhost:5432/archisynapse
REDIS_URL=redis://localhost:6379
JWT_SECRET=your_jwt_secret_here
```

### 4. Start Local Environment

```bash
docker-compose up -d
```

### 5. Run Database Migrations

```bash
npm run migrate
npm run seed
```

### 6. Start Development Server

```bash
npm run dev
```

---

## Docker Deployment

### Build Docker Images

```bash
docker build -t archisynapse-api:latest .
docker build -f Dockerfile.fraud -t archisynapse-fraud:latest .
docker build -f Dockerfile.ledger -t archisynapse-ledger:latest .
```

---

## Kubernetes Deployment

### 1. Create Namespace

```bash
kubectl create namespace archisynapse-prod
```

### 2. Create Secrets

```bash
kubectl create secret generic db-credentials \\\n  --from-literal=username=archisynapse \\\n  --from-literal=password=secure_password
```

### 3. Deploy PostgreSQL (Helm)

```bash
helm repo add bitnami https://charts.bitnami.com/bitnami
helm install postgresql bitnami/postgresql \\\n  --namespace archisynapse-prod
```

### 4. Deploy Redis (Helm)

```bash
helm install redis bitnami/redis \\\n  --namespace archisynapse-prod
```

---

## Health Checks

### API Health Endpoint

```bash
curl http://localhost:3000/health
```

### Readiness Probe

```bash
curl http://localhost:3000/ready
```

---

## Monitoring & Logging

### View Logs

```bash
kubectl logs -f deployment/archisynapse-api -n archisynapse-prod
```

---

## Backup & Recovery

### Database Backup

```bash
pg_dump -h localhost -U archisynapse archisynapse > backup.sql
```

### Recovery

```bash
psql -h localhost -U archisynapse archisynapse < backup.sql
```

---

*Last Updated: May 2026*
*Deployment Version: 1.0*