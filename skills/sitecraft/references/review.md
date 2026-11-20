# Blind review

The builder is the worst judge of their own page. A fresh critic sees only pictures: never the code, the conversation or the effort.

## Render

```
node <skill>/scripts/design-audit.mjs <url> --out .design [--bold]
```

For each page, at 1440 and 375, this saves:
- the first screen
- the full page
- a squint render (blurred)
- a grayscale render
- `metrics.md`, with fonts, scale, spacing, palette, alignment and contrast

Use `--bold` when saturated grounds or poster-size type are part of the concept. The metrics are evidence, not a verdict.

Also run `node <skill>/scripts/states.mjs <url> --out .states`. It writes a state sheet for each page (default, hover and focus for every control), screenshots of opened menus and forms in error, loading frames on a slow connection, and the 404. Give the critic all of them, not only the home page. Also run `node <skill>/scripts/motion.mjs <url> --pages <the main pages>` and give the critic the motion sheets: filmstrips of the first load, of scrolling (mid-way and settled) and of hovering the main action, with the animation list and the smoothness numbers.

## The critic

Spawn a general-purpose subagent. Give it the screenshot paths and `metrics.md`, and in a second part, the concept and the vibe. Tell it to Read every image itself. The brief:

> **Part 1, blind.** Look at the first screen and the squint render, at 1440 and 375, before you read anything else. Write three words for how the page feels and one sentence on its mood. Answer honestly: would you stop scrolling for this in a design feed? Have you seen this page, or one like it, many times before? Commit to your answers.
>
> **Part 2.** Here is the concept and the vibe: [paste]. Compare your blind words with the sense words. Say where they match, where they miss, and which visible decision causes each miss. Read every screenshot, then score the thirteen criteria from 1 to 5. Give one sentence of evidence per score, pointing at a specific place on the page. Rank the five changes that would raise the scores most, with exact values (px, hex, grid columns, section). Do not praise. Do not suggest decoration that does not come from the concept. End with the one quality that would make the page feel most like its vibe.

## Rubric

On every criterion, 3 means competent but forgettable, 4 means deliberate choices, and 5 means memorable and only this product.

1. **First impression:** what it is, for whom, and what to do, within five seconds.
2. **Hierarchy:** one thing leads each screen, and the squint render shows it.
3. **Typography:** the faces fit, the scale contrast is real, and the leading, measure and line breaks are good.
4. **Grid:** few alignment lines and deliberate spans.
5. **Rhythm:** grouping by space, varied section shapes, and the page has pace.
6. **Color:** roles and contrast hold, and the hierarchy survives grayscale.
7. **Moment and imagery:** something people would screenshot.
8. **Craft and motion:** states, details and edges hold up close. The motion filmstrips show an entrance, scroll motion and control feedback, and the motion is smooth, consistent and stops with reduced motion.
9. **Mobile:** recomposed, not shrunk.
10. **Distinctiveness:** you would know whose site it is without the logo.
11. **Vibe:** the blind words match the intended feeling.
12. **Originality:** an idea shapes the whole page and you have not seen it before. 1 means a template, 3 tidy with one nice touch, 5 you would send it to a friend.
13. **Whole site:** every page and state is designed in the concept, including inner pages, menus, form errors, loading and the 404. 1 means only the home page is designed, 3 means the inner pages are tidy but plain, 5 means every page and state feels like the same site.

**It passes** when:
- the average is 4.0 or more
- nothing scores under 3
- Vibe and Originality are both 4 or more
- two of the three blind words match the vibe

## Fixing

- Fix causes, not symptoms. A weak hierarchy score usually means the type or the visual is too small.
- If Originality is under 4, find a stronger idea. Polish will not raise it.
- **Critics disagree.** Averages drift by about 0.2 between critics. A fix that two critics in a row ask for is real; a fix from one critic is a suggestion. Never undo a fix just because the next critic asks for the opposite. Keep the choice that serves the concept, and tell the user about the disagreement.
- Re-render, and send a new critic the new screenshots plus the previous scores.
- Run at most three rounds. If the page still fails, show the user the scores, the remaining fixes and the screenshots. Often the missing piece is an asset only they have, such as a photo, a real product or brand type.

**Report** the blind words and a table of the scores for each round, with the final screenshots.
