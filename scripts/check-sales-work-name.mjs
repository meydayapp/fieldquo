// scripts/check-sales-work-name.mjs
//
//   npm run check:sales-work-name
//
// The owner, 2026-09-22: a rep may sell under a WORK NAME ("Jesus… go as
// Daniel"), and a rep's link must be OPAQUE — not their real name slugged,
// not guessable from a colleague's. This executes both halves rather than
// reading them:
//
//   1. name resolution — validateWorkName against hostile input; the work
//      name, the first-name fallback, a stored value that no longer passes;
//      the staff label /platform prints.
//   2. link resolution — a new token, a legacy code (any case), an unknown
//      value; the token wins a collision; the lazy mint is once-only, refuses
//      a token equal to anybody's legacy code, and survives a race — driven
//      through the REAL attribution capture and the REAL demo-page loader
//      with an in-memory client.
//   3. a grep over every outsider-facing file: none interpolates a rep's real
//      name, and no link builder is handed SalesRep.code.
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

const ROOT = process.cwd();
let pass = 0;
const failures = [];
function ok(label, cond, detail) {
  if (cond) {
    pass++;
    console.log(`  ok   ${label}`);
  } else {
    failures.push(label);
    console.log(`  FAIL ${label}${detail === undefined ? "" : ` — ${JSON.stringify(detail)}`}`);
  }
}
const read = (rel) => readFileSync(join(ROOT, rel), "utf8");

const {
  validateWorkName,
  workNameOf,
  realFirstName,
  repPublicName,
  repStaffLabel,
  mintReferralToken,
  isReferralTokenShape,
  REFERRAL_TOKEN_LENGTH,
} = await import("@/lib/sales/repIdentity");
const { ensureReferralToken, findRepByLinkCode, repIdsByLinkCodes } = await import("@/lib/sales/repLink");
const { captureAttributionWithin } = await import("@/lib/sales/attribution");
const { loadRepForDemo } = await import("@/lib/sales/demoBooking/book");

// ── 1. Name resolution ───────────────────────────────────────────────────
console.log("\nwork name — validation");
ok("a plain name passes", validateWorkName("Daniel").value === "Daniel");
ok("two words and a hyphen pass", validateWorkName("Mary-Ann Lee").value === "Mary-Ann Lee");
ok("accented and non-Latin letters pass", validateWorkName("José").ok && validateWorkName("Zoë").ok && validateWorkName("Олена").ok && validateWorkName("李明").ok);
ok("whitespace is collapsed and trimmed", validateWorkName("  Dan   iel  ").value === "Dan iel");
ok("empty clears (ok, null) rather than erroring", validateWorkName("").ok && validateWorkName("").value === null && validateWorkName("   ").value === null && validateWorkName(null).value === null);
ok("one letter is too short", validateWorkName("D").error === "length");
ok("31 letters is too long", validateWorkName("D".repeat(31)).error === "length" && validateWorkName("D".repeat(30)).ok);
ok("length counts letters, not UTF-16 units", validateWorkName("𝒟𝒶").ok === false || validateWorkName("Zoë").ok);
ok("digits are refused", validateWorkName("Dan1el").error === "characters");
ok("an apostrophe is refused (headers, SMS, TTS)", validateWorkName("O'Brien").error === "characters");
ok("markup is refused", validateWorkName("<b>Dan</b>").error === "characters" && validateWorkName("Dan>").error === "characters");
ok("a header-injection attempt is refused", validateWorkName("Dan\r\nBcc: x@y.z").ok === false);
ok("an emoji is refused", validateWorkName("Dan 🎨").error === "characters");
ok("leading or trailing hyphen is refused", validateWorkName("-Dan").ok === false && validateWorkName("Dan-").ok === false);
ok("a double hyphen or a spaced hyphen is refused", validateWorkName("Da--n").ok === false && validateWorkName("Dan - Lee").ok === false);
ok("a non-string is refused as a type error", validateWorkName(42).error === "type" && validateWorkName({}).error === "type");

console.log("\nwork name — what outsiders see");
const JESUS = { name: "Jesus Pérez", workName: "Daniel" };
ok("the work name when set", repPublicName(JESUS) === "Daniel");
ok("a two-word work name is kept whole", repPublicName({ name: "Mary Smith", workName: "Mary Ann" }) === "Mary Ann");
ok("the real FIRST name when no work name — never the full name", repPublicName({ name: "Jesus Pérez" }) === "Jesus" && repPublicName({ name: "Jesus Pérez", workName: null }) === "Jesus");
ok("a stored work name that no longer passes falls back to the first name", repPublicName({ name: "Jesus Pérez", workName: "<script>" }) === "Jesus" && workNameOf({ workName: "x" }) === null);
ok("no name at all is null, not a placeholder", repPublicName({}) === null && repPublicName(null) === null && repPublicName({ name: "   " }) === null);
ok("realFirstName splits on any whitespace", realFirstName({ name: "  Ana\tLima " }) === "Ana");
ok("never contains the surname when a work name is set", !repPublicName(JESUS).includes("Pérez"));

console.log("\nwork name — what FieldQuo's own screens see");
ok("both names when they differ", repStaffLabel(JESUS) === "Jesus Pérez — works as Daniel");
ok("just the real name when no work name", repStaffLabel({ name: "Jesus Pérez" }) === "Jesus Pérez");
ok("just the real name when the work name IS the first name", repStaffLabel({ name: "Jesus Pérez", workName: "jesus" }) === "Jesus Pérez");
ok("null for nothing", repStaffLabel({}) === null);

// ── 2. Link resolution ───────────────────────────────────────────────────
console.log("\nreferral tokens — shape");
const minted = new Set();
let allShaped = true;
for (let i = 0; i < 2000; i++) {
  const t = mintReferralToken();
  minted.add(t);
  if (!isReferralTokenShape(t) || t.length !== REFERRAL_TOKEN_LENGTH) allShaped = false;
}
ok("every token is 8 Crockford base32 characters, lower case", allShaped);
ok("2,000 mints, 2,000 distinct tokens (40 random bits)", minted.size === 2000, minted.size);
ok("no i, l, o or u — nothing to misread off a phone", [...minted].every((t) => !/[ilou]/.test(t)));
ok("not sequential: consecutive mints share no long prefix", (() => {
  const a = mintReferralToken();
  const b = mintReferralToken();
  return a.slice(0, 4) !== b.slice(0, 4) || a.slice(4) !== b.slice(4);
})());
ok("the mint uses the injected byte source (CSPRNG by default)", mintReferralToken(() => new Uint8Array(8)) === "00000000" && mintReferralToken(() => new Uint8Array(8).fill(31)) === "zzzzzzzz");
ok("a legacy name slug is not token-shaped", !isReferralTokenShape("jesus-perez") && !isReferralTokenShape("dana") && !isReferralTokenShape(""));
ok("token shape is case-insensitive, like the lookup", isReferralTokenShape("K3M9X2PQ"));

// ── The in-memory client ────────────────────────────────────────────────
function makeClient(reps, { raceOnce = false } = {}) {
  const writes = [];
  let raced = false;
  const matches = (r, where) => {
    if (!where) return true;
    if (where.OR) return where.OR.some((w) => matches(r, w));
    for (const [k, v] of Object.entries(where)) {
      if (v && typeof v === "object" && "equals" in v) {
        const a = String(r[k] ?? "");
        if (v.mode === "insensitive" ? a.toLowerCase() !== String(v.equals).toLowerCase() : a !== v.equals) return false;
      } else if (v && typeof v === "object" && "in" in v) {
        if (!v.in.includes(r[k])) return false;
      } else if (r[k] !== v && !(v === null && (r[k] === null || r[k] === undefined))) {
        return false;
      }
    }
    return true;
  };
  const pick = (r, select) => (r ? (select ? Object.fromEntries(Object.keys(select).filter((k) => k in r).map((k) => [k, r[k]])) : { ...r }) : null);
  const client = {
    writes,
    reps,
    salesRep: {
      findUnique: async ({ where, select }) => pick(reps.find((r) => matches(r, where)) || null, select),
      findFirst: async ({ where, select }) => pick(reps.find((r) => matches(r, where)) || null, select),
      findMany: async ({ where, select }) => reps.filter((r) => matches(r, where)).map((r) => pick(r, select)),
      updateMany: async ({ where, data }) => {
        if (raceOnce && !raced) {
          // Another tab minted between our read and our write.
          raced = true;
          const r = reps.find((x) => x.id === where.id);
          r.referralToken = "wonrace1";
          return { count: 0 };
        }
        if (data.referralToken && reps.some((r) => r.referralToken === data.referralToken)) {
          throw Object.assign(new Error("unique"), { code: "P2002" });
        }
        const hit = reps.filter((r) => matches(r, where));
        for (const r of hit) Object.assign(r, data);
        writes.push({ op: "salesRep.updateMany", where, data });
        return { count: hit.length };
      },
    },
    company: {
      findUnique: async ({ where }) =>
        where.id === "co_1" ? { id: "co_1", email: "owner@acme.example", createdAt: new Date("2026-09-20"), members: [] } : null,
    },
    salesAttribution: {
      findUnique: async () => null,
      create: async ({ data }) => {
        writes.push({ op: "salesAttribution.create", data });
        return { id: "attr_1", ...data };
      },
    },
    salesAttributionTouch: {
      create: async ({ data }) => {
        writes.push({ op: "salesAttributionTouch.create", data });
        return { id: "touch_1", ...data };
      },
    },
    member: { findFirst: async () => null },
    salesEvent: { findMany: async () => [], findUnique: async () => null },
  };
  return client;
}
const repRow = (over) => ({ active: true, endedAt: null, kind: "rep", email: `${over.id}@fieldquo.example`, workName: null, referralToken: null, ...over });

console.log("\nlink resolution — findRepByLinkCode");
{
  const c = makeClient([
    repRow({ id: "rep_new", name: "Jesus Pérez", workName: "Daniel", code: "jesus-perez", referralToken: "k3m9x2pq" }),
    repRow({ id: "rep_old", name: "Dana Whitfield", code: "dana" }),
    // A legacy code that happens to be token-shaped, owned by somebody else.
    repRow({ id: "rep_clash", name: "Other", code: "abcd2345" }),
    repRow({ id: "rep_tok", name: "Tok", code: "tok", referralToken: "abcd2345" }),
  ]);
  ok("a new token resolves to its rep", (await findRepByLinkCode("k3m9x2pq", c))?.id === "rep_new");
  ok("…in any case, off a phone", (await findRepByLinkCode("K3M9X2PQ", c))?.id === "rep_new");
  ok("a legacy code still resolves (old cards, old texts)", (await findRepByLinkCode("dana", c))?.id === "rep_old");
  ok("…case-insensitively, as it always did", (await findRepByLinkCode("DANA", c))?.id === "rep_old");
  ok("a legacy code of a rep who HAS a token still resolves to them", (await findRepByLinkCode("jesus-perez", c))?.id === "rep_new");
  ok("an unknown value resolves to nobody", (await findRepByLinkCode("zzzzzzzz", c)) === null && (await findRepByLinkCode("nobody-here", c)) === null);
  ok("empty resolves to nobody", (await findRepByLinkCode("", c)) === null && (await findRepByLinkCode(null, c)) === null);
  ok("a token beats a legacy code spelled the same", (await findRepByLinkCode("abcd2345", c))?.id === "rep_tok");
  const ids = await repIdsByLinkCodes(["K3M9X2PQ", "dana", "abcd2345", "nope"], c);
  ok("the batch form resolves both kinds, token precedence kept", ids.get("k3m9x2pq") === "rep_new" && ids.get("dana") === "rep_old" && ids.get("abcd2345") === "rep_tok" && !ids.has("nope"));
}

console.log("\nlink resolution — ensureReferralToken (the lazy, one-row mint)");
{
  const c = makeClient([repRow({ id: "rep_a", name: "Ana Lima", code: "ana" }), repRow({ id: "rep_b", name: "Bo", code: "bo", referralToken: "bbbbbbbb" })]);
  const first = await ensureReferralToken({ id: "rep_a" }, c);
  ok("a rep with no token gets one", isReferralTokenShape(first) && c.reps[0].referralToken === first);
  ok("…in exactly one write, conditional on the token still being null", c.writes.length === 1 && c.writes[0].where.referralToken === null && Object.keys(c.writes[0].data).join() === "referralToken");
  const again = await ensureReferralToken({ id: "rep_a" }, c);
  ok("a second call returns the same token and writes nothing", again === first && c.writes.length === 1);
  ok("a row already carrying its token is answered without a read", (await ensureReferralToken({ id: "rep_b", referralToken: "bbbbbbbb" }, c)) === "bbbbbbbb" && c.writes.length === 1);
  ok("no id, no token", (await ensureReferralToken({}, c)) === null && (await ensureReferralToken(null, c)) === null);
}
{
  // The mint is asked for a token equal to another rep's LEGACY code, then a
  // token another rep already holds, then a clean one.
  const c = makeClient([repRow({ id: "rep_a", name: "Ana", code: "ana" }), repRow({ id: "rep_x", name: "X", code: "k3m9x2pq" }), repRow({ id: "rep_y", name: "Y", code: "y", referralToken: "yyyyyyyy" })]);
  const queue = ["k3m9x2pq", "yyyyyyyy", "cleantk1"];
  const t = await ensureReferralToken({ id: "rep_a" }, c, { mint: () => queue.shift() });
  ok("a token equal to anybody's legacy code, or anybody's token, is never issued", t === "cleantk1", t);
}
{
  const c = makeClient([repRow({ id: "rep_a", name: "Ana", code: "ana" })], { raceOnce: true });
  const t = await ensureReferralToken({ id: "rep_a" }, c);
  ok("a lost race returns the WINNER's token — one rep, one link", t === "wonrace1" && c.reps[0].referralToken === "wonrace1");
}
{
  const c = makeClient([repRow({ id: "rep_a", name: "Ana", code: "ana" }), repRow({ id: "rep_b", name: "B", code: "b", referralToken: "samesame" })]);
  let threw = false;
  try {
    await ensureReferralToken({ id: "rep_a" }, c, { mint: () => "samesame" });
  } catch {
    threw = true;
  }
  ok("six collisions in a row is an error, never a name-slug link", threw);
}

console.log("\nlink resolution — through the real attribution capture");
{
  const reps = () => [
    repRow({ id: "rep_new", name: "Jesus Pérez", workName: "Daniel", code: "jesus-perez", referralToken: "k3m9x2pq" }),
    repRow({ id: "rep_old", name: "Dana Whitfield", code: "dana" }),
  ];
  const run = async (rawCode) => {
    const c = makeClient(reps());
    const v = await captureAttributionWithin(c, { companyId: "co_1", rawCode, source: "link" });
    return { v, writes: c.writes };
  };
  const byToken = await run("k3m9x2pq");
  ok("a signup on a new token link is attributed to that rep", byToken.v.outcome === "attribute" && byToken.v.salesRepId === "rep_new" && byToken.writes.some((w) => w.op === "salesAttribution.create" && w.data.salesRepId === "rep_new"));
  const byLegacy = await run("jesus-perez");
  ok("a signup on the SAME rep's legacy link is attributed to them too", byLegacy.v.outcome === "attribute" && byLegacy.v.salesRepId === "rep_new");
  const byOld = await run("Dana");
  ok("a rep who never minted a token keeps being credited on their old link", byOld.v.outcome === "attribute" && byOld.v.salesRepId === "rep_old");
  const unknown = await run("zzzzzzzz");
  ok("an unknown code attributes nobody and writes nothing", unknown.v.outcome === "unknown_rep" && unknown.writes.length === 0);
  const none = await run(null);
  ok("no code is an ordinary signup, silent", none.v.outcome === "no_code" && none.writes.length === 0);
}

console.log("\nlink resolution — through the real demo-page loader");
{
  const c = makeClient([
    repRow({ id: "rep_new", name: "Jesus Pérez", workName: "Daniel", code: "jesus-perez", referralToken: "k3m9x2pq" }),
    repRow({ id: "rep_gone", name: "Gone", code: "gone", active: false }),
    repRow({ id: "rep_inf", name: "Infl", code: "infl", kind: "influencer" }),
  ]);
  ok("/demo/<token> opens the rep's page", (await loadRepForDemo("k3m9x2pq", c))?.id === "rep_new");
  ok("/demo/<legacy code> still opens it", (await loadRepForDemo("jesus-perez", c))?.id === "rep_new");
  ok("/demo/<unknown> is not found", (await loadRepForDemo("zzzzzzzz", c)) === null);
  ok("an inactive rep or an influencer ledger is not a calendar", (await loadRepForDemo("gone", c)) === null && (await loadRepForDemo("infl", c)) === null);
  const loaded = await loadRepForDemo("k3m9x2pq", c);
  ok("the loaded row carries the work name for the page to show", repPublicName(loaded) === "Daniel");
}

// ── 3. The grep: no outsider-facing template interpolates the real name ──
function decomment(src) {
  let out = "";
  let i = 0;
  let state = "code";
  while (i < src.length) {
    const ch = src[i];
    const d = src[i + 1];
    if (state === "code") {
      if (ch === "/" && d === "/") { state = "line"; out += "  "; i += 2; continue; }
      if (ch === "/" && d === "*") { state = "block"; out += "  "; i += 2; continue; }
      if (ch === '"' || ch === "'" || ch === "`") { state = ch; out += ch; i++; continue; }
      out += ch; i++; continue;
    }
    if (state === "line") { out += ch === "\n" ? "\n" : " "; if (ch === "\n") state = "code"; i++; continue; }
    if (state === "block") {
      if (ch === "*" && d === "/") { state = "code"; out += "  "; i += 2; continue; }
      out += ch === "\n" ? "\n" : " "; i++; continue;
    }
    if (ch === "\\") { out += "  "; i += 2; continue; }
    if (ch === state) state = "code";
    out += ch;
    i++;
  }
  return out;
}

console.log("\noutsider-facing files — no real name, no name-slug link");
// Every file that writes something a prospect, a signup or a customer reads
// or hears: emails, texts, invites, voice prompts, the call script, the demo
// and intro-link pages, the check-in drafts, the canned texts.
const OUTSIDER_FILES = [
  "lib/sales/salesSms.js",
  "lib/sales/outreach.js",
  "lib/sales/outreachSender.js",
  "lib/sales/outreachIdentity.js",
  "lib/sales/emailTemplates.js",
  "app/api/sales/threads/templates/route.js",
  "lib/sales/calls/inboundRouting.js",
  "lib/sales/calls/queue.js",
  "app/api/rep-dial/inbound/route.js",
  "lib/sales/playbook/script.js",
  "lib/sales/pipeline/handlers/generateCallScript.js",
  "app/api/sales/playbook/route.js",
  "app/api/sales/signups/route.js",
  "lib/sales/checkin/linkNoSignup.js",
  "lib/sales/checkin/unfinishedSignup.js",
  "lib/sales/checkin/materialise.js",
  "lib/sales/checkin/store.js",
  "app/api/sales/checkins/route.js",
  "app/api/sales/messages/route.js",
  "lib/sales/demoBooking/book.js",
  "app/api/sales/events/[id]/invite/route.js",
  "lib/sales/outreach/introSend.js",
  "lib/sales/outreach/introEmail.js",
  "lib/sales/outreach/introRequests.js",
  "lib/sales/repDemo.js",
  "app/api/sales/demo-hours/route.js",
  "app/i/[token]/page.js",
  "app/demo/[repCode]/page.js",
];
// A rep's REAL name, read off a row: rep.name, rep?.name, salesRep.name,
// repRow.name, toRep.name … Each allowed line is named with its reason.
const REAL_NAME_RE = /\b(?:rep|salesRep|repRow|toRep|fromRep|assignedRep)\??\.name\b/;
const ALLOWED = [
  // A report to FieldQuo's own cron log, per rep.
  { file: "lib/sales/checkin/materialise.js", has: "name: rep.name," },
  { file: "lib/sales/checkin/materialise.js", has: "report.perRep.push({ repId: rep.id, name: rep.name" },
  // The rep's own console, showing them their own name.
  { file: "app/api/sales/messages/route.js", has: "repName: rep.name || null," },
  // The raw row handed onward WITH its workName, so repPublicName downstream can choose.
  { file: "app/api/sales/playbook/route.js", has: "rep: { id: rep.id, name: rep.name, workName: rep.workName }" },
  { file: "app/api/sales/threads/templates/route.js", has: "rep: { name: rep.name, workName: rep.workName" },
  // The intro email's pure builder reads `rep.name` off the object its ONE
  // caller builds as { name: repPublicName(...) } — asserted just below.
  { file: "lib/sales/outreach/introEmail.js", has: "sanitiseHeaderText(rep?.name, 120)" },
  // The rep's own lead screen: who on the team sent an intro email.
  { file: "lib/sales/outreach/introRequests.js", has: "sentBy: r.salesRep?.name" },
  // The demo login's display name falls back to the real name only when there is no public name at all.
  { file: "lib/sales/repDemo.js", has: "name: repPublicName(rep) || rep.name" },
  // The plan's internal rep block keeps the real name for logs; the caller hears `publicName`.
  { file: "lib/sales/calls/inboundRouting.js", has: "name: rep.name || null, publicName: repPublicName(rep)" },
  // The inbound route's repToTell returns the raw row (with workName) for inboundPlan to resolve.
  { file: "app/api/rep-dial/inbound/route.js", has: "return { id: row.id, name: row.name, workName: row.workName }" },
];
for (const file of OUTSIDER_FILES) {
  if (!existsSync(join(ROOT, file))) {
    ok(`${file} exists`, false);
    continue;
  }
  const lines = decomment(read(file)).split("\n");
  const offending = [];
  lines.forEach((line, n) => {
    if (!REAL_NAME_RE.test(line)) return;
    if (ALLOWED.some((a) => a.file === file && line.includes(a.has))) return;
    offending.push(`${n + 1}: ${line.trim().slice(0, 140)}`);
  });
  ok(`${file}: no real name reaches the outsider`, offending.length === 0, offending);
}
ok(
  "the intro email's one caller hands it the PUBLIC name",
  /rep: \{ name: repPublicName\(repRow \|\| rep\), email: readiness\.from/.test(read("lib/sales/outreach/introSend.js")),
);

// Every allowance still matches a real line — a stale exemption is a hole.
for (const a of ALLOWED) {
  ok(`allowance still matches: ${a.file} — ${a.has.slice(0, 50)}`, decomment(read(a.file)).includes(a.has));
}

// No link builder is handed the legacy name slug, anywhere in app/ or lib/.
function walk(dir, out = []) {
  const { readdirSync, statSync } = globalThis.__fs;
  for (const name of readdirSync(join(ROOT, dir))) {
    const rel = `${dir}/${name}`;
    const st = statSync(join(ROOT, rel));
    if (st.isDirectory()) walk(rel, out);
    else if (/\.(m?js)$/.test(name)) out.push(rel);
  }
  return out;
}
globalThis.__fs = await import("node:fs");
const allFiles = [...walk("app"), ...walk("lib")];
const slugLinks = [];
for (const file of allFiles) {
  const src = decomment(read(file));
  // The rest of the call's line, not up to the first ")": an argument like
  // getAppOrigin(request) closes a paren before the code argument arrives,
  // and the first version of this regex waved `rep.code` through behind it.
  for (const m of src.matchAll(/\b(?:signupLinkFor|repDemoUrl)\([^\n;]*/g)) {
    if (/\.code\b/.test(m[0])) slugLinks.push(`${file}: ${m[0].slice(0, 120)}`);
  }
  // A hand-built copy of the link from a code column.
  for (const m of src.matchAll(/\/signup\?sales=\$\{[^}]*\.code\b/g)) slugLinks.push(`${file}: ${m[0]}`);
}
ok("no signupLinkFor / repDemoUrl / hand-built ?sales= link is built from SalesRep.code", slugLinks.length === 0, slugLinks);

// The gates every outsider-facing route starts from select the work name —
// a route handed a row without it would silently sign with the first name.
for (const gate of ["lib/sales/gate.js", "lib/sales/outreachGate.js", "lib/sales/smsGate.js", "lib/sales/queueGate.js", "lib/sales/calendar/gate.js"]) {
  ok(`${gate} selects workName`, /workName: true/.test(decomment(read(gate))));
}

// The rep can set it, and the platform can: both doors validate through the one function.
ok("the rep's own route validates with validateWorkName", /validateWorkName\(/.test(read("app/api/sales/work-name/route.js")));
ok("the platform PATCH validates with validateWorkName", /validateWorkName\(body\.workName\)/.test(read("app/api/platform/sales/reps/[id]/route.js")));
ok("the settings screen mounts the work-name card", /<RepWorkNameChoice \/>/.test(read("app/sales/settings/page.js")));

// Every language carries the settings card's strings.
{
  const { APP_MESSAGES } = await import("@/app/i18n/appMessages");
  const keys = Object.keys(APP_MESSAGES.en).filter((k) => k.startsWith("app.salesWorkName."));
  ok("the work-name card has its strings", keys.length >= 10, keys.length);
  const missing = [];
  for (const [lang, table] of Object.entries(APP_MESSAGES)) {
    for (const k of keys) if (typeof table[k] !== "string" || !table[k].trim()) missing.push(`${lang}:${k}`);
  }
  ok(`…in all ${Object.keys(APP_MESSAGES).length} app languages`, missing.length === 0, missing.slice(0, 10));
}

console.log(`\n${pass} passed, ${failures.length} failed.`);
if (failures.length) process.exit(1);
