// app/app/help/page.js
//
// In-app knowledge base for contractors. Static content, so it's a thin
// wrapper over the shared HelpCenter with the "company" audience.
"use client";

import HelpCenter from "@/app/components/help/HelpCenter";

import { useTranslation } from "@/app/hooks/useTranslation";
export default function HelpPage() {
  const { t } = useTranslation();
  return (
    <HelpCenter
      audience="company"
      title={t("app.help.title")}
      intro="Step-by-step guides for everything in FieldQuo — quotes, jobs, invoices, getting paid, booking, your website, your team, and using it on your phone. Search, or browse by topic below."
    />
  );
}
