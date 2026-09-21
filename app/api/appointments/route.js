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
} from "@/lib/permissions/enforce";
import { ownedIdsRefusal } from "@/lib/tenant/ownedIds";
import { sendBookingConfirmationEmail } from "@/app/admin/lib/email/templates";
import { resolveClientLanguage } from "@/lib/i18n/clientLanguage";
import { serviceName, isMeasure } from "@/lib/schedule/clientNotice";
import { recordSiteVisit } from "@/lib/quotes/siteVisitActivity";
import { pickAbout, prefillLocation, aboutLabel } from "@/lib/schedule/appointmentAbout";
import { loadAboutRecord } from "@/lib/schedule/aboutRecord";
import { geocodeAppointment, appointmentAddress } from "@/lib/geo/geocodeAppointment";
import { loadScheduleFeed } from "@/lib/schedule/feed";
import { scheduleSync } from "@/lib/calendar/googleSync";

export async function GET(request) {
  const { member, response } = await memberOrRefusal(request);
  if (response) return response;

  // The three-source union, its scoping and its redaction live in
  // lib/schedule/feed.js now, so the day map (app/api/schedule/map) reads the
  // SAME rows for the same caller rather than a second copy of the rule. The
  // grid is loaded here, not there: the feed takes `full` as an argument so
  // no caller can hand it a session member with no permissions and have every
  // scope fall open.
  const full = await loadEnforceableMember(db, member.id);
  return NextResponse.json(await loadScheduleFeed(db, member, full));
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

  // ── One Google call per address, at the moment it is set ─────────────────
  //
  // The same wrapper and the same refusals as a job's siteAddress
  // (lib/geo/geocodeAppointment.js). Awaited, as createJob awaits its
  // geocode: a serverless function may be frozen the instant it responds, and
  // the wrapper's own timeout bounds the wait. A failure leaves nulls — the
  // appointment is booked either way, and the day map lists it as "no
  // location on the map" rather than dropping it.
  if (appointmentAddress(appointment)) {
    const coords = await geocodeAppointment(db, appointment);
    Object.assign(appointment, {
      latitude: coords.latitude,
      longitude: coords.longitude,
      geocodedAt: coords.geocodedAt,
    });
  }

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

  // Onto the assignee's Google Calendar, behind the response — a Google
  // hiccup can never fail the booking that just saved.
  scheduleSync("appointment", appointment.id);

  return NextResponse.json(out, { status: 201 });
}
