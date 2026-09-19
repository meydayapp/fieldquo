// lib/aiEmployee/smsChannel.js
//
// A text from a customer's phone to the shared system number, filed into the
// company's inbox and — when exactly one company holds that phone — answered
// by that company's AI employee.
//
// ══ Exactly one company, or no automatic reply ═════════════════════════════
//
// lib/sms/clientLine.js's holder rule returns EVERY company that has the
// sender's phone on a Client record, and says in its header why it does not
// narrow: nothing records which tenant last texted which phone, so narrowing
// would be a guess. A guess here would be one company's AI employee
// answering, in its own name, a text meant for another — the tenant leak
// non-negotiable #8 forbids. So:
//
//   one holder   → filed on that company's "sms" thread; the employee (if
//                  on) answers through the same ingest hook Messenger uses.
//   many holders → filed on EACH holder's thread, with a `shared_line`
//                  activity line saying so, and `noAutoReply` set: no
//                  employee runs, no tool runs, a person at each company sees
//                  it. The owner's rule, verbatim: "a phone held by two
//                  companies → no tool call, human handoff."
//   no holder    → not ours; the route hands it to the sales-number handler
//                  exactly as before.
//
// ══ STOP / START are untouched ═════════════════════════════════════════════
//
// The route classifies the keyword BEFORE this runs and never calls this for
// one (lib/sms/optOut.js records it). A STOP is an opt-out, not a message.
//
// ══ Idempotent on Twilio's own id ══════════════════════════════════════════
//
// The Message row's externalId is the MessageSid. Twilio retries a webhook
// that answers slowly; ingestEvent's upsert on (threadId, externalId) makes
// the retry a no-op rather than a second bubble and a second model call.

import { db } from "@/lib/db";
import { ingestEvent } from "@/lib/messaging/ingest";
import { writeActivity } from "@/lib/messaging/activity";
import { sendOnChannel } from "@/lib/messaging/send";
import { toE164 } from "@/lib/sms/twilioClient";
import { ownChannelFor } from "./ownChannel";

/**
 * "Someone will reply shortly" — the one text a customer gets when they wrote
 * and no employee answered (off, out of credit, handed off, or drafting for a
 * person to read first). Once per thread per day, because a second one is
 * noise and each is a real text from the business. Never when several
 * companies hold the phone: no tenant can send it without claiming the text.
 */
export const ACK_WINDOW_MS = 24 * 60 * 60 * 1000;

const ACK = Object.freeze({
  en: "Thanks — someone from {company} will reply shortly.",
  fr: "Merci — quelqu'un de {company} vous répondra sous peu.",
  es: "Gracias — alguien de {company} le responderá en breve.",
  uk: "Дякуємо — хтось із {company} незабаром вам відповість.",
  pa: "ਧੰਨਵਾਦ — {company} ਤੋਂ ਕੋਈ ਜਲਦੀ ਹੀ ਜਵਾਬ ਦੇਵੇਗਾ।",
  tl: "Salamat — may sasagot mula sa {company} sa lalong madaling panahon.",
  de: "Danke — jemand von {company} antwortet Ihnen in Kürze.",
  zh: "谢谢——{company} 的工作人员会尽快回复您。",
  it: "Grazie — qualcuno di {company} ti risponderà a breve.",
});

export function ackText({ companyName, language = "en" }) {
  return (ACK[language] || ACK.en).replace("{company}", String(companyName || "").trim() || "the team");
}

/** Send the acknowledgement if none went out on this thread in the window. */
async function maybeAck(prisma, { channel, threadId, e164, companyName, language }) {
  const recent = await prisma.message.count({
    where: {
      threadId,
      direction: "out",
      sentByUserId: null,
      failedReason: null,
      sentAt: { gte: new Date(Date.now() - ACK_WINDOW_MS) },
    },
  });
  if (recent > 0) return false;
  const text = ackText({ companyName, language });
  const sent = await sendOnChannel({ channel, recipientExternalId: e164, text, kind: "text" });
  await prisma.message
    .create({
      data: {
        threadId,
        direction: "out",
        private: false,
        externalId: sent.ok && sent.externalId ? sent.externalId : `local:${crypto.randomUUID()}`,
        body: text,
        sentAt: new Date(),
        sentByUserId: null,
        failedReason: sent.ok ? null : `${sent.reason}`,
      },
    })
    .catch(() => null);
  return Boolean(sent.ok);
}

/** The customer's name at THIS company, from its own Client rows. */
async function holderName(prisma, companyId, e164) {
  const digits = e164.replace(/\D/g, "").slice(-10);
  if (digits.length < 10) return null;
  const rows = await prisma.$queryRaw`
    SELECT c."name" FROM "Client" c
    WHERE c."companyId" = ${companyId}
      AND regexp_replace(COALESCE(c."phone", ''), '\\D', '', 'g') LIKE ${"%" + digits}
    ORDER BY c."createdAt" ASC LIMIT 1`;
  return rows?.[0]?.name || null;
}

/**
 * @param from        the sender's phone, as Twilio gave it
 * @param body        the text
 * @param messageSid  Twilio's MessageSid — the idempotency key
 * @param companies   the holders lib/sms/clientLine.js resolved: [{ id, name }]
 * @returns {{ filed: number, answered: boolean, shared: boolean }}
 */
export async function handleInboundClientSms(
  { from, body, messageSid, companies = [] },
  { db: prisma = db, ingest = ingestEvent } = {},
) {
  const e164 = toE164(from) || String(from || "").trim();
  const text = String(body || "").trim();
  if (!e164 || !text || !companies.length) return { filed: 0, answered: false, shared: false };

  const shared = companies.length > 1;
  let filed = 0;
  let answered = false;

  for (const company of companies) {
    const channel = await ownChannelFor(company.id, "sms", prisma);
    if (!channel) continue;

    const result = await ingest({
      platform: "sms",
      pageExternalId: channel.externalId,
      kind: "message",
      direction: "in",
      threadExternalId: e164,
      participantExternalId: e164,
      participantName: await holderName(prisma, company.id, e164).catch(() => null),
      externalId: messageSid ? String(messageSid) : `sms:${crypto.randomUUID()}`,
      body: text,
      sentAt: new Date(),
      noAutoReply: shared,
    }).catch((err) => {
      console.error("[aiEmployee] sms ingest failed:", err?.message);
      return null;
    });

    if (!result?.handled) continue;
    filed += 1;
    if (result.ai?.replied) answered = true;

    if (shared) {
      if (result.created) {
        await writeActivity(prisma, { threadId: result.threadId, type: "shared_line", at: new Date() }).catch(() => null);
      }
    } else if (result.created && !result.ai?.replied) {
      const row = await prisma.company
        .findUnique({ where: { id: company.id }, select: { name: true, defaultLanguage: true } })
        .catch(() => null);
      await maybeAck(prisma, {
        channel,
        threadId: result.threadId,
        e164,
        companyName: row?.name || company.name,
        language: row?.defaultLanguage || "en",
      }).catch(() => null);
    }
  }

  return { filed, answered, shared };
}
