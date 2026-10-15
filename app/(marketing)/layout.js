// app/(marketing)/layout.js
import MarketingHeader from "@/app/components/marketing/MarketingHeader";
import MarketingFooter from "@/app/components/marketing/MarketingFooter";
import JenniferPanel from "@/app/components/jennifer/JenniferPanel";
import { siteOrigin } from "@/lib/marketing/metadata";
import { organizationLd, ldJson } from "@/lib/seo/structuredData";

export default function MarketingLayout({ children }) {
  return (
    <div className="min-h-screen flex flex-col">
      {/* Organization JSON-LD on every marketing page, and ONLY here: the
          root layout also wraps the contractor's quote, portal and website,
          which must never describe themselves as FieldQuo. See
          lib/seo/structuredData.js for what it may claim (no sameAs until a
          real profile exists). */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: ldJson(organizationLd(siteOrigin())) }}
      />
      <MarketingHeader />
      <main className="flex-1">{children}</main>
      <MarketingFooter />
      <JenniferPanel variant="marketing" />
    </div>
  );
}
