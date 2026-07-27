// app/platform/page.js — placeholder, see app/components/platform/NotBuilt.js
import NotBuilt from "@/app/components/platform/NotBuilt";

export default function PlatformHomePage() {
  return (
    <NotBuilt
      title="Platform console"
      description="FieldQuo's internal back office. Not built yet."
      apiRoute="/api/platform/analytics/overview"
    />
  );
}
