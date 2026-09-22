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

export const metadata = {
  title: "Document to sign",
  robots: { index: false, follow: false },
};

export default async function PublicWaiverPage({ params }) {
  const { token } = await params;
  // One indexed lookup of the id, so an unknown link is a 404 and not a 200
  // over a friendly error — see app/q/[token]/page.js for why the status
  // code matters.
  const exists = token ? await db.documentSignature.findUnique({ where: { token }, select: { id: true } }) : null;
  if (!exists) notFound();
  return <WaiverPage token={token} />;
}
