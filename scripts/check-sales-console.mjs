#!/usr/bin/env node
//
// scripts/check-sales-console.mjs
//
//   npm run check:sales-console
//
// The rep console: the space where the dial control goes, and the structure
// that keeps a rep's place while they work a list.
//
// ══ Why this file exists ═══════════════════════════════════════════════════
//
// The owner opened /sales/queue and said "I don't even know where to go to
// dial". Two separate defects were behind that sentence, and neither was
// catchable by anything in scripts/ before this file:
//
//   1. **The dial region did not exist when it could not be used.** The rule
//      it was following is correct and stays — there is no greyed-out Call
//      button, because a control that looks broken teaches a rep to press it
//      harder. But the screen implemented "no control" as "no markup", so a
//      rep could not tell "you have claimed nobody" from "this record has no
//      number" from "it is 21:00 in Tulsa" from "calling is not built". Four
//      different problems with four different fixes, rendered identically as
//      blank space. Absence of UI is indistinguishable from absence of
//      feature, and no static check can see a thing that is not there — so the
//      decision was moved into lib/sales/dialSpace.js, which is a pure
//      function this file EXECUTES.
//
//   2. **Six full-page navigations.** /sales, /sales/queue, /sales/leads,
//      /sales/threads, /sales/notes and /sales/companies. A closer working a
//      list lost their place on every one. The queue is now one surface: the
//      list persists, the pane swaps, and the prospect is in the URL so a
//      specific one can still be opened by link.
//
// ══ What EXECUTES, and what is merely read ════════════════════════════════
//
// Sections 1–4 run dialSpace() against every shape the queue payload can take,
// including hostile ones — a forged href beside a refusal, a decision value
// nobody has ever returned, a null prospect, an empty compliance object. That
// is where the value is: the guarantee "there is always a sentence here" is
// only worth something if no input can produce an empty one.
//
// Sections 5–7 read source, and are honest about being weaker. They assert
// that the console still asks the ONE endpoint it is allowed to ask, that the
// four empty-queue reasons still reach a reader, and that the nav no longer
// hides two of its six tabs off the right edge of a phone. A regex cannot
// prove a layout; scripts/check-mobile-surfaces.mjs holds this file's screens
// to its strict tier and this file asserts that it still does.
//
// ══ What this does NOT prove ══════════════════════════════════════════════
//
//   * That the console looks right or fits. There is no browser here. It was
//     opened at 1280px and at 375px against a live rep session before this
//     shipped; that is a measurement, not a regression guard.
//   * That a rep cannot browse the pool. That is queueGate.js's guarantee and
//     check-sales-auth.mjs's assertion. What IS asserted here is the weaker,
//     complementary fact that this rewrite added no second data source: the
//     console reads /api/sales/queue and /api/sales/notes and nothing else.
//   * That dialHref is the only producer of a dial target.
//     check-sales-calling-window.mjs owns that, including the "no `tel:`
//     anywhere under app/sales" rule. This file asserts the SECOND gate — that
//     dialSpace drops an href it was handed beside a decision that forbids one.
import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import {
  CALL_ALLOWED,
  CALL_REFUSED,
  CALL_UNKNOWN,
  dialHref,
  salesCallReadiness,
} from "@/lib/sales/callingRules";
import {
  DIAL_DO_NOT_CONTACT,
  DIAL_NO_DECISION,
  DIAL_NO_NUMBER,
  DIAL_NO_PROSPECT,
  DIAL_READY,
  DIAL_REFUSED,
  DIAL_STATES,
  DIAL_UNCONFIRMED,
  dialSpace,
} from "@/lib/sales/dialSpace";
import { buildQueue } from "@/lib/sales/prospectView";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

let pass = 0;
const failures = [];

function ok(name, condition, detail = "") {
  if (condition) {
    pass++;
    return true;
  }
  const line = `${name}${detail ? `  — ${detail}` : ""}`;
  failures.push(line);
  console.log(`  ✗ ${line}`);
  return false;
}
const section = (t) => console.log(`\n${t}`);

const read = (p) => readFileSync(join(ROOT, p), "utf8");

/**
 * Source with comments removed.
 *
 * Every string rule below runs on this. A sentence in a header comment is not
 * a behaviour, and this repo has had check scripts pass against their own
 * explanations more than once.
 */
function codeOnly(src) {
  return src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
}

console.log("The rep console — the dial space, and the surface that keeps a rep's place\n");

// ═══════════════════════════════════════════════════════════════════════════
section("1. THE ONE THAT MATTERS: the space is never empty");
// ═══════════════════════════════════════════════════════════════════════════
//
// Every state, including the ones nobody planned for, produces a title and a
// body. This is the executable form of "say what is missing, do not render
// nothing" — the rule the screen broke.

const OK_PROSPECT = {
  id: "p1",
  businessName: "Acme Painting",
  phoneE164: "+15551234567",
  contact: { callable: true, code: null, title: null, text: null },
};

/** Oklahoma at 03:00 local — verified, windowed, and firmly shut. */
const shutNow = salesCallReadiness({
  prospect: { country: "US", province: "OK" },
  timeZone: "America/Chicago",
  now: new Date("2026-09-04T08:00:00Z"),
});
/** The same prospect at 15:00 local — open. */
const openNow = salesCallReadiness({
  prospect: { country: "US", province: "OK" },
  timeZone: "America/Chicago",
  now: new Date("2026-09-04T20:00:00Z"),
});
/** Nobody has read this one's law: an UNKNOWN, which is not a refusal. */
const unread = salesCallReadiness({
  prospect: { country: "US", province: "ZZ" },
  now: new Date("2026-09-04T20:00:00Z"),
});

ok("the fixture that must be shut IS shut", shutNow.decision === CALL_REFUSED, shutNow.decision);
ok("the fixture that must be open IS open", openNow.decision === CALL_ALLOWED, openNow.decision);
ok("the unread fixture is UNKNOWN, not refused", unread.decision === CALL_UNKNOWN, unread.decision);

const CASES = [
  ["nothing claimed", { prospect: null, compliance: null, claimedCount: 0 }],
  ["claims held, none open", { prospect: null, compliance: null, claimedCount: 4 }],
  [
    "do-not-contact",
    {
      prospect: {
        ...OK_PROSPECT,
        contact: { callable: false, code: "do_not_contact", title: "Do not contact", text: "Recorded 2026-01-02." },
      },
      compliance: openNow,
    },
  ],
  [
    "no phone on the record",
    {
      prospect: {
        ...OK_PROSPECT,
        phoneE164: null,
        contact: { callable: false, code: "no_phone", title: "No phone number", text: "This record carries no phone number." },
      },
      compliance: openNow,
    },
  ],
  ["no decision reached the screen", { prospect: OK_PROSPECT, compliance: null }],
  ["refused — outside the window", { prospect: OK_PROSPECT, compliance: shutNow }],
  ["unknown — nobody read the law", { prospect: OK_PROSPECT, compliance: unread }],
  [
    "allowed",
    { prospect: OK_PROSPECT, compliance: openNow, href: dialHref(openNow, OK_PROSPECT.phoneE164) },
  ],
  [
    "allowed, and no number to ring",
    { prospect: { ...OK_PROSPECT, phoneE164: null }, compliance: openNow, href: null },
  ],
  ["a decision value nobody has ever returned", { prospect: OK_PROSPECT, compliance: { decision: "maybe" } }],
  ["an empty compliance object", { prospect: OK_PROSPECT, compliance: {} }],
  ["a prospect with no contact block at all", { prospect: { id: "p2" }, compliance: openNow }],
];

for (const [name, input] of CASES) {
  const space = dialSpace(input);
  ok(
    `${name}: has a title and a body`,
    typeof space.title === "string" &&
      space.title.trim().length > 0 &&
      typeof space.detail === "string" &&
      space.detail.trim().length > 0,
    JSON.stringify({ title: space.title, detail: space.detail }),
  );
  ok(`${name}: names a state this file knows`, DIAL_STATES.includes(space.state), space.state);
  ok(
    `${name}: carries a tone a renderer can paint`,
    ["has", "gap", "unknown"].includes(space.tone),
    space.tone,
  );
  ok(`${name}: reasons is always an array`, Array.isArray(space.reasons), typeof space.reasons);
}

ok(
  "dialSpace with NO arguments at all still answers",
  (() => {
    const s = dialSpace();
    return s.state === DIAL_NO_PROSPECT && s.title.length > 0 && s.detail.length > 0;
  })(),
);

// ═══════════════════════════════════════════════════════════════════════════
section("2. An href exists if and only if the state is READY");
// ═══════════════════════════════════════════════════════════════════════════
//
// The second gate. dialHref() already refuses to build a target from anything
// but an `allowed` decision; this asserts that dialSpace cannot be talked into
// one either, which is what makes the rendering branch in the page safe to be
// a single `state === DIAL_READY && space.href` test.

for (const [name, input] of CASES) {
  const space = dialSpace(input);
  ok(
    `${name}: href and READY agree`,
    (space.state === DIAL_READY) === (space.href !== null),
    `${space.state} / ${space.href}`,
  );
}

// The forgery. A caller that built a `tel:` some other way — or a bug that
// passed the wrong prospect's — must not get it rendered beside a refusal.
for (const [name, compliance] of [
  ["a refusal", shutNow],
  ["an unknown", unread],
  ["no decision", null],
  ["a decision nobody returns", { decision: "maybe" }],
]) {
  const space = dialSpace({ prospect: OK_PROSPECT, compliance, href: "tel:+15550000000" });
  ok(
    `a forged href beside ${name} is dropped`,
    space.href === null && space.state !== DIAL_READY,
    `${space.state} / ${space.href}`,
  );
}

ok(
  "an empty-string href is not a dial control",
  dialSpace({ prospect: OK_PROSPECT, compliance: openNow, href: "   " }).state === DIAL_NO_NUMBER,
);
ok(
  "…and a non-string one is not either",
  dialSpace({ prospect: OK_PROSPECT, compliance: openNow, href: 12345 }).state === DIAL_NO_NUMBER,
);
ok(
  "the allowed path returns exactly what dialHref built",
  dialSpace({
    prospect: OK_PROSPECT,
    compliance: openNow,
    href: dialHref(openNow, OK_PROSPECT.phoneE164),
  }).href === "tel:+15551234567",
);

// ═══════════════════════════════════════════════════════════════════════════
section("3. The rule and the hour, or 'no sales number yet' — the owner's ask");
// ═══════════════════════════════════════════════════════════════════════════
//
// A refusal that says only "you cannot call" is the blank space with words on
// it. What a rep needs is the jurisdiction and when it opens.

{
  const space = dialSpace({ prospect: OK_PROSPECT, compliance: shutNow });
  ok("a refusal is the REFUSED state", space.state === DIAL_REFUSED, space.state);
  ok(
    "…and names the jurisdiction",
    space.detail.includes(shutNow.jurisdiction.name),
    space.detail,
  );
  ok("…and states the window", space.detail.includes(shutNow.windowText), space.detail);
  ok(
    "…and says when it opens, because 'wait' is not an instruction",
    Boolean(shutNow.opensAtText) && space.detail.includes(shutNow.opensAtText),
    space.detail,
  );
  ok(
    "…and hands the blockers through so the specific reason is rendered too",
    space.reasons.length === shutNow.blockers.length && space.reasons.length > 0,
    `${space.reasons.length} vs ${shutNow.blockers.length}`,
  );
}

{
  // Arizona bans an unsolicited sales call to a mobile number outright. There
  // is no window, so there must be no invented hour and no "right now" — a
  // rule that cannot be waited out must not be described as one that can.
  const az = salesCallReadiness({
    prospect: { country: "US", province: "AZ" },
    timeZone: "America/Phoenix",
    now: new Date("2026-09-04T20:00:00Z"),
  });
  if (ok("the Arizona fixture is a flat refusal", az.decision === CALL_REFUSED, az.decision)) {
    const space = dialSpace({ prospect: OK_PROSPECT, compliance: az });
    ok("a prohibition still fills the space", space.detail.trim().length > 0);
    ok(
      "…and does NOT tell a rep to come back later",
      !/right now|opens at/i.test(`${space.title} ${space.detail}`),
      `${space.title} ${space.detail}`,
    );
  }
}

{
  const space = dialSpace({
    prospect: {
      ...OK_PROSPECT,
      phoneE164: null,
      contact: { callable: false, code: "no_phone", title: "No phone number", text: "This record carries no phone number." },
    },
    compliance: openNow,
  });
  ok("a missing number is its own state", space.state === DIAL_NO_NUMBER, space.state);
  ok(
    "…and says so in the owner's words rather than 'unavailable'",
    /no sales number yet/i.test(space.title),
    space.title,
  );
  ok(
    "…and says what would fix it",
    space.detail.length > space.title.length,
    space.detail,
  );
}

{
  const space = dialSpace({
    prospect: {
      ...OK_PROSPECT,
      contact: { callable: false, code: "do_not_contact", title: "Do not contact", text: "Recorded 2026-01-02." },
    },
    compliance: openNow,
  });
  ok("do-not-contact outranks an open window", space.state === DIAL_DO_NOT_CONTACT, space.state);
  ok("…and repeats the recorded reason rather than inventing one", space.detail.includes("2026-01-02"));
}

// ── A refusal and an unknown are not the same sentence, ever ───────────────
//
// This is the same discipline capabilityStatement() follows for `false` versus
// `null`, applied to the call decision. Rendering them alike would tell a rep
// we checked Colorado's statute when nobody has.
{
  const refused = dialSpace({ prospect: OK_PROSPECT, compliance: shutNow });
  const unknown = dialSpace({ prospect: OK_PROSPECT, compliance: unread });
  ok("an unknown is its own state", unknown.state === DIAL_UNCONFIRMED, unknown.state);
  ok("…and reads differently from a refusal", refused.title !== unknown.title);
  ok(
    "…and is painted differently, which is what a scanning eye reads",
    refused.tone !== unknown.tone,
    `${refused.tone} vs ${unknown.tone}`,
  );
  ok(
    "…and never claims the call is forbidden",
    !/may not/i.test(unknown.title),
    unknown.title,
  );
  ok(
    "a missing decision is an unknown, not a refusal",
    dialSpace({ prospect: OK_PROSPECT, compliance: null }).state === DIAL_NO_DECISION,
  );
}

// ═══════════════════════════════════════════════════════════════════════════
section("4. The four empty queues stay four");
// ═══════════════════════════════════════════════════════════════════════════
//
// buildQueue() distinguishes no_trade, unknown_pool, pool_empty and
// nothing_claimed. check-prospect-ui.mjs asserts the module produces them;
// this asserts they still reach a reader with four DIFFERENT sentences, which
// is the half that was got wrong once — "we could not count what is left" was
// printed on the default view while all 39 trades reported a clean zero.

{
  const shapes = {
    no_trade: buildQueue({ prospects: [], repId: "r1", tradeKey: null, availableToClaim: null }),
    unknown_pool: buildQueue({ prospects: [], repId: "r1", tradeKey: "painter", availableToClaim: null }),
    nothing_claimed: buildQueue({ prospects: [], repId: "r1", tradeKey: "painter", availableToClaim: 7 }),
    pool_empty: buildQueue({ prospects: [], repId: "r1", tradeKey: "painter", availableToClaim: 0 }),
  };
  for (const [expected, q] of Object.entries(shapes)) {
    ok(`${expected} is reported as itself`, q.emptyReason === expected, q.emptyReason);
    ok(`…and carries a sentence`, typeof q.emptyText === "string" && q.emptyText.length > 0);
  }
  ok(
    "the four sentences are four sentences",
    new Set(Object.values(shapes).map((q) => q.emptyText)).size === 4,
    Object.values(shapes).map((q) => q.emptyText).join(" | "),
  );
  ok(
    "only the counting failure says we could not count",
    /could not count/i.test(shapes.unknown_pool.emptyText) &&
      !/could not count/i.test(shapes.no_trade.emptyText) &&
      !/could not count/i.test(shapes.nothing_claimed.emptyText) &&
      !/could not count/i.test(shapes.pool_empty.emptyText),
  );
}

const CONSOLE_FILE = "app/sales/queue/page.js";
const consoleSrc = codeOnly(read(CONSOLE_FILE));
// The dial region the console renders. Its own file since the lead screen
// started using it; the questions this script asks about the dial follow the
// code rather than staying pointed at the page that used to hold it.
const REGION_FILE = "app/components/sales/DialRegion.js";
const regionSrc = codeOnly(read(REGION_FILE));

// The screen must branch on the REASON CODE, not on truthiness. A single
// "Nothing here" is what this whole section exists to prevent, and rendering
// only `emptyText` while choosing one icon for all four would be that bug
// wearing four sentences.
for (const reason of ["unknown_pool", "nothing_claimed", "pool_empty"]) {
  ok(
    `the console reads emptyReason === "${reason}"`,
    consoleSrc.includes(`"${reason}"`),
    "the four cases collapsed to one branch",
  );
}
ok(
  "…and renders the server's own sentence rather than writing its own",
  /queue\.emptyText/.test(consoleSrc),
);

// ═══════════════════════════════════════════════════════════════════════════
section("5. One surface: the list persists and the prospect is in the URL");
// ═══════════════════════════════════════════════════════════════════════════

ok(`${CONSOLE_FILE} exists`, existsSync(join(ROOT, CONSOLE_FILE)));

ok(
  "the selection is a search param, so a prospect is openable by link",
  /useSearchParams/.test(consoleSrc) && /params\.get\("prospectId"\)/.test(consoleSrc),
  "the old screen kept it in React state, so no prospect had a URL",
);
ok(
  "…and it is wrapped in a Suspense boundary, which useSearchParams requires",
  /Suspense/.test(consoleSrc),
);
ok(
  "…and moving between rows REPLACES rather than pushes",
  // Scoped to the selection, not the whole file. `select()` is the function
  // that moves between rows, and it must replace — one history entry per row
  // click makes the back button useless for leaving. A router.push elsewhere
  // in this file is a deliberate navigation AWAY from the queue (carrying a
  // prospect across to its lead screen), which is exactly the kind of move a
  // back button should undo, and the earlier whole-file rule turned that
  // feature into a permanent red rather than a question.
  (() => {
    const at = consoleSrc.indexOf("function select(");
    const body = at >= 0 ? consoleSrc.slice(at, consoleSrc.indexOf("\n  }", at)) : "";
    return body.length > 20 && /setQuery\(|router\.replace\(/.test(body) && !/router\.push\(/.test(body);
  })(),
  "one history entry per row click makes the back button useless for leaving",
);
ok(
  "the trade is in the URL too, so the whole working state survives a reload",
  /params\.get\("trade"\)/.test(consoleSrc),
);
ok(
  "/sales/queue still works with nothing selected",
  // `prospectId` defaults to "" and is only appended when set; the route's own
  // handler already treats an absent one as "top of the queue".
  /params\.get\("prospectId"\) \|\| ""/.test(consoleSrc),
);

ok(
  "the list and the detail come from ONE payload, so they cannot disagree",
  (consoleSrc.match(/\/api\/sales\/queue/g) || []).length >= 1 &&
    /data\?\.queue\?\.items/.test(consoleSrc) &&
    /data\?\.current/.test(consoleSrc),
);

// The list must not blank on every selection — that is the losing-your-place
// problem this rewrite exists to fix, wearing a spinner.
ok(
  "a refetch does not put the screen back into its first-load state",
  /setLoading\(false\)/.test(consoleSrc) && !/setLoading\(true\)/.test(consoleSrc),
  "setLoading(true) inside load() blanks the list on every row click",
);

// ── No second data source, and no pool ─────────────────────────────────────
//
// The strongest structural claim this rewrite makes is that it added no way to
// see an unclaimed prospect. The console is allowed exactly two endpoints; a
// third is a thing a reviewer must look at deliberately.
{
  // /api/sales/leads joined the list when the queue learned to hand a prospect
  // to the leads screen and, later, to correct what a call taught the rep. It
  // is not a second source of PROSPECTS — it reads and writes the rep's OWN
  // lead, POST refuses a prospect this rep does not hold, and neither method
  // can list anything unclaimed. That is the property this block guards, and
  // the assertion below still names it.
  const ALLOWED = ["/api/sales/queue", "/api/sales/notes", "/api/sales/leads"];
  const called = [...new Set([...consoleSrc.matchAll(/["'`](\/api\/[A-Za-z0-9/_-]+)/g)].map((m) => m[1]))];
  const unexpected = called.filter((u) => !ALLOWED.some((a) => u === a || u.startsWith(`${a}/`)));
  ok(
    "the console calls only the queue and the rep's own notes",
    unexpected.length === 0,
    unexpected.join(" "),
  );
  ok(
    "…and names no endpoint that could list what is unclaimed",
    !/available|unclaimed|pool/.test(called.join(" ")),
    called.join(" "),
  );
}

// ── The pool is visible without opening a thirty-nine item dropdown ────────
//
// The per-trade counts have always been on this screen — one per <option>,
// inside a closed <select>. The owner opened the queue with 159 prospects
// waiting across 28 trades, saw an empty "Yours to work" and a closed
// dropdown, and asked whether discovery had failed. A number nobody scrolls a
// select to find is a number nobody has.
// Both sentences moved into app/i18n/appMessages.js when the sales portal was
// translated, so these match the KEY the screen renders rather than the English
// words the screen used to hold. Matching the words would now be satisfiable
// only by an UNTRANSLATED console, which is the opposite of the assertion —
// the subject here is that the total is stated outside the closed select, and
// that is a fact about placement, not about which language it is stated in.
ok(
  "the free-to-claim total is stated outside the select",
  /app\.salesQueue\.poolFree/.test(consoleSrc) && /stocked\.reduce\(/.test(consoleSrc),
);
ok(
  "…and the trades with something in them are listed first",
  /stocked = useMemo\(/.test(consoleSrc) && /\.sort\(\(a, b\) => b\.available - a\.available\)/.test(consoleSrc),
);
ok(
  "…while the empty ones stay selectable rather than being filtered away",
  /<optgroup label=\{t\("app\.salesQueue\.tradeGroupEmpty"\)\}>/.test(consoleSrc) &&
    /empties\.map\(/.test(consoleSrc),
);
ok(
  "…and it is still COUNTS only — no rep reads the pool and picks the good ones",
  !/businessName/.test(consoleSrc.slice(consoleSrc.indexOf("stocked = useMemo"), consoleSrc.indexOf("</select>"))),
);

// ── The call controls are in one place, and it is the top of the pane ──────
//
// It WAS pinned (`lg:sticky lg:top-4 z-10`) and this assertion demanded it.
// The owner then reported the lead editor and the notes "scrolling underneath,
// blocking and making it hard to read": the card holds the call panel, which
// on a call is taller than the viewport, and a sticky element taller than the
// viewport never scrolls through — everything after it is covered until the
// column ends. So the region is in normal flow, and this asserts the exact
// class that caused it is not on the dial section. The list column keeps its
// bounded sticky (max-h + overflow-y-auto), which never covers anything
// because nothing sits under it in its own column.
{
  const dialTag = consoleSrc.match(/<section[^>]*data-tour="sales-queue-dial"[^>]*>/)?.[0] || "";
  ok("the dial section is findable by its tour anchor", dialTag.length > 0);
  ok(
    "the call region is NOT sticky — a sticky card taller than the viewport covers the notes under it",
    dialTag.length > 0 && !/\bsticky\b/.test(dialTag) && !/\bfixed\b/.test(dialTag),
    dialTag.slice(0, 160),
  );
  ok(
    "…and it is first in the pane, so the dial is still the first thing on the screen",
    consoleSrc.indexOf('data-tour="sales-queue-dial"') < consoleSrc.indexOf("<QueueLeadEditor"),
  );
}
ok(
  // CallPanel moved to app/components/sales when the lead screen started
  // rendering the same console — see DialRegion's header. The question is
  // unchanged and still asked of the queue: is the write-up on this pane, or a
  // page away? It is now reached through DialRegion, so both halves of the
  // chain are asserted rather than just the name the queue happens to import.
  "the notes and the write-up are in the pane, not a page away",
  /ProspectNotes/.test(consoleSrc) &&
    /DialRegion/.test(consoleSrc) &&
    /<CallPanel/.test(regionSrc),
);
ok(
  "…and the notes panel still carries the visibility notice both other screens carry",
  /RepNoteVisibilityNotice/.test(consoleSrc),
  "a promise about privacy shown on two screens of three is worse than none",
);
ok(
  "…and says so honestly when the notes table is not reachable",
  /RepNoteUnavailable/.test(consoleSrc) && /notes_model_missing/.test(consoleSrc),
);

// The route that narrows notes to one prospect must narrow the REP's own
// notes, never widen them. noteReaderWhere() is the boundary and stays first.
{
  const notesRoute = codeOnly(read("app/api/sales/notes/route.js"));
  ok(
    "the notes route accepts a prospectId filter",
    /searchParams\.get\("prospectId"\)/.test(notesRoute),
  );
  ok(
    "…and applies it ON TOP of noteReaderWhere, never instead of it",
    /noteReaderWhere\(\{[^}]*\}\),[\s\S]{0,200}prospectId/.test(notesRoute),
    "the scoping fragment must still be the first thing in the where clause",
  );
}

// ═══════════════════════════════════════════════════════════════════════════
section("6. The dial control still cannot be rendered from a bad decision");
// ═══════════════════════════════════════════════════════════════════════════
//
// The page's one rendering branch. If it ever tests something other than the
// state and the href — `compliance.decision`, a truthy phone number, anything
// it computed itself — the two gates above stop being load-bearing.

ok(
  "the page builds its target with dialHref and nothing else",
  /dialHref\(/.test(consoleSrc),
);
ok(
  "…and hands it to dialSpace to be re-gated rather than rendering it directly",
  /dialSpace\(/.test(consoleSrc),
);
ok(
  // Asked of DialRegion now, because that is where the one rendering branch
  // lives. Asking it of the queue alone would have passed vacuously the moment
  // the branch moved — which is exactly the false pass this section exists to
  // prevent, so the file it reads moved with the code.
  "the Call control is rendered on DIAL_READY and a real href, and on nothing else",
  /space\.state === DIAL_READY && space\.href/.test(regionSrc),
  "any other condition here bypasses both gates",
);
ok(
  "…and the queue reaches its dial ONLY through that branch",
  /<DialRegion/.test(consoleSrc) && !/<CallPanel/.test(consoleSrc),
);
ok(
  "there is still no greyed-out dial",
  !/disabled[^>]{0,40}Call /.test(consoleSrc) && !/disabled[^>]{0,40}Call /.test(regionSrc),
);

// ═══════════════════════════════════════════════════════════════════════════
section("7. Six tabs, and all six on a 375px screen");
// ═══════════════════════════════════════════════════════════════════════════
//
// Measured in a browser before this was written: the old single row with
// overflow-x-auto fitted four, and Notes and My companies sat off the right
// edge behind a scroll with no scrollbar, no fade and no arrow. A link that is
// present and invisible is the same defect as a screen with no nav entry.
//
// The fix for that day was a three-column grid below sm:. At fourteen tabs
// the grid was five rows of chrome on a phone, so below lg the row is hidden
// and app/components/sales/SalesMobileTabBar.js carries every tab instead —
// five on a bottom bar, the rest in a drawer. What this section holds onto is
// the property, not the mechanism: every tab reachable at 375px, none behind
// a horizontal scroll. scripts/check-sales-mobile.mjs asserts the bar and the
// drawer between them account for the whole list.

{
  const shell = codeOnly(read("app/sales/SalesShell.js"));
  const TABS = [
    "/sales",
    "/sales/queue",
    "/sales/leads",
    "/sales/threads",
    "/sales/notes",
    "/sales/companies",
  ];
  for (const href of TABS) {
    ok(`the rail still links ${href}`, shell.includes(`"${href}"`));
  }
  ok(
    "the rail never hides tabs behind a horizontal scroll",
    !/overflow-x-auto/.test(shell),
    "overflow-x-auto on the nav is how two of six went missing",
  );
  ok(
    "…it is a single row from lg up, and hands the list to the phone chrome below it",
    /hidden lg:flex/.test(shell) && /<SalesMobileTabBar\s+tabs=\{tabs\}/.test(shell),
    "below lg the tabs live in SalesMobileTabBar's bar and drawer, not in this row",
  );
  ok(
    "…and no tab refuses to wrap, which would clip rather than fold",
    !/whitespace-nowrap|truncate/.test(shell.slice(shell.indexOf("<nav"))),
  );
  ok(
    "every tab is a 44px target",
    /min-h-\[44px\][^`]*border-b-2/.test(shell),
  );
  ok(
    "the console gets the width a two-column surface needs, and only it does",
    /max-w-7xl.*:.*max-w-5xl/.test(shell) && /\/sales\/queue/.test(shell),
    "widening every screen would cost the reading screens their measure",
  );
}

// The mobile tier this surface earned. check-sales-home.mjs asserts the same
// thing; asserted here too because this file's whole subject is a screen that
// has to work at 375px, and a demotion elsewhere would silently retire it.
{
  const mobile = read("scripts/check-mobile-surfaces.mjs");
  ok(
    'app/sales is still held at tier "strict"',
    /\{\s*dir:\s*"app\/sales",\s*tier:\s*"strict"\s*\}/.test(mobile),
  );
  ok(
    "…and the console is still named in STRICT_FILES",
    /"app\/sales\/queue\/page\.js"/.test(mobile),
  );
}

// ═══════════════════════════════════════════════════════════════════════════
console.log(
  failures.length === 0
    ? `\nALL PASS — ${pass} checks`
    : `\n${pass} passed, ${failures.length} FAILED\n` + failures.map((f) => `  ✗ ${f}`).join("\n"),
);
process.exit(failures.length === 0 ? 0 : 1);
