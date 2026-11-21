// serve.mjs — find the stack, start the site, wait until it answers, look at it, stop it.
// usage: node serve.mjs [dir] [--port 4173] [--open] [--shot out.png] [--stop] [--detect] [--timeout 90]
import { spawn, execFileSync } from "node:child_process";
import { findPlaywright } from "./_pw.mjs";
import { createServer } from "node:net";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync, openSync } from "node:fs";
import { createRequire } from "node:module";
import { join, resolve } from "node:path";
import { platform } from "node:os";

const argv = process.argv.slice(2);
const flag = (name, fallback) => {
  const i = argv.indexOf(name);
  return i >= 0 && argv[i + 1] ? argv[i + 1] : fallback;
};
const has = (name) => argv.includes(name);
const positional = argv.filter((a, i) => !a.startsWith("--") && !argv[i - 1]?.startsWith("--"));
const dir = resolve(positional[0] ?? ".");
const wantedPort = Number(flag("--port", "4173"));
const timeoutS = Number(flag("--timeout", "90"));
const stateFile = join(dir, ".run", "state.json");

if (!existsSync(dir)) {
  console.error(`no such folder: ${dir}`);
  process.exit(2);
}

// ---------- detect ----------
function detect(root) {
  const pkgPath = join(root, "package.json");
  if (existsSync(pkgPath)) {
    let pkg = {};
    try {
      // a BOM from a Windows editor breaks JSON.parse and silently turns every project into "unknown"
      pkg = JSON.parse(readFileSync(pkgPath, "utf8").replace(/^\uFEFF/, ""));
    } catch {
      /* a broken package.json is a finding, not a crash */
    }
    const scripts = pkg.scripts ?? {};
    const order = ["dev", "start", "serve", "preview"];
    const name = order.find((s) => scripts[s]);
    const deps = { ...(pkg.dependencies ?? {}), ...(pkg.devDependencies ?? {}) };
    const framework =
      deps.next ? "next" :
      deps["@angular/core"] ? "angular" :
      deps.nuxt ? "nuxt" :
      deps.astro ? "astro" :
      deps["@sveltejs/kit"] ? "sveltekit" :
      deps.svelte ? "svelte" :
      deps.vue ? "vue" :
      deps.vite ? "vite" :
      deps.react ? "react" :
      "node";
    if (name) {
      return {
        kind: "package-script",
        framework,
        cmd: platform() === "win32" ? "npm.cmd" : "npm",
        args: ["run", name],
        note: `package.json scripts.${name}`,
        hint: scripts[name],
      };
    }
  }

  for (const config of ["astro.config.mjs", "astro.config.ts", "next.config.js", "next.config.mjs", "vite.config.js", "vite.config.ts", "nuxt.config.ts", "svelte.config.js"]) {
    if (existsSync(join(root, config))) {
      return { kind: "config-only", framework: config.split(".")[0], cmd: null, args: [], note: config };
    }
  }

  if (existsSync(join(root, "index.html"))) {
    return { kind: "static", framework: "static", root, note: "index.html in the root" };
  }
  if (existsSync(join(root, "public", "index.html"))) {
    return { kind: "static", framework: "static", root: join(root, "public"), note: "public/index.html" };
  }
  if (existsSync(join(root, "dist", "index.html"))) {
    return { kind: "static", framework: "static", root: join(root, "dist"), note: "built output in dist/" };
  }
  if (existsSync(join(root, "build", "index.html"))) {
    return { kind: "static", framework: "static", root: join(root, "build"), note: "built output in build/" };
  }
  if (existsSync(join(root, "pubspec.yaml")) || existsSync(join(root, "Cargo.toml")) || existsSync(join(root, "go.mod"))) {
    return { kind: "native", framework: "native", cmd: null, args: [], note: "go/rust/flutter project, check its own run command" };
  }
  return { kind: "unknown", framework: "unknown", cmd: null, args: [], note: "no package.json scripts and no index.html" };
}

const info = detect(dir);

if (has("--detect")) {
  console.log(JSON.stringify({ dir, ...info }, null, 2));
  process.exit(0);
}

// ---------- stop ----------
function killPort(port) {
  // the pid in state.json is sometimes the shell wrapper, so the listener is found by port as a backstop
  try {
    const out = execFileSync("netstat", ["-ano"], { encoding: "utf8" });
    const pids = new Set();
    for (const line of out.split(/\r?\n/)) {
      const m = line.trim().match(/^TCP\s+\S+:(\d+)\s+\S+\s+LISTENING\s+(\d+)$/i);
      if (m && Number(m[1]) === port) pids.add(m[2]);
    }
    for (const p of pids) {
      try {
        execFileSync("taskkill", ["/PID", p, "/T", "/F"], { stdio: "ignore" });
      } catch {
        /* already gone */
      }
    }
    return [...pids];
  } catch {
    return [];
  }
}

if (has("--stop")) {
  if (!existsSync(stateFile)) {
    console.log("nothing running: no .run/state.json here");
    process.exit(0);
  }
  const state = JSON.parse(readFileSync(stateFile, "utf8"));
  try {
    if (platform() === "win32") {
      spawn("taskkill", ["/PID", String(state.pid), "/T", "/F"], { stdio: "ignore" });
    } else {
      process.kill(-state.pid, "SIGTERM");
    }
    console.log(`stopped pid ${state.pid} on port ${state.port}`);
  } catch (e) {
    console.log(`pid ${state.pid} was already gone (${e.code ?? e.message})`);
  }
  // a shell wrapper can die while its server survives, so the port gets checked too
  await new Promise((r) => setTimeout(r, 700));
  if (platform() === "win32") {
    const strays = killPort(state.port);
    if (strays.length) console.log(`also cleared pid ${strays.join(", ")} still listening on ${state.port}`);
  }
  rmSync(stateFile, { force: true });
  process.exit(0);
}

// ---------- port ----------
function freePort(start) {
  return new Promise((res) => {
    const srv = createServer();
    srv.once("error", () => res(freePort(start + 1)));
    srv.once("listening", () => srv.close(() => res(start)));
    srv.listen(start, "127.0.0.1");
  });
}

const port = await freePort(wantedPort);
const url = `http://localhost:${port}`;

// ---------- start ----------
mkdirSync(join(dir, ".run"), { recursive: true });
const logPath = join(dir, ".run", "server.log");

let child;
const isWin = platform() === "win32";
if (info.kind === "static") {
  const py = isWin ? "python" : "python3";
  const out = openSync(logPath, "w");
  // Windows needs a shell for some interpreters; passing one command string avoids arg-escaping warnings
  child = isWin
    ? spawn(`${py} -m http.server ${port} --bind 127.0.0.1 --directory "${info.root}"`, { cwd: dir, stdio: ["ignore", out, out], shell: true })
    : spawn(py, ["-m", "http.server", String(port), "--bind", "127.0.0.1", "--directory", info.root], {
        cwd: dir,
        stdio: ["ignore", out, out],
        detached: true,
      });
} else if (info.cmd) {
  const out = openSync(logPath, "w");
  const env = { ...process.env, PORT: String(port), FORCE_COLOR: "0", BROWSER: "none" };
  const parts = [...info.args, "--", "--port", String(port)];
  child = isWin
    ? spawn(`${info.cmd} ${parts.join(" ")}`, { cwd: dir, stdio: ["ignore", out, out], shell: true, env })
    : spawn(info.cmd, parts, { cwd: dir, stdio: ["ignore", out, out], detached: true, env });
} else {
  console.error(`cannot start this project automatically: ${info.note}`);
  console.error("start it by hand, then run: node verify.mjs <url>");
  process.exit(2);
}

child.on("error", (e) => {
  console.error(`failed to spawn: ${e.message}`);
  process.exit(2);
});

// the state file lands before the wait, so --stop works even if the page never answers
writeFileSync(
  stateFile,
  JSON.stringify(
    { pid: child.pid, port, url, dir, cmd: info.kind === "static" ? "python -m http.server" : `${info.cmd} ${info.args.join(" ")}`, started: new Date().toISOString() },
    null,
    2
  )
);

function stopChild() {
  try {
    if (isWin) spawn("taskkill", ["/PID", String(child.pid), "/T", "/F"], { stdio: "ignore" });
    else process.kill(-child.pid, "SIGTERM");
  } catch {
    /* already gone */
  }
}

// ---------- wait until it answers ----------
const probe = `http://127.0.0.1:${port}`;
const deadline = Date.now() + timeoutS * 1000;
let up = false;
let lastError = "";
let exited = false;
child.on("exit", (code) => {
  exited = true;
  lastError = `server exited with code ${code}`;
});

while (Date.now() < deadline && !exited) {
  await new Promise((r) => setTimeout(r, 500));
  try {
    const res = await fetch(probe, { signal: AbortSignal.timeout(3000) });
    if (res.status < 500) {
      up = true;
      break;
    }
    lastError = `HTTP ${res.status}`;
  } catch (e) {
    lastError = e.cause?.code ?? e.message;
  }
}

if (!up) {
  console.error(`no answer on ${probe} (${lastError})`);
  console.error(`server log: ${logPath}`);
  stopChild();
  await new Promise((r) => setTimeout(r, 600));
  stopChild();
  rmSync(stateFile, { force: true });
  process.exit(1);
}

// ---------- look at it ----------
if (has("--shot") || has("--open")) {
  const shot = flag("--shot", null);
  if (shot) {
    try {
      const pw = findPlaywright({ exit: false });
      if (!pw) throw new Error("playwright not found");
      const { chromium } = pw;
      const browser = await chromium.launch();
      const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
      await page.goto(url, { waitUntil: "load", timeout: 30000 });
      await page.waitForTimeout(800);
      await page.screenshot({ path: shot, fullPage: true });
      await browser.close();
      console.log(`screenshot: ${resolve(shot)}`);
    } catch (e) {
      console.log(`screenshot skipped: ${e.message}`);
      console.log("install with: npm i -g playwright && npx playwright install chromium");
    }
  }
  if (has("--open")) {
    const cmd = platform() === "win32" ? "cmd" : platform() === "darwin" ? "open" : "xdg-open";
    const args = platform() === "win32" ? ["/c", "start", "", url] : [url];
    spawn(cmd, args, { stdio: "ignore", detached: true }).unref();
    console.log(`opened ${url}`);
  }
}

console.log(`\n${info.framework} via ${info.note}`);
console.log(`serving ${url}`);
console.log(`pid ${child.pid} · log ${logPath}`);
console.log(`stop with: node serve.mjs "${dir}" --stop`);

// the child handle would keep this process alive forever; the server is meant to outlive us
child.unref();
process.exit(0);
