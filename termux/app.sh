#!/usr/bin/env bash
# app.sh — Start the Expo dev server on this phone (Termux session 2).
# Then open Expo Go and connect to exp://127.0.0.1:8081
set -euo pipefail

APP_DIR="$HOME/opencode-mobile"

if [ ! -d "$APP_DIR" ]; then
  echo "==> Cloning opencode-mobile ..."
  git clone https://github.com/911houssem/opencode-mobile.git "$APP_DIR"
fi

cd "$APP_DIR"
git pull --ff-only || true

if [ ! -d node_modules ]; then
  echo "==> Installing dependencies ..."
  npm install
fi

# Give Metro a bit more headroom on a phone
export NODE_OPTIONS="--max-old-space-size=2048"

echo "==> Starting Expo dev server on http://127.0.0.1:8081"
echo "    In Expo Go, open: exp://127.0.0.1:8081"
exec npx expo start --port 8081