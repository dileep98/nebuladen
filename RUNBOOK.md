# NebulaDen Runbook

Operational procedures for running and maintaining NebulaDen in production.

---

## Service Overview

| Component | Technology | URL |
|-----------|-----------|-----|
| Frontend | Next.js on Vercel | https://nebuladen.vercel.app |
| Backend | Node.js on EC2 | https://nebuladen.duckdns.org |
| Agent | Claude API via WebSocket | wss://nebuladen.duckdns.org/ws |

---

## Health Checks

Check if backend is running:

    curl https://nebuladen.duckdns.org/health
    Expected: {"status":"ok","timestamp":"..."}

Check system metrics:

    curl https://nebuladen.duckdns.org/metrics
    Expected: {"cpu":0,"memory":{...},"disk":{...},"network":{...},...}

---

## SSH Access

    ssh -i nebuladen-key-v2.pem ubuntu@50.17.232.178

---

## Common Operations

### Restart the backend

    pm2 restart nebuladen-backend

### View live logs

    pm2 logs nebuladen-backend

### View structured logs

    cat ~/nebuladen/backend/logs/combined.log | tail -50

### View error logs only

    cat ~/nebuladen/backend/logs/error.log

### View backup logs

    cat ~/backup.log

### Deploy latest code manually

    cd ~/nebuladen
    git pull origin main
    cd backend
    npm install
    pm2 restart nebuladen-backend

### Check PM2 process status

    pm2 status

### Check PM2 log rotation config

    pm2 conf pm2-logrotate

### Check Nginx status

    sudo systemctl status nginx

### Restart Nginx

    sudo systemctl restart nginx

---

## Deployment Pipeline

Every push to main branch triggers:
1. GitHub Actions runs automated tests (98% coverage)
2. npm security audit (blocks on high/critical vulnerabilities)
3. SSH into EC2
4. git pull origin main
5. npm install
6. pm2 restart nebuladen-backend
7. Health check verification — pipeline fails if backend does not respond 200

---

## Monitoring & Alerts

| Monitor | Tool | Alert |
|---------|------|-------|
| Frontend uptime | UptimeRobot | Email when down |
| Backend uptime | UptimeRobot | Email when down |
| EC2 CPU > 80% | CloudWatch | Email via SNS |
| EC2 status check | CloudWatch | Email via SNS |

---

## Backup & Recovery

### Automatic Backups
- db.json is automatically backed up to S3 every 6 hours via cron job
- Bucket: s3://nebuladen-backups-639163294452/db-backups/
- S3 versioning enabled for additional protection
- Backup logs: ~/backup.log

### List available backups

    aws s3 ls s3://nebuladen-backups-639163294452/db-backups/

### Restore from backup

    aws s3 cp s3://nebuladen-backups-639163294452/db-backups/db_YYYY-MM-DD_HH-MM-SS.json ~/nebuladen/backend/db.json
    pm2 restart nebuladen-backend

### Manual backup

    ~/backup.sh

---

## Log Management

### PM2 Log Rotation (auto-configured)
- Max log size: 10MB before rotating
- Retention: 7 days
- Compression: enabled
- Schedule: daily at midnight UTC

### Winston Application Logs
- Combined logs: ~/nebuladen/backend/logs/combined.log
- Error logs: ~/nebuladen/backend/logs/error.log
- Format: JSON with timestamp, service, and metadata

---

## Incident Response

### Backend is down
1. Check UptimeRobot alert email
2. SSH into EC2: ssh -i nebuladen-key-v2.pem ubuntu@50.17.232.178
3. Check PM2: pm2 status
4. If stopped: pm2 restart nebuladen-backend
5. Check logs: pm2 logs nebuladen-backend --lines 50
6. Check Nginx: sudo systemctl status nginx

### WebSocket disconnecting
1. Check Nginx error logs: sudo tail -20 /var/log/nginx/error.log
2. Restart Nginx: sudo systemctl restart nginx
3. Restart backend: pm2 restart nebuladen-backend

### High CPU alert
1. Check active sessions: curl https://nebuladen.duckdns.org/metrics
2. Check running processes: top
3. Check PM2 logs for errors: pm2 logs nebuladen-backend --lines 100

### Disk space running low
1. Check disk usage: df -h
2. Check log sizes: du -sh ~/.pm2/logs/* ~/nebuladen/backend/logs/*
3. Force log rotation: pm2 flush
4. Clean old backups if needed: aws s3 ls s3://nebuladen-backups-639163294452/db-backups/

### SSL certificate expiry
Certificate auto-renews via Certbot. To manually renew:

    sudo certbot renew
    sudo systemctl restart nginx

Certificate expires: 2026-07-26

### Data loss / restore needed
1. List available backups: aws s3 ls s3://nebuladen-backups-639163294452/db-backups/
2. Copy latest backup: aws s3 cp s3://nebuladen-backups-639163294452/db-backups/db_LATEST.json ~/nebuladen/backend/db.json
3. Restart backend: pm2 restart nebuladen-backend

---

## Architecture

    User → Vercel (Next.js) → EC2 t3.micro (Nginx → Express + WebSocket) → Claude API
                                        ↓
                                  PM2 (process management)
                                        ↓
                                  Winston (structured logging)
                                        ↓
                                  S3 (db.json backups every 6h)

---

## Environment Variables

### Backend (.env on EC2)

    PORT=4000
    JWT_SECRET=<secret>
    ANTHROPIC_API_KEY=<key>

### Frontend (.env on Vercel)

    NEXT_PUBLIC_API_URL=https://nebuladen.duckdns.org
    NEXT_PUBLIC_WS_URL=wss://nebuladen.duckdns.org

---

## Free Tier Limits (AWS)

| Resource | Limit | Current Usage |
|----------|-------|---------------|
| EC2 t3.micro | 750 hrs/month | ~720 hrs |
| EBS Storage | 30 GB | 8 GB |
| S3 Storage | 5 GB | Minimal |
| Data Transfer | 100 GB/month | Minimal |
