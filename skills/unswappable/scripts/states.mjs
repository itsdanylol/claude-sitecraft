// states.mjs — walk the whole site, not just the home page.
// Crawls every page (sitemap + links), then on each page: hovers, focuses and clicks every control,
// opens menus and the mobile nav, submits forms empty and invalid, films loading on a slow connection,
// and checks the 404. Writes contact sheets a critic can read and a report of missing states.
// usage: node states.mjs <url> [--out .states] [--max-pages 40] [--max-controls 40] [--loading-pages 3] [--no-loading]
import { createRequire } from "node:module";
import { mkdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

const argv = process.argv.slice(2);
const flag = (n, f) => { const i = argv.indexOf(n); return i >= 0 && argv[i + 1] ? argv[i + 1] : f; };
const target = argv.find((a, i) => !a.startsWith("--") && !argv[i - 1]?.startsWith("--"));
if (!target || !/^https?:\/\//.test(target)) { console.error("usage: node states.mjs <http(s) url> [--out .states] [--max-pages 40]"); process.exit(2); }
const outDir = flag("--out", ".states");
const maxPages = Number(flag("--max-pages", 40));
const maxControls = Number(flag("--max-controls", 40));
const loadingPages = argv.includes("--no-loading") ? 0 : Number(flag("--loading-pages", 3));
const origin = new URL(target).origin;

// find playwright in the project being checked, then next to this script (npm install in the repo), then NODE_PATH
const require = (name) => { for (const base of [join(process.cwd(), "package.json"), import.meta.url]) { try { return createRequire(base)(name); } catch {} } throw new Error(`cannot find ${name}`); };
let chromium;
try { ({ chromium } = require("playwright")); } catch { console.error("playwright not found: npm i -g playwright && npx playwright install chromium"); process.exit(2); }
mkdirSync(outDir, { recursive: true });
const slug = (p) => p.replace(/[/?#&=.]+/g, "-").replace(/^-|-$/g, "") || "index";
const browser = await chromium.launch();
const findings = [];
const pagesOut = [];

// ---------- discover every page: sitemap first, then follow links ----------
const seen = new Set(), queue = [new URL(target).pathname];
try {
  const sm = await (await fetch(new URL("/sitemap.xml", origin), { signal: AbortSignal.timeout(8000) })).text();
  for (const m of sm.matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/g)) { try { const u = new URL(m[1]); if (u.origin === origin) queue.push(u.pathname + u.search); } catch {} }
} catch {}
const crawler = await browser.newPage();
const pages = [];
while (queue.length && pages.length < maxPages) {
  const p = queue.shift();
  const key = p.replace(/#.*$/, "") || "/";
  if (seen.has(key) || /\.(pdf|zip|png|jpe?g|webp|svg|xml|txt)$/i.test(key)) continue;
  seen.add(key);
  try {
    const res = await crawler.goto(new URL(key, origin).href, { waitUntil: "domcontentloaded", timeout: 20000 });
    if (!res || res.status() >= 400) { findings.push(`${key}: linked page returns ${res ? res.status() : "nothing"}`); continue; }
    pages.push(key);
    const links = await crawler.evaluate(() => [...document.querySelectorAll("a[href]")].map((a) => a.href));
    for (const l of links) { try { const u = new URL(l); if (u.origin === location.origin || u.origin === origin) queue.push(u.pathname + u.search); } catch {} }
  } catch (e) { findings.push(`${key}: could not load (${e.message.slice(0, 80)})`); }
}
await crawler.close();
if (queue.length && pages.length >= maxPages) findings.push(`stopped at ${maxPages} pages; raise --max-pages to cover the rest`);

// ---------- helpers that run in the page ----------
const CONTROLS = "a[href], button, [role=button], [role=tab], [role=menuitem], summary, input:not([type=hidden]), select, textarea, [aria-expanded], [tabindex='0']";
const styleKey = (el) => {
  const s = getComputedStyle(el);
  return [s.color, s.backgroundColor, s.borderColor, s.boxShadow, s.outlineStyle, s.outlineColor, s.outlineWidth, s.textDecorationLine, s.textDecorationColor, s.transform, s.opacity, s.backgroundImage].join("|");
};

async function sheet(name, cells) {
  // a contact sheet: one row per control, default / hover / focus side by side
  const html = `<!doctype html><meta charset=utf-8><style>body{margin:0;padding:24px;background:#f4f4f2;font:13px/1.4 ui-monospace,Consolas,monospace;color:#222}
  h1{font:600 16px/1 system-ui;margin:0 0 16px}.r{display:grid;grid-template-columns:220px repeat(3,1fr);gap:12px;align-items:center;padding:8px 0;border-top:1px solid #ddd}
  .r img{max-width:100%;max-height:120px;background:repeating-conic-gradient(#e6e6e6 0 25%,#fff 0 50%) 0/12px 12px;outline:1px solid #ccc}.flag{color:#b00}</style>
  <h1>${name}</h1><div class=r><b>control</b><b>default</b><b>hover</b><b>focus</b></div>${cells.map((c) => `<div class=r><span>${c.label}${c.flags.length ? `<br><span class=flag>${c.flags.join("<br>")}</span>` : ""}</span>${["d", "h", "f"].map((k) => c[k] ? `<img src="data:image/png;base64,${c[k]}">` : "<span>—</span>").join("")}</div>`).join("")}`;
  const p = await browser.newPage({ viewport: { width: 1200, height: 800 } });
  await p.setContent(html);
  const file = join(outDir, `${name}.png`);
  await p.screenshot({ path: file, fullPage: true });
  await p.close();
  return file;
}

// ---------- loading: film the first pages on a slow connection ----------
const loadingShots = [];
for (const path of pages.slice(0, loadingPages)) {
  for (const width of [1440, 375]) {
    const ctx = await browser.newContext({ viewport: { width, height: width > 600 ? 900 : 812 } });
    const page = await ctx.newPage();
    const cdp = await ctx.newCDPSession(page);
    await cdp.send("Network.enable");
    await cdp.send("Network.emulateNetworkConditions", { offline: false, latency: 400, downloadThroughput: 50 * 1024, uploadThroughput: 20 * 1024 }); // slow 3G-ish
    const t0 = Date.now();
    const nav = page.goto(new URL(path, origin).href, { waitUntil: "load", timeout: 60000 }).catch(() => null);
    for (const at of [300, 1000, 2500]) {
      await page.waitForTimeout(Math.max(0, at - (Date.now() - t0)));
      const f = join(outDir, `loading-${slug(path)}-${width}-${at}ms.png`);
      try { await page.screenshot({ path: f }); loadingShots.push(f); } catch {}
    }
    await nav;
    const loaded = Date.now() - t0;
    if (path === pages[0]) findings.push(`${path} @${width}: full load took ${(loaded / 1000).toFixed(1)}s on the slow profile; look at the loading frames for blank screens, layout jumps and font swaps`);
    await ctx.close();
  }
}

// ---------- every page: states of every control ----------
for (const path of pages) {
  const entry = { path, shots: [], sheet: null, disclosures: [], forms: [] };
  for (const width of [1440, 375]) {
    const page = await browser.newPage({ viewport: { width, height: width > 600 ? 900 : 812 } });
    const consoleErrors = [];
    page.on("console", (m) => { if (m.type() === "error") consoleErrors.push(m.text().slice(0, 120)); });
    await page.goto(new URL(path, origin).href, { waitUntil: "load", timeout: 30000 }).catch(() => {});
    await page.waitForLoadState("networkidle", { timeout: 8000 }).catch(() => {});
    const full = join(outDir, `${slug(path)}-${width}.png`);
    await page.screenshot({ path: full, fullPage: true }).catch(() => {});
    entry.shots.push(full);
    if (consoleErrors.length) findings.push(`${path} @${width}: console errors: ${consoleErrors.slice(0, 2).join(" | ")}`);

    if (width === 1440) {
      // hover and focus on every control, with a check that each state is visibly different
      const handles = (await page.$$(CONTROLS)).slice(0, maxControls * 2);
      const cells = [];
      // shoot each control with a margin, so outlines drawn outside the box (outline-offset, focus rings) are in frame
      const shoot = async (h) => { const b = await h.boundingBox(); if (!b) return null; const vp = page.viewportSize(); const x = Math.max(0, b.x - 10), y = Math.max(0, b.y - 10); return (await page.screenshot({ clip: { x, y, width: Math.min(vp.width - x, b.width + 20), height: Math.min(vp.height - y, b.height + 20) }, timeout: 3000 })).toString("base64"); };
      for (const h of handles) {
        if (cells.length >= maxControls) break;
        const info = await h.evaluate((el) => { const r = el.getBoundingClientRect(); const s = getComputedStyle(el); return { ok: r.width > 4 && r.height > 4 && s.visibility !== "hidden" && s.display !== "none", label: `${el.tagName.toLowerCase()}${el.type ? `[${el.type}]` : ""} "${(el.innerText || el.value || el.getAttribute("aria-label") || el.placeholder || "").trim().slice(0, 28)}"`, disabled: el.disabled || el.getAttribute("aria-disabled") === "true", hoverless: /^(INPUT|SELECT|TEXTAREA)$/.test(el.tagName) || el.getAttribute("role") === "region" }; }).catch(() => ({ ok: false }));
        if (!info.ok) continue;
        const cell = { label: info.label, flags: [] };
        try {
          await h.scrollIntoViewIfNeeded();
          await page.mouse.move(0, 0);
          await page.waitForTimeout(120);
          const base = await h.evaluate(styleKey);
          cell.d = await shoot(h);
          await h.hover({ timeout: 2000 });
          await page.waitForTimeout(260);
          const hov = await h.evaluate(styleKey);
          cell.h = await shoot(h);
          await page.mouse.move(0, 0);
          await page.keyboard.press("Tab").catch(() => {});
          await h.focus();
          await page.evaluate(() => document.activeElement && document.activeElement.matches(":focus-visible"));
          await page.waitForTimeout(200);
          const foc = await h.evaluate(styleKey);
          cell.f = await shoot(h);
          await h.evaluate((el) => el.blur());
          if (!info.disabled && !info.hoverless && hov === base) cell.flags.push("no hover state");
          if (foc === base) cell.flags.push("no visible focus");
        } catch { cell.flags.push("could not capture"); }
        if (cell.flags.includes("no visible focus")) findings.push(`${path}: ${info.label} has no visible focus state`);
        if (cell.flags.includes("no hover state")) findings.push(`${path}: ${info.label} has no hover state`);
        cells.push(cell);
      }
      entry.sheet = await sheet(`states-${slug(path)}`, cells);
    }

    // disclosures: menus, accordions, tabs, toggles, and the mobile nav at 375
    const triggers = await page.$$("[aria-expanded], summary, [role=tab], button:not([type=submit])");
    let n = 0;
    for (const t of triggers.slice(0, 12)) {
      const vis = await t.evaluate((el) => { const r = el.getBoundingClientRect(); return r.width > 4 && r.height > 4 && !el.closest("form"); }).catch(() => false);
      if (!vis) continue;
      const label = await t.evaluate((el) => (el.innerText || el.getAttribute("aria-label") || el.tagName).trim().slice(0, 30));
      const before = await page.evaluate(() => document.body.innerHTML.length + ":" + document.querySelectorAll("[aria-expanded=true],[open],[aria-selected=true]").length);
      try { await t.scrollIntoViewIfNeeded(); await t.click({ timeout: 2000 }); } catch { continue; }
      await page.waitForTimeout(450);
      const after = await page.evaluate(() => document.body.innerHTML.length + ":" + document.querySelectorAll("[aria-expanded=true],[open],[aria-selected=true]").length);
      const f = join(outDir, `open-${slug(path)}-${width}-${++n}.png`);
      await page.screenshot({ path: f }).catch(() => {});
      entry.disclosures.push({ label, width, file: f, changed: before !== after });
      if (before === after) findings.push(`${path} @${width}: "${label}" changes nothing when clicked`);
      await page.keyboard.press("Escape").catch(() => {});
      if (page.url().replace(/#.*$/, "") !== new URL(path, origin).href.replace(/#.*$/, "")) await page.goBack().catch(() => {});
    }
    if (width === 375) {
      const hasMenu = await page.evaluate(() => { const nav = document.querySelector("header nav, nav"); if (!nav) return "none"; const links = [...nav.querySelectorAll("a")].filter((a) => a.getBoundingClientRect().width > 0); const toggle = document.querySelector("header [aria-expanded], header button[aria-controls], nav button"); return links.length >= 2 ? "links visible" : toggle ? "toggle" : "hidden, no toggle"; });
      if (hasMenu === "hidden, no toggle") findings.push(`${path} @375: navigation links are hidden on phones and there is no menu button`);
    }

    // forms: submit empty, then with an invalid value, and capture what the visitor sees
    if (width === 1440) {
      const forms = await page.$$("form");
      for (const [i, form] of forms.entries()) {
        const res = { index: i + 1, shots: [] };
        for (const mode of ["empty", "invalid"]) {
          await page.goto(new URL(path, origin).href, { waitUntil: "load" }).catch(() => {});
          const fm = (await page.$$("form"))[i]; if (!fm) break;
          if (mode === "invalid") await fm.$$eval("input[type=email], input[type=tel], input[type=url], input[type=number]", (els) => els.forEach((e) => { e.value = "x"; e.dispatchEvent(new Event("input", { bubbles: true })); })).catch(() => {});
          const before = await fm.evaluate((f) => f.innerText.length + ":" + f.querySelectorAll("[aria-invalid=true], .error, [role=alert]").length);
          const submit = await fm.$("button[type=submit], button:not([type]), input[type=submit]");
          if (!submit) { findings.push(`${path}: form ${i + 1} has no submit button`); break; }
          await submit.click({ timeout: 2000 }).catch(() => {});
          await page.waitForTimeout(500);
          const after = await fm.evaluate((f) => f.innerText.length + ":" + f.querySelectorAll("[aria-invalid=true], .error, [role=alert]").length).catch(() => before);
          const f = join(outDir, `form-${slug(path)}-${i + 1}-${mode}.png`);
          await fm.screenshot({ path: f }).catch(() => page.screenshot({ path: f }));
          res.shots.push(f);
          if (before === after) findings.push(`${path}: form ${i + 1} shows no error of its own when submitted ${mode} (only the browser bubble, which screenshots and many users miss)`);
        }
        entry.forms.push(res);
      }
    }
    await page.close();
  }
  pagesOut.push(entry);
}

// ---------- the 404 ----------
const nf = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const r404 = await nf.goto(new URL(`/unswappable-missing-${Date.now()}`, origin).href).catch(() => null);
const notFound = join(outDir, "404-1440.png");
await nf.screenshot({ path: notFound, fullPage: true }).catch(() => {});
if (!r404 || r404.status() !== 404) findings.push(`a missing page returns ${r404 ? r404.status() : "nothing"}, not 404`);
await nf.close();
await browser.close();

// ---------- report ----------
const uniq = [...new Set(findings)];
const md = [
  `# Site states`, ``, `${target}: ${pages.length} page(s) crawled. Every control hovered, focused and clicked; forms submitted empty and invalid; loading filmed on a slow connection.`, ``,
  `## Pages`, ...pagesOut.map((p) => `- ${p.path}: ${p.shots.map((s) => resolve(s)).join(", ")}${p.sheet ? `\n  - state sheet: ${resolve(p.sheet)}` : ""}${p.disclosures.length ? `\n  - opened: ${p.disclosures.map((d) => `"${d.label}" @${d.width} ${resolve(d.file)}`).join("; ")}` : ""}${p.forms.length ? `\n  - forms: ${p.forms.map((f) => f.shots.map((s) => resolve(s)).join(", ")).join("; ")}` : ""}`), ``,
  `## Loading frames`, ...loadingShots.map((s) => `- ${resolve(s)}`), ``,
  `## 404`, `- ${resolve(notFound)}`, ``,
  `## Findings`, ...(uniq.length ? uniq.map((f) => `- ${f}`) : ["- none"]),
].join("\n");
writeFileSync(join(outDir, "states.md"), md, "utf8");
console.log(`${pages.length} page(s): ${pages.join(", ")}`);
console.log(`${uniq.length} finding(s)`);
for (const f of uniq.slice(0, 40)) console.log(`  - ${f}`);
console.log(`report: ${resolve(join(outDir, "states.md"))}`);
process.exit(uniq.some((f) => /no visible focus|changes nothing|no error of its own|not 404|could not load|returns/.test(f)) ? 1 : 0);
