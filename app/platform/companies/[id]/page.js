// app/platform/companies/[id]/page.js — placeholder, see app/components/platform/NotBuilt.js
import NotBuilt from "@/app/components/platform/NotBuilt";

export default function PlatformCompanyDetailPage() {
  return (
    <NotBuilt
      title="Company detail"
      description="Inspect a single company, its subscription and its members. Not built yet."
      apiRoute="/api/platform/companies/[id]"
    />
  );
}
