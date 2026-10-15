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
//   notFor     the custom plan's cap (CUSTOM_MAX_SEATS, CUSTOM_CREW_GAP in
//              lib/pricing/ladder.js) — site audit D2.B, 2026-10-15
//
// The items are built by homeFaqItems (lib/marketing/homeFaq.js), which the
// homepage ALSO calls on the server for its FAQPage JSON-LD — so the
// structured answers are the visible ones, word for word in English.
"use client";

import FAQ from "@/app/components/marketing/FAQ";
import { homeFaqItems } from "@/lib/marketing/homeFaq";
import { useTranslation } from "@/app/hooks/useTranslation";
import { numberLocaleFor } from "@/app/i18n/numberLocale";

export default function HomeFAQ({ graceDays, languages = { email: [], app: [] } }) {
  const { t, language } = useTranslation();
  const items = homeFaqItems(t, { graceDays, languages, locale: numberLocaleFor(language) });
  return <FAQ items={items} title={t("faq.title")} />;
}
