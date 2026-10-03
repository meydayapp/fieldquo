// app/w/[token]/page.js
//
// A waiver sent on its own — off a job or an invoice — for the client to
// read and sign. Outside the app shell, no session, nothing that names
// FieldQuo: it reads as a document from the company they hired, the same
// way /q/[token] does. A quote-attached waiver is signed inside the quote's
// own page instead; this route still answers for it, so the emailed link
// works either way.

export const dynamic = "force-dynamic";

import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import WaiverPage from "./WaiverPage";
import { clientPageMetadata, neutralClientMetadata } from "@/lib/whiteLabel/pageMetadata";
import { waiverCompany } from "@/lib/whiteLabel/metadataLoaders";

const ROBOTS = { index: false, follow: false };

// The company's name and logo in the tab and the link preview
// (lib/whiteLabel/pageMetadata.js) — not the document's title, which is the
// company's own wording and may name the client or the job.
export async function generateMetadata({ params }) {
  const { token } = await params;
  const company = await waiverCompany(token);
  return company
    ? clientPageMetadata(company, { robots: ROBOTS })
    : neutralClientMetadata({ title: "Document to sign", robots: ROBOTS });
}

export default async function PublicWaiverPage({ params }) {
  const { token } = await params;
  // One indexed lookup of the id, so an unknown link is a 404 and not a 200
  // over a friendly error — see app/q/[token]/page.js for why the status
  // code matters.
  const exists = token ? await db.documentSignature.findUnique({ where: { token }, select: { id: true } }) : null;
  if (!exists) notFound();
  return <WaiverPage token={token} />;
}
