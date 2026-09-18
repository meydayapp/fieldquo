// app/i/[token]/page.js
//
// The page behind the intro email's links — reached from an email, no
// login, usually on a phone. See app/api/intro-link/[token]/route.js for
// why the GET shows a button and the POST does the thing.
//
// A DEMO token is forwarded to the rep's own booking page (app/demo/
// [repCode]) with the token in ?t=, so a prospect holding an email sent
// before that page existed picks a slot like everyone else. Opening the
// token here is pure (no DB) and the forward writes nothing, so a mail
// scanner following it books nothing. A token that does not open falls
// through to the form, which says the link is not valid.
export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { openIntroLink } from "@/lib/sales/outreach/introLink";
import { repDemoUrl } from "@/lib/sales/demoBooking/url";
import IntroLinkForm from "./IntroLinkForm";

export const metadata = {
  title: "FieldQuo",
  // A token in a search index would let anybody who found a real URL file a
  // request in somebody else's name.
  robots: { index: false, follow: false },
};

export default async function IntroLinkPage({ params }) {
  // Next 16: params is a Promise.
  const { token } = await params;
  const opened = openIntroLink(token);
  if (opened.ok && opened.kind === "demo") {
    const rep = await db.salesRep.findUnique({ where: { id: opened.salesRepId }, select: { code: true } }).catch(() => null);
    if (rep?.code) redirect(repDemoUrl("", rep.code, { token }));
  }
  return <IntroLinkForm token={token} />;
}
