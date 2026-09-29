// app/q/[token]/add/page.js
//
// "Add this price to your own quote" — where the secondary line in a quote
// email to a BUSINESS client lands (lib/email/quoteEmail.js,
// lib/quotes/addToQuoteLink.js). Owner-approved 2026-09-29.
//
// The reader is a contractor who received a subcontractor's quote: it says,
// in plain words, what happens if they carry this price into their own quote
// with FieldQuo, then lets them do it — signed in, straight away; signed out,
// through a free account or a login that brings them back here.
//
// ══ What this page may show ════════════════════════════════════════════════
//
// Exactly what /q/<token> already shows the same token holder, and no more:
// the sending company's name and the quote's price. Same gate, too — a draft
// is the ordinary not-found (isPubliclyReadable), so an early-copied link
// reveals nothing here that the document page would refuse. Everything
// about the READER's own company (their open quotes, their markup) comes
// from /api/quotes/received/[token], which answers only for a signed-in
// member and only about their own tenant.
//
// This is one of the few pages that shows FieldQuo's own face on a
// client-facing path, deliberately: the reader asked to use FieldQuo. The
// quote document itself, one link away, stays the sender's.

export const dynamic = "force-dynamic";

import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { isPubliclyReadable } from "@/lib/quotes/shareToken";
import { sourceCostAmount } from "@/lib/quotes/importQuote";
import AddToQuoteFlow from "./AddToQuoteFlow";

export const metadata = {
  title: "Add this price to your quote",
  // Same reason as /q/<token>: a share token in a search index defeats it.
  robots: { index: false, follow: false },
};

export default async function AddToQuotePage({ params }) {
  // Next 16: params is a Promise.
  const { token } = await params;
  const quote = token
    ? await db.quote.findFirst({
        where: { shareToken: token },
        select: {
          status: true,
          language: true,
          total: true,
          acceptedTotal: true,
          company: { select: { name: true, currency: true } },
        },
      })
    : null;
  if (!quote || !isPubliclyReadable(quote.status)) notFound();

  return (
    <AddToQuoteFlow
      token={token}
      language={quote.language || "en"}
      senderName={quote.company?.name || null}
      amount={sourceCostAmount(quote)}
      currency={quote.company?.currency || null}
    />
  );
}
