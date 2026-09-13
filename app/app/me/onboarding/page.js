"use client";

// app/app/me/onboarding/page.js — my checklist, big tap targets, every row
// opens the thing it asks for. Inside the employee shell.
import { useTranslation } from "@/app/hooks/useTranslation";
import MeShell from "@/app/components/me/MeShell";
import OnboardingChecklist from "@/app/components/hr/OnboardingChecklist";

export default function MeOnboardingPage() {
  const { t } = useTranslation();
  return (
    <MeShell title={t("app.hr.me.onboarding")}>
      <OnboardingChecklist mode="self" />
    </MeShell>
  );
}
