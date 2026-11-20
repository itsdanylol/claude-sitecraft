# Concept

The page *is* something, not just *about* something. Find the idea before any style.

## 1. Three concepts

Write three, each from a different territory:

- **Name:** what the product's name literally is or sounds like.
- **Material:** what the user's hands touch, such as paper, dough, steel or film.
- **Place:** where the work happens, for example a dock, a ward, or a kitchen at 6am.
- **Process:** how the work unfolds over time, such as steeping, proofing, compiling or tides.
- **Formal system:** a notation, ritual or diagram from the field, such as a score, a ledger or a field guide.

Give each one:

- **Idea:** five words or fewer.
- **Anchor:** the product fact it depends on.
- **Structure:** how it shapes every section, not only the hero.
- **Signature moment:** the one thing people screenshot.
- **Motion verb:** one verb, from the concept, that sets every animation.

**Kill** a concept that passes with a competitor's name, that only shapes the hero, or that gets in the way of the reader's action. **Pick** the survivor with the best total for originality, fit, memorability and buildability, with ties going to originality. If the winner is "split hero with a product card", start this section again.

## 2. Dials, and invent the layout

Set three dials from 1 to 10:

- **Variance**, default 7. At 1–3 the grid is symmetric. At 6–8 it is fractional, with cropped type and bleeds. At 9–10 the grid breaks, with collage and rotation.
- **Motion**, default 5. At 1–2 there is hover only. At 5–6 there is a scroll-linked state and one signature. At 7 and up motion is continuous.
- **Density**, default 4. At 1–2 it is a gallery. At 5–6 it is editorial. At 9–10 it is a cockpit.

Map the user's words onto them: "brutalist" is variance 9 and motion 2, "playful" is 7 and 7, "luxury" is 5, 3 and density 2.

There are no layout templates to pick from. Invent the layout from the concept:

- Sketch three different first screens as ASCII wireframes, each made from the concept's own material. Do not reach for a known hero shape. Keep the one that says the idea fastest.
- Give each section its own composition, drawn from what that section is in the concept. No two sections in a row share a shape.
- Avoid repeating yourself across sites. Read `~/.unswappable-history.md` if it exists. Do not reuse a hero shape, type pairing or concept listed there. When the site is done, append one line: date, product, concept, hero shape, type pairing.

## 3. The vibe

This is the feeling a visitor gets before reading a word. Invent it from the product's own world. Never take it from another site's look.

- **Feeling:** one sentence, for example "Like a quiet tasting table on a slow morning, beside someone who knows a lot."
- **Five sense words:**
  - temperature
  - texture
  - light
  - pace
  - sound
- **Scene:** three sentences describing a real moment where the product is used.
- **Never feels like:** two or three feelings to avoid.

Every design decision must name the sense word it serves. A decision that cannot is a default, so change it.

## 4. Imagery

Choose in this order:

1. Real material from the user.
2. Generated images, prompted from the scene. Unslop's visuals reference has the recipe.
3. Generative art in code, made from the concept:
   - Write the algorithm's idea in one line first.
   - Seed it from something real.
   - Drive it with the product's own data, so the picture means something.
   - Keep the parameters in one object.
   - Give it a still fallback for no-JS and reduced motion.
   - Never copy an artwork or a famous example.
4. Type as image: huge cropped letters, or the product's own notation at poster size.

A product view in code is proof, not imagery. A page needs both.

## 5. The style tile

Build one screen, `style-tile.html`, with:
- the palette as swatches
- the type scale set with real copy
- the buttons with hover and focus
- one card
- one field
- a strip of the hero at real size

Screenshot it at 1440 and 375. Ask whether it feels like the vibe sentence. Approving it here is cheap; redoing a finished site is not.

## 6. Moves

Pick moves to express the concept, never to replace one. Use one signature move and two to four supporting moves per page, and never two heavy moves in the same viewport.

- **Type:**
  - poster headline at 12–20vw, tracking -0.04em, leading 0.9, cropped by the edge
  - the notation as the hero
  - an expressive display face against a strict mono
  - variable axes driven by scroll
  - text on a path
- **Layout:**
  - sections as the concept's sequence (chapters, hours, infusions)
  - a sticky giant marker
  - a full-bleed takeover
  - a broken grid over a real 12-column base
  - a horizontal snap strip
  - a collage of rotated objects
- **Color:**
  - the page changes color with the story (dawn to night, pale to deep)
  - a bold ground instead of off-white
  - duotone images
  - grain or halftone only when the trade is print
- **Imagery:**
  - generative art from data
  - one object on stage with light that matches the page
  - masks cut to a shape from the concept
  - the real UI tilted on the table
- **Motion:**
  - one motion verb for everything
  - scroll-linked state, never scroll-jacking
  - an SVG path that draws as you scroll
  - art that answers the pointer gently
  - WebGL only for technical products, and never at the cost of LCP

Each move costs something: poster type needs a very short headline, a strip needs keyboard support and a visible affordance, and a color story needs contrast checked on every ground.

**Push, then edit.** For each section, ask what the bolder version is (bigger, cropped, full-bleed, inverted, one huge thing instead of three small ones) and take it unless it hurts reading or the action. Then cut whatever does not serve the idea. Restraint means removing what does not belong, not removing everything that is not grey.
