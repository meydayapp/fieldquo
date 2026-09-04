// app/api/quotes/received/[token]/route.js
//
// Context for the contractor affordance on a received quote link (/q/[token]).
// Answers: is the viewer a FieldQuo contractor who could pull this quote into
// their own project, and if so, which of their quotes can it go on?
//
// This is NOT the client-facing quote payload — that stays at
// /api/public/quotes/[token]. This endpoint only exists to drive the "Add to my
// project" panel and is safe to call anonymously (it just returns canImport:
// false for a stranger).
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentMember } from "@/lib/currentMember";
import { loadEnforceableMember, hasLevel } from "@/lib/permissions/enforce";
import { sourceCostAmount } from "@/lib/quotes/importQuote";

export async function GET(request, { params }) {
  const { token } = await params;

  const source = await db.quote.findFirst({
    where: { shareToken: token },
    select: {
      id: true,
      quoteNumber: true,
      status: true,
      companyId: true,
      total: true,
      acceptedTotal: true,
      company: { select: { name: true, currency: true } },
      // No client relation. `sentToEmail`, `client.email` and `client.type` were
      // read only by the three dead fields removed below, and this endpoint is
      // callable by anyone holding the share token — narrowing what it loads is
      // the cheapest form of not leaking it.
    },
  });
  if (!source)
    return NextResponse.json({ error: "This link isn't valid." }, { status: 404 });

  // A logged-in viewer. Wrapped because getCurrentMember also runs the billing
  // gate; a lapsed or absent session just means "not importable", never an error
  // on what is otherwise a public page.
  const member = await getCurrentMember(request).catch(() => null);
  // Read-only impersonation (userId null) must not be offered a write action.
  const authenticated = Boolean(member && member.userId);
  const isOwnQuote = Boolean(member && member.companyId === source.companyId);
  // ── And the grid, which this route never asked ──────────────────────────
  //
  // `canImport` gates a WRITE onto one of the viewer's own quotes, and the
  // branch below hands back that company's open quotes and their totals to
  // whoever holds the share link. Asked at the same level as the import itself
  // so the panel is offered to exactly the people the POST will accept.
  const full = authenticated ? await loadEnforceableMember(db, member.id) : null;
  const canImport =
    authenticated && !isOwnQuote && hasLevel(full, "quotes", "view_create_edit");

  // ── Three fields used to be built here and read by nothing ───────────────
  //
  // `recipientKnown`, `clientIsCompany` and `viewerCompanyName` all existed to
  // drive the signed-out contractor pitch in ContractorImportPanel. That branch
  // sat behind an earlier `if (!ctx.canImport) return null`, so it had been
  // unreachable for as long as the guard existed; it is now deleted, and so are
  // these.
  //
  // recipientKnown is the one worth naming: it ran a `user.findFirst` on the
  // recipient's email for EVERY view of /q/<token>, homeowners included. A query
  // per page load, on the page a stranger opens on a phone in a driveway, for a
  // value that reached no rendered element.
  let openQuotes = [];
  if (canImport) {
    // The viewer's own open quotes — the projects an incoming cost can be
    // added to. Decided quotes are excluded: they're a record of what was
    // agreed, not somewhere to bolt a new line.
    const quotes = await db.quote.findMany({
      where: { companyId: member.companyId, status: { in: ["draft", "sent"] } },
      orderBy: { createdAt: "desc" },
      take: 40,
      select: {
        id: true,
        quoteNumber: true,
        total: true,
        client: { select: { name: true } },
      },
    });
    openQuotes = quotes.map((q) => ({
      id: q.id,
      quoteNumber: q.quoteNumber,
      total: Number(q.total),
      clientName: q.client?.name || null,
    }));
  }

  return NextResponse.json({
    sourceCompanyName: source.company?.name || null,
    sourceQuoteNumber: source.quoteNumber,
    amount: sourceCostAmount(source), // the sub's price = the GC's cost
    currency: source.company?.currency || null,
    authenticated,
    isOwnQuote,
    canImport,
    openQuotes,
  });
}
