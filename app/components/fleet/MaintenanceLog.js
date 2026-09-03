"use client";

// app/components/fleet/MaintenanceLog.js
//
// What has been done to one van.
//
// ══ Why the odometer field is on THIS form ═════════════════════════════════
//
// "Serviced at 84,000 km" is an odometer reading, and typing it here is the
// only moment somebody reliably has the number in front of them. The server
// decides whether it moves the van's recorded mileage
// (lib/fleet/vehicle.js `odometerFromMaintenance`) and refuses when applying
// it would be a guess — an entry older than the reading on file, or a reading
// with no date to compare against. The response says whether it moved, and
// this component tells the person rather than leaving them to notice.
//
// ══ Cost is optional and blank means blank ════════════════════════════════
//
// A repair with no cost recorded is a repair whose invoice hasn't arrived.
// Sending 0 would say it was free, and that number goes into a maintenance
// total somebody looks at when deciding whether to keep the van.

import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { useTranslation } from "@/app/hooks/useTranslation";
import { reportResponseError } from "@/lib/clientErrors";
import ListState from "@/app/components/ListState";

const inputClass =
  "w-full border border-border rounded-lg px-3 py-2.5 text-sm bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-ring/10";

// Mirrors MAINTENANCE_KINDS in lib/fleet/payload.js. The server is the
// authority — it refuses anything not on its own list — and this is the
// picker, so an option added there without one here is an option nobody can
// choose rather than a value the API rejects at save time.
const KINDS = ["service", "repair", "tyres", "inspection", "other"];

function formatDate(value, locale) {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString(locale || undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export default function MaintenanceLog({
  vehicleId,
  entries,
  loading,
  errorKey,
  canEdit,
  onRetry,
  onChanged,
}) {
  const { t, language } = useTranslation();
  const [adding, setAdding] = useState(false);
  const [kind, setKind] = useState("service");
  const [description, setDescription] = useState("");
  const [performedAt, setPerformedAt] = useState(() =>
    new Date().toISOString().slice(0, 10),
  );
  const [odometerKm, setOdometerKm] = useState("");
  const [cost, setCost] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  async function submit(e) {
    e.preventDefault();
    setError("");
    setNotice("");
    if (!description.trim()) {
      setError(t("app.fleet.describeRequired", "Say what was done."));
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(`/api/fleet/${vehicleId}/maintenance`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kind,
          description: description.trim(),
          performedAt,
          // Blank stays blank all the way to the column.
          odometerKm: odometerKm === "" ? null : Number(odometerKm),
          costCents: cost === "" ? null : Math.round(Number(cost) * 100),
        }),
      });
      if (!res.ok) {
        const message = await reportResponseError(
          res,
          t("app.fleet.logFailed", "Couldn't log that."),
        );
        setError(message || t("app.fleet.logFailed", "Couldn't log that."));
        return;
      }
      const payload = await res.json();
      setDescription("");
      setOdometerKm("");
      setCost("");
      setAdding(false);
      // Said out loud, because the odometer changing is a consequence of this
      // form that happens on a different part of the screen.
      if (payload?.odometerUpdated) {
        setNotice(
          t("app.fleet.odometerMoved", "The van's odometer was updated to match this entry."),
        );
      }
      await onChanged?.(payload);
    } finally {
      setSaving(false);
    }
  }

  async function remove(entry) {
    if (
      !window.confirm(
        t(
          "app.fleet.confirmRemoveEntry",
          "Delete this entry? The odometer reading it set stays as it is — the van really did do those kilometres.",
        ),
      )
    )
      return;
    const res = await fetch(`/api/fleet/${vehicleId}/maintenance/${entry.id}`, {
      method: "DELETE",
    });
    if (!res.ok) {
      await reportResponseError(res, t("app.fleet.deleteFailed", "Couldn't remove that."));
      return;
    }
    await onChanged?.(null);
  }

  return (
    <div className="mt-2 space-y-3">
      <ListState
        loading={loading}
        errorKey={errorKey}
        isEmpty={!!entries && entries.length === 0}
        onRetry={onRetry}
        skeleton={<div className="h-10 bg-accent rounded-lg animate-pulse" />}
        empty={
          <p className="text-xs text-muted-foreground">
            {t("app.fleet.noMaintenance", "Nothing logged yet.")}
          </p>
        }
      >
        <ul className="space-y-1.5">
          {(entries || []).map((entry) => (
            <li key={entry.id} className="flex items-start justify-between gap-2 text-xs">
              <span className="min-w-0">
                <span className="text-foreground">
                  {formatDate(entry.performedAt, language)}
                </span>{" "}
                <span className="text-muted-foreground">
                  {t(`app.fleet.kind.${entry.kind}`, entry.kind)} — {entry.description}
                  {entry.odometerKm !== null && entry.odometerKm !== undefined
                    ? ` · ${entry.odometerKm.toLocaleString()} km`
                    : ""}
                  {/* Nothing printed when the cost is null: a blank is "we
                      don't know what it cost", and "$0.00" is a claim. */}
                  {entry.costCents !== null && entry.costCents !== undefined
                    ? ` · $${(entry.costCents / 100).toFixed(2)}`
                    : ""}
                </span>
              </span>
              {canEdit && (
                <button
                  type="button"
                  onClick={() => remove(entry)}
                  aria-label={t("app.action.delete", "Delete")}
                  className="p-2 -m-1 text-muted-foreground shrink-0"
                >
                  <Trash2 size={13} />
                </button>
              )}
            </li>
          ))}
        </ul>
      </ListState>

      {notice && <p className="text-xs text-emerald-700 dark:text-emerald-300">{notice}</p>}

      {canEdit &&
        (adding ? (
          <form onSubmit={submit} className="space-y-2.5 border border-border rounded-lg p-3">
            <select
              className={inputClass}
              value={kind}
              onChange={(e) => setKind(e.target.value)}
            >
              {KINDS.map((k) => (
                <option key={k} value={k}>
                  {t(`app.fleet.kind.${k}`, k)}
                </option>
              ))}
            </select>
            <input
              className={inputClass}
              placeholder={t("app.fleet.whatWasDone", "What was done")}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
            <input
              type="date"
              className={inputClass}
              value={performedAt}
              onChange={(e) => setPerformedAt(e.target.value)}
            />
            <input
              className={inputClass}
              inputMode="numeric"
              placeholder={t("app.fleet.odometerAtService", "Odometer then (km) — optional")}
              value={odometerKm}
              onChange={(e) => setOdometerKm(e.target.value)}
            />
            <input
              className={inputClass}
              inputMode="decimal"
              placeholder={t("app.fleet.costOptional", "What it cost — leave blank if unknown")}
              value={cost}
              onChange={(e) => setCost(e.target.value)}
            />
            {error && (
              <p role="alert" className="text-sm text-red-700 dark:text-red-300">
                {error}
              </p>
            )}
            <div className="flex gap-2">
              <button
                type="submit"
                disabled={saving}
                className="flex-1 bg-inverted text-inverted-foreground py-2.5 rounded-lg text-sm font-semibold disabled:opacity-60 min-h-[44px]"
              >
                {saving ? t("app.action.saving", "Saving…") : t("app.fleet.logIt", "Log it")}
              </button>
              <button
                type="button"
                onClick={() => setAdding(false)}
                className="px-4 rounded-lg border border-border text-sm font-semibold min-h-[44px]"
              >
                {t("app.action.cancel", "Cancel")}
              </button>
            </div>
          </form>
        ) : (
          <button
            type="button"
            onClick={() => setAdding(true)}
            className="inline-flex items-center gap-1.5 text-xs font-semibold border border-border rounded-full px-3 py-2 min-h-[36px]"
          >
            <Plus size={13} /> {t("app.fleet.logWork", "Log work")}
          </button>
        ))}
    </div>
  );
}
