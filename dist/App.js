import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState } from 'react';
import { Box, Text, useInput, useApp } from 'ink';
import TextInput from 'ink-text-input';
import Spinner from 'ink-spinner';
import { execSync, spawn } from 'child_process';
import * as os from 'os';
function detectSystem() {
    let sudo = false;
    try {
        execSync('sudo -n true', { stdio: 'pipe' });
        sudo = true;
    }
    catch { }
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
async function callClaude(prompt) {
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
const Header = ({ systemInfo }) => (_jsxs(Box, { flexDirection: "column", marginBottom: 1, children: [_jsxs(Box, { children: [_jsx(Text, { color: "green", bold: true, children: "\uD83E\uDD8E Hex" }), _jsxs(Text, { color: "gray", children: [" \u2014 ", systemInfo.os, " ", systemInfo.arch] })] }), _jsxs(Text, { color: "gray", dimColor: true, children: [systemInfo.cpuCores, " cores \u2022 ", systemInfo.memoryGb, " GB RAM \u2022 sudo: ", systemInfo.sudo ? 'yes' : 'no'] })] }));
const MessageList = ({ messages }) => (_jsx(Box, { flexDirection: "column", marginBottom: 1, children: messages.slice(-10).map((msg, i) => (_jsxs(Box, { marginBottom: msg.role === 'assistant' ? 1 : 0, children: [_jsxs(Text, { color: msg.role === 'user' ? 'blue' : 'green', bold: true, children: [msg.role === 'user' ? 'you' : 'hex', ":"] }), _jsxs(Text, { children: [" ", msg.content] })] }, i))) }));
const InputArea = ({ value, onChange, onSubmit, loading }) => (_jsx(Box, { children: loading ? (_jsxs(Box, { children: [_jsx(Text, { color: "yellow", children: _jsx(Spinner, { type: "dots" }) }), _jsx(Text, { color: "gray", children: " thinking..." })] })) : (_jsxs(Box, { children: [_jsx(Text, { color: "cyan", bold: true, children: '> ' }), _jsx(TextInput, { value: value, onChange: onChange, onSubmit: onSubmit, placeholder: "Type a message..." })] })) }));
// ─────────────────────────────────────────────────────────────
// Main App
// ─────────────────────────────────────────────────────────────
const App = () => {
    const { exit } = useApp();
    const [systemInfo] = useState(detectSystem);
    const [messages, setMessages] = useState([]);
    const [input, setInput] = useState('');
    const [loading, setLoading] = useState(false);
    useInput((_, key) => {
        if (key.escape || (key.ctrl && _.toLowerCase() === 'c')) {
            exit();
        }
    });
    const handleSubmit = async (value) => {
        if (!value.trim() || loading)
            return;
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
    return (_jsxs(Box, { flexDirection: "column", padding: 1, children: [_jsx(Header, { systemInfo: systemInfo }), _jsx(MessageList, { messages: messages }), _jsx(InputArea, { value: input, onChange: setInput, onSubmit: handleSubmit, loading: loading }), _jsx(Box, { marginTop: 1, children: _jsx(Text, { color: "gray", dimColor: true, children: "Press Esc or Ctrl+C to exit" }) })] }));
};
export default App;
