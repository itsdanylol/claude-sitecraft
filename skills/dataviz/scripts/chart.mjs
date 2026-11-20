// chart.mjs — rows in, one honest chart out. No chart library, no runtime, no fake data.
// usage: node chart.mjs data.csv --type line --out chart.svg
//        node chart.mjs data.json --type bar --accent "#e0a458" --theme dark
// data: CSV with a header row (first column is the category) or JSON array of objects.
import { readFileSync, writeFileSync } from "node:fs";

const argv = process.argv.slice(2);
const flag = (name, fallback) => {
  const i = argv.indexOf(name);
  return i >= 0 && argv[i + 1] ? argv[i + 1] : fallback;
};
const has = (name) => argv.includes(name);

const input = argv[0];
if (!input) {
  console.error(`usage: node chart.mjs <data.csv|data.json> [--type ${TYPES().join("|")}] [--out chart.svg]`);
  process.exit(2);
}
function TYPES() {
  return ["line", "bar", "stacked", "sparkline", "progress"];
}

const type = flag("--type", "line");
if (!TYPES().includes(type)) {
  console.error(`--type must be one of ${TYPES().join(", ")}`);
  process.exit(2);
}
const outPath = flag("--out", null);
const width = Number(flag("--width", type === "sparkline" ? "180" : "720"));
const height = Number(flag("--height", type === "sparkline" ? "48" : "260"));
const accent = flag("--accent", "#e0a458");
const theme = flag("--theme", "dark");
const title = flag("--title", "");
const subtitle = flag("--subtitle", "");
const unit = flag("--unit", "");
const decimals = Number(flag("--decimals", "0"));
const xLabel = flag("--xlabel", "");
const yLabel = flag("--ylabel", "");
const maxOverride = flag("--max", null);

// ---------- parse ----------
function parseCsv(text) {
  const rows = text
    .trim()
    .split(/\r?\n/)
    .map((line) => line.split(",").map((c) => c.trim().replace(/^"|"$/g, "")));
  const header = rows.shift();
  return rows.map((r) => Object.fromEntries(header.map((h, i) => [h, r[i] ?? ""])));
}

function parseJson(text) {
  const data = JSON.parse(text);
  if (Array.isArray(data)) return data;
  if (data?.categories && Array.isArray(data.series)) {
    return data.categories.map((c, i) => {
      const row = { category: c };
      for (const s of data.series) row[s.name] = s.values[i];
      return row;
    });
  }
  throw new Error("JSON must be an array of objects, or { categories: [], series: [{ name, values: [] }] }");
}

const raw = readFileSync(input, "utf8");
const rows = input.toLowerCase().endsWith(".json") ? parseJson(raw) : parseCsv(raw);
if (!rows.length) {
  console.error("no rows in the input");
  process.exit(2);
}

const columns = Object.keys(rows[0]);
const xKey = columns.find((c) => !/^-?\d+([.,]\d+)?$/.test(String(rows[0][c]))) ?? columns[0];
const seriesKeys = columns.filter((c) => c !== xKey);
const categories = rows.map((r) => String(r[xKey]));
const series = seriesKeys.map((k) => ({
  name: k,
  values: rows.map((r) => {
    const n = Number(String(r[k]).replace(/[^0-9.-]/g, ""));
    return Number.isFinite(n) ? n : 0;
  }),
}));

// ---------- palette ----------
const palettes = {
  dark: { bg: "none", grid: "rgba(232,230,225,0.10)", axis: "rgba(232,230,225,0.22)", text: "#8a8f98", strong: "#e8e6e1" },
  light: { bg: "none", grid: "rgba(10,11,13,0.09)", axis: "rgba(10,11,13,0.22)", text: "#5b6068", strong: "#14161a" },
};
const pal = palettes[theme] ?? palettes.dark;
const neutralSteps = theme === "dark" ? ["#8a8f98", "#5d636b", "#454b53", "#343941"] : ["#6f757e", "#9aa0a8", "#c1c5cb", "#d8dbe0"];
const colorFor = (i, n) => (i === 0 ? accent : neutralSteps[(i - 1) % neutralSteps.length]);
const accentSoft = (opacity) => accent;

// ---------- numbers ----------
const fmt = (n) =>
  Math.abs(n) >= 1000
    ? n.toLocaleString("en-US", { minimumFractionDigits: decimals, maximumFractionDigits: decimals })
    : n.toFixed(decimals);

function niceScale(v, ticks) {
  if (v <= 0) return { max: ticks, step: 1 };
  const raw = v / ticks;
  const mag = Math.pow(10, Math.floor(Math.log10(raw)));
  const step = [1, 2, 2.5, 5, 10].map((s) => s * mag).find((s) => s >= raw) ?? 10 * mag;
  return { max: step * ticks, step };
}

// ---------- geometry ----------
const pad =
  type === "sparkline"
    ? { t: 2, r: 2, b: 2, l: 2 }
    : type === "progress"
      ? { t: title || subtitle ? 40 : 8, r: 16, b: 24, l: 8 }
      : { t: title || subtitle ? 46 : 18, r: 18, b: series.length > 1 ? 66 : 44, l: 58 };
const plotW = width - pad.l - pad.r;
const plotH = height - pad.t - pad.b;

const TICKS = 5;
const totals = series.map((s) => s.values.reduce((a, b) => a + b, 0));
const stackedTotals = categories.map((_, i) => series.reduce((sum, s) => sum + (s.values[i] ?? 0), 0));
const dataMax = maxOverride
  ? Number(maxOverride)
  : type === "stacked"
    ? Math.max(...stackedTotals, 1)
    : Math.max(...series.flatMap((s) => s.values), 1);
const scale = type === "progress" ? { max: Math.max(dataMax, 1), step: Math.max(dataMax, 1) / TICKS } : niceScale(dataMax, TICKS);
const yMax = scale.max;
const n = categories.length;

const xAt = (i) => (type === "bar" || type === "stacked" ? pad.l + (plotW / n) * (i + 0.5) : pad.l + (n === 1 ? plotW / 2 : (plotW / (n - 1)) * i));
const yAt = (v) => pad.t + plotH - (v / yMax) * plotH;

const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const mono = `font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-variant-numeric:tabular-nums`;
const labelFont = `font-family:ui-sans-serif,system-ui,-apple-system,"Segoe UI",sans-serif`;

// ---------- draw ----------
const parts = [];
parts.push(
  `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-labelledby="ct cd">`
);
parts.push(`<title id="ct">${esc(title || categories.join(", ").slice(0, 80))}</title>`);
parts.push(
  `<desc id="cd">${esc(
    `${type} chart. ${series.map((s) => `${s.name}: ${fmt(Math.max(...s.values))}${unit ? " " + unit : ""} at the highest point`).join("; ")}. ${categories.length} points from ${categories[0]} to ${categories[n - 1]}.`
  )}</desc>`
);
parts.push(`<rect width="${width}" height="${height}" fill="${pal.bg}"/>`);

if (title) parts.push(`<text x="${pad.l}" y="24" fill="${pal.strong}" style="${labelFont};font-size:14px;font-weight:500">${esc(title)}</text>`);
if (subtitle) parts.push(`<text x="${pad.l}" y="${title ? 42 : 24}" fill="${pal.text}" style="${labelFont};font-size:12px">${esc(subtitle)}</text>`);

if (type === "line" || type === "bar" || type === "stacked") {
  // gridlines and y labels
  for (let i = 0; i <= TICKS; i++) {
    const v = scale.step * i;
    const y = yAt(v);
    parts.push(`<line x1="${pad.l}" x2="${pad.l + plotW}" y1="${y}" y2="${y}" stroke="${pal.grid}" stroke-width="1"/>`);
    parts.push(`<text x="${pad.l - 10}" y="${y + 4}" text-anchor="end" fill="${pal.text}" style="${mono};font-size:11px">${fmt(v)}</text>`);
  }
  if (yLabel) parts.push(`<text x="${pad.l - 46}" y="${pad.t - 8}" fill="${pal.text}" style="${labelFont};font-size:11px">${esc(yLabel)}</text>`);
  if (xLabel) parts.push(`<text x="${pad.l + plotW}" y="${height - 8}" text-anchor="end" fill="${pal.text}" style="${labelFont};font-size:11px">${esc(xLabel)}</text>`);
}

if (type === "line") {
  series.forEach((s, si) => {
    const color = colorFor(si, series.length);
    const pts = s.values.map((v, i) => `${xAt(i).toFixed(1)},${yAt(v).toFixed(1)}`).join(" ");
    parts.push(`<polyline points="${pts}" fill="none" stroke="${color}" stroke-width="${si === 0 ? 2 : 1.5}" stroke-linejoin="round" stroke-linecap="round" ${si === 0 ? "" : 'stroke-dasharray="4 4"'}/>`);
    if (n <= 14) {
      s.values.forEach((v, i) => {
        parts.push(`<circle cx="${xAt(i).toFixed(1)}" cy="${yAt(v).toFixed(1)}" r="${si === 0 ? 3 : 2}" fill="${color}"/>`);
      });
    }
  });
}

if (type === "bar") {
  const slot = plotW / n;
  const groupW = slot * 0.72;
  const barW = groupW / series.length;
  series.forEach((s, si) => {
    const color = colorFor(si, series.length);
    s.values.forEach((v, i) => {
      const x = pad.l + slot * i + (slot - groupW) / 2 + barW * si;
      const y = yAt(v);
      parts.push(`<rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${Math.max(1, barW - 2).toFixed(1)}" height="${Math.max(0, pad.t + plotH - y).toFixed(1)}" fill="${color}"/>`);
    });
  });
}

if (type === "stacked") {
  const slot = plotW / n;
  const barW = slot * 0.56;
  categories.forEach((_, i) => {
    let acc = 0;
    series.forEach((s, si) => {
      const v = s.values[i] ?? 0;
      const y0 = yAt(acc);
      const y1 = yAt(acc + v);
      const x = pad.l + slot * i + (slot - barW) / 2;
      parts.push(`<rect x="${x.toFixed(1)}" y="${y1.toFixed(1)}" width="${barW.toFixed(1)}" height="${Math.max(0, y0 - y1).toFixed(1)}" fill="${colorFor(si, series.length)}"/>`);
      acc += v;
    });
  });
}

if (type === "sparkline") {
  const s = series[0];
  const min = Math.min(...s.values);
  const max = Math.max(...s.values);
  const sy = (v) => pad.t + plotH - ((v - min) / (max - min || 1)) * plotH;
  const pts = s.values.map((v, i) => `${xAt(i).toFixed(1)},${sy(v).toFixed(1)}`).join(" ");
  parts.push(`<polyline points="${pts}" fill="none" stroke="${accent}" stroke-width="1.5" stroke-linejoin="round" stroke-linecap="round"/>`);
  const lastX = xAt(s.values.length - 1);
  const lastY = sy(s.values[s.values.length - 1]);
  parts.push(`<circle cx="${lastX.toFixed(1)}" cy="${lastY.toFixed(1)}" r="2.5" fill="${accent}"/>`);
}

if (type === "progress") {
  const value = series[0].values[0];
  const pct = Math.max(0, Math.min(1, value / yMax));
  const barH = 8;
  const y = pad.t;
  parts.push(`<rect x="${pad.l}" y="${y}" width="${plotW}" height="${barH}" fill="${pal.grid}"/>`);
  parts.push(`<rect x="${pad.l}" y="${y}" width="${(plotW * pct).toFixed(1)}" height="${barH}" fill="${accent}"/>`);
  if (categories[0] !== title) {
    parts.push(
      `<text x="${pad.l}" y="${y + barH + 18}" fill="${pal.strong}" style="${labelFont};font-size:13px;font-weight:500">${esc(categories[0])}</text>`
    );
  }
  parts.push(
    `<text x="${pad.l + plotW}" y="${y + barH + 18}" text-anchor="end" fill="${pal.text}" style="${mono};font-size:12px">${fmt(value)}${unit ? " " + esc(unit) : ""} of ${fmt(yMax)}</text>`
  );
}

// x labels
if (type === "line" || type === "bar" || type === "stacked") {
  const step = Math.max(1, Math.ceil(n / 12));
  categories.forEach((c, i) => {
    if (i % step !== 0 && i !== n - 1) return;
    parts.push(
      `<text x="${xAt(i).toFixed(1)}" y="${pad.t + plotH + 18}" text-anchor="${type === "line" ? "middle" : "middle"}" fill="${pal.text}" style="${mono};font-size:11px">${esc(c)}</text>`
    );
  });
}

// legend, only when there is more than one series
if (series.length > 1 && type !== "sparkline" && type !== "progress") {
  let lx = pad.l;
  const ly = height - 10;
  series.forEach((s, si) => {
    parts.push(`<rect x="${lx}" y="${ly - 8}" width="8" height="8" fill="${colorFor(si, series.length)}"/>`);
    parts.push(`<text x="${lx + 13}" y="${ly}" fill="${pal.text}" style="${labelFont};font-size:11px">${esc(s.name)}</text>`);
    lx += 13 + s.name.length * 6.2 + 18;
  });
}

parts.push("</svg>");
const svg = parts.join("\n");

if (outPath) {
  writeFileSync(outPath, svg, "utf8");
  console.log(`wrote ${outPath} (${svg.length.toLocaleString()} chars, ${type}, ${n} points, ${series.length} series)`);
  if (series.length > 3) console.log(`note: ${series.length} series is a lot for one chart. One accent, the rest neutral, or split into two charts.`);
  if (n > 24 && type !== "line") console.log(`note: ${n} categories in bars gets crowded. A line for a trend, or rank the top 8.`);
} else {
  console.log(svg);
}
