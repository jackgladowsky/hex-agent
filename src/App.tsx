import React, { useState, useEffect } from 'react';
import { Box, Text, useInput, useApp } from 'ink';
import TextInput from 'ink-text-input';
import Spinner from 'ink-spinner';
import { execSync, spawn } from 'child_process';
import * as os from 'os';

// Resolve full path to claude CLI
function getClaudePath(): string {
  const home = os.homedir();
  // Ensure PATH includes common locations
  const extraPaths = `${home}/.local/bin:/opt/homebrew/bin:/usr/local/bin`;
  const fullPath = `${extraPaths}:${process.env.PATH || ''}`;
  
  try {
    return execSync('which claude', { encoding: 'utf8', env: { ...process.env, PATH: fullPath } }).trim();
  } catch {
    // Fallback to common locations
    const paths = [
      `${home}/.local/bin/claude`,
      '/usr/local/bin/claude',
      '/opt/homebrew/bin/claude',
      `${home}/.npm-global/bin/claude`,
      `${home}/.nvm/versions/node/v22.21.0/bin/claude`,
    ];
    for (const p of paths) {
      try {
        execSync(`test -x "${p}"`);
        return p;
      } catch {}
    }
    return 'claude'; // fallback, let it fail with better error
  }
}

const CLAUDE_PATH = getClaudePath();

// ─────────────────────────────────────────────────────────────
// System Detection
// ─────────────────────────────────────────────────────────────

interface SystemInfo {
  os: string;
  arch: string;
  hostname: string;
  cpuCores: number;
  memoryGb: number;
  sudo: boolean;
}

function detectSystem(): SystemInfo {
  let sudo = false;
  try {
    execSync('sudo -n true', { stdio: 'pipe' });
    sudo = true;
  } catch {}

  return {
    os: os.platform(),
    arch: os.arch(),
    hostname: os.hostname(),
    cpuCores: os.cpus().length,
    memoryGb: Math.round(os.totalmem() / 1024 / 1024 / 1024 * 10) / 10,
    sudo,
  };
}

// ─────────────────────────────────────────────────────────────
// Claude CLI Integration
// ─────────────────────────────────────────────────────────────

interface ClaudeStreamEvent {
  type: string;
  message?: {
    role: string;
    content: Array<{ type: string; text?: string }>;
  };
  content_block?: {
    type: string;
    text?: string;
  };
  delta?: {
    type: string;
    text?: string;
  };
  result?: string;
  subtype?: string;
}

async function callClaude(
  prompt: string, 
  sessionId: string, 
  isFirst: boolean,
  onPartial?: (text: string) => void
): Promise<string> {
  return new Promise((resolve) => {
    // Build the PATH with nvm and other common locations
    const home = os.homedir();
    const nvmPath = `${home}/.nvm/versions/node/v22.21.0/bin`;
    const extraPaths = [nvmPath, `${home}/.local/bin`, '/usr/local/bin', '/usr/bin', '/bin'];
    const fullPath = [...extraPaths, process.env.PATH || ''].join(':');

    // Use stream-json for structured output (requires --verbose)
    const args = isFirst
      ? ['-p', '--verbose', '--dangerously-skip-permissions', '--output-format', 'stream-json', '--session-id', sessionId]
      : ['-p', '--verbose', '--dangerously-skip-permissions', '--output-format', 'stream-json', '--resume', sessionId];

    const child = spawn(CLAUDE_PATH, args, {
      cwd: process.cwd(),
      env: { ...process.env, PATH: fullPath, HOME: home },
      shell: false,
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    let fullText = '';
    let errorOutput = '';
    let buffer = '';

    child.stdout.on('data', (data) => {
      buffer += data.toString();
      // Process complete JSON lines
      const lines = buffer.split('\n');
      buffer = lines.pop() || ''; // Keep incomplete line in buffer
      
      for (const line of lines) {
        if (!line.trim()) continue;
        try {
          const event: ClaudeStreamEvent = JSON.parse(line);
          
          // Handle different event types
          if (event.type === 'assistant' && event.message?.content) {
            // Full message at the end
            for (const block of event.message.content) {
              if (block.type === 'text' && block.text) {
                fullText = block.text;
              }
            }
          } else if (event.type === 'content_block_delta' && event.delta?.text) {
            // Streaming delta
            fullText += event.delta.text;
            onPartial?.(fullText);
          } else if (event.type === 'result' && event.result) {
            // Final result text
            fullText = event.result;
          }
        } catch {
          // Not JSON, treat as raw text
          fullText += line;
        }
      }
    });

    child.stderr.on('data', (data) => {
      errorOutput += data.toString();
    });

    // Send prompt via stdin
    child.stdin.write(prompt);
    child.stdin.end();

    child.on('error', (err) => {
      resolve(`Error: Could not spawn claude CLI.\nPath: ${CLAUDE_PATH}\n${err.message}`);
    });

    child.on('close', (code) => {
      // Process any remaining buffer
      if (buffer.trim()) {
        try {
          const event: ClaudeStreamEvent = JSON.parse(buffer);
          if (event.type === 'assistant' && event.message?.content) {
            for (const block of event.message.content) {
              if (block.type === 'text' && block.text) {
                fullText = block.text;
              }
            }
          } else if (event.result) {
            fullText = event.result;
          }
        } catch {
          fullText += buffer;
        }
      }

      if (code !== 0 && errorOutput && !fullText) {
        resolve(`Error (code ${code}): ${errorOutput}`);
        return;
      }
      resolve(fullText.trim() || 'No response from Claude.');
    });
  });
}

function generateSessionId(): string {
  // Generate UUID v4
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

// ─────────────────────────────────────────────────────────────
// Components
// ─────────────────────────────────────────────────────────────

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

const Header: React.FC<{ systemInfo: SystemInfo; sessionId: string }> = ({ systemInfo, sessionId }) => (
  <Box flexDirection="column" marginBottom={1}>
    <Box>
      <Text color="green" bold>🦎 Hex</Text>
      <Text color="gray"> — {systemInfo.os} {systemInfo.arch}</Text>
    </Box>
    <Text color="gray" dimColor>
      {systemInfo.cpuCores} cores • {systemInfo.memoryGb} GB RAM • sudo: {systemInfo.sudo ? 'yes' : 'no'}
    </Text>
    <Text color="gray" dimColor>session: {sessionId}</Text>
  </Box>
);

const MessageList: React.FC<{ messages: Message[] }> = ({ messages }) => (
  <Box flexDirection="column" marginBottom={1}>
    {messages.slice(-10).map((msg, i) => (
      <Box key={i} marginBottom={msg.role === 'assistant' ? 1 : 0}>
        <Text color={msg.role === 'user' ? 'blue' : 'green'} bold>
          {msg.role === 'user' ? 'you' : 'hex'}:
        </Text>
        <Text> {msg.content}</Text>
      </Box>
    ))}
  </Box>
);

const InputArea: React.FC<{
  value: string;
  onChange: (v: string) => void;
  onSubmit: (v: string) => void;
  loading: boolean;
}> = ({ value, onChange, onSubmit, loading }) => (
  <Box>
    {loading ? (
      <Box>
        <Text color="yellow">
          <Spinner type="dots" />
        </Text>
        <Text color="gray"> thinking...</Text>
      </Box>
    ) : (
      <Box>
        <Text color="cyan" bold>{'> '}</Text>
        <TextInput
          value={value}
          onChange={onChange}
          onSubmit={onSubmit}
          placeholder="Type a message..."
        />
      </Box>
    )}
  </Box>
);

// ─────────────────────────────────────────────────────────────
// Main App
// ─────────────────────────────────────────────────────────────

const App: React.FC = () => {
  const { exit } = useApp();
  const [systemInfo] = useState<SystemInfo>(detectSystem);
  const [sessionId] = useState<string>(generateSessionId);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [isFirst, setIsFirst] = useState(true);

  useInput((_, key) => {
    if (key.escape || (key.ctrl && _.toLowerCase() === 'c')) {
      exit();
    }
  });

  const handleSubmit = async (value: string) => {
    if (!value.trim() || loading) return;
    
    const userMsg = value.trim();
    if (userMsg.toLowerCase() === 'exit' || userMsg.toLowerCase() === 'quit') {
      exit();
      return;
    }

    setInput('');
    setMessages(prev => [...prev, { role: 'user', content: userMsg }]);
    setLoading(true);

    // First message includes system context
    const prompt = isFirst
      ? `[System: ${systemInfo.os} ${systemInfo.arch}, ${systemInfo.cpuCores} cores, ${systemInfo.memoryGb}GB RAM, sudo=${systemInfo.sudo ? 'yes' : 'no'}]\n\n${userMsg}`
      : userMsg;

    const response = await callClaude(prompt, sessionId, isFirst);
    
    setMessages(prev => [...prev, { role: 'assistant', content: response }]);
    setLoading(false);
    setIsFirst(false);
  };

  return (
    <Box flexDirection="column" padding={1}>
      <Header systemInfo={systemInfo} sessionId={sessionId} />
      <MessageList messages={messages} />
      <InputArea
        value={input}
        onChange={setInput}
        onSubmit={handleSubmit}
        loading={loading}
      />
      <Box marginTop={1}>
        <Text color="gray" dimColor>Press Esc or Ctrl+C to exit</Text>
      </Box>
    </Box>
  );
};

export default App;
