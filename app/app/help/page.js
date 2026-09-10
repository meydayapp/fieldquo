// app/app/help/page.js
//
// In-app knowledge base for contractors. Static content, so it's a thin
// wrapper over the shared HelpCenter with the "company" audience.
//
// ── The intro is keyed now; the GUIDES are not ─────────────────────────────
//
// `intro` used to be the one string here that skipped t(), with a note giving
// the English and French it should have had. The key exists, so it does.
//
// The articles themselves are a different problem and this page cannot fix it:
// they are 38 structured documents in app/data/helpArticles.js — title,
// summary and a body of prose blocks — and they are English. That is CONTENT,
// not labels, so nothing done to this file translates a word of it. See the
// report; the honest fix is a per-language article set, not nine copies of a
// t() call.
//
// FieldQuo's own name stays in every language: this is the back office, not a
// client-facing surface, and the product name is not translated (same rule the
// catalogue already applies to "FieldQuo AI").
"use client";

import HelpCenter from "@/app/components/help/HelpCenter";

import { useTranslation } from "@/app/hooks/useTranslation";
export default function HelpPage() {
  const { t } = useTranslation();
  return (
    <HelpCenter
      audience="company"
      title={t("app.help.title")}
      intro={t("app.help.intro")}
    />
  );
}
