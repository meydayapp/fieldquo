"use client";

// app/components/hr/TeamHrTabs.js — the row of pills across Manage Team's
// HR screens, so Compliance, Onboarding checklists and Policies are one
// hop from each other and from the roster.
import Link from "next/link";
import { useTranslation } from "@/app/hooks/useTranslation";

const TABS = [
  { key: "team", href: "/app/settings/team", labelKey: "app.setTeam.title" },
  { key: "compliance", href: "/app/settings/team/compliance", labelKey: "app.hr.compliance.tab" },
  { key: "onboarding", href: "/app/settings/team/onboarding", labelKey: "app.hr.templates.tab" },
  { key: "policies", href: "/app/settings/policies", labelKey: "app.hr.policies.tab" },
];

export default function TeamHrTabs({ active }) {
  const { t } = useTranslation();
  return (
    <div className="flex flex-wrap gap-2 text-sm" data-hr-tabs>
      {TABS.map((tab) => (
        <Link key={tab.key} href={tab.href} className={`border rounded-full px-4 py-2 min-h-[44px] inline-flex items-center ${active === tab.key ? "bg-primary text-primary-foreground border-primary" : "border-border"}`}>
          {t(tab.labelKey)}
        </Link>
      ))}
    </div>
  );
}
