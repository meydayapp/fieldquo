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

function formatDateOnly(value) {
  if (!value) return "";
  return new Date(value).toLocaleDateString("en-CA", {
    timeZone: "UTC",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function money(cents) {
  return `$${(Number(cents || 0) / 100).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
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

export default function PaymentScheduleCard({ stages }) {
  const { t } = useTranslation();
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
                {money(stage.amountCents)}
              </div>
            </div>
          ))}
      </div>
    </div>
  );
}
