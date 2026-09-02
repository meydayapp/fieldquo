// app/app/jobs/[id]/JobDetail.js
//
// Job detail: the page a crew opens on site. Structured around what someone
// standing in a driveway needs — who, where, when, what's left — rather than
// around the shape of the database record.
//
// Visits are still most of the substance here — assignment, checklists and
// photos live on JobVisit, not on the job itself, so the visit list stays the
// main body rather than a footnote. The one thing the job now owns directly is
// its own start/end (below the "needs a date" banner): a two-week repaint has
// no single site trip to hang a date off, and forcing one into a visit was
// the gap this page used to have.
"use client";

import { useCallback, useEffect, useState } from "react";
import { JOB_STATUSES, jobStatusLabel } from "@/lib/jobs/statusLabels";
import JobCosting from "@/app/components/jobs/JobCosting";
import JobMaterials from "@/app/components/jobs/JobMaterials";
import JobTasks from "@/app/components/jobs/JobTasks";
import Link from "next/link";
import { useTranslation } from "@/app/hooks/useTranslation";
import JobPhotoCurator from "@/app/components/jobs/JobPhotoCurator";
import EquipmentUseLog from "@/app/components/jobs/EquipmentUseLog";
import JobPhotoTimeline from "@/app/components/jobs/JobPhotoTimeline";
import SuggestedTasks from "@/app/components/jobs/SuggestedTasks";
import VisitChecklist from "@/app/components/jobs/VisitChecklist";
import VisitStatus from "@/app/components/jobs/VisitStatus";
import { visitStatusLabel } from "@/lib/jobs/visitStatus";
import { isVisitOutsideJobRange } from "@/lib/jobs/visitInRange";
import { callbackReasonLabel } from "@/lib/jobs/callbackReasons";
import ChangeOrders from "@/app/components/jobs/ChangeOrders";
import {
  ArrowLeft,
  Pencil,
  AlertCircle,
  Calendar,
  User,
  MapPin,
  Phone,
  Plus,
  FileText,
  Trash2,
  Archive,
} from "lucide-react";
import { formatAddress } from "@/lib/format/address";
import { useRouter } from "next/navigation";
import { usePermissions } from "@/app/providers/PermissionProvider";
import { hasLevel } from "@/lib/permissions/enforce";
import DeleteConfirmModal from "@/app/components/admin/DeleteConfirmModal";
import PaymentScheduleCard from "./PaymentScheduleCard";

const STATUS_STYLES = {
  scheduled:
    "bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-900",
  in_progress:
    "bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-900",
  completed:
    "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-900",
  cancelled: "bg-muted text-muted-foreground border-border",
  // Visit-only, and it had no entry — so the moment a visit could actually be
  // put on the way, its badge would have fallen through to the same grey as a
  // cancelled one. Purple rather than amber: "in_progress" above is a JOB
  // status and the two sit inches apart on this page.
  on_the_way:
    "bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300 border-purple-200 dark:border-purple-900",
  // lib/schedule/jobVisits.js filters on both spellings because it could not
  // be sure which one the table holds. Style both for the same reason.
  canceled: "bg-muted text-muted-foreground border-border",
};

// `unscheduled` included — it's where every auto-created job from an accepted
// quote lands, so omitting it made the <select> show "scheduled" for a job the
// badge above correctly called "unscheduled", and interacting silently flipped it.
// Shared with the Jobs list — see lib/jobs/statusLabels.js for why.

function formatDateTime(value) {
  if (!value) return "Not scheduled";
  return new Date(value).toLocaleString("en-CA", {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

// startDate/endDate are calendar dates, not moments — no time-of-day to show,
// and UTC so the day printed is the day that was stored regardless of where
// the browser sits (same reasoning as documentFormatters' date()).
function formatDateOnly(value) {
  if (!value) return "";
  return new Date(value).toLocaleDateString("en-CA", {
    timeZone: "UTC",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export default function JobDetail({ jobId }) {
  const { t } = useTranslation();

  // Same question the route asks, asked of the same grid. usePermissions()
  // returns null while unresolved, and hasLevel(null) is false — so the button
  // arrives a beat late rather than flashing and vanishing.
  const router = useRouter();
  const caller = usePermissions();
  const canDeleteJob = hasLevel(caller, "jobs", "view_create_edit_delete");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Archiving is the answer for a job that CAN'T be deleted — one carrying
  // approved hours or tasks. Cancelling it would say something untrue about
  // work that actually happened; filing it away says only "I'm done looking
  // at this", and it is reversible.
  async function setArchived(archived) {
    setBusy(true);
    setError("");
    try {
      const res = await fetch(`/api/jobs/${jobId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ archived }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => null);
        throw new Error(
          d?.error || t("app.jobs.archiveFailed", "That didn't save."),
        );
      }
      const updated = await res.json();
      setJob((j) => ({ ...j, archivedAt: updated.archivedAt }));
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function deleteJob() {
    setDeleting(true);
    setError("");
    try {
      const res = await fetch(`/api/jobs/${jobId}`, { method: "DELETE" });
      if (!res.ok) {
        const d = await res.json().catch(() => null);
        // 409 is the server explaining that this job carries records of work.
        // Surfaced verbatim — it names what is attached and what to do
        // instead, which a generic "couldn't delete" would throw away.
        throw new Error(
          d?.error ||
            t("app.jobs.deleteFailed", "That job couldn't be deleted."),
        );
      }
      router.push("/app/jobs");
    } catch (err) {
      setError(err.message);
      setConfirmDelete(false);
    } finally {
      setDeleting(false);
    }
  }
  const [job, setJob] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/jobs/${jobId}`);
      if (!res.ok) {
        const d = await res.json().catch(() => null);
        throw new Error(
          d?.error ||
            (res.status === 404 ? "Job not found." : "Couldn't load."),
        );
      }
      setJob(await res.json());
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [jobId]);

  useEffect(() => {
    load();
  }, [load]);

  async function setStatus(status) {
    setBusy(true);
    setError("");
    try {
      const res = await fetch(`/api/jobs/${jobId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => null);
        // Surfaces the granular permission message rather than a generic
        // failure — "your access level doesn't allow you to edit jobs" tells
        // someone what to ask their manager for.
        throw new Error(d?.error || "Couldn't update status.");
      }
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return (
      <div className="p-4 sm:p-6 max-w-4xl mx-auto space-y-4 animate-pulse">
        <div className="h-8 bg-accent rounded w-1/3" />
        <div className="h-40 bg-accent rounded-xl" />
      </div>
    );
  }

  if (!job) {
    return (
      <div className="p-4 sm:p-6 max-w-lg mx-auto">
        <div className="bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 rounded-xl p-5">
          <div className="flex items-center gap-2 text-red-700 dark:text-red-300 font-semibold">
            <AlertCircle size={18} /> {error || "Job not found."}
          </div>
          <Link
            href="/app/jobs"
            className="mt-3 inline-block text-sm text-red-700 dark:text-red-300 underline"
          >
            {t("app.job.backToJobs")}
          </Link>
        </div>
      </div>
    );
  }

  const completedVisits = job.visits?.filter(
    (v) => v.status === "completed",
  ).length;

  return (
    <div className="p-4 sm:p-6 max-w-4xl mx-auto space-y-6">
      <Link
        href="/app/jobs"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft size={14} />
        {t("app.jobs.title")}
      </Link>

      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="min-w-0">
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-2xl font-bold text-foreground">{job.title}</h1>
            <span
              className={`text-xs px-2.5 py-1 rounded-full border ${
                STATUS_STYLES[job.status] ||
                "bg-muted text-muted-foreground border-border"
              }`}
            >
              {jobStatusLabel(job.status, t)}
            </span>
            {/* Status and archived are different facts, so they get different
                badges. A job can be Completed AND filed away, or Cancelled and
                still sitting in the list. */}
            {job.archivedAt && (
              <span className="text-xs px-2.5 py-1 rounded-full border border-border bg-muted text-muted-foreground">
                {t("app.jobs.archived", "Archived")}
              </span>
            )}
          </div>
          {job.quote && (
            <p className="text-sm text-muted-foreground mt-1">
              From quote{" "}
              <Link
                href={`/app/quotes/${job.quote.id}`}
                className="underline hover:text-foreground"
              >
                {job.quote.quoteNumber}
              </Link>
            </p>
          )}
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <select
            data-tour="job-status"
            value={job.status}
            disabled={busy}
            onChange={(e) => setStatus(e.target.value)}
            className="border border-border rounded-lg px-3 py-2 text-sm bg-card disabled:opacity-60"
          >
            {JOB_STATUSES.map((s) => (
              <option key={s} value={s}>
                {jobStatusLabel(s, t)}
              </option>
            ))}
          </select>
          <Link
            href={`/app/jobs/${jobId}/edit`}
            className="inline-flex items-center gap-1.5 border border-border text-foreground px-3 py-2 rounded-lg text-sm font-semibold"
          >
            <Pencil size={13} />
            {t("app.action.edit")}
          </Link>

          {/* ── Delete ──────────────────────────────────────────────────────
              DELETE /api/jobs/[id] has existed all along with nothing calling
              it, so a job could never be removed from the UI at all.

              Gated on the SAME grid level the route enforces, not on a role.
              An owner who doesn't want Managers deleting jobs sets their Jobs
              permission to "view, create, edit" instead of "…and delete" —
              which is now editable per person under Manage Team → Edit access.
              Hardcoding a role here would contradict the grid.

              The server still refuses a job carrying time entries or tasks;
              this button can't know that in advance, so the refusal arrives as
              a sentence rather than being pre-empted with a guess. */}
          {/* Archive / Restore. Offered to anyone who can edit the job, because
              filing something away destroys nothing and is undone by pressing
              the same button again. */}
          <button
            type="button"
            onClick={() => setArchived(!job.archivedAt)}
            disabled={busy}
            className="inline-flex items-center gap-1.5 border border-border text-foreground px-3 py-2 rounded-lg text-sm font-semibold disabled:opacity-60"
          >
            <Archive size={13} />
            {job.archivedAt
              ? t("app.jobs.restore", "Restore")
              : t("app.jobs.archive", "Archive")}
          </button>

          {canDeleteJob && (
            <button
              type="button"
              onClick={() => setConfirmDelete(true)}
              disabled={busy}
              className="inline-flex items-center gap-1.5 border border-border text-muted-foreground hover:text-destructive px-3 py-2 rounded-lg text-sm font-semibold disabled:opacity-60"
            >
              <Trash2 size={13} />
              {t("app.action.delete", "Delete")}
            </button>
          )}
        </div>
      </div>

      <DeleteConfirmModal
        isOpen={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        onConfirm={deleteJob}
        title={t("app.jobs.deleteTitle", "Delete this job?")}
        message={t(
          "app.jobs.deleteBody",
          "The job and its visits are removed for good. The quote and any invoice stay where they are. If work has already been logged against it, cancel it instead.",
        )}
        itemName={job.title}
        busy={deleting}
      />

      {error && (
        <div className="bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 rounded-lg px-4 py-3 text-sm text-red-700 dark:text-red-300">
          {error}
        </div>
      )}

      {/* Needs a date — the clear call to action the badge only hinted at. A job
          fresh off an accepted quote lands here unscheduled. Two honest ways
          out, not one: a visit is a TRIP to the address (an assessment, a
          repair call), and plenty of jobs — a two-week repaint with no site
          visit of its own — need only the work's own start/end instead. Either
          flips the job to "scheduled" automatically (POST .../visits and PATCH
          .../[id] both do it, from `unscheduled` only), so this banner is never
          steering someone toward a visit that isn't the right recommendation. */}
      {job.status === "unscheduled" && (
        <div className="bg-purple-50 dark:bg-purple-950/30 border border-purple-200 dark:border-purple-900 rounded-xl px-4 py-3 flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2 text-sm text-purple-800 dark:text-purple-200">
            <Calendar size={16} className="shrink-0" />
            {t(
              "app.job.needsDateBanner",
              "This job needs a date — schedule a visit, or set the work's own start and end dates.",
            )}
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Link
              href={`/app/jobs/${jobId}/edit`}
              className="inline-flex items-center gap-1.5 border border-purple-300 dark:border-purple-800 text-purple-800 dark:text-purple-200 px-3 py-1.5 rounded-lg text-sm font-semibold"
            >
              {t("app.job.setDates", "Set dates")}
            </Link>
            <Link
              href={`/app/jobs/${jobId}/visits/new`}
              className="inline-flex items-center gap-1.5 bg-purple-600 text-white px-3 py-1.5 rounded-lg text-sm font-semibold"
            >
              <Plus size={14} /> {t("app.job.scheduleVisit", "Schedule a visit")}
            </Link>
          </div>
        </div>
      )}

      {/* The work's own dates, when set — independent of any visit. Shown
          whether or not the banner above is visible, so a job that already
          has dates but is picking up a follow-up visit still shows them. */}
      {job.startDate && (
        <div className="bg-card border border-border rounded-xl px-4 py-3 flex items-center gap-2 text-sm text-foreground">
          <Calendar size={16} className="shrink-0 text-muted-foreground" />
          <span>
            {t("app.job.workDates", "Work scheduled")}:{" "}
            <span className="font-medium">{formatDateOnly(job.startDate)}</span>
            {job.endDate && (
              <>
                {" – "}
                <span className="font-medium">{formatDateOnly(job.endDate)}</span>
              </>
            )}
            {!job.endDate && (
              <span className="text-muted-foreground">
                {" "}
                ({t("app.job.noEndDateYet", "no end date yet")})
              </span>
            )}
          </span>
        </div>
      )}

      {/* Callback banners — both directions. A job pointing BACK at an
          original (this job IS the callback), and a job that has already had
          returns booked against it (this job HAS callbacks). Both are just
          links; the KPI dashboard is where the rate lives. */}
      {job.originalJob && (
        <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900 rounded-xl px-4 py-3 text-sm text-amber-800 dark:text-amber-200">
          {t("app.job.isCallbackFor", "This job is a callback")}
          {job.callbackReason && ` (${callbackReasonLabel(job.callbackReason, t)})`}
          {" — "}
          <Link href={`/app/jobs/${job.originalJob.id}`} className="underline">
            {job.originalJob.title}
          </Link>
        </div>
      )}
      {job.callbackJobs?.length > 0 && (
        <div className="bg-card border border-border rounded-xl px-4 py-3 text-sm">
          <p className="font-medium text-foreground mb-1.5">
            {t("app.job.hasCallbacks", "Callback jobs for this one")}
          </p>
          <ul className="space-y-1">
            {job.callbackJobs.map((cb) => (
              <li key={cb.id}>
                <Link href={`/app/jobs/${cb.id}`} className="underline text-foreground">
                  {cb.title}
                </Link>
                {cb.callbackReason && (
                  <span className="text-muted-foreground"> — {callbackReasonLabel(cb.callbackReason, t)}</span>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Empty for every job whose company has no structured payment
          schedule — see lib/paymentSchedule/run.js. */}
      {/* changeOrders so the card can say that its frozen stage amounts don't
          cover agreed changes — see the card's own header for why the stages
          are deliberately NOT recomputed. */}
      <PaymentScheduleCard stages={job.paymentStages} changeOrders={job.changeOrders} />

      {/* Client — the details someone needs before they set off */}
      <div
        data-tour="job-client"
        className="bg-card border border-border rounded-xl p-5"
      >
        <h2 className="font-semibold text-foreground mb-4">
          {t("app.job.client")}
        </h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field icon={User} label="Name" value={job.client?.name} />
          <Field
            icon={Phone}
            label="Phone"
            value={
              job.client?.phone ? (
                <a
                  href={`tel:${job.client.phone}`}
                  className="text-foreground underline"
                >
                  {job.client.phone}
                </a>
              ) : (
                <Absent client={job.client} t={t} />
              )
            }
          />
          <Field
            icon={MapPin}
            label="Address"
            value={
              job.client?.address ? (
                // Opens the device's default maps app — the single most-used
                // action on this page for anyone in a vehicle.
                <a
                  href={`https://maps.google.com/?q=${encodeURIComponent(
                    formatAddress(job.client),
                  )}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-foreground underline"
                >
                  {/* Was address + city, which duplicated the city and also
                      disagreed with the maps link above it. One formatter now,
                      so the text and the destination match. */}
                  {formatAddress(job.client)}
                </a>
              ) : (
                // The address is NOT one of the restricted fields — a member on
                // name_address_only gets it in full — so a blank one here is a
                // genuine blank, and Absent says so.
                <Absent client={job.client} t={t} />
              )
            }
          />
          <Field
            icon={FileText}
            label="Email"
            value={job.client?.email || <Absent client={job.client} t={t} />}
          />
        </div>
      </div>

      {/* Visits */}
      {/* What the job has actually cost. Renders itself away when nothing has
          been recorded and for anyone without the jobCosting toggle. */}
      <JobCosting jobId={job.id} />

      {/* Scope changes agreed after the quote was accepted — see the
          ChangeOrder model's own header for why this is a deliberate log,
          never inferred from a quote or invoice edit. */}
      <ChangeOrders jobId={job.id} changeOrders={job.changeOrders} onChanged={load} />

      {/* What has to be bought before the crew leaves the yard. Sits under the
          costing because it is the same bill of materials — one derived from
          the quote's takeoff — seen from the other end: the cost panel asks
          whether the price covers it, this asks whether it has been bought. */}
      <JobMaterials jobId={job.id} />

      {/* Which of the company's own equipment came along. Sits next to the
          buy list for the same reason: it's the other thing a crew brings to
          a job besides materials, and it's just as cheap to tick off. See
          the component's own header for why no dollar figure shows here. */}
      <EquipmentUseLog jobId={job.id} />

      {/* And what has to be DONE on it. Sits beside the buy list because the
          owner named them in one breath — "materials to buy, tasks from the
          notes" — and because they answer the two halves of the same question
          somebody asks in the van. */}
      <JobTasks jobId={job.id} />

      <div
        data-tour="job-visits"
        className="bg-card border border-border rounded-xl p-5"
      >
        <div className="flex items-center justify-between gap-3 mb-4 flex-wrap">
          <div>
            <h2 className="font-semibold text-foreground">
              {t("app.job.visits")}
            </h2>
            {job.visits?.length > 0 && (
              <p className="text-xs text-muted-foreground mt-0.5">
                {completedVisits} of {job.visits.length} complete
              </p>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Link
              href={`/app/jobs/new?originalJobId=${jobId}&clientId=${job.clientId}`}
              className="inline-flex items-center gap-1.5 border border-border text-sm font-semibold px-3 py-1.5 rounded-lg hover:bg-muted"
            >
              {t("app.job.logCallbackJob", "Log a callback job")}
            </Link>
            <Link
              href={`/app/jobs/${jobId}/visits/new`}
              className="inline-flex items-center gap-1.5 border border-border text-sm font-semibold px-3 py-1.5 rounded-lg hover:bg-muted"
            >
              <Plus size={13} />
              {t("app.job.addVisit")}
            </Link>
          </div>
        </div>

        {!job.visits?.length ? (
          <p className="text-sm text-muted-foreground">
            {t("app.job.noVisits")}
          </p>
        ) : (
          <div className="divide-y divide-border">
            {job.visits.map((v) => {
              const items = Array.isArray(v.checklistItems)
                ? v.checklistItems
                : [];
              const done = items.filter((i) => i?.done).length;
              // A nudge, not a rule — see lib/jobs/visitInRange.js for why a
              // visit before startDate or after endDate is often intentional
              // (a pre-job look, a warranty callback) and never blocked.
              const outsideRange = isVisitOutsideJobRange(v, job);

              return (
                <div key={v.id} className="py-4 first:pt-0 last:pb-0">
                  <div className="flex items-start justify-between gap-3 flex-wrap">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 text-sm">
                        <Calendar size={14} className="text-muted-foreground" />
                        <span className="font-medium text-foreground">
                          {formatDateTime(v.scheduledAt)}
                        </span>
                        <span
                          className={`text-xs px-2 py-0.5 rounded-full border ${
                            STATUS_STYLES[v.status] ||
                            "bg-muted text-muted-foreground border-border"
                          }`}
                        >
                          {visitStatusLabel(v.status)}
                        </span>
                        {outsideRange && (
                          <span className="text-xs px-2 py-0.5 rounded-full border border-amber-200 dark:border-amber-900 bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300">
                            {t("app.job.visitOutsideRange", "Outside job dates")}
                          </span>
                        )}
                        {v.returnReason && (
                          <span className="text-xs px-2 py-0.5 rounded-full border border-amber-200 dark:border-amber-900 bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300">
                            {callbackReasonLabel(v.returnReason, t)}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        {v.assignedTo?.name
                          ? `Assigned to ${v.assignedTo.name}`
                          : "Unassigned"}
                        {items.length > 0 &&
                          ` · ${done}/${items.length} checklist items`}
                        {v.photos?.length > 0 &&
                          ` · ${v.photos.length} photo${v.photos.length === 1 ? "" : "s"}`}
                      </p>
                      {v.notes && (
                        <p className="text-sm text-muted-foreground mt-2 whitespace-pre-wrap">
                          {v.notes}
                        </p>
                      )}
                      {v.returnNotes && (
                        <p className="text-sm text-amber-700 dark:text-amber-300 mt-2 whitespace-pre-wrap">
                          {v.returnNotes}
                        </p>
                      )}
                    </div>
                  </div>

                  <VisitStatus
                    jobId={jobId}
                    visit={v}
                    client={job.client}
                    onChanged={load}
                  />

                  <VisitChecklist jobId={jobId} visit={v} onChanged={load} />
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Turn what a human wrote about this job into office to-dos */}
      <SuggestedTasks jobId={jobId} onCreated={load} />

      {/* The job's own photo record — every photo filed, dated, grouped by
          stage, issue shots included. This is the evidence; the panel below
          is the marketing curation of a subset of it. */}
      <JobPhotoTimeline jobId={jobId} jobTitle={job.title} />

      {/* Curate the crew's photos → website gallery */}
      <JobPhotoCurator jobId={jobId} />
    </div>
  );
}

/**
 * Why a client field is empty — and the two answers are not the same answer.
 *
 * This page printed "Not set" over a phone number and an email address the
 * client definitely has. The API had removed both because the member is on
 * clientsProperties "name_address_only", and marked the record
 * `restricted: true` for exactly this reason (lib/permissions/enforce.js) —
 * which nothing read.
 *
 * The cost of getting it wrong is not cosmetic. "Not set" is an instruction: it
 * tells a crew member the office never captured a contact, and the reasonable
 * next step is to ring the client, ask for their email, and type it in. That is
 * a person collecting data that already exists, over a boundary their owner
 * deliberately drew. AGENTS.md names this one: absence of a statement is not a
 * statement.
 */
function Absent({ client, t }) {
  if (client?.restricted) {
    return (
      <span className="text-muted-foreground italic">
        {t("app.access.restricted", "Hidden by your access level")}
      </span>
    );
  }
  return (
    <span className="text-muted-foreground">
      {t("app.job.notSet", "Not set")}
    </span>
  );
}

function Field({ icon: Icon, label, value }) {
  return (
    <div>
      <dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-1.5">
        {Icon && <Icon size={12} />}
        {label}
      </dt>
      <dd className="mt-1 text-sm text-foreground">{value || "—"}</dd>
    </div>
  );
}
