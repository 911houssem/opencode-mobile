#!/usr/bin/env bash
# server.sh — Start the OpenCode API server on this phone (Termux session 1).
# The app connects to http://localhost:4096 (same device).
set -euo pipefail

# Provider API keys / config live in ~/.config/opencode/opencode.json
# or in environment variables (e.g. ANTHROPIC_API_KEY).

mkdir -p "$HOME/workspace"
cd "$HOME/workspace"

echo "==> Starting OpenCode server on http://localhost:4096"
# --mdns also advertises opencode.local so other devices can auto-connect
exec opencode serve --port 4096 --mdns