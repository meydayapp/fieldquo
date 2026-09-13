"use client";

// app/app/me/tax-forms/page.js — the TD1 / W-4 questions. ?kind= picks the
// form; useSearchParams needs a Suspense boundary in the App Router.
import { Suspense } from "react";
import { useTranslation } from "@/app/hooks/useTranslation";
import MeShell from "@/app/components/me/MeShell";
import TaxFormScreen from "@/app/components/hr/TaxFormScreen";

export default function MeTaxFormsPage() {
  const { t } = useTranslation();
  return (
    <MeShell title={t("app.hr.me.taxForms")}>
      <Suspense fallback={null}>
        <TaxFormScreen />
      </Suspense>
    </MeShell>
  );
}
