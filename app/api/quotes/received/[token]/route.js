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
import { loadEnforceableMember, hasLevel, hasToggle } from "@/lib/permissions/enforce";
import { sourceCostAmount } from "@/lib/quotes/importQuote";
import { isPubliclyReadable } from "@/lib/quotes/shareToken";
import { gcSignupPrefill, quotePageClientFacts } from "@/lib/quotes/gcSignup";

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
      // Exactly the fields quotePageClientFacts may put on /q/<token> — the
      // signup prefill below is built from that object and nothing else, so
      // this endpoint (callable by anyone holding the share token) can tell
      // the token holder no more than the quote page itself does.
      client: { select: { name: true, type: true, contactName: true, email: true, phone: true, address: true } },
    },
  });
  // ── A draft is nobody's to import ─────────────────────────────────────────
  //
  // Every saved quote carries a token now (lib/quotes/shareToken.js), so a
  // token resolving says nothing about whether the quote was ever SENT. This
  // endpoint answered for drafts anyway — the sub's still-being-worked-out
  // price, to whoever held a link copied early. Same rule and same 404 as the
  // page itself (app/q/[token]/page.js): the amount goes only to a token
  // holder who could already read it there.
  if (!source || !isPubliclyReadable(source.status))
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
  // "Start a new quote" makes a CLIENT as well as a quote — offered only to
  // someone the POST will let do both (app/api/clients asks the same level).
  const canStartNew = canImport && hasLevel(full, "clientsProperties", "full_edit");

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

  // ── Approved quotes: the sub's price arrives after the client said yes ──
  //
  // The owner's real case (2026-10-05): the sub's quote lands AFTER the GC's
  // client signed. Those quotes were missing from the list above, so there
  // was nowhere to put the price. An approved quote WITH a job is a target
  // now — the import does not touch the signed quote, it raises a pending
  // change order to the client (lib/quotes/importQuote.js). Offered only to
  // someone the import route will let raise one: the change-order gates
  // (jobs: view_create_edit + showPricing), the same pair POST
  // /api/jobs/[id]/change-orders asks.
  let approvedQuotes = [];
  const canRaiseChange =
    canImport && hasLevel(full, "jobs", "view_create_edit") && hasToggle(full, "showPricing");
  if (canRaiseChange) {
    const quotes = await db.quote.findMany({
      where: { companyId: member.companyId, status: "accepted", jobs: { some: {} } },
      orderBy: { acceptedAt: "desc" },
      take: 40,
      select: {
        id: true,
        quoteNumber: true,
        client: { select: { name: true } },
      },
    });
    approvedQuotes = quotes.map((q) => ({
      id: q.id,
      quoteNumber: q.quoteNumber,
      clientName: q.client?.name || null,
    }));
  }

  // ── The signup prefill, for a signed-out reader ─────────────────────────
  //
  // "Create your free account" from this quote opens with what the quote page
  // shows about its client (lib/quotes/gcSignup.js): for a business client the
  // name, contact, email, phone and office address; for a homeowner the name.
  // `accountExists`: whether that email already has a login, so /signup says
  // "Log in" instead of making a second account — the same answer /signup
  // gives the moment that email is submitted.
  let signupPrefill = null;
  if (!authenticated) {
    signupPrefill = gcSignupPrefill(quotePageClientFacts(source.client));
    if (signupPrefill.email) {
      const login = await db.user
        .findFirst({ where: { email: { equals: signupPrefill.email, mode: "insensitive" } }, select: { id: true } })
        .catch(() => null);
      signupPrefill.accountExists = Boolean(login);
    }
  }

  return NextResponse.json({
    sourceCompanyName: source.company?.name || null,
    signupPrefill,
    sourceQuoteNumber: source.quoteNumber,
    amount: sourceCostAmount(source), // the sub's price = the GC's cost
    currency: source.company?.currency || null,
    authenticated,
    isOwnQuote,
    canImport,
    canStartNew,
    openQuotes,
    approvedQuotes,
  });
}
