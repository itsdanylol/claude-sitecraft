// crawl.mjs — extract what a product actually says about itself, from a URL or a folder.
// No dependencies. Every block carries its source path so nothing in the brief is unattributable.
// usage: node crawl.mjs <url|dir> [--out file.md] [--max 12] [--agent "marketing-skill"]
import { existsSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { findPlaywright } from "./_pw.mjs";
import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";
import { basename, join, relative, resolve } from "node:path";

const argv = process.argv.slice(2);
if (!argv.length) {
  console.error("usage: node crawl.mjs <url|dir> [--out file.md] [--max 12]");
  process.exit(2);
}
const flag = (name, fallback) => {
  const i = argv.indexOf(name);
  return i >= 0 && argv[i + 1] ? argv[i + 1] : fallback;
};
const target = argv[0];
const outPath = flag("--out", null);
const maxPages = Number(flag("--max", "12"));
const userAgent = `${flag("--agent", "marketing-skill")}/1.0 (+brief research; respects robots.txt)`;
const renderMode = argv.includes("--render");

const decode = (s) =>
  s
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&mdash;/g, "—")
    .replace(/&ndash;/g, "–")
    .replace(/&middot;/g, "·")
    .replace(/&#(\d+);/g, (_, d) => String.fromCharCode(Number(d)));

const text = (html) =>
  decode(
    html
      .replace(/<(script|style|noscript|svg)[\s\S]*?<\/\1>/gi, " ")
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<\/(p|div|li|h[1-6]|section|article|tr)>/gi, "\n")
      .replace(/<[^>]+>/g, " ")
  )
    .replace(/[ \t]+/g, " ")
    .replace(/\n\s*\n+/g, "\n")
    .trim();

const first = (html, re) => {
  const m = html.match(re);
  return m ? text(m[1]) : null;
};
const all = (html, re) => [...html.matchAll(re)].map((m) => text(m[1])).filter(Boolean);
const uniq = (arr) => [...new Set(arr.map((v) => v.trim()).filter(Boolean))];

const PRICE = /(?:[$\u20ac\u00a3]\s?\d[\d,.]*|\d[\d,.]*\s?(?:USD|EUR|GBP)\b|per (?:month|year|run|seat|key))/gi;

// ---------- optional renderer, for client-rendered sites ----------
let renderer = null;
async function startRenderer() {
  const { chromium } = findPlaywright(); // --render needs it
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  return {
    html: async (url) => {
      await page.goto(url, { waitUntil: "load", timeout: 30000 });
      await page.waitForTimeout(600);
      return page.content();
    },
    close: () => browser.close(),
  };
}

// ---------- one page ----------
async function readPage(url) {
  let html;
  let status = 200;
  if (renderer) {
    try {
      html = await renderer.html(url);
    } catch (e) {
      return { url, error: e.message };
    }
  } else {
    const res = await fetch(url, { headers: { "user-agent": userAgent, accept: "text/html" }, redirect: "follow" });
    status = res.status;
    const type = res.headers.get("content-type") ?? "";
    if (!res.ok || !type.includes("html")) return { url, status, skipped: true };
    html = await res.text();
  }

  const title = first(html, /<title[^>]*>([\s\S]*?)<\/title>/i);
  const metaDescription =
    first(html, /<meta[^>]+name=["']description["'][^>]*content=["']([^"']*)["']/i) ??
    first(html, /<meta[^>]+content=["']([^"']*)["'][^>]*name=["']description["']/i);
  const canonical = first(html, /<link[^>]+rel=["']canonical["'][^>]*href=["']([^"']*)["']/i);
  const h1 = uniq(all(html, /<h1[^>]*>([\s\S]*?)<\/h1>/gi));
  const h2 = uniq(all(html, /<h2[^>]*>([\s\S]*?)<\/h2>/gi)).slice(0, 14);

  const paragraphs = uniq(all(html, /<p[^>]*>([\s\S]*?)<\/p>/gi))
    .filter((p) => p.length > 40)
    .slice(0, 18);

  const buttons = uniq(all(html, /<button[^>]*>([\s\S]*?)<\/button>/gi)).slice(0, 12);
  const links = [...html.matchAll(/<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)].map((m) => ({
    href: m[1],
    label: text(m[2]).slice(0, 60),
  }));
  const hrefs = [...new Set(links.map((l) => l.href))];
  const prices = uniq((html.match(PRICE) ?? []).map((p) => p.trim())).slice(0, 20);

  return { url, status, title, metaDescription, canonical, h1, h2, paragraphs, buttons, links, hrefs, prices };
}

// ---------- robots ----------
async function robotsFor(origin) {
  try {
    const res = await fetch(new URL("/robots.txt", origin), { headers: { "user-agent": userAgent } });
    if (!res.ok) return [];
    const body = await res.text();
    const groups = body.split(/\n(?=\s*user-agent)/i);
    const mine = groups.find((g) => /user-agent:\s*\*/i.test(g));
    if (!mine) return [];
    return [...mine.matchAll(/^disallow:\s*(\S+)/gim)].map((m) => m[1]).filter((p) => p && p !== "/");
  } catch {
    return [];
  }
}

async function crawlUrl(start) {
  const origin = new URL(start).origin;
  const disallowed = await robotsFor(origin);
  const blocked = (path) => disallowed.some((d) => path.startsWith(d.replace(/\*$/, "")));

  const seen = new Set();
  const queue = [new URL(start).href];
  const pages = [];

  while (queue.length && pages.length < maxPages) {
    const url = queue.shift();
    if (seen.has(url)) continue;
    seen.add(url);
    const path = new URL(url).pathname;
    if (blocked(path)) continue;

    let page;
    try {
      page = await readPage(url);
    } catch (e) {
      pages.push({ url, error: e.message });
      continue;
    }
    if (page.skipped) continue;
    pages.push(page);

    const priority = (h) => {
      if (/\/(pricing|plans?|docs?|about|security|terms|privacy|changelog|blog|product)\b/i.test(h)) return 0;
      return 1;
    };
    const next = page.hrefs
      .map((h) => {
        try {
          return new URL(h, url);
        } catch {
          return null;
        }
      })
      .filter((u) => u && u.origin === origin && /^https?:$/.test(u.protocol))
      .filter((u) => !/\.(png|jpe?g|webp|svg|pdf|zip|mp4|ico|css|js|woff2?)$/i.test(u.pathname))
      .map((u) => ({ href: u.origin + u.pathname, p: priority(u.pathname) }))
      .sort((a, b) => a.p - b.p)
      .map((v) => v.href);
    for (const h of next) if (!seen.has(h)) queue.push(h);
  }
  return { origin, disallowed, pages };
}

// ---------- a folder ----------
function walk(dir, depth = 0, acc = []) {
  if (depth > 3) return acc;
  let entries = [];
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return acc;
  }
  for (const e of entries) {
    if (/^(node_modules|\.git|dist|build|\.next|vendor|target|coverage|\.venv|__pycache__)$/.test(e.name)) continue;
    const p = join(dir, e.name);
    if (e.isDirectory()) walk(p, depth + 1, acc);
    else acc.push(p);
  }
  return acc;
}

function crawlDir(dir) {
  const root = resolve(dir);
  const files = walk(root);
  const rel = (p) => relative(root, p).replace(/\\/g, "/");
  const read = (p, limit = 12000) => {
    try {
      return readFileSync(p, "utf8").slice(0, limit);
    } catch {
      return null;
    }
  };

  const blocks = [];
  const gaps = [];

  const readme = files.find((f) => /^readme(\.md|\.txt|\.rst)?$/i.test(basename(f)));
  if (readme) {
    blocks.push({ source: rel(readme), kind: "readme", body: read(readme) });
  } else {
    gaps.push("no README in the root");
  }

  const manifests = files.filter((f) =>
    /(^|\/)(package\.json|pyproject\.toml|Cargo\.toml|go\.mod|composer\.json|Gemfile|requirements\.txt|Dockerfile|Makefile)$/i.test(rel(f))
  );
  for (const m of manifests.slice(0, 6)) {
    const body = read(m, 6000);
    if (body) blocks.push({ source: rel(m), kind: "manifest", body });
  }

  const docs = files.filter((f) => /\.(md|mdx)$/i.test(f) && !/node_modules/.test(f)).slice(0, 25);
  for (const d of docs) {
    if (readme && d === readme) continue;
    const body = read(d, 4000);
    if (!body) continue;
    const headings = [...body.matchAll(/^#{1,4}\s+(.+)$/gm)].map((h) => h[1].trim()).slice(0, 20);
    blocks.push({ source: rel(d), kind: "doc", headings, excerpt: body.replace(/^#{1,4}.*$/gm, "").trim().slice(0, 1200) });
  }

  const routes = files
    .filter((f) => /(^|\/)(pages|app|routes|src\/pages|src\/routes)\//.test(rel(f)) && /\.(jsx?|tsx?|vue|svelte|astro|html|php)$/i.test(f))
    .map((f) => rel(f).replace(/^.*?(pages|app|routes)\//, "$1/"))
    .slice(0, 40);
  if (routes.length) blocks.push({ source: "routes", kind: "routes", body: uniq(routes).join("\n") });

  let git = null;
  try {
    git = execFileSync("git", ["-C", root, "log", "--oneline", "-30"], { encoding: "utf8" });
  } catch {
    git = null;
  }
  if (git) blocks.push({ source: "git log --oneline -30", kind: "history", body: git.trim() });
  else gaps.push("not a git repo, or git is unavailable");

  const uiStrings = [];
  for (const f of files.filter((f) => /\.(jsx?|tsx?|vue|svelte|astro|html)$/i.test(f)).slice(0, 60)) {
    const body = read(f, 8000);
    if (!body) continue;
    for (const m of body.matchAll(/>([A-Z][^<>{}]{6,80})</g)) uiStrings.push(m[1].trim());
  }
  if (uiStrings.length) blocks.push({ source: "UI strings across components", kind: "strings", body: uniq(uiStrings).slice(0, 60).join("\n") });
  else gaps.push("no UI strings found in components, so there is no raw copy from the interface");

  if (!files.some((f) => /pricing|plans/i.test(rel(f)))) gaps.push("no pricing page or plan copy found");
  if (!files.some((f) => /changelog|releases?/i.test(rel(f)))) gaps.push("no changelog");
  if (!manifests.length) gaps.push("no manifest, so the stack and dependencies are unknown");

  return { root, blocks, gaps, fileCount: files.length };
}

// ---------- render ----------
function renderUrlReport({ origin, disallowed, pages }) {
  const lines = [`# Raw dossier — ${origin}`, "", `generated ${new Date().toISOString().slice(0, 10)}`, "", "Every line below is copied from the source. Nothing here is an interpretation.", ""];
  if (disallowed.length) lines.push(`> robots.txt disallows: ${disallowed.join(", ")}. Those paths were not crawled.`, "");

  for (const p of pages) {
    lines.push(`## ${new URL(p.url).pathname || "/"}`);
    lines.push(`source: ${p.url}`);
    if (p.error) {
      lines.push(`error: ${p.error}`, "");
      continue;
    }
    if (p.title) lines.push(`title: ${p.title}`);
    if (p.metaDescription) lines.push(`meta: ${p.metaDescription}`);
    if (p.canonical) lines.push(`canonical: ${p.canonical}`);
    for (const h of p.h1) lines.push(`h1: ${h}`);
    for (const h of p.h2) lines.push(`h2: ${h}`);
    if (p.prices.length) lines.push(`prices: ${p.prices.join(" | ")}`);
    if (p.buttons.length) lines.push(`buttons: ${p.buttons.join(" | ")}`);
    if (p.paragraphs.length) {
      lines.push("", "body:");
      for (const t of p.paragraphs) lines.push(`- ${t}`);
    }
    lines.push("");
  }

  const gaps = [];
  const bodyChars = pages.reduce((n, p) => n + (p.paragraphs ?? []).join(" ").length, 0);
  if (bodyChars < 600 && !renderMode) gaps.push("the raw HTML carries almost no body text, so the site is client-rendered: re-run with --render");
  const joined = pages.map((p) => (p.paragraphs ?? []).join(" ") + " " + (p.title ?? "")).join(" ");
  if (!pages.some((p) => p.prices?.length)) gaps.push("no price anywhere in the crawl");
  if (!pages.some((p) => /pricing|plans/i.test(p.url))) gaps.push("no pricing page reached");
  if (!pages.some((p) => /docs/i.test(p.url))) gaps.push("no docs page reached");
  if (!pages.some((p) => /changelog|releases/i.test(p.url))) gaps.push("no changelog reached");
  if (!/\d/.test(joined.replace(/\d{4}/g, ""))) gaps.push("almost no numbers on the crawled pages, so proof will be hard");
  if (pages.length < 3) gaps.push("fewer than three pages reached, the site may be client-rendered or behind auth");

  return lines.concat(["## Gaps", ...gaps.map((g) => `- ${g}`), ""]).join("\n");
}

function renderDirReport({ root, blocks, gaps, fileCount }) {
  const lines = [
    `# Raw dossier — ${basename(root)}`,
    "",
    `generated ${new Date().toISOString().slice(0, 10)} · ${fileCount} files scanned · root ${root}`,
    "",
    "Every line below is copied from the source. Nothing here is an interpretation.",
    "",
  ];
  for (const b of blocks) {
    lines.push(`## ${b.kind} · ${b.source}`, "");
    if (b.headings?.length) lines.push(`headings: ${b.headings.join(" | ")}`, "");
    const body = b.body ?? b.excerpt;
    if (body) lines.push("```", body.trim().slice(0, 6000), "```", "");
  }
  lines.push("## Gaps", ...gaps.map((g) => `- ${g}`), "");
  return lines.join("\n");
}

// ---------- run ----------
let report;
if (/^https?:\/\//i.test(target)) {
  if (renderMode) renderer = await startRenderer();
  try {
    report = renderUrlReport(await crawlUrl(target));
  } finally {
    if (renderer) await renderer.close();
  }
} else if (existsSync(target) && statSync(target).isDirectory()) {
  report = renderDirReport(crawlDir(target));
} else {
  console.error(`not a URL or a directory: ${target}`);
  process.exit(2);
}

if (outPath) {
  writeFileSync(outPath, report, "utf8");
  console.log(`wrote ${outPath} (${report.length.toLocaleString()} chars)`);
} else {
  console.log(report);
}
