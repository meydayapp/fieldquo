// scripts/check-free-dial.mjs
//
//   npm run check:free-dial
//
// A rep is told "call him on his cell". Can they record it, ring it, and be
// stopped from texting it if it turns out to be a landline?
//
// ══ The two failures this file exists to catch ════════════════════════════
//
// 1. TOLL FRAUD. Free dial means the screen names a destination. If it names a
//    PHONE NUMBER, one stolen rep session dials a premium-rate line on
//    FieldQuo's Twilio account for as long as nobody notices, and no amount of
//    validating that number helps — a well-formed E.164 is exactly what an
//    attacker sends. So the wire carries an ID of a row we already stored, the
//    server re-reads it in the request that dials, and it can only find rows
//    belonging to the record the rep is on.
//
// 2. TEXTING A LANDLINE, which is a SILENT SUCCESS. The carrier accepts it,
//    the provider reports it sent, the rep sees a tick, and it reaches nobody —
//    no bounce, no error, nothing to notice. So the text channel refuses a
//    known landline and says why, rather than reporting a delivery.
//
// ══ Executed, not read, wherever it can be ═══════════════════════════════
//
// Sections 1–4 run the shipped functions against hostile input: an id from a
// different prospect, a malformed id, a landline chosen for a text, one of
// FieldQuo's own numbers, a suppressed contractor, no numbers at all, the same
// number recorded twice. Sections 5–7 are source questions, each scoped to a
// named function or a decommented file, because a whole-file regex passes over
// a deleted guard whenever the paragraph explaining it is still there — this
// project has been fooled by exactly that.
//
// ══ Mutation-tested ══════════════════════════════════════════════════════
//
// Each guarantee was broken on disk in turn, the break confirmed by re-reading
// the file, this script confirmed to exit NON-ZERO, and the file restored from
// a `cp` backup — never `git checkout`, which restores the commit rather than
// the working copy. Judged by exit code, not by grepping the output for FAIL:
// a script that crashes prints no failures and reads exactly like a pass.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

import {
  CHANNEL_TEXT,
  CHANNEL_VOICE,
  KIND_LANDLINE,
  KIND_MOBILE,
  KIND_UNKNOWN,
  contactChoices,
  reaches,
} from "@/lib/sales/contact/numbers";
import {
  contactNumberScope,
  loadContactNumbers,
  pickContactNumber,
  sayRefusal,
} from "@/lib/sales/contact/resolve";
import { firstSuppression } from "@/lib/sales/suppression";
import { REP_CALL_WRITES } from "@/lib/sales/calls/gate";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (p) => readFileSync(join(ROOT, p), "utf8");
/** Strip comments so a source assertion cannot pass on a sentence about it. */
const decomment = (src) =>
  src.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/(^|[^:])\/\/[^\n]*/g, "$1 ");

let pass = 0;
const failures = [];
function ok(name, cond, got) {
  if (cond) {
    pass++;
    console.log(`  ok   ${name}`);
  } else {
    failures.push(name);
    console.log(`  FAIL ${name}${got !== undefined ? `  — got: ${JSON.stringify(got)}` : ""}`);
  }
  return Boolean(cond);
}
const section = (title) => console.log(`\n${title}\n`);

const SHOP = "+16135550100";
const CELL = "+16135550142";
const FAX = "+16135550188";
const OURS = "+15145550001";

const row = (over = {}) => ({
  id: over.id || "n1",
  e164: over.e164 || CELL,
  kind: over.kind || KIND_UNKNOWN,
  label: over.label ?? null,
  canCall: over.canCall === undefined ? null : over.canCall,
  canText: over.canText === undefined ? null : over.canText,
  preferred: over.preferred === true,
  createdAt: over.createdAt || new Date("2026-09-01T10:00:00Z"),
  note: over.note ?? null,
});

const target = { phoneE164: SHOP };

// ═══════════════════════════════════════════════════════════════════════════
section("1. Reach: what a line can carry, and what a human said about it");

ok("a mobile takes a call", reaches({ kind: KIND_MOBILE }, CHANNEL_VOICE) === true);
ok("a mobile takes a text", reaches({ kind: KIND_MOBILE }, CHANNEL_TEXT) === true);
ok("a landline takes a call", reaches({ kind: KIND_LANDLINE }, CHANNEL_VOICE) === true);
ok(
  "a landline does NOT take a text — the whole reason this module exists",
  reaches({ kind: KIND_LANDLINE }, CHANNEL_TEXT) === false,
);
ok("an unknown line is offered on both", reaches({ kind: KIND_UNKNOWN }, CHANNEL_TEXT) === true);
ok(
  "a rep who was TOLD a landline forwards and takes texts outranks the kind",
  reaches({ kind: KIND_LANDLINE, canText: true }, CHANNEL_TEXT) === true,
);
ok(
  "a rep who was told NOT to ring a mobile outranks the kind too",
  reaches({ kind: KIND_MOBILE, canCall: false }, CHANNEL_VOICE) === false,
);
ok(
  "null is not false — an unstated canText falls back to the kind",
  reaches({ kind: KIND_LANDLINE, canText: null }, CHANNEL_TEXT) === false &&
    reaches({ kind: KIND_MOBILE, canText: null }, CHANNEL_TEXT) === true,
);
ok("an unknown channel reaches nothing", reaches({ kind: KIND_MOBILE }, "carrier pigeon") === false);
ok(
  "an unknown channel is refused by contactChoices as well",
  contactChoices({ primary: SHOP }, { channel: "fax" }).reason === "unknown_channel",
);

// ═══════════════════════════════════════════════════════════════════════════
section("2. Picking a number, against every hostile shape");

{
  const r = pickContactNumber({ target: { phoneE164: null }, rows: [] });
  ok("no number anywhere refuses", r.ok === false, r);
  ok("…with `no_number`, not a silent null", r.code === "no_number", r.code);
  ok("…and a sentence a rep can act on", typeof r.error === "string" && r.error.length > 20);
}
{
  const r = pickContactNumber({ target: null, rows: [] });
  ok("a null target refuses rather than throwing", r.ok === false && r.code === "no_number");
}
{
  const r = pickContactNumber({ target, rows: [] });
  ok("with only the listing number, that is what gets dialled", r.ok === true && r.e164 === SHOP);
  ok("…and it carries no stored id, because it is not a stored row", r.numberId === null, r.numberId);
}
{
  const rows = [row({ id: "cell", e164: CELL, label: "Owner's cell" })];
  const r = pickContactNumber({ target, rows });
  ok(
    "a number a rep was GIVEN outranks the directory listing",
    r.ok === true && r.e164 === CELL,
    r.e164,
  );
  ok("…and the listing is still offered second", r.choices[1]?.e164 === SHOP, r.choices);
}
{
  const rows = [
    row({ id: "a", e164: CELL, createdAt: new Date("2026-09-01T10:00:00Z") }),
    row({ id: "b", e164: FAX, createdAt: new Date("2026-09-02T10:00:00Z"), preferred: true }),
  ];
  const r = pickContactNumber({ target, rows });
  ok("the one marked preferred comes first", r.e164 === FAX, r.e164);
}
{
  const rows = [row({ id: "cell", e164: CELL })];
  const r = pickContactNumber({ target, rows, contactNumberId: "cell" });
  ok("naming a stored id dials that number", r.ok === true && r.e164 === CELL);
  ok("…and says which row it was", r.numberId === "cell", r.numberId);
}

// ── The security case: an id that is not on this record ──────────────────
//
// The rows handed in are the ones loadContactNumbers() returned for THIS
// prospect. An id belonging to somebody else's prospect is therefore simply
// absent, and this is what happens when it is.
{
  const rows = [row({ id: "cell", e164: CELL })];
  const other = pickContactNumber({ target, rows, contactNumberId: "somebody-elses-row-id" });
  ok("an id from a DIFFERENT prospect is refused", other.ok === false, other);
  ok("…as `not_on_this_record`", other.code === "not_on_this_record", other.code);
  ok("…and nothing is dialled", other.e164 === null, other.e164);
  ok(
    "…and the refusal does not confirm which ids exist",
    !/cell/.test(String(other.error)),
    other.error,
  );
}
for (const bad of ["", "   ", "../../etc/passwd", "'; DROP TABLE--", "n1 n2"]) {
  const rows = [row({ id: "cell", e164: CELL })];
  const r = pickContactNumber({ target, rows, contactNumberId: bad });
  const blank = bad.trim() === "";
  ok(
    `a malformed id ${JSON.stringify(bad)} ${blank ? "falls back to the best choice" : "is refused"}`,
    blank ? r.ok === true && r.e164 === CELL : r.ok === false && r.code === "not_on_this_record",
    r,
  );
}
for (const bad of [null, undefined, 12345, {}, [], true]) {
  const rows = [row({ id: "cell", e164: CELL })];
  const r = pickContactNumber({ target, rows, contactNumberId: bad });
  ok(
    `a non-string id ${JSON.stringify(bad) ?? "undefined"} never selects a row by accident`,
    r.ok === true && r.e164 === CELL && r.numberId === "cell",
    r,
  );
}

// ── A landline, chosen for a text ────────────────────────────────────────
{
  const rows = [row({ id: "shopline", e164: FAX, kind: KIND_LANDLINE, label: "The shop" })];
  const voice = pickContactNumber({ target, rows, contactNumberId: "shopline", channel: CHANNEL_VOICE });
  ok("a landline can be rung", voice.ok === true && voice.e164 === FAX);

  const text = pickContactNumber({ target, rows, contactNumberId: "shopline", channel: CHANNEL_TEXT });
  ok("the SAME landline is refused for a text", text.ok === false, text);
  ok("…with the reason named", text.code === "landline_cannot_receive_text", text.code);
  ok(
    "…and the reason says the failure would be silent",
    /delivered to nobody|no bounce/i.test(String(text.error)),
    text.error,
  );
  ok(
    "…and it is not on the text list at all, so no screen can offer it",
    !text.choices.some((c) => c.e164 === FAX),
    text.choices,
  );
  ok(
    "…while it IS on the call list",
    voice.choices.some((c) => c.e164 === FAX),
  );
}
{
  const rows = [row({ id: "fwd", e164: FAX, kind: KIND_LANDLINE, canText: true })];
  const r = pickContactNumber({ target, rows, contactNumberId: "fwd", channel: CHANNEL_TEXT });
  ok(
    "a landline the contractor SAID forwards can be texted — a human beats a lookup",
    r.ok === true && r.e164 === FAX,
    r,
  );
}
{
  const rows = [row({ id: "u", e164: CELL, kind: KIND_UNKNOWN })];
  const r = pickContactNumber({ target, rows, channel: CHANNEL_TEXT });
  ok("an unverified number is offered for text", r.ok === true && r.e164 === CELL);
  ok(
    "…with the doubt printed rather than hidden",
    typeof r.choices[0]?.doubt === "string" && r.choices[0].doubt.length > 20,
    r.choices[0]?.doubt,
  );
}

// ── One of FieldQuo's own numbers ────────────────────────────────────────
{
  const rows = [row({ id: "loop", e164: OURS })];
  const r = pickContactNumber({ target, rows, ourNumbers: [OURS] });
  ok("our own number is never a choice", !r.choices.some((c) => c.e164 === OURS), r.choices);
  ok("…it is refused with `one_of_ours`", r.refused.some((x) => x.why === "one_of_ours"), r.refused);
  const chosen = pickContactNumber({ target, rows, ourNumbers: [OURS], contactNumberId: "loop" });
  ok("…and choosing it explicitly is still refused", chosen.ok === false, chosen);
  ok("…with the same reason", chosen.code === "one_of_ours", chosen.code);
}
{
  // The listing number itself being one of ours — a typo in a discovered row.
  const r = pickContactNumber({ target: { phoneE164: OURS }, rows: [], ourNumbers: [OURS] });
  ok("a listing number that is one of ours leaves nothing to dial", r.ok === false, r);
  ok("…reported as all_refused, not as no_number", r.code === "all_refused", r.code);
}

// ── A suppressed contractor ──────────────────────────────────────────────
{
  const rows = [row({ id: "cell", e164: CELL, label: "Owner's cell" })];
  const r = pickContactNumber({
    target,
    rows,
    blocked: true,
    blockedReason: "They replied STOP on 2 September.",
  });
  ok("a blocked business offers no number at all", r.ok === false && r.choices.length === 0, r);
  ok(
    "…including the cell they gave us afterwards — the flag is on the BUSINESS",
    !r.choices.some((c) => c.e164 === CELL),
  );
  ok("…and the rep is told why", /STOP/.test(String(r.error)) || /stop/i.test(String(r.error)), r.error);
  const chosen = pickContactNumber({ target, rows, blocked: true, contactNumberId: "cell" });
  ok("…and naming the id explicitly does not get round it", chosen.ok === false, chosen);
}

// ── The same number twice ────────────────────────────────────────────────
{
  const rows = [
    row({ id: "first", e164: CELL, createdAt: new Date("2026-09-01T10:00:00Z") }),
    row({ id: "second", e164: CELL, createdAt: new Date("2026-09-03T10:00:00Z") }),
  ];
  const r = pickContactNumber({ target, rows });
  const hits = r.choices.filter((c) => c.e164 === CELL);
  ok("the same number recorded twice is ONE choice, not two", hits.length === 1, r.choices);
  ok("…and the listing is still there beside it", r.choices.length === 2, r.choices);
  const byOther = pickContactNumber({ target, rows, contactNumberId: "second" });
  ok("…and either id resolves to the same number", byOther.ok === true && byOther.e164 === CELL);
}
{
  // The primary and an alternate being the same number — a rep re-typing what
  // is already on the listing.
  const rows = [row({ id: "same", e164: SHOP })];
  const r = pickContactNumber({ target, rows });
  ok("re-typing the listing number does not produce two entries", r.choices.length === 1, r.choices);
}

// ── Rubbish in a row ─────────────────────────────────────────────────────
{
  const rows = [row({ id: "junk", e164: "call the shop" })];
  const r = pickContactNumber({ target, rows });
  ok("an unusable stored number is not a choice", r.choices.every((c) => c.e164 !== null));
  ok("…it is refused as not_a_number", r.refused.some((x) => x.why === "not_a_number"), r.refused);
  ok("…and the listing still gets dialled", r.ok === true && r.e164 === SHOP);
  const chosen = pickContactNumber({ target, rows, contactNumberId: "junk" });
  ok("…and choosing it is refused rather than dialling nothing", chosen.ok === false, chosen);
}
{
  const rows = [row({ id: "nocall", e164: CELL, kind: KIND_MOBILE, canCall: false })];
  const r = pickContactNumber({ target, rows, contactNumberId: "nocall" });
  ok("a number recorded as 'do not call' is refused for a call", r.ok === false, r);
  ok("…as not_callable", r.code === "not_callable", r.code);
}
ok(
  "every refusal code has a sentence written for it",
  ["landline_cannot_receive_text", "one_of_ours", "not_a_number", "not_callable", "blocked"].every(
    (why) => typeof sayRefusal(why) === "string" && sayRefusal(why).length > 20,
  ),
);
ok(
  "an unrecognised refusal code still says something rather than nothing",
  sayRefusal("something new", CHANNEL_TEXT).length > 10,
);

// ═══════════════════════════════════════════════════════════════════════════
section("3. The query that finds a record's numbers can never be unscoped");

ok(
  "with neither id, the scope is NULL rather than an empty filter",
  contactNumberScope({}) === null,
);
ok(
  "…and that is not the same as `{}` — an empty filter would match every number in the database",
  contactNumberScope({ prospectId: null, salesLeadId: null }) === null,
);
ok(
  "a prospect id produces exactly one clause",
  JSON.stringify(contactNumberScope({ prospectId: "p1" })) === JSON.stringify({ OR: [{ prospectId: "p1" }] }),
  contactNumberScope({ prospectId: "p1" }),
);
ok(
  "both ids produce both clauses, so a lead sees its business's numbers",
  contactNumberScope({ prospectId: "p1", salesLeadId: "l1" }).OR.length === 2,
);

{
  // A client that records what it was asked, so "no query was issued" is a
  // fact rather than an inference.
  const calls = [];
  const client = {
    salesContactNumber: {
      findMany: async (args) => {
        calls.push(args);
        return [row({ id: "cell", e164: CELL })];
      },
    },
  };
  const none = await loadContactNumbers({ client });
  ok("with no ids, loadContactNumbers issues NO query at all", calls.length === 0, calls);
  ok("…and returns an empty list", Array.isArray(none) && none.length === 0);

  const some = await loadContactNumbers({ prospectId: "p1", client });
  ok("with a prospect id it queries once", calls.length === 1, calls.length);
  ok(
    "…scoped to that prospect",
    JSON.stringify(calls[0].where) === JSON.stringify({ OR: [{ prospectId: "p1" }] }),
    calls[0].where,
  );
  ok("…and returns the rows", some.length === 1);
}
{
  const bare = await loadContactNumbers({ prospectId: "p1", client: {} });
  ok(
    "a deployment whose client has no SalesContactNumber gets [] rather than a crash",
    Array.isArray(bare) && bare.length === 0,
  );
}
{
  const client = {
    salesContactNumber: { findMany: async () => { throw new Error("neon is asleep"); } },
  };
  const boom = await loadContactNumbers({ prospectId: "p1", client });
  ok("a failed read is an empty list, not an exception through the dial", boom.length === 0);
}

// ═══════════════════════════════════════════════════════════════════════════
section("4. A STOP blocks every number of theirs, not just the one it came from");

const suppressionClient = (suppressed) => ({
  salesSuppression: {
    findMany: async ({ where }) => {
      const values = where.OR.map((o) => o.value);
      return values.some((v) => suppressed.includes(v))
        ? [
            {
              kind: "phone",
              value: values[0],
              channels: ["phone", "sms", "email"],
              reason: "Replied STOP",
              source: "sms",
              requestedAt: new Date("2026-09-02T10:00:00Z"),
              retainUntil: null,
              removedAt: null,
              removedByAdminId: null,
              removedReason: null,
              createdAt: new Date("2026-09-02T10:00:00Z"),
            },
          ]
        : [];
    },
  },
});

{
  const clean = await firstSuppression(suppressionClient([]), {
    channel: "phone",
    phones: [SHOP, CELL],
  });
  ok("nobody suppressed is not suppressed", clean.suppressed === false, clean);
}
{
  // THE case free dial creates: they said STOP from the shop line, and the rep
  // is about to ring the cell.
  const hit = await firstSuppression(suppressionClient([SHOP]), {
    channel: "phone",
    phones: [CELL, SHOP],
  });
  ok(
    "a STOP from the SHOP line blocks a call to the cell somebody gave us",
    hit.suppressed === true,
    hit,
  );
  ok("…and names which number carried the refusal", hit.phone === SHOP, hit.phone);
}
{
  const boom = await firstSuppression(
    { salesSuppression: { findMany: async () => { throw new Error("down"); } } },
    { channel: "phone", phones: [CELL] },
  );
  ok("a list that cannot be read FAILS CLOSED", boom.suppressed === true, boom);
  ok("…and says so rather than pretending", /could not be read/i.test(String(boom.reason)), boom.reason);
}
{
  const empty = await firstSuppression(suppressionClient([SHOP]), { channel: "phone", phones: [] });
  ok("no numbers to check is not a refusal", empty.suppressed === false);
  const nulls = await firstSuppression(suppressionClient([SHOP]), {
    channel: "phone",
    phones: [null, undefined, ""],
  });
  ok("…and neither are empty entries", nulls.suppressed === false);
}

// ═══════════════════════════════════════════════════════════════════════════
section("5. The dial route: the browser names an ID, and every guard re-runs");

const callsRoute = decomment(read("app/api/sales/calls/route.js"));
const dialBody = (() => {
  const at = callsRoute.indexOf('if (action === "dial")');
  const end = callsRoute.indexOf("const attemptId =", at);
  return at >= 0 && end > at ? callsRoute.slice(at, end) : "";
})();
ok("the dial branch was found", dialBody.length > 500, dialBody.length);

ok(
  "the dial branch reads a contactNumberId off the body",
  /body\.contactNumberId/.test(dialBody),
);
for (const field of ["body.to", "body.toE164", "body.phone", "body.phoneE164", "body.e164", "body.number"]) {
  ok(
    `it never takes ${field} — a caller-named destination is toll fraud`,
    !new RegExp(field.replace(".", "\\.")).test(dialBody),
  );
}
ok(
  "the number comes from pickContactNumber over rows loadContactNumbers returned",
  /pickContactNumber\(\{/.test(dialBody) && /loadContactNumbers\(\{/.test(dialBody),
);
ok(
  "…and those rows are scoped to the prospect AND lead the gate already resolved",
  /prospectId: target\.prospectId/.test(dialBody) && /salesLeadId: target\.leadId/.test(dialBody),
);
ok("a refused choice stops the request", /if \(!chosen\.ok\)/.test(dialBody));
ok(
  "…and an id that is not on the record answers 404, not 409",
  /chosen\.code === "not_on_this_record" \? 404 : 409/.test(dialBody),
);

ok(
  "the suppression list is read across EVERY number, through the shared loop",
  /firstSuppression\(db, \{ channel: "phone", phones: everyNumber \}\)/.test(dialBody),
);
ok(
  "…and `everyNumber` is built from the listing plus the stored rows",
  /target\.phoneE164, \.\.\.contactRows\.map\(\(r\) => r\.e164\)/.test(dialBody),
);
ok("…and a suppressed verdict refuses with 409", /suppression\?\.suppressed/.test(dialBody));
ok("the do-not-contact flag still refuses first", /target\.doNotContactAt/.test(dialBody));
ok(
  "the 24-hour cap counts attempts against the CHOSEN number",
  /attemptsLast24h\(dialTo,/.test(dialBody),
);
ok("the calling window is still recomputed here", /salesCallReadiness\(\{/.test(dialBody));
ok("…and anything but `allowed` refuses", /readiness\.decision !== CALL_ALLOWED/.test(dialBody));
ok(
  "the caller-id plan is built for the chosen number",
  /callPlan\(\{\s*toE164: dialTo,/.test(dialBody),
);
ok(
  "…and still refuses one of FieldQuo's own numbers",
  /ownNumbers: ours/.test(dialBody) && /ownNumbers\(\)/.test(dialBody),
);
ok(
  "our own numbers are excluded from the choice on BOTH channels, not just the browser one",
  /ourNumbers: ours/.test(dialBody),
);
ok(
  "the attempt row records the chosen number, because the bridge dials off that row",
  /toE164: dialTo/.test(dialBody),
);
ok(
  "nothing after the choice falls back to the listing number",
  !/toE164: target\.phoneE164/.test(dialBody) && !/attemptsLast24h\(target\.phoneE164/.test(dialBody),
);

// ═══════════════════════════════════════════════════════════════════════════
section("6. Recording a number, and what that route may never write");

const numbersRoute = decomment(read("app/api/sales/calls/numbers/route.js"));
ok("the recording route rides the calling gate", /requireCallingRep\(request\)/.test(numbersRoute));
ok("…and returns its refusal verbatim", /if \(refusal\)/.test(numbersRoute));
ok(
  "the calling gate declares salesContactNumber",
  REP_CALL_WRITES.includes("salesContactNumber"),
  REP_CALL_WRITES,
);
ok(
  "…and still forbids the tables that decide money",
  !REP_CALL_WRITES.includes("salesAttribution") && !REP_CALL_WRITES.includes("salesCommissionEntry"),
);
{
  const writes = [
    ...numbersRoute.matchAll(
      /\bdb\.(\w+)\.(create|createMany|update|updateMany|upsert|delete|deleteMany)\b/g,
    ),
  ];
  ok("the route does write something", writes.length > 0, writes.length);
  ok(
    "every write is to salesContactNumber and nothing else",
    writes.every((m) => m[1] === "salesContactNumber"),
    writes.map((m) => `${m[1]}.${m[2]}`),
  );
  ok(
    "it never overwrites Prospect.phoneE164 or SalesLead.phone — those are identity",
    !/phoneE164:\s/.test(numbersRoute.replace(/phoneE164: true/g, "")) ||
      !writes.some((m) => m[1] === "prospect" || m[1] === "salesLead"),
  );
  ok(
    "and it deletes nothing",
    !writes.some((m) => m[2] === "delete" || m[2] === "deleteMany"),
  );
}
ok(
  "the record it hangs a number on is re-read scoped to this rep",
  /queueWhere\(repId\)/.test(numbersRoute) && /salesRepId: repId/.test(numbersRoute),
);
ok(
  "the number is normalised with the same function the suppression list keys on",
  /normalisePhone\(body\.e164/.test(numbersRoute),
);
ok(
  "…and a number that will not normalise is refused rather than stored",
  /if \(!e164\)/.test(numbersRoute),
);
ok(
  "canCall and canText stay three-valued — an unanswered question is not a no",
  /function tristate\(/.test(numbersRoute) && /return null;/.test(numbersRoute),
);
ok(
  "a business that asked us to stop gets no new numbers",
  /owner\.doNotContactAt/.test(numbersRoute),
);
ok(
  "the rep who wrote it down comes from the gate, never from the body",
  /addedBySalesRepId: rep\.id/.test(numbersRoute) && !/body\.addedBySalesRepId/.test(numbersRoute),
);
ok(
  "a PATCH finds the row inside the already-scoped set, not by id alone",
  /rows\.find\(\(r\) => r\.id === id\)/.test(numbersRoute),
);

// ═══════════════════════════════════════════════════════════════════════════
section("7. Texting: a landline is refused, not silently swallowed");

const smsRoute = decomment(read("app/api/sales/sms/route.js"));
ok(
  "the texting route chooses its number on the TEXT channel",
  /channel: CHANNEL_TEXT/.test(smsRoute),
);
ok(
  "…through the same picker the dial uses",
  /pickContactNumber\(\{/.test(smsRoute) && /loadContactNumbers\(\{/.test(smsRoute),
);
for (const field of ["body.to", "body.toE164", "body.phone", "body.e164"]) {
  ok(
    `the send never takes ${field} from the browser either`,
    !new RegExp(field.replace(".", "\\.")).test(smsRoute),
  );
}
ok(
  "a refused number stops the send with the reason attached",
  /if \(!chosen\.ok\)/.test(smsRoute) && /refused: chosen\.refused/.test(smsRoute),
);
ok(
  "the readiness rules — suppression, +1, the window — run against the CHOSEN number",
  /lead: \{ \.\.\.lead, phone: chosen\.e164 \}/.test(smsRoute),
);
ok(
  "a STOP from any of their numbers blocks the text",
  /firstSuppression\(db, \{/.test(smsRoute),
);
ok(
  "…and a do-not-contact blocks every number of theirs, not just the listed one",
  /blocked: Boolean\(lead\.prospect\?\.doNotContactAt\)/.test(smsRoute),
);

// ═══════════════════════════════════════════════════════════════════════════
section("8. The screens: an id on the wire, a reason on the page");

const panel = decomment(read("app/components/sales/CallPanel.js"));
// Scoped to place(), not the whole file: `toE164` also appears where the panel
// READS the server's answer back, and a whole-file match would either fail on
// that or be weakened until it proved nothing. The claim is about what goes
// OUT.
const placeBody = (() => {
  const at = panel.indexOf("async function place(");
  const end = panel.indexOf("function hangUp(", at);
  return at >= 0 && end > at ? panel.slice(at, end) : "";
})();
ok("place() was found in the call panel", placeBody.length > 400, placeBody.length);
// The request payload itself, not the whole function: place() also READS
// `toE164` back off the server's answer, and a whole-function match would
// either fail on that or get weakened until it proved nothing. The claim is
// about what goes OUT.
const dialPayload = placeBody.match(/body: JSON\.stringify\(\{([\s\S]*?)\n\s*\}\),/)?.[1] || "";
ok("the dial payload was found", dialPayload.length > 40, dialPayload);
ok("the call panel sends the id", /contactNumberId/.test(dialPayload), dialPayload);
ok(
  "…and puts no phone number on the wire at all",
  !/phone/i.test(dialPayload) && !/e164/i.test(dialPayload) && !/\+\d/.test(dialPayload),
  dialPayload,
);
const picker = decomment(read("app/components/sales/ContactNumbers.js"));
ok("the picker posts to the recording route", /"\/api\/sales\/calls\/numbers"/.test(picker));
ok("…and shows what was refused", /refused/.test(picker));
ok(
  "…with the landline reason spelled out, because the failure is otherwise invisible",
  /landline_cannot_receive_text/.test(picker),
);
ok(
  "every control in the picker meets the 44px touch target",
  (picker.match(/min-h-\[44px\]/g) || []).length >= 2,
);
{
  const queue = decomment(read("app/sales/queue/page.js"));
  ok("the queue renders the picker", /<ContactNumbers/.test(queue));
  ok("…and hands the dial the chosen number", /chosenNumber\?\.e164/.test(queue));
  // A typed number resolves to a stored row's id first (storedForTyped);
  // the chosen stored number is the fallback. Still an id, never a number.
  ok("…and the chosen id, not a number", /contactNumberId: storedForTyped\?\.id \|\| chosenNumber\?\.id/.test(queue));
  ok(
    "dialHref is still the only thing producing a tel: target",
    /dialHref\(compliance,/.test(queue) && !/tel:/.test(queue),
  );
  ok("the queue can edit the record", /<QueueLeadEditor/.test(queue));
}
{
  const editor = decomment(read("app/components/sales/QueueLeadEditor.js"));
  ok(
    "the record editor writes the rep's own lead through the route that already writes it",
    /\/api\/sales\/leads\//.test(editor) && /method: "PATCH"/.test(editor),
  );
  ok(
    "…and never the discovered prospect",
    !/\/api\/sales\/queue/.test(editor) && !/prospect\./.test(editor),
  );
  ok(
    "a prospect with no lead is offered one rather than having one invented",
    /\/api\/sales\/leads"/.test(editor) && /method: "POST"/.test(editor),
  );
}
{
  const lead = decomment(read("app/sales/leads/[id]/page.js"));
  ok("the lead screen renders the same picker", /<ContactNumbers/.test(lead));
  ok("…and dials the chosen number", /chosenNumber\?\.e164/.test(lead));
}

// ═══════════════════════════════════════════════════════════════════════════
section("9. The schema, and this check's own registration");

{
  const schema = read("prisma/schema.prisma");
  const model = schema.slice(schema.indexOf("model SalesContactNumber {"));
  const body = model.slice(0, model.indexOf("\n}\n"));
  ok("SalesContactNumber is in the schema", body.length > 100);
  ok("…keyed to a prospect and/or a lead, both nullable", /prospectId String\?/.test(body) && /salesLeadId String\?/.test(body));
  ok("…with the number normalised into e164", /e164 String/.test(body));
  ok("…and a kind that defaults to unknown rather than a guess", /kind String @default\("unknown"\)/.test(body));
  ok(
    "…canCall and canText are NULLABLE — absence of a statement is not a statement",
    /canCall Boolean\?/.test(body) && /canText Boolean\?/.test(body),
  );
  ok("…the rep who wrote it down survives them leaving", /onDelete: SetNull/.test(body));
  ok(
    "…and the same number cannot be stored twice against one record",
    /@@unique\(\[prospectId, e164\]\)/.test(body) && /@@unique\(\[salesLeadId, e164\]\)/.test(body),
  );
}
{
  const pkg = JSON.parse(read("package.json"));
  ok("check:free-dial is a script", typeof pkg.scripts?.["check:free-dial"] === "string");
  ok("…and check:all runs it", (pkg.scripts?.["check:all"] || "").includes("check:free-dial"));
}

// ═══════════════════════════════════════════════════════════════════════════
console.log(`\n${pass} passed, ${failures.length} failed`);
if (failures.length) {
  console.log("\nFailed:");
  for (const f of failures) console.log(`  - ${f}`);
  process.exit(1);
}
