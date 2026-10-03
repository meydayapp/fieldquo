// app/estimate-report/[token]/book/page.js
//
// "Book an in-person visit" from the report.
//
// ── Why the report has its own booking page ─────────────────────────────────
//
// /book/<slug> reads no query string: it mounts BookingFlow bare, and the
// prefill the flow accepts (`prefill`, `quoteId`) is a component prop the
// self-quote confirmation passes from memory. A homeowner arriving from an
// emailed report has no such memory, and putting their name, email, phone
// and address into a URL — in an email that gets forwarded and logged — is
// not the way to give it to them. So this page resolves the share token
// server-side, reads the draft's contact details, and mounts the SAME
// BookingFlow that /book/<slug> renders, prefilled, with the visit tied to
// the draft by quoteId. The confirm route re-checks that the quote belongs to
// the company and that the email matches before it links anything.
//
// Only reachable when the model gave the report a booking link, which
// canBookVisit() decides; a company with no calendar has no button to get
// here from, and a direct visit sees the flow's own "not bookable" card.

export const dynamic = "force-dynamic";

import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { documentTheme } from "@/lib/documents/theme";
import { isInstantEstimateQuote } from "@/lib/estimate/report/model";
import BookingFlow from "@/app/book/[companySlug]/BookingFlow";
import { clientPageMetadata, neutralClientMetadata } from "@/lib/whiteLabel/pageMetadata";

async function loadDraft(token) {
  if (!token || typeof token !== "string" || token.length > 128) return null;
  const quote = await db.quote.findFirst({
    where: { shareToken: token },
    select: {
      id: true,
      quoteType: true,
      estimateData: true,
      estimateSource: true,
      autoEstimated: true,
      createdVia: true,
      client: { select: { name: true, email: true, phone: true, address: true } },
      // logoUrl for the tab icon and the share image only — the company
      // object is never handed to the flow below.
      company: { select: { name: true, slug: true, bookingSlug: true, brandColor: true, logoUrl: true } },
    },
  });
  if (!quote || !isInstantEstimateQuote(quote)) return null;
  return quote;
}

// The company's name, icon and share image — never the client's name or the
// address this page pre-fills (lib/whiteLabel/pageMetadata.js).
export async function generateMetadata({ params }) {
  const { token } = await params;
  const draft = await loadDraft(token);
  const robots = { index: false, follow: false };
  return draft?.company
    ? clientPageMetadata(draft.company, { robots })
    : neutralClientMetadata({ title: " ", robots });
}

export default async function ReportBookingPage({ params }) {
  const { token } = await params;
  const draft = await loadDraft(token);
  if (!draft) notFound();

  const theme = documentTheme(draft.company);
  const address = draft.client?.address || draft.estimateData?.measurement?.formattedAddress || "";

  return (
    <div className="min-h-dvh" style={{ backgroundColor: theme.page }}>
      <BookingFlow
        companySlug={draft.company.bookingSlug || draft.company.slug}
        quoteId={draft.id}
        prefill={{
          name: draft.client?.name || "",
          email: draft.client?.email || "",
          phone: draft.client?.phone || "",
          address,
        }}
      />
    </div>
  );
}
