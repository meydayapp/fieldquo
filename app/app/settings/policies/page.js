"use client";

// app/app/settings/policies/page.js — Settings → Policies. See
// app/components/hr/PoliciesManager.js.
import { ScrollText } from "lucide-react";
import { useTranslation } from "@/app/hooks/useTranslation";
import { useSettingsAccess } from "@/app/providers/SettingsAccessProvider";
import { NoAccessPanel } from "@/app/components/settings/PermissionNotice";
import PoliciesManager from "@/app/components/hr/PoliciesManager";

export default function PoliciesSettingsPage() {
  const { t } = useTranslation();
  const access = useSettingsAccess();
  if (!access.canSee("user:manage")) return <NoAccessPanel capability="user:manage" />;
  return (
    <div className="max-w-3xl mx-auto p-4 sm:p-6 space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
          <ScrollText size={22} /> {t("app.hr.policies.title")}
        </h1>
        <p className="text-sm text-muted-foreground mt-1">{t("app.hr.policies.intro")}</p>
      </div>
      <PoliciesManager />
    </div>
  );
}
