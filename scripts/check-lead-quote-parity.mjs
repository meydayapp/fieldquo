// scripts/check-lead-quote-parity.mjs
//
//   npm run check:lead-quote-parity
//
// A quote started from a lead has to be the SAME quote "New quote" makes.
//
// ══ What this exists to stop coming back ═══════════════════════════════════
//
// Q-2026-0026, owner's report 2026-10-20: a Cabinet Refinishing quote built on
// screen from Tracey Leroux's lead, reviewed, and the review said the quote was
// empty. It was: total $0.00. lib/leads/convertLead.js writes a QuoteScopeGroup
// with the lead's category and `lineItems: null`, and QuoteBuilder loads every
// stored group as `persisted` — the rule that stops a sent quote being repriced
// — so the estimator was handed a service card with NO unit-pricing form and no
// takeoff. 20 doors and 6 drawers price at $3,900.00 through a group added from
// the service picker and at $0.00 through that one.
//
// The three further gaps on the same quote: no QuoteCosting row, no expiry, and
// no photos.
//
// ══ How it is proved ═══════════════════════════════════════════════════════
//
// By EXECUTION, end to end, not by reading the source:
//
//   1. convertLeadToQuote runs against scripts/fixtures/dbStub.mjs and the
//      written rows are inspected.
//   2. The written group is shaped as GET /api/quotes/[id] returns it and run
//      through the builder's own initialStateFromQuote.
//   3. The group is priced through lib/quotes/builderPayload.js — the one
//      module both builder modes price with — and the figure is asserted to
//      the cent, not merely asserted non-zero.
//   4. QuoteBuilderForm is RENDERED over the converted quote, and the
//      unit-pricing form has to be on screen with the total beside it.
//   5. buildQuoteCostingRow and deriveQuoteCosting both run over what that
//      first save stores, to prove the operational cost the owner asked for
//      (labour hours, materials) comes off the lead's counts — and that no
//      row is INVENTED at conversion to fake it.
//
// Bundled through esbuild like check-doc-builder (the components are JSX), with
// `@/lib/db` aliased to the stub the way db-stub-hooks.mjs does it for bare
// node — so this file may use JSX AND execute the write path.
//
// ══ The rule this must not break ═══════════════════════════════════════════
//
// `persisted` exists to stop two things: repricing a quote a client already
// has, and counting a derived line twice. Section 3 pins that a stored group
// WITH line items is untouched by the revival, md5 of its payload included.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { convertLeadToQuote } from "../lib/leads/convertLead.js";
import { rows, writes, resetDbStub } from "./fixtures/dbStub.mjs";
import {
  newScopeGroup,
  groupSubtotal,
  scopeGroupPayload,
  isSeedScopeGroup,
  reviveSeedScopeGroup,
} from "../lib/quotes/builderPayload.js";
import { QuoteBuilderForm, initialStateFromQuote } from "../app/components/quotes/builder/QuoteBuilder.js";
import { LanguageProvider } from "../app/providers/LanguageProvider.js";
import { PermissionProvider } from "../app/providers/PermissionProvider.js";
import { buildQuoteCostingRow, shouldWriteQuoteCosting } from "../app/api/quotes/costingWrite.js";
import { deriveQuoteCosting } from "../lib/costing/quoteCostEstimate.js";
import { defaultValidUntil } from "../lib/quotes/validUntil.js";
import { FALLBACK_LABOUR_RATE, FALLBACK_OVERHEAD_PCT } from "../lib/costing/costingDefaults.js";

let checks = 0;
let failures = 0;
const ok = (cond, label, detail) => {
  if (typeof cond === "string") throw new TypeError(`ok() called label-first: ${JSON.stringify(cond)}`);
  if (typeof label !== "string") throw new TypeError("ok() needs a string label second");
  checks++;
  if (!cond) failures++;
  console.log(
    (cond ? "  ok   " : "  FAIL ") + label + (cond || detail === undefined ? "" : `  — ${JSON.stringify(detail).slice(0, 300)}`),
  );
};
const section = (t) => console.log(`\n${t}\n`);
const md5 = (o) => createHash("md5").update(JSON.stringify(o)).digest("hex");
const src = (p) => readFileSync(join(process.cwd(), p), "utf8");

// The trade, as a company that sells it has it: the system category row plus
// this company's own rate card (none saved — so the trade's price book, which
// is what a real tenant who never opened the rates screen is on).
const CABINETS = { id: "cat-cab", key: "cabinet_refinishing", label: "Cabinet Refinishing", enabled: true, defaultRate: null, customFields: null };

/** A Messenger lead whose conversation counted the kitchen: 20 doors, 6 drawers. */
function cabinetLead(over = {}) {
  return {
    id: "lead-cab",
    companyId: "co1",
    name: "Tracey Leroux",
    email: "tracey@example.com",
    phone: "+16135550188",
    categoryId: CABINETS.id,
    message: "Kitchen cabinets, white.",
    budgetBand: null,
    timeline: null,
    clientPhotos: [],
    intake: {
      address: "12 Main St",
      scope: { from: "conversation", counts: { doors: 20, drawers: 6 }, sources: { doors: { quote: "20 doors and 6 drawers" } } },
    },
    language: "en",
    quoteId: null,
    ...over,
  };
}

async function convert(lead, { threads = [], messages = [] } = {}) {
  resetDbStub();
  rows.company = [{ id: "co1", defaultLanguage: "en" }];
  rows.serviceCategory = [CABINETS];
  rows.leadRequest = [lead];
  rows.messageThread = threads;
  rows.message = messages;
  await convertLeadToQuote({ lead, member: { userId: "u1" }, company: { id: "co1", defaultLanguage: "en" } });
  const quote = writes.find((w) => w.model === "quote" && w.action === "create")?.data || null;
  return { quote, group: quote?.scopeGroups?.create?.[0] || null };
}


async function main() {
  // ═══════════════════════════════════════════════════════════════════════════
  section("1. The conversion, EXECUTED — what it writes and what it deliberately does not");
  // ═══════════════════════════════════════════════════════════════════════════

  const { quote: CONVERTED, group: SEED } = await convert(cabinetLead());

  ok(Boolean(CONVERTED), "converting the lead created a quote");
  ok(CONVERTED?.createdVia === "lead_conversion", "…stamped lead_conversion", CONVERTED?.createdVia);
  ok(Boolean(SEED), "…with one scope group under the lead's category", SEED);
  ok(SEED?.categoryId === CABINETS.id, "the group carries the lead's category", SEED?.categoryId);
  ok(
    JSON.stringify(SEED?.intakeValues) === JSON.stringify({ doorCount: 20, drawerCount: 6 }),
    "THE COUNTS REACH THE GROUP: the conversation's 20 doors and 6 drawers, in the trade's own intake keys",
    SEED?.intakeValues,
  );
  ok(!SEED?.lineItems, "…and NO line items — nothing has been priced, which is what makes it a seed", SEED?.lineItems);
  ok(
    !writes.some((w) => w.model === "quoteCosting"),
    "no QuoteCosting row is written at conversion — see the block above convertLeadToQuote: a margin against a $0 price is a stored lie, and the first save writes the real one",
  );
  ok(CONVERTED?.validUntil === undefined, "no expiry is STORED either — the 30 days are offered on screen, not written behind the estimator", CONVERTED?.validUntil);

  // ── The photos ────────────────────────────────────────────────────────────
  //
  // Established against the live row rather than assumed: on Q-2026-0026 the
  // quote was created at 20:14:49Z and all four Cloudinary images landed at
  // 20:36 and after. The carry works; it is a snapshot. Both halves pinned.
  {
    const THREAD = [{ id: "t1", companyId: "co1", leadId: "lead-cab" }];
    const ready = await convert(cabinetLead(), {
      threads: THREAD,
      messages: [
        {
          id: "m1", threadId: "t1", direction: "in", private: false, sentAt: new Date("2026-10-01T10:00:00Z"),
          attachments: [{ type: "image", url: "https://res.cloudinary.com/demo/image/upload/v1/kitchen.jpg" }],
        },
        {
          id: "m2", threadId: "t1", direction: "in", private: false, sentAt: new Date("2026-10-01T10:01:00Z"),
          attachments: [{ type: "video", url: "https://res.cloudinary.com/demo/video/upload/v1/walkthrough.mp4" }],
        },
      ],
    });
    ok(
      JSON.stringify(ready.quote?.clientPhotos) ===
        JSON.stringify([
          { url: "https://res.cloudinary.com/demo/image/upload/v1/kitchen.jpg", kind: "photo", publicId: null },
          { url: "https://res.cloudinary.com/demo/video/upload/v1/walkthrough.mp4", kind: "video", publicId: null },
        ]),
      "a thread with READY Cloudinary attachments carries them onto the quote, photo and video",
      ready.quote?.clientPhotos,
    );

    const pending = await convert(cabinetLead(), {
      threads: THREAD,
      messages: [
        {
          id: "m1", threadId: "t1", direction: "in", private: false, sentAt: new Date("2026-10-01T10:00:00Z"),
          // Messenger's own CDN link: re-hosting has not happened yet. This is
          // what the thread looked like when Q-2026-0026 was converted.
          attachments: [{ type: "image", url: "https://scontent.xx.fbcdn.net/v/t1/abc.jpg", mediaId: "m-1" }],
        },
      ],
    });
    ok(
      pending.quote?.clientPhotos === undefined,
      "an attachment still awaiting re-hosting is NOT carried — an expiring Meta URL on a quote is a photo that vanishes next week",
      pending.quote?.clientPhotos,
    );
    ok(
      /`url` is never Meta's/.test(src("lib/leads/convertLead.js")) && /A SNAPSHOT/.test(src("lib/leads/convertLead.js")),
      "…and the snapshot finding is written down where the next reader will look, so it is not re-investigated as a broken carry",
    );
  }

  // ═══════════════════════════════════════════════════════════════════════════
  section("2. The builder opens it — THE REGRESSION: a seed is priceable, to the cent");
  // ═══════════════════════════════════════════════════════════════════════════

  /** The converted quote as GET /api/quotes/[id] returns it. */
  const STORED_ROW = {
    id: "q-lead",
    quoteNumber: "Q-2026-0026",
    status: "draft",
    client: { id: "c1", name: "Tracey Leroux", email: "tracey@example.com", address: "12 Main St" },
    language: "en",
    subtotal: 0,
    discount: 0,
    tax: 0,
    total: 0,
    taxEnabled: true,
    validUntil: null,
    createdAt: "2026-10-20T20:14:49.584Z",
    notes: CONVERTED?.notes || "",
    clientPhotos: [],
    company: { currency: "CAD" },
    importedGroupIds: [],
    addOns: [],
    jobs: [],
    scopeGroups: [
      {
        id: "g-seed",
        categoryId: CABINETS.id,
        category: { key: CABINETS.key, label: CABINETS.label },
        label: SEED?.label ?? null,
        lineItems: null,
        intakeValues: SEED?.intakeValues ?? null,
        takeoff: null,
        subtotal: 0,
      },
    ],
  };

  const loaded = initialStateFromQuote(STORED_ROW, { fallbackLabel: "Scope" }).groups[0];

  ok(loaded.persisted === true, "every stored group still LOADS persisted — groupFromStored is untouched (check-paint-coats-labour.mjs pins this too)");
  ok(isSeedScopeGroup(loaded), "…and the loaded group is recognised as a SEED: stored, no lines, no factors, not imported");
  ok(groupSubtotal(loaded) === 0, "THE BUG, reproduced: priced as a frozen group the lead's 20 doors and 6 drawers are worth $0.00", groupSubtotal(loaded));

  const revived = reviveSeedScopeGroup(loaded, CABINETS, null, { language: "en" });

  ok(revived.persisted === false, "revived, it derives like a group added from the service picker");
  ok(revived.id === "g-seed", "…keeping the stored row's id, so the save updates that group instead of orphaning the lead's one", revived.id);
  ok(revived.baseUnitPrice === 150, "…with the trade price book's per-door rate on it, which is what a flipped flag alone would have left at zero", revived.baseUnitPrice);
  ok(
    JSON.stringify(revived.intakeValues) === JSON.stringify({ doorCount: 20, drawerCount: 6 }),
    "…and the homeowner's counts still on it",
    revived.intakeValues,
  );
  ok(groupSubtotal(revived) === 3900, "THE FIGURE: 20 doors + 6 drawers at $150 a unit = $3,900.00", groupSubtotal(revived));

  // The same scope through the OTHER door, to the cent. If these two ever
  // disagree, a lead-converted quote is priced differently from a typed one —
  // which is the whole complaint.
  const typed = newScopeGroup(CABINETS, CABINETS.label, null, { tempId: revived.tempId, intakeValues: { doorCount: 20, drawerCount: 6 }, language: "en" });
  ok(
    groupSubtotal(typed) === groupSubtotal(revived),
    "the lead's scope and the same scope typed into a new quote come to the SAME number",
    { typed: groupSubtotal(typed), revived: groupSubtotal(revived) },
  );
  // Bar the row id, which is the one thing that must differ: the revived group
  // UPDATES the lead's own QuoteScopeGroup, the typed one is created.
  const sansId = ({ id, ...rest }) => rest;
  ok(
    md5(sansId(scopeGroupPayload(revived, null, "en"))) === md5(sansId(scopeGroupPayload(typed, null, "en"))),
    "…and save as the same payload, byte for byte, bar the row id",
    md5(sansId(scopeGroupPayload(typed, null, "en"))),
  );

  // A trade the company has since switched off has no rate card to price from.
  ok(
    reviveSeedScopeGroup(loaded, null, null, { language: "en" }) === loaded,
    "a seed under a service the company no longer sells is left exactly as it was — unpriceable and honest about it, never a form that moves no number",
  );

  // ═══════════════════════════════════════════════════════════════════════════
  section("3. The `persisted` rule is NOT weakened — a stored PRICE is untouched");
  // ═══════════════════════════════════════════════════════════════════════════

  const PRICED = initialStateFromQuote({
    ...STORED_ROW,
    subtotal: 4200,
    scopeGroups: [
      {
        ...STORED_ROW.scopeGroups[0],
        lineItems: [{ description: "Cabinet Refinishing", quantity: 26, unit: "unit", rate: 150, amount: 3900 }, { description: "Soft-close hinges", quantity: 1, amount: 300 }],
        subtotal: 4200,
      },
    ],
  }).groups[0];

  ok(!isSeedScopeGroup(PRICED), "a stored group WITH line items is not a seed");
  ok(reviveSeedScopeGroup(PRICED, CABINETS, null, { language: "en" }) === PRICED, "…and the revival returns the identical object — not a copy, not a patch");
  ok(groupSubtotal(PRICED) === 4200, "…so it still prices as the sum of its stored lines, unrepriced", groupSubtotal(PRICED));
  ok(
    md5(scopeGroupPayload(reviveSeedScopeGroup(PRICED, CABINETS, null, "en"), null, "en")) === md5(scopeGroupPayload(PRICED, null, "en")),
    "…and its payload md5 is unchanged, which is the double-pricing bug pinned",
    md5(scopeGroupPayload(PRICED, null, "en")),
  );

  {
    // The other two shapes that are money somebody settled.
    const factored = { ...loaded, customFactors: [{ kind: "percent", label: "Access", value: 10 }] };
    ok(!isSeedScopeGroup(factored), "a group carrying the estimator's own complexity factor is not a seed");
    const imported = { ...loaded, imported: true };
    ok(!isSeedScopeGroup(imported), "an imported subcontractor cost is not a seed — it is another company's price");
  }

  // ═══════════════════════════════════════════════════════════════════════════
  section("4. ON SCREEN — the builder renders the form the estimator was missing");
  // ═══════════════════════════════════════════════════════════════════════════

  const BOOTSTRAP = {
    clients: [STORED_ROW.client],
    categories: [CABINETS],
    products: [],
    workers: [],
    members: [{ userId: "u1", active: true, user: { id: "u1", name: "Sam" } }],
    recipeOverrides: {},
    companyLanguage: "en",
    companyCurrency: "CAD",
    taxConfig: { taxRate: 13, autoApplyLocalTax: false, taxRates: [], country: "CA", province: "ON" },
    overheadPerJob: 240,
    company: { name: "Pembroke Cabinets", brandColor: "#1d4ed8", country: "CA" },
  };

  function render(row, { layout = "classic", status = null } = {}) {
    const q = status ? { ...row, status } : row;
    const initial = { ...initialStateFromQuote(q, { fallbackLabel: "Scope" }), quote: q, costingLoaded: true };
    return renderToStaticMarkup(
      <LanguageProvider initialLanguage="en">
        <PermissionProvider role="owner" permissions={{}}>
          <QuoteBuilderForm mode="edit" quoteId={q.id} bootstrap={{ ...BOOTSTRAP, layout }} initial={initial} />
        </PermissionProvider>
      </LanguageProvider>,
    );
  }
  const totalOf = (html) => {
    const m = html.match(/data-totals-figure[\s\S]*?tabular-nums leading-tight">([^<]+)</);
    return m ? m[1] : null;
  };

  {
    const html = render(STORED_ROW);
    ok(html.includes("data-unit-pricing"), "the unit-pricing form is DRAWN on a lead-converted draft — the control that was missing");
    ok(/\$3,900\.00/.test(html), "…and the lead's 20 doors and 6 drawers are priced on screen", totalOf(html));
    ok(!/NaN/.test(html), "no NaN anywhere on it");
    const doc = render(STORED_ROW, { layout: "document" });
    // The document layout draws the SAME editor through b.renderGroupEditor,
    // but only inside an expanded card (`data-doc-group-editor`), and a static
    // render has every card shut. So what is asserted here is the FIGURE — the
    // thing a $0 quote got wrong — not the form's markup a second time.
    ok(/\$3,900\.00/.test(doc), "the document layout prices the same seed at the same figure", totalOf(doc));
    ok(totalOf(doc) === totalOf(html), "…showing the same total in both", { doc: totalOf(doc), classic: totalOf(html) });
  }

  {
    // Past `sent` the API refuses scopeGroups, so a price the save cannot store
    // must not be offered. The frozen card is the honest screen there.
    const sent = render(STORED_ROW, { status: "accepted" });
    ok(!sent.includes("data-unit-pricing"), "on a quote past `sent` the form is NOT offered — the save would refuse the lines");
  }

  // ═══════════════════════════════════════════════════════════════════════════
  section("5. The expiry — a visible suggestion, never a stored one");
  // ═══════════════════════════════════════════════════════════════════════════

  {
    const draft = initialStateFromQuote(STORED_ROW);
    ok(draft.validUntil === defaultValidUntil(), "a stored DRAFT with no expiry opens on the 30-day suggestion", draft.validUntil);
    ok(draft.validUntilDefaulted === true, "…flagged as a suggestion, so the hint under the box says what it is");

    const kept = initialStateFromQuote({ ...STORED_ROW, validUntil: "2026-11-30T00:00:00.000Z" });
    ok(kept.validUntil === "2026-11-30", "a quote that HAS an expiry opens on its own date", kept.validUntil);
    ok(kept.validUntilDefaulted === false, "…and is not described as a default, which never happened");

    const sent = initialStateFromQuote({ ...STORED_ROW, status: "sent" });
    ok(sent.validUntil === "", "a SENT quote with no expiry is left empty — 'this does not expire' is a term the client has already read");

    const html = render(STORED_ROW);
    ok(new RegExp(defaultValidUntil()).test(html), "the suggested date is in the box on screen, where it can be changed or cleared", defaultValidUntil());
    ok(/30 days/.test(html), "…with the words saying it is a suggestion", (html.match(/[^>]*30 days[^<]*/) || [])[0]);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  section("6. Operational cost — labour and materials, off the lead's own counts");
  // ═══════════════════════════════════════════════════════════════════════════

  {
    resetDbStub();
    rows.company = [{ id: "co1", defaultLanguage: "en" }];
    rows.serviceCategory = [CABINETS];
    // What the builder's save sends for the revived group, and the price it sets.
    const payload = scopeGroupPayload(revived, null, "en");
    const row = await buildQuoteCostingRow({
      companyId: "co1",
      // INPUTS ONLY, exactly as costingPayload() sends them for a panel nobody
      // has typed a crew into — the same two fallbacks createEstimateQuote uses.
      costing: { labourRate: FALLBACK_LABOUR_RATE, overheadPct: FALLBACK_OVERHEAD_PCT },
      price: groupSubtotal(revived),
      scopeGroups: [payload],
    });
    ok(Boolean(row), "buildQuoteCostingRow answers for the revived group");
    ok(Number(row?.labourHours) > 0, "LABOUR: the hours come off the door and drawer counts, not from nowhere", row?.labourHours);
    ok(Number(row?.materialTotal) > 0, "MATERIALS: the recipe prices the same counts", row?.materialTotal);
    ok(Number(row?.labourCost) > 0, "…and the hours are costed at the fallback crew rate", { labourCost: row?.labourCost, rate: row?.labourRate });
    // ── Where the cost actually comes from, and it is not an invented row ──
    //
    // isEmptyQuoteCosting asks whether the ESTIMATOR said anything — a crew,
    // added hours, added materials, a note. On a draft just opened nobody has,
    // so no row is written, and that is exactly what happens on a quote typed
    // from scratch too. The cost is not lost: with no saved row GET
    // /api/quotes/[id]/costing recomputes through deriveQuoteCosting off the
    // group's OWN intake answers — which is what the revival above makes
    // reachable. Before it, the counts could not be typed anywhere that saved
    // them, so the recompute had nothing to work from.
    ok(
      !shouldWriteQuoteCosting({ costingSent: true, may: true, hasExistingRow: false, row }),
      "nobody having named a crew, no row is written — the same as a quote typed from scratch",
    );
    ok(
      shouldWriteQuoteCosting({
        costingSent: true,
        may: true,
        hasExistingRow: false,
        row: { ...row, crew: [{ id: "w1", name: "Sam", rate: 32, hours: 12, cost: 384 }] },
      }),
      "…and the moment a crew IS named the save writes it",
    );
    const derived = await deriveQuoteCosting({
      companyId: "co1",
      quote: { subtotal: groupSubtotal(revived), discount: 0, scopeGroups: [payload] },
    });
    ok(!derived?.costBasisMissing, "THE OWNER'S REPORT: the saved group recomputes with a real cost basis, not costBasisMissing", derived?.costBasisMissing);
    ok(
      Number(derived?.labourHours) > 0 && Number(derived?.materialTotal) > 0,
      "…labour hours AND materials, off the lead's own counts",
      { hours: derived?.labourHours, materials: derived?.materialTotal },
    );
    ok(
      Math.abs(Number(row?.price) - 3900) < 0.005,
      "costed against the price the save sets, not against the seed's $0.00",
      row?.price,
    );
  }

  // ═══════════════════════════════════════════════════════════════════════════
  section("7. Mutation — break a guard and this file has to fail");
  // ═══════════════════════════════════════════════════════════════════════════

  if (!process.argv.includes("--no-mutate")) {
    const { readFileSync: rd, writeFileSync: wr } = await import("node:fs");
    const MUTATIONS = [
      [
        "lib/quotes/builderPayload.js",
        "a seed goes back to loading as a frozen price",
        (s) => s.replace("export function isSeedScopeGroup(group) {\n  if (!group || !group.persisted) return false;", "export function isSeedScopeGroup(group) {\n  if (group) return false;\n  if (!group || !group.persisted) return false;"),
      ],
      [
        "lib/quotes/builderPayload.js",
        "a group WITH stored lines starts deriving again (the double-pricing bug)",
        (s) => s.replace("  return (Array.isArray(group.lineItems) ? group.lineItems : []).length === 0;", "  return true;"),
      ],
      [
        "app/components/quotes/builder/QuoteBuilder.js",
        "the builder stops reviving the seed it loaded",
        (s) => s.replace("        ? reviveSeedScopeGroup(", "        ? ((x) => x)("),
      ],
      [
        "app/components/quotes/builder/QuoteBuilder.js",
        "a stored draft with no expiry opens on an empty box again",
        (s) => s.replace("        : defaultValidUntil(),\n    validUntilDefaulted: !quote.validUntil,", "        : \"\",\n    validUntilDefaulted: !quote.validUntil,"),
      ],
      [
        "lib/leads/convertLead.js",
        "the conversation's counts stop reaching the scope group",
        (s) => s.replace("  const intakeValues = tradeKey ? intakeValuesFromScope(tradeKey, leadScopeCounts(lead)) : null;", "  const intakeValues = null;"),
      ],
    ];

    const BUILD = [
      "npx esbuild scripts/check-lead-quote-parity.mjs --bundle --platform=node --format=cjs --jsx=automatic",
      "--loader:.js=jsx --loader:.mjs=jsx '--alias:@/lib/db=./scripts/fixtures/dbStub.mjs' --alias:@=.",
      "--alias:next/navigation=./scripts/stub-next-navigation.js --log-level=error --outfile=.lead-quote-parity.mut.cjs",
      "&& node .lead-quote-parity.mut.cjs --no-mutate",
    ].join(" ");

    for (const [rel, label, mutate] of MUTATIONS) {
      const file = join(process.cwd(), rel);
      const ORIGINAL = rd(file, "utf8");
      const mutated = mutate(ORIGINAL);
      if (mutated === ORIGINAL) {
        ok(false, `mutation applies: ${label}`, "the source moved under it — rewrite the mutation, do not delete it");
        continue;
      }
      wr(file, mutated);
      let caught = false;
      try {
        execFileSync("sh", ["-c", BUILD], { stdio: ["ignore", "pipe", "pipe"] });
      } catch {
        caught = true;
      } finally {
        wr(file, ORIGINAL);
        try {
          execFileSync("sh", ["-c", "rm -f .lead-quote-parity.mut.cjs"], { stdio: "ignore" });
        } catch {
          /* nothing to remove */
        }
      }
      ok(caught, `mutation caught: ${label}`);
    }
  }

}

// Not top-level await: this file is bundled to CommonJS by esbuild (the
// components it renders are JSX), and that format has no top-level await.
main().then(
  () => {
    console.log(`\ncheck-lead-quote-parity: ${checks - failures}/${checks} passed`);
    if (failures) {
      console.error(`${failures} FAILED`);
      process.exit(1);
    }
  },
  (err) => {
    console.error(err);
    process.exit(1);
  },
);
