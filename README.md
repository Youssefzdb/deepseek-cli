# DeepSeek CLI

Unofficial terminal client for [chat.deepseek.com](https://chat.deepseek.com) with streaming support.

## Features

- Login with email/password
- Session persistence (auto-restore)
- Streaming chat responses
- PoW (Proof of Work) solving via native C library
- Claude Code-style terminal UI

## Requirements

- Node.js 18+
- Python 3
- OpenSSL (`libcrypto`)

## Setup

```bash
# Install dependencies
npm install

# Compile the PoW solver
cc -O3 -shared -fPIC -o deepseek_hash.so deepseek_hash.c -lcrypto

# Start the app
npm start
```

Or set environment variables:

```bash
export DEEPSEEK_EMAIL="your@email.com"
export DEEPSEEK_PASSWORD="yourpassword"
npm start
```

## Usage

1. Enter your DeepSeek email when prompted
2. Enter your password
3. Start chatting!

Commands:
- `/clear` — Clear conversation history

## How it works

- Authenticates via DeepSeek's Android API
- Solves PoW challenges using a compiled C Keccak-136/32 implementation
- Streams responses via Server-Sent Events (SSE)

## Files

| File | Description |
|------|-------------|
| `src/deepseek.ts` | DeepSeek API client with auth, PoW, streaming |
| `src/index.tsx` | Entry point (credential prompt + render) |
| `src/components/App.tsx` | Terminal UI component |
| `solve_pow.py` | PoW solver (Python + C FFI) |
| `deepseek_hash.c` | Keccak-136/32 hash implementation |
| `deepseek_hash.so` | Compiled C library |
