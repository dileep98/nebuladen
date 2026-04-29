# NebulaDen 🌌

> Your agent. Its own computer.

NebulaDen is an AI agent platform where every user gets a personal AI agent ("Nebula") backed by a real AWS cloud machine. Chat with your agent, give it tasks, and watch it execute — all in real time.

![CI/CD](https://github.com/dileep98/nebuladen/actions/workflows/deploy.yml/badge.svg)

## Live Demo
- **Frontend:** https://nebuladen.vercel.app
- **Backend:** https://nebuladen.duckdns.org
- **Health:** https://nebuladen.duckdns.org/health
- **Metrics:** https://nebuladen.duckdns.org/metrics

## Features
- 🤖 Personal AI agent powered by Claude (Anthropic)
- ☁️ Real AWS EC2 cloud compute backing every agent
- 💬 Real-time chat via WebSockets over HTTPS/WSS
- 🖥️ Shell command execution on cloud machine
- 📊 Live system metrics dashboard (CPU, RAM, Disk, Network)
- 🔐 JWT-based authentication with bcrypt password hashing
- 🚀 Full CI/CD pipeline — test, audit, deploy, smoke test
- 🛡️ Rate limiting, security headers, command sandboxing
- 💾 Automated S3 backups every 6 hours with versioning
- 📋 PM2 log rotation — 10MB max, 7 days retention

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 16, Tailwind CSS, react-markdown |
| Backend | Node.js, Express, WebSockets |
| AI | Anthropic Claude API (claude-sonnet-4-6) |
| Infrastructure | AWS EC2 t3.micro, Elastic IP, S3, IAM |
| Proxy | Nginx with SSL termination |
| Auth | JWT, bcryptjs |
| Logging | Winston (structured JSON) |
| Monitoring | CloudWatch, UptimeRobot, SNS alerts |
| Deployment | Vercel (frontend), PM2 + EC2 (backend) |
| CI/CD | GitHub Actions (test → deploy → smoke test) |
| IaC | Terraform |
| Testing | Jest + Supertest (98% coverage) |

## Architecture

    User Browser
        ↓ (HTTPS)
    Vercel (Next.js frontend)
        ↓ (WSS + HTTPS)
    Nginx (SSL termination) on EC2 t3.micro
        ↓
    Express (API + WebSocket server)
        ├── Claude API (Anthropic) — agent intelligence
        └── child_process — shell execution on EC2
        ↓
    PM2 (process management + log rotation)
        ↓
    S3 (db.json backups every 6h)

    GitHub Actions: push → test (98% coverage) → npm audit → build → deploy → smoke test

## CI/CD Pipeline

Every push to main triggers 3 jobs in sequence:

    test job
        ├── Backend unit + integration tests (98% coverage)
        ├── npm security audit
        └── Next.js frontend build verification
    deploy job
        ├── SSH into EC2
        ├── git pull + npm install
        ├── pm2 restart
        └── Health check verification (blocks if unhealthy)
    smoke-test job
        ├── Live health check
        ├── Live metrics check
        └── Live frontend check

## Local Development

### Prerequisites
- Node.js 20+
- AWS account
- Anthropic API key

### Frontend

    cd frontend
    npm install
    npm run dev

### Backend

    cd backend
    npm install
    npm run dev

### Run Tests

    cd backend
    npm test

### Run Tests with Coverage

    cd backend
    npm run test:coverage

### Environment Variables

frontend/.env.local

    NEXT_PUBLIC_API_URL=http://localhost:4000
    NEXT_PUBLIC_WS_URL=ws://localhost:4000

backend/.env

    PORT=4000
    JWT_SECRET=your-secret-key
    ANTHROPIC_API_KEY=your-anthropic-api-key

## Monitoring & Observability

- **UptimeRobot** — monitors frontend and backend every 5 minutes
- **CloudWatch** — CPU alarm (>80%) and EC2 status check alarm
- **SNS** — email alerts for all CloudWatch alarms
- **Winston** — structured JSON logs with timestamp and metadata
- **/metrics endpoint** — real-time CPU, RAM, disk, network, active sessions
- **PM2 log rotation** — 10MB max file size, 7 days retention, compressed

## Backup & Recovery

- db.json backed up to S3 every 6 hours via cron job
- S3 versioning enabled for point-in-time recovery
- Restore procedure documented in RUNBOOK.md

## Documentation
- [SUBMISSION.md](./SUBMISSION.md) — architecture decisions, challenges, approach
- [RUNBOOK.md](./RUNBOOK.md) — operational procedures and incident response
- [terraform/main.tf](./terraform/main.tf) — full infrastructure as code
- [GUARDRAILS.md](./GUARDRAILS.md) | Safety measures, blocked commands, responsible AI use |

## Built for SkyKoi Senior Platform Engineer Assessment
This project was built as part of the SkyKoi hiring process — a one-week take-home assessment to build an original AI agent platform with real cloud compute backing.
