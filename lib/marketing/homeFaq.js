// lib/marketing/homeFaq.js
//
// The homepage FAQ's questions and answers, built in ONE place for both of
// the things that print them: the visible accordion
// (app/components/marketing/home/HomeFAQ.js, in the reader's language) and
// the FAQPage JSON-LD (app/(marketing)/page.js, in English — the language the
// server renders). Google requires structured FAQ text to match what is on
// the page; building both from one function makes that true by construction.
//
// What each answer rests on is listed in HomeFAQ.js's header.

import { TRIAL_DAYS, TRIAL_CARD_REQUIRED } from "@/lib/pricing";
import { CUSTOM_MAX_SEATS, CUSTOM_CREW_GAP } from "@/lib/pricing/ladder";

function listOf(names, locale) {
  const list = (names || []).filter(Boolean);
  try {
    return new Intl.ListFormat(locale, { style: "long", type: "conjunction" }).format(list);
  } catch {
    return list.join(", ");
  }
}

/**
 * @param t          a translator: t(key, values) → string
 * @param graceDays  GRACE_DAYS (lib/billing/access.js), passed in by the page
 * @param languages  { email: [native names], app: [native names] }
 * @param locale     Intl locale for the language lists
 * @returns [{ id, q, a }]
 */
export function homeFaqItems(t, { graceDays, languages = { email: [], app: [] }, locale = "en-CA" } = {}) {
  return [
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
    // Site audit D2.B (2026-10-15): who FieldQuo is NOT for, said once,
    // plainly. The limits are the ladder's own constants — the custom plan's
    // cap (47 seats and 52 crew on 2026-10-15, lib/pricing/ladder.js) — so
    // the sentence moves if the cap does.
    {
      id: "notFor",
      q: t("home.faq.notFor.q"),
      a: t("home.faq.notFor.a", { maxSeats: CUSTOM_MAX_SEATS, maxCrew: CUSTOM_MAX_SEATS + CUSTOM_CREW_GAP }),
    },
  ];
}
