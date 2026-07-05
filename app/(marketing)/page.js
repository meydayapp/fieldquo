// app/(marketing)/page.js
import Hero from "@/app/components/marketing/Hero";
import AIExplainer from "@/app/components/marketing/AIExplainer";
import FeaturesIndustries from "@/app/components/marketing/FeaturesIndustries";
import FAQ from "@/app/components/marketing/FAQ";
import ResourcesTeaser from "@/app/components/marketing/ResourcesTeaser";

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
