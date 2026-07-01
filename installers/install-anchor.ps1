# Copyright © 2026 Tucker Peters. Authored independently, in the author's personal time.
# Licensed under the Apache License, Version 2.0.
#
# Anchor - AI setup for Windows.  (EXPERIMENTAL: written carefully but not yet tested on a
# real Windows machine - please report issues.)
#
# Right-click this file -> "Run with PowerShell", OR open PowerShell and run:
#     Set-ExecutionPolicy -Scope Process Bypass -Force; .\install-anchor.ps1
#
# Installs the tools that let Anchor use your Claude or ChatGPT subscription. Anchor works
# fully WITHOUT this; it only adds AI suggestions. Nothing is uploaded. Safe to re-run.

$ErrorActionPreference = 'Continue'
function Say($m)  { Write-Host $m }
function OK($m)   { Write-Host "OK  $m" -ForegroundColor Green }
function Warn($m) { Write-Host "!   $m" -ForegroundColor Yellow }
function Err($m)  { Write-Host "x   $m" -ForegroundColor Red }
function Step($m) { Write-Host "`n$m" -ForegroundColor White }
function Have($c) { return [bool](Get-Command $c -ErrorAction SilentlyContinue) }

Write-Host "Anchor - connect AI (optional)" -ForegroundColor White
Say "This sets up your Claude or ChatGPT subscription for use inside Anchor."
Say "You only do this once. Nothing here is uploaded. Press Ctrl-C to cancel."

# 1. winget
Step "1/4  Checking winget (the Windows installer)..."
if (-not (Have 'winget')) {
  Err "winget was not found. Install 'App Installer' from the Microsoft Store, then run this again."
  Read-Host "Press Enter to close"; exit 1
}
OK "winget present."

# 2. Node
Step "2/4  Checking Node..."
if (-not (Have 'node')) {
  Warn "Installing Node..."
  winget install --id OpenJS.NodeJS.LTS -e --accept-source-agreements --accept-package-agreements
  $env:Path = [System.Environment]::GetEnvironmentVariable('Path','Machine') + ';' + [System.Environment]::GetEnvironmentVariable('Path','User')
}
if (Have 'node') { OK ("Node " + (node --version)) } else { Err "Node still not found; open a new window and re-run."; }

# 3. Choose + install agent
Step "3/4  Which subscription do you have?"
Say "   1) Claude  (Claude Pro / Max)  -> installs Claude Code"
Say "   2) ChatGPT (Plus / Pro)        -> installs Codex"
Say "   3) Both"
$choice = Read-Host "Choose 1, 2, or 3 [1]"
if ([string]::IsNullOrWhiteSpace($choice)) { $choice = '1' }

function Install-Claude {
  if (Have 'claude') { OK "Claude Code already installed."; return }
  Warn "Installing Claude Code..."
  npm install -g @anthropic-ai/claude-code
  if (Have 'claude') { OK "Claude Code installed." } else { Err "Could not install Claude Code." }
}
function Install-Codex {
  if (Have 'codex') { OK "Codex already installed."; return }
  Warn "Installing Codex..."
  npm install -g @openai/codex
  if (Have 'codex') { OK "Codex installed." } else { Err "Could not install Codex." }
}

$wantClaude = $false; $wantCodex = $false
switch ($choice) {
  '1' { $wantClaude = $true }
  '2' { $wantCodex = $true }
  '3' { $wantClaude = $true; $wantCodex = $true }
  default { $wantClaude = $true }
}
if ($wantClaude) { Install-Claude }
if ($wantCodex)  { Install-Codex }

# 4. Sign in
Step "4/4  Sign in to your subscription"
if ($wantClaude -and (Have 'claude')) {
  Say "A browser window will open. Sign in with your Claude account (type /login if needed, /exit when done)."
  Read-Host "Press Enter to start Claude sign-in"
  claude
}
if ($wantCodex -and (Have 'codex')) {
  Say "Now sign in with your ChatGPT account (choose 'Sign in with ChatGPT')."
  Read-Host "Press Enter to start Codex sign-in"
  codex login
}

Step "Done"
if (Have 'claude') { OK ("claude: " + (Get-Command claude).Source) }
if (Have 'codex')  { OK ("codex:  " + (Get-Command codex).Source) }
Say "You can close this window and open Anchor. In Anchor: AI chip -> Test connection."
Say "If Anchor still says 'Standard review', quit and reopen it so it picks up the new tools."
Read-Host "Press Enter to close"
