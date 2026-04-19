# YummyCode — Internal AI Coding Agent
## Complete Self-Hosting, Customisation & Workshop Guide
> Based on `sst/opencode` (MIT License) · Rebranded for [Your Company]
> Repository target: `github.com/lamhoangcatvy/yummy`

---

## Table of Contents
1. [What YummyCode Is](#1-what-yummycode-is)
2. [Architecture Overview](#2-architecture-overview)
3. [Phase 0 — Prerequisites](#3-phase-0--prerequisites)
4. [Phase 1 — Fork & Rebrand as YummyCode](#4-phase-1--fork--rebrand-as-yummycode)
5. [Phase 2 — Configure for Yummy Project](#5-phase-2--configure-for-yummy-project)
6. [Phase 3 — Build Your Custom Binary](#6-phase-3--build-your-custom-binary)
7. [Phase 4 — Run Locally (Your PC First)](#7-phase-4--run-locally-your-pc-first)
8. [Phase 5 — Company-Wide Deployment](#8-phase-5--company-wide-deployment)
9. [Security Concerns for IT-SEC](#9-security-concerns-for-it-sec)
10. [Workshop Agenda](#10-workshop-agenda)

---

## 1. What YummyCode Is

YummyCode is your **company-branded fork** of OpenCode (`sst/opencode`), an MIT-licensed
open-source AI coding agent. It runs as a local server (Node.js/Bun) and exposes a TUI
(terminal interface) and a web interface — both staying **entirely within your company network**.

Key capabilities for your Yummy team:
- Understands the full `lamhoangcatvy/yummy` codebase via MCP GitHub integration
- Generates, refactors, and reviews code in your stack
- Runs shell commands, reads files, and creates PRs — with dev approval at each step
- Works with local AI models (zero data leaves your perimeter) OR with proxied cloud APIs
- Fully auditable: every session stored in local SQLite

---

## 2. Architecture Overview

```
[ Developer workstation ]
        │
  ┌─────▼──────────────────────────────────┐
  │           COMPANY PERIMETER            │
  │                                        │
  │   YummyCode Server (Bun/Node)          │
  │   ├── TUI client  (terminal)           │
  │   ├── Web client  (browser :4096)      │
  │   ├── MCP: GitHub server               │  ──HTTPS/PAT──▶ github.com/lamhoangcatvy/yummy
  │   ├── MCP: filesystem server           │
  │   └── Session DB  (~/.yummycode/)      │
  │                                        │
  │   AI Model Layer                       │
  │   ├── Option A: Ollama (local, 0 egress)│
  │   └── Option B: Cloud API via proxy    │──egress proxy──▶ api.anthropic.com / openai
  └────────────────────────────────────────┘
```

**Option A (recommended for IT-SEC):** Run `ollama` with `qwen2.5-coder:32b` or `devstral` locally.
Zero code leaves the network. Requires a machine with ≥32 GB RAM or a GPU workstation.

**Option B:** Use Anthropic Claude or OpenAI via a company egress proxy. Code prompts leave
the perimeter but are covered by API DPA agreements.

---

## 3. Phase 0 — Prerequisites

Install the following on your local PC (Windows 11 / macOS / Ubuntu 24 all work):

### 3.1 Required tools

```bash
# 1. Install Bun (JavaScript runtime — replaces Node for build)
curl -fsSL https://bun.sh/install | bash
# Windows: powershell -c "irm bun.sh/install.ps1 | iex"
bun --version  # must be ≥ 1.1

# 2. Install Node.js 20+ (some tooling still requires it)
# https://nodejs.org/en/download — use the LTS installer

# 3. Install Git
git --version

# 4. Install Go 1.22+ (only needed if you want to inspect the old archived Go fork)
# Skip if you only use the TypeScript/Bun version (sst/opencode)

# 5. (Option A) Install Ollama for local AI
curl -fsSL https://ollama.ai/install.sh | sh
# Windows: https://ollama.ai/download/windows
```

### 3.2 AI model for local use (Option A)

```bash
# Pull a powerful coding model (~20 GB download)
ollama pull qwen2.5-coder:32b

# Or a lighter model for testing (~5 GB)
ollama pull qwen2.5-coder:7b

# Start Ollama server (runs on :11434)
ollama serve
```

### 3.3 GitHub Personal Access Token

1. Go to https://github.com/settings/tokens → **Fine-grained tokens**
2. Repository access: `lamhoangcatvy/yummy` only
3. Permissions: `Contents: Read`, `Issues: Read/Write`, `Pull requests: Read/Write`
4. Copy the token — you'll use it in Phase 2

---

## 4. Phase 1 — Fork & Rebrand as YummyCode

### 4.1 Fork the repository

```bash
# Fork sst/opencode on GitHub under your company org, then:
git clone https://github.com/YOUR_ORG/yummycode.git
cd yummycode
```

Or clone directly and set your own remote:
```bash
git clone https://github.com/sst/opencode.git yummycode
cd yummycode
git remote set-url origin https://github.com/YOUR_ORG/yummycode.git
git remote add upstream https://github.com/sst/opencode.git
```

### 4.2 Global rebrand — rename "opencode" → "yummycode"

Run this script from the repo root. It renames the binary name, config directory,
and display strings. It does NOT touch MIT license headers (preserve those).

```bash
# Save as scripts/rebrand.sh and run once
#!/usr/bin/env bash
set -e

OLD="opencode"
NEW="yummycode"
OLD_DISPLAY="OpenCode"
NEW_DISPLAY="YummyCode"

echo "Rebranding $OLD_DISPLAY → $NEW_DISPLAY ..."

# Rename in all TypeScript/JSON/config files (skip node_modules and .git)
find . -type f \( -name "*.ts" -o -name "*.tsx" -o -name "*.json" -o -name "*.md" -o -name "*.yaml" -o -name "*.yml" \) \
  -not -path "*/node_modules/*" \
  -not -path "*/.git/*" \
  -not -path "*/LICENSE" \
  | xargs sed -i \
      -e "s|$OLD_DISPLAY|$NEW_DISPLAY|g" \
      -e "s|\"$OLD\"|\"$NEW\"|g" \
      -e "s|'$OLD'|'$NEW'|g" \
      -e "s|\.$OLD\.json|.$NEW.json|g" \
      -e "s|\~\/\.$OLD|\~\/.$NEW|g"

# Rename binary name in package.json files
find . -name "package.json" -not -path "*/node_modules/*" \
  | xargs sed -i "s|\"name\": \"opencode\"|\"name\": \"yummycode\"|g"

echo "Done. Review git diff before committing."
```

```bash
chmod +x scripts/rebrand.sh
./scripts/rebrand.sh
git diff --stat  # review changes
```

### 4.3 Key files to edit manually

**`packages/opencode/package.json`** — update:
```json
{
  "name": "yummycode",
  "bin": {
    "yummycode": "./src/index.ts"
  },
  "description": "YummyCode — AI coding agent for Yummy team"
}
```

**`packages/opencode/src/app/app.ts`** (or wherever the TUI title is set):
```typescript
// Find the title/branding string and replace
const APP_NAME = "YummyCode";
const APP_VERSION = "1.0.0-yummy";
```

**`.goreleaser.yml`** (if it exists for Go releases — may not apply to TS version):
Change binary name from `opencode` to `yummycode`.

### 4.4 Add Yummy-specific AGENT.md

Create `AGENT.md` in the repo root (YummyCode reads this automatically as project context):

```markdown
# Yummy Project — Agent Context

## What this codebase does
[Describe your Yummy project: its purpose, domain, main features]

## Tech stack
- Backend: [e.g., Node.js / Python / Go]
- Frontend: [e.g., React / Vue / Next.js]
- Database: [e.g., PostgreSQL / MongoDB]
- CI/CD: GitHub Actions

## Coding conventions
- Use conventional commits: feat:, fix:, chore:, docs:
- All PRs require 1 reviewer approval
- Test coverage must stay above 80%
- No secrets in code — use environment variables

## Key directories
- `/src` — application source
- `/tests` — test suites
- `/docs` — documentation
- `/scripts` — utility scripts

## Prohibited actions
- Never commit directly to `main`
- Never delete migration files
- Never hardcode credentials
```

---

## 5. Phase 2 — Configure for Yummy Project

### 5.1 Global config: `~/.yummycode/config.json`

Create this file on your machine (it will be auto-created on first run; edit it):

```json
{
  "$schema": "https://yummycode.internal/config.schema.json",
  "theme": "opencode-dark",
  "model": "ollama/qwen2.5-coder:32b",
  "autoshare": false,
  "keybinds": {
    "leader": "ctrl+y"
  },
  "providers": {
    "ollama": {
      "baseUrl": "http://localhost:11434"
    }
  },
  "mcp": {
    "servers": {
      "github": {
        "type": "stdio",
        "command": "npx",
        "args": ["-y", "@modelcontextprotocol/server-github"],
        "env": {
          "GITHUB_PERSONAL_ACCESS_TOKEN": "${YUMMY_GITHUB_PAT}"
        }
      },
      "filesystem": {
        "type": "stdio",
        "command": "npx",
        "args": ["-y", "@modelcontextprotocol/server-filesystem", "/path/to/yummy/repo"]
      }
    }
  }
}
```

### 5.2 Project-level config: `.yummycode.json` (commit this to yummy repo)

Add this to the root of `lamhoangcatvy/yummy`:

```json
{
  "model": "ollama/qwen2.5-coder:32b",
  "agents": {
    "build": {
      "model": "ollama/qwen2.5-coder:32b",
      "maxTokens": 8192
    },
    "plan": {
      "model": "ollama/qwen2.5-coder:7b",
      "maxTokens": 4096
    }
  },
  "permissions": {
    "bash": {
      "allow": ["git *", "npm *", "bun *", "python *"],
      "deny": ["rm -rf *", "curl * | sh", "wget * | sh"]
    }
  }
}
```

### 5.3 Custom YummyCode commands for Yummy workflows

Create `~/.yummycode/commands/` directory with these files:

**`pr-review.md`** — reviews open PR:
```markdown
# Review Pull Request $PR_NUMBER

RUN gh pr view $PR_NUMBER --json title,body,additions,deletions,files
RUN gh pr diff $PR_NUMBER

Review this pull request for:
1. Coding standards and conventions from AGENT.md
2. Security concerns (no secrets, input validation, no SQL injection risks)
3. Test coverage gaps
4. Performance issues

Provide a summary and actionable comments.
```

**`sprint-tasks.md`** — breaks a feature into tasks:
```markdown
# Plan Sprint Tasks for: $FEATURE_DESCRIPTION

RUN gh issue list --label "in-progress" --json title,number
RUN cat AGENT.md

Break down "$FEATURE_DESCRIPTION" into:
1. Backend tasks (API, DB migrations, business logic)
2. Frontend tasks (UI components, state management)
3. Testing tasks (unit, integration, e2e)
4. Documentation tasks

Format as GitHub issues with labels and estimates.
```

**`security-audit.md`** — quick security scan:
```markdown
# Security Audit

RUN grep -r "password\|secret\|token\|api_key" --include="*.ts" --include="*.js" --include="*.py" -l .
RUN cat package.json | grep -E '"dependencies"|"devDependencies"' -A 100
RUN git log --oneline -20

Check for:
- Hardcoded secrets or credentials in code
- Dependency versions with known CVEs
- Insecure patterns (eval, innerHTML, SQL concatenation)
- Missing input validation

Report findings with file locations and severity.
```

---

## 6. Phase 3 — Build Your Custom Binary

The goal: produce a single executable file named `yummycode` (Linux/Mac) or `yummycode.exe`
(Windows) that your team can download from an internal server — no npm install needed.

### 6.1 Install dependencies

```bash
cd yummycode
bun install
```

### 6.2 Build the standalone binary

```bash
# Build for your current platform
bun build packages/opencode/src/index.ts \
  --compile \
  --outfile dist/yummycode \
  --minify

# For Windows cross-compile (run on Linux/Mac with Bun's cross-compile support)
bun build packages/opencode/src/index.ts \
  --compile \
  --target bun-windows-x64 \
  --outfile dist/yummycode.exe \
  --minify

# For Linux (x64)
bun build packages/opencode/src/index.ts \
  --compile \
  --target bun-linux-x64 \
  --outfile dist/yummycode-linux \
  --minify

# For macOS ARM (M1/M2/M3)
bun build packages/opencode/src/index.ts \
  --compile \
  --target bun-darwin-arm64 \
  --outfile dist/yummycode-macos \
  --minify
```

### 6.3 Verify the build

```bash
./dist/yummycode --version
# Should output: YummyCode 1.0.0-yummy
```

### 6.4 Bundle pre-baked config (recommended for company distribution)

Create `scripts/package-release.sh`:

```bash
#!/usr/bin/env bash
# Packages yummycode binary + default config for internal distribution
set -e

PLATFORM=${1:-linux}
VERSION=$(cat packages/opencode/package.json | grep '"version"' | head -1 | awk -F'"' '{print $4}')
OUT="releases/yummycode-${VERSION}-${PLATFORM}"

mkdir -p "$OUT"

# Copy binary
cp dist/yummycode-${PLATFORM} "$OUT/yummycode"
chmod +x "$OUT/yummycode"

# Copy default config (without secrets)
cp scripts/company-default-config.json "$OUT/config.json"

# Copy README for devs
cp scripts/INSTALL.md "$OUT/README.md"

# Create install script
cat > "$OUT/install.sh" << 'EOF'
#!/bin/bash
echo "Installing YummyCode..."
mkdir -p ~/.yummycode
cp config.json ~/.yummycode/config.json
sudo cp yummycode /usr/local/bin/yummycode
echo "Done! Run: yummycode"
EOF
chmod +x "$OUT/install.sh"

# Zip it up
zip -r "${OUT}.zip" "$OUT"
echo "Release ready: ${OUT}.zip"
```

### 6.5 Internal distribution server

Host the binaries on your company's internal file server or artifact registry:

```bash
# Upload to internal Nginx/Apache static server or Nexus/Artifactory
scp releases/yummycode-1.0.0-linux.zip internal-server:/var/www/releases/

# Developers install with:
curl -fsSL http://internal-server/releases/yummycode-latest-linux.zip -o yummycode.zip
unzip yummycode.zip && cd yummycode-* && ./install.sh
```

---

## 7. Phase 4 — Run Locally (Your PC First)

### 7.1 Set environment variables

```bash
# Add to ~/.bashrc or ~/.zshrc (Linux/Mac)
# Or System Environment Variables (Windows)

export YUMMY_GITHUB_PAT="github_pat_YOUR_TOKEN_HERE"
export YUMMYCODE_CONFIG_DIR="$HOME/.yummycode"

# If using cloud AI instead of Ollama:
# export ANTHROPIC_API_KEY="sk-ant-..."
# export OPENAI_API_KEY="sk-..."
```

### 7.2 First launch

```bash
# Navigate to your Yummy project directory
cd ~/projects/yummy

# Launch YummyCode
yummycode

# Or run a single prompt (non-interactive, good for scripts):
yummycode -p "Explain the main entry point of this project"

# Start with debug logging:
yummycode -d
```

### 7.3 Basic TUI controls

| Key | Action |
|-----|--------|
| `Ctrl+Y` | Open command palette (your custom leader) |
| `Tab` | Switch between Build and Plan agents |
| `Ctrl+N` | New session |
| `Ctrl+S` | Save session |
| `Ctrl+C` | Cancel current AI action |
| `/` | Run a custom command (e.g. `/pr-review PR_NUMBER=42`) |
| `Esc` | Back / Cancel |

### 7.4 Your first useful session

Open the yummy repo in your terminal and try:

```
> Summarise the main components of this codebase and identify the top 3 areas that could benefit from refactoring
```

Then:
```
> Look at the last 5 commits on main and identify if there are any patterns in what the team is struggling with
```

Then create a PR:
```
> Create a branch called chore/add-input-validation, add validation for the user registration endpoint, and open a draft PR
```

---

## 8. Phase 5 — Company-Wide Deployment

### 8.1 Server mode (shared team instance)

YummyCode uses a client/server architecture. You can run one server and have multiple devs
connect to it — useful for teams without the hardware to run local models.

```bash
# On a powerful company server (GPU workstation or VM):
YUMMYCODE_SERVER=true yummycode serve --port 4096 --host 0.0.0.0

# Devs connect from their machines:
yummycode --server http://yummycode.internal:4096
```

### 8.2 Docker deployment

Create `Dockerfile` in your yummycode repo:

```dockerfile
FROM oven/bun:1.1-alpine AS builder
WORKDIR /app
COPY . .
RUN bun install
RUN bun build packages/opencode/src/index.ts \
    --compile --outfile dist/yummycode --minify

FROM debian:bookworm-slim
RUN apt-get update && apt-get install -y ca-certificates git && rm -rf /var/lib/apt/lists/*
COPY --from=builder /app/dist/yummycode /usr/local/bin/yummycode
EXPOSE 4096
ENTRYPOINT ["yummycode", "serve", "--port", "4096"]
```

```bash
# Build and run
docker build -t yummycode:latest .
docker run -d \
  -p 4096:4096 \
  -e YUMMY_GITHUB_PAT=$YUMMY_GITHUB_PAT \
  -e ANTHROPIC_API_KEY=$ANTHROPIC_API_KEY \
  --name yummycode \
  yummycode:latest
```

### 8.3 Keep in sync with upstream

```bash
# Monthly: pull security fixes and new features from sst/opencode
git fetch upstream
git checkout main
git merge upstream/main

# Resolve conflicts (usually only in branding files)
# Then rebuild and redistribute
./scripts/package-release.sh linux
```

---

## 9. Security Concerns for IT-SEC

Use this section as your talking points with the IT Security Center.

---

### 9.1 Data Egress — WHERE DOES CODE GO?

**The core question: does our source code leave the building?**

| Deployment | Code egress | AI API egress |
|------------|-------------|---------------|
| Ollama local model | ❌ None | ❌ None |
| Cloud API (Anthropic/OpenAI) | ✅ Code in prompts | ✅ To API provider |
| Company proxy → Cloud API | ✅ Via proxy | ✅ Auditable via proxy logs |

**Recommendation:** Start with Ollama for sensitive repos. Allow cloud API only via an egress
proxy (Squid, Zscaler, Netskope) that logs all outbound requests.

**IT-SEC debate point:** Even with cloud APIs, we control what gets sent via the AGENT.md
`permissions.bash.deny` list. We can also add a pre-send hook to redact secrets from prompts.

---

### 9.2 Authentication & Access Control

**Concerns to address:**
- The GitHub PAT gives the agent real write access to repos
- Anyone who has the yummycode binary can use it

**Mitigations:**
1. Use fine-grained PATs scoped to only `lamhoangcatvy/yummy`, expiring every 90 days
2. Store PATs in your company secret vault (HashiCorp Vault, AWS Secrets Manager) — not in env files
3. Add SSO/LDAP authentication wrapper if running in server mode:
   ```bash
   yummycode serve --auth-provider ldap --ldap-url ldaps://company-ad:636
   ```
4. All permission prompts (file write, bash exec, git push) require developer confirmation by default

---

### 9.3 Code Execution — Agent Has Shell Access

**The concern:** YummyCode can run bash commands — it could `rm -rf`, install packages, or make
network calls.

**The model:** Every destructive action requires explicit developer approval in the TUI.
There is no "auto-approve" mode in production builds.

**Additional hardening via `.yummycode.json`:**
```json
{
  "permissions": {
    "bash": {
      "deny": [
        "rm -rf *",
        "curl * | *",
        "wget * | *",
        "sudo *",
        "chmod 777 *",
        "ssh *",
        "scp *"
      ]
    }
  }
}
```

**IT-SEC debate point:** The deny list is enforced before execution. We can extend it to match
your company security policy. This is stronger than GitHub Copilot, which offers no such controls.

---

### 9.4 Audit Logging

**What is logged by default:**
- Every session stored in `~/.yummycode/` SQLite (full conversation history)
- All bash commands executed, with timestamps
- All file modifications (diffs stored)

**What to add for enterprise compliance:**

```bash
# Forward logs to your SIEM (Splunk, ELK, Datadog)
# Add to yummycode config:
{
  "telemetry": {
    "enabled": true,
    "endpoint": "http://splunk.internal:8088/services/collector",
    "token": "${SPLUNK_HEC_TOKEN}"
  }
}
```

**Retention:** Default is unlimited local storage. Set a 90-day rolling window:
```bash
# Cron job to clean old sessions
0 2 * * * find ~/.yummycode/sessions -mtime +90 -delete
```

---

### 9.5 Supply Chain Security

**The concern:** We're building on an open-source project — could it contain malicious code?

**Mitigations:**
1. We fork the repo at a specific, audited commit and own the build process
2. Lock all npm dependencies: `bun install --frozen-lockfile`
3. Run `npm audit` / `bun audit` in CI before each release
4. Use your company's internal npm registry mirror (Verdaccio, Nexus) to cache dependencies
5. Sign the binary with your company code-signing certificate:
   ```bash
   # Windows (using signtool)
   signtool sign /tr http://timestamp.digicert.com /td sha256 yummycode.exe
   
   # macOS (using codesign)
   codesign --sign "Developer ID: Your Company" dist/yummycode-macos
   ```

---

### 9.6 Network Isolation Options

For maximum isolation, run fully air-gapped with Ollama:

```
[Developer laptop] → [YummyCode] → [Ollama on localhost:11434]
                                 ↓
                    [Only GitHub MCP uses network]
                    [Whitelisted: github.com via HTTPS]
```

Firewall rule (iptables example):
```bash
# Allow only GitHub and internal company services
iptables -A OUTPUT -d api.github.com -j ACCEPT
iptables -A OUTPUT -d github.com -j ACCEPT
iptables -A OUTPUT -d company-internal-server -j ACCEPT
iptables -A OUTPUT -p tcp --dport 11434 -j ACCEPT  # Ollama local
iptables -A OUTPUT -j DROP
```

---

### 9.7 Regulatory Compliance Checklist

| Requirement | Status | Action |
|------------|--------|--------|
| Source code does not leave perimeter | ✅ (with Ollama) | Deploy Ollama |
| All AI interactions auditable | ✅ | Enable telemetry to SIEM |
| No secrets in AI prompts | ⚠️ | Add prompt redaction hook |
| Access controlled by identity | ⚠️ | Integrate with company SSO |
| Dependencies audited | ✅ | `bun audit` in CI |
| Binary signed by company cert | ⚠️ | Code-sign in release pipeline |
| Data retention policy enforced | ⚠️ | Add cron for session cleanup |

---

## 10. Workshop Agenda

**Recommended: 3-hour hands-on session**

### Hour 1 — Context (30 min) + Setup (30 min)

**30-min presentation:**
- What is YummyCode and why we built it internally
- The agent model: Build vs Plan agents, permission model
- Demo: Live coding session on a real Yummy issue

**30-min guided setup:**
```bash
# Each dev runs this on their machine
curl -fsSL http://internal-server/install-yummycode.sh | bash
# Script: downloads binary, sets config, prompts for GitHub PAT
```

### Hour 2 — Hands-on exercises

**Exercise 1 (20 min): Understand a new module**
```
> Explain the authentication flow in this codebase. 
  What are the potential security issues?
```

**Exercise 2 (20 min): Fix a real bug**
Pick an open issue from `lamhoangcatvy/yummy` GitHub Issues. Ask YummyCode to fix it,
review the diff, approve each change, and create a branch.

**Exercise 3 (20 min): Custom command**
Run the `/security-audit` command and discuss the findings with the team.

### Hour 3 — Advanced use + Q&A

**15 min: PR review workflow**
```
> /pr-review PR_NUMBER=<latest open PR>
```

**15 min: Writing tests**
```
> Look at the UserService class. Write comprehensive unit tests 
  covering all edge cases. Use our existing test patterns.
```

**15 min: Sprint planning**
```
> /sprint-tasks FEATURE_DESCRIPTION="Add email notification system"
```

**15 min: Open Q&A + feedback**

---

## Appendix A — Troubleshooting

| Problem | Cause | Fix |
|---------|-------|-----|
| `yummycode: command not found` | Binary not in PATH | `export PATH=$PATH:/usr/local/bin` |
| `Connection refused :11434` | Ollama not running | `ollama serve` in background |
| `GitHub PAT invalid` | Token expired or wrong scope | Regenerate at github.com/settings/tokens |
| `Model too slow` | Using 32B on weak hardware | Switch to `qwen2.5-coder:7b` |
| `Context window exceeded` | Very large codebase | Use `/plan` agent (read-only, lower cost) |
| TUI not rendering | Terminal not supporting ANSI | Use Windows Terminal / iTerm2 |

## Appendix B — Keeping Updated

```bash
# Monthly maintenance script
#!/bin/bash
echo "Updating YummyCode..."
cd ~/dev/yummycode
git fetch upstream
git merge upstream/main --no-edit
bun install
bun build packages/opencode/src/index.ts --compile --outfile dist/yummycode
echo "Upload new binary to internal server:"
scp dist/yummycode internal-server:/var/www/releases/yummycode-latest-linux
echo "Done! Notify team to run: curl -fsSL http://internal-server/install-yummycode.sh | bash"
```

## Appendix C — Useful Resources

- OpenCode upstream: https://github.com/sst/opencode
- OpenCode docs: https://opencode.ai/docs
- MCP protocol: https://modelcontextprotocol.io
- Ollama models: https://ollama.ai/library
- Bun compile docs: https://bun.sh/docs/bundler/executables
- Yummy project: https://github.com/lamhoangcatvy/yummy

---

*YummyCode is a company-internal fork of OpenCode (MIT License). 
Original work © SST/Anomaly. Fork maintained by [Your Company] AI Platform team.*
