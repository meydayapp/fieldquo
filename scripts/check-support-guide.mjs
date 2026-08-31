// scripts/check-support-guide.mjs
//
//   npm run check:support-guide
//
// docs/SUPPORT-GUIDE.md is written for an AI answering a contractor's first
// support question. Its brief (see the commit that added it) put four hard
// constraints on the document, on top of it having to be true:
//
//   1. Every route it names has to exist as a real page — "go to settings"
//      is useless to a support agent, but a page that no longer exists is
//      worse: confident and wrong.
//   2. No file path into lib/ or app/, no function name — the reader is
//      answering a contractor, not editing the repo. A route the CONTRACTOR
//      would type into a browser ("/app/settings/overhead") is fine and
//      required; a path that only means something to someone reading the
//      source ("lib/analytics/minimumPrice.js", a bracketed dynamic segment
//      like "[id]", a ".js" extension) is not.
//   3. No environment variable names, no credentials, no internal URLs — a
//      support agent has no business typing one into a chat with a customer.
//   4. No personal data — no real customer names, emails, phones, addresses.
//      Where an example is needed it has to be an obviously fake one.
//
// This mirrors scripts/check-env-docs.mjs's shape (scan the doc, scan the
// source of truth, fail on the gap) rather than inventing a new pattern.
//
// ── Why routes are matched loosely, not string-equality ─────────────────────
//
// A real page.js path carries Next's [dynamicSegment] syntax; the guide
// writes the same spot as a readable placeholder ("<id>", "<token>",
// "<company>") because that's what's rule 2 above bans the bracket form for.
// So route-checking here treats ANY bracketed segment on disk, and ANY
// angle-bracket placeholder in the doc, as "matches one path segment" and
// requires every LITERAL segment to agree — strict enough to catch a renamed
// or deleted route, loose enough not to fight the doc's own placeholder
// convention.
//
// ── Why the env-var list is derived, not hardcoded ──────────────────────────
//
// docs/VERCEL.md already carries a checked, current list of every variable
// the app reads (check-env-docs.mjs fails the build if it drifts). Reusing
// that extraction here means this script can't go stale independently of
// that one — a newly added variable is banned from the support guide the
// moment it lands in VERCEL.md, with no second list to remember to update.
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, dirname, resolve, relative, sep } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const DOC_PATH = join(ROOT, "docs/SUPPORT-GUIDE.md");
const VERCEL_DOC_PATH = join(ROOT, "docs/VERCEL.md");

let failures = 0;
let checks = 0;
function ok(name, pass, detail = "") {
  checks++;
  if (!pass) failures++;
  console.log(`  ${pass ? "ok  " : "FAIL"} ${name}${detail ? `  ${detail}` : ""}`);
}

const doc = readFileSync(DOC_PATH, "utf8");

// ══ 1. Every named route resolves to a real page ═══════════════════════════

// Directories under app/ that are implementation, not a page a browser
// visits — never scanned for routes and never treated as a claim in the doc.
const NON_ROUTE_DIRS = new Set([
  "api", "components", "data", "hooks", "i18n", "providers", "admin",
]);

function collectPages(dir, segments, out) {
  let entries;
  try { entries = readdirSync(dir); } catch { return; }
  for (const name of entries) {
    if (name.startsWith(".") || name === "node_modules") continue;
    const full = join(dir, name);
    if (!statSync(full).isDirectory()) continue;
    if (segments.length === 0 && NON_ROUTE_DIRS.has(name)) continue;
    // Route groups like "(marketing)" contribute no path segment of their own.
    const seg = name.startsWith("(") && name.endsWith(")") ? null : name;
    const nextSegments = seg ? [...segments, seg] : segments;
    try {
      statSync(join(full, "page.js"));
      out.push(nextSegments);
    } catch {
      /* no page.js here — still may have one further down */
    }
    collectPages(full, nextSegments, out);
  }
}

const pageSegmentLists = [];
collectPages(join(ROOT, "app"), [], pageSegmentLists);

// Each segment list becomes a matcher: a bracketed segment ("[id]",
// "[...path]") matches any single placeholder or literal at that position;
// a literal segment must match the doc's literal exactly.
function segmentsMatch(realSegs, docSegs) {
  if (realSegs.length !== docSegs.length) return false;
  return realSegs.every((real, i) => {
    const isDynamic = /^\[.+\]$/.test(real);
    if (isDynamic) return true;
    return real === docSegs[i];
  });
}

// Pulls "/app/settings/overhead", "/q/<token>", "/embed/<company>/book" etc.
// out of prose. Deliberately permissive on what counts as a placeholder
// segment (anything wrapped in <...>) so the doc's own readable convention
// is exactly what's accepted.
// Longest alternatives first, plus a lookahead barring another letter/hyphen
// right after the keyword — alternation in JS regex takes the FIRST match,
// not the longest, so "q" ahead of "quote" in the list would otherwise match
// only the "/q" inside "/quote/<company>" and stop there.
const ROUTE_RE = /\/(?:instant-quote|accept-invitation|platform|embed|quote|book|portal|refer|site|plan|design|visit|signup|login|app|q|f|l)(?![A-Za-z-])(?:\/[A-Za-z0-9_.<>-]+)*/g;
const foundRoutes = [...new Set((doc.match(ROUTE_RE) || []).map((r) => r.replace(/[.,;:)]+$/, "")))];

ok("at least one route was found to check", foundRoutes.length > 5, `(found ${foundRoutes.length})`);

const badRoutes = [];
for (const route of foundRoutes) {
  const docSegs = route.split("/").filter(Boolean);
  const matches = pageSegmentLists.some((realSegs) => segmentsMatch(realSegs, docSegs));
  if (!matches) badRoutes.push(route);
}
ok(
  "every route named in the guide is a real page",
  badRoutes.length === 0,
  badRoutes.length ? `— not found: ${badRoutes.join(", ")}` : "",
);

// ══ 2. No source-code file paths, dynamic-segment brackets, or extensions ══

const codeLeaks = [];
if (doc.includes("lib/")) codeLeaks.push('"lib/"');
if (/\bapp\/(app|api|platform)\b/.test(doc)) codeLeaks.push('a source-tree "app/app", "app/api" or "app/platform" reference');
if (/\.jsx?\b/.test(doc)) codeLeaks.push('a ".js"/".jsx" file extension');
if (/[[\]]/.test(doc)) codeLeaks.push("a square bracket (Next.js dynamic-segment syntax)");
if (/\bscripts\//.test(doc)) codeLeaks.push('"scripts/"');
if (/\bprisma\//i.test(doc)) codeLeaks.push('"prisma/"');
ok("no source-code file paths or dynamic-segment syntax", codeLeaks.length === 0, codeLeaks.join("; "));

// A function call reads as "identifierName(" with no space before the paren —
// English prose essentially never does this, but "word (aside)" is common and
// must not trip it, which is why the regex requires no preceding space.
const callLike = doc.match(/\b[a-z][A-Za-z0-9]*\(/g) || [];
ok("no function-call-shaped syntax", callLike.length === 0, callLike.length ? `e.g. ${callLike[0]}` : "");

// ══ 3. No environment variable names, credentials, or internal URLs ════════

let vercelDoc;
try {
  vercelDoc = readFileSync(VERCEL_DOC_PATH, "utf8");
} catch {
  vercelDoc = "";
}
// Same extraction check-env-docs.mjs uses for "documented" names — every
// ALL_CAPS_WITH_UNDERSCORES token in backticks. Reusing it means a variable
// added to VERCEL.md is automatically banned here too.
const envNames = [...new Set(
  [...vercelDoc.matchAll(/`([A-Z][A-Z0-9]*(?:_[A-Z0-9]+)+)`/g)].map((m) => m[1]),
)];
const leakedEnvNames = envNames.filter((name) => doc.includes(name));
ok(
  "no environment variable names",
  leakedEnvNames.length === 0,
  leakedEnvNames.length ? `— found: ${leakedEnvNames.join(", ")}` : "",
);

ok(
  "no localhost / internal deployment URL",
  !/localhost|127\.0\.0\.1|vercel\.app/i.test(doc),
);

// ══ 4. No personal data, other than clearly fake examples ══════════════════

// Fake domains this codebase already uses as placeholders elsewhere in docs
// (FEATURE-GUIDE's "you@yourbusiness.com", the RFC 2606 reserved
// example.com). Anything else that looks like an email address is either a
// real one or an ambiguous one, and neither belongs in a support doc.
const ALLOWED_EMAIL_DOMAINS = ["example.com", "example.org", "yourbusiness.com"];
const emails = [...new Set((doc.match(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g) || []))];
const badEmails = emails.filter(
  (e) => !ALLOWED_EMAIL_DOMAINS.some((d) => e.toLowerCase().endsWith(`@${d}`)),
);
ok(
  "no email addresses other than fake examples",
  badEmails.length === 0,
  badEmails.length ? `— found: ${badEmails.join(", ")}` : "",
);

// North American phone numbers only get a real subscriber block; NPA-555-01XX
// is reserved by the numbering plan for fiction and can never be a real,
// dialable line — the same block the product's own demo phone lines use.
const phoneMatches = [...new Set((doc.match(/\(?\d{3}\)?[-. ]?\d{3}[-. ]?\d{4}/g) || []))];
const badPhones = phoneMatches.filter((p) => {
  const digits = p.replace(/\D/g, "");
  const exchange = digits.slice(3, 6);
  return !(digits.length === 10 && exchange === "555" && digits.slice(6, 8) === "01");
});
ok(
  "no phone numbers other than the reserved fictional block",
  badPhones.length === 0,
  badPhones.length ? `— found: ${badPhones.join(", ")}` : "",
);

console.log(`\n${failures === 0 ? "✓" : "✗"} support guide: ${checks - failures}/${checks} checks passed`);
if (failures > 0) process.exit(1);
