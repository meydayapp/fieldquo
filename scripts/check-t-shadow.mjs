// scripts/check-t-shadow.mjs
//
// Guards ONE mistake: naming a local binding `t` in a file that also uses the
// `t` from useTranslation(). The i18n sweep did this repeatedly —
// `.map((t, i) => …)` over a tiers/templates/tasks array, inside a component
// whose `t` is the translation function — and it crashes at RENDER with
// "t is not a function" (the map item is an object). `next build` and
// check:undef both stay green, because a `t` *does* exist in scope; it's just
// the wrong one. no-shadow is the only thing that sees it.
//
// ESLint's no-shadow can't be scoped to a single identifier, so this runs it
// and keeps only the `t` reports. Everything else the repo shadows is left
// alone — this is a targeted guard, not a style rule.
import { execFileSync } from "node:child_process";

const CONFIG = new URL("./check-undef.config.mjs", import.meta.url).pathname;

let raw = "";
try {
  raw = execFileSync(
    "npx",
    ["eslint", "app", "lib", "--no-config-lookup", "--config", CONFIG,
     "--rule", '{"no-shadow":["error",{"hoist":"all"}]}', "--format", "unix"],
    { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] },
  );
} catch (err) {
  // eslint exits non-zero when it reports anything — that's expected, the
  // findings are on stdout.
  raw = (err.stdout || "") + (err.stderr || "");
}

const hits = raw
  .split("\n")
  .filter((line) => /'t' is already declared in the upper scope/.test(line));

if (hits.length) {
  console.error(
    `\n✖ ${hits.length} local binding(s) named \`t\` shadow the useTranslation() function.\n` +
      `  Rename the loop/param/local to something descriptive (tpl, tier, task, item…).\n` +
      `  A shadowed \`t\` crashes at render with "t is not a function".\n`,
  );
  for (const h of hits) console.error("  " + h.trim());
  console.error("");
  process.exit(1);
}

console.log("check:t-shadow — no shadowed translation function found.");
