// lib/aiEmployee/webChat.js
//
// The server side of the site chat widget.
//
// ══ A stranger, a slug, and nothing else ═══════════════════════════════════
//
// The visitor has no account. The company is resolved from the booking slug —
// the same lookup /book, /quote and /instant-quote use — and NEVER from
// anything else in the request. The visitor's own identity is a random token
// the server minted on their first message and the widget keeps in
// localStorage: it names a thread on this company's web channel and nothing
// more, and a stranger who guesses one guesses 128 bits.
//
// ══ One ingest, one inbox ══════════════════════════════════════════════════
//
// A visitor's message goes through lib/messaging/ingest.js's ingestEvent —
// the same function a Messenger webhook calls — on the company's "web"
// channel row. That is what puts it in Conversations with an unread count, a
// thread number, the push to staff and the AI employee hook, and it is why a
// human reply from the inbox reaches the widget: the reply route writes an
// outbound Message on the thread, and the widget reads the thread.
//
// ══ What the visitor is told when nobody answers ═══════════════════════════
//
// Four states, and the widget prints a sentence for each rather than a
// spinner: `replied` (an answer is in the transcript), `waiting` (the
// employee drafted and the mode says a person reads first, OR no employee is
// on, OR the employee handed off — all three are "someone will reply
// shortly" from where the visitor sits), `handed_off` is folded into waiting
// on purpose, and `off` is the honest state when the company has no web
// chat at all — the widget is not rendered then, so a request in that state
// is a stale tab.
//
// ══ CASL ═══════════════════════════════════════════════════════════════════
//
// Nothing here is a marketing message: the visitor wrote first, every reply
// answers them, and no address, phone or email is stored beyond what they
// typed into the conversation. The transcript is the only record.

import { db } from "@/lib/db";
import { ingestEvent } from "@/lib/messaging/ingest";
import { CONVERSATION_DIRECTIONS } from "@/lib/messaging/messageKinds";
import { findBookingCompany } from "@/lib/booking/findBookingCompany";
import { isSupported, DEFAULT_LANGUAGE } from "@/app/i18n/languages";
import { employeeForChannel } from "./employees";
import { ownChannelFor, ownChannelExternalId } from "./ownChannel";

/** How many messages one visitor may send in ten minutes. */
export const VISITOR_BURST_LIMIT = 20;
const VISITOR_BURST_WINDOW_MS = 10 * 60 * 1000;
/** The most a visitor may type at once. */
export const MAX_VISITOR_TEXT = 1500;
/** How much of a thread the widget is shown. */
const TRANSCRIPT_LIMIT = 60;

const COMPANY_SELECT = {
  id: true,
  name: true,
  logoUrl: true,
  brandColor: true,
  defaultLanguage: true,
  isDemo: true,
};

/** A fresh visitor token. 128 bits, hex. */
export function mintVisitorToken() {
  return crypto.randomUUID().replace(/-/g, "") + crypto.randomUUID().replace(/-/g, "").slice(0, 8);
}

/** Is this a token we minted? Shape only — the thread lookup is the truth. */
export function isVisitorToken(value) {
  return typeof value === "string" && /^[a-f0-9]{40}$/.test(value);
}

const threadExternalId = (token) => `visitor:${token}`;

/**
 * What the widget needs before the first message: is chat on, who fronts it,
 * what colour is the button. Public — carries no price, no email, no phone.
 */
export async function webChatConfig(companySlug) {
  const company = await findBookingCompany(companySlug, COMPANY_SELECT);
  if (!company) return null;
  const employee = await employeeForChannel(company.id, "web");
  return {
    enabled: Boolean(employee),
    company: { name: company.name, logoUrl: company.logoUrl || null, brandColor: company.brandColor || null },
    employee: employee
      ? { displayName: employee.displayName || employee.name || null, avatarUrl: employee.avatarUrl || null }
      : null,
  };
}

/** The transcript a visitor may read: their own turns and the business's. */
async function transcript(prisma, threadId) {
  const rows = await prisma.message.findMany({
    where: { threadId, direction: { in: [...CONVERSATION_DIRECTIONS] }, private: false, failedReason: null },
    orderBy: { sentAt: "asc" },
    take: TRANSCRIPT_LIMIT,
    select: { id: true, direction: true, body: true, sentAt: true },
  });
  return rows
    .filter((m) => String(m.body || "").trim())
    .map((m) => ({ id: m.id, from: m.direction === "in" ? "visitor" : "business", text: m.body, at: m.sentAt }));
}

/** The visitor's thread on this company's web channel, or null. */
async function threadFor(prisma, companyId, token) {
  if (!isVisitorToken(token)) return null;
  const channel = await prisma.messagingChannel.findUnique({
    where: { platform_externalId: { platform: "web", externalId: ownChannelExternalId("web", companyId) } },
    select: { id: true, companyId: true },
  });
  if (!channel || channel.companyId !== companyId) return null;
  return prisma.messageThread.findFirst({
    where: { channelId: channel.id, externalThreadId: threadExternalId(token), companyId },
    select: { id: true, status: true },
  });
}

/**
 * Read the conversation. Used by the widget's poll.
 */
export async function readWebChat({ companySlug, visitorToken }, { db: prisma = db } = {}) {
  const company = await findBookingCompany(companySlug, { id: true });
  if (!company) return { ok: false, reason: "unknown_company" };
  const thread = await threadFor(prisma, company.id, visitorToken);
  if (!thread) return { ok: true, messages: [], threadId: null };
  return { ok: true, threadId: thread.id, messages: await transcript(prisma, thread.id) };
}

/**
 * One message from the visitor.
 *
 * @returns {{ ok, reason?, visitorToken, threadId, state, messages }}
 */
export async function postWebChat(
  { companySlug, visitorToken = null, text, language = null },
  { db: prisma = db, ingest = ingestEvent } = {},
) {
  const body = String(text || "").trim().slice(0, MAX_VISITOR_TEXT);
  if (!body) return { ok: false, reason: "empty" };

  const company = await findBookingCompany(companySlug, COMPANY_SELECT);
  if (!company) return { ok: false, reason: "unknown_company" };

  const channel = await ownChannelFor(company.id, "web", prisma);
  if (!channel) return { ok: false, reason: "no_channel" };

  const token = isVisitorToken(visitorToken) ? visitorToken : mintVisitorToken();

  // ── Per-visitor burst limit, from the thread itself ─────────────────────
  //
  // The route limits per IP; this limits per token, so one visitor behind a
  // busy office IP is not silenced by a colleague, and one script with a
  // token cannot run the company's AI allowance down.
  const existing = await prisma.messageThread.findFirst({
    where: { channelId: channel.id, externalThreadId: threadExternalId(token) },
    select: { id: true },
  });
  if (existing) {
    const recent = await prisma.message.count({
      where: { threadId: existing.id, direction: "in", sentAt: { gte: new Date(Date.now() - VISITOR_BURST_WINDOW_MS) } },
    });
    if (recent >= VISITOR_BURST_LIMIT) return { ok: false, reason: "rate_limited", visitorToken: token };
  }

  const lang = isSupported(language) ? language : company.defaultLanguage || DEFAULT_LANGUAGE;

  const result = await ingest({
    platform: "web",
    pageExternalId: channel.externalId,
    kind: "message",
    direction: "in",
    threadExternalId: threadExternalId(token),
    participantExternalId: threadExternalId(token),
    participantName: null,
    externalId: `web:${crypto.randomUUID()}`,
    body,
    sentAt: new Date(),
    language: lang,
  });

  if (!result?.handled) return { ok: false, reason: result?.reason || "not_stored", visitorToken: token };

  // The tenant fence, restated where it is cheapest to read: the thread the
  // ingest returned belongs to the company the slug resolved to, or this is
  // a bug worth refusing on.
  if (result.companyId !== company.id) return { ok: false, reason: "tenant_mismatch", visitorToken: token };

  const state = result.ai?.replied ? "replied" : "waiting";
  return {
    ok: true,
    visitorToken: token,
    threadId: result.threadId,
    state,
    messages: await transcript(prisma, result.threadId),
  };
}
