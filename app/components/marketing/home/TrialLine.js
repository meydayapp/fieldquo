// app/components/marketing/home/TrialLine.js
//
// "14 days free · no card needed · every feature on every plan" — printed
// three times on the homepage, so one component, and every part of it read
// from lib/pricing.js rather than typed.
//
// The middle clause is CONDITIONAL on TRIAL_CARD_REQUIRED. It was a false
// claim on this page once (a card was taken at signup), and
// check:marketing-cta now bans a no-card claim only while that constant says
// a card is required — so the day the owner turns the card back on, this
// clause disappears here and the check fails anything that still says it.
"use client";

import { TRIAL_DAYS, TRIAL_CARD_REQUIRED } from "@/lib/pricing";
import { useTranslation } from "@/app/hooks/useTranslation";

export default function TrialLine({ className = "" }) {
  const { t } = useTranslation();
  const parts = [t("home.trial.days", { days: TRIAL_DAYS })];
  if (!TRIAL_CARD_REQUIRED) parts.push(t("home.trial.noCard"));
  parts.push(t("home.trial.allFeatures"));
  return <p className={className}>{parts.join(" · ")}</p>;
}
