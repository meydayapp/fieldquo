// scripts/check-site-publish-path.mjs
//
//   npm run check:site-publish-path
//
// Does an edit to the tenant website reach the person the website is for?
//
// ══ The bug this exists for ════════════════════════════════════════════════
//
// CompanySite carries the page content twice: a flat `blocks` array (the
// original single-page site) and a `pages` array (the multi-page site the
// current builder produces). lib/site/pages.js resolvePages() prefers `pages`
// whenever it is a non-empty valid array and NEVER READS `blocks` in that
// case.
//
// So any write that updated only `blocks` changed nothing a visitor could see,
// on every site the builder has generated since `pages` existed. Three did:
//
//   - POST /api/settings/website/languages — spent the company's AI allowance
//     writing the site in French, stored translations[fr].blocks, and served
//     the ENGLISH page with a French <title>. The switcher appeared, the row
//     was written, the quota was billed, and it looked done.
//   - PUT /api/settings/website/photos — "Pair them up" confirmed the pairs
//     and the public page kept the old ones.
//   - DELETE /api/settings/website/photos — the worst: a photo the contractor
//     deleted from their library, and from `blocks`, STAYED LIVE on their
//     website through `pages`.
//
// ══ Two halves, both load-bearing ══════════════════════════════════════════
//
// HALF ONE — EXECUTED. The precedence claim above is not asserted by reading a
// comment; the SHIPPED resolvePages is imported and run, and the assertions are
// about what it returns. If someone changes the precedence, the read half below
// stops being the right thing to demand and this half says so first.
//
// HALF TWO — READ. Executing the mechanism proves nothing about whether the
// routes use it — this repo's history is mostly bugs of that shape. So each
// route file is parsed, comment-stripped (its own write-up of the bug would
// otherwise match as the bug), and every companySite.update that carries page
// content is required to carry both shapes.
import { readFileSync } from "node:fs";
import { resolvePages } from "@/lib/site/pages";
import { buildPages } from "@/lib/site/buildPages";

let pass = 0;
const failures = [];
// Label FIRST. Reversed, a non-empty string becomes the condition and nothing
// here could ever fail.
const ok = (label, cond) => (cond ? (pass++, undefined) : failures.push(label));

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");
const stripComments = (src) =>
  src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^[ \t]*\/\/.*$/gm, "");

// ── HALF ONE: the precedence, executed ────────────────────────────────────
console.log("\n1. What resolvePages actually serves\n");

const EN = [{ id: "h", type: "hero", visible: true, content: { headline: "Quality painting" } }];
const FR = [{ id: "h", type: "hero", visible: true, content: { headline: "Peinture de qualité" } }];
const enPages = [{ id: "home", slug: "home", title: "Home", nav: true, blocks: EN }];

// Exactly the precedence app/site/[subdomain]/page.js applies.
const serve = (translated, site) =>
  resolvePages({
    blocks: Array.isArray(translated?.blocks) ? translated.blocks : site.blocks,
    pages: Array.isArray(translated?.pages) ? translated.pages : site.pages,
  });

const headline = (pages) =>
  pages[0].blocks.find((b) => b.type === "hero")?.content?.headline;

const multiPageSite = { blocks: EN, pages: enPages };

ok(
  "a translation carrying ONLY blocks is not served on a multi-page site (the bug)",
  headline(serve({ blocks: FR }, multiPageSite)) === "Quality painting",
);
ok(
  "a translation carrying pages IS served",
  headline(serve({ blocks: FR, pages: [{ id: "home", slug: "home", title: "Accueil", nav: true, blocks: FR }] }, multiPageSite)) ===
    "Peinture de qualité",
);
// The legacy shape must keep working, or "always write pages" would be the
// wrong demand for a single-page site.
ok(
  "a legacy site with no pages still renders from blocks",
  headline(serve({ blocks: FR }, { blocks: EN, pages: null })) === "Peinture de qualité",
);
ok(
  "buildPages is deterministic — the same blocks give the same slugs twice",
  JSON.stringify(buildPages(FR, { services: false }).map((p) => p.slug)) ===
    JSON.stringify(buildPages(FR, { services: false }).map((p) => p.slug)),
);

// ── HALF TWO: do the routes write both shapes? ────────────────────────────
console.log("2. Every write that changes page content writes both shapes\n");

// Brace-matched body of the named exported handler, so an assertion cannot be
// satisfied by a `pages` sitting in a different verb of the same file.
function handlerBody(src, verb) {
  const start = src.indexOf(`export async function ${verb}(`);
  if (start === -1) return "";
  let i = src.indexOf("{", start);
  let depth = 0;
  for (let j = i; j < src.length; j++) {
    if (src[j] === "{") depth++;
    else if (src[j] === "}" && --depth === 0) return src.slice(i, j + 1);
  }
  return "";
}

// The `data:` payload of every companySite.update in a body.
function updatePayloads(body) {
  const out = [];
  const re = /companySite\s*\.\s*update\s*\(/g;
  let m;
  while ((m = re.exec(body))) {
    let i = body.indexOf("{", m.index);
    let depth = 0;
    for (let j = i; j < body.length; j++) {
      if (body[j] === "{") depth++;
      else if (body[j] === "}" && --depth === 0) {
        out.push(body.slice(i, j + 1));
        break;
      }
    }
  }
  return out;
}

const CONTENT_WRITERS = [
  ["app/api/settings/website/photos/route.js", "PUT", "confirming before/after pairs"],
  ["app/api/settings/website/photos/route.js", "DELETE", "deleting a photo"],
];

for (const [file, verb, what] of CONTENT_WRITERS) {
  const body = handlerBody(stripComments(read(file)), verb);
  ok(`${verb} ${file} exists`, body.length > 0);

  // The handler must build its page content through the both-shapes helper, and
  // the variable it builds must be the one that reaches the database. Matching
  // only "does the file mention applyToAllBlockSets" would pass a handler that
  // computed it and then wrote something else.
  const built = body.match(/const\s+([A-Za-z_$][\w$]*)\s*=\s*applyToAllBlockSets\s*\(/);
  ok(`${what}: page content is built through the both-shapes helper`, Boolean(built));

  const payloads = updatePayloads(body);
  ok(`${what}: the handler writes to companySite`, payloads.length > 0);

  const name = built?.[1];
  ok(
    `${what}: that write reaches \`pages\` too, not just \`blocks\``,
    payloads.some((p) =>
      name
        ? new RegExp(`(\\.\\.\\.\\s*${name}\\b|\\bdata\\s*:\\s*${name}\\b|^\\s*\\{\\s*${name}\\s*,)`, "m").test(p) ||
          new RegExp(`\\b${name}\\b`).test(p)
        : /\bpages\b/.test(p),
    ),
  );

  // And nothing in the handler may write `blocks` on its own afterwards — that
  // is the exact shape of the bug, and it would silently win as the later write.
  ok(
    `${what}: no companySite.update writes a bare \`blocks\` alongside it`,
    !payloads.some((p) => /\bblocks\s*:/.test(p) && !/\bpages\b/.test(p) && !new RegExp(`\\b${name}\\b`).test(p)),
  );
}

// The helper itself has to actually map over pages — a stub returning only
// blocks would satisfy the spelling test above from every call site at once.
{
  const src = stripComments(read("app/api/settings/website/photos/route.js"));
  const at = src.indexOf("function applyToAllBlockSets");
  ok("photos route defines the shared both-shapes helper", at !== -1);
  const helper = src.slice(at, at + 900);
  ok(
    "…and it maps the transform over every page's blocks, not just the flat list",
    /site\.pages\s*\.\s*map\s*\(/.test(helper) && /blocks:\s*sanitiseBlocks\(\s*transform\(/.test(helper),
  );
  ok(
    "…and it leaves a legacy site's `pages` alone rather than inventing one",
    /Array\.isArray\(site\.pages\)\s*&&\s*site\.pages\.length/.test(helper),
  );
  ok(
    "…and it still sanitises what it stores — this is served to strangers",
    (helper.match(/sanitiseBlocks\(/g) || []).length >= 2,
  );
}

// The language route is the one that spends money to produce the content.
{
  const src = stripComments(read("app/api/settings/website/languages/route.js"));
  const body = handlerBody(src, "POST");
  ok("POST /api/settings/website/languages exists", body.length > 0);
  ok(
    "a generated translation is stored with `pages`, not blocks alone",
    /\[language\]\s*:\s*\{[^}]*\bpages\s*:/.test(body),
  );
  ok(
    "…built with buildPages (deterministic, no second model call, no extra spend)",
    /buildPages\s*\(/.test(body) && /from "@\/lib\/site\/buildPages"/.test(src),
  );
  ok(
    "…and the stored flat `blocks` are the translated home page, not the source",
    /blocks:\s*translatedPages\[0\]\.blocks/.test(body),
  );
  ok(
    "the menu is translated from the siteCopy table, not machine-translated",
    /siteCopy\(/.test(src) && /NAV_KEY_BY_SLUG/.test(src),
  );
}

console.log(`\n${pass} checks passed.`);
if (failures.length) {
  console.log(`\n${failures.length} FAILED:\n`);
  for (const f of failures) console.log(`  ✗ ${f}`);
  process.exit(1);
}
console.log("Every website write reaches the page a visitor is served.\n");
