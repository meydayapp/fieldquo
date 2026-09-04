// app/(marketing)/page.js
import Hero from "@/app/components/marketing/Hero";
import AIExplainer from "@/app/components/marketing/AIExplainer";
import FeaturesIndustries from "@/app/components/marketing/FeaturesIndustries";
import FAQ from "@/app/components/marketing/FAQ";
import ResourcesTeaser from "@/app/components/marketing/ResourcesTeaser";
import ClosingCTA from "@/app/components/marketing/ClosingCTA";
import { marketingMetadata } from "@/lib/marketing/metadata";

// Per-page metadata across the marketing site — see lib/marketing/metadata.js,
// including why there is no root-level title template.
export const metadata = marketingMetadata({
  path: "/",
  title:
    "FieldQuo — quotes, invoices and scheduling for field service businesses",
  description:
    "Build a quote on site, send it before you leave the driveway, and get paid without chasing anyone. Quoting, scheduling, invoicing and payments for painters, plumbers, electricians, landscapers and every other trade.",
});

export default function HomePage() {
  return (
    <>
      <Hero />
      <AIExplainer />
      <FeaturesIndustries />
      <FAQ />
      <ResourcesTeaser />
      {/* Last, deliberately: the page ended on a link to the Help Centre, so a
          reader the FAQ had just convinced had nothing to click. See
          ClosingCTA.js for why it is not folded into ResourcesTeaser.

          The order above is untouched. Whether the AI section or the trades
          band comes second is a positioning call — lead on the thing no
          competitor has, or on the thing that tells a roofer this is for
          roofers — and that is the owner's to make, not an import order to
          quietly reshuffle. */}
      <ClosingCTA />
    </>
  );
}
