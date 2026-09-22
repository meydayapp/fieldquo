// scripts/check-quote-preview.mjs
//
// The client's link is minted when the quote is SAVED, and who may open it is
// decided by the quote's STATUS.
//
// What this proves, in the owner's terms:
//
//   "Preview as a client is only available after it has been sent" — and it
//   should be before, "so that we can spot anything." … "the token should be
//   minted when the quote is saved because the quote will be sent either way
//   afterwards."
//
// So: a token exists after a plain save; the world gets the ordinary
// not-found on a draft's link; a signed-in member of the owning company gets a
// preview with a banner; the preview writes nothing; sending does not change
// the token; and the copy-link row is live on a draft.
//
// Pure functions are executed against hostile input, and the public route is
// EXECUTED all four ways round — the world, another tenant's member, the
// owning company's member, and an unknown token — against the recording db
// stub, so "a preview writes nothing" is measured rather than read. The
// remaining source assertions (the create/update/send paths, which need a
// session and a tenant to execute) are there to keep a later edit from quietly
// undoing a gate, the same method check-public-payload.mjs uses for the token
// minters.

import { readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath, pathToFileURL } from "url";
import { mintShareToken, shareTokenData, isPubliclyReadable } from "@/lib/quotes/shareToken";
import { memberMayPreview } from "@/lib/quotes/previewAccess";
import { contrastRatio } from "@/lib/brand/colour";
import { APP_MESSAGES } from "@/app/i18n/appMessages";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const read = (f) => readFileSync(join(ROOT, f), "utf8");

let pass = 0;
let fail = 0;
function ok(what, cond, detail = "") {
  if (cond) {
    pass++;
    console.log(`  ok   ${what}`);
  } else {
    fail++;
    console.log(`  FAIL ${what}${detail ? ` — ${detail}` : ""}`);
  }
}
const section = (s) => console.log(`\n${s}\n`);

// ── The token itself ────────────────────────────────────────────────────────

section("mintShareToken — unguessable, and a different string every time");

const sample = Array.from({ length: 500 }, () => mintShareToken());
ok("500 mints, 500 distinct strings", new Set(sample).size === 500);
ok(
  "every one is base64url only — no +, / or = to be mangled in a URL",
  sample.every((t) => /^[A-Za-z0-9_-]+$/.test(t)),
);
ok(
  "every one is 43 characters (32 bytes, base64url, unpadded)",
  sample.every((t) => t.length === 43),
);
// A cuid or a sequential id would be guessable from a neighbouring quote's.
// The crude test for that: the first six characters must not be shared by the
// whole sample, which a timestamp prefix would be.
ok(
  "no shared prefix — not a timestamp-ordered id",
  new Set(sample.map((t) => t.slice(0, 6))).size > 490,
);

section("shareTokenData — mints on absence, NEVER overwrites");

ok("null gets a token", typeof shareTokenData(null).shareToken === "string");
ok("undefined gets a token", typeof shareTokenData(undefined).shareToken === "string");
ok('"" (never saved) gets a token', typeof shareTokenData("").shareToken === "string");
ok("an existing token yields an EMPTY fragment", Object.keys(shareTokenData("abc")).length === 0);
ok(
  "…so spreading it into an update cannot rewrite a link already in a client's inbox",
  !("shareToken" in shareTokenData("a-link-already-emailed")),
);
// Hostile: a value that is truthy but not a plausible token is still left
// alone. Rewriting it would be this function deciding a row is wrong, which is
// not its job — and would break whatever link that row is already serving.
ok("a junk-but-present value is left alone", Object.keys(shareTokenData("   ")).length === 0);
ok("0 is absence, not a token", typeof shareTokenData(0).shareToken === "string");
ok("false is absence, not a token", typeof shareTokenData(false).shareToken === "string");

section("isPubliclyReadable — the gate is the STATUS, not the token");

ok("draft: no", isPubliclyReadable("draft") === false);
for (const s of ["sent", "accepted", "declined", "expired", "viewed"]) {
  ok(`${s}: yes`, isPubliclyReadable(s) === true);
}
// Hostile: an unknown status is readable, deliberately. Every status this
// product has except "draft" means the document left the office, and a new
// one that did not would have to say so here — failing open on a status that
// does not exist would hide a document from the client who was sent it.
ok("an unrecognised status is readable", isPubliclyReadable("whatever-comes-next") === true);
ok("null is readable — absence of a draft claim is not a draft", isPubliclyReadable(null) === true);

// ── The create and update paths mint it ─────────────────────────────────────

section("A plain save produces a token");

const createRoute = read("app/api/quotes/route.js");
ok(
  "POST /api/quotes imports the minter",
  /import \{ mintShareToken \} from "@\/lib\/quotes\/shareToken"/.test(createRoute),
);
ok(
  "…and the create data carries shareToken: mintShareToken()",
  /db\.quote\.create\(\{[\s\S]{0,4000}?shareToken: mintShareToken\(\)/.test(createRoute),
);

const patchRoute = read("app/api/quotes/[id]/route.js");
ok(
  "PATCH /api/quotes/[id] imports shareTokenData",
  /import \{ shareTokenData \} from "@\/lib\/quotes\/shareToken"/.test(patchRoute),
);
ok(
  "…and spreads it into the scalar data of the save",
  /const scalarData = \{[\s\S]{0,1200}?\.\.\.shareTokenData\(existing\.shareToken\)/.test(patchRoute),
);
ok(
  "…reading the EXISTING token, so a save cannot re-mint one",
  patchRoute.includes("shareTokenData(existing.shareToken)"),
);

section("Sending does not change the token");

const sendRoute = read("app/api/quotes/[id]/send/route.js");
ok(
  "the send route still reuses the stored token when there is one",
  /let shareToken = quote\.shareToken;[\s\S]{0,400}?if \(!shareToken\) \{/.test(sendRoute),
);
ok(
  "…and only writes a token inside that `if`, never outside it",
  (sendRoute.match(/data: \{ shareToken \}/g) || []).length === 1,
);

const shareRoute = read("app/api/quotes/[id]/share/route.js");
ok(
  "POST /share still returns the existing token unless rotation is asked for",
  /if \(quote\.shareToken && !rotate\)/.test(shareRoute),
);

// ── The public page ─────────────────────────────────────────────────────────

section("A draft's link is not-found to the world");

const publicPage = read("app/q/[token]/page.js");
ok("the page imports the status gate", publicPage.includes("isPubliclyReadable"));
ok("the page imports the member check", publicPage.includes("canPreviewCompanyDocument"));
ok(
  "it selects status and companyId — the gate needs both",
  /select: \{ id: true, status: true, companyId: true \}/.test(publicPage),
);
ok(
  "an unreadable status with no preview is notFound(), not a 200 with a message",
  /if \(!isPubliclyReadable\(found\.status\) && !preview\) notFound\(\)/.test(publicPage),
);
ok(
  "the member check is only consulted for a status the world may not read",
  /isPubliclyReadable\(found\.status\)\s*\?\s*false/.test(publicPage),
);
ok("the banner is rendered only for a preview", /\{preview && <PreviewBanner \/>\}/.test(publicPage));

const publicApi = read("app/api/public/quotes/[token]/route.js");
const getBody = publicApi.slice(
  publicApi.indexOf("export async function GET"),
  publicApi.indexOf("export async function POST"),
);
ok("the GET was found", getBody.length > 200);
ok(
  "a draft still 404s unless the caller is a member of the owning company",
  /preview = await canPreviewCompanyDocument\(request, quote\.companyId\)/.test(getBody) &&
    /if \(!preview\) \{[\s\S]{0,200}?status: 404/.test(getBody),
);
ok("the payload says it is a preview", /presented\.preview = true/.test(getBody));

// ── The route, EXECUTED, all four ways round ────────────────────────────────
//
// The shipped GET and POST, against scripts/fixtures/dbStub.mjs (which records
// every write) and scripts/fixtures/currentMemberStub.mjs (which varies who is
// asking). Reading the source can show the branch exists; only running it can
// show what a member of ANOTHER company gets, and that nothing was written on
// the way to the answer.

section("The public route, executed: who gets what");

{
  const { rows, writes, resetDbStub } = await import("./fixtures/dbStub.mjs");
  const { setCurrentMember, resetCurrentMemberStub } = await import("./fixtures/currentMemberStub.mjs");
  resetDbStub();
  resetCurrentMemberStub();

  const COMPANY = {
    name: "Probe Co", logoUrl: null, brandColor: "#06356b", email: "a@b.c", phone: null,
    website: null, address: null, paymentTerms: null, paymentMethods: null, currency: "CAD",
    defaultLanguage: "en", financing: null, province: "ON", country: "CA", taxRate: 13,
    autoApplyLocalTax: true, vatRegistered: false,
  };
  const quote = (over) => ({
    companyId: "cmp_a", quoteNumber: "Q-1", language: "en", subtotal: 100, discount: 0,
    tax: 13, total: 113, taxEnabled: true, validUntil: null, notes: null, processNotes: null,
    client: { name: "C", email: "c@d.e", address: null, language: "en" },
    company: COMPANY, scopeGroups: [], addOns: [], presentation: null,
    ...over,
  });
  rows.quote = [
    quote({ id: "q_draft", status: "draft", sentAt: null, shareToken: "tok_draft" }),
    quote({ id: "q_sent", status: "sent", sentAt: new Date(), shareToken: "tok_sent" }),
  ];

  const { GET, POST } = await import(
    pathToFileURL(join(ROOT, "app/api/public/quotes/[token]/route.js")).href
  );
  const request = { headers: { get: () => null } };
  const OWNER = { id: "m1", companyId: "cmp_a" };
  const OTHER = { id: "m2", companyId: "cmp_b" };

  async function call(token, member) {
    setCurrentMember(member);
    writes.length = 0;
    const res = await GET(request, { params: Promise.resolve({ token }) });
    const body = await res.json();
    return { status: res.status, body, wrote: writes.map((w) => `${w.model}.${w.action}`) };
  }

  const worldOnDraft = await call("tok_draft", null);
  ok("a draft's link, to the world: 404", worldOnDraft.status === 404, worldOnDraft.status);
  ok(
    "…with no numbers in the body",
    !("total" in worldOnDraft.body) && !("subtotal" in worldOnDraft.body),
    Object.keys(worldOnDraft.body),
  );

  const otherOnDraft = await call("tok_draft", OTHER);
  ok("a draft's link, to ANOTHER company's member: 404", otherOnDraft.status === 404, otherOnDraft.status);
  ok(
    "…the same body a stranger gets — nothing says the quote exists",
    JSON.stringify(otherOnDraft.body) === JSON.stringify(worldOnDraft.body),
  );

  const ownerOnDraft = await call("tok_draft", OWNER);
  ok("a draft's link, to the owning company's member: 200", ownerOnDraft.status === 200, ownerOnDraft.status);
  ok("…flagged as a preview", ownerOnDraft.body.preview === true);
  ok("…and it is the real document, not a placeholder", ownerOnDraft.body.quoteNumber === "Q-1");

  const worldOnSent = await call("tok_sent", null);
  ok("a SENT quote's link, to the world: 200 — unchanged by any of this", worldOnSent.status === 200);
  ok(
    "…and NOT flagged as a preview, so the client sees Approve and Decline",
    !("preview" in worldOnSent.body),
  );

  const unknown = await call("tok_nothing", OWNER);
  ok("an unknown token is 404 even for a signed-in member", unknown.status === 404);

  section("A preview writes NOTHING — measured, not read");

  for (const [who, result] of [
    ["the world on a draft", worldOnDraft],
    ["another tenant on a draft", otherOnDraft],
    ["the owning member previewing a draft", ownerOnDraft],
    ["the world on a sent quote", worldOnSent],
    ["an unknown token", unknown],
  ]) {
    ok(`${who}: zero database writes`, result.wrote.length === 0, result.wrote.join(", "));
  }

  section("A preview can look, never decide — executed");

  setCurrentMember(OWNER);
  writes.length = 0;
  const decide = await POST(
    // A well-formed decision, so the refusal below is the DRAFT gate and not
    // the body validator answering first — a 400 would prove nothing.
    { headers: { get: () => null }, json: async () => ({ decision: "accepted", signature: { name: "X" } }) },
    { params: Promise.resolve({ token: "tok_draft" }) },
  );
  ok("the owning member cannot accept their own draft through the client page", decide.status === 404, decide.status);
  ok("…and the attempt wrote nothing", writes.length === 0, writes.map((w) => `${w.model}.${w.action}`).join(", "));

  resetCurrentMemberStub();
}

section("A preview writes NOTHING — asserted against the source too");

// The whole promise of the preview. Anything on this list in the GET would
// make "the client opened it" a lie the first time an estimator checked their
// own work — which is exactly the kind of quietly-wrong record this codebase
// keeps being swept for.
const FORBIDDEN_IN_GET = [
  ["a quote update", /db\.quote\.update\(/],
  ["a viewedAt / firstViewedAt stamp", /viewedAt/],
  ["an activity row", /recordActivity\(/],
  ["a notification", /notifyEvent\(/],
  ["any create", /\.create\(/],
  ["any upsert", /\.upsert\(/],
  ["an email", /sendEmail|resend|Resend/],
];
for (const [what, re] of FORBIDDEN_IN_GET) {
  ok(`GET /api/public/quotes/[token] contains no ${what}`, !re.test(getBody));
}
ok(
  "…and the page itself only reads",
  !/db\.quote\.update|\.create\(|recordActivity/.test(publicPage),
);

section("A preview can look, never decide");

const postBody = publicApi.slice(publicApi.indexOf("export async function POST"));
ok(
  "POST (accept / decline) still refuses a draft outright",
  /if \(!quote \|\| quote\.status === "draft"\)/.test(postBody),
);
ok(
  "…and the preview flag is not consulted there — it cannot open a decision path",
  !postBody.includes("canPreviewCompanyDocument") && !/preview/.test(postBody),
);

const approval = read("app/q/[token]/QuoteApproval.js");
ok("QuoteApproval reads the flag off the payload", /const previewing = Boolean\(quote\.preview\)/.test(approval));
ok(
  "the foot's Approve / Decline pair is REPLACED in a preview, not greyed",
  /\) : previewing \? \(\s*<PreviewDecisionNote \/>/.test(approval),
);
ok(
  "the header's Accept is absent in a preview",
  /\{!decided && !expired && !previewing && \(\s*<button/.test(approval),
);
ok(
  "the phone's pinned Accept bar is absent in a preview",
  (approval.match(/!decided && !expired && !previewing/g) || []).length === 2,
);
ok(
  "the extras stay tickable — a preview must price the way the client's copy will",
  /const locked = Boolean\(decided\) \|\| expired;/.test(approval),
);

// ── The tenant comparison, executed ─────────────────────────────────────────

section("memberMayPreview — a member of SOME company is not a member of THIS one");

const C = "cmp_the_owner";
ok("the owning company's member: yes", memberMayPreview({ companyId: C }, C) === true);
ok("another company's member: NO", memberMayPreview({ companyId: "cmp_someone_else" }, C) === false);
ok("nobody signed in: no", memberMayPreview(null, C) === false);
ok("undefined member: no", memberMayPreview(undefined, C) === false);
ok("a member object with no companyId: no", memberMayPreview({ id: "m1" }, C) === false);
// Hostile: the quote's companyId is the thing being compared against. If it
// ever arrived null or undefined — a bad select, a renamed column — a naive
// `a === b` would make every member of every tenant a previewer of a document
// with no owner. It refuses instead.
ok("a quote with no companyId: no, for everybody", memberMayPreview({ companyId: C }, null) === false);
ok("…and not for a member whose companyId is also null", memberMayPreview({ companyId: null }, null) === false);
ok("…and not for undefined on both sides", memberMayPreview({ companyId: undefined }, undefined) === false);
// Hostile: non-strings. An object that stringifies the same, or a shared
// truthy sentinel, must not slip through an == comparison.
ok("a non-string companyId on the member: no", memberMayPreview({ companyId: { toString: () => C } }, C) === false);
ok("a non-string companyId on the quote: no", memberMayPreview({ companyId: C }, { toString: () => C }) === false);
ok("empty strings are not a match", memberMayPreview({ companyId: "" }, "") === false);

// ── The Send menu ───────────────────────────────────────────────────────────

section("Preview and Copy link work from the first save");

const detail = read("app/app/quotes/[id]/page.js");
ok(
  "`linkable` no longer excludes a draft",
  /const linkable = !quote\.historicalImportedAt && canDuplicateQuote;/.test(detail),
);
ok(
  "…and nothing else on this screen still tests the old status condition for a link",
  !/linkable = quote\.status !== "draft"/.test(detail),
);
ok(
  "the copy-link row carries the owner's draft wording",
  detail.includes("app.sendMenu.copyLinkDraft"),
);
ok(
  "the preview row explains what a draft preview is for",
  detail.includes("app.sendMenu.previewDraftHint"),
);
ok(
  "neither link row is disabled by the status any more",
  !/disabled: !linkable[\s\S]{0,200}?previewAfterSend/.test(detail),
);
ok(
  "Preview is also a button in the strip, not only a menu row",
  /data-quote-preview-button/.test(detail),
);
ok(
  "…wired to the same handler as the menu row, so the two cannot drift",
  /data-quote-preview-button/.test(detail) &&
    (detail.match(/onClick=\{handlePreview\}/g) || []).length === 1 &&
    (detail.match(/onSelect: handlePreview/g) || []).length === 1,
);
ok(
  "…and absent rather than greyed when a link may not be handed out at all",
  /\{linkable && \(\s*<button/.test(detail),
);

// The builder's own copy of the same two rows. It had the same
// `status !== "draft"` gate, which is the one the owner actually hits — the
// builder is where a quote is written — so the two screens have to agree.
const builder = read("app/components/quotes/builder/DocumentBuilder.js");
ok(
  "the builder's link rows no longer wait for a send either",
  /const linkable = isEdit;/.test(builder),
);
ok(
  "…and still refuse on a quote that has never been saved, which has nothing to link to",
  /hint: linkable \? null : afterSaveHint/.test(builder) && builder.includes("afterSaveHint"),
);
ok(
  "the builder's copy row carries the same draft wording as the quote page",
  builder.includes("app.sendMenu.copyLinkDraft"),
);
ok(
  "the builder's preview row explains what a draft preview is for",
  builder.includes("app.sendMenu.previewDraftHint"),
);
ok(
  "neither builder row is gated on the status any more",
  !/linkable = isEdit && start\.status/.test(builder),
);

// ── Wording ─────────────────────────────────────────────────────────────────

section("Every new string is in all nine languages");

const NEW_KEYS = [
  "app.sendMenu.copyLinkDraft",
  "app.sendMenu.previewShort",
  "app.sendMenu.previewDraftHint",
  "app.quotePreview.banner",
  "app.quotePreview.decisionNote",
];
const LANGS = Object.keys(APP_MESSAGES);
ok("the catalogue still has nine languages", LANGS.length === 9, `got ${LANGS.length}`);
for (const key of NEW_KEYS) {
  const missing = LANGS.filter((l) => !APP_MESSAGES[l][key]);
  ok(`${key} in all nine`, missing.length === 0, `missing in ${missing.join(", ")}`);
  const english = APP_MESSAGES.en[key];
  const untranslated = LANGS.filter((l) => l !== "en" && l !== "tl" && APP_MESSAGES[l][key] === english);
  // tl keeps "Preview" as a loanword, which is what a Filipino contractor
  // actually says — every other language is expected to differ from English.
  ok(`${key} is really translated`, untranslated.length === 0, `same as English in ${untranslated.join(", ")}`);
}
ok(
  "the banner says the client cannot open it yet, not merely that it is unsent",
  /cannot open/i.test(APP_MESSAGES.en["app.quotePreview.banner"]),
);

section("The preview strip is legible on every tenant");

// The bar is fixed chrome and deliberately NOT brand-derived: it is the one
// element on this page that belongs to the office rather than to the
// contractor, so no tenant's colour can drag it under the bar.
const ratio = contrastRatio("#ffffff", "#1f2937");
ok(`white on #1f2937 measures ${ratio.toFixed(2)}:1 — over 4.5`, ratio >= 4.5);
const banner = read("app/q/[token]/PreviewBanner.js");
ok("the banner uses that pair and no brand colour", banner.includes("#1f2937") && !banner.includes("brandColor"));
// The classes only — the file's comment explains why it is not sticky, and a
// whole-file grep would fail on the explanation rather than on the code.
const bannerClasses = (banner.match(/className="([^"]*)"/g) || []).join(" ");
ok(
  "the banner is not pinned over the document it exists to show",
  !/\b(sticky|fixed)\b/.test(bannerClasses),
  bannerClasses,
);

console.log(`\n${pass} passed, ${fail} failed\n`);
process.exit(fail ? 1 : 0);
