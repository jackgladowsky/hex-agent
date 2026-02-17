# Hex

Minimal AI agent with full hardware control. Piggybacks your Claude Code subscription — no API keys needed.

## Requirements

- Node.js 18+
- Claude Code CLI authenticated (`claude` command working)

## Quick Start

```bash
git clone https://github.com/jackgladowsky/hex-agent
cd hex-agent
npm install
npm start
```

## Usage

```bash
# Interactive chat (dev mode with hot reload)
npm run dev

# Production
npm start
```

## How it works

1. **Bootstrap** — Detects OS, arch, CPU, RAM, sudo access
2. **Session** — Creates a Claude Code session (persists across messages)
3. **Agent loop** — Your prompts go to Claude with `--dangerously-skip-permissions`

```
┌─────────────────────────────────────────┐
│  First message                          │
│  claude -p --session-id <uuid> "prompt" │
└─────────────────┬───────────────────────┘
                  ▼
┌─────────────────────────────────────────┐
│  Subsequent messages                    │
│  claude -p --resume <uuid>              │
│  (prompt via stdin)                     │
└─────────────────────────────────────────┘
```

## Philosophy

- **Zero config** — Just clone and run
- **Hardware agnostic** — Works on Linux/Mac/Windows
- **Self-discovering** — Detects its own capabilities at startup
- **Piggybacks auth** — Uses your Claude Code subscription, no API key management
- **Full autonomy** — `--dangerously-skip-permissions` means no confirmation prompts

## License

MIT
