// app/q/[token]/page.js
//
// What the client sees when they click the link in their email.
//
// This route was already being linked to — app/api/cron/follow-ups emails
// `/q/<shareToken>` — but the page didn't exist and the token was never
// minted, so every follow-up sent a 404. This is the other half.
//
// It sits outside the app shell on purpose: no nav, no FieldQuo branding
// competing with the contractor's, nothing that suggests the client has an
// account somewhere. It should read as a document from the company they hired.

export const dynamic = "force-dynamic";

import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import QuoteApproval from "./QuoteApproval";
import ContractorImportPanel from "./ContractorImportPanel";

export const metadata = {
  title: "Your quote",
  // Keep it out of search results. A share token in a Google index would
  // defeat the point of the token.
  robots: { index: false, follow: false },
};

export default async function PublicQuotePage({ params }) {
  const { token } = await params;

  // ── An unknown link is a 404, not a 200 ────────────────────────────────
  //
  // This page rendered with status 200 for any token at all; the client
  // component then fetched, failed, and drew a friendly "this link isn't
  // valid" message. The words were right and the status code was a lie.
  //
  // One indexed lookup of the id only — no quote body, no relations. That is
  // cheap enough for a page a homeowner opens on a phone in a driveway, which
  // is the audience this whole route is built for.
  //
  // notFound() renders ./not-found.js, which carries the same friendly wording
  // the client component had. Without that file this "fix" would trade a good
  // message for a correct status code, which is not a trade worth making.
  const exists = token
    ? await db.quote.findFirst({
        where: { shareToken: token },
        select: { id: true },
      })
    : null;
  if (!exists) notFound();

  return (
    <>
      <QuoteApproval token={token} />
      {/* Below the white-label document, and self-hiding for homeowners — see
          ContractorImportPanel. The GC ↔ subcontractor import lives here. */}
      <div className="px-4 pb-10">
        <ContractorImportPanel token={token} />
      </div>
    </>
  );
}
