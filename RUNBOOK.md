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
    Expected: {"cpu":0,"memory":{...},"disk":{...},...}

---

## SSH Access

    ssh -i nebuladen-key.pem ubuntu@50.17.232.178

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

### Deploy latest code manually

    cd ~/nebuladen
    git pull origin main
    cd backend
    npm install
    pm2 restart nebuladen-backend

### Check PM2 process status

    pm2 status

### Check Nginx status

    sudo systemctl status nginx

### Restart Nginx

    sudo systemctl restart nginx

---

## Backup & Recovery

### Database Backup
- db.json is automatically backed up to S3 every 6 hours
- Bucket: s3://nebuladen-backups-639163294452/db-backups/
- S3 versioning enabled for additional protection

### List available backups
    aws s3 ls s3://nebuladen-backups-639163294452/db-backups/

### Restore from backup
    aws s3 cp s3://nebuladen-backups-639163294452/db-backups/db_YYYY-MM-DD_HH-MM-SS.json ~/nebuladen/backend/db.json
    pm2 restart nebuladen-backend

---

## Deployment Pipeline

Every push to main branch triggers:
1. GitHub Actions SSH into EC2
2. git pull origin main
3. npm install
4. pm2 restart nebuladen-backend
5. Health check verification

---

## Monitoring & Alerts

| Monitor | Tool | Alert |
|---------|------|-------|
| Frontend uptime | UptimeRobot | Email when down |
| Backend uptime | UptimeRobot | Email when down |
| EC2 CPU > 80% | CloudWatch | Email via SNS |
| EC2 status check | CloudWatch | Email via SNS |

---

## Incident Response

### Backend is down
1. Check UptimeRobot alert email
2. SSH into EC2
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

### SSL certificate expiry
Certificate auto-renews via Certbot. To manually renew:

    sudo certbot renew
    sudo systemctl restart nginx

Certificate expires: 2026-07-26

---

## Architecture

    User → Vercel (Next.js) → EC2 t3.micro (Express + WebSocket) → Claude API
                                        ↓
                                  Nginx (SSL termination)
                                        ↓
                                  PM2 (process management)

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
| Data Transfer | 100 GB/month | Minimal |
