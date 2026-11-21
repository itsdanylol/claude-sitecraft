// design-audit.mjs — measure the design of a rendered page and make the renders a critic needs.
// Saves per page and width: first screen, full page, squint (blurred) and grayscale renders, plus metrics.md.
// Metrics are evidence for the design review in references/review.md, not a verdict on beauty.
// usage: node design-audit.mjs <url|file> [--out .design] [--widths 1440,375] [--pages /,/about] [--max-pages 20] [--json] [--bold]
// Use --bold when the concept deliberately uses saturated grounds or poster-scale type (concept.md).
import { findPlaywright } from "./_pw.mjs";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

const argv = process.argv.slice(2);
const flag = (n, f) => { const i = argv.indexOf(n); return i >= 0 && argv[i + 1] ? argv[i + 1] : f; };
const target = argv.find((a, i) => !a.startsWith("--") && !argv[i - 1]?.startsWith("--"));
if (!target) { console.error("usage: node design-audit.mjs <url|file> [--out .design] [--widths 1440,375] [--pages /,/about]"); process.exit(2); }
const isFile = !/^https?:\/\//.test(target);
if (isFile && !existsSync(target)) { console.error(`not a file or a URL: ${target}`); process.exit(2); }
const baseUrl = isFile ? pathToFileURL(resolve(target)).href : target;
const outDir = flag("--out", ".design");
const widths = flag("--widths", "1440,375").split(",").map(Number);
const asJson = argv.includes("--json");
// --bold: the concept uses saturated grounds and poster-scale type on purpose, so those stop being findings
const bold = argv.includes("--bold");
const maxPages = Number(flag("--max-pages", 20));

// find playwright in the project being checked, then next to this script (npm install in the repo), then NODE_PATH
const { chromium } = findPlaywright();
mkdirSync(outDir, { recursive: true });
const slug = (p) => p.replace(/^https?:\/\/[^/]+/, "").replace(/[/?#&=]+/g, "-").replace(/^-|-$/g, "") || "index";

const browser = await chromium.launch();

// pages: explicit, or same-origin links from the start page (up to 8)
let pages = flag("--pages", null)?.split(",").map((s) => s.trim()).filter(Boolean) ?? null;
if (!pages) {
  pages = ["/"];
  if (!isFile) {
    const p = await browser.newPage();
    try {
      await p.goto(baseUrl, { waitUntil: "load", timeout: 30000 });
      const links = await p.evaluate(() => [...document.querySelectorAll("a[href]")].map((a) => { try { const u = new URL(a.getAttribute("href"), location.href); return u.origin === location.origin ? u.pathname : null; } catch { return null; } }).filter(Boolean));
      try {
        const sm = await (await fetch(new URL("/sitemap.xml", new URL(baseUrl).origin), { signal: AbortSignal.timeout(8000) })).text();
        for (const m of sm.matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/g)) { try { const u = new URL(m[1]); if (u.origin === new URL(baseUrl).origin) links.push(u.pathname); } catch {} }
      } catch {}
      pages = [new URL(baseUrl).pathname, ...links].filter((v, i, a) => a.indexOf(v) === i).slice(0, maxPages);
    } catch {}
    await p.close();
  }
}
const urlFor = (p) => (isFile ? baseUrl : new URL(p, new URL(baseUrl).origin).href);

function measure() {
  const vw = innerWidth, vh = innerHeight;
  const visible = (el) => { const r = el.getBoundingClientRect(); const s = getComputedStyle(el); return r.width > 0 && r.height > 0 && s.visibility !== "hidden" && s.display !== "none" && +s.opacity > 0.05; };
  const ownText = (el) => [...el.childNodes].filter((n) => n.nodeType === 3).map((n) => n.textContent).join("").replace(/\s+/g, " ").trim();
  const parse = (c) => { const m = c.match(/rgba?\(([^)]+)\)/); if (!m) return null; const p = m[1].split(/[ ,/]+/).filter(Boolean).map(Number); return { r: p[0], g: p[1], b: p[2], a: p[3] ?? 1 }; };
  const hex = ({ r, g, b }) => "#" + [r, g, b].map((v) => Math.round(v).toString(16).padStart(2, "0")).join("");
  const hsl = ({ r, g, b }) => { r /= 255; g /= 255; b /= 255; const mx = Math.max(r, g, b), mn = Math.min(r, g, b); const l = (mx + mn) / 2; const d = mx - mn; const s = d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1)); let h = 0; if (d) h = mx === r ? ((g - b) / d) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4; return { h: (h * 60 + 360) % 360, s, l, c: d }; };
  // a color counts as an accent by chroma, so warm off-whites and tinted darks do not
  const vivid = (h) => h.c > 0.22 && h.l > 0.12 && h.l < 0.9;
  const lum = ({ r, g, b }) => { const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b); };
  const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((m, n) => n - m); return (x + 0.05) / (y + 0.05); };
  const blend = (fg, bg) => ({ r: fg.r * fg.a + bg.r * (1 - fg.a), g: fg.g * fg.a + bg.g * (1 - fg.a), b: fg.b * fg.a + bg.b * (1 - fg.a), a: 1 });
  const bgOf = (el) => { for (let e = el; e; e = e.parentElement) { const s = getComputedStyle(e); if (s.backgroundImage !== "none" && !/^linear-gradient\(\s*(rgba?\([^)]*\))\s*,\s*\1\s*\)$/.test(s.backgroundImage)) return null; const c = parse(s.backgroundColor); if (c && c.a > 0.95) return c; } return { r: 255, g: 255, b: 255, a: 1 }; };

  // decorative text hidden from assistive tech is art, not reading text
  const texts = [...document.querySelectorAll("body *")].filter((el) => ownText(el).length > 1 && visible(el) && !el.closest("[aria-hidden=true]"));
  const fam = {}, sizes = {}, weights = new Set(), textColors = {};
  let bodySizeVotes = {};
  const leading = [], tracking = [], contrast = [], wrap = [];
  for (const el of texts) {
    const s = getComputedStyle(el); const t = ownText(el); const n = t.length;
    const f = s.fontFamily.split(",")[0].replace(/["']/g, "").trim();
    fam[f] = (fam[f] || 0) + n;
    const size = Math.round(parseFloat(s.fontSize)); sizes[size] = (sizes[size] || 0) + n;
    weights.add(s.fontWeight);
    if (/^(P|LI|DD|BLOCKQUOTE)$/.test(el.tagName) || (el.tagName === "SPAN" && el.closest("p"))) bodySizeVotes[size] = (bodySizeVotes[size] || 0) + n;
    const c = parse(s.color);
    if (c) {
      textColors[hex(c)] = (textColors[hex(c)] || 0) + n;
      const bg = bgOf(el);
      if (bg) {
        const cr = ratio(blend(c, bg), bg);
        const large = size >= 24 || (size >= 18.6 && +s.fontWeight >= 700);
        if (cr < (large ? 3 : 4.5)) contrast.push(`${cr.toFixed(2)}:1 ${size}px "${t.slice(0, 30)}" (${hex(c)} on ${hex(bg)})`);
      }
    }
    const lh = s.lineHeight === "normal" ? 1.2 : parseFloat(s.lineHeight) / parseFloat(s.fontSize);
    if (n > 80 && size <= 20 && (lh < 1.35 || lh > 1.85)) leading.push(`${size}px text at ${lh.toFixed(2)} line height "${t.slice(0, 24)}"`);
    if (size >= 40 && lh > 1.3 && el.getBoundingClientRect().height > size * 1.8) leading.push(`${size}px heading at ${lh.toFixed(2)} line height, loose for display "${t.slice(0, 24)}"`);
    const ls = s.letterSpacing === "normal" ? 0 : parseFloat(s.letterSpacing) / parseFloat(s.fontSize);
    if (size >= 40 && ls > 0.005) tracking.push(`${size}px heading has positive tracking`);
    if (size <= 14 && ls < -0.005) tracking.push(`${size}px text has negative tracking "${t.slice(0, 20)}"`);
    if (/^H[1-3]$/.test(el.tagName)) { const tw = s.textWrap || s.textWrapStyle || ""; if (!/balance|pretty/.test(tw)) wrap.push(el.tagName.toLowerCase()); }
  }
  const sortObj = (o) => Object.entries(o).sort((a, b) => b[1] - a[1]);
  const bodySize = +(sortObj(bodySizeVotes)[0]?.[0] ?? sortObj(sizes)[0]?.[0] ?? 16);
  const h1 = document.querySelector("h1");
  const h1Size = h1 ? Math.round(parseFloat(getComputedStyle(h1).fontSize)) : 0;
  const maxSize = Math.max(...Object.keys(sizes).map(Number), 0);

  // spacing on the 4px grid
  let spacingTotal = 0; const offGrid = {};
  for (const el of document.querySelectorAll("body *")) {
    if (!visible(el)) continue;
    const s = getComputedStyle(el);
    for (const p of ["marginTop", "marginBottom", "marginLeft", "marginRight", "paddingTop", "paddingBottom", "paddingLeft", "paddingRight", "rowGap", "columnGap"]) {
      const v = parseFloat(s[p]); if (!v || v < 3 || isNaN(v)) continue;
      // margin: auto centering produces arbitrary values; skip side margins that just center the box
      if (/margin(Left|Right)/.test(p) && el.parentElement && Math.abs(v - (el.parentElement.getBoundingClientRect().width - el.getBoundingClientRect().width) / 2) < 2) continue;
      spacingTotal++;
      if (Math.abs(v - Math.round(v / 4) * 4) > 0.5) offGrid[Math.round(v * 10) / 10] = (offGrid[Math.round(v * 10) / 10] || 0) + 1;
    }
  }
  const offCount = Object.values(offGrid).reduce((a, b) => a + b, 0);

  // palette: background area and saturated hues
  const docArea = Math.max(1, document.documentElement.scrollWidth * document.documentElement.scrollHeight);
  const bgArea = {}; let accentArea = 0; const hues = new Set();
  // Count only the area each ground shows, not the area painted over by a nested ground.
  // Without this, body + section + card add up, and the page reads as 186% color.
  const grounds = [];
  for (const el of document.querySelectorAll("html, body, body *")) {
    if (!visible(el)) continue;
    const c = parse(getComputedStyle(el).backgroundColor); if (!c || c.a < 0.5) continue;
    const r = el.getBoundingClientRect();
    grounds.push({ el, c, own: r.width * r.height });
  }
  const byEl = new Map(grounds.map((g) => [g.el, g]));
  for (const g of grounds) {
    let p = g.el.parentElement;
    while (p && !byEl.has(p)) p = p.parentElement;
    if (p) byEl.get(p).own -= g.own;
  }
  for (const g of grounds) {
    const a = Math.max(0, g.own); if (!a) continue;
    bgArea[hex(g.c)] = (bgArea[hex(g.c)] || 0) + a;
    const h = hsl(g.c); if (vivid(h)) { accentArea += a; hues.add(Math.round(h.h / 30)); }
  }
  accentArea = Math.min(accentArea, docArea);
  for (const [c] of Object.entries(textColors)) { const h = hsl(parse(`rgb(${parseInt(c.slice(1, 3), 16)},${parseInt(c.slice(3, 5), 16)},${parseInt(c.slice(5, 7), 16)})`)); if (vivid(h)) hues.add(Math.round(h.h / 30)); }

  // alignment lines: distinct left edges of block content
  const edges = {};
  for (const el of document.querySelectorAll("h1,h2,h3,h4,p,ul,ol,img,picture,video,canvas,button,form,figure,blockquote,table,a")) {
    if (!visible(el)) continue;
    const s = getComputedStyle(el); if (el.tagName === "A" && !/block|flex|grid/.test(s.display)) continue;
    if (el.parentElement?.closest("p,li,button,a,figure,blockquote,nav,footer")) continue;
    const r = el.getBoundingClientRect(); if (r.width < 40 || r.width > vw - 4) continue;
    const x = Math.round(r.left / 8) * 8; edges[x] = (edges[x] || 0) + 1;
  }
  const edgeList = sortObj(edges).filter(([, n]) => n >= 1);
  const strongLines = edgeList.filter(([, n]) => n >= 3).length;

  // measure: characters per line
  const longLines = [];
  for (const p of document.querySelectorAll("p")) {
    if (!visible(p)) continue; const t = p.innerText.trim(); if (t.length < 160) continue;
    const s = getComputedStyle(p); const lh = s.lineHeight === "normal" ? parseFloat(s.fontSize) * 1.2 : parseFloat(s.lineHeight);
    const lines = Math.max(1, Math.round(p.getBoundingClientRect().height / lh));
    const cpl = Math.round(t.length / lines); if (lines >= 2 && (cpl > 80 || cpl < 35)) longLines.push(`${cpl} chars per line "${t.slice(0, 24)}"`);
  }

  // section shapes and rhythm
  const main = document.querySelector("main") || document.body;
  let blocks = [...main.children].filter((e) => visible(e) && e.getBoundingClientRect().height > 120);
  if (blocks.length === 1) blocks = [...blocks[0].children].filter((e) => visible(e) && e.getBoundingClientRect().height > 120);
  const shape = (sec) => {
    let best = null;
    for (const el of [sec, ...sec.querySelectorAll("*")]) {
      const s = getComputedStyle(el); if (!/grid|flex/.test(s.display)) continue;
      const kids = [...el.children].filter(visible); if (kids.length < 2) continue;
      const tops = new Set(kids.map((k) => Math.round(k.getBoundingClientRect().top / 10)));
      const perRow = Math.round(kids.length / tops.size);
      if (perRow >= 2 && (!best || kids.length > best.n)) best = { n: kids.length, perRow };
    }
    const media = sec.querySelector("img,picture,video,svg,canvas") ? "+media" : "";
    return best ? `${best.perRow}-up x${best.n}${media}` : `single${media}`;
  };
  const sections = blocks.map((b) => {
    const s = getComputedStyle(b); const r = b.getBoundingClientRect();
    // a gradient band counts by its last color stop, so tone shifts drawn as gradients are seen
    const stops = s.backgroundImage.match(/rgba?\([^)]+\)/g);
    const flat = parse(s.backgroundColor);
    const tone = stops ? parse(stops[stops.length - 1]) : flat && flat.a > 0.5 ? flat : null;
    return { tag: b.tagName.toLowerCase(), h: Math.round(r.height), pad: `${parseFloat(s.paddingTop)}/${parseFloat(s.paddingBottom)}`, bg: tone ? hex(tone) : "inherit", shape: shape(b), title: (b.querySelector("h1,h2,h3")?.innerText || "").trim().slice(0, 32) };
  });
  const repeats = [];
  for (let i = 2; i < sections.length; i++) if (sections[i].shape === sections[i - 1].shape && sections[i].shape === sections[i - 2].shape && sections[i].shape !== "single") repeats.push(`three ${sections[i].shape} sections in a row ending at "${sections[i].title}"`);
  const bands = new Set(sections.map((s) => s.bg)).size;

  // first screen
  let heroMedia = 0;
  for (const el of document.querySelectorAll("img,picture,video,svg,canvas,[style*=background-image]")) {
    if (el.closest("nav, header") || (el.tagName === "svg" && el.getBoundingClientRect().width < 48)) continue;
    const r = el.getBoundingClientRect(); if (r.top > vh || r.bottom < 0 || r.width < 60) continue;
    const a = Math.max(0, Math.min(r.right, vw) - Math.max(r.left, 0)) * Math.max(0, Math.min(r.bottom, vh) - Math.max(r.top, 0));
    heroMedia = Math.max(heroMedia, a / (vw * vh));
  }
  for (const el of document.querySelectorAll("body *")) { // a built product view: a large boxed element that is not text
    const s = getComputedStyle(el);
    const hasImage = s.backgroundImage !== "none" && !/^(linear|radial|conic)-gradient/.test(s.backgroundImage);
    if (!hasImage && !(parse(s.boxShadow.match(/rgba?\([^)]+\)/)?.[0] || "") && s.boxShadow !== "none")) continue;
    const r = el.getBoundingClientRect(); if (r.top > vh * 0.9 || r.width < vw * 0.25) continue;
    const a = Math.max(0, Math.min(r.right, vw) - Math.max(r.left, 0)) * Math.max(0, Math.min(r.bottom, vh) - Math.max(r.top, 0));
    if (a / (vw * vh) < 0.9) heroMedia = Math.max(heroMedia, a / (vw * vh));
  }
  const h1Rect = h1?.getBoundingClientRect();

  return {
    fonts: sortObj(fam).slice(0, 5).map(([f, n]) => `${f} (${n} chars)`),
    familyCount: Object.keys(fam).length,
    sizes: Object.keys(sizes).map(Number).sort((a, b) => b - a),
    weights: [...weights].sort(),
    bodySize, h1Size, maxSize, scaleRatio: +(Math.max(h1Size, maxSize) / bodySize).toFixed(2),
    leading: leading.slice(0, 5), tracking: [...new Set(tracking)].slice(0, 4), wrapMissing: [...new Set(wrap)],
    spacing: { total: spacingTotal, offGrid: offCount, offPct: spacingTotal ? Math.round((offCount / spacingTotal) * 100) : 0, values: sortObj(offGrid).slice(0, 6).map(([v, n]) => `${v}px x${n}`) },
    textColors: sortObj(textColors).length, topTextColors: sortObj(textColors).slice(0, 5).map(([c]) => c),
    backgrounds: sortObj(bgArea).slice(0, 5).map(([c, a]) => `${c} ${Math.round((a / docArea) * 100)}%`),
    accentPct: Math.round((accentArea / docArea) * 100), hueFamilies: hues.size,
    alignment: { distinct: edgeList.length, strong: strongLines, top: edgeList.slice(0, 6).map(([x, n]) => `x=${x} (${n})`) },
    contrast: contrast.slice(0, 8), contrastCount: contrast.length,
    longLines: longLines.slice(0, 4),
    sections, repeats, bands,
    hero: { mediaPct: Math.round(heroMedia * 100), h1Top: h1Rect ? Math.round(h1Rect.top) : null, h1InFirstScreen: h1Rect ? h1Rect.top < vh : false },
  };
}

function judge(m, w) {
  const f = [];
  const desk = w >= 1024;
  if (m.familyCount > 3) f.push(`${m.familyCount} font families in use, aim for 1 or 2 (plus a mono at most)`);
  if (m.sizes.length > (bold ? 12 : 9)) f.push(`${m.sizes.length} distinct font sizes, aim for 5 to 7 from one scale`);
  if (m.weights.length > 3) f.push(`${m.weights.length} font weights (${m.weights.join(", ")}), aim for 2`);
  if (desk && m.scaleRatio < 3) f.push(`weak scale contrast: largest text ${Math.max(m.h1Size, m.maxSize)}px vs body ${m.bodySize}px (${m.scaleRatio}x), aim for 3x or more on desktop`);
  if (!desk && m.scaleRatio < 1.8) f.push(`weak scale contrast on mobile (${m.scaleRatio}x), aim for about 2x`);
  if (m.bodySize < 16) f.push(`body text is ${m.bodySize}px, use 16 to 19`);
  if (m.spacing.offPct > 10) f.push(`${m.spacing.offPct}% of spacing values are off the 4px grid: ${m.spacing.values.join(", ")}`);
  if (m.textColors > 6) f.push(`${m.textColors} different text colors, aim for 3 or 4 roles`);
  if (!bold && m.hueFamilies > 1) f.push(`${m.hueFamilies} saturated hue families, aim for one accent (fine if the others are semantic or inside a moment)`);
  if (!bold && m.accentPct > 15) f.push(`saturated color covers ${m.accentPct}% of the page, accent should be scarce (about 10% or less) unless it is a deliberate moment`);
  if (desk && m.alignment.distinct > 10) f.push(`${m.alignment.distinct} distinct left edges, content does not share a grid; aim for 3 to 5 strong lines`);
  if (m.contrastCount) f.push(`${m.contrastCount} text element(s) under WCAG contrast`);
  if (m.repeats.length) f.push(...m.repeats.map((r) => `monotonous rhythm: ${r}`));
  if (m.sections.length >= 5 && m.bands < 2) f.push("every section on the same background, no tone shift for rhythm");
  if (!m.hero.h1InFirstScreen) f.push("the h1 is not in the first screen");
  if (desk && m.hero.mediaPct < 15) f.push(`first screen has no strong visual (largest visual covers ${m.hero.mediaPct}% of it)`);
  return f;
}

const report = [];
for (const path of pages) {
  for (const width of widths) {
    const page = await browser.newPage({ viewport: { width, height: width >= 1024 ? 900 : 812 }, deviceScaleFactor: 1 });
    try {
      await page.goto(urlFor(path), { waitUntil: "load", timeout: 30000 });
      await page.waitForLoadState("networkidle", { timeout: 8000 }).catch(() => {});
      await page.evaluate(async () => { for (let y = 0; y < document.body.scrollHeight; y += innerHeight * 0.8) { scrollTo(0, y); await new Promise((r) => setTimeout(r, 120)); } scrollTo(0, 0); });
      await page.emulateMedia({ reducedMotion: "reduce" });
      await page.waitForTimeout(600);
      const m = await page.evaluate(measure);
      const base = join(outDir, `${slug(path)}-${width}`);
      await page.screenshot({ path: `${base}-first.png` });
      await page.screenshot({ path: `${base}-full.png`, fullPage: true });
      await page.addStyleTag({ content: "html{filter:blur(7px) !important}" });
      await page.screenshot({ path: `${base}-squint.png`, fullPage: true });
      await page.addStyleTag({ content: "html{filter:grayscale(1) !important}" });
      await page.screenshot({ path: `${base}-gray.png`, fullPage: true });
      report.push({ path, width, metrics: m, findings: judge(m, width), shots: ["first", "full", "squint", "gray"].map((k) => `${base}-${k}.png`) });
    } catch (e) {
      report.push({ path, width, error: e.message.slice(0, 160) });
    }
    await page.close();
  }
}
await browser.close();

// metrics.md for the critic, and a console summary
const md = [`# Design metrics`, ``, `Target: ${target}`, `Measured facts for the design review. They are evidence, not a verdict.`, ``];
for (const r of report) {
  md.push(`## ${r.path} at ${r.width}px`, ``);
  if (r.error) { md.push(`Could not load: ${r.error}`, ``); continue; }
  const m = r.metrics;
  md.push(
    `- Type: ${m.fonts.join(", ")}; sizes ${m.sizes.join("/")}px; weights ${m.weights.join(", ")}`,
    `- Scale: body ${m.bodySize}px, h1 ${m.h1Size}px, largest ${m.maxSize}px, ratio ${m.scaleRatio}x`,
    `- Spacing: ${m.spacing.total} values, ${m.spacing.offPct}% off the 4px grid${m.spacing.values.length ? " (" + m.spacing.values.join(", ") + ")" : ""}`,
    `- Color: ${m.textColors} text colors (${m.topTextColors.join(" ")}); backgrounds ${m.backgrounds.join(", ")}; saturated ${m.accentPct}% of page in ${m.hueFamilies} hue families`,
    `- Alignment: ${m.alignment.distinct} distinct left edges, ${m.alignment.strong} used 3+ times; ${m.alignment.top.join(", ")}`,
    `- First screen: largest visual ${m.hero.mediaPct}% of it, h1 top at ${m.hero.h1Top}px`,
    `- Sections (${m.sections.length}, ${m.bands} background tones): ${m.sections.map((s) => `${s.shape}${s.title ? ` "${s.title}"` : ""} ${s.h}px pad ${s.pad}`).join(" → ")}`,
  );
  if (m.leading.length) md.push(`- Leading: ${m.leading.join("; ")}`);
  if (m.tracking.length) md.push(`- Tracking: ${m.tracking.join("; ")}`);
  if (m.wrapMissing.length) md.push(`- No text-wrap balance on: ${m.wrapMissing.join(", ")}`);
  if (m.longLines.length) md.push(`- Measure: ${m.longLines.join("; ")}`);
  if (m.contrast.length) md.push(`- Contrast failures: ${m.contrast.join("; ")}`);
  md.push(``, r.findings.length ? `Findings:\n${r.findings.map((f) => `- ${f}`).join("\n")}` : `Findings: none from the metrics. Judge the screenshots.`, ``, `Renders: ${r.shots.map((s) => resolve(s)).join(", ")}`, ``);
}
writeFileSync(join(outDir, "metrics.md"), md.join("\n"), "utf8");
if (asJson) writeFileSync(join(outDir, "metrics.json"), JSON.stringify(report, null, 2), "utf8");

for (const r of report) {
  if (r.error) { console.log(`ERR   ${r.path} @${r.width}: ${r.error}`); continue; }
  const m = r.metrics;
  console.log(`${r.findings.length ? "LOOK" : " ok "}  ${r.path} @${r.width}  scale ${m.scaleRatio}x  fonts ${m.familyCount}  sizes ${m.sizes.length}  off-grid ${m.spacing.offPct}%  edges ${m.alignment.distinct}  accent ${m.accentPct}%  hero visual ${m.hero.mediaPct}%`);
  for (const f of r.findings) console.log(`      - ${f}`);
}
console.log(`\nmetrics and renders in ${resolve(outDir)} (read metrics.md, then look at every render)`);
