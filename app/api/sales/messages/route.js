// app/api/sales/messages/route.js
//
// A rep's text conversations: who wrote, what they said, a reply — and the
// check-in this contractor is due, waiting unsent.
//
// ══ Why this exists ═══════════════════════════════════════════════════════
//
// A rep could send exactly one thing — a templated signup link, from a panel
// on a lead — and could see nothing that came back. Until the inbound handler
// started storing replies, nothing DID come back: a contractor answering "sure,
// call me Thursday" was scanned for STOP and dropped. Both halves exist now, so
// this is the screen behind them.
//
// ══ The same two gates, unchanged ═════════════════════════════════════════
//
// GET goes through requireSalesRep — the portal's normal door, which permits
// reads. POST goes through requireSmsRep, the narrow named exception, used at
// exactly this one method. The blanket "the sales portal is read-only" rule
// stays intact everywhere else, and the list of things a rep may do that leave
// the building stays short enough to read.
//
// ══ A rep's own conversations, and nobody else's ══════════════════════════
//
// Every read is scoped by salesRepId. Two reps working different territories
// off one shared sales number must not read each other's prospects, and "it is
// all our own number anyway" is the argument that turns a shared line into a
// shared inbox.
//
// ══ THE LEAD LOOKUP WAS WRONG, AND IT COST EVERY SEND ═════════════════════
//
// This route used to ask for "this rep's most recently updated lead that has a
// phone at all", then discard it if the phone did not match the thread. For
// any rep holding more than one lead that is a miss almost every time, so
// `lead` was almost always null — including in POST, where the lead is the
// only source of the prospect's TIME ZONE. No zone means lib/sales/smsWindow.js
// refuses the send, correctly and with a good sentence, for a reason that has
// nothing to do with the clock. The reply box was refusing nearly every reply.
//
// The fix is leadForThread() in lib/sales/checkin/store.js: match on the
// NORMALISED number, because `phone` is stored as the rep typed it and
// "(514) 555-0134" and "+15145550134" are the same prospect.
//
// ══ Absent is not the same as empty ═══════════════════════════════════════
//
// `checkIns: null` means the draft table could not be read; `checkIns: []`
// means there are none. The screen says different things for the two, because
// "no drafts" and "we could not look" are different claims and only one of
// them is reassuring. AGENTS.md failure class #5.
// ══ The list is a chat client's list, and it says four more things ════════
//
// Unread (inbound rows after the rep last had the thread open — see
// lib/sales/messages/readState.js), an open draft, the rep's own "done"
// filing, and when the other side last wrote. Each is read from its own
// table and each fails SEPARATELY and DISTINGUISHABLY: a list that cannot
// count unread says `unread: null`, never 0. The bucket a conversation lands
// in is lib/sales/messages/rooms.js, pure, executed by the check.
//
// ══ The thread is a chat client's thread, and it carries the room's context ═
//
// Beside the messages: the rep's call attempts to this number (read only —
// they are drawn as system rows and in the History tab), the do-not-contact
// row if one exists (the "STOP received" row and the red tag), the texting
// window as an open/closed tag, and the contact's details for the bar on
// the right. All of it is READ. The only write on this route is still POST,
// and it still goes through every gate it always did.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { requireSalesRep } from "@/lib/sales/gate";
import { requireSmsRep } from "@/lib/sales/smsGate";
import {
  salesConversations,
  salesThread,
  deliverReplySms,
  salesSmsStatus,
} from "@/lib/sales/salesSms";
import { normalisePhone } from "@/lib/sales/suppressionRules";
import { getAppOrigin } from "@/lib/appUrl";
import {
  leadForThread,
  threadContext,
  openCheckIns,
  openCheckInsByThread,
  suggestionForThread,
} from "@/lib/sales/checkin/store";
import { threadReadStates, threadReadState } from "@/lib/sales/messages/readState";
import { salesSmsWindowState } from "@/lib/sales/smsWindow";
import { findSuppressions } from "@/lib/sales/suppression";
import { loadContactNumbers } from "@/lib/sales/contact/resolve";
import { db } from "@/lib/db";
import { materialiseCheckInsForRep, materialiseDemoCheckIn } from "@/lib/sales/checkin/materialise";
import { ruleDraft } from "@/lib/sales/checkin/draft";
import { CHECKIN_REASONS, REASON_CODES, checkinHeadlineKey } from "@/lib/sales/checkin/signals";
import { signupLinkFor } from "@/lib/sales/repStats";

/**
 * The `!` catalogue for one conversation.
 *
 * Built HERE, not in the browser, because the wording comes from
 * lib/sales/checkin/draft.js, which imports the model provider and must not
 * be bundled into a client. Every entry is the deterministic rule draft —
 * no model is asked while a page merely renders (store.js's rule) — with
 * the rep's own name and this business's name in it. English only: the
 * texts this portal sends are English (the CASL footer the send appends is
 * English, and the STOP keyword the inbound handler listens for is English),
 * and no lead or prospect row records the contact's language, so there is
 * nothing to translate INTO without inventing it.
 *
 * `titleKey` lets the screen show the entry's title in the rep's language;
 * the TEXT is what goes over the wire and stays as it is.
 */
function cannedFor({ rep, lead, origin }) {
  const facts = { companyName: lead?.businessName || null };
  const entries = REASON_CODES.map((code) => ({
    id: `checkin:${code}`,
    group: "checkin",
    titleKey: checkinHeadlineKey(code),
    title: CHECKIN_REASONS[code].headline,
    text: ruleDraft({ primary: { code }, facts }, { repName: rep?.name }),
  }));
  const link = rep?.code ? signupLinkFor(origin, rep.code) : null;
  if (link) {
    entries.unshift({
      id: "signup",
      group: "sales",
      titleKey: "app.salesText.cannedSignupTitle",
      title: "Signup link",
      // Identification first, the same order signupLinkSmsBody keeps and for
      // the same reason: the name is what a stranger reads in the preview.
      text: `Hi, it is ${String(rep?.name || "").trim() || "FieldQuo"} from FieldQuo. Here is the link to get started: ${link}`,
    });
  }
  return entries;
}

export async function GET(request) {
  const { rep, refusal } = await requireSalesRep(request);
  if (refusal) return NextResponse.json(refusal.body, { status: refusal.status });

  const url = new URL(request.url);
  const withE164 = normalisePhone(url.searchParams.get("with"));

  if (!withE164) {
    // ── The backlog first, so "Drafts due" is true when it renders ────────
    //
    // The day-1 / day-7 / milestone drafts for every company this rep signed
    // up, written if they are not there yet (lib/sales/checkin/materialise.js
    // — idempotent, rule-worded, never sent), plus the fixture draft on the
    // rep's demo company. A company that signed up through the link and was
    // never texted has no message row, so without this the list could not
    // show it at all — the gap the owner named. Fails soft: a backlog that
    // could not be written is reported under `draftsError` below, with the
    // list still drawn from what IS on record.
    let backlogError = null;
    try {
      await materialiseCheckInsForRep({ salesRepId: rep.id });
      await materialiseDemoCheckIn({ salesRepId: rep.id });
    } catch (err) {
      backlogError = "Check-ins for your companies could not be written, so \"Drafts due\" may be missing one.";
      console.error("[sales messages] backlog unwritable:", err?.message);
    }

    // Two reads that fail soft and fail distinguishably, then the list.
    let readStates = null;
    let readStateError = null;
    try {
      readStates = await threadReadStates({ salesRepId: rep.id });
    } catch (err) {
      readStateError = "Read markers could not be read, so unread counts are not shown.";
      console.error("[sales messages] read states unreadable:", err?.message);
    }
    let drafts = null;
    let draftsError = null;
    try {
      drafts = await openCheckInsByThread({ salesRepId: rep.id });
    } catch (err) {
      draftsError = "Check-in drafts could not be read, so \"Drafts due\" may be missing conversations.";
      console.error("[sales messages] drafts unreadable:", err?.message);
    }
    const conversations = (await salesConversations({ salesRepId: rep.id, readStates })).map((c) => {
      const draft = drafts ? drafts.get(c.e164) || null : null;
      return {
        ...c,
        // A thread that has messages but no lead can still be named by the
        // company its draft is about.
        name: c.name || draft?.name || null,
        isDemo: Boolean(draft?.isDemo),
        // Null when the table could not be read — absence, not zero.
        openDrafts: drafts ? draft?.count || 0 : null,
        nextDraftDue: draft?.nextDue || null,
      };
    });

    // ── Threads that exist only as a draft ──────────────────────────────
    //
    // A company the backlog drafted for and nobody has texted yet has no
    // SalesSmsMessage row, so salesConversations() cannot know it. It is a
    // conversation all the same — the next thing to happen in it is written
    // down — so it is listed from the draft: the company's name, the draft's
    // wording as the preview, `lastDirection: "out"` so the rooms rule files
    // it under "Drafts due" and never under "Needs a reply", and
    // `draftOnly: true` so the screen does not print "You: …" over words
    // that never went.
    if (drafts) {
      const seen = new Set(conversations.map((c) => c.e164));
      for (const [e164, draft] of drafts) {
        if (seen.has(e164)) continue;
        conversations.push({
          e164,
          lastAt: draft.nextDue || draft.firstCreatedAt,
          lastBody: draft.draftText,
          lastDirection: "out",
          leadId: null,
          name: draft.name,
          isDemo: Boolean(draft.isDemo),
          count: 0,
          unanswered: false,
          lastInboundAt: null,
          unread: readStates ? 0 : null,
          readState: readStates ? readStates.get(e164) || null : null,
          openDrafts: draft.count,
          nextDraftDue: draft.nextDue || null,
          draftOnly: true,
        });
      }
    }
    return NextResponse.json({
      conversations,
      readStateError,
      draftsError: draftsError || backlogError,
    });
  }

  const messages = await salesThread({ salesRepId: rep.id, withE164 });
  const { lead, company, timeZone } = await threadContext({ salesRepId: rep.id, toE164: withE164 });

  // The same readiness the send itself evaluates, so the screen can hide a
  // compose box that could not succeed and SAY WHY. It is not the decision:
  // deliverReplySms reads the list again at the moment of the send, because an
  // opt-out that lands while the rep is typing has to win. Hiding a button is
  // not access control — this is the courtesy, that is the enforcement.
  const readiness = await salesSmsStatus({
    rep,
    lead: lead || { phone: withE164, timeZone: null },
    origin: getAppOrigin(request),
  }).catch(() => null);

  // The room's context, every piece read on its own so one missing table
  // costs its own panel and nothing else. All read-only.
  const now = new Date();
  const [readState, calls, suppressions, numbers, emailThreads, pastCheckIns, prospectScore] =
    await Promise.all([
      threadReadState({ salesRepId: rep.id, e164: withE164 }).catch(() => null),
      db.salesCallAttempt
        .findMany({
          where: { salesRepId: rep.id, toE164: withE164 },
          orderBy: { dialledAt: "desc" },
          take: 30,
          select: {
            id: true,
            dialledAt: true,
            direction: true,
            disposition: true,
            answeredAt: true,
            talkSeconds: true,
            dialChannel: true,
            voicemailSeconds: true,
          },
        })
        .catch(() => null),
      findSuppressions(db, { phone: withE164 }).catch(() => null),
      lead
        ? loadContactNumbers({ prospectId: lead.prospectId || null, salesLeadId: lead.id }).catch(() => null)
        : Promise.resolve([]),
      lead
        ? db.salesThread
            .findMany({
              where: { leadId: lead.id, salesRepId: rep.id },
              orderBy: { lastMessageAt: "desc" },
              take: 10,
              select: { id: true, subject: true, lastMessageAt: true },
            })
            .catch(() => null)
        : Promise.resolve([]),
      db.salesCheckIn
        .findMany({
          where: { salesRepId: rep.id, toE164: withE164, status: { in: ["sent", "dismissed"] } },
          orderBy: { updatedAt: "desc" },
          take: 10,
          select: { id: true, status: true, sentAt: true, dismissedAt: true, draftText: true, reasonCode: true },
        })
        .catch(() => null),
      lead?.prospectId
        ? db.prospectScore
            .findFirst({
              where: { prospectId: lead.prospectId },
              orderBy: { computedAt: "desc" },
              select: { score: true, computedAt: true },
            })
            .catch(() => null)
        : Promise.resolve(null),
    ]);

  const prospect = lead?.prospectId
    ? await db.prospect
        .findUnique({
          where: { id: lead.prospectId },
          select: { id: true, tradeKey: true, city: true, province: true, phoneE164: true },
        })
        .catch(() => null)
    : null;

  // Both reads fail soft and fail DISTINGUISHABLY. A missing SalesCheckIn
  // table — this deployment's Neon project is at its size limit and the table
  // could not be created — must show as "we could not look", never as "you
  // have no drafts".
  let checkIns = null;
  let suggestion = null;
  let checkInError = null;
  try {
    checkIns = await openCheckIns({ salesRepId: rep.id, toE164: withE164 });
    // Only when nothing is already open on this thread. A second draft for the
    // same company on the same day is noise, and the dedupe key would refuse
    // to store it anyway.
    if (!checkIns.length) {
      ({ suggestion } = await suggestionForThread({
        salesRepId: rep.id,
        company,
        timeZone,
        repName: rep.name,
      }));
    }
  } catch (err) {
    checkInError =
      "Check-in drafts could not be read, so this conversation may be missing one. " +
      "Nothing was sent and nothing was lost.";
    console.error("[sales messages] check-ins unreadable:", err?.message);
  }

  // ── A thread with no lead, named by the draft it holds ────────────────
  //
  // The company behind an open draft, read off the rep's own row, for the
  // thread that exists only because the backlog wrote it (a demo draft has
  // no lead at all; a numberless company's lead may not carry the thread's
  // number). Scoped by the row's salesRepId, which the openCheckIns read
  // already applied. A demo is said in data so the screen can refuse the
  // composer for the same reason the send path will.
  let draftCompany = null;
  const draftCompanyId = !company && checkIns?.length ? checkIns.find((c) => c.companyId)?.companyId || null : null;
  if (draftCompanyId) {
    draftCompany = await db.company
      .findUnique({ where: { id: draftCompanyId }, select: { id: true, name: true, isDemo: true } })
      .catch(() => null);
  }
  const demoThread = Boolean(draftCompany?.isDemo) || (checkIns || []).some((c) => c.origin === "demo");
  const demoBlocker = demoThread
    ? {
        code: "demo_company",
        title: "This is your demo company. Nothing is sent from a demo.",
        fix: "The draft is here so you can see what a day-1 check-in looks like; on a real signup it is sendable.",
      }
    : null;

  return NextResponse.json({
    with: withE164,
    messages,
    lead: lead
      ? {
          id: lead.id,
          businessName: lead.businessName,
          contactName: lead.contactName,
          timeZone: lead.timeZone,
          email: lead.email || null,
          status: lead.status || null,
          prospectId: lead.prospectId || null,
        }
      : null,
    // Only ever a company this rep is attributed to — threadContext re-checks
    // that through assignedCompanyWhere. The escalation control renders off
    // this and off nothing else, because a support ticket needs a signed-up
    // company and decideEscalation() refuses without one.
    company: company ? { id: company.id, name: company.name } : null,
    // The company an open draft is ABOUT, when the thread has no lead to
    // name it. Never a company the rep is not attributed to or does not hold
    // as a demo: the row it came from is theirs.
    draftCompany: draftCompany ? { id: draftCompany.id, name: draftCompany.name, isDemo: draftCompany.isDemo } : null,
    demo: demoThread,
    timeZone,
    canSend: demoThread ? false : readiness ? readiness.canSend : false,
    suppressed: readiness ? readiness.blockers.some((b) => b.code === "suppressed") : false,
    blockers: demoBlocker ? [demoBlocker, ...(readiness ? readiness.blockers : [])] : readiness ? readiness.blockers : null,
    checkIns,
    checkInError,
    suggestion,
    // ── The chat client's context ─────────────────────────────────────
    readState,
    canned: cannedFor({ rep, lead, origin: getAppOrigin(request) }),
    window: salesSmsWindowState(now, timeZone),
    // Null when the table could not be read; [] when there were none.
    calls: calls
      ? calls.map((c) => ({
          id: c.id,
          at: c.dialledAt,
          direction: c.direction,
          disposition: c.disposition,
          answered: Boolean(c.answeredAt),
          talkSeconds: c.talkSeconds,
          dialChannel: c.dialChannel,
          voicemailSeconds: c.voicemailSeconds,
        }))
      : null,
    // Live do-not-contact rows for this number: when it was asked for and
    // from where. Removed rows are left out here — the header tag says
    // what is true NOW; the readiness blockers above already carry the
    // verdict the send will get.
    suppressions: suppressions
      ? suppressions
          .filter((row) => !row.removedAt)
          .map((row) => ({ id: row.id, requestedAt: row.requestedAt, source: row.source, reason: row.reason }))
      : null,
    contact: {
      trade: prospect?.tradeKey || null,
      city: prospect?.city || lead?.province || null,
      province: prospect?.province || lead?.province || null,
      score: prospectScore ? { value: prospectScore.score, at: prospectScore.computedAt } : null,
      repName: rep.name || null,
      numbers: numbers
        ? numbers.map((n) => ({
            id: n.id,
            e164: n.e164,
            kind: n.kind,
            label: n.label,
            canCall: n.canCall,
            canText: n.canText,
            preferred: n.preferred,
          }))
        : null,
      emailThreads,
      pastCheckIns,
    },
  });
}

export async function POST(request) {
  const { rep, refusal } = await requireSmsRep(request);
  if (refusal) return NextResponse.json(refusal.body, { status: refusal.status });

  const body = await request.json().catch(() => null);
  const withE164 = normalisePhone(body?.to);
  const text = String(body?.text ?? "").trim();

  if (!withE164) return NextResponse.json({ error: "Who to?" }, { status: 400 });
  if (!text) return NextResponse.json({ error: "There is nothing to send." }, { status: 400 });

  // The rep must already be IN this conversation. A free-text send to an
  // arbitrary number would be a cold-contact path with none of the
  // first-contact rules attached — no signup link, no lead, and no record of
  // where the number came from.
  const existing = await salesThread({ salesRepId: rep.id, withE164 });
  if (!existing.length) {
    return NextResponse.json(
      {
        error:
          "You have not texted this number before. Start from the lead — the first message carries " +
          "your signup link and the identification the law wants on a first contact.",
      },
      { status: 409 },
    );
  }

  const lead = await leadForThread({ salesRepId: rep.id, toE164: withE164 });

  const result = await deliverReplySms({
    rep,
    // The lead supplies the prospect's TIME ZONE, which is what the texting
    // window is judged in. A lead matched by anything other than the number
    // would evaluate the clock against somebody else's town.
    lead: lead || { phone: withE164, timeZone: null },
    text,
    origin: getAppOrigin(request),
  });

  if (!result.ok) {
    return NextResponse.json(
      { error: result.error, blockers: result.blockers || null, suppressed: result.suppressed || false },
      { status: result.status || 409 },
    );
  }
  return NextResponse.json({ ok: true, messages: await salesThread({ salesRepId: rep.id, withE164 }) });
}
