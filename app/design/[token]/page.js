// app/design/[token]/page.js
//
// The client-facing kitchen designer. Public — the share token is the
// credential, same as /q/[token] and /portal/[token].
//
// A thin shell: the designer is heavily interactive, so the body has to be a
// client component, and everything it needs comes from the token-gated API
// rather than from a session that doesn't exist here.
import DesignClient from "./DesignClient";
import { clientPageMetadata, neutralClientMetadata } from "@/lib/whiteLabel/pageMetadata";
import { quoteCompanyByShareToken } from "@/lib/whiteLabel/metadataLoaders";

// A drawing of one homeowner's kitchen has no business in a search index, and a
// share token in a crawler's log is a share token in someone else's hands.
const ROBOTS = { index: false, follow: false };

// The company's name and logo in the tab and the link preview
// (lib/whiteLabel/pageMetadata.js) — what app/api/kitchen-design/[token]
// already tells the same token holder, and nothing more.
export async function generateMetadata({ params }) {
  const { token } = await params;
  const company = await quoteCompanyByShareToken(token);
  return company
    ? clientPageMetadata(company, { robots: ROBOTS })
    : neutralClientMetadata({ title: "Your kitchen", robots: ROBOTS });
}

export default function Page() {
  return <DesignClient />;
}
