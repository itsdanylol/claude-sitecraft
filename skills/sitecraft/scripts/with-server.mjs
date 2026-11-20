// with-server.mjs — start a server, wait until it answers, run a command against it, always tear it down.
// Idea from the with_server helper in Anthropic's webapp-testing skill (Apache-2.0); this is an independent Node rewrite.
// usage: node with-server.mjs --server "npx --yes serve site -l 4173" --port 4173 [--server ... --port ...]
//                             [--timeout 60] [--path /] -- node verify.mjs http://localhost:4173 --out .verify
// Exits with the wrapped command's exit code. If a port already answers, that server is reused and left alone.
import { spawn, spawnSync } from "node:child_process";

const argv = process.argv.slice(2);
const sep = argv.indexOf("--");
if (sep < 0 || sep === argv.length - 1) {
  console.error('usage: node with-server.mjs --server "<cmd>" --port N [...] [--timeout 60] [--path /] -- <command ...>');
  process.exit(2);
}
const own = argv.slice(0, sep);
const command = argv.slice(sep + 1);

const servers = [];
let timeout = 60;
let probePath = "/";
for (let i = 0; i < own.length; i++) {
  const a = own[i];
  const v = own[i + 1];
  if (a === "--server") servers.push({ cmd: v, port: null }), i++;
  else if (a === "--port") {
    const s = [...servers].reverse().find((x) => x.port === null);
    if (!s) { console.error("--port must follow a --server"); process.exit(2); }
    s.port = Number(v); i++;
  } else if (a === "--timeout") timeout = Number(v), i++;
  else if (a === "--path") probePath = v, i++;
  else { console.error(`unknown flag: ${a}`); process.exit(2); }
}
if (!servers.length || servers.some((s) => !s.cmd || !s.port)) {
  console.error("every --server needs a --port");
  process.exit(2);
}

const isWin = process.platform === "win32";
const children = [];

async function answers(port) {
  for (const host of ["127.0.0.1", "localhost"]) {
    try {
      const r = await fetch(`http://${host}:${port}${probePath}`, { signal: AbortSignal.timeout(1500) });
      if (r.status < 500) return true;
    } catch {}
  }
  return false;
}

function killTree(child) {
  if (!child || child.exitCode !== null) return;
  // synchronous, so the kill finishes before this process exits; /T takes the shell's children with it
  if (isWin) spawnSync("taskkill", ["/pid", String(child.pid), "/T", "/F"], { stdio: "ignore" });
  else try { process.kill(-child.pid, "SIGTERM"); } catch { try { child.kill("SIGTERM"); } catch {} }
}
function teardown() { for (const c of children) killTree(c); }
process.on("SIGINT", () => { teardown(); process.exit(130); });
process.on("SIGTERM", () => { teardown(); process.exit(143); });

let code = 1;
try {
  for (const s of servers) {
    if (await answers(s.port)) {
      console.error(`[with-server] port ${s.port} already answers, reusing it`);
      continue;
    }
    console.error(`[with-server] starting: ${s.cmd}`);
    const child = spawn(s.cmd, { shell: true, stdio: ["ignore", "pipe", "pipe"], detached: !isWin });
    const tail = [];
    const keep = (d) => { tail.push(String(d)); if (tail.length > 40) tail.shift(); };
    child.stdout.on("data", keep);
    child.stderr.on("data", keep);
    children.push(child);
    const deadline = Date.now() + timeout * 1000;
    let up = false;
    while (Date.now() < deadline) {
      if (child.exitCode !== null) break;
      if (await answers(s.port)) { up = true; break; }
      await new Promise((r) => setTimeout(r, 400));
    }
    if (!up) {
      const why = child.exitCode !== null ? `server exited with code ${child.exitCode}` : `port ${s.port} never answered within ${timeout}s`;
      console.error(`[with-server] ${why}. Last output:\n${tail.join("").slice(-2000)}`);
      throw new Error("server did not start");
    }
    console.error(`[with-server] port ${s.port} is up`);
  }
  console.error(`[with-server] running: ${command.join(" ")}`);
  code = await new Promise((res) => {
    // on Windows a shell is needed to find npx/npm .cmd shims, so pass one quoted string instead of an args array
    const quote = (a) => (/^[\w@%+=:,./\\-]+$/.test(a) ? a : `"${a.replace(/"/g, '\\"')}"`);
    const c = isWin
      ? spawn(command.map(quote).join(" "), { stdio: "inherit", shell: true })
      : spawn(command[0], command.slice(1), { stdio: "inherit" });
    c.on("exit", (n) => res(n ?? 1));
    c.on("error", (e) => { console.error(e.message); res(1); });
  });
} catch {
  code = 1;
} finally {
  teardown();
}
process.exit(code);
