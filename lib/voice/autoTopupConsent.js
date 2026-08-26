// lib/voice/autoTopupConsent.js
//
// The wording a contractor has to read and agree to before FieldQuo may charge
// their card without them being there, and the record we keep of it.
//
// ── This is a compliance artefact, not marketing copy ───────────────────────
//
// Stripe's guidance for saving a payment method and charging it off-session is
// explicit that the merchant must state, and must KEEP A RECORD OF, four
// things:
//
//   1. the customer's agreement that we will initiate a series of payments,
//   2. the anticipated timing and frequency of those payments,
//   3. how the amount is determined,
//   4. the cancellation policy.
//
// Stripe's hosted setup page collects the CARD. It states none of those four.
// That half is ours, and it is the half that makes an off-session charge
// authorised rather than merely technically possible.
//
// lib/servicePlans/consent.js does exactly this one level down — the contractor
// charging their own client. This is the same discipline pointed the other way:
// FieldQuo is the merchant and the contractor is the customer. Same shape on
// purpose, because two different disciplines about the same Stripe requirement
// is how one of them ends up weaker.
//
// ── Why the exact text is snapshotted ───────────────────────────────────────
//
// buildAutoTopupTerms is rendered on the settings screen, the owner ticks a box
// against it, and the flat `text` is written verbatim into
// VoiceAutoTopup.termsText. Improving this wording next month cannot rewrite
// what somebody agreed to last month — which is the whole point of keeping a
// record rather than a boolean.
//
// ── Why it lives in a file with no server imports ───────────────────────────
//
// Same trap creditCurrency.js carries a warning about: the settings page is a
// client component, and anything it imports that reaches lib/voice/credits.js
// drags the Prisma client into the browser bundle and breaks the build. The
// terms have to be readable by the screen AND by the route that records them,
// so they sit here with no imports at all.
//
// ── Why only English and French ─────────────────────────────────────────────
//
// The app ships in six languages; two of them have had a fluent human read
// them. A payment authorisation drafted by machine translation is not an
// authorisation anybody has vouched for, so a company whose language we cannot
// state these terms in is shown them in English and told so — the same refusal
// lib/servicePlans/consent.js makes, one level up. Refusing to state it in a
// language nobody has checked is the honest failure; stating it anyway is not.

/** Languages we hold reviewed authorisation wording for. */
export const AUTO_TOPUP_TERMS_LANGUAGES = ["en", "fr"];

/** The language these terms will actually be stated in, given a preference. */
export function autoTopupTermsLanguage(language) {
  const code = String(language || "en").toLowerCase();
  return AUTO_TOPUP_TERMS_LANGUAGES.includes(code) ? code : "en";
}

const money = (cents) => `$${(Math.max(0, Math.round(Number(cents) || 0)) / 100).toFixed(2)}`;

/**
 * The full terms, as displayed and as recorded.
 *
 * @param thresholdCents  the balance we charge BELOW
 * @param amountCents     what each charge is for
 * @param maxPerDay       the hard daily cap on the number of charges
 * @param dailyCents      the hard daily cap on the total taken
 * @param currency        the ledger's currency — "USD". Stated out loud because
 *                        every company in production bills in CAD and their
 *                        other invoices say so; a bare "$30" here would be read
 *                        as thirty Canadian dollars and Stripe would take
 *                        thirty American ones. See lib/voice/creditCurrency.js.
 * @param companyName     who the card belongs to, so the record names them
 * @param language        en | fr; anything else is stated in English
 *
 * @returns { language, title, intro, bullets, consentLabel, text }
 *          `text` is the flat snapshot written to the database — every line
 *          that was on screen, joined, so a dispute is read against exactly
 *          what the person saw.
 */
export function buildAutoTopupTerms({
  thresholdCents,
  amountCents,
  maxPerDay,
  dailyCents,
  currency = "USD",
  companyName = "",
  language = "en",
}) {
  const code = autoTopupTermsLanguage(language);
  const threshold = `${money(thresholdCents)} ${currency}`;
  const amount = `${money(amountCents)} ${currency}`;
  const daily = `${money(dailyCents)} ${currency}`;
  const who = companyName ? ` (${companyName})` : "";

  // Item 1 — a series of payments, initiated by FieldQuo.
  // Item 2 — timing and frequency, including the ceiling on both.
  // Item 3 — how the amount is determined.
  // Item 4 — the cancellation policy.
  // Numbered so the check script can assert all four survive an edit.
  const bullets =
    code === "fr"
      ? [
          `Vous autorisez FieldQuo à prélever une série de paiements sur la carte que vous enregistrez à l’étape suivante, sans vous le redemander chaque fois. La carte est celle de votre entreprise${who}.`,
          `Un prélèvement a lieu chaque fois que votre crédit téléphonique descend sous ${threshold}. Il n’y a pas de date fixe : cela dépend de vos appels. Au maximum ${maxPerDay} prélèvements par jour et ${daily} par jour, quoi qu’il arrive.`,
          `Chaque prélèvement est de ${amount} — le montant que vous avez choisi ci-dessus, et rien d’autre. Nous ne calculons rien : c’est ce montant fixe, converti en minutes au tarif affiché sur cette page.`,
          `Si la carte est refusée, la recharge automatique est désactivée immédiatement et nous vous écrivons. Nous ne réessayons pas.`,
          `Vous pouvez désactiver la recharge automatique à tout moment sur cette page. Aucun prélèvement n’a lieu ensuite.`,
          `Chaque prélèvement apparaît dans « Où est passé le crédit », sur cette même page, avec sa date et son montant.`,
        ]
      : [
          `You authorise FieldQuo to take a series of payments from the card you save on the next screen, without asking you again each time. The card is your company's${who}.`,
          `A payment is taken whenever your phone credit falls below ${threshold}. There is no fixed date — it depends on your call volume. At most ${maxPerDay} payments in a day, and at most ${daily} in a day, whatever happens.`,
          `Each payment is ${amount} — the amount you chose above, and nothing else. Nothing is calculated: it is that fixed figure, converted into minutes at the rate shown on this page.`,
          `If the card is declined, automatic top-up switches off straight away and we email you. We do not retry.`,
          `You can switch automatic top-up off at any time on this page. Nothing is taken after that.`,
          `Every payment appears under “Where the credit went” on this page, with its date and amount.`,
        ];

  const title =
    code === "fr"
      ? "Autoriser la recharge automatique du crédit téléphonique"
      : "Authorise automatic phone credit top-ups";

  const intro =
    code === "fr"
      ? "Lisez ce qui suit avant d’accepter. Nous conservons ce texte, la date et l’heure de votre accord."
      : "Read this before you agree. We keep a copy of this wording and the moment you agreed to it.";

  const consentLabel =
    code === "fr"
      ? "J’ai lu ce qui précède et j’autorise ces prélèvements."
      : "I have read the above and I authorise these payments.";

  return {
    language: code,
    title,
    intro,
    bullets,
    consentLabel,
    text: [title, intro, ...bullets, consentLabel].join("\n"),
  };
}
