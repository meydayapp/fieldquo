// lib/sales/outreach/introSend.js
//
// The database half of the intro email: what the pop-up may offer, and the
// one send.
//
// ══ The offer is computed here, and refused here, with the reason ════════
//
// The pop-up opens after a no-answer or a voicemail and asks "Send
// {business} the intro email?" with the address it would go to. Every reason
// it might not — no address on the record, the address on FieldQuo's
// do-not-contact list, the rep's mailbox not connected, an intro already
// sent to that address inside fourteen days — is decided by introEmailOffer()
// from fresh rows, and stated as a `refusal` the dialog prints instead of a
// Send button. The send route calls the SAME function again in the request
// that sends, because a verdict computed for a screen is a verdict about a
// moment that has passed (lib/migrations/state.js's rule).
//
// ══ Where the address comes from ═════════════════════════════════════════
//
// The lead's own column, the linked prospect's crawled address, and any
// SalesContactEmail rows — lib/sales/emailRecipients.js's closed set, so an
// address the pop-up offers is one the composer would accept too. A typed
// address is saved onto the lead FIRST (lib/sales/contact/record.js
// recordContactEmail, which refuses a do-not-contact business and a test
// account) and only then sent to. Nothing here sends to a bare string.
//
// ══ A prospect with no lead yet ══════════════════════════════════════════
//
// The queue's console works a Prospect; the email needs a SalesLead (the
// thread, the request stamps and the Today counters hang off one). The same
// answer "Text them" gives (lib/sales/messages/startThread.js): the rep's
// existing lead for that prospect, else one created from it, carrying the
// prospect's name, address and location. Created only on SEND, never on
// offer — a pop-up dismissed with "Not now" must leave nothing behind.

import { randomUUID } from "node:crypto";
import { db } from "@/lib/db";
import { getAppOrigin } from "@/lib/appUrl";
import { recordError } from "@/lib/platform/errorLog";
import { mailingAddress } from "@/lib/legal/mailingAddress";
import { bareAddress, isPlausibleEmail } from "@/lib/sales/outreach";
import { deliverOutreach, outreachStatus } from "@/lib/sales/outreachSender";
import { checkSuppression, sourceProviderForContact } from "@/lib/sales/suppression";
import { createSalesLead } from "@/lib/sales/leadCreate";
import { recordContactEmail } from "@/lib/sales/contact/record";
import { signupLinkFor } from "@/lib/sales/repStats";
import { ensureSignupProgress } from "@/lib/sales/signupProgress";
import { defaultScriptLanguage } from "@/lib/sales/intel/callScript";
import { buildIntroEmail, INTRO_EMAIL_LANGUAGES, isIntroEmailLanguage, introTradePhrase } from "./introEmail";
import { introScreenshotFor } from "./introScreenshots";
import {
  INTRO_REPEAT_DAYS,
  introLinkExpiry,
  introLinkUrl,
  introLinksConfigured,
  recentIntroSend,
  sealIntroLink,
} from "./introLink";
import { repDemoUrl } from "@/lib/sales/demoBooking/url";

/** The number a prospect can ring the rep back on: their assigned sales line, or null. */
export async function repNumberFor(salesRepId, client = db) {
  if (!salesRepId) return null;
  const row = await client.platformSmsNumber.findFirst({
    where: { assignedRepId: salesRepId, active: true },
    select: { e164: true },
    orderBy: { e164: "asc" },
  });
  return row?.e164 || null;
}

/**
 * The hosted screenshot for a trade, per language — public/product/email/.
 * The owner's rule: the picture represents the prospect's trade (the
 * roofing card with the satellite still, the paving card with the traced
 * driveway, the cabinet quote); lib/sales/outreach/introScreenshots.js is
 * the table, and the alt text names the trade in the email's language.
 */
export function introScreenshotUrl(origin, language, tradeKey = null) {
  const shot = introScreenshotFor(tradeKey, language, introTradePhrase(tradeKey, language));
  return { url: `${String(origin || "").replace(/\/+$/, "")}${shot.path}`, alt: shot.alt, frame: shot.frame, kind: shot.kind };
}

/**
 * The refusals, as codes the screen translates. `error` is the English the
 * route returns beside the code, for the log and for a screen without the
 * catalogue.
 */
export const INTRO_REFUSALS = Object.freeze({
  no_email: "This lead has no email address on record. Add one and the intro can go.",
  suppressed: "This address is on FieldQuo's do-not-contact list.",
  mailbox: "Your mailbox isn't connected, so nothing can be sent from your address yet.",
  links: "The platform can't mint the email's links (META_TOKEN_ENCRYPTION_KEY is not set).",
  recent: `An intro email already went to this address in the last ${INTRO_REPEAT_DAYS} days.`,
  not_yours: "That lead isn't yours.",
  not_on_record: "That address isn't on the lead's record.",
  unreadable: "That doesn't look like an email address.",
  language: `The intro email is written in ${INTRO_EMAIL_LANGUAGES.join(", ")} only.`,
});

const LEAD_SELECT = {
  id: true,
  salesRepId: true,
  businessName: true,
  contactName: true,
  email: true,
  phone: true,
  status: true,
  timeZone: true,
  country: true,
  province: true,
  prospectId: true,
  prospect: { select: { id: true, email: true, tradeKey: true, province: true, doNotContactAt: true } },
  contactEmails: { select: { id: true, email: true }, orderBy: { createdAt: "asc" } },
};

/** The rep's lead by id, or their lead for a prospect — never another rep's. */
async function loadLead({ rep, leadId = null, prospectId = null, client = db }) {
  if (leadId) return client.salesLead.findFirst({ where: { id: leadId, salesRepId: rep.id }, select: LEAD_SELECT });
  if (prospectId) {
    return client.salesLead.findFirst({
      where: { prospectId, salesRepId: rep.id },
      orderBy: { createdAt: "desc" },
      select: LEAD_SELECT,
    });
  }
  return null;
}

/** The addresses on the record, in the closed set's order, deduplicated. */
export function candidateAddresses(lead, prospect = null) {
  const out = [];
  const seen = new Set();
  const add = (raw, source) => {
    const a = bareAddress(raw);
    if (!a || !isPlausibleEmail(a) || seen.has(a)) return;
    seen.add(a);
    out.push({ address: a, source });
  };
  add(lead?.email, "lead");
  add(lead?.prospect?.email || prospect?.email, "prospect");
  for (const row of Array.isArray(lead?.contactEmails) ? lead.contactEmails : []) add(row?.email, "contact");
  return out;
}

/**
 * Judge one address for one lead. The 14-day guard is by ADDRESS, across
 * every rep: a second rep who claims the same business a week later must
 * not send the same email twice.
 *
 * @returns { ok: true } | { ok: false, code, error, status }
 */
async function judgeAddress({ lead, address, client = db, now = new Date() }) {
  const sourceProvider = await sourceProviderForContact(client, { leadId: lead?.id || null, email: address });
  const verdict = await checkSuppression(client, { email: address, channel: "email", sourceProvider });
  if (verdict.suppressed) return { ok: false, code: "suppressed", error: verdict.reason || INTRO_REFUSALS.suppressed, status: 409 };
  const rows = await client.salesIntroEmail.findMany({
    where: { toAddress: address, sentAt: { gte: new Date(now.getTime() - INTRO_REPEAT_DAYS * 24 * 60 * 60 * 1000) } },
    select: { sentAt: true },
  });
  const recent = recentIntroSend(rows, { now });
  if (recent) return { ok: false, code: "recent", error: INTRO_REFUSALS.recent, status: 409, recentAt: recent };
  return { ok: true };
}

/**
 * What the pop-up shows.
 *
 * @param rep         the gate's fresh row.
 * @param leadId      the rep's lead, or
 * @param prospectId  a prospect off the queue (the lead may not exist yet —
 *                    the offer then reads the prospect for its address).
 * @returns {{ ok: true, leadId, businessName, candidates: [{address, source, refusal?}],
 *             defaultAddress, defaultLanguage, languages, canType, refusal: null, notice }
 *          | { ok: true, ..., refusal: { code, error } }}
 *
 * `refusal` is set when NOTHING can be sent — no mailbox, no links. A
 * per-address problem (suppressed, sent recently) rides on that candidate,
 * so the rep can pick another; no address at all is a `notice` beside the
 * typed field.
 */
export async function introEmailOffer({ rep, leadId = null, prospectId = null, client = db, now = new Date() }) {
  const lead = await loadLead({ rep, leadId, prospectId, client });
  const prospect =
    !lead && prospectId
      ? await client.prospect.findFirst({
          where: { id: prospectId, assignedRepId: rep.id },
          select: { id: true, businessName: true, email: true, tradeKey: true, province: true, doNotContactAt: true },
        })
      : null;
  if (!lead && !prospect) return { ok: false, status: 404, code: "not_yours", error: INTRO_REFUSALS.not_yours };

  const businessName = lead?.businessName || prospect?.businessName || "";
  const readiness = await outreachStatus(rep);
  const languages = INTRO_EMAIL_LANGUAGES;
  // The gate's rep row carries no `language`; read it here so the default
  // follows the call script's rule (Quebec → fr, else the rep's own portal
  // language when it is one of the three, else en).
  const repRow = await client.salesRep.findUnique({ where: { id: rep.id }, select: { language: true } });
  const defaultLanguage = defaultScriptLanguage({ prospect: lead?.prospect || prospect || lead, rep: { language: repRow?.language || null } });

  const base = {
    ok: true,
    leadId: lead?.id || null,
    prospectId: lead?.prospectId || prospect?.id || null,
    businessName,
    languages,
    defaultLanguage,
    // A test account may send to a typed address (its own), but it is not
    // saved on the record — recordContactEmail refuses — so the dialog says
    // so rather than promising a save that will not happen.
    canType: true,
    typedIsSaved: rep?.testAccount !== true && !(lead?.prospect?.doNotContactAt || prospect?.doNotContactAt),
  };

  if (!readiness.canSend) return { ...base, candidates: [], defaultAddress: null, refusal: { code: "mailbox", error: readiness.blockers[0]?.title || INTRO_REFUSALS.mailbox } };
  if (!introLinksConfigured()) return { ...base, candidates: [], defaultAddress: null, refusal: { code: "links", error: INTRO_REFUSALS.links } };

  const raw = candidateAddresses(lead, prospect);
  const candidates = [];
  for (const c of raw) {
    const judged = await judgeAddress({ lead: lead || { id: null }, address: c.address, client, now });
    candidates.push(judged.ok ? c : { ...c, refusal: { code: judged.code, error: judged.error, recentAt: judged.recentAt || null } });
  }
  const first = candidates.find((c) => !c.refusal) || null;
  return {
    ...base,
    candidates,
    defaultAddress: first?.address || null,
    // No address on the record is said as a NOTICE, not a refusal: the
    // dialog still offers the typed field, because "ask them for it and
    // type it in" is the whole reason the address is editable. A refusal
    // is for the cases typing cannot fix (mailbox, links).
    refusal: null,
    notice: candidates.length === 0 ? { code: "no_email", error: INTRO_REFUSALS.no_email } : null,
  };
}

/**
 * Send it.
 *
 * @param rep         the gate's fresh row.
 * @param leadId / prospectId  as for the offer. With only a prospectId and no
 *                    lead, one is created from the prospect — on send only.
 * @param toAddress   the address the rep confirmed or typed.
 * @param language    "en" | "fr" | "es".
 * @param attemptId   the call this follows, for the row.
 * @param origin      the app origin, for the links.
 * @returns { ok: true, introEmailId, threadId, messageId, toAddress, savedAddress }
 *        | { ok: false, status, code, error }
 */
export async function sendIntroEmail({ rep, leadId = null, prospectId = null, toAddress, language, attemptId = null, origin = null, request = null, now = new Date() }) {
  if (!isIntroEmailLanguage(language)) return { ok: false, status: 400, code: "language", error: INTRO_REFUSALS.language };
  const address = bareAddress(toAddress);
  if (!address || !isPlausibleEmail(address)) return { ok: false, status: 400, code: "unreadable", error: INTRO_REFUSALS.unreadable };

  // ── The lead, materialised from the prospect when there is none ───────
  let lead = await loadLead({ rep, leadId, prospectId });
  if (!lead && prospectId) {
    const prospect = await db.prospect.findFirst({
      where: { id: prospectId, assignedRepId: rep.id },
      select: { id: true, businessName: true, email: true, phoneE164: true, country: true, province: true },
    });
    if (!prospect) return { ok: false, status: 404, code: "not_yours", error: INTRO_REFUSALS.not_yours };
    const created = await createSalesLead(db, { salesRepId: rep.id, source: prospect });
    lead = await loadLead({ rep, leadId: created.id });
  }
  if (!lead) return { ok: false, status: 404, code: "not_yours", error: INTRO_REFUSALS.not_yours };

  // ── The address, on the record first ──────────────────────────────────
  let savedAddress = false;
  const onRecord = candidateAddresses(lead).some((c) => c.address === address);
  if (!onRecord) {
    const recorded = await recordContactEmail({ lead, rep, email: address });
    // A test account's typed address is sent to and not saved — the dialog
    // said so. Every other refusal stands.
    if (!recorded.ok && recorded.code !== "test_account") {
      return { ok: false, status: recorded.status, code: recorded.code, error: recorded.error };
    }
    savedAddress = recorded.ok && !recorded.onLead;
  }

  // ── Re-judged in the request that sends ───────────────────────────────
  const readiness = await outreachStatus(rep);
  if (!readiness.canSend) return { ok: false, status: 409, code: "mailbox", error: readiness.blockers[0]?.title || INTRO_REFUSALS.mailbox };
  if (!introLinksConfigured()) return { ok: false, status: 409, code: "links", error: INTRO_REFUSALS.links };
  const judged = await judgeAddress({ lead, address, now });
  if (!judged.ok) return { ok: false, status: judged.status, code: judged.code, error: judged.error };

  // ── The row's id is minted before the send; the row is written after ─
  //
  // The links have to name the row, so its id exists before anything is
  // sent — but the row itself is written only once the mailbox's SMTP has
  // accepted the message. A row that says "sent" for mail that never left
  // is the class of bug AGENTS.md opens with, and this table is also the
  // 14-day guard, so a phantom row would block the retry. Nothing here
  // deletes to tidy up.
  const rowId = randomUUID();
  const expiresAt = introLinkExpiry(now);
  const appOrigin = origin || getAppOrigin(request);
  const link = (kind) => introLinkUrl(appOrigin, sealIntroLink({ introEmailId: rowId, leadId: lead.id, salesRepId: rep.id, kind, expiresAt }));

  // The rep's code and number are not on the gate's row; read fresh here.
  const repRow = await db.salesRep.findUnique({ where: { id: rep.id }, select: { code: true, language: true } });
  const repPhone = await repNumberFor(rep.id);
  // The rep's signup link with a progress token, the same row the texted
  // link uses, so the panel shows where the contractor is either way.
  const progress = await ensureSignupProgress({ client: db, leadId: lead.id, salesRepId: rep.id, now }).catch(() => null);
  const signupLink = signupLinkFor(appOrigin, repRow?.code, { linkToken: progress?.token || null });
  if (!signupLink) return { ok: false, status: 409, code: "no_code", error: "This rep has no signup code, so the email has no link to carry." };

  const sent = await deliverOutreach({
    rep,
    lead,
    thread: null,
    to: [address],
    subject: "",
    body: "",
    build: (replyToken) =>
      buildIntroEmail({
        language,
        rep: { name: rep.name, email: readiness.from, phone: repPhone },
        business: lead.businessName,
        contactName: lead.contactName,
        tradeKey: lead.prospect?.tradeKey || null,
        signupLink,
        callbackUrl: link("callback"),
        // The demo button lands on the rep's own booking page with the
        // sealed token in ?t=, so the prospect picks a slot rather than
        // filing a request — lib/sales/demoBooking/book.js. The older
        // /i/<token> link still works: app/i/[token] forwards a demo token
        // there.
        demoUrl: repDemoUrl(appOrigin, repRow?.code, { token: sealIntroLink({ introEmailId: rowId, leadId: lead.id, salesRepId: rep.id, kind: "demo", expiresAt }) }),
        unsubscribeUrl: link("unsubscribe"),
        screenshotUrl: introScreenshotUrl(appOrigin, language, lead.prospect?.tradeKey || null).url,
        screenshotAlt: introScreenshotUrl(appOrigin, language, lead.prospect?.tradeKey || null).alt,
        mailingAddress: mailingAddress(),
        replyToken,
      }),
  });

  if (!sent.ok) {
    return { ok: false, status: sent.status, code: sent.suppressed ? "suppressed" : "send_failed", error: sent.error };
  }

  let row;
  try {
    row = await db.salesIntroEmail.create({
      data: {
        id: rowId,
        salesRepId: rep.id,
        leadId: lead.id,
        attemptId: attemptId || null,
        toAddress: address,
        language,
        sentAt: now,
        expiresAt,
        threadId: sent.threadId,
        messageId: sent.messageId,
      },
      select: { id: true },
    });
  } catch (err) {
    // The mail left and the thread is filed; only this table's row did not
    // land. Said in the log — the links in that email will answer "this
    // link isn't valid" until somebody looks — and reported to the rep as a
    // send that worked, because it did.
    await recordError({
      area: "sales_outreach",
      code: "intro_email_row_not_written",
      message: `Intro email to ${address} was sent but its row was not written: ${err?.message || err}`,
      detail: { salesRepId: rep.id, leadId: lead.id, threadId: sent.threadId, rowId },
    }).catch(() => {});
    row = { id: rowId };
  }

  return { ok: true, introEmailId: row.id, threadId: sent.threadId, messageId: sent.messageId, toAddress: address, savedAddress, leadId: lead.id };
}
