// lib/sms/followUpText.js
//
// The TEXT a follow-up rule sends, when the rule's channel is "sms".
//
// ── Why this exists ────────────────────────────────────────────────────────
//
// The owner, 2026-11-02: "the part you need to build is the SMS / email
// automations, AND send personalized Follow Ups to leads. and the email and
// sms with link to pre-quote video."
//
// Fourteen leads reached TrueFinish Cabinets through their agency between 23
// October and 2 November; six booked an estimate. The agency's own reading of
// the gap is follow-up, and the first thing their playbook does is text. Up
// to today FieldQuo's follow-up cron could not: lib/followUps/triggers.js
// ended with `FOLLOW_UP_CHANNEL = "email"` and a comment saying to widen it
// only when the cron genuinely gained a channel. This is the channel.
//
// ── The same shape as lib/sms/documentText.js, deliberately ───────────────
//
// Read that file beside this one. Same verdict-then-send split, same
// never-throws contract, same "the switch is re-read FRESH from the row"
// rule, same "the tenant is an argument and never read off the company row"
// rule — that one because the first cut of documentText read `company.id`
// and neither of its callers selected it, so every text would have been
// refused as "no_company" with nothing on screen saying so.
//
// Three things differ, and each one is the reason this is not just a
// parameter on that function:
//
//   1. The switch is a DIFFERENT switch and defaults the other way
//      (Company.followUpSmsOn, off — see followUpTextOn for why).
//   2. There is no email to be "after". A document text rides behind a send
//      the email provider already accepted; a follow-up text IS the send,
//      and the FollowUpLog claim in the cron is what stops it going twice.
//   3. It carries the pre-quote video, which a document text never does.
//
// ── Nothing here is best-effort-and-forget ────────────────────────────────
//
// A document text may fail quietly-ish because the document still went by
// email. This cannot: if the text does not go, the follow-up did not happen.
// So every decline has a reason, the cron counts it, and the cron does NOT
// claim the (rule, entity) row for the declines a person can fix — no phone,
// an opt-out, the switch off. A rule that could not text today must be able
// to text tomorrow when somebody adds the number.

import { db } from "@/lib/db";
import { sendSms, toE164 } from "@/lib/sms/twilioClient";
import { clientSmsFrom } from "@/lib/sms/clientLine";
import { maySms } from "@/lib/sms/optOut";
import { renderMessage } from "@/lib/sms/renderTemplate";
import { loadSmsTemplateTranslations } from "@/lib/i18n/companyText";
import { PHONE_REQUIRED_CODE } from "@/lib/trial/phoneGate";
import { preQuoteVideoFor } from "@/lib/followUps/preQuoteVideo";
// The pure rules — the switch, the type map, the greeting — live apart so the
// settings route and the follow-ups page can read them without pulling the
// database and the Twilio SDK in behind them.
import { FOLLOW_UP_TEXT_TYPE, followUpTextOn, followUpTextType, clientFirstName } from "@/lib/sms/followUpTextRules";

// Re-exported for the cron, which asks "does this trigger have SMS wording?"
// before it loads a single entity and should not have to know that the answer
// lives in a second module. followUpTextType is NOT re-exported: nothing
// outside this file reads it.
export { FOLLOW_UP_TEXT_TYPE };

/**
 * May we text this client a follow-up, and on what number?
 *
 * Reads the switch FRESH from the row rather than trusting the caller's
 * select, exactly as documentTextVerdict and bookingTextVerdict do. The cron
 * loads its company rows through four different finders with four different
 * includes; a column missing from one of them must not read as a decision.
 *
 * The cron calls this BEFORE claiming the FollowUpLog row, so a decline costs
 * nothing and the same lead is tried again tomorrow. sendFollowUpText below
 * then calls it AGAIN, and that is not an oversight: the check that matters
 * is the one the number is actually used behind. A sender that accepted a
 * verdict as an argument could be handed a stale one and text somebody who
 * said stop in between — and the read is one indexed column on one row.
 *
 * @returns {{ send: boolean, reason: string, to: string|null }}
 */
export async function followUpTextVerdict({ companyId, phone }) {
  if (!companyId) return { send: false, reason: "no_company", to: null };
  const row = await db.company.findUnique({
    where: { id: companyId },
    select: { followUpSmsOn: true },
  });
  // A company that isn't there is not a company that said no — kept apart so
  // the reason reported is the reason that happened.
  if (!row) return { send: false, reason: "no_company", to: null };
  if (!followUpTextOn(row)) return { send: false, reason: "switched_off", to: null };
  const to = toE164(phone);
  if (!to) return { send: false, reason: "no_phone", to: null };
  // SmsOptOut AND CallConsent, both — see lib/sms/optOut.js. Every send path
  // in this codebase asks this one function; a follow-up, which chases
  // somebody who has not answered, is the last place to make an exception.
  if (!(await maySms({ companyId, phone: to }))) return { send: false, reason: "opted_out", to };
  return { send: true, reason: "ok", to };
}

/**
 * Text one client their follow-up. Never throws.
 *
 * @param trigger    the rule's triggerEvent — the type is derived from it
 *                   (FOLLOW_UP_TEXT_TYPE), never passed in by the caller, so
 *                   a trigger with no wording cannot be texted on a guess.
 * @param companyId  the tenant, passed EXPLICITLY and never read off the
 *                   company row — see this file's header.
 * @param company    the row the cron already loaded: name, phone,
 *                   smsTemplates, defaultLanguage, smsFromNumber,
 *                   preQuoteVideoUrl.
 * @param client     the client slot the cron builds for every entity type
 *                   (for a lead that is the lead's own name/phone — there is
 *                   no Client row yet). Needs name and phone.
 * @param language   the client's language, from followUpLanguage() — so the
 *                   text is in the language everything else they have had
 *                   from this company was in.
 * @param service    what an enquiry asked about (the lead's category label),
 *                   or null.
 * @param number     the quote number, for a quote chase.
 * @param quoteUrl   the quote's own /q/<token> page — the link the covering
 *                   email's button carries, passed in rather than built here
 *                   so there is one url per document.
 * @param ref        { type, id } for the delivery receipt (model SmsDelivery).
 * @param clientId   the Client row id when there is one; null for a lead.
 *
 * @returns {{ texted: boolean, reason: string, to?: string, simulated?: boolean, error?: string|null }}
 */
export async function sendFollowUpText({
  trigger,
  companyId,
  company,
  client,
  language = "en",
  service = null,
  number = null,
  quoteUrl = null,
  ref = null,
  clientId = null,
}) {
  const type = followUpTextType(trigger);
  // A trigger with no wording is refused here as well as at save time. The
  // route will not store an "sms" rule on invoice_overdue, and if one ever
  // got in by another door it sends nothing and says why, rather than
  // rendering an empty string at a homeowner.
  if (!type) return { texted: false, reason: "no_wording" };
  if (!companyId) return { texted: false, reason: "no_company" };
  // A quote chase with no share token has no page to send anybody to. Absent
  // rather than a text that reads "...approve it online:" and stops.
  if (type === "quote_follow_up" && !quoteUrl) return { texted: false, reason: "no_link" };

  try {
    const verdict = await followUpTextVerdict({ companyId, phone: client?.phone });
    if (!verdict.send) return { texted: false, reason: verdict.reason };

    // The company's pre-quote video, or nothing. Read through
    // preQuoteVideoFor so a half-typed address cannot become a dead link in
    // a homeowner's phone; when there is none the sentence is simply absent
    // (lib/sms/templates.js leadFollowUpText), never "video coming soon".
    const video = type === "lead_follow_up" ? preQuoteVideoFor(company) : null;

    const result = await sendSms({
      to: verdict.to,
      body: renderMessage({
        type,
        templates: company?.smsTemplates,
        language,
        templateLanguage: company?.defaultLanguage || "en",
        // The company's own wording in THIS client's language once its draft
        // lands (lib/i18n/autoTranslate.js) — else the built-in translation.
        // Nothing is translated at send time; the draft was written when the
        // company saved (AGENTS.md non-negotiable 6).
        translatedTemplates: await loadSmsTemplateTranslations(db, company, {
          companyId,
          language,
        }),
        values: {
          company: company?.name,
          name: clientFirstName(client),
          // The company's phone, for the tail that points at a person who
          // will answer: replies to this number are never read
          // (app/api/sms/inbound is not a client inbox). Null drops the
          // clause rather than inventing a channel.
          phone: company?.phone || null,
          ...(service ? { service } : {}),
          ...(video ? { video } : {}),
          ...(number ? { number } : {}),
          ...(quoteUrl ? { link: quoteUrl } : {}),
        },
      }),
      from: clientSmsFrom(company),
      companyId,
      // The purpose is the message type itself, registered in SMS_PURPOSES
      // and labelled on the platform's SMS health page — not a hand-typed
      // string that would fold into "other".
      purpose: type,
      ref,
      clientId,
    });

    if (!result?.success) {
      // The card-free trial's phone gate is not a delivery failure — the
      // company has not verified a mobile yet (lib/trial/phoneGate.js). Its
      // own reason, because "the text didn't go" is true and useless: this
      // one is fixable in a minute. The cron counts it separately so a
      // trialling company's whole follow-up run is not reported as broken.
      if (result?.code === PHONE_REQUIRED_CODE) {
        return { texted: false, reason: "phone_unverified" };
      }
      console.error("[follow-ups] text failed:", result?.error);
      return { texted: false, reason: "failed", error: result?.error || null };
    }
    return {
      texted: true,
      reason: "ok",
      to: verdict.to,
      // A demo tenant's text is recorded exactly like a real one, so this is
      // the only thing that can stop the cron's response claiming a phone
      // buzzed.
      ...(result.simulated === true ? { simulated: true } : {}),
    };
  } catch (err) {
    // Never throws: one unreachable number must not end a run that still has
    // ninety follow-ups to send. Reported, not hidden.
    console.error("[follow-ups] text threw:", err?.message);
    return { texted: false, reason: "failed", error: err?.message || null };
  }
}
