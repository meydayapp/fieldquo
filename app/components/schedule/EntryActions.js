// app/components/schedule/EntryActions.js
//
// The office's controls on one scheduled thing: move it, call it off, mark it
// done, put it back.
//
// ── One control, two kinds of row ──────────────────────────────────────────
//
// The calendar merges Appointments and JobVisits (lib/schedule/jobVisits.js)
// and could reassign either and do nothing else. The job page could move a
// visit through its statuses and not move its time. This is the one set of
// buttons for both, keyed on `kind`: the endpoint differs, the transition
// list differs (lib/jobs/visitStatus.js vs lib/appointments/statusLabels.js),
// and everything else — the dialogs, the travel warning, the "email the
// client" tick — is the same because the thing being done is the same.
//
// ── The gate is the parent's ───────────────────────────────────────────────
//
// Whether this viewer may touch this row is decided where the row is known:
// mayMoveVisit on the job page, the calendar's own mine-or-edit_all test. Both
// mirror their route; this component only offers what will not 403. Hiding a
// button is not access control and nothing here claims it is.
//
// ── A refusal is a sentence, then a choice ─────────────────────────────────
//
// The move routes answer 409 with a reason key when the new time is in the
// past or leaves too little for the drive (lib/schedule/moveEntry.js). The
// dialog renders the reason in the office's language and offers "Move it
// anyway", which re-posts with `force: true`. The office may overrule the
// estimate; a client never can — see moveEntry.js for why that is right.
"use client";

import { useState } from "react";
import { CalendarClock, Loader2, MessageSquare, X } from "lucide-react";
import { reportResponseError, showError } from "@/lib/clientErrors";
import { showToast } from "@/lib/toast";
import { useTranslation } from "@/app/hooks/useTranslation";
import { visitActions, visitActionLabel } from "@/lib/jobs/visitStatus";
import { appointmentActions } from "@/lib/appointments/statusLabels";
import { captureStamp } from "@/lib/location/capture";
import { languageMeta } from "@/app/i18n/languages";

/** The PATCH target for a row of this kind. */
function endpointFor({ kind, id, jobId }) {
  return kind === "visit" ? `/api/jobs/${jobId}/visits/${id}` : `/api/appointments/${id}`;
}

/** A Date as the value a <input type="datetime-local"> wants, in local time. */
function toLocalInput(value) {
  const d = value ? new Date(value) : null;
  if (!d || Number.isNaN(d.getTime())) return "";
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

const quiet =
  "inline-flex items-center gap-1.5 min-h-[36px] text-sm font-semibold px-3 py-1.5 rounded-lg border border-border hover:bg-muted disabled:opacity-50";
const primary =
  "inline-flex items-center gap-1.5 min-h-[36px] text-sm font-semibold px-3 py-1.5 rounded-lg bg-primary text-primary-foreground hover:opacity-90 disabled:opacity-50";

/**
 * @param {"visit"|"appointment"} kind
 * @param {string}  id
 * @param {string}  [jobId]      required for a visit
 * @param {string}  status
 * @param {string|Date} scheduledAt
 * @param {object}  [client]     { email, phone, restricted } — what the letter
 *                               and the on-my-way text will reach
 * @param {boolean} [crew]       the job page: offer the crew's own "on my way"
 *                               and stamp the phone's position on the tap
 * @param {function} onChanged   called after any successful change
 */
export default function EntryActions({ kind, id, jobId, status, scheduledAt, client, crew = false, onChanged }) {
  const { t } = useTranslation();
  const [busy, setBusy] = useState(null);
  const [dialog, setDialog] = useState(null); // "move" | "cancel" | null

  const all = kind === "visit" ? visitActions(status) : appointmentActions(status);
  // The calendar is not the van: "on my way" is a crew member's move, texts a
  // stranger, and wants the phone's position. Only the job page offers it.
  const actions = all.filter((a) => crew || a.office);
  const canMove = !["completed", "cancelled", "canceled"].includes(status);

  const url = endpointFor({ kind, id, jobId });

  async function patch(body) {
    const res = await fetch(url, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    return res;
  }

  async function move(to) {
    setBusy(to);
    try {
      // null whenever the phone did not answer; the body then carries no
      // `stamp` key at all. Only the crew's own taps ask — an office member
      // completing a visit from a desk is not a position of the crew.
      const stamp = crew && kind === "visit" ? await captureStamp() : null;
      const res = await patch({ status: to, ...(stamp && { stamp }) });
      if (!res.ok) {
        await reportResponseError(res, t("app.visitAction.failed", "Couldn't update the visit."));
        return;
      }
      onChanged?.();
    } catch {
      showError(t("app.visitAction.failedNetwork", "Couldn't update the visit. Check your connection."));
    } finally {
      setBusy(null);
    }
  }

  const textsGoTo = client?.restricted
    ? t("app.visitAction.textsRestricted")
    : client?.phone
      ? t("app.visitAction.textsTo", { phone: client.phone })
      : t("app.visitAction.textsNone");

  return (
    <div className="mt-3 flex flex-wrap items-center gap-2">
      {canMove && (
        <button type="button" onClick={() => setDialog("move")} disabled={busy !== null} className={quiet}>
          <CalendarClock size={13} />
          {t("app.visitAction.reschedule", "Reschedule")}
        </button>
      )}
      {actions.map((a) => (
        <button
          key={a.to}
          type="button"
          onClick={() => (a.cancels ? setDialog("cancel") : move(a.to))}
          disabled={busy !== null}
          title={a.texts ? textsGoTo : undefined}
          className={a.tone === "primary" ? primary : quiet}
        >
          {busy === a.to ? <Loader2 size={13} className="animate-spin" /> : a.texts ? <MessageSquare size={13} /> : null}
          {visitActionLabel(a, t)}
        </button>
      ))}
      {actions.some((a) => a.texts) && (
        <span className="text-xs text-muted-foreground basis-full">{textsGoTo}</span>
      )}

      {dialog === "move" && (
        <MoveDialog
          t={t}
          scheduledAt={scheduledAt}
          client={client}
          patch={patch}
          onClose={() => setDialog(null)}
          onDone={() => {
            setDialog(null);
            onChanged?.();
          }}
        />
      )}
      {dialog === "cancel" && (
        <CancelDialog
          t={t}
          client={client}
          patch={patch}
          onClose={() => setDialog(null)}
          onDone={() => {
            setDialog(null);
            onChanged?.();
          }}
        />
      )}
    </div>
  );
}

/** The "email the client" tick, or the honest sentence about why there is none. */
function NotifyRow({ t, client, notify, setNotify }) {
  if (client?.restricted) {
    return (
      <label className="flex items-start gap-2.5 text-sm text-foreground">
        <input type="checkbox" checked={notify} onChange={(e) => setNotify(e.target.checked)} className="mt-0.5" />
        <span>{t("app.visitAction.emailRestricted")}</span>
      </label>
    );
  }
  // The calendar's visit rows carry a name and an address and no email key at
  // all (lib/schedule/jobVisits.js narrows to what name_address_only allows).
  // "No email on file" would be a claim about a field this screen never
  // loaded, so an unknown address gets the tick with the honest wording and
  // the route sends only if there is one.
  if (!client || !("email" in client)) {
    return (
      <label className="flex items-start gap-2.5 text-sm text-foreground">
        <input type="checkbox" checked={notify} onChange={(e) => setNotify(e.target.checked)} className="mt-0.5" />
        <span>{t("app.visitAction.emailClientUnknown")}</span>
      </label>
    );
  }
  if (!client.email) {
    return <p className="text-xs text-muted-foreground">{t("app.visitAction.noEmail")}</p>;
  }
  return (
    <label className="flex items-start gap-2.5 text-sm text-foreground">
      <input type="checkbox" checked={notify} onChange={(e) => setNotify(e.target.checked)} className="mt-0.5" />
      <span>{t("app.visitAction.emailClient", { email: client.email })}</span>
    </label>
  );
}

function Shell({ t, title, onClose, children }) {
  return (
    <div className="fixed inset-0 bg-black/40 flex items-end sm:items-center justify-center z-50 p-0 sm:p-4" onClick={onClose}>
      <div
        className="bg-card rounded-t-2xl sm:rounded-xl w-full sm:max-w-md p-5 max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label={t("app.action.close", "Close")}
            className="inline-flex items-center justify-center min-h-[44px] min-w-[44px] -mr-2 text-muted-foreground"
          >
            <X size={18} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

/** The reason the route refused, in the office's language. */
function refusal(t, data) {
  const minutes = data?.travel?.shortBy;
  switch (data?.reason) {
    case "in_the_past":
      return t("app.visitAction.reason.in_the_past");
    case "travel_short":
      return data.travel?.against === "next"
        ? t("app.visitAction.reason.travel_short_next", { minutes })
        : t("app.visitAction.reason.travel_short_prev", { minutes });
    case "no_time":
    case "bad_time":
      return t("app.visitAction.reason.bad_time");
    default:
      return data?.error || t("app.visitAction.failed", "Couldn't update the visit.");
  }
}

function MoveDialog({ t, scheduledAt, client, patch, onClose, onDone }) {
  const [when, setWhen] = useState(toLocalInput(scheduledAt));
  const [notify, setNotify] = useState(!client || !("email" in client) || Boolean(client.email || client.restricted));
  const [saving, setSaving] = useState(false);
  const [warning, setWarning] = useState(null); // { text, canForce }

  async function submit(force) {
    if (!when) return;
    setSaving(true);
    setWarning(null);
    try {
      const res = await patch({
        scheduledAt: new Date(when).toISOString(),
        notifyClient: notify,
        ...(force && { force: true }),
      });
      if (res.ok) {
        const data = await res.json().catch(() => ({}));
        if (data?.notice?.sent && data.notice.language) {
          showToast({
            message: t("app.visitAction.emailed", { language: languageMeta(data.notice.language).nativeName }),
            tone: "info",
          });
        }
        onDone();
        return;
      }
      // 409 is a conversation, not a failure: show the reason and offer the
      // override. Anything else is reported the way every other request is.
      if (res.status === 409) {
        const data = await res.json().catch(() => ({}));
        setWarning({ text: refusal(t, data), canForce: ["in_the_past", "travel_short"].includes(data?.reason) });
        return;
      }
      await reportResponseError(res, t("app.visitAction.failed", "Couldn't update the visit."));
    } catch {
      showError(t("app.visitAction.failedNetwork", "Couldn't update the visit. Check your connection."));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Shell t={t} title={t("app.visitAction.rescheduleTitle", "Move this visit")} onClose={onClose}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          submit(false);
        }}
        className="space-y-4"
      >
        <div>
          <label className="block text-sm font-medium text-foreground mb-1">{t("app.visitAction.newTime")}</label>
          <input
            type="datetime-local"
            value={when}
            onChange={(e) => {
              setWhen(e.target.value);
              setWarning(null);
            }}
            required
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
          />
        </div>
        <NotifyRow t={t} client={client} notify={notify} setNotify={setNotify} />
        {warning && (
          <div className="rounded-lg border border-amber-200 dark:border-amber-900 bg-amber-50 dark:bg-amber-950/40 px-3 py-2 text-sm text-amber-800 dark:text-amber-200">
            {warning.text}
          </div>
        )}
        <div className="flex gap-3 pt-1">
          <button type="button" onClick={onClose} disabled={saving} className={`${quiet} flex-1 justify-center py-2.5`}>
            {t("app.action.cancel", "Cancel")}
          </button>
          {warning?.canForce ? (
            <button type="button" onClick={() => submit(true)} disabled={saving} className={`${primary} flex-1 justify-center py-2.5`}>
              {saving ? <Loader2 size={13} className="animate-spin" /> : null}
              {t("app.visitAction.moveAnyway")}
            </button>
          ) : (
            <button type="submit" disabled={saving || !when} className={`${primary} flex-1 justify-center py-2.5`}>
              {saving ? <Loader2 size={13} className="animate-spin" /> : null}
              {t("app.visitAction.move")}
            </button>
          )}
        </div>
      </form>
    </Shell>
  );
}

function CancelDialog({ t, client, patch, onClose, onDone }) {
  const [reason, setReason] = useState("");
  const [notify, setNotify] = useState(!client || !("email" in client) || Boolean(client.email || client.restricted));
  const [saving, setSaving] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await patch({ status: "cancelled", cancelReason: reason.trim() || null, notifyClient: notify });
      if (!res.ok) {
        await reportResponseError(res, t("app.visitAction.failed", "Couldn't update the visit."));
        return;
      }
      const data = await res.json().catch(() => ({}));
      if (data?.notice?.sent && data.notice.language) {
        showToast({
          message: t("app.visitAction.emailed", { language: languageMeta(data.notice.language).nativeName }),
          tone: "info",
        });
      }
      onDone();
    } catch {
      showError(t("app.visitAction.failedNetwork", "Couldn't update the visit. Check your connection."));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Shell t={t} title={t("app.visitAction.cancelTitle", "Cancel this visit")} onClose={onClose}>
      <form onSubmit={submit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-foreground mb-1">{t("app.visitAction.cancelReason")}</label>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={2}
            maxLength={500}
            placeholder={t("app.visitAction.cancelReasonPlaceholder")}
            className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
          />
        </div>
        <NotifyRow t={t} client={client} notify={notify} setNotify={setNotify} />
        <div className="flex gap-3 pt-1">
          <button type="button" onClick={onClose} disabled={saving} className={`${quiet} flex-1 justify-center py-2.5`}>
            {t("app.visitAction.keep")}
          </button>
          <button
            type="submit"
            disabled={saving}
            className="flex-1 inline-flex items-center justify-center gap-1.5 bg-red-600 text-white py-2.5 rounded-lg text-sm font-semibold disabled:opacity-60"
          >
            {saving ? <Loader2 size={13} className="animate-spin" /> : null}
            {t("app.visitAction.confirmCancel")}
          </button>
        </div>
      </form>
    </Shell>
  );
}
