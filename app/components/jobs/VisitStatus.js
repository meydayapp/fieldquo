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
"use client";

import { useState } from "react";
import { Loader2, MessageSquare } from "lucide-react";
import { reportResponseError, showError } from "@/lib/clientErrors";
import { visitActions, mayMoveVisit } from "@/lib/jobs/visitStatus";
import { usePermissions } from "@/app/providers/PermissionProvider";
import { hasLevel } from "@/lib/permissions/enforce";
import { useSession } from "@/lib/auth-client";

export default function VisitStatus({ jobId, visit, client, onChanged }) {
  const [busy, setBusy] = useState(null);
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

  const actions = visitActions(visit.status);

  async function move(to) {
    setBusy(to);
    try {
      const res = await fetch(`/api/jobs/${jobId}/visits/${visit.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: to }),
      });
      if (!res.ok) {
        await reportResponseError(res, "Couldn't update the visit.");
        return;
      }
      onChanged?.();
    } catch {
      showError("Couldn't update the visit. Check your connection.");
    } finally {
      setBusy(null);
    }
  }

  const textsGoTo = client?.restricted
    ? "The client gets your “on my way” text — their number is hidden by your access level."
    : client?.phone
      ? `Texts your “on my way” wording to ${client.phone}.`
      : "No mobile on file for this client, so nothing will be sent — the visit just moves.";

  return (
    <div className="mt-3 flex flex-wrap items-center gap-2">
      {actions.map((a) => (
        <button
          key={a.to}
          type="button"
          onClick={() => move(a.to)}
          disabled={busy !== null}
          title={a.texts ? textsGoTo : undefined}
          className={
            a.tone === "primary"
              ? "inline-flex items-center gap-1.5 text-sm font-semibold px-3 py-1.5 rounded-lg bg-primary text-primary-foreground hover:opacity-90 disabled:opacity-50"
              : "inline-flex items-center gap-1.5 text-sm font-semibold px-3 py-1.5 rounded-lg border border-border hover:bg-muted disabled:opacity-50"
          }
        >
          {busy === a.to ? (
            <Loader2 size={13} className="animate-spin" />
          ) : a.texts ? (
            <MessageSquare size={13} />
          ) : null}
          {a.label}
        </button>
      ))}
      {actions.some((a) => a.texts) && (
        <span className="text-xs text-muted-foreground basis-full">
          {textsGoTo}
        </span>
      )}
    </div>
  );
}
