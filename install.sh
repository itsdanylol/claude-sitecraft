#!/usr/bin/env bash
# Copies the five skills into your Claude skills folder and installs the browser the scripts use.
# usage: ./install.sh            (personal: ~/.claude/skills)
#        ./install.sh --project  (this project only: ./.claude/skills)
set -euo pipefail
here="$(cd "$(dirname "$0")" && pwd)"
dest="$HOME/.claude/skills"
[ "${1:-}" = "--project" ] && dest="$(pwd)/.claude/skills"
mkdir -p "$dest"
for s in unswappable unslop marketing dataviz run; do
  rm -rf "$dest/$s"
  cp -R "$here/skills/$s" "$dest/$s"
  echo "installed $s -> $dest/$s"
done
if command -v npm >/dev/null; then
  (cd "$here" && npm install --silent && npx playwright install chromium) || echo "Playwright setup failed; run: npm i -g playwright && npx playwright install chromium"
else
  echo "Node.js not found. Install Node 18+, then: npm i -g playwright && npx playwright install chromium"
fi
echo "Done. Ask Claude to build or redo a site, or type /unswappable."
