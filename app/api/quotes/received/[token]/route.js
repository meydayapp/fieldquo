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
      sentToEmail: true,
      company: { select: { name: true, currency: true } },
      client: { select: { email: true, type: true } },
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
  const canImport = authenticated && !isOwnQuote;

  // Recognition hint for the signed-OUT call to action, and nothing more. Scoped
  // strictly to the address the sub already ADDRESSED this quote to — never a
  // caller-supplied email — so it can't be turned into an oracle for probing
  // whether arbitrary emails are registered. The caller already holds the secret
  // share token minted for this exact recipient.
  const recipientEmail = source.sentToEmail || source.client?.email || null;
  let recipientKnown = false;
  if (recipientEmail) {
    const hit = await db.user.findFirst({
      where: { email: recipientEmail },
      select: { id: true },
    });
    recipientKnown = Boolean(hit);
  }

  let viewerCompanyName = null;
  let openQuotes = [];
  if (canImport) {
    const [co, quotes] = await Promise.all([
      db.company.findUnique({
        where: { id: member.companyId },
        select: { name: true },
      }),
      // The viewer's own open quotes — the projects an incoming cost can be
      // added to. Decided quotes are excluded: they're a record of what was
      // agreed, not somewhere to bolt a new line.
      db.quote.findMany({
        where: { companyId: member.companyId, status: { in: ["draft", "sent"] } },
        orderBy: { createdAt: "desc" },
        take: 40,
        select: {
          id: true,
          quoteNumber: true,
          total: true,
          client: { select: { name: true } },
        },
      }),
    ]);
    viewerCompanyName = co?.name || null;
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
    recipientKnown,
    // The quote was addressed to a BUSINESS, not a homeowner. This is what lets
    // the signed-out contractor pitch appear for a GC while a homeowner's quote
    // stays fully white-label (no FieldQuo, no "are you a contractor"). We can't
    // tell an unregistered contractor from a homeowner by session alone; the
    // recipient's own client type is the honest signal.
    clientIsCompany: source.client?.type === "company",
    viewerCompanyName,
    openQuotes,
  });
}
