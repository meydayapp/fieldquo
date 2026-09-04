// app/app/help/page.js
//
// In-app knowledge base for contractors. Static content, so it's a thin
// wrapper over the shared HelpCenter with the "company" audience.
//
// ── i18n PENDING ───────────────────────────────────────────────────────────
//
// `intro` below is the one string on this page that does not go through t(),
// and it is the longest one on it. Not wired, because a t() call on a key that
// does not exist yet turns check:translations red for every other agent in the
// tree (commit 080999e). Reported instead:
//
//   app.help.intro
//     en: "Step-by-step guides for everything in FieldQuo — quotes, jobs,
//          invoices, getting paid, booking, your website, your team, and using
//          it on your phone. Search, or browse by topic below."
//     fr: "Des guides pas à pas pour tout dans FieldQuo — soumissions,
//          chantiers, factures, encaissements, prise de rendez-vous, votre site
//          web, votre équipe, et l'utilisation sur téléphone. Cherchez, ou
//          parcourez par sujet ci-dessous."
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
      intro="Step-by-step guides for everything in FieldQuo — quotes, jobs, invoices, getting paid, booking, your website, your team, and using it on your phone. Search, or browse by topic below."
    />
  );
}
