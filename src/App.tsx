import React, { useState, useEffect } from 'react';
import { Box, Text, useInput, useApp } from 'ink';
import TextInput from 'ink-text-input';
import Spinner from 'ink-spinner';
import { execSync } from 'child_process';
import * as os from 'os';
import * as nodePty from 'node-pty';

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

async function callClaude(prompt: string, sessionId: string, isFirst: boolean): Promise<string> {
  return new Promise((resolve) => {
    const args = isFirst
      ? ['-p', '--dangerously-skip-permissions', '--session-id', sessionId, prompt]
      : ['-p', '--dangerously-skip-permissions', '--resume', sessionId];

    const ptyProcess = nodePty.spawn('claude', args, {
      name: 'xterm-256color',
      cols: 120,
      rows: 30,
      cwd: process.cwd(),
      env: process.env as Record<string, string>,
    });

    // For resume, send prompt via stdin
    if (!isFirst) {
      setTimeout(() => ptyProcess.write(prompt + '\n'), 100);
    }

    let output = '';
    ptyProcess.onData((data: string) => {
      output += data;
    });

    ptyProcess.onExit(() => {
      // Clean ANSI codes and terminal garbage
      const clean = output
        .replace(/\x1b\[[0-9;?]*[a-zA-Z]/g, '')
        .replace(/\x1b\][^\x07\x1b]*(?:\x07|\x1b\\)/g, '')
        .replace(/\x1b[PX^_].*?(?:\x1b\\|\x07)/gs, '')
        .replace(/\[<u/g, '')
        .replace(/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/g, '')
        .trim();
      resolve(clean);
    });
  });
}

function generateSessionId(): string {
  return `hex-${Math.random().toString(36).substring(2, 10)}`;
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
