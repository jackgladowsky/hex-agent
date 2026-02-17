import React, { useState, useEffect } from 'react';
import { Box, Text, useInput, useApp } from 'ink';
import TextInput from 'ink-text-input';
import Spinner from 'ink-spinner';
import { execSync, spawn } from 'child_process';
import * as os from 'os';
import * as pty from 'node:child_process';

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

async function callClaude(prompt: string): Promise<string> {
  return new Promise((resolve) => {
    const child = spawn('claude', ['-p', '--dangerously-skip-permissions', prompt], {
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    let output = '';
    child.stdout.on('data', (data) => {
      output += data.toString();
    });
    child.stderr.on('data', (data) => {
      output += data.toString();
    });
    child.on('close', () => {
      // Clean ANSI codes
      const clean = output
        .replace(/\x1b\[[0-9;?]*[a-zA-Z]/g, '')
        .replace(/\x1b\][^\x07\x1b]*(?:\x07|\x1b\\)/g, '')
        .replace(/\[<u/g, '')
        .trim();
      resolve(clean);
    });
    child.on('error', (err) => {
      resolve(`Error: ${err.message}`);
    });
  });
}

// ─────────────────────────────────────────────────────────────
// Components
// ─────────────────────────────────────────────────────────────

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

const Header: React.FC<{ systemInfo: SystemInfo }> = ({ systemInfo }) => (
  <Box flexDirection="column" marginBottom={1}>
    <Box>
      <Text color="green" bold>🦎 Hex</Text>
      <Text color="gray"> — {systemInfo.os} {systemInfo.arch}</Text>
    </Box>
    <Text color="gray" dimColor>
      {systemInfo.cpuCores} cores • {systemInfo.memoryGb} GB RAM • sudo: {systemInfo.sudo ? 'yes' : 'no'}
    </Text>
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
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);

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

    // Build context
    const context = `[System: ${systemInfo.os} ${systemInfo.arch}, ${systemInfo.cpuCores} cores, ${systemInfo.memoryGb}GB RAM, sudo=${systemInfo.sudo ? 'yes' : 'no'}]\n\n`;
    const history = messages.slice(-4).map(m => `${m.role === 'user' ? 'User' : 'Hex'}: ${m.content}`).join('\n');
    const prompt = context + (history ? history + '\n' : '') + `User: ${userMsg}`;

    const response = await callClaude(prompt);
    
    setMessages(prev => [...prev, { role: 'assistant', content: response }]);
    setLoading(false);
  };

  return (
    <Box flexDirection="column" padding={1}>
      <Header systemInfo={systemInfo} />
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
