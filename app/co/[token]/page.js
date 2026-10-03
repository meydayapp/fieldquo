// app/co/[token]/page.js
//
// The one-page change-order addendum a homeowner opens from the text or the
// email: the original line, what changed, the delta, the new total, the
// schedule impact, and "Approve & sign". Outside the app shell for the same
// reason /q/[token] is — it must read as a document from the company they
// hired, not as a SaaS page.

export const dynamic = "force-dynamic";

import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import ChangeOrderApproval from "./ChangeOrderApproval";
import { clientPageMetadata, neutralClientMetadata } from "@/lib/whiteLabel/pageMetadata";
import { changeOrderCompany } from "@/lib/whiteLabel/metadataLoaders";

// A share token in a search index would defeat the point of the token.
const ROBOTS = { index: false, follow: false };

// The company's name and logo in the tab and the link preview
// (lib/whiteLabel/pageMetadata.js). The name alone: the addendum is written
// in its quote's language, and there is no translated "Change order" label
// to put beside it — an English word on a French addendum's tab would be
// the one line of the document in the wrong language.
export async function generateMetadata({ params }) {
  const { token } = await params;
  const company = await changeOrderCompany(token);
  return company
    ? clientPageMetadata(company, { robots: ROBOTS })
    : neutralClientMetadata({ title: "Change order", robots: ROBOTS });
}

export default async function PublicChangeOrderPage({ params }) {
  // Next 16: params is a Promise.
  const { token } = await params;

  // An unknown link is a 404, not a 200 with a friendly message — the same
  // reasoning app/q/[token]/page.js gives at length. One indexed lookup.
  const exists = token
    ? await db.changeOrder.findFirst({ where: { shareToken: token }, select: { id: true } })
    : null;
  if (!exists) notFound();

  return <ChangeOrderApproval token={token} />;
}
