// app/components/quotes/SiteVisitPanel.js
//
// "Schedule an on-site visit" on a quote — the estimator's trip to measure up
// before the price is final — and the list of the visits already booked.
//
// ── One scheduler, not a second one ────────────────────────────────────────
//
// The form here is the same two questions the job's visit page asks (when,
// who — app/app/jobs/[id]/visits/new) and posts to the same route the
// calendar's "New appointment" posts to, with one extra field: `quoteId`.
// The server reads the client off the quote, writes an Appointment row, and
// sends the client the confirmation letter the booking page sends. So a visit
// scheduled here IS a calendar entry — reschedule, complete and cancel are
// the calendar's own EntryActions, mounted on each row below, going through
// the same PATCH with the same letters in the quote's language.
//
// ── Where it is mounted ────────────────────────────────────────────────────
//
// The quote detail page and the builder in EDIT mode. Not the builder in
// create mode: there is no quote row to link to until the first save, and a
// button that scheduled a visit against nothing would be the control
// AGENTS.md opens with.
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { CalendarClock, CalendarDays, Loader2, MapPin, Plus, User as UserIcon, X } from "lucide-react";
import { fetchJson } from "@/lib/fetchJson";
import { useTranslation } from "@/app/hooks/useTranslation";
import { useCompanyPreferences } from "@/app/providers/CompanyPreferencesProvider";
import { usePermissions } from "@/app/providers/PermissionProvider";
import { useSession } from "@/lib/auth-client";
import { can } from "@/lib/permissions";
import { hasLevel } from "@/lib/permissions/enforce";
import { personOptionLabel } from "@/lib/team/personLabel";
import { dayKey } from "@/lib/calendar/monthGrid";
import { formatAddress } from "@/lib/format/address";
import { languageMeta } from "@/app/i18n/languages";
import {
  appointmentStatusClasses,
  appointmentStatusLabel,
} from "@/lib/appointments/statusLabels";
import EntryActions from "@/app/components/schedule/EntryActions";

const inputClass =
  "w-full border border-border rounded-lg px-3 py-2.5 text-sm bg-card focus:outline-none focus:ring-2 focus:ring-ring/10 focus:border-border";

/** The language's own name for the notice — "français", not "fr". */
function languageName(code) {
  if (!code) return "";
  const meta = languageMeta(code);
  return meta?.nativeName || meta?.name || code;
}

/**
 * The rows: one per measure, date, estimator, status, and a link to the day
 * on the calendar. Shared with the job page, which shows the same visits
 * read-only above the crew's own — so the two screens cannot describe one
 * appointment two ways.
 *
 * @param {object[]} visits   Appointment rows { id, scheduledAt, status, assignedTo, cancelReason }
 * @param {object}  [client]  the (redacted) client, for EntryActions' letters
 * @param {function} [onChanged] when given, each row gets the office actions
 */
export function SiteVisitRows({ visits, client = null, onChanged = null }) {
  const { t } = useTranslation();
  const { formatDateTime } = useCompanyPreferences();
  const caller = usePermissions();
  const { data: session } = useSession();
  const myUserId = session?.user?.id || null;

  if (!visits?.length) return null;

  return (
    <ul className="divide-y divide-border">
      {visits.map((v) => {
        // Same dial as the calendar row: the assignee, or schedule:edit_all.
        // The route re-asks and refuses; this only decides what is drawn.
        const mayAct =
          Boolean(onChanged) &&
          (!caller?.role ||
            (myUserId && v.assignedToId === myUserId) ||
            hasLevel(caller, "schedule", "edit_all"));
        return (
          <li key={v.id} className="py-3 first:pt-0 last:pb-0">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <span className="inline-flex items-center gap-1.5 text-sm font-medium text-foreground">
                <CalendarClock size={14} className="text-muted-foreground" />
                {formatDateTime(v.scheduledAt)}
              </span>
              <span className="inline-flex items-center gap-1.5 text-sm text-muted-foreground">
                <UserIcon size={14} />
                {v.assignedTo?.name || t("app.visitNew.unassigned", "Not assigned yet")}
              </span>
              <span
                className={`text-xs font-medium px-2 py-0.5 rounded-full ${appointmentStatusClasses(v.status)}`}
              >
                {appointmentStatusLabel(v.status, t)}
              </span>
              <Link
                href={`/app/appointments?day=${dayKey(new Date(v.scheduledAt))}`}
                className="inline-flex items-center gap-1 text-sm underline underline-offset-2"
              >
                <CalendarDays size={13} />
                {t("app.siteVisit.seeOnCalendar", "See on calendar")}
              </Link>
            </div>
            {v.location && (
              <p className="text-xs text-muted-foreground mt-1 inline-flex items-center gap-1">
                <MapPin size={12} /> {v.location}
              </p>
            )}
            {v.cancelReason && v.status === "cancelled" && (
              <p className="text-xs text-muted-foreground mt-1">
                {t("app.visitAction.cancelledWhy", { reason: v.cancelReason })}
              </p>
            )}
            {mayAct && (
              <EntryActions
                kind="appointment"
                id={v.id}
                status={v.status}
                scheduledAt={v.scheduledAt}
                client={client}
                onChanged={onChanged}
              />
            )}
          </li>
        );
      })}
    </ul>
  );
}

/**
 * @param {string} quoteId
 * @param {object} quote   GET /api/quotes/[id] payload: client, quoteNumber,
 *                         appointments, jobs, language
 */
export default function SiteVisitPanel({ quoteId, quote }) {
  const { t } = useTranslation();
  const caller = usePermissions();
  const [visits, setVisits] = useState(() => quote?.appointments || []);
  const [open, setOpen] = useState(false);
  const [notice, setNotice] = useState(null);

  // The parent re-reads the quote (the detail page after a tax retry, the
  // builder never) and hands a new list; adopt it. Reset during render, the
  // way React documents for state derived from a changed prop, rather than
  // in an effect that would render the stale list once first.
  const [adopted, setAdopted] = useState(quote?.appointments);
  if (quote?.appointments !== adopted) {
    setAdopted(quote?.appointments);
    setVisits(quote?.appointments || []);
  }

  // Re-read the quote rather than patch local state: the row that came back
  // from POST is the row, but a reschedule or cancellation through
  // EntryActions answers with the calendar's shape, and one reader for both
  // is what keeps this list from disagreeing with the calendar.
  async function reload() {
    try {
      const fresh = await fetchJson(`/api/quotes/${quoteId}`);
      setVisits(fresh?.appointments || []);
    } catch (err) {
      // The change already happened server-side; the next page load shows it.
      console.error("[siteVisit] reload failed:", err?.message);
    }
  }

  // Rendered away, not disabled, below appointment:create — every role holds
  // it today, but the route asks, so this asks the same question.
  const canSchedule = !caller?.role || can(caller.role, "appointment:create");
  if (!quoteId || !quote) return null;

  const job = quote.jobs?.[0] || null;

  return (
    <section className="bg-card border border-border rounded-xl p-5 space-y-4" data-site-visit-panel>
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h2 className="font-semibold text-foreground">
            {t("app.siteVisit.title", "On-site visit")}
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            {t(
              "app.siteVisit.intro",
              "Send an estimator to measure up before the price is final. The client gets the same confirmation a booked visit sends, in the quote's language.",
            )}
          </p>
        </div>
        {canSchedule && (
          <button
            type="button"
            onClick={() => {
              setNotice(null);
              setOpen(true);
            }}
            className="inline-flex items-center gap-1.5 border border-border text-foreground text-sm font-semibold px-4 py-2 rounded-full shrink-0"
          >
            <Plus size={14} />
            {visits.length
              ? t("app.siteVisit.scheduleAnother", "Schedule another visit")
              : t("app.siteVisit.schedule", "Schedule an on-site visit")}
          </button>
        )}
      </div>

      {notice && (
        <div
          className={`rounded-lg px-4 py-3 text-sm border ${
            notice.sent
              ? "bg-green-50 dark:bg-green-950/40 border-green-200 dark:border-green-900 text-green-800 dark:text-green-300"
              : "bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-900 text-amber-900 dark:text-amber-200"
          }`}
        >
          {noticeSentence(notice, t)}
        </div>
      )}

      {visits.length ? (
        <SiteVisitRows visits={visits} client={quote.client || null} onChanged={reload} />
      ) : (
        <p className="text-sm text-muted-foreground">
          {t("app.siteVisit.none", "No visit scheduled yet.")}
        </p>
      )}

      {job && visits.length > 0 && (
        <p className="text-xs text-muted-foreground">
          {t("app.siteVisit.inJobHistory", "Also on the history of job")}{" "}
          <Link href={`/app/jobs/${job.id}`} className="underline underline-offset-2">
            {job.title}
          </Link>
        </p>
      )}

      {open && (
        <ScheduleModal
          quoteId={quoteId}
          quote={quote}
          onClose={() => setOpen(false)}
          onCreated={(created) => {
            setOpen(false);
            setNotice(created.notice || { sent: false });
            reload();
          }}
        />
      )}
    </section>
  );
}

/**
 * What happened to the confirmation, in one sentence the office can act on.
 *
 * `to` is null both when the client has no address and when this member may
 * not read it (the route redacts it on the same rule as the client row), so
 * "sent" is decided first: a letter that went out is reported as sent
 * whether or not the address may be shown. Only an unsent letter with no
 * address is "nothing was sent" — and that is the case the office has to
 * act on by phone.
 */
function noticeSentence(notice, t) {
  const language = languageName(notice.language);
  const demoTail = notice.simulated ? ` ${t("app.demo.notEmailed")}` : "";
  if (notice.sent && notice.to) {
    return t("app.siteVisit.sentTo", { email: notice.to, language }) + demoTail;
  }
  if (notice.sent) return t("app.siteVisit.sent", { language }) + demoTail;
  if (!notice.to) return t("app.siteVisit.notSentNoEmail");
  return t("app.siteVisit.notSentFailed");
}

function ScheduleModal({ quoteId, quote, onClose, onCreated }) {
  const { t } = useTranslation();
  const caller = usePermissions();
  const { data: session } = useSession();
  const myUserId = session?.user?.id || null;
  // The same rule the calendar's assignee select follows: without
  // appointment:assign the only assignee the route accepts is yourself.
  const canAssign = !caller?.role || can(caller.role, "appointment:assign");

  const [members, setMembers] = useState([]);
  const [scheduledAt, setScheduledAt] = useState("");
  const [assignedToId, setAssignedToId] = useState("");
  const [location, setLocation] = useState(() => formatAddress(quote?.client) || "");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    fetchJson("/api/settings/members")
      .then((data) => {
        if (!cancelled) setMembers(Array.isArray(data) ? data : []);
      })
      .catch(() => {
        // The visit can be scheduled unassigned; a roster that failed to
        // load must not block the form. The select simply offers nobody.
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const assignable = canAssign
    ? members
    : members.filter((m) => (m.user?.id || m.userId) === myUserId);

  const clientEmail = quote?.client?.email || null;
  const restricted = Boolean(quote?.client?.restricted);

  async function submit(e) {
    e.preventDefault();
    setError("");
    if (!scheduledAt) {
      setError(t("app.visitNew.pickDateTime"));
      return;
    }
    setSaving(true);
    try {
      const created = await fetchJson("/api/appointments", {
        method: "POST",
        body: {
          quoteId,
          scheduledAt: new Date(scheduledAt).toISOString(),
          assignedToId: assignedToId || null,
          location: location.trim() || null,
          notes: notes.trim() || null,
        },
      });
      onCreated(created);
    } catch (err) {
      setError(
        err?.i18nKey ? t(err.i18nKey, err.message) : err?.message || t("app.siteVisit.scheduleError"),
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-end sm:items-center justify-center z-50 p-0 sm:p-4">
      <div className="bg-card rounded-t-2xl sm:rounded-xl w-full sm:max-w-md p-5 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-1">
          <h2 className="font-semibold">{t("app.siteVisit.schedule", "Schedule an on-site visit")}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label={t("app.action.close", "Close")}
            className="inline-flex items-center justify-center min-h-[44px] min-w-[44px] -mr-2 text-muted-foreground"
          >
            <X size={18} />
          </button>
        </div>
        <p className="text-sm text-muted-foreground mb-4">
          {quote?.client?.name}
          {quote?.quoteNumber ? ` · ${quote.quoteNumber}` : ""}
        </p>

        {error && (
          <div className="bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 rounded-lg px-4 py-3 text-sm text-red-700 dark:text-red-300 mb-3">
            {error}
          </div>
        )}

        <form onSubmit={submit} className="space-y-3">
          <div>
            <label className="block text-sm font-medium text-foreground mb-1">
              {t("app.visitNew.when", "When")}
            </label>
            <input
              type="datetime-local"
              value={scheduledAt}
              onChange={(e) => setScheduledAt(e.target.value)}
              className={inputClass}
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground mb-1">
              {t("app.siteVisit.who", "Estimator")}
            </label>
            <select
              value={assignedToId}
              onChange={(e) => setAssignedToId(e.target.value)}
              className={inputClass}
            >
              <option value="">{t("app.visitNew.unassigned", "Not assigned yet")}</option>
              {assignable.map((m) => (
                <option key={m.id || m.userId} value={m.user?.id || m.userId}>
                  {personOptionLabel(m, m.user?.name || m.user?.email)}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground mb-1">
              {t("app.siteVisit.where", "Where")}
            </label>
            <input
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              className={inputClass}
              placeholder={t("app.appts.siteAddress", "Site address")}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-foreground mb-1">
              {t("app.siteVisit.notes", "Notes for the estimator")}
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              className={inputClass}
            />
          </div>

          {/* Said before the button, not after: whether a letter will go out
              is part of deciding to press it. Three cases, three sentences —
              an address, a restricted address, and none on file. */}
          <p className="text-xs text-muted-foreground">
            {clientEmail
              ? t("app.siteVisit.emailNote", { email: clientEmail })
              : restricted
                ? t("app.siteVisit.emailNoteRestricted")
                : t("app.siteVisit.emailNoteNone")}
          </p>

          <button
            type="submit"
            disabled={saving}
            className="inline-flex items-center justify-center gap-2 bg-inverted text-inverted-foreground text-sm font-semibold px-5 py-2.5 rounded-lg disabled:opacity-60 w-full mt-1"
          >
            {saving && <Loader2 size={14} className="animate-spin" />}
            {saving
              ? t("app.siteVisit.scheduling", "Scheduling…")
              : t("app.visitNew.submit", "Schedule visit")}
          </button>
        </form>
      </div>
    </div>
  );
}
