// lib/platform/salesNumberCandidates.js
//
// Which numbers FIELDQUO_SALES_NUMBER could legitimately be set to.
//
// ══ Why a broken screen should name the fix's ingredients ══════════════════
//
// /platform/sales-agent, with the variable unset, says "Set
// FIELDQUO_SALES_NUMBER to a number bought on the Retell account". True, and
// useless on its own: the owner then has to work out WHICH number, on a
// different screen — where the likeliest answer is a toll-free number Retell
// bills FieldQuo for that no company holds, currently filed under "billing
// leak" on /platform/voice-numbers. Two screens describing one situation from
// opposite ends, and neither mentioning the other.
//
// ══ The filter is the safety property ══════════════════════════════════════
//
// ONLY `leak` lines are offered. A number a COMPANY holds must never be
// suggested: pointing the sales line at a contractor's number diverts their
// callers to FieldQuo's own agent, which lib/platform/salesCall.js already
// detects after the fact as `belongs_to_tenant`. `leak` means exactly "Retell
// has it, no company holds it, and it is not already one of ours" — see
// auditVoiceNumbers.
//
// ══ Why it lives here and not in the route ═════════════════════════════════
//
// scripts/check-sales-agent.mjs asserts that app/api/platform/sales-agent/
// route.js references no tenant model at all — a blanket rule, stricter than
// the non-negotiable it guards (the console may VIEW a company's data and may
// not EDIT it). This query is a READ, and a read of exactly the table
// /api/platform/voice-numbers already reads for the same comparison. Moving it
// out keeps that route's stricter rule intact rather than arguing it down; the
// no-writes guarantee is asserted here instead, by
// scripts/check-platform-diagnostics.mjs.

import { db } from "@/lib/db";
import { voiceConfigured, listAllNumbers } from "@/lib/voice/retell";
import { auditVoiceNumbers } from "@/lib/voice/numberAudit";
import { sharedTestNumbers, toE164 } from "@/lib/voice/numbers";
import { describeFailure } from "@/lib/platform/diagnostics";

/**
 * @returns { numbers, complete, problem, checked }
 *
 * `problem` rather than an empty list when the look failed. An empty list would
 * read as "Retell holds nothing", which is a different and far more alarming
 * fact than "we could not ask" — the distinction this whole area is built on.
 */
export async function salesNumberCandidates() {
  if (!voiceConfigured()) {
    return { numbers: [], complete: null, problem: null, checked: false };
  }
  try {
    const [listed, rows] = await Promise.all([
      listAllNumbers(),
      db.voicePhoneNumber.findMany({
        where: { simulated: false },
        include: { company: { select: { name: true } } },
      }),
    ]);
    const audit = auditVoiceNumbers({
      providerNumbers: listed.items,
      rows,
      // The sales number is unset by definition on this path, so only the
      // shared test line can be excluded as deliberately held by nobody.
      ourNumbers: sharedTestNumbers()
        .map(toE164)
        .filter(Boolean)
        .map((e164) => ({ e164, label: "test" })),
      now: new Date(),
    });
    return {
      numbers: audit.lines
        .filter((l) => l.leak)
        .map((l) => ({ e164: l.e164, nickname: l.nickname, answering: l.answering })),
      // A partial page read as the whole account would offer a number that may
      // well be held by a company on a page nobody fetched.
      complete: listed.complete,
      problem: null,
      checked: true,
    };
  } catch (err) {
    return {
      numbers: [],
      complete: null,
      problem: describeFailure(err, { vendor: "Retell", envVar: "RETELL_API_KEY" }),
      checked: false,
    };
  }
}
