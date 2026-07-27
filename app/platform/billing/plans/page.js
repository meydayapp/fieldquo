// app/platform/billing/plans/page.js — placeholder, see app/components/platform/NotBuilt.js
import NotBuilt from "@/app/components/platform/NotBuilt";

export default function PlatformPlansPage() {
  return (
    <NotBuilt
      title="Plans"
      description="Create and edit the subscription plans companies can buy. The public /pricing page reads these live from the Plan table."
      apiRoute="/api/platform/billing/plans"
    />
  );
}
