# PRD: PHP CRUD AI CLI Tool (Zero-Install NPX)

## 1. Overview
A lightweight, zero-install interactive CLI tool published to npm that assists students building PHP CRUD projects in lab environments. It connects to the Gemini API, maintains chat memory in RAM during the session, reads local project files via commands, and allows switching models or updating API keys dynamically.

## 2. Key Features
- **Zero-Install (`npx`)**: Runs instantly via `npx` without leaving local `node_modules` folders on lab PCs.
- **First-run API Key Prompt**: Automatically prompts the user for their Gemini API key if not already configured, saving it securely in `~/.phpcrud-ai-config.json`.
- **Interactive REPL Loop**: Chat naturally with the AI assistant.
- **Special Commands**:
  - `/newpi`: Reset or update the Gemini API key.
  - `/models`: Switch between Gemini models (e.g., `gemini-2.5-flash`, `gemini-1.5-pro`).
  - `/cat <file>`: Read and feed a local file's content into the chat context so the AI can analyze PHP code.
- **Session Memory**: Retains conversation history in RAM during the active session.

## 3. Architecture & Tech Stack
- **Language**: JavaScript (Node.js ES Modules)
- **Dependencies**: `@google/genai`
- **Config Storage**: User home directory config file (`os.homedir()`)
