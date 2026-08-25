// app/api/invoices/[id]/document/route.js
//
// Everything an invoice SAYS, for the staff who have to stand behind it.
//
// ── The mirror of /api/quotes/[id]/document ────────────────────────────────
//
// Same reasoning, same response shape, deliberately. AGENTS.md: invoices MIRROR
// quotes and are not a lesser version of them. The quote route exists because
// the estimator who wrote the quote could see a bare list of line items while
// the client read a document; the invoice was worse, because by the time it is
// raised the office is defending a price the client has already agreed to and
// the office could not see the sentences either.
//
// Field for field this returns what the quote route returns — groups with
// `included` and `mayChange`, `processSteps` with their timelines, `glossary`,
// `processNotes` with its provenance, `paymentTerms` and `paymentSchedule` —
// so the two pages can render from the same shape and cannot drift apart.
//
// ── Where an invoice's content comes from ──────────────────────────────────
//
// The MONEY is always the invoice's own: its line items are what was billed,
// and a quote edited after the fact must never change what an invoice says it
// charged for. The trade CONTENT comes from the originating quote's scope
// groups, because that is where the ServiceCategory lives — an Invoice has no
// category of its own, by design.
//
// An invoice raised by hand has no quote and therefore no categories. It gets
// one ungrouped list and no per-trade content, and the page says so. That is
// absence stated, not padded: inventing "what's included" for a $120 callout
// nobody ever quoted would be putting a promise in a contractor's mouth.
//
// A separate endpoint rather than widening GET /api/invoices/[id] for the same
// reason the quote route gives: that response is spread into the PDF route, the
// editor and the portal, and this prose is several kilobytes none of them want.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentMember } from "@/lib/currentMember";
import { attachServiceSettings } from "@/lib/documents/loadServiceSettings";
import {
  resolveServiceContent,
  dominantProcessSteps,
  dominantGlossary,
} from "@/lib/documents/serviceContent";
import { parsePaymentSchedule } from "@/lib/documents/paymentSchedule";
import { groupInvoiceLineItems } from "@/lib/invoices/documentGroups";

const num = (v) => Number(v ?? 0);

export async function GET(request, { params }) {
  const { id } = await params;
  const member = await getCurrentMember(request);
  if (!member)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const invoice = await db.invoice.findFirst({
    where: { id, companyId: member.companyId },
    select: {
      id: true,
      lineItems: true,
      quote: {
        select: {
          id: true,
          quoteNumber: true,
          // The quote's own "what happens next" if it has one. An invoice has
          // no processNotes column: the wording the client agreed to lives on
          // the document they approved, and re-asking the company default here
          // would print today's boilerplate over last month's agreement.
          processNotes: true,
          scopeGroups: {
            orderBy: { sortOrder: "asc" },
            select: {
              id: true,
              categoryId: true,
              label: true,
              sortOrder: true,
              subtotal: true,
              // Read only to pick the scope paragraph for the job that was
              // actually sold — a refacing group in thermofoil describes a
              // different job from one in painted MDF. Never returned: some
              // takeoffs carry supplier cost and markup.
              takeoff: true,
              category: { select: { key: true, label: true } },
            },
          },
        },
      },
      company: { select: { paymentTerms: true, defaultProcessNotes: true } },
    },
  });
  if (!invoice)
    return NextResponse.json({ error: "Not found" }, { status: 404 });

  // The company's own wording where they have customised it — the same join the
  // quote route and the client-facing route make, so the three cannot drift.
  const scopeGroups = await attachServiceSettings(
    db,
    member.companyId,
    invoice.quote?.scopeGroups || [],
  );

  // Content per category, looked up once. Several scope groups can share a
  // category on a big job, and resolving it per group would run the same
  // override lookup twice for one answer.
  const contentByGroupId = new Map(
    scopeGroups.map((g) => [
      g.id,
      resolveServiceContent(
        g.category?.key || null,
        g.companySettings || null,
        g.takeoff,
      ),
    ]),
  );

  const billed = groupInvoiceLineItems(
    invoice.lineItems,
    scopeGroups.map((g) => ({
      id: g.id,
      label: g.label || g.category?.label || null,
      categoryKey: g.category?.key || null,
      sortOrder: g.sortOrder,
    })),
  );

  const groups = billed.map((g) => {
    const content = g.matched ? contentByGroupId.get(g.key) : null;
    return {
      id: g.key,
      categoryKey: g.categoryKey,
      label: g.label,
      // What was BILLED, not what was quoted. These two can legitimately differ
      // — an invoice gets edited, extras get added — and showing the quote's
      // figure under the invoice's heading would be the page arguing with the
      // totals two inches below it.
      subtotal: g.subtotal,
      lineItems: g.lineItems,
      accent: content?.accent || null,
      // The same paragraph the quote printed above the prices. An invoice
      // mirrors the quote rather than summarising it — the client reading the
      // bill should find the scope they agreed to, in the words they agreed to
      // it in. "" for a trade that declares none.
      description: content?.description || "",
      included: content?.included || [],
      // Empty for every trade that declares none, so the page renders nothing
      // rather than a heading over a blank panel.
      mayChange: content?.mayChange || [],
    };
  });

  // Weighted by what each trade was QUOTED at, not by what this invoice billed.
  // The process steps describe the work that was agreed; if a deposit invoice
  // bills 50% of one trade and nothing of another, the dominant trade is still
  // whichever one the job is mostly about.
  const forDominant = scopeGroups.map((g) => ({
    categoryKey: g.category?.key || null,
    override: g.companySettings || null,
    subtotal: num(g.subtotal),
  }));

  return NextResponse.json({
    groups,
    // True when nothing could be placed against a trade — the page states it
    // rather than showing a document with silently missing halves.
    hasTradeContent: groups.some(
      (g) => g.description || g.included.length > 0 || g.mayChange.length > 0,
    ),
    quote: invoice.quote
      ? { id: invoice.quote.id, quoteNumber: invoice.quote.quoteNumber }
      : null,
    // Shown once, from the largest group by value — see dominantProcessSteps.
    // Skipped entirely with no quote behind the invoice: dominantProcessSteps([])
    // returns the GENERIC set, which is a reasonable default on a quote being
    // written and a fabrication on an invoice for work already done.
    processSteps: scopeGroups.length ? dominantProcessSteps(forDominant) : [],
    glossary: scopeGroups.length ? dominantGlossary(forDominant) : [],
    processNotes:
      invoice.quote?.processNotes ||
      invoice.company?.defaultProcessNotes ||
      null,
    processNotesSource: invoice.quote?.processNotes
      ? "quote"
      : invoice.company?.defaultProcessNotes
        ? "company"
        : null,
    paymentTerms: invoice.company?.paymentTerms || null,
    paymentSchedule: parsePaymentSchedule(invoice.company?.paymentTerms),
  });
}
