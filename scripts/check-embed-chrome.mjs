// scripts/check-embed-chrome.mjs
//
//   npm run check:embed-chrome
//
// Two layout regressions the build cannot see, pinned.
//
// ── 1. The embed widgets draw no company header ─────────────────────────────
//
// /embed/<slug>/{book,quote,instant-quote} and /embed/<slug>/funnel/<slug>
// mount the SAME components as /book, /quote, /instant-quote and /f — that is
// the point of them (see app/embed/[companySlug]/[widget]/page.js). Each flow
// opens with the company's logo and name, which is right on a standalone page
// a homeowner reached from a link, and wrong inside an iframe two inches under
// the company's own masthead on the company's own website: the second logo is
// what makes it read as a widget somebody else made.
//
// The flows take an `embedded` prop, true ONLY from the two embed routes, and
// skip the header on it. Nothing enforces that except this file: a refactor
// that drops the prop from one mount, or lifts one header out of its guard,
// still builds, still passes every render check, and shows up as a doubled
// logo on a customer's homepage where nobody at FieldQuo will ever look.
//
// The same prop turns off `min-h-screen` on the two roots that had it. Inside
// an iframe "the screen" is the iframe, so a root that insists on being at
// least that tall can never measure shorter than the height the snippet
// started with — EmbedFrame posts the number back, the host applies it, and
// the box grows but never shrinks.
//
// ── 2. Services & Pricing: the panels stack, they do not share a row ────────
//
// The per-trade card on app/app/settings/services is a flex row from `sm` up:
// switch and label on the left, the one-number rate box on the right. RateCard
// and QuoteWording used to be DIRECT CHILDREN of that row, so at ≥640px a
// rate card with a dozen inputs and a wording panel with textareas were laid
// out beside the label column, three panels on one line, each overlapping
// the next. They are full-width blocks under the row now, inside the same
// card, and this asserts they stay there.
//
// This reads source. It cannot render, so it proves the guard is PRESENT, not
// that the header is invisible; pair it with a browser when the flows change.
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(new URL("..", import.meta.url).pathname);
const read = (p) => readFileSync(resolve(root, p), "utf8");

let bad = 0;
const ok = (label, cond, extra = "") => {
  console.log(`${cond ? "  ok  " : "  FAIL"} ${label}${extra ? `  ${extra}` : ""}`);
  if (!cond) bad++;
};

// ── JSX tag scanner ─────────────────────────────────────────────────────────
//
// Finds the end of an opening tag that starts at `from`, stepping over
// `{...}` expressions (an `onChange={(e) => ...}` contains a `>` that is not
// the tag's) and quoted strings. Returns { end, selfClosing }.
function tagEnd(src, from) {
  let i = from;
  let depth = 0;
  let quote = null;
  for (; i < src.length; i++) {
    const ch = src[i];
    if (quote) {
      if (ch === quote && src[i - 1] !== "\\") quote = null;
      continue;
    }
    if (ch === '"' || ch === "'" || ch === "`") {
      quote = ch;
      continue;
    }
    if (ch === "{") depth++;
    else if (ch === "}") depth--;
    else if (ch === ">" && depth === 0) {
      return { end: i, selfClosing: src[i - 1] === "/" };
    }
  }
  return null;
}

// Comments talk ABOUT these class names ("No min-h-screen: inside a 600px
// iframe…"), so every assertion about what a file renders reads it with the
// comments blanked. Blanked, not removed — line numbers in the report must
// still point at the file the reader has open.
function stripComments(src) {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, " "))
    .replace(/(^|[^:"'`])\/\/[^\n]*/g, (m, lead) => lead + " ".repeat(m.length - lead.length));
}

// The index just past the `</div>` that closes the <div starting at `open`.
function closingDiv(src, open) {
  const first = tagEnd(src, open);
  if (!first || first.selfClosing) return null;
  let depth = 1;
  let i = first.end + 1;
  const re = /<div\b|<\/div>/g;
  re.lastIndex = i;
  let m;
  while ((m = re.exec(src))) {
    if (m[0] === "</div>") {
      depth--;
      if (depth === 0) return m.index + m[0].length;
    } else {
      const t = tagEnd(src, m.index);
      if (!t) return null;
      if (!t.selfClosing) depth++;
      re.lastIndex = t.end + 1;
    }
  }
  return null;
}

// ── Part 1: embed chrome ────────────────────────────────────────────────────

console.log("\nembed routes pass `embedded`, and only they do\n");

const widgetPage = read("app/embed/[companySlug]/[widget]/page.js");
for (const flow of ["BookingFlow", "InstantQuoteFlow", "SelfQuoteFlow"]) {
  const re = new RegExp(`<${flow}\\b[^>]*\\bembedded\\b`);
  ok(`/embed/[slug]/[widget] mounts ${flow} with embedded`, re.test(widgetPage));
}
const funnelEmbed = read("app/embed/[companySlug]/funnel/[funnelSlug]/page.js");
ok(
  "/embed/[slug]/funnel/[funnelSlug] mounts FunnelRunner with embedded",
  /<FunnelRunner\b[^>]*\bembedded\b/.test(funnelEmbed),
);

// The public pages must NOT pass it: the header is the whole difference
// between the standalone page and the widget, and this is the half of the
// contract a copy-paste from the embed route would silently break.
const publicMounts = [
  ["app/book/[companySlug]/page.js", "BookingFlow"],
  ["app/book/[companySlug]/[eventSlug]/page.js", "BookingFlow"],
  ["app/quote/[companySlug]/page.js", "SelfQuoteFlow"],
  ["app/instant-quote/[companySlug]/page.js", "InstantQuoteFlow"],
  ["app/f/[companySlug]/[funnelSlug]/page.js", "FunnelRunner"],
];
for (const [file, flow] of publicMounts) {
  const src = read(file);
  const mounts = src.match(new RegExp(`<${flow}\\b[^>]*>`, "g")) || [];
  ok(
    `${file} mounts ${flow} without embedded`,
    mounts.length > 0 && mounts.every((m) => !/\bembedded\b/.test(m)),
    mounts.length ? "" : "(no mount found)",
  );
}

console.log("\neach flow declares the prop and guards every company header on it\n");

// For each flow: the exported component destructures `embedded`, and every
// header site — recognised by the logo ternary `X.logoUrl ? (` — sits inside
// a `!embedded &&` guard within the preceding window. The window is generous
// because BookingFlow's header is a component called at three sites, where
// the guard wraps the call rather than the ternary.
const flows = [
  {
    file: "app/book/[companySlug]/BookingFlow.js",
    component: "BookingFlow",
    // Three call sites of <Header>; the ternary lives inside Header itself,
    // so the sites are what carry the guard.
    headerSites: (src) => [...src.matchAll(/<Header\b/g)].map((m) => m.index),
    window: 120,
  },
  {
    file: "app/instant-quote/[companySlug]/InstantQuoteFlow.js",
    component: "InstantQuoteFlow",
    headerSites: (src) =>
      [...src.matchAll(/data\.company\.logoUrl \? \(/g)].map((m) => m.index),
    window: 400,
  },
  {
    file: "app/quote/[companySlug]/SelfQuoteFlow.js",
    component: "SelfQuoteFlow",
    // The form header and the confirmation masthead. Both are `<name>.logoUrl ? (`.
    headerSites: (src) =>
      [...src.matchAll(/\b(?:c|company)\.logoUrl \? \(/g)].map((m) => m.index),
    window: 400,
  },
  {
    file: "app/f/[companySlug]/[funnelSlug]/FunnelRunner.js",
    component: "FunnelRunner",
    headerSites: (src) => [...src.matchAll(/\bc\.logoUrl \? \(/g)].map((m) => m.index),
    window: 250,
  },
];

for (const { file, component, headerSites, window: win } of flows) {
  const src = read(file);
  const sig = new RegExp(
    `export default function ${component}\\(\\{[^}]*\\bembedded\\s*=\\s*false\\b[^}]*\\}\\)`,
  );
  ok(`${component} takes embedded (default false)`, sig.test(src));

  const sites = headerSites(src);
  ok(`${component}: header sites found`, sites.length > 0, `(${sites.length})`);
  for (const at of sites) {
    const before = src.slice(Math.max(0, at - win), at);
    const line = src.slice(0, at).split("\n").length;
    ok(`${component}: header at line ${line} is guarded by !embedded`, /!embedded\s*&&/.test(before));
  }
}

// SelfQuoteFlow's confirmation is a separate component; the guard inside it is
// only real if the flow passes the prop through.
{
  const src = read("app/quote/[companySlug]/SelfQuoteFlow.js");
  ok(
    "SelfQuoteFlow passes embedded into <Confirmation>",
    /<Confirmation\b[\s\S]*?\bembedded=\{embedded\}[\s\S]*?\/>/.test(src),
  );
}

console.log("\nno root pins the iframe at viewport height when embedded\n");

{
  const src = stripComments(read("app/instant-quote/[companySlug]/InstantQuoteFlow.js"));
  // Every min-h-screen left in the file must be the standalone branch of an
  // `embedded ?` ternary, and the embedded branch must say min-h-0.
  const lines = src.split("\n");
  const hits = lines
    .map((l, i) => [l, i + 1])
    .filter(([l]) => l.includes("min-h-screen"));
  ok("InstantQuoteFlow still has a standalone min-h-screen", hits.length > 0);
  for (const [l, n] of hits) {
    ok(
      `InstantQuoteFlow line ${n}: min-h-screen is the non-embedded branch`,
      /embedded\s*\?/.test(l) && /min-h-0/.test(l),
    );
  }
  ok(
    "InstantQuoteFlow's <Centered> states receive embedded",
    (src.match(/<Centered\b/g) || []).length ===
      (src.match(/<Centered embedded=\{embedded\}/g) || []).length,
  );
}
{
  const src = stripComments(read("app/f/[companySlug]/[funnelSlug]/FunnelRunner.js"));
  const lines = src.split("\n");
  const hits = lines
    .map((l, i) => [l, i + 1])
    .filter(([l]) => l.includes("min-h-screen"));
  ok("FunnelRunner still has a standalone min-h-screen", hits.length > 0);
  for (const [l, n] of hits) {
    ok(
      `FunnelRunner line ${n}: min-h-screen is the non-embedded branch`,
      /embedded\s*\?/.test(l) && /min-h-0/.test(l),
    );
  }
  ok(
    "FunnelRunner's <Shell> sites all receive embedded",
    (src.match(/<Shell\b/g) || []).length ===
      (src.match(/<Shell\b[^>]*embedded=\{embedded\}/g) || []).length,
  );
}
for (const file of ["app/book/[companySlug]/BookingFlow.js", "app/quote/[companySlug]/SelfQuoteFlow.js"]) {
  const src = stripComments(read(file));
  // These two never had one — their Shell comments say why. Keep it that way.
  ok(`${file.split("/").pop()} has no min-h-screen`, !/min-h-screen/.test(src));
}

// ── Part 2: Services & Pricing ──────────────────────────────────────────────

console.log("\nServices & Pricing: RateCard and QuoteWording are under the row, not in it\n");

{
  const src = stripComments(read("app/app/settings/services/page.js"));

  // The card first, then the row INSIDE it. The page has another
  // `sm:flex-row` above the list (the search-and-filter toolbar), and a search
  // for the class alone found that one.
  const cardStart = src.search(/<div\s+key=\{c\.id\}/);
  ok("per-trade card (<div key={c.id}) found", cardStart >= 0);
  const cardEnd = cardStart >= 0 ? closingDiv(src, cardStart) : null;
  ok("per-trade card closes cleanly", cardEnd != null);

  const rowRe = /<div\b[^>]*className="[^"]*\bsm:flex-row\b[^"]*"/g;
  rowRe.lastIndex = Math.max(0, cardStart);
  const rowMatch = cardStart >= 0 ? rowRe.exec(src) : null;
  const rowStart = rowMatch && rowMatch.index < (cardEnd ?? Infinity) ? rowMatch.index : -1;
  ok("per-trade row (sm:flex-row) found inside the card", rowStart >= 0);
  const rowEnd = rowStart >= 0 ? closingDiv(src, rowStart) : null;
  ok("per-trade row closes cleanly", rowEnd != null);

  for (const panel of ["RateCard", "QuoteWording"]) {
    const at = src.indexOf(`<${panel}`);
    ok(`${panel} is rendered`, at >= 0);
    ok(
      `${panel} is not a child of the sm:flex-row container`,
      rowStart >= 0 && rowEnd != null && !(at > rowStart && at < rowEnd),
    );
    ok(
      `${panel} sits inside the per-trade card, after the row`,
      cardEnd != null && rowEnd != null && at > rowEnd && at < cardEnd,
    );
  }

  // The label column: a flex-1 label beside fixed inputs must be allowed to
  // shrink, and the name must wrap rather than widen the column.
  ok(
    "category label is min-w-0 and wraps",
    /<span className="min-w-0 break-words">\{c\.label\}<\/span>/.test(src),
  );
}

console.log("\nServices & Pricing: the panels' own rows fit a phone\n");

{
  const rate = read("app/app/settings/services/RateCard.js");
  ok(
    "RateCard: the flex-1 field label is min-w-0",
    /className="flex-1 min-w-0[^"]*"[^>]*>\s*\{field\.label\}/.test(rate),
  );
}
{
  const wording = stripComments(read("app/app/settings/services/QuoteWording.js"));
  // Assemble the classes the way the component does, then look for the pair
  // that used to be there.
  const base = wording.match(/const fieldClass =\s*"([^"]+)"/)?.[1] || "";
  const full = wording.match(/const inputClass = `([^`]+)`/)?.[1] || "";
  // (?<![\w-]) rather than \b: `min-w-0` contains `w-0` at a word boundary.
  ok(
    "QuoteWording: fieldClass exists and has no width",
    Boolean(base) && !/(?<![\w-])w-(full|\d+)\b/.test(base),
  );
  ok("QuoteWording: inputClass is w-full over fieldClass", /^w-full \$\{fieldClass\}$/.test(full));
  ok("QuoteWording: fieldClass is min-w-0", /\bmin-w-0\b/.test(base));
  ok(
    "QuoteWording: no element carries both w-full and w-28",
    !/\$\{inputClass\}[^`]*\bw-28\b/.test(wording) && !/\bw-28\b[^`]*\$\{inputClass\}/.test(wording),
  );
  ok(
    "QuoteWording: the timeline box extends fieldClass, not inputClass",
    /\$\{fieldClass\} w-28 shrink-0/.test(wording),
  );
  ok(
    "QuoteWording: the unfilled-token list can break",
    /className="font-mono break-all"[^>]*>\{unfilled/.test(wording),
  );
}

console.log(bad ? `\n${bad} problem(s)\n` : "\nall good\n");
process.exit(bad ? 1 : 0);
