// motion.mjs — see motion you cannot watch. For each page it films filmstrips of the first load, of scrolling
// (mid-animation and settled) and of hovering the main action, audits every running animation, measures smoothness
// while scrolling, and checks that reduced motion really reduces it. Writes a sheet per page plus motion.md.
// usage: node motion.mjs <url> [--out .motion] [--pages /,/about] [--width 1440]
import { findPlaywright } from "./_pw.mjs";
import { mkdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

const argv = process.argv.slice(2);
const flag = (n, f) => { const i = argv.indexOf(n); return i >= 0 && argv[i + 1] ? argv[i + 1] : f; };
const target = argv.find((a, i) => !a.startsWith("--") && !argv[i - 1]?.startsWith("--"));
if (!/^https?:\/\//.test(target || "")) { console.error("usage: node motion.mjs <http(s) url> [--out .motion] [--pages /,/about]"); process.exit(2); }
const out = flag("--out", ".motion"); mkdirSync(out, { recursive: true });
const width = Number(flag("--width", 1440)), height = width >= 768 ? 900 : 812;
const origin = new URL(target).origin;
const pages = flag("--pages", new URL(target).pathname).split(",").map((s) => s.trim()).filter(Boolean);
// find playwright in the project being checked, then next to this script (npm install in the repo), then NODE_PATH
const { chromium } = findPlaywright();
const slug = (p) => p.replace(/[/?#&=.]+/g, "-").replace(/^-|-$/g, "") || "index";
const browser = await chromium.launch();
const findings = [], report = [];
const CHEAP = /^(transform|opacity|filter|clip-path|color|background-color|border-color|outline-color|fill|stroke|box-shadow|translate|scale|rotate|offset|stroke-dashoffset|text-decoration-color|visibility)$/;

const auditInPage = () => {
  const kebab = (s) => s.replace(/[A-Z]/g, (m) => "-" + m.toLowerCase());
  return document.getAnimations().map((a) => {
    const t = a.effect?.getTiming?.() || {};
    const props = new Set();
    try { for (const k of a.effect.getKeyframes()) for (const p of Object.keys(k)) if (!["offset", "easing", "composite", "computedOffset"].includes(p)) props.add(kebab(p)); } catch {}
    if (a.transitionProperty) props.add(a.transitionProperty);
    const el = a.effect?.target;
    return {
      kind: a.constructor.name, name: a.animationName || a.transitionProperty || a.id || "", props: [...props],
      duration: typeof t.duration === "number" ? Math.round(t.duration) : 0, easing: t.easing || "", iterations: t.iterations,
      target: el ? `${el.tagName?.toLowerCase()}${el.className && typeof el.className === "string" ? "." + el.className.split(" ")[0] : ""}` : "",
    };
  });
};

async function frames(page, times, action) {
  const shots = []; const t0 = Date.now();
  if (action) action();
  for (const at of times) {
    await page.waitForTimeout(Math.max(0, at - (Date.now() - t0)));
    shots.push({ label: `${at}ms`, b64: (await page.screenshot({ type: "jpeg", quality: 70 })).toString("base64") });
  }
  return shots;
}

for (const path of pages) {
  const url = new URL(path, origin).href;
  const entry = { path, rows: [], animations: [], smooth: null };

  // 1. first load, frame by frame
  const ctx = await browser.newContext({ viewport: { width, height } });
  const page = await ctx.newPage();
  const nav = page.goto(url, { waitUntil: "commit", timeout: 30000 }).catch(() => null);
  await nav;
  entry.rows.push({ title: "First load", shots: await frames(page, [0, 150, 300, 500, 800, 1200, 1600]) });
  await page.waitForLoadState("load").catch(() => {});
  await page.waitForTimeout(400);
  const atLoad = await page.evaluate(auditInPage);

  // 2. scrolling: each step shown mid-animation and settled
  const scrollShots = [];
  const total = await page.evaluate(() => document.documentElement.scrollHeight - innerHeight);
  const steps = Math.min(8, Math.max(2, Math.ceil(total / (height * 0.9))));
  const during = [];
  for (let i = 1; i <= steps; i++) {
    const y = Math.round((total * i) / steps);
    await page.evaluate((yy) => scrollTo({ top: yy, behavior: "instant" }), y);
    await page.waitForTimeout(120);
    scrollShots.push({ label: `${i}/${steps} mid`, b64: (await page.screenshot({ type: "jpeg", quality: 65 })).toString("base64") });
    during.push(...(await page.evaluate(auditInPage)));
    await page.waitForTimeout(700);
    scrollShots.push({ label: `${i}/${steps} settled`, b64: (await page.screenshot({ type: "jpeg", quality: 65 })).toString("base64") });
  }
  entry.rows.push({ title: "Scroll", shots: scrollShots });

  // 3. smoothness while scrolling smoothly from the top: frame times, long tasks, layout shifts
  await page.evaluate(() => scrollTo(0, 0));
  await page.waitForTimeout(300);
  entry.smooth = await page.evaluate(async () => {
    const long = []; let cls = 0;
    const po1 = new PerformanceObserver((l) => l.getEntries().forEach((e) => long.push(Math.round(e.duration))));
    const po2 = new PerformanceObserver((l) => l.getEntries().forEach((e) => { if (!e.hadRecentInput) cls += e.value; }));
    try { po1.observe({ type: "longtask", buffered: false }); } catch {}
    try { po2.observe({ type: "layout-shift", buffered: false }); } catch {}
    const gaps = []; let last = performance.now(), running = true;
    const tick = (t) => { gaps.push(t - last); last = t; if (running) requestAnimationFrame(tick); };
    requestAnimationFrame(tick);
    const end = document.documentElement.scrollHeight - innerHeight;
    for (let y = 0; y <= end; y += 40) { scrollTo(0, y); await new Promise((r) => requestAnimationFrame(r)); }
    await new Promise((r) => setTimeout(r, 300));
    running = false; po1.disconnect(); po2.disconnect();
    const slow = gaps.filter((g) => g > 25).length;
    return { frames: gaps.length, slowFrames: slow, slowPct: Math.round((slow / Math.max(1, gaps.length)) * 100), worstFrame: Math.round(Math.max(...gaps)), longTasks: long, cls: +cls.toFixed(3) };
  });

  // 4. hover on the main action
  await page.evaluate(() => scrollTo(0, 0));
  const hoverMid = [];
  // the main action: try the likeliest selectors in order, not whichever matches first in the page
  let cta = null;
  for (const sel of ["main a.btn", "main [class*=btn]:not([type=submit])", "a[class*=btn]", "main button:not([type=submit])", "[class*=cta]", "main a[href]"]) { cta = await page.$(sel); if (cta) break; }
  if (cta) {
    await cta.scrollIntoViewIfNeeded();
    const box = await cta.boundingBox();
    const hoverShots = [];
    if (box) {
      const clip = { x: Math.max(0, box.x - 24), y: Math.max(0, box.y - 24), width: Math.min(width, box.width + 48), height: Math.min(height, box.height + 48) };
      const t0 = Date.now();
      await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
      for (const at of [0, 60, 120, 200, 320]) { await page.waitForTimeout(Math.max(0, at - (Date.now() - t0))); if (at === 60) hoverMid.push(...(await page.evaluate(auditInPage).catch(() => []))); hoverShots.push({ label: `hover ${at}ms`, b64: (await page.screenshot({ clip, type: "jpeg", quality: 85 })).toString("base64") }); }
      // press, then release away from the control so nothing is clicked or navigated
      await page.mouse.down(); hoverShots.push({ label: "pressed", b64: (await page.screenshot({ clip, type: "jpeg", quality: 85 })).toString("base64") }); await page.mouse.move(2, 2); await page.mouse.up();
    }
    entry.rows.push({ title: "Hover and press on the main action", shots: hoverShots, small: true });
  }
  const hoverAnims = await page.evaluate(auditInPage).catch(() => []);
  await ctx.close();

  // 5. reduced motion: nothing should keep moving
  const rctx = await browser.newContext({ viewport: { width, height }, reducedMotion: "reduce" });
  await rctx.addInitScript(() => { const raf = window.requestAnimationFrame.bind(window); window.__pageRaf = 0; window.requestAnimationFrame = (cb) => { window.__pageRaf++; return raf(cb); }; });
  const rp = await rctx.newPage();
  await rp.goto(url, { waitUntil: "load" }).catch(() => {});
  await rp.waitForTimeout(800);
  const reduced = await rp.evaluate(() => document.getAnimations().filter((a) => a.playState === "running" && (a.effect?.getTiming?.().iterations === Infinity || (a.effect?.getTiming?.().duration || 0) > 200)).length);
  const rafLoops = await rp.evaluate(async () => { const a = window.__pageRaf || 0; await new Promise((r) => setTimeout(r, 500)); return (window.__pageRaf || 0) - a; });
  await rctx.close();

  // findings
  const all = [...atLoad, ...during, ...hoverAnims, ...hoverMid];
  const uniq = new Map(); for (const a of all) uniq.set(`${a.target}|${a.name}|${a.props.join(",")}`, a);
  entry.animations = [...uniq.values()];
  const expensive = entry.animations.filter((a) => a.props.some((p) => !CHEAP.test(p) && p !== "all"));
  const allProp = entry.animations.filter((a) => a.props.includes("all"));
  const easings = new Set(entry.animations.map((a) => a.easing).filter((e) => e && e !== "linear"));
  const longEntrances = entry.animations.filter((a) => a.iterations !== Infinity && a.duration > 1200);
  // identical frames mean nothing moved: no entrance on load, no scroll-linked motion
  const load = entry.rows[0].shots;
  if (load.length > 2 && load[1].b64 === load[load.length - 1].b64) findings.push(`${path}: the first load has no entrance; frames from 150ms to 1600ms are identical`);
  const sc = entry.rows[1].shots;
  const stillPairs = sc.filter((x, i) => i % 2 === 0 && sc[i + 1] && x.b64 === sc[i + 1].b64).length;
  if (sc.length >= 4 && stillPairs === sc.length / 2) findings.push(`${path}: nothing moves while scrolling; every scroll step looks the same mid-way and settled`);
  if (!entry.animations.length) findings.push(`${path}: no motion layer at all; no load, scroll or hover animation was found`);
  if (expensive.length) findings.push(`${path}: animates layout-costly properties: ${[...new Set(expensive.flatMap((a) => a.props.filter((p) => !CHEAP.test(p))))].slice(0, 6).join(", ")} (use transform and opacity)`);
  if (allProp.length) findings.push(`${path}: ${allProp.length} transition(s) on "all"; name the properties`);
  if (easings.size > 3) findings.push(`${path}: ${easings.size} different easing curves; one motion verb means one or two curves`);
  if (longEntrances.length) findings.push(`${path}: ${longEntrances.length} animation(s) longer than 1.2s (${longEntrances.slice(0, 3).map((a) => a.target + " " + a.duration + "ms").join(", ")})`);
  if (entry.smooth.slowPct > 10) findings.push(`${path}: ${entry.smooth.slowPct}% of frames over 25ms while scrolling (worst ${entry.smooth.worstFrame}ms); not smooth`);
  if (entry.smooth.longTasks.length) findings.push(`${path}: ${entry.smooth.longTasks.length} long task(s) during scroll (${entry.smooth.longTasks.slice(0, 4).join(", ")}ms)`);
  if (entry.smooth.cls > 0.05) findings.push(`${path}: layout shifts while scrolling (CLS ${entry.smooth.cls})`);
  if (reduced > 0) findings.push(`${path}: ${reduced} animation(s) still running with reduced motion on`);
  if (rafLoops > 20) findings.push(`${path}: a requestAnimationFrame loop keeps running with reduced motion on (${rafLoops} frames in 0.5s); draw one still frame instead`);

  // the sheet
  const html = `<!doctype html><meta charset=utf-8><style>body{margin:0;padding:24px;background:#141414;color:#eee;font:13px/1.4 ui-monospace,Consolas,monospace}
    h1{font:600 18px/1 system-ui;margin:0 0 18px}h2{font:600 14px/1 system-ui;margin:24px 0 10px;color:#bbb}
    .row{display:flex;flex-wrap:wrap;gap:10px}.f{display:flex;flex-direction:column;gap:4px}.f img{width:260px;border:1px solid #333}.s img{width:auto;max-width:260px}</style>
    <h1>Motion · ${path} · ${width}px</h1>${entry.rows.map((r) => `<h2>${r.title}</h2><div class="row ${r.small ? "s" : ""}">${r.shots.map((s) => `<div class=f><img src="data:image/jpeg;base64,${s.b64}"><span>${s.label}</span></div>`).join("")}</div>`).join("")}
    <h2>Smoothness while scrolling</h2><div>${entry.smooth.frames} frames, ${entry.smooth.slowPct}% over 25ms, worst ${entry.smooth.worstFrame}ms, long tasks ${entry.smooth.longTasks.length}, CLS ${entry.smooth.cls}</div>
    <h2>Animations found (${entry.animations.length})</h2><div>${entry.animations.slice(0, 30).map((a) => `${a.target} · ${a.props.join(", ") || a.name} · ${a.duration}ms · ${a.easing}${a.iterations === Infinity ? " · loops" : ""}`).join("<br>")}</div>`;
  const sp = await browser.newPage({ viewport: { width: 1400, height: 900 } });
  await sp.setContent(html, { waitUntil: "load" });
  const sheetFile = join(out, `motion-${slug(path)}-${width}.png`);
  await sp.screenshot({ path: sheetFile, fullPage: true });
  await sp.close();
  report.push({ path, sheet: resolve(sheetFile), smooth: entry.smooth, animations: entry.animations.length, reducedStillRunning: reduced, rafFramesWithReducedMotion: rafLoops });
}
await browser.close();

const uniqF = [...new Set(findings)];
writeFileSync(join(out, "motion.md"), [`# Motion`, ``, ...report.map((r) => `- ${r.path}: ${r.animations} animation(s); ${r.smooth.slowPct}% slow frames while scrolling; CLS ${r.smooth.cls}; sheet ${r.sheet}`), ``, `## Findings`, ...(uniqF.length ? uniqF.map((f) => `- ${f}`) : ["- none"])].join("\n"));
for (const r of report) console.log(`${r.path}: ${r.animations} animation(s), ${r.smooth.slowPct}% slow frames, CLS ${r.smooth.cls}  ${r.sheet}`);
console.log(`${uniqF.length} finding(s)`); for (const f of uniqF) console.log(`  - ${f}`);
process.exit(uniqF.some((f) => /not smooth|still running|keeps running|layout-costly/.test(f)) ? 1 : 0);
