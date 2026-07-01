#!/bin/bash
# Copyright © 2026 Tucker Peters. Authored independently, in the author's personal time.
# Licensed under the Apache License, Version 2.0.
#
# Anchor — AI setup for macOS.
# Double-click this file to install the tools that let Anchor use your Claude or
# ChatGPT subscription. Anchor works fully WITHOUT this; it only adds AI suggestions.
# Safe to re-run. It never uploads anything and never touches your documents.

set -uo pipefail

BOLD=$'\033[1m'; DIM=$'\033[2m'; GRN=$'\033[32m'; YEL=$'\033[33m'; RED=$'\033[31m'; RST=$'\033[0m'
say()  { printf "%s\n" "$*"; }
ok()   { printf "${GRN}✓${RST} %s\n" "$*"; }
warn() { printf "${YEL}!${RST} %s\n" "$*"; }
err()  { printf "${RED}✗${RST} %s\n" "$*"; }
step() { printf "\n${BOLD}%s${RST}\n" "$*"; }

clear 2>/dev/null || true
say "${BOLD}Anchor — connect AI (optional)${RST}"
say "${DIM}This sets up your Claude or ChatGPT subscription for use inside Anchor.${RST}"
say "${DIM}You only do this once. Nothing here is uploaded. Press Ctrl-C to cancel.${RST}"

# ── 1. Xcode Command Line Tools (needed by Homebrew) ────────────────────────────
step "1/5  Checking developer tools…"
if ! xcode-select -p >/dev/null 2>&1; then
  warn "Installing Apple Command Line Tools (a system dialog may appear)…"
  xcode-select --install >/dev/null 2>&1 || true
  say "    Finish that install if prompted, then run this again."
else
  ok "Command Line Tools present."
fi

# ── 2. Homebrew ────────────────────────────────────────────────────────────────
step "2/5  Checking Homebrew (the macOS installer)…"
if ! command -v brew >/dev/null 2>&1; then
  # Common install locations may not be on PATH yet
  for b in /opt/homebrew/bin/brew /usr/local/bin/brew; do [ -x "$b" ] && eval "$($b shellenv)"; done
fi
if ! command -v brew >/dev/null 2>&1; then
  warn "Installing Homebrew…"
  NONINTERACTIVE=1 /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)" || { err "Homebrew install failed. See https://brew.sh"; exit 1; }
  for b in /opt/homebrew/bin/brew /usr/local/bin/brew; do [ -x "$b" ] && eval "$($b shellenv)"; done
fi
command -v brew >/dev/null 2>&1 && ok "Homebrew ready." || { err "Homebrew still not found."; exit 1; }

# ── 3. Node ────────────────────────────────────────────────────────────────────
step "3/5  Checking Node…"
if ! command -v node >/dev/null 2>&1; then
  warn "Installing Node…"; brew install node || { err "Node install failed."; exit 1; }
fi
ok "Node $(node --version 2>/dev/null)."

# ── 4. Choose and install an AI agent ──────────────────────────────────────────
step "4/5  Which subscription do you have?"
say "   ${BOLD}1${RST}) Claude  (Claude Pro / Max)  →  installs Claude Code"
say "   ${BOLD}2${RST}) ChatGPT (Plus / Pro)        →  installs Codex"
say "   ${BOLD}3${RST}) Both"
printf "Choose 1, 2, or 3 [1]: "; read -r choice || true; choice=${choice:-1}

install_claude() {
  if command -v claude >/dev/null 2>&1; then ok "Claude Code already installed."; return; fi
  warn "Installing Claude Code…"
  npm install -g @anthropic-ai/claude-code || { err "Could not install Claude Code."; return 1; }
  ok "Claude Code installed."
}
install_codex() {
  if command -v codex >/dev/null 2>&1; then ok "Codex already installed."; return; fi
  warn "Installing Codex…"
  npm install -g @openai/codex || brew install codex || { err "Could not install Codex."; return 1; }
  ok "Codex installed."
}

WANT_CLAUDE=0; WANT_CODEX=0
case "$choice" in
  1) WANT_CLAUDE=1 ;;
  2) WANT_CODEX=1 ;;
  3) WANT_CLAUDE=1; WANT_CODEX=1 ;;
  *) WANT_CLAUDE=1 ;;
esac
[ "$WANT_CLAUDE" = 1 ] && install_claude
[ "$WANT_CODEX" = 1 ] && install_codex

# ── 5. Sign in ─────────────────────────────────────────────────────────────────
step "5/5  Sign in to your subscription"
if [ "$WANT_CLAUDE" = 1 ] && command -v claude >/dev/null 2>&1; then
  say "A browser window will open. Sign in with your ${BOLD}Claude${RST} account."
  say "${DIM}(In Claude Code, type /login if it doesn't prompt automatically, then /exit when done.)${RST}"
  printf "Press Return to start Claude sign-in… "; read -r _ || true
  claude || true
fi
if [ "$WANT_CODEX" = 1 ] && command -v codex >/dev/null 2>&1; then
  say "Now sign in with your ${BOLD}ChatGPT${RST} account (choose \"Sign in with ChatGPT\")."
  printf "Press Return to start Codex sign-in… "; read -r _ || true
  codex login || true
fi

step "Done"
command -v claude >/dev/null 2>&1 && ok "claude: $(command -v claude)"
command -v codex  >/dev/null 2>&1 && ok "codex:  $(command -v codex)"
say "${GRN}You can close this window and open Anchor.${RST} In Anchor, go to the AI chip → Test connection."
say "${DIM}If Anchor still says \"Standard review\", quit and reopen it so it picks up the new tools.${RST}"
printf "\nPress Return to close… "; read -r _ || true
