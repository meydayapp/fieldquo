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

import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { isPubliclyReadable } from "@/lib/quotes/shareToken";
import { canPreviewCompanyDocument } from "@/lib/quotes/previewAccess";
import QuoteApproval from "./QuoteApproval";
import ContractorImportPanel from "./ContractorImportPanel";
import PreviewBanner from "./PreviewBanner";

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
  //
  // Status and companyId as well as the id, because the gate below is a STATUS
  // test. Every saved quote now carries a share token (lib/quotes/shareToken.js
  // — minted at save so the office can preview and copy the link before
  // sending), so "this token resolves" no longer means "this document is ready
  // to be read by the person holding it".
  const found = token
    ? await db.quote.findFirst({
        where: { shareToken: token },
        select: { id: true, status: true, companyId: true },
      })
    : null;
  if (!found) notFound();

  // ── A draft is not-found to the world, a preview to its own office ───────
  //
  // Same 404 as an unknown token: a stranger who gets hold of a draft link
  // learns nothing from the response about whether it names a real quote.
  //
  // The exception is the company that wrote it. A signed-in member sees the
  // page exactly as the client will, with a strip above it saying the link
  // is not live yet — which is the request this whole change came from
  // ("preview as a client is only available after it has been sent", and it
  // should be before, "so that we can spot anything"). The preview writes
  // nothing: no view is recorded, no timestamp is stamped on the quote and
  // no email goes anywhere, and the API behind it makes the same promise.
  const preview = isPubliclyReadable(found.status)
    ? false
    : await canPreviewCompanyDocument({ headers: await headers() }, found.companyId);
  if (!isPubliclyReadable(found.status) && !preview) notFound();

  return (
    <>
      {preview && <PreviewBanner />}
      <QuoteApproval token={token} />
      {/* Below the white-label document, and self-hiding for homeowners — see
          ContractorImportPanel. The GC ↔ subcontractor import lives here. */}
      <div className="px-4 pb-10">
        <ContractorImportPanel token={token} />
      </div>
    </>
  );
}
