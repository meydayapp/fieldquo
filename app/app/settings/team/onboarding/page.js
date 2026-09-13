"use client";

// app/app/settings/team/onboarding/page.js — the company's new-hire
// checklists. Opening this is what creates the default one.
import { ClipboardList } from "lucide-react";
import { useTranslation } from "@/app/hooks/useTranslation";
import { useSettingsAccess } from "@/app/providers/SettingsAccessProvider";
import { NoAccessPanel } from "@/app/components/settings/PermissionNotice";
import TemplateEditor from "@/app/components/hr/TemplateEditor";
import TeamHrTabs from "@/app/components/hr/TeamHrTabs";

export default function OnboardingTemplatesPage() {
  const { t } = useTranslation();
  const access = useSettingsAccess();
  if (!access.canSee("user:manage")) return <NoAccessPanel capability="user:manage" />;
  return (
    <div className="max-w-3xl mx-auto p-4 sm:p-6 space-y-4">
      <div>
        <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
          <ClipboardList size={22} /> {t("app.hr.templates.title")}
        </h1>
      </div>
      <TeamHrTabs active="onboarding" />
      <TemplateEditor />
    </div>
  );
}
