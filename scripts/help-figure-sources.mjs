// scripts/help-figure-sources.mjs
//
// The file behind a help-centre figure reference, for a language. The pure
// half (parsing the reference) is lib/help/figures.js so the pages can use
// it; this is the fs half, shared by the build script and the check so the
// two cannot disagree about which capture answers a reference.
//
//   live:<route-slug>    docs/screens/live/app/<lang>/<route-slug>.png
//   create:<route-slug>  docs/screens/live/actions/<lang>/<route-slug>.png
//   harness:<slug>       docs/screens/app-guide/<lang>/NN-<slug>.png
//
// The requested language first, English second. Which one answered is
// returned, never hidden.
import { existsSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { parseFigureRef } from "../lib/help/figures.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

const SOURCES = {
  live: (lang, name) => join(ROOT, "docs/screens/live/app", lang, `${name}.png`),
  create: (lang, name) => join(ROOT, "docs/screens/live/actions", lang, `${name}.png`),
  harness: (lang, name) => {
    const dir = join(ROOT, "docs/screens/app-guide", lang);
    if (!existsSync(dir)) return null;
    const hit = readdirSync(dir).find((f) => /^\d+-/.test(f) && f.slice(f.indexOf("-") + 1) === `${name}.png`);
    return hit ? join(dir, hit) : null;
  },
};

export function resolveFigure(ref, lang) {
  const parsed = parseFigureRef(ref);
  if (!parsed) return null;
  for (const l of [lang, "en"]) {
    const file = SOURCES[parsed.kind](l, parsed.name);
    if (file && existsSync(file)) return { file, lang: l, publicName: parsed.publicName };
  }
  return null;
}

/** Every reference a capture set can answer today, for the writers. */
export function availableFigures() {
  const out = [];
  const live = join(ROOT, "docs/screens/live/app/en");
  if (existsSync(live)) for (const f of readdirSync(live)) if (f.endsWith(".png")) out.push(`live:${f.slice(0, -4)}`);
  const create = join(ROOT, "docs/screens/live/actions/en");
  if (existsSync(create)) for (const f of readdirSync(create)) if (f.endsWith(".png")) out.push(`create:${f.slice(0, -4)}`);
  const harness = join(ROOT, "docs/screens/app-guide/en");
  if (existsSync(harness)) for (const f of readdirSync(harness)) if (/^\d+-.*\.png$/.test(f)) out.push(`harness:${f.slice(f.indexOf("-") + 1, -4)}`);
  return out.sort();
}
