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
import { Receipt, Clock, AlertTriangle, Building2, Unlink } from "lucide-react";
import { useTranslation } from "@/app/hooks/useTranslation";

/** A window's end, in the reader's own locale. Dates only — the hour a window
 *  opened is noise on a figure measured in days. */
function fmtDay(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? ""
    : d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

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
  // Null on an older cached response, and null from the route whenever there is
  // no honest window to measure — both mean "say nothing", which is why this is
  // read defensively rather than defaulted to a zero.
  const unattributed = data.unattributed || null;
  // Always an object from the route; defaulted here only so an older cached
  // response can't crash the panel mid-deploy.
  const contract = data.contract || {
    quotedTotal: comparison.revenue,
    quotedTotalKnown: comparison.revenue != null,
    approvedChanges: 0,
    currentContractValue: comparison.revenue,
  };
  const hasChanges = Number(contract.approvedChanges) !== 0;

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
    !actual.labour.pendingHours &&
    !actual.equipment?.total;
  // Approved changes on a job with no quote are a real statement too — "$500
  // of agreed extra work, and no quoted total to add it to" is exactly the
  // sentence a contractor needs — so their presence keeps the panel open even
  // when the contract value itself is unknown.
  // Untagged hours in this job's window keep it open too, and this is the case
  // the whole unattributed figure was written for: a job somebody worked all
  // week that shows nothing, because every punch came off a phone and landed on
  // no job at all. Hiding the panel there hides the one sentence that explains
  // why the job looks untouched.
  const hasUnattributed = Boolean(unattributed && unattributed.hours > 0);
  if (nothingRecorded && comparison.revenue == null && !hasChanges && !hasUnattributed)
    return null;

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

      <div
        className={`grid gap-4 ${actual.overhead ? "sm:grid-cols-4" : "sm:grid-cols-3"}`}
      >
        <Stat
          icon={<Receipt size={14} />}
          label={t("app.jobCosting.expenses", "Expenses")}
          value={money(actual.expenses.total)}
        />
        {/* "on this job" is not padding. This figure counts only hours somebody
            TAGGED to this job — the query behind it is `where: { jobId }` — so
            the sentence has to say so. A bare "{hours}h approved" reads as all
            the labour there was, which is exactly the impression the
            unattributed note further down exists to correct. */}
        <Stat
          icon={<Clock size={14} />}
          label={t("app.jobCosting.labour", "Labour")}
          value={money(actual.labour.cost)}
          note={t("app.jobCosting.hoursApproved", "{hours}h approved on this job", {
            hours: actual.labour.approvedHours,
          })}
        />
        {/* ── Only when the company's overhead is actually known ────────────
            `actual.overhead` is null when nobody has filled in the overhead
            screen, and null is not zero: rendering a $0 overhead row would be
            a statement we have no basis for, and it would make the total below
            look complete when it isn't. Absent, so absent from the screen. */}
        {actual.overhead && (
          <Stat
            icon={<Building2 size={14} />}
            label={t("app.jobCosting.overhead", "Overhead")}
            value={money(actual.overhead.amount)}
          />
        )}
        <Stat
          label={t("app.jobCosting.totalCost", "Total cost")}
          value={money(actual.total)}
          strong
        />
      </div>

      {/* Where that share came from, in the same words the quote screen uses
          for the same number — the two panels are costing one job and must not
          sound like they mean different things. */}
      {actual.overhead && (
        <p className="mt-2 text-xs text-muted-foreground">
          {t(
            "app.jobCosting.overheadNote",
            "Overhead is this job's share of what the business costs to run — your fixed costs spread across the jobs you take on.",
          )}
        </p>
      )}

      {/* ── Equipment logged against this job ────────────────────────────
          Null when nothing was logged — see EquipmentUseLog.js and the
          double-count note on lib/costing/actualJobCost.js. Two very
          different sentences depending on `includedInOverhead`:
          `true` means the overhead figure ABOVE already carries this —
          shown as information, never implied to be additional cost.
          `false` means it genuinely raised the total, because nothing else
          here was capturing depreciation at all. */}
      {actual.equipment && actual.equipment.total > 0 && (
        <div className="mt-4 pt-4 border-t border-border">
          <p className="text-xs text-muted-foreground">
            {actual.equipment.includedInOverhead
              ? t(
                  "app.jobCosting.equipmentInOverhead",
                  "Equipment logged on this job ({amount}) is already covered by the overhead share above — it isn't added again.",
                  { amount: money(actual.equipment.total) },
                )
              : t(
                  "app.jobCosting.equipmentAdded",
                  "Equipment logged on this job added {amount} to the total above — set up Settings → Overhead and this stops being counted twice.",
                  { amount: money(actual.equipment.total) },
                )}
          </p>
          {actual.equipment.byAsset.length > 0 && (
            <div className="mt-2 space-y-1">
              {actual.equipment.byAsset.map((a) => (
                <div key={a.assetId} className="flex justify-between text-xs">
                  <span className="text-muted-foreground">{a.name || "—"}</span>
                  <span className="tabular-nums text-muted-foreground">{money(a.cost)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Quoted + agreed changes = what the job is worth now ────────────
          Three figures, never one. A single blended "revenue" would hide the
          fact the job grew, which is the thing worth knowing when the margin
          moves. Rendered only when there ARE approved changes: a "+$0.00"
          row on every ordinary job is noise, and the single "Quoted" figure
          below is already the whole truth for those. */}
      {hasChanges && (
        <div className="mt-4 pt-4 border-t border-border grid sm:grid-cols-3 gap-4">
          <Stat
            label={t("app.jobCosting.quotedTotal", "Quoted")}
            value={
              contract.quotedTotalKnown
                ? money(contract.quotedTotal)
                : t("app.jobCosting.noQuote", "No quote")
            }
          />
          <Stat
            label={t("app.jobCosting.approvedChanges", "Approved changes")}
            value={`${Number(contract.approvedChanges) > 0 ? "+" : ""}${money(contract.approvedChanges)}`}
          />
          <Stat
            label={t("app.jobCosting.contractValue", "Contract value now")}
            value={
              contract.currentContractValue == null
                ? "—"
                : money(contract.currentContractValue)
            }
            strong
          />
        </div>
      )}

      {/* Absence of a quoted total is not a zero — see the API route. Said out
          loud, because a change order sitting next to a "—" contract value is
          otherwise just a gap on the screen. */}
      {hasChanges && !contract.quotedTotalKnown && (
        <p className="mt-2 text-xs text-muted-foreground">
          {t(
            "app.jobCosting.noQuoteNote",
            "This job has no quote behind it, so there's no contract value to add these changes to. The changes themselves are still owed.",
          )}
        </p>
      )}

      {/* Profit against the price the client agreed. Deliberately NOT against
          an estimate: the quote's estimate isn't stored, and recomputing it
          today against a changed price book would produce a variance that
          moves when nobody touched the job. See the API route. */}
      {comparison.profit !== null && (
        <div className="mt-4 pt-4 border-t border-border grid sm:grid-cols-3 gap-4">
          <Stat
            label={
              hasChanges
                ? t("app.jobCosting.contractValue", "Contract value now")
                : t("app.jobCosting.quoted", "Quoted")
            }
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

      {/* ── Hours that reached no job at all ──────────────────────────────
          NOT this job's hours, and the wording must never suggest otherwise.
          It is a company-wide count over the window this job ran in, and it is
          here because the labour figure above is a `where: { jobId }` query:
          every hour nobody tagged is missing from it, and from every other
          job's panel too. Until the self-serve clock could set a job, that was
          most of the hours a crew punched.

          Rendered as information, never added to a total. An invented
          attribution would be worse than a named gap — which is also why the
          rows that predate the fix were left alone rather than backfilled. */}
      {unattributed && unattributed.hours > 0 && (
        <div className="mt-4 pt-4 border-t border-border">
          <div className="flex items-start gap-2 text-xs text-muted-foreground">
            <Unlink size={13} className="shrink-0 mt-0.5" />
            <span>
              {t(
                "app.jobCosting.unattributedNote",
                "{hours}h of your team's time between {from} and {to} isn't linked to any job, so it isn't in this job's costs — or any other job's.",
                {
                  hours: unattributed.hours,
                  from: fmtDay(unattributed.from),
                  to: fmtDay(unattributed.to),
                },
              )}{" "}
              {t(
                "app.jobCosting.unattributedFix",
                "Tag those entries to a job on the timesheet and they'll land here.",
              )}
            </span>
          </div>
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
