# NebulaDen 🌌

> Your agent. Its own computer.

NebulaDen is an AI agent platform where every user gets a personal AI agent ("Nebula") backed by a real AWS cloud machine. Chat with your agent, give it tasks, and watch it execute — all in real time.

## Live Demo
- **Frontend:** https://nebuladen.vercel.app
- **Backend:** https://nebuladen.duckdns.org

## Features
- 🤖 Personal AI agent powered by Claude (Anthropic)
- ☁️ Real AWS EC2 cloud compute per agent
- 💬 Real-time chat via WebSockets
- 🖥️ Shell command execution on cloud machine
- 🔐 JWT-based authentication
- 🚀 CI/CD pipeline via GitHub Actions

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js, Tailwind CSS |
| Backend | Node.js, Express, WebSockets |
| AI | Anthropic Claude API |
| Infrastructure | AWS EC2, Elastic IP |
| Auth | JWT, bcryptjs |
| Deployment | Vercel (frontend), PM2 + EC2 (backend) |
| CI/CD | GitHub Actions |

## Architecture

```
┌─────────────┐     HTTPS      ┌──────────────────────────────────────┐
│ User browser│ ─────────────► │           Vercel (Next.js)           │
└─────────────┘                └──────────────┬───────────────────────┘
                                              │ WSS + HTTPS
                                              ▼
                               ┌──────────────────────────────────────┐
                               │         AWS EC2 t3.micro             │
                               │  ┌────────────────────────────────┐  │
                               │  │     Nginx (SSL termination)    │  │
                               │  └───────────────┬────────────────┘  │
                               │                  │                   │
                               │  ┌───────────────▼────────────────┐  │
                               │  │   Express (API + WebSocket)    │  │
                               │  └───────┬───────────────┬────────┘  │
                               │          │               │           │
                               │  ┌───────▼──────┐ ┌─────▼────────┐   │
                               │  │  Claude API  │ │    Shell     │   │
                               │  │  (Anthropic) │ │ child_process│   │
                               │  └──────────────┘ └──────────────┘   │
                               │                                      │
                               │  PM2 · CloudWatch · Winston logs     │
                               └──────────────────────────────────────┘
                                              ▲
                               ┌──────────────┴───────────────────────┐
                               │     GitHub Actions (CI/CD)           │
                               │   push → pull → install → restart    │
                               └──────────────────────────────────────┘
```

## Local Development

### Prerequisites
- Node.js 18+
- AWS account
- Anthropic API key

### Frontend
```bash
cd frontend
npm install
npm run dev
```

### Backend
```bash
cd backend
npm install
npm run dev
```

### Environment Variables

**frontend/.env.local**
```
NEXT_PUBLIC_API_URL=http://localhost:4000
NEXT_PUBLIC_WS_URL=ws://localhost:4000
```

**backend/.env**
```
PORT=4000
JWT_SECRET=your-secret-key
ANTHROPIC_API_KEY=your-anthropic-api-key
```

## Deployment
- Frontend: Deployed on Vercel
- Backend: Deployed on AWS EC2 with PM2
- CI/CD: GitHub Actions auto-deploys on push to main

## Built for SkyKoi Senior Platform Engineer Interview
This project was built in one week as part of the SkyKoi hiring process.
