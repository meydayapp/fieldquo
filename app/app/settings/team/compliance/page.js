"use client";

// app/app/settings/team/compliance/page.js — HR & compliance: per person,
// what is expiring, unfinished, unsigned or unacknowledged. A tab on
// Manage Team; see app/components/hr/ComplianceOverview.js.
import { ShieldCheck } from "lucide-react";
import { useTranslation } from "@/app/hooks/useTranslation";
import { useSettingsAccess } from "@/app/providers/SettingsAccessProvider";
import { NoAccessPanel } from "@/app/components/settings/PermissionNotice";
import ComplianceOverview from "@/app/components/hr/ComplianceOverview";
import TeamHrTabs from "@/app/components/hr/TeamHrTabs";

export default function CompliancePage() {
  const { t } = useTranslation();
  const access = useSettingsAccess();
  if (!access.canSee("user:manage")) return <NoAccessPanel capability="user:manage" />;
  return (
    <div className="max-w-5xl mx-auto p-4 sm:p-6 space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
          <ShieldCheck size={22} /> {t("app.hr.compliance.title")}
        </h1>
        <p className="text-sm text-muted-foreground mt-1">{t("app.hr.compliance.intro")}</p>
      </div>
      <TeamHrTabs active="compliance" />
      <ComplianceOverview />
    </div>
  );
}
