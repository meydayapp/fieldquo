// app/api/quotes/[id]/call/route.js
//
// "Ring this client about this quote" — the button on the quote itself.
//
// ── Why a button, when the assistant already calls automatically ──────────
//
// Because the automatic path is scoped, and the scope is a standing decision
// made once on a settings screen. A company set to "instant estimates only" has
// no way to say "not that rule, this quote" — and the estimator looking at the
// quote is exactly the person who knows it is worth a call. Their click IS the
// decision, so manualQuoteCallGate drops the scope checks and keeps the ones a
// click cannot make safe: an unreviewed total, a quote the client has never
// been sent, no number to dial, and the company's own master switch.
//
// ── It QUEUES, and that is deliberate ─────────────────────────────────────
//
// Nothing dials from a button press. enqueueOutbound puts a task down and
// /api/cron/voice-outbound places it within fifteen minutes, re-checking
// consent, calling hours, credit and the quote's total at dial time. A person
// can withdraw consent between the click and the call, and the call has to lose
// that race — which it cannot do if the click dialled.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { memberOrRefusal } from "@/lib/apiMember";
import { levelOrRefusal } from "@/lib/permissions/apiGate";
import { recordActivity } from "@/lib/activity/log";
import { enqueueOutbound } from "@/lib/voice/outboundCall";
import { manualQuoteCallGate } from "@/lib/voice/quoteCallScope";
import {
  QUOTE_CALLBACK_PURPOSE,
  QUOTE_CALLBACK_SELECT,
  quoteCallContext,
} from "@/lib/voice/triggers";

export async function POST(request, { params }) {
  const { id } = await params;
  const { member, response } = await memberOrRefusal(request);
  if (response) return response;

  // Ringing a client about their quote is acting on the quote, so it takes the
  // level that edits one. A read-only viewer must not be able to start a call
  // the company pays for and the client receives.
  const { response: denied } = await levelOrRefusal(
    member,
    "quotes",
    "view_create_edit",
    "call clients about quotes",
  );
  if (denied) return denied;

  // Scoped in the WHERE. A quote id from another tenant resolves to nothing
  // rather than to their customer's phone number.
  const quote = await db.quote.findFirst({
    where: { id, companyId: member.companyId },
    // The SAME select the automatic path uses, so the two gates cannot disagree
    // about a quote by reading different columns of it.
    select: QUOTE_CALLBACK_SELECT,
  });
  if (!quote) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const gate = manualQuoteCallGate(quote);
  if (!gate.allowed) {
    // The reason travels as a code the screen translates. A refusal a person
    // cannot act on ("no") is what makes them press the button again.
    return NextResponse.json(
      { error: "That quote can't be called about yet.", reason: gate.reason },
      { status: 409 },
    );
  }

  const task = await enqueueOutbound({
    companyId: quote.companyId,
    purpose: QUOTE_CALLBACK_PURPOSE,
    clientId: quote.clientId,
    quoteId: quote.id,
    // NOT `once`. The automatic path fires a single call per quote for ever;
    // a person pressing this a week later has decided to ring again, and
    // enqueueOutbound's live-task de-dupe still stops a double press queueing
    // two calls at once.
    // The same brief the automatic path builds. See quoteCallContext.
    context: quoteCallContext(quote),
  });

  if (!task) {
    // enqueueOutbound returns null when a live task already exists for this
    // quote. Not an error — the call they want is already coming.
    return NextResponse.json({ queued: false, reason: "already_queued" });
  }

  await recordActivity(member, {
    action: "quote.call.queued",
    entityType: "quote",
    entityId: quote.id,
    summary: `Queued a call to ${quote.client?.name || "the client"} about quote ${quote.quoteNumber ?? ""}`.trim(),
  });

  return NextResponse.json({ queued: true });
}
