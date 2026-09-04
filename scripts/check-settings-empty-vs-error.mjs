// scripts/check-settings-empty-vs-error.mjs
//
//   node --import ./scripts/alias-loader.mjs scripts/check-settings-empty-vs-error.mjs
//
// ── One rule, on the twelve settings screens that were breaking it ─────────
//
// A refused or failed request must not render as a statement about the
// business. lib/loadState.js is the write-up; check-settings-load-guards.mjs
// holds the five money-and-team screens. This file holds the rest of Settings,
// where the same shape was found twelve more times in one pass.
//
// What each of them actually said, out loud, after a request the server
// refused:
//
//   services          "You haven't set up any service types yet."
//   work-areas        "No work areas yet."
//   checklists        "No checklists yet / Write down the steps your crew…"
//   follow-ups        three at once — "you need an email template first", "no
//                     follow-up rules yet", and a disabled New-rule button
//   leave             "No policies yet — seed a template above or add one",
//                     to a company whose employment terms were already saved
//   job-photo-tags    "You already have every starter tag."
//   products          "you have no quote types to attach this to" — and then
//                     the product saved with no category links
//   quote-email       an empty, editable reference list whose first Add
//                     REPLACED the stored one (see below)
//   messages          a title and a subtitle over nothing
//   meta-ads          "FieldQuo hasn't been approved by Meta as an
//                     advertiser-facing app on this deployment"
//   overhead          "No assets yet." and "Nothing outstanding." — the second
//                     being a false statement about money owed
//   lead-form         a page silently missing every funnel, for every role
//                     below admin, because GET /api/funnels 403s them
//
// ── Why the assertions are shaped the way they are ────────────────────────
//
// Two forbidden SHAPES, asserted directly, because they are what actually
// produces the sentence:
//
//   1. `r.ok ? r.json() : []` — the failure resolves, so no catch fires, no
//      error state is set, and `[]` becomes a claim of zero.
//   2. an empty-state render that is not gated on knowing the load succeeded.
//
// Everything is read comment-stripped. Each of these files now carries a
// paragraph describing the shape it used to have — as does this one — and
// scanning raw source would make the write-up of the bug match as the bug.

import { readFileSync } from "node:fs";

let pass = 0;
const failures = [];
// Label FIRST. Reversed, a non-empty string becomes the condition and nothing
// here could ever fail.
const ok = (label, cond) => (cond ? (pass++, undefined) : failures.push(label));

const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");
// ── A stripper that does not eat the file ─────────────────────────────────
//
// The obvious `/\/\*[\s\S]*?\*\//g` is wrong here, and wrong in the direction
// that fakes a pass. quote-email/page.js contains
//
//     accept="image/*"
//
// on an <input>. That `/*` opens a block comment as far as the regex is
// concerned, and the next `*/` is 140 lines further down inside a JSX comment
// — so the middle of the file, including the guard being asserted, simply
// disappeared. Every negative assertion ("this file does NOT contain the
// forbidden shape") then passes on the empty string.
//
// A block comment in this codebase always begins a line. A MIME wildcard never
// does. Anchoring the opener to the start of a line is enough to tell them
// apart, and is checked below against the exact string that caused it.
const stripComments = (src) =>
  src
    .replace(/^[ \t]*\{\s*\/\*[\s\S]*?\*\/\s*\}/gm, "")
    .replace(/^[ \t]*\/\*[\s\S]*?\*\//gm, "")
    .replace(/^[ \t]*\/\/.*$/gm, "");

const PAGES = {
  services: "app/app/settings/services/page.js",
  workAreas: "app/app/settings/work-areas/page.js",
  checklists: "app/app/settings/checklists/page.js",
  followUps: "app/app/settings/follow-ups/page.js",
  leave: "app/app/settings/leave/page.js",
  photoTags: "app/app/settings/job-photo-tags/page.js",
  products: "app/app/settings/products/page.js",
  quoteEmail: "app/app/settings/quote-email/page.js",
  messages: "app/app/settings/messages/page.js",
  metaAds: "app/app/settings/meta-ads/page.js",
  overhead: "app/app/settings/overhead/page.js",
  leadForm: "app/app/settings/lead-form/page.js",
  refer: "app/app/settings/refer/page.js",
};

const src = Object.fromEntries(
  Object.entries(PAGES).map(([k, p]) => [k, stripComments(read(p))]),
);

// The stripper, checked against the thing that broke it. Both halves matter:
// it must still remove real comments, and it must not treat a MIME wildcard as
// one. Without the second, every negative assertion below passes on "".
ok(
  "the comment stripper does not treat accept=\"image/*\" as a comment opener",
  stripComments('const a = "image/*";\nconst keep = 1;\n/* gone */\nconst also = 2;')
    .includes("const keep = 1;"),
);
ok(
  "...and still removes a real block comment",
  !stripComments("/* gone */\nconst k = 1;").includes("gone"),
);
ok(
  "...and a JSX one",
  !stripComments("  {/* gone */}\nconst k = 1;").includes("gone"),
);
// Belt and braces: nothing here may assert against an empty file.
for (const [name, path] of Object.entries(PAGES)) {
  ok(`${path}: survived comment-stripping with code left in it`, src[name].length > 500);
}

// ── 1. The swallow, everywhere ─────────────────────────────────────────────
//
// `.then((r) => (r.ok ? r.json() : []))` and its `{}` twin. The response
// identifier is captured and required to be the SAME on both sides, so a
// `.then((d) => ...)` further down the file cannot satisfy it.
// The trailing `,?` is not cosmetic. Prettier wraps the long form as
//
//     fetch(url).then((r) =>
//       r.ok ? r.json() : [],
//     ),
//
// with a trailing comma before the closing paren. Without it this regex
// matched only the one-line spelling — a mutation test proved it: restoring
// the swallow in checklists/page.js changed the file and the check still said
// 71/0. Both spellings are asserted against below.
const SWALLOW = /\.then\(\s*\(?\s*(\w+)\s*\)?\s*=>\s*\(?\s*\1\.ok\s*\?\s*\1\.json\(\)\s*:\s*(\[\s*\]|\{\s*\})\s*\)?\s*,?\s*\)/;
// And the older, blunter one: parse whatever came back, status unread.
const UNCHECKED_JSON = /\.then\(\s*\(?\s*(\w+)\s*\)?\s*=>\s*\1\.json\(\)\s*\)/;

for (const [name, path] of Object.entries(PAGES)) {
  ok(`${path}: no "r.ok ? r.json() : []" swallow`, !SWALLOW.test(src[name]));
  ok(`${path}: no unchecked .then(r => r.json())`, !UNCHECKED_JSON.test(src[name]));
}

// The detectors prove themselves. A regex that matches nothing passes every
// file forever, which is the false pass this whole file exists to avoid.
ok(
  "the swallow detector matches the shape it forbids",
  SWALLOW.test('fetch("/x").then((r) => (r.ok ? r.json() : []))') &&
    SWALLOW.test('fetch("/x").then((r) => (r.ok ? r.json() : {}))'),
);
ok(
  "...including the wrapped, trailing-comma form Prettier produces",
  SWALLOW.test('fetch("/x").then((r) =>\n  r.ok ? r.json() : [],\n),'),
);
ok(
  "...and does not match a rejecting guard",
  !SWALLOW.test('fetch("/x").then((r) => (r.ok ? r.json() : Promise.reject(r)))'),
);
ok(
  "the unchecked-json detector matches the shape it forbids",
  UNCHECKED_JSON.test('fetch("/x").then((r) => r.json()).then(setThing)'),
);
ok(
  "...and does not match fetchJson",
  !UNCHECKED_JSON.test('const d = await fetchJson("/x");'),
);

// ── 2. Each claim, gated on knowing the load succeeded ────────────────────
//
// Asserted per page against the specific sentence, because a page can gate one
// empty state and leave the one next to it ungated — which is exactly what
// job-photo-tags did, list guarded and starter set not.
const CLAIMS = [
  ["services", /loadError \?[\s\S]{0,400}app\.setServices\.emptyState/, "the services empty state"],
  ["workAreas", /!loadError && !canAssign[\s\S]{0,200}app\.setWorkAreas\.noneYet/, "the work-areas empty state"],
  ["checklists", /loaded && own\.length === 0/, "the checklists empty panel"],
  ["followUps", /!loadError && eligibleTemplates\.length === 0/, "the follow-ups no-template banner"],
  ["followUps", /loadError \? null : rules\.length === 0/, "the follow-ups empty sentence"],
  ["photoTags", /failed \|\| starter === null \? null :/, "the starter-tag block"],
  ["products", /quoteTypesError \?[\s\S]{0,300}app\.setProducts\.noQuoteTypes/, "the products no-quote-types line"],
  ["messages", /\{loadError && \(/, "the messages error block"],
  ["metaAds", /\{status && !status\.appConfigured && \(/, "the Meta not-configured card"],
  ["overhead", /assetsError \?[\s\S]{0,200}assets === null/, "the asset register"],
  ["overhead", /billsError \?[\s\S]{0,200}bills === null/, "the bills panel"],
];
for (const [page, re, what] of CLAIMS) {
  ok(`${PAGES[page]}: ${what} is gated on the load having succeeded`, re.test(src[page]));
}

// ── 3. leave: the fabricated company ──────────────────────────────────────
//
// `setData({ policies: [], templates: [] })` in the catch was the whole bug —
// it manufactured a company with no leave policies out of a 500 and then
// invited the owner to re-enter their employment terms. The file already knew:
// the templates half carried a comment about a failed load, and only the
// policies half was left making the claim.
ok(
  "leave no longer fabricates an empty company on a failed load",
  !/setData\(\{\s*policies:\s*\[\s*\]/.test(src.leave),
);
ok(
  "...and a failed load reads as an error rather than a spinner that never stops",
  /if \(!data\) \{[\s\S]{0,600}return error \?/.test(src.leave),
);

// ── 4. quote-email: the one where the lie DELETED something ───────────────
//
// `data?.references || { include: false, items: [], max: 6 }` rendered a live,
// empty, editable reference list after a failed load. AddRow then sent
// `[...[], row]`, and the PATCH REPLACES the stored array — so an admin who
// opened this during a Neon cold start, saw "no references" and added one
// destroyed the other five. The toggle also rendered OFF for a company whose
// references were on, so they believed it while the emails kept sending them.
ok(
  "quote-email no longer invents an empty references card",
  !/data\?\.references \|\|/.test(src.quoteEmail),
);
ok(
  "quote-email no longer invents an empty before/after card",
  !/data\?\.beforeAfter \|\|/.test(src.quoteEmail),
);
ok(
  "quote-email refuses to render the form at all after a failed load",
  /if \(loadError \|\| !data\) \{/.test(src.quoteEmail),
);
// A SAVE failure must still leave the form on screen — it is a different
// state, and collapsing the two would hide the form the moment a PATCH 409s.
ok(
  "a save failure and a load failure are separate states",
  /const \[loadError, setLoadError\] = useState\(""\)/.test(src.quoteEmail) &&
    /catch \(err\) \{\s*setError\(err\.message\);/.test(src.quoteEmail),
);
// The caps travelled in the response all along; the literals 6 and 4
// duplicated lib/quotes/emailSections.js and would have gone stale silently.
ok(
  "the reference cap is not re-guessed on the client",
  !/max: 6/.test(src.quoteEmail) && !/max: 4/.test(src.quoteEmail),
);

// ── 5. overhead: the load that could hang forever ─────────────────────────
//
// Promise.all with no catch on the chain and none on the first two legs. One
// P1001 on /api/salaries — which AGENTS.md says to expect after Neon idles —
// meant setLoading(false) never ran and the page sat on its skeleton with no
// error and no retry. The asymmetry was the tell: legs three and four had
// catches, one and two did not.
ok(
  "overhead's initial load cannot leave the skeleton up forever",
  /const leg = \(url, fallback\) =>/.test(src.overhead) &&
    !/fetch\("\/api\/salaries"\)\.then\(\(r\) => r\.json\(\)\)/.test(src.overhead),
);
ok(
  "every leg of overhead's initial load has a failure path",
  (src.overhead.match(/leg\("\/api\//g) || []).length === 4,
);
// Two invented numbers on the same screen, both contradicting a lib that had
// already reasoned the case through.
ok(
  "overhead does not re-guess the server's target margin",
  !/targetMargin \|\| 0\.2/.test(src.overhead),
);
ok(
  "overhead does not print 0h for hours it was not told",
  !/unabsorbedHours \?\? 0/.test(src.overhead),
);
ok(
  "overhead surfaces a refused minimum-price read instead of blanking the KPIs",
  /res\.status !== 400[\s\S]{0,200}reportResponseError/.test(src.overhead),
);

// ── 6. lead-form: a 403 that is routine, and one that is not ──────────────
//
// GET /api/funnels 403s every role below admin. Swallowing that to `[]` meant
// a supervisor's page silently lost a whole section. A 403 here is the normal
// answer for that person, so it says so; anything else is a real failure.
ok(
  "lead-form tells a restricted member the funnels aren't theirs to see",
  /res\.status === 403[\s\S]{0,120}setFunnelsRestricted\(true\)/.test(src.leadForm),
);
ok(
  "...and names any other failure",
  /setFunnelsError\(await reportResponseError\(res\)\)/.test(src.leadForm),
);

// ── 7. Seven destructive controls that did not say so ─────────────────────
//
// Every one is a bare trash icon wired straight to a DELETE — no soft flag, no
// undo — sitting beside siblings on the same settings section that DO confirm.
//
// The five on Overhead are each an input to the company's price floor, which
// moves the instant the row goes. That screen already knew: the asset card's
// own note reads "Disposal, not deletion. The months it was in service really
// did cost the business money; deleting the row would rewrite that history" —
// two lines above a trash button doing exactly that deletion.
for (const fn of [
  "removeBill",
  "removeFixedCost",
  "removeSalary",
  "removeDebt",
]) {
  ok(
    `overhead: ${fn} asks before deleting`,
    new RegExp(`async function ${fn}\\(id, label\\) \\{\\s*if \\(!confirmDelete\\(label\\)\\) return;`).test(
      src.overhead,
    ),
  );
}
ok(
  "overhead: removeAsset asks, and points at Dispose instead",
  /async function removeAsset\(id, label\) \{[\s\S]{0,400}window\.confirm[\s\S]{0,400}deleteAssetConfirm/.test(
    src.overhead,
  ) && /return;\s*\}\s*const res = await fetch\(`\/api\/assets/.test(src.overhead),
);
// Every trash button must pass the label the dialog names. A confirm that says
// "Delete undefined?" is worse than no confirm.
for (const call of [
  "removeFixedCost(f.id, f.category)",
  "removeSalary(s.id, s.name)",
  "removeDebt(d.id, d.name)",
  "removeAsset(a.id, a.name)",
  "removeBill(b.id, b.category)",
]) {
  ok(`overhead: the button passes a name to ${call.split("(")[0]}`, src.overhead.includes(call));
}

// ── 7b. The two on the price book ─────────────────────────────────────────
ok(
  "deleting a price-book row asks first",
  /function handleDelete[\s\S]{0,900}window\.confirm[\s\S]{0,600}method: "DELETE"/.test(
    src.products,
  ) && /if \(!confirmed\) return;/.test(src.products),
);
ok(
  "...and the confirmation names the row being deleted",
  /handleDelete\(p\.id, p\.name\)/.test(src.products),
);

// ── 8. A search with no hits is not an empty catalogue ────────────────────
//
// Search is server-side (`?q=`), so zero rows after typing says something
// about the search. A company with 400 products was told it had none yet.
ok(
  "products distinguishes an empty search from an empty catalogue",
  /search\.trim\(\)[\s\S]{0,200}app\.setProducts\.emptyList/.test(src.products),
);

// ── 9. Refer: a money figure for a reward that is not money ───────────────
//
// The card read `formatMoney(data.creditEarnedCents / 100)`. Nothing has
// written ReferralCredit.creditCents on a referrer row since the reward became
// a free month — grantReferrerCredit says "creditCents/currency stay null on
// new rows". So the sum is 0 for every company on the current scheme, and a
// business with ten rewarded referrals was shown "$0.00 credit earned" as a
// fact, off data (`rewardedCount`) the server was sending correctly all along.
// Both halves, with AND: a `||` here would pass on either one alone, which is
// how an assertion ends up looking strict and testing nothing. Comments are
// stripped first, so the write-up above does not satisfy it.
ok(
  "refer no longer reads the dead creditCents column",
  !/creditEarnedCents/.test(src.refer),
);
ok(
  "...and formats no money on this page at all",
  !/formatMoney\(/.test(src.refer),
);
ok(
  "...and counts the referrals that were actually rewarded",
  /const rewardedCount = Number\(data\.rewardedCount\) \|\| 0;/.test(src.refer),
);
ok(
  "...through the plural pair, not a bare number",
  /rewardedCount === 1[\s\S]{0,120}app\.refer\.monthEarnedOne[\s\S]{0,120}app\.refer\.monthsEarnedOther/.test(
    src.refer,
  ),
);
// creditEarnedNote says "Applied to your next invoice". A deferred trial_end
// is not a line on an invoice; earnedNote is the sentence that fits.
ok(
  "...and describes the reward as an account extension, not an invoice credit",
  /app\.refer\.earnedNote/.test(src.refer) &&
    !/app\.refer\.creditEarnedNote/.test(src.refer),
);

// ── Report ─────────────────────────────────────────────────────────────────
console.log(
  `\ncheck-settings-empty-vs-error: ${pass} passed, ${failures.length} failed`,
);
for (const f of failures) console.log(`  ✗ ${f}`);
if (failures.length) process.exitCode = 1;
