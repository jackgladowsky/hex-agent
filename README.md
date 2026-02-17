# Hex

Minimal AI agent with full hardware control. Uses Claude Code's OAuth token — no API keys needed.

## Requirements

- Python 3.10+
- Claude Code authenticated (`claude` CLI logged in)

## Install

```bash
cd ~/hex
pip install -r requirements.txt
# or
uv pip install -r requirements.txt
```

## Usage

```bash
# Chat with Hex
python hex.py chat
# or just
python hex.py

# Show system info
python hex.py info
```

## How it works

1. **Bootstrap**: Detects OS, CPU, RAM, sudo access
2. **Auth**: Reads Claude Code's OAuth token from `~/.claude/.credentials.json`
3. **Loop**: User input → Claude → tool execution → repeat

## Tools

- `run_command` - Execute shell commands (with optional sudo)
- `read_file` - Read file contents
- `write_file` - Write to files

## Philosophy

- Hardware agnostic (Linux/Mac/Windows)
- Self-discovering (figures out its own capabilities)
- Minimal dependencies (just httpx)
- Piggybacks Claude Code auth (no API key management)
