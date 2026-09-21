// app/components/sales/SignupBadge.js
//
// The one badge for a signup-sourced lead, wherever it is drawn: the rep's
// queue list and card, the review folder's signup section, the owner's
// signups screen, the rep's "Your signups" list.
//
//   hot      red    an abandoned signup — a phone number typed into our own
//                   form and the tab closed. The owner's word: "a badge that
//                   might say hot".
//   new      green  a company created self-serve — a welcome call.
//   stalled  red    that company with no card after the grace, or no quote
//                   sent in its first week.
//
// Nine languages through the app catalogue (app.signupLead.badge.*), so the
// same component is right on /platform (whose neighbours are English) and
// on /sales (which is in nine). The colours are the same pairs the queue's
// "Do not contact" and "Best time now" chips use — measured there, not new.
"use client";

import { Flame, Sparkles, AlertTriangle } from "lucide-react";
import { useTranslation } from "@/app/hooks/useTranslation";

export const SIGNUP_BADGE_KEYS = Object.freeze({
  hot: "app.signupLead.badge.hot",
  new: "app.signupLead.badge.new",
  stalled: "app.signupLead.badge.stalled",
});

/**
 * The signup fact's params with the "ago" noun in the reader's language:
 * lib/signup/leads.js sends { n, unit: "minutes"|"hours"|"days" } and the
 * catalogue's sentence reads "{ago}", so the unit goes through its own key
 * rather than being interpolated as an English word.
 */
export function signupFactParams(fact, t) {
  const p = fact?.params || {};
  const unit = p.unit || "minutes";
  const out = { ...p, ago: t(`app.signupLead.ago.${unit}`, `${p.n ?? 0} ${unit} ago`, { n: p.n ?? 0 }) };
  // "card added / not yet", "first quote sent / not yet" — words, so they
  // go through keys rather than arriving as English values.
  if (typeof p.cardAdded === "boolean") out.card = t(p.cardAdded ? "app.signupLead.card.added" : "app.signupLead.card.notYet", p.card);
  if (typeof p.quoteSent === "boolean") out.quote = t(p.quoteSent ? "app.signupLead.quote.sent" : "app.signupLead.quote.notYet", p.quote);
  return out;
}

/** The fact's sentence in the reader's language. */
export function signupFactText(fact, t) {
  if (!fact) return "";
  return fact.textKey ? t(fact.textKey, fact.text, signupFactParams(fact, t)) : fact.text;
}

const TONE = {
  hot: "border-red-600/40 bg-red-600/10 text-red-700 dark:text-red-300",
  stalled: "border-red-600/40 bg-red-600/10 text-red-700 dark:text-red-300",
  new: "border-emerald-600/40 bg-emerald-600/10 text-emerald-700 dark:text-emerald-300",
};

const ICON = { hot: Flame, stalled: AlertTriangle, new: Sparkles };

/**
 * @param kind    "hot" | "new" | "stalled" — anything else draws nothing.
 * @param compact the list-row size (11px) rather than the card chip.
 */
export default function SignupBadge({ kind, compact = false, title = null }) {
  const { t } = useTranslation();
  const key = SIGNUP_BADGE_KEYS[kind];
  if (!key) return null;
  const Icon = ICON[kind];
  return (
    <span
      className={`inline-flex items-center gap-1 rounded border font-semibold uppercase tracking-wide ${TONE[kind]} ${
        compact ? "px-1 py-px mr-1 text-[11px] leading-4" : "px-2 py-0.5 text-xs"
      }`}
      data-signup-badge={kind}
      title={title || undefined}
    >
      <Icon size={compact ? 11 : 12} aria-hidden="true" />
      {t(key)}
    </span>
  );
}
