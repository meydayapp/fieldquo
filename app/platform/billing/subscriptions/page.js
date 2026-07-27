// app/platform/billing/subscriptions/page.js — placeholder, see app/components/platform/NotBuilt.js
import NotBuilt from "@/app/components/platform/NotBuilt";

export default function PlatformSubscriptionsPage() {
  return (
    <NotBuilt
      title="Subscriptions"
      description="Who's on which plan, and the state of their Stripe billing. Not built yet."
      apiRoute="/api/platform/billing/portal"
    />
  );
}
