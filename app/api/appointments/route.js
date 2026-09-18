// app/api/appointments/route.js
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { memberOrRefusal } from "@/lib/apiMember";
import { can, requirePermission } from "@/lib/permissions";
import {
  loadEnforceableMember,
  hasLevel,
  redactClient,
  assignedJobWhere,
} from "@/lib/permissions/enforce";
import { ownScheduleFilter } from "@/lib/schedule/teamScope";
import {
  VISIT_INCLUDE,
  toCalendarEntry,
  bookingToCalendarEntry,
} from "@/lib/schedule/jobVisits";
import { ownedIdsRefusal } from "@/lib/tenant/ownedIds";
import { sendBookingConfirmationEmail } from "@/app/admin/lib/email/templates";
import { resolveClientLanguage } from "@/lib/i18n/clientLanguage";
import { serviceName, isMeasure } from "@/lib/schedule/clientNotice";
import { recordSiteVisit } from "@/lib/quotes/siteVisitActivity";
import { pickAbout, prefillLocation, aboutLabel } from "@/lib/schedule/appointmentAbout";
import { loadAboutRecord } from "@/lib/schedule/aboutRecord";

export async function GET(request) {
  const { member, response } = await memberOrRefusal(request);
  if (response) return response;

  // Schedule scoping. "View their own schedule" means the calendar shows
  // only their jobs — a filter, not a 403. Unassigned appointments stay
  // visible to everyone: an unclaimed job nobody can see is a job nobody
  // does.
  //
  // The fragment is built by ownScheduleFilter() rather than written out here
  // three times (appointments, visits, bookings). Three hand-copied copies of
  // the same rule is how one of them ends up disagreeing with the other two,
  // and the one that disagrees is the one nobody reads.
  //
  // `includeUnassigned` is now decided per source rather than taken as the
  // default everywhere. It defaults to true because of what an unassigned
  // APPOINTMENT is; the other two sources are different rows carrying
  // different data, and each says below why it answers differently.
  const full = await loadEnforceableMember(db, member.id);
  const ownFilter = (field, opts) =>
    ownScheduleFilter(full, member.userId, { field, ...opts });

  const appointments = await db.appointment.findMany({
    where: {
      companyId: member.companyId,
      ...ownFilter("assignedToId"),
    },
    include: {
      client: true,
      assignedTo: { select: { id: true, name: true } },
      // The quote an on-site measure was scheduled from (lib/quotes/siteVisit.js),
      // so the row can link back to it the way a visit links to its job. Null
      // on every other appointment; the number is what the link is labelled.
      quote: { select: { id: true, quoteNumber: true } },
      // What a hand-booked appointment is about, when the office said
      // (lib/schedule/appointmentAbout.js). Same one-line select as the
      // quote: the card prints the number or the title and links to it.
      job: { select: { id: true, title: true } },
      invoice: { select: { id: true, invoiceNumber: true } },
      // For the real finish time. An Appointment has no duration of its own,
      // so one created from a booking is the only kind we can say anything
      // definite about — and the travel check stays silent rather than
      // assuming an hour for the rest. See lib/booking/travel.js travelLegs.
      // `source` rides along with the end time: the calendar badges a booking
      // the AI receptionist took, and somebody driving to a job is entitled to
      // know a robot arranged it. Selected here rather than derived from
      // VoiceCall.bookingId, which would be a third query per row.
      booking: {
        select: {
          endTime: true,
          source: true,
          // ── Which KIND of appointment this is ──────────────────────────
          //
          // A callback and a site visit look identical on the calendar: a name
          // and a time. One means ring this person, the other means drive to
          // their house — and a callback has no address, so the row for one is
          // a name and a time and nothing else. Somebody reading their day has
          // to be able to tell which it is without opening anything.
          mode: true,
        },
      },
    },
    orderBy: { scheduledAt: "asc" },
  });

  // ── Visits belong on the calendar too ──────────────────────────────────
  //
  // Scheduling a visit on a job advanced the job to "scheduled" and put
  // nothing here, because visits live in JobVisit and this reads Appointment.
  // A manager booked crew work for Tuesday, opened the Calendar, and saw an
  // empty week — while the dashboard's "Upcoming visits" tile read 0 against a
  // job that plainly had one.
  //
  // Merged at read time rather than mirrored into an Appointment row; see
  // lib/schedule/jobVisits.js for why. Entries carry `kind` so the UI links a
  // visit to its job instead of offering an appointment editor that would not
  // work on it.
  //
  // ── "Unassigned" does not mean the same thing on a visit ────────────────
  //
  // Unassigned APPOINTMENTS stay visible to everyone, and that is right: the
  // row is a time and a client the caller can already read at their level.
  //
  // A visit is not that row. toCalendarEntry carries the JOB's title, the
  // client's name and the site address — precisely what a Crew member is
  // confined away from — so an unassigned visit on a job they are not on put
  // that job's title and the homeowner's address on their calendar while
  // GET /api/jobs/[id] answered 404 for the very same job. The calendar was
  // the widest door onto the client list again, one table over.
  //
  // So an unassigned visit is theirs to pick up only on a job that is already
  // theirs. "Their job" is assignedJobWhere — the same fragment every job read
  // in the product uses — rather than a second definition written out here:
  // two definitions of one rule is how the calendar and the job board come to
  // disagree about which jobs exist, and the copy is the one that rots.
  //
  // Nobody who could see the whole calendar loses anything. ownFilter returns
  // {} for a member holding schedule edit_all, so visitScope is {} and the
  // spread is a no-op; and assignedJobWhere returns {} for anyone who sees the
  // whole job board (an Estimator sits at jobs:view_only and keeps every job),
  // so for them an unassigned visit stays visible — its address is on a job
  // they can already open.
  const ownVisits = ownFilter("assignedToId", { includeUnassigned: false });
  const myJobs = assignedJobWhere(full);
  const visitScope = Object.keys(ownVisits).length
    ? {
        OR: [
          ownVisits,
          // Spread, not `job: myJobs`: myJobs is {} for an unscoped member and
          // an empty relation filter is a claim about the relation rather than
          // the absence of one.
          { assignedToId: null, ...(Object.keys(myJobs).length ? { job: myJobs } : {}) },
        ],
      }
    : {};

  const visits = await db.jobVisit.findMany({
    where: {
      // Archived jobs are filed away, so their visits leave the calendar and
      // the dashboard count with them. Otherwise "archive" would only tidy the
      // Jobs list while the work kept showing up everywhere else.
      job: { companyId: member.companyId, archivedAt: null },
      ...visitScope,
    },
    include: VISIT_INCLUDE,
    orderBy: { scheduledAt: "asc" },
  });

  // ── And bookings, when they never became an appointment ────────────────
  //
  // A confirmed booking is meant to turn into an Appointment and reach this
  // list as one. `Booking.appointmentId` is nullable, though — rows predating
  // the link have none — and a booking that did not convert is a client who
  // has been sent a confirmation for a visit nobody in the company can see.
  //
  // `appointmentId: null` is what keeps this from double-counting: a booking
  // that DID convert is already in `appointments` above, and is skipped here.
  // So this is a floor under the conversion, not a second copy of it, and it
  // stays correct whichever way that mechanism behaves.
  //
  // pending_payment is deliberately excluded. It is a slot held while someone
  // pays, not a booked visit, and putting unpaid holds on the calendar would
  // send a crew to a house that never confirmed.
  const bookings = await db.booking.findMany({
    where: {
      appointmentId: null,
      status: { in: ["confirmed", "cancelled", "completed"] },
      eventType: {
        companyId: member.companyId,
        // Same rule, same builder — but the assignee column is `userId` here,
        // because a booking is owned through the EventType whose page took it.
        //
        // `includeUnassigned` is off, and this is the one source where the
        // default was plainly wrong. EventType.userId is null for a
        // COMPANY-WIDE booking type — the public /book page anyone in the city
        // can fill in — so "unassigned" here does not mean "spare work waiting
        // to be claimed", it means "every booking the company has ever taken
        // through its own front door". Each one carried a stranger's name and
        // street address onto the calendar of every member scoped to their own
        // schedule, and there is nothing for them to claim: a booking is not
        // assignable at all (bookingToCalendarEntry has no editor behind it,
        // and its id would 404 against /api/appointments/[id]).
        ...ownFilter("userId", { includeUnassigned: false }),
      },
    },
    include: {
      eventType: { select: { name: true, userId: true, user: { select: { id: true, name: true } } } },
    },
    orderBy: { startTime: "asc" },
  });

  // ── The calendar is the widest door onto the client list ────────────────
  //
  // `include: { client: true }` above is the whole Client row, and this feed is
  // the one endpoint every employee's app hits on load. So an employee confined
  // to clientsProperties "name_address_only" received every customer's email,
  // phone, private notes and portalToken here — the same exposure that was
  // closed on GET /api/clients and then again on the client DETAIL route, still
  // standing open on the busiest route of the three.
  //
  // /api/appointments/[id] has redacted since that sweep. This is its sibling,
  // and the sibling is always the one that gets missed.
  //
  // The visit and booking entries need nothing: VISIT_INCLUDE already narrows
  // to { id, name, address } (which is exactly what name_address_only allows),
  // and a booking's client is synthesised from the booking's own columns.
  return NextResponse.json([
    ...appointments.map((a) => ({
      ...a,
      kind: "appointment",
      client: redactClient(full, a.client),
    })),
    ...visits.map(toCalendarEntry).filter(Boolean),
    ...bookings.map(bookingToCalendarEntry).filter(Boolean),
  ].sort((a, b) => new Date(a.scheduledAt) - new Date(b.scheduledAt)));
}

export async function POST(request) {
  const { member, response } = await memberOrRefusal(request);
  if (response) return response;

  try {
    requirePermission(member.role, "appointment:create");
  } catch (err) {
    return NextResponse.json(
      { error: err.message },
      { status: err.status || 403 },
    );
  }

  // Hoisted: the create-a-client branch below needs the grid, and so does the
  // response, which carries the whole Client row back. Loading it twice would
  // be two round trips to learn one thing.
  const full = await loadEnforceableMember(db, member.id);

  const body = await request.json();
  const {
    clientName,
    clientPhone,
    scheduledAt,
    location,
    requiresSupervisor,
    assignedToId,
    quoteId,
    notes,
  } = body;
  let { clientId } = body;

  // ── What it is about, when booked by hand ────────────────────────────────
  //
  // One of quoteId / jobId / invoiceId, or none. A quote posted ALONE keeps
  // the older site-visit meaning below: the client is read off the quote.
  // Posted WITH a client of its own — the calendar dialog linking a call to
  // a record — the caller's client stays the caller's, and a record whose
  // client differs was warned about in the dialog, never refused here. The
  // owner's case is the husband ringing about the wife's job: the
  // appointment is his, the job stays hers, and both facts are kept.
  const picked = pickAbout(body);
  if (picked.error) {
    return NextResponse.json({ error: picked.error }, { status: 400 });
  }
  const about = picked.about;
  const aboutRecord = about ? await loadAboutRecord(db, member.companyId, about) : null;
  if (about && !aboutRecord) {
    // Scoped to the company, so another tenant's id misses like the quote
    // branch below: 404, and no word on whether it exists elsewhere.
    return NextResponse.json(
      { error: `That ${about.kind} isn't on this account.` },
      { status: 404 },
    );
  }
  const linkOnly = about && (about.kind !== "quote" || clientId || clientName);

  // ── An on-site measure, scheduled from a quote ───────────────────────────
  //
  // The quote page posts `quoteId` and nothing else identifies the client:
  // the client IS the quote's client, read from the row rather than trusted
  // from the browser. Scoped to the company for the same reason every lookup
  // here is. See lib/quotes/siteVisit.js for why this is an Appointment and
  // not a model of its own. An appointment about a quote is a measure
  // whichever door it came through — the confirmation letter and the job's
  // history below follow `quote`, not the door.
  const quote = about?.kind === "quote" ? aboutRecord : null;
  if (quote && !linkOnly) clientId = quote.clientId;

  // Either identifies a client. `clientId` is the precise form and is now
  // accepted — it was not, which meant a caller holding an id had no way to
  // say so and had to hope a name matched.
  if ((!clientId && !clientName) || !scheduledAt) {
    return NextResponse.json(
      { error: "Give a client (clientId or clientName) and a time." },
      { status: 400 },
    );
  }

  const when = new Date(scheduledAt);
  if (Number.isNaN(when.getTime())) {
    return NextResponse.json({ error: "That isn't a date and time." }, { status: 400 });
  }

  // Reassigning to someone else requires appointment:assign — creating your own unassigned appt doesn't
  if (
    assignedToId &&
    assignedToId !== member.userId &&
    !can(member.role, "appointment:assign")
  ) {
    return NextResponse.json(
      {
        error:
          "You can create appointments but only a supervisor or admin can assign them to someone else",
      },
      { status: 403 },
    );
  }

  // Whoever it is assigned to has to be on this team.
  //
  // There WAS a membership lookup here — but only inside the
  // `requiresSupervisor` branch below, which exists to check the assignee's
  // ROLE. An ordinary appointment skipped it entirely, so an assignedToId
  // naming a user in another company was written and read back through
  // `include: { assignedTo: { name } }`. A check that runs on the unusual path
  // and not the common one is the easiest kind to believe in.
  const notOurs = await ownedIdsRefusal(NextResponse, db, member.companyId, {
    assignedToId,
  });
  if (notOurs) return notOurs;

  if (requiresSupervisor && assignedToId) {
    const assignee = await db.member.findUnique({
      where: {
        userId_companyId: { userId: assignedToId, companyId: member.companyId },
      },
    });
    if (
      !assignee ||
      !["owner", "admin", "supervisor"].includes(assignee.role)
    ) {
      return NextResponse.json(
        {
          error:
            "This appointment requires a supervisor or admin to be assigned",
        },
        { status: 400 },
      );
    }
  }

  // ── Find the client before deciding to invent one ────────────────────────
  //
  // This used to look up by PHONE ONLY. Book "Emilio Boves" with no phone
  // number and it created a second Emilio Boves, every time — a duplicate
  // factory that nobody noticed because the create was silent.
  //
  // Adding the permission check in front of that create turned a silent bug
  // into a loud one: QA booked against a client who was plainly on file and
  // got "That client isn't on file yet", which was both a refusal and a lie.
  //
  // So resolution comes first and tries everything the caller gave us, most
  // precise first. Only a genuine miss reaches the create path.
  let client = null;

  if (clientId) {
    // Scoped to the company: an id from another tenant must miss, not throw.
    client = await db.client.findFirst({
      where: { id: clientId, companyId: member.companyId },
    });
    if (!client) {
      return NextResponse.json(
        { error: "That client isn't on this account." },
        { status: 404 },
      );
    }
  }

  if (!client && clientPhone) {
    client = await db.client.findFirst({
      where: { companyId: member.companyId, phone: clientPhone },
    });
  }

  if (!client && clientName) {
    // Case-insensitive exact match. Deliberately not `contains`: booking
    // "Emilio" against a client called "Emilio Boves Construction" would be a
    // guess, and guessing which customer an appointment belongs to is worse
    // than asking.
    client = await db.client.findFirst({
      where: {
        companyId: member.companyId,
        name: { equals: String(clientName).trim(), mode: "insensitive" },
      },
    });
  }

  if (!client) {
    // ── A side effect is still a create ──────────────────────────────────
    //
    // POST /api/clients requires clientsProperties:full_edit. This endpoint
    // used to create a client with no check at all, which meant the 403 on
    // the clients route was decorative: QA posted an appointment as an
    // employee restricted to name_address_only, got a 201, and a client
    // record appeared. Worse, the same employee then could not delete it —
    // deletion IS gated — so the bypass was one-way.
    //
    // The same level is required here as on the front door. Booking an
    // appointment for an EXISTING client is untouched; only conjuring a new
    // client record needs the permission that creating one needs.
    if (!hasLevel(full, "clientsProperties", "full_edit")) {
      return NextResponse.json(
        {
          error:
            `No client named "${String(clientName || "").trim()}" is on file, ` +
            "and your access level doesn't allow you to add one. Ask someone " +
            "who can, then book against them.",
        },
        { status: 403 },
      );
    }

    client = await db.client.create({
      data: {
        companyId: member.companyId,
        name: clientName,
        phone: clientPhone || null,
      },
    });
  }

  const appointment = await db.appointment.create({
    data: {
      companyId: member.companyId,
      clientId: client.id,
      scheduledAt: when,
      // A measure goes to the client's address unless the office typed
      // another; the calendar already falls back to client.address when this
      // is null, so storing it is what makes the CONFIRMATION letter carry
      // the same street the crew will drive to.
      location: aboutRecord
        ? prefillLocation({ typed: location, record: aboutRecord, client })
        : location || null,
      requiresSupervisor: !!requiresSupervisor,
      status:
        requiresSupervisor && !assignedToId ? "needs_supervisor" : "scheduled",
      notes: typeof notes === "string" && notes.trim() ? notes.trim().slice(0, 2000) : null,
      createdById: member.userId,
      assignedToId: assignedToId || null,
      ...(about && { [`${about.kind}Id`]: about.id }),
    },
    include: {
      client: true,
      assignedTo: { select: { id: true, name: true } },
      quote: { select: { id: true, quoteNumber: true } },
      job: { select: { id: true, title: true } },
      invoice: { select: { id: true, invoiceNumber: true } },
    },
  });

  // ── The client is told, in the document's language ───────────────────────
  //
  // Only for an appointment ABOUT something. A plain appointment booked on
  // the calendar has emailed nobody since the product began, and whether it
  // should is a product decision this route does not take on its own. One
  // about a quote, a job or an invoice is different: it is about a document
  // the client already holds, the letter can cite it, and the language is
  // fixed by non-negotiable #6 — lib/i18n/clientLanguage.js: the document's
  // language (a quote's or an invoice's; a job's is the quote it came from),
  // then the client's, then the company's. The letter is the SAME
  // confirmation the booking page sends (app/admin/lib/email/templates.js),
  // with the record named the way the calendar card names it, so the
  // confirmation, the moved and the cancelled letters all read as one visit.
  //
  // The letter goes to the APPOINTMENT's client — the person who rang — not
  // the record's, when the two differ: the husband who booked the call is
  // the one expecting the confirmation.
  //
  // `notice` says what happened, honestly: no address on file is "nothing
  // was sent", not silence, because the office is about to tell the
  // homeowner "you'll get a confirmation".
  const notice = { sent: false, language: null, to: null, simulated: false };
  if (aboutRecord) {
    const company = await db.company.findUnique({ where: { id: member.companyId } });
    const document =
      about.kind === "job" ? aboutRecord.quote || null : aboutRecord;
    const language = resolveClientLanguage({ document, client, company });
    notice.language = language;
    const to = String(client.email || "").trim();
    if (to && company) {
      notice.to = to;
      const label = aboutLabel(appointment);
      const result = await sendBookingConfirmationEmail({
        to,
        company,
        companyName: company.name,
        clientName: client.name || "",
        eventTypeName: serviceName({ language, measure: isMeasure(quote, label) }),
        startTime: appointment.scheduledAt,
        location: appointment.location || client.address || null,
        timezone: company.timezone,
        arrivalWindowMinutes: company.arrivalWindowMinutes || 0,
        about: label,
        language,
      }).catch((err) => {
        console.error("[appointments] confirmation failed:", err?.message);
        return { error: err?.message || "send failed" };
      });
      notice.sent = Boolean(result && !result.error && !result.skipped);
      notice.simulated = Boolean(result?.simulated);
    }

    // A measure is job history. Written against the quote now and against
    // its job too if one already exists — and carried into the job at
    // conversion otherwise (lib/jobs/createJobFromQuote.js). An appointment
    // about a job or an invoice is not a measure and writes nothing here.
    if (quote) {
      await recordSiteVisit(member, "scheduled", {
        appointment,
        quote,
        timeZone: company?.timezone || null,
      });
    }
  }

  // Redacted like the list and like /api/appointments/[id]. Booking an
  // appointment against an existing client is allowed at name_address_only —
  // reading that client's phone number back out of the 201 is not, and "you
  // created it so you may see it" is not true here: the client already existed.
  const out = { ...appointment, client: redactClient(full, appointment.client), notice };
  // The address the letter went to is the client's email, which the redaction
  // just decided whether this member may read. The notice follows the same
  // verdict: "sent" survives, the address does not.
  if (notice.to && !out.client?.email) notice.to = null;

  return NextResponse.json(out, { status: 201 });
}
