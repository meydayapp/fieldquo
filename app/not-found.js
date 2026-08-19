// app/not-found.js
//
// The 404 for every unmatched URL, and for every notFound() that has no closer
// boundary. Before this file existed, both rendered Next's built-in page: an
// unstyled black screen, no logo, no navigation, no way back.
//
// The case that made it worth building is the referral link. /refer/<code>
// calls notFound() for an unknown code, and referral codes are read off a van,
// typed off a business card and — most often — truncated by a text message.
// A prospect who lost half the URL landed on a black screen with FieldQuo's
// name nowhere on it and no route to anywhere.
//
// ── Where this 404 must NOT appear ──────────────────────────────────────────
//
// The root not-found boundary covers the whole app, including surfaces that
// are white-label. Two segments therefore carry their own unbranded
// not-found.js so this branded page can never surface on them:
//
//   app/site/[subdomain]/not-found.js  — a contractor's own website, on their
//                                        own hostname
//   app/embed/not-found.js             — a widget inside a contractor's iframe
//
// If you add another surface a homeowner reaches without knowing FieldQuo
// exists, give it the same treatment.
//
// No metadata export: Next supports one on global-not-found.js, not here, and
// it injects noindex on 404 responses by itself.
import MarketingHeader from "@/app/components/marketing/MarketingHeader";
import MarketingFooter from "@/app/components/marketing/MarketingFooter";
import NotFoundContent from "@/app/components/marketing/NotFoundContent";

export default function NotFound() {
  return (
    <div className="min-h-screen flex flex-col">
      <MarketingHeader />
      <main className="flex-1">
        <NotFoundContent />
      </main>
      <MarketingFooter />
    </div>
  );
}
