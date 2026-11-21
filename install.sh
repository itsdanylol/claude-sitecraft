#!/usr/bin/env bash
# Copies the five skills into your Claude skills folder and installs the browser the scripts use.
# usage: ./install.sh                    (personal: ~/.claude/skills)
#        ./install.sh --project          (this project only: ./.claude/skills)
#        ./install.sh --force            (also replace skills of the same name that sitecraft did not install)
#        ./install.sh --skip-browser     (copy the skills only)
set -euo pipefail
here="$(cd "$(dirname "$0")" && pwd)"
dest="$HOME/.claude/skills"
force=0
browser=1
for arg in "$@"; do
  case "$arg" in
    --project) dest="$(pwd)/.claude/skills" ;;
    --force) force=1 ;;
    --skip-browser) browser=0 ;;
    *) echo "unknown option: $arg" >&2; exit 2 ;;
  esac
done
mkdir -p "$dest"

# Every copied skill gets this marker, so a later run knows it may replace it.
marker=".installed-by-sitecraft"
skipped=()
for s in sitecraft unslop marketing dataviz run; do
  target="$dest/$s"
  if [ -e "$target" ] && [ ! -e "$target/$marker" ] && [ "$force" -ne 1 ]; then
    skipped+=("$s")
    echo "skipped $s: $target already exists and was not installed by sitecraft"
    continue
  fi
  rm -rf "$target"
  cp -R "$here/skills/$s" "$target"
  echo "sitecraft $(date +%Y-%m-%d)" > "$target/$marker"
  echo "installed $s -> $target"
done

if [ "${#skipped[@]}" -gt 0 ]; then
  echo
  echo "Kept your existing ${skipped[*]}. Sitecraft falls back to its own steps when a sibling skill is different."
  echo "To replace them with sitecraft's versions, run again with --force."
fi

# Playwright goes into <skills>/.sitecraft-deps, which every script looks in (see scripts/_pw.mjs).
if [ "$browser" -eq 1 ]; then
  deps="$dest/.sitecraft-deps"
  if command -v npm >/dev/null; then
    mkdir -p "$deps"
    [ -f "$deps/package.json" ] || echo '{ "name": "sitecraft-deps", "private": true }' > "$deps/package.json"
    if (cd "$deps" && npm install --silent --no-audit --no-fund playwright@^1.48.0 && npx playwright install chromium); then
      echo "Playwright and Chromium installed in $deps"
    else
      echo "Playwright setup failed. Run: cd \"$deps\" && npm install playwright && npx playwright install chromium"
    fi
  else
    echo "Node.js not found. Install Node 18+, then run this script again."
  fi
fi
echo "Done. Ask Claude to build or redo a site, or type /sitecraft."
