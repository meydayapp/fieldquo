// app/components/jobs/VisitStatus.js
//
// The control that moves a visit from scheduled, to on the way, to done.
//
// ── What was missing ───────────────────────────────────────────────────────
//
// `JobVisit.status` was written exactly once — at creation, as "scheduled" —
// and nothing in the product could ever change it. The PATCH route accepted a
// status, reacted to two of them, and the only client that ever called it was
// the checklist, which sends `checklistItems` and nothing else. So the "on my
// way" text had a settings screen for its wording, a template renderer, an
// opt-out check and a send path, and no button. See lib/jobs/visitStatus.js
// for the full list of what that stranded.
//
// ── The text is named on the button, not discovered afterwards ─────────────
//
// Moving a visit to "on the way" texts the homeowner. That is an outward-facing
// side effect fired by what otherwise looks like a status pill, so the label
// says it and the line underneath says where it goes. Three different sentences,
// because the honest one depends on what this viewer can actually see:
//
//   - phone visible      → name the number. The crew member can check it.
//   - client restricted  → the viewer is on name_address_only and the phone is
//                          withheld from them, NOT missing. The text will still
//                          send. Saying "no number on file" here would be the
//                          Absent() bug on the client panel above, repeated.
//   - genuinely no phone → say plainly that nothing gets sent, because the
//                          status still changes and a crew member who pressed
//                          a button called "text the client" deserves to know
//                          no text happened.
//
// ── Success is not a delivery receipt ──────────────────────────────────────
//
// The route fires the SMS in a detached async IIFE and never reports on it —
// deliberately, so a Twilio outage can't block the status from saving, and so
// an opt-out check can run without holding the response. That means a 200 here
// means "the status saved", never "the client got a text". Nothing below claims
// otherwise.
//
// ── Where the phone was, once, at the tap ──────────────────────────────────
//
// "On my way" and "Complete" are the two moments a position beside a visit
// means something, so the tap asks the phone where it is — once, with the
// browser's own permission prompt, through lib/location/capture.js — and
// sends it as `stamp` beside the status. The status change does not wait on
// an answer it did not get: a refusal, a desktop, no fix inside eight seconds
// all send the same request this button always sent, minus the stamp. There
// is no background reading here; nothing runs between taps.
//
// ── Now a thin wrapper ─────────────────────────────────────────────────────
//
// The buttons, the stamp and the sentences above moved into
// app/components/schedule/EntryActions.js, which renders the same control on
// the calendar for appointments and visits alike and adds the two things this
// file never had: moving the visit's time, and cancelling it with a reason.
// What stays here is the crew gate — mayMoveVisit, mirroring the route — and
// `crew: true`, which is what makes "On my way" appear and the tap ask the
// phone where it is.
"use client";

import { mayMoveVisit } from "@/lib/jobs/visitStatus";
import { usePermissions } from "@/app/providers/PermissionProvider";
import { hasLevel } from "@/lib/permissions/enforce";
import { useSession } from "@/lib/auth-client";
import EntryActions from "@/app/components/schedule/EntryActions";

export default function VisitStatus({ jobId, visit, client, onChanged }) {
  const caller = usePermissions();
  const { data: session } = useSession();

  const mayMove = mayMoveVisit({
    assignedToId: visit.assignedToId ?? null,
    userId: session?.user?.id || null,
    hasEditAll: hasLevel(caller, "schedule", "edit_all"),
  });

  // Not an access control — the route re-asks the identical question and
  // refuses with a sentence telling them who to ask. This only stops offering
  // work that would 403.
  if (!mayMove) return null;

  return (
    <EntryActions
      kind="visit"
      id={visit.id}
      jobId={jobId}
      status={visit.status}
      scheduledAt={visit.scheduledAt}
      client={client}
      crew
      onChanged={onChanged}
    />
  );
}
