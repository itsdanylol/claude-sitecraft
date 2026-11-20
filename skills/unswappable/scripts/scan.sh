#!/usr/bin/env bash
# Read-only inventory of a repo for unswappable. Usage: scan.sh [path]
# Prints what the project is, how it builds, what the site contains, and facts to cite.
set -u
root="${1:-.}"
cd "$root" 2>/dev/null || { echo "no such dir: $root"; exit 1; }
sec() { printf '\n== %s ==\n' "$1"; }
ex='-not -path */node_modules/* -not -path */.git/* -not -path */dist/* -not -path */build/* -not -path */.next/* -not -path */.astro/* -not -path */vendor/* -not -path */target/*'

sec "Location"; pwd
if git rev-parse --git-dir >/dev/null 2>&1; then
  echo "remote: $(git remote get-url origin 2>/dev/null || echo none)"
  echo "branch: $(git branch --show-current 2>/dev/null)"
  echo "last commits:"; git log --oneline -n 8 2>/dev/null
  echo "commits: $(git rev-list --count HEAD 2>/dev/null)  first: $(git log --reverse --format=%ad --date=short 2>/dev/null | head -1)  last: $(git log -1 --format=%ad --date=short 2>/dev/null)"
  echo "dirty files: $(git status --porcelain 2>/dev/null | wc -l)"
else echo "not a git repo"; fi

sec "Top level"; ls -A | grep -v '^.git$' | head -60

sec "Manifests and config"
for f in package.json pnpm-lock.yaml yarn.lock package-lock.json bun.lockb pyproject.toml requirements.txt Gemfile go.mod Cargo.toml composer.json \
  astro.config.* next.config.* nuxt.config.* svelte.config.* vite.config.* remix.config.* gatsby-config.* eleventy.config.* .eleventy.js hugo.toml config.toml _config.yml mkdocs.yml docusaurus.config.* \
  tailwind.config.* postcss.config.* tsconfig.json netlify.toml vercel.json wrangler.toml wrangler.jsonc firebase.json CNAME Dockerfile docker-compose.yml .env.example .nvmrc; do
  for m in $f; do [ -e "$m" ] && echo "found: $m"; done
done
ls .github/workflows 2>/dev/null | sed 's/^/workflow: /'

sec "package.json"
if [ -f package.json ] && command -v node >/dev/null; then
  node -e 'const p=require("./package.json");const o=(k)=>p[k]&&console.log(k+": "+JSON.stringify(p[k]));["name","version","description","homepage","license","type"].forEach(o);
  console.log("scripts: "+JSON.stringify(p.scripts||{},null,1));
  console.log("deps: "+Object.keys(p.dependencies||{}).join(", "));
  console.log("devDeps: "+Object.keys(p.devDependencies||{}).join(", "))'
fi

sec "Docs that state facts"
for f in README* readme* CHANGELOG* CONTRIBUTING* LICENSE* docs; do [ -e "$f" ] && echo "found: $f"; done
[ -f README.md ] && { echo "--- README.md head ---"; head -60 README.md; }

sec "Site entry points"
find . -maxdepth 4 $ex \( -name 'index.html' -o -name '404.html' -o -name 'robots.txt' -o -name 'sitemap*.xml' -o -name 'manifest.webmanifest' -o -name 'favicon.*' \) 2>/dev/null | head -30

sec "Pages and routes"
for d in src/pages pages app src/app src/routes routes content src/content docs public; do
  [ -d "$d" ] && { echo "[$d]"; find "$d" -type f $ex 2>/dev/null | head -50; }
done

sec "Styles and tokens"
find . -type f $ex \( -name '*.css' -o -name '*.scss' -o -name '*.sass' -o -name '*.less' \) 2>/dev/null | head -20
grep -rhoE '^\s*--[a-zA-Z0-9-]+:\s*[^;]+' --include=*.css . 2>/dev/null | grep -v node_modules | sort -u | head -60
grep -rhoE 'font-family:[^;}]+' --include=*.css --include=*.html . 2>/dev/null | grep -v node_modules | sort | uniq -c | sort -rn | head -8
grep -rhoE '#[0-9a-fA-F]{6}\b' --include=*.css --include=*.html --include=*.tsx --include=*.jsx --include=*.vue --include=*.svelte . 2>/dev/null | grep -v node_modules | tr 'A-F' 'a-f' | sort | uniq -c | sort -rn | head -12

sec "Components"
find . -type f $ex \( -name '*.tsx' -o -name '*.jsx' -o -name '*.vue' -o -name '*.svelte' -o -name '*.astro' \) 2>/dev/null | head -40

sec "Images and assets"
find . -type f $ex \( -iname '*.png' -o -iname '*.jpg' -o -iname '*.jpeg' -o -iname '*.webp' -o -iname '*.avif' -o -iname '*.svg' -o -iname '*.mp4' -o -iname '*.woff2' \) -size +0 2>/dev/null | head -40
echo "largest assets:"; find . -type f $ex \( -iname '*.png' -o -iname '*.jpg' -o -iname '*.jpeg' -o -iname '*.webp' -o -iname '*.mp4' \) -printf '%s %p\n' 2>/dev/null | sort -rn | head -5

sec "Facts in the code worth citing"
grep -rnEi '(price|pricing|\$[0-9]+|€[0-9]+|per month|/mo\b|free trial|plan)' --include=*.html --include=*.md --include=*.mdx --include=*.tsx --include=*.jsx --include=*.vue --include=*.json . 2>/dev/null | grep -v -e node_modules -e lock | head -15
grep -rnEoi '(mailto:[^"'"'"' )]+|tel:[^"'"'"' )]+|https?://(twitter|x|github|linkedin|instagram|youtube|discord)[^"'"'"' )]*)' . --include=*.html --include=*.tsx --include=*.jsx --include=*.md --include=*.vue 2>/dev/null | grep -v node_modules | sort -u | head -12
grep -rnE '(lorem ipsum|TODO|FIXME|\[X\]|123,456|example\.com|your-?(name|email|company))' -i . --include=*.html --include=*.md --include=*.tsx --include=*.jsx --include=*.vue --include=*.json 2>/dev/null | grep -v -e node_modules -e lock | head -15

sec "Tests and scripts"
find . -maxdepth 3 $ex \( -name '*.test.*' -o -name '*.spec.*' -o -name 'Makefile' -o -name 'justfile' \) 2>/dev/null | head -10

sec "Done"
echo "Read-only scan complete. Open the files above before claiming anything about them."
