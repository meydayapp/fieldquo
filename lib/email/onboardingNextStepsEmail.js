// lib/email/onboardingNextStepsEmail.js
//
// FieldQuo → a new company that, two hours after signing up, still has steps
// open on its onboarding checklist. "Finish setting up" — never "you didn't
// finish signing up": they did, and they are on their free month.
//
// What it prints, top to bottom: the trade in the subject line; for a
// card-free trial, one line saying when the free month ends; a numbered
// block of ONLY the steps still open, in the checklist's own order, each with
// one line on what it unlocks and a button that opens that step's window on
// the home page (/app?step=<key> — see nextStepHref); a tick list of what is
// already done; the ADDITIONAL set-up steps still on their home page
// (lib/setupSteps.js — the ones not done, not hidden, and applicable), each a
// link to its own page; and a one-line footer that says why this arrived and
// that it arrives once. The shape is a lead-generation site's "next steps
// 1-2-3" letter the owner had just received as a contractor; the words are
// ours.
//
// ══ Where the sentences come from ═════════════════════════════════════════
//
// The per-trade line under "Set your pricing" and "Connect Stripe" is the
// trade's own selling point from lib/sales/tradeSellingPoints.js — the ONE
// table the reps' intro email, the five-minute signup nudge and the playbooks
// read, so a painter is told the same thing about room-by-room quotes here as
// on a sales call. Where the trade's list carries no matching point, the
// generic POINTS entry is used, never a sentence typed here. The additional
// set-up steps borrow from the same table where a point is plainly the thing
// the step switches on (SETUP_STEP_POINTS below); the rest print their title
// and link alone rather than a sentence invented for them. The three lines
// that are about the product rather than a feature (logo, address, services)
// are catalogue keys (app.nextSteps.unlock.*); the tax line is the country's
// own `whyKey`, which the checklist card already prints.
//
// ══ Eight languages, and where the trade lines stop ═══════════════════════
//
// The letter's own sentences are in all eight document languages. The trade
// table is in en / fr / es only (TRADE_PITCH_LANGUAGES). In the other five,
// printing a painter's English sentence inside a German letter is worse than
// not printing it, so there: the subject is the one without a trade, the
// pricing and Stripe rows use the catalogue's plain sentence
// (app.nextSteps.unlock.pricing / .payments), the additional steps print no
// unlock line, and the social-proof sentence — which names the trade — is
// not printed.
//
// ══ Transactional, and deliberately no unsubscribe ════════════════════════
//
// lib/marketing/unsubscribe.js's split: a notice to a CONTRACTOR about their
// own FieldQuo account is B2B account admin, the same class as the "you're
// subscribed" confirmation and the grace warnings — a message that helps
// complete a setup the recipient asked for and paid for, sent once. CASL's
// transaction-facilitation carve-out is built for exactly this, and a stray
// "unsubscribe" on a message like it invites someone to switch off mail they
// need. scripts/check-consent-mechanisms.mjs is where that split is asserted
// for the builders it lists; this one carries no opt-out link on purpose and
// no mailing address, and the check for this file asserts both absences.
//
// There is no "rather one email a week?" control either: no weekly digest
// exists to switch to, and a footer link that promises one would be a dead
// control (AGENTS.md, the rule that matters most).
//
// ══ Social proof only from a real sample ══════════════════════════════════
//
// `proof` is { companies, medianMinutes } from firstQuoteProof(), which
// returns null under NEXT_STEPS_PROOF_MIN_COMPANIES real rows. Null prints
// nothing — not a placeholder sentence, not a rounded guess.

import { escapeHtml, escapeAttr } from "@/lib/email/emailTheme";
import { APP_MESSAGES } from "@/app/i18n/appMessages";
import { POINTS, TRADE_PITCH_LANGUAGES, tradeSellingPoints } from "@/lib/sales/tradeSellingPoints";
import { introTradePhrase } from "@/lib/sales/outreach/introEmail";
import { formatCalendarDay } from "@/lib/format/localeDate";
import {
  NEXT_STEPS_MAX,
  NEXT_STEPS_MORE_MAX,
  nextStepHref,
  nextStepsLanguage,
  setupStepHref,
} from "@/lib/signup/nextSteps";

/**
 * The selling point that says what an additional set-up step switches on,
 * where one plainly does. A step not named here prints no unlock line — a
 * sentence written for this letter alone would be the copy that rots.
 */
const SETUP_STEP_POINTS = Object.freeze({
  team: ["scheduling"],
  overhead: ["job_costing"],
  google_reviews: ["review_requests"],
  instant_quotes: ["instant_quotes", "self_quote"],
  availability: ["booking_page"],
  materials: ["material_costs"],
  add_ons: ["add_on_upsell"],
});

// The billing family's palette — measured there (#595f6b is 6.41:1 on the
// card and 5.88:1 on the page), reused rather than re-chosen.
const INK = "#111827";
const MUTED = "#4b5563";
const FAINT = "#595f6b";
const CARD = "#ffffff";
const PAGE = "#f5f5f5";
const RULE = "#e5e7eb";
const TICK = "#15803d"; // 5.02:1 on white

function textFor(language) {
  const dict = APP_MESSAGES[language] || {};
  return (key, fallback) => dict[key] ?? APP_MESSAGES.en[key] ?? fallback ?? key;
}

function fill(template, values) {
  return String(template ?? "").replace(/\{(\w+)\}/g, (m, k) =>
    values[k] !== undefined && values[k] !== null ? String(values[k]) : m,
  );
}

/** The point with this key from the trade's own list (its proof may be trade-specific), else the generic POINTS entry. */
function pointFor(tradeKey, lang, keys) {
  const own = tradeSellingPoints(tradeKey, lang).points;
  for (const key of keys) {
    const hit = own.find((p) => p.key === key);
    if (hit) return { sentence: hit.proof, key, tradeSpecific: true };
  }
  for (const key of keys) {
    const base = POINTS[key];
    if (base) return { sentence: base.oneLiner[lang], key, tradeSpecific: false };
  }
  return null;
}

/** "4 h 40 min" / "35 min" — the median, in the reader's language's shortest form. */
function whenPhrase(minutes, lang) {
  const m = Math.max(0, Math.round(Number(minutes) || 0));
  const h = Math.floor(m / 60);
  const rest = m % 60;
  if (h === 0) return `${m} min`;
  // "h" reads in all three languages; "min" too.
  return rest ? `${h} h ${rest} min` : `${h} h`;
}

/**
 * @param companyName   the company's name — required, it is in the subject
 * @param firstName     the owner's first name, or null
 * @param language      the company's default language; the eight document
 *                      languages render natively, anything else is English
 * @param tradeKey      a DISCOVERY_TRADES key, or null
 * @param steps         getOnboardingStatus().steps — every step, done or not,
 *                      in the checklist's order; the letter lists the open
 *                      ones and ticks the rest
 * @param setupSteps    the additional set-up steps STILL ON THE CARD —
 *                      remainingSteps(stepsFor(snapshot)) from
 *                      lib/setupSteps.js, in the card's order. Each
 *                      { key, titleKey, title, href }. Empty prints nothing.
 * @param trialEndsAt   the card-free trial's end (nextStepsTrialEndsAt), or
 *                      null — null prints no trial line, never a guessed date
 * @param origin        absolute origin the links are built on
 * @param proof         { companies, medianMinutes } | null — see the header
 * @returns { subject, html, text, language, fallback, open: [key], done: [key],
 *            more: [key], moreHidden, tradeSpecific: [key], links, moreLinks, trialLine }
 * @throws when every step is done — there is no letter to write, and the
 *         cron must have decided that before building
 */
export function buildOnboardingNextStepsEmail({
  companyName,
  firstName = null,
  language = "en",
  tradeKey = null,
  steps = [],
  setupSteps = [],
  trialEndsAt = null,
  origin,
  proof = null,
} = {}) {
  const company = String(companyName ?? "").trim();
  if (!company) throw new Error("buildOnboardingNextStepsEmail: the company's name is in the subject line and cannot be empty.");
  if (!origin || !/^https?:\/\//.test(String(origin))) throw new Error("buildOnboardingNextStepsEmail: needs an absolute origin for the links.");
  const all = (Array.isArray(steps) ? steps : []).filter((s) => s && typeof s.key === "string");
  const openSteps = all.filter((s) => !s.done).slice(0, NEXT_STEPS_MAX);
  const doneSteps = all.filter((s) => s.done);
  if (!openSteps.length) throw new Error("buildOnboardingNextStepsEmail: every step is done — there is no next-steps letter to send.");
  // Only rows that are still on the card. The caller passes remainingSteps(),
  // but a row marked done / dismissed / not-applying is refused here too — a
  // letter listing a step the card has already taken away sends the reader
  // looking for something that is not there.
  const moreAll = (Array.isArray(setupSteps) ? setupSteps : []).filter(
    (s) => s && typeof s.key === "string" && !s.done && !s.dismissed && s.applies !== false,
  );
  const moreSteps = moreAll.slice(0, NEXT_STEPS_MORE_MAX);
  const moreHidden = moreAll.length - moreSteps.length;

  const lang = nextStepsLanguage(language);
  const fallback = lang !== String(language || "").toLowerCase().split(/[-_]/)[0];
  const t = textFor(lang);
  const first = String(firstName ?? "").trim();
  // The trade table's languages — see the header. Outside them no trade
  // sentence is printed at all, rather than an English one.
  const pitch = TRADE_PITCH_LANGUAGES.includes(lang);
  const known = pitch && typeof tradeKey === "string" && tradeSellingPoints(tradeKey, lang).points.length > 0;
  const tradePhrase = known ? introTradePhrase(tradeKey, lang) : null;

  // The row's words. Tax registration names the registration the company's
  // country does, the way the checklist card does; the others read the
  // catalogue key the checklist row carries.
  const labelOf = (step) => {
    if (step.key === "tax_registration") {
      return fill(t("app.onboarding.taxRegLabel", "Add your {name}"), { name: t(step.nameKey, "tax registration number") });
    }
    return t(step.labelKey || `app.onboarding.step.${step.key}`, step.label || step.key);
  };

  // One line on what the step unlocks — the trade's own sentence where the
  // one table has one, the catalogue's product sentence otherwise.
  const tradeSpecific = [];
  const unlockOf = (step) => {
    switch (step.key) {
      case "logo":
        return fill(t("app.nextSteps.unlock.logo"), { company });
      case "business_info":
        return t("app.nextSteps.unlock.business_info");
      case "services":
        return t("app.nextSteps.unlock.services");
      case "pricing": {
        if (!pitch) return t("app.nextSteps.unlock.pricing");
        const p = pointFor(known ? tradeKey : null, lang, ["quotes", "price_book", "instant_quotes"]);
        if (p?.tradeSpecific) tradeSpecific.push(step.key);
        return p?.sentence || "";
      }
      case "payments": {
        if (!pitch) return t("app.nextSteps.unlock.payments");
        const p = pointFor(known ? tradeKey : null, lang, ["card_payments"]);
        if (p?.tradeSpecific) tradeSpecific.push(step.key);
        return p?.sentence || "";
      }
      case "tax_registration":
        return step.whyKey ? t(step.whyKey, "") : "";
      default:
        return "";
    }
  };

  const subject = known
    ? fill(t("app.nextSteps.subject"), { company, trade: tradePhrase })
    : fill(t("app.nextSteps.subjectNoTrade"), { company });
  const heading = t("app.nextSteps.heading");
  const greeting = first ? fill(t("app.nextSteps.greetingNamed"), { name: first }) : t("app.nextSteps.greeting");
  const intro =
    openSteps.length === 1
      ? fill(t("app.nextSteps.introOne"), { company })
      : fill(t("app.nextSteps.introMany"), { company, count: openSteps.length });
  const proofLine =
    proof && known && Number.isFinite(Number(proof.companies)) && Number(proof.companies) > 0 && Number.isFinite(Number(proof.medianMinutes))
      ? fill(t("app.nextSteps.proof"), { count: proof.companies, trade: tradePhrase, when: whenPhrase(proof.medianMinutes, lang) })
      : null;
  const footer = fill(t("app.nextSteps.footer"), { company });
  const homeUrl = `${String(origin).replace(/\/+$/, "")}/app`;
  // Quebec French puts a space before a colon; the other two do not.
  const colon = lang === "fr" ? " :" : ":";

  const rows = openSteps.map((step, i) => {
    const label = labelOf(step);
    const unlock = unlockOf(step);
    const href = nextStepHref(step, origin);
    const stripe = step.key === "payments" ? t("app.nextSteps.opensStripe") : null;
    return { n: i + 1, key: step.key, label, unlock, href, stripe };
  });

  // The additional steps: title, link, and the trade's own line where the
  // one table has a point for it — in the trade table's languages only.
  const moreRows = moreSteps.map((step) => {
    const label = t(step.titleKey || `app.setup.step.${step.key}`, step.title || step.key);
    let unlock = "";
    const keys = SETUP_STEP_POINTS[step.key];
    if (pitch && keys) {
      const p = pointFor(known ? tradeKey : null, lang, keys);
      if (p?.tradeSpecific) tradeSpecific.push(`setup:${step.key}`);
      unlock = p?.sentence || "";
    }
    return { key: step.key, label, unlock, href: setupStepHref(step, origin) };
  });
  const moreRemaining = moreHidden > 0 ? fill(t("app.nextSteps.moreRemaining"), { count: moreHidden }) : null;

  // One honest line on the trial, and only when there is a date to print.
  const trialDate = trialEndsAt ? formatCalendarDay(trialEndsAt, lang) : "";
  const trialLine = trialDate ? fill(t("app.nextSteps.trialLine"), { date: trialDate }) : null;

  const rowHtml = rows
    .map(
      (r) => `
        <tr>
          <td valign="top" style="width:36px;padding:14px 0 0 0;">
            <div style="width:28px;height:28px;border-radius:14px;background:${INK};color:#ffffff;font-weight:700;font-size:14px;line-height:28px;text-align:center;">${r.n}</div>
          </td>
          <td valign="top" style="padding:14px 0 14px 8px;border-bottom:1px solid ${RULE};">
            <div style="font-size:16px;font-weight:700;color:${INK};line-height:1.4;">${escapeHtml(r.label)}</div>
            ${r.unlock ? `<div style="font-size:14px;line-height:1.6;color:${MUTED};margin-top:4px;">${escapeHtml(r.unlock)}</div>` : ""}
            ${r.stripe ? `<div style="font-size:13px;line-height:1.6;color:${MUTED};margin-top:4px;">${escapeHtml(r.stripe)}</div>` : ""}
            <div style="margin-top:10px;">
              <a href="${escapeAttr(r.href)}" style="display:inline-block;padding:10px 18px;background:${INK};color:#ffffff !important;text-decoration:none;border-radius:8px;font-weight:700;font-size:14px;">${escapeHtml(t("app.nextSteps.openStep"))}</a>
            </div>
          </td>
        </tr>`,
    )
    .join("");

  const doneHtml = doneSteps.length
    ? `<p style="font-size:13px;font-weight:700;letter-spacing:0.04em;text-transform:uppercase;color:${MUTED};margin:28px 0 8px 0;">${escapeHtml(t("app.nextSteps.doneIntro"))}</p>
       <ul style="list-style:none;margin:0;padding:0;font-size:14px;line-height:1.7;color:${MUTED};">
         ${doneSteps.map((s) => `<li><span style="color:${TICK};font-weight:700;">&#10003;</span>&nbsp; ${escapeHtml(labelOf(s))}</li>`).join("")}
       </ul>`
    : "";

  const moreHtml = moreRows.length
    ? `<p style="font-size:13px;font-weight:700;letter-spacing:0.04em;text-transform:uppercase;color:${MUTED};margin:28px 0 4px 0;">${escapeHtml(t("app.setup.title"))}</p>
       <ul style="list-style:none;margin:0;padding:0;">
         ${moreRows
           .map(
             (r) => `<li style="padding:10px 0;border-bottom:1px solid ${RULE};">
           <a href="${escapeAttr(r.href)}" style="font-size:15px;font-weight:700;color:${INK} !important;text-decoration:underline;">${escapeHtml(r.label)}</a>
           ${r.unlock ? `<div style="font-size:14px;line-height:1.6;color:${MUTED};margin-top:2px;">${escapeHtml(r.unlock)}</div>` : ""}
         </li>`,
           )
           .join("")}
       </ul>
       ${moreRemaining ? `<p style="font-size:14px;line-height:1.6;color:${MUTED};margin:10px 0 0 0;">${escapeHtml(moreRemaining)}</p>` : ""}`
    : "";

  const html = `<!DOCTYPE html>
<html lang="${lang}">
  <head><meta charset="utf-8" /><meta name="viewport" content="width=device-width,initial-scale=1" /></head>
  <body style="margin:0;padding:0;background:${PAGE};font-family:Arial,Helvetica,sans-serif;color:${INK};">
    <div style="max-width:560px;margin:0 auto;">
      <div style="background:${INK};color:#ffffff;padding:32px 30px;text-align:center;">
        <h1 style="margin:0;font-size:22px;font-weight:700;">${escapeHtml(heading)}</h1>
      </div>
      <div style="background:${CARD};padding:32px 30px;">
        <p style="font-size:15px;line-height:1.7;margin:0 0 12px 0;color:${INK};">${escapeHtml(greeting)}</p>
        <p style="font-size:15px;line-height:1.7;margin:0 0 ${trialLine ? "12px" : "20px"} 0;color:${INK};">${escapeHtml(intro)}</p>
        ${trialLine ? `<p style="font-size:15px;line-height:1.7;margin:0 0 20px 0;color:${INK};font-weight:700;">${escapeHtml(trialLine)}</p>` : ""}
        <p style="font-size:13px;font-weight:700;letter-spacing:0.04em;text-transform:uppercase;color:${MUTED};margin:0 0 4px 0;">${escapeHtml(t("app.nextSteps.stepsIntro"))}</p>
        <table role="presentation" width="100%" style="border-collapse:collapse;">${rowHtml}</table>
        ${doneHtml}
        ${moreHtml}
        ${proofLine ? `<p style="font-size:14px;line-height:1.7;color:${MUTED};margin:24px 0 0 0;">${escapeHtml(proofLine)}</p>` : ""}
        <div style="text-align:center;margin:28px 0 0 0;">
          <a href="${escapeAttr(homeUrl)}" style="display:inline-block;padding:12px 26px;border:2px solid ${INK};color:${INK} !important;text-decoration:none;border-radius:8px;font-weight:700;font-size:14px;">${escapeHtml(t("app.nextSteps.homeCta"))}</a>
        </div>
      </div>
      <div style="text-align:center;padding:20px;color:${FAINT};font-size:12px;line-height:1.6;">${escapeHtml(footer)}</div>
    </div>
  </body>
</html>`;

  const text = [
    heading,
    "",
    greeting,
    intro,
    ...(trialLine ? [trialLine] : []),
    "",
    `${t("app.nextSteps.stepsIntro")}${colon}`,
    ...rows.flatMap((r) => [
      `${r.n}. ${r.label}`,
      ...(r.unlock ? [`   ${r.unlock}`] : []),
      ...(r.stripe ? [`   ${r.stripe}`] : []),
      `   ${t("app.nextSteps.openStep")}${colon} ${r.href}`,
    ]),
    ...(doneSteps.length ? ["", `${t("app.nextSteps.doneIntro")}${colon}`, ...doneSteps.map((s) => `✓ ${labelOf(s)}`)] : []),
    ...(moreRows.length
      ? [
          "",
          `${t("app.setup.title")}${colon}`,
          ...moreRows.flatMap((r) => [`- ${r.label}: ${r.href}`, ...(r.unlock ? [`  ${r.unlock}`] : [])]),
          ...(moreRemaining ? [moreRemaining] : []),
        ]
      : []),
    ...(proofLine ? ["", proofLine] : []),
    "",
    `${t("app.nextSteps.homeCta")}${colon} ${homeUrl}`,
    "",
    "—",
    footer,
  ].join("\n");

  return {
    subject,
    html,
    text,
    language: lang,
    fallback,
    open: rows.map((r) => r.key),
    done: doneSteps.map((s) => s.key),
    more: moreRows.map((r) => r.key),
    moreHidden,
    tradeSpecific,
    links: rows.map((r) => r.href),
    moreLinks: moreRows.map((r) => r.href),
    trialLine,
  };
}

/** The colour pairs this email asserts. */
export const ONBOARDING_NEXT_STEPS_PAIRS = [
  { name: "body ink on card", fg: INK, bg: CARD },
  { name: "muted unlock line on card", fg: MUTED, bg: CARD },
  { name: "footer on page", fg: FAINT, bg: PAGE },
  { name: "heading on header bar", fg: "#ffffff", bg: INK },
  { name: "tick on card", fg: TICK, bg: CARD },
];
