# CredPay - Production Deployment & CI/CD Guide

## Table of Contents
1. [Local Development Setup](#local-development-setup)
2. [Database Setup & Migrations](#database-setup--migrations)
3. [Environment Configuration](#environment-configuration)
4. [Docker Build & Push](#docker-build--push)
5. [Kubernetes Deployment](#kubernetes-deployment)
6. [CI/CD Pipeline](#cicd-pipeline)
7. [Monitoring & Observability](#monitoring--observability)
8. [Disaster Recovery](#disaster-recovery)
9. [Security Checklist](#security-checklist)
10. [Performance Optimization](#performance-optimization)

---

## Local Development Setup

### Prerequisites
- Node.js 20+
- pnpm 9+
- Docker & Docker Compose
- PostgreSQL 14+ (optional if using Docker)
- Redis (optional if using Docker)

### Quick Start

```bash
# Clone repository
git clone https://github.com/credpay/credpay.git
cd credpay

# Copy environment file
cp .env.example .env

# Start services with Docker Compose
docker-compose up -d

# Install dependencies
pnpm install

# Run migrations
pnpm run migrate

# Start development server
pnpm run dev

# API available at http://localhost:3000
# Adminer (DB UI) at http://localhost:8080
# RabbitMQ Management at http://localhost:15672
```

### Verify Local Setup

```bash
# Health check
curl http://localhost:3000/health

# Test request (requires auth)
curl http://localhost:3000/api/v1/wallet/balance \
  -H "Authorization: Bearer <token>"

# View logs
docker-compose logs -f api-server

# Stop services
docker-compose down
```

---

## Database Setup & Migrations

### Initial Schema Setup

The database schema is automatically initialized via:

```bash
# Using Drizzle ORM migrations
pnpm run db:migrate

# Or manually using SQL
psql -U credpay -d credpay -f lib/db/schema.sql
```

### Seed Data

```bash
# Insert default fee configuration
pnpm run db:seed

# Create test users/data
pnpm run db:seed:test
```

### Database Backup & Recovery

```bash
# Backup PostgreSQL database
pg_dump -U credpay credpay > backup-$(date +%Y%m%d-%H%M%S).sql

# Restore from backup
psql -U credpay credpay < backup.sql

# AWS RDS Backup (console or CLI)
aws rds create-db-snapshot \
  --db-instance-identifier credpay-prod \
  --db-snapshot-identifier credpay-prod-backup-$(date +%Y%m%d-%H%M%S)

# Restore from RDS snapshot
aws rds restore-db-instance-from-db-snapshot \
  --db-instance-identifier credpay-prod-restored \
  --db-snapshot-identifier credpay-prod-backup-20260422-120000
```

### Migration Verification

```bash
# Check migration status
pnpm run db:status

# Rollback last migration (development only)
pnpm run db:rollback

# Test migrations on staging
pnpm run db:migrate --env staging
```

---

## Environment Configuration

### Required Environment Variables

```bash
# Database
DATABASE_URL=postgresql://user:pass@host:5432/credpay

# Redis
REDIS_URL=redis://:password@host:6379

# Message Queue
RABBITMQ_URL=amqp://user:pass@host:5672

# JWT (Generate with: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")
JWT_SECRET=<32-byte-hex>
JWT_PUBLIC_KEY=<public-key>
JWT_PRIVATE_KEY=<private-key>

# Payment Gateways
RAZORPAY_KEY_ID=rzp_live_xxxxx
RAZORPAY_KEY_SECRET=xxxxx
RAZORPAY_WEBHOOK_SECRET=xxxxx

CASHFREE_CLIENT_ID=xxxxx
CASHFREE_CLIENT_SECRET=xxxxx

# Email/SMS
SENDGRID_API_KEY=SG.xxxxx
TWILIO_ACCOUNT_SID=xxxxx
TWILIO_AUTH_TOKEN=xxxxx
```

### Generate Secure Keys

```bash
# Generate JWT secret
node -e "console.log('JWT_SECRET=' + require('crypto').randomBytes(32).toString('hex'))"

# Generate RSA key pair for JWT
openssl genrsa -out private.pem 2048
openssl rsa -in private.pem -pubout -out public.pem

# For AWS KMS rotation
aws kms generate-data-key --key-id alias/credpay-key --key-spec AES_256
```

---

## Docker Build & Push

### Build Local Image

```bash
# Build image
docker build -t credpay/api-server:latest -f artifacts/api-server/Dockerfile .

# Run locally
docker run -d \
  --name credpay-api \
  -p 3000:3000 \
  --env-file .env \
  credpay/api-server:latest

# View logs
docker logs -f credpay-api
```

### Build & Push to Registry

```bash
# Login to ECR (AWS)
aws ecr get-login-password --region us-east-1 | \
  docker login --username AWS --password-stdin 123456789012.dkr.ecr.us-east-1.amazonaws.com

# Build for production
docker build \
  -t 123456789012.dkr.ecr.us-east-1.amazonaws.com/credpay/api-server:v1.0.0 \
  -t 123456789012.dkr.ecr.us-east-1.amazonaws.com/credpay/api-server:latest \
  -f artifacts/api-server/Dockerfile .

# Push to ECR
docker push 123456789012.dkr.ecr.us-east-1.amazonaws.com/credpay/api-server:v1.0.0
docker push 123456789012.dkr.ecr.us-east-1.amazonaws.com/credpay/api-server:latest

# Verify image
aws ecr describe-images \
  --repository-name credpay/api-server \
  --query 'imageDetails[*].[imageTags,imageSizeInBytes]'
```

### Image Security Scanning

```bash
# Scan with Trivy
trivy image credpay/api-server:latest

# Scan with AWS ECR
aws ecr start-image-scan \
  --repository-name credpay/api-server \
  --image-id imageTag=latest

# View scan results
aws ecr describe-image-scan-findings \
  --repository-name credpay/api-server \
  --image-id imageTag=latest
```

---

## Kubernetes Deployment

### Prerequisites

```bash
# AWS CLI configured
aws configure

# kubectl installed and configured
aws eks update-kubeconfig \
  --region us-east-1 \
  --name credpay-prod-cluster

# Verify cluster access
kubectl cluster-info
kubectl get nodes
```

### Deploy to Kubernetes

```bash
# Apply manifests (order matters)
kubectl apply -f k8s/credpay-prod.yaml

# Verify deployment
kubectl get deployments -n credpay-prod
kubectl get pods -n credpay-prod
kubectl get svc -n credpay-prod

# Check pod status
kubectl describe pod -n credpay-prod <pod-name>

# View logs
kubectl logs -n credpay-prod <pod-name> -c api-server
kubectl logs -n credpay-prod -l app=credpay-api --tail=100

# Port forward for debugging
kubectl port-forward -n credpay-prod svc/credpay-api-svc 3000:80
```

### Update Deployment (Rolling Update)

```bash
# Update image
kubectl set image deployment/credpay-api \
  -n credpay-prod \
  api-server=credpay/api-server:v1.0.1

# Monitor rollout
kubectl rollout status deployment/credpay-api -n credpay-prod

# Rollback if needed
kubectl rollout undo deployment/credpay-api -n credpay-prod
kubectl rollout undo deployment/credpay-api -n credpay-prod --to-revision=2
```

### Scale Deployment

```bash
# Manual scaling
kubectl scale deployment credpay-api -n credpay-prod --replicas=5

# View HPA status
kubectl get hpa -n credpay-prod
kubectl describe hpa credpay-api-hpa -n credpay-prod

# Check HPA metrics
kubectl top pods -n credpay-prod
kubectl top nodes
```

---

## CI/CD Pipeline

### GitHub Actions Workflow

Create `.github/workflows/deploy.yml`:

```yaml
name: Deploy CredPay

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

env:
  AWS_REGION: us-east-1
  ECR_REPOSITORY: credpay/api-server
  EKS_CLUSTER_NAME: credpay-prod-cluster

jobs:
  test:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:16-alpine
        env:
          POSTGRES_PASSWORD: postgres
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5

    steps:
      - uses: actions/checkout@v4

      - uses: pnpm/action-setup@v2
        with:
          version: 9

      - uses: actions/setup-node@v4
        with:
          node-version: "20"
          cache: "pnpm"

      - name: Install dependencies
        run: pnpm install --frozen-lockfile

      - name: Type check
        run: pnpm run typecheck

      - name: Lint
        run: pnpm run lint

      - name: Unit tests
        run: pnpm run test
        env:
          DATABASE_URL: postgresql://postgres:postgres@localhost:5432/test

      - name: Integration tests
        run: pnpm run test:integration
        env:
          DATABASE_URL: postgresql://postgres:postgres@localhost:5432/test

  build:
    needs: test
    runs-on: ubuntu-latest
    permissions:
      id-token: write
      contents: read
    
    steps:
      - uses: actions/checkout@v4

      - name: Configure AWS credentials
        uses: aws-actions/configure-aws-credentials@v4
        with:
          role-to-assume: arn:aws:iam::123456789012:role/github-actions
          role-session-name: github-actions
          aws-region: us-east-1

      - name: Login to Amazon ECR
        id: login-ecr
        uses: aws-actions/amazon-ecr-login@v2

      - name: Build, tag, and push image to Amazon ECR
        env:
          ECR_REGISTRY: ${{ steps.login-ecr.outputs.registry }}
          IMAGE_TAG: ${{ github.sha }}
        run: |
          docker build -t $ECR_REGISTRY/$ECR_REPOSITORY:$IMAGE_TAG \
                       -t $ECR_REGISTRY/$ECR_REPOSITORY:latest \
                       -f artifacts/api-server/Dockerfile .
          docker push $ECR_REGISTRY/$ECR_REPOSITORY:$IMAGE_TAG
          docker push $ECR_REGISTRY/$ECR_REPOSITORY:latest

      - name: Scan image with Trivy
        uses: aquasecurity/trivy-action@master
        with:
          image-ref: ${{ steps.login-ecr.outputs.registry }}/${{ env.ECR_REPOSITORY }}:${{ github.sha }}
          format: sarif
          output: trivy-results.sarif

      - name: Upload Trivy results to GitHub Security tab
        uses: github/codeql-action/upload-sarif@v2
        with:
          sarif_file: trivy-results.sarif

  deploy-staging:
    needs: build
    runs-on: ubuntu-latest
    if: github.ref == 'refs/heads/main' && github.event_name == 'push'
    
    steps:
      - uses: actions/checkout@v4

      - name: Configure AWS credentials
        uses: aws-actions/configure-aws-credentials@v4
        with:
          role-to-assume: arn:aws:iam::123456789012:role/github-actions
          aws-region: us-east-1

      - name: Update kubeconfig
        run: |
          aws eks update-kubeconfig \
            --name credpay-staging-cluster \
            --region us-east-1

      - name: Deploy to staging
        run: |
          kubectl set image deployment/credpay-api \
            -n credpay-staging \
            api-server=123456789012.dkr.ecr.us-east-1.amazonaws.com/credpay/api-server:${{ github.sha }} \
            --record

          kubectl rollout status deployment/credpay-api -n credpay-staging

  deploy-production:
    needs: [build, deploy-staging]
    runs-on: ubuntu-latest
    if: github.ref == 'refs/heads/main' && github.event_name == 'push'
    environment: production
    
    steps:
      - uses: actions/checkout@v4

      - name: Configure AWS credentials
        uses: aws-actions/configure-aws-credentials@v4
        with:
          role-to-assume: arn:aws:iam::123456789012:role/github-actions
          aws-region: us-east-1

      - name: Update kubeconfig
        run: |
          aws eks update-kubeconfig \
            --name credpay-prod-cluster \
            --region us-east-1

      - name: Deploy to production
        run: |
          kubectl set image deployment/credpay-api \
            -n credpay-prod \
            api-server=123456789012.dkr.ecr.us-east-1.amazonaws.com/credpay/api-server:${{ github.sha }} \
            --record

          kubectl rollout status deployment/credpay-api -n credpay-prod

      - name: Run smoke tests
        run: |
          kubectl run smoke-test \
            -n credpay-prod \
            --image=curlimages/curl \
            --rm -i --restart=Never \
            -- sh -c "curl -f http://credpay-api-svc/health"
```

---

## Monitoring & Observability

### Prometheus Setup

```bash
# Add Prometheus helm chart
helm repo add prometheus-community https://prometheus-community.github.io/helm-charts
helm repo update

# Install Prometheus
helm install prometheus prometheus-community/kube-prometheus-stack \
  -n credpay-monitoring \
  --create-namespace \
  -f k8s/prometheus-values.yaml
```

### Configure Alerts

```bash
# Create PrometheusRule
kubectl apply -f k8s/prometheus-rules.yaml
```

### View Metrics

```bash
# Port forward Prometheus
kubectl port-forward -n credpay-monitoring svc/prometheus-operated 9090:9090

# Port forward Grafana
kubectl port-forward -n credpay-monitoring svc/prometheus-grafana 3000:80
```

### Key Metrics to Monitor

- **API Latency**: `histogram_quantile(0.99, rate(http_request_duration_ms[5m]))`
- **Error Rate**: `rate(http_requests_total{status=~"5.."}[5m])`
- **Database Connections**: `pg_stat_activity_count`
- **Redis Memory**: `redis_memory_used_bytes`
- **Message Queue Depth**: `rabbitmq_queue_messages_ready`
- **Payment Success Rate**: `rate(payments_total{status="success"}[5m])`
- **Payout Success Rate**: `rate(payouts_total{status="success"}[5m])`

---

## Disaster Recovery

### RTO & RPO

| Component | RTO | RPO |
|-----------|-----|-----|
| API Servers | 5 min | 0 (stateless) |
| PostgreSQL | 30 min | 15 min |
| Redis Cache | 5 min | Acceptable loss |
| Message Queue | 10 min | 1 hr |

### Backup Strategy

```bash
# Automated daily backup
0 2 * * * aws rds create-db-snapshot \
  --db-instance-identifier credpay-prod \
  --db-snapshot-identifier credpay-backup-$(date +\%Y\%m\%d)

# Test restore monthly
0 3 1 * * aws rds restore-db-instance-from-db-snapshot \
  --db-instance-identifier credpay-restore-test \
  --db-snapshot-identifier credpay-backup-$(date -d "1 day ago" +\%Y\%m\%d)

# Cross-region backup replication (AWS)
aws rds copy-db-snapshot \
  --source-db-snapshot-identifier credpay-backup-20260422 \
  --target-db-snapshot-identifier credpay-backup-20260422-replica \
  --source-region us-east-1 \
  --destination-region eu-west-1
```

### Failover Procedure

```bash
# Promote read replica to primary
aws rds promote-read-replica credpay-replica-prod

# Update DNS to point to new primary
aws route53 change-resource-record-sets \
  --hosted-zone-id ZXXXXX \
  --change-batch file://dns-failover.json
```

---

## Security Checklist

### Pre-Deployment

- [ ] All secrets rotated
- [ ] JWT keys verified
- [ ] SSL/TLS certificates valid
- [ ] Security group rules reviewed
- [ ] VPC configuration reviewed
- [ ] IAM roles least-privilege
- [ ] Image vulnerability scan passed
- [ ] OWASP dependency check passed
- [ ] Rate limiting configured
- [ ] CORS properly configured

### Runtime Security

- [ ] Pod security policies enforced
- [ ] Network policies configured
- [ ] Secrets encrypted at rest
- [ ] TLS 1.3 only
- [ ] HTTP security headers in place
- [ ] SQL injection tests passed
- [ ] XSS protection verified
- [ ] CSRF tokens validated

### Post-Deployment

- [ ] WAF rules active
- [ ] DDoS protection enabled
- [ ] Security monitoring active
- [ ] Audit logs enabled
- [ ] Access logging enabled
- [ ] Admin dashboards secured
- [ ] Backup encryption verified

---

## Performance Optimization

### Database Optimization

```sql
-- Analyze slow queries
EXPLAIN ANALYZE SELECT * FROM transactions WHERE user_id = 'xxx';

-- Optimize indexes
REINDEX INDEX idx_transactions_user;

-- Vacuum optimize
VACUUM ANALYZE transactions;
```

### Redis Optimization

```bash
# Monitor Redis
redis-cli monitor

# Check memory usage
redis-cli INFO memory

# Optimize eviction policy
CONFIG SET maxmemory-policy allkeys-lru
```

### Application Optimization

```bash
# Enable gzip compression
NODE_OPTIONS="--enable-source-maps" pnpm start

# Connection pooling
PG_POOL_SIZE=20 pnpm start

# Cache headers
Cache-Control: public, max-age=3600
```

---

## Troubleshooting

### Common Issues

#### Pod stuck in CrashLoopBackOff

```bash
# Check logs
kubectl logs -n credpay-prod <pod-name>

# Check events
kubectl describe pod -n credpay-prod <pod-name>

# Common causes: DB connection, missing secrets, OOM
```

#### Database connection pooling exhausted

```bash
# Check connections
psql -U credpay -c "SELECT count(*) FROM pg_stat_activity;"

# Increase pool size in env
PG_POOL_SIZE=30

# Kill idle connections
SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE idle_in_transaction;
```

#### High API latency

```bash
# Check database query performance
EXPLAIN ANALYZE SELECT ...;

# Check Redis hit rate
redis-cli INFO stats | grep keyspace

# Profile Node.js
node --prof app.js
node --prof-process isolate-*.log > profile.txt
```

---

## Completion Checklist

- [ ] Local development environment working
- [ ] Database schema applied successfully
- [ ] Docker images built and pushed
- [ ] Kubernetes manifests deployed
- [ ] CI/CD pipeline configured
- [ ] Monitoring and alerting active
- [ ] Backup and recovery tested
- [ ] Security checklist completed
- [ ] Performance baselines established
- [ ] Documentation reviewed and updated

