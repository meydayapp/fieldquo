// app/hooks/useIndustryLabels.js
//
// The twelve trades, in the visitor's language.
//
// app/data/industries.js carries the slug and an ENGLISH label. That label is
// a routing/ordering key, not display copy — three separate surfaces (the
// header dropdown, the footer column, the "Built for any trade" block on the
// homepage) were rendering it verbatim, so a French visitor got a fully
// translated page with a strip of English trade names in the middle of it.
// That strip is the one thing a visitor scans to decide "is this for me?".
//
// The translations already existed: app/i18n/industries/<lang>.js carries a
// label for all twelve trades in all six languages, written for the
// /industries/[slug] pages. This hook is the one place that joins the two, so
// the next surface that lists trades gets the language for free rather than
// growing a fourth copy of the English array.
//
// Order comes from INDUSTRIES, not from the catalogue: the list is
// alphabetical in English and stays in that order everywhere, which keeps the
// nav grid stable no matter which language is active.
"use client";

import { useMemo } from "react";
import { INDUSTRIES } from "@/app/data/industries";
import { industryContentFor } from "@/app/i18n/industries";
import { useTranslation } from "@/app/hooks/useTranslation";

export function useIndustryLabels() {
  const { language } = useTranslation();

  return useMemo(
    () =>
      INDUSTRIES.map((ind) => ({
        slug: ind.slug,
        // industryContentFor falls back field by field to English, so a trade
        // added tomorrow without a translation shows its English name rather
        // than its slug.
        label: industryContentFor(ind.slug, language)?.label || ind.label,
      })),
    [language],
  );
}
