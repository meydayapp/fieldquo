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

export const metadata = {
  title: "Change order",
  // A share token in a search index would defeat the point of the token.
  robots: { index: false, follow: false },
};

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
