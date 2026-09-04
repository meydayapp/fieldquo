// scripts/check-appointment-status.mjs
//
// Run: node --import ./scripts/alias-loader.mjs scripts/check-appointment-status.mjs
//
// Every status a row on /app/appointments can hold renders as a coloured chip
// with a translated label — across all THREE vocabularies that calendar merges.
//
// ── What this is guarding against, concretely ──────────────────────────────
//
// The page printed `String(status).replace("_", " ")`, so a supervisor-gated
// visit rendered as the words "needs supervisor": lowercase, underscore-
// stripped, and English in a French office. That is the third occurrence of one
// bug — invoices printed `partially_refunded` at a contractor mid-chargeback,
// and the job detail badge said `unscheduled` while its own list said "Needs a
// date". Each time, one screen got the considered word and the other got
// whatever the database happened to hold.
//
// The colour half was worse and quieter. STATUS_STYLES had four keys, matching
// `enum AppointmentStatus` exactly — which LOOKS exhaustive and is not, because
// the calendar also carries Bookings (`pending_payment`, `confirmed`) and
// JobVisits (`on_the_way`, `in_progress`, `canceled`). Every unconverted
// booking on the page had been falling through to plain grey with the words
// "pending payment" beside it, and nothing anywhere failed.
//
// ── Why it reads the schema rather than a list of strings ──────────────────
//
// A hardcoded list here would agree with itself forever the day someone adds a
// value to any of the three — the check passing while the page fell behind is
// the exact shape of the bug. Both enums are parsed out of prisma/schema.prisma
// and VISIT_STATUS_LABELS is imported, and those three are the only authority.

import { readFileSync } from "node:fs";
import { APP_MESSAGES } from "@/app/i18n/appMessages";
import { VISIT_STATUS_LABELS, visitStatusLabel } from "@/lib/jobs/visitStatus";
import {
  APPOINTMENT_FILTERS,
  APPOINTMENT_STATUS_PRESENTATION,
  APPOINTMENT_TONE_CLASSES,
  appointmentFilterLabel,
  appointmentStatusClasses,
  appointmentStatusLabel,
  appointmentStatusPresentation,
} from "@/lib/appointments/statusLabels";

let pass = 0;
const failures = [];
// Argument order is (condition, label) — the same as check-invoice-status.mjs,
// this check's sibling. Stated because the repo has both orders in different
// scripts and a swapped pair passes silently: a non-empty label string is
// truthy, so every assertion "passes" and the check verifies nothing.
function ok(cond, label) {
  if (cond) pass++;
  else failures.push(label);
}

const readRaw = (p) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");
// Comments are prose about the bug and quote the very code they replaced —
// this file's own subject line, `s.replace("_", " ")`, appears verbatim in a
// comment on the page. Scanning raw source would let a comment satisfy an
// assertion about a render, which is a check that passes on a broken screen.
const strip = (s) =>
  s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
const read = (p) => strip(readRaw(p));

// A `t` that records what it was asked for and hands back a marker. Declared
// here rather than beside its first use because two sections need it, and a
// const used above its declaration is a TDZ crash, not a failed assertion.
const seen = [];
const fakeT = (key) => {
  seen.push(key);
  return `[${key}]`;
};

const PAGE = "app/app/appointments/page.js";
const src = read(PAGE);
const schema = readRaw("prisma/schema.prisma");

// ── 1. The enums, from the schema itself ───────────────────────────────────

function parseEnum(name) {
  const m = schema.match(new RegExp(`enum ${name}\\s*\\{([\\s\\S]*?)\\n\\}`));
  ok(!!m, `enum ${name} is present in prisma/schema.prisma`);
  return (m ? m[1] : "")
    .split("\n")
    .map((l) => l.replace(/\/\/.*$/, "").trim())
    .filter((l) => /^[a-z_]+$/.test(l));
}

const APPOINTMENT_STATUSES = parseEnum("AppointmentStatus");
const BOOKING_STATUSES = parseEnum("BookingStatus");
const VISIT_STATUSES = Object.keys(VISIT_STATUS_LABELS);

// Anchors. If a regex silently stops matching, every loop below iterates over
// an empty array and the whole check passes while asserting nothing.
ok(APPOINTMENT_STATUSES.length === 4, `AppointmentStatus parsed 4 values (got ${APPOINTMENT_STATUSES.length})`);
ok(APPOINTMENT_STATUSES.includes("needs_supervisor"), "the AppointmentStatus parse reaches needs_supervisor");
ok(BOOKING_STATUSES.length === 4, `BookingStatus parsed 4 values (got ${BOOKING_STATUSES.length})`);
ok(BOOKING_STATUSES.includes("pending_payment"), "the BookingStatus parse reaches pending_payment");
ok(VISIT_STATUSES.length >= 5, `VISIT_STATUS_LABELS carries its values (got ${VISIT_STATUSES.length})`);
ok(VISIT_STATUSES.includes("on_the_way"), "the visit label map still carries on_the_way");

const ALL = [...new Set([...APPOINTMENT_STATUSES, ...BOOKING_STATUSES, ...VISIT_STATUSES])];
// The union is the point of this check. Four would mean it had quietly gone
// back to being the AppointmentStatus-only map that shipped the bug.
ok(ALL.length >= 9, `the union of the three vocabularies is wide (got ${ALL.length})`);

// ── 2. Exhaustive both ways ────────────────────────────────────────────────

for (const s of ALL) {
  ok(
    Object.prototype.hasOwnProperty.call(APPOINTMENT_STATUS_PRESENTATION, s),
    `presentation covers "${s}"`,
  );
}
for (const k of Object.keys(APPOINTMENT_STATUS_PRESENTATION)) {
  ok(ALL.includes(k), `"${k}" is a real status of one of the three sources, not a stale key`);
}

// ── 3. Every status resolves to a real chip ────────────────────────────────

for (const s of ALL) {
  const cls = appointmentStatusClasses(s);
  ok(typeof cls === "string" && cls.length > 0, `"${s}" yields classes`);
  ok(!/undefined|null/.test(cls), `"${s}" classes contain no undefined/null`);
  ok(/bg-/.test(cls), `"${s}" actually paints a background`);
  const { tone } = appointmentStatusPresentation(s);
  ok(!!APPOINTMENT_TONE_CLASSES[tone], `"${s}" tone "${tone}" is defined`);
}

// Every literal Tailwind colour ramp needs its dark: half. `bg-muted` and
// `text-muted-foreground` are theme tokens that already flip, so they are
// exempt — the rule is about `bg-green-50`, which in a dark cab is a slab.
for (const [tone, cls] of Object.entries(APPOINTMENT_TONE_CLASSES)) {
  for (const literal of cls.match(/(?:^|\s)(?:bg|text|border)-[a-z]+-\d{2,3}(?:\/\d+)?/g) || []) {
    const util = literal.trim();
    const [prefix] = util.split("-");
    ok(
      new RegExp(`dark:${prefix}-`).test(cls),
      `tone "${tone}" pairs ${util} with a dark: ${prefix}`,
    );
  }
}

// ── 4. The labels exist, in every language ─────────────────────────────────
//
// appMessages.js is one dictionary per language in a single file, so counting
// occurrences across the whole file is what catches a key added to English
// only — the failure that ships an English word into a Punjabi office.

const messages = readRaw("app/i18n/appMessages.js");
const LANGS = Object.keys(APP_MESSAGES).length;
ok(LANGS >= 6, `found the language catalogue (got ${LANGS})`);

for (const s of ALL) {
  const { labelKey } = appointmentStatusPresentation(s);
  if (!labelKey) continue;
  const n = messages.split(`"${labelKey}":`).length - 1;
  ok(n === LANGS, `"${labelKey}" is translated ${LANGS}× (found ${n})`);
}

// ── 5. No status is left without a key ─────────────────────────────────────
//
// `on_the_way` was the one hole: no catalogue entry existed for it anywhere in
// the product, so it shipped English-only rather than borrowing "In progress",
// which means something else to a crew member. `app.status.onTheWay` exists
// now and is wired up, so the tolerance is gone: the next status added without
// a key fails the build here rather than reaching a French office in English.
const holes = Object.entries(APPOINTMENT_STATUS_PRESENTATION)
  .filter(([, v]) => !v.labelKey)
  .map(([k]) => k);
ok(holes.length === 0, `every status carries a catalogue key (holes: ${JSON.stringify(holes)})`);
ok(
  appointmentStatusPresentation("on_the_way").labelKey === "app.status.onTheWay",
  "on_the_way is wired to its own key, not borrowed from another status",
);

// ── 5b. The two modules cannot disagree about the same visit ───────────────
//
// A JobVisit shows on the job page (lib/jobs/visitStatus.js) and on this
// calendar, and both used to hold their own words: this one said "needs
// supervisor", that one said "On the way" in French. Shared keys are only a
// fix while they stay shared, so the overlap is asserted rather than trusted.
for (const [status, entry] of Object.entries(VISIT_STATUS_LABELS)) {
  const [visitKey] = entry;
  ok(
    Array.isArray(entry) && typeof visitKey === "string" && visitKey.startsWith("app."),
    `visitStatus.js holds a KEY for "${status}", not an English word (got ${JSON.stringify(entry)})`,
  );
  const { labelKey } = appointmentStatusPresentation(status);
  ok(
    labelKey === visitKey,
    `the job page and the calendar name "${status}" with one key (${visitKey} vs ${labelKey})`,
  );
}
// And the same word actually comes out of both, given the same `t`.
for (const status of VISIT_STATUSES) {
  ok(
    visitStatusLabel(status, fakeT) === appointmentStatusLabel(status, fakeT),
    `"${status}" renders identically on both screens`,
  );
}

// Every entry carries English regardless, so a language missing the key still
// gets a word rather than a snake_case one.
for (const s of ALL) {
  const { en } = appointmentStatusPresentation(s);
  ok(typeof en === "string" && en.length > 0 && !en.includes("_"), `"${s}" carries a readable English fallback`);
}

// ── 6. An unknown status degrades honestly ─────────────────────────────────
//
// A value added to a schema and deployed before the UI catches up must not
// borrow another status's colour or, worse, its WORD. "Completed" on a
// cancelled visit is a false statement about somebody's day.

for (const junk of ["", null, undefined, "abducted_by_aliens", "SCHEDULED", 7, {}]) {
  const cls = appointmentStatusClasses(junk);
  ok(typeof cls === "string" && !/undefined|null/.test(cls), `unknown status ${JSON.stringify(junk)} yields clean classes`);
  ok(appointmentStatusPresentation(junk).labelKey === null, `unknown status ${JSON.stringify(junk)} claims no label of its own`);
  const label = appointmentStatusLabel(junk, null);
  ok(typeof label === "string" && !label.includes("_"), `unknown status ${JSON.stringify(junk)} renders without underscores (got ${JSON.stringify(label)})`);
}
ok(
  appointmentStatusLabel("abducted_by_aliens", null) === "abducted by aliens",
  "an unknown status falls back to the tidied raw value, not a blank badge",
);

// The label really is the catalogue's, not the English fallback, when a `t` is
// supplied. A shared module that ignores its `t` is a translated label in
// source and an English one on screen.
for (const s of ALL) {
  const { labelKey } = appointmentStatusPresentation(s);
  if (!labelKey) continue;
  ok(appointmentStatusLabel(s, fakeT) === `[${labelKey}]`, `"${s}" routes its label through t()`);
}
ok(seen.length >= 8, `t() was actually consulted (${seen.length} lookups)`);

// ── 7. The filter row ──────────────────────────────────────────────────────

ok(APPOINTMENT_FILTERS[0] === "all", "the filter row leads with all");
for (const f of APPOINTMENT_FILTERS.slice(1)) {
  ok(APPOINTMENT_STATUSES.includes(f), `filter "${f}" is an AppointmentStatus a person here can actually set`);
}
for (const s of APPOINTMENT_STATUSES) {
  ok(APPOINTMENT_FILTERS.includes(s), `every AppointmentStatus is offered as a filter — "${s}"`);
}
ok(
  appointmentFilterLabel("all", fakeT) === "[app.jobs.filterAll]",
  "the all chip takes its word from the catalogue",
);
ok(
  appointmentFilterLabel("needs_supervisor", fakeT) === "[app.appts.supervisorRequired]",
  "the needs_supervisor chip is translated, not raw",
);

// ── 8. The page kept no private copy, and renders no raw column value ──────

ok(!/const STATUS_STYLES/.test(src), `${PAGE} declares no local STATUS_STYLES`);
ok(src.includes("appointmentStatusClasses"), `${PAGE} takes its chip classes from the shared module`);
ok(src.includes("appointmentStatusLabel"), `${PAGE} takes its badge wording from the shared module`);
ok(src.includes("appointmentFilterLabel"), `${PAGE} takes its chip wording from the shared module`);
// The literal bug. Comment-stripped, so the comment recording what was fixed
// cannot satisfy this.
ok(!/replace\(["']_["'],\s*["'] ["']\)/.test(src), `${PAGE} renders no underscore-stripped status`);
ok(!/\{s\.replace/.test(src), `${PAGE} filter chips render no raw filter value`);
ok(!/t\(`app\.status\.\$\{/.test(src), `${PAGE} builds no runtime translation key (check:translations cannot see one)`);
// The filter list is the module's, not a second array that would drift from it.
ok(
  /APPOINTMENT_FILTERS\.map\(/.test(src),
  `${PAGE} maps the shared filter list rather than its own array literal`,
);

// ── 9. A count is a claim ──────────────────────────────────────────────────
//
// The chips carry counts now. `useState([])` would make "Scheduled 0" the
// state of the page while the request is still in flight and after it fails —
// stating as fact the one thing the screen does not yet know. null ≠ 0.
ok(
  /const \[appointments, setAppointments\] = useState\(null\)/.test(src),
  `${PAGE} starts its list as null, not an empty array`,
);
ok(
  /if \(!appointments\) return null;/.test(src),
  `${PAGE} yields no counts at all until the list has loaded`,
);
ok(
  /\{filterCounts && \(/.test(src),
  `${PAGE} renders the count span only when there is a count`,
);
// The counts must be over the same list the chip filters, or the number and
// the result disagree on screen.
ok(
  /counts\[s\] = appointments\.filter\(\(a\) => a\.status === s\)\.length/.test(src),
  `${PAGE} counts each chip over the same predicate it filters by`,
);
// And the same distinction the empty state has to make. "No appointments in
// this view" over a request that never answered is a claim about a calendar
// nobody has read.
ok(
  /\{!loading && appointments && shown\.length === 0 && \(/.test(src),
  `${PAGE} says "empty" only when it knows the calendar is empty`,
);

// ── 10. The error banner survives dark mode, and offers the retry ──────────
//
// Byte-identical to the team schedule's `bg-red-50 text-red-700
// border-red-200` with no dark: half — a bright slab in a dark cab. And there
// was no retry at all, on a stack whose database scales to zero and whose first
// request after idle can fail with P1001; the only cure was reloading the route
// and losing the month, the selected day and every open row.
const errorBanner = src.match(/\{error && \([\s\S]{0,900}?\n\s{6}\)\}/);
ok(!!errorBanner, `${PAGE} still renders an error banner`);
const banner = errorBanner ? errorBanner[0] : "";
for (const util of banner.match(/(?:bg|text|border)-red-\d{2,3}(?:\/\d+)?/g) || []) {
  const [prefix] = util.split("-");
  ok(
    new RegExp(`dark:${prefix}-red-`).test(banner),
    `the error banner pairs ${util} with a dark: ${prefix}`,
  );
}
ok(/onClick=\{load\}/.test(banner), "the error banner's button re-runs the page's own loader");
ok(/app\.action\.retry/.test(banner), "the retry button is translated");
// A retry that is not wired to the thing that failed is the dead control this
// repo keeps finding. `load` has to be the same function the mount effect uses.
ok(
  /const load = useCallback\(async \(\) => \{/.test(src),
  `${PAGE} has one named loader`,
);
ok(
  /useEffect\(\(\) => \{\s*load\(\);\s*\}, \[load\]\);/.test(src),
  `${PAGE} loads on mount through that same loader`,
);
ok(
  /fetchJson\("\/api\/appointments"\)/.test(src.match(/const load = useCallback[\s\S]*?\n  \}, \[\]\);/)?.[0] || ""),
  "the loader really re-fetches the appointments",
);

// ── 11. The touch-target floor still holds on the chips ────────────────────
//
// px-3 py-1.5 measured 32px, under even the 36px floor this repo settled on,
// on the controls a crew member taps holding a phone in one hand. Adding a
// count inside the chip is exactly the sort of edit that reaches for a
// smaller pill.
const chipRow = src.match(/data-tour="appts-filters"[\s\S]*?<\/div>/);
ok(!!chipRow, `${PAGE} still has its filter row`);
ok(/min-h-\[44px\]/.test(chipRow ? chipRow[0] : ""), "the filter chips are 44px targets");

if (failures.length) {
  console.error(`check:appointment-status FAILED — ${failures.length} problem(s):`);
  for (const f of failures) console.error(`  ✗ ${f}`);
  process.exit(1);
}
console.log(
  `check:appointment-status passed — ${ALL.length} statuses across 3 sources × ${LANGS} languages, ` +
    `${APPOINTMENT_FILTERS.length} filters, ${pass} assertions.`,
);
