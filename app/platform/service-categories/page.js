// app/platform/service-categories/page.js — placeholder, see app/components/platform/NotBuilt.js
import NotBuilt from "@/app/components/platform/NotBuilt";

export default function PlatformServiceCategoriesPage() {
  return (
    <NotBuilt
      title="Service categories"
      description="The global category list companies pick from during onboarding. Not built yet."
      apiRoute="/api/platform/service-categories"
    />
  );
}
