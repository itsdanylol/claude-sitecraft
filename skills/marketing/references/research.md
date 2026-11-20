# Research

Two jobs: find out what the thing does, and find out how the category already talks about it. The first comes from the source. The second comes from other people's words.

## Ladder for a thin source

When `crawl.mjs` returns almost nothing, work down this ladder in order and stop as soon as the material is enough.

1. **Linked pages.** The site's own nav, footer, `/pricing`, `/docs`, `/changelog`, `/about`, `/security`, `/terms`. The terms page is where limits are stated honestly.
2. **Git history.** `git log --oneline -50`, `git shortlog -sn`. Merge messages and issue titles describe what the product does in the author's own words.
3. **The code's own strings.** `grep -rn "error\|notice\|placeholder" src | head -40`. UI strings and error messages are written for the user, which makes them the best raw copy in the repo.
4. **Run it.** A real screen or a real CLI session beats any description. `--help` output, a first run, the empty state.
5. **Package registries.** npm, PyPI, crates.io, providers of the thing. Downloads and dependents are weak proof; the description and the README are the point.
6. **The Wayback Machine.** `https://web.archive.org/web/2024*/example.com` shows how the product described itself when it was less polished, often more plainly.
7. **Wider web.** Reviews, launch posts, forum threads, changelogs on third-party sites. Search the product name in quotes.
8. **The category.** If the product still cannot be described, describe the category first, then find the one difference. The difference is the copy.

## Category search

Do these as separate searches and keep what you find verbatim. Phrases, not paraphrases; the whole point is to write in their words, not yours.

- `<product> pricing` — what the market charges, and how it presents it.
- `<category> alternatives` — the comparison pages. Note which claims every competitor makes. Those are the claims you cannot win with.
- `<category> site:reddit.com` and `<category> site:news.ycombinator.com` — complaints, in the language of the complaint. This is where pain lines come from.
- `"<product name>"` in quotes — mentions, coverage, the sentence other people use to describe it.
- `<category> reviews`, `<category> vs` — the objections buyers raise before they say yes.
- `<competitor name> changelog` — what they shipped recently, so your claims are not about to be everyone's.

For each finding record: the exact phrase, the URL, the date, and whether it is about this product, a competitor, or the category.

## Labeling

Every line in the dossier carries one of:

- `found` — read it in a named source, with the path or URL.
- `inferred` — reasoned from code, config or structure. Say what it was inferred from.
- `category` — true of the category, not yet true of this product.
- `unknown` — a real gap. These drive the questions you ask.

Never promote a label. An `inferred` fact does not become a number on the page. A `category` assumption does not become a claim. The only thing that may appear in customer-facing copy as a number is `found` with a date, or `verified` because you ran it.

## Questions, when you have to ask

Ask only for gaps research could not close: a real customer count, a benchmark, a launch date, a legal entity, a trademark clearance. One message, every question at once, each with your best guess attached so a one-word answer is enough. Anything you can find yourself, find yourself.

## Etiquette

- Respect `robots.txt`. Do not crawl behind a login, and do not use an account you were not given.
- Never copy text from a competitor's site into the product's copy. Take the shape of the argument, never the sentence.
- Do not read secrets, `.env` files, customer data or private keys found in a repo. If a public repo contains them, that is a finding to report, not material to use.
- Quote a review or a forum post as a source for the pain, not as a testimonial. Testimonials need a name and permission.
- If a fact is about to go on a public page and you are unsure, mark it `needs:` and let a human confirm.
