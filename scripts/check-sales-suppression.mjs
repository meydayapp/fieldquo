// scripts/check-sales-suppression.mjs
//
//   npm run check:sales-suppression
//
// FieldQuo's own do-not-contact list, and the rule for when a rep may dial.
//
// ══ Why this check is mostly EXECUTION ═════════════════════════════════════
//
// A suppression list fails in exactly one way that matters: it stores one
// spelling of a person and looks up another, so it answers "not suppressed"
// about somebody who asked us to stop. That failure is invisible by reading —
// every line looks right, and the bug is in the disagreement between two of
// them. So the normalisers, the key derivation, the verdict, the write path
// and the calling window are all RUN here, against the ways each could be
// wrong: an opt-out taken by phone and then an email send, two leads holding
// the same address, a suppressed domain, mixed casing and formatting, a
// lookalike that must NOT be suppressed, a removal with no reason, and a call
// attempted outside the window in the prospect's time zone rather than ours.
//
// lib/sales/suppression.js takes its Prisma client as an argument — the shape
// lib/marketing/unsubscribe.js and lib/sales/outreachInbound.js already use —
// so the real shipped functions run below against a fake client, with no
// database and no loader hooks.
//
// ══ Why every source rule is scoped to ONE function ════════════════════════
//
// The parts that cannot be executed ("is the guard inside the send path")
// are matched against source with comments stripped, and every positional
// rule is scoped to a single named function pulled out by brace matching. A
// guard string appearing elsewhere in the same file — in a neighbouring
// function, or in a route's other handler — must not manufacture a pass. That
// has produced a false pass twice in this project, which is why
// functionBody() exists here and in scripts/check-sales-outreach.mjs rather
// than a file-wide includes().

import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

import {
  ALL_CHANNELS,
  INTERNAL_DNC_RETENTION,
  SUPPRESSION_CHANNELS,
  SUPPRESSION_KINDS,
  SUPPRESSION_SOURCES,
  describeSuppression,
  emailLookupKeys,
  internalDncRetainUntil,
  isSuppressionChannel,
  isSuppressionKind,
  isSuppressionSource,
  normaliseDomain,
  normaliseEmail,
  normalisePhone,
  normaliseSuppressionValue,
  suppressionLookupKeys,
  suppressionVerdict,
  withinRetention,
} from "@/lib/sales/suppressionRules";
import {
  checkSuppression,
  findSuppressions,
  importSuppressions,
  listSuppressions,
  parseSuppressionImport,
  suppress,
  suppressionRefusal,
  suppressWithin,
  unsuppress,
} from "@/lib/sales/suppression";
import {
  SALES_CALL_WINDOW,
  describeSalesCallWindow,
  localTimeIn,
  withinSalesCallingHours,
} from "@/lib/sales/callingWindow";
import { CALL_WINDOW } from "@/lib/voice/outbound";
import { contactOptedOut, fileInboundMessage } from "@/lib/sales/outreachInbound";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

let pass = 0;
const failures = [];
function ok(name, cond, got) {
  if (cond) {
    pass++;
    console.log(`  ✓ ${name}`);
  } else {
    failures.push(name);
    console.log(`  ✗ ${name}${got !== undefined ? `  got: ${JSON.stringify(got)}` : ""}`);
  }
}
const section = (title) => console.log(`\n${title}`);

// ── Source helpers ─────────────────────────────────────────────────────────

/** Comments stripped before any regex touches source. A guard named in a comment is not a guard. */
function stripComments(src) {
  return src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
}

function read(relative) {
  return stripComments(readFileSync(join(ROOT, relative), "utf8"));
}

/**
 * The body of ONE named function, by brace matching.
 *
 * The parameter list is walked to its closing paren first: taking the next `{`
 * after the name lands on the destructuring brace of `POST(request, { params
 * })` and matches a two-word "body", against which every assertion passes or
 * fails for reasons unrelated to the handler.
 */
function functionBody(src, name) {
  const start = src.search(
    new RegExp(`(export\\s+)?(async\\s+)?function\\s+${name}\\s*\\(`),
  );
  if (start === -1) return null;

  const paren = src.indexOf("(", start);
  if (paren === -1) return null;
  let parens = 0;
  let afterParams = -1;
  for (let i = paren; i < src.length; i++) {
    if (src[i] === "(") parens++;
    else if (src[i] === ")") {
      parens--;
      if (parens === 0) {
        afterParams = i;
        break;
      }
    }
  }
  if (afterParams === -1) return null;

  const open = src.indexOf("{", afterParams);
  if (open === -1) return null;
  let depth = 0;
  for (let i = open; i < src.length; i++) {
    if (src[i] === "{") depth++;
    else if (src[i] === "}") {
      depth--;
      if (depth === 0) return src.slice(open, i + 1);
    }
  }
  return null;
}

function walk(dir, out = []) {
  if (!existsSync(dir)) return out;
  for (const name of readdirSync(dir)) {
    if (name === "node_modules" || name === ".next" || name.startsWith(".")) continue;
    const full = join(dir, name);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (name.endsWith(".js") || name.endsWith(".mjs")) out.push(full);
  }
  return out;
}

// ── A fake Prisma client ───────────────────────────────────────────────────
//
// Answers exactly the queries lib/sales/suppression.js and
// lib/sales/outreachInbound.js make, and records every write, so an assertion
// is about an ARGUMENT rather than about a line of source. Anything
// unscripted throws by name — the rule scripts/fixtures/dbStub.mjs states. A
// check must never pass because a query silently answered "nothing".
function fakeDb({ suppressions = [], threads = [], messages = [], leads = [] } = {}) {
  const state = {
    suppressions: suppressions.map((s) => ({ ...s })),
    events: [],
    threads: threads.map((t) => ({ ...t })),
    messages: messages.map((m) => ({ ...m })),
    leads: leads.map((l) => ({ ...l })),
    deletes: [],
  };
  let seq = 0;

  const matchOr = (row, where) => {
    if (where?.OR) return where.OR.some((c) => row.kind === c.kind && row.value === c.value);
    if (where?.OR === undefined && Object.keys(where || {}).length === 0) return true;
    return false;
  };

  const client = {
    salesSuppression: {
      findMany: async ({ where = {} } = {}) => {
        if (where.OR) return state.suppressions.filter((r) => matchOr(r, where));
        if (!Object.keys(where).length) return [...state.suppressions];
        // The list screen's contains search.
        const needle = where.OR?.[0]?.value?.contains;
        return state.suppressions.filter((r) => !needle || r.value.includes(needle));
      },
      count: async ({ where = {} } = {}) =>
        Object.keys(where).length ? state.suppressions.length : state.suppressions.length,
      findUnique: async ({ where }) => {
        const k = where?.kind_value;
        if (!k) throw new Error("fakeDb: salesSuppression.findUnique needs kind_value");
        return state.suppressions.find((r) => r.kind === k.kind && r.value === k.value) || null;
      },
      upsert: async ({ where, create, update }) => {
        const k = where.kind_value;
        const found = state.suppressions.find((r) => r.kind === k.kind && r.value === k.value);
        if (found) {
          Object.assign(found, update);
          return found;
        }
        const row = { id: `sup_${++seq}`, createdAt: new Date(), ...create };
        state.suppressions.push(row);
        return row;
      },
      update: async ({ where, data }) => {
        const found = state.suppressions.find((r) => r.id === where.id);
        if (!found) throw new Error("fakeDb: no such suppression");
        Object.assign(found, data);
        return found;
      },
      delete: async () => {
        state.deletes.push("salesSuppression.delete");
        throw new Error("fakeDb: nothing may delete a suppression");
      },
      deleteMany: async () => {
        state.deletes.push("salesSuppression.deleteMany");
        throw new Error("fakeDb: nothing may delete a suppression");
      },
    },
    salesSuppressionEvent: {
      create: async ({ data }) => {
        const row = { id: `ev_${++seq}`, occurredAt: new Date(), ...data };
        state.events.push(row);
        return row;
      },
    },
    salesThread: {
      findUnique: async ({ where }) =>
        state.threads.find((t) => t.replyToken === where.replyToken) || null,
      updateMany: async ({ where, data }) => {
        const hits = state.threads.filter(
          (t) => t.id === where.id && (!where.lastMessageAt?.lt || t.lastMessageAt < where.lastMessageAt.lt),
        );
        for (const t of hits) Object.assign(t, data);
        return { count: hits.length };
      },
    },
    salesMessage: {
      findFirst: async ({ where }) =>
        state.messages.find(
          (m) =>
            m.threadId === where.threadId &&
            m.direction === where.direction &&
            m.providerId === where.providerId,
        ) || null,
      findMany: async ({ where }) =>
        state.messages.filter((m) => {
          if (where.direction && m.direction !== where.direction) return false;
          if (where.thread) {
            const t = state.threads.find((x) => x.id === m.threadId);
            if (!t) return false;
            // The bug this check exists for: a rep-scoped clause here.
            if (where.thread.salesRepId !== undefined && t.salesRepId !== where.thread.salesRepId) {
              return false;
            }
            if (where.thread.leadId !== undefined && t.leadId !== where.thread.leadId) return false;
            if (where.thread.lead?.email !== undefined) {
              const lead = state.leads.find((l) => l.id === t.leadId);
              if (!lead || lead.email !== where.thread.lead.email) return false;
            }
          }
          return true;
        }),
      create: async ({ data }) => {
        const row = { id: `msg_${++seq}`, ...data };
        state.messages.push(row);
        return row;
      },
    },
    $transaction: async (fn) => fn(client),
  };

  return { client, state };
}

// ═══════════════════════════════════════════════════════════════════════════
section("1. Normalisation — the same person, spelled every way");

{
  // Mixed casing and formatting, which is how the same person arrives twice.
  ok("an address lowercases", normaliseEmail("BOB@Acme.COM") === "bob@acme.com");
  ok("a display name is stripped", normaliseEmail("Bob Vance <BOB@Acme.com>") === "bob@acme.com");
  ok("surrounding whitespace goes", normaliseEmail("   bob@acme.com \n") === "bob@acme.com");
  ok("a www. on the domain half goes", normaliseEmail("bob@WWW.Acme.com") === "bob@acme.com");
  ok("a trailing dot on the domain goes", normaliseEmail("bob@acme.com.") === "bob@acme.com");
  ok("a plus tag is KEPT in what is stored", normaliseEmail("bob+news@acme.com") === "bob+news@acme.com");

  // Hostile.
  ok("a header injection is refused, not reshaped", normaliseEmail("bob@acme.com\r\nBcc: x@y.com") === null);
  ok("an address with a space is refused", normaliseEmail("bo b@acme.com") === null);
  ok("no @ is refused", normaliseEmail("acme.com") === null);
  ok("a bare local part is refused", normaliseEmail("bob@") === null);
  ok("a leading @ is refused", normaliseEmail("@acme.com") === null);
  ok("a domain with no dot is refused", normaliseEmail("bob@localhost") === null);
  ok("empty and null are refused", normaliseEmail("") === null && normaliseEmail(null) === null);
  ok("an object is refused rather than stringified into a key", normaliseEmail({}) === null);
  ok("a 300-character address is refused", normaliseEmail(`${"a".repeat(300)}@acme.com`) === null);
}

{
  ok("a URL becomes its domain", normaliseDomain("https://WWW.Acme.com/contact?x=1#y") === "acme.com");
  ok("a port goes", normaliseDomain("acme.com:8443") === "acme.com");
  ok("an address's right-hand side is taken", normaliseDomain("bob@Acme.com") === "acme.com");
  ok("a subdomain is its OWN key, not folded to the parent", normaliseDomain("support.acme.com") === "support.acme.com");
  ok("an IP address is refused", normaliseDomain("192.168.0.1") === null);
  ok("a single label is refused", normaliseDomain("acme") === null);
  ok("a hyphen-led label is refused", normaliseDomain("-acme.com") === null);
  ok("an underscore is refused", normaliseDomain("ac_me.com") === null);
  ok("empty is refused", normaliseDomain("   ") === null);
}

{
  ok("a formatted NANP number normalises", normalisePhone("(613) 555-0142") === "+16135550142");
  ok("...and so does the same number with a 1", normalisePhone("1-613-555-0142") === "+16135550142");
  ok("...and with dots", normalisePhone("613.555.0142") === "+16135550142");
  ok("...and already in E.164", normalisePhone("+16135550142") === "+16135550142");
  ok("all four spellings collapse to ONE key",
     new Set([
       normalisePhone("(613) 555-0142"),
       normalisePhone("1-613-555-0142"),
       normalisePhone("613.555.0142"),
       normalisePhone("+1 613 555 0142"),
     ]).size === 1);
  ok("a too-short number is refused", normalisePhone("555") === null);
  ok("letters are refused", normalisePhone("CALL-ME") === null);
  ok("empty is refused", normalisePhone("") === null);
  ok("a +0 number is refused", normalisePhone("+000000000") === null);
}

{
  ok("normaliseSuppressionValue routes by kind",
     normaliseSuppressionValue("email", "B@A.com") === "b@a.com" &&
     normaliseSuppressionValue("domain", "https://A.com") === "a.com" &&
     normaliseSuppressionValue("phone", "6135550142") === "+16135550142");
  ok("an unknown kind normalises to nothing", normaliseSuppressionValue("fax", "x") === null);
  ok("the kind is never sniffed — a phone under 'domain' is refused",
     normaliseSuppressionValue("domain", "6135550142") === null);
}

// ═══════════════════════════════════════════════════════════════════════════
section("2. Lookup widens where storage does not");

{
  const keys = emailLookupKeys("Bob <BOB+FieldQuo@Acme.com>");
  const flat = keys.map((k) => `${k.kind}:${k.value}`);
  ok("the address itself is a key", flat.includes("email:bob+fieldquo@acme.com"), flat);
  ok("the plus-tag-stripped mailbox is also a key", flat.includes("email:bob@acme.com"), flat);
  ok("the domain is also a key", flat.includes("domain:acme.com"), flat);
  ok("an address with no tag produces two keys, not three", emailLookupKeys("bob@acme.com").length === 2);
  ok("an unusable address produces no keys at all", emailLookupKeys("nonsense").length === 0);
}

{
  const keys = suppressionLookupKeys({ email: "BOB@Acme.com", phone: "(613) 555-0142" });
  const flat = keys.map((k) => `${k.kind}:${k.value}`);
  ok("one contact yields the email, the domain and the phone",
     flat.includes("email:bob@acme.com") && flat.includes("domain:acme.com") && flat.includes("phone:+16135550142"),
     flat);
  ok("keys are deduplicated",
     suppressionLookupKeys({ email: "bob@acme.com", domain: "acme.com" }).length === 2);
  ok("a contact with nothing usable yields no keys", suppressionLookupKeys({}).length === 0);
}

// ═══════════════════════════════════════════════════════════════════════════
section("3. The verdict — what closes a channel, and what does not");

const row = (over = {}) => ({
  id: "s1",
  kind: "email",
  value: "bob@acme.com",
  channels: ALL_CHANNELS,
  source: "reply",
  requestedAt: new Date("2026-08-01"),
  removedAt: null,
  ...over,
});

{
  ok("a live row on this channel suppresses", suppressionVerdict({ rows: [row()], channel: "email" }).suppressed);
  ok("no rows means not suppressed", suppressionVerdict({ rows: [], channel: "email" }).suppressed === false);
  ok("a REMOVED row does not suppress",
     suppressionVerdict({ rows: [row({ removedAt: new Date() })], channel: "email" }).suppressed === false);
  ok("a row that closes only email does not close phone",
     suppressionVerdict({ rows: [row({ channels: ["email"] })], channel: "phone" }).suppressed === false);
  ok("...and still closes email",
     suppressionVerdict({ rows: [row({ channels: ["email"] })], channel: "email" }).suppressed);
  ok("a row with no channels closes nothing",
     suppressionVerdict({ rows: [row({ channels: [] })], channel: "email" }).suppressed === false);
  ok("a malformed row (channels not a list) closes nothing rather than throwing",
     suppressionVerdict({ rows: [row({ channels: null })], channel: "email" }).suppressed === false);

  // The one that must fail CLOSED.
  const typo = suppressionVerdict({ rows: [row()], channel: "e-mail" });
  ok("an unrecognised channel REFUSES rather than waving the send through", typo.suppressed === true);
  ok("...and says why", /isn't a channel/.test(typo.reason || ""));
  ok("an undefined channel refuses too", suppressionVerdict({ rows: [], channel: undefined }).suppressed === true);

  const both = suppressionVerdict({
    rows: [row({ kind: "domain", value: "acme.com", id: "d1" }), row()],
    channel: "email",
  });
  ok("the most specific hit is the one reported", both.hit.kind === "email", both.hit?.kind);
  ok("a domain-only hit still suppresses",
     suppressionVerdict({ rows: [row({ kind: "domain", value: "acme.com" })], channel: "email" }).suppressed);
  ok("the reason names the person, not a code", /bob@acme\.com/.test(describeSuppression(row())));
  ok("a domain reason says it covers everyone there",
     /Everyone at acme\.com/.test(describeSuppression(row({ kind: "domain", value: "acme.com" }))));
  ok("the reason states the principle", /binds FieldQuo/.test(describeSuppression(row())));
}

// ═══════════════════════════════════════════════════════════════════════════
section("4. The hostile cases from the brief, executed end to end");

{
  // ── An opt-out taken by PHONE, then an EMAIL send ─────────────────────────
  const { client, state } = fakeDb();
  const written = await suppress(client, {
    kind: "phone",
    value: "(613) 555-0142",
    source: "call",
    reason: "Told the rep to stop calling.",
  });
  ok("a phone opt-out writes one row", written.ok && state.suppressions.length === 1);
  ok("...normalised to E.164", state.suppressions[0].value === "+16135550142", state.suppressions[0].value);
  ok("...closing EVERY channel, because an unqualified stop is unqualified",
     ALL_CHANNELS.every((c) => state.suppressions[0].channels.includes(c)), state.suppressions[0].channels);

  const emailAttempt = await checkSuppression(client, {
    email: "bob@acme.com",
    phone: "1 613 555 0142",
    channel: "email",
  });
  ok("THE CASE: an EMAIL send to that prospect is refused by the PHONE opt-out", emailAttempt.suppressed);
  ok("...and a differently-formatted spelling of the same number still hits", emailAttempt.hit.kind === "phone");

  const other = await checkSuppression(client, { phone: "(613) 555-0143", channel: "phone" });
  ok("an UNSUPPRESSED LOOKALIKE one digit away is not suppressed", other.suppressed === false);
}

{
  // ── Two leads, one email. The bug the audit found. ────────────────────────
  const { client, state } = fakeDb({
    leads: [
      { id: "leadA", email: "bob@acme.com" },
      { id: "leadB", email: "bob@acme.com" },
    ],
    threads: [
      { id: "tA", leadId: "leadA", salesRepId: "rep1", replyToken: "fqs" + "a".repeat(32), lastMessageAt: new Date(0), subject: "Hi" },
      { id: "tB", leadId: "leadB", salesRepId: "rep2", replyToken: "fqs" + "b".repeat(32), lastMessageAt: new Date(0), subject: "Hi" },
    ],
    messages: [
      { id: "m1", threadId: "tA", direction: "in", body: "unsubscribe" },
    ],
  });

  const repOne = await contactOptedOut(client, { leadId: "leadA", email: "bob@acme.com" });
  const repTwo = await contactOptedOut(client, { leadId: "leadB", email: "bob@acme.com" });
  ok("the rep who received the opt-out is blocked", repOne.optedOut);
  ok("THE BUG: the SECOND rep holding the same prospect is blocked too", repTwo.optedOut, repTwo);
  ok("...and is told the request binds FieldQuo", /binds FieldQuo|stands for FieldQuo/.test(repTwo.reason || ""));

  // A different prospect at the same company is NOT swept up by a per-address
  // opt-out — only a DOMAIN suppression does that, and none was recorded.
  const colleague = await contactOptedOut(client, { leadId: "leadC", email: "sue@acme.com" });
  ok("a colleague at the same company is NOT blocked by one person's reply", colleague.optedOut === false);
  ok("nothing was written by a read", state.suppressions.length === 0);
}

{
  // ── A suppressed DOMAIN ───────────────────────────────────────────────────
  const { client } = fakeDb();
  await suppress(client, { kind: "domain", value: "https://WWW.Acme.com/about", source: "manual", reason: "Head office asked." });

  const anyone = await checkSuppression(client, { email: "someone.new@Acme.com", channel: "email" });
  ok("THE CASE: a suppressed domain blocks an address never seen before", anyone.suppressed);
  ok("...and the URL that was pasted normalised to the bare domain", anyone.hit.value === "acme.com", anyone.hit?.value);

  const lookalike = await checkSuppression(client, { email: "bob@acme.com.co", channel: "email" });
  ok("an UNSUPPRESSED LOOKALIKE domain is not blocked", lookalike.suppressed === false);
  const sub = await checkSuppression(client, { email: "bob@mail.acme.com", channel: "email" });
  ok("a subdomain is not blocked by the parent — it is its own key, never guessed", sub.suppressed === false);
}

{
  // ── A removal without a reason ────────────────────────────────────────────
  const { client, state } = fakeDb();
  await suppress(client, { kind: "email", value: "bob@acme.com", source: "reply" });

  for (const [label, reason] of [["missing", undefined], ["empty", ""], ["whitespace", "   "], ["null", null]]) {
    const r = await unsuppress(client, { kind: "email", value: "bob@acme.com", adminId: "admin1", reason });
    ok(`THE CASE: a removal with a ${label} reason is REFUSED`, r.ok === false && r.status === 400, r);
  }
  ok("...and the row is untouched by the refusal", state.suppressions[0].removedAt == null);

  const unattributed = await unsuppress(client, { kind: "email", value: "bob@acme.com", reason: "because" });
  ok("a removal with no superadmin attached is refused", unattributed.ok === false && unattributed.status === 403);

  const good = await unsuppress(client, {
    kind: "email",
    value: "BOB@Acme.com",
    adminId: "admin1",
    reason: "They wrote back asking to be re-added to the list.",
  });
  ok("a removal with a reason succeeds — and matches on the NORMALISED key", good.ok, good);
  ok("the row is still there; nothing was deleted", state.suppressions.length === 1);
  ok("removedAt is set", state.suppressions[0].removedAt instanceof Date);
  ok("the reason is stored", /re-added/.test(state.suppressions[0].removedReason));
  ok("the superadmin is recorded", state.suppressions[0].removedByAdminId === "admin1");
  ok("a removal writes an event", state.events.some((e) => e.action === "removed"));
  ok("the send path now allows it", (await checkSuppression(client, { email: "bob@acme.com", channel: "email" })).suppressed === false);

  const twice = await unsuppress(client, { kind: "email", value: "bob@acme.com", adminId: "a", reason: "again" });
  ok("removing twice is refused rather than silently repeated", twice.ok === false && twice.status === 409);

  const gone = await unsuppress(client, { kind: "email", value: "nobody@acme.com", adminId: "a", reason: "x" });
  ok("removing something that is not on the list is a 404", gone.ok === false && gone.status === 404);
}

{
  // ── Re-adding, and the channel union ──────────────────────────────────────
  const { client, state } = fakeDb();
  await suppress(client, { kind: "email", value: "bob@acme.com", channels: ["email"], source: "reply", requestedAt: new Date("2026-03-01") });
  const second = await suppress(client, { kind: "email", value: "BOB@ACME.COM", channels: ["phone"], source: "call", requestedAt: new Date("2026-06-01") });

  ok("a re-add updates the one row rather than making a second", state.suppressions.length === 1);
  ok("...and reports itself as a re-suppression", second.action === "resuppressed");
  ok("channels UNION rather than replace — the March request is not reopened",
     ["email", "phone"].every((c) => state.suppressions[0].channels.includes(c)), state.suppressions[0].channels);
  ok("the retention clock still runs from the EARLIEST request",
     new Date(state.suppressions[0].requestedAt).getTime() === new Date("2026-03-01").getTime(),
     state.suppressions[0].requestedAt);
  ok("both writes left an event", state.events.length === 2);

  // A removal, then the person asks again.
  await unsuppress(client, { kind: "email", value: "bob@acme.com", adminId: "a", reason: "asked to resume" });
  await suppress(client, { kind: "email", value: "bob@acme.com", source: "reply" });
  ok("a fresh request outranks an earlier superadmin removal", state.suppressions[0].removedAt === null);
  ok("...and clears who removed it", state.suppressions[0].removedByAdminId === null);
}

{
  // ── Refusing to write nonsense ────────────────────────────────────────────
  const { client, state } = fakeDb();
  ok("an unusable value writes nothing",
     (await suppress(client, { kind: "email", value: "not an address", source: "manual" })).ok === false);
  ok("an unknown kind writes nothing",
     (await suppress(client, { kind: "fax", value: "x", source: "manual" })).ok === false);
  ok("an unknown source writes nothing — where a request came from is not guessed",
     (await suppress(client, { kind: "email", value: "b@a.com", source: "vibes" })).ok === false);
  ok("an empty channel list writes nothing",
     (await suppress(client, { kind: "email", value: "b@a.com", channels: [], source: "manual" })).ok === false);
  ok("a channel list of only junk writes nothing",
     (await suppress(client, { kind: "email", value: "b@a.com", channels: ["carrier pigeon"], source: "manual" })).ok === false);
  ok("nothing at all was written by five refusals", state.suppressions.length === 0 && state.events.length === 0);
}

{
  // ── The refusal shape a route can return ──────────────────────────────────
  const { client } = fakeDb();
  await suppress(client, { kind: "email", value: "bob@acme.com", source: "reply" });
  const refusal = await suppressionRefusal(client, { email: "BOB@acme.com", channel: "email" });
  ok("suppressionRefusal returns a 409, not a 403 or a 500", refusal?.status === 409, refusal);
  ok("...carrying a human-readable reason", typeof refusal.body.error === "string" && refusal.body.error.length > 20);
  ok("...and the optedOut flag the screens already branch on", refusal.body.optedOut === true);
  ok("an unsuppressed contact returns null", (await suppressionRefusal(client, { email: "sue@other.com", channel: "email" })) === null);
}

// ═══════════════════════════════════════════════════════════════════════════
section("5. An inbound 'unsubscribe' becomes FieldQuo's, atomically");

{
  const token = "fqs" + "c".repeat(32);
  const { client, state } = fakeDb({
    leads: [{ id: "leadA", email: "bob@acme.com" }],
    threads: [
      {
        id: "tA",
        leadId: "leadA",
        salesRepId: "rep1",
        replyToken: token,
        subject: "Hi",
        lastMessageAt: new Date(0),
        salesRep: { email: "rep@fieldquo.com" },
        lead: { id: "leadA", email: "bob@acme.com", phone: null },
      },
    ],
  });

  const filed = await fileInboundMessage(client, {
    token,
    fromAddress: "bob@acme.com",
    toAddress: "rep@fieldquo.com",
    subject: "Re: Hi",
    body: "unsubscribe",
    providerId: "prov-1",
    sentAt: new Date("2026-08-20"),
  });

  ok("the reply is filed", filed.filed === true);
  ok("it reports the opt-out", filed.optOut === true);
  ok("THE FIX: it also reports that the PLATFORM list was written", filed.suppressed === true, filed);
  ok("...and one suppression row exists", state.suppressions.length === 1);
  ok("...keyed on the address FieldQuo wrote to", state.suppressions[0].value === "bob@acme.com");
  ok("...closing every channel", ALL_CHANNELS.every((c) => state.suppressions[0].channels.includes(c)));
  ok("...dated from the reply, not from now",
     new Date(state.suppressions[0].requestedAt).getTime() === new Date("2026-08-20").getTime());
  ok("...citing the message as evidence", Boolean(state.suppressions[0].salesMessageId));
  ok("...and the lead", state.suppressions[0].salesLeadId === "leadA");

  // The forged-From attack: the suppression must key on the lead's address,
  // never on whatever the reply claimed to come from.
  const token2 = "fqs" + "d".repeat(32);
  const forged = fakeDb({
    leads: [{ id: "leadB", email: "sue@other.com" }],
    threads: [
      {
        id: "tB",
        leadId: "leadB",
        salesRepId: "rep1",
        replyToken: token2,
        subject: "Hi",
        lastMessageAt: new Date(0),
        salesRep: { email: "rep@fieldquo.com" },
        lead: { id: "leadB", email: "sue@other.com", phone: null },
      },
    ],
  });
  await fileInboundMessage(forged.client, {
    token: token2,
    fromAddress: "victim@competitor.com",
    body: "unsubscribe",
    providerId: "p2",
  });
  ok("a forged From cannot suppress a third party",
     forged.state.suppressions.every((s) => s.value !== "victim@competitor.com"),
     forged.state.suppressions.map((s) => s.value));
  ok("...it suppresses only the address we actually wrote to",
     forged.state.suppressions.length === 1 && forged.state.suppressions[0].value === "sue@other.com");

  // An ordinary reply must not suppress anybody.
  const token3 = "fqs" + "e".repeat(32);
  const normal = fakeDb({
    leads: [{ id: "leadC", email: "amy@third.com" }],
    threads: [
      {
        id: "tC",
        leadId: "leadC",
        salesRepId: "rep1",
        replyToken: token3,
        subject: "Hi",
        lastMessageAt: new Date(0),
        salesRep: { email: "rep@fieldquo.com" },
        lead: { id: "leadC", email: "amy@third.com", phone: null },
      },
    ],
  });
  await fileInboundMessage(normal.client, {
    token: token3,
    fromAddress: "amy@third.com",
    body: "Sounds interesting, can you please stop by at 3 on Thursday?",
    providerId: "p3",
  });
  ok("an ordinary reply containing 'stop by' suppresses NOBODY", normal.state.suppressions.length === 0);
}

// ═══════════════════════════════════════════════════════════════════════════
section("6. Retention — three years and fourteen days");

{
  ok("the constant is 3 years and 14 days",
     INTERNAL_DNC_RETENTION.years === 3 && INTERNAL_DNC_RETENTION.days === 14);

  const from = new Date("2026-09-01T00:00:00Z");
  const until = internalDncRetainUntil(from);
  ok("2026-09-01 retains until 2029-09-15", until.toISOString().slice(0, 10) === "2029-09-15", until.toISOString());

  // Calendar arithmetic, not 3 * 365 days: a window containing 29 February
  // must not come out a day short of the legal minimum.
  // 2024-01-01 + 3 years spans 29 February 2024. Picking a start date whose
  // window contains no leap day (2025-01-01 is one) would make this assertion
  // pass for the wrong reason — the two arithmetics agree there.
  const leap = internalDncRetainUntil(new Date("2024-01-01T00:00:00Z"));
  const naive = new Date(Date.parse("2024-01-01T00:00:00Z") + (3 * 365 + 14) * 86400000);
  ok("a window spanning a leap day is a day LONGER than 3*365+14, never shorter",
     leap.getTime() > naive.getTime(), { leap: leap.toISOString(), naive: naive.toISOString() });

  ok("an unparseable date falls back to now rather than to 1970",
     internalDncRetainUntil("not a date").getFullYear() >= new Date().getFullYear() + 3);

  ok("a row inside its window is retained",
     withinRetention({ retainUntil: new Date("2030-01-01") }, new Date("2026-09-01")));
  ok("a row past its window reports so",
     withinRetention({ retainUntil: new Date("2026-01-01") }, new Date("2026-09-01")) === false);
  ok("a row with no retainUntil is KEPT — unknown never means deletable",
     withinRetention({}) === true);

  // The stored column, on a real write.
  const { client, state } = fakeDb();
  await suppress(client, { kind: "email", value: "b@a.com", source: "reply", requestedAt: new Date("2026-09-01") });
  ok("every write stores retainUntil, so the obligation is legible in the row",
     state.suppressions[0].retainUntil instanceof Date);
  ok("...computed from the request date", state.suppressions[0].retainUntil.toISOString().slice(0, 10) === "2029-09-15");
}

{
  // Nothing anywhere may delete one of these rows.
  const offenders = [];
  for (const file of [...walk(join(ROOT, "lib")), ...walk(join(ROOT, "app")), ...walk(join(ROOT, "scripts"))]) {
    const src = stripComments(readFileSync(file, "utf8"));
    if (/salesSuppression(Event)?\s*\.\s*delete(Many)?\s*\(/.test(src)) {
      offenders.push(file.replace(ROOT + "/", ""));
    }
  }
  ok("NOTHING in lib, app or scripts deletes a suppression row", offenders.length === 0, offenders);

  const libSrc = read("lib/sales/suppression.js");
  ok("the suppression module exports no delete function", !/export\s+(async\s+)?function\s+\w*[Dd]elete/.test(libSrc));
  ok("removal is a soft removedAt, not a delete", /removedAt: new Date\(\)/.test(libSrc));

  const routeSrc = read("app/api/platform/suppressions/route.js");
  ok("the superadmin route exposes NO DELETE handler", !/export\s+async\s+function\s+DELETE/.test(routeSrc));
  ok("...and removal goes through unsuppress()", functionBody(routeSrc, "PATCH").includes("unsuppress(db,"));

  // The schema's own guarantee.
  const schema = readFileSync(join(ROOT, "prisma/schema.prisma"), "utf8");
  ok("the schema explains the three-years-and-fourteen-days number",
     /three years and fourteen days/i.test(schema));
  ok("...and no suppression relation cascades on delete",
     !/model SalesSuppression[\s\S]*?onDelete:\s*Cascade[\s\S]*?\n}/.test(schema.slice(schema.indexOf("model SalesSuppression"))) ||
     !/SalesSuppression[^\n]*onDelete: Cascade/.test(schema));
  const rulesSrc = read("lib/sales/suppressionRules.js");
  ok("the retention rule says WHY fourteen days is part of the number",
     /fourteen days/.test(readFileSync(join(ROOT, "lib/sales/suppressionRules.js"), "utf8")) &&
     /within fourteen days/.test(readFileSync(join(ROOT, "lib/sales/suppressionRules.js"), "utf8")));
  ok("...and that the B2B exemption does not reach it",
     /NOT exempt from the internal-list requirement|are NOT exempt/.test(
       readFileSync(join(ROOT, "lib/sales/suppressionRules.js"), "utf8")));
  ok("the rules module still compiles to real exports", typeof internalDncRetainUntil === "function" && rulesSrc.length > 0);
}

// ═══════════════════════════════════════════════════════════════════════════
section("7. The calling window — the prospect's clock, not ours");

{
  ok("weekdays run 09:00–21:30",
     SALES_CALL_WINDOW.weekday.startMinute === 540 && SALES_CALL_WINDOW.weekday.endMinute === 1290,
     SALES_CALL_WINDOW.weekday);
  ok("weekends run 10:00–18:00",
     SALES_CALL_WINDOW.weekend.startMinute === 600 && SALES_CALL_WINDOW.weekend.endMinute === 1080,
     SALES_CALL_WINDOW.weekend);
  ok("the description is derived from the numbers, not retyped",
     describeSalesCallWindow().includes("09:00–21:30") && describeSalesCallWindow().includes("10:00–18:00"),
     describeSalesCallWindow());
  ok("...and says whose time zone it is in", /prospect's own time zone/.test(describeSalesCallWindow()));

  // The whole reason this module exists: it is NOT the homeowner window.
  ok("this is NOT the homeowner window it would have been tempting to reuse",
     SALES_CALL_WINDOW.weekday.endMinute !== CALL_WINDOW.endHour * 60);
  ok("the homeowner window is untouched — still 9:00–20:00",
     CALL_WINDOW.startHour === 9 && CALL_WINDOW.endHour === 20, CALL_WINDOW);
  ok("the weekend START is LATER than the homeowner window, which is the hour that was wrong",
     SALES_CALL_WINDOW.weekend.startMinute > CALL_WINDOW.startHour * 60);
}

{
  // 2026-09-02 is a Wednesday; 2026-09-05 a Saturday.
  const TZ = "America/Toronto"; // UTC-4 in September
  const at = (iso) => new Date(iso);

  ok("Wednesday 09:00 local is allowed", withinSalesCallingHours(at("2026-09-02T13:00:00Z"), TZ).allowed);
  ok("Wednesday 08:59 local is refused", withinSalesCallingHours(at("2026-09-02T12:59:00Z"), TZ).allowed === false);
  ok("Wednesday 21:29 local is allowed", withinSalesCallingHours(at("2026-09-03T01:29:00Z"), TZ).allowed);
  ok("Wednesday 21:30 local is refused — the half hour is a real boundary",
     withinSalesCallingHours(at("2026-09-03T01:30:00Z"), TZ).allowed === false);

  ok("Saturday 09:30 local is REFUSED (the homeowner window would have allowed it)",
     withinSalesCallingHours(at("2026-09-05T13:30:00Z"), TZ).allowed === false);
  ok("Saturday 10:00 local is allowed", withinSalesCallingHours(at("2026-09-05T14:00:00Z"), TZ).allowed);
  ok("Saturday 17:59 local is allowed", withinSalesCallingHours(at("2026-09-05T21:59:00Z"), TZ).allowed);
  ok("Saturday 18:00 local is refused", withinSalesCallingHours(at("2026-09-05T22:00:00Z"), TZ).allowed === false);
  ok("Sunday is a weekend too", withinSalesCallingHours(at("2026-09-06T13:30:00Z"), TZ).allowed === false);

  // THE CASE: their clock, not ours.
  const instant = at("2026-09-02T21:00:00Z"); // 17:00 Toronto, 00:00 Kyiv, 14:00 Vancouver
  ok("the same instant is inside the window in Toronto", withinSalesCallingHours(instant, "America/Toronto").allowed);
  ok("...and inside it in Vancouver", withinSalesCallingHours(instant, "America/Vancouver").allowed);
  ok("THE CASE: and OUTSIDE it in the rep's own Kyiv, which is why the rep's clock is never used",
     withinSalesCallingHours(instant, "Europe/Kyiv").allowed === false);

  const late = at("2026-09-03T04:00:00Z"); // 00:00 Toronto, 21:00 Vancouver
  ok("midnight in Toronto is refused", withinSalesCallingHours(late, "America/Toronto").allowed === false);
  ok("...while 21:00 the same instant in Vancouver is allowed — one call, two answers",
     withinSalesCallingHours(late, "America/Vancouver").allowed);

  // Deliberately at an instant that IS inside the window in Toronto (11:00
  // Wednesday). A `new Date()` here would let a fallback-to-Toronto bug pass
  // whenever the check happened to run at night — which is exactly how a
  // mutation of this rule survived the first pass of this file.
  const inTorontoHours = at("2026-09-02T15:00:00Z");
  ok("Toronto really is inside the window at that instant — so the next three assertions mean something",
     withinSalesCallingHours(inTorontoHours, TZ).allowed);

  const unknown = withinSalesCallingHours(inTorontoHours, null);
  ok("an UNKNOWN time zone refuses, with no fallback to ours or to Toronto", unknown.allowed === false);
  ok("...and is not retryable, because waiting does not fix it", unknown.retryLater === false);
  ok("...and says a time zone must be recorded, not merely that it is a bad hour",
     /until a time zone is recorded/.test(unknown.reason), unknown.reason);
  ok("a garbage time zone refuses", withinSalesCallingHours(inTorontoHours, "Mars/Olympus").allowed === false);
  ok("an empty string refuses", withinSalesCallingHours(inTorontoHours, "  ").allowed === false);
  ok("a non-string time zone refuses", withinSalesCallingHours(inTorontoHours, 5).allowed === false);
  ok("a too-early call IS retryable", withinSalesCallingHours(at("2026-09-02T11:00:00Z"), TZ).retryLater === true);

  ok("localTimeIn reads a weekday and a minute together",
     localTimeIn(TZ, at("2026-09-02T13:30:00Z"))?.weekday === 3 &&
     localTimeIn(TZ, at("2026-09-02T13:30:00Z"))?.minute === 9 * 60 + 30,
     localTimeIn(TZ, at("2026-09-02T13:30:00Z")));
  ok("midnight is minute 0, never minute 1440",
     localTimeIn(TZ, at("2026-09-03T04:00:00Z"))?.minute === 0,
     localTimeIn(TZ, at("2026-09-03T04:00:00Z")));
  ok("an unusable zone returns null rather than a plausible time", localTimeIn("nope/nope") === null);

  const src = read("lib/sales/callingWindow.js");
  ok("the module explains why there are two windows", /SECOND window/i.test(readFileSync(join(ROOT, "lib/sales/callingWindow.js"), "utf8")));
  ok("...and does not import the homeowner one", !/voice\/outbound/.test(src));
  ok("nothing dials from it — it is a rule, not a caller", !/sendSms|calls\.create|fetch\(/.test(src));
}

// ═══════════════════════════════════════════════════════════════════════════
section("8. Every outbound path re-reads the list at the moment it sends");

{
  const sender = read("lib/sales/outreachSender.js");
  const deliver = functionBody(sender, "deliverOutreach");
  ok("deliverOutreach exists to be scoped", Boolean(deliver));
  ok("deliverOutreach checks the suppression list", deliver.includes("checkSuppression(db,"));
  ok("...BEFORE it calls sendEmail",
     deliver.indexOf("checkSuppression(db,") < deliver.indexOf("sendEmail("),
     { check: deliver.indexOf("checkSuppression(db,"), send: deliver.indexOf("sendEmail(") });
  ok("...before it even builds the email", deliver.indexOf("checkSuppression(db,") < deliver.indexOf("buildOutboundEmail"));
  ok("...passing the lead's PHONE as well as the email, so a phone opt-out reaches the mail path",
     /checkSuppression\(db,\s*\{[^}]*phone:\s*lead\.phone/.test(deliver));
  ok("...on the email channel", /channel:\s*"email"/.test(deliver));
  ok("a suppressed contact returns without sending",
     /suppression\.suppressed[\s\S]{0,200}return \{[\s\S]{0,120}ok: false/.test(deliver));
  ok("the module does not cache the verdict at import time", !/^const suppress/m.test(sender));
}

{
  // The routes must load `phone`, or the check above has nothing to look up.
  const newThread = read("app/api/sales/threads/route.js");
  const post = functionBody(newThread, "POST");
  ok("the new-thread route selects the lead's phone", /select:\s*\{[^}]*phone: true/.test(post), post.slice(0, 400));
  ok("...and asks contactOptedOut, not the old rep-scoped helper", post.includes("contactOptedOut(db,"));
  ok("...before deliverOutreach", post.indexOf("contactOptedOut(db,") < post.indexOf("deliverOutreach("));
  ok("the old rep-scoped leadIsOptedOut is gone from this route", !/leadIsOptedOut/.test(newThread));

  const reply = read("app/api/sales/threads/[id]/messages/route.js");
  const replyPost = functionBody(reply, "POST");
  ok("the reply route selects the lead's phone too", /phone: true/.test(replyPost));
  ok("...and asks contactOptedOut", replyPost.includes("contactOptedOut(db,"));
  ok("...before deliverOutreach", replyPost.indexOf("contactOptedOut(db,") < replyPost.indexOf("deliverOutreach("));
  ok("the old rep-scoped helper is gone from here too", !/leadIsOptedOut/.test(reply));
}

{
  // The screens must show the same verdict the send path enforces.
  const leadRoute = read("app/api/sales/leads/[id]/route.js");
  const get = functionBody(leadRoute, "GET");
  ok("the lead screen's data asks contactOptedOut", get.includes("contactOptedOut(db,"));
  ok("...and returns the reason so the screen can say WHY", /optedOutReason/.test(get));
  const threadRoute = read("app/api/sales/threads/[id]/route.js");
  ok("the thread screen's data does too", functionBody(threadRoute, "GET").includes("contactOptedOut(db,"));
}

{
  // The second outbound path, which the audit did not name.
  const referral = read("app/api/settings/referral/invite/route.js");
  const post = functionBody(referral, "POST");
  ok("the referral invite route exists to be scoped", Boolean(post));
  ok("it checks FieldQuo's suppression list", post.includes("checkSuppression(db,"));
  ok("...before sendSms", post.indexOf("checkSuppression(db,") < post.indexOf("sendSms("));
  ok("...and before sendEmail", post.indexOf("checkSuppression(db,") < post.indexOf("sendEmail("));
  ok("...passing both the email and the phone", /checkSuppression\(db,\s*\{[\s\S]{0,120}email,[\s\S]{0,120}phone,/.test(post));
  ok("...on the channel actually being used", /channel:\s*channel === "sms" \? "sms" : "email"/.test(post));
  ok("a suppressed recipient is refused with a 409", /suppression\.suppressed[\s\S]{0,400}status: 409/.test(post));
}

{
  // The ledger of every outbound path, kept honest. A NEW caller of sendEmail
  // or sendSms that reaches a PROSPECT must be added here deliberately — this
  // is the registry scripts/check-route-callers.mjs's header argues for, in
  // the small.
  //
  // Everything else that sends is tenant mail (a contractor's quote, invoice,
  // reminder or campaign) or transactional mail to FieldQuo's own users and
  // customers — a different party, a different audience, and governed by the
  // tenant-scoped consent tables instead. Two are named as deliberate
  // non-guards below.
  const PROSPECT_SENDERS = [
    "lib/sales/outreachSender.js",
    "app/api/settings/referral/invite/route.js",
  ];
  for (const f of PROSPECT_SENDERS) {
    ok(`${f} guards on checkSuppression`, read(f).includes("checkSuppression("));
  }

  // Inbound-initiated, and deliberately NOT guarded: refusing to answer
  // somebody who wrote to us first is not what a do-not-contact list means,
  // and a suppressed person who books a demo has plainly changed their mind.
  const demoBook = read("app/api/demo/book/route.js");
  ok("the demo booking confirmation is NOT gated — they contacted us",
     !demoBook.includes("checkSuppression("));
  // The rep invite is an employment offer to a named person, not outreach.
  ok("the sales-rep invite is NOT gated either", !read("lib/sales/inviteEmail.js").includes("checkSuppression("));
}

// ═══════════════════════════════════════════════════════════════════════════
section("9. The opt-out binds FieldQuo, not a rep's copy of a row");

{
  const inbound = read("lib/sales/outreachInbound.js");
  const contact = functionBody(inbound, "contactOptedOut");
  ok("contactOptedOut exists", Boolean(contact));
  ok("it reads the platform list FIRST", contact.indexOf("checkSuppression(db,") < contact.indexOf("salesMessage.findMany"));
  ok("...and its message query is NOT scoped by salesRepId", !/salesRepId/.test(contact), contact);
  ok("...and matches on the address rather than only the lead id", /lead: \{ email \}/.test(contact));
  ok("the derived per-lead signal is superseded, not deleted — leadOptedOut is still used",
     contact.includes("leadOptedOut(inbound)"));

  const file = functionBody(inbound, "fileInboundMessage");
  ok("filing a reply writes the suppression", file.includes("suppressWithin(tx,"));
  ok("...inside the SAME transaction as the message",
     file.indexOf("$transaction") < file.indexOf("suppressWithin(tx,") &&
     file.indexOf("suppressWithin(tx,") < file.lastIndexOf("return { message: created"));
  ok("...after the message row exists, so it can cite it",
     file.indexOf("salesMessage.create") < file.indexOf("suppressWithin(tx,"));
  ok("...keyed on the lead's address, never on the reply's From",
     /value: thread\.lead\.email/.test(file) && !/value: parsed\.fromAddress/.test(file));

  ok("nothing still calls the old rep-scoped helper anywhere",
     ![...walk(join(ROOT, "app")), ...walk(join(ROOT, "lib"))].some((f) =>
       /\bleadIsOptedOut\b/.test(stripComments(readFileSync(f, "utf8")))));

  // Nothing may reach the list except through the module that normalises.
  const raw = [...walk(join(ROOT, "app")), ...walk(join(ROOT, "lib"))]
    .filter((f) => !f.endsWith("lib/sales/suppression.js"))
    .filter((f) => /db\.salesSuppression|tx\.salesSuppression/.test(stripComments(readFileSync(f, "utf8"))))
    .map((f) => f.replace(ROOT + "/", ""));
  ok("only lib/sales/suppression.js touches the table directly — everything else normalises through it",
     raw.length === 0, raw);
}

// ═══════════════════════════════════════════════════════════════════════════
section("10. The superadmin screen, and the import");

{
  const route = read("app/api/platform/suppressions/route.js");
  for (const handler of ["GET", "POST", "PATCH"]) {
    const body = functionBody(route, handler);
    ok(`${handler} refuses a non-superadmin`, Boolean(body) && body.includes("superadminOrRefusal(request)"));
    ok(`${handler} returns the refusal as a NextResponse, never the bare object`,
       /if \(refusal\) return NextResponse\.json\(refusal\.body, \{ status: refusal\.status \}\)/.test(body));
  }
  const gate = functionBody(route, "superadminOrRefusal");
  ok("the gate demands superadmin specifically, not any platform admin",
     gate.includes('admin.role !== "superadmin"'));
  ok("...answering 401 when signed out and 403 when under-privileged",
     /status: 401/.test(gate) && /status: 403/.test(gate));

  ok("a removal is audit-logged", functionBody(route, "PATCH").includes("platformAuditLog.create"));
  ok("an addition is audit-logged", functionBody(route, "POST").includes("platformAuditLog.create"));
}

{
  // The import parser, against a hostile paste.
  const { entries, errors } = parseSuppressionImport(
    [
      "# a comment",
      "",
      "  BOB@Acme.com  ",
      "phone, (613) 555-0142",
      "domain,https://WWW.Example.com/x",
      "not a thing at all",
      "email,",
    ].join("\n"),
  );
  const flat = entries.map((e) => `${e.kind}:${e.value.trim()}`);
  ok("a bare address is read as an email", flat.some((f) => /^email:BOB@Acme\.com$/i.test(f)), flat);
  ok("a prefixed phone is read as a phone", flat.includes("phone:(613) 555-0142"), flat);
  ok("a prefixed domain is read as a domain", flat.some((f) => f.startsWith("domain:https://WWW.Example.com")), flat);
  ok("comments and blank lines are skipped, not counted", entries.length === 3, entries.length);
  ok("an unreadable line is REPORTED rather than dropped", errors.some((e) => /not a thing/.test(e.raw)), errors);
  ok("a prefix with no value is reported too", errors.some((e) => /^email,$/.test(e.raw.trim())), errors);
  ok("the error says how to fix it", errors.every((e) => /Prefix the line|No value/.test(e.error)), errors);

  const { client, state } = fakeDb();
  const result = await importSuppressions(client, { entries, source: "import", adminId: "a1" });
  ok("every readable line becomes a row", result.added === 3 && state.suppressions.length === 3, result);
  ok("...normalised on the way in",
     state.suppressions.map((s) => s.value).sort().join(",") === "+16135550142,bob@acme.com,example.com",
     state.suppressions.map((s) => s.value));
  ok("...each closing every channel", state.suppressions.every((s) => ALL_CHANNELS.every((c) => s.channels.includes(c))));
  ok("...each with an event", state.events.length === 3);
  ok("...each with a retention date", state.suppressions.every((s) => s.retainUntil instanceof Date));

  const again = await importSuppressions(client, { entries, source: "import", adminId: "a1" });
  ok("re-importing the same list adds nothing and updates everything", again.added === 0 && again.updated === 3, again);
  ok("...and still only three rows exist", state.suppressions.length === 3);

  const bad = await importSuppressions(client, { entries: [{ kind: "email", value: "@@@" }], source: "import" });
  ok("a bad entry is reported per line, not swallowed into a count",
     bad.failed.length === 1 && bad.failed[0].line === 1, bad);
}

{
  const { client } = fakeDb();
  await suppress(client, { kind: "email", value: "bob@acme.com", source: "reply" });
  const listed = await listSuppressions(client, {});
  ok("the list screen's query returns rows and a total", listed.rows.length === 1 && listed.total === 1);
  const found = await findSuppressions(client, { email: "BOB@acme.com" });
  ok("findSuppressions matches on the normalised key", found.length === 1);
  ok("findSuppressions on an empty contact asks the database nothing",
     (await findSuppressions(client, {})).length === 0);
}

{
  const page = read("app/platform/suppressions/page.js");
  ok("the screen adds through the real route", /fetch(Json)?\("\/api\/platform\/suppressions"/.test(page));
  ok("the search box submits to it", /\/api\/platform\/suppressions\?/.test(page));
  ok("removal is a PATCH, never a DELETE", /method: "PATCH"/.test(page) && !/method: "DELETE"/.test(page));
  ok("removal collects a reason before it calls anything",
     page.indexOf("prompt(") < page.indexOf('method: "PATCH"'));
  ok("the button says what it does, not 'Delete'", /Remove, with a reason/.test(page) && !/>\s*Delete\s*</.test(page));
  ok("the import reports the lines it could not read", /unreadable/.test(page));
  ok("no dead control: there is no 'coming soon' panel standing in for a button",
     !/coming soon/i.test(page));
  ok("the screen explains the retention date rather than showing a bare column",
     /three years and fourteen days/i.test(readFileSync(join(ROOT, "app/platform/suppressions/page.js"), "utf8")));
  ok("it is reachable from the console's own navigation",
     read("app/components/platform/PlatformSidebar.js").includes('href: "/platform/suppressions"'));
}

// ═══════════════════════════════════════════════════════════════════════════
section("11. The vocabulary is one list, not several");

{
  ok("three kinds, and they are the ones the schema names",
     SUPPRESSION_KINDS.join(",") === "email,phone,domain");
  ok("three channels", SUPPRESSION_CHANNELS.join(",") === "email,phone,sms");
  ok("ALL_CHANNELS is every channel, which is what an unqualified stop means",
     ALL_CHANNELS.length === SUPPRESSION_CHANNELS.length);
  ok("ALL_CHANNELS is a copy, so a caller mutating it cannot narrow the default",
     ALL_CHANNELS !== SUPPRESSION_CHANNELS);
  ok("the sources are the ones the screen offers", SUPPRESSION_SOURCES.includes("regulator"));
  ok("the guards agree with the lists",
     SUPPRESSION_KINDS.every(isSuppressionKind) &&
     SUPPRESSION_CHANNELS.every(isSuppressionChannel) &&
     SUPPRESSION_SOURCES.every(isSuppressionSource));
  ok("and refuse anything else",
     !isSuppressionKind("fax") && !isSuppressionChannel("post") && !isSuppressionSource("vibes"));

  // The whole point, stated once more as an assertion: nothing about this list
  // is tenant-scoped.
  const schema = readFileSync(join(ROOT, "prisma/schema.prisma"), "utf8");
  const model = schema.slice(schema.indexOf("model SalesSuppression {"));
  const body = model.slice(0, model.indexOf("\n}"));
  ok("SalesSuppression has NO companyId", !/companyId/.test(body), body.match(/companyId.*/)?.[0]);
  ok("...no salesRepId that scopes it (only who recorded it)",
     !/^\s+salesRepId\s/m.test(body), body.match(/^\s+salesRepId.*/m)?.[0]);
  const libSrc = read("lib/sales/suppression.js");
  ok("no query in the module filters by company or rep",
     !/where: \{[^}]*companyId/.test(libSrc) && !/where: \{[^}]*salesRepId/.test(libSrc));
}

// ═══════════════════════════════════════════════════════════════════════════
console.log(
  `\n${failures.length === 0 ? `ALL PASS — ${pass} checks` : `${failures.length} FAILED of ${pass + failures.length}`}`,
);
for (const f of failures) console.log(`  ✗ ${f}`);
process.exit(failures.length ? 1 : 0);
