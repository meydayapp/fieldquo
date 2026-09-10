#!/usr/bin/env node
//
// scripts/check-sales-server-copy.mjs
//
//   npm run check:sales-server-copy
//
// The sentences a rep reads that a SERVER wrote.
//
// ══ What went wrong, and why a check is the fix ═══════════════════════════
//
// Commit cf099363 translated every /sales SCREEN into nine languages. What it
// could not reach was the text those screens RECEIVE already written: refusal
// copy composed in lib/sales/*, labels composed in app/api/sales/*, and
// rendered verbatim. So a rep on Spanish got a Spanish frame around English
// content — the half-translated state that commit existed to remove, moved one
// layer down.
//
// The fix was structural rather than textual: those modules are pure, are
// executed by a dozen check scripts under bare node, and must never import a
// translator. So each one now emits the NAME of the sentence — a catalogue key
// — plus the values it interpolates, and keeps its English as the fallback.
//
// That shape has exactly one failure mode, and it is silent: a branch that
// names a key the catalogue does not have. t() then falls back to English and
// the screen looks fine to whoever wrote it. So §1 EXECUTES every one of those
// functions across its whole input space and demands the catalogue answer.
//
// ══ Judged by exit code, and read with comments stripped ══════════════════
//
// Every assertion goes through ok() and the process exits 1 if any failed. Do
// not read a run by grepping for FAIL. Sources are decommented before any
// regex touches them: this repository explains at length, in prose, what each
// file must not do, and a check here has been satisfied by a comment ABOUT a
// rule instead of by the rule more than once.
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { APP_MESSAGES } from "@/app/i18n/appMessages";
import { dialSpace, DIAL_STATES } from "@/lib/sales/dialSpace";
import { salesCallReadiness, describeWindowParts } from "@/lib/sales/callingRules";
import {
  SUPPRESSION_NOTICE_KEYS,
  SUPPRESSION_SOURCES,
  suppressionNotice,
  describeSuppression,
} from "@/lib/sales/suppressionRules";
import { dispositionOptions, DISPOSITION_COPY_KEYS } from "@/lib/sales/calls/dispositions";
import { CHECKIN_HEADLINE_KEYS, checkinHeadlineKey, REASON_CODES } from "@/lib/sales/checkin/signals";
import { ENGAGEMENTS, PAYOUT_METHODS, payoutReadiness } from "@/lib/sales/payoutDetails";
import { MILESTONE_LABEL_KEYS, MILESTONE_LABELS } from "@/lib/sales/commission";
import { AUTH_REFUSAL_KEYS, authRefusalKey } from "@/lib/sales/authRefusals";
import { FETCH_ERROR_KEYS } from "@/lib/fetchJson";
import { NOTES_REFUSAL_KEYS } from "@/lib/sales/notes/model";
import { LAYER_HEADINGS, prospectView, prospectFacts } from "@/lib/sales/prospectView";
import { PARENT_KIND_KEYS, parentSentence, describeParent } from "@/lib/sales/notes/parents";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (p) => readFileSync(join(ROOT, p), "utf8");
const decomment = (src) =>
  src.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/(^|[^:])\/\/[^\n]*/g, "$1 ");

let pass = 0;
const failures = [];
function ok(name, cond, got) {
  if (cond) {
    pass++;
    return;
  }
  failures.push(name);
  console.log(`  FAIL ${name}${got !== undefined ? `  — got: ${JSON.stringify(got)}` : ""}`);
}
const section = (h) => console.log(`\n${h}`);

const LANGS = Object.keys(APP_MESSAGES);

/** Every language answers this key with something. The whole point. */
function keyLives(key, where) {
  const absent = LANGS.filter((l) => APP_MESSAGES[l][key] === undefined);
  ok(`${where} names ${key}, and every language has it`, absent.length === 0, absent);
}

// ═══════════════════════════════════════════════════════════════════════════
section("1. Every key these functions can NAME, the catalogue answers");
// ═══════════════════════════════════════════════════════════════════════════
//
// Executed, not read. A key is only wrong at the moment a branch reaches it,
// and reading the source cannot tell which branches are reachable.

// ── The dial region: nine states, driven through every one ────────────────
{
  const seen = new Set();
  const keysOf = (space) => {
    seen.add(space.state);
    for (const k of [space.titleKey, space.detailKey]) if (k) keyLives(k, `dialSpace/${space.state}`);
    if (space.params?.countKey) keyLives(space.params.countKey, `dialSpace/${space.state} count`);
    if (space.reasonKey) keyLives(space.reasonKey, `dialSpace/${space.state} reason`);
    for (const b of space.reasons || []) {
      if (b.titleKey) keyLives(b.titleKey, `blocker/${b.code}`);
      if (b.fixKey) keyLives(b.fixKey, `blocker/${b.code}`);
    }
  };

  const rules = (province, now) =>
    salesCallReadiness({ prospect: { country: "US", province }, now: new Date(now) });

  // No prospect, holding none and holding some.
  keysOf(dialSpace({}));
  keysOf(dialSpace({ claimedCount: 4 }));
  // Every uncallable contact code, including one nobody has heard of.
  for (const code of ["our_own_number", "do_not_contact", "opted_out", "no_phone", "invented"]) {
    keysOf(dialSpace({ prospect: { contact: { callable: false, code } } }));
  }
  // A contact carrying the keys contactability() now supplies.
  keysOf(
    dialSpace({
      prospect: {
        contact: {
          callable: false,
          code: "opted_out",
          titleKey: "app.salesDial.space.optedOut.title",
          textKey: "app.salesDial.space.optedOutMeaning.detail",
          reasonKey: "app.salesSuppression.reason.person.sms",
          reasonParams: { value: "+16135550142", date: "2026-01-01" },
        },
      },
    }),
  );
  const callable = { contact: { callable: true } };
  keysOf(dialSpace({ prospect: callable }));                              // no decision
  keysOf(dialSpace({ prospect: callable, compliance: { decision: "?" } })); // unreadable
  // Refused with a window, refused outright, unknown, allowed with and without
  // a number — driven off the REAL jurisdiction table, not a forged verdict.
  keysOf(dialSpace({ prospect: callable, compliance: rules("WA", "2026-09-08T09:00:00Z") }));
  keysOf(dialSpace({ prospect: callable, compliance: rules("AZ", "2026-09-08T18:00:00Z") }));
  keysOf(dialSpace({ prospect: callable, compliance: rules("ZZ", "2026-09-08T18:00:00Z") }));
  keysOf(dialSpace({ prospect: callable, compliance: rules("OK", "2026-09-08T18:00:00Z") }));
  keysOf(
    dialSpace({
      prospect: callable,
      compliance: rules("WA", "2026-09-08T18:00:00Z"),
      href: "tel:+16135550142",
    }),
  );
  keysOf(dialSpace({ prospect: callable, compliance: rules("WA", "2026-09-08T18:00:00Z") }));

  // Vacuity guard. Every one of the assertions above passes trivially against
  // a dialSpace that returned nothing, and that is the shape of failure that
  // makes a check reassuring and useless.
  ok(
    "…and that drove at least seven of the nine dial states",
    seen.size >= 7,
    [...seen],
  );
  ok(
    "…all of which are states dialSpace declares",
    [...seen].every((s) => DIAL_STATES.includes(s)),
    [...seen].filter((s) => !DIAL_STATES.includes(s)),
  );
}

// ── The calling window, in both shapes and with and without closed days ───
{
  const shapes = [
    { weekday: { startMinute: 480, endMinute: 1200 }, weekend: { startMinute: 480, endMinute: 1200 } },
    { weekday: { startMinute: 480, endMinute: 1200 }, weekend: { startMinute: 540, endMinute: 1080 } },
    {
      weekday: { startMinute: 480, endMinute: 1200 },
      weekend: { startMinute: 480, endMinute: 1200 },
      closedWeekdays: [0],
    },
    {
      weekday: { startMinute: 480, endMinute: 1200 },
      weekend: { startMinute: 540, endMinute: 1080 },
      closedWeekdays: [0, 6],
    },
  ];
  const named = new Set();
  for (const w of shapes) {
    const parts = describeWindowParts(w);
    named.add(parts.key);
    keyLives(parts.key, "describeWindowParts");
  }
  ok("the four window shapes name four DIFFERENT keys", named.size === 4, [...named]);
  ok("a null window names none", describeWindowParts(null) === null);
  for (const k of [
    "app.salesDial.window.statutoryRule",
    "app.salesDial.window.courtesyRule",
    "app.salesDial.window.opensAt",
    "app.salesDial.quotedInEnglish",
    "app.salesSuppression.dateNotRecorded",
  ]) {
    keyLives(k, "the window statement");
  }
}

// ── The suppression sentence: every kind against every source ─────────────
{
  const named = new Set();
  for (const kind of ["email", "phone", "domain"]) {
    for (const source of [...SUPPRESSION_SOURCES, "something_new"]) {
      const notice = suppressionNotice({ kind, source, value: "bob@acme.com", requestedAt: new Date() });
      named.add(notice.reasonKey);
      keyLives(notice.reasonKey, `suppressionNotice/${kind}/${source}`);
    }
  }
  ok("no row is left without a key", !named.has(undefined) && !named.has(null), [...named]);
  ok(
    "…and a source nobody has heard of gets the unrecorded sentence, not a minted key",
    suppressionNotice({ kind: "email", source: "something_new", value: "x@y.z" }).reasonKey ===
      "app.salesSuppression.reason.person.unrecorded",
  );
  ok("no row at all names nothing, and spreads clean", Object.keys(suppressionNotice(null)).length === 0);
  for (const k of SUPPRESSION_NOTICE_KEYS) keyLives(k, "SUPPRESSION_NOTICE_KEYS");
  // Every source the LIST records must have a sentence of its own. Dropping
  // one silently reclassifies those people as "recorded" — the flattening that
  // told a rep a prospect had unsubscribed from an email nobody sent them, in
  // a new spelling. Asserted as a partition rather than as a count, so adding
  // a source and forgetting its sentence fails here.
  for (const source of SUPPRESSION_SOURCES) {
    const key = suppressionNotice({ kind: "email", source, value: "a@b.c" }).reasonKey;
    ok(
      `the ${source} source has a sentence of its own, not the generic one`,
      key === `app.salesSuppression.reason.person.${source}`,
      key,
    );
  }
  ok(
    "…and SUPPRESSION_NOTICE_KEYS covers every one of them, both subjects",
    SUPPRESSION_NOTICE_KEYS.length === (SUPPRESSION_SOURCES.length + 1) * 2,
    { declared: SUPPRESSION_NOTICE_KEYS.length, sources: SUPPRESSION_SOURCES.length },
  );
  keyLives("app.salesSuppression.reason.detectedReply", "the eighth source");

  // The DATE is a value, never a second sentence, and it is the row's own ISO
  // day rather than a localised one — this is a compliance record.
  const dated = suppressionNotice({ kind: "email", source: "sms", value: "a@b.c", requestedAt: "2026-03-04T05:06:07Z" });
  ok("the date travels as a value", dated.reasonParams.date === "2026-03-04", dated.reasonParams);
  ok(
    "…and an unreadable one is null rather than an invented day",
    suppressionNotice({ kind: "email", source: "sms", value: "a@b.c", requestedAt: "nonsense" })
      .reasonParams.date === null,
  );
}

// ── Ten dispositions, twenty keys, on the control a rep uses every call ────
{
  const options = dispositionOptions();
  ok("the picker has its full vocabulary", options.length >= 10, options.length);
  for (const d of options) {
    keyLives(d.labelKey, `disposition/${d.code}`);
    keyLives(d.hintKey, `disposition/${d.code}`);
    ok(`${d.code} keeps its English as the fallback`, Boolean(d.label && d.hint));
  }
  ok(
    "DISPOSITION_COPY_KEYS names exactly what the picker names",
    DISPOSITION_COPY_KEYS.length === options.length * 2,
    { declared: DISPOSITION_COPY_KEYS.length, picker: options.length * 2 },
  );
}

// ── Eight check-in reasons ────────────────────────────────────────────────
{
  for (const code of REASON_CODES) keyLives(checkinHeadlineKey(code), `checkin/${code}`);
  for (const k of CHECKIN_HEADLINE_KEYS) keyLives(k, "CHECKIN_HEADLINE_KEYS");
  ok("a code this build has never seen names no key", checkinHeadlineKey("nonsense") === null);
  ok("…and neither does nothing at all", checkinHeadlineKey(null) === null);
}

// ── Pay: engagements, methods, and every reason a rep cannot be paid ──────
{
  for (const e of ENGAGEMENTS) {
    keyLives(e.labelKey, `engagement/${e.key}`);
    keyLives(e.noteKey, `engagement/${e.key}`);
  }
  for (const m of PAYOUT_METHODS) {
    keyLives(m.labelKey, `method/${m.key}`);
    keyLives(m.handleLabelKey, `method/${m.key}`);
    keyLives(m.noteKey, `method/${m.key}`);
  }
  const problems = [
    ...payoutReadiness({}).problems,
    ...payoutReadiness({ engagement: "freelancer" }).problems,
    ...payoutReadiness({ engagement: "freelancer", payoutMethod: "wise" }).problems,
    ...payoutReadiness({ engagement: "freelancer", payoutMethod: "wise", payoutHandle: "  " }).problems,
  ];
  ok("every reason a rep cannot be paid was reached", problems.length >= 3, problems.length);
  for (const p of problems) {
    if (p.titleKey) keyLives(p.titleKey, `payoutReadiness/${p.code}`);
    if (p.fixKey) keyLives(p.fixKey, `payoutReadiness/${p.code}`);
    // The handle problem names two OTHER keys inside its values — the method
    // and the field it is asking for — because neither is safe to lower-case
    // by English rules.
    if (p.params?.methodKey) keyLives(p.params.methodKey, `payoutReadiness/${p.code} method`);
    if (p.params?.handleKey) keyLives(p.params.handleKey, `payoutReadiness/${p.code} field`);
  }
  for (const milestone of Object.keys(MILESTONE_LABELS)) {
    keyLives(MILESTONE_LABEL_KEYS[milestone], `milestone/${milestone}`);
  }
  ok(
    "every milestone with a label has a key, and none has a key with no label",
    Object.keys(MILESTONE_LABELS).length === Object.keys(MILESTONE_LABEL_KEYS).length,
  );
}

// ── The front door, and fetchJson's own last resort ───────────────────────
{
  for (const [code, key] of Object.entries(AUTH_REFUSAL_KEYS)) {
    keyLives(key, `authRefusal/${code}`);
    ok(`authRefusalKey resolves ${code}`, authRefusalKey(code) === key);
  }
  ok("a code this build has never seen resolves to null", authRefusalKey("nope") === null);
  ok("…and so does nothing at all", authRefusalKey(null) === null);
  // ── The four invite refusals stay four ─────────────────────────────────
  //
  // The invite route's whole reason for holding a map is that "ask for a new
  // invitation", "sign in with the password you set" and "ask a superadmin
  // about your account" are different instructions. Pointing two codes at one
  // key gives that back while every assertion above still passes — which is
  // exactly what happened when this file was mutation-tested.
  {
    const invite = Object.entries(AUTH_REFUSAL_KEYS).filter(([c]) => c.startsWith("invite_"));
    const keys = new Set(invite.map(([, k]) => k));
    ok("each invite refusal keeps its own key", keys.size === invite.length, {
      codes: invite.length,
      keys: keys.size,
    });
    for (const lang of LANGS) {
      const said = new Set(invite.map(([, k]) => String(APP_MESSAGES[lang][k])));
      ok(`…and its own sentence in ${lang}`, said.size === invite.length, [...said].length);
    }
  }
  for (const key of Object.values(FETCH_ERROR_KEYS)) keyLives(key, "fetchJson");
  for (const key of Object.values(NOTES_REFUSAL_KEYS)) keyLives(key, "notes model");
}

// ── The research layers, driven through a whole prospect view ─────────────
{
  for (const layer of Object.values(LAYER_HEADINGS)) {
    keyLives(layer.titleKey, "LAYER_HEADINGS");
    keyLives(layer.noteKey, "LAYER_HEADINGS");
    ok("…and it keeps its English", Boolean(layer.title && layer.note));
  }

  // Every fact row, in both its known and its unknown state.
  for (const prospect of [
    {},
    {
      businessName: "Acme Painting",
      city: "Ottawa",
      province: "ON",
      country: "CA",
      phoneE164: "+16135550142",
      googleRating: 4.5,
      googleReviewCount: 12,
      hasWebsite: true,
      websiteUrl: "https://acme.example",
      businessStatus: "open",
      sourceUpdatedAt: "2026-01-01T00:00:00Z",
      sourceProvider: "rbq",
    },
    { hasWebsite: false },
    { hasWebsite: null, websiteUrl: "https://listed.example" },
    { hasWebsite: null },
  ]) {
    for (const row of prospectFacts(prospect, { derivedSite: "acme.example" })) {
      keyLives(row.labelKey, `fact/${row.key} label`);
      if (row.textKey) keyLives(row.textKey, `fact/${row.key} text`);
      ok(`fact/${row.key} keeps its English text`, typeof row.text === "string" && row.text.length > 0);
    }
  }
  // The guessed-domain branch, which only fires with no hasWebsite and no url.
  {
    const guessed = prospectFacts({}, { derivedSite: "acme.example" }).find((r) => r.key === "website");
    ok(
      "a GUESSED website is keyed as a guess, not as a listing",
      guessed.textKey === "app.salesIntel.fact.website.guessed",
      guessed.textKey,
    );
  }

  const view = prospectView({
    prospect: { id: "p1", businessName: "Acme", hasWebsite: null },
    inferences: [
      { kind: "company_scale", value: "SMALL_BUSINESS", evidenceIds: ["e1"], source: "call" },
      { kind: "company_scale", value: "11 employees", evidenceIds: ["e1"] },
      { kind: "company_scale", value: "SOLO_LIKELY", evidenceIds: [] },
    ],
    opportunities: [
      { capabilityCode: "ONLINE_BOOKING", evidenceIds: [], reason: "x" },
      { capabilityCode: "ONLINE_BOOKING", evidenceIds: ["e1"], reason: "" },
    ],
    evidence: [{ id: "e1", type: "transcript" }],
  });

  keyLives(view.scoreNoteKey, "prospectView score");
  let renderable = 0;
  let refused = 0;
  for (const inf of view.inferences) {
    if (inf.renderable) {
      renderable++;
      if (inf.textKey) keyLives(inf.textKey, "inference bucket");
      if (inf.kindTextKey) keyLives(inf.kindTextKey, "inference kind");
      keyLives(inf.confidenceTextKey, "inference confidence");
      keyLives(inf.sourceTextKey, "inference source");
      ok("a renderable inference keeps its English", Boolean(inf.text && inf.sourceText));
    } else {
      refused++;
      keyLives(inf.refusalKey, "inference refusal");
      ok("a refused inference keeps its English", typeof inf.refusal === "string");
    }
  }
  ok("both an inference that renders and ones that are withheld were reached", renderable >= 1 && refused >= 2, {
    renderable,
    refused,
  });

  let oRefused = 0;
  for (const o of view.opportunities) {
    if (!o.renderable) {
      oRefused++;
      keyLives(o.refusalKey, "opportunity refusal");
    } else {
      keyLives(o.confidenceTextKey, "opportunity confidence");
    }
  }
  ok("both recommendation refusals were reached", oRefused === 2, oRefused);

  ok("the unknowns are objects a screen can look up", view.unknowns.length > 0, view.unknowns.length);
  for (const u of view.unknowns) {
    ok("every unknown carries its English", typeof u.text === "string" && u.text.length > 10, u);
    if (u.key) keyLives(u.key, "unknown");
  }
  ok(
    "…and at least one of them names a key rather than only English",
    view.unknowns.some((u) => Boolean(u.key)),
  );
}

// ── The note's parent, one sentence again instead of two copies ───────────
{
  for (const key of Object.values(PARENT_KIND_KEYS)) keyLives(key, "PARENT_KIND_KEYS");
  for (const key of [
    "app.salesNotes.parentNamed",
    "app.salesNotes.parentUnnamed",
    "app.salesNotes.parentGone",
    "app.salesNotes.parentNone",
  ]) {
    keyLives(key, "parentSentence");
  }
  // Executed against a translator that reports what it was asked for, so the
  // four branches are proven distinct rather than assumed to be.
  const asked = [];
  const t = (k, v) => {
    asked.push(k);
    return v ? `${k}(${JSON.stringify(v)})` : k;
  };
  const said = new Set();
  for (const note of [
    { leadId: "l1", parentLabel: "Acme" },
    { threadId: "t1" },
    { prospectId: "p1", parentLabel: "Acme" },
    { parentLabel: "Acme" },
    {},
  ]) {
    said.add(parentSentence(t, describeParent(note)));
  }
  ok("the parent states say five different things", said.size === 5, [...said].length);
  ok("…and nothing was built without asking the catalogue", asked.length >= 5, asked.length);
  ok("no parent at all says nothing rather than guessing", parentSentence(t, null) === "");
}

// ═══════════════════════════════════════════════════════════════════════════
section("2. The SCREEN resolves the key — it does not print the English");
// ═══════════════════════════════════════════════════════════════════════════
//
// §1 proves the keys exist. It proves nothing about whether anybody looks them
// up: a lib module emitting a perfect key beside an English sentence that the
// screen renders instead is the same untranslated screen with more code in it.

const RESOLVES = [
  ["app/components/sales/DialRegion.js", ["say(t, space.titleKey", "say(t, b.titleKey", "say(t, u.titleKey", "say(t, w.titleKey", "WindowLines"]],
  ["app/components/sales/CallPanel.js", ["t(d.labelKey", "t(chosen.hintKey"]],
  ["app/components/sales/PayoutDestinationForm.js", ["t(m.labelKey", "t(m.noteKey", "t(chosen.handleLabelKey", "t(engagement.labelKey"]],
  ["app/components/sales/EarningsPanel.js", ["t(rung.labelKey"]],
  ["app/components/sales/RepNoteUnavailable.js", ["NOTES_REFUSAL_KEYS"]],
  ["app/sales/queue/page.js", ["t(heading.titleKey", "t(f.labelKey", "t(inf.refusalKey", "t(o.refusalKey", "t(inf.confidenceTextKey", "t(inf.sourceTextKey"]],
  ["app/sales/leads/[id]/page.js", ["optedOutReasonKey"]],
  ["app/sales/threads/[id]/page.js", ["optedOutReasonKey"]],
  ["app/sales/messages/CheckInDraft.js", ["checkinHeadlineKey"]],
  ["app/sales/login/page.js", ["errorText(t, err, AUTH_REFUSAL_KEYS)"]],
  ["app/sales/invite/[token]/page.js", ["errorText(t, err, AUTH_REFUSAL_KEYS)"]],
  ["app/sales/notes/page.js", ["parentSentence(t, parent)"]],
  ["app/sales/notes/[id]/page.js", ["parentSentence(t, parent)"]],
];

for (const [path, needles] of RESOLVES) {
  const code = decomment(read(path));
  for (const needle of needles) {
    ok(`${path} resolves ${needle}`, code.includes(needle));
  }
}

// The routes have to SEND what the screens read. A screen reading a field no
// route sends is the mirror of the original bug — see check-sales-home.mjs §7,
// which found `optedOutReason` returned and rendered by nobody.
for (const route of ["app/api/sales/leads/[id]/route.js", "app/api/sales/threads/[id]/route.js"]) {
  ok(`${route} sends optedOutReasonKey`, decomment(read(route)).includes("optedOutReasonKey"));
}
for (const route of ["app/api/sales/auth/login/route.js", "app/api/sales/auth/invite/route.js"]) {
  ok(`${route} stamps a code beside its sentence`, /code:\s*["'A-Za-z_]/.test(decomment(read(route))));
}

// ── The two properties check-sales-home.mjs holds, asserted here too ──────
//
// That file asserts the two compliance screens render `{optedOutReason}` as a
// BARE EXPRESSION and never name one of the eight sources themselves. Both
// still hold, and both are easy to break from THIS side — resolving a key into
// a component instead of into a variable would break the first, and hard-coding
// a friendlier sentence would break the second. Asserted twice on purpose.
for (const screen of ["app/sales/leads/[id]/page.js", "app/sales/threads/[id]/page.js"]) {
  const src = decomment(read(screen));
  ok(`${screen} still renders {optedOutReason} as a bare expression`, /\{\s*optedOutReason\s*\}/.test(src));
  ok(
    `${screen} still asserts no mechanism of its own`,
    !/replied with an unsubscribe request/i.test(read(screen)),
  );
  ok(
    `…and the reason it renders came from the route, not from a branch here`,
    /optedOutReasonKey/.test(src) && !/optedOut\s*\?\s*["']/.test(src),
  );
}

// ═══════════════════════════════════════════════════════════════════════════
section("3. The sentence is the unit");
// ═══════════════════════════════════════════════════════════════════════════
//
// The defect this whole change exists to remove, in its most durable form:
// "FieldQuo works out what each person should be paid… Pagas a través de tu
// propio banco" — one sentence, two languages, because somebody translated the
// middle. It is cheap to reintroduce and invisible in review, so it is checked.

// ── A count is never decided by an English rule ──────────────────────────
const TOUCHED = [
  "lib/sales/dialSpace.js",
  "lib/sales/callingRules.js",
  "lib/sales/suppressionRules.js",
  "lib/sales/payoutDetails.js",
  "lib/sales/calls/dispositions.js",
  "lib/sales/checkin/signals.js",
  "lib/sales/notes/parents.js",
  "lib/sales/authRefusals.js",
  "lib/fetchJson.js",
  "app/components/sales/DialRegion.js",
  "app/components/sales/CallPanel.js",
  "app/components/sales/PayoutDestinationForm.js",
];
for (const path of TOUCHED) {
  const code = decomment(read(path));
  // `n === 1 ? "" : "s"` and every dialect of it. Four of the nine languages
  // this portal ships in disagree with that test, and Ukrainian needs three
  // forms — see lib/i18n/plurals.js.
  const ternaries = [...code.matchAll(/===\s*1\s*\?[^:]{0,40}:/g)].map((m) => m[0]);
  ok(`${path} decides no plural with a ternary`, ternaries.length === 0, ternaries);
}

// ── A translated fragment is never glued to a literal one ────────────────
//
// `t("…") + " some words"` and its template-literal twin. Concatenating a
// resolved sentence with an English one produces a paragraph half in each,
// which is the exact shape of the defect above. A join of a resolved sentence
// with ANOTHER resolved sentence is fine and is how the opt-out notice works,
// so the rule is about the LITERAL half.
for (const [path] of RESOLVES) {
  const code = decomment(read(path));
  const glued = [
    ...code.matchAll(/t\([^)]*\)\s*\+\s*["'][^"']*\p{L}{3}/gu),
    ...code.matchAll(/["'][^"']*\p{L}{3}[^"']*["']\s*\+\s*t\(/gu),
  ].map((m) => m[0]);
  ok(`${path} glues no English fragment onto a translated one`, glued.length === 0, glued);
}

// ── The catalogue's own halves ───────────────────────────────────────────
//
// A key whose English is a bare clause — no verb, opens or closes mid-sentence
// — is a fragment somebody will interpolate. Checked on the ones that carry a
// whole claim rather than on labels, which are legitimately one word.
{
  // Full stop, ideographic full stop, Gurmukhi danda, and the two marks that
  // can end one. NOT a guess about what a sentence looks like — the danda is
  // how Punjabi ends one, and a check that demanded a Latin period would be
  // demanding a worse translation, which is the trap check-app-catalogue's own
  // "NOT a gate — declension" note describes.
  const ENDS = /[.。।！？!?…]["'\u2019\u201d)\]]?\s*$/u;

  // The rule is comparative, not absolute: where ENGLISH is a whole sentence,
  // every language must be one too. That is exactly the property at stake —
  // "Pagas a través de tu propio banco" was a whole sentence in Spanish glued
  // to half an English one — and it takes no view on labels, which are
  // legitimately a noun phrase in every language ("Do not contact", "Phone").
  const claims = Object.keys(APP_MESSAGES.en).filter(
    (k) =>
      (k.startsWith("app.salesDial.space.") ||
        k.startsWith("app.salesDial.blocker.") ||
        k.startsWith("app.salesDial.unenforced.") ||
        k.startsWith("app.salesSuppression.reason.") ||
        k.startsWith("app.salesIntel.inference.") ||
        k.startsWith("app.salesIntel.opportunity.") ||
        k.startsWith("app.salesPay.readiness.") ||
        k.startsWith("app.salesAuth.") ||
        k.startsWith("app.fetchError.")) &&
      typeof APP_MESSAGES.en[k] === "string" &&
      ENDS.test(APP_MESSAGES.en[k]),
  );
  ok("there are claims to check", claims.length >= 40, claims.length);
  for (const key of claims) {
    for (const lang of LANGS) {
      const value = String(APP_MESSAGES[lang][key] ?? "");
      ok(
        `${key} is a whole sentence in ${lang}, as it is in English`,
        ENDS.test(value),
        value.slice(-40),
      );
    }
  }
}

// ═══════════════════════════════════════════════════════════════════════════
section("4. The English did not move, and the legal text did not get rewritten");
// ═══════════════════════════════════════════════════════════════════════════
//
// Two things this change was NOT allowed to do.

// describeSuppression's exact wording is asserted by
// check-sales-suppression.mjs. It stays here too, because the temptation from
// this side is to delete it once suppressionNotice exists — and its callers
// (an API error body, a log line, a check under bare node) have no reader
// whose language could be consulted.
{
  const row = { kind: "email", value: "bob@acme.com", source: "reply", requestedAt: new Date("2026-01-02") };
  const said = describeSuppression(row);
  ok("describeSuppression still names the person", /bob@acme\.com/.test(said), said);
  ok("…still states the principle", /binds FieldQuo/.test(said), said);
  ok("…and still answers null for no row", describeSuppression(null) === null);
}

// The jurisdiction table's own words are quoted, not translated. A blocker
// carrying statutory prose is flagged `legalText`, and the renderer labels it.
{
  const az = salesCallReadiness({
    prospect: { country: "US", province: "AZ" },
    now: new Date("2026-09-08T18:00:00Z"),
  });
  const flat = az.blockers.find((b) => b.legalText);
  ok("a flat statutory prohibition is flagged as quoted text", Boolean(flat), az.blockers.map((b) => b.code));
  ok("…and it is NOT given a fix key it would be translated through", !flat?.fixKey, flat?.fixKey);

  const tx = salesCallReadiness({
    prospect: { country: "US", province: "TX" },
    now: new Date("2026-09-08T18:00:00Z"),
  });
  const legalWarning = [...tx.warnings, ...tx.unenforced].find((w) => w.legalText);
  ok("a registration or data-acquisition rule is flagged too", Boolean(legalWarning), {
    warnings: tx.warnings.map((w) => w.code),
  });
  ok("…and its HEADING is still ours to translate", Boolean(legalWarning?.titleKey), legalWarning?.titleKey);

  const renderer = decomment(read("app/components/sales/DialRegion.js"));
  // BOTH sites, counted. Quoted legal text reaches a rep in two places — under
  // a blocker and in the citation panel — and asserting the label "appears"
  // was satisfied by either one, so deleting the other was invisible. Found by
  // mutation testing this file.
  const labelled = renderer.split("app.salesDial.quotedInEnglish").length - 1;
  ok("the renderer labels quoted legal text everywhere it shows any", labelled >= 2, labelled);
  ok("…and passes the flag through to every notice", /legalText=\{Boolean\(/.test(renderer));
  ok(
    "…including the citation panel, which is quoted statute with no blocker around it",
    /citation[\s\S]{0,400}app\.salesDial\.quotedInEnglish/.test(renderer),
  );
}

// The reader's language reaches the one string that is a formatted INSTANT
// rather than a sentence. A key cannot carry a date.
{
  const en = salesCallReadiness({
    prospect: { country: "US", province: "WA" },
    now: new Date("2026-09-08T09:00:00Z"),
  });
  const de = salesCallReadiness({
    prospect: { country: "US", province: "WA" },
    now: new Date("2026-09-08T09:00:00Z"),
    language: "de",
  });
  ok("an opening time is produced at all", Boolean(en.opensAtText), en.opensAtText);
  ok("…and it follows the reader's language", en.opensAtText !== de.opensAtText, {
    en: en.opensAtText,
    de: de.opensAtText,
  });
  ok(
    "…while the IANA zone stays an identifier in both",
    String(en.opensAtText).includes("America/") === String(de.opensAtText).includes("America/"),
  );
  for (const screen of ["app/sales/queue/page.js", "app/sales/leads/[id]/page.js"]) {
    ok(`${screen} hands the rules its reader's language`, /language,/.test(decomment(read(screen))));
  }
}

// ═══════════════════════════════════════════════════════════════════════════
console.log(`\n${failures.length ? "FAILED" : "PASSED"} — ${pass} passed, ${failures.length} failed`);
if (failures.length) {
  for (const name of failures) console.log(`  · ${name}`);
  process.exit(1);
}
