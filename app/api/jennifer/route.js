// app/api/jennifer/route.js
//
// Jennifer's one endpoint, for both modes — a signed-in company member and an
// anonymous marketing-site visitor hit the exact same route. The MODE is
// decided here, from the request, and never trusted from the request body:
//
//   company    — getCurrentMember() resolves a real session. companyId comes
//                from THAT resolved member, never from anything the client
//                sent — mirroring app/api/ai/copilot/route.js exactly. The
//                conversation is PERSISTED (lib/ai/jennifer/conversations.js)
//                so an escalated one can be handed to a FieldQuo operator in
//                /platform/jennifer and the reply can reach the contractor's
//                own panel again.
//   anonymous  — no session at all, or a session that can't be resolved for
//                any reason (no active company, an impersonated read-only
//                session hitting this as a write-shaped POST, a billing-
//                locked account). Falling back to anonymous rather than
//                erroring is deliberate: Jennifer's anonymous mode is a
//                strict SUBSET of what she can do signed in — sales knowledge
//                and public calculators only, nothing account-specific — so
//                failing to resolve a session degrades to "no less safe than
//                a stranger asking the same question", never to an error page
//                where a chat panel was rendered. NOTHING is persisted for
//                this mode (AGENTS.md non-negotiable #8) — the whole
//                conversation lives in the browser tab and is POSTed back in
//                full each turn, same as before this file grew a company-mode
//                persistence layer.
//
// ── Two different request shapes, on purpose ─────────────────────────────
//
// Anonymous: { messages: [...] } — the full history, client-held, because
// there is nothing server-side to append to.
// Company:   { conversationId?, message, images? } — one new turn, because the
// server now owns the history. The first call of a conversation omits
// conversationId and gets one back to send on every later call.
//
// ── The unresolved → escalated → resolved lifecycle (company mode only) ────
//
// See lib/ai/jennifer/conversations.js's header for the reasoning — modelled
// on the reference implementation's own `status === "unresolved"` gate on
// whether the agent answers at all. Once a conversation is escalated,
// Jennifer stops replying in it; a message still SAVES (so the operator sees
// the whole thread) but the model is never called again for that
// conversation until it's resolved.
//
// ── Reactivity: polling, not streaming or websockets ────────────────────────
//
// There is no equivalent of Convex's reactive subscriptions in this stack —
// Prisma and Next give a request/response, nothing pushed. Two different
// problems, two different answers, decided deliberately rather than both
// solved the same way:
//
//   * Jennifer's OWN reply: NOT streamed token-by-token in this pass. The
//     panel already shows a spinner while it waits, which is honest (it says
//     "working", not "done"); token streaming would read a little faster but
//     changes nothing about what's TRUE, and was cut under time pressure in
//     favour of the half below, which changes what's possible, not just how
//     it looks. Flagged in the final report as unfinished, not silently
//     skipped.
//   * An OPERATOR's reply, once escalated: this is the half that actually
//     needs solving, because nothing else will ever notice a human typed
//     into /platform/jennifer. The panel polls GET on this route — see below
//     — but ONLY while status is "escalated": a plain bot conversation never
//     changes except by the visitor's own actions, so polling it would be
//     pure waste. SSE would be smoother and websockets are not remotely
//     justified for a low-volume tier-1 support surface — polling on an
//     interval is the simplest thing that is actually true, and a failed
//     poll is surfaced as "couldn't check for a reply", never silently
//     dropped (see JenniferPanel.js's `pollError` state) — this codebase
//     already distinguishes "empty" from "could not load" everywhere else,
//     and this is that same discipline applied here.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentMember } from "@/lib/currentMember";
import { askJennifer } from "@/lib/ai/jennifer/client";
import { escalationLabel } from "@/lib/ai/jennifer/escalate";
import { isAiConfigured } from "@/lib/ai/provider";
import { checkAiQuota, recordAiUsage } from "@/lib/ai/usage";
import { rateLimit } from "@/lib/rateLimit";
import {
  loadConversation,
  createConversation,
  appendMessage,
  markEscalated,
  reopenIfResolved,
  shouldAutoRespond,
  toModelMessages,
} from "@/lib/ai/jennifer/conversations";

const MAX_MESSAGES = 40;
const MAX_MESSAGE_CHARS = 4000;

// ── Attachments: signed-in only ──────────────────────────────────────────
//
// A contractor sending a screenshot of an error is genuinely useful for
// tier-1 support and this route already has an authenticated Cloudinary
// upload path to reuse (/api/upload, gated by memberOrRefusal — an anonymous
// visitor cannot even obtain a URL to send here in the first place). A
// stranger on the marketing site attaching an arbitrary image to a vision
// call billed through FieldQuo's own OpenAI account is pure cost and abuse
// with no account behind it to attribute it to, so anonymous mode never
// reaches the vendor with an image, full stop — see the mode check below and
// the matching one in lib/ai/jennifer/client.js.
//
// Even in company mode, a raw URL from the request body is not trusted as-is:
// it has to be a Cloudinary URL Cloudinary itself issued, inside THIS
// company's own upload folder (app/api/upload/route.js writes to
// `fieldquo/companies/<companyId>`) — otherwise a member could point Jennifer
// at another company's uploaded photo, or at an arbitrary external image, and
// have FieldQuo's account pay to have a vision model look at it.
const MAX_IMAGES = 2;

/**
 * Exported so the check script can execute it directly against a hostile URL
 * rather than merely reading this comment.
 */
export function companyOwnImageUrls(raw, companyId) {
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
  if (!cloudName || !companyId) return [];

  const prefix = `https://res.cloudinary.com/${cloudName}/`;
  const ownFolder = `/fieldquo/companies/${companyId}/`;

  return (Array.isArray(raw) ? raw : [])
    .filter((u) => typeof u === "string")
    .filter((u) => u.startsWith(prefix) && u.includes(ownFolder))
    .slice(0, MAX_IMAGES);
}

/**
 * The one write anonymous mode ever makes: a ticket, not a transcript.
 *
 * Lands in the SAME queue /platform/feedback already reads. `body` carries
 * only the one-sentence reason — never the conversation — because
 * non-negotiable #8 is about the CONVERSATION, and this row is deliberately
 * not one: no back-and-forth, nothing a visitor said beyond the one line that
 * triggered the handoff, just "someone needs a human, here's why."
 *
 * COMPANY mode does NOT use this — an escalated company conversation is
 * itself the record an operator opens in /platform/jennifer; writing a
 * second, redundant ticket here would just be two places saying the same
 * thing with two different amounts of context.
 *
 * Never allowed to break the response the visitor is waiting on — same "a
 * metering failure must not turn a working answer into an error" rule
 * recordAiUsage follows.
 */
async function recordAnonymousEscalation({ result, pageUrl }) {
  const reasonText =
    result.escalationNote ||
    (result.escalationCategory ? escalationLabel(result.escalationCategory) : "unspecified");

  try {
    await db.feedback.create({
      data: {
        type: "jennifer_escalation",
        subject: `Jennifer escalation (anonymous): ${result.escalationCategory || "handed off"}`.slice(0, 200),
        body: reasonText.slice(0, 5000),
        pageUrl: pageUrl?.slice(0, 500) || null,
      },
    });
  } catch (err) {
    console.error("[jennifer] couldn't record anonymous escalation:", err?.message);
  }
}

/**
 * A real session for a real company, or null. Never throws out of this
 * function — every failure mode (no session, impersonation hitting a
 * write-shaped route, a billing-locked account, a half-migrated session with
 * no Member row) falls back to null, which the caller below treats as
 * anonymous. See this file's header for why that's the safe direction.
 *
 * skipBillingGate: true — a company behind on its own FieldQuo bill still
 * gets tier-1 support; that is arguably the account MOST likely to need it,
 * and "your subscription's overdue" is itself one of the things Jennifer
 * would sensibly escalate rather than a reason to refuse her entirely.
 */
async function resolveCompanyMember(request) {
  try {
    const member = await getCurrentMember(request, { skipBillingGate: true });
    if (!member?.companyId) return null;
    return member;
  } catch {
    return null;
  }
}

async function handleAnonymousPost(request, body) {
  const messages = Array.isArray(body?.messages) ? body.messages : null;

  if (!messages || messages.length === 0) {
    return NextResponse.json({ error: "messages array required" }, { status: 400 });
  }
  if (messages.length > MAX_MESSAGES) {
    return NextResponse.json(
      { error: "That's a long conversation — start a new one." },
      { status: 400 },
    );
  }
  for (const m of messages) {
    if (typeof m?.content !== "string" || !["user", "assistant"].includes(m?.role)) {
      return NextResponse.json({ error: "Malformed message." }, { status: 400 });
    }
    if (m.content.length > MAX_MESSAGE_CHARS) {
      return NextResponse.json({ error: "That message is too long." }, { status: 400 });
    }
  }

  const limited = rateLimit(request, "jennifer-anonymous", {
    limit: 20,
    windowMs: 15 * 60 * 1000,
    message: "Too many messages from this connection. Wait a few minutes and try again.",
  });
  if (limited) return limited;

  const result = await askJennifer({ mode: "anonymous", messages });

  if (result.escalated) {
    await recordAnonymousEscalation({ result, pageUrl: request.headers.get("referer") });
  }

  return NextResponse.json({
    text: result.text,
    escalated: Boolean(result.escalated),
    navigation: result.navigation || null,
    mode: "anonymous",
  });
}

async function handleCompanyPost(request, body, member) {
  const message = typeof body?.message === "string" ? body.message.trim() : "";
  if (!message) {
    return NextResponse.json({ error: "message is required" }, { status: 400 });
  }
  if (message.length > MAX_MESSAGE_CHARS) {
    return NextResponse.json({ error: "That message is too long." }, { status: 400 });
  }

  let conversation;
  if (body?.conversationId) {
    conversation = await loadConversation({
      conversationId: String(body.conversationId),
      companyId: member.companyId, // the ONLY source of truth for scope
    });
    if (!conversation) {
      return NextResponse.json({ error: "Conversation not found." }, { status: 404 });
    }
    conversation = await reopenIfResolved(conversation);
  } else {
    conversation = await createConversation({ companyId: member.companyId, userId: member.userId });
  }

  await appendMessage({ conversationId: conversation.id, role: "user", content: message });

  if (!shouldAutoRespond(conversation.status)) {
    // Escalated and staying that way: saved for the operator, no bot reply,
    // and — deliberately checked in THIS order — no AI quota consulted
    // either. A company sitting at its monthly cap can still tell a human
    // "it's still broken" in an escalated thread; the quota governs the
    // MODEL answering, not a message landing in front of a person.
    return NextResponse.json({
      conversationId: conversation.id,
      text: null,
      escalated: true,
      status: conversation.status,
      navigation: null,
      mode: "company",
    });
  }

  // Checked BEFORE the call, exactly like /api/ai/copilot — recording after
  // only tells you what you already spent. Deliberately AFTER the
  // shouldAutoRespond check above: quota governs whether the MODEL runs, and
  // an escalated conversation never reaches the model regardless of quota.
  const quota = await checkAiQuota(member.companyId);
  if (!quota.allowed) {
    return NextResponse.json({ error: quota.reason, quotaExceeded: true }, { status: 429 });
  }

  const images = companyOwnImageUrls(body?.images, member.companyId);
  const priorMessages = toModelMessages(conversation.messages);

  const result = await askJennifer({
    mode: "company",
    companyId: member.companyId,
    member: { role: member.role },
    messages: [...priorMessages, { role: "user", content: message }],
    images,
    onUsage: (u) =>
      recordAiUsage({
        companyId: member.companyId,
        feature: "jennifer",
        userId: member.userId,
        ...u,
      }),
  });

  await appendMessage({ conversationId: conversation.id, role: "assistant", content: result.text });

  let status = conversation.status;
  if (result.escalated) {
    const reason = result.escalationCategory
      ? escalationLabel(result.escalationCategory)
      : result.escalationNote || "handed off";
    const updated = await markEscalated({ conversationId: conversation.id, reason });
    status = updated.status;
  }

  return NextResponse.json({
    conversationId: conversation.id,
    text: result.text,
    escalated: Boolean(result.escalated),
    status,
    navigation: result.navigation || null,
    mode: "company",
  });
}

export async function POST(request) {
  const body = await request.json().catch(() => null);

  if (!isAiConfigured()) {
    return NextResponse.json(
      { error: "Jennifer isn't switched on for this deployment yet — OPENAI_API_KEY is missing." },
      { status: 503 },
    );
  }

  const member = await resolveCompanyMember(request);

  try {
    return member ? await handleCompanyPost(request, body, member) : await handleAnonymousPost(request, body);
  } catch (err) {
    console.error("[jennifer]", err);
    const status = err?.status || err?.response?.status;
    const message =
      status === 401
        ? "Jennifer's OpenAI key was rejected."
        : status === 429
          ? "Jennifer is being rate-limited. Wait a few seconds and try again."
          : `Jennifer couldn't answer. ${err?.message || ""}`.trim();
    return NextResponse.json({ error: message }, { status: 502 });
  }
}

/**
 * Polling for an operator's reply. Company mode only — anonymous has no
 * session and no persisted conversation to poll (see this file's header).
 * See JenniferPanel.js: only called while status === "escalated".
 */
export async function GET(request) {
  const member = await resolveCompanyMember(request);
  if (!member) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const conversationId = searchParams.get("conversationId");

  const conversation = await loadConversation({ conversationId, companyId: member.companyId });
  if (!conversation) {
    return NextResponse.json({ error: "Conversation not found." }, { status: 404 });
  }

  return NextResponse.json({
    conversationId: conversation.id,
    status: conversation.status,
    messages: conversation.messages.map((m) => ({
      id: m.id,
      role: m.role,
      content: m.content,
      createdAt: m.createdAt,
    })),
  });
}
