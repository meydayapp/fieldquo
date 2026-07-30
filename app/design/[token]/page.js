// app/design/[token]/page.js
//
// The client-facing kitchen designer. Public — the share token is the
// credential, same as /q/[token] and /portal/[token].
//
// A thin shell: the designer is heavily interactive, so the body has to be a
// client component, and everything it needs comes from the token-gated API
// rather than from a session that doesn't exist here.
import DesignClient from "./DesignClient";

// A drawing of one homeowner's kitchen has no business in a search index, and a
// share token in a crawler's log is a share token in someone else's hands.
export const metadata = {
  title: "Your kitchen",
  robots: { index: false, follow: false },
};

export default function Page() {
  return <DesignClient />;
}
