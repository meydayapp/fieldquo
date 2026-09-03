// app/no-contact/[token]/page.js
//
// Reached from the one link in the abandoned-signup recovery email — no login,
// no account, often on a phone. See app/api/no-contact/[token]/route.js for
// why GET reads and POST mutates, and lib/signup/abandoned.js for why this
// email needs an unsubscribe at all when a billing notice does not.
export const dynamic = "force-dynamic";

import NoContactForm from "./NoContactForm";

export const metadata = {
  title: "Stop hearing from FieldQuo",
  // Same reasoning as the marketing unsubscribe page: a token in a search
  // index would let anybody who guessed a real URL suppress somebody else.
  robots: { index: false, follow: false },
};

export default async function NoContactPage({ params }) {
  // Next 16: params is a Promise.
  const { token } = await params;
  return <NoContactForm token={token} />;
}
