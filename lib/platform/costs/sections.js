// lib/platform/costs/sections.js
//
// The three sections /platform/costs is built from, as a pure function of
// the ledgers summary.js reads.
//
// ══ Why three sections and not one table ═════════════════════════════════
//
// The owner read "OpenAI — FieldQuo's own $20.31" and asked "we spend $20?
// how?" — it was the sales floor's research briefs, and nothing on the page
// said so. So no line may say "FieldQuo's own" without saying which of
// three businesses it belongs to:
//
//   1. Sales floor      what FieldQuo spends to SELL — the reps' calls,
//                       recordings and texts, their numbers, the pipeline's
//                       AI by area, the prospect lookups, FieldQuo's own
//                       Retell sales line.
//   2. Companies        what FieldQuo spends SERVING customers — tenants'
//                       Retell minutes and rent, client and crew texts, crew
//                       lines, the companies' AI — and beside each, what the
//                       companies were CHARGED for it, from the credit
//                       ledger, so the margin is visible per line.
//   3. Platform itself  what keeps the lights on — database, hosting,
//                       email, maps, Stripe's fees on FieldQuo's own
//                       revenue, and the hand-entered bills.
//
// Every line carries provider · sourceKind (api / computed / hand) · asOf.
// The three totals sum to the page total: a Twilio charge nobody can
// attribute goes to section 3 under its own name rather than being spread.
//
// ══ A hand-entered bill adds, or reconciles, never both ══════════════════
//
// A bill typed in for a provider the section already has an API or
// computed line for (OpenAI's invoice beside the pulled Costs figure,
// Retell's beside the per-call sum) is printed as a reconciliation —
// "invoice $X · pulled $Y" — and NOT added, or the month would count it
// twice. A bill for a provider with no line of its own (Vercel, Namecheap)
// is the line, and the section total says "includes hand-entered bills".
import { TWILIO_CATEGORY_LABELS } from "./dailyLedger";
import { splitOpenaiCategory } from "./openaiCosts";
import { NEON_METRICS, splitNeonCategory } from "./neonConsumption";
import { STRIPE_CATEGORY_LABELS, splitStripeCategory } from "./stripeFees";
import { fixedBillSection } from "./fixedBills";

const r4 = (n) => Math.round(n * 10000) / 10000;
const num = (v) => (v === null || v === undefined || v === "" || !Number.isFinite(Number(v)) ? null : Number(v));

export const SECTION_KEYS = Object.freeze(["sales", "companies", "platform"]);
export const SECTION_TITLES = Object.freeze({
  sales: "Sales floor",
  companies: "Companies",
  platform: "Platform itself",
});
export const SECTION_BLURBS = Object.freeze({
  sales: "What FieldQuo spends to sell: the reps' calls, recordings and texts, their numbers, the prospecting pipeline's AI, and the lookups that feed it.",
  companies: "What FieldQuo spends serving customers, and beside each line what the companies were charged for it.",
  platform: "What keeps the product running: database, hosting, email, maps, Stripe's cut of FieldQuo's own revenue, and the bills typed in from invoices.",
});

/** The sales-pipeline AI areas in English, with what one unit is. */
export const AI_AREA_LABELS = Object.freeze({
  research_brief: { label: "Research briefs", unit: "brief" },
  call_script: { label: "Call scripts", unit: "script" },
  trade_suggestion: { label: "Trade suggestions", unit: "suggestion" },
  site_inference: { label: "Site inference", unit: "site" },
  playbook_talking_points: { label: "Playbook talking points", unit: "playbook" },
  sales_call_transcript: { label: "Call transcripts (Whisper)", unit: "call" },
  sales_transcript: { label: "Call transcripts (Whisper)", unit: "call" },
  sales_call_qa: { label: "Call QA scoring", unit: "call" },
  sms_reply_triage: { label: "Text-reply triage", unit: "reply" },
  retention_checkin: { label: "Retention check-in drafts", unit: "draft" },
});

/** "5¢ per 100" / "$1.20 each" — what a unit costs, from cents and a count. PURE. */
export function perUnitStatement(cents, count, unit = "unit") {
  const c = num(cents);
  const n = num(count);
  if (c === null || !n || n <= 0) return null;
  const each = c / n;
  if (each >= 1) return `$${(each / 100).toFixed(2)} per ${unit}`;
  const per100 = each * 100;
  if (per100 >= 1) return `${Math.round(per100 * 10) / 10}¢ per 100`;
  return `${Math.round(each * 1000 * 100) / 100}¢ per 1,000`;
}

function line({ key, label, cents, provider, sourceKind, source, asOf, note = null, units = null, unitLabel = null, count = null, perUnit = null, charged = null, isFloor = false }) {
  return { key, label, cents: cents === undefined ? null : cents, provider, sourceKind, source, asOf, note, units, unitLabel, count, perUnit, charged, isFloor };
}

function sumLines(lines) {
  let cents = 0;
  let complete = true;
  for (const l of lines) {
    if (l.cents === null) complete = false;
    else cents += l.cents;
  }
  return { cents: r4(cents), complete };
}

/**
 * @param twilio         summariseTwilio() + sides (summary.js's twilio block)
 * @param openai         { platform: { byArea: [{ area, micros, calls, unpriced, tokens }] , micros, unpricedCalls }, tenants: { byFeature, micros, companies }, asOf }
 * @param openaiBilled   { lines: [{ category, cents, units, unit, currency }], totalCents|null, daysBilled, asOf, lastPullAt, configured, envVar, reconciliation }
 * @param retell         summary.js's retell block ({ platform, tenants, rent, numbersHeld, asOf })
 * @param places, localScrape, apify   { cents, requests|places, asOf, source, lines? }
 * @param neon           { lines: [{ category, cents|null, units, unit }], pricedCents|null, unpricedCount, asOf, lastPullAt, configured, envVar, plans }
 * @param stripe         { lines: [{ category, cents, units, count }], keptCents|null, grossChargeCents|null, asOf, lastPullAt, configured }
 * @param charged        { byKind: { call, number_rent, number_setup, crew_line_rent, crew_line_setup, crew_text, image_generation, image_vision, … } } cents (positive) companies were debited in the period
 * @param fixed          fixedBillsForPeriod() output ({ byProvider: [{ provider, label, section, cents, wholeMonthCents, bills }] })
 * @param now
 */
export function buildSections({ twilio, openai, openaiBilled, retell, places, localScrape, apify, neon, stripe, charged = { byKind: {} }, fixed = { byProvider: [] }, now = new Date() } = {}) {
  const sales = [];
  const companies = [];
  const platform = [];
  const twilioAsOf = twilio?.lastPullAt || null;
  const twilioSource = "Twilio Usage Records → PlatformCostDaily (pulled hourly)";

  // ── 1. Sales floor ──────────────────────────────────────────────────────
  for (const l of twilio?.sides?.sales?.lines || []) {
    if (l.cents === 0) continue;
    const cat = twilio.lines.find((x) => x.category === l.category);
    sales.push(line({
      key: `twilio:${l.category}`,
      label: TWILIO_CATEGORY_LABELS[l.category] || l.category,
      cents: l.cents,
      provider: "twilio",
      sourceKind: "api",
      source: twilioSource,
      asOf: twilioAsOf,
      note: l.how,
      units: cat?.units ?? null,
      unitLabel: cat?.unit ?? null,
      count: cat?.count ?? null,
    }));
  }
  for (const a of openai?.platform?.byArea || []) {
    const meta = AI_AREA_LABELS[a.area] || { label: a.area, unit: "call" };
    const cents = r4((a.micros || 0) / 10000);
    sales.push(line({
      key: `openai:${a.area}`,
      label: meta.label,
      cents,
      provider: "openai",
      sourceKind: "computed",
      source: "PlatformAiUsage × lib/ai/usage.js price table (vendor token counts; the dollar is computed, not billed)",
      asOf: openai?.asOf || now,
      note: `${Number(a.calls || 0).toLocaleString("en-CA")} ${meta.unit}${a.calls === 1 ? "" : "s"}${a.tokens ? ` · ${Number(a.tokens).toLocaleString("en-CA")} tokens` : ""}${a.unpriced ? ` · ${a.unpriced} unpriced calls not summed` : ""}`,
      units: a.tokens ?? null,
      unitLabel: "tokens",
      count: a.calls,
      perUnit: perUnitStatement(cents, a.calls, meta.unit),
      isFloor: Boolean(a.unpriced),
    }));
  }
  if (retell?.platform && (retell.platform.calls > 0 || retell.platform.cents)) {
    sales.push(line({
      key: "retell:sales_line",
      label: "Retell — the sales floor's own line (the marketing number's agent)",
      cents: retell.platform.cents,
      provider: "retell",
      sourceKind: "api",
      source: "PlatformVoiceCall.providerCostCents — Retell's per-call figure from its webhook",
      asOf: retell.asOf || now,
      note: `${retell.platform.calls} calls${retell.platform.unknownCalls ? `, ${retell.platform.unknownCalls} with no figure yet` : ""}`,
      count: retell.platform.calls,
      isFloor: Boolean(retell.platform.unknownCalls),
    }));
  }
  if (places) {
    sales.push(line({
      key: "google_places",
      label: "Google Places — prospect checks",
      cents: places.cents,
      provider: "google_places",
      sourceKind: "computed",
      source: places.source,
      asOf: places.asOf || now,
      note: `${Number(places.requests || 0).toLocaleString("en-CA")} requests at list price · Google's first 1,000 a month are free and not subtracted`,
      count: places.requests,
      perUnit: perUnitStatement(places.cents, places.requests, "request"),
    }));
  }
  if (apify && (apify.cents || apify.count)) {
    sales.push(line({
      key: "apify",
      label: "Apify — BBB and Google Maps scrapes",
      cents: apify.cents,
      provider: "apify",
      sourceKind: "api",
      source: apify.source,
      asOf: apify.asOf || now,
      note: `${Number(apify.count || 0).toLocaleString("en-CA")} runs`,
      count: apify.count,
    }));
  }
  if (localScrape) {
    sales.push(line({
      key: "local_scrape",
      label: "Google Maps — read from the owner's Mac",
      cents: 0,
      provider: "local_scrape",
      sourceKind: "computed",
      source: localScrape.source,
      asOf: localScrape.asOf || now,
      note: `${Number(localScrape.places || 0).toLocaleString("en-CA")} places at $0 — the same fields Places charges $35/1,000 for`,
      count: localScrape.places,
    }));
  }

  // ── 2. Companies — cost beside what they were charged ───────────────────
  const kinds = charged?.byKind || {};
  const chargedOf = (...ks) => {
    let total = 0;
    let any = false;
    for (const k of ks) {
      if (num(kinds[k]) !== null) {
        any = true;
        total += Number(kinds[k]);
      }
    }
    return any ? r4(total) : 0;
  };
  const chargedBlock = (cents, how) => ({ cents, how, source: "VoiceCreditEntry — the credit ledger's debits in the period, by kind" });
  if (retell?.tenants) {
    companies.push(line({
      key: "retell:tenant_calls",
      label: "Retell — companies' receptionist minutes",
      cents: retell.tenants.cents,
      provider: "retell",
      sourceKind: "api",
      source: "VoiceCall.providerCostCents — Retell's per-call figure from its webhook",
      asOf: retell.asOf || now,
      note: `${retell.tenants.calls} calls${retell.tenants.unknownCalls ? `, ${retell.tenants.unknownCalls} with no figure yet` : ""}${retell.tenants.seconds ? ` · ${Math.round(retell.tenants.seconds / 60)} minutes` : ""}`,
      count: retell.tenants.calls,
      isFloor: Boolean(retell.tenants.unknownCalls),
      charged: chargedBlock(chargedOf("call"), "kind = call"),
    }));
    companies.push(line({
      key: "retell:rent",
      label: "Retell — number rent",
      cents: retell.rent?.cents ?? null,
      provider: "retell",
      sourceKind: "computed",
      source: "Numbers held × US$2.00/month list price (retellai.com/pricing) prorated — Retell publishes no billing endpoint",
      asOf: retell.asOf || now,
      note: retell.rent?.cents === null ? "the count of Retell numbers could not be read" : `${retell.numbersHeld} numbers held today`,
      count: retell.numbersHeld,
      charged: chargedBlock(chargedOf("number_rent", "number_setup"), "kinds number_rent + number_setup"),
    }));
  }
  for (const l of twilio?.sides?.tenants?.lines || []) {
    if (l.cents === 0) continue;
    const cat = twilio.lines.find((x) => x.category === l.category);
    const isSms = l.category === "sms-outbound" || l.category === "sms-inbound";
    const isNumbers = l.category === "phonenumbers";
    companies.push(line({
      key: `twilio:tenants:${l.category}`,
      label: isNumbers ? "Twilio — crew lines held" : isSms ? `Twilio — client and crew texts (${l.category === "sms-outbound" ? "out" : "in"})` : `Twilio — ${TWILIO_CATEGORY_LABELS[l.category] || l.category}`,
      cents: l.cents,
      provider: "twilio",
      sourceKind: "api",
      source: twilioSource,
      asOf: twilioAsOf,
      note: l.how,
      units: cat?.units ?? null,
      unitLabel: cat?.unit ?? null,
      count: cat?.count ?? null,
      charged: isNumbers
        ? chargedBlock(chargedOf("crew_line_rent", "crew_line_setup"), "kinds crew_line_rent + crew_line_setup")
        : isSms
          ? { ...chargedBlock(l.category === "sms-outbound" ? chargedOf("crew_text") : 0, l.category === "sms-outbound" ? "kind = crew_text (both directions of the crew inbox are debited on the reply)" : "client texts from the system number are inside the subscription — no per-text charge"), inPlan: l.category !== "sms-outbound" }
          : null,
    }));
  }
  if (openai?.tenants) {
    const cents = r4((openai.tenants.micros || 0) / 10000);
    const imageCharged = chargedOf("image_generation", "image_vision");
    companies.push(line({
      key: "openai:tenants",
      label: "OpenAI — companies' AI (copilot, digests, translations, images)",
      cents,
      provider: "openai",
      sourceKind: "computed",
      source: "AiUsage × lib/ai/usage.js price table (vendor token counts; the dollar is computed, not billed)",
      asOf: openai.asOf || now,
      note: `${(openai.tenants.byFeature || []).reduce((s, f) => s + Number(f.calls || 0), 0).toLocaleString("en-CA")} calls · ${openai.tenants.companies ?? "?"} companies`,
      count: (openai.tenants.byFeature || []).reduce((s, f) => s + Number(f.calls || 0), 0),
      charged: { ...chargedBlock(imageCharged, "kinds image_generation + image_vision from the AI wallet; text features are inside the plan's monthly allowance and carry no per-call charge"), inPlan: true },
    }));
  }

  // ── 3. Platform itself ──────────────────────────────────────────────────
  if (neon) {
    const priced = (neon.lines || []).filter((l) => l.cents !== null);
    const unpriced = (neon.lines || []).filter((l) => l.cents === null);
    const metricLabel = (cat) => {
      const { metric, projectId } = splitNeonCategory(cat);
      const m = NEON_METRICS.find((x) => x.key === metric);
      return `${m?.label || metric}${projectId ? ` · ${projectId}` : ""}`;
    };
    if (!neon.configured) {
      platform.push(line({ key: "neon", label: "Neon — database", cents: null, provider: "neon", sourceKind: "api", source: "Neon consumption API", asOf: null, note: `waiting for ${neon.envVar} — nothing is pulled until it is set` }));
    } else if ((neon.lines || []).length === 0) {
      platform.push(line({ key: "neon", label: "Neon — database", cents: null, provider: "neon", sourceKind: "api", source: "Neon consumption API", asOf: neon.lastPullAt, note: neon.lastPullAt ? "no consumption rows in this period" : "not pulled yet — the daily pull runs within the hour" }));
    } else {
      for (const l of priced) {
        platform.push(line({
          key: `neon:${l.category}`,
          label: `Neon — ${metricLabel(l.category)}`,
          cents: l.cents,
          provider: "neon",
          sourceKind: "computed",
          source: `Neon consumption API units × the plan's list rate on neon.com/pricing (read 2026-09-19) — not Neon's invoice; data transfer, branches and restores are not in the API`,
          asOf: neon.lastPullAt,
          units: l.units,
          unitLabel: l.unit,
        }));
      }
      for (const l of unpriced) {
        const { metric } = splitNeonCategory(l.category);
        const m = NEON_METRICS.find((x) => x.key === metric);
        platform.push(line({
          key: `neon:${l.category}`,
          label: `Neon — ${metricLabel(l.category)}`,
          cents: m?.priced ? null : 0,
          provider: "neon",
          sourceKind: "api",
          source: "Neon consumption API — units only",
          asOf: neon.lastPullAt,
          units: l.units,
          unitLabel: l.unit,
          note: m?.priced ? `${Number(l.units).toLocaleString("en-CA")} ${l.unit} × your plan's rate — enter Neon's invoice under Fixed bills` : "not a billed metric; shown for scale",
        }));
      }
    }
  }
  if (stripe) {
    if (!stripe.configured) {
      platform.push(line({ key: "stripe", label: "Stripe — fees on FieldQuo's own revenue", cents: null, provider: "stripe", sourceKind: "api", source: "Stripe balance transactions", asOf: null, note: "waiting for STRIPE_SECRET_KEY" }));
    } else if ((stripe.lines || []).length === 0) {
      platform.push(line({ key: "stripe", label: "Stripe — fees on FieldQuo's own revenue", cents: null, provider: "stripe", sourceKind: "api", source: "Stripe balance transactions", asOf: stripe.lastPullAt, note: stripe.lastPullAt ? "no balance transactions in this period" : "not pulled yet — the daily pull runs within the hour" }));
    } else {
      for (const l of stripe.lines) {
        const { reportingCategory, currency } = splitStripeCategory(l.category);
        platform.push(line({
          key: `stripe:${l.category}`,
          label: `Stripe kept — ${STRIPE_CATEGORY_LABELS[reportingCategory] || reportingCategory}${currency !== "USD" ? ` (${currency})` : ""}`,
          cents: l.cents,
          provider: "stripe",
          sourceKind: "api",
          source: "Stripe balance transactions on FieldQuo's own account — `fee` per transaction plus Stripe's own fee lines",
          asOf: stripe.lastPullAt,
          units: l.units,
          unitLabel: `gross ${currency} minor units`,
          count: l.count,
          note: reportingCategory === "charge" && l.units !== null ? `on $${(Number(l.units) / 100).toFixed(2)} gross${currency !== "USD" ? ` ${currency}` : ""} in ${l.count} charges` : `${l.count} transactions`,
        }));
      }
    }
  }
  for (const l of twilio?.sides?.unattributed?.lines || []) {
    if (l.cents === 0) continue;
    platform.push(line({
      key: `twilio:unattributed:${l.category}`,
      label: `Twilio — ${TWILIO_CATEGORY_LABELS[l.category] || l.category} (not attributed)`,
      cents: l.cents,
      provider: "twilio",
      sourceKind: "api",
      source: twilioSource,
      asOf: twilioAsOf,
      note: l.how,
    }));
  }

  // ── Hand-entered bills: add where there is no line, reconcile where there is ──
  const providersWithLines = { sales: new Set(sales.map((l) => l.provider)), companies: new Set(companies.map((l) => l.provider)), platform: new Set(platform.filter((l) => l.cents !== null).map((l) => l.provider)) };
  const reconciliations = [];
  const buckets = { sales, companies, platform };
  for (const fb of fixed?.byProvider || []) {
    const section = fixedBillSection(fb.provider);
    const target = buckets[section];
    const hasLine = providersWithLines[section].has(fb.provider);
    if (hasLine) {
      const pulled = r4(target.filter((l) => l.provider === fb.provider && l.cents !== null).reduce((s, l) => s + l.cents, 0));
      reconciliations.push({ provider: fb.provider, section, invoiceCents: fb.cents, pulledCents: pulled, bills: fb.bills, statement: `${fb.label}: invoice ${fmt(fb.cents)} (hand-entered${fb.bills.some((b) => b.share < 1) ? ", this period's share" : ""}) · pulled/computed ${fmt(pulled)} — ${diffWords(pulled, fb.cents)}` });
      continue;
    }
    target.push(line({
      key: `fixed:${fb.provider}`,
      label: `${fb.label} — invoice`,
      cents: fb.cents,
      provider: fb.provider,
      sourceKind: "hand",
      source: "PlatformFixedBill — typed in from the invoice by a superadmin",
      asOf: null,
      note: fb.bills.map((b) => b.statement).join(" · ") + (fb.bills.some((b) => b.share < 1) ? ` — ${fmt(fb.wholeMonthCents)} for the whole month, this period's share shown` : ""),
    }));
  }

  const out = {};
  for (const key of SECTION_KEYS) {
    const lines = buckets[key];
    const { cents, complete } = sumLines(lines);
    out[key] = {
      key,
      title: SECTION_TITLES[key],
      blurb: SECTION_BLURBS[key],
      totalCents: cents,
      complete,
      isFloor: !complete || lines.some((l) => l.isFloor),
      includesHandEntered: lines.some((l) => l.sourceKind === "hand"),
      sourceKinds: { api: lines.filter((l) => l.sourceKind === "api").length, computed: lines.filter((l) => l.sourceKind === "computed").length, hand: lines.filter((l) => l.sourceKind === "hand").length },
      chargedCents: key === "companies" ? r4(lines.reduce((s, l) => s + (l.charged?.cents || 0), 0)) : null,
      lines,
    };
  }
  const totalCents = r4(SECTION_KEYS.reduce((s, k) => s + out[k].totalCents, 0));
  return {
    sections: out,
    totalCents,
    complete: SECTION_KEYS.every((k) => out[k].complete),
    includesHandEntered: SECTION_KEYS.some((k) => out[k].includesHandEntered),
    reconciliations,
    openaiBilled: openaiBilled || null,
  };
}

function fmt(cents) {
  const c = num(cents);
  return c === null ? "unknown" : `$${(c / 100).toFixed(2)}`;
}

function diffWords(pulled, invoice) {
  const p = num(pulled);
  const i = num(invoice);
  if (p === null || i === null || i === 0) return "cannot compare";
  const pct = Math.round(((p - i) / i) * 1000) / 10;
  if (pct === 0) return "level";
  return `pulled is ${Math.abs(pct)}% ${pct > 0 ? "over" : "under"} the invoice`;
}

/** The OpenAI billed lines grouped for the page: per project, per line item. PURE. */
export function groupOpenaiBilled(lines) {
  const byProject = new Map();
  for (const l of Array.isArray(lines) ? lines : []) {
    const { projectId, lineItem } = splitOpenaiCategory(l.category);
    if (lineItem === null && projectId === null) continue;
    const key = projectId || "(organisation)";
    const cur = byProject.get(key) || { projectId: key, cents: 0, lines: [] };
    cur.cents = r4(cur.cents + (num(l.cents) || 0));
    cur.lines.push({ lineItem: lineItem || "(all)", cents: num(l.cents), units: l.units, unit: l.unit });
    byProject.set(key, cur);
  }
  return [...byProject.values()].sort((a, b) => b.cents - a.cents);
}
