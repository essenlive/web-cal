#!/usr/bin/env node
// Minimal chromium-cli-style REPL for driving web-cal in a headless container.
// Reads newline-delimited commands from stdin, one per line:
//
//   nav <url>
//   wait-for text=<substring>          (or any CSS selector)
//   hover text=<substring>              (or any CSS selector; first match)
//   click text=<substring>              (or any CSS selector; first match)
//   fill <selector>|||<value>           (locator.fill; use a real selector, not text=, for inputs with a placeholder)
//   dragto <fromSelector>|||<toSelector> (native HTML5 drag-and-drop; use `[data-slot="drawer-content"] >> text=X` to disambiguate from the dimmed sidebar behind an open drawer)
//   screenshot <name>                   (PNG written to shots/, full page)
//   console                             (print collected page/console errors)
//
// Usage:
//   node .claude/skills/run-web-cal/driver.mjs <<'EOF'
//   nav http://localhost:3050/dev
//   wait-for text=Calendrier
//   screenshot dev-page
//   EOF
//
// Screenshots land in .claude/skills/run-web-cal/shots/ (relative to this file,
// so it works regardless of the caller's cwd).

import { chromium } from "playwright";
import { createInterface } from "node:readline";
import { mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const shotsDir = join(here, "shots");
mkdirSync(shotsDir, { recursive: true });

function toLocator(page, arg) {
  if (arg.startsWith("text=")) return page.locator(`text=${arg.slice(5)}`).first();
  return page.locator(arg).first();
}

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1400, height: 1000 } });
const errors = [];
page.on("pageerror", (e) => errors.push(String(e)));
page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });

const rl = createInterface({ input: process.stdin });
for await (const raw of rl) {
  const line = raw.trim();
  if (!line || line.startsWith("#")) continue;
  const [cmd, ...rest] = line.split(" ");
  const arg = rest.join(" ");
  try {
    if (cmd === "nav") {
      await page.goto(arg, { waitUntil: "networkidle" });
    } else if (cmd === "wait-for") {
      await toLocator(page, arg).waitFor({ timeout: 15000 });
    } else if (cmd === "hover") {
      await toLocator(page, arg).hover();
    } else if (cmd === "click") {
      await toLocator(page, arg).click();
    } else if (cmd === "fill") {
      const [selector, ...value] = arg.split("|||");
      await toLocator(page, selector).fill(value.join("|||"));
    } else if (cmd === "dragto") {
      const [from, to] = arg.split("|||");
      await toLocator(page, from).dragTo(toLocator(page, to));
    } else if (cmd === "screenshot") {
      const path = join(shotsDir, `${arg || "screenshot"}.png`);
      await page.screenshot({ path, fullPage: true });
      console.log(`screenshot -> ${path}`);
    } else if (cmd === "console") {
      console.log("ERRORS:", JSON.stringify(errors));
    } else {
      console.log(`unknown command: ${cmd}`);
    }
  } catch (e) {
    console.log(`ERROR running "${line}": ${e.message}`);
  }
}

await browser.close();
