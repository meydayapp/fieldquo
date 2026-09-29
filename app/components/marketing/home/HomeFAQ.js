// app/components/marketing/home/HomeFAQ.js
//
// Section 11: the questions a contractor asks before signing up, answered
// from the code rather than from memory. Rendered through the shared FAQ
// accordion (app/components/marketing/FAQ.js) with its own items, the same
// way /product/<slug> asks its questions.
//
// What each answer rests on, so the next person can re-check it:
//
//   trial      TRIAL_DAYS (lib/pricing.js)
//   card       TRIAL_CARD_REQUIRED (lib/pricing.js) picks which answer; the
//              read-only window is GRACE_DAYS (lib/billing/access.js), passed
//              in from the server page; "nothing is deleted" is that file's
//              stated rule
//   cancel     app/api/platform/billing/cancel/route.js — a paid plan is
//              cancelled at the end of the period it paid for
//   switch     the CSV imports: /app/clients/import, the price book import
//              (/api/products/import), /app/jobs/import (past jobs)
//   migration  docs/MIGRATION-SERVICE.md — clients and quotes only, created
//              never changed, after the company requests, accepts and pays
//   languages  both lists are computed on the server: client emails from
//              SUPPORTED_EMAIL_LANGUAGES, app screens from APP_LANGUAGES
//              (complete AND reviewed) — see app/(marketing)/page.js
//   devices    the app is a web app with a manifest (app/manifest.js)
"use client";

import FAQ from "@/app/components/marketing/FAQ";
import { TRIAL_DAYS, TRIAL_CARD_REQUIRED } from "@/lib/pricing";
import { useTranslation } from "@/app/hooks/useTranslation";
import { numberLocaleFor } from "@/app/i18n/numberLocale";

function listOf(names, locale) {
  const list = (names || []).filter(Boolean);
  try {
    return new Intl.ListFormat(locale, { style: "long", type: "conjunction" }).format(list);
  } catch {
    return list.join(", ");
  }
}

export default function HomeFAQ({ graceDays, languages = { email: [], app: [] } }) {
  const { t, language } = useTranslation();
  const locale = numberLocaleFor(language);

  const items = [
    { id: "trial", q: t("home.faq.trial.q"), a: t("home.faq.trial.a", { days: TRIAL_DAYS }) },
    {
      id: "card",
      q: t("home.faq.card.q"),
      a: TRIAL_CARD_REQUIRED
        ? t("home.faq.card.aCard", { days: TRIAL_DAYS })
        : t("home.faq.card.aNoCard", { grace: graceDays }),
    },
    { id: "cancel", q: t("home.faq.cancel.q"), a: t("home.faq.cancel.a") },
    { id: "switch", q: t("home.faq.switch.q"), a: t("home.faq.switch.a") },
    { id: "migration", q: t("home.faq.migration.q"), a: t("home.faq.migration.a") },
    {
      id: "languages",
      q: t("home.faq.languages.q"),
      a: t("home.faq.languages.a", {
        emailLanguages: listOf(languages.email, locale),
        appLanguages: listOf(languages.app, locale),
      }),
    },
    { id: "devices", q: t("home.faq.devices.q"), a: t("home.faq.devices.a") },
  ];

  return <FAQ items={items} title={t("faq.title")} />;
}
