// app/api/quotes/[id]/document/route.js
//
// Everything a quote SAYS, for the staff who wrote it.
//
// ── Why this exists ─────────────────────────────────────────────────────────
//
// The client-facing route (/api/public/quotes/[token]) resolves per-trade
// content for the document a homeowner reads: what's included, what could
// change the price, the process with its timelines, the glossary, the payment
// schedule. The STAFF route returned none of it — so the person who wrote the
// quote saw a bare list of line items and the client saw a document.
//
// That is backwards. The estimator is the one who has to defend every sentence
// on it, and they could not see the sentences.
//
// A separate endpoint rather than widening GET /api/quotes/[id]: that response
// is already spread into the PDF route and the editor, and the prose here is
// several kilobytes that neither needs. Same reasoning the public route gives
// for resolving server-side in the first place.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { memberOrRefusal } from "@/lib/apiMember";
import { attachServiceSettings } from "@/lib/documents/loadServiceSettings";
import {
  resolveServiceContent,
  dominantProcessSteps,
  dominantGlossary,
} from "@/lib/documents/serviceContent";
import { parsePaymentSchedule } from "@/lib/documents/paymentSchedule";
import {
  loadEnforceableMember,
  requireMoney,
  permissionErrorResponse,
} from "@/lib/permissions/enforce";

const num = (v) => Number(v ?? 0);

export async function GET(request, { params }) {
  const { id } = await params;
  const { member, response } = await memberOrRefusal(request);
  if (response) return response;

  // The on-screen document mirror — the same priced payload the PDF renders,
  // as JSON. Gated identically: hiding the download and serving its contents
  // through the sibling endpoint would be the side door this sweep exists to
  // close.
  try {
    const full = await loadEnforceableMember(db, member.id);
    requireMoney(full, "see priced documents");
  } catch (err) {
    const { body, status } = permissionErrorResponse(err);
    return NextResponse.json(body, { status });
  }

  const quote = await db.quote.findFirst({
    where: { id, companyId: member.companyId },
    select: {
      id: true,
      processNotes: true,
      scopeGroups: {
        orderBy: { sortOrder: "asc" },
        select: {
          id: true,
          categoryId: true,
          subtotal: true,
          label: true,
          // Read only to pick the scope paragraph for what was actually sold.
          // Not returned: on some trades it holds supplier cost and markup, and
          // this response is rendered on a page an estimator without costing
          // permission can open.
          takeoff: true,
          category: { select: { key: true, label: true } },
        },
      },
      company: { select: { paymentTerms: true, defaultProcessNotes: true } },
    },
  });
  if (!quote) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // The company's own wording where they have customised it — the same join
  // the client-facing route makes, so the two documents cannot drift.
  quote.scopeGroups = await attachServiceSettings(
    db,
    member.companyId,
    quote.scopeGroups,
  );

  const groups = quote.scopeGroups.map((g) => {
    const content = resolveServiceContent(
      g.category?.key,
      g.companySettings || null,
      g.takeoff,
    );
    return {
      id: g.id,
      categoryKey: g.category?.key || null,
      label: g.label || g.category?.label || "Scope",
      subtotal: num(g.subtotal),
      accent: content.accent,
      // The scope paragraph the client's copy prints above the prices, resolved
      // against this group's takeoff so staff see the variant that was actually
      // sold rather than the trade's generic one. "" when the trade declares
      // none — render nothing, not a heading over a blank.
      description: content.description,
      included: content.included,
      // Empty for every trade that declares none, so the page renders nothing
      // rather than a heading over a blank panel.
      mayChange: content.mayChange,
    };
  });

  const forDominant = quote.scopeGroups.map((g) => ({
    categoryKey: g.category?.key || null,
    override: g.companySettings || null,
    subtotal: num(g.subtotal),
  }));

  return NextResponse.json({
    groups,
    // Shown once, from the largest group by value — see dominantProcessSteps.
    processSteps: dominantProcessSteps(forDominant),
    glossary: dominantGlossary(forDominant),
    // The quote's own words if it has them, else the company's default. This
    // is what actually prints, so the staff page must resolve it the same way
    // rather than showing the template and letting somebody assume.
    processNotes:
      quote.processNotes || quote.company?.defaultProcessNotes || null,
    processNotesSource: quote.processNotes
      ? "quote"
      : quote.company?.defaultProcessNotes
        ? "company"
        : null,
    paymentTerms: quote.company?.paymentTerms || null,
    paymentSchedule: parsePaymentSchedule(quote.company?.paymentTerms),
  });
}
