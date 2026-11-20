# Craft

The concept makes the page memorable. Craft makes it hold up. These are the defaults, and the concept may break any of them on purpose, with a reason written in the brief.

## Stack

- Pick the smallest stack that works. For a few pages, plain HTML and CSS with one stylesheet. For many pages built from Markdown, Astro or Eleventy. For real interactivity, Vite plus the project's framework. For a shop, a hosted platform.
- In an existing codebase, match its framework and components. Do not migrate.
- Ship `404.html`, `robots.txt` with a `Sitemap:` line, `sitemap.xml`, a favicon as SVG, a 1200×630 OG image, and `_headers` (CSP report-only first, nosniff, referrer policy, caching).
- Put tokens in CSS custom properties before building components: the palette roles, the type scale, space on a 4px grid, radii, and one easing curve.

## Grid

- Use 12 columns with a content width of 1120–1360 and gutters of 24–40. On a phone, use 4 columns at 16–20 from the edge.
- Everything starts on a column line. Three or four alignment lines look designed. One edge per block looks assembled.
- Break the grid only over a real grid, so the break reads as intended.
- Keep reading text at 60–72 characters, even when the layout is wide.

## Type

- Type carries most of the vibe. Use one display face with character and one text face or mono. A third face is allowed only when it is the product's notation. Write down why each was chosen. Never use Inter or a system font by reflex.
- Scale contrast is real: the display size is at least three times the body size on desktop and about twice on a phone. Use a ratio of 1.25 for apps and 1.333 or more for marketing pages.
- Leading: body 1.5–1.65, display 0.85–1.1. Tighten tracking on display sizes, never on small text.
- `text-wrap: balance` on headings and `pretty` on paragraphs. Use real quotes, en dashes, non-breaking spaces before units, and tabular figures for numbers.
- Self-host fonts in woff2, preload only the critical weight, and keep fonts under 100 KB.

## Color

- Name the roles: ground, ink, muted, line and accent. Use a tinted ramp, not a list of colors.
- Check every text and ground pair against 4.5:1, or 3:1 for large text. This matters most when the concept changes the ground.
- Hierarchy must hold in grayscale.

## Rhythm

- Space sections on a scale, such as 96, 128 and 160 on desktop and 64, 80 and 96 on a phone.
- Never put three sections of the same shape in a row. Vary density: dense, then airy, then dense.
- Give each screenful one focal point.
- Structure the page as an arc: the start promises, the middle proves, and the end asks for one action.

## Components

- **Buttons:** 44–56 tall, one primary style and one quiet style, a press scale of 0.97–0.98, a visible focus ring.
- **Cards:** a border or a shadow, not both. Nested radius is the outer radius minus the padding.
- **Forms:** inputs 44–56 tall, labels above, errors written in words.
- **Navigation:** the logo, a few links, one button. On a phone, recompose it rather than squeezing it.

## HTML, CSS and JS

- Use semantic landmarks and one `h1`. Links are `a` and actions are `button`. Images have width, height and alt text. Inputs are labeled and have `autocomplete`.
- Build mobile-first, with `clamp()` for fluid sizes. Animate only transform and opacity, and respect `prefers-reduced-motion`. Use `100svh`, not `100vh`.
- Use progressive enhancement: the page reads and its links work with no JS. Defer scripts. Load third-party code only if the user wants it, and give it SRI.

## Every state

Design these on purpose, in the concept's language. No state is left on browser defaults.

- **Links and controls:** hover, focus-visible, active and visited for every control; disabled only where it is real. The same timing and curve everywhere.
- **Navigation:** the current page is marked. The mobile menu is designed, not a raw list: it opens and closes, traps focus while open, and closes on Escape.
- **Forms:** errors written in words, beside the field, tied with `aria-describedby`, and never only in color or in the browser bubble. A submitting state. A success state, or a page, that says what happens next.
- **Empty, error and offline:** say what happened and what to do next, in the product's voice.
- **Loading:** the first paint already shows the layout and the ground color. There are no blank white frames and no layout jump when fonts or images arrive. Images reserve their space with a tone placeholder. A loader exists only when there is a real wait; it hands off into the page and is skipped on repeat visits.
- **Page transitions:** use the concept's motion verb, through the View Transitions API or a short cross-fade. Never block navigation. Use a plain cut with reduced motion.
- **Inner pages:** every template carries the concept (its grounds, markers, type and imagery), not only the home page. Page 12 should feel like the same site as the home page.
- **The 404 and 500 pages:** designed, helpful, in the voice, with a way back.

## Motion

Every site ships a motion layer. You cannot watch it, so write it from these rules, then let `scripts/motion.mjs` film it and audit it.

- **One motion verb, one or two curves.** The concept's verb sets the easing and durations for everything. For example: settle uses `cubic-bezier(.2,.7,.2,1)`, snap uses `cubic-bezier(.5,0,.1,1)`, drift uses `cubic-bezier(.3,.1,.2,1)`. Feedback takes 120–200ms, entrances 400–800ms, and nothing that blocks reading takes more than 1.2s.
- **Entrance.** The first screen's parts arrive in order, staggered by 60–120ms: the headline lines, then the visual, then the actions. Animate from `opacity: 0` with a small translate or a clip-path reveal. Content is visible without JS: start the hidden state only when a `.js` class on `<html>` is present.
- **Scroll.** Reveal sections with an IntersectionObserver at a threshold around 0.15, once, by adding a class. Better still, tie motion to the concept: colour that shifts with the story, a path that draws, a number that counts, a sticky marker that changes. Use CSS scroll-driven animations (`animation-timeline: view()`) where they are supported, with the observer as the fallback. Never scroll-jack or smooth-scroll the page by hand.
- **Micro-interactions.** Every control answers hover, press (scale 0.97–0.98) and focus. Links animate their underline. Cards lift 2–4px with a shadow shift. Forms shake or highlight on an error, and confirm on success.
- **Page transitions.** On a multi-page site, use the View Transitions API (`@view-transition { navigation: auto; }`) with a named shared element where it fits, such as the logo or a hero image. In an SPA, use `document.startViewTransition` around route changes.
- **Signature.** One move people remember, from the concept. It can be continuous (the art answers the pointer) as long as it pauses off-screen and in hidden tabs.
- **Performance.** Animate only `transform`, `opacity`, `filter` and `clip-path`. Name each transition's properties and never use `all`. Use `will-change` only during the animation. Never trigger layout or layout shift. Keep `requestAnimationFrame` loops off-screen-aware.
- **Reduced motion.** `@media (prefers-reduced-motion: reduce)` turns every entrance into its final state, removes scroll motion and transitions (cross-fades of 150ms or less are fine), and draws generative art as one still frame with no animation loop.

## Charts

Invoke `dataviz`. A chart answers one question, uses one accent, starts area charts at zero, uses mono labels with units, and is plain SVG with no library.

## Deploy notes

List the hosts that fit (Cloudflare Pages, Netlify, Vercel, GitHub Pages), the DNS and HTTPS steps, a form service, and privacy-friendly analytics if wanted. Give the one command or the clicks needed, and stop there. Offer a single-file handover (CSS and JS inlined) when the user wants something to send.
