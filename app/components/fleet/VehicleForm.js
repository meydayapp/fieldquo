"use client";

// app/components/fleet/VehicleForm.js
//
// Adding a van to the fleet screen, or editing one already on it.
//
// ══ What "add" means here, and what it does not ════════════════════════════
//
// It attaches a fleet record to an Asset that is ALREADY in the company's
// register. It does not create the asset: an Asset carries a cost and a useful
// life, it feeds depreciation into the company's overhead, and it moves the
// price floor on every quote written afterwards. Creating one from a screen
// about plates and insurance dates would be a money change made somewhere
// nobody is watching for money changes.
//
// So when there is no un-recorded vehicle left in the register, the picker
// says so, and — only for someone who may actually write the cost basis — it
// links to where a vehicle gets added. For everyone else it names who to ask.
// Neither branch draws a button that leads to a refusal.
//
// ══ Empty fields ══════════════════════════════════════════════════════════
//
// Every field is optional and every blank is sent as a blank, which the API
// reads as "clear this" (lib/fleet/payload.js). That is what makes a mistyped
// VIN or a wrong renewal date recoverable — and it is why nothing here
// pre-fills a plausible value for a field the person left alone.

import { useState } from "react";
import { X } from "lucide-react";
import Link from "next/link";
import { useTranslation } from "@/app/hooks/useTranslation";
import { reportResponseError } from "@/lib/clientErrors";

const inputClass =
  "w-full border border-border rounded-lg px-3 py-2.5 text-sm bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-ring/10";

export function dateInputValue(value) {
  if (!value) return "";
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? "" : d.toISOString().slice(0, 10);
}

export function formValuesFrom(vehicle) {
  return {
    vin: vehicle?.vin || "",
    plate: vehicle?.plate || "",
    makeModel: vehicle?.makeModel || "",
    year: vehicle?.year ?? "",
    // Empty string, not 0. A van whose mileage nobody has recorded must arrive
    // at this form as a blank box, because a pre-filled 0 is a reading nobody
    // took and it drives the service-due figure.
    odometerKm: vehicle?.odometerKm ?? "",
    assignedToUserId: vehicle?.assignedToUserId || "",
    insuranceExpiresAt: dateInputValue(vehicle?.insuranceExpiresAt),
    registrationExpiresAt: dateInputValue(vehicle?.registrationExpiresAt),
    nextServiceDueAt: dateInputValue(vehicle?.nextServiceDueAt),
    nextServiceDueKm: vehicle?.nextServiceDueKm ?? "",
  };
}

/**
 * @param mode            "create" | "edit"
 * @param vehicle         the row being edited (edit mode)
 * @param attachable      rows with an asset but no fleet record yet (create mode)
 * @param drivers         [{ userId, name, active }]
 * @param canManageAssets whether to offer the link to the asset register
 * @param onSaved         handed the fresh whole-fleet payload
 */
export default function VehicleForm({
  mode,
  vehicle,
  attachable = [],
  drivers = [],
  canManageAssets = false,
  onSaved,
  onCancel,
}) {
  const { t } = useTranslation();
  const [assetId, setAssetId] = useState(attachable[0]?.assetId || "");
  const [values, setValues] = useState(() => formValuesFrom(vehicle));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const creating = mode === "create";

  async function submit(e) {
    e.preventDefault();
    setError("");
    if (creating && !assetId) {
      setError(t("app.fleet.pickVehicle", "Pick which vehicle this is."));
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(creating ? "/api/fleet" : `/api/fleet/${vehicle.id}`, {
        method: creating ? "POST" : "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(creating ? { assetId, ...values } : values),
      });
      if (!res.ok) {
        const message = await reportResponseError(
          res,
          t("app.fleet.saveFailed", "Couldn't save that."),
        );
        setError(message || t("app.fleet.saveFailed", "Couldn't save that."));
        return;
      }
      onSaved?.(await res.json());
    } finally {
      setSaving(false);
    }
  }

  if (creating && attachable.length === 0) {
    return (
      <div className="border border-border rounded-xl p-4 space-y-2">
        <p className="text-sm font-semibold text-foreground">
          {t("app.fleet.noAssetsTitle", "Every vehicle in the register already has a record")}
        </p>
        <p className="text-sm text-muted-foreground">
          {t(
            "app.fleet.noAssetsBody",
            "A van has to be in the asset register first — that's the row that carries what it cost and how it depreciates.",
          )}
        </p>
        {canManageAssets ? (
          <Link
            href="/app/settings/overhead"
            className="inline-flex items-center text-sm font-semibold underline text-foreground"
          >
            {t("app.fleet.goToRegister", "Add a vehicle to the register")}
          </Link>
        ) : (
          <p className="text-sm text-muted-foreground">
            {t(
              "app.fleet.askOwner",
              "Ask an owner or admin to add it — the register sits with the company's costs.",
            )}
          </p>
        )}
        <button
          type="button"
          onClick={onCancel}
          className="block w-full mt-2 border border-border rounded-lg py-2.5 text-sm font-semibold min-h-[44px]"
        >
          {t("app.action.cancel", "Cancel")}
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="border border-border rounded-xl p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-foreground">
          {creating
            ? t("app.fleet.addTitle", "Add a vehicle")
            : t("app.fleet.editTitle", "Edit vehicle")}
        </h3>
        <button
          type="button"
          onClick={onCancel}
          aria-label={t("app.action.cancel", "Cancel")}
          className="p-2 -m-2 text-muted-foreground"
        >
          <X size={16} />
        </button>
      </div>

      {creating && (
        <label className="block text-xs text-muted-foreground">
          {t("app.fleet.whichVehicle", "Which vehicle")}
          <select
            className={`${inputClass} mt-1`}
            value={assetId}
            onChange={(e) => setAssetId(e.target.value)}
          >
            {attachable.map((row) => (
              <option key={row.assetId} value={row.assetId}>
                {row.asset?.name || row.assetId}
              </option>
            ))}
          </select>
        </label>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <input
          className={inputClass}
          placeholder={t("app.fleet.plate", "Plate")}
          value={values.plate}
          onChange={(e) => setValues({ ...values, plate: e.target.value })}
        />
        <input
          className={inputClass}
          placeholder={t("app.fleet.makeModel", "Make and model")}
          value={values.makeModel}
          onChange={(e) => setValues({ ...values, makeModel: e.target.value })}
        />
        <input
          className={inputClass}
          placeholder={t("app.fleet.vin", "VIN")}
          value={values.vin}
          onChange={(e) => setValues({ ...values, vin: e.target.value })}
        />
        <input
          className={inputClass}
          inputMode="numeric"
          placeholder={t("app.fleet.year", "Year")}
          value={values.year}
          onChange={(e) => setValues({ ...values, year: e.target.value })}
        />
      </div>

      <label className="block text-xs text-muted-foreground">
        {t("app.fleet.odometer", "Odometer (km)")}
        <input
          className={`${inputClass} mt-1`}
          inputMode="numeric"
          // No placeholder of "0". Blank means nobody has read it, and the
          // service-due-by-distance figure says "unknown" rather than
          // pretending the van is fresh off the lot.
          placeholder={t("app.fleet.odometerPlaceholder", "Leave blank if you don't know")}
          value={values.odometerKm}
          onChange={(e) => setValues({ ...values, odometerKm: e.target.value })}
        />
      </label>

      <label className="block text-xs text-muted-foreground">
        {t("app.fleet.driver", "Who has it")}
        <select
          className={`${inputClass} mt-1`}
          value={values.assignedToUserId}
          onChange={(e) => setValues({ ...values, assignedToUserId: e.target.value })}
        >
          <option value="">{t("app.fleet.noDriver", "Nobody in particular")}</option>
          {drivers.map((d) => (
            <option key={d.userId} value={d.userId}>
              {d.name || d.userId}
              {d.active ? "" : ` — ${t("app.fleet.inactive", "no longer active")}`}
            </option>
          ))}
        </select>
      </label>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <label className="block text-xs text-muted-foreground">
          {t("app.fleet.insuranceExpires", "Insurance expires")}
          <input
            type="date"
            className={`${inputClass} mt-1`}
            value={values.insuranceExpiresAt}
            onChange={(e) => setValues({ ...values, insuranceExpiresAt: e.target.value })}
          />
        </label>
        <label className="block text-xs text-muted-foreground">
          {t("app.fleet.registrationExpires", "Registration expires")}
          <input
            type="date"
            className={`${inputClass} mt-1`}
            value={values.registrationExpiresAt}
            onChange={(e) =>
              setValues({ ...values, registrationExpiresAt: e.target.value })
            }
          />
        </label>
        <label className="block text-xs text-muted-foreground">
          {t("app.fleet.serviceDueAt", "Next service due (date)")}
          <input
            type="date"
            className={`${inputClass} mt-1`}
            value={values.nextServiceDueAt}
            onChange={(e) => setValues({ ...values, nextServiceDueAt: e.target.value })}
          />
        </label>
        <label className="block text-xs text-muted-foreground">
          {t("app.fleet.serviceDueKm", "Next service due (km)")}
          <input
            className={`${inputClass} mt-1`}
            inputMode="numeric"
            value={values.nextServiceDueKm}
            onChange={(e) => setValues({ ...values, nextServiceDueKm: e.target.value })}
          />
        </label>
      </div>
      {/* Said on the form because it is the one place the two numbers meet:
          a km target with no odometer cannot be a countdown, and the row will
          say "unknown" rather than inventing one. */}
      <p className="text-xs text-muted-foreground">
        {t(
          "app.fleet.serviceKmHint",
          "A service due at a mileage only counts down once the odometer above is filled in.",
        )}
      </p>

      {error && (
        <p role="alert" className="text-sm text-red-700 dark:text-red-300">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={saving}
        className="w-full bg-inverted text-inverted-foreground py-3 rounded-lg text-sm font-semibold disabled:opacity-60 min-h-[44px]"
      >
        {saving ? t("app.action.saving", "Saving…") : t("app.action.save", "Save")}
      </button>
    </form>
  );
}
