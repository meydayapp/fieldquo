// scripts/check-quote-review-freshness.mjs
//
//   npm run check:quote-review-freshness
//
// The review reviews what is ON SCREEN.
//
// ══ The bug this exists for ════════════════════════════════════════════════
//
// Q-2026-0026, from the owner's own live quote: four photos attached, the
// expiry filled in, the "what happens next" written, a priced Cabinet
// Refinishing section worth $5,122 — and the review panel beside all of it
// came back 42/100 with "No expiry date", "No line items", "Nothing about what
// happens next", "No photos", and a deep photo read that said "This quote has
// no photos attached yet".
//
// Nothing was wrong with the review. app/api/quotes/[id]/review/route.js reads
// the SAVED row, and the saved row genuinely had validUntil NULL, processNotes
// empty and clientPhotos NULL: everything on screen was unsaved browser state.
// Create mode never had this — "Save & review" saves and only then routes to
// ?review=1 — and edit mode simply never got the same guarantee.
//
// ══ What this executes ═════════════════════════════════════════════════════
//
//   1. lib/quotes/reviewGate.js, the rule itself: a save that fails, or
//      throws, means the review NEVER runs; a save that lands runs it once,
//      after; no save at all (the ?review=1 arrival, already saved) runs it
//      without a second write.
//   2. The real PATCH /api/quotes/[id] against the scripted db, from the
//      unsaved editor state through lib/quotes/builderRequest.js — the
//      builder's own save, byte for byte. Before it, the completeness checks
//      on the stored row ARE the owner's four findings. After it, they are
//      gone, and the stored lines are the $3,900 the estimator can see.
//   3. A refusal the route really gives mid-edit — the quote was accepted in
//      the back office while the editor was open — which is the failure the
//      gate is there for: nothing is written, and a review on top of it would
//      have been filed about the other version. (The colleague-saved-first
//      409 is executed in scripts/check-stale-write.mjs, against a double
//      that can raise Prisma's P2025.)
//   4. The second, separate bug: the live readiness panel counted only the
//      lines TYPED by hand, so a structured estimate — whose lines are derived
//      and flattened at save time — read as "No line items" on every quote of
//      that shape.
//   5. The deep read's refusal now describes the ROW ("no photos are saved on
//      this quote"), which is what it counts, rather than the screen.
//
// Read, not executed: that the panel and the builder are wired to the gate.
// Executing a mechanism proves nothing about whether anything reaches it.
//
//   node --import ./scripts/alias-loader.mjs \
//        --import ./scripts/route-stub-loader.mjs \
//        scripts/check-quote-review-freshness.mjs

import { readFileSync } from "node:fs";
import { PATCH } from "@/app/api/quotes/[id]/route";
import { rows, writes, resetDbStub } from "@/lib/db";
import { session } from "@/lib/apiMember";
import { runAfterSave } from "@/lib/quotes/reviewGate";
import { newScopeGroup, scopeGroupPayload } from "@/lib/quotes/builderPayload";
import { quoteRequestBody } from "@/lib/quotes/builderRequest";
import { completenessChecks, completenessSummary } from "@/lib/quotes/completeness";
import { CATEGORIES } from "@/scripts/fixtures/builderPayloadFixtures.mjs";
import { APP_MESSAGES } from "@/app/i18n/appMessages.js";

let pass = 0;
let fail = 0;
const ok = (name, cond, got) => {
  if (cond) {
    pass++;
    console.log(`  ok   ${name}`);
  } else {
    fail++;
    console.log(`  FAIL ${name}${got !== undefined ? `  got: ${JSON.stringify(got)}` : ""}`);
  }
};
const section = (s) => console.log(`\n${s}\n`);
const read = (p) => readFileSync(p, "utf8");
const ids = (checks) => checks.map((c) => c.id).sort();

// ───────────────────────────────────────────────────────────────────────────
section("1. The rule: no save, no review");

{
  const log = [];
  const run = async () => {
    log.push("run");
    return "review";
  };

  const refused = await runAfterSave({
    save: async () => {
      log.push("save");
      return { ok: false };
    },
    run,
  });
  ok("a save that refuses answers ok:false", refused.ok === false && refused.reason === "save_failed", refused);
  ok("…and the review never ran — no model call, no stored score", log.join(",") === "save", log);

  log.length = 0;
  const threw = await runAfterSave({
    save: async () => {
      log.push("save");
      throw new Error("Network request failed");
    },
    run,
  });
  ok("a save that THROWS is a save that did not happen", threw.ok === false && threw.error === "Network request failed", threw);
  ok("…and still nothing ran", log.join(",") === "save", log);

  log.length = 0;
  const landed = await runAfterSave({
    save: async () => {
      log.push("save");
      return { ok: true };
    },
    run,
  });
  ok("a save that lands runs the review, once, AFTER it", log.join(",") === "save,run", log);
  ok("…and hands the result straight back", landed.ok === true && landed.result === "review", landed);

  log.length = 0;
  const noSave = await runAfterSave({ save: undefined, run });
  ok("no save to do (the ?review=1 arrival) reviews without a second write", log.join(",") === "run" && noSave.ok === true, log);

  // Anything that is not exactly { ok: true } is a refusal. This is what lets
  // QuoteBuilder's runSave return undefined from its dozen refusal paths
  // without each one having to know about the review.
  for (const answer of [undefined, null, {}, { ok: "yes" }, { ok: 1 }, false]) {
    const g = await runAfterSave({ save: async () => answer, run: async () => "ran" });
    ok(`a save answering ${JSON.stringify(answer)} does not review`, g.ok === false, g);
  }
}

// ───────────────────────────────────────────────────────────────────────────
section("2. The editor's state, saved through the builder's own save");

const OWNER = { id: "mem_owner", userId: "u_owner", companyId: "co_1", role: "owner", permissions: null };
const VERSION = "2026-10-19T10:00:00.000Z";

// Four photos, in the stored shape a Cloudinary upload produces — a bare
// string or a bad URL is dropped by normaliseMediaList, which is the whole
// reason this fixture is not ["a.jpg"].
const PHOTOS = [1, 2, 3, 4].map((n) => ({
  url: `https://res.cloudinary.com/demo/image/upload/v1/quotes/kitchen-${n}.jpg`,
  kind: "photo",
  publicId: `quotes/kitchen-${n}`,
}));

/** Q-2026-0026 as the database actually held it. */
const savedRow = () => ({
  id: "q_1",
  companyId: "co_1",
  clientId: "c_1",
  quoteNumber: "Q-2026-0026",
  status: "draft",
  validUntil: null,
  processNotes: "",
  clientPhotos: null,
  notes: "",
  reviewNotes: "",
  subtotal: 0,
  discount: 0,
  tax: 0,
  total: 0,
  taxEnabled: true,
  language: "en",
  createdAt: new Date("2026-10-19T09:00:00.000Z"),
  updatedAt: new Date(VERSION),
});

function seed() {
  resetDbStub();
  rows.member = [OWNER];
  rows.company = [{ id: "co_1", currency: "CAD", language: "en", defaultProcessNotes: "" }];
  rows.serviceCategory = [
    { id: CATEGORIES.cabinets.id, companyId: "co_1", key: "cabinet_refinishing", label: "Cabinet Refinishing", unit: "unit" },
  ];
  rows.client = [{ id: "c_1", companyId: "co_1", name: "Mrs Khan", type: "individual", email: "k@example.com" }];
  rows.quote = [savedRow()];
  session.member = OWNER;
}

// The unsaved editor state: the expiry typed in, the photos attached, the
// process wording written, and one Cabinet Refinishing section at 26 faces.
// A group added in this session holds NO line items of its own — its price is
// derived and flattened at save time (lib/quotes/builderPayload.js).
const cabinetGroup = () =>
  newScopeGroup(CATEGORIES.cabinets, "Cabinet Refinishing", null, {
    tempId: "t_cab",
    intakeValues: { doorCount: 20, drawerCount: 6 },
  });

const editorBody = (over = {}) => {
  const group = cabinetGroup();
  return quoteRequestBody({
    isEdit: true,
    canEditScope: true,
    subtotal: 3900,
    appliedDiscount: 0,
    tax: 507,
    taxEnabled: true,
    total: 4407,
    notes: "",
    reviewNotes: "",
    processNotes: "Deposit 50% on approval, balance on completion. Two to three days on site.",
    validUntil: "2026-11-19",
    clientPhotos: PHOTOS,
    siteAddress: "1 Main St",
    groupsPayload: [scopeGroupPayload(group, null, "en")],
    assignedToTouched: false,
    assignedToId: "",
    version: VERSION,
    ...over,
  });
};

const patch = (body) =>
  PATCH(
    new Request("https://app.fieldquo.com/api/quotes/q_1", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }),
    { params: Promise.resolve({ id: "q_1" }) },
  );

/**
 * The quote as lib/ai/quoteReview.js's loadQuote hands it to the checks.
 *
 * Joined here because the scripted db has no `include`: the fields are
 * loadQuote's own select list, and the groups are the rows the route just
 * wrote — not a hand-made shape, which is the point.
 */
const asReviewed = () => {
  const quote = rows.quote.find((q) => q.id === "q_1");
  const category = rows.serviceCategory[0];
  return {
    ...quote,
    client: rows.client[0],
    company: rows.company[0],
    scopeGroups: rows.quoteScopeGroup
      .filter((g) => g.quoteId === "q_1")
      .map((g) => ({ ...g, category: { id: category.id, key: category.key, label: category.label, companySettings: [] } })),
  };
};
const checksNow = () => {
  const q = asReviewed();
  return completenessChecks(q, q.scopeGroups.flatMap((g) => (Array.isArray(g.lineItems) ? g.lineItems : [])));
};

{
  seed();

  // What the owner got. Not a guess at it — the checks, run on the row.
  const before = ids(checksNow());
  ok(
    "BEFORE the save the stored row really is missing all four — this is the 42/100",
    ["no_expiry", "no_items", "no_photos", "no_process"].every((id) => before.includes(id)),
    before,
  );

  const res = await patch(editorBody());
  const body = await res.json();
  ok("the builder's save lands", res.status === 200, { status: res.status, error: body?.error });

  const after = ids(checksNow());
  ok("the expiry on screen is now the expiry reviewed", !after.includes("no_expiry"), after);
  ok("the four photos are now on the row the deep read counts", !after.includes("no_photos"), after);
  ok("what happens next is read from the quote, not from nowhere", !after.includes("no_process"), after);
  ok("the priced section is line items, not 'nothing here to price'", !after.includes("no_items"), after);

  const stored = rows.quoteScopeGroup.filter((g) => g.quoteId === "q_1");
  const lines = stored.flatMap((g) => (Array.isArray(g.lineItems) ? g.lineItems : []));
  ok("…because the save flattened the derived lines onto the row", lines.length === 1, lines);
  ok("…at the figure on the estimator's screen", lines[0]?.amount === 3900 && lines[0]?.quantity === 26, lines[0]);

  const summary = completenessSummary(checksNow());
  ok("nothing blocking is left on a quote that was complete all along", summary.blocking === 0, summary.checks.map((c) => c.id));
}

// ───────────────────────────────────────────────────────────────────────────
section("3. A save that does not land must not produce a review");

{
  seed();
  // A refusal the route really gives, with the editor open: somebody accepted
  // the quote in the back office while the estimator was still writing it, so
  // the save of its line items is refused outright ("already decided"). The
  // other refusal this guards — a colleague's save landing first, which comes
  // back 409 stale_write — is executed in scripts/check-stale-write.mjs
  // against a double that can raise Prisma's P2025; the scripted db here
  // cannot, which is why this uses the refusal it can actually produce.
  rows.quote[0].status = "accepted";

  const res = await patch(editorBody());
  const body = await res.json();
  ok("a save the route refuses comes back as a refusal", res.status === 400 && /already decided/.test(body.error || ""), { status: res.status, body });
  ok("…and the row is untouched", rows.quote[0].validUntil === null && rows.quote[0].clientPhotos === null, {
    validUntil: rows.quote[0].validUntil,
  });
  ok("…nothing was written at all", !writes.length, writes.map((w) => `${w.model}.${w.action}`));

  // What the panel does with that: the builder answers "not saved", so no
  // review runs on the row above — which still reads as the owner's 42/100
  // and would have been FILED as a review of a document nobody is looking at.
  let ran = false;
  const gated = await runAfterSave({
    save: async () => (res.ok ? { ok: true } : { ok: false }),
    run: async () => {
      ran = true;
    },
  });
  ok("the panel reviews nothing after a refused save", gated.ok === false && ran === false, { gated, ran });
  const stillMissing = ids(checksNow());
  ok("…and the stale row is still the one that would have been scored", stillMissing.includes("no_expiry"), stillMissing);
}

// ───────────────────────────────────────────────────────────────────────────
section("4. The live panel counts the lines the CLIENT will read");

{
  const group = cabinetGroup();
  const draft = (groups) => ({
    validUntil: "2026-11-19",
    processNotes: "Deposit 50% on approval.",
    clientPhotos: PHOTOS,
    discount: "",
    subtotal: 3900,
    scopeGroups: groups,
    client: { email: "k@example.com" },
  });

  ok("a structured estimate carries no typed line items at all", (group.lineItems || []).length === 0, group.lineItems);

  // What QuoteReadiness was handed before: `scopeGroups.flatMap(g => g.lineItems)`.
  const typedOnly = completenessChecks(draft([group]), (group.lineItems || []));
  ok(
    "reading only the typed lines calls a priced $3,900 section 'No line items'",
    ids(typedOnly).includes("no_items"),
    ids(typedOnly),
  );

  // What it is handed now: the lines the SAVE would store, through the save's
  // own function, so the panel and the stored review cannot disagree.
  const derived = [group].map((g) => ({ ...g, lineItems: scopeGroupPayload(g, null, "en").lineItems }));
  const live = completenessChecks(draft(derived), derived.flatMap((g) => g.lineItems));
  ok("the derived lines are what the client reads", derived[0].lineItems.length === 1 && derived[0].lineItems[0].amount === 3900, derived[0].lineItems);
  ok("…so the false 'No line items' is gone", !ids(live).includes("no_items"), ids(live));
  ok("…and nothing else is invented in its place", ids(live).length === 0, ids(live));

  // And it is the same arithmetic the save does — the figure the panel judges
  // and the figure the quote is stored at are one number, not two.
  seed();
  ok(
    "the panel's lines are byte-identical to the save's",
    JSON.stringify(derived[0].lineItems) === JSON.stringify(scopeGroupPayload(cabinetGroup(), null, "en").lineItems),
  );
}

// ───────────────────────────────────────────────────────────────────────────
section("5. The wiring — is any of it reachable");

{
  const panel = read("app/components/quotes/SuggestAddOns.js");
  const builder = read("app/components/quotes/builder/QuoteBuilder.js");

  ok("the panel takes the parent's save", /onSaveFirst,/.test(panel));
  ok("the review goes through the gate", /runAfterSave\(\{\s*save: saveFirst \? saveFirstTracked : undefined,\s*run: \(\) => fetchJson\(`\/api\/quotes\/\$\{quoteId\}\/review`/.test(panel));
  ok("the deep photo read goes through the same gate", /runAfterSave\(\{\s*save: saveFirstTracked,\s*run: \(\) => fetchJson\(`\/api\/quotes\/\$\{quoteId\}\/vision`/.test(panel));
  ok("a refused save is said out loud, in both panels", (panel.match(/app\.quoteReview\.notSaved/g) || []).length === 2, panel.match(/app\.quoteReview\.notSaved/g));
  ok("neither runs on a refusal", (panel.match(/if \(!gated\.ok\) \{/g) || []).length === 2);
  ok("the arrival from 'Save & review' does NOT save a second time", /runReview\(\{ saveFirst: false \}\)/.test(panel));
  ok("the button says which half it is doing", /app\.quoteReview\.savingFirst/.test(panel));

  // The deep read's own refusal: it counts photos on the ROW, so it has to say
  // so. "has no photos attached yet" was read as a claim about the screen —
  // with four thumbnails on it — and that is the sentence that cost the hour.
  const vision = read("app/api/quotes/[id]/vision/route.js");
  ok("the deep read's refusal names the saved state", /No photos are saved on this quote/.test(vision));
  ok("…and says what to check when the screen disagrees", /check they finished uploading/.test(vision));

  ok("the builder passes its own save down", /onSaveFirst=\{saveForReview\}/.test(builder));
  ok("…which is runSave, not a second save path", /const saveForReview = async \(\) => \{\s*const saved = await handleSave\("draft", \{ stay: true \}\);/.test(builder));
  ok("…and only reviews on an explicit ok", /if \(saved\?\.ok\) return \{ ok: true \};/.test(builder));
  ok("handleSave hands runSave's answer back", /return await runSave\(action, opts\);/.test(builder));
  ok("the stay path answers ok and stays put", /if \(stay\) \{\s*setSaving\(""\);\s*return \{ ok: true, id \};/.test(builder));
  ok("create mode still routes to ?review=1 — unchanged", /router\.push\(`\/app\/quotes\/\$\{id\}\/edit\?review=1`\)/.test(builder));
  ok("the readiness panel is fed the derived lines", /scopeGroups: readinessGroups,/.test(builder) && /const readinessItems = readinessGroups\.flatMap/.test(builder));
  ok("…derived through the save's own function", /lineItems: buildScopeGroupPayload\(/.test(builder));
}

// ───────────────────────────────────────────────────────────────────────────
section("6. The words exist in every app language");

for (const key of ["app.quoteReview.savingFirst", "app.quoteReview.notSaved"]) {
  const missing = Object.keys(APP_MESSAGES).filter((l) => !APP_MESSAGES[l][key]);
  ok(`${key} in all ${Object.keys(APP_MESSAGES).length} languages`, missing.length === 0, missing);
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
