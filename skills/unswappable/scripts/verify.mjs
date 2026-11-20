// verify.mjs — look at a page the way a suspicious designer does, at every width that breaks layouts.
// Reports what a script can see; the eye still has to look at the screenshots.
// usage: node verify.mjs <url|file> [--out .verify] [--widths 375,414,575,768,1024,1440] [--max-pages 40]
//        [--pages /,/pricing] [--json] [--no-interact]
// Also checks head and SEO tags, page weight against budgets, robots/sitemap/404, WCAG 2.2 target size,
// SRI, render-blocking scripts and removed focus rings. Wrap with with-server.mjs to start and stop the server.
// exits 1 on a hard failure, so it can gate a build.
import { createRequire } from "node:module";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

const argv = process.argv.slice(2);
if (!argv.length) {
  console.error("usage: node verify.mjs <url|file> [--out .verify] [--widths ..] [--pages ..] [--json]");
  process.exit(2);
}
const flag = (name, fallback) => {
  const i = argv.indexOf(name);
  return i >= 0 && argv[i + 1] ? argv[i + 1] : fallback;
};
const has = (name) => argv.includes(name);

const target = argv.find((a, i) => !a.startsWith("--") && !argv[i - 1]?.startsWith("--"));
const outDir = flag("--out", ".verify");
// 575 is in the list because that is where single-column layouts quietly fall apart
const widths = flag("--widths", "375,414,575,768,1024,1440").split(",").map(Number);
const explicitPages = flag("--pages", null);
const maxPages = Number(flag("--max-pages", 40));
const asJson = has("--json");
const probeInteractions = !has("--no-interact");

if (!existsSync(target) && !/^https?:\/\//.test(target)) {
  console.error(`not a file or a URL: ${target}`);
  process.exit(2);
}
const isFile = !/^https?:\/\//.test(target);
const baseUrl = isFile ? pathToFileURL(resolve(target)).href : target;
const baseOrigin = isFile ? null : new URL(baseUrl).origin;

// find playwright in the project being checked, then next to this script (npm install in the repo), then NODE_PATH
const require = (name) => { for (const base of [join(process.cwd(), "package.json"), import.meta.url]) { try { return createRequire(base)(name); } catch {} } throw new Error(`cannot find ${name}`); };
let chromium;
try {
  ({ chromium } = require("playwright"));
} catch {
  console.error("playwright not found: npm i -g playwright && npx playwright install chromium");
  process.exit(2);
}

mkdirSync(outDir, { recursive: true });
const slug = (p) => p.replace(/^https?:\/\/[^/]+/, "").replace(/[/?#&=]+/g, "-").replace(/^-|-$/g, "") || "index";

// placeholders and unverifiable claims, the things a buyer notices first
const PLACEHOLDERS = [
  /\bexample\.(com|org|net)\b/i,
  /\bexample corp\b/i,
  /\bacme\b/i,
  /\blorem ipsum\b/i,
  /\[needs?:[^\]]*\]/i,
  /\[[A-Za-z][^\]]{0,40}\]/,
  /\bTODO\b/,
  /\bTBD\b/,
  /\bcoming soon\b/i,
  /\bplaceholder\b/i,
  /\bfoo\s?bar\b/i,
  /\bN\/A\b/,
];
const UNVERIFIABLE = [
  /\b\d[\d,.]*\s?[kKmM]?\+?\s+(?:happy\s+)?(?:customers|teams|users|businesses|companies)\b/i,
  /\btrusted by\b/i,
  /\bloved by\b/i,
  /\b\d+(?:\.\d+)?x\s+(?:faster|better|more)\b/i,
  /\b(?:the best|best[- ]in[- ]class|the leading|world[- ]class|industry[- ]leading|#1)\b/i,
  /\b(?:100%|zero[- ]risk|guaranteed)\b/i,
];

const browser = await chromium.launch();
const results = [];
const failures = [];

// ---------- discover ----------
let pages = explicitPages ? explicitPages.split(",").map((p) => p.trim()).filter(Boolean) : ["/"];
if (!explicitPages && baseOrigin) {
  const scout = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  try {
    await scout.goto(baseUrl, { waitUntil: "load", timeout: 30000 });
    const hrefs = await scout.evaluate(() => [...document.querySelectorAll("a[href]")].map((a) => a.getAttribute("href")));
    const same = new Set();
    for (const h of hrefs) {
      try {
        const u = new URL(h, location.href);
        if (u.origin === location.origin) same.add(u.pathname + (u.search || ""));
      } catch {}
    }
    // the sitemap lists pages nothing links to (thank-you pages, landing variants)
    try {
      const sm = await (await fetch(new URL("/sitemap.xml", baseOrigin), { signal: AbortSignal.timeout(8000) })).text();
      for (const m of sm.matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/g)) { try { const u = new URL(m[1]); if (u.origin === baseOrigin) same.add(u.pathname + (u.search || "")); } catch {} }
    } catch {}
    pages = [new URL(baseUrl).pathname, ...same].filter((v, i, a) => a.indexOf(v) === i).slice(0, maxPages);
    if (same.size + 1 > maxPages) failures.push(`only the first ${maxPages} pages were checked; raise --max-pages`);
  } catch (e) {
    failures.push(`page unreachable: ${e.message.slice(0, 120)}`);
  }
  await scout.close();
}
const urlFor = (p) => (isFile ? baseUrl : new URL(p, baseOrigin).href);

// ---------- site files: robots, sitemap, a real 404 ----------
const site = [];
if (baseOrigin) {
  const get = async (p) => {
    try { const r = await fetch(new URL(p, baseOrigin), { redirect: "manual", signal: AbortSignal.timeout(8000) }); return { status: r.status, text: r.status < 400 ? await r.text() : "" }; }
    catch { return { status: 0, text: "" }; }
  };
  const robots = await get("/robots.txt");
  if (robots.status !== 200) site.push("no /robots.txt");
  else {
    if (!/^\s*sitemap:/im.test(robots.text)) site.push("robots.txt has no Sitemap: line");
    if (/^\s*disallow:\s*\/\s*$/im.test(robots.text)) failures.push("site: robots.txt disallows everything (Disallow: /)");
  }
  const sm = await get("/sitemap.xml");
  if (sm.status !== 200) site.push("no /sitemap.xml");
  else if (!/<urlset|<sitemapindex/.test(sm.text)) site.push("sitemap.xml is not a urlset or sitemap index");
  const missing = await get(`/unswappable-404-probe-${Date.now()}`);
  if (missing.status === 200) failures.push("site: a missing URL returns 200, so there is no real 404 (soft 404)");
  else if (missing.status !== 404 && missing.status !== 410) site.push(`a missing URL returns ${missing.status}, expected 404`);
}

// ---------- content audit, once per page ----------
async function contentAudit(page, path) {
  return page.evaluate(
    ({ placeholders, unverifiable }) => {
      const out = { placeholders: [], unverifiable: [], emptySections: [], emptyCells: [], deadActions: [], trust: [], tinyText: [], longLines: [] };
      const textOf = (el) => (el.innerText ?? el.textContent ?? "").replace(/\s+/g, " ").trim();
      const pRe = placeholders.map((s) => new RegExp(s.source, s.flags));
      const uRe = unverifiable.map((s) => new RegExp(s.source, s.flags));

      // visible text, split into pieces that carry a location
      for (const el of document.querySelectorAll("body *")) {
        if (el.children.length) continue;
        const t = textOf(el);
        if (!t || t.length < 3) continue;
        const rect = el.getBoundingClientRect();
        if (rect.width === 0 || rect.height === 0) continue;
        for (const re of pRe) if (re.test(t)) out.placeholders.push(t.slice(0, 70));
        for (const re of uRe) if (re.test(t)) out.unverifiable.push(t.slice(0, 70));
        const size = parseFloat(getComputedStyle(el).fontSize);
        if (size && size < 12) out.tinyText.push(`${size}px "${t.slice(0, 40)}"`);
      }

      // sections that are mostly empty space, or a heading with no content
      for (const el of document.querySelectorAll("section, article, main > div, footer")) {
        const r = el.getBoundingClientRect();
        if (r.height < 120) continue;
        const kids = [...el.querySelectorAll("*")].filter((k) => {
          const kr = k.getBoundingClientRect();
          return kr.width > 0 && kr.height > 0 && k.children.length === 0 && (k.innerText ?? "").trim().length > 0;
        });
        if (!kids.length) {
          out.emptySections.push(`${el.tagName.toLowerCase()} ${Math.round(r.height)}px with no text`);
          continue;
        }
        // charts and images are content too, not empty space
        const mediaBottom = (root) => Math.max(0, ...[...root.querySelectorAll("svg, img, canvas, video, picture, iframe")].map((m) => m.getBoundingClientRect()).filter((m) => m.width > 40 && m.height > 40).map((m) => m.bottom));
        const lastBottom = Math.max(mediaBottom(el), ...kids.map((k) => k.getBoundingClientRect().bottom));
        // the section's own bottom padding is designed space, not a dead band
        const dead = r.bottom - parseFloat(getComputedStyle(el).paddingBottom || 0) - lastBottom;
        if (dead > 140) {
          const first = (kids[0].innerText ?? "").trim().slice(0, 30);
          out.emptySections.push(`${Math.round(dead)}px dead band at the bottom of a section near "${first}"`);
        }
      }

      // table columns with no data
      for (const table of document.querySelectorAll("table")) {
        const rows = [...table.querySelectorAll("tbody tr")];
        if (!rows.length) continue;
        const cols = Math.max(...rows.map((r) => r.children.length));
        for (let c = 0; c < cols; c++) {
          let filled = 0;
          for (const r of rows) {
            const cell = r.children[c];
            const t = cell ? (cell.innerText ?? "").trim() : "";
            if (t && !/^[—–-]$/.test(t)) filled++;
          }
          if (filled === 0) out.emptyCells.push(`column ${c + 1} of ${cols} is empty in every row`);
        }
      }

      // actions that point nowhere
      for (const el of document.querySelectorAll("a[href]")) {
        const href = (el.getAttribute("href") || "").trim();
        const t = (el.innerText ?? "").trim().slice(0, 40) || "(no text)";
        if (href === "" || href === "#" || href.startsWith("javascript:")) out.deadActions.push(`"${t}" -> ${href || "(empty)"}`);
      }

      // credibility signals a stranger would look for
      const body = document.body.innerText.toLowerCase();
      const links = [...document.querySelectorAll("a[href]")].map((a) => (a.getAttribute("href") || "").toLowerCase() + " " + (a.innerText || "").toLowerCase());
      const hasContact = /@[a-z0-9.-]+\.[a-z]{2,}/i.test(document.body.innerText) || links.some((l) => /contact|mailto:/.test(l));
      const hasLegal = links.some((l) => /terms|privacy|legal|imprint/.test(l));
      const hasNamedEntity =
        /(ltd|llc|inc\.?|gmbh|b\.v\.|s\.a\.r\.l|pty|corp|company)\b/i.test(document.body.innerText) ||
        /©|\(c\)\s?\d{4}/.test(document.body.innerText);
      if (!hasContact) out.trust.push("no email address or contact link anywhere");
      if (!hasLegal) out.trust.push("no terms or privacy link");
      if (!hasNamedEntity) out.trust.push("no company name or entity line");
      if (!/\b(20\d{2})\b/.test(body)) out.trust.push("no date anywhere, so nothing can be dated");

      // reading measure: lines longer than 90 characters are hard to follow
      for (const p of document.querySelectorAll("p, li")) {
        const t = (p.innerText ?? "").trim();
        if (t.length < 120) continue;
        const size = parseFloat(getComputedStyle(p).fontSize) || 16;
        const w = p.getBoundingClientRect().width;
        const perLine = Math.round(w / (size * 0.5));
        if (perLine > 100) out.longLines.push(`${perLine} chars per line at ${Math.round(w)}px`);
        break;
      }
      return out;
    },
    { placeholders: PLACEHOLDERS.map((r) => ({ source: r.source, flags: r.flags })), unverifiable: UNVERIFIABLE.map((r) => ({ source: r.source, flags: r.flags })) }
  );
}

// ---------- head, SEO and best-practice audit, once per page ----------
// Thresholds follow common linting proxies (title 50-60, description ~150-160); they are advisories, not limits.
async function headAudit(page) {
  return page.evaluate(() => {
    const hard = [];
    const soft = [];
    const meta = (sel) => document.head.querySelector(sel)?.getAttribute("content")?.trim() ?? "";
    if (!document.doctype || document.doctype.name.toLowerCase() !== "html") hard.push("no <!doctype html>, the page renders in quirks mode");
    const firstHead = document.head.firstElementChild;
    const charset = document.head.querySelector("meta[charset]");
    if (!charset) soft.push("no <meta charset>");
    else if (firstHead !== charset) soft.push("<meta charset> is not the first element in <head>");
    const lang = document.documentElement.getAttribute("lang");
    if (!lang) hard.push("<html> has no lang attribute");
    const vp = meta("meta[name=viewport]");
    if (!vp) hard.push("no viewport meta, phones will render it zoomed out");
    else if (/user-scalable\s*=\s*no|maximum-scale\s*=\s*1(\.0)?\b/i.test(vp)) hard.push("viewport blocks zoom (user-scalable=no or maximum-scale=1)");
    const title = document.title.trim();
    if (!title) hard.push("no <title>");
    else if (title.length < 25 || title.length > 65) soft.push(`title is ${title.length} chars (aim 50-60): "${title.slice(0, 70)}"`);
    const desc = meta("meta[name=description]");
    if (!desc) hard.push("no meta description");
    else if (desc.length < 70 || desc.length > 170) soft.push(`description is ${desc.length} chars (aim ~150)`);
    const canonical = document.head.querySelector("link[rel=canonical]")?.getAttribute("href");
    if (!canonical) soft.push("no canonical link");
    for (const p of ["og:title", "og:description", "og:image"]) if (!meta(`meta[property="${p}"]`)) soft.push(`no ${p}`);
    if (!meta("meta[name='twitter:card']")) soft.push("no twitter:card");
    if (!document.head.querySelector("link[rel~=icon]")) soft.push("no favicon link");
    const robots = meta("meta[name=robots]").toLowerCase();
    if (/noindex/.test(robots)) hard.push(`meta robots says "${robots}", search engines will drop this page`);
    for (const s of document.querySelectorAll('script[type="application/ld+json"]')) {
      try { JSON.parse(s.textContent); } catch (e) { hard.push(`JSON-LD does not parse: ${String(e.message).slice(0, 60)}`); }
    }
    if (location.protocol === "https:") {
      const mixed = [...document.querySelectorAll("img[src],script[src],link[href],iframe[src],video[src],audio[src],source[src]")]
        .map((el) => el.getAttribute("src") || el.getAttribute("href"))
        .filter((u) => /^http:\/\//i.test(u || ""));
      if (mixed.length) hard.push(`${mixed.length} mixed-content resource(s) over http`);
    }
    const noDims = [...document.querySelectorAll("img")].filter((i) => !(i.getAttribute("width") && i.getAttribute("height")) && !/aspect-ratio/.test(i.getAttribute("style") || "") && !i.src.startsWith("data:"));
    if (noDims.length) soft.push(`${noDims.length} img without width and height (layout shift risk)`);
    const thirdParty = [...document.querySelectorAll("script[src]")].filter((s) => { try { return new URL(s.src).origin !== location.origin; } catch { return false; } });
    const noSri = thirdParty.filter((s) => !s.integrity);
    if (noSri.length) soft.push(`${noSri.length} third-party script(s) without integrity (SRI): ${noSri.map((s) => new URL(s.src).host).slice(0, 3).join(", ")}`);
    const blocking = [...document.head.querySelectorAll("script[src]")].filter((s) => !s.defer && !s.async && s.type !== "module");
    if (blocking.length) soft.push(`${blocking.length} render-blocking script(s) in <head>`);
    if (/document\.write\s*\(/.test([...document.scripts].map((s) => s.textContent).join("\n"))) soft.push("inline script uses document.write");
    // focus rings removed with no replacement is the most common keyboard failure a stylesheet can cause
    let killsOutline = false;
    let hasFocusVisible = false;
    for (const sheet of document.styleSheets) {
      let rules;
      try { rules = sheet.cssRules; } catch { continue; }
      for (const r of rules || []) {
        const t = r.cssText || "";
        if (/:focus-visible/.test(t)) hasFocusVisible = true;
        if (/:focus\b[^{]*\{[^}]*outline:\s*(none|0)/.test(t)) killsOutline = true;
      }
    }
    if (killsOutline && !hasFocusVisible) hard.push("CSS removes the :focus outline and defines no :focus-visible style");
    return { hard, soft, title, descLength: desc.length };
  });
}

// starting budgets for bytes as served, from common web-quality guidance; adjust per project
const BUDGET = { total: 1500, script: 300, stylesheet: 100, font: 100, image: 500 }; // KB
function classify(type, url) {
  if (type === "script") return "script";
  if (type === "stylesheet") return "stylesheet";
  if (type === "font" || /\.(woff2?|ttf|otf)(\?|$)/i.test(url)) return "font";
  if (type === "image" || /\.(png|jpe?g|webp|avif|gif|svg)(\?|$)/i.test(url)) return "image";
  return "other";
}

// ---------- interaction probe ----------
async function probeClicks(page) {
  const candidates = await page.evaluate(() =>
    [...document.querySelectorAll("button, [role=button], summary, a[href='#'], a[href='']")]
      .map((el, i) => ({ i, text: (el.innerText || el.textContent || "").trim().slice(0, 40) || el.tagName.toLowerCase(), tag: el.tagName.toLowerCase(), submit: el.tagName === "BUTTON" && !!el.form && (el.getAttribute("type") || "submit") === "submit" }))
      // submit buttons hand off to the form, which validation may block on purpose
      .filter((c) => c.text && !c.submit)
      .slice(0, 40)
  );
  const dead = [];
  for (const c of candidates) {
    const before = await page.evaluate(() => document.body.innerHTML.length + ":" + document.querySelectorAll("[aria-expanded=true]").length);
    try {
      await page.evaluate((idx) => {
        const el = [...document.querySelectorAll("button, [role=button], summary, a[href='#'], a[href='']")][idx];
        el?.scrollIntoView({ block: "center" });
        el?.click();
      }, c.i);
      await page.waitForTimeout(400);
      const after = await page.evaluate(() => document.body.innerHTML.length + ":" + document.querySelectorAll("[aria-expanded=true]").length);
      if (before === after) dead.push(`"${c.text}" (${c.tag}) changed nothing when clicked`);
    } catch {
      /* a click that throws is a finding the eye can confirm */
    }
  }
  return dead;
}

// ---------- main loop ----------
for (const path of pages) {
  const url = urlFor(path);

  // content + interactions at desktop once
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  let content = null;
  let head = null;
  let interactions = [];
  const bytes = { script: 0, stylesheet: 0, font: 0, image: 0, other: 0 };
  const sizing = [];
  page.on("requestfinished", (req) => {
    sizing.push(
      req.sizes().then((s) => { bytes[classify(req.resourceType(), req.url())] += (s.responseBodySize || 0) + (s.responseHeadersSize || 0); }).catch(() => {})
    );
  });
  try {
    // reconnaissance before action: let the network settle so dynamic pages are judged as rendered
    await page.goto(url, { waitUntil: "load", timeout: 30000 });
    await page.waitForLoadState("networkidle", { timeout: 8000 }).catch(() => {});
    await page.waitForTimeout(500);
    await Promise.all(sizing);
    content = await contentAudit(page, path);
    head = await headAudit(page);
    if (probeInteractions) interactions = await probeClicks(page);
  } catch (e) {
    failures.push(`${path}: could not load (${e.message.slice(0, 100)})`);
  }
  await page.close();

  const kb = Object.fromEntries(Object.entries(bytes).map(([k, v]) => [k, Math.round(v / 1024)]));
  kb.total = Object.values(kb).reduce((a, b) => a + b, 0);
  const overBudget = isFile ? [] : Object.entries(BUDGET).filter(([k, lim]) => kb[k] > lim).map(([k, lim]) => `${k} ${kb[k]} KB > ${lim} KB`);
  if (overBudget.length) failures.push(`${path}: over budget (${overBudget.join(", ")})`);
  if (head) for (const h of head.hard) failures.push(`${path}: ${h}`);

  if (content) {
    if (content.placeholders.length) failures.push(`${path}: ${content.placeholders.length} placeholder string(s)`);
    if (content.emptyCells.length) failures.push(`${path}: table column with no data`);
    if (content.deadActions.length) failures.push(`${path}: ${content.deadActions.length} link(s) pointing nowhere`);
    if (interactions.length) failures.push(`${path}: ${interactions.length} control(s) that do nothing`);
    results.push({ path, kind: "content", content, interactions, head, kb, overBudget });
  }

  for (const width of widths) {
    const wpage = await browser.newPage({ viewport: { width, height: 900 } });
    const consoleErrors = [];
    const failedRequests = [];
    wpage.on("console", (m) => {
      if (m.type() === "error") consoleErrors.push(m.text().slice(0, 200));
    });
    wpage.on("requestfailed", (r) => failedRequests.push(`${r.url().slice(0, 100)} ${r.failure()?.errorText ?? ""}`.trim()));

    let nav = "ok";
    try {
      await wpage.goto(url, { waitUntil: "load", timeout: 30000 });
      await wpage.waitForTimeout(600);
    } catch (e) {
      nav = e.message.slice(0, 150);
      failures.push(`${path} @${width}: ${nav}`);
    }

    const facts = await wpage.evaluate((vw) => {
      const docW = document.documentElement.scrollWidth;
      const overflow = [];
      if (docW > vw + 1) {
        for (const el of document.querySelectorAll("body *")) {
          const r = el.getBoundingClientRect();
          if (r.width === 0 || r.height === 0) continue;
          if (r.right > vw + 1 || r.left < -1) {
            const cls = typeof el.className === "string" ? el.className.split(" ")[0] : "";
            overflow.push(`${el.tagName.toLowerCase()}${cls ? "." + cls : ""} ${Math.round(r.left)}..${Math.round(r.right)}`);
          }
        }
      }
      const imgsNoAlt = [...document.querySelectorAll("img:not([alt])")].map((i) => (i.getAttribute("src") || "").slice(0, 60));
      const controls = [...document.querySelectorAll("input:not([type=hidden]), select, textarea")];
      const unlabeled = controls.filter((el) => {
        if (el.getAttribute("aria-label") || el.getAttribute("aria-labelledby") || el.getAttribute("title")) return false;
        if (el.id && document.querySelector(`label[for="${CSS.escape(el.id)}"]`)) return false;
        return !el.closest("label");
      }).map((el) => `${el.tagName.toLowerCase()}[name=${el.getAttribute("name") ?? "?"}]`);
      const headings = [...document.querySelectorAll("h1,h2,h3,h4,h5,h6")].map((h) => ({ level: Number(h.tagName[1]), text: (h.innerText || "").trim().slice(0, 60) }));
      const h1s = headings.filter((h) => h.level === 1).length;
      const skips = [];
      let prev = 0;
      for (const h of headings) {
        if (prev && h.level > prev + 1) skips.push(`h${prev}->h${h.level} at "${h.text}"`);
        prev = h.level;
      }
      const smallTargets =
        vw <= 480
          ? [...document.querySelectorAll("a, button, [role=button]")]
              .map((el) => {
                const r = el.getBoundingClientRect();
                return { t: (el.innerText || "").trim().slice(0, 22), w: Math.round(r.width), h: Math.round(r.height) };
              })
              .filter((x) => x.w > 0 && x.h > 0 && (x.h < 40 || x.w < 40))
              .map((x) => `"${x.t}" ${x.w}x${x.h}`)
              .slice(0, 10)
          : [];
      // WCAG 2.2 AA 2.5.8: targets under 24x24 CSS px fail unless inline in a sentence
      const tinyTargets =
        vw <= 480
          ? [...document.querySelectorAll("a, button, [role=button], input[type=checkbox], input[type=radio]")]
              .filter((el) => !el.closest("p, li > p, td, blockquote, figcaption") || el.tagName !== "A")
              .map((el) => {
                const r = el.getBoundingClientRect();
                return { t: (el.innerText || el.getAttribute("aria-label") || el.tagName.toLowerCase()).trim().slice(0, 22), w: Math.round(r.width), h: Math.round(r.height) };
              })
              .filter((x) => x.w > 0 && x.h > 0 && (x.h < 24 || x.w < 24))
              .map((x) => `"${x.t}" ${x.w}x${x.h}`)
              .slice(0, 10)
          : [];
      // clipped text: an element whose content is taller or wider than its box with hidden overflow
      const clipped = [...document.querySelectorAll("h1,h2,h3,p,span,button,a,li")]
        .filter((el) => {
          const s = getComputedStyle(el);
          return (s.overflow === "hidden" || s.textOverflow === "ellipsis") && (el.scrollHeight > el.clientHeight + 2 || el.scrollWidth > el.clientWidth + 2);
        })
        .map((el) => `"${(el.innerText || "").trim().slice(0, 30)}"`)
        .slice(0, 8);

      // dead bands: a section whose text stops well before the section does
      const deadBands = [];
      for (const el of document.querySelectorAll("section, article, footer, main > div")) {
        const r = el.getBoundingClientRect();
        if (r.height < 160) continue;
        const leaves = [...el.querySelectorAll("*")].filter((k) => {
          const kr = k.getBoundingClientRect();
          return kr.width > 0 && kr.height > 0 && k.children.length === 0 && (k.innerText ?? "").trim().length > 2;
        });
        if (!leaves.length) continue;
        const mediaBottom = (root) => Math.max(0, ...[...root.querySelectorAll("svg, img, canvas, video, picture, iframe")].map((m) => m.getBoundingClientRect()).filter((m) => m.width > 40 && m.height > 40).map((m) => m.bottom));
        const last = Math.max(mediaBottom(el), ...leaves.map((k) => k.getBoundingClientRect().bottom));
        // subtract designed bottom padding of the section and of its first inner wrapper
        const pad = parseFloat(getComputedStyle(el).paddingBottom || 0) + (el.firstElementChild ? parseFloat(getComputedStyle(el.firstElementChild).paddingBottom || 0) : 0);
        const dead = Math.round(r.bottom - pad - last);
        const limit = vw <= 480 ? 80 : 120;
        if (dead > limit) deadBands.push(`${dead}px of nothing after "${(leaves[0].innerText ?? "").trim().slice(0, 24)}"`);
      }

      // grid columns with no real data: the div-based cousin of an empty table column
      const emptyColumns = [];
      for (const el of document.querySelectorAll("div, ul, dl")) {
        const rows = [...el.children];
        if (rows.length < 2 || rows.length > 8) continue;
        const counts = rows.map((r) => r.children.length);
        if (!counts.every((c) => c >= 3 && c === counts[0])) continue;
        const cols = counts[0];
        for (let c = 0; c < cols; c++) {
          const cells = rows.map((r) => (r.children[c]?.innerText ?? "").trim());
          const empty = cells.filter((t) => !t || /^[\u2014\u2013-]$/.test(t)).length;
          if (empty === rows.length) emptyColumns.push(`column ${c + 1} of ${cols} is empty in every row`);
          else if (rows.length > 1 && empty === rows.length - 1) emptyColumns.push(`column ${c + 1} of ${cols} is empty in ${empty} of ${rows.length} rows`);
        }
      }

      return { docW, pageH: document.documentElement.scrollHeight, overflow: overflow.slice(0, 10), imgsNoAlt: imgsNoAlt.slice(0, 8), unlabeled, h1s, skips, smallTargets, tinyTargets, clipped, deadBands: deadBands.slice(0, 6), emptyColumns: [...new Set(emptyColumns)].slice(0, 6) };
    }, width);

    const shot = join(outDir, `${slug(path)}-${width}.png`);
    try {
      await wpage.screenshot({ path: shot, fullPage: true });
    } catch {}

    results.push({ path, width, nav, shot, ...facts, consoleErrors: consoleErrors.slice(0, 6), failedRequests: failedRequests.slice(0, 6) });

    if (facts.docW > width + 1) failures.push(`${path} @${width}: horizontal scroll (${facts.docW} > ${width})`);
    if (facts.h1s !== 1) failures.push(`${path} @${width}: ${facts.h1s} h1 elements`);
    if (facts.imgsNoAlt.length) failures.push(`${path} @${width}: ${facts.imgsNoAlt.length} img without alt`);
    if (facts.unlabeled.length) failures.push(`${path} @${width}: ${facts.unlabeled.length} unlabeled control`);
    if (consoleErrors.length) failures.push(`${path} @${width}: console error`);
    if (failedRequests.length) failures.push(`${path} @${width}: ${failedRequests.length} failed request`);
    if (facts.overflow.length && facts.docW > width + 1) failures.push(`${path} @${width}: ${facts.overflow.length} element(s) wider than the viewport`);
    if (facts.tinyTargets.length) failures.push(`${path} @${width}: ${facts.tinyTargets.length} target(s) under 24px (WCAG 2.5.8)`);
    for (const d of facts.deadBands) failures.push(`${path} @${width}: dead band — ${d}`);
    for (const c of facts.emptyColumns) failures.push(`${path} @${width}: ${c}`);

    await wpage.close();
  }
}

await browser.close();

// ---------- report ----------
if (asJson) {
  writeFileSync(join(outDir, "report.json"), JSON.stringify({ target, widths, budget: BUDGET, site, results, failures: [...new Set(failures)] }, null, 2), "utf8");
  console.log(`json: ${resolve(join(outDir, "report.json"))}`);
} else {
  console.log(`\n${target}  ·  ${results.filter((r) => r.width).length} page/width pairs  ·  widths ${widths.join(", ")}\n`);
  for (const r of results) {
    if (r.kind === "content") {
      const c = r.content;
      const lines = [];
      if (c.placeholders.length) lines.push(`placeholders: ${c.placeholders.slice(0, 4).join(" | ")}`);
      if (c.unverifiable.length) lines.push(`unverifiable claims: ${c.unverifiable.slice(0, 3).join(" | ")}`);
      if (c.emptySections.length) lines.push(`empty space: ${c.emptySections.slice(0, 3).join(" | ")}`);
      if (c.emptyCells.length) lines.push(`empty column: ${c.emptyCells.join(" | ")}`);
      if (c.deadActions.length) lines.push(`dead links: ${c.deadActions.slice(0, 3).join(" | ")}`);
      if (r.interactions.length) lines.push(`inert controls: ${r.interactions.slice(0, 3).join(" | ")}`);
      if (c.trust.length) lines.push(`trust gaps: ${c.trust.join(" | ")}`);
      if (c.tinyText.length) lines.push(`text under 12px: ${c.tinyText.slice(0, 3).join(" | ")}`);
      if (c.longLines.length) lines.push(`line length: ${c.longLines[0]}`);
      if (r.head?.hard.length) lines.push(`head (fail): ${r.head.hard.join(" | ")}`);
      if (r.head?.soft.length) lines.push(`head (advice): ${r.head.soft.join(" | ")}`);
      if (r.kb && !isFile) lines.push(`weight as served: ${r.kb.total} KB (js ${r.kb.script}, css ${r.kb.stylesheet}, font ${r.kb.font}, img ${r.kb.image})${r.overBudget.length ? "  OVER: " + r.overBudget.join(", ") : ""}`);
      console.log(lines.length ? `CONTENT  ${r.path}\n${lines.map((l) => `   ${l}`).join("\n")}` : `CONTENT  ${r.path}  clean`);
      continue;
    }
    const flags = [];
    if (r.docW > r.width + 1) flags.push(`H-SCROLL ${r.docW}>${r.width}`);
    if (r.h1s !== 1) flags.push(`${r.h1s} h1`);
    if (r.imgsNoAlt.length) flags.push(`${r.imgsNoAlt.length} no-alt`);
    if (r.unlabeled.length) flags.push(`${r.unlabeled.length} unlabeled`);
    if (r.clipped.length) flags.push(`${r.clipped.length} clipped`);
    if (r.deadBands.length) flags.push(`${r.deadBands.length} dead band`);
    if (r.emptyColumns.length) flags.push(`${r.emptyColumns.length} empty column`);
    if (r.tinyTargets.length) flags.push(`${r.tinyTargets.length} target<24px`);
    if (r.smallTargets.length) flags.push(`${r.smallTargets.length} small target`);
    if (r.consoleErrors.length) flags.push(`${r.consoleErrors.length} console`);
    if (r.failedRequests.length) flags.push(`${r.failedRequests.length} failed req`);
    if (r.skips.length) flags.push(`heading skip`);
    if (r.nav !== "ok") flags.push("NAV FAILED");
    console.log(`${flags.length ? "FAIL" : " ok "}  ${r.path} @${r.width}  h=${r.pageH}  ${r.shot}`);
    if (r.overflow.length) console.log(`      overflow: ${r.overflow.slice(0, 3).join("; ")}`);
    if (r.deadBands.length) console.log(`      dead band: ${r.deadBands.slice(0, 2).join("; ")}`);
    if (r.emptyColumns.length) console.log(`      empty column: ${r.emptyColumns.slice(0, 2).join("; ")}`);
    if (r.clipped.length) console.log(`      clipped: ${r.clipped.slice(0, 3).join("; ")}`);
    if (r.tinyTargets.length) console.log(`      under 24px: ${r.tinyTargets.slice(0, 3).join("; ")}`);
    else if (r.smallTargets.length) console.log(`      under 44px (advice): ${r.smallTargets.slice(0, 3).join("; ")}`);
    if (r.skips.length) console.log(`      headings: ${r.skips.join("; ")}`);
  }
  if (site.length) console.log(`SITE  ${site.join(" | ")}`);
  const uniq = [...new Set(failures)];
  console.log(`\n${uniq.length} finding(s)`);
  for (const f of uniq) console.log(`  - ${f}`);
  console.log(`screenshots in ${resolve(outDir)}`);
}
process.exit([...new Set(failures)].length ? 1 : 0);
