# CredPay - Production Deployment Checklist

**Status**: Ready for Deployment
**Last Updated**: April 22, 2026
**Current Environment**: Development ✓ / Staging ⏳ / Production ⏳

---

## Phase 1: Pre-Deployment Setup (1-2 weeks)

### AWS Infrastructure Setup
- [ ] Create AWS account and configure IAM roles
- [ ] Set up EKS cluster (credpay-prod-cluster)
  - [ ] Configure auto-scaling group (2-10 nodes)
  - [ ] Set up node security groups
  - [ ] Enable audit logging
- [ ] Create RDS PostgreSQL database (Multi-AZ)
  - [ ] Configure backup retention (30 days)
  - [ ] Enable automated backups
  - [ ] Set up read replicas for analytics
  - [ ] Configure enhanced monitoring
- [ ] Create ElastiCache Redis cluster
  - [ ] Configure Multi-AZ
  - [ ] Set up parameter backups
  - [ ] Enable automatic failover
- [ ] Create managed message queue (RabbitMQ or MSK Kafka)
  - [ ] Configure high availability
  - [ ] Set up monitoring
- [ ] Create S3 bucket for database backups
  - [ ] Enable versioning and lifecycle policies
  - [ ] Set up cross-region replication
- [ ] Create CloudFront distribution for CDN
  - [ ] Configure SSL/TLS
  - [ ] Set up cache behaviors

### Security & Keys
- [ ] Generate JWT private/public key pair
  ```bash
  openssl genrsa -out private.pem 2048
  openssl rsa -in private.pem -pubout -out public.pem
  ```
- [ ] Generate JWT_SECRET
  ```bash
  node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
  ```
- [ ] Generate refresh token secret
- [ ] Set up AWS Secrets Manager for all secrets
- [ ] Configure AWS KMS key for encryption at rest
- [ ] Request SSL/TLS certificate from ACM
- [ ] Set up WAF (Web Application Firewall)
- [ ] Configure DDoS protection (AWS Shield)

### Payment Gateways
- [ ] Register with Razorpay (production account)
  - [ ] Obtain API keys (live mode)
  - [ ] Configure webhook URLs and secrets
  - [ ] Set up settlement accounts
  - [ ] Test payment flows
- [ ] Register with Cashfree (production account)
  - [ ] Obtain API credentials (live mode)
  - [ ] Configure webhook URLs
  - [ ] Set up beneficiary management
  - [ ] Test payout flows

### Monitoring & Logging
- [ ] Set up Prometheus cluster
  - [ ] Configure scrape targets
  - [ ] Set up retention policies
- [ ] Set up Grafana dashboard
  - [ ] Create production dashboard
  - [ ] Configure alerting
- [ ] Set up ELK stack (Elasticsearch, Logstash, Kibana)
  - [ ] Configure log ingestion
  - [ ] Set up log retention policies
- [ ] Configure CloudWatch for AWS resource monitoring
- [ ] Set up Sentry for error tracking
- [ ] Set up DataDog (optional) for comprehensive APM

### DNS & Domain
- [ ] Register domain (credpay.com)
- [ ] Set up Route 53 hosted zone
- [ ] Configure DNS records
  - [ ] api.credpay.com → ALB
  - [ ] app.credpay.com → CloudFront
  - [ ] admin.credpay.com → ALB
- [ ] Configure health checks
- [ ] Set up failover routing (optional for high availability)

---

## Phase 2: Application Deployment (1 week)

### Docker Image Preparation
- [ ] Update version number (semantic versioning)
- [ ] Update Dockerfile with latest dependencies
- [ ] Run security scan on Dockerfile
- [ ] Build Docker image locally
  ```bash
  docker build -t credpay/api-server:v1.0.0 -f artifacts/api-server/Dockerfile .
  ```
- [ ] Test image locally
- [ ] Configure ECR registry
- [ ] Push image to ECR
  ```bash
  docker push 123456789012.dkr.ecr.us-east-1.amazonaws.com/credpay/api-server:v1.0.0
  ```
- [ ] Scan image with Trivy for vulnerabilities
- [ ] Tag as latest
  ```bash
  docker tag credpay/api-server:v1.0.0 credpay/api-server:latest
  docker push credpay/api-server:latest
  ```

### Database Initialization
- [ ] Create database in RDS PostgreSQL
- [ ] Create database user with restricted privileges
- [ ] Run schema migration
  ```bash
  pnpm run db:migrate --env production
  ```
- [ ] Seed default data
  ```bash
  pnpm run db:seed
  ```
- [ ] Verify schema creation
  ```sql
  SELECT table_name FROM information_schema.tables WHERE table_schema='public';
  ```
- [ ] Set up monitoring for database
- [ ] Configure backup schedule

### Kubernetes Deployment
- [ ] Update k8s/credpay-prod.yaml with production values
  - [ ] Update image references (ECR URL)
  - [ ] Update environment variables
  - [ ] Update secret references
- [ ] Create Kubernetes namespace
  ```bash
  kubectl create namespace credpay-prod
  ```
- [ ] Apply ConfigMap
  ```bash
  kubectl apply -f k8s/credpay-prod.yaml
  ```
- [ ] Apply Secrets
  ```bash
  kubectl apply -f k8s/credpay-prod-secrets.yaml
  ```
- [ ] Deploy application
  ```bash
  kubectl apply -f k8s/credpay-prod.yaml
  ```
- [ ] Verify deployment status
  ```bash
  kubectl get pods -n credpay-prod
  kubectl describe pod -n credpay-prod <pod-name>
  ```
- [ ] Check service endpoints
  ```bash
  kubectl get svc -n credpay-prod
  ```

### Kubernetes Configuration
- [ ] Update HPA (Horizontal Pod Autoscaler)
  - [ ] Set min replicas: 3
  - [ ] Set max replicas: 10
  - [ ] Configure CPU threshold: 70%
  - [ ] Configure memory threshold: 80%
- [ ] Configure PDB (Pod Disruption Budget)
  - [ ] Minimum available pods: 2
- [ ] Set up NetworkPolicy
  - [ ] Ingress: Allow from ingress-nginx
  - [ ] Egress: Allow to databases and external services
- [ ] Configure RBAC
  - [ ] Service account permissions
  - [ ] Role and RoleBinding
- [ ] Set up Ingress
  - [ ] Configure TLS termination
  - [ ] Set rate limiting rules
  - [ ] Configure path-based routing

---

## Phase 3: Testing & Validation (1 week)

### Functionality Testing
- [ ] API health check
  ```bash
  curl https://api.credpay.com/health
  ```
- [ ] User registration test
  ```bash
  curl -X POST https://api.credpay.com/api/v1/auth/register \
    -d '{"email":"test@credpay.com","password":"Test123!","name":"Test"}'
  ```
- [ ] Payment flow test
  - [ ] Create payment intent
  - [ ] Simulate payment confirmation
  - [ ] Verify ledger entries
  - [ ] Check wallet balance
- [ ] KYC workflow test
  - [ ] Submit KYC documents
  - [ ] Verify status
  - [ ] Approve/reject
- [ ] Payout workflow test
  - [ ] Add payee
  - [ ] Create payout request
  - [ ] Verify async processing
  - [ ] Check payout status

### Integration Testing
- [ ] Razorpay webhook test
  - [ ] Simulate payment success webhook
  - [ ] Verify ledger update
  - [ ] Check notification sending
- [ ] Cashfree webhook test
  - [ ] Simulate payout success webhook
  - [ ] Verify status update
  - [ ] Check notification sending
- [ ] Database test
  - [ ] Query all major tables
  - [ ] Verify indexes
  - [ ] Check backup completion

### Load Testing
- [ ] Run load test (1000 concurrent users)
  ```bash
  # Using Apache Bench or similar
  ab -n 10000 -c 1000 https://api.credpay.com/api/v1/health
  ```
- [ ] Monitor resource usage
  - [ ] CPU utilization
  - [ ] Memory consumption
  - [ ] Network bandwidth
  - [ ] Database connections
- [ ] Verify auto-scaling
  - [ ] Check pod scaling
  - [ ] Verify node scaling
- [ ] Verify performance
  - [ ] API latency < 100ms (p99)
  - [ ] Error rate < 1%
  - [ ] No timeouts

### Security Testing
- [ ] SQL injection test
  ```bash
  curl 'https://api.credpay.com/api/v1/transactions?userId=1 OR 1=1'
  ```
- [ ] XSS test
  - [ ] Try injecting script tags
  - [ ] Verify escaping
- [ ] CSRF test
  - [ ] Verify CSRF token validation
- [ ] Rate limiting test
  ```bash
  for i in {1..200}; do curl https://api.credpay.com/api/v1/health; done
  ```
- [ ] JWT token test
  - [ ] Verify token expiration
  - [ ] Verify signature validation
  - [ ] Verify refresh token flow
- [ ] Authorization test
  - [ ] Verify users can only access own data
  - [ ] Verify admin endpoints are protected

### Performance Baseline
- [ ] Establish API latency baseline
- [ ] Document database query times
- [ ] Record error rate
- [ ] Document throughput (requests/sec)
- [ ] Store metrics for comparison

---

## Phase 4: Production Launch Preparation (2-3 days)

### Documentation
- [ ] Publish API documentation
- [ ] Create runbook for common operations
- [ ] Document server architecture
- [ ] Create incident response playbook
- [ ] Document backup & recovery procedures
- [ ] Update README files

### Monitoring & Alerts
- [ ] Configure Prometheus alerts
  - [ ] Alert on error rate > 5%
  - [ ] Alert on latency p99 > 500ms
  - [ ] Alert on payment failure > 1%
  - [ ] Alert on database replication lag > 30s
- [ ] Configure log alerts
  - [ ] Critical errors
  - [ ] Failed transactions
  - [ ] Suspect activity
- [ ] Configure AWS CloudWatch alarms
  - [ ] Database CPU > 80%
  - [ ] Network replication lag > 1s
  - [ ] Disk space < 10%

### On-Call Setup
- [ ] Configure PagerDuty/OpsGenie
- [ ] Set up escalation policy
- [ ] Create incident templates
- [ ] Configure Slack/email notifications
- [ ] Brief on-call team members
- [ ] Schedule rotation

### Backup Verification
- [ ] Verify daily backup completion
  ```bash
  aws rds describe-db-snapshots --db-instance-identifier credpay-prod
  ```
- [ ] Test restore from backup
  - [ ] Create test restore
  - [ ] Verify data integrity
  - [ ] Delete test restore
- [ ] Verify cross-region backup replication

---

## Phase 5: Soft Launch (1 week)

### Limited Beta Release
- [ ] Invite 100-500 beta users
- [ ] Set up user communication channel
- [ ] Monitor error rates closely
- [ ] Check for any critical bugs
- [ ] Verify payment processing works
- [ ] Verify payout processing works
- [ ] Monitor database performance
- [ ] Verify backup completion
- [ ] Review logs for anomalies

### Monitoring During Beta
- [ ] Check API latency (target < 100ms p99)
- [ ] Verify payment success rate > 99%
- [ ] Verify payout success rate > 95%
- [ ] Monitor error logs
- [ ] Track user feedback
- [ ] Fix critical bugs immediately

---

## Phase 6: Full Production Launch

### Pre-Launch Verification
- [ ] All tests passing
- [ ] Performance benchmarks met
- [ ] Security audit completed
- [ ] Compliance checklist completed
- [ ] Documentation finalized
- [ ] Support team trained
- [ ] Monitoring active
- [ ] Backup verified
- [ ] On-call team ready

### Launch Day
- [ ] Scale up to production capacity
  ```bash
  kubectl scale deployment credpay-api -n credpay-prod --replicas=5
  ```
- [ ] Open registration to public
- [ ] Monitor metrics continuously
- [ ] Have rollback plan ready
- [ ] Test customer support

### Post-Launch (First 24 hours)
- [ ] Monitor closely for errors
- [ ] Check API latency every hour
- [ ] Verify payment processing
- [ ] Verify payout processing
- [ ] Review logs for issues
- [ ] Check database performance
- [ ] Verify backup completion

---

## Operations Checklist (Ongoing)

### Daily
- [ ] Check health dashboard
- [ ] Review error logs
- [ ] Verify backup completion
- [ ] Check payment success rates
- [ ] Monitor database load

### Weekly
- [ ] Review performance metrics
- [ ] Check database replication lag
- [ ] Verify backup restoration capability
- [ ] Review security logs
- [ ] Check for disk space issues

### Monthly
- [ ] Performance review
- [ ] Security audit
- [ ] Database optimization
- [ ] Backup and recovery test
- [ ] Disaster recovery drill

### Quarterly
- [ ] Comprehensive security audit
- [ ] Load testing
- [ ] Chaos engineering tests
- [ ] Update dependencies
- [ ] Review and update runbooks

---

## Rollback Decision Tree

### Scenario: API errors > 5%
1. Check logs for errors
2. If critical: `kubectl rollout undo deployment/credpay-api -n credpay-prod`
3. Notify stakeholders
4. Investigate root cause

### Scenario: Database connection pool exhausted
1. Check active connections
2. Scale down non-essential services
3. Increase pool size if needed
4. Consider database failover

### Scenario: Disk space < 10%
1. Archive old logs
2. Check for disk bloat
3. Consider emergency cleanup
4. Schedule disk expansion

---

## Post-Launch Optimization (Month 1+)

### Performance Optimization
- [ ] Analyze slow queries
- [ ] Add indexes as needed
- [ ] Optimize Redis cache hit rate
- [ ] Tune connection pool size
- [ ] Implement caching strategies

### Cost Optimization
- [ ] Review AWS resource utilization
- [ ] Consider reserved instances
- [ ] Optimize data transfer costs
- [ ] Review log retention

### Security Hardening
- [ ] Rotate secrets and keys
- [ ] Update security group rules
- [ ] Apply security patches
- [ ] Review and update WAF rules
- [ ] Penetration testing

---

## Success Criteria

✅ **Deployment Successful When**:
- [ ] API is responding (< 100ms latency)
- [ ] All endpoints are accessible
- [ ] Database is replicating correctly
- [ ] Backup jobs are running
- [ ] Monitoring is active and working
- [ ] Payment processing is working
- [ ] Payout processing is working
- [ ] Zero critical errors in first 24 hours
- [ ] User feedback is positive

❌ **Rollback Trigger**:
- [ ] Error rate > 10%
- [ ] Success rate on payments < 90%
- [ ] Database corruption detected
- [ ] Security breach detected
- [ ] Data loss detected
- [ ] Service completely unavailable

---

## Post-Deployment Support

- **Deployment Lead**: [Name] - deployment@credpay.com
- **On-Call**: [Schedule] - oncall@credpay.com
- **Support Channel**: #credpay-prod-ops (Slack)
- **Incident Status**: status.credpay.com

---

## Notes / Comments

```
[Space for deployment team notes]
```

---

**Print this checklist and mark items as you complete them during deployment.**

Last Updated: April 22, 2026
Deployment Status: Ready ✅
