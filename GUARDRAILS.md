# NebulaDen — Guardrails & Safety Documentation

This document describes the safety measures, restrictions, and responsible AI practices implemented in NebulaDen.

---

## Overview

NebulaDen gives users access to a real Linux terminal via an AI agent. This creates real security risks that must be carefully managed. This document outlines every guardrail implemented to protect users, the system, and third parties.

---

## 1. Shell Command Execution Guardrails

### Blocked Commands
The following commands are blocked outright regardless of context:

| Category | Blocked Commands |
|----------|-----------------|
| Privilege escalation | sudo, sudo su, sudo -i, su root |
| Destructive | rm -rf /, rm -rf ~, mkfs, dd if= |
| Fork bombs | while true, for(;;) |
| Sensitive files | db.json, activity.json, .env |
| Workspace escape | ../nebuladen, /home/ubuntu/nebuladen |
| Network abuse | curl pipe bash, wget pipe bash |
| Netcat listeners | nc -l |

### Blocked Patterns (Regex)
Pattern-based blocking catches obfuscated variants:

- rm -rf / or rm -rf ~ — destructive recursive delete
- Writing to disk devices — > /dev/sd*
- Remote code execution — curl/wget piped to bash
- Python shell escape — python -c "import os; os.system(...)"
- Accessing NebulaDen backend — /home/ubuntu/nebuladen

### Execution Limits
- Timeout: 10 seconds per command — prevents infinite loops
- Output buffer: 512KB max — prevents memory exhaustion
- Output truncation: 3000 characters displayed — prevents UI flooding

---

## 2. User Isolation

### Workspace Isolation
Each user gets their own isolated workspace directory:

    /home/ubuntu/workspace/<user-id>/

- Users can only read/write within their own workspace
- Commands run with cwd set to the user's workspace
- HOME environment variable points to workspace, not system home
- Users cannot navigate to /home/ubuntu/nebuladen (blocked)

### Session Isolation
- Each user gets a dedicated WebSocket session
- Conversation history is isolated per user
- No cross-user data access

### What Users Cannot Do
- Access other users' workspaces
- Read NebulaDen backend files (db.json, .env, agent.js, etc.)
- Escalate privileges (sudo blocked)
- Access system-critical directories (/proc, /sys blocked)
- Affect other users' sessions

---

## 3. API Rate Limiting

### HTTP Rate Limits
| Endpoint | Limit | Window |
|----------|-------|--------|
| All endpoints | 100 requests | 15 minutes |
| Auth endpoints | 10 requests | 15 minutes |

### Agent Rate Limits
| Limit | Value |
|-------|-------|
| Daily message limit | 50 messages per user |
| Message cooldown | 3 seconds between messages |
| Max message length | 2000 characters |

These limits prevent:
- API cost abuse (Claude API is pay-per-use)
- Brute force authentication attacks
- DoS via shell command flooding

---

## 4. Authentication & Data Security

### Password Security
- Passwords hashed with bcrypt (cost factor 10)
- Salt automatically generated per password
- Plaintext passwords never stored or logged

### Token Security
- JWT tokens with 7-day expiry
- Signed with server-side secret key
- WebSocket connections validated with JWT before accepting

### Input Validation
- Email format validated with regex on frontend and backend
- Email normalized to lowercase before storage (prevents duplicate accounts)
- Name: max 100 characters
- Email: max 254 characters (RFC 5321 limit)
- Password: min 8 characters, max 128 characters
- Password cannot be whitespace only

### HTTP Security Headers (Helmet.js)
- X-Content-Type-Options: nosniff
- X-Frame-Options: SAMEORIGIN
- X-XSS-Protection: 1; mode=block
- Strict-Transport-Security (HSTS)
- Content-Security-Policy

---

## 5. AI Agent Guardrails

### System Prompt Restrictions
The agent's system prompt explicitly instructs Claude to:
- Never reveal contents of db.json, .env, or activity.json
- Never execute commands outside the user's workspace
- Always use $ prefix for real command execution
- Refuse requests to access NebulaDen backend code

### Model Used
- Default: claude-sonnet-4-6 — capable and cost-efficient
- Fast mode: claude-haiku-4-5-20251001 — for simple queries

### Conversation History Limit
- Maximum 20 messages kept in context per session
- Older messages automatically pruned
- Prevents context window abuse and cost escalation

---

## 6. Infrastructure Security

### Network Security
- All traffic over HTTPS (Let's Encrypt SSL)
- WebSocket connections over WSS (encrypted)
- Security Group restricts inbound ports to 22, 80, 443, 4000 only

### SSH Access
- Key-based authentication only (password auth disabled)
- Private key rotated after accidental exposure
- Key stored securely, never committed to Git

### Secrets Management
- All secrets in .env file (never committed to Git)
- .env in .gitignore
- GitHub Actions secrets used for CI/CD credentials

---

## 7. Monitoring & Incident Response

### What We Monitor
- Backend uptime (UptimeRobot every 5 minutes)
- Frontend uptime (UptimeRobot every 5 minutes)
- EC2 CPU usage (CloudWatch alert at 80%)
- EC2 status checks (CloudWatch alert on failure)

### Alerting
- All alerts delivered via AWS SNS to email
- Response procedures documented in RUNBOOK.md

### Logging
- All HTTP requests logged with Winston (structured JSON)
- All WebSocket connections and disconnections logged
- All blocked shell commands logged with warn severity
- All errors logged with full stack traces

---

## 8. Known Limitations & Future Improvements

### Current Limitations
| Limitation | Impact | Production Fix |
|------------|--------|----------------|
| Shared EC2 instance | Users share compute | Docker containers per user |
| File-based user storage | No encryption at rest | DynamoDB with encryption |
| No container isolation | Workspace escape theoretically possible | Docker with seccomp profiles |
| No network egress filtering | Users can make arbitrary HTTP requests | VPC with egress rules |

### Planned Production Improvements
- Docker containers — complete filesystem isolation per user
- seccomp profiles — kernel-level syscall filtering
- DynamoDB — encrypted, scalable user storage
- VPC egress filtering — control what external services agents can reach
- Audit logging — immutable log of every command executed per user

---

## 9. Responsible AI Use

### What NebulaDen Is Designed For
- Personal productivity and automation
- Learning and experimentation with Linux and cloud
- Code writing, debugging, and execution
- File management and data processing

### What NebulaDen Is Not Designed For
- Attacking or scanning other systems
- Mining cryptocurrency
- Storing or processing sensitive personal data
- Automated spam or abuse

### User Responsibility
Users are responsible for:
- Commands they execute in their workspace
- Content they ask the agent to generate
- External services they connect to via the agent

---

## 10. Security Contact

If you discover a security vulnerability in NebulaDen, please report it to:
dtutika1998@outlook.com

Please include:
- Description of the vulnerability
- Steps to reproduce
- Potential impact
