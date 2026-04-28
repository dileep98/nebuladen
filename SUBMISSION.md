# NebulaDen — Submission Document

## Overview
NebulaDen is an AI agent platform where each user gets a personal AI agent ("Nebula") backed by a real AWS cloud machine. Users interact with their agent through a web chat interface in real time. The agent can answer questions, write code, and execute shell commands on its cloud instance.

---

## Architecture & Design Decisions

### Frontend
- **Next.js (App Router)** — chosen for its file-based routing, fast rendering, and seamless Vercel deployment
- **Tailwind CSS** — utility-first styling for rapid UI development
- **WebSockets** — real-time bidirectional communication between the browser and the agent
- Pages: Landing, Login, Signup, Dashboard, Chat

### Backend
- **Node.js + Express** — lightweight, fast HTTP server
- **ws (WebSocket library)** — handles persistent agent connections per user
- **JWT authentication** — stateless auth with 7-day token expiry
- **bcryptjs** — secure password hashing
- **In-memory user store** — chosen for speed during MVP; production would use DynamoDB

### Agent System
- Each user gets a dedicated WebSocket session
- Messages are sent to **Claude (claude-sonnet-4-6)** as the agent brain via Anthropic SDK
- Shell commands (prefixed with `$`) are executed directly on the EC2 instance using Node's `child_process`
- Dangerous commands are blocked via a blocklist
- Conversation history is maintained per session for context

### AWS Infrastructure
- **EC2 t3.micro** (free-tier eligible) running Ubuntu 22.04 in us-east-1
- **Elastic IP** — fixed public IP (50.17.232.178) so the address never changes on restart
- **Security Group** — ports 22 (SSH), 80 (HTTP), 443 (HTTPS), 4000 (backend) open
- **PM2** — process manager keeping the backend alive and auto-restarting on crash or reboot

### CI/CD Pipeline
- **GitHub Actions** — on every push to `main`, automatically SSHs into EC2 and runs `git pull + npm install + pm2 restart`
- Zero-downtime deployments from local machine to production

---

## Strategy & Approach

### Week Plan
- Day 1: Research, AWS setup, project scaffolding
- Day 2: Frontend pages (landing, auth, dashboard, chat)
- Day 3: Backend (Express server, JWT auth, WebSocket layer)
- Day 4: Agent system (Claude integration, shell execution)
- Day 5: AWS infrastructure (EC2, Elastic IP, security groups)
- Day 6: CI/CD pipeline, deployment, frontend hosting
- Day 7: Polish, write-up, submission

### Prioritization
Focused on: working auth → real-time chat → actual shell execution → live deployment.
Deprioritized: voice calls, multi-channel support, enterprise features.

---

## Tools & Services Used
- **Next.js** — frontend framework
- **Node.js + Express** — backend server
- **WebSockets (ws)** — real-time agent communication
- **Anthropic Claude API** — agent intelligence (claude-sonnet-4-6)
- **AWS EC2** — cloud compute for agent execution
- **AWS Elastic IP** — static IP for the backend
- **PM2** — Node.js process manager
- **GitHub Actions** — CI/CD pipeline
- **Vercel** — frontend hosting
- **JWT + bcryptjs** — authentication

---

## What I Reverse-Engineered vs Inferred

### Reverse-Engineered
- Core concept from tagline: "Your Own Koi With Its Own Computer" → each user gets an agent + dedicated compute
- Dashboard structure: Overview (fleet stats), Devices (machine connection), Koi (agent list)
- Agent UX: personalized greeting, execution modes (queue/immediate), response types (smart/fast)
- Encrypted terminal connection for device linking

### Inferred
- WebSocket-based real-time communication (standard for chat interfaces)
- JWT-based authentication (industry standard)
- EC2-backed compute per agent (confirmed by their security diagram showing t3.large per Koi)

---

## Key Challenges & Solutions

| Challenge | Solution |
|-----------|----------|
| Node.js version conflict on EC2 | Manually removed conflicting libnode72 package, installed Node 18 via NodeSource |
| Frontend as Git submodule | Removed nested .git folder, re-added frontend as regular directory |
| uuid ESM compatibility | Replaced with Node's built-in crypto.randomUUID |
| Free-tier instance type | Used t3.micro instead of t2.micro (region-specific availability) |
| Slow SCP file transfer | Switched to GitHub clone on EC2 — instant |

---

## What Was Straightforward
- Next.js page routing and Tailwind styling
- Express server and JWT auth setup
- WebSocket connection between frontend and backend
- AWS security group configuration
- PM2 process management

## What Was Difficult
- Node.js version conflicts on EC2 (conflicting system packages)
- Git submodule issue with nested repositories
- Ensuring WebSocket upgrades work correctly alongside HTTP routes

---

## Assumptions Made
- One agent per user (matches SkyKoi's model)
- In-memory storage is acceptable for MVP (no persistence between server restarts)
- Free-tier EC2 is sufficient to demonstrate the architecture
- Shell execution on the backend server simulates "agent running on cloud compute"

---

## Deviations & Improvements

### Deviations from SkyKoi
- Used t3.micro instead of t3.large (free-tier constraint)
- No voice call support (out of scope for one week)
- No multi-channel support (WhatsApp, Slack, etc.)
- Single shared EC2 instead of one per user (free-tier constraint — Docker containers would be used in production)

### Improvements Over SkyKoi
- **CI/CD pipeline** — automatic deployment on every GitHub push
- **Simpler onboarding** — no early access gate, instant signup
- **Developer-friendly** — clean codebase with clear separation of concerns
- **Open architecture** — easy to extend with new agent capabilities

---

## Live Links
- **Frontend:** https://nebuladen.vercel.app
- **Backend:** https://nebuladen.duckdns.org
- **Repository:** https://github.com/dileep98/nebuladen
