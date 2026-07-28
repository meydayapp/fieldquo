// app/portal/[token]/page.js
//
// The client portal. Everything a homeowner has with one company: their
// quotes, their invoices, the balance owing, and a way to pay it.
//
// Four API routes already spoke this language (portal/[token], .../pay,
// .../refer, .../request) but this page was a zero-byte file and nothing ever
// minted a Client.portalToken, so none of them were reachable. See
// lib/clientPortal.js for the other half.

export const dynamic = "force-dynamic";

import ClientPortal from "./ClientPortal";

export const metadata = {
  title: "Your account",
  // A portal token in a search index would defeat the point of the token.
  robots: { index: false, follow: false },
};

export default async function PortalPage({ params }) {
  const { token } = await params;
  return <ClientPortal token={token} />;
}
