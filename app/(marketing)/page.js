// app/(marketing)/page.js
import Hero from "@/app/components/marketing/Hero";
import AIExplainer from "@/app/components/marketing/AIExplainer";
import FeaturesIndustries from "@/app/components/marketing/FeaturesIndustries";
import FAQ from "@/app/components/marketing/FAQ";
import ResourcesTeaser from "@/app/components/marketing/ResourcesTeaser";
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
    </>
  );
}
