# Stacks

## Default ports

| Stack | Port | Command |
| --- | --- | --- |
| Vite (React, Vue, Svelte, vanilla) | 5173 | `npm run dev` |
| Next.js | 3000 | `npm run dev` |
| Astro | 4321 | `npm run dev` |
| Nuxt | 3000 | `npm run dev` |
| Angular | 4200 | `npm run start` |
| SvelteKit | 5173 | `npm run dev` |
| Create React App | 3000 | `npm start` |
| Expo / React Native web | 8081 | `npm run web` |
| Python http.server | any | `python -m http.server <port> --bind 127.0.0.1 --directory <root>` |
| `npx serve` | 3000 | `npx --yes serve <root> -l <port>` |
| Docusaurus | 3000 | `npm run start` |
| VuePress | 8080 | `npm run dev` |
| Hugo | 1313 | `hugo server` |
| Jekyll | 4000 | `bundle exec jekyll serve` |
| Laravel | 8000 | `php artisan serve --port=<port>` |
| Rails | 3000 | `bin/rails server -p <port>` |
| Django | 8000 | `python manage.py runserver <port>` |
| FastAPI / uvicorn | 8000 | `uvicorn main:app --port <port>` |
| Go (net/http, chi, gin) | 8080 | `go run .` |
| Rust (trunk for WASM) | 8080 | `trunk serve --port <port>` |
| Rust (axum, actix) | 3000 / 8080 | `cargo run` |

Ports are defaults, not promises. The script probes and takes the next free one, then sets `PORT` in the child environment, which Vite, Next, Astro, Express and most Node servers read.

## Telling Vite from a built site

- `vite.config.*` plus a `src/` with `.jsx/.tsx/.vue/.svelte` means dev server.
- `dist/index.html` with hashed asset names (`index-a1b2c3.js`) means a build exists. Serve `dist/` directly; it is faster, and it is what the user will ship.
- `dist/assets/*.map` present means it was built for debugging, not production. Say so before judging performance.

## Failures and what they mean

| Log line | Cause | Fix |
| --- | --- | --- |
| `EADDRINUSE` | port bound | let the script step up, or kill the holder |
| `Cannot find module 'x'` | dependencies missing | `npm install` (say it ran) |
| `Unknown command "dev"` | no such script | use `--detect`, then the script it names |
| `Failed to resolve import` | path or alias wrong | a real build error, not a serving error, hand it back |
| `EACCES` on port 80/443 | privileged port | use a high port, never admin |
| `digital envelope routines::unsupported` | old Node vs new OpenSSL | `NODE_OPTIONS=--openssl-legacy-provider`, or upgrade |
| Blank page, clean log | client-side error or wrong base path | open `verify.mjs`, read the console errors |
| 404 on assets | served from the wrong root, or a `base` path | serve the folder that contains `index.html` |

## Reading a dev server's first output

Most dev servers print three things that matter: `Local: http://localhost:<port>`, the network URL, and whether it needs a rebuild. Trust the printed port over the flag; frameworks occasionally ignore `PORT` and pick their own. If the printed port differs from the one the script is polling, the poll will time out while the site is actually up, so the log is the tiebreaker.

## What to look at once it runs

- The URL you asked for returns the page you meant, not the router's fallback.
- At 1440 wide: the first screen composes as a whole, no dead band, no horizontal scroll.
- At 375 wide: nothing overlaps, no text under 11px, touch targets at least 44px.
- Console: no errors, no failed requests. `sitecraft/scripts/verify.mjs` captures both across widths.
- Fonts and images: loaded, no layout shift after they arrive.
