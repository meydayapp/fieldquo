"use client";

// app/app/me/documents/page.js — "My documents": what the company holds on
// me, and what I can hand in from my phone. Inside the employee shell.
import { useTranslation } from "@/app/hooks/useTranslation";
import MeShell from "@/app/components/me/MeShell";
import WorkerDocumentsPanel from "@/app/components/hr/WorkerDocumentsPanel";

export default function MeDocumentsPage() {
  const { t } = useTranslation();
  return (
    <MeShell title={t("app.hr.me.documents")}>
      <WorkerDocumentsPanel mode="self" />
    </MeShell>
  );
}
