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
// Whole-read only: applying one trade, or onto an existing quote, is the
// plan's P4.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { memberOrRefusal } from "@/lib/apiMember";
import { levelOrRefusal } from "@/lib/permissions/apiGate";
import { loadPlanRead } from "@/lib/planRead/load";
import { priceReadNow } from "@/lib/planRead/priceRead";
import { categoryForTrade } from "@/lib/planRead/tradePricing";
import { tradesFromScope } from "@/lib/planRead/tradeCatalogue";

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
  const { computed, pricedPaint: priced, pricing, ctx } = out;
  const office = (extra) => ({ aiDrafted: true, source: "plan_read", planReadId: read.id, ...extra });

  const extraLines = priced.access
    .filter((a) => a.price !== null)
    .map((a) => ({
      description: `${a.label}${a.areaName ? ` — ${a.areaName}` : ""}`,
      quantity: 1,
      unit: "flat",
      rate: a.price,
      amount: a.price,
      // Office-only provenance; never rendered to the client.
      meta: office({}),
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
  const adj = read.model?.pricing?.marginAdjustment;
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
  const unpriced = priced.access.filter((a) => a.price === null).map((a) => `• ${a.label}${a.areaName ? ` — ${a.areaName}` : ""}${a.heightFt ? ` (${a.heightFt} ft)` : ""}: no price yet — add a line`);
  const noRate = (pricing?.trades || []).flatMap((t) => t.unpriced.map((u) => `• ${t.label}: ${u.label} (${u.quantity} ${u.unit}) — no rate; add one`));
  const suggestedOff = (pricing?.trades || []).filter((t) => t.blocks.some((b) => b.rung === "suggestion") && useSuggestions[t.tradeKey] !== true).map((t) => `• ${t.label}: FieldQuo's suggested lines were left off — add your own or use them on the read`);
  const tradeNotes = (computed.trades || []).flatMap((t) => [
    ...(t.assumptions || []).map((a) => `• ${t.label}: ${a}`),
    ...(t.exclusions || []).map((a) => `• ${t.label} excludes: ${a}`),
  ]);
  const scope = tradesFromScope(read.scope);
  const reviewNotes = [
    `Drafted by FieldQuo AI from the drawing read "${read.title}"${scope.stated ? ` for ${scope.trades.map((t) => t.tradeKey).join(", ")}` : ""}. Check every quantity marked estimated or low confidence.`,
    computed.summary ? `\n${computed.summary}` : "",
    computed.assumptions.length ? `\nAssumptions:\n${computed.assumptions.map((a) => `• ${a}`).join("\n")}` : "",
    computed.exclusions.length ? `\nExclusions:\n${computed.exclusions.map((a) => `• ${a}`).join("\n")}` : "",
    tradeNotes.length ? `\nTrades:\n${tradeNotes.join("\n")}` : "",
    open.length ? `\nOpen questions:\n${open.join("\n")}` : "",
    unpriced.length ? `\nAccess equipment:\n${unpriced.join("\n")}` : "",
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
    },
  });
}
