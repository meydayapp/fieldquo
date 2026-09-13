"use client";

// app/app/me/notes/page.js — what my managers wrote that I may see, and the
// warnings or write-ups waiting for my acknowledgement.
import { useTranslation } from "@/app/hooks/useTranslation";
import MeShell from "@/app/components/me/MeShell";
import MyNotes from "@/app/components/hr/MyNotes";

export default function MeNotesPage() {
  const { t } = useTranslation();
  return (
    <MeShell title={t("app.hr.me.notes")}>
      <MyNotes />
    </MeShell>
  );
}
