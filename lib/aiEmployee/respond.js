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
// ══ Three modes, and the safe one is the default ═══════════════════════════
//
// `ask` writes an AiEmployeeReply with `sentAt` null: a draft waiting for a
// person, and every tool with a side effect becomes an AiEmployeeProposal.
// `accept_edits` sends the reply (a reversible act) and still proposes
// anything that commits. `auto` sends and books. All three go through the
// SAME composition — the mode changes only what happens to the finished text
// and to each tool call (lib/aiEmployee/permission.js's mayActAlone, asked
// inside tools.js's executeFor), so there is exactly one path a reply can be
// produced by, and a contractor reading a draft is reading what would have
// gone out.
//
// ══ The best model, because a company pays for it by the token ═════════════
//
// `tier: "best"` on the tool loop — lib/ai/provider.js's BEST_MODEL. The
// employee holds a conversation with a stranger in the company's name and
// can put a slot on the calendar; the owner's decision is that this runs on
// the best model and is metered at that model's real rate (lib/ai/usage.js).
//
// ══ …paid in dollars from the company's AI credit (owner, 2026-09-25) ══════
//
// "The AI chat settings in the agentic employee should be theirs to pay —
// their own chat bot." Metered through meterFor("ai_employee_reply")
// (lib/ai/featurePayer.js), whose company ledger for this feature is the AI
// WALLET (lib/ai/walletMeter.js): before the call the balance must cover one
// typical reply, or the verdict is NO_CREDIT and nothing reaches the model;
// after it, the actual cost × the pay-as-you-go multiplier is debited once,
// keyed on the AiEmployeeReply row it paid for. The AiUsage row is still
// written, marked paidFromWallet. Until AI_EMPLOYEE_GRACE_ENDS_ON a company
// whose wallet cannot cover a reply keeps the old monthly-allowance
// behaviour, so nobody's employee went silent on the day this shipped.
//
// ══ Out of credit: a person is fetched, never a silent stop ════════════════
//
// NO_CREDIT writes the refusal, flags the thread handed-off AND raises an
// "ai_employee.handoff" notification, so the channel layer can tell the
// customer someone will reply shortly and a person at the company is told
// why the employee went quiet. The one thing it never does is produce a
// cheaper reply.
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

import { randomUUID } from "node:crypto";
import { db } from "@/lib/db";
import { CONVERSATION_DIRECTIONS } from "@/lib/messaging/messageKinds";
import { runToolLoop, isAiConfigured } from "@/lib/ai/provider";
import { checkAiQuota, recordAiUsage, estimateCostMicros } from "@/lib/ai/usage";
import { meterFor } from "@/lib/ai/featurePayer";
import { buildEmployeePrompt, instructionsFingerprint, roleFor, disclosureLine } from "./roles";
import { attachmentTally, mediaClaimRefusal } from "./evidence";
import { selectChunks } from "./sources";
import { SKIP, shouldReply, sendMode, withinBusinessHours } from "./decide";
import { serviceWindowState, needsServiceWindow } from "@/lib/messaging/serviceWindow";
import { sourceForPlatform } from "@/lib/messaging/platforms";
import { definitionsForRole, executeFor } from "./tools";
import { mayActAlone, RISK_REVERSIBLE } from "./permission";
import { employeeForChannel, isChannel } from "./employees";
import { createProposal } from "./proposals";
import { notifyEvent } from "@/lib/notifications/notify";
import {
  assignThread,
  burstGate,
  superseded,
  logRouting,
  introductionLine,
  HAND_OFF_TOOL,
} from "./routing";

/** The tier every employee conversation runs on. Asserted by the check. */
export const AI_EMPLOYEE_TIER = "best";

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
 * What the customer has actually attached, over the WHOLE thread.
 *
 * Deliberately not folded into conversation() above, which takes the last
 * twelve turns: a photo that arrived fifteen messages ago is still a photo
 * that arrived, and counting only the window the model can see would produce
 * "0 attachments" for a thread that has one — the guard then refusing a reply
 * that correctly mentions it. The window is about what the model READS; this
 * is about what is TRUE.
 *
 * 200 is a ceiling, not a page: a messaging thread with more than 200 inbound
 * messages is a thread nobody is drafting a first reply to, and an unbounded
 * findMany on a Json column is how one pathological conversation times out an
 * ingest webhook.
 */
async function attachmentsOnThread(prisma, threadId) {
  const rows = await prisma.message.findMany({
    where: { threadId, direction: "in" },
    orderBy: { sentAt: "desc" },
    take: 200,
    select: { direction: true, attachments: true },
  });
  return attachmentTally(rows);
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
  // "meta" | "web" | "sms" — picks WHICH employee answers
  // (lib/aiEmployee/employees.js) and is stamped on any proposal.
  channel = "meta",
  // The test box names an employee directly (a company may have several);
  // read under companyId, so it can only ever be one of the company's own.
  employeeId = null,
  // The customer's language, for the disclosure line. The company's default
  // when the channel does not know better.
  language = null,
  dryRun = false,
  // The test box's typed message. Only read on a dry run — a real reply
  // answers a Message row that exists, and letting a caller supply the
  // customer's words for a live send would be a way to make the employee say
  // something to a homeowner that they never wrote.
  testText = "",
  send = null,
  // 0 for the turn that answers the homeowner; 1 when this call is the
  // COLLEAGUE a hand-off just moved the thread to (lib/aiEmployee/routing.js).
  // At depth 1 the hand-off tool is withheld — one inbound message moves a
  // thread once — and the reply opens with the introduction line.
  handOffDepth = 0,
  deps = {},
} = {}) {
  const {
    db: prisma = db,
    checkAiQuota: checkQuota = checkAiQuota,
    recordAiUsage: recordUsage = recordAiUsage,
    meterFor: meterForFn = meterFor,
    runToolLoop: runLoop = runToolLoop,
    isAiConfigured: aiConfigured = isAiConfigured,
    notify = notifyEvent,
    sleep = undefined,
    // The clock the wallet's grace window is read against. A check pins it.
    now = null,
  } = deps;

  const chan = isChannel(channel) ? channel : "meta";
  const afterHandOff = handOffDepth > 0;

  let [employee, company, thread, message] = await Promise.all([
    // ── Who answers ──────────────────────────────────────────────────────
    //
    // On a real thread this is provisional: the ROUTING below decides, and
    // an employee named here that is not the thread's assignee is refused
    // (NOT_ASSIGNEE). The test box names one directly and has no thread, so
    // for it this IS the answer; with no name and no thread, the channel's
    // employee stands in. Both reads are under companyId, so it can only
    // ever be one of the company's own. An employee switched off is null,
    // and null is the NO_EMPLOYEE verdict: nothing routes to it, nothing is
    // proposed for it, nothing is metered against it.
    employeeId
      ? prisma.aiEmployee.findFirst({ where: { id: employeeId, companyId } })
      : threadId
        ? null
        : employeeForChannel(companyId, chan, prisma),
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
            // The 24-hour customer service window's one input. Read with the
            // thread so the guard below is a FACT the verdict is given, not a
            // second query the pure function would have to make.
            lastInboundAt: true,
            // Routing state — lib/aiEmployee/routing.js. Who holds the
            // thread, what the front desk decided, and whether a person has
            // taken it over.
            assignedEmployeeId: true,
            routingIntent: true,
            routingReason: true,
            humanTookOverAt: true,
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

  // ── The routing gate ─────────────────────────────────────────────────────
  //
  // Three things happen here, in this order, on a real thread only (a dry
  // run has no thread and nothing to route):
  //
  //   1. The burst lock's first half. The message waits a moment and yields
  //      if a newer one from the same person has landed — its turn answers
  //      both. Only at depth 0: a colleague's turn is already the answer to
  //      the message that moved the thread.
  //   2. A person who took the thread over silences everyone. The stamp is
  //      read off the row and handed to shouldReply as a fact.
  //   3. The assignee. assignThread returns the employee that holds the
  //      thread, running the front desk if nobody does yet. An employee
  //      named by the caller that is not the assignee is REFUSED, before any
  //      quota is checked or prompt built. This line is what makes "only the
  //      assignee replies" true; the check calls this function for two
  //      employees on one thread and asserts exactly one composes.
  if (threadId && thread && !dryRun) {
    if (!afterHandOff && message?.sentAt) {
      const gate = await burstGate({ companyId, threadId, messageId, sentAt: message.sentAt, prisma, ...(sleep ? { sleep } : {}) });
      if (gate.merged) {
        return { replied: false, reason: SKIP.BURST_MERGED, mode: sendMode(employee), burst: gate.burst };
      }
    }
    // A person holds it. Returned here, before any read or spend — the
    // thread has no assignee to load and nothing to route — and handed to
    // shouldReply below as well for the paths that reach it.
    if (thread.humanTookOverAt) {
      return { replied: false, reason: SKIP.HUMAN_TOOK_OVER, mode: sendMode(employee) };
    }
    const routed = await assignThread({ companyId, thread, channel: chan, text: message?.body, prisma, deps });
    if (routed.employee && employee && employee.id !== routed.employee.id) {
      return { replied: false, reason: SKIP.NOT_ASSIGNEE, mode: sendMode(employee), assignedEmployeeId: routed.employee.id };
    }
    employee = routed.employee;
  }

  // Who pays for this reply — the company's AI credit, by default — and the
  // gate that decides whether it may be written at all.
  const meter = await meterForFn(AI_EMPLOYEE_FEATURE, {
    companyId,
    prisma,
    now,
    deps: { checkAiQuota: checkQuota, recordAiUsage: recordUsage },
  });

  const [state, quota] = await Promise.all([
    threadId
      ? threadState(prisma, companyId, threadId)
      : Promise.resolve({ handedOff: false, repliesSoFar: 0 }),
    // BEFORE the call, on every path including the dry run — a test box that
    // spent credit a company did not have would be the one surface where the
    // rule was skipped, and it is the surface people press repeatedly. A
    // wallet that cannot cover one reply comes back allowed: false, which
    // shouldReply turns into NO_CREDIT — no model call, a person fetched.
    meter.check(),
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
    humanTookOver: Boolean(thread?.humanTookOverAt),
    handedOff: state.handedOff,
    repliesSoFar: state.repliesSoFar,
    // ── WhatsApp's 24-hour window ────────────────────────────────────────
    //
    // Computed from the thread that was just read, through the same pure
    // function the composer and the send path use — one definition of "is the
    // window open", so the employee cannot disagree with the screen.
    //
    // `.open` is TRUE for Facebook and Instagram: serviceWindowState is only
    // consulted for a platform that has a window of ours (see
    // needsServiceWindow), and a thread with no channel at all is the test
    // box, which never sends.
    serviceWindowOpen: needsServiceWindow(thread?.channel?.platform)
      ? serviceWindowState(thread?.lastInboundAt).open
      : true,
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
    if (flags) {
      // Human-visible, by name. The customer is told "someone will reply
      // shortly" by the channel layer; this is the half that tells the
      // company WHY, and that it is the bill.
      await notify({
        companyId,
        type: "ai_employee.handoff",
        entityId: threadId,
        params: { reason: SKIP.NO_CREDIT, channel: chan },
      }).catch(() => {});
    }
    return { replied: false, reason: verdict.reason, mode: verdict.mode, replyId, handedOff: flags };
  }

  // ── Compose ────────────────────────────────────────────────────────────
  //
  // Sources are read under THIS companyId and handed to selectChunks, which
  // takes rows and never a database — so there is no query in the retrieval
  // path that could be written without a company on it. That is the tenant
  // fence for the prompt, and it is structural.
  const sources = await prisma.aiEmployeeSource.findMany({
    // The COMPANY'S material, whichever of its employees is answering — a
    // policy uploaded for the receptionist is the closer's policy too.
    where: { companyId, status: "ready" },
    select: { id: true, title: true, kind: true, extractedText: true },
  });

  const inboundText = String(inbound || "").trim();
  const picked = selectChunks({ sources, query: inboundText, role: employee.role });

  const [history, tally] = await Promise.all([
    threadId ? conversation(prisma, threadId) : Promise.resolve([]),
    // A dry run has no thread, so nothing has been attached — which is the
    // truthful tally and the one the test box should compose against.
    threadId ? attachmentsOnThread(prisma, threadId) : Promise.resolve(attachmentTally([])),
  ]);
  // A dry run has no stored message to answer, so the caller's text IS the
  // conversation. Same composition either way.
  const messages = history.length
    ? history
    : [{ role: "user", content: inboundText || "(no message)" }];

  const definitions = definitionsForRole(employee.role, {
    disabledTools: employee.disabledTools,
    afterHandOff,
  });
  const tools = [];
  // Proposals the mode would not let run. Collected during the loop and
  // written AFTER the reply row exists, so each carries the replyId it came
  // from — inside the loop that id does not exist yet.
  const pendingProposals = [];
  let handedOff = false;
  let handoffReason = null;
  // The colleague a hand-off moved the thread to, if the model made one.
  let handOffTo = null;

  const execute = executeFor({
    companyId,
    role: employee.role,
    mode: verdict.mode,
    // Every channel turn's input came from the customer. Tainted, always.
    tainted: true,
    dryRun,
    source: chan === "meta" ? platformSource(thread) : chan === "web" ? "web_chat" : "sms",
    language: language || company?.defaultLanguage || null,
    // The company's switches and the thread context the hand-off needs —
    // injected, never taken from the model (tools.js's header).
    disabledTools: employee.disabledTools,
    threadId,
    employeeId: employee.id,
    afterHandOff,
    prisma,
    onTool: ({ name, ok, summary, result }) => {
      tools.push({ name, ok, summary: summary || null });
      if (name === "hand_off_to_human") {
        handedOff = true;
        handoffReason = summary || "model_requested";
      }
      if (name === HAND_OFF_TOOL) {
        // Ping-pong: the routing layer refused a second hand-off inside ten
        // minutes and sent the thread to a person instead. Read exactly as
        // hand_off_to_human is — the same flag, the same notification.
        if (result?.handedOff === true) {
          handedOff = true;
          handoffReason = `ping_pong`;
        } else if (result?.ok && result?.toEmployeeId) {
          handOffTo = { id: result.toEmployeeId, name: result.toName || null };
        }
      }
    },
    onProposal: async ({ name, args, risk }) => {
      pendingProposals.push({ name, args, risk });
      return null;
    },
  });

  let usage = null;
  let text = "";
  try {
    const result = await runLoop({
      system: buildEmployeePrompt({ employee, company, sources: picked, tally }),
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
      // Four rounds: check the calendar, book, maybe look a price up, answer.
      // A fifth is almost always a model going round in circles, and every
      // round resends the whole prompt at the company's expense.
      maxRounds: 4,
      // The best model, at medium effort — see the header.
      tier: AI_EMPLOYEE_TIER,
      reasoningEffort: "medium",
      onUsage: (u) => {
        usage = u;
      },
    });
    text = String(result?.text || "").trim();
    // ── The disclosure, on the first message of every channel ───────────
    //
    // "Hi, I'm {name}, {Company}'s AI assistant." Prepended HERE, once, on
    // the first reply the employee produces on a thread — not left to the
    // model, which applies a rule most of the time. The customer's language,
    // because it is the customer reading it.
    if (text && state.repliesSoFar === 0) {
      text = `${disclosureLine({
        displayName: employee.displayName || employee.name,
        companyName: company?.name,
        language: language || company?.defaultLanguage || "en",
      })} ${text}`;
    }
    // ── The introduction, on the turn after a hand-off ──────────────────
    //
    // "{name} here — I'll take it from here." Prepended for the same reason
    // the disclosure is: a homeowner is entitled to know a different
    // colleague is now writing, and a rule the model applies is a rule it
    // applies most of the time. Once, at depth 1, never on the answering
    // turn.
    if (text && afterHandOff) {
      text = `${introductionLine({
        displayName: employee.displayName || employee.name,
        language: language || company?.defaultLanguage || "en",
      })} ${text}`;
    }
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
  //
  // Called once per path, right after that path's AiEmployeeReply row exists,
  // because the row's id is the debit's idempotency key: the ledger's unique
  // (companyId, ref) index means a second settle for the same reply finds the
  // first debit instead of writing another. The AiUsage row is written by the
  // meter on the same call. The charge is then stamped on the reply
  // (chargedCents) — only once the ledger entry exists, so the conversation
  // never shows a charge the statement does not.
  //
  // The test box has no reply row; it is charged under a one-off ref, because
  // it really does call the model — the screen says so beside the button.
  const settle = async (replyId) => {
    if (!usage) return 0;
    const out = await meter.record(usage, {
      ref: replyId ? `ai_employee_reply:${replyId}` : dryRun ? `ai_employee_test:${randomUUID()}` : null,
      note: dryRun
        ? `AI employee test — ${employee.displayName || employee.name || "assistant"}`
        : `AI employee reply — ${employee.displayName || employee.name || "assistant"}`,
    });
    const charged = Math.max(0, Math.round(Number(out?.chargedCents) || 0));
    if (replyId && charged > 0) {
      await prisma.aiEmployeeReply
        .update({ where: { id: replyId }, data: { chargedCents: charged } })
        .catch((err) => console.error("[aiEmployee] failed to stamp the charge:", err?.message));
    }
    return charged;
  };

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

  // ── The hallucination gate ─────────────────────────────────────────────
  //
  // The prompt now states the attachment count (roles.js, via evidence.js), and
  // that is the braces. This is the belt: a draft that claims to have received
  // or seen a photo when the thread has none does not go out, in either mode.
  //
  // Read AFTER the model has written and BEFORE anything is sent or offered,
  // because that is the only place a claim can be checked against the record.
  // It is deliberately cheap — a regex over one message, no second model call —
  // for the same reason lib/voice/autoDraft.js keeps its guards out of the
  // provider: a guard that costs a call is a guard somebody turns off.
  const mediaRefusal = mediaClaimRefusal({ text, tally });

  // ── The burst lock's second half ─────────────────────────────────────────
  //
  // A newer message from the same person landed while this one was being
  // composed. The reply was written to a question that has since grown, and
  // the newer message's own turn — which read the whole thread — answers
  // both. Recorded as a spend (the row keeps the words and the cost), never
  // sent, never offered as a draft. Depth 0 only: a colleague's turn is the
  // answer to the message that moved the thread.
  if (!dryRun && !afterHandOff && threadId && message?.sentAt && (await superseded(prisma, { threadId, messageId, sentAt: message.sentAt }))) {
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
      suppressedReason: SKIP.BURST_MERGED,
      instructionsFingerprint: employee.instructionsFingerprint || null,
    });
    // Composed, never sent — and still paid for: the model was called.
    const chargedCents = await settle(replyId);
    await logRouting(prisma, { companyId, threadId, kind: "burst_merged", reason: "composed_then_superseded" });
    return { replied: false, reason: SKIP.BURST_MERGED, mode: verdict.mode, replyId, tools, chargedCents };
  }

  if (dryRun) {
    const chargedCents = await settle(null);
    return {
      replied: false,
      dryRun: true,
      channel: chan,
      employeeId: employee.id,
      // What a real message in this mode would do: sent, or waiting.
      wouldSend: mayActAlone({ mode: verdict.mode, risk: RISK_REVERSIBLE }),
      wouldPropose: tools.filter((x) => x.summary === "would_propose").map((x) => x.name),
      model: usage?.model || null,
      // The test box is shown the refusal too. A contractor pressing it and
      // being shown words that would never have been sent is the settings
      // screen lying about its own feature.
      reason: mediaRefusal,
      mode: verdict.mode,
      text,
      sources: named,
      tools,
      handedOff: handedOff || Boolean(mediaRefusal),
      costCents,
      // What the AI credit was actually debited for this test (0 when it ran
      // on the allowance, or FieldQuo paid).
      chargedCents,
      usage,
    };
  }

  if (mediaRefusal) {
    // handedOff, not merely suppressed. The same argument the NO_CREDIT branch
    // above makes: the homeowner asked something and is getting nothing, and a
    // stop nobody is told about is indistinguishable from the feature not
    // working. This one is stronger — the model has just demonstrated it is
    // writing about a photograph that does not exist, so the conversation
    // belongs to a person until somebody presses Resume on it.
    //
    // draftText is kept, as "dismissed_by_user" keeps it: the row is a spend
    // record first, and the refused words are the only way to see WHAT it
    // claimed. It is excluded from the suggestion list by suppressedReason —
    // see app/api/ai-employee/suggestions/route.js's where clause — so it is
    // recorded without ever being offered.
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
      handedOff: true,
      handoffReason: mediaRefusal,
      suppressedReason: mediaRefusal,
      instructionsFingerprint: employee.instructionsFingerprint || null,
    });
    await settle(replyId);
    await notify({
      companyId,
      type: "ai_employee.handoff",
      entityId: threadId,
      params: { reason: mediaRefusal, channel: chan },
    }).catch(() => {});
    return { replied: false, reason: mediaRefusal, mode: verdict.mode, replyId, tools, handedOff: true };
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
  // Before the send: a send that fails still spent the model call.
  const chargedCents = await settle(replyId);

  if (handedOff) {
    // The model fetched a person. Told to the company the same way the
    // out-of-credit stop is, so "it stopped on these" is never only a list
    // somebody has to remember to open.
    await notify({
      companyId,
      type: "ai_employee.handoff",
      entityId: threadId,
      params: { reason: handoffReason || "model_requested", channel: chan },
    }).catch(() => {});
  }

  // ── The proposals, now that the reply row they belong to exists ─────────
  const proposalIds = [];
  for (const p of pendingProposals) {
    const id = await createProposal(
      {
        companyId,
        employeeId: employee.id,
        threadId,
        replyId,
        channel: chan,
        name: p.name,
        args: p.args,
        risk: p.risk,
        history: messages,
      },
      { db: prisma, notify },
    );
    if (id) proposalIds.push(id);
  }

  if (!text) {
    return { replied: false, reason: "no_text", mode: verdict.mode, replyId, tools, proposalIds, chargedCents };
  }

  // A reply is a REVERSIBLE act: it goes out alone in accept_edits and auto,
  // and waits as a draft in ask. Same function, same matrix as the tools.
  const sendAlone = mayActAlone({ mode: verdict.mode, risk: RISK_REVERSIBLE, tainted: true });

  if (!sendAlone || !send) {
    // ask (or no sender). Nothing has been sent; the draft waits on the
    // settings screen with any proposals beside it.
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
      chargedCents,
      replyId,
      proposalIds,
      // The colleague's draft follows this one — both wait for a person, in
      // the order the homeowner would have read them.
      colleague: handOffTo ? await followHandOff() : null,
    };
  }

  const sent = await send(text, { employeeId: employee.id }).catch((err) => ({ ok: false, reason: err?.message || "send_failed" }));

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
    chargedCents,
    replyId,
    proposalIds,
    // ── The colleague's turn ───────────────────────────────────────────
    //
    // After THIS employee's one-line "my colleague will take it from here"
    // has gone, the colleague answers the same message with the whole
    // thread in front of it. Same function, same send, depth 1 — so the
    // hand-off tool is withheld and the introduction line is prepended.
    // The assignment already moved inside the tool, so the routing gate
    // above admits the colleague and would now refuse this employee.
    colleague: handOffTo ? await followHandOff() : null,
  };

  /** The colleague's turn on the same message. Never throws. */
  async function followHandOff() {
    if (!handOffTo || afterHandOff) return null;
    try {
      const next = await respondToMessage({
        companyId,
        threadId,
        messageId,
        channel: chan,
        employeeId: handOffTo.id,
        language,
        send,
        handOffDepth: handOffDepth + 1,
        deps,
      });
      return { employeeId: handOffTo.id, replied: Boolean(next?.replied), suggested: Boolean(next?.suggested), reason: next?.reason || null, replyId: next?.replyId || null };
    } catch (err) {
      console.error("[aiEmployee] colleague turn failed:", err?.message);
      return { employeeId: handOffTo.id, replied: false, suggested: false, reason: "error", replyId: null };
    }
  }
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

/**
 * The lead source for a callback taken on this thread — see tools.js.
 *
 * The map used to live here AND in lib/attribution/loadMonthlyConversations.js,
 * two copies of the same three-line lookup. They are one now
 * (lib/messaging/platforms.js): the copy nobody looks at is the one that rots,
 * and here that would have meant a WhatsApp lead filed under no source at all
 * while the month-end rollup counted it correctly — or the reverse.
 *
 * The fallback is "ai_employee" rather than null: a callback booked with no
 * thread behind it (the test box) genuinely came from the employee.
 */
function platformSource(thread) {
  return sourceForPlatform(thread?.channel?.platform, "ai_employee");
}

export { instructionsFingerprint, roleFor };
