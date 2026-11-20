// beforeafter.mjs — a before/after image with a diagonal split, for every page of a redesign.
//
// 1. Before you change anything, capture the old site:
//      node beforeafter.mjs capture <url> --out .before [--widths 1440,375] [--max-pages 40]
// 2. After the redesign, capture the new one the same way:
//      node beforeafter.mjs capture <url> --out .after
// 3. Compose the pairs (same file names in both folders) into diagonal PNGs:
//      node beforeafter.mjs compose --before .before --after .after --out before-after [--title "Site name"]
//    or a single pair from files or URLs:
//      node beforeafter.mjs compose --before old.png --after https://new.site --out compare.png
//
// The old version fills the upper left, the new one the lower right, split by one diagonal line with labels.
import { createRequire } from "node:module";
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { basename, extname, join, resolve } from "node:path";

const argv = process.argv.slice(2);
const mode = argv[0];
const flag = (n, f) => { const i = argv.indexOf(n); return i >= 0 && argv[i + 1] ? argv[i + 1] : f; };
// find playwright in the project being checked, then next to this script (npm install in the repo), then NODE_PATH
const require = (name) => { for (const base of [join(process.cwd(), "package.json"), import.meta.url]) { try { return createRequire(base)(name); } catch {} } throw new Error(`cannot find ${name}`); };
let chromium;
try { ({ chromium } = require("playwright")); } catch { console.error("playwright not found: npm i -g playwright && npx playwright install chromium"); process.exit(2); }
const slug = (p) => p.replace(/[/?#&=.]+/g, "-").replace(/^-|-$/g, "") || "index";
const sizeFor = (w) => ({ width: w, height: w >= 768 ? 900 : 812 });

if (mode === "capture") {
  const url = argv[1];
  if (!/^https?:\/\//.test(url || "")) { console.error("usage: node beforeafter.mjs capture <url> --out .before"); process.exit(2); }
  const out = flag("--out", ".before"); mkdirSync(out, { recursive: true });
  const widths = flag("--widths", "1440,375").split(",").map(Number);
  const maxPages = Number(flag("--max-pages", 40));
  const origin = new URL(url).origin;
  const browser = await chromium.launch();
  // pages: the sitemap plus a crawl, so the before set matches what states.mjs and verify.mjs see
  const seen = new Set(), queue = [new URL(url).pathname], pages = [];
  try { const sm = await (await fetch(new URL("/sitemap.xml", origin), { signal: AbortSignal.timeout(8000) })).text(); for (const m of sm.matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/g)) { try { const u = new URL(m[1]); if (u.origin === origin) queue.push(u.pathname); } catch {} } } catch {}
  const crawl = await browser.newPage();
  while (queue.length && pages.length < maxPages) {
    const p = queue.shift().replace(/#.*$/, "") || "/";
    if (seen.has(p) || /\.(pdf|zip|png|jpe?g|webp|svg|xml|txt)$/i.test(p)) continue;
    seen.add(p);
    const res = await crawl.goto(new URL(p, origin).href, { waitUntil: "domcontentloaded", timeout: 20000 }).catch(() => null);
    if (!res || res.status() >= 400) continue;
    pages.push(p);
    for (const h of await crawl.evaluate(() => [...document.querySelectorAll("a[href]")].map((a) => a.href))) { try { const u = new URL(h); if (u.origin === origin) queue.push(u.pathname); } catch {} }
  }
  await crawl.close();
  for (const p of pages) for (const w of widths) {
    const page = await browser.newPage({ viewport: sizeFor(w) });
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto(new URL(p, origin).href, { waitUntil: "load", timeout: 30000 }).catch(() => {});
    await page.waitForLoadState("networkidle", { timeout: 8000 }).catch(() => {});
    await page.waitForTimeout(600);
    const f = join(out, `${slug(p)}-${w}.png`);
    await page.screenshot({ path: f });
    console.log(`captured ${f}`);
    await page.close();
  }
  writeFileSync(join(out, "pages.json"), JSON.stringify({ url, capturedAt: new Date().toISOString(), pages, widths }, null, 2));
  await browser.close();
  process.exit(0);
}

if (mode === "compose") {
  const before = flag("--before", null), after = flag("--after", null), out = flag("--out", "before-after");
  const title = flag("--title", "");
  if (!before || !after) { console.error("usage: node beforeafter.mjs compose --before <dir|png|url> --after <dir|png|url> --out <dir|png>"); process.exit(2); }
  const isDir = (p) => existsSync(p) && statSync(p).isDirectory();
  const browser = await chromium.launch();

  async function asDataUrl(src, size) {
    if (/^https?:\/\//.test(src)) {
      const page = await browser.newPage({ viewport: size });
      await page.emulateMedia({ reducedMotion: "reduce" });
      await page.goto(src, { waitUntil: "load", timeout: 30000 }).catch(() => {});
      await page.waitForLoadState("networkidle", { timeout: 8000 }).catch(() => {});
      await page.waitForTimeout(600);
      const b = await page.screenshot(); await page.close();
      return `data:image/png;base64,${b.toString("base64")}`;
    }
    const ext = extname(src).slice(1).toLowerCase().replace("jpg", "jpeg");
    return `data:image/${ext || "png"};base64,${readFileSync(src).toString("base64")}`;
  }

  async function composePair(bSrc, aSrc, file, size) {
    const [b, a] = [await asDataUrl(bSrc, size), await asDataUrl(aSrc, size)];
    const { width: W, height: H } = size;
    // the split runs from 58% across the top to 42% across the bottom
    const x1 = W * 0.58, x2 = W * 0.42;
    const pill = (text, x, y, align, dark) => `<div style="position:absolute;left:${x}px;top:${y}px;transform:translateX(${align === "right" ? "-100%" : "0"});font:600 ${Math.round(W / 60) + 6}px/1 system-ui,-apple-system,Segoe UI,sans-serif;letter-spacing:.02em;padding:${Math.round(W / 140) + 6}px ${Math.round(W / 90) + 8}px;border-radius:999px;background:${dark ? "#111" : "#fff"};color:${dark ? "#fff" : "#111"};box-shadow:0 2px 12px rgba(0,0,0,.25)">${text}</div>`;
    const html = `<!doctype html><meta charset=utf-8><style>html,body{margin:0;width:${W}px;height:${H}px;overflow:hidden;background:#111}
      img{position:absolute;inset:0;width:${W}px;height:${H}px;object-fit:cover;object-position:top}</style>
      <img src="${b}">
      <img src="${a}" style="clip-path:polygon(${x1}px 0,${W}px 0,${W}px ${H}px,${x2}px ${H}px)">
      <svg width="${W}" height="${H}" style="position:absolute;inset:0"><line x1="${x1}" y1="-2" x2="${x2}" y2="${H + 2}" stroke="rgba(0,0,0,.35)" stroke-width="${W >= 768 ? 9 : 7}"/><line x1="${x1}" y1="-2" x2="${x2}" y2="${H + 2}" stroke="#fff" stroke-width="${W >= 768 ? 5 : 4}"/></svg>
      ${pill("Before", Math.round(W * 0.03), Math.round(H - H * 0.03 - (W / 60 + 6) - 2 * (W / 140 + 6)), "left", true)}
      ${pill("After", Math.round(W * 0.97), Math.round(H * 0.03), "right", false)}
      ${title ? `<div style="position:absolute;right:${Math.round(W * 0.03)}px;bottom:${Math.round(H * 0.03)}px;font:600 ${Math.round(W / 70) + 4}px/1 system-ui,sans-serif;color:#fff;background:rgba(0,0,0,.55);padding:8px 12px;border-radius:8px">${title.replace(/[<>&]/g, "")}</div>` : ""}`;
    const page = await browser.newPage({ viewport: size, deviceScaleFactor: 1 });
    await page.setContent(html, { waitUntil: "load" });
    await page.screenshot({ path: file });
    await page.close();
    console.log(`wrote ${resolve(file)}`);
  }

  if (isDir(before) && isDir(after)) {
    mkdirSync(out, { recursive: true });
    const names = readdirSync(before).filter((f) => /\.png$/i.test(f) && existsSync(join(after, f)));
    if (!names.length) { console.error("no matching file names in the two folders"); process.exit(1); }
    const missing = readdirSync(after).filter((f) => /\.png$/i.test(f) && !existsSync(join(before, f)));
    for (const n of names) {
      const w = Number((n.match(/-(\d+)\.png$/i) || [])[1]) || 1440;
      await composePair(join(before, n), join(after, n), join(out, n.replace(/\.png$/i, "-before-after.png")), sizeFor(w));
    }
    if (missing.length) console.log(`new pages with no before (shown as after only): ${missing.join(", ")}`);
  } else {
    const w = Number(flag("--width", 1440));
    const file = /\.png$/i.test(out) ? out : join(out, "before-after.png");
    mkdirSync(resolve(file, ".."), { recursive: true });
    await composePair(before, after, file, sizeFor(w));
  }
  await browser.close();
  process.exit(0);
}

console.error("usage: node beforeafter.mjs capture <url> --out .before | compose --before <dir|png|url> --after <dir|png|url> --out <dir|png>");
process.exit(2);
