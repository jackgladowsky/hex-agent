#!/usr/bin/env python3
"""
Hex - Minimal AI agent with full hardware control.
Uses Claude Code CLI for LLM calls (piggybacks your subscription).
"""

import json
import subprocess
import sys
import platform
import pty
import os
import select

# ─────────────────────────────────────────────────────────────
# System: Detect hardware and OS
# ─────────────────────────────────────────────────────────────

def detect_system() -> dict:
    """Gather system information."""
    info = {
        "os": platform.system(),
        "arch": platform.machine(),
        "hostname": platform.node(),
        "python": platform.python_version(),
    }
    
    # Check sudo access
    try:
        result = subprocess.run(["sudo", "-n", "true"], capture_output=True, timeout=2)
        info["sudo"] = result.returncode == 0
    except:
        info["sudo"] = False
    
    # Linux-specific
    if info["os"] == "Linux":
        try:
            with open("/proc/meminfo") as f:
                for line in f:
                    if line.startswith("MemTotal:"):
                        info["memory_gb"] = round(int(line.split()[1]) / 1024 / 1024, 1)
                        break
            info["cpu_cores"] = int(subprocess.run(["nproc"], capture_output=True, text=True).stdout.strip())
        except:
            pass
    
    return info


def check_claude_cli() -> bool:
    """Check if Claude CLI is installed."""
    try:
        return subprocess.run(["claude", "--version"], capture_output=True, timeout=5).returncode == 0
    except:
        return False


# ─────────────────────────────────────────────────────────────
# Agent
# ─────────────────────────────────────────────────────────────

SYSTEM_PROMPT = """You are Hex, an AI agent with full control of this machine.
You have full shell access. Execute commands freely to accomplish tasks.
Be direct and concise. This is your machine."""


def call_claude_pty(prompt: str) -> str:
    """Call Claude via CLI with PTY (required for Claude CLI)."""
    cmd = ["claude", "-p", "--dangerously-skip-permissions", prompt]
    
    # Create pseudo-terminal
    master_fd, slave_fd = pty.openpty()
    
    try:
        proc = subprocess.Popen(
            cmd,
            stdin=slave_fd,
            stdout=slave_fd,
            stderr=slave_fd,
            close_fds=True,
        )
        os.close(slave_fd)
        
        output = []
        while True:
            ready, _, _ = select.select([master_fd], [], [], 120)
            if not ready:
                break
            try:
                chunk = os.read(master_fd, 4096)
                if not chunk:
                    break
                output.append(chunk.decode('utf-8', errors='replace'))
            except OSError:
                break
        
        proc.wait()
        os.close(master_fd)
        
        # Clean up terminal control codes
        result = ''.join(output)
        import re
        # Remove ANSI escape sequences
        result = re.sub(r'\x1b\[[0-9;?]*[a-zA-Z]', '', result)
        result = re.sub(r'\x1b\][^\x07\x1b]*(?:\x07|\x1b\\)', '', result)
        result = re.sub(r'\x1b[PX^_].*?(?:\x1b\\|\x07)', '', result, flags=re.DOTALL)
        result = re.sub(r'\[<u', '', result)  # Specific garbage
        result = re.sub(r'[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]', '', result)
        
        return result.strip()
    
    except Exception as e:
        return f"Error: {e}"


def call_claude(prompt: str, system_info: dict) -> str:
    """Call Claude with system context."""
    context = f"[System: {system_info['os']} {system_info['arch']}, {system_info.get('cpu_cores', '?')} cores, {system_info.get('memory_gb', '?')}GB RAM, sudo={'yes' if system_info.get('sudo') else 'no'}]\n\n"
    return call_claude_pty(context + prompt)


def chat(system_info: dict):
    """Interactive chat loop."""
    print(f"\n🦎 Hex v0.1 — {system_info['os']} {system_info['arch']}")
    print(f"   {system_info.get('cpu_cores', '?')} cores, {system_info.get('memory_gb', '?')} GB RAM, sudo: {'yes' if system_info.get('sudo') else 'no'}")
    print("\nType 'exit' to quit.\n")
    
    history = []
    
    while True:
        try:
            user_input = input("you: ").strip()
        except (EOFError, KeyboardInterrupt):
            print("\nBye.")
            break
        
        if not user_input:
            continue
        if user_input.lower() in ("exit", "quit", "q"):
            break
        
        # Build prompt with history
        prompt = ""
        for h in history[-4:]:
            prompt += f"{h['role']}: {h['msg']}\n"
        prompt += f"User: {user_input}"
        
        print("  [thinking...]")
        response = call_claude(prompt, system_info)
        print(f"\nhex: {response}\n")
        
        history.append({"role": "User", "msg": user_input})
        history.append({"role": "Hex", "msg": response[:300]})


# ─────────────────────────────────────────────────────────────
# CLI
# ─────────────────────────────────────────────────────────────

def main():
    import argparse
    parser = argparse.ArgumentParser(description="Hex - AI agent with hardware control")
    parser.add_argument("command", nargs="?", default="chat", choices=["chat", "info", "run"])
    parser.add_argument("prompt", nargs="*", help="Prompt for 'run' command")
    args = parser.parse_args()
    
    system_info = detect_system()
    
    if args.command == "info":
        print(json.dumps(system_info, indent=2))
        return
    
    if not check_claude_cli():
        print("Error: Claude CLI not found. Install: npm install -g @anthropic-ai/claude-code")
        sys.exit(1)
    
    if args.command == "run" and args.prompt:
        print(call_claude(" ".join(args.prompt), system_info))
        return
    
    chat(system_info)


if __name__ == "__main__":
    main()
