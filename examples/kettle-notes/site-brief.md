# Kettle Notes — site brief (design demo)

Kettle Notes is a **fictional product** made up for a unswappable demo. Nothing here is a real customer, price or number. The site says so on the page.

## Dossier

| Fact | Label | Source |
| --- | --- | --- |
| A tasting journal for independent tea shops: log each steep, compare harvests side by side, print shelf cards | found | user's brief, 2026-11-18 |
| Reader is the owner or buyer at a small tea shop who cups teas before stocking them | category inference | how specialty tea shops buy (cupping before ordering) |
| Tea is judged per infusion: temperature, time, leaf weight, notes change steep to steep | category inference | gongfu tasting practice |
| Prices for plans | unknown | fictional; shown as demo values and labeled |
| Customers, testimonials, usage numbers | unknown | none exist; none shown |

## Concept

**Three concepts**

| Territory | Idea (5 words) | Anchor | Signature moment | Structure |
| --- | --- | --- | --- | --- |
| Process | The page steeps like tea | Oolong is tasted across six infusions, and its colour changes with each | Scrolling turns the whole page from pale gold to deep amber and back, steep by steep | Six sections are the six infusions |
| Material | A drawer of index cards | Notes end up as shelf cards | The cards fan out of a drawer | Sections are cards in a drawer |
| Formal system | The tasting log as poster | The steep notation `2nd · 95°C · 15s` | The notation is set at poster size | A ledger |

**Kill tests**
- The index-card drawer fails the swap test: any notes app could use it.
- The poster ledger survives, but it only shapes the type.
- "The page steeps" survives every test. A coffee or notes app cannot use it, it shapes every section, and reading is not hurt because each section is a calm field of colour.

**Pick:** the page steeps. Originality 5, fit 5, memorability 5, buildability 4. The ledger's poster-size notation is folded in as the section markers.

- **Signature moment:** the background deepens from pale gold to near-brown and fades back as you scroll, like six infusions in a gaiwan.
- **Motion verb:** steep, meaning a slow diffusion with 900ms colour cross-fades, steam that drifts slowly, and nothing that snaps.
- **Imagery:** generative cup rings drawn from the real log data. Each steep leaves a ring; its temperature sets the ring's darkness and its time sets the width. Steam drifts above and answers the pointer.

**Dials:** variance 7, motion 5, density 3.

**Deal** (`deal.mjs --seed "Kettle Notes" --variance 7`):
- hero: giant number
- type: expressive italic display plus a neutral grotesk
- direction: left-heavy
- texture: deep solid ground
- sections: text over art bottom-left · two columns offset · full-bleed · horizontal strip · horizontal strip · text over art bottom-left
- **Re-dealt section 5** as "two columns offset": two sideways strips in a row would make the plans hard to compare.
- The giant number is the steep temperature, `95°`, set in italic as the hero visual.

**Infusion colours**, one per section, each a solid ground:

| Steep | Colour | Section |
| --- | --- | --- |
| 1st | pale gold `#efe1b4` | hero |
| 2nd | gold `#e2b25c` | the log |
| 3rd | amber `#b5651d` | the comparison, full-bleed |
| 4th | deep liquor `#4e230b` | the shelf cards strip |
| 5th | fading amber `#cf9a5c` | plans |
| 6th | almost water `#f3ead3` | close |

## Shared direction

- **Concept.** The page steeps like tea (see Concept).
- **Product.** A tasting journal that helps independent tea shops record every steep, compare harvests, and turn notes into shelf cards.
- **Reader.** A tea shop owner at the cupping table on a Tuesday morning, five samples steeping, writing notes on whatever paper is near. Action: start a journal.
- **Problem and promise.** "My notes are on the backs of invoices, and I can't tell if this spring's Dancong beats last autumn's." Promise: every steep in one place, so harvests can be compared and the good words reach the shelf.
- **Proof.** 1) The product view shows a real-looking tasting log with per-steep data (shown, demo data). 2) A printed shelf card made from that log (shown). 3) No customer claims, since none exist.
- **Character and voice.** Unhurried, exact, warm. It would never say "Supercharge your tea game!"
- **World.** A cupping table: off-white paper, ink, unglazed clay, oolong amber in the cup, deep green leaf.
- **Moments.** The tasting log card in the hero, and the printed shelf card presented like an object on a dark leaf-green band.
- **Signature.** Steep notation in mono: `3rd · 95°C · 40s`. Used for every infusion everywhere and nowhere else.
- **Vibe.** See the Vibe section: warm, paper, low morning sun, unhurried, a kettle cooling.

## Vibe

- **Feeling.** Like sitting down at a quiet tasting table on a slow morning, beside someone who knows a great deal and is in no hurry.
- **Sense words.**
  - temperature: warm
  - texture: paper
  - light: low morning sun
  - pace: unhurried
  - sound: a kettle ticking as it cools
- **Scene.** Tuesday, half past nine, before the shop opens. Five gaiwans in a row on a wooden counter, steam lifting, a pencil and a stack of index cards. Sun comes in low through the window and turns the tea amber. The owner tastes, pauses and writes three words.
- **Never feels like.** A SaaS dashboard, a luxury spa, a startup pitch.

| Decision | Choice | Because |
| --- | --- | --- |
| Type | Book serif for everything, mono only for steep numbers | paper, someone who knows |
| Color | Warm paper ramp, one oolong amber accent, a deep leaf-green band | warm, low sun |
| Space | 128px section pads, one idea per screen | unhurried |
| Shape | 12px cards like index cards, a printed card at 2px with a slight tilt | paper |
| Motion | Nothing on load, 160ms colour fades on hover | unhurried, kettle cooling |
| Imagery | Objects from the counter built in code: the log card, the shelf card, a cup-colour swatch | the scene |
| Copy | Short, calm sentences, precise numbers, no exclamation | in no hurry, knows a lot |

## Build plan

**Stack.** One static `index.html` with inline CSS and no JS needed. A `404.html`, `robots.txt`, `sitemap.xml` and `_headers`. System font stacks for the demo, with a note to self-host a chosen face (Newsreader or Source Serif) in production.

**Tokens.**
- paper `#f5f0e6` page · paper-2 `#ebe3d4` alt band · card `#fbf8f2` · hairline `rgba(35,31,26,.12)`
- ink `#231f1a` text · ink-2 `#544a40` secondary · muted `#6f6457` meta
- oolong `#8a4b14` the one accent (action, links, the current steep) · leaf `#1e2a23` inverted band · leaf-ink `#e9e2d3` text on leaf
- Display: Palatino Linotype, Book Antiqua, Iowan Old Style, Georgia, serif. Text: same serif at 18/1.6. Mono: Cascadia Mono, Consolas, ui-monospace, for the steep notation and figures.
- Sizes: 84 / 48 / 28 / 20 / 18 / 15 / 14 (mono). Mobile: 44 / 32 / 22 / 18 / 17 / 14.
- Weights 400 and 600 (600 only for the wordmark and buttons).
- Space on 4: 8 / 12 / 16 / 24 / 32 / 48 / 64 / 96 / 128. Section pads 128 desktop and 80 mobile.
- Radius 6 controls, 12 cards, 2 printed card. Easing `cubic-bezier(.2,.7,.2,1)` at 160 / 240ms.

**Wireframe, desktop (12 columns, 1200px, 32px gutters)**
```
[ top band: "Design demo · Kettle Notes is a fictional product"            ]
[ wordmark (1-3)                      Journal  Shelf cards  Pricing  [Start] ]
[ h1 84px "Every steep, written down" (1-6)  | tasting log card (7-12),     ]
[ sub 20px (1-5)                              |  runs 64px past hero bottom  ]
[ [Start a journal]  See a shelf card (1-6)   |                              ]
---- paper-2 ----------------------------------------------------------------
[ h2 "From cup to shelf in three steps" (1-5)                                 ]
[ steps list 1 Log/2 Compare/3 Print (1-4) | harvest comparison view (5-12) ]
---- leaf band, inverted -----------------------------------------------------
[ caption (1-4)          | printed shelf card, centered, real 4:5 (5-9)      ]
---- paper -------------------------------------------------------------------
[ h2 "Plans" (1-4)       | three rows, name / what / price right (6-12)      ]
[ close: h2 48px (1-7)  [Start a journal]                                     ]
[ footer on grid                                                              ]
```
**Mobile (375):** top band → nav (wordmark and a Start button) → h1 44 → sub → actions → log card at full width, simplified to 3 steeps → steps as a list, then the comparison view stacked → leaf band with the card, then the caption → plans as rows → close → footer.

**Critique of the plan against generic tells (revised).**
- I dropped a "features" row of three equal cards. The steps sit beside one real view instead.
- I dropped an uppercase eyebrow above each h2. The section number appears only in the steps list, because those really are steps.
- The hero headline gets no accent word. The accent appears only in the button, links and the current steep row.
- The default would be everything centered. Instead the hero is left-aligned on columns 1–6, and only the shelf card is centered, on purpose, as the object moment.
- There is no testimonial section, since there are no real customers. The proof is the product itself.

## Positioning (marketing)

- **Product.** A tasting journal for tea shops that records each infusion and turns the notes into shelf cards.
- **Reader.** A shop owner cupping new samples before ordering, notes scattered on scrap paper.
- **Pain.** "I can't remember how last autumn's batch compared" (category inference, no source: fictional product).
- **Promise.** This harvest and the last one are side by side, steep by steep, and the best words reach the shelf.
- **Mechanism.** Every note is saved with its temperature, time and leaf weight, so sessions line up by steep.
- **Proof.** The product view, a comparison and a shelf card on the page (demo data). There is no customer proof, because none exists.
- **Objections.** "I already use a notebook": it keeps the notebook's habit but adds comparison. "Another subscription": the first 50 teas are free (demo price). "Typing at the table is slow": the notes are short phrases, with the numbers chosen, not typed.
- **Banned claims.** Customer counts, "trusted by", time saved, sales uplift, "AI".

## Ledger

| Claim on the page | Evidence | Label |
| --- | --- | --- |
| Saves temperature, time and leaf weight per steep | the product definition in this brief | found (fictional product) |
| Compares two sessions side by side | the product definition | found (fictional product) |
| Prints an A6 shelf card | design decision for the demo | found (fictional product) |
| Prices £0 / £9 / £29 | invented for the demo | labeled "demo prices" on the page |
| Tea names, notes and the £14 card price | example data | covered by the demo band and "Demo data" labels |
