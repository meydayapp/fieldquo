// lib/aiEmployee/respond.js
//
// One inbound message in, one reply — or one NAMED refusal — out.
//
// ══ The shape this file copies ═════════════════════════════════════════════
//
// lib/voice/autoDraft.js, deliberately: an automated model call that runs on
// every inbound event, checks quota BEFORE it spends, records usage AFTER on
// every path, returns rather than throws, and writes the reason it did nothing
// so a contractor asking "why did it skip this one?" gets an answer. Its
// header says a silent skip is the failure the whole file exists to avoid.
// That is true here with a stranger on the other end of it.
//
// ══ Two modes, and the safe one is the default ═════════════════════════════
//
// SUGGEST writes an AiEmployeeReply with `sentAt` null: a draft waiting for a
// person. AUTO does the same write and then sends. Both go through the SAME
// composition — the mode changes only what happens to the finished text, so
// there is exactly one path a reply can be produced by, and a contractor
// reading a suggestion is reading what would have gone out. See
// lib/aiEmployee/decide.js's sendMode for why the default is not a truthiness
// test.
//
// ══ Every path writes a row ════════════════════════════════════════════════
//
// Including the refusals — especially the refusals. NO_CREDIT and HANDED_OFF
// both flag the thread for a person; a stop nobody is told about is
// indistinguishable from the feature not working, and the out-of-credit stop
// is the one a contractor can actually fix.
//
// The one exception, and it is a deliberate one: the reasons that mean the
// company has not switched this on (NO_EMPLOYEE, DISABLED). Those fire on
// every inbound message for every company that has never used the feature, and
// writing a row for each would fill the table with the fact that a feature is
// off. They return the reason and write nothing.

import { db } from "@/lib/db";
import { CONVERSATION_DIRECTIONS } from "@/lib/messaging/messageKinds";
import { runToolLoop, isAiConfigured } from "@/lib/ai/provider";
import { checkAiQuota, recordAiUsage, estimateCostMicros } from "@/lib/ai/usage";
import { buildEmployeePrompt, instructionsFingerprint, roleFor } from "./roles";
import { selectChunks } from "./sources";
import { SKIP, MODE_AUTO, shouldReply, sendMode, withinBusinessHours } from "./decide";
import { definitionsForRole, executeFor } from "./tools";

/** The AiUsage feature name. Its own, so a contractor's usage screen can show
 *  what the employee cost separately from what they asked for by hand. */
export const AI_EMPLOYEE_FEATURE = "ai_employee_reply";

/** Reasons that mean "not switched on" — see the header. */
const UNCONFIGURED = new Set([SKIP.NO_EMPLOYEE, SKIP.DISABLED]);

/** How much of the conversation the model is shown. */
const HISTORY_LIMIT = 12;

/**
 * Has the employee already handed this thread to a person?
 *
 * Read as a COUNT rather than a boolean column on the thread, because the
 * thread belongs to the messaging feature and the handoff belongs to this one
 * — see the AiEmployeeReply schema note on why there is no foreign key here.
 */
async function threadState(prisma, companyId, threadId) {
  const [handoff, replies] = await Promise.all([
    prisma.aiEmployeeReply.count({ where: { companyId, threadId, handedOff: true } }),
    // Only replies that were actually PRODUCED count against the cap. A row
    // written to record "no credit" is not a reply the homeowner received, and
    // counting it would let a bad month permanently exhaust a thread's cap.
    prisma.aiEmployeeReply.count({
      where: { companyId, threadId, draftText: { not: null } },
    }),
  ]);
  return { handedOff: handoff > 0, repliesSoFar: replies };
}

/**
 * Has a PERSON written on this thread since the message we are answering?
 *
 * `sentByUserId` is the discriminator: the messaging schema sets it for a
 * contractor's own reply and leaves it null for an automation. An outbound
 * message with no user is this employee's, and an employee treating its own
 * message as "a human is handling it" would stop itself on its first reply.
 */
async function humanRepliedSince(prisma, threadId, since) {
  const count = await prisma.message.count({
    where: {
      threadId,
      direction: "out",
      sentByUserId: { not: null },
      sentAt: { gte: since },
    },
  });
  return count > 0;
}

/** The last few turns, oldest first, as chat messages. */
async function conversation(prisma, threadId) {
  const rows = await prisma.message.findMany({
    // ── An internal note is not part of the conversation ────────────────
    //
    // Message.direction has four values (lib/messaging/messageKinds.js): "in",
    // "out", "note" and "activity". Only the first two are a real message
    // between two people, and the filter is written from THAT module's own
    // constant rather than from a comparison here — a private note swept into
    // the history is a private note the model can paraphrase back to the
    // homeowner, which is the exact leak the four-value column exists to make
    // impossible. `private: false` is the second, independent half of the same
    // rule, the way metaSend.js checks both.
    where: { threadId, direction: { in: [...CONVERSATION_DIRECTIONS] }, private: false },
    orderBy: { sentAt: "desc" },
    take: HISTORY_LIMIT,
    select: { direction: true, body: true, failedReason: true },
  });

  return rows
    .reverse()
    // A message that never reached the homeowner is not part of the
    // conversation they are having. Replaying a failed send as though they had
    // read it produces an employee that answers a question nobody was asked.
    .filter((m) => !m.failedReason && String(m.body || "").trim())
    .map((m) => ({
      role: m.direction === "in" ? "user" : "assistant",
      content: String(m.body).slice(0, 2000),
    }));
}

/**
 * Draft or send a reply to one inbound message.
 *
 * Best-effort by contract, exactly like autoDraftAfterCall: the caller is an
 * ingest path that has already stored the homeowner's message, and a failure
 * here must never turn that into a 500 the webhook retries. Every path
 * returns; nothing throws.
 *
 * @param dryRun  the settings screen's test box. Composes through this same
 *                function so what a contractor is shown is what would be sent —
 *                writing nothing, sending nothing, and running the two
 *                side-effecting tools in simulation (lib/aiEmployee/tools.js).
 * @param send    injected. The AUTO path calls it with the finished text; the
 *                caller owns the sending because the send path belongs to the
 *                messaging feature and a second implementation of it here
 *                would be the copy that rots.
 *
 * @returns {{ replied, mode, reason, text, sources, tools, replyId }}
 */
export async function respondToMessage({
  companyId,
  threadId = null,
  messageId = null,
  dryRun = false,
  // The test box's typed message. Only read on a dry run — a real reply
  // answers a Message row that exists, and letting a caller supply the
  // customer's words for a live send would be a way to make the employee say
  // something to a homeowner that they never wrote.
  testText = "",
  send = null,
  deps = {},
} = {}) {
  const {
    db: prisma = db,
    checkAiQuota: checkQuota = checkAiQuota,
    recordAiUsage: recordUsage = recordAiUsage,
    runToolLoop: runLoop = runToolLoop,
    isAiConfigured: aiConfigured = isAiConfigured,
  } = deps;

  const [employee, company, thread, message] = await Promise.all([
    prisma.aiEmployee.findUnique({ where: { companyId } }),
    prisma.company.findUnique({
      where: { id: companyId },
      select: { id: true, name: true, businessHours: true, timezone: true, defaultLanguage: true },
    }),
    threadId
      ? prisma.messageThread.findFirst({
          where: { id: threadId, companyId },
          select: {
            id: true,
            status: true,
            participantName: true,
            channel: { select: { platform: true } },
          },
        })
      : null,
    messageId
      ? prisma.message.findFirst({
          where: { id: messageId, threadId },
          select: { id: true, direction: true, body: true, sentAt: true },
        })
      : null,
  ]);

  // ── The tenant boundary of this feature is companyId ───────────────────
  //
  // The thread is read WITH companyId in the where — a threadId is a cuid a
  // caller supplies, and the AiEmployeeReply schema note says companyId is what
  // scopes this feature, so this is where that has to be true. A test box has
  // no thread at all and stands in one that is open and belongs to nobody; it
  // can only ever reach the dry-run branches below.
  if (threadId && !thread) {
    return { replied: false, reason: "unknown_thread", mode: sendMode(employee) };
  }
  if (!threadId && !dryRun) {
    return { replied: false, reason: "unknown_thread", mode: sendMode(employee) };
  }
  if (messageId && !message) {
    return { replied: false, reason: "unknown_message", mode: sendMode(employee) };
  }

  const [state, quota] = await Promise.all([
    threadId
      ? threadState(prisma, companyId, threadId)
      : Promise.resolve({ handedOff: false, repliesSoFar: 0 }),
    // BEFORE the call, on every path including the dry run — a test box that
    // spent credit a company did not have would be the one surface where the
    // rule was skipped, and it is the surface people press repeatedly.
    checkQuota(companyId),
  ]);

  const humanReplied =
    threadId && message?.sentAt
      ? await humanRepliedSince(prisma, threadId, message.sentAt)
      : false;

  const inbound = message?.body ?? (dryRun ? testText : "");

  const verdict = shouldReply({
    employee,
    businessHoursOpen: withinBusinessHours(company),
    thread: thread || { status: "open" },
    message: { direction: message?.direction ?? "in", body: inbound },
    quota,
    aiConfigured: aiConfigured(),
    humanReplied,
    handedOff: state.handedOff,
    repliesSoFar: state.repliesSoFar,
  });

  if (!verdict.reply) {
    if (dryRun || UNCONFIGURED.has(verdict.reason)) {
      return { replied: false, reason: verdict.reason, mode: verdict.mode };
    }
    // ── The refusal is written down, and some of them fetch a person ────
    //
    // NO_CREDIT is the one this matters most for. The employee stops; it does
    // NOT produce a shorter or cheaper answer, because a degraded reply sent
    // in a contractor's name is worse than no reply, and it hides the bill
    // that caused it. So the row carries the reason AND flags the thread.
    const flags = verdict.reason === SKIP.NO_CREDIT;
    const replyId = await recordReply(prisma, {
      companyId,
      employeeId: employee?.id || "unknown",
      threadId,
      messageId,
      suppressedReason: verdict.reason,
      handedOff: flags,
      handoffReason: flags ? SKIP.NO_CREDIT : null,
      instructionsFingerprint: employee?.instructionsFingerprint || null,
    });
    return { replied: false, reason: verdict.reason, mode: verdict.mode, replyId };
  }

  // ── Compose ────────────────────────────────────────────────────────────
  //
  // Sources are read under THIS companyId and handed to selectChunks, which
  // takes rows and never a database — so there is no query in the retrieval
  // path that could be written without a company on it. That is the tenant
  // fence for the prompt, and it is structural.
  const sources = await prisma.aiEmployeeSource.findMany({
    where: { companyId, employeeId: employee.id, status: "ready" },
    select: { id: true, title: true, kind: true, extractedText: true },
  });

  const inboundText = String(inbound || "").trim();
  const picked = selectChunks({ sources, query: inboundText, role: employee.role });

  const history = threadId ? await conversation(prisma, threadId) : [];
  // A dry run has no stored message to answer, so the caller's text IS the
  // conversation. Same composition either way.
  const messages = history.length
    ? history
    : [{ role: "user", content: inboundText || "(no message)" }];

  const definitions = definitionsForRole(employee.role);
  const tools = [];
  let handedOff = false;
  let handoffReason = null;

  const execute = executeFor({
    companyId,
    role: employee.role,
    dryRun,
    source: platformSource(thread),
    language: company?.defaultLanguage || null,
    onTool: ({ name, ok, summary }) => {
      tools.push({ name, ok, summary: summary || null });
      if (name === "hand_off_to_human") {
        handedOff = true;
        handoffReason = summary || "model_requested";
      }
    },
  });

  let usage = null;
  let text = "";
  try {
    const result = await runLoop({
      system: buildEmployeePrompt({ employee, company, sources: picked }),
      // The homeowner's words arrive as ordinary `user` turns, which is what
      // they are. The rule that stops one of them being read as an order is in
      // the system prompt (roles.js's DATA_RULE) rather than wrapped around
      // each message: a fence INSIDE a user turn is a fence the model can be
      // asked to ignore by the next user turn, and the tool RESULTS — the
      // place free text actually arrives from the database — are fenced where
      // that works, in tools.js.
      messages,
      tools: definitions,
      execute,
      // Three rounds: look something up, maybe price it, answer. A fourth is
      // almost always a model going round in circles, and every round resends
      // the whole prompt at the company's expense.
      maxRounds: 3,
      onUsage: (u) => {
        usage = u;
      },
    });
    text = String(result?.text || "").trim();
  } catch (err) {
    // A vendor failure is not a reply. Recorded rather than thrown, so the
    // ingest path that called this does not 500 and Meta does not retry.
    const replyId = await recordReply(prisma, {
      companyId,
      employeeId: employee.id,
      threadId,
      messageId,
      suppressedReason: "provider_error",
      instructionsFingerprint: employee.instructionsFingerprint || null,
      toolsUsed: tools,
    });
    console.error("[aiEmployee] reply failed:", err?.message);
    return { replied: false, reason: "provider_error", mode: verdict.mode, replyId };
  }

  // AFTER, on every path that spent — including the one that produced no text.
  // An expensive failure is exactly the case worth seeing in the numbers, which
  // is the same argument runToolLoop's own out-of-rounds branch makes.
  if (usage && !dryRun) {
    await recordUsage({ companyId, feature: AI_EMPLOYEE_FEATURE, ...usage });
  }

  const costCents = usage
    ? Math.ceil(
        estimateCostMicros({
          model: usage.model,
          promptTokens: usage.promptTokens || 0,
          completionTokens: usage.completionTokens || 0,
        }) / 10_000,
      )
    : 0;

  const named = picked.map((c) => ({ id: c.id, title: c.title, kind: c.kind }));

  if (dryRun) {
    return {
      replied: false,
      dryRun: true,
      reason: null,
      mode: verdict.mode,
      text,
      sources: named,
      tools,
      handedOff,
      costCents,
      usage,
    };
  }

  // The row is written BEFORE the send, so a send that throws still leaves the
  // record of what was composed and what it cost. The alternative loses both.
  const replyId = await recordReply(prisma, {
    companyId,
    employeeId: employee.id,
    threadId,
    messageId,
    draftText: text || null,
    model: usage?.model || null,
    promptTokens: usage?.promptTokens || 0,
    completionTokens: usage?.completionTokens || 0,
    costCents,
    toolsUsed: tools,
    handedOff,
    handoffReason,
    instructionsFingerprint: employee.instructionsFingerprint || null,
    // A loop that produced no words is recorded as such rather than as a
    // suggestion with an empty body somebody has to open to discover is empty.
    suppressedReason: text ? null : "no_text",
  });

  if (!text) {
    return { replied: false, reason: "no_text", mode: verdict.mode, replyId, tools };
  }

  if (verdict.mode !== MODE_AUTO || !send) {
    // SUGGEST. Nothing has been sent; the draft waits on the settings screen.
    return {
      replied: false,
      suggested: true,
      reason: null,
      mode: verdict.mode,
      text,
      sources: named,
      tools,
      handedOff,
      costCents,
      replyId,
    };
  }

  const sent = await send(text).catch((err) => ({ ok: false, reason: err?.message || "send_failed" }));

  if (sent?.ok) {
    await prisma.aiEmployeeReply.update({
      where: { id: replyId },
      data: { sentAt: new Date() },
    });
  } else {
    // The send refused — most often because Meta has not approved the channel
    // (app/api/messaging/threads/[id]/reply/route.js refuses loudly for the
    // same reason). The draft survives as a suggestion rather than being
    // discarded, and the reason is recorded.
    await prisma.aiEmployeeReply.update({
      where: { id: replyId },
      data: { suppressedReason: `send_failed:${sent?.reason || "unknown"}` },
    });
  }

  return {
    replied: Boolean(sent?.ok),
    suggested: !sent?.ok,
    reason: sent?.ok ? null : `send_failed:${sent?.reason || "unknown"}`,
    mode: verdict.mode,
    text,
    sources: named,
    tools,
    handedOff,
    costCents,
    replyId,
  };
}

/** The write. One place, so every path records the same columns. */
async function recordReply(prisma, data) {
  try {
    const row = await prisma.aiEmployeeReply.create({ data });
    return row?.id || null;
  } catch (err) {
    // Same rule recordAiUsage follows: a bookkeeping failure must not turn a
    // working reply into an error. The worst case is a missing audit row,
    // which is FieldQuo's problem and not the homeowner's.
    console.error("[aiEmployee] failed to record reply:", err?.message);
    return null;
  }
}

/** The lead source for a callback taken on this thread — see tools.js. */
function platformSource(thread) {
  switch (thread?.channel?.platform) {
    case "facebook":
      return "meta_messenger";
    case "instagram":
      return "meta_instagram";
    default:
      return "ai_employee";
  }
}

export { instructionsFingerprint, roleFor };
