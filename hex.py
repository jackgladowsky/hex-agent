#!/usr/bin/env python3
"""
Hex - Minimal AI agent with full hardware control.
Uses Claude Code OAuth token for authentication.
"""

import json
import os
import subprocess
import sys
from pathlib import Path

import httpx

# ─────────────────────────────────────────────────────────────
# Auth: Read Claude Code credentials
# ─────────────────────────────────────────────────────────────

def get_claude_credentials() -> dict:
    """Load OAuth token from Claude Code's credentials file."""
    creds_path = Path.home() / ".claude" / ".credentials.json"
    if not creds_path.exists():
        print("Error: Claude Code not authenticated.")
        print("Run 'claude' and log in first.")
        sys.exit(1)
    
    with open(creds_path) as f:
        creds = json.load(f)
    
    oauth = creds.get("claudeAiOauth", {})
    if not oauth.get("accessToken"):
        print("Error: No access token found. Re-authenticate with Claude Code.")
        sys.exit(1)
    
    return oauth


# ─────────────────────────────────────────────────────────────
# System: Detect hardware and OS
# ─────────────────────────────────────────────────────────────

def detect_system() -> dict:
    """Gather system information."""
    import platform
    
    info = {
        "os": platform.system(),
        "arch": platform.machine(),
        "hostname": platform.node(),
        "python": platform.python_version(),
    }
    
    # Check sudo access
    try:
        result = subprocess.run(
            ["sudo", "-n", "true"],
            capture_output=True,
            timeout=2
        )
        info["sudo"] = result.returncode == 0
    except:
        info["sudo"] = False
    
    # Get memory
    try:
        if info["os"] == "Linux":
            with open("/proc/meminfo") as f:
                for line in f:
                    if line.startswith("MemTotal:"):
                        kb = int(line.split()[1])
                        info["memory_gb"] = round(kb / 1024 / 1024, 1)
                        break
    except:
        pass
    
    # Get CPU info
    try:
        if info["os"] == "Linux":
            result = subprocess.run(["nproc"], capture_output=True, text=True)
            info["cpu_cores"] = int(result.stdout.strip())
    except:
        pass
    
    return info


# ─────────────────────────────────────────────────────────────
# Tools: Command execution
# ─────────────────────────────────────────────────────────────

TOOLS = [
    {
        "name": "run_command",
        "description": "Execute a shell command on the system. Use for file operations, system management, installing packages, etc.",
        "input_schema": {
            "type": "object",
            "properties": {
                "command": {
                    "type": "string",
                    "description": "The shell command to execute"
                },
                "sudo": {
                    "type": "boolean",
                    "description": "Run with sudo (if available)",
                    "default": False
                }
            },
            "required": ["command"]
        }
    },
    {
        "name": "read_file",
        "description": "Read contents of a file",
        "input_schema": {
            "type": "object",
            "properties": {
                "path": {
                    "type": "string",
                    "description": "Path to the file"
                }
            },
            "required": ["path"]
        }
    },
    {
        "name": "write_file",
        "description": "Write content to a file",
        "input_schema": {
            "type": "object",
            "properties": {
                "path": {
                    "type": "string",
                    "description": "Path to the file"
                },
                "content": {
                    "type": "string",
                    "description": "Content to write"
                }
            },
            "required": ["path", "content"]
        }
    }
]


def execute_tool(name: str, input: dict) -> str:
    """Execute a tool and return the result."""
    try:
        if name == "run_command":
            cmd = input["command"]
            if input.get("sudo"):
                cmd = f"sudo {cmd}"
            result = subprocess.run(
                cmd,
                shell=True,
                capture_output=True,
                text=True,
                timeout=60
            )
            output = result.stdout
            if result.stderr:
                output += f"\nSTDERR: {result.stderr}"
            if result.returncode != 0:
                output += f"\n[exit code: {result.returncode}]"
            return output or "(no output)"
        
        elif name == "read_file":
            path = Path(input["path"]).expanduser()
            return path.read_text()
        
        elif name == "write_file":
            path = Path(input["path"]).expanduser()
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_text(input["content"])
            return f"Wrote {len(input['content'])} bytes to {path}"
        
        else:
            return f"Unknown tool: {name}"
    
    except Exception as e:
        return f"Error: {e}"


# ─────────────────────────────────────────────────────────────
# Agent: Main loop
# ─────────────────────────────────────────────────────────────

def build_system_prompt(system_info: dict) -> str:
    """Build the system prompt with hardware context."""
    return f"""You are Hex, an AI agent with full control of this machine.

SYSTEM INFO:
- OS: {system_info.get('os', 'Unknown')}
- Architecture: {system_info.get('arch', 'Unknown')}
- Hostname: {system_info.get('hostname', 'Unknown')}
- CPU Cores: {system_info.get('cpu_cores', 'Unknown')}
- Memory: {system_info.get('memory_gb', 'Unknown')} GB
- Sudo Access: {system_info.get('sudo', False)}

You have tools to run commands, read/write files. Use them freely to accomplish tasks.
Be direct, efficient, and take action. This is your machine."""


def chat(oauth: dict, system_info: dict):
    """Main chat loop."""
    messages = []
    system_prompt = build_system_prompt(system_info)
    
    print(f"\n🦎 Hex v0.1 — {system_info['os']} {system_info['arch']}")
    print(f"   {system_info.get('cpu_cores', '?')} cores, {system_info.get('memory_gb', '?')} GB RAM")
    print(f"   sudo: {'yes' if system_info.get('sudo') else 'no'}")
    print("\nType 'exit' to quit.\n")
    
    while True:
        try:
            user_input = input("you: ").strip()
        except (EOFError, KeyboardInterrupt):
            print("\nBye.")
            break
        
        if not user_input:
            continue
        if user_input.lower() in ("exit", "quit", "q"):
            print("Bye.")
            break
        
        messages.append({"role": "user", "content": user_input})
        
        # Agent loop: keep going until no more tool calls
        while True:
            response = call_claude(oauth, system_prompt, messages)
            
            # Collect text and tool calls
            text_parts = []
            tool_calls = []
            
            for block in response.get("content", []):
                if block["type"] == "text":
                    text_parts.append(block["text"])
                elif block["type"] == "tool_use":
                    tool_calls.append(block)
            
            # Print any text
            if text_parts:
                print(f"\nhex: {''.join(text_parts)}\n")
            
            # If no tool calls, we're done
            if not tool_calls:
                messages.append({"role": "assistant", "content": response["content"]})
                break
            
            # Execute tools
            messages.append({"role": "assistant", "content": response["content"]})
            tool_results = []
            
            for tool in tool_calls:
                print(f"  [running: {tool['name']}]")
                result = execute_tool(tool["name"], tool["input"])
                tool_results.append({
                    "type": "tool_result",
                    "tool_use_id": tool["id"],
                    "content": result[:10000]  # Truncate long outputs
                })
            
            messages.append({"role": "user", "content": tool_results})


def call_claude(oauth: dict, system_prompt: str, messages: list) -> dict:
    """Call Claude API with OAuth token."""
    headers = {
        "Authorization": f"Bearer {oauth['accessToken']}",
        "Content-Type": "application/json",
        "anthropic-version": "2023-06-01",
    }
    
    payload = {
        "model": "claude-sonnet-4-20250514",
        "max_tokens": 4096,
        "system": system_prompt,
        "messages": messages,
        "tools": TOOLS,
    }
    
    with httpx.Client(timeout=120) as client:
        resp = client.post(
            "https://api.anthropic.com/v1/messages",
            headers=headers,
            json=payload
        )
    
    if resp.status_code != 200:
        print(f"API Error: {resp.status_code}")
        print(resp.text)
        sys.exit(1)
    
    return resp.json()


# ─────────────────────────────────────────────────────────────
# CLI Entry
# ─────────────────────────────────────────────────────────────

def main():
    import argparse
    parser = argparse.ArgumentParser(description="Hex - AI agent with hardware control")
    parser.add_argument("command", nargs="?", default="chat", choices=["chat", "info"])
    args = parser.parse_args()
    
    system_info = detect_system()
    
    if args.command == "info":
        print(json.dumps(system_info, indent=2))
        return
    
    oauth = get_claude_credentials()
    chat(oauth, system_info)


if __name__ == "__main__":
    main()
