// app/api/settings/instant-quote/route.js
//
// Read and write the company's instant-estimate sell rates — the rows the
// public estimator prices off. GET returns every wired trade with the saved
// config, or the reference defaults as a STARTING POINT when nothing is saved
// yet (flagged isDefaults, so the UI can say "review these, they're not your
// prices until you save"). PUT saves one trade.
//
// Writes are owner/admin only. A rate card is not company trivia — it's what a
// stranger is shown and what the company may have to honour, so it sits above
// the "user:manage" line that lets a supervisor edit hours.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { memberOrRefusal } from "@/lib/apiMember";
import { recordActivity } from "@/lib/activity/log";
import {
  INSTANT_ESTIMATE_DEFAULTS,
  INSTANT_ESTIMATE_TRADES,
} from "@/lib/estimate/instantEstimate";
import { instantRateFields } from "@/lib/estimate/instantRateFields";
import {
  applyDerivedSeed,
  deriveInstantSeed,
  seedFields,
  readSeedValue,
  seedInputsFor,
  DERIVED_SEED_TRADES,
} from "@/lib/estimate/instantSeed";
import { instantQuoteReadiness } from "@/lib/estimate/instantQuoteReadiness";
import { instantAutoEnablePlan } from "@/lib/estimate/instantQuoteProvision";
import { tradeLabel } from "@/lib/estimate/instantQuoteServer";
import {
  categoryKeysForInstantTrade,
  categoryLabel,
  catalogueMismatches,
  instantTradeOffered,
} from "@/lib/trades/catalog";
import { normaliseFinancing } from "@/lib/estimate/financing";
import { normaliseFormFields } from "@/lib/estimate/formFields";
import { normaliseFormAppearance, isDefaultAppearance, formPalette } from "@/lib/estimate/formAppearance";
import { serviceAreaConfigured } from "@/lib/company/serviceArea";
import {
  reportWebsiteChoice,
  resolveReportWebsite,
  ownWebsiteUrl,
  hostedSiteUrl,
  siteIsTailored,
} from "@/lib/estimate/report/website";
import { reprovisionIfLive } from "@/lib/voice/provision";
import { getAppOrigin } from "@/lib/appUrl";
import {
  loadEnforceableMember,
  requireToggle,
  permissionErrorResponse,
} from "@/lib/permissions/enforce";

function isPricingAdmin(role) {
  return role === "owner" || role === "admin";
}

export async function GET(request) {
  const { member, response } = await memberOrRefusal(request);
  if (response) return response;

  // ── The read had no check at all ─────────────────────────────────────────
  //
  // Writes were owner/admin from the start; reading was open to any member of
  // the company. What this returns is `config` and `rateFields` per trade —
  // the per-unit sell rates a stranger is quoted from, the same $150 per door
  // Settings > Services carries — so it is gated on the same toggle
  // /api/products is, and refuses rather than redacting for the same reason
  // that route gives: a rate card with the rates removed is a broken screen,
  // not a boundary.
  //
  // Impersonation is carved out of the READ only. Non-negotiable #3 is that the
  // platform console views everything and edits nothing, and a support
  // session's role is "viewer", which holds no grid at all. PUT below does not
  // consult member.impersonation, so a write cannot pick the carve-out up.
  if (!member.impersonation) {
    const full = await loadEnforceableMember(db, member.id);
    try {
      requireToggle(full, "showPricing", "see the instant-quote rates");
    } catch (err) {
      const { body, status } = permissionErrorResponse(err);
      return NextResponse.json(body, { status });
    }
  }

  const [saved, company, enabledCategories] = await Promise.all([
    db.instantQuoteConfig.findMany({ where: { companyId: member.companyId } }),
    db.company.findUnique({
      where: { id: member.companyId },
      select: {
        financing: true,
        slug: true,
        // For the report's website rule — see lib/estimate/report/website.js.
        website: true,
        instantReportWebsite: true,
        // The form's look (lib/estimate/formAppearance.js) and the brand it
        // is derived from, for the live preview and the contrast readout.
        publicFormAppearance: true,
        brandColor: true,
        // Whether a service area is drawn: it locks the job address to
        // "required" on every trade's field settings, and the card says so.
        latitude: true,
        longitude: true,
        serviceRadiusKm: true,
        servicePostalPrefixes: true,
        site: {
          select: { subdomain: true, published: true, blocks: true, pages: true, handEditedAt: true, photoLibrary: true },
        },
      },
    }),
    // What the company says it SELLS. This screen used to render every wired
    // estimator with no reference to it, which is how a cabinet painter came to
    // have a roofing rate card: he was shown the card, so he filled it in.
    //
    // `rates` comes too: it is the company's patch over the trade's price book
    // (Settings › Services & Pricing), and the seed a trade starts from is
    // derived from THAT book, not ours — see lib/estimate/instantSeed.js.
    db.companyServiceCategory.findMany({
      where: { companyId: member.companyId, enabled: true },
      select: { rates: true, category: { select: { key: true } } },
    }),
  ]);
  const byTrade = new Map(saved.map((r) => [r.trade, r]));
  const enabledKeys = enabledCategories.map((r) => r.category.key);
  const enabledSet = new Set(enabledKeys);
  const enabledRows = enabledCategories.map((r) => ({ key: r.category.key, rates: r.rates }));

  // ── Selling the service IS the configuration ─────────────────────────────
  //
  // The owner's words: "the instant quote is the reflection of pricing and
  // offering in Services". Before this, it wasn't — switching a service on
  // created nothing here, and the screen told him his two lists disagreed and
  // left him to reconcile them by hand.
  //
  // So a trade he sells, that this build can price, AND whose price HE has
  // stated in his own rate card, is created and switched on here without being
  // asked. A trade whose price he has not stated is not created at all: no row,
  // no invented figure, and the "you sell this, it needs your price" finding
  // below keeps firing until he types one. See lib/estimate/instantQuoteProvision.js
  // for exactly how "his price" is told apart from ours.
  //
  // Lazily, on the read of the screen that shows the result, for the same
  // reason app/api/ai-employee/route.js creates its row on GET: the alternative
  // is a migration over every company for a screen most of them have not opened.
  // Idempotent — it only ever creates a row for a trade that has none.
  //
  // NOT for an impersonating support session (non-negotiable #3: the platform
  // console views everything and edits nothing) and not for a member who could
  // not save this rate card by hand.
  if (!member.impersonation && isPricingAdmin(member.role)) {
    const candidates = Object.keys(INSTANT_ESTIMATE_TRADES).map((trade) => {
      const derived = deriveInstantSeed(trade, seedInputsFor(trade, enabledRows));
      const base = INSTANT_ESTIMATE_DEFAULTS[trade] ?? null;
      return {
        trade,
        offeredAsService: categoryKeysForInstantTrade(trade).some((k) => enabledSet.has(k)),
        hasSavedRow: byTrade.has(trade),
        config: derived && base ? applyDerivedSeed(trade, base, derived) : base,
        derived,
      };
    });

    for (const { trade, config } of instantAutoEnablePlan(candidates)) {
      // createMany would be one round trip, but a race with a parallel request
      // has to lose quietly rather than 500 the settings screen — the unique is
      // (companyId, trade), so the loser's create is exactly the no-op we want.
      const created = await db.instantQuoteConfig
        .create({ data: { companyId: member.companyId, trade, enabled: true, config } })
        .catch(() => null);
      if (!created) continue;
      byTrade.set(trade, created);
      saved.push(created);
      // Logged because it is a CLIENT-FACING change nobody clicked: from this
      // moment a stranger can be quoted for this trade. The company must be
      // able to find out when that started and why.
      recordActivity(member, {
        action: "settings.instant_quote_auto_enabled",
        entityType: "settings",
        entityId: trade,
        summary: `Instant quotes switched on automatically for ${tradeLabel(trade)} — you sell it, and it prices from your own rates.`,
        metadata: { trade, auto: true },
      }).catch(() => {});
    }
  }

  // ── Only the trades this company sells ───────────────────────────────────
  //
  // The owner, looking at TrueFinish's three services: "if TrueFinish only has
  // 3 selected quote types, why do I have the option to show the other 11? it
  // doesn't make sense, I should enable them first." He is right — the other
  // eleven were rendered behind a disclosure, and being SHOWN a card is what
  // made filling it in look like the job. They are no longer sent at all, so
  // they cannot be listed and (with the PUT gate below) cannot be configured.
  //
  // A trade he has already switched ON stays, even when it is not one of his
  // services: it is his row, a homeowner can be quoted from it right now, and
  // the amber "not one of your services" finding is only actionable if the card
  // with the off switch is still on the screen.
  const listable = Object.entries(INSTANT_ESTIMATE_TRADES).filter(
    ([trade]) => instantTradeOffered(trade, enabledKeys) || byTrade.get(trade)?.enabled,
  );

  const trades = listable.map(([trade, spec]) => {
    const row = byTrade.get(trade);
    const seed = INSTANT_ESTIMATE_DEFAULTS[trade] ?? null;
    // ── The pricing IS the company's own pricing where it can be ──────────
    //
    // For a trade whose rates a price book can state, run the derivation over
    // the company's book (their rates patched over ours) and over only the
    // services they have switched on. Null for every other trade, and for a
    // derivable one whose services are all off — nothing to inherit from.
    //
    // This used to be a SEED: a starting point copied onto the instant row,
    // after which the row priced and the book moved on without it. It is now
    // the live figure on both sides — see effectiveInstantConfig in
    // lib/estimate/instantQuoteServer.js.
    const seedInputs = seedInputsFor(trade, enabledRows);
    const derived = deriveInstantSeed(trade, seedInputs);
    // ── What the owner sees is what a homeowner is quoted ─────────────────
    //
    // This file's own header promises that, and it stopped being true the day
    // a trade could be seeded from the price book and then drift from it. The
    // public pricer now reads the book LIVE (effectiveInstantConfig in
    // lib/estimate/instantQuoteServer.js), so the screen applies the same
    // derivation over the same saved row and the promise holds again — with no
    // drift notice and no "adopt" button, because there is nothing left to
    // adopt.
    const config =
      (derived ? applyDerivedSeed(trade, row?.config ?? seed, derived) : row?.config ?? seed) ??
      null;
    // Does the price book state this trade's rates? Then this screen shows
    // them and does not edit them.
    const pricedFromServices = DERIVED_SEED_TRADES.includes(trade) && Boolean(derived);
    // Which of the company's own services this estimator prices. Plural: one
    // `painting` estimator serves interior and exterior painting both.
    const categoryKeys = categoryKeysForInstantTrade(trade);
    return {
      trade,
      label: tradeLabel(trade),
      measure: spec.measure, // roof_address | lawn_polygon | manual_area | manual_units
      // ── Two different questions the screen used to answer by trade NAME ───
      //
      // `spec.hasMaterials` says the public form asks the homeowner to pick a
      // material. It does NOT say the company edits a list of material sell
      // rates: refacing declares it and prices off a per-door rate times a
      // material multiplier, with no `materials[]` rows to iterate. The screen
      // encoded that gap as `trade !== "cabinet_refacing"`, which is a fact
      // about one trade written where a rule belongs. The seed already carries
      // the answer, and reproduces today's set exactly — so this replaces
      // `hasMaterials` in the payload rather than joining it. Sending both would
      // leave a field nothing on the screen reads.
      // A rate the price book states is not editable here any more — it is
      // edited under Services & Pricing, where the quote builder reads it from
      // too. So the material rows and the unit-rate boxes are suppressed for a
      // derived trade and replaced by the read-only block below, which shows
      // the figures the estimator will actually use and links to the one screen
      // that changes them. Two boxes for one number is how they disagree.
      hasMaterialRates: Array.isArray(seed?.materials) && !pricedFromServices,
      // The unit rates this trade prices off, resolved from its price book and
      // its seed — see lib/estimate/instantRateFields.js. Filtered HERE rather
      // than in the browser so a supplier cost flagged `internal` never leaves
      // the server for a screen that edits client-facing prices.
      rateFields: pricedFromServices ? [] : instantRateFields(trade, seed),
      // The rates this trade takes from the company's own price book, as a
      // read-only list: label, the value the estimator will use, and whether
      // it reads as money or a percentage. Present only when the derivation
      // produced something, so the screen never shows an empty "your rates"
      // panel over a trade that has none.
      pricedFromServices: pricedFromServices
        ? seedFields(trade)
            .map((f) => ({ ...f, value: readSeedValue(derived, f.path) }))
            .filter((f) => f.value !== undefined)
        : null,
      enabled: row?.enabled ?? false,
      // Is this one of their trades? Drives the grouping on the settings
      // screen — their own services first, everything else behind a
      // disclosure — so nobody configures a rate card for work they don't do.
      offeredAsService: categoryKeys.some((k) => enabledSet.has(k)),
      serviceLabels: categoryKeys.map(categoryLabel),
      // The company's saved config with their live price-book rates over it —
      // exactly what the public pricer will use — else the reference defaults
      // so they have something to edit rather than a blank grid.
      config,
      isDefaults: !row,
      // Whether the figures on an UNSAVED card are the company's own (read out
      // of their Services & Pricing book) or FieldQuo's reference points. The
      // note must not let the second pass for the first.
      derivedFromServices: !row && Boolean(derived),
      // Painting only: which scopes the company sells, so the screen can
      // show the surcharge box for those and grey the other — and say plainly
      // when neither is on, because the public page then offers no painting
      // at all (loadCompanyInstantTrades drops it).
      ...(trade === "painting" && { scopesOffered: seedInputs.offered }),
      // Whether a homeowner can actually get a number out of the SAVED config,
      // dry-run through the public pricer. An enabled trade that can't price is
      // a dead control in front of a stranger, and the contractor is the only
      // person allowed to be told why — so it's computed here, behind auth, and
      // never on the public endpoint.
      // Dry-run over the config that will actually price — the saved row with
      // the live book over it — not over the row alone. A trade whose rate now
      // comes from Services would otherwise be reported unready for a box this
      // screen no longer shows.
      readiness: instantQuoteReadiness(trade, row ? config : null),
    };
  });

  // ── Where the two screens disagree ───────────────────────────────────────
  //
  // Reported, never repaired. He has roofing switched on; that is his row and
  // his call, and a migration that turned it off on his behalf would be a
  // destructive operation labelled as tidying. So the screen says what it sees
  // and every change still comes from him pressing something.
  const mismatches = catalogueMismatches({
    enabledCategoryKeys: enabledKeys,
    instantRows: saved.map((r) => ({ trade: r.trade, enabled: r.enabled })),
    wiredTrades: Object.keys(INSTANT_ESTIMATE_TRADES),
  });

  return NextResponse.json({
    trades,
    canEdit: isPricingAdmin(member.role),
    // Labelled here rather than in the catalogue: the estimator's public name
    // ("Stairs & Railings") is not the catalogue's name for the trade
    // ("Stairs"), and the screen is talking about the estimator.
    mismatches: {
      instantWithoutService: mismatches.instantWithoutService.map((m) => ({
        ...m,
        tradeLabel: tradeLabel(m.trade),
      })),
      serviceWithoutInstant: mismatches.serviceWithoutInstant.map((m) => ({
        ...m,
        tradeLabel: tradeLabel(m.trade),
      })),
    },
    // What a homeowner opening the public link would see right now. The owner
    // asked "so I have to turn it on somewhere?" while looking at this screen;
    // the answer belongs on it.
    liveTradeCount: trades.filter(
      (t) =>
        t.enabled &&
        t.readiness.ok &&
        // Painting with no scope sold is not on the public page, however
        // ready its row is.
        !(t.trade === "painting" && t.scopesOffered.length === 0),
    ).length,
    companySlug: company?.slug || null,
    // Company-level, not per-trade — one financing offer for the business.
    financing: normaliseFinancing(company?.financing),
    // The form's look, normalised (a saved value the normaliser rejects reads
    // as the default, which is what the public page will draw), the brand it
    // derives from, and whether the job address is locked by a service area.
    formAppearance: normaliseFormAppearance(company?.publicFormAppearance).appearance,
    brandColor: company?.brandColor || null,
    serviceAreaConfigured: serviceAreaConfigured(company),
    // Where the estimate REPORT's website tile sends a homeowner: the saved
    // choice (null = automatic), what the automatic rule would pick today,
    // and the two candidate URLs so the screen can say what each choice
    // means rather than offering "FieldQuo site" to a company with none.
    reportWebsite: {
      setting: reportWebsiteChoice(company?.instantReportWebsite),
      automatic: resolveReportWebsite({ company: { website: company?.website, instantReportWebsite: null }, site: company?.site }),
      ownUrl: ownWebsiteUrl(company),
      hostedUrl: hostedSiteUrl(company?.site),
      hostedTailored: siteIsTailored(company?.site),
    },
  });
}

export async function PUT(request) {
  const { member, response } = await memberOrRefusal(request);
  if (response) return response;

  if (!isPricingAdmin(member.role)) {
    return NextResponse.json(
      { error: "Only an owner or admin can set instant-quote pricing." },
      { status: 403 },
    );
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  // ── Company-level financing save ─────────────────────────────────────────
  //
  // Distinct from the per-trade rate save below: financing is one offer for the
  // whole business, so a `{ financing }` payload (no trade) updates the company
  // and returns. normaliseFinancing drops a bad URL and clamps the note before
  // it's stored.
  if (body && body.financing !== undefined) {
    const financing = normaliseFinancing(body.financing);
    await db.company.update({
      where: { id: member.companyId },
      data: { financing },
    });
    await recordActivity(member, {
      action: "settings.financing_updated",
      entityType: "settings",
      summary: financing.enabled ? "Turned on financing on estimates" : "Turned off financing",
      metadata: {
        enabled: financing.enabled,
        mode: financing.url ? "provider" : "contact",
        // Whether a monthly estimate is now shown to homeowners, and on what.
        // This is the company committing to a rate in front of clients, so it
        // belongs in the audit trail rather than only in the row.
        aprPct: financing.aprPct,
        termMonths: financing.termMonths,
      },
    });
    return NextResponse.json({ ok: true, financing });
  }

  // ── The report's website link ────────────────────────────────────────────
  //
  // Same shape as the financing save: a `{ instantReportWebsite }` payload
  // updates the company and returns. "auto" (or null) clears the override.
  if (body && body.instantReportWebsite !== undefined) {
    const choice = reportWebsiteChoice(body.instantReportWebsite);
    await db.company.update({
      where: { id: member.companyId },
      data: { instantReportWebsite: choice },
    });
    await recordActivity(member, {
      action: "settings.instant_report_website_updated",
      entityType: "settings",
      summary: choice
        ? `Estimate report website link set to "${choice}"`
        : "Estimate report website link set to automatic",
      metadata: { choice },
    });
    return NextResponse.json({ ok: true, instantReportWebsite: choice });
  }

  // ── The form's look ──────────────────────────────────────────────────────
  //
  // `{ formAppearance }` — company-level like financing. Normalised (unknown
  // keys dropped, a value outside its set replaced by the default), then
  // MEASURED against the company's brand: a preset whose text cannot reach
  // 4.5:1 on its surface is refused with the failing pairs named, never
  // saved for a stranger to squint at. The default look is stored as null,
  // which is also what every company had before the setting existed.
  if (body && body.formAppearance !== undefined) {
    const { appearance } = normaliseFormAppearance(body.formAppearance);
    const company = await db.company.findUnique({
      where: { id: member.companyId },
      select: { brandColor: true },
    });
    const palette = formPalette(company?.brandColor, appearance);
    if (palette.failures.length) {
      return NextResponse.json(
        {
          error: `That look can't be read on your brand colour: ${palette.failures
            .map((f) => `${f.label} measures ${f.ratio}:1 (needs ${f.need}:1)`)
            .join("; ")}. Pick another surface or field style.`,
          failures: palette.failures,
        },
        { status: 400 },
      );
    }
    const stored = isDefaultAppearance(appearance) ? null : appearance;
    await db.company.update({
      where: { id: member.companyId },
      data: { publicFormAppearance: stored },
    });
    await recordActivity(member, {
      action: "settings.form_appearance_updated",
      entityType: "settings",
      summary: stored
        ? `Public form look set to ${Object.entries(stored).map(([k, v]) => `${k}=${v}`).join(", ")}`
        : "Public form look reset to the standard look",
      metadata: { appearance: stored },
    });
    return NextResponse.json({ ok: true, formAppearance: appearance });
  }

  const { trade, enabled, config: postedConfig } = body || {};
  const spec = INSTANT_ESTIMATE_TRADES[trade];
  if (!spec) {
    return NextResponse.json({ error: "Unknown trade" }, { status: 400 });
  }

  // ── The form's fields, per trade ─────────────────────────────────────────
  //
  // `config.fields` (lib/estimate/formFields.js) is normalised before it is
  // stored: unknown field names and unknown states are dropped rather than
  // saved for the public route to trip on, and the one rule the setting may
  // not break — phone and email both hidden — is refused with a sentence
  // instead of silently corrected, because a silent correction is a switch
  // that looks flipped and isn't. A config with no `fields` is stored as it
  // came, which the public route reads as the defaults.
  let config = postedConfig;
  if (config && typeof config === "object" && !Array.isArray(config) && config.fields !== undefined) {
    const { fields, problems } = normaliseFormFields(config.fields);
    if (problems.some((p) => p.key === "contact")) {
      return NextResponse.json(
        { error: "Phone and email can't both be hidden — a homeowner has to leave one way to be reached." },
        { status: 400 },
      );
    }
    config = { ...config, fields };
  }

  // Refuse to enable a trade that can't actually price, or one the company
  // doesn't sell. Better a clear error here than a public "instant quote"
  // button that returns needsConfig — a dead control in front of a homeowner
  // is exactly what this product forbids.
  //
  // The price check is the READINESS dry-run, not a hand-written mirror of the
  // estimator's rules. The hand-written mirror is what let Cabinet Refacing
  // through: it validated a per-door price the public pricer never looked at.
  //
  // The SERVICE check is the other half of the GET no longer listing a trade
  // the company doesn't sell: hiding the card is not access control, and a
  // POST around the screen must not switch one on either. Only on enable —
  // saving or switching OFF a trade whose service was since withdrawn has to
  // stay possible, or a company that turned a service off is left with a row
  // they can never reach to turn off.
  if (enabled) {
    const enabledKeys = (
      await db.companyServiceCategory.findMany({
        where: { companyId: member.companyId, enabled: true },
        select: { category: { select: { key: true } } },
      })
    )
      .map((r) => r.category?.key)
      .filter(Boolean);
    if (!instantTradeOffered(trade, enabledKeys)) {
      const labels = categoryKeysForInstantTrade(trade).map(categoryLabel);
      return NextResponse.json(
        {
          error: `You don't sell ${labels.join(" or ") || tradeLabel(trade)} yet. Switch it on under Settings › Services first — that's the list your quotes, your website and this estimator all read.`,
        },
        { status: 400 },
      );
    }
    const readiness = instantQuoteReadiness(trade, config);
    if (!readiness.ok) {
      return NextResponse.json(
        { error: [readiness.message, readiness.fix].filter(Boolean).join(" ") },
        { status: 400 },
      );
    }
  }

  const saved = await db.instantQuoteConfig.upsert({
    where: { companyId_trade: { companyId: member.companyId, trade } },
    update: { enabled: Boolean(enabled), config: config ?? null },
    create: {
      companyId: member.companyId,
      trade,
      enabled: Boolean(enabled),
      config: config ?? null,
    },
  });

  await recordActivity(member, {
    action: "settings.instant_quote_updated",
    entityType: "settings",
    entityId: saved.trade,
    summary: `${saved.enabled ? "Enabled" : "Updated"} instant-quote pricing for ${saved.trade}`,
    metadata: { trade: saved.trade, enabled: saved.enabled },
  });

  // ── The phone receptionist asks for whatever this trade needs ───────────
  //
  // Its questions are derived from these rows (lib/voice/quoteQuestions.js), so
  // enabling a trade here and not pushing would leave an agent that has never
  // heard of it — the settings screen saying one thing and the phone another,
  // which is the whole reason provisionAgent pushes on every save.
  //
  // Best-effort, and it never creates an agent: reprovisionIfLive refuses when
  // the company has no live one, so a company that has never set up voice pays
  // nothing for saving a rate card.
  await reprovisionIfLive(member.companyId, getAppOrigin(request)).catch((err) =>
    console.error("[settings/instant-quote] couldn't refresh the receptionist:", err?.message),
  );

  return NextResponse.json({ ok: true, trade: saved.trade, enabled: saved.enabled });
}
