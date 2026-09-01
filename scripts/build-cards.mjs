#!/usr/bin/env node
// Regenerates the Featured Projects block in README.md from projects.json.
//
//   node scripts/build-cards.mjs             regenerate the README block
//   node scripts/build-cards.mjs --shots     also screenshot every `live` URL first
//
// Only the text between the PROJECTS markers is rewritten; the rest of README.md
// is left byte-for-byte alone.

import { readFile, writeFile, access, mkdir } from "node:fs/promises";
import { constants } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const README = path.join(ROOT, "README.md");
const MANIFEST = path.join(ROOT, "projects.json");
const SHOTS_DIR = path.join(ROOT, "assets", "projects");

const START = "<!-- PROJECTS:START -->";
const END = "<!-- PROJECTS:END -->";

// Palette — keep in sync with the tokens documented in README.md.
const ACCENT_DARK = "22EBF7";
const ACCENT_LIGHT = "0E7490";
const SURFACE = "0D1117";

const exists = async (p) =>
  access(p, constants.F_OK).then(
    () => true,
    () => false,
  );

/** Shields badge for one stack chip. Encoded so `+`, spaces and `/` survive. */
const chip = (label) => {
  const safe = encodeURIComponent(label).replace(/-/g, "--").replace(/_/g, "__");
  return `<img alt="${label}" src="https://img.shields.io/badge/${safe}-${SURFACE}?style=flat&labelColor=${SURFACE}&color=${SURFACE}" />`;
};

/** One project cell. `img` is a repo-relative path or null. */
function card(project, img) {
  const { name, tagline, stack = [], repo, private: isPrivate, live, role } = project;

  const title = repo
    ? `<a href="https://github.com/${repo}"><b>${name}</b></a>`
    : `<b>${name}</b>`;

  const lines = [];
  if (img) {
    const wrapped = live
      ? `<a href="${live}"><img alt="${name} screenshot" src="${img}" width="100%" /></a>`
      : `<img alt="${name} screenshot" src="${img}" width="100%" />`;
    lines.push(wrapped, "");
  }
  lines.push(title, "");
  if (tagline) lines.push(`<sub>${tagline}</sub>`, "");

  const meta = [];
  if (role) meta.push(`<sub><b>${role}</b></sub>`);
  if (isPrivate) meta.push("<sub>🔒 Private repository</sub>");
  if (live) meta.push(`<sub><a href="${live}">Live demo ↗</a></sub>`);
  if (meta.length) lines.push(meta.join(" &nbsp;·&nbsp; "), "");

  if (stack.length) lines.push(`<sub>${stack.join(" · ")}</sub>`);

  return lines.join("\n");
}

async function renderTable(featured) {
  const cells = [];
  for (const p of featured) {
    const rel = path.posix.join("assets", "projects", `${p.slug}.png`);
    const img = (await exists(path.join(SHOTS_DIR, `${p.slug}.png`))) ? rel : null;
    cells.push(card(p, img));
  }

  // Two columns. A trailing odd cell gets an empty partner so the table stays square.
  const rows = [];
  for (let i = 0; i < cells.length; i += 2) {
    const left = cells[i];
    const right = cells[i + 1] ?? "";
    rows.push(
      `  <tr>\n    <td width="50%" valign="top">\n\n${left}\n\n</td>\n    <td width="50%" valign="top">\n\n${right}\n\n</td>\n  </tr>`,
    );
  }
  return `<table>\n${rows.join("\n")}\n</table>`;
}

function renderMentions(rest) {
  if (!rest.length) return "";
  const items = rest.map((p) => {
    const label = p.repo ? `[${p.name}](https://github.com/${p.repo})` : p.name;
    const stack = p.stack?.length ? ` (${p.stack.join(", ")})` : "";
    return `**${label}**${stack}`;
  });
  return `\nAlso on the workbench: ${items.join(" · ")}\n`;
}

async function screenshot(projects) {
  const targets = projects.filter((p) => p.live);
  if (!targets.length) {
    console.log("No projects have a `live` URL — nothing to screenshot.");
    return;
  }
  const { chromium } = await import("playwright");
  await mkdir(SHOTS_DIR, { recursive: true });
  const browser = await chromium.launch();
  try {
    for (const p of targets) {
      const out = path.join(SHOTS_DIR, `${p.slug}.png`);
      const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
      try {
        await page.goto(p.live, { waitUntil: "networkidle", timeout: 45_000 });
        await page.waitForTimeout(2500);
        await page.screenshot({ path: out });
        console.log(`captured  ${p.slug}.png  <- ${p.live}`);
      } catch (err) {
        // A dead deployment must not fail the whole build; the card falls back to text.
        console.warn(`SKIPPED   ${p.slug}  (${p.live}) — ${err.message.split("\n")[0]}`);
      } finally {
        await page.close();
      }
    }
  } finally {
    await browser.close();
  }
}

async function main() {
  const raw = JSON.parse(await readFile(MANIFEST, "utf8"));
  const projects = Array.isArray(raw) ? raw : raw.projects;
  if (!Array.isArray(projects)) throw new Error("projects.json: expected an array or {projects:[...]}");

  for (const p of projects) {
    if (!p.slug) throw new Error(`projects.json: entry "${p.name ?? "?"}" is missing a slug`);
    if (p.private && p.repo) {
      throw new Error(
        `projects.json: "${p.slug}" is marked private but also has repo "${p.repo}". ` +
          `A private repo link 404s for visitors — set repo to null.`,
      );
    }
  }

  // `--has-live` is a probe for CI: exit 0 if any project has a live URL worth
  // screenshotting, 1 otherwise, so the workflow can skip installing Playwright.
  if (process.argv.includes("--has-live")) {
    const n = projects.filter((p) => p.live).length;
    console.log(`${n} project(s) have a live URL.`);
    process.exit(n > 0 ? 0 : 1);
  }

  if (process.argv.includes("--shots")) await screenshot(projects);

  const featured = projects.filter((p) => p.featured !== false);
  const rest = projects.filter((p) => p.featured === false);

  const block = [START, "", await renderTable(featured), renderMentions(rest), END].join("\n");

  const readme = await readFile(README, "utf8");
  const s = readme.indexOf(START);
  const e = readme.indexOf(END);
  if (s === -1 || e === -1) throw new Error(`README.md is missing ${START} / ${END} markers`);

  const next = readme.slice(0, s) + block + readme.slice(e + END.length);
  if (next === readme) {
    console.log("README.md already up to date.");
    return;
  }
  await writeFile(README, next);
  console.log(`README.md updated — ${featured.length} cards, ${rest.length} mentions.`);
}

main().catch((err) => {
  console.error(String(err.message ?? err));
  process.exit(1);
});
