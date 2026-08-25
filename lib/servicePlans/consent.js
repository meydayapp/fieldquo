// lib/servicePlans/consent.js
//
// The wording a client has to read and agree to before anything can charge
// their card or debit their bank account, and the rules about when we are
// allowed to ask at all.
//
// ── This is a compliance artefact, not marketing copy ───────────────────────
//
// Stripe's guidance for saving a payment method and charging it off-session is
// explicit that the merchant — us, on the contractor's behalf — must state, and
// must KEEP A RECORD OF, four things:
//
//   1. the customer's agreement that we will initiate a series of payments,
//   2. the anticipated timing and frequency of those payments,
//   3. how the amount is determined,
//   4. the cancellation policy.
//
// Stripe's hosted page collects the instrument and, for pre-authorized debit in
// Canada, renders its own PAD agreement and emails the client a copy. It does
// NOT state the four items above — that is ours, and it is the half that makes
// an off-session charge authorised rather than merely technically possible.
//
// buildAuthorisationTerms is therefore rendered on the client's own page, the
// client ticks a box against it, and the exact string is snapshotted into
// ServicePlanAuthorisation.termsText. Improving this wording later cannot
// rewrite what an existing client agreed to.
//
// ── Why only English and French ─────────────────────────────────────────────
//
// The rest of the client-facing surface ships in six languages. This does not,
// and the product says so rather than machine-drafting a payment authorisation
// nobody fluent has read. A client whose language we cannot state these terms
// in is not offered automatic charging at all — they get the invoice-per-visit
// tier, which needs no mandate and works in every language. Refusing to ask is
// the honest failure; asking in wording we cannot vouch for is not.

import { documentFormatters } from "@/lib/i18n/documentLabels";

/** Languages we hold reviewed authorisation wording for. */
export const AUTHORISATION_LANGUAGES = ["en", "fr"];

export function canAuthoriseInLanguage(language) {
  return AUTHORISATION_LANGUAGES.includes(String(language || "").toLowerCase());
}

// How each cadence is described in a sentence, and — separately — the short
// phrase Stripe requires as `interval_description` on a pre-authorized debit
// mandate. Stripe renders that phrase verbatim in its own agreement, so it has
// to read as a schedule ("twice a year") and not as an enum ("semiannual").
const CADENCE = {
  en: {
    weekly: { every: "every week", interval: "Once a week" },
    monthly: { every: "every month", interval: "Once a month" },
    quarterly: { every: "every three months", interval: "Once every three months" },
    semiannual: { every: "twice a year", interval: "Twice a year" },
    annual: { every: "once a year", interval: "Once a year" },
  },
  fr: {
    weekly: { every: "chaque semaine", interval: "Une fois par semaine" },
    monthly: { every: "chaque mois", interval: "Une fois par mois" },
    quarterly: { every: "tous les trois mois", interval: "Une fois tous les trois mois" },
    semiannual: { every: "deux fois par an", interval: "Deux fois par an" },
    annual: { every: "une fois par an", interval: "Une fois par an" },
  },
};

function lang(language) {
  const code = String(language || "en").toLowerCase();
  return CADENCE[code] ? code : "en";
}

/**
 * The short schedule phrase for Stripe's PAD mandate.
 *
 * Stripe requires this whenever payment_schedule is "interval", and prints it
 * inside the agreement the client signs. It must describe the same cadence the
 * plan actually bills on — if the two disagree, every debit is outside the
 * mandate.
 */
export function mandateIntervalDescription(frequency, language = "en") {
  const table = CADENCE[lang(language)];
  return table[frequency]?.interval || table.monthly.interval;
}

/**
 * How the series ends, as a clause. Never invents an end for an open plan —
 * "until you cancel" is the true statement and is also the one that makes the
 * cancellation policy meaningful.
 */
function lengthClause(plan, code, fmt) {
  if (plan.endMode === "count" && plan.occurrenceCount > 0) {
    const n = plan.occurrenceCount;
    return code === "fr"
      ? `${n} paiement${n > 1 ? "s" : ""} au total, puis l’entente prend fin d’elle-même.`
      : `${n} payment${n > 1 ? "s" : ""} in total, after which this arrangement ends on its own.`;
  }
  if (plan.endMode === "until" && plan.endDate) {
    const when = fmt.date(plan.endDate);
    return code === "fr"
      ? `Aucun paiement après le ${when}.`
      : `No payments after ${when}.`;
  }
  return code === "fr"
    ? "Il n’y a pas de date de fin : les paiements continuent jusqu’à ce que vous ou l’entreprise y mettiez fin."
    : "There is no end date: payments continue until you or the company ends the arrangement.";
}

/**
 * The full terms, as displayed and as recorded.
 *
 * @param plan     the ServicePlan row (money terms are frozen at creation, so
 *                 this text can be regenerated identically later)
 * @param company  { name, currency, phone, email }
 * @param amounts  the result of occurrenceAmounts(plan)
 * @param term     the result of termTotals(...), or null for an open plan
 * @returns { language, title, intro, bullets: string[], consentLabel,
 *            cancelNote, text }
 *          `text` is the flat snapshot written to the database — the bullets
 *          joined, so a dispute is read against exactly what was on screen.
 */
export function buildAuthorisationTerms({ plan, company, amounts, term = null }) {
  const code = lang(plan?.language);
  const fmt = documentFormatters(code, company?.currency);
  const cadence = CADENCE[code][plan.frequency] || CADENCE[code].monthly;
  const name = company?.name || "";
  const amount = fmt.money(amounts.total);
  const first = fmt.date(plan.startDate);

  // Item 1 — a series of payments, initiated by the company.
  // Item 2 — timing and frequency.
  // Item 3 — how the amount is determined.
  // Item 4 — the cancellation policy.
  // Numbered here so the check script can assert all four survive an edit.
  const bullets =
    code === "fr"
      ? [
          `Vous autorisez ${name} à prélever une série de paiements sur le moyen de paiement que vous enregistrez à l’étape suivante, sans autre intervention de votre part.`,
          `Le premier paiement est prélevé le ${first}, puis ${cadence.every}.`,
          `Chaque paiement est de ${amount}${plan.taxRatePct ? " (taxes comprises)" : ""}. Ce montant est fixé maintenant et ne peut pas être modifié en cours d’entente : pour le changer, il faut annuler celle-ci et en conclure une nouvelle.`,
          lengthClause(plan, code, fmt),
          `Vous pouvez mettre fin à cette entente à tout moment en communiquant avec ${name}${company?.phone ? ` au ${company.phone}` : ""}${company?.email ? ` ou à ${company.email}` : ""}. Aucun paiement n’est prélevé après l’annulation.`,
          `Chaque paiement donne lieu à une facture, visible dans votre espace client.`,
        ]
      : [
          `You authorise ${name} to take a series of payments from the payment method you save on the next screen, without asking you again each time.`,
          `The first payment is taken on ${first}, and then ${cadence.every}.`,
          `Each payment is ${amount}${plan.taxRatePct ? " (tax included)" : ""}. That amount is fixed now and cannot be changed while this arrangement runs — changing it means cancelling this one and agreeing a new one.`,
          lengthClause(plan, code, fmt),
          `You can end this arrangement at any time by contacting ${name}${company?.phone ? ` on ${company.phone}` : ""}${company?.email ? ` at ${company.email}` : ""}. No payment is taken after it is cancelled.`,
          `Every payment raises an invoice, which you can see in your client account.`,
        ];

  const title =
    code === "fr"
      ? `Autoriser les paiements automatiques — ${plan.name}`
      : `Authorise automatic payments — ${plan.name}`;

  const intro =
    code === "fr"
      ? `${name} vous propose de régler « ${plan.name} » automatiquement. Lisez ce qui suit avant d’accepter.`
      : `${name} would like to collect for “${plan.name}” automatically. Read this before you agree.`;

  const consentLabel =
    code === "fr"
      ? "J’ai lu ce qui précède et j’autorise ces paiements."
      : "I have read the above and I authorise these payments.";

  const cancelNote =
    term && term.occurrences > 1
      ? code === "fr"
        ? `Total sur la durée de l’entente : ${fmt.money(term.total)} pour ${term.occurrences} paiements.`
        : `Total over the whole arrangement: ${fmt.money(term.total)} across ${term.occurrences} payments.`
      : "";

  return {
    language: code,
    title,
    intro,
    bullets,
    consentLabel,
    cancelNote,
    text: [title, intro, ...bullets, cancelNote, consentLabel]
      .filter(Boolean)
      .join("\n"),
  };
}
