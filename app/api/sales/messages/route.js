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
// ══ One conversation per business ═════════════════════════════════════════
//
// The owner's rule: "any texts sent to a company should also end up in SMS"
// — and in ONE conversation for that company, whichever of their numbers
// each text went to. The list folds per-number threads by business
// (lib/sales/messages/business.js) and the thread is read across every
// number the business has (businessResolve.js), so the signup link the rep
// texted to the owner's cell and the day-1 check-in the engine aimed at the
// shop line sit in the same room, each with its kind chip, and the numbers
// are listed in the context bar. `with` stays a number — the one a reply
// goes to by default — because every row is keyed on one.
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
  sentDemoCheckIns,
  sentDemoByThread,
  suggestionForThread,
} from "@/lib/sales/checkin/store";
import { waitingDraftsFor } from "@/lib/sales/checkin/waiting";
import { threadReadStates, threadReadState } from "@/lib/sales/messages/readState";
import { salesSmsWindowState } from "@/lib/sales/smsWindow";
import { findSuppressions } from "@/lib/sales/suppression";
import { loadContactNumbers } from "@/lib/sales/contact/resolve";
import { db } from "@/lib/db";
import { materialiseCheckInsForRep, materialiseDemoCheckIn } from "@/lib/sales/checkin/materialise";

// ── Where the seconds go, said in the response ─────────────────────────────
// The owner measured 10+ s to open a thread. From a warm machine every query
// in this file answers in well under a second, so the time is somewhere this
// file cannot see — a cold function, a sleeping database, the network. A
// Server-Timing header and one log line per request put the server's own
// number beside the browser's, so the next report can say which it was.
function timed(t0, label, body) {
  const ms = Date.now() - t0;
  console.log(`[sales/messages] ${label} ${ms}ms`);
  return NextResponse.json(body, { headers: { "Server-Timing": `app;dur=${ms}` } });
}
const MATERIALISE_EVERY_MS = 10 * 60 * 1000;
const materialisedAt = new Map();
function shouldMaterialise(repId) {
  const last = materialisedAt.get(repId) || 0;
  if (Date.now() - last < MATERIALISE_EVERY_MS) return false;
  materialisedAt.set(repId, Date.now());
  return true;
}
import { ruleDraft } from "@/lib/sales/checkin/draft";
import { CHECKIN_REASONS, REASON_CODES, checkinHeadlineKey } from "@/lib/sales/checkin/signals";
import { signupLinkFor } from "@/lib/sales/repStats";
import { markAgreedOnCall } from "@/lib/sales/agreedOnCall";
import { threadTriage } from "@/lib/sales/messages/triage";
import { lastReviewOf } from "@/lib/sales/conversationAudit";
import { resolveBusiness } from "@/lib/sales/messages/businessResolve";
import { mergeReadStates } from "@/lib/sales/messages/business";
import { START_REFUSALS, resolveNumberHolder } from "@/lib/sales/messages/startThread";
import { suggestZoneForNumber } from "@/lib/sales/areaCodeZone";
import { attachThreadToLead } from "@/lib/sales/messages/attachThread";
import { SALES_SMS_TIME_ZONES } from "@/lib/sales/smsWindow";
import { resolveLeadTimeZone } from "@/lib/sales/leadTimeZone";

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
/** The one shape of a rep's link (lib/sales/repStats.js signupLinkFor) — what marks a text as the link being sent. */
const LINK_MARK = "/signup?sales=";

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
  // "As discussed" — the first-message option for a company that said
  // "text me instead" on the call: the rep's name, the business, and an
  // open sentence the rep finishes. Offered whether or not the rep has a
  // link, because it is about the call, not the signup.
  entries.unshift({
    id: "discussed",
    group: "sales",
    titleKey: "app.salesText.cannedDiscussedTitle",
    title: "As discussed on the call",
    text: `Hi${facts.companyName ? ` ${facts.companyName}` : ""}, it is ${String(rep?.name || "").trim() || "FieldQuo"} from FieldQuo — thanks for taking my call. As discussed, `,
  });
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
  const t0 = Date.now();

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
      // …but not on EVERY list load. The snapshot is reads-then-inserts over
      // every attributed company and cost ~0.6 s before a single conversation
      // was read (measured 2026-09-15). The daily cron and the Companies page
      // write the same rows; here it runs at most once per rep every ten
      // minutes per instance, the cadence a draft can actually change at.
      if (shouldMaterialise(rep.id)) {
        await materialiseCheckInsForRep({ salesRepId: rep.id });
        await materialiseDemoCheckIn({ salesRepId: rep.id });
      }
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
    // The banner's number: the ONE definition of "waiting" (lib/sales/checkin/
    // waiting.js), the same one the sidebar badge and the Today card read.
    // Null when it could not be counted — the banner then draws nothing,
    // never "0 drafts waiting".
    let waiting = null;
    try {
      waiting = await waitingDraftsFor(rep.id);
    } catch (err) {
      console.error("[sales messages] waiting drafts uncounted:", err?.message);
    }
    // Demo threads whose draft was SENT (simulated — store.js
    // simulateDemoSend): no SalesSmsMessage exists for them, so without this
    // the demo conversation would vanish from the list the moment the rep
    // pressed Send, which is the opposite of what a send looks like.
    let demoSent = new Map();
    try {
      demoSent = await sentDemoByThread({ salesRepId: rep.id });
    } catch (err) {
      console.error("[sales messages] demo sends unreadable:", err?.message);
    }
    const conversations = (await salesConversations({ salesRepId: rep.id, readStates })).map((c) => {
      // Drafts and demo sends are keyed per number; a conversation is per
      // business, so every number of it is asked and the answers added up.
      const e164s = (c.numbers || [{ e164: c.e164 }]).map((n) => n.e164);
      const draftRows = drafts ? e164s.map((n) => drafts.get(n)).filter(Boolean) : [];
      const draft = draftRows.length
        ? {
            count: draftRows.reduce((n, d) => n + (d.count || 0), 0),
            nextDue: draftRows.map((d) => d.nextDue).filter(Boolean).sort((a, b) => new Date(a) - new Date(b))[0] || null,
            name: draftRows.find((d) => d.name)?.name || null,
            isDemo: draftRows.some((d) => d.isDemo),
          }
        : null;
      const demo = e164s.map((n) => demoSent.get(n)).find(Boolean) || null;
      return {
        ...c,
        // A thread that has messages but no lead can still be named by the
        // company its draft is about.
        name: c.name || draft?.name || demo?.name || null,
        isDemo: Boolean(draft?.isDemo) || Boolean(demo),
        // Null when the table could not be read — absence, not zero.
        openDrafts: drafts ? draft?.count || 0 : null,
        nextDraftDue: draft?.nextDue || null,
      };
    });
    // Every number already inside a listed conversation, so a draft or a
    // demo send on the business's OTHER number joins it rather than opening
    // a second row.
    const listed = () => new Set(conversations.flatMap((c) => (c.numbers || [{ e164: c.e164 }]).map((n) => n.e164)));

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
      const seen = listed();
      for (const [e164, draft] of drafts) {
        if (seen.has(e164)) continue;
        conversations.push({
          e164,
          numbers: [{ e164, lastAt: null, count: 0 }],
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
    // ── The demo thread after its send ──────────────────────────────────
    //
    // Listed from the sent demo row the way a real thread is listed from
    // its SalesSmsMessage: our words last, so rooms.js files it under
    // "Waiting on them" — where a real send lands.
    {
      const seen = listed();
      for (const [e164, sent] of demoSent) {
        if (seen.has(e164)) continue;
        conversations.push({
          e164,
          numbers: [{ e164, lastAt: sent.lastAt, count: 1 }],
          lastAt: sent.lastAt,
          lastBody: sent.lastBody,
          lastDirection: "out",
          leadId: null,
          name: sent.name,
          isDemo: true,
          count: 1,
          unanswered: true,
          lastInboundAt: null,
          unread: readStates ? 0 : null,
          readState: readStates ? readStates.get(e164) || null : null,
          openDrafts: drafts ? 0 : null,
          nextDraftDue: null,
        });
      }
    }
    return timed(t0, `list rep=${rep.id} conversations=${conversations.length}`, {
      conversations,
      readStateError,
      draftsError: draftsError || backlogError,
      waiting,
    });
  }

  // The business behind the number, and every number of theirs — the thread
  // is read across all of them. Falls back to the one number when nothing
  // names a business: a stranger's text is a conversation with one phone.
  let business = await resolveBusiness({ salesRepId: rep.id, withE164, client: db }).catch(() => null);
  // ── A thread that names a business and hangs on no lead ─────────────────
  //
  // Attached now, on open — the backfill for rows filed before
  // lib/sales/messages/attachThread.js existed (the header's reason, and
  // the owner's: "we should know the timezone because it is Advance
  // Appliance, one of her leads"). The ONE write this GET makes beside the
  // check-in backlog, and for the same reason that one is here: the screen
  // cannot show what is not on record. Idempotent — a thread with nothing
  // to attach writes nothing — and fails soft to the nameless thread the
  // screen already knows how to draw. `attached` rides on the response so
  // the screen can say it happened.
  let attached = null;
  if (!business?.lead) {
    try {
      const result = await attachThreadToLead({ salesRepId: rep.id, rep, e164: withE164, client: db });
      if (result.attached) {
        attached = { leadId: result.leadId, created: result.created, recorded: result.recorded, unsaved: result.unsaved || null };
        business = await resolveBusiness({ salesRepId: rep.id, withE164, client: db }).catch(() => business);
      }
    } catch (err) {
      console.error("[sales messages] thread not attached to a lead:", err?.message);
    }
  }
  const numbers = business?.numbers?.length ? business.numbers : [withE164];
  const messages = await salesThread({ salesRepId: rep.id, withE164, numbers });
  const { lead, company, timeZone } = await threadContext({
    salesRepId: rep.id,
    toE164: withE164,
    ...(business ? { lead: business.lead } : {}),
  });

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
  const [readState, calls, suppressions, contactNumbers, emailThreads, pastCheckIns, prospectScore] =
    await Promise.all([
      // The read state of the whole conversation: the latest read and the
      // latest filing across its numbers (business.js mergeReadStates).
      Promise.all(numbers.map((n) => threadReadState({ salesRepId: rep.id, e164: n }).catch(() => null))).then(mergeReadStates),
      db.salesCallAttempt
        .findMany({
          where: { salesRepId: rep.id, toE164: { in: numbers } },
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
      // Per number, then flattened: a STOP from the owner's cell is a fact
      // about this conversation whichever number it is opened from.
      Promise.all(numbers.map((n) => findSuppressions(db, { phone: n })))
        .then((lists) => lists.flat())
        .catch(() => null),
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
          where: { salesRepId: rep.id, toE164: { in: numbers }, status: { in: ["sent", "dismissed"] } },
          orderBy: { updatedAt: "desc" },
          take: 10,
          // origin and companyId: a demo thread whose only draft has been
          // sent has no open row left to say it is a demo, and it must not
          // stop being one the moment Send is pressed.
          select: { id: true, status: true, sentAt: true, dismissedAt: true, draftText: true, reasonCode: true, origin: true, companyId: true },
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

  // ── Whose number this is, when it is not on a lead of the rep's ─────────
  //
  // A ?thread= link from the ring dialog, or a number typed into the URL,
  // lands here with no lead. The screen must not print a disabled box with
  // no sentence (AGENTS.md's rule): it says WHY — another rep holds it
  // (with their name), or nobody does, in which case it offers to save it
  // as a lead or open the thread on a new one. Read-only; the same lookup
  // startTextThread makes before it writes. Null when the lookup failed,
  // so "we could not tell" is not drawn as "nobody's".
  const holder = lead
    ? null
    : await resolveNumberHolder(db, { e164: withE164, salesRepId: rep.id })
        .then((h) => (h.kind === "other" ? { kind: "other", name: h.holderName || null } : { kind: "none" }))
        .catch(() => null);

  // ── The zone the area code suggests — a suggestion, never the decision ──
  //
  // Only when nothing on the lead states or derives one (the readiness's
  // own verdict, so this cannot disagree with it): the select on the screen
  // is pre-filled with it and the rep confirms by sending, which writes it
  // on the lead as stated. lib/sales/areaCodeZone.js says why this never
  // reaches the send path itself. Null for a split code (807, 250…), and
  // the screen then asks with an empty select as before.
  const zoneBlocker = (readiness?.blockers || []).find((b) => b.code === "time_zone_unknown") || null;
  const suggestedTimeZone =
    zoneBlocker && lead && !zoneBlocker.candidates?.length ? suggestZoneForNumber(withE164) : null;

  // Both reads fail soft and fail DISTINGUISHABLY. A missing SalesCheckIn
  // table — this deployment's Neon project is at its size limit and the table
  // could not be created — must show as "we could not look", never as "you
  // have no drafts".
  let checkIns = null;
  let suggestion = null;
  let checkInError = null;
  try {
    checkIns = await openCheckIns({ salesRepId: rep.id, toE164: withE164, numbers });
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
  const draftCompanyId = !company
    ? (checkIns || []).find((c) => c.companyId)?.companyId || (pastCheckIns || []).find((c) => c.companyId)?.companyId || null
    : null;
  if (draftCompanyId) {
    draftCompany = await db.company
      .findUnique({ where: { id: draftCompanyId }, select: { id: true, name: true, isDemo: true } })
      .catch(() => null);
  }
  const demoThread =
    Boolean(draftCompany?.isDemo) ||
    (checkIns || []).some((c) => c.origin === "demo") ||
    (pastCheckIns || []).some((c) => c.origin === "demo");
  // Said as a warning beside a Send that works, not as a blocker: the demo's
  // Send is real in every respect but the carrier (lib/sales/checkin/store.js
  // simulateDemoSend), and a blocker would hide the button a rep is here to
  // learn.
  const demoWarning = demoThread
    ? {
        code: "demo_company",
        title: "This is your demo company.",
        fix: "Send here shows what happens; nothing leaves FieldQuo.",
      }
    : null;
  // The demo's sent check-ins, drawn as its outbound messages. No
  // SalesSmsMessage row exists for them — see simulateDemoSend for why —
  // so they are read from the check-in table and merged in by time.
  const demoMessages = demoThread ? await sentDemoCheckIns({ salesRepId: rep.id, toE164: withE164, numbers }).catch(() => []) : [];
  const threadMessages = demoMessages.length
    ? [...messages, ...demoMessages].sort((a, b) => new Date(a.sentAt) - new Date(b.sentAt))
    : messages;

  // When the owner last read this thread from the console (lib/sales/
  // conversationAudit.js) — the rep is told, on the thread, every time.
  // Null when never, and null when the audit log could not be read.
  const reviewedByOwner = await lastReviewOf({ repId: rep.id, kind: "sms", with: withE164 });

  // Every number in this conversation, with what last touched each, for
  // the context bar's list — `with` first, which is where a reply goes.
  const numberRows = numbers.map((e164) => {
    let lastAt = null;
    let count = 0;
    for (const m of threadMessages) {
      if (m.toE164 !== e164 && m.fromE164 !== e164) continue;
      count += 1;
      if (!lastAt || new Date(m.sentAt) > new Date(lastAt)) lastAt = m.sentAt;
    }
    return { e164, lastAt, count };
  });

  return timed(t0, `thread rep=${rep.id} with=${withE164} messages=${threadMessages.length}`, {
    with: withE164,
    numbers: numberRows,
    messages: threadMessages,
    reviewedByOwner,
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
    // Where the clock came from — stated by a rep, or derived from the
    // lead's address the way the call region derives it — so the header
    // can say "from their address" rather than print a zone as a fact
    // nobody typed. Null when there is none, which is what the blocker says.
    timeZoneSource: lead ? resolveLeadTimeZone(lead).source : null,
    // The lead this thread was hung on during THIS read, when it was.
    attached,
    holder,
    // For the composer's zone row, when the readiness asks for one: the
    // closed list every zone write is checked against, and the area code's
    // suggestion (or null). The list is the SAME one the signup panel and
    // the lead editor use — two lists would let a rep state a zone here
    // that the send refuses.
    timeZones: zoneBlocker && lead ? SALES_SMS_TIME_ZONES : null,
    suggestedTimeZone: suggestedTimeZone?.timeZone ? suggestedTimeZone : null,
    // A demo thread's composer is not a send path — the reply route writes
    // a SalesSmsMessage only after a carrier accepts, and there is no
    // carrier — so free-text replies stay off; the draft's own Send is the
    // demo's send. The window and the opt-out list are judged for a real
    // number and are not reported as blockers on a fictional one.
    canSend: demoThread ? false : readiness ? readiness.canSend : false,
    suppressed: readiness ? readiness.blockers.some((b) => b.code === "suppressed") : false,
    blockers: demoThread ? [] : readiness ? readiness.blockers : null,
    checkIns,
    checkInError,
    suggestion,
    // ── The chat client's context ─────────────────────────────────────
    readState,
    // The latest reply's kind — the chip in the header and the dropdown
    // that overrides it. Decided by the same pure function the list uses,
    // over the rows above, so a thread and its row in the list cannot
    // disagree. Null when they have never written; `kind: null` when the
    // last reply was not classified, which the screen draws as no chip.
    triage: (() => {
      const verdict = threadTriage(messages);
      return verdict
        ? { kind: verdict.kind, reason: verdict.reason, overridden: verdict.overridden, at: verdict.at, open: verdict.open }
        : null;
    })(),
    canned: cannedFor({ rep, lead, origin: getAppOrigin(request) }),
    // The override rode in on the readiness (salesSmsStatus resolved it);
    // the tag reads the same mode so header and composer cannot disagree.
    window: salesSmsWindowState(now, timeZone, {
      windowPolicy: readiness?.windowOverride ? { mode: readiness.windowOverride } : null,
    }),
    // Caveats beside a Send that works — the console's calling-window
    // override, and the demo's "nothing leaves FieldQuo". Null when the
    // readiness could not be read, the same as `blockers`.
    warnings: demoWarning ? [demoWarning, ...(readiness?.warnings || [])] : readiness ? readiness.warnings : null,
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
      numbers: contactNumbers
        ? contactNumbers.map((n) => ({
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

  // The lead by number, else the business's lead when the number is another
  // of theirs (the owner's cell a rep was given on a call) — with THIS
  // number standing in for the lead's own, the way the signup-link route
  // hands a chosen number to the send, so every gate runs against the number
  // that will actually be messaged, judged in the lead's zone.
  const lead =
    (await leadForThread({ salesRepId: rep.id, toE164: withE164 })) ||
    (await resolveBusiness({ salesRepId: rep.id, withE164, client: db })
      .then((b) => (b?.lead ? { ...b.lead, phone: withE164 } : null))
      .catch(() => null));

  // ── A first contact needs a lead behind it; it no longer needs the link ─
  //
  // Until 2026-09-18 this refused EVERY first text — "start from the lead,
  // the first message carries your signup link" — and a company that said
  // "text me instead" on the call got the fixed introduction or nothing.
  // The rule's reason was never the link: it was that a free-text send to
  // an arbitrary number is a cold-contact path with no lead and no record
  // of where the number came from. So that is what is checked. The
  // conversation may be new; the NUMBER may not be a stranger's — it has
  // to be on a lead this rep holds (the "Text them" press and the New
  // message picker both put it there through startTextThread, which
  // records where it came from). What the first message carries is what
  // every message carries: replySmsBody's footer — FieldQuo, the mailing
  // address, "Reply STOP to opt out" — the identification and the
  // unsubscribe CASL s.6 wants, on a first text as on a tenth.
  const existing = await salesThread({ salesRepId: rep.id, withE164 });
  if (!existing.length && !lead) {
    return NextResponse.json(
      {
        error: START_REFUSALS.no_lead,
        code: "no_lead",
      },
      { status: 409 },
    );
  }

  const result = await deliverReplySms({
    rep,
    // The lead supplies the prospect's TIME ZONE, which is what the texting
    // window is judged in. A lead matched by anything other than the number
    // — or the business behind it — would evaluate the clock against
    // somebody else's town.
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
  // A free-text send that carries the rep's signup link is "agreed on the
  // call" exactly as the dedicated send is — the same write, so the funnel's
  // agreed stage does not depend on which composer the rep used.
  const agreedOnCall = lead?.id && result.body?.includes(LINK_MARK)
    ? await markAgreedOnCall({ repId: rep.id, lead })
    : null;
  return NextResponse.json({ ok: true, agreedOnCall, messages: await salesThread({ salesRepId: rep.id, withE164 }) });
}
