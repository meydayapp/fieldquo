// app/portal/login/[companySlug]/not-found.js
//
// An unknown or not-ready company slug on the standalone Client login page.
// Without this, notFound() there rendered the root 404 — FieldQuo's marketing
// header, nav and footer — on a link a contractor put in their own website's
// menu: the white-label leak app/embed/not-found.js exists to prevent. Terse
// and unbranded; there is no company to brand it with.
import { neutralClientMetadata } from "@/lib/whiteLabel/pageMetadata";

export const metadata = neutralClientMetadata({
  title: " ",
  robots: { index: false, follow: false },
});

export default function PortalLoginNotFound() {
  return (
    <main className="min-h-screen px-4 py-16 text-center text-sm text-neutral-600">
      This login page isn&apos;t available. Please check the link.
    </main>
  );
}
