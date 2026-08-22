"use client";

// app/components/jobs/JobCosting.js
//
// What this job actually cost, on the job.
//
// The quote screen has a good Cost & margin block — materials, labour hours,
// overhead, target margin. Then the job happens, expenses get tagged to it,
// crews log hours against it, and none of it appeared anywhere on the job. A
// contractor could see what they THOUGHT a job would cost and never what it
// did, which is the half of the question worth asking.
//
// Renders nothing at all when there is nothing recorded. An empty cost panel
// on every fresh job is noise, and "£0 spent" on a job nobody has worked yet
// is a statement we have no business making.

import { useEffect, useState } from "react";
import { Receipt, Clock, AlertTriangle } from "lucide-react";
import { useTranslation } from "@/app/hooks/useTranslation";

export default function JobCosting({ jobId }) {
  const { t } = useTranslation();
  const [data, setData] = useState(null);

  useEffect(() => {
    if (!jobId) return;
    let live = true;
    fetch(`/api/jobs/${jobId}/costing`)
      // 403 is the normal answer for someone without the jobCosting toggle,
      // not an error worth showing. The panel simply isn't theirs.
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => live && setData(d))
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [jobId]);

  if (!data?.actual) return null;

  const { actual, comparison } = data;

  // ── Why this no longer hides itself when nothing is recorded ────────────
  //
  // It used to return null on a job with no costs yet, which meant "Quoted /
  // Left after costs / Margin" was missing at exactly the moment a manager is
  // deciding how to run the job — the panel appeared only once it had nothing
  // left to inform.
  //
  // It still hides when there is nothing at all to say: no costs AND no quote
  // behind the job. Zeroes against a known quote are a real statement ("you've
  // spent nothing, the whole $2,100 is still yours"); zeroes against nothing
  // are noise.
  const nothingRecorded =
    !actual.expenses.total &&
    !actual.labour.approvedHours &&
    !actual.labour.pendingHours;
  if (nothingRecorded && comparison.revenue == null) return null;

  // Currency comes from the endpoint, which reads it off the company. Not a
  // prop with a CAD default — the job page doesn't load the company, so the
  // default would silently win for every non-Canadian contractor.
  const money = (n) => {
    const v = Number(n);
    return (Number.isFinite(v) ? v : 0).toLocaleString(undefined, {
      style: "currency",
      currency: data.currency || "CAD",
    });
  };

  return (
    <div className="bg-card border border-border rounded-xl p-5">
      <h2 className="font-semibold text-foreground mb-4">
        {t("app.jobCosting.title", "What this job has cost")}
      </h2>

      <div className="grid sm:grid-cols-3 gap-4">
        <Stat
          icon={<Receipt size={14} />}
          label={t("app.jobCosting.expenses", "Expenses")}
          value={money(actual.expenses.total)}
        />
        <Stat
          icon={<Clock size={14} />}
          label={t("app.jobCosting.labour", "Labour")}
          value={money(actual.labour.cost)}
          note={t("app.jobCosting.hoursApproved", "{hours}h approved", {
            hours: actual.labour.approvedHours,
          })}
        />
        <Stat
          label={t("app.jobCosting.totalCost", "Total cost")}
          value={money(actual.total)}
          strong
        />
      </div>

      {/* Profit against the price the client agreed. Deliberately NOT against
          an estimate: the quote's estimate isn't stored, and recomputing it
          today against a changed price book would produce a variance that
          moves when nobody touched the job. See the API route. */}
      {comparison.profit !== null && (
        <div className="mt-4 pt-4 border-t border-border grid sm:grid-cols-3 gap-4">
          <Stat
            label={t("app.jobCosting.quoted", "Quoted")}
            value={money(comparison.revenue)}
          />
          <Stat
            label={t("app.jobCosting.profit", "Left after costs")}
            value={money(comparison.profit)}
            tone={comparison.profit < 0 ? "bad" : "good"}
            strong
          />
          {comparison.marginPct !== null && (
            <Stat
              label={t("app.jobCosting.margin", "Margin")}
              value={`${comparison.marginPct}%`}
              tone={comparison.profit < 0 ? "bad" : undefined}
            />
          )}
        </div>
      )}

      {/* The total is knowably short. Saying so is the difference between a
          figure and a guess presented as one. */}
      {actual.incomplete && (
        <div className="mt-4 flex items-start gap-2 text-xs text-amber-700 dark:text-amber-400">
          <AlertTriangle size={13} className="shrink-0 mt-0.5" />
          <span>
            {actual.labour.pendingHours > 0 &&
              t(
                "app.jobCosting.pendingNote",
                "{hours}h are still waiting for approval and aren't counted yet.",
                { hours: actual.labour.pendingHours },
              )}{" "}
            {actual.labour.unratedHours > 0 &&
              t(
                "app.jobCosting.unratedNote",
                "{hours}h were worked by someone with no hourly rate on file, so they're costing nothing here.",
                { hours: actual.labour.unratedHours },
              )}
          </span>
        </div>
      )}

      {actual.expenses.byCategory.length > 1 && (
        <div className="mt-4 pt-4 border-t border-border">
          <p className="text-xs text-muted-foreground mb-2">
            {t("app.jobCosting.byCategory", "Spend by category")}
          </p>
          <div className="space-y-1">
            {actual.expenses.byCategory.map((c) => (
              <div key={c.category} className="flex justify-between text-sm">
                <span className="text-muted-foreground">{c.category}</span>
                <span className="tabular-nums">{money(c.amount)}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function Stat({ icon, label, value, note, strong, tone }) {
  return (
    <div>
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
        {icon}
        {label}
      </div>
      <div
        className={`mt-1 tabular-nums ${strong ? "text-xl font-bold" : "text-lg font-semibold"} ${
          tone === "bad"
            ? "text-red-600 dark:text-red-400"
            : tone === "good"
              ? "text-green-700 dark:text-green-400"
              : "text-foreground"
        }`}
      >
        {value}
      </div>
      {note && <div className="text-xs text-muted-foreground mt-0.5">{note}</div>}
    </div>
  );
}
