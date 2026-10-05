// app/api/plan-reads/[id]/draft-quote/route.js
//
// GET — the drawing read's draft, in the shape the quote builder opens with
// (`/app/quotes/new?fromPlanRead=<id>`, app/components/quotes/builder/
// QuoteBuilder.js). Nothing is saved until the estimator presses Save.
//
//   painting   one scope group per category, each holding the
//              `area_substrate` paint TAKEOFF the read produced — the builder
//              prices it from the company's book exactly as a typed one.
//   trades     one group per trade beyond painting, under the company's own
//              category for it (the read's scope first), holding the lines
//              the pricing ladder priced from the COMPANY's rates — its
//              drywall or roofing rate card, its own services
//              (lib/planRead/tradePricing.js). FieldQuo-suggested lines go on
//              ONLY when a person pressed "Use FieldQuo suggestions" for that
//              trade on the read, and every one is flagged
//              (meta.aiSuggested — source and coefficients) and says so in
//              its office detail.
//   margin     the margin adjustment a person added on the read, as its own
//              visible line (the owner's decision #9 — never a silent scale).
//
// The figures that ride along are the company's own rates and the
// estimator's own choices — the model never wrote one. The summary,
// assumptions, exclusions, open questions, unpriced items and equipment go to
// the INTERNAL review notes.
//
// One drawing set → several quotes (the first pass, 2026-10-05):
// `?scope=<key>` drafts ONE part of the read — "exterior_painting",
// "interior_painting" or "trade:<trade>" (lib/planRead/slices.js) — with only
// its own areas, access, crew plan and price. No re-read: the same read,
// filtered. Without it, the whole read, as before. Onto an existing quote is
// still the plan's P4.
//
// Access lines carry their price: the estimator's own, else the company's
// rental rates, else the cited reference (lib/planRead/firstPass.js); an
// estimate not yet confirmed says so in the office notes.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { memberOrRefusal } from "@/lib/apiMember";
import { levelOrRefusal } from "@/lib/permissions/apiGate";
import { loadPlanRead } from "@/lib/planRead/load";
import { priceReadNow } from "@/lib/planRead/priceRead";
import { categoryForTrade } from "@/lib/planRead/tradePricing";
import { tradesFromScope } from "@/lib/planRead/tradeCatalogue";
import { ASSUMED, ASSUMED_KEYS } from "@/lib/planRead/firstPassRules";
import { buildReview } from "@/lib/planRead/review";

const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100;

export async function GET(request, { params }) {
  const { id } = await params;
  const { member, response } = await memberOrRefusal(request);
  if (response) return response;
  const { response: denied } = await levelOrRefusal(member, "quotes", "view_create_edit", "create a quote from a drawing read");
  if (denied) return denied;

  const read = await loadPlanRead(id, member.companyId, { messages: false });
  if (!read) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!read.model) return NextResponse.json({ error: "Run the read first." }, { status: 409 });

  const out = await priceReadNow(read, { companyId: member.companyId, prisma: db });
  let { computed, pricedPaint: priced, pricing } = out;
  const { ctx } = out;
  const scopeKey = new URL(request.url).searchParams.get("scope");
  let slice = null;
  if (scopeKey) {
    slice = (out.slices || []).find((x) => x.key === scopeKey) || null;
    if (!slice) return NextResponse.json({ error: "That part of the read doesn't exist any more — open the read again." }, { status: 404 });
    computed = { ...slice.computed, trades: slice.computed.trades || [] };
    priced = slice.priced || { groups: [], lines: [], access: [], skipped: [], subtotal: 0, accessTotal: 0, unpricedAccess: 0 };
    pricing = slice.pricing || pricing;
  }
  const office = (extra) => ({ aiDrafted: true, source: "plan_read", planReadId: read.id, ...extra });

  // Priced above zero only: a 0 is equipment the company owns — priced, so
  // not "unpriced" below, but a $0 line on the client's quote reads as free
  // work, so it is named in the review notes instead.
  const extraLines = priced.access
    .filter((a) => a.price !== null && a.price > 0)
    .map((a) => ({
      description: `${a.label}${a.areaName ? ` — ${a.areaName}` : ""}`,
      quantity: 1,
      unit: "flat",
      rate: a.price,
      amount: a.price,
      // Office-only provenance; never rendered to the client. aiPriced: the
      // chat entered the figure from the estimator's own words — verify.
      // accessEstimate: priced from the company's rental rates or the cited
      // reference, not yet confirmed by a person.
      meta: office({
        ...(a.priceSource === "ai" ? { aiPriced: true } : {}),
        ...(a.priceSource === "reference" || a.priceSource === "company" ? { accessEstimate: { source: a.priceSource, why: a.why || null } } : {}),
        // Every access line says how it was priced — the builder's "Access in this price".
        access: { kind: a.equipment || null, source: a.priceSource || null, why: a.why || null },
      }),
    }));

  const groups = priced.groups.map((g, i) => ({
    categoryKey: g.categoryKey,
    takeoff: g.takeoff,
    extraLines: i === 0 ? extraLines : [],
  }));
  // Access priced but no painting group to hang it on still needs a home.
  if (!groups.length && extraLines.length) groups.push({ categoryKey: "interior_painting", takeoff: null, extraLines });

  // ── The trades, priced at the company's own rates ─────────────────────────
  const skipped = [...priced.skipped];
  const scopeKeys = (read.scope?.categories || []).map((c) => c.key);
  const useSuggestions = read.model?.pricing?.useSuggestions || {};
  for (const pt of pricing?.trades || []) {
    const trade = (computed.trades || []).find((t) => t.tradeKey === pt.tradeKey);
    const categoryKey = categoryForTrade(pt.tradeKey, { scopeKeys, enabledKeys: ctx.enabledKeys });
    const lines = [];
    for (const b of pt.blocks) {
      if (b.rung === "engine" || b.rung === "service") {
        for (const l of b.lines) {
          // Plain lines on the draft: the drywall finish-line marker would
          // let the builder's own level sync (which reads the group's intake,
          // empty here) rewrite or drop them before the estimator saw them.
          const { drywallFinish, ...meta } = l.meta || {};
          void drywallFinish;
          lines.push({ ...l, meta: office({ ...meta, rung: b.rung, rungSource: b.source }) });
        }
      } else if (b.rung === "suggestion" && useSuggestions[pt.tradeKey] === true) {
        const item = trade?.items.find((i) => (b.itemIds || []).includes(i.id));
        const sell = b.sell ?? pricing.recommendation.suggestionSell.find((s) => s.id === b.id)?.sell ?? null;
        if (!item || sell === null) continue;
        const qty = item.quantity.value;
        lines.push({
          description: item.label,
          detail: "FieldQuo suggestion — not your price yet. Set your own rate in Settings → Services.",
          quantity: qty,
          unit: item.quantity.unitLabel || item.quantity.unit,
          rate: qty > 0 ? round2(sell / qty) : sell,
          amount: sell,
          meta: office({ rung: "suggestion", aiSuggested: { source: b.source, coefficients: b.coefficients } }),
        });
      }
    }
    if (!lines.length) continue;
    if (!categoryKey) {
      skipped.push({ tradeKey: pt.tradeKey, label: pt.label, reason: "no_category" });
      continue;
    }
    groups.push({ categoryKey, takeoff: null, extraLines: lines });
  }

  // ── The margin adjustment a person added on the read ─────────────────────
  // The read's margin adjustment is for the WHOLE read; one part's quote
  // does not carry it (its gap is shown on that part's card instead).
  const adj = slice ? null : read.model?.pricing?.marginAdjustment;
  if (adj && adj.amount > 0 && groups.length) {
    groups[groups.length - 1].extraLines.push({
      description: "Margin adjustment",
      quantity: 1,
      unit: "flat",
      rate: round2(adj.amount),
      amount: round2(adj.amount),
      meta: office({ marginAdjustment: { targetPct: adj.targetPct, at: adj.at } }),
    });
  }

  const open = [
    ...computed.questions.filter((q) => !q.resolved).map((q) => `• ${q.text}`),
    ...(computed.trades || []).flatMap((t) => (t.questions || []).filter((q) => !q.resolved).map((q) => `• ${t.label}: ${q.text}`)),
  ];
  const where = (a) => `${a.label}${a.areaName ? ` — ${a.areaName}` : ""}`;
  const unpriced = [
    ...priced.access.filter((a) => a.price === null).map((a) => `• ${where(a)}${a.heightFt ? ` (${a.heightFt} ft)` : ""}: no price yet — add a line`),
    ...priced.access.filter((a) => a.price === 0).map((a) => `• ${where(a)}: your own — no charge, no line`),
    ...priced.access.filter((a) => a.price > 0 && a.priceSource === "ai").map((a) => `• ${where(a)}: price entered by FieldQuo AI from the conversation — verify it`),
    ...priced.access.filter((a) => a.price > 0 && (a.priceSource === "reference" || a.priceSource === "company")).map((a) => `• ${where(a)}: ${a.priceSource === "company" ? "priced from your rental rates" : "estimated from the reference rental table"} — confirm it. ${a.why || ""}`.trim()),
  ];
  // What the read priced on, the crew plan behind the days, and the height
  // factors — every figure's reason, in the office notes.
  const assumed = ASSUMED_KEYS.filter((k) => read.model?.assumed?.[k]).map((k) => `• ${ASSUMED[k].label}: ${String(read.model.assumed[k].value).replace(/_/g, " ")}${read.model.assumed[k].basis ? ` (${read.model.assumed[k].basis})` : ""}`);
  const plan = priced.plan
    ? `${priced.plan.hours} h on site: ${priced.plan.days} days for ${priced.plan.crew.size} painters at ${priced.plan.crew.hoursPerDay} productive h a day (${priced.plan.crew.sizeWhy})${priced.plan.setupHours ? `, incl. ${priced.plan.setupHours} h daily setup and clean-up` : ""}.`
    : null;
  const heights = (priced.lines || []).filter((l) => l.height && l.height.factor > 1).map((l) => `• ${l.area} — ${l.label}: ×${l.height.factor} on the hours (${l.height.why})`);
  // "Check before sending" — what was ticked (who, when) and what was not —
  // carried into the office notes; the builder warns on the unreviewed count.
  let review = null;
  try {
    review = buildReview({ computed, priced, pricing, model: read.model, firstPass: out.firstPass, ownRates: out.own, compare: slice?.compare || null, currency: out.fctx?.currency || null });
  } catch (err) {
    console.error("[planRead] draft review:", err?.message);
  }
  const reviewLines = review
    ? [
        `• ${review.accessSentence}`,
        ...review.checks.map((c) => `• ${c.tick ? (c.tick.verdict === "ok" ? "✓ Checked" : "✎ To change") : "☐ Not reviewed"}: ${c.text}${c.tick?.at ? ` (${String(c.tick.at).slice(0, 10)})` : ""}`),
      ]
    : [];
  const materialsLine = priced.materials?.items?.length ? `Material list: ${priced.materials.items.map((i) => `${i.qty} ${i.unit} ${i.label}${i.priceSource === "default" ? " (default price)" : ""}`).join("; ")}.` : null;
  // Extra prep hours ride on the takeoff's lines (row.prepHours); the notes
  // say which the chat set, so the estimator checks them.
  const prep = (computed.surfaces || [])
    .filter((s) => s.active && s.prepHours > 0)
    .map((s) => `• ${s.label}: +${s.prepHours} h prep${s.prepNote ? ` — ${s.prepNote}` : ""}${s.prepSource === "ai" ? " (set by FieldQuo AI from the conversation — verify)" : ""}`);
  const noRate =(pricing?.trades || []).flatMap((t) => t.unpriced.map((u) => `• ${t.label}: ${u.label} (${u.quantity} ${u.unit}) — no rate; add one`));
  const suggestedOff = (pricing?.trades || []).filter((t) => t.blocks.some((b) => b.rung === "suggestion") && useSuggestions[t.tradeKey] !== true).map((t) => `• ${t.label}: FieldQuo's suggested lines were left off — add your own or use them on the read`);
  const tradeNotes = (computed.trades || []).flatMap((t) => [
    ...(t.assumptions || []).map((a) => `• ${t.label}: ${a}`),
    ...(t.exclusions || []).map((a) => `• ${t.label} excludes: ${a}`),
  ]);
  const scope = tradesFromScope(read.scope);
  const reviewNotes = [
    `Drafted by FieldQuo AI from the drawing read "${read.title}"${slice ? ` — ${slice.label} only` : scope.stated ? ` for ${scope.trades.map((t) => t.tradeKey).join(", ")}` : ""}. Check every quantity marked estimated or low confidence.`,
    computed.summary ? `\n${computed.summary}` : "",
    computed.assumptions.length ? `\nAssumptions:\n${computed.assumptions.map((a) => `• ${a}`).join("\n")}` : "",
    computed.exclusions.length ? `\nExclusions:\n${computed.exclusions.map((a) => `• ${a}`).join("\n")}` : "",
    tradeNotes.length ? `\nTrades:\n${tradeNotes.join("\n")}` : "",
    open.length ? `\nOpen questions:\n${open.join("\n")}` : "",
    unpriced.length ? `\nAccess equipment:\n${unpriced.join("\n")}` : "",
    prep.length ? `\nExtra prep hours:\n${prep.join("\n")}` : "",
    assumed.length ? `\nPriced on:\n${assumed.join("\n")}` : "",
    plan ? `\nCrew plan: ${plan}` : "",
    heights.length ? `\nHeight:\n${heights.join("\n")}` : "",
    materialsLine ? `\n${materialsLine}` : "",
    reviewLines.length ? `\nCheck before sending:\n${reviewLines.join("\n")}` : "",
    noRate.length ? `\nNo rate yet:\n${noRate.join("\n")}` : "",
    suggestedOff.length ? `\nNot on this draft:\n${suggestedOff.join("\n")}` : "",
    adj && adj.amount > 0 ? `\nA margin adjustment line was added on the read to hold your ${adj.targetPct}% target.` : "",
  ]
    .join("")
    .slice(0, 8000);

  return NextResponse.json({
    draft: {
      planReadId: read.id,
      clientId: read.clientId || null,
      groups,
      reviewNotes,
      skipped,
      // Items of "Check before sending" nobody ticked — the builder warns.
      unreviewed: review ? review.unreviewed : 0,
    },
  });
}
