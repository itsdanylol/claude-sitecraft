# Charts

## Type follows the question

| The question | The chart | Never |
| --- | --- | --- |
| How has it moved over time? | Line, or area only if the total matters | Bars for a continuous trend with many points |
| Which is biggest? | Bars, horizontal when the labels are long | Pie, donut, radar |
| What is the share of a whole? | One stacked bar, or a list with thin bars | Donut, 3D pie, bubble |
| How does this compose over time? | Stacked bars, or a stacked area with 2 to 3 series | Stacked bars with 8 series |
| How does a distribution sit? | Histogram, or a strip plot for small n | A line joining unordered categories |
| Is this ahead or behind a target? | Progress bar, one number, one reference | A gauge with a needle |
| What is the ranking? | A list with thin bars and the number in text | A sorted pie |
| Two series against each other? | Scatter, with a labelled outlier or two | Dual y-axes (they invent a correlation) |
| One number, over time, tiny? | Sparkline, no axis, last point marked | A miniature full chart |

## Wrong but common

- **Dual y-axes.** Two scales on one frame lets you draw any two lines into a story. Use two small charts stacked, sharing the x axis.
- **Truncated bar charts.** Bars carry area, so the baseline is part of the value. Starting at 40 turns a 3% difference into a cliff.
- **Donuts.** Humans rank lengths better than angles. Six slices in a ring are six unreadable arcs.
- **Rainbow series.** Color is the weakest channel after length and position. One accent, then neutral steps, then labels.
- **3D, shadows, gradients.** Every one of them distorts the value they are meant to show.
- **Legends that could be direct labels.** If there is room, label the line at its end instead of a legend above.
- **A chart per stat card.** A number with a label and a change outranks a sparkline in a card. The card is not a chart.

## Values and ticks

- Ticks land on round numbers: 0, 10, 20, 30 rather than 0, 13, 25, 38. Divide the range into 4 or 5 steps of equal round size, and let the top of the scale go slightly above the data.
- Bars and stacked bars start at zero. A line may start elsewhere if the truncation is marked and stated in the subtitle.
- One format per chart, and one across the screen: pick `$48,210` or `$48.2k`, never both. Use `font-variant-numeric: tabular-nums`.
- Percentages carry their base: "38% of 47 runs", not "38%".
- Round to the precision the reader can act on. Two decimals on a count is a lie about the measurement.

## Built by hand, no library

**Line.** A `polyline` per series, `fill="none"`, `stroke-width` 2 for the leading series and 1.5 dashed for the rest. Marks only when there are 14 points or fewer.

```html
<svg viewBox="0 0 720 260" role="img" aria-labelledby="t1 d1" style="width:100%;height:auto;max-width:720px">
  <title id="t1">Runs per month, 2026</title>
  <desc id="d1">Runs rise from 18 in January to 47 in December. Findings rise from 7 to 27.</desc>
  <line x1="58" x2="702" y1="214" y2="214" stroke="rgba(232,230,225,.22)"/>
  <polyline points="58,190 117,168 175,178 ..." fill="none" stroke="#e0a458" stroke-width="2" stroke-linejoin="round"/>
</svg>
```

**Bars.** `rect` with `x`, `y`, `width`, `height = baseline - y`. Group two series in the same slot, gap 2 between bars, no gap at zero.

**Stacked bar, one category (a share).** One `rect` per segment inside one track, `y` accumulated from the top down. Put the total outside the bar, not inside a segment.

**Progress.** A track `rect` at 10% opacity and a fill `rect` at the accent. The number goes in text beside it, never inside the fill.

**List with bars.** A `<ul>`, each row a label, a thin `<span>` sized with a CSS custom property, and the value in mono. This beats a chart for rankings and costs nothing.

```html
<ul class="bars">
  <li><span>Contract</span><span class="bar" style="--v:98%"></span><span class="n">116</span></li>
</ul>
<style>
  .bars li { display:grid; grid-template-columns: 8rem 1fr 3rem; align-items:center; gap:12px }
  .bars .bar { height:6px; background: rgba(232,230,225,.12); position:relative }
  .bars .bar::after { content:""; position:absolute; inset:0 auto 0 0; width:var(--v); background:#e0a458 }
  .bars .n { font-variant-numeric: tabular-nums; text-align:right; font-family: ui-monospace, monospace }
</style>
```

**Sparkline.** No axis, no grid, one 1.5px line, a 2.5px dot on the last point. Fits in 48px height and reads at a glance or not at all.

## Accessible by construction

- `role="img"` with `<title>` and `<desc>`: the description is a sentence about what the data shows, not a list of coordinates.
- Text as `<text>`, never paths, so it scales with the reader's font size.
- Four or five ticks, not ten. Fewer at narrow widths.
- Direct labels at the end of lines when there is room.
- Distinguish series by position or dash as well as color.
- Keyboard and screen readers: if the chart is the only access to the numbers, provide a `<table>` beside it, visually hidden if needed.
- Contrast: labels at 4.5 to 1 against the plot background, grid at 1.5 to 1 (it is decoration, but it should not disappear).

## Sizes

| Where | Width | Height | Notes |
| --- | --- | --- | --- |
| Dashboard main chart | fluid, cap 900 | 240 to 320 | One per screen at this size |
| Card or panel | 280 to 420 | 140 to 200 | Four ticks or fewer |
| Inline in copy | 180 | 48 | Sparkline, no labels |
| Report or slide figure | 1200 by 675 | n/a | Export at 2x for print |

At 375 wide: drop to three ticks, label every other category, and turn a grouped bar into one series plus a total.
