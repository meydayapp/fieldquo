// app/app/invoices/[id]/JobPanel.js
//
// The invoice's end of the project: the job it bills for, the visits on it, and
// whether the crew's hours have been through payroll.
//
// ── Why this belongs on the invoice and not only on the job ────────────────
//
// The owner's ask, in his words: "setting a time / assigning the job to someone
// if not already done. All of that should be on the admin side of the invoice
// so it gets linked with the rest — job, payroll, etc — throughout the life
// cycle of the project."
//
// The invoice is where somebody looks when they are about to bill, or about to
// chase. Both are exactly the moment you need to know whether the work was
// actually scheduled, who did it, and whether their hours have been paid. Those
// facts lived three screens away and the invoice knew nothing about them.
//
// ── Nothing here is a second copy ──────────────────────────────────────────
//
// Creating the job goes through POST /api/invoices/[id]/lifecycle, which calls
// the same lib/jobs/createJob.js that POST /api/jobs does — so the cross-tenant
// quote check and the imported-cost materialisation happen either way.
// Scheduling a visit posts to the existing POST /api/jobs/[id]/visits, which is
// what flips an unscheduled job to scheduled and closes the "schedule the job"
// task. This screen adds no rules of its own to either.
//
// The one thing it deliberately does NOT reproduce is the visit checklist
// picker. That is a real form with real depth on /app/jobs/[id]/visits/new, and
// a cut-down copy of it here would be a worse version of a page that already
// works — so the panel offers the two fields that answer "when, and who", and
// links to the full form for everything else.
"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  Briefcase,
  CalendarPlus,
  Loader2,
  Plus,
  Link2,
  Unlink,
  Clock,
  UserRound,
} from "lucide-react";
import { useTranslation } from "@/app/hooks/useTranslation";
import { useCompanyPreferences } from "@/app/providers/CompanyPreferencesProvider";
import { reportResponseError } from "@/lib/clientErrors";
// The one place a job status is given a name — the Jobs list and the job detail
// page read it from here too, which is why they no longer disagree.
import { jobStatusLabel } from "@/lib/jobs/statusLabels";

const inputClass =
  "w-full border border-border rounded-lg px-3 py-2 text-sm bg-card focus:outline-none focus:ring-2 focus:ring-ring/10";

export default function JobPanel({
  invoiceId,
  clientId,
  clientName,
  defaultJobTitle,
  job,
  payroll,
  onJobChange,
  focusRequest,
}) {
  const { t } = useTranslation();
  const { formatDate, formatDateTime } = useCompanyPreferences();

  const [error, setError] = useState("");
  const [busy, setBusy] = useState("");
  const [mode, setMode] = useState(""); // "" | "create" | "link" | "visit"
  const [title, setTitle] = useState(defaultJobTitle || "");

  // The client's other jobs, for linking an invoice to work that already
  // exists. Loaded only when the link form is opened — most invoices never need
  // it, and a list of every job in the company on every invoice load is a
  // request nobody asked for.
  const [jobs, setJobs] = useState(null);
  const [linkTarget, setLinkTarget] = useState("");

  // Who can be sent. Same endpoint the full visit form uses.
  const [members, setMembers] = useState([]);
  const [scheduledAt, setScheduledAt] = useState("");
  const [assignedToId, setAssignedToId] = useState("");

  // A banner asked for one of these forms. The prop is "<form>:<nonce>" — the
  // nonce is what makes pressing the same banner twice work. Passing the bare
  // form name would give the effect an unchanged value the second time and the
  // banner button would silently stop responding, which is the same class of
  // dead control as a button with no handler.
  useEffect(() => {
    if (!focusRequest) return;
    setMode(String(focusRequest).split(":")[0]);
  }, [focusRequest]);

  useEffect(() => {
    if (mode !== "visit" || members.length > 0) return;
    fetch("/api/settings/members")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => setMembers(Array.isArray(d) ? d : []))
      // Not fatal. A visit can be booked with nobody assigned, so a failure
      // here leaves the picker empty rather than blocking the date.
      .catch(() => {});
  }, [mode, members.length]);

  useEffect(() => {
    if (mode !== "link" || jobs !== null) return;
    fetch("/api/jobs")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) =>
        setJobs(
          Array.isArray(d) ? d.filter((j) => j.client?.id === clientId) : [],
        ),
      )
      .catch(() => setJobs([]));
  }, [mode, jobs, clientId]);

  const post = useCallback(
    async (body, action) => {
      setBusy(action);
      setError("");
      try {
        const res = await fetch(`/api/invoices/${invoiceId}/lifecycle`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        if (!res.ok) {
          await reportResponseError(res, setError, t("app.invoiceJob.linkError"));
          return null;
        }
        const data = await res.json();
        // Re-read the WHOLE lifecycle, not just the job: creating or linking a
        // job changes which banners apply (the "no job is linked" one goes
        // away, "no visit booked" may appear) and brings the cost panel its
        // first real figures. Splicing the job in alone would leave the page
        // still telling the user to do what they had just done.
        const refreshed = await fetch(`/api/invoices/${invoiceId}/lifecycle`)
          .then((r) => (r.ok ? r.json() : null))
          .catch(() => null);
        onJobChange?.(refreshed?.job ?? data.job ?? null, refreshed);
        setMode("");
        return data;
      } finally {
        setBusy("");
      }
    },
    [invoiceId, onJobChange, t],
  );

  async function scheduleVisit(e) {
    e.preventDefault();
    if (!job?.id) return;
    setBusy("visit");
    setError("");
    try {
      const res = await fetch(`/api/jobs/${job.id}/visits`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          scheduledAt,
          assignedToId: assignedToId || null,
        }),
      });
      if (!res.ok) {
        await reportResponseError(res, setError, t("app.invoiceJob.visitError"));
        return;
      }
      // Re-read the job rather than splicing the new visit in locally: posting
      // a visit can also flip the job's status from unscheduled to scheduled,
      // and a panel that showed the visit but not the status change would be
      // half right in a way nobody would notice.
      const refreshed = await fetch(`/api/invoices/${invoiceId}/lifecycle`)
        .then((r) => (r.ok ? r.json() : null))
        .catch(() => null);
      if (refreshed) onJobChange?.(refreshed.job || null, refreshed);
      setMode("");
      setScheduledAt("");
      setAssignedToId("");
    } finally {
      setBusy("");
    }
  }

  return (
    <section className="bg-card border border-border rounded-xl p-5">
      <div className="flex items-center justify-between gap-3 flex-wrap mb-3">
        <h2 className="font-semibold text-foreground flex items-center gap-2">
          <Briefcase size={16} className="text-muted-foreground" />
          {t("app.invoiceJob.title")}
        </h2>
        {job && (
          <Link
            href={`/app/jobs/${job.id}`}
            className="text-xs font-semibold underline"
          >
            {t("app.invoiceJob.openJob")}
          </Link>
        )}
      </div>

      {error && (
        <p className="mb-3 text-sm text-red-700 dark:text-red-300">{error}</p>
      )}

      {!job ? (
        <>
          {/* Stated, not implied. An empty panel would read as "loading", and
              an invented job title would put work on the board that nobody
              agreed to. */}
          <p className="text-sm text-muted-foreground">
            {t("app.invoiceJob.none")}
          </p>

          {mode === "create" ? (
            <form
              className="mt-3 space-y-2"
              onSubmit={(e) => {
                e.preventDefault();
                post({ action: "createJob", title }, "createJob");
              }}
            >
              <label className="block text-xs font-medium text-foreground">
                {t("app.invoiceJob.jobTitle")}
              </label>
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
                maxLength={200}
                placeholder={t("app.invoiceJob.jobTitlePlaceholder")}
                className={inputClass}
              />
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setMode("")}
                  className="px-3 py-1.5 rounded-full border border-border text-xs font-semibold"
                >
                  {t("app.action.cancel")}
                </button>
                <button
                  type="submit"
                  disabled={busy === "createJob"}
                  className="px-3 py-1.5 rounded-full bg-inverted text-inverted-foreground text-xs font-semibold disabled:opacity-60 inline-flex items-center gap-1.5"
                >
                  {busy === "createJob" && (
                    <Loader2 size={12} className="animate-spin" />
                  )}
                  {t("app.invoiceJob.createJob")}
                </button>
              </div>
            </form>
          ) : mode === "link" ? (
            <div className="mt-3 space-y-2">
              {jobs === null ? (
                <p className="text-sm text-muted-foreground">
                  {t("app.invoiceJob.loadingJobs")}
                </p>
              ) : jobs.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  {t("app.invoiceJob.noOtherJobs", { name: clientName || "" })}
                </p>
              ) : (
                <select
                  value={linkTarget}
                  onChange={(e) => setLinkTarget(e.target.value)}
                  className={inputClass}
                >
                  <option value="">{t("app.invoiceJob.chooseJob")}</option>
                  {jobs.map((j) => (
                    <option key={j.id} value={j.id}>
                      {j.title}
                    </option>
                  ))}
                </select>
              )}
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setMode("")}
                  className="px-3 py-1.5 rounded-full border border-border text-xs font-semibold"
                >
                  {t("app.action.cancel")}
                </button>
                <button
                  type="button"
                  disabled={!linkTarget || busy === "linkJob"}
                  onClick={() =>
                    post({ action: "linkJob", jobId: linkTarget }, "linkJob")
                  }
                  className="px-3 py-1.5 rounded-full bg-inverted text-inverted-foreground text-xs font-semibold disabled:opacity-60 inline-flex items-center gap-1.5"
                >
                  {busy === "linkJob" && (
                    <Loader2 size={12} className="animate-spin" />
                  )}
                  {t("app.invoiceJob.link")}
                </button>
              </div>
            </div>
          ) : (
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                onClick={() => setMode("create")}
                className="px-3 py-1.5 rounded-full bg-inverted text-inverted-foreground text-xs font-semibold inline-flex items-center gap-1.5"
              >
                <Plus size={12} /> {t("app.invoiceJob.createJob")}
              </button>
              <button
                onClick={() => setMode("link")}
                className="px-3 py-1.5 rounded-full border border-border text-xs font-semibold inline-flex items-center gap-1.5"
              >
                <Link2 size={12} /> {t("app.invoiceJob.linkExisting")}
              </button>
            </div>
          )}
        </>
      ) : (
        <>
          <div className="flex items-baseline justify-between gap-3 flex-wrap">
            <p className="text-sm font-medium text-foreground">{job.title}</p>
            <span className="text-xs text-muted-foreground">
              {jobStatusLabel(job.status, t)}
            </span>
          </div>
          {/* Which rule found this job. "Through the quote" is a real and
              common answer, and letting it read as an explicit link would make
              the Unlink button below look broken when it did nothing. */}
          <p className="mt-0.5 text-xs text-muted-foreground">
            {job.linkSource === "invoice"
              ? t("app.invoiceJob.linkedDirectly")
              : t("app.invoiceJob.linkedViaQuote")}
          </p>

          {/* The work's own dates, when the job has them — so somebody
              billing or chasing from this screen can see the job is already
              scheduled without the visit list making it look otherwise. Set
              from the job page itself; this panel doesn't duplicate that
              form, same rule as the visit picker below it. */}
          {job.startDate && (
            <p className="mt-1 text-xs text-muted-foreground">
              {t("app.job.workDates", "Work scheduled")}:{" "}
              <span className="font-medium text-foreground">
                {formatDate(job.startDate)}
              </span>
              {job.endDate && (
                <>
                  {" – "}
                  <span className="font-medium text-foreground">
                    {formatDate(job.endDate)}
                  </span>
                </>
              )}
            </p>
          )}

          <div className="mt-3">
            <p className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground mb-1">
              {t("app.invoiceJob.visits")}
            </p>
            {job.visits?.length > 0 ? (
              <ul className="space-y-1">
                {job.visits.map((v) => (
                  <li
                    key={v.id}
                    className="flex justify-between gap-3 text-sm text-muted-foreground"
                  >
                    <span className="tabular-nums">
                      {formatDateTime(v.scheduledAt)}
                    </span>
                    <span className="flex items-center gap-1.5">
                      <UserRound size={12} />
                      {v.assignedTo?.name || t("app.invoiceJob.unassigned")}
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">
                {t("app.invoiceJob.noVisits")}
              </p>
            )}
          </div>

          {mode === "visit" ? (
            <form onSubmit={scheduleVisit} className="mt-3 space-y-2">
              <div className="grid gap-2 sm:grid-cols-2">
                <div>
                  <label className="block text-xs font-medium text-foreground mb-1">
                    {t("app.invoiceJob.when")}
                  </label>
                  <input
                    type="datetime-local"
                    required
                    value={scheduledAt}
                    onChange={(e) => setScheduledAt(e.target.value)}
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-foreground mb-1">
                    {t("app.invoiceJob.who")}
                  </label>
                  <select
                    value={assignedToId}
                    onChange={(e) => setAssignedToId(e.target.value)}
                    className={inputClass}
                  >
                    <option value="">{t("app.invoiceJob.unassigned")}</option>
                    {members.map((m) => (
                      <option key={m.id} value={m.user?.id || m.userId}>
                        {m.user?.name || m.user?.email}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => setMode("")}
                  className="px-3 py-1.5 rounded-full border border-border text-xs font-semibold"
                >
                  {t("app.action.cancel")}
                </button>
                <button
                  type="submit"
                  disabled={busy === "visit"}
                  className="px-3 py-1.5 rounded-full bg-inverted text-inverted-foreground text-xs font-semibold disabled:opacity-60 inline-flex items-center gap-1.5"
                >
                  {busy === "visit" && (
                    <Loader2 size={12} className="animate-spin" />
                  )}
                  {t("app.invoiceJob.bookVisit")}
                </button>
                {/* The full form, for a visit that needs a checklist or crew
                    notes. Not a duplicate of it — a door to it. */}
                <Link
                  href={`/app/jobs/${job.id}/visits/new`}
                  className="text-xs underline text-muted-foreground"
                >
                  {t("app.invoiceJob.moreOptions")}
                </Link>
              </div>
            </form>
          ) : (
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                onClick={() => setMode("visit")}
                className="px-3 py-1.5 rounded-full border border-border text-xs font-semibold inline-flex items-center gap-1.5"
              >
                <CalendarPlus size={12} /> {t("app.invoiceJob.bookVisit")}
              </button>
              {/* Only offered on an explicit link. Unlinking a job the QUOTE
                  owns would clear a column that was never set, and a button
                  that does nothing is the one rule this codebase is swept for. */}
              {job.linkSource === "invoice" && (
                <button
                  onClick={() => post({ action: "unlinkJob" }, "unlinkJob")}
                  disabled={busy === "unlinkJob"}
                  className="px-3 py-1.5 rounded-full border border-border text-xs font-semibold text-muted-foreground disabled:opacity-60 inline-flex items-center gap-1.5"
                >
                  {busy === "unlinkJob" ? (
                    <Loader2 size={12} className="animate-spin" />
                  ) : (
                    <Unlink size={12} />
                  )}
                  {t("app.invoiceJob.unlink")}
                </button>
              )}
            </div>
          )}

          {/* ── Payroll ────────────────────────────────────────────────────
              Null when the reader has no job-costing access, or when nobody
              has logged approved hours. Both mean "show nothing" — a panel of
              zeroes would say the crew worked for free. */}
          {payroll && payroll.crew?.length > 0 && (
            <div className="mt-4 pt-3 border-t border-border">
              <p className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground mb-1 flex items-center gap-1.5">
                <Clock size={12} />
                {t("app.invoiceJob.hoursOnThisJob")}
              </p>
              <ul className="space-y-0.5">
                {payroll.crew.map((m, i) => (
                  <li
                    key={m.workerId || i}
                    className="flex justify-between gap-3 text-sm text-muted-foreground"
                  >
                    <span>{m.name}</span>
                    <span className="tabular-nums">
                      {t("app.duration.hours", { value: m.hours })}
                      {/* Marked hidden rather than blank — a missing rate
                          reads as "nobody set one" and invites someone to go
                          and fill it in with a number they may not see. */}
                      {m.rateHidden
                        ? ` · ${t("app.invoiceJob.rateHidden")}`
                        : m.hourlyRate == null
                          ? ` · ${t("app.invoiceJob.noRate")}`
                          : ""}
                    </span>
                  </li>
                ))}
              </ul>

              {payroll.periods?.length > 0 && (
                <div className="mt-2">
                  <p className="text-xs text-muted-foreground">
                    {t("app.invoiceJob.payPeriods")}
                  </p>
                  <ul className="mt-0.5 space-y-0.5">
                    {payroll.periods.map((p) => (
                      <li
                        key={p.id}
                        className="flex justify-between gap-3 text-sm text-muted-foreground"
                      >
                        <span className="tabular-nums">
                          {formatDate(p.periodStart)} –{" "}
                          {formatDate(p.periodEnd)}
                        </span>
                        <span>
                          {t(`app.payRunStatus.${p.status}`, p.status)}
                        </span>
                      </li>
                    ))}
                  </ul>
                  {/* Deliberately not "this job cost $X in payroll". A pay run
                      covers a period across every job; apportioning its gross
                      would be a made-up number on a payroll screen. What IS
                      true is which periods these hours fall in. */}
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    {t("app.invoiceJob.payPeriodsNote")}
                  </p>
                </div>
              )}

              {payroll.hoursNotInAnyRun > 0 && (
                <p className="mt-2 text-sm text-amber-800 dark:text-amber-300">
                  {t("app.invoiceJob.hoursNotPaid", {
                    hours: t("app.duration.hours", {
                      value: payroll.hoursNotInAnyRun,
                    }),
                  })}
                </p>
              )}
            </div>
          )}
        </>
      )}
    </section>
  );
}
