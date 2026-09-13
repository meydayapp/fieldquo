"use client";

// app/app/log/page.js — the manager's log book. Managers only: the nav row
// is gated in lib/permissions/nav.js on the same roles the API requires,
// and the page refuses the rest with the standard panel rather than
// rendering a composer whose POST would 403.
import { BookOpen } from "lucide-react";
import { useTranslation } from "@/app/hooks/useTranslation";
import { useSettingsAccess } from "@/app/providers/SettingsAccessProvider";
import { NoAccessPanel } from "@/app/components/settings/PermissionNotice";
import ManagerLog from "@/app/components/hr/ManagerLog";

export default function ManagerLogPage() {
  const { t } = useTranslation();
  const access = useSettingsAccess();
  if (!access.canSee("user:manage")) return <NoAccessPanel capability="user:manage" />;
  return (
    <div className="max-w-3xl mx-auto p-4 sm:p-6 space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
          <BookOpen size={22} /> {t("app.hr.log.title")}
        </h1>
        <p className="text-sm text-muted-foreground mt-1">{t("app.hr.log.intro")}</p>
      </div>
      <ManagerLog />
    </div>
  );
}
