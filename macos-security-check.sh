#!/usr/bin/env bash
set -euo pipefail

RED=$'\033[31m'
YELLOW=$'\033[33m'
GREEN=$'\033[32m'
BLUE=$'\033[34m'
RESET=$'\033[0m'

banner() {
  local now user host
  now="$(date '+%Y-%m-%d %H:%M:%S %Z')"
  user="$(id -un)"
  host="$(hostname -s 2>/dev/null || hostname)"
  printf '\n%s============================================================%s\n' "$BLUE" "$RESET"
  printf '%s  macOS SECURITY CHECK%s\n' "$BLUE" "$RESET"
  printf '%s  Read-only local risk scan%s\n' "$BLUE" "$RESET"
  printf '%s  Time: %s%s\n' "$BLUE" "$now" "$RESET"
  printf '%s  Target: %s@%s%s\n' "$BLUE" "$user" "$host" "$RESET"
  printf '%s============================================================%s\n\n' "$BLUE" "$RESET"
}

banner

section() {
  printf '\n%s== %s ==%s\n' "$BLUE" "$1" "$RESET"
}

ok() {
  printf '%s[OK]%s %s\n' "$GREEN" "$RESET" "$1"
}

warn() {
  printf '%s[WARN]%s %s\n' "$YELLOW" "$RESET" "$1"
}

info() {
  printf '%s[INFO]%s %s\n' "$BLUE" "$RESET" "$1"
}

section "System"
info "User: $(id -un)"
info "Host: $(hostname -s 2>/dev/null || hostname)"
info "OS: $(sw_vers -productVersion 2>/dev/null || uname -a)"
info "Shell: ${SHELL:-unknown}"

section "Python"
if command -v python3 >/dev/null 2>&1; then
  python3 - <<'PY'
import importlib.util, site, sys
mods = ["litellm", "pydantic", "requests"]
print(f"Interpreter: {sys.executable}")
for name in mods:
    print(f"{name}: {'present' if importlib.util.find_spec(name) else 'absent'}")
print("Site-packages:")
for p in site.getsitepackages():
    print(f"  {p}")
print(f"User site: {site.getusersitepackages()}")
PY
else
  warn "python3 not found"
fi

section "Node"
if command -v node >/dev/null 2>&1; then
  info "Node: $(node -v 2>/dev/null || true)"
fi
if command -v npm >/dev/null 2>&1; then
  info "npm: $(npm -v 2>/dev/null || true)"
fi

section "LaunchAgents and Daemons"
for dir in "$HOME/Library/LaunchAgents" /Library/LaunchAgents /Library/LaunchDaemons; do
  [ -d "$dir" ] || continue
  info "Scanning $dir"
  find "$dir" -maxdepth 1 -name '*.plist' -print 2>/dev/null | while IFS= read -r plist; do
    label=$(plutil -extract Label raw -o - "$plist" 2>/dev/null || basename "$plist")
    program=$(plutil -extract Program raw -o - "$plist" 2>/dev/null || true)
    args=$(plutil -extract ProgramArguments json -o - "$plist" 2>/dev/null || true)
    if [[ "$plist" == *"com.lbyczf.cfw.helper.plist" ]] || [[ "$plist" == *"sunlogin"* ]] || [[ "$plist" == *"teamviewer"* ]]; then
      warn "$label -> $program $args"
    fi
  done
done

section "Shell Startup"
for f in "$HOME/.zshrc" "$HOME/.zprofile" "$HOME/.bashrc" "$HOME/.bash_profile" "$HOME/.profile"; do
  [ -f "$f" ] || continue
  if rg -n --hidden -i 'curl\s+\S+\s*\|\s*sh|curl\s+\S+\s*\|\s*bash|wget\s+\S+\s*\|\s*sh|eval\s*\$\(|base64\s+-d|osascript|launchctl|chmod\s+\+x\s+\S+|sudo\s+sh' "$f" >/dev/null 2>&1; then
    warn "Suspicious pattern in $f"
    rg -n --hidden -i 'curl\s+\S+\s*\|\s*sh|curl\s+\S+\s*\|\s*bash|wget\s+\S+\s*\|\s*sh|eval\s*\$\(|base64\s+-d|osascript|launchctl|chmod\s+\+x\s+\S+|sudo\s+sh' "$f" || true
  else
    ok "$f looks clean"
  fi
done

section "Current Project"
if [ -f package.json ]; then
  if rg -n '"(preinstall|install|postinstall|prepare|prepack|postpack|prepublish|postpublish)"' package.json >/dev/null 2>&1; then
    warn "Lifecycle scripts found in package.json"
    rg -n '"(preinstall|install|postinstall|prepare|prepack|postpack|prepublish|postpublish)"' package.json || true
  else
    ok "No npm lifecycle scripts in package.json"
  fi
fi

section "High-Risk Files"
find "$HOME/Library/Python" "$HOME/Library/Caches/pip" "$HOME/.local/share/virtualenvs" "$HOME/.pyenv/versions" \
  -iname '*litellm*' -o -name '*.pth' 2>/dev/null | sed -n '1,80p' || true

section "Done"
ok "Review warnings manually. This script is read-only."
