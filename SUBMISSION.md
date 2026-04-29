# NebulaDen — Submission Document

## Overview
NebulaDen is an AI agent platform where each user gets a personal AI agent ("Nebula") backed by a real AWS cloud machine. Users interact with their agent through a real-time web chat interface. The agent can answer questions, write code, and execute shell commands directly on its EC2 instance — demonstrating the core architecture of an agent-backed compute system.

---

## Architecture & Design Decisions

### Frontend
- **Next.js (App Router)** — chosen for file-based routing, fast rendering, and seamless Vercel deployment
- **Tailwind CSS** — utility-first styling for rapid UI development
- **WebSockets** — real-time bidirectional communication between the browser and the agent
- **react-markdown + remark-gfm** — renders agent responses as formatted markdown including tables, code blocks, and lists
- Pages: Landing, Login, Signup, Dashboard, Chat

### Backend
- **Node.js + Express** — lightweight, fast HTTP server
- **ws (WebSocket library)** — handles persistent agent connections per user
- **JWT authentication** — stateless auth with 7-day token expiry
- **bcryptjs** — secure password hashing with auto-generated salt
- **File-based user store (db.json)** — chosen for simplicity in MVP; production would use DynamoDB with per-user isolation

### Agent System
- Each user gets a dedicated WebSocket session with maintained conversation history
- Messages are processed by **Claude (claude-sonnet-4-6)** as the agent brain via Anthropic SDK
- Shell commands (prefixed with $) are executed directly on the EC2 instance using Node's child_process
- Dangerous commands are blocked via a pattern-based blocklist with regex matching
- Output is capped at 512KB and truncated at 3000 characters to prevent abuse
- Daily message limit (50/day) and 3-second cooldown prevent API abuse

### AWS Infrastructure
- **EC2 t3.micro** (free-tier eligible) running Ubuntu 22.04 in us-east-1
- **Elastic IP** — fixed public IP so the address never changes on restart
- **Nginx** — reverse proxy handling SSL termination and WebSocket upgrade routing
- **Let's Encrypt SSL** — free HTTPS certificate with auto-renewal via Certbot
- **Security Group** — ports 22 (SSH), 80 (HTTP), 443 (HTTPS), 4000 (backend) open
- **PM2** — process manager keeping the backend alive and auto-restarting on crash or reboot
- **IAM Role** — EC2 instance has S3 write access for automated backups
- **S3 Bucket** — db.json backed up every 6 hours with versioning enabled

### CI/CD Pipeline
- **GitHub Actions** — on every push to main, runs tests, security audit, deploys to EC2, verifies health
- **Health check verification** — pipeline fails and alerts if backend does not return 200 after deploy
- Zero manual steps from code push to production

---

## Execution Timeline

Completed in approximately 3 days of focused work:

- **Day 1:** Research and reverse engineering SkyKoi, AWS account setup, EC2 provisioning, security groups, Elastic IP, project scaffolding, frontend pages (landing, auth, dashboard, chat)
- **Day 2:** Backend (Express, JWT auth, WebSocket layer), agent system (Claude integration, shell execution), EC2 deployment, Nginx SSL configuration, CI/CD pipeline via GitHub Actions
- **Day 3:** SRE hardening — structured logging (Winston), CloudWatch alarms, UptimeRobot monitoring, Helmet.js security headers, shell command sandboxing, automated tests (98% coverage), S3 backups, PM2 log rotation, Terraform IaC, Markdown rendering, operational documentation (RUNBOOK.md)

Finishing the core product early allowed extra time for SRE hardening that demonstrates production-readiness beyond the basic requirements.

---

## Prioritization

Focused on: working auth → real-time agent chat → actual shell execution on EC2 → HTTPS deployment → SRE observability.

Deliberately deferred: voice calls, multi-channel integrations (WhatsApp/Slack), per-user EC2 isolation — these add operational complexity without demonstrating the core architecture more clearly.

---

## Tools & Services Used

- **Next.js** — frontend framework
- **Node.js + Express** — backend server
- **WebSockets (ws)** — real-time agent communication
- **Anthropic Claude API** — agent intelligence (claude-sonnet-4-6)
- **AWS EC2** — cloud compute for agent execution
- **AWS Elastic IP** — static IP for the backend
- **AWS CloudWatch** — CPU and status check alarms
- **AWS SNS** — alert notifications via email
- **AWS S3** — automated db.json backups every 6 hours with versioning
- **AWS IAM** — EC2 instance role for S3 access
- **Nginx** — reverse proxy and SSL termination
- **Let's Encrypt + Certbot** — free SSL certificate with auto-renewal
- **PM2** — Node.js process manager with log rotation
- **GitHub Actions** — CI/CD pipeline with tests, security audit, and health check verification
- **Vercel** — frontend hosting
- **JWT + bcryptjs** — authentication
- **Winston** — structured JSON logging
- **Helmet.js** — HTTP security headers
- **UptimeRobot** — uptime monitoring for frontend and backend
- **Terraform** — infrastructure as code (documents the full AWS setup reproducibly)
- **DuckDNS** — free subdomain for SSL certificate
- **react-markdown + remark-gfm** — markdown rendering in chat
- **Jest + Supertest** — automated testing (98% code coverage)

---

## What I Reverse-Engineered vs Inferred

### Reverse-Engineered
- Core concept from tagline: "Your Own Koi With Its Own Computer" — each user gets an agent backed by dedicated compute
- Dashboard structure: Overview (fleet stats with RAM/CPU/disk graphs), Devices (machine connection via encrypted terminal command), Koi (agent list with status and plan badge)
- Agent UX: personalized greeting with time of day, execution modes (queue/immediate), response types (smart/fast mapping to different models)
- Encrypted terminal payload for device linking (AES-256 shown in UI)
- EC2-per-user isolation model (confirmed by security diagram showing separate VPCs per Koi)

### Inferred
- WebSocket-based real-time communication (standard for chat interfaces)
- JWT-based authentication (industry standard)
- Claude as the underlying model (confirmed by features page listing Claude Opus 4.6)
- Nginx as reverse proxy for SSL termination (standard pattern for Node.js on EC2)

---

## Key Challenges & Solutions

| Challenge | Solution |
|-----------|----------|
| Node.js version conflict on EC2 | Manually removed conflicting libnode72 package, installed Node 18 via NodeSource |
| Frontend initialised as Git submodule | Removed nested .git folder, force re-added frontend as regular directory |
| uuid ESM incompatibility | Replaced with Node's built-in crypto.randomUUID |
| Free-tier instance type mismatch | Used t3.micro instead of t2.micro (region-specific free tier availability) |
| WebSocket disconnecting through Nginx over SSL | Added connection upgrade map in nginx.conf and dedicated /ws location block with proxy_read_timeout 3600 |
| Exposed SSH private key in Git history | Rotated key pair, removed from GitHub, updated EC2 authorized_keys and GitHub Actions secret |
| EC2 manual edits conflicting with CI/CD | Established rule: all changes go through GitHub, never edit directly on EC2 |

---

## What Was Straightforward
- Next.js page routing and Tailwind styling
- Express server and JWT auth setup
- WebSocket connection between frontend and backend locally
- AWS security group configuration via CLI
- PM2 process management and startup scripts
- Let's Encrypt SSL certificate issuance

## What Was Difficult
- Node.js version conflicts on EC2 due to conflicting system packages
- WebSocket upgrade routing through Nginx over SSL (1006 close code debugging)
- Git submodule issue caused by nested repository initialisation
- Ensuring CI/CD pipeline stays in sync when EC2 has manual changes

---

## Assumptions Made
- One agent per user is the right starting model (matches SkyKoi's architecture)
- File-based storage is acceptable for MVP — clear migration path to DynamoDB documented
- Free-tier EC2 is sufficient to demonstrate the agent-compute architecture
- Shell execution running on the backend EC2 instance satisfies the "agent backed by cloud compute" requirement
- Docker container isolation per user would be the production approach for multi-tenancy on shared EC2

---

## Engineering Tradeoffs

### Single EC2 vs Per-User EC2
SkyKoi runs a dedicated t3.large per Koi. On free tier, running one EC2 per user is not feasible. Instead, each user gets a dedicated WebSocket session with isolated conversation history. In production, Docker containers would provide the same process isolation at lower cost than separate EC2 instances.

### File-based Storage vs DynamoDB
db.json is simple and sufficient for MVP. It persists across restarts, is backed up to S3 every 6 hours, and requires zero AWS configuration. The migration path to DynamoDB is straightforward — replace the read/write functions in routes/auth.js with AWS SDK calls. This was a deliberate choice to keep the infrastructure simple while demonstrating the agent architecture.

### claude-sonnet-4-6 vs claude-opus-4-6
Sonnet is used by default (fast mode uses Haiku). Opus would give better reasoning but at higher cost and latency. The model is configurable per-request — a production system would route to Opus for complex tasks automatically.

---

## Improvements Over SkyKoi

- **CI/CD pipeline with health verification** — auto-deploys on every push and fails the pipeline if the backend does not respond
- **Automated test suite** — 98% code coverage with Jest and Supertest, runs on every push
- **npm security audit** — blocks deploys on high/critical vulnerabilities
- **SRE observability** — structured JSON logging, real-time metrics endpoint, CloudWatch alarms, UptimeRobot monitoring
- **Data resilience** — automated S3 backups every 6 hours with versioning and restore procedures
- **PM2 log rotation** — prevents disk filling up in production
- **Simpler onboarding** — no early access gate or waitlist, instant signup
- **Infrastructure as Code** — full Terraform definition of all AWS resources for reproducible deployments
- **Operational runbook** — documented incident response procedures

---

## SRE Practices Implemented

### Observability
- Structured JSON logging with Winston — every request, WebSocket event, and error is logged with timestamp, metadata and severity
- Real-time system metrics endpoint (/metrics) — CPU, RAM, disk, network I/O, active sessions
- Live dashboard showing agent resource usage with progress bars

### Monitoring & Alerting
- UptimeRobot monitors frontend and backend every 5 minutes
- CloudWatch alarm triggers when EC2 CPU exceeds 80%
- CloudWatch status check alarm triggers if EC2 instance fails
- All alerts delivered via AWS SNS to email

### Reliability
- PM2 process manager with auto-restart on crash
- PM2 startup script ensures backend survives EC2 reboots
- Graceful shutdown handles SIGTERM properly
- Health check verification in CI/CD pipeline — deploy fails if backend does not respond
- PM2 log rotation — 10MB max, 7 days retention, compressed

### Security
- Helmet.js security headers on all HTTP responses
- Rate limiting on all endpoints (100 req/15min global, 10 req/15min on auth)
- JWT authentication with 7-day expiry
- bcrypt password hashing with auto-generated salt
- Shell command blocklist with regex pattern matching prevents dangerous operations
- Daily message limit (50/day) prevents API abuse
- SSH key rotation after accidental exposure
- npm audit in CI blocks deploys on high/critical vulnerabilities

### Data Resilience
- db.json backed up to S3 every 6 hours via cron job
- S3 bucket versioning enabled for point-in-time recovery
- Restore procedure documented in RUNBOOK.md

### Testing
- 15 automated tests across auth, middleware, and health check
- 98% code coverage (statements, branches, functions, lines)
- Tests run in CI before every deploy
- Deploy blocked if any test fails

### Operational Documentation
- RUNBOOK.md with incident response procedures for all common failure scenarios
- Architecture documentation in SUBMISSION.md
- CI/CD pipeline with automatic health verification

---

## Live Links
- **Frontend:** https://nebuladen.vercel.app
- **Backend:** https://nebuladen.duckdns.org
- **Repository:** https://github.com/dileep98/nebuladen
- **Health check:** https://nebuladen.duckdns.org/health
- **Metrics:** https://nebuladen.duckdns.org/metrics
