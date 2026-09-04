#!/usr/bin/env node
//
// scripts/check-sales-home.mjs
//
//   npm run check:sales-home
//
// The regression guard for the sales rep portal's front door, and for two
// properties of the WHOLE /sales surface that nothing else was asserting.
//
// ══ Why this file exists ═══════════════════════════════════════════════════
//
// Three separate holes, each of which had already produced a real defect:
//
//   1. **A field returned and never rendered.** /api/sales/me has sent
//      `signupLink` and `signups` since the day it was written and NOTHING in
//      the portal read either — AGENTS.md's first recurring failure class, on
//      the one artefact a rep physically hands to a contractor. There was no
//      check that could have noticed, because "an API field with no reader" is
//      invisible to every route-level check in the repo.
//
//   2. **No reachability audit for /sales.** scripts/check-nav-audit.mjs walks
//      app/app and app/platform and asserts every page is reachable from a
//      nav. It does not walk app/sales. So the portal was the one staff
//      surface where a screen could ship with no way to open it — the exact
//      failure that file exists to prevent, on the surface the standing rules
//      call the most important one.
//
//   3. **The arbitrary-hex rule covered one file.** check-platform-console.mjs
//      asserts SalesShell.js names no raw hex, because SalesShell.js is where
//      that bug was found and fixed. The identical line survived in
//      /sales/login and /sales/invite — 2.80:1 on the ground those pages paint
//      — for exactly as long as the rule was scoped to one file. The rule is
//      the whole tree here.
//
// ══ What EXECUTES, and why that half matters most ═════════════════════════
//
// app/sales/nextAction.js decides the one sentence at the top of the portal:
// what a rep does next. It is the only thing on that screen that can be
// actively WRONG rather than merely ugly — a sentence derived from a list that
// failed to load tells a rep to go home while three people wait on a reply. So
// every branch of it is run here against hostile input (nulls, NaN, strings,
// negatives, unparseable dates, missing keys), not read.
//
// ══ What this does NOT prove ══════════════════════════════════════════════
//
//   * That the screen looks right, fits, or is legible. There is no browser.
//     scripts/check-mobile-surfaces.mjs holds app/sales to STRICT and this file
//     asserts it still does — that is a hazard floor, not a design review.
//   * That /api/sales/me actually returns what the screen reads. The route is
//     asserted to SELECT those fields; whether Postgres agrees is a runtime
//     question no static check answers.
//   * That a rep can be authenticated at all. check-sales-auth.mjs owns that.
import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join, relative } from "node:path";
import {
  LADDER_ORDER,
  LAPSE_WARNING_HOURS,
  lapsingWithin,
  nextAction,
  queueSummary,
  repliesWaiting,
  untouchedLeads,
} from "@/app/sales/nextAction";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

let pass = 0;
const failures = [];

function ok(name, condition, detail = "") {
  if (condition) {
    pass++;
    return true;
  }
  failures.push(`${name}${detail ? `  — ${detail}` : ""}`);
  console.log(`  ✗ ${name}${detail ? `  — ${detail}` : ""}`);
  return false;
}
const section = (t) => console.log(`\n${t}`);

const read = (p) => readFileSync(join(ROOT, p), "utf8");

/**
 * Source with comments removed.
 *
 * Every string rule below runs on this. A sentence in a header comment is not
 * a behaviour, and four false passes in this repo's history came from a check
 * matching its own explanation.
 */
function codeOnly(src) {
  return src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
}

// ═══════════════════════════════════════════════════════════════════════════
section("1. The ladder — order is behaviour, not presentation");
// ═══════════════════════════════════════════════════════════════════════════
//
// The order decides what a rep does with their next hour. It is asserted
// against a literal list rather than against the wording, so a reworded
// headline is free and a reordered ladder is not.

ok(
  "the ladder is replies → call → claim → write",
  JSON.stringify(LADDER_ORDER) === JSON.stringify(["replies", "call", "claim", "write"]),
  JSON.stringify(LADDER_ORDER),
);

const ALL_ZERO = { repliesWaiting: 0, prospectsToCall: 0, freeToClaim: 0, newLeads: 0 };

ok("all zero is 'clear', and says so", nextAction(ALL_ZERO).code === "clear");
ok(
  "…and offers no link, because there is nowhere useful to send anybody",
  nextAction(ALL_ZERO).href === null && nextAction(ALL_ZERO).cta === null,
);

ok(
  "a reply outranks everything below it",
  nextAction({ ...ALL_ZERO, repliesWaiting: 1, prospectsToCall: 9, freeToClaim: 9, newLeads: 9 })
    .code === "replies",
);
ok(
  "an unworked claim outranks claiming more",
  nextAction({ ...ALL_ZERO, prospectsToCall: 2, freeToClaim: 400 }).code === "call",
);
ok(
  "claiming outranks writing to a lead",
  nextAction({ ...ALL_ZERO, freeToClaim: 5, newLeads: 5 }).code === "claim",
);
ok("writing is the last rung", nextAction({ ...ALL_ZERO, newLeads: 5 }).code === "write");
ok(
  "…and each rung links at the screen that does the thing",
  nextAction({ ...ALL_ZERO, repliesWaiting: 1 }).href === "/sales/threads" &&
    nextAction({ ...ALL_ZERO, prospectsToCall: 1 }).href === "/sales/queue" &&
    nextAction({ ...ALL_ZERO, newLeads: 1 }).href === "/sales/leads",
);

{
  // Singular and plural, because "1 prospects have written back" is the kind
  // of small wrongness that makes a rep stop believing the rest of the screen.
  const one = nextAction({ ...ALL_ZERO, repliesWaiting: 1 }).headline;
  const two = nextAction({ ...ALL_ZERO, repliesWaiting: 2 }).headline;
  ok("one reply reads as one", /1 prospect has/.test(one), one);
  ok("two replies read as two", /2 prospects have/.test(two), two);
}

// ═══════════════════════════════════════════════════════════════════════════
section("2. null is not zero — the ladder stops, it does not guess");
// ═══════════════════════════════════════════════════════════════════════════
//
// THE assertion in this file. A failed load must never be ranked as "none of
// those", because "none of those" is an action-changing claim.

ok(
  "a null top rung refuses to answer at all",
  nextAction({ ...ALL_ZERO, repliesWaiting: null }).code === "unknown",
);
ok(
  "…and names which card failed, so the rep knows what to retry",
  nextAction({ ...ALL_ZERO, repliesWaiting: null }).blockedBy === "replies",
);
ok(
  "an unknown answer offers no call to action",
  nextAction({ ...ALL_ZERO, repliesWaiting: null }).href === null,
);
// The two unknown branches say different things and must stay distinguishable.
// Found by mutation testing: deleting the null branch entirely still produced
// `unknown` + the right `blockedBy`, because the shape guard below it also
// rejects null — so a rep would have been told their conversations "came back
// in a shape we don't recognise" for an ordinary offline moment. Asserting the
// code alone could not see that.
ok(
  "a failed load is described as a failed load, and names the card",
  /didn’t load/.test(nextAction({ ...ALL_ZERO, repliesWaiting: null }).detail) &&
    /your conversations/.test(nextAction({ ...ALL_ZERO, repliesWaiting: null }).detail),
  nextAction({ ...ALL_ZERO, repliesWaiting: null }).detail,
);
ok(
  "…and a malformed payload is described as a malformed payload, not as offline",
  /shape/.test(nextAction({ ...ALL_ZERO, repliesWaiting: Number.NaN }).detail),
  nextAction({ ...ALL_ZERO, repliesWaiting: Number.NaN }).detail,
);
ok(
  "a KNOWN top rung still answers over an unknown one below it",
  nextAction({ ...ALL_ZERO, repliesWaiting: 3, prospectsToCall: null }).code === "replies",
);
ok(
  "…but a zero top rung over an unknown second rung is unknown, not 'clear'",
  nextAction({ ...ALL_ZERO, repliesWaiting: 0, prospectsToCall: null }).code === "unknown" &&
    nextAction({ ...ALL_ZERO, repliesWaiting: 0, prospectsToCall: null }).blockedBy === "call",
);
ok(
  "a missing key is treated exactly as null, never as zero",
  nextAction({}).code === "unknown" && nextAction({}).blockedBy === "replies",
);
ok("no argument at all is unknown, not clear", nextAction().code === "unknown");

for (const [label, value] of [
  ["NaN", Number.NaN],
  ["Infinity", Number.POSITIVE_INFINITY],
  ["a string", "3"],
  ["an object", {}],
]) {
  ok(
    `${label} is a broken payload, not a count`,
    nextAction({ ...ALL_ZERO, repliesWaiting: value }).code === "unknown",
  );
}

// A negative is finite and > 0 is false, so it falls through the rung rather
// than announcing "-2 prospects have written back". Asserted because the
// fall-through is load-bearing and easy to break with a `!== 0` refactor.
ok(
  "a negative count does not announce itself",
  nextAction({ ...ALL_ZERO, repliesWaiting: -2 }).code === "clear",
);

// ═══════════════════════════════════════════════════════════════════════════
section("3. repliesWaiting — the newest message, and only inbound");
// ═══════════════════════════════════════════════════════════════════════════

ok("a non-array is unknown", repliesWaiting(null) === null && repliesWaiting(undefined) === null);
ok("an empty list is a real zero", repliesWaiting([]) === 0);
ok(
  "only a thread whose NEWEST message is inbound counts",
  repliesWaiting([
    { messages: [{ direction: "in" }, { direction: "out" }] },
    { messages: [{ direction: "out" }, { direction: "in" }] },
  ]) === 1,
);
ok(
  "a thread with no messages is not waiting on anybody",
  repliesWaiting([{ messages: [] }, {}, { messages: null }]) === 0,
);

// ═══════════════════════════════════════════════════════════════════════════
section("4. queueSummary — a worked claim is not an unworked one");
// ═══════════════════════════════════════════════════════════════════════════
//
// "mine_worked" means the rep already spoke to them and the prospect is theirs
// permanently. Counting those as "to call" would make the number grow with
// every successful call and never come down — the opposite of what a "what is
// left" figure is for.

{
  const items = [
    { claim: { state: "mine" }, contact: { callable: true } },
    { claim: { state: "mine" }, contact: { callable: false } },
    { claim: { state: "mine_worked" }, contact: { callable: true } },
  ];
  const s = queueSummary({ queue: { items }, trades: [{ available: 2 }, { available: 3 }] });
  // Three separate one-item payloads rather than three assertions about the
  // same number: `s.toCall === 1` repeated proves one thing and looks like
  // three, which is how this repo's five false passes were all shaped.
  const only = (item) => queueSummary({ queue: { items: [item] }, trades: [] }).toCall;
  ok("an unworked, callable claim counts", only(items[0]) === 1, String(only(items[0])));
  ok("a claim with no callable number does not", only(items[1]) === 0, String(only(items[1])));
  ok("an already-worked claim does not", only(items[2]) === 0, String(only(items[2])));
  ok("…and the three together are one, not three", s.toCall === 1, String(s.toCall));
  ok("the total claimed is still all three", s.claimed === 3);
  ok("free-to-claim sums the per-trade counts", s.freeToClaim === 5, String(s.freeToClaim));
}

ok(
  "no payload at all is unknown on every figure, not zero on any of them",
  Object.values(queueSummary(null)).every((v) => v === null),
);
ok(
  "a payload with no queue is unknown about the queue and still honest about the pool",
  queueSummary({ trades: [{ available: 4 }] }).toCall === null &&
    queueSummary({ trades: [{ available: 4 }] }).freeToClaim === 4,
);
ok(
  "one unreadable trade count makes the SUM unknown rather than short",
  queueSummary({ trades: [{ available: 4 }, { available: null }] }).freeToClaim === null,
);

// ═══════════════════════════════════════════════════════════════════════════
section("5. lapsingWithin — urgency is measured, never invented");
// ═══════════════════════════════════════════════════════════════════════════

{
  const now = new Date("2026-09-03T12:00:00.000Z");
  const at = (h) => new Date(now.getTime() + h * 3600_000).toISOString();
  const items = [
    { claim: { state: "mine", expiresAt: at(2) } }, // inside the window
    { claim: { state: "mine", expiresAt: at(11.9) } }, // inside
    { claim: { state: "mine", expiresAt: at(30) } }, // outside
    { claim: { state: "mine", expiresAt: at(-1) } }, // already lapsed
    { claim: { state: "mine", expiresAt: "not a date" } }, // unreadable
    { claim: { state: "mine", expiresAt: null } }, // worked, no lease
    { claim: { state: "mine_worked", expiresAt: at(1) } }, // not on a lease
  ];
  ok("two claims lapse inside the window", lapsingWithin(items, 12, now) === 2, String(lapsingWithin(items, 12, now)));
  ok("a non-array is unknown, not zero", lapsingWithin(null) === null);
  ok("an empty list is a real zero", lapsingWithin([], 12, now) === 0);
  ok(
    "an unreadable date invents neither urgency nor calm",
    lapsingWithin([{ claim: { state: "mine", expiresAt: "nonsense" } }], 12, now) === 0,
  );
  ok("the warning window is a third of the 48-hour lease", LAPSE_WARNING_HOURS === 12);
}

// ═══════════════════════════════════════════════════════════════════════════
section("6. untouchedLeads — an absent group is zero, an absent map is not");
// ═══════════════════════════════════════════════════════════════════════════
//
// groupBy omits a status with no rows, so a missing `new` key IS a real zero.
// A missing counts OBJECT is a failed request and is not.

ok("no counts object is unknown", untouchedLeads(null) === null && untouchedLeads(undefined) === null);
ok("a counts object with no 'new' group is a real zero", untouchedLeads({ contacted: 4 }) === 0);
ok("a present count is used", untouchedLeads({ new: 7 }) === 7);
ok("a non-numeric count is unknown", untouchedLeads({ new: "7" }) === null);

// ═══════════════════════════════════════════════════════════════════════════
section("7. The screen reads what the API sends — the field with no reader");
// ═══════════════════════════════════════════════════════════════════════════

const HOME = "app/sales/page.js";
const home = codeOnly(read(HOME));
const meRoute = codeOnly(read("app/api/sales/me/route.js"));

for (const field of ["signupLink", "code"]) {
  ok(`/api/sales/me returns ${field}`, meRoute.includes(field));
  ok(`…and the home screen renders it`, home.includes(field));
}
ok("the route returns the signup counts", /signups:\s*\{/.test(meRoute));
ok(
  "…and the home screen renders today, this week and lifetime",
  home.includes("signups?.today") &&
    home.includes("signups?.thisWeek") &&
    home.includes("signups?.total"),
);
ok(
  "the UTC day boundary is stated on screen, as repStats.js asks",
  /today \(UTC\)/.test(read(HOME)) && /UTC/.test(read(HOME)),
);

for (const endpoint of [
  "/api/sales/me",
  "/api/sales/queue",
  "/api/sales/leads",
  "/api/sales/threads",
]) {
  ok(`the home screen calls ${endpoint}`, home.includes(`"${endpoint}"`));
}

ok(
  "the ladder is imported rather than re-decided on the screen",
  home.includes("nextAction") && home.includes("./nextAction"),
);

// A confident zero is the failure this whole screen is shaped around. `?? 0`
// on a figure would reintroduce it in one character.
{
  const zeroCoalesce = [...home.matchAll(/signups\?\.[A-Za-z]+\s*\?\?\s*0/g)].map((m) => m[0]);
  ok(
    "no signup figure falls back to 0 when it did not load",
    zeroCoalesce.length === 0,
    zeroCoalesce.join(" "),
  );
}
ok(
  "a figure distinguishes 'not loaded' from a number",
  /value === null \|\| value === undefined/.test(home),
);

// The copy button is the only control here that can silently not exist.
ok(
  "the copy control is gated on the clipboard API actually being there",
  /navigator\.clipboard\?\.writeText/.test(home) && /canCopy &&/.test(home),
);
ok(
  "…and the link is selectable anyway, so nothing is unreachable without it",
  /readOnly/.test(home),
);

// ── The same failure class, on the two compliance screens ──────────────────
//
// /api/sales/leads/[id] and /api/sales/threads/[id] have returned
// `optedOutReason` since the suppression list landed, and nothing rendered it.
// check-sales-suppression.mjs asserts the ROUTE sends it — "returns the reason
// so the screen can say WHY" — and no check asked whether a screen read it, so
// the sentence the server computed was thrown away and each screen printed a
// fixed English one instead.
//
// That is not merely a wasted field. contactOptedOut() answers from two
// sources, and describeSuppression() writes which entry closed the channel and
// how it got there: replied, asked on the phone, texted STOP, a regulator's
// list, or a whole DOMAIN listed rather than this person. The lead screen said
// "They replied with an unsubscribe request" over all of them — telling a rep a
// prospect unsubscribed from an email nobody sent them.
{
  for (const [screen, route] of [
    ["app/sales/leads/[id]/page.js", "app/api/sales/leads/[id]/route.js"],
    ["app/sales/threads/[id]/page.js", "app/api/sales/threads/[id]/route.js"],
  ]) {
    const src = codeOnly(read(screen));
    ok(`${route} sends optedOutReason`, codeOnly(read(route)).includes("optedOutReason"));
    ok(`${screen} reads it`, src.includes("optedOutReason"));
    ok(
      `…and renders it, rather than only destructuring it`,
      /\{\s*optedOutReason\s*\}/.test(src),
      "the value is read into a variable and never reaches the DOM",
    );
    // The mechanism the screen must NOT assert, because the route did not
    // determine it. Six of the seven suppression sources are not a reply.
    ok(
      `…and does not assert a mechanism of its own`,
      !/replied with an unsubscribe request/i.test(src),
      "the screen names one of the seven sources as though it were the only one",
    );
  }
}

// ═══════════════════════════════════════════════════════════════════════════
section("8. Reachable — nothing else audits the /sales tree");
// ═══════════════════════════════════════════════════════════════════════════
//
// check-nav-audit.mjs walks app/app and app/platform. It does not walk
// app/sales, so this is the only place a rep-portal screen with no way in gets
// caught. Same shape: a route is reachable if the shell links it, or if
// another /sales screen links it (a drill-in), or if it is on the short list
// of screens reached WITHOUT a session, each with its reason.

const SHELL = read("app/sales/SalesShell.js");

/** Reached without a session, so the shell deliberately renders no tab. */
const UNAUTHENTICATED = {
  "/sales/login": "the sign-in form — the shell hides itself here",
  "/sales/invite/[token]": "an emailed invitation link; lib/sales/inviteEmail.js builds it",
};

function pages(dir) {
  const out = [];
  const walk = (abs) => {
    for (const entry of readdirSync(abs)) {
      const full = join(abs, entry);
      if (statSync(full).isDirectory()) walk(full);
      else if (entry === "page.js") {
        const route = `/${relative(join(ROOT, "app"), abs).split("\\").join("/")}`;
        out.push(route);
      }
    }
  };
  walk(join(ROOT, dir));
  return out.sort();
}

/** Every /sales source, so a drill-in can be found wherever it is written. */
function sources(dir) {
  const out = [];
  const walk = (abs) => {
    for (const entry of readdirSync(abs)) {
      const full = join(abs, entry);
      if (statSync(full).isDirectory()) walk(full);
      else if (entry.endsWith(".js")) out.push(relative(ROOT, full).split("\\").join("/"));
    }
  };
  walk(join(ROOT, dir));
  return out;
}

const SALES_SOURCES = [
  ...sources("app/sales"),
  ...(existsSync(join(ROOT, "app/components/sales")) ? sources("app/components/sales") : []),
];
const SALES_TEXT = SALES_SOURCES.map((f) => read(f)).join("\n");

for (const route of pages("app/sales")) {
  if (UNAUTHENTICATED[route]) {
    pass++;
    continue;
  }
  const tabbed = SHELL.includes(`"${route}"`);
  // A dynamic segment is linked as a template literal, so the static prefix is
  // what a source can be searched for.
  const prefix = route.replace(/\/\[[^\]]+\]$/, "/");
  const drilled = route.endsWith("]")
    ? SALES_TEXT.includes(`${prefix}\${`)
    : SALES_TEXT.includes(`"${route}"`);
  ok(
    `${route} can be opened — a tab, or a link from another /sales screen`,
    tabbed || drilled,
    "add a tab in SalesShell.js, a link, or an UNAUTHENTICATED entry with a reason",
  );
}

for (const route of Object.keys(UNAUTHENTICATED)) {
  const dir = join(ROOT, "app", route.slice(1));
  ok(
    `the unauthenticated entry ${route} still names a real screen`,
    existsSync(join(dir, "page.js")),
    "a stale exemption hides the next unreachable screen",
  );
}

ok("the portal root is the Today screen", existsSync(join(ROOT, "app/sales/page.js")));
ok(
  "the companies book kept a tab when it stopped being the root",
  SHELL.includes('"/sales/companies"') && existsSync(join(ROOT, "app/sales/companies/page.js")),
);
ok(
  "…and it is still the translated screen it was, not an English rewrite",
  read("app/sales/companies/page.js").includes("app.salesPortal.myCompanies"),
);
ok("the notes tab is still wired, as check:rep-notes expects", SHELL.includes('"/sales/notes"'));

// ═══════════════════════════════════════════════════════════════════════════
section("9. Colour — the tree, not the one file where the bug was found");
// ═══════════════════════════════════════════════════════════════════════════

{
  const hexed = SALES_SOURCES.filter((f) =>
    /(?:bg|text|border|fill|stroke)-\[#[0-9a-fA-F]{3,8}\]/.test(codeOnly(read(f))),
  );
  ok(
    "no /sales file paints an arbitrary hex — every colour is a theme token",
    hexed.length === 0,
    hexed.join(" "),
  );
}

// The token those files now use has to actually clear the floor. Measured off
// globals.css so a palette edit fails here rather than shipping.
{
  const css = read("app/globals.css");
  const values = (name) => [...css.matchAll(new RegExp(`--${name}:\\s*(#[0-9a-fA-F]{6})`, "g"))].map((m) => m[1]);
  const lum = (hex) => {
    const c = [1, 3, 5]
      .map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
      .map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
    return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
  };
  const ratio = (a, b) => {
    const [x, y] = [lum(a), lum(b)];
    return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
  };

  const accent = values("brand-accent-text");
  const muted = values("muted");
  const card = values("card");
  ok(
    "globals.css declares --brand-accent-text, --muted and --card in both themes",
    accent.length >= 2 && muted.length >= 2 && card.length >= 2,
    `${accent.length}/${muted.length}/${card.length}`,
  );

  if (accent.length >= 2 && muted.length >= 2 && card.length >= 2) {
    for (const [i, theme] of ["light", "dark"].entries()) {
      for (const [name, ground] of [["--muted", muted[i]], ["--card", card[i]]]) {
        const r = ratio(accent[i], ground[0] === "#" ? ground : `#${ground}`);
        ok(
          `${theme}: the sales wordmark clears 4.5:1 on ${name}`,
          r >= 4.5,
          `${accent[i]} on ${ground} measures ${r.toFixed(2)}:1`,
        );
      }
    }
  }
}

// ═══════════════════════════════════════════════════════════════════════════
section("10. The surface stays at the mobile tier it earned");
// ═══════════════════════════════════════════════════════════════════════════
//
// app/sales was promoted from baseline to strict on 2026-09-03 by FIXING the
// four buttons that failed rather than exempting them. Nothing stops a future
// edit from quietly moving it back, so the tier is asserted from here.

{
  const mobile = read("scripts/check-mobile-surfaces.mjs");
  ok(
    'app/sales is held at tier "strict" in check-mobile-surfaces.mjs',
    /\{\s*dir:\s*"app\/sales",\s*tier:\s*"strict"\s*\}/.test(mobile),
    "if it was demoted, fix the file that failed instead",
  );
  ok(
    "…and there is no KNOWN_GAPS entry excusing an app/sales file",
    !/KNOWN_GAPS[\s\S]{0,600}app\/sales/.test(mobile),
  );
}

// ═══════════════════════════════════════════════════════════════════════════
console.log(
  failures.length === 0
    ? `\nALL PASS — ${pass} checks`
    : `\n${pass} passed, ${failures.length} FAILED\n` + failures.map((f) => `  ✗ ${f}`).join("\n"),
);
process.exit(failures.length === 0 ? 0 : 1);
