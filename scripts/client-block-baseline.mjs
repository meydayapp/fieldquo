// scripts/client-block-baseline.mjs
//
// Prints the md5 of every client block scripts/fixtures/clientBlockRender.mjs
// renders, as JSON. Bundled by check:client-unit for the comparison, and —
// once, against the tree BEFORE the department line existed (21cefa69c) — to
// write scripts/fixtures/clientBlockBaseline.json:
//
//   npx esbuild scripts/client-block-baseline.mjs --bundle --platform=node \
//     --format=cjs --jsx=automatic --loader:.js=jsx --loader:.mjs=jsx \
//     --alias:@=<old tree> --outfile=/tmp/b.cjs && node /tmp/b.cjs
import { createHash } from "node:crypto";
import { renderClientBlocks } from "./fixtures/clientBlockRender.mjs";

const md5 = (s) => createHash("md5").update(s).digest("hex");
const blocks = renderClientBlocks();
const out = {};
for (const [fixture, byLang] of Object.entries(blocks)) {
  out[fixture] = {};
  for (const [lang, surfaces] of Object.entries(byLang)) {
    out[fixture][lang] = Object.fromEntries(Object.entries(surfaces).map(([k, v]) => [k, md5(v)]));
  }
}
console.log(JSON.stringify(out, null, 2));
