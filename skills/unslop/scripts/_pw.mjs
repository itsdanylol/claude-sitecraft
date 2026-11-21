// _pw.mjs — find Playwright wherever it was installed. Each skill folder carries its own copy of this file,
// because the skills can be installed one at a time. Places, in order:
//   1. the project being checked (npm i -D playwright)
//   2. next to this script and up the tree (npm install in a clone, or in a plugin folder)
//   3. $SITECRAFT_DEPS, then <skills>/.sitecraft-deps, where install.sh and install.ps1 put it
//   4. NODE_PATH, then the global npm folder (npm i -g playwright)
import { createRequire } from "node:module";
import { execSync } from "node:child_process";
import { join, dirname } from "node:path";
import { homedir } from "node:os";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));

function bases() {
  const list = [join(process.cwd(), "package.json"), join(here, "package.json")];
  if (process.env.SITECRAFT_DEPS) list.push(join(process.env.SITECRAFT_DEPS, "package.json"));
  list.push(join(here, "..", "..", ".sitecraft-deps", "package.json"), join(homedir(), ".claude", "skills", ".sitecraft-deps", "package.json"));
  return list;
}

function globalBase() {
  try {
    const root = execSync("npm root -g", { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"], timeout: 8000 }).trim();
    return root ? join(dirname(root), "package.json") : null;
  } catch { return null; }
}

export function findPlaywright({ names = ["playwright", "playwright-core"], exit = true } = {}) {
  const tryAll = (list) => {
    for (const base of list) for (const name of names) {
      try { return createRequire(base)(name); } catch {}
    }
    return null;
  };
  const found = tryAll(bases()) ?? tryAll([globalBase()].filter(Boolean));
  if (found || !exit) return found;
  console.error([
    "Playwright not found. Pick one:",
    "  - run install.sh (or install.ps1) from the sitecraft repo again, it installs it beside the skills",
    "  - in the project you are checking: npm i -D playwright && npx playwright install chromium",
    "  - globally: npm i -g playwright && npx playwright install chromium",
    "  - or point SITECRAFT_DEPS at a folder whose node_modules holds playwright",
  ].join("\n"));
  process.exit(2);
}
