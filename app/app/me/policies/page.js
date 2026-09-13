"use client";

// app/app/me/policies/page.js — read, type your name, acknowledge.
import { useTranslation } from "@/app/hooks/useTranslation";
import MeShell from "@/app/components/me/MeShell";
import PolicyReader from "@/app/components/hr/PolicyReader";

export default function MePoliciesPage() {
  const { t } = useTranslation();
  return (
    <MeShell title={t("app.hr.me.policies")}>
      <PolicyReader />
    </MeShell>
  );
}
