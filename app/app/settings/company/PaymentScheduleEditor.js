// app/app/settings/company/PaymentScheduleEditor.js
//
// The structured half of the payment schedule feature — Settings → Company →
// Payment schedule. Sibling to the free-text "Payment terms" field just
// below it on the same page: that field still exists and still renders on
// documents exactly as it always did, but once a schedule is saved here it
// generates that field's text rather than a human typing it — see
// app/api/settings/payment-schedule/route.js's header for why keeping the
// two in sync (rather than picking one and deleting the other) is the fix.
//
// This is a THIN client around the API route — every real rule (percentages
// must sum to 100, the closed trigger set) is enforced server-side in
// lib/paymentSchedule/validate.js. Client-side validation here is a UX
// convenience (don't let someone click Save on an obviously broken total),
// never the actual gate.
"use client";

import { useEffect, useState } from "react";
import { Plus, Trash2, Loader2, Check, AlertCircle } from "lucide-react";
import { useTranslation } from "@/app/hooks/useTranslation";
import {
  PAYMENT_SCHEDULE_TRIGGERS,
  DEFAULT_STAGE_LABELS,
  totalPercentage,
} from "@/lib/paymentSchedule/engine";

const TRIGGER_KEY = {
  on_invoice_created: "app.paymentSchedule.triggerOnInvoiceCreated",
  job_start: "app.paymentSchedule.triggerJobStart",
  halfway: "app.paymentSchedule.triggerHalfway",
  job_end: "app.paymentSchedule.triggerJobEnd",
};

function nextSeq(stages) {
  return stages.reduce((max, s) => Math.max(max, s.seq), -1) + 1;
}

// Which trigger to default a freshly-added stage to: the first one not
// already used, or on_invoice_created if the set is empty — matches the
// order the owner described the four triggers in.
function nextTrigger(stages) {
  const used = new Set(stages.map((s) => s.trigger));
  return PAYMENT_SCHEDULE_TRIGGERS.find((tr) => !used.has(tr)) || PAYMENT_SCHEDULE_TRIGGERS[0];
}

export default function PaymentScheduleEditor({ canEdit, onSaved, onCleared }) {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(true);
  const [stages, setStages] = useState([]);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    fetch("/api/settings/payment-schedule")
      .then((r) => r.json())
      .then((d) => {
        if (cancelled) return;
        setStages(Array.isArray(d?.stages) ? d.stages : []);
      })
      .catch(() => {})
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, []);

  const sum = totalPercentage(stages);
  const validTotal = stages.length > 0 && Math.abs(sum - 100) < 0.001;

  function addStage() {
    const trigger = nextTrigger(stages);
    setStages([
      ...stages,
      {
        seq: nextSeq(stages),
        label: DEFAULT_STAGE_LABELS[trigger] || "",
        trigger,
        percentage: 0,
      },
    ]);
    setSaved(false);
  }

  function updateStage(seq, patch) {
    setStages(stages.map((s) => (s.seq === seq ? { ...s, ...patch } : s)));
    setSaved(false);
  }

  function removeStage(seq) {
    setStages(
      stages.filter((s) => s.seq !== seq).map((s, i) => ({ ...s, seq: i })),
    );
    setSaved(false);
  }

  async function save() {
    setSaving(true);
    setError("");
    try {
      const res = await fetch("/api/settings/payment-schedule", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stages }),
      });
      const d = await res.json().catch(() => null);
      if (!res.ok) {
        setError(
          d?.error === "invalid_schedule"
            ? t("app.paymentSchedule.totalMustBe100", "Stages must add up to exactly 100% before they can be saved.")
            : d?.error || "Couldn't save the schedule.",
        );
        return;
      }
      setStages(d.stages || []);
      setSaved(true);
      onSaved?.(d);
    } catch {
      setError("Couldn't reach the server — check your connection and try again.");
    } finally {
      setSaving(false);
    }
  }

  async function turnOff() {
    if (
      !window.confirm(
        t(
          "app.paymentSchedule.turnOffConfirm",
          "This clears every stage. Jobs already using this schedule keep what was already billed; new quotes will use the free-text terms below instead. Continue?",
        ),
      )
    ) {
      return;
    }
    setSaving(true);
    setError("");
    try {
      const res = await fetch("/api/settings/payment-schedule", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stages: [] }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => null);
        setError(d?.error || "Couldn't turn off the schedule.");
        return;
      }
      setStages([]);
      onCleared?.();
    } catch {
      setError("Couldn't reach the server — check your connection and try again.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <div className="h-24 animate-pulse rounded-lg bg-muted" />;
  }

  return (
    <div className="space-y-3">
      {!canEdit ? (
        <p className="text-sm text-muted-foreground">
          {stages.length === 0
            ? t("app.paymentSchedule.emptyState", "No stages yet — every quote gets one full invoice on acceptance, exactly as it always has.")
            : null}
        </p>
      ) : null}

      {stages.length === 0 && !canEdit ? null : (
        <div className="space-y-2">
          {stages.map((stage) => (
            <div
              key={stage.seq}
              className="flex flex-wrap items-center gap-2 rounded-lg border border-border p-2.5"
            >
              <input
                value={stage.label}
                onChange={(e) => updateStage(stage.seq, { label: e.target.value })}
                disabled={!canEdit}
                placeholder={t("app.paymentSchedule.stageLabel", "Stage name")}
                className="min-w-[9rem] flex-1 rounded border border-border bg-background px-2 py-1.5 text-sm"
              />
              <select
                value={stage.trigger}
                onChange={(e) => updateStage(stage.seq, { trigger: e.target.value })}
                disabled={!canEdit}
                className="rounded border border-border bg-background px-2 py-1.5 text-sm"
              >
                {PAYMENT_SCHEDULE_TRIGGERS.map((tr) => (
                  <option key={tr} value={tr}>
                    {t(TRIGGER_KEY[tr], tr)}
                  </option>
                ))}
              </select>
              <div className="flex items-center gap-1">
                <input
                  type="number"
                  min={0}
                  max={100}
                  step="0.1"
                  value={stage.percentage}
                  onChange={(e) =>
                    updateStage(stage.seq, { percentage: Number(e.target.value) })
                  }
                  disabled={!canEdit}
                  className="w-20 rounded border border-border bg-background px-2 py-1.5 text-sm text-right tabular-nums"
                />
                <span className="text-sm text-muted-foreground">%</span>
              </div>
              {canEdit && (
                <button
                  type="button"
                  onClick={() => removeStage(stage.seq)}
                  title={t("app.paymentSchedule.removeStage", "Remove this stage")}
                  className="rounded p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                >
                  <Trash2 size={15} />
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {canEdit && (
        <button
          type="button"
          onClick={addStage}
          className="inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-xs font-medium hover:border-foreground/40"
        >
          <Plus size={14} /> {t("app.paymentSchedule.addStage", "Add a stage")}
        </button>
      )}

      {stages.length > 0 && (
        <div
          className={`text-sm font-medium ${validTotal ? "text-muted-foreground" : "text-destructive"}`}
        >
          {t("app.paymentSchedule.total", "Total")}: {sum}%
          {!validTotal && ` — ${t("app.paymentSchedule.totalMustBe100", "Stages must add up to exactly 100% before they can be saved.")}`}
        </div>
      )}

      {error && (
        <div className="flex items-start gap-2 text-sm text-destructive">
          <AlertCircle size={15} className="mt-0.5 shrink-0" />
          {error}
        </div>
      )}

      {canEdit && stages.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 pt-1">
          <button
            type="button"
            onClick={save}
            disabled={saving || !validTotal}
            className="inline-flex items-center gap-1.5 rounded-lg bg-foreground px-4 py-2 text-sm font-semibold text-background disabled:opacity-50"
          >
            {saving ? <Loader2 size={14} className="animate-spin" /> : saved ? <Check size={14} /> : null}
            {saved ? t("app.paymentSchedule.saved", "Saved") : t("app.paymentSchedule.save", "Save schedule")}
          </button>
          <button
            type="button"
            onClick={turnOff}
            disabled={saving}
            className="text-sm text-muted-foreground underline hover:text-foreground"
          >
            {t("app.paymentSchedule.turnOff", "Turn off — go back to free text")}
          </button>
        </div>
      )}
    </div>
  );
}
