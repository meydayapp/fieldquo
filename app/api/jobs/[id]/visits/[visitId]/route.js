// app/api/jobs/[id]/visits/[visitId]/route.js
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { memberOrRefusal } from "@/lib/apiMember";
import { sendSms } from "@/lib/sms/twilioClient";
import { renderMessage } from "@/lib/sms/renderTemplate";
import { resolveClientLanguage } from "@/lib/i18n/clientLanguage";
import { maySms } from "@/lib/sms/optOut";
import { clientSmsFrom } from "@/lib/sms/clientLine";
import { ensureUpcomingVisit } from "@/lib/jobs/recurrence";
import { normalizeChecklistItems } from "@/lib/jobs/checklistItems";
import { loadEnforceableMember, hasLevel } from "@/lib/permissions/enforce";
import { isCallbackReason } from "@/lib/jobs/callbackReasons";
import { recordStampIfPresent } from "@/lib/location/stamps";
import { planOfficeMove, bracketStops, moveReasonMessage } from "@/lib/schedule/moveEntry";
import { assigneeStopsAround } from "@/lib/schedule/entryNeighbours";
import { notifyClientMoved, notifyClientCancelled } from "@/lib/schedule/clientNotice";
import { travelMinutes, hasPoint } from "@/lib/booking/travel";
import { serverMapsKey } from "@/lib/measure/roofMeasurement";

/**
 * "20 min" / "1 h 10" — the number the template's {eta} slot takes.
 *
 * Minutes only, no "about": the wording around the token is the company's
 * own, in the client's language, and a unit word in English would sit inside
 * a French sentence. Rounded up to the nearest five so a straight-line guess
 * does not read as a measurement.
 */
function etaPhrase(minutes) {
  const m = Math.max(5, Math.ceil(minutes / 5) * 5);
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  const rest = m % 60;
  return rest ? `${h} h ${String(rest).padStart(2, "0")}` : `${h} h`;
}

export async function PATCH(request, { params }) {
  // Next 16: `params` is a Promise; reading it synchronously gives undefined.
  const _params = await params;
  const { member, response } = await memberOrRefusal(request);
  if (response) return response;

  const visit = await db.jobVisit.findFirst({
    where: {
      id: _params.visitId,
      jobId: _params.id,
      job: { companyId: member.companyId },
    },
    include: {
      job: {
        include: {
          client: true,
          company: true,
          // The letter's language follows the quote the job came from, when
          // there is one — the same rule the quote's own covering email used.
          quote: { select: { language: true, quoteNumber: true } },
        },
      },
    },
  });
  if (!visit) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // ── Whose visit is this? ───────────────────────────────────────────────
  //
  // Company scope was the only check, so any member could edit ANY visit —
  // QA rewrote the notes on a visit assigned to a colleague. This is the crew
  // endpoint: ticking off a checklist, adding photos, leaving a note about
  // what was found. All of that is about the visit YOU attended.
  //
  // Scoped on the `schedule` grid, the same one the appointment routes use,
  // because a visit is a scheduled piece of work and there is no reason for it
  // to answer a different question. Unassigned stays editable — an unclaimed
  // visit that nobody can complete is a visit that nobody does, which is the
  // reasoning the appointments list already carries.
  const full = await loadEnforceableMember(db, member.id);
  const mine = !!member.userId && visit.assignedToId === member.userId;
  if (!mine && visit.assignedToId !== null && !hasLevel(full, "schedule", "edit_all")) {
    return NextResponse.json(
      {
        error:
          "You can only update visits assigned to you. Ask whoever runs the " +
          "schedule to reassign this one.",
      },
      { status: 403 },
    );
  }

  const body = await request.json();
  const { status, checklistItems, photos, notes, scheduledAt, returnReason, returnNotes, stamp } = body;

  // ── Moving it: the booking page's arithmetic, with an office override ────
  //
  // Same check, same function and same `force` escape as the appointment
  // route — lib/schedule/moveEntry.js says why. The visit's coordinates are
  // the job site's; a job that never geocoded contributes no travel, and
  // unknown travel never blocks.
  let plan = null;
  if (scheduledAt !== undefined) {
    const start = new Date(scheduledAt);
    const stops = Number.isFinite(start.getTime())
      ? await assigneeStopsAround({
          companyId: visit.job.companyId,
          assignedToId: visit.assignedToId,
          start,
          exclude: { visitId: visit.id },
        })
      : [];
    const { previous, next } = bracketStops(stops, start);
    const here = {
      lat: Number(visit.job.siteLatitude ?? visit.job.latitude),
      lng: Number(visit.job.siteLongitude ?? visit.job.longitude),
    };
    const key = serverMapsKey();
    const [fromPrev, toNext] = await Promise.all([
      previous?.point && hasPoint(here) ? travelMinutes(previous.point, here, { key }) : null,
      next?.point && hasPoint(here) ? travelMinutes(here, next.point, { key }) : null,
    ]);
    plan = planOfficeMove({
      scheduledAt,
      force: body.force === true,
      previous,
      next,
      travelFromPrevious: fromPrev?.minutes ?? null,
      travelToNext: toNext?.minutes ?? null,
      travelBuffer: visit.job.company.travelBufferMinutes || 0,
    });
    if (!plan.ok) {
      return NextResponse.json(
        { error: moveReasonMessage(plan.reason, plan.travel), reason: plan.reason, travel: plan.travel },
        { status: plan.httpStatus },
      );
    }
  }

  // A cancel carries its reason and a reopen clears it — see the appointment
  // route for the same two lines and why. Cancelling is a status, never a
  // delete: the job's visit count and the calendar both still show the day.
  const cancelling = status === "cancelled";
  const reopening = status === "scheduled" && ["cancelled", "canceled"].includes(visit.status);
  const cancelReason = cancelling
    ? String(body.cancelReason ?? "").trim().slice(0, 500) || null
    : reopening
      ? null
      : undefined;

  if (returnReason !== undefined && returnReason !== null && !isCallbackReason(returnReason)) {
    return NextResponse.json(
      { error: `Unknown return reason: ${returnReason}` },
      { status: 400 },
    );
  }

  // keepDone: this is the crew ticking things off, so `done` is the payload,
  // not noise to reset. No forcePhase either — a visit's list is mixed by
  // design (pre/during/post all sit in one array) and each item stays where
  // the template that contributed it put it.
  const items =
    checklistItems === undefined
      ? undefined
      : normalizeChecklistItems(checklistItems, { keepDone: true });

  const updated = await db.jobVisit.update({
    where: { id: _params.visitId },
    data: {
      ...(status !== undefined && { status }),
      ...(items !== undefined && {
        checklistItems: items.length ? items : null,
      }),
      ...(photos !== undefined && { photos }),
      ...(notes !== undefined && { notes }),
      ...(plan && { scheduledAt: plan.start }),
      ...(cancelReason !== undefined && { cancelReason }),
      // Null is a legal value here — "actually, this wasn't a callback" has to
      // be un-settable, not just settable, or a mis-tap permanently taints a
      // job's rework rate with no way back.
      ...(returnReason !== undefined && { returnReason: returnReason || null }),
      ...(returnNotes !== undefined && { returnNotes: returnNotes || null }),
    },
    include: { assignedTo: { select: { id: true, name: true } } },
  });

  // ── Where the phone was when they tapped ──────────────────────────────────
  //
  // Only for a status change, and only after the update above has succeeded.
  // recordStampIfPresent never throws and nothing below reads its result, so
  // a refused permission, a desktop browser or a malformed `stamp` leaves
  // this response byte-for-byte what it was before the field existed. The
  // worker is the visit's assignee when that is who tapped, and nobody
  // otherwise — an office member completing a visit from a desk is not a
  // position of the crew. See lib/location/stamps.js.
  if (status !== undefined && stamp != null) {
    try {
      const worker = mine
        ? await db.worker.findFirst({
            where: { companyId: visit.job.companyId, userId: member.userId },
            select: { id: true },
          })
        : null;
      await recordStampIfPresent({
        db,
        companyId: visit.job.companyId,
        kind: status,
        stamp,
        workerId: worker?.id ?? null,
        jobId: visit.jobId,
        visitId: visit.id,
      });
    } catch (err) {
      console.error("[visit status] location stamp not recorded:", err?.message);
    }
  }

  // Fire an "on my way" text when status flips to that state — don't let an SMS
  // failure block the actual status update from saving. Wrapped in an async
  // IIFE (rather than a bare `await`) so the opt-out check ahead of the send
  // keeps that same "never blocks the response" property.
  if (status === "on_the_way" && visit.job.client.phone) {
    (async () => {
      // Reply STOP has to mean something everywhere a client-facing text goes
      // out, not just on the reminder cron that already checked it — see
      // lib/sms/optOut.js.
      const allowed = await maySms({ companyId: visit.job.companyId, phone: visit.job.client.phone });
      if (!allowed) return;

      // ── The ETA, when there is one to give ──────────────────────────────
      //
      // `{eta}` was offered in the template editor and never supplied, so a
      // company that wrote "ETA {eta}" texted "ETA" to every client. It is
      // filled the way the booking page works out travel: from where the
      // phone was when the button was tapped (the `stamp`, when the crew
      // member allowed it) to the job's geocoded site, through the same
      // travelMinutes. No stamp, or a job that never geocoded, and the token
      // collapses to nothing — the text reads "is on the way" and says no
      // number it cannot stand behind.
      let eta = null;
      const site = {
        lat: Number(visit.job.siteLatitude ?? visit.job.latitude),
        lng: Number(visit.job.siteLongitude ?? visit.job.longitude),
      };
      const from = { lat: Number(stamp?.latitude), lng: Number(stamp?.longitude) };
      if (hasPoint(from) && hasPoint(site)) {
        const drive = await travelMinutes(from, site, { key: serverMapsKey() }).catch(() => null);
        if (drive && Number.isFinite(drive.minutes)) eta = etaPhrase(drive.minutes);
      }

      await sendSms({
        to: visit.job.client.phone,
        // The company's own number when it has one, else the shared line —
        // the same decision the inbound STOP route resolves in reverse. See
        // lib/sms/clientLine.js.
        from: clientSmsFrom(visit.job.company),
        // Simulated for a demo tenant rather than sent — see lib/sms/demoSms.js.
        // The status change, the row and the activity trail all still happen,
        // so a rep demoing "on my way" sees the whole flow work.
        companyId: visit.job.companyId,
        // The company's own wording when they set it, the built-in otherwise.
        // renderMessage falls back safely if a stored template is invalid, so a
        // bad edit can never ship a raw "{token}" to a customer.
        body: renderMessage({
          type: "on_my_way",
          templates: visit.job.company.smsTemplates,
          // The text follows the client's language like their quote did; the
          // company's custom wording applies only to clients who read the
          // language it was written in.
          language: resolveClientLanguage({ client: visit.job.client, company: visit.job.company }),
          templateLanguage: visit.job.company.defaultLanguage || "en",
          values: {
            company: visit.job.company.name,
            worker: updated.assignedTo?.name || "Your technician",
            name: (visit.job.client.name || "").split(/\s+/)[0],
            eta,
            // The number a client can call to move the visit. Replies to the
            // text are not read; the wording says so by pointing here.
            phone: visit.job.company.phone || null,
          },
        }),
      });
    })().catch((err) => console.error("On-my-way SMS failed:", err.message));
  }

  // A completed visit on a recurring job spawns the next one immediately, so the
  // crew closing out today's clean sees next week's already on the calendar
  // instead of waiting for the nightly cron. ensureUpcomingVisit is idempotent
  // (it no-ops when a future visit already exists), so this and the cron can't
  // double-book. Never let it block the status update that just saved.
  if (status === "completed" && visit.job.recurring) {
    await ensureUpcomingVisit(db, _params.id).catch((err) =>
      console.error("[recurring next-visit] failed:", err.message),
    );
  }

  // ── Telling the client, in their language ────────────────────────────────
  //
  // The office moved or cancelled a visit the client was expecting. Same two
  // letters the client's own link sends, `initiatedBy: "office"`, in the
  // language of the quote the job came from, else the client's, else the
  // company's. `notifyClient: false` is the dialog's tick for a change
  // already agreed by phone. Nothing is sent for "on my way" (that is the
  // text above) or for completing.
  const notice = { sent: false, language: null };
  if (body.notifyClient !== false && (plan || cancelling)) {
    const common = {
      company: visit.job.company,
      client: visit.job.client,
      quote: visit.job.quote,
      jobTitle: visit.job.title,
      location: visit.job.siteAddress || visit.job.client?.address || null,
    };
    const result = plan
      ? await notifyClientMoved({ ...common, previousStartTime: visit.scheduledAt, startTime: plan.start })
      : await notifyClientCancelled({ ...common, startTime: visit.scheduledAt });
    notice.sent = result.sent;
    notice.language = result.language;
  }

  return NextResponse.json({ ...updated, notice });
}
