# Hex

Minimal AI agent with full hardware control. Zero dependencies — just Python 3 and Claude Code CLI.

## Requirements

- Python 3.10+
- Claude Code CLI authenticated (`npm install -g @anthropic-ai/claude-code` then `claude` to login)

## Usage

```bash
# Interactive chat
python hex.py chat
# or just
python hex.py

# Single prompt
python hex.py run "list files in /tmp"

# Show system info
python hex.py info
```

## How it works

```
┌─────────────────────────────────────────┐
│  BOOTSTRAP                              │
│  - Detect OS, arch, permissions         │
│  - Inventory hardware (CPU, RAM)        │
│  - Check sudo access                    │
└─────────────────┬───────────────────────┘
                  ▼
┌─────────────────────────────────────────┐
│  AGENT LOOP                             │
│  - User prompt → Claude CLI (-p mode)   │
│  - Uses PTY for TTY-required CLI        │
│  - Full autonomy (--dangerously-skip)   │
└─────────────────────────────────────────┘
```

## Philosophy

- **Hardware agnostic** — works on any Linux/Mac/Windows with Python
- **Self-discovering** — detects its own hardware and capabilities
- **Zero dependencies** — just stdlib + Claude Code CLI
- **Piggybacks Claude Code auth** — no API key management
- **Full autonomy** — `--dangerously-skip-permissions` means no prompts

## License

MIT
