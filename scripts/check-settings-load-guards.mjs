// scripts/check-settings-load-guards.mjs
//
// Run: node --import ./scripts/alias-loader.mjs scripts/check-settings-load-guards.mjs
//
// A failed request must not render as a fact about the business.
//
// ── What this is guarding against, concretely ──────────────────────────────
//
// Five loads across the money-and-team settings screens were written as
//
//     fetch(url).then((r) => r.json()).then(setThing)
//
// with no status check. When a route 403s or 500s, Next sends a JSON body —
// `{ error: "…" }` — so `res.json()` SUCCEEDS. Nothing throws, no catch fires,
// and the page renders the error object as though it were the data:
//
//   /api/settings/members      → `Array.isArray` says no → "No team members yet."
//                                to a company of nine.
//   /api/time-entries          → same → an empty timesheet, immediately before
//                                somebody runs payroll off it.
//   /api/payouts (after a run) → not an array → `payouts.map` blanks the screen.
//   /api/settings/business-info on Settings → Payments → every field undefined
//                                → "Not connected to Stripe", with a Connect
//                                button, to a company that has been taking card
//                                payments for a year.
//   /api/settings/business-info on Settings → Company → the worst one. Every
//                                read is `data?.x || default`, so the page
//                                built a complete, editable, plausible company
//                                out of the defaults — Canada, CAD,
//                                America/Toronto, automatic tax on — and the
//                                Save button then PATCHed that invented company
//                                over the real one.
//
// ── Why the company page gets three assertions of its own ──────────────────
//
// It is the only one of the five with a Save button, so it is the only one
// where a failed load could DESTROY data rather than merely misreport it. The
// three halves of the fix are asserted separately because each fails on its
// own: guard the fetch, refuse to render the form, and send only the fields
// the page actually edits.
//
// ── Why it strips comments first ──────────────────────────────────────────
//
// Every one of these pages now carries a comment describing the shape it used
// to have — this file does too. Scanning the raw source would make the write-up
// of the bug match as the bug.

import { readFileSync } from "node:fs";

let pass = 0;
const failures = [];
// Label FIRST. Reversed, a non-empty string becomes the condition and nothing
// here could ever fail.
const ok = (label, cond) => (cond ? (pass++, undefined) : failures.push(label));

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");

function stripComments(src) {
  return src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^[ \t]*\/\/.*$/gm, "");
}

const PAGES = {
  company: "app/app/settings/company/page.js",
  payments: "app/app/settings/payments/page.js",
  team: "app/app/settings/team/page.js",
  timesheets: "app/app/settings/team/timesheets/page.js",
  payRun: "app/app/settings/team/payroll/page.js",
};

const src = Object.fromEntries(
  Object.entries(PAGES).map(([k, p]) => [k, stripComments(read(p))]),
);

// ── 1. No unchecked r.json() anywhere on these five pages ──────────────────
//
// The shape, not the words: `.then((r) => r.json())` with nothing between the
// response and the parse. `r.ok ? r.json() : …` does not match, and neither
// does fetchJson, which reads the body as text and throws on a bad status.
//
// Deliberately a SHAPE check rather than "does the file mention res.ok
// somewhere" — a page can check the status on one call and not on the next,
// which is exactly how /api/workers ended up guarded on the line below an
// unguarded /api/time-entries in the same Promise.all.
// The parameter is captured and required to be the SAME identifier on both
// sides, so `.then((r) => r.json())` matches and `.then((d) => other.json())`
// does not.
const UNCHECKED_JSON = /\.then\(\s*\(?\s*(\w+)\s*\)?\s*=>\s*\1\.json\(\)\s*\)/;

for (const [name, path] of Object.entries(PAGES)) {
  ok(
    `${path}: no unchecked .then(r => r.json())`,
    !UNCHECKED_JSON.test(src[name]),
  );
}

// A sanity assertion on the detector itself. A regex that matches nothing
// passes every file forever, which is the false-pass this whole file is about.
ok(
  "the unchecked-json detector actually matches the shape it forbids",
  UNCHECKED_JSON.test('fetch("/x").then((r) => r.json()).then(setThing)'),
);
ok(
  "...and does not match a guarded one",
  !UNCHECKED_JSON.test('fetch("/x").then((r) => (r.ok ? r.json() : []))'),
);
ok(
  "...and does not match fetchJson",
  !UNCHECKED_JSON.test('const d = await fetchJson("/x");'),
);

// ── 2. Empty and failed are different sentences ────────────────────────────
//
// Each of these pages has one line that makes a claim about the business when
// the list is empty. Every one of them used to fire on a failed request too.
// The claim must now be gated on knowing the read succeeded.
ok(
  "the team roster's empty state is gated on the load having succeeded",
  /loadFailed \?[\s\S]{0,400}app\.setTeam\.noMembers/.test(src.team),
);
ok(
  "the timesheet's empty state is gated on the load having succeeded",
  /loadFailed \?[\s\S]{0,400}app\.timesheets\.empty/.test(src.timesheets),
);
ok(
  "the pay run's empty state is gated on the load having succeeded",
  /loadError \?[\s\S]{0,400}app\.payrollRun\.noPayouts/.test(src.payRun),
);

// The seat tile printed `{seats.used}` — which is `undefined` when the read
// failed, and renders as nothing at all beside the words "seats used". A blank
// is not a number and it is not "we don't know" either.
ok(
  "the seat count says it doesn't know rather than rendering blank",
  /\{seats\.used \?\? "—"\}/.test(src.team),
);
// "It's just me — no crew right now" is derived from those same counts, so a
// failed read offered it to a company of nine.
ok(
  "the works-alone checkbox is not offered on an unknown seat count",
  /seats\.used != null/.test(src.team) && /!loadFailed/.test(src.team),
);

// ── 3. The company page: the one with a Save button ────────────────────────
ok(
  "the company page tracks a load failure",
  /const \[loadError, setLoadError\] = useState\(""\)/.test(src.company),
);
// The form must not render at all. `!form` alone was not enough: the failure
// mode that mattered was a response with the wrong STATUS but a parseable body,
// where `form` IS populated — from defaults.
ok(
  "the company page refuses to render the form after a failed load",
  /if \(loadError \|\| !form\)/.test(src.company),
);
// And the save must send what the page EDITS, not everything it loaded. Both
// of these have no control on the screen; both were PATCHed on every save.
ok(
  "the company save sends an explicit payload, not the whole form",
  /body: JSON\.stringify\(payload\(\)\)/.test(src.company) &&
    !/body: JSON\.stringify\(form\)/.test(src.company),
);
ok(
  "the company page no longer sends sitePublished",
  !/sitePublished/.test(src.company),
);
ok(
  "the company page no longer sends discoverable",
  !/discoverable/.test(src.company),
);
// Availability: `[]` means "they set none", which renders as seven closed days.
// A failed read must not make that statement.
ok(
  "a failed availability read is distinguished from no hours set",
  /hoursFailed/.test(src.company),
);
// The payment-schedule read fails CLOSED. `false` unlocks the free-text payment
// terms, and saving that while a schedule is really active is the "two that can
// disagree" state the card forbids.
ok(
  "the payment-schedule read fails closed, not open",
  /\.catch\(\(\) => setScheduleActive\(true\)\)/.test(src.company),
);

// ── 4. The pay run's re-read is array-guarded ──────────────────────────────
//
// It ran straight after a SUCCESSFUL pay run: `setPayouts(await fetch(...)
// .then(r => r.json()))`. A non-array there reaches `payouts.map` and blanks
// the screen at the exact moment somebody needs to see what just happened.
ok(
  "the pay run guards the shape of what it re-reads",
  /Array\.isArray\(data\) \? data : \[\]/.test(src.payRun),
);

// ── 5. Two controls that did nothing are gone ──────────────────────────────
//
// `emailSubscribed` was a ticked, labelled checkbox on the hire form that
// appeared in no request body and had no column — the whole lifetime of the
// value was the two lines of local state that rendered it.
const teamNew = stripComments(read("app/app/settings/team/new/page.js"));
ok(
  "the hire form no longer renders the emailSubscribed checkbox",
  !/emailSubscribed/.test(teamNew),
);

// "Apply to everyone", unticked, wrote `appliesToAll: false` — which
// buildPayRun excludes from the company-wide query, while the per-worker path
// it implies reads a join table nothing in the codebase ever writes.
const payrollSettings = stripComments(read("app/app/settings/payroll/page.js"));
ok(
  "the payroll form no longer offers an appliesToAll toggle",
  !/setDraft\(\{ \.\.\.draft, appliesToAll/.test(payrollSettings),
);
// The claim above is only true while nothing creates a WorkerSalaryComponent.
// The day something does, the toggle should come back — so this fails then,
// rather than leaving the removal in place for a reason that stopped holding.
const repoWide = [
  read("lib/payroll/buildPayRun.js"),
  read("app/api/settings/payroll-components/route.js"),
].join("\n");
ok(
  "nothing has started creating WorkerSalaryComponent rows (if it has, restore the toggle)",
  !/workerSalaryComponent\.(create|createMany|upsert)/i.test(repoWide),
);

// ── Report ─────────────────────────────────────────────────────────────────
console.log(
  `\ncheck-settings-load-guards: ${pass} passed, ${failures.length} failed`,
);
for (const f of failures) console.log(`  ✗ ${f}`);
if (failures.length) process.exitCode = 1;
