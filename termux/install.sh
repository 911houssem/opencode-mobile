#!/usr/bin/env bash
# install.sh — Set up Termux to run OpenCode server + this Expo app
# Requires: Termux from F-Droid (not Play Store), Android aarch64.
set -euo pipefail

echo "==> Updating Termux packages ..."
pkg update -y
pkg upgrade -y

echo "==> Installing base packages (nodejs for Expo, git, etc.) ..."
pkg install -y nodejs-lts git curl bash tar coreutils

echo "==> Installing OpenCode CLI (native Termux aarch64 build) ..."
# Uses the official OpenCode release + a small glibc bridge so it runs on
# Android/Bionic. Installs the latest upstream version natively (no proot).
curl -fsSL https://raw.githubusercontent.com/retired64/opencode-termux/main/install.sh | bash

echo "==> Verifying OpenCode ..."
opencode --version

echo ""
echo "Done. Next steps:"
echo "  1) Configure your provider API keys (see README)."
echo "  2) Run: bash ~/opencode-mobile/termux/server.sh   (session 1)"
echo "  3) Run: bash ~/opencode-mobile/termux/app.sh      (session 2)"