// app/i/[token]/page.js
//
// The page behind the intro email's links — reached from an email, no
// login, usually on a phone. See app/api/intro-link/[token]/route.js for
// why the GET shows a button and the POST does the thing.
export const dynamic = "force-dynamic";

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
  return <IntroLinkForm token={token} />;
}
