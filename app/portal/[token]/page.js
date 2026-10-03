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
import { clientPageMetadata, neutralClientMetadata } from "@/lib/whiteLabel/pageMetadata";
import { portalCompany } from "@/lib/whiteLabel/metadataLoaders";

// A portal token in a search index would defeat the point of the token.
const ROBOTS = { index: false, follow: false };

// The company's name in the tab and its logo as the icon — the portal is
// their client account, not ours (lib/whiteLabel/pageMetadata.js). The name
// alone, not "Your account · …": the page speaks the client's language and
// the tab has no translation to borrow.
export async function generateMetadata({ params }) {
  const { token } = await params;
  const found = await portalCompany(token);
  return found
    ? clientPageMetadata(found.company, { robots: ROBOTS })
    : neutralClientMetadata({ title: "Your account", robots: ROBOTS });
}

export default async function PortalPage({ params }) {
  const { token } = await params;
  return <ClientPortal token={token} />;
}
