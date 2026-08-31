// app/unsubscribe/[token]/page.js
//
// Reached from a link in a commercial email — no login, no account. See
// lib/marketing/unsubscribe.js for the token shape and
// app/api/unsubscribe/[token]/route.js for why GET reads and POST mutates.
export const dynamic = "force-dynamic";

import UnsubscribeForm from "./UnsubscribeForm";

export const metadata = {
  title: "Unsubscribe",
  // An unsubscribe token in a search index would let anyone unsubscribe
  // anyone else who guessed a real page URL — same reasoning as the client
  // portal's robots block.
  robots: { index: false, follow: false },
};

export default async function UnsubscribePage({ params }) {
  const { token } = await params;
  return <UnsubscribeForm token={token} />;
}
