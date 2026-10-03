"use client";

// app/components/hr/TeamHrTabs.js — the row of pills across Manage Team's
// HR screens, so Compliance, Onboarding checklists and Policies are one
// hop from each other and from the roster. Drawn by SettingsTabStrip: it
// used to `flex-wrap` onto a second line on a phone instead of scrolling.
import { useTranslation } from "@/app/hooks/useTranslation";
import SettingsTabStrip from "@/app/components/settings/SettingsTabStrip";

const TABS = [
  { key: "team", href: "/app/settings/team", labelKey: "app.setTeam.title" },
  { key: "compliance", href: "/app/settings/team/compliance", labelKey: "app.hr.compliance.tab" },
  { key: "onboarding", href: "/app/settings/team/onboarding", labelKey: "app.hr.templates.tab" },
  { key: "policies", href: "/app/settings/policies", labelKey: "app.hr.policies.tab" },
];

export default function TeamHrTabs({ active }) {
  const { t } = useTranslation();
  return (
    <SettingsTabStrip
      data-hr-tabs
      label={t("app.setTeam.title")}
      active={active}
      tabs={TABS.map((tab) => ({ key: tab.key, href: tab.href, label: t(tab.labelKey) }))}
    />
  );
}
