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
