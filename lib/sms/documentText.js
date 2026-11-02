// lib/sms/documentText.js
//
// The TEXT that carries a quote's or an invoice's link, beside the email that
// carries the document.
//
// ── Why this exists ────────────────────────────────────────────────────────
//
// The owner, 2026-11-02, on app/quotes/<id>: "send right now it sends only an
// email but it should also send the quote link via text... something short,
// like Hi __, here is your free quote from ... you can open it via the link
// ... review and approve online... in the languages from the client like the
// emails... the invoice should be the same."
//
// A homeowner in a driveway reads a text. The quote email, with its PDF and
// its scope breakdown, is the document; this is the nudge that gets it opened,
// and it points at the SAME url the email's own button does — /q/<token> for
// a quote, the portal's invoice deep link (stage query and all) for an
// invoice. Not a second, shorter link: two links to one document is two
// things to keep working, and the second is the one that rots.
//
// ── After the email, never before ──────────────────────────────────────────
//
// Both routes call this only once the email provider has ACCEPTED the
// message. A text saying "your quote is ready" sent beside a failed email is
// the lie this codebase keeps pulling out: the client taps a link to a quote
// the company believes it never sent, and the status on screen says draft.
//
// So this is best-effort in one direction only. A failed TEXT never fails the
// send — the document went by email, which is the delivery — but it is
// REPORTED, in the route's response and in the screen's own sentence. The
// quiet half-send ("Sent to ana@…" over a text that never left) is the thing
// AGENTS.md names first.
//
// ── One switch for both documents ──────────────────────────────────────────
//
// Company.documentSmsOn, read through documentTextOn() below. The quote
// carries the toggle on Settings › Messages and the invoice follows it, the
// same arrangement the three booking texts have (lib/booking/bookingText.js):
// a company that decided it does not pay for client texts is asked once, and
// cannot end up with one of the pair silently on.

import { db } from "@/lib/db";
import { sendSms, toE164 } from "@/lib/sms/twilioClient";
import { clientSmsFrom } from "@/lib/sms/clientLine";
import { maySms } from "@/lib/sms/optOut";
import { renderMessage } from "@/lib/sms/renderTemplate";
import { loadSmsTemplateTranslations } from "@/lib/i18n/companyText";
import { documentFormatters } from "@/lib/i18n/documentLabels";
import { PHONE_REQUIRED_CODE } from "@/lib/trial/phoneGate";
// The pure rules — the switch, the greeting and the type map — live apart so
// the settings route and the two client pages can read them without pulling
// the database and the Twilio SDK in behind them.
import { DOCUMENT_TEXT_TYPE, documentTextOn, clientFirstName } from "@/lib/sms/documentTextRules";

/**
 * May we text this client about this document, and on what number?
 *
 * Reads the switch FRESH from the row rather than trusting the caller's
 * select, exactly as bookingTextVerdict does: the two send routes load their
 * company row with different selects for their own reasons, and a column
 * missing from one of them must not read as a decision.
 *
 * @returns {{ send: boolean, reason: string, to: string|null }}
 */
export async function documentTextVerdict({ companyId, phone }) {
  if (!companyId) return { send: false, reason: "no_company", to: null };
  const row = await db.company.findUnique({
    where: { id: companyId },
    select: { documentSmsOn: true },
  });
  // A company that isn't there is not a company that said no. Kept apart so
  // the reason the screen reports is the reason that happened — "switched_off"
  // for a missing row would send somebody to a settings page to un-tick
  // something nobody ticked.
  if (!row) return { send: false, reason: "no_company", to: null };
  if (!documentTextOn(row)) return { send: false, reason: "switched_off", to: null };
  // Deliberately the CLIENT's own number, not a contact's. The recipient
  // picker on the send dialog chooses which people are emailed from the
  // addresses on their contact rows (lib/clients/recipients.js); contacts
  // carry no phone that a send has ever been allowed to use, and inventing
  // "text whoever was emailed" would text a number nobody checked.
  const to = toE164(phone);
  if (!to) return { send: false, reason: "no_phone", to: null };
  if (!(await maySms({ companyId, phone: to }))) return { send: false, reason: "opted_out", to };
  return { send: true, reason: "ok", to };
}

/**
 * Text the client the document's link. Never throws.
 *
 * @param kind      "quote" | "invoice"
 * @param companyId  the tenant, passed EXPLICITLY and never read off the
 *                  company row.
 *
 *                  Not fussiness. Both send routes build their company row
 *                  with a `select` for the email they are composing, and
 *                  neither of them selects `id` — so the first version of
 *                  this, which read `company.id`, refused every text as
 *                  "no_company" while reporting nothing wrong. Caught before
 *                  it shipped, by looking at the select rather than at the
 *                  code. The tenant is the one value that must never depend
 *                  on a caller remembering a field.
 * @param company   the row the route already loaded — needs name,
 *                  smsTemplates, defaultLanguage, smsFromNumber, currency
 * @param client    the Client row (name, phone)
 * @param url       the url the covering EMAIL's button carries
 * @param number    the quote or invoice number, for the {number} token
 * @param amount    what an invoice asks for, as a number, for {amount} —
 *                  null for a quote, which asks for nothing yet
 * @param language  the document's language, from resolveClientLanguage — so
 *                  the text and the letter it accompanies are in one language
 * @param ref       { type, id } for the delivery receipt (model SmsDelivery)
 *
 * @returns {{ texted: boolean, reason: string, to?: string, simulated?: boolean }}
 */
export async function sendDocumentLinkText({
  kind,
  companyId,
  company,
  client,
  url,
  number = null,
  amount = null,
  language = "en",
  ref = null,
}) {
  const type = DOCUMENT_TEXT_TYPE[kind];
  if (!type) return { texted: false, reason: "bad_request" };
  if (!companyId) return { texted: false, reason: "no_company" };
  if (!url) return { texted: false, reason: "no_link" };

  try {
    const verdict = await documentTextVerdict({ companyId, phone: client?.phone });
    if (!verdict.send) return { texted: false, reason: verdict.reason };

    // The figure the EMAIL asked for, formatted in the document's own
    // language and currency — so a company that puts {amount} in its wording
    // cannot have its text name a number the letter did not. Absent for a
    // quote: nothing has been asked for yet.
    const money = amount == null ? null : documentFormatters(language, company?.currency).money(amount);

    const result = await sendSms({
      to: verdict.to,
      body: renderMessage({
        type,
        templates: company?.smsTemplates,
        language,
        templateLanguage: company?.defaultLanguage || "en",
        // The company's own wording in THIS client's language once its draft
        // lands (lib/i18n/autoTranslate.js) — else the built-in translation.
        translatedTemplates: await loadSmsTemplateTranslations(db, company, {
          companyId,
          language,
        }),
        values: {
          company: company?.name,
          name: clientFirstName(client),
          number: number || null,
          ...(money ? { amount: money } : {}),
          link: url,
        },
      }),
      from: clientSmsFrom(company),
      companyId,
      purpose: type,
      ref,
      clientId: client?.id || null,
    });

    if (!result?.success) {
      // ── The card-free trial's phone gate is not a failure ───────────────
      //
      // sendSms refuses a tenant text until a trialling company has verified
      // a mobile (lib/trial/phoneGate.js, owner-approved 2026-10-03), and
      // most companies sending their first quote ARE on a trial. Reporting
      // that as "the text didn't go" would alarm somebody about something
      // they can fix in a minute, and tell them nothing about how — so it
      // keeps its own reason, and its own sentence names the screen that
      // fixes it (app.docText.phoneUnverified). The path is NOT returned:
      // nothing on either page would read it, and a field nobody reads is
      // the first failure class AGENTS.md lists.
      if (result?.code === PHONE_REQUIRED_CODE) {
        return { texted: false, reason: "phone_unverified" };
      }
      // Everything else, said out loud rather than swallowed. The caller puts
      // it in its response and the screen says "the text didn't go" beside
      // "emailed".
      console.error(`[${kind} send] text failed:`, result?.error);
      return { texted: false, reason: "failed", error: result?.error || null };
    }
    return {
      texted: true,
      reason: "ok",
      to: verdict.to,
      // A demo tenant's text is recorded exactly like a real one, so this is
      // the only thing that can stop a screen claiming a phone buzzed.
      ...(result.simulated === true ? { simulated: true } : {}),
    };
  } catch (err) {
    // A text is never a reason the document failed to go out — the email
    // already carried it. Still reported rather than hidden.
    console.error(`[${kind} send] text threw:`, err?.message);
    return { texted: false, reason: "failed", error: err?.message || null };
  }
}
