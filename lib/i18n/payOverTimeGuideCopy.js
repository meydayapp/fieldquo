// lib/i18n/payOverTimeGuideCopy.js
//
// Every word of the client's "How to pay over time" guide
// (app/portal/[token]/pay-over-time), and the one line that links to it from
// the portal's pay page and the invoice email — in the eight client
// languages (app/i18n/languages.js).
//
// Written for a client who may be elderly, on a phone, in a driveway: four
// steps, one short sentence each, the button named exactly as the portal
// prints it (clientDocCopy's cardFee.payOverTimeWith — the guide reuses it
// rather than paraphrasing, so step 1 matches the button letter for letter).
//
// ── What it is allowed to claim ───────────────────────────────────────────
//
// Only what Stripe documents for the providers the pay link offers — the
// sources are cited in lib/payments/payOverTimeGuide.js. In short:
//
//   * the provider shows the plans and the client chooses one before
//     agreeing (Klarna: https://docs.stripe.com/payments/klarna — "displays
//     payment options … After the customer selects a payment option";
//     Affirm: https://docs.stripe.com/payments/affirm — "selects a payment
//     plan and accepts the terms of the repayment plan");
//   * the provider decides approval (https://docs.stripe.com/payments/klarna/compliance
//     — "Klarna decides if customers can use Klarna for purchases";
//     https://docs.stripe.com/payments/affirm — "Affirm confirms or denies
//     a loan");
//   * the client repays the provider directly, and the company receives the
//     payment (https://docs.stripe.com/payments/klarna — "you receive the
//     entire order amount (minus fees)", "who repays Klarna directly";
//     https://docs.stripe.com/payments/affirm — "who repays Affirm
//     directly").
//
// Never: an interest rate, "0%", "interest-free", "no credit check", approval
// odds, a monthly figure, or the company's own pay-over-time fee (internal —
// Settings › Payments). scripts/check-pay-over-time-guide.mjs reads every
// string here against that list in every language, and fails on "FieldQuo":
// the guide is the contractor's page.
//
// Provider names are brand names and are never translated. `list` below is
// the providers joined with the language's own "or".

import { clientDocCopy } from "@/lib/i18n/clientDocCopy";
import { companyDisplayName, nameThenStop } from "@/lib/i18n/companyName";

const COPY = {
  en: {
    or: " or ",
    title: "How to pay over time",
    intro: (company, list) => `${company} offers payment over time with ${list}. Here's how it works.`,
    steps: [
      { title: (button) => `Tap “${button}”`, body: () => "You'll find it on your invoice, under the Pay button." },
      { title: (button, list) => `Choose ${list}`, body: (list) => `On the secure payment page, pick ${list} as how you'd like to pay.` },
      { title: () => "See your plan", body: (list) => `${list} shows you the plans it can offer you and decides whether to approve you. You see the plan before you agree to anything.` },
      { title: () => "Agree, and you're done", body: (list, company) => `Once you accept a plan, ${company} is paid, and you repay ${list} directly.` },
    ],
    unavailable: (company) => `Paying over time isn't offered on this account right now. If you have a question, contact ${nameThenStop(company)}`,
    backToInvoice: "Back to your invoice",
    mock: { invoice: "Your invoice", pay: "Pay", paymentPage: "Secure payment page", method: "Payment method", card: "Card" },
    alt: (button, list) => `A drawing of the invoice's “${button}” button, then the payment page with ${list} chosen.`,
    linkPrompt: "Want to pay over time?",
    linkAction: "See how",
  },
  fr: {
    or: " ou ",
    title: "Comment payer en plusieurs versements",
    intro: (company, list) => `${company} vous permet de payer en plusieurs versements avec ${list}. Voici comment faire.`,
    steps: [
      { title: (button) => `Touchez « ${button} »`, body: () => "Le bouton se trouve sur votre facture, sous le bouton Payer." },
      { title: (button, list) => `Choisissez ${list}`, body: (list) => `Sur la page de paiement sécurisée, choisissez ${list} comme mode de paiement.` },
      { title: () => "Consultez votre plan", body: (list) => `${list} vous présente les plans qu'il peut vous offrir et décide de vous approuver ou non. Vous voyez le plan avant d'accepter quoi que ce soit.` },
      { title: () => "Acceptez, et c'est réglé", body: (list, company) => `Dès que vous acceptez un plan, ${company} est payé, et vous remboursez ${list} directement.` },
    ],
    unavailable: (company) => `Le paiement en plusieurs versements n'est pas offert sur ce compte pour le moment. Pour toute question, communiquez avec ${nameThenStop(company)}`,
    backToInvoice: "Retour à votre facture",
    mock: { invoice: "Votre facture", pay: "Payer", paymentPage: "Page de paiement sécurisée", method: "Mode de paiement", card: "Carte" },
    alt: (button, list) => `Illustration du bouton « ${button} » de la facture, puis de la page de paiement avec ${list} choisi.`,
    linkPrompt: "Vous voulez payer en plusieurs versements ?",
    linkAction: "Voyez comment",
  },
  es: {
    or: " o ",
    title: "Cómo pagar a plazos",
    intro: (company, list) => `${company} ofrece pagar a plazos con ${list}. Así funciona.`,
    steps: [
      { title: (button) => `Toque «${button}»`, body: () => "Está en su factura, debajo del botón Pagar." },
      { title: (button, list) => `Elija ${list}`, body: (list) => `En la página de pago segura, elija ${list} como forma de pago.` },
      { title: () => "Vea su plan", body: (list) => `${list} le muestra los planes que puede ofrecerle y decide si lo aprueba. Usted ve el plan antes de aceptar nada.` },
      { title: () => "Acepte y listo", body: (list, company) => `Cuando acepta un plan, ${company} recibe el pago y usted le paga a ${list} directamente.` },
    ],
    unavailable: (company) => `El pago a plazos no está disponible en esta cuenta por ahora. Si tiene preguntas, comuníquese con ${nameThenStop(company)}`,
    backToInvoice: "Volver a su factura",
    mock: { invoice: "Su factura", pay: "Pagar", paymentPage: "Página de pago segura", method: "Forma de pago", card: "Tarjeta" },
    alt: (button, list) => `Dibujo del botón «${button}» de la factura y, después, la página de pago con ${list} elegido.`,
    linkPrompt: "¿Quiere pagar a plazos?",
    linkAction: "Vea cómo",
  },
  uk: {
    or: " або ",
    title: "Як оплатити частинами",
    intro: (company, list) => `${company} пропонує оплату частинами через ${list}. Ось як це працює.`,
    steps: [
      { title: (button) => `Натисніть «${button}»`, body: () => "Ця кнопка є у вашому рахунку, під кнопкою «Оплатити»." },
      { title: (button, list) => `Виберіть ${list}`, body: (list) => `На захищеній сторінці оплати виберіть ${list} як спосіб оплати.` },
      { title: () => "Перегляньте свій план", body: (list) => `${list} показує плани, які може вам запропонувати, і вирішує, чи схвалити вас. Ви бачите план, перш ніж на щось погодитися.` },
      { title: () => "Погодьтеся — і готово", body: (list, company) => `Щойно ви приймаєте план, ${company} отримує оплату, а ви повертаєте кошти ${list} напряму.` },
    ],
    unavailable: (company) => `Зараз оплата частинами тут недоступна. Якщо маєте запитання, зверніться до ${nameThenStop(company)}`,
    backToInvoice: "Назад до рахунку",
    mock: { invoice: "Ваш рахунок", pay: "Оплатити", paymentPage: "Захищена сторінка оплати", method: "Спосіб оплати", card: "Картка" },
    alt: (button, list) => `Малюнок: кнопка «${button}» у рахунку, далі сторінка оплати з вибраним ${list}.`,
    linkPrompt: "Хочете оплатити частинами?",
    linkAction: "Дізнайтеся як",
  },
  pa: {
    or: " ਜਾਂ ",
    title: "ਕਿਸ਼ਤਾਂ ਵਿੱਚ ਭੁਗਤਾਨ ਕਿਵੇਂ ਕਰਨਾ ਹੈ",
    intro: (company, list) => `${company} ${list} ਰਾਹੀਂ ਕਿਸ਼ਤਾਂ ਵਿੱਚ ਭੁਗਤਾਨ ਦੀ ਸਹੂਲਤ ਦਿੰਦੀ ਹੈ। ਇਹ ਇਸ ਤਰ੍ਹਾਂ ਕੰਮ ਕਰਦਾ ਹੈ।`,
    steps: [
      { title: (button) => `“${button}” ਦਬਾਓ`, body: () => "ਇਹ ਤੁਹਾਡੇ ਇਨਵੌਇਸ 'ਤੇ, ਭੁਗਤਾਨ ਵਾਲੇ ਬਟਨ ਦੇ ਹੇਠਾਂ ਹੈ।" },
      { title: (button, list) => `${list} ਚੁਣੋ`, body: (list) => `ਸੁਰੱਖਿਅਤ ਭੁਗਤਾਨ ਪੰਨੇ 'ਤੇ, ਭੁਗਤਾਨ ਦੇ ਤਰੀਕੇ ਵਜੋਂ ${list} ਚੁਣੋ।` },
      { title: () => "ਆਪਣੀ ਯੋਜਨਾ ਦੇਖੋ", body: (list) => `${list} ਤੁਹਾਨੂੰ ਉਹ ਯੋਜਨਾਵਾਂ ਦਿਖਾਉਂਦਾ ਹੈ ਜੋ ਉਹ ਤੁਹਾਨੂੰ ਦੇ ਸਕਦਾ ਹੈ, ਅਤੇ ਫ਼ੈਸਲਾ ਕਰਦਾ ਹੈ ਕਿ ਤੁਹਾਨੂੰ ਮਨਜ਼ੂਰੀ ਦੇਣੀ ਹੈ ਜਾਂ ਨਹੀਂ। ਕਿਸੇ ਵੀ ਗੱਲ ਲਈ ਸਹਿਮਤ ਹੋਣ ਤੋਂ ਪਹਿਲਾਂ ਤੁਸੀਂ ਯੋਜਨਾ ਦੇਖਦੇ ਹੋ।` },
      { title: () => "ਸਹਿਮਤ ਹੋਵੋ, ਬੱਸ ਹੋ ਗਿਆ", body: (list, company) => `ਜਦੋਂ ਤੁਸੀਂ ਕੋਈ ਯੋਜਨਾ ਮਨਜ਼ੂਰ ਕਰ ਲੈਂਦੇ ਹੋ, ${company} ਨੂੰ ਭੁਗਤਾਨ ਮਿਲ ਜਾਂਦਾ ਹੈ, ਅਤੇ ਤੁਸੀਂ ${list} ਨੂੰ ਸਿੱਧਾ ਭੁਗਤਾਨ ਕਰਦੇ ਹੋ।` },
    ],
    unavailable: (company) => `ਇਸ ਵੇਲੇ ਇੱਥੇ ਕਿਸ਼ਤਾਂ ਵਿੱਚ ਭੁਗਤਾਨ ਉਪਲਬਧ ਨਹੀਂ ਹੈ। ਕੋਈ ਸਵਾਲ ਹੋਵੇ ਤਾਂ ${company} ਨਾਲ ਸੰਪਰਕ ਕਰੋ।`,
    backToInvoice: "ਆਪਣੇ ਇਨਵੌਇਸ 'ਤੇ ਵਾਪਸ",
    mock: { invoice: "ਤੁਹਾਡਾ ਇਨਵੌਇਸ", pay: "ਭੁਗਤਾਨ ਕਰੋ", paymentPage: "ਸੁਰੱਖਿਅਤ ਭੁਗਤਾਨ ਪੰਨਾ", method: "ਭੁਗਤਾਨ ਦਾ ਤਰੀਕਾ", card: "ਕਾਰਡ" },
    alt: (button, list) => `ਤਸਵੀਰ: ਇਨਵੌਇਸ ਦਾ “${button}” ਬਟਨ, ਫਿਰ ਭੁਗਤਾਨ ਪੰਨਾ ਜਿਸ 'ਤੇ ${list} ਚੁਣਿਆ ਹੋਇਆ ਹੈ।`,
    linkPrompt: "ਕਿਸ਼ਤਾਂ ਵਿੱਚ ਭੁਗਤਾਨ ਕਰਨਾ ਚਾਹੁੰਦੇ ਹੋ?",
    linkAction: "ਦੇਖੋ ਕਿਵੇਂ",
  },
  tl: {
    or: " o ",
    title: "Paano magbayad nang hulugan",
    intro: (company, list) => `Puwede kayong magbayad nang hulugan sa ${company} gamit ang ${list}. Ganito ito gumagana.`,
    steps: [
      { title: (button) => `I-tap ang “${button}”`, body: () => "Nasa invoice ninyo ito, sa ilalim ng button na Magbayad." },
      { title: (button, list) => `Piliin ang ${list}`, body: (list) => `Sa secure na pahina ng pagbabayad, piliin ang ${list} bilang paraan ng pagbabayad.` },
      { title: () => "Tingnan ang inyong plano", body: (list) => `Ipinapakita ng ${list} ang mga planong maiaalok nito sa inyo, at ito ang nagpapasya kung maaaprubahan kayo. Makikita ninyo ang plano bago kayo pumayag sa anumang bagay.` },
      { title: () => "Pumayag, at tapos na", body: (list, company) => `Kapag tinanggap ninyo ang isang plano, mababayaran ang ${company}, at direkta kayong magbabayad sa ${list}.` },
    ],
    unavailable: (company) => `Hindi available dito ang pagbabayad nang hulugan sa ngayon. Kung may tanong kayo, makipag-ugnayan sa ${nameThenStop(company)}`,
    backToInvoice: "Bumalik sa invoice ninyo",
    mock: { invoice: "Ang inyong invoice", pay: "Magbayad", paymentPage: "Secure na pahina ng pagbabayad", method: "Paraan ng pagbabayad", card: "Card" },
    alt: (button, list) => `Larawan ng button na “${button}” sa invoice, at ng pahina ng pagbabayad na napili ang ${list}.`,
    linkPrompt: "Gusto ba ninyong magbayad nang hulugan?",
    linkAction: "Tingnan kung paano",
  },
  de: {
    or: " oder ",
    title: "So zahlen Sie in Raten",
    intro: (company, list) => `${company} bietet Ratenzahlung mit ${list} an. So funktioniert es.`,
    steps: [
      { title: (button) => `Tippen Sie auf „${button}“`, body: () => "Sie finden die Schaltfläche auf Ihrer Rechnung, unter „Bezahlen“." },
      { title: (button, list) => `Wählen Sie ${list}`, body: (list) => `Wählen Sie auf der sicheren Zahlungsseite ${list} als Zahlungsart.` },
      { title: () => "Ihren Plan ansehen", body: (list) => `${list} zeigt Ihnen die Pläne, die es Ihnen anbieten kann, und entscheidet, ob Sie genehmigt werden. Sie sehen den Plan, bevor Sie irgendetwas zustimmen.` },
      { title: () => "Zustimmen – fertig", body: (list, company) => `Sobald Sie einen Plan annehmen, wird ${company} bezahlt, und Sie zahlen direkt an ${list} zurück.` },
    ],
    unavailable: (company) => `Ratenzahlung ist hier derzeit nicht verfügbar. Bei Fragen wenden Sie sich an ${nameThenStop(company)}`,
    backToInvoice: "Zurück zu Ihrer Rechnung",
    mock: { invoice: "Ihre Rechnung", pay: "Bezahlen", paymentPage: "Sichere Zahlungsseite", method: "Zahlungsart", card: "Karte" },
    alt: (button, list) => `Zeichnung: die Schaltfläche „${button}“ auf der Rechnung, dann die Zahlungsseite mit ${list} ausgewählt.`,
    linkPrompt: "Möchten Sie in Raten zahlen?",
    linkAction: "So geht's",
  },
  it: {
    or: " o ",
    title: "Come pagare a rate",
    intro: (company, list) => `${company} offre il pagamento a rate con ${list}. Ecco come funziona.`,
    steps: [
      { title: (button) => `Tocca «${button}»`, body: () => "Lo trovi nella tua fattura, sotto il pulsante Paga." },
      { title: (button, list) => `Scegli ${list}`, body: (list) => `Nella pagina di pagamento sicura, scegli ${list} come metodo di pagamento.` },
      { title: () => "Guarda il tuo piano", body: (list) => `${list} ti mostra i piani che può offrirti e decide se approvarti. Vedi il piano prima di accettare qualsiasi cosa.` },
      { title: () => "Accetta, ed è fatta", body: (list, company) => `Quando accetti un piano, ${company} riceve il pagamento e tu rimborsi ${list} direttamente.` },
    ],
    unavailable: (company) => `Il pagamento a rate qui non è disponibile al momento. Per domande, contatta ${nameThenStop(company)}`,
    backToInvoice: "Torna alla tua fattura",
    mock: { invoice: "La tua fattura", pay: "Paga", paymentPage: "Pagina di pagamento sicura", method: "Metodo di pagamento", card: "Carta" },
    alt: (button, list) => `Disegno del pulsante «${button}» della fattura, poi della pagina di pagamento con ${list} selezionato.`,
    linkPrompt: "Vuoi pagare a rate?",
    linkAction: "Ecco come",
  },
};

/** The languages the guide is written in — the eight client languages. */
export const PAY_OVER_TIME_GUIDE_LANGUAGES = Object.freeze(Object.keys(COPY));

/** The raw table, for scripts/check-pay-over-time-guide.mjs. */
export const PAY_OVER_TIME_GUIDE_COPY = COPY;

/**
 * The guide's sentences for one language, with the providers and the
 * company's name already filled in. Unknown languages fall back to English.
 *
 * @param language   the client's language
 * @param names      provider brand names, e.g. ["Klarna"]
 * @param company    the company's display name
 */
export function payOverTimeGuideCopy(language, { names = [], company: rawCompany = "" } = {}) {
  // Trimmed once here: a stored "TrueFinish Cabinets Inc. " printed "contact
  // TrueFinish Cabinets Inc. ." (2026-10-10). The stored name is left as typed.
  const company = companyDisplayName(rawCompany);
  const code = Object.prototype.hasOwnProperty.call(COPY, language) ? language : "en";
  const c = COPY[code];
  const list = names.join(c.or);
  // The real button's label, from the catalogue the portal prints it with.
  const button = clientDocCopy(code).cardFee.payOverTimeWith(names);
  return {
    language: code,
    title: c.title,
    intro: c.intro(company, list),
    button,
    steps: c.steps.map((s) => ({ title: s.title(button, list), body: s.body(list, company) })),
    unavailable: c.unavailable(company),
    backToInvoice: c.backToInvoice,
    backToAccount: clientDocCopy(code).backToAccount,
    mock: c.mock,
    alt: c.alt(button, list),
    linkPrompt: c.linkPrompt,
    linkAction: c.linkAction,
  };
}

/** Just the link line, for the portal pay page and the invoice email. */
export function payOverTimeGuideLink(language) {
  const code = Object.prototype.hasOwnProperty.call(COPY, language) ? language : "en";
  return { prompt: COPY[code].linkPrompt, action: COPY[code].linkAction };
}
