// lib/voice/outboundCall.js
//
// Queueing an outbound call, and — when the time is right — placing it.
//
// ══ Two steps on purpose ═══════════════════════════════════════════════════
//
// enqueueOutbound() records the INTENT. placeQueuedCall() acts on it, later,
// from the cron. They're separate because the moment a trigger fires (a quote
// approved at 9pm) is almost never the moment it's decent to call. The queue
// carries the "not yet", and every gate is re-checked at dial time rather than
// enqueue time — a number can opt out, or the credit can run dry, in the hours
// between.
//
// ══ Nothing here trusts a stored phone number ══════════════════════════════
//
// The task links a lead/client/quote, not a number. The number is read from
// that record when the call is about to be placed, so a corrected number or a
// fresh opt-out takes effect even for a call already queued. A queue full of
// frozen numbers is how you ring the wrong person a week after they changed it.
import { db } from "@/lib/db";
import { toE164 } from "./numbers";
import { mayCall } from "./outbound";
import { canTakeCall } from "./credits";
// Availability, not affordability — see lib/features/gate.js.
import { featureAllowsSpend } from "@/lib/features/gate";
import { createPhoneCall } from "./retell";
import { voiceConfigured } from "./retell";
import { buildOutboundPrompt, purposeSpec, contextComplete, spokenTotal } from "./outboundPrompt";

/**
 * Queue an outbound call.
 *
 * Deliberately forgiving about WHEN — pass `notBefore` to hold it (the trigger
 * uses "next morning" for anything fired after hours). Deliberately strict
 * about WHAT — an unknown purpose is refused here, because a task that can
 * never run is worse than no task.
 */
export async function enqueueOutbound({
  companyId,
  purpose,
  leadId = null,
  clientId = null,
  quoteId = null,
  jobId = null,
  bookingId = null,
  context = {},
  notBefore = null,
}) {
  if (!companyId || !purposeSpec(purpose)) return null;

  // De-dupe: one live task per (company, purpose, subject). A quote re-saved
  // three times must not queue three calls to the same person.
  const subject = { leadId, clientId, quoteId, jobId, bookingId };
  const existing = await db.voiceCallTask.findFirst({
    where: {
      companyId,
      purpose,
      status: { in: ["queued", "calling"] },
      ...subject,
    },
    select: { id: true },
  });
  if (existing) return existing;

  return db.voiceCallTask.create({
    data: {
      companyId,
      purpose,
      leadId,
      clientId,
      quoteId,
      jobId,
      bookingId,
      context,
      ...(notBefore ? { notBefore } : {}),
    },
  });
}

/** The number to dial and a display name, from whatever the task links. */
async function resolveTarget(task) {
  if (task.clientId) {
    const c = await db.client.findUnique({
      where: { id: task.clientId },
      select: { phone: true, name: true, language: true, email: true },
    });
    if (c?.phone) return { e164: toE164(c.phone), name: c.name, language: c.language, clientId: task.clientId };
  }
  if (task.leadId) {
    const l = await db.leadRequest.findUnique({
      where: { id: task.leadId },
      select: { phone: true, name: true },
    });
    if (l?.phone) return { e164: toE164(l.phone), name: l.name, leadId: task.leadId };
  }
  return null;
}

/**
 * The company's own number to call FROM, and its outbound agent.
 *
 * Both required — no number means no caller ID and no way for the webhook to
 * tie the call back to the company; no outbound agent means no brief, and a
 * call with no brief is worse than one not placed.
 */
async function resolveCaller(companyId) {
  const [number, agent] = await Promise.all([
    db.voicePhoneNumber.findFirst({
      where: { companyId, status: "active" },
      select: { e164: true, numberType: true },
    }),
    db.voiceAgent.findUnique({
      where: { companyId },
      select: { outboundProviderAgentId: true },
    }),
  ]);
  return { number, outboundAgentId: agent?.outboundProviderAgentId || null };
}

/**
 * Try to place one queued call, right now.
 *
 * Returns a small verdict object rather than throwing, so the cron can record
 * an outcome per task and move on. Every "no" is a string a person can read —
 * "no consent on file" is actionable where a false isn't.
 *
 * @returns { placed, reason, retryLater? }
 */
export async function placeQueuedCall(task, { now = new Date() } = {}) {
  if (!voiceConfigured()) return { placed: false, reason: "Voice isn't configured." };

  const company = await db.company.findUnique({
    where: { id: task.companyId },
    select: { name: true, timezone: true, outboundCallsEnabled: true },
  });
  if (!company) return { placed: false, reason: "No such company." };

  // Has FieldQuo withdrawn voice from this company? Checked before consent and
  // before credit, because those are questions about whether the CONTRACTOR may
  // make this call and this one is about whether the platform is offering the
  // feature at all.
  //
  // retryLater, not terminal: withdrawal is usually temporary (a kill switch
  // while something is fixed), and a terminal verdict would quietly discard a
  // queue of confirmation calls that should go out the moment it comes back.
  // The task waits; nothing is lost.
  if (!(await featureAllowsSpend(task.companyId, "voice_receptionist"))) {
    return {
      placed: false,
      reason: "The phone assistant isn't available on this account right now.",
      retryLater: true,
    };
  }

  // ── The contractor's own outbound switch, re-checked HERE ────────────────
  //
  // `outboundCallsEnabled` was selected on the query above and then never read
  // — a dead read on the one field that decides whether we ring anybody. It IS
  // checked in lib/voice/triggers.js, but that is enqueue time, and this file's
  // own header says why that isn't enough: "every gate is re-checked at dial
  // time rather than enqueue time". A contractor who switched outbound calls
  // off at 9am still had the morning's queue dialled at 11.
  //
  // retryLater rather than terminal, matching the withdrawal case above:
  // switching the feature back on should let a held confirmation call go out,
  // not find its queue quietly discarded.
  if (!company.outboundCallsEnabled) {
    return {
      placed: false,
      reason: "Outbound calls are switched off for this company.",
      retryLater: true,
    };
  }

  const target = await resolveTarget(task);
  if (!target?.e164) {
    // No number, and none is going to appear on a queued task — terminal.
    return { placed: false, reason: "No usable phone number on the linked record.", terminal: true };
  }

  // Consent + calling hours, re-checked NOW. retryLater (outside hours) is not a
  // failure — the cron leaves the task queued and tries again next run.
  const may = await mayCall({
    companyId: task.companyId,
    phone: target.e164,
    now,
    timeZone: company.timezone || undefined,
  });
  if (!may.allowed) {
    // Outside hours is "not yet" — requeue. Anything else (opted out, no
    // consent, expired, unusable number) is "not ever, for this task" — the
    // cron marks it skipped rather than burning retries on a call it will never
    // be allowed to make.
    return {
      placed: false,
      reason: may.reason,
      retryLater: Boolean(may.retryLater),
      terminal: !may.retryLater,
    };
  }

  const { number, outboundAgentId } = await resolveCaller(task.companyId);
  // A missing number or agent is a setup problem, not a bad-time problem — hold
  // the task (retryLater) rather than skip it, so it goes out once the company
  // finishes setting voice up instead of being silently dropped.
  if (!number?.e164) return { placed: false, reason: "No active phone number to call from.", retryLater: true };
  if (!outboundAgentId) return { placed: false, reason: "The outbound agent isn't set up.", retryLater: true };

  // ── Credit, priced against the number we are about to dial FROM ──────────
  //
  // Moved below resolveCaller for one reason: the type. A toll-free line costs
  // 40¢ a minute, and asking canTakeCall without one checks against the 35¢
  // local rate — so a company with 37¢ passed the gate and ended the call 3¢ in
  // the red. Same fix syncNumberAttachment already carries.
  //
  // This gate matters more than the inbound one, not less. Detaching the agent
  // stops a stranger's call being ANSWERED; it does nothing about a call we
  // initiate, and an outbound minute costs FieldQuo's shared Retell account
  // exactly what an inbound minute costs. Without this check, a company at zero
  // credit still dials out on the pool's money.
  const credit = await canTakeCall(task.companyId, number.numberType);
  if (!credit.allowed) {
    return { placed: false, reason: "Not enough voice credit to place a call.", retryLater: true };
  }

  // ── The quote is re-checked NOW, like consent and credit ────────────────
  //
  // A task queued when a quote was approved and emailed can reach the dialler
  // after it was un-approved, adjusted, or deleted. Re-reading it here is the
  // same rule the rest of this function follows: nothing frozen at enqueue time
  // decides anything at dial time.
  const quoteNow = await quoteStateNow(task);
  if (quoteNow.refuse) {
    return { placed: false, reason: quoteNow.refuse, terminal: true };
  }

  // Build the brief. Company name and the customer's first name are merged in
  // here, alongside whatever the trigger stored (a quote total a human already
  // approved, an appointment time). contextComplete has the final say — a
  // purpose missing a required variable is skipped, not dialled blind.
  const context = {
    companyName: company.name,
    customerName: firstName(target.name),
    ...task.context,
    ...quoteNow.context,
  };
  if (!contextComplete(task.purpose, context).ok) {
    return { placed: false, reason: "Missing details the call needs." };
  }

  const built = buildOutboundPrompt({ purpose: task.purpose, context });
  if (!built) return { placed: false, reason: "Couldn't build the call script." };

  let created;
  try {
    created = await createPhoneCall({
      fromE164: number.e164,
      toE164: target.e164,
      agentId: outboundAgentId,
      dynamicVariables: { outbound_prompt: built.prompt, opening: built.opening },
      metadata: { companyId: task.companyId, purpose: task.purpose, taskId: task.id },
    });
  } catch (err) {
    return { placed: false, reason: err.message || "The provider refused the call." };
  }

  const providerCallId = created?.call_id;
  if (!providerCallId) return { placed: false, reason: "The provider didn't return a call id." };

  // Create the VoiceCall row NOW, with the subject links, so a mid-call tool
  // invocation (save_caller) updates the RIGHT lead/client instead of creating
  // a stray one — the tool route resolves context from this row.
  await db.voiceCall.upsert({
    where: { providerCallId },
    create: {
      providerCallId,
      companyId: task.companyId,
      direction: "outbound",
      fromE164: number.e164,
      toE164: target.e164,
      leadId: target.leadId || task.leadId || null,
      clientId: target.clientId || task.clientId || null,
      bookingId: task.bookingId || null,
      startedAt: now,
    },
    update: {},
  });

  return { placed: true, reason: purposeSpec(task.purpose).label, providerCallId };
}

/**
 * For a quote-linked task: is the quote still callable, and is the figure the
 * agent was handed still the one the client was emailed?
 *
 * ── Why the figure is re-derived rather than trusted ───────────────────────
 *
 * Outbound rule 3 lets the agent state a quote total, on one condition: a human
 * already committed to it. Once the quote has been emailed, that condition is
 * "the client is holding this number in writing". If somebody edits the total
 * between the send and the call, the figure on the task is no longer the figure
 * in the client's inbox — so it is DROPPED, and the purpose's own brief falls
 * back to "you do not have the quote figure; do not guess it". A call that says
 * "someone will go through the numbers with you" is a slightly weaker call; a
 * call that reads out a number the client has never seen is a different problem
 * entirely.
 *
 * @returns {{ refuse?: string, context: object }}
 */
async function quoteStateNow(task) {
  if (!task?.quoteId) return { context: {} };

  const quote = await db.quote
    .findUnique({
      where: { id: task.quoteId },
      select: {
        total: true,
        needsReview: true,
        sentAt: true,
        company: { select: { currency: true } },
      },
    })
    .catch(() => null);

  if (!quote) return { refuse: "That quote no longer exists.", context: {} };
  if (quote.needsReview) {
    return { refuse: "That quote went back to needing review — nobody has approved it.", context: {} };
  }
  if (!quote.sentAt) {
    return { refuse: "That quote hasn't been emailed to them yet.", context: {} };
  }

  const queued = task.context?.quoteTotal;
  if (!queued) return { context: {} };

  // The SAME formatter triggers.js used to write it, so "did the figure move?"
  // compares two numbers rather than two spellings.
  const live = spokenTotal(quote.total, quote.company?.currency || "CAD");
  // Explicit undefined, not an omission: this object is spread OVER task.context,
  // so only writing the key can clear a stale figure that came from it.
  return { context: live === queued ? {} : { quoteTotal: undefined } };
}

/** "Sam Rivera" → "Sam". Empty stays empty — the opening handles a missing name. */
function firstName(name) {
  const n = String(name || "").trim();
  return n ? n.split(/\s+/)[0] : "";
}
