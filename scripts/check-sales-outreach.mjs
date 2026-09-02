// scripts/check-sales-outreach.mjs
//
//   npm run check:sales-outreach
//
// A rep's outreach has two halves that fail in opposite directions, and this
// executes both against the ways each could look like it works and not:
//
//   OUTBOUND, which can send the wrong thing to a real stranger. A subject
//   carrying CRLF is a header injection; a body carrying markup is a script in
//   somebody's inbox; a missing mailing address is a CASL violation delivered
//   before anyone notices.
//
//   INBOUND, which can silently lose a reply. An unset secret that compares
//   against "Bearer undefined"; a token that arrives upper-cased and matches
//   nothing; a forwarded copy of our OWN message filed as the prospect's; a
//   reply quoting our footer's "unsubscribe" and marking itself an opt-out.
//
// Almost all of it is EXECUTION, not reading. lib/sales/outreach.js is pure by
// design and lib/sales/outreachInbound.js takes its database client as an
// argument (lib/marketing/unsubscribe.js's shape, for this reason), so the real
// shipped functions run here against a fake client with no loader hooks.
//
// The parts that cannot be executed — "is the guard in this route" — are
// matched against source with comments stripped, and every positional rule is
// scoped to ONE named function pulled out by brace-matching. A guard string
// appearing elsewhere in the same file must not manufacture a pass; that
// happened earlier today in another check, and section 8 exists in this shape
// because of it.

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

import {
  LEAD_STATUSES,
  bareAddress,
  buildOutboundEmail,
  caslFooterLines,
  detectOptOut,
  emailDomain,
  extractReplyToken,
  htmlToText,
  isLeadStatus,
  isPlausibleEmail,
  isReplyToken,
  leadListWhere,
  leadOptedOut,
  leadWhere,
  newReplyToken,
  parseInboundEmail,
  parseSentAt,
  replyToAddress,
  sanitiseBodyText,
  sanitiseHeaderText,
  statusAfterSend,
  threadListWhere,
  threadWhere,
  verifyInboundSecret,
  visibleReplyText,
} from "@/lib/sales/outreach";
import { contactOptedOut, fileInboundMessage } from "@/lib/sales/outreachInbound";
import { outreachReadiness } from "@/lib/sales/outreachReadiness";
import { REP_OUTREACH_WRITES } from "@/lib/sales/outreachGate";
import { contrastRatio } from "@/lib/brand/colour";

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

/**
 * Strip comments before any regex touches source.
 *
 * Every rule below is about what the code DOES. A guard named in a comment is
 * not a guard, and a warning written in prose must not create a false failure
 * either.
 */
function stripComments(src) {
  return src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
}

function read(relative) {
  return stripComments(readFileSync(join(ROOT, relative), "utf8"));
}

/**
 * The body of ONE named function, by brace matching.
 *
 * This is the part that matters. "Does the send route check the opt-out" is a
 * question about a specific handler, and a file-wide `includes()` answers it
 * "yes" as soon as ANY function in the file mentions it — which is how a check
 * certifies a hole. Earlier today a guard string present in a neighbouring
 * function in the same file produced exactly that false pass.
 */
function functionBody(src, name) {
  const start = src.search(
    new RegExp(`(export\\s+)?(async\\s+)?function\\s+${name}\\s*\\(`),
  );
  if (start === -1) return null;

  // Walk the PARAMETER list to its closing paren first. Taking the next `{`
  // after the name lands on the destructuring brace of `POST(request, {
  // params })` and brace-matches a two-word "body" of `{ params }` — every
  // assertion against which passes or fails for reasons that have nothing to
  // do with the handler. Found by this check failing on exactly the routes
  // that destructure, and passing on the ones that do not.
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

// ── A fake Prisma client ───────────────────────────────────────────────────
//
// Small on purpose: it answers the four queries lib/sales/outreachInbound.js
// makes and records every write, so an assertion is about an ARGUMENT rather
// than about a line of source. Unscripted access throws by name, the same rule
// scripts/fixtures/dbStub.mjs states — a check must never pass because a query
// silently answered "nothing".
function fakeDb({ threads = [], messages = [], leads = [] } = {}) {
  const state = {
    threads: [...threads],
    messages: [...messages],
    leads: [...leads],
    // FieldQuo's own do-not-contact list. Scripted here because filing an
    // inbound "unsubscribe" now writes to it in the SAME transaction as the
    // message — see lib/sales/outreachInbound.js. Before that change an
    // opt-out reached only this rep's copy of the prospect, which is the bug
    // scripts/check-sales-suppression.mjs was written around.
    suppressions: [],
    events: [],
    writes: [],
  };
  const client = {
    salesSuppression: {
      findUnique: async ({ where }) =>
        state.suppressions.find(
          (r) => r.kind === where.kind_value.kind && r.value === where.kind_value.value,
        ) || null,
      findMany: async ({ where = {} }) =>
        where.OR
          ? state.suppressions.filter((r) => where.OR.some((c) => r.kind === c.kind && r.value === c.value))
          : [...state.suppressions],
      upsert: async ({ where, create, update }) => {
        const found = state.suppressions.find(
          (r) => r.kind === where.kind_value.kind && r.value === where.kind_value.value,
        );
        state.writes.push({ model: "salesSuppression", action: "upsert", where, data: found ? update : create });
        if (found) {
          Object.assign(found, update);
          return found;
        }
        const row = { id: `sup_${state.suppressions.length + 1}`, ...create };
        state.suppressions.push(row);
        return row;
      },
    },
    salesSuppressionEvent: {
      create: async ({ data }) => {
        state.writes.push({ model: "salesSuppressionEvent", action: "create", data });
        const row = { id: `ev_${state.events.length + 1}`, ...data };
        state.events.push(row);
        return row;
      },
    },
    salesThread: {
      findUnique: async ({ where }) =>
        state.threads.find((t) => t.replyToken === where.replyToken) || null,
      updateMany: async ({ where, data }) => {
        state.writes.push({ model: "salesThread", action: "updateMany", where, data });
        const hits = state.threads.filter(
          (t) =>
            t.id === where.id &&
            (!where.lastMessageAt?.lt || t.lastMessageAt < where.lastMessageAt.lt),
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
            if (where.thread.leadId !== undefined && t.leadId !== where.thread.leadId) return false;
            if (where.thread.salesRepId !== undefined && t.salesRepId !== where.thread.salesRepId) {
              return false;
            }
            if (where.thread.lead?.email !== undefined) {
              const lead = state.leads.find((l) => l.id === t.leadId);
              if (!lead || lead.email !== where.thread.lead.email) return false;
            }
          }
          return true;
        }),
      create: async ({ data }) => {
        state.writes.push({ model: "salesMessage", action: "create", data });
        const row = { id: `msg_${state.messages.length + 1}`, ...data };
        state.messages.push(row);
        return row;
      },
    },
    $transaction: async (fn) => fn(client),
    // Every write, in order, so an assertion can be about the DATA a row was
    // created with rather than about the fact that a call happened.
    __state: state,
  };
  return new Proxy(client, {
    get(target, prop) {
      if (prop in target) return target[prop];
      throw new Error(`fakeDb: db.${String(prop)} is not scripted`);
    },
  });
}

// ═══════════════════════════════════════════════════════════════════════════
section("1. Reply tokens — the only thing that files an inbound message");

const token = newReplyToken();
ok("a minted token validates", isReplyToken(token), token);
ok("tokens are unique across 500 mints", new Set(Array.from({ length: 500 }, newReplyToken)).size === 500);
ok("a token is lowercase hex behind a fixed prefix", /^fqs[0-9a-f]{32}$/.test(token), token);
ok("garbage is not a token", !isReplyToken("fqs") && !isReplyToken(null) && !isReplyToken(`${token}x`));

ok(
  "found in a plus-addressed To:",
  extractReplyToken({ to: `Emilio <emilio+${token}@fieldquo.com>` }) === token,
);
ok(
  "found when the provider UPPER-CASED the local part",
  extractReplyToken({ to: `EMILIO+${token.toUpperCase()}@FIELDQUO.COM` }) === token,
);
ok(
  "found in the quoted Ref: line of a reply",
  extractReplyToken({ body: `Sounds good.\n\n> Ref: ${token}\n> Emilio` }) === token,
);
ok("found in References:", extractReplyToken({ references: `<x@y> <${token}@fieldquo.com>` }) === token);
ok("an explicit replyToken wins", extractReplyToken({ explicit: token, to: `x+${newReplyToken()}@a.com` }) === token);
ok("nothing carrying one returns null", extractReplyToken({ to: "emilio@fieldquo.com", body: "hi" }) === null);
ok("an unknown token is still returned for the caller to reject", extractReplyToken({ to: `a+fqs${"0".repeat(32)}@b.com` }) === `fqs${"0".repeat(32)}`);

// THE rule. A sender address is not a routing key — see the crew inbound
// route's comment, which this feature inherits verbatim.
ok(
  "a token in the SENDER's address is ignored entirely",
  extractReplyToken({ from: `attacker+${token}@evil.com` }) === null,
);
{
  const src = read("lib/sales/outreach.js");
  const body = functionBody(src, "extractReplyToken");
  ok("extractReplyToken takes no `from` parameter", body !== null && !/\bfrom\b\s*,/.test(src.slice(src.indexOf("export function extractReplyToken"), src.indexOf("export function extractReplyToken") + 300)));
  ok("...and never reads one", body !== null && !/\bfrom\b/.test(body), body?.slice(0, 120));
}

// ═══════════════════════════════════════════════════════════════════════════
section("2. Reply addressing — no default, because guessing loses mail");

ok("plus mode sub-addresses", replyToAddress("emilio@fieldquo.com", token, "plus") === `emilio+${token}@fieldquo.com`);
ok("plain mode is the rep's own address", replyToAddress("emilio@fieldquo.com", token, "plain") === "emilio@fieldquo.com");
ok("an unset mode produces NO address", replyToAddress("emilio@fieldquo.com", token, undefined) === null);
ok("an invented mode produces no address", replyToAddress("emilio@fieldquo.com", token, "smart") === null);
ok("a bad token produces no address", replyToAddress("emilio@fieldquo.com", "fqs-nope", "plus") === null);
ok("an address that already has a + is refused in plus mode", replyToAddress("a+b@fieldquo.com", token, "plus") === null);
ok("...but works in plain mode", replyToAddress("a+b@fieldquo.com", token, "plain") === "a+b@fieldquo.com");
ok("a non-address produces no address", replyToAddress("not-an-email", token, "plain") === null);

ok("emailDomain lowercases", emailDomain("Emilio@FieldQuo.com") === "fieldquo.com");
ok("emailDomain refuses nonsense", emailDomain("a@b") === null && emailDomain("") === null);
ok("isPlausibleEmail refuses a CRLF injection", !isPlausibleEmail("a@b.com\r\nBcc: evil@x.com"));
ok("isPlausibleEmail refuses angle brackets and commas", !isPlausibleEmail("<a@b.com>") && !isPlausibleEmail("a@b.com,c@d.com"));
ok("isPlausibleEmail accepts a real one", isPlausibleEmail("emilio@fieldquo.com"));
ok("bareAddress unwraps a display name", bareAddress("Ada L <Ada@Acme.com>") === "ada@acme.com");

// ═══════════════════════════════════════════════════════════════════════════
section("3. What goes out — sanitised, escaped, and legally complete");

ok("CRLF is stripped out of a subject", !/[\r\n]/.test(sanitiseHeaderText("Re: hi\r\nBcc: evil@x.com")));
ok("...and the injected header is inert text", sanitiseHeaderText("Re: hi\r\nBcc: evil@x.com") === "Re: hi Bcc: evil@x.com");
ok("NUL and control bytes are stripped", sanitiseHeaderText("a b") === "a b");
ok("a subject is length-capped", sanitiseHeaderText("x".repeat(5000), 200).length === 200);
ok("a body keeps newlines and tabs", sanitiseBodyText("a\n\tb") === "a\n\tb");
ok("a body drops other control bytes", sanitiseBodyText("a b") === "ab");
ok("a body is length-capped", sanitiseBodyText("x".repeat(200_000)).length === 100_000);
ok("htmlToText drops script content entirely", !htmlToText("<p>hi</p><script>alert(1)</script>").includes("alert"));
ok("htmlToText keeps the words", htmlToText("<p>hi</p><div>there</div>").replace(/\s+/g, " ").trim() === "hi there");

const rep = { name: "Emilio Boves", email: "emilio@fieldquo.com" };
const ADDRESS = "FieldQuo, 123 Rue Principale, Gatineau QC";

{
  const built = buildOutboundEmail({
    rep,
    subject: "Quick question <b>about quotes</b>",
    body: "Hi there <script>alert('xss')</script>\n\nSecond paragraph & more.",
    replyToken: token,
    mailingAddress: ADDRESS,
  });

  ok("the body's markup is escaped, not rendered", built.html.includes("&lt;script&gt;") && !built.html.includes("<script>"));
  ok("an ampersand in the body is escaped", built.html.includes("&amp;"));
  ok("paragraphs survive as paragraphs", (built.html.match(/<p style/g) || []).length === 2);
  ok("the CASL mailing address is in the html", built.html.includes("Gatineau QC"));
  ok("...and in the plain-text alternative", built.text.includes("Gatineau QC"));
  ok("an unsubscribe mechanism is in both parts", /unsubscribe/i.test(built.html) && /unsubscribe/i.test(built.text));
  ok("the sender is identified by name and address", built.text.includes("Emilio Boves") && built.text.includes("emilio@fieldquo.com"));
  ok("the Ref: line carries the token (the plain-mode carrier)", built.text.includes(`Ref: ${token}`) && built.html.includes(token));
  ok("a reply quoting that footer re-finds the thread", extractReplyToken({ body: `> ${built.text}` }) === token);
}

// The gap that must BLOCK rather than be papered over — lib/legal/
// privacyOfficer.js's precedent, applied where the placeholder would already
// have been delivered to a stranger.
for (const missing of ["", "   ", null, undefined]) {
  let threw = false;
  try {
    buildOutboundEmail({ rep, subject: "Hi", body: "Hello", replyToken: token, mailingAddress: missing });
  } catch (err) {
    threw = /mailing address/i.test(err.message);
  }
  ok(`no mailing address (${JSON.stringify(missing)}) refuses to build an email`, threw);
}
for (const [label, args] of [
  ["no subject", { rep, subject: "   ", body: "x", replyToken: token, mailingAddress: ADDRESS }],
  ["no body", { rep, subject: "x", body: "  \n ", replyToken: token, mailingAddress: ADDRESS }],
  ["a forged token", { rep, subject: "x", body: "y", replyToken: "fqs-forged", mailingAddress: ADDRESS }],
  ["no rep", { rep: {}, subject: "x", body: "y", replyToken: token, mailingAddress: ADDRESS }],
]) {
  let threw = false;
  try {
    buildOutboundEmail(args);
  } catch {
    threw = true;
  }
  ok(`${label} refuses to build an email`, threw);
}

ok(
  "the footer's grey meets 4.5:1 on white",
  contrastRatio("#6b7280", "#ffffff") >= 4.5,
  contrastRatio("#6b7280", "#ffffff"),
);
ok("the footer is four lines: who, where, how to stop, and the ref", caslFooterLines({ rep, mailingAddress: ADDRESS, replyToken: token }).length === 4);

// ═══════════════════════════════════════════════════════════════════════════
section("4. Reading an opt-out — the half that could destroy a pipeline");

// Our own footer, quoted back. If this read as an opt-out, EVERY reply would
// switch its own lead off.
const quotedFooter = `Yes please, send it over.\n\nOn Mon, 1 Sep 2026 at 09:00, Emilio wrote:\n> Don't want to hear from me again? Reply with "unsubscribe" and I'll stop.\n> Ref: ${token}`;
ok("a normal reply quoting our unsubscribe line is NOT an opt-out", !detectOptOut(quotedFooter));
ok("...and the quoted part is dropped before reading", !visibleReplyText(quotedFooter).includes("unsubscribe"));

// The case that makes the stripping load-bearing rather than belt-and-braces,
// and it is an ordinary one: an html reply flattened to text loses the ">"
// markers a plain-text client would have added (a blockquote is just
// paragraphs once the tags are gone), so the "On … wrote:" break is the ONLY
// thing separating what the prospect typed from what is quoted below it. Below
// it here is somebody ELSE's marketing footer, whose link text is the bare word
// on a line of its own — which lands inside the first three lines and would be
// read as this prospect opting out of a conversation they were happy with.
const quotedOtherVendor = htmlToText(
  "<p>Yes, let's talk Thursday.</p><blockquote><p>On Mon, Acme Supplies wrote:</p>" +
    "<p>Unsubscribe</p><p>Manage preferences</p></blockquote>",
);
ok("a bare 'Unsubscribe' in QUOTED text below the reply is not an opt-out", !detectOptOut(quotedOtherVendor));

for (const yes of [
  "unsubscribe",
  "Unsubscribe.",
  "UNSUBSCRIBE",
  "please unsubscribe",
  "Remove me",
  "take me off your list",
  "stop emailing me",
  "opt me out",
  "Do not contact me",
  "don't email me again",
  "unsubscribe\n\nSent from my iPhone",
]) {
  ok(`"${yes.split("\n")[0]}" is an opt-out`, detectOptOut(yes));
}
for (const no of [
  "please stop by at 3",
  "Can you stop sending it as a PDF and use a link?",
  "I unsubscribed from your competitor last week, they were relentless",
  "Sounds good, let's talk Thursday",
  "",
  null,
  "We use a tool that has an unsubscribe link, does yours?",
]) {
  ok(`${JSON.stringify(no)} is NOT an opt-out`, !detectOptOut(no));
}

ok("leadOptedOut ignores outbound messages", !leadOptedOut([{ direction: "out", body: "unsubscribe" }]));
ok("leadOptedOut reads inbound ones", leadOptedOut([{ direction: "out", body: "hi" }, { direction: "in", body: "unsubscribe" }]));
ok("leadOptedOut on nothing is false", !leadOptedOut([]) && !leadOptedOut());

// ═══════════════════════════════════════════════════════════════════════════
section("5. The inbound secret — cronAuth's rule, mirrored");

const SECRET = "s3cret-value";
ok("the right header is accepted", verifyInboundSecret(`Bearer ${SECRET}`, SECRET).ok);
ok("no header is refused", !verifyInboundSecret(null, SECRET).ok);
ok("an empty header is refused", !verifyInboundSecret("", SECRET).ok);
ok("a wrong secret is refused", !verifyInboundSecret("Bearer wrong-value", SECRET).ok);
ok("the bare secret without Bearer is refused", !verifyInboundSecret(SECRET, SECRET).ok);
ok("a prefix of the secret is refused", !verifyInboundSecret(`Bearer ${SECRET.slice(0, -1)}`, SECRET).ok);
ok("the secret plus a byte is refused", !verifyInboundSecret(`Bearer ${SECRET}x`, SECRET).ok);
ok("case matters", !verifyInboundSecret(`bearer ${SECRET}`, SECRET).ok);

// The bug cronAuth.js was written for, checked from both sides.
for (const unset of [undefined, null, "", 0, false]) {
  const v = verifyInboundSecret(`Bearer ${unset}`, unset);
  ok(`an unset secret (${JSON.stringify(unset)}) DENIES rather than matching "Bearer ${unset}"`, !v.ok && v.reason === "unconfigured");
}
ok("an unset secret denies a correct-looking header too", !verifyInboundSecret("Bearer anything", undefined).ok);

{
  // The route must ask the same question, of the env var, before anything else.
  const src = read("app/api/webhooks/inbound-sales-email/route.js");
  const post = functionBody(src, "POST");
  ok("the inbound route has a POST handler", post !== null);
  ok("POST calls verifyInboundSecret", /verifyInboundSecret\s*\(/.test(post || ""));
  ok("...against process.env.SALES_INBOUND_SECRET", /process\.env\.SALES_INBOUND_SECRET/.test(post || ""));
  ok("...and 401s before touching the body", (post || "").indexOf("status: 401") < (post || "").indexOf("request.text()"));
  ok("the sender is never used to look anything up in the route", !/where[\s\S]{0,80}fromAddress/.test(post || ""));
}

// ═══════════════════════════════════════════════════════════════════════════
section("6. Parsing and filing an inbound message");

{
  const parsed = parseInboundEmail({
    from: "Prospect <someone.else@acme.com>",
    to: `emilio+${token}@fieldquo.com`,
    subject: "Re: hi\r\nBcc: evil@example.com",
    html: "<p>Yes please</p><script>alert(1)</script>",
    "message-id": "<abc@acme.com>",
    date: "2026-08-30T10:00:00Z",
  });
  ok("the token comes off the To: header", parsed.token === token);
  ok("a CRLF subject is neutralised on the way in", !/[\r\n]/.test(parsed.subject));
  ok("an html-only body becomes text", parsed.body.trim() === "Yes please");
  ok("...with the script gone", !parsed.body.includes("alert"));
  ok("the provider's message id is kept", parsed.providerId === "<abc@acme.com>");
  ok("the provider's date is kept", parsed.sentAt instanceof Date);
}
ok("alternative field names are read", parseInboundEmail({ sender: "a@b.com", "body-plain": "hi", recipient: `x+${token}@y.com` }).token === token);
ok("an empty payload parses to no token", parseInboundEmail({}).token === null);
ok("a non-object payload does not throw", parseInboundEmail("nonsense").token === null);
ok("a future date is refused", parseSentAt("2099-01-01T00:00:00Z") === null);
ok("an unparseable date is refused", parseSentAt("last tuesday") === null);
ok("a 1970 epoch is refused", parseSentAt("1970-01-01T00:00:00Z") === null);
ok("a real date survives", parseSentAt("2026-08-30T10:00:00Z")?.getFullYear() === 2026);

const THREAD = {
  id: "thread_1",
  leadId: "lead_1",
  salesRepId: "rep_1",
  subject: "Quick question",
  replyToken: token,
  lastMessageAt: new Date("2026-08-30T09:00:00Z"),
  salesRep: { email: "emilio@fieldquo.com" },
  // The address FieldQuo actually wrote to. An opt-out is keyed on this and
  // never on the reply's forgeable From — see fileInboundMessage.
  lead: { id: "lead_1", email: "prospect@acme.com", phone: null },
};

{
  const db = fakeDb({ threads: [{ ...THREAD }] });
  const result = await fileInboundMessage(db, parseInboundEmail({}));
  ok("a message with no token is refused, with a reason", !result.filed && result.reason === "no_token", result);
}
{
  const db = fakeDb({ threads: [{ ...THREAD }] });
  const result = await fileInboundMessage(
    db,
    parseInboundEmail({ from: "a@b.com", to: `x+fqs${"9".repeat(32)}@y.com`, text: "hi" }),
  );
  ok("an UNKNOWN token files nothing", !result.filed && result.reason === "unknown_token", result);
}
{
  // The headline case: a prospect replies from a completely different address.
  const db = fakeDb({ threads: [{ ...THREAD }] });
  const result = await fileInboundMessage(
    db,
    parseInboundEmail({
      from: "assistant@totally-different.com",
      to: `emilio+${token}@fieldquo.com`,
      text: "Yes, Thursday works",
      "message-id": "<m1>",
    }),
  );
  ok("a reply from a DIFFERENT sender still files, by token", result.filed && result.threadId === "thread_1", result);
  const written = db.__state.writes.find((w) => w.model === "salesMessage")?.data;
  ok("...stored with direction 'in'", written?.direction === "in", written);
  ok("...keeping the sender that actually wrote", written?.fromAddress === "assistant@totally-different.com", written?.fromAddress);
  ok("...and the provider's own id", written?.providerId === "<m1>", written?.providerId);
}
{
  // Our own sent copy coming back through a forward-everything rule.
  const db = fakeDb({ threads: [{ ...THREAD }] });
  const result = await fileInboundMessage(
    db,
    parseInboundEmail({ from: "Emilio <EMILIO@fieldquo.com>", to: "prospect@acme.com", text: `Ref: ${token}`, "message-id": "<m2>" }),
  );
  ok("our own outbound copy is discarded, not filed as a reply", !result.filed && result.reason === "own_outbound", result);
}
{
  const db = fakeDb({
    threads: [{ ...THREAD }],
    messages: [{ id: "msg_0", threadId: "thread_1", direction: "in", providerId: "<dup>" }],
  });
  const result = await fileInboundMessage(db, parseInboundEmail({ from: "a@b.com", to: `x+${token}@y.com`, text: "hi", "message-id": "<dup>" }));
  ok("the same provider message id is not filed twice", !result.filed && result.reason === "duplicate", result);
}
{
  const thread = { ...THREAD };
  const db = fakeDb({ threads: [thread] });
  await fileInboundMessage(db, parseInboundEmail({ from: "a@b.com", to: `x+${token}@y.com`, text: "later", date: "2026-08-31T10:00:00Z", "message-id": "<m3>" }));
  const forward = thread.lastMessageAt.toISOString();
  await fileInboundMessage(db, parseInboundEmail({ from: "a@b.com", to: `x+${token}@y.com`, text: "older replay", date: "2026-08-29T10:00:00Z", "message-id": "<m4>" }));
  ok("lastMessageAt moves forward on a newer message", forward === "2026-08-31T10:00:00.000Z", forward);
  ok("...and a replayed older one cannot drag it back", thread.lastMessageAt.toISOString() === forward, thread.lastMessageAt);
}
{
  const db = fakeDb({ threads: [{ ...THREAD }] });
  const result = await fileInboundMessage(db, parseInboundEmail({ from: "a@b.com", to: `x+${token}@y.com`, text: "unsubscribe", "message-id": "<m5>" }));
  ok("an opt-out reply files AND is reported as one", result.filed && result.optOut === true, result);
  ok("...and is written to FieldQuo's own do-not-contact list", result.suppressed === true, result);
  ok("the sending rep is refused", (await contactOptedOut(db, { leadId: "lead_1", email: "prospect@acme.com" })).optedOut);

  // ══ This assertion used to say the OPPOSITE, and the opposite was a bug ══
  //
  // It read: "…and says nothing about another rep's lead", asserting that
  // leadIsOptedOut(db, "rep_2", "lead_1") returned false — i.e. that an
  // opt-out silenced only the rep who received it. SalesLead has no unique
  // constraint on email, so two reps genuinely can hold the same prospect,
  // and that behaviour meant one of them kept emailing somebody who had
  // asked FieldQuo to stop. The compliance audit named it
  // (docs/sales-intel/AUDIT-compliance.md §5); an opt-out binds FieldQuo,
  // not a rep's copy of a row. The check now asserts the fix.
  const otherRep = await contactOptedOut(db, { leadId: "lead_99", email: "prospect@acme.com" });
  ok("A SECOND rep holding the same prospect is refused too", otherRep.optedOut, otherRep);
  ok("...via the platform list, not via that rep's own messages", otherRep.via === "suppression", otherRep);

  const stranger = await contactOptedOut(db, { leadId: "lead_2", email: "someone.else@acme.com" });
  ok("a different person at the same company is NOT swept up", stranger.optedOut === false);
}

// ═══════════════════════════════════════════════════════════════════════════
section("7. Scoping — a rep's book is the boundary, not a filter");

for (const bad of ["", null, undefined, 0, {}, [], { salesRepId: "rep_1" }]) {
  const where = leadWhere(bad, "lead_1");
  ok(`leadWhere with a ${JSON.stringify(bad)} rep id collapses to __none__`, where.salesRepId === "__none__", where);
  ok(`threadWhere with a ${JSON.stringify(bad)} rep id collapses to __none__`, threadWhere(bad, "t").salesRepId === "__none__");
  ok(`leadListWhere with a ${JSON.stringify(bad)} rep id collapses to __none__`, leadListWhere(bad).salesRepId === "__none__");
  ok(`threadListWhere with a ${JSON.stringify(bad)} rep id collapses to __none__`, threadListWhere(bad).salesRepId === "__none__");
}
ok("a missing lead id also collapses rather than widening", leadWhere("rep_1", undefined).id === "__none__");
ok("no scoping fragment is ever empty", Object.keys(leadListWhere("rep_1")).length > 0 && Object.keys(threadListWhere("rep_1")).length > 0);
ok("a valid status narrows the list", leadListWhere("rep_1", "demoed").status === "demoed");
ok("an invented status is ignored rather than passed to Prisma", leadListWhere("rep_1", "hacked").status === undefined);
ok("every pipeline status is accepted", LEAD_STATUSES.every(isLeadStatus) && !isLeadStatus("won"));
ok("a send moves 'new' to 'contacted'", statusAfterSend("new") === "contacted");
ok("...and moves nothing else backwards", ["contacted", "demoed", "signed", "lost"].every((s) => statusAfterSend(s) === s));

// ═══════════════════════════════════════════════════════════════════════════
section("8. The routes — every handler scoped, gated, and re-checked");

const ROUTES = [
  ["app/api/sales/leads/route.js", "GET", ["requireOutreachRep", "leadListWhere(rep.id"]],
  ["app/api/sales/leads/route.js", "POST", ["requireOutreachRep", "salesRepId: rep.id"]],
  ["app/api/sales/leads/[id]/route.js", "GET", ["requireOutreachRep", "leadWhere(rep.id"]],
  ["app/api/sales/leads/[id]/route.js", "PATCH", ["requireOutreachRep", "leadWhere(rep.id"]],
  ["app/api/sales/leads/[id]/link/route.js", "GET", ["requireOutreachRep", "leadWhere(rep.id", "candidates(rep.id)"]],
  ["app/api/sales/leads/[id]/link/route.js", "POST", ["requireOutreachRep", "leadWhere(rep.id", "assignedCompanyWhere(rep.id"]],
  ["app/api/sales/threads/route.js", "GET", ["requireOutreachRep", "threadListWhere(rep.id"]],
  ["app/api/sales/threads/route.js", "POST", ["requireOutreachRep", "leadWhere(rep.id", "contactOptedOut(db,"]],
  ["app/api/sales/threads/[id]/route.js", "GET", ["requireOutreachRep", "threadWhere(rep.id"]],
  ["app/api/sales/threads/[id]/messages/route.js", "POST", ["requireOutreachRep", "threadWhere(rep.id", "contactOptedOut(db,"]],
];

for (const [file, method, required] of ROUTES) {
  const body = functionBody(read(file), method);
  ok(`${file} exports ${method}`, body !== null);
  for (const needle of required) {
    // Scoped to the ONE handler, so a helper used by a sibling handler in the
    // same file cannot manufacture a pass here.
    ok(`  ${method} ${file.replace("app/api/sales/", "")} uses ${needle}`, (body || "").includes(needle));
  }
  ok(`  ${method} ${file.replace("app/api/sales/", "")} refuses before it reads`, (body || "").includes("refusal"));
}

{
  // A rep may never name their own salesRepId. The create must take it from the
  // gate's fresh read of the session.
  const post = functionBody(read("app/api/sales/leads/route.js"), "POST");
  ok("lead creation never reads a salesRepId from the request body", !/body\.salesRepId/.test(post || ""));
}

{
  // Only the three outreach tables are writable through /api/sales. The list is
  // lib/sales/outreachGate.js's, so widening it means editing the file that
  // states the rule rather than a route nobody re-reads.
  const files = [
    "app/api/sales/leads/route.js",
    "app/api/sales/leads/[id]/route.js",
    "app/api/sales/leads/[id]/link/route.js",
    "app/api/sales/threads/route.js",
    "app/api/sales/threads/[id]/route.js",
    "app/api/sales/threads/[id]/messages/route.js",
    "lib/sales/outreachSender.js",
    "lib/sales/outreachInbound.js",
  ];
  const offenders = [];
  for (const file of files) {
    for (const m of read(file).matchAll(/\b(?:db|tx)\.([a-zA-Z]+)\.(create|update|updateMany|upsert|delete|deleteMany|createMany)\b/g)) {
      if (!REP_OUTREACH_WRITES.includes(m[1])) offenders.push(`${file}: ${m[1]}.${m[2]}`);
    }
  }
  ok("outreach writes only to SalesLead / SalesThread / SalesMessage", offenders.length === 0, offenders);
  ok("nothing in the outreach paths deletes a message or a thread", !files.some((f) => /\b(?:db|tx)\.sales(Message|Thread|Lead)\.delete/.test(read(f))));
}

{
  const link = read("app/api/sales/leads/[id]/link/route.js");
  ok("the link route never writes an attribution", !/salesAttribution\.(create|update|upsert)/.test(link));
  // The candidate list GET offers and the company POST accepts must come from
  // the SAME predicate, or the screen can offer a company the write refuses.
  ok(
    "the candidate list is built from assignedCompanyWhere",
    (functionBody(link, "candidates") || "").includes("assignedCompanyWhere(repId)"),
  );
  const post = functionBody(link, "POST");
  ok("linking re-reads the company under the rep's scope at write time", /db\.company\.findFirst[\s\S]{0,200}assignedCompanyWhere\(rep\.id\)/.test(post || ""));
  ok("linking is a compare-and-set on convertedCompanyId", /convertedCompanyId: null/.test(post || ""));
  ok("a P2002 is answered, not thrown at the rep", /P2002/.test(post || ""));
}

// ═══════════════════════════════════════════════════════════════════════════
section("9. Readiness — the compose box exists only when sending works");

const READY = {
  repEmail: "emilio@fieldquo.com",
  senderDomainVerified: true,
  replyAddressing: "plain",
  mailingAddress: ADDRESS,
  inboundSecretSet: true,
};
ok("fully configured: can send, nothing to say", outreachReadiness(READY).canSend && outreachReadiness(READY).warnings.length === 0);

const blocked = [
  ["an unverified sender domain", { ...READY, senderDomainVerified: false }, "sender_domain_unverified"],
  ["an unset reply mode", { ...READY, replyAddressing: undefined }, "reply_addressing_unset"],
  ["an invented reply mode", { ...READY, replyAddressing: "clever" }, "reply_addressing_unset"],
  ["no mailing address", { ...READY, mailingAddress: "" }, "mailing_address_unset"],
  ["a whitespace mailing address", { ...READY, mailingAddress: "   " }, "mailing_address_unset"],
  ["a rep with no email", { ...READY, repEmail: "" }, "rep_email_invalid"],
  ["a rep with an injected email", { ...READY, repEmail: "a@b.com\r\nBcc: x@y.com" }, "rep_email_invalid"],
];
for (const [label, input, code] of blocked) {
  const verdict = outreachReadiness(input);
  ok(`${label} BLOCKS sending`, !verdict.canSend, verdict.blockers.map((b) => b.code));
  ok(`  ...naming ${code}`, verdict.blockers.some((b) => b.code === code));
  ok(`  ...with a fix a person can act on`, verdict.blockers.every((b) => b.fix && b.fix.length > 30));
}
ok("nothing configured at all reports every blocker at once", outreachReadiness({}).blockers.length >= 3);

{
  // The honest "waiting on mail forwarding setup" state the brief asked for:
  // outbound still works, and the screen says replies are not being filed.
  const v = outreachReadiness({ ...READY, inboundSecretSet: false });
  ok("a missing inbound secret does NOT block sending", v.canSend);
  ok("...but is warned about", v.warnings.some((w) => w.code === "inbound_not_configured"));
  ok("...in words that say replies still reach the rep's mailbox", /mailbox/i.test(v.warnings.find((w) => w.code === "inbound_not_configured").fix));
}
{
  const v = outreachReadiness({ ...READY, senderDomainVerified: null });
  ok("'we could not ask Resend' is a warning, not a refusal", v.canSend && v.warnings.some((w) => w.code === "sender_domain_unknown"));
}

{
  // The UI must obey it. A compose form rendered on anything looser than this
  // is the dead control AGENTS.md opens with.
  const page = read("app/sales/leads/[id]/page.js");
  const line = page.split("\n").find((l) => l.includes("const canCompose"));
  ok("the lead screen gates its compose box on canSend", Boolean(line) && line.includes("outreach?.canSend"));
  ok("...and on the opt-out", Boolean(line) && line.includes("!optedOut"));
  ok("...and on the lead actually having an address", Boolean(line) && line.includes("lead.email"));
  ok("the compose form renders only inside that gate", /\{canCompose && \(/.test(page));
  ok("the blockers are shown instead", page.includes("OutreachNotice"));

  // The screens must not import lib/sales/outreach.js: it pulls node:crypto in
  // for the token generator and the timing-safe secret check, neither of which
  // belongs in a browser bundle. outreachPipeline.js exists for the five
  // statuses they legitimately share. Caught here rather than by the build,
  // which bundled it without complaint.
  const clientPages = [
    "app/sales/leads/page.js",
    "app/sales/leads/[id]/page.js",
    "app/sales/threads/page.js",
    "app/sales/threads/[id]/page.js",
    "app/sales/leads/OutreachNotice.js",
  ];
  const leaked = clientPages.filter((f) => /from "@\/lib\/sales\/outreach"/.test(read(f)));
  ok("no client screen imports the server-only outreach module", leaked.length === 0, leaked);

  const thread = read("app/sales/threads/[id]/page.js");
  const replyLine = thread.split("\n").find((l) => l.includes("const canReply"));
  ok("the thread screen gates its reply box the same way", Boolean(replyLine) && replyLine.includes("outreach?.canSend") && replyLine.includes("!optedOut"));
  ok("a message body is never rendered as markup", !thread.includes("dangerouslySetInnerHTML"));
  ok("...it is rendered as pre-wrapped text", thread.includes("whitespace-pre-wrap"));
}

// ═══════════════════════════════════════════════════════════════════════════
section("10. Nothing sends by itself");

{
  const sender = read("lib/sales/outreachSender.js");
  ok("the send path is the only place sendEmail is called for outreach", (sender.match(/sendEmail\(/g) || []).length === 1);
  ok("a send that Resend refused writes NO message row", /result\?\.error \|\| !result\?\.id[\s\S]{0,600}return \{[\s\S]{0,200}ok: false/.test(sender));
  ok("a skipped send (no API key) writes no row either", /result\?\.skipped[\s\S]{0,400}return \{[\s\S]{0,200}ok: false/.test(sender));
  const deliver = functionBody(sender, "deliverOutreach");
  ok("deliverOutreach re-checks readiness in the same request as the send", (deliver || "").includes("await outreachStatus(rep)"));
  ok("...before it builds the email", (deliver || "").indexOf("outreachStatus(rep)") < (deliver || "").indexOf("buildOutboundEmail"));
  ok("...and the row is written only after the provider returns an id", (deliver || "").indexOf("sendEmail(") < (deliver || "").indexOf("salesMessage.create"));
  ok("outreach never sends as the platform sender behind the rep's back", !/getPlatformFrom/.test(sender));
  ok("the send passes no companyId — this is not tenant mail", !/companyId:/.test(deliver || ""));
}
{
  // No scheduler reaches any of this. If one ever should, it is a product
  // decision with its own consent posture, not a quiet import.
  const cronDir = join(ROOT, "app/api/cron");
  const { readdirSync, statSync } = await import("node:fs");
  const walk = (dir, out = []) => {
    for (const name of readdirSync(dir)) {
      const full = join(dir, name);
      if (statSync(full).isDirectory()) walk(full, out);
      else if (name.endsWith(".js")) out.push(full);
    }
    return out;
  };
  const offenders = walk(cronDir).filter((f) => /sales\/outreach/.test(stripComments(readFileSync(f, "utf8"))));
  ok("no cron imports anything from lib/sales/outreach*", offenders.length === 0, offenders);
}

// ═══════════════════════════════════════════════════════════════════════════
console.log(
  `\n${failures.length === 0 ? `ALL PASS — ${pass} checks` : `${failures.length} FAILED of ${pass + failures.length}`}`,
);
for (const f of failures) console.log(`  ✗ ${f}`);
process.exit(failures.length ? 1 : 0);
