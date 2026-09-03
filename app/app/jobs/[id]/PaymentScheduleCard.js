// app/app/jobs/[id]/PaymentScheduleCard.js
//
// This job's own frozen payment schedule — empty for every job whose company
// has no structured schedule (see lib/paymentSchedule/run.js), so most jobs
// render nothing here, unchanged from before this feature existed.
//
// Exists specifically for AGENTS.md's own rule: "if a stage cannot fire, the
// screen says so." A stage waiting on a date the job doesn't have yet is
// shown as waiting and WHY, not silently missing — the difference between an
// honest "not yet" and a schedule that quietly never bills anyone.
"use client";

import { Clock, Send, CircleSlash, AlertCircle } from "lucide-react";
import { useTranslation } from "@/app/hooks/useTranslation";
import { paymentScheduleShortfall } from "@/lib/jobs/changeOrderValue";
import { useCompanyMoney } from "@/app/providers/CompanyPreferencesProvider";

function formatDateOnly(value) {
  if (!value) return "";
  return new Date(value).toLocaleDateString("en-CA", {
    timeZone: "UTC",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

const BLOCKED_KEY = {
  awaiting_start_date: "app.job.paymentSchedule.blockedStartDate",
  awaiting_end_date: "app.job.paymentSchedule.blockedEndDate",
  invalid_date_range: "app.job.paymentSchedule.blockedInvalidRange",
};

const BLOCKED_FALLBACK = {
  awaiting_start_date: "Can't schedule yet — set a start date for this job",
  awaiting_end_date: "Can't schedule yet — set an end date for this job",
  invalid_date_range: "The end date is before the start date — fix the job's dates",
};

function StatusIcon({ stage }) {
  if (stage.status === "requested") return <Send size={15} className="text-emerald-600" />;
  if (stage.status === "waived") return <CircleSlash size={15} className="text-muted-foreground" />;
  if (stage.blockedReason) return <AlertCircle size={15} className="text-amber-600" />;
  return <Clock size={15} className="text-muted-foreground" />;
}

export default function PaymentScheduleCard({ stages, changeOrders }) {
  const money = useCompanyMoney();
  const { t } = useTranslation();
  // ── Why the stages are NOT recomputed when a change order is agreed ───────
  //
  // JobPaymentStage.amountCents is frozen at creation, and its comment gives
  // the reason: "the total it is a percentage OF cannot change
  // post-acceptance". A change order falsifies that premise — and recomputing
  // is still the wrong fix, for three reasons that all move real money:
  //
  //   * a `requested` stage has already emailed the client a pay link for a
  //     specific amount, and re-deriving it would make the email and the
  //     system disagree about what was asked for;
  //   * the percentages sum to 100 of the ACCEPTED total, which is the number
  //     the payment-terms document the client read is written against
  //     (lib/documents/paymentSchedule.js). Silently re-basing a "30% deposit"
  //     on a bigger contract changes a deposit the client already saw;
  //   * recomputing only the pending stages leaves the set summing to neither
  //     total — an already-requested stage on the old base beside pending ones
  //     on the new base is arithmetic nobody can reconcile.
  //
  // So the schedule keeps its numbers, the change orders are collected on the
  // invoice balance (every stage shares ONE invoice — see the model header),
  // and the shortfall is SAID rather than left for a contractor to notice that
  // the stages no longer add up to what they are owed.
  const shortfall = paymentScheduleShortfall({ stages, changeOrders });
  if (!Array.isArray(stages) || stages.length === 0) return null;

  return (
    <div className="bg-card border border-border rounded-xl px-4 py-3.5">
      <h3 className="text-sm font-semibold text-foreground mb-2.5">
        {t("app.job.paymentSchedule.title", "Payment schedule")}
      </h3>
      <div className="space-y-2">
        {[...stages]
          .sort((a, b) => a.seq - b.seq)
          .map((stage) => (
            <div
              key={stage.id}
              className="flex items-start justify-between gap-3 text-sm"
            >
              <div className="flex items-start gap-2 min-w-0">
                <span className="mt-0.5 shrink-0">
                  <StatusIcon stage={stage} />
                </span>
                <div className="min-w-0">
                  <div className="font-medium text-foreground truncate">
                    {stage.label} — {Number(stage.percentage)}%
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {stage.status === "requested" &&
                      t("app.job.paymentSchedule.requested", "Requested") +
                        (stage.dueDate ? ` · ${formatDateOnly(stage.dueDate)}` : "")}
                    {stage.status === "waived" &&
                      t("app.job.paymentSchedule.waived", "Waived (0%)")}
                    {stage.status === "pending" && stage.blockedReason &&
                      t(
                        BLOCKED_KEY[stage.blockedReason] || "app.job.paymentSchedule.pending",
                        BLOCKED_FALLBACK[stage.blockedReason] || "Waiting",
                      )}
                    {stage.status === "pending" && !stage.blockedReason && stage.dueDate &&
                      t("app.job.paymentSchedule.dueOn", "Due {date}", {
                        date: formatDateOnly(stage.dueDate),
                      })}
                  </div>
                </div>
              </div>
              <div className="shrink-0 font-medium tabular-nums text-foreground">
                {money(Number(stage.amountCents || 0) / 100)}
              </div>
            </div>
          ))}
      </div>

      {shortfall.applies && (
        <p className="mt-2.5 pt-2.5 border-t border-border text-xs text-muted-foreground">
          {t(
            "app.job.paymentSchedule.changeOrderNote",
            "These stages are percentages of the accepted quote and don't include {amount} of agreed changes. That's collected on the invoice balance, not by a stage.",
            { amount: money(Number(shortfall.approvedChangeCents || 0) / 100) },
          )}
        </p>
      )}
    </div>
  );
}
