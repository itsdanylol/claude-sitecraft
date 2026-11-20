# Fallbacks


Use these when the named skill is not installed. Each one is the whole procedure for its step.

**A. Copy, when `marketing` is missing.** Write from the shared direction, not from the layout. For each page: one `h1` that names what the product does for whom, in words that could not fit a competitor; a subhead that adds the how, not a repeat; three to five sections, each with a claim and the evidence beside it; one primary action named by what the reader gets, one secondary at most. Every claim carries proof, or the claim gets smaller. Ban: "supercharge", "seamless", "unlock", "revolutionize", "game-changing", "AI-powered" on everything, exclamation marks, greeting headlines, "Trusted by 10,000+" without a source, trailing periods on labels. Write the meta title (50 to 60 characters) and description (about 150) per page, alt text as a description of the picture not of the keyword, and the 404 and empty states. If `man-writing` is installed, load it and write through it. Keep every unverified fact marked `[needs: ...]` in the page and listed in the report.

**B. Charts, when `dataviz` is missing.** One main chart per screen, clearly the largest thing that shows data; anything else is a ranked list or a short table, never a second chart of the same size. Pick the type from the data: trend is a line, comparison is bars, share is one stacked bar, a single goal is a progress bar. Muted grid, muted mono labels, no uppercase axis labels, no rainbow inside one series, one accent on the one series or month that matters and neutral steps for the rest. Numbers in one format with `tabular-nums`. Charts ship as inline SVG or as CSS bars, no chart library for four bars, and every figure carries its unit and its comparison. If the data is placeholder, say so in the page and in the report.

**C. Run it locally, when `run` is missing.** Static folder: `npx --yes serve . -l 4173` or `python -m http.server 4173`. A Vite or Next app: `npm run dev`. Start it as a background process, wait for the port to answer, then point the browser at it. Stop it when verification is done.

**D. Look at it, when no built-in browser exists.** The scripts need Playwright with Chromium: run `npm install && npx playwright install chromium` once in the skill's repo, or `npm i -g playwright && npx playwright install chromium`. Run:

```
node <skill folder>/scripts/with-server.mjs --server "npx --yes serve site -l 4173" --port 4173 -- node <skill folder>/scripts/verify.mjs http://localhost:4173 --out .verify
```

Drop the `with-server.mjs` part if the server is already running. It loads every page at 375, 414, 575, 768, 1024 and 1440 wide, screenshots each, and reports horizontal overflow, console errors, failed requests, missing `alt`, unlabeled inputs, heading order, the `h1` count, targets under 24px, head and SEO tags, page weight against budgets, removed focus rings, and whether robots.txt, sitemap.xml and a real 404 exist. Read the screenshots with your own eyes as well: overlap, clipped text, dead bands and a layout that breaks at 430 wide are things a script cannot see. If Playwright is missing, `npm i -g playwright && npx playwright install chromium` once.

