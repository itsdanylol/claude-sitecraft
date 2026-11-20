# Quality

Run this after the blind review passes. A check you did not run is reported as not checked, never as passed.

```
node <skill>/scripts/with-server.mjs --server "npx --yes serve site -l 4173" --port 4173 -- node <skill>/scripts/verify.mjs http://localhost:4173 --out .verify
```

It covers six widths, screenshots, overflow, dead bands, clipped text, placeholders, dead links, inert controls, head and SEO tags, page weight against budgets, 24px targets, removed focus rings, robots.txt, sitemap.xml, a real 404, SRI and render-blocking scripts. Read its findings, then look at the screenshots yourself.

## By hand

- **Keyboard.** Tab through the whole page. The order is logical, focus is always visible and never hidden under a sticky bar, and there are no traps.
- **Contrast.** Text is 4.5:1 and large text and UI are 3:1, on every ground the concept uses.
- **Motion.** With reduced motion on, every screen is a finished still frame. Nothing flashes more than three times a second.
- **WCAG 2.2.**
  - Targets are 24px or more (44px for touch).
  - Anything done by dragging has a single-tap alternative.
  - Help sits in the same place on every page.
  - Logins accept paste.
- **SEO.**
  - A unique title (about 50–60 characters) and description (about 150).
  - A canonical URL.
  - Open Graph tags and an image.
  - JSON-LD that describes only visible content.
  - Real 404s.
  - Content in the HTML, not only rendered by JS.
- **Performance.**
  - LCP 2.5 s or less, INP 200 ms or less, CLS 0.1 or less.
  - Budgets: total 1.5 MB, JS 300 KB, CSS 100 KB, fonts 100 KB, images 500 KB.
  - The LCP image uses `fetchpriority="high"` and is never lazy-loaded.
  - Run Lighthouse if it is available.
- **Security.**
  - HTTPS with no mixed content.
  - A CSP in report-only mode first.
  - nosniff, a referrer policy, and SRI or self-hosting for third-party code.
  - `npm audit` when there are dependencies.
- **Function.** Every link and button does something, forms show success and error states, and the console is clean.
- **Honesty.**
  - Run the `marketing` copy checklist on the final page.
  - Every placeholder is marked and listed.
  - Legal pages are offered as drafts for a lawyer to review.

## Report

For each area, one line: what was checked, how, the result with numbers, its severity, and what is left. Then list what the user must supply.
