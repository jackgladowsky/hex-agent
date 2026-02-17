# 🦎 Hex

A terminal-based AI coding agent powered by Claude CLI.

## Current Status

✅ **Working:**
- Interactive TUI with Ink (React for terminals)
- Claude CLI integration via spawn (uses your authenticated Claude CLI)
- Session persistence with session IDs
- System info detection (OS, arch, CPU, RAM, sudo)
- ANSI output cleaning

## Requirements

- Node.js 18+
- Authenticated Claude CLI (`npm i -g @anthropic-ai/claude-code && claude`)
- Must run `claude` and authenticate first

## Quick Start

```bash
npm install
npm run dev
```

Type messages, press Enter to send. Press Esc or Ctrl+C to exit.

## How It Works

1. **UI Layer** - Ink renders a beautiful TUI with message history
2. **Backend** - Spawns Claude CLI (`claude -p --session-id <id>`) for each conversation
3. **Sessions** - UUID-based sessions for persistent conversations

## Architecture

```
src/
├── cli.tsx     # Entry point (Ink render)
└── App.tsx     # Main component (UI + Claude integration)
```

## Design Goals

- **Minimal** - Single-file core, no unnecessary abstractions
- **Fast** - Direct CLI spawn, no SDK overhead
- **Persistent** - Session IDs enable conversation continuity
- **Beautiful** - Clean TUI with color-coded messages

## Notes

- Uses `-p` (print) mode for non-interactive output
- Requires Claude CLI to be authenticated (OAuth or API key)
- PATH must include the claude binary location

---

Built by Jack. Powered by Claude.
