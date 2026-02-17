# Hex

Minimal AI agent with full hardware control. Piggybacks your Claude Code subscription — no API keys needed.

## Requirements

- Python 3.10+ (for Python version)
- Node.js 18+ (for TypeScript version)
- Claude Code CLI authenticated (`claude` command working)

## Quick Start

### Python (zero deps)
```bash
git clone https://github.com/jackgladowsky/hex-agent
cd hex-agent
python3 hex.py
```

### TypeScript (pretty terminal UI)
```bash
git clone https://github.com/jackgladowsky/hex-agent
cd hex-agent
npm install
npm run dev
```

## Usage

```bash
# Interactive chat
python3 hex.py

# Single prompt
python3 hex.py run "list files in /tmp"

# Show system info
python3 hex.py info
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
- **Hardware agnostic** — Works on Linux/Mac/Windows with Python
- **Self-discovering** — Detects its own capabilities at startup
- **Piggybacks auth** — Uses your Claude Code subscription, no API key management
- **Full autonomy** — `--dangerously-skip-permissions` means no confirmation prompts

## License

MIT
