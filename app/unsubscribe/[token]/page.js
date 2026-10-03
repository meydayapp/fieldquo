// app/unsubscribe/[token]/page.js
//
// Reached from a link in a commercial email — no login, no account. See
// lib/marketing/unsubscribe.js for the token shape and
// app/api/unsubscribe/[token]/route.js for why GET reads and POST mutates.
export const dynamic = "force-dynamic";

import UnsubscribeForm from "./UnsubscribeForm";
import { clientPageMetadata, neutralClientMetadata } from "@/lib/whiteLabel/pageMetadata";
import { unsubscribeCompany } from "@/lib/whiteLabel/metadataLoaders";

// An unsubscribe token in a search index would let anyone unsubscribe
// anyone else who guessed a real page URL — same reasoning as the client
// portal's robots block.
const ROBOTS = { index: false, follow: false };

// Every token here belongs to one company's marketing list (a campaign, a
// review request — lib/marketing/unsubscribe.js), so the tab and icon are
// that company's, not ours (lib/whiteLabel/pageMetadata.js).
export async function generateMetadata({ params }) {
  const { token } = await params;
  const company = await unsubscribeCompany(token);
  return company
    ? clientPageMetadata(company, { robots: ROBOTS })
    : neutralClientMetadata({ title: "Unsubscribe", robots: ROBOTS });
}

export default async function UnsubscribePage({ params }) {
  const { token } = await params;
  return <UnsubscribeForm token={token} />;
}
