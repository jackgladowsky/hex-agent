#!/usr/bin/env node
import React from 'react';
import { render } from 'ink';
import App from './App.js';

// Parse command line arguments
const args = process.argv.slice(2);
let model = 'sonnet'; // default

for (let i = 0; i < args.length; i++) {
  if (args[i] === '--model' || args[i] === '-m') {
    model = args[i + 1] || 'sonnet';
    i++;
  } else if (args[i] === '--help' || args[i] === '-h') {
    console.log(`
🦎 Hex - AI System Assistant

Usage: hex [options]

Options:
  -m, --model <model>  AI model to use (default: sonnet)
                       Options: sonnet, opus, haiku
  -h, --help           Show this help message

Examples:
  hex                  Start with default model (sonnet)
  hex --model opus     Start with Opus
  hex -m haiku         Start with Haiku (faster, cheaper)
`);
    process.exit(0);
  }
}

render(<App model={model} />);
