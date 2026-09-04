"use client";

// app/components/fleet/VehicleCard.js
//
// One van: what is due, who has it, and what has been done to it.
//
// ══ Four expiries, always all four ═════════════════════════════════════════
//
// Insurance, registration, service by date and service by mileage are rendered
// whatever their state — including "not recorded". A row silently missing from
// a list of four is how "nobody ever entered the insurance renewal" becomes
// invisible, and an invisible gap is exactly what puts an uninsured van on the
// road.
//
// ══ The orphan ════════════════════════════════════════════════════════════
//
// `VehicleDetail.assetId` has no foreign key, so deleting the Asset from
// Settings → Overhead leaves this record pointing at nothing. The card says so
// plainly and offers to remove the fleet record — it does NOT hide the row,
// because a lapsed insurance date is still a true fact about a real van, and
// it does not touch the register.

import { useCallback, useEffect, useState } from "react";
import {
  Truck,
  ChevronDown,
  ChevronRight,
  Pencil,
  Trash2,
  Wrench,
  AlertTriangle,
} from "lucide-react";
import { useTranslation } from "@/app/hooks/useTranslation";
import { useCompanyMoney } from "@/app/providers/CompanyPreferencesProvider";
import { reportResponseError } from "@/lib/clientErrors";
import { fetchList } from "@/lib/loadState";
import ExpiryBadge from "@/app/components/ExpiryBadge";
import VehicleForm from "./VehicleForm";
import MaintenanceLog from "./MaintenanceLog";

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

// Why the depreciation reason is on this card at all: lib/fleet/load.js has
// always sent `chargeable` and `chargeReason` per vehicle and nothing here
// read them. lib/accounting/depreciation.js returns `bookValue = cost` for a
// register row with no in-service date or no useful life — so a van nobody
// finished entering showed "Book value now: $52,000", identical in every way
// to a van that really is worth that. Settings → Overhead already names these
// five reasons; the same keys are reused rather than a second wording.
const ASSET_REASON_FALLBACK = {
  not_in_service: "Not in service yet",
  fully_depreciated: "Fully written down",
  disposed: "Sold or written off",
  inactive: "Not in use",
  incomplete: "Missing details",
};

export default function VehicleCard({
  row,
  drivers,
  canEdit,
  canSeeCost,
  canManageAssets,
  attachable,
  onChanged,
}) {
  const { t, language } = useTranslation();
  // The company's own currency, not a typed "$" — a Dublin painter's van did
  // not cost dollars. See lib/format/money.js for the six private formatters
  // this hook exists to replace.
  const companyMoney = useCompanyMoney();
  // Null stays null. `Number(null) || 0` used to make an unrecorded cost read
  // as "$0", and 0 is a finite, confident, wrong answer on a page about what
  // a van is worth.
  const money = (v) =>
    v === null || v === undefined
      ? t("app.fleet.notRecorded", "Not recorded")
      : companyMoney(v);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [log, setLog] = useState(null);
  const [logErrorKey, setLogErrorKey] = useState("");
  const [logLoading, setLogLoading] = useState(false);

  const attention = row.attention || { state: "unknown", expiries: [] };
  const name = row.name || t("app.fleet.unnamed", "Unnamed vehicle");

  const loadLog = useCallback(async () => {
    if (!row.id) return;
    setLogLoading(true);
    const result = await fetchList(`/api/fleet/${row.id}/maintenance`);
    if (result.aborted) return;
    if (!result.ok) {
      setLogErrorKey(result.errorKey);
      setLogLoading(false);
      return;
    }
    setLogErrorKey("");
    setLog(Array.isArray(result.data?.maintenance) ? result.data.maintenance : []);
    setLogLoading(false);
  }, [row.id]);

  useEffect(() => {
    if (open && row.id && log === null && !logErrorKey) loadLog();
  }, [open, row.id, log, logErrorKey, loadLog]);

  async function removeVehicle() {
    if (
      !window.confirm(
        t(
          "app.fleet.confirmDelete",
          "Remove this vehicle's fleet record? The asset itself, and its depreciation, stay exactly as they are.",
        ),
      )
    )
      return;
    const res = await fetch(`/api/fleet/${row.id}`, { method: "DELETE" });
    if (!res.ok) {
      await reportResponseError(res, t("app.fleet.deleteFailed", "Couldn't remove that."));
      return;
    }
    onChanged?.(await res.json());
  }

  // A vehicle in the register with no fleet record yet. Offered as an "add
  // details" card rather than hidden — the van exists, and pretending it
  // doesn't is how a fleet screen comes to disagree with the driveway.
  if (!row.hasDetail) {
    return (
      <div className="bg-card border border-dashed border-border rounded-xl p-4">
        <div className="flex items-center gap-2">
          <Truck size={16} className="text-muted-foreground" />
          <span className="font-semibold text-sm text-foreground">{name}</span>
        </div>
        <p className="text-xs text-muted-foreground mt-1">
          {t(
            "app.fleet.noDetailsYet",
            "In the asset register, but no plate, mileage or renewal dates recorded.",
          )}
        </p>
        {canEdit && !editing && (
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="mt-3 inline-flex items-center gap-1.5 text-xs font-semibold border border-border rounded-full px-3 py-2 min-h-[36px]"
          >
            <Pencil size={13} /> {t("app.fleet.addDetails", "Add fleet details")}
          </button>
        )}
        {editing && (
          <div className="mt-3">
            <VehicleForm
              mode="create"
              attachable={[row]}
              drivers={drivers}
              canManageAssets={canManageAssets}
              onSaved={(payload) => {
                setEditing(false);
                onChanged?.(payload);
              }}
              onCancel={() => setEditing(false)}
            />
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="bg-card border border-border rounded-xl">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        className="w-full text-left p-4 flex items-start gap-3 min-h-[56px]"
      >
        <span className="mt-0.5 text-muted-foreground">
          {open ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
        </span>
        <span className="flex-1 min-w-0">
          <span className="block font-semibold text-sm text-foreground truncate">
            {name}
          </span>
          <span className="block text-xs text-muted-foreground truncate">
            {[row.plate, row.makeModel, row.year].filter(Boolean).join(" · ") ||
              t("app.fleet.noIdentifiers", "No plate or model recorded")}
          </span>
          <span className="mt-2 flex flex-wrap items-center gap-2">
            <ExpiryBadge
              state={attention.state}
              label={
                attention.state === "expired"
                  ? t("app.fleet.badgeOverdue", "Something's lapsed")
                  : attention.state === "due_soon"
                    ? t("app.fleet.badgeDue", "Something's due")
                    : attention.state === "ok"
                      ? t("app.fleet.badgeOk", "Nothing due")
                      : t("app.fleet.badgeUnknown", "Nothing recorded")
              }
            />
            {row.assignedToName && (
              <span className="text-xs text-muted-foreground truncate">
                {t("app.fleet.withDriver", "with {name}", { name: row.assignedToName })}
              </span>
            )}
          </span>
        </span>
      </button>

      {open && (
        <div className="px-4 pb-4 space-y-4 border-t border-border pt-3">
          {row.assetMissing && (
            <div
              role="status"
              className="flex items-start gap-2 bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-900 rounded-lg p-3"
            >
              <AlertTriangle size={15} className="text-amber-700 dark:text-amber-300 mt-0.5" />
              <p className="text-xs text-amber-700 dark:text-amber-300">
                {t(
                  "app.fleet.orphanWarning",
                  "The asset record behind this vehicle was deleted. The dates below are still real — keep them, or remove this record once the van's gone.",
                )}
              </p>
            </div>
          )}

          <ul className="space-y-2">
            {(attention.expiries || []).map((e) => (
              <li key={e.kind} className="flex items-center justify-between gap-3">
                <span className="text-xs text-foreground">
                  {
                    {
                      insurance: t("app.fleet.insurance", "Insurance"),
                      registration: t("app.fleet.registration", "Registration"),
                      service: t("app.fleet.serviceDate", "Service (by date)"),
                      serviceKm: t("app.fleet.serviceKm", "Service (by mileage)"),
                    }[e.kind]
                  }
                </span>
                <span className="flex items-center gap-2 shrink-0">
                  <span className="text-xs text-muted-foreground">
                    {e.kind === "serviceKm"
                      ? e.state === "unknown"
                        ? t("app.fleet.kmUnknown", "Not enough recorded")
                        : t("app.fleet.kmRemaining", "{km} km to go", { km: e.remainingKm })
                      : e.state === "unknown"
                        ? t("app.fleet.dateUnknown", "No date recorded")
                        : formatDate(e.endsAt, language)}
                  </span>
                  <ExpiryBadge state={e.state} />
                </span>
              </li>
            ))}
          </ul>

          <dl className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-xs">
            <dt className="text-muted-foreground">{t("app.fleet.odometer", "Odometer (km)")}</dt>
            <dd className="text-foreground text-right">
              {/* Null is unknown. Never a 0 — a van nobody has read the dash on
                  and a van straight off the lot are different vans. */}
              {row.odometerKm === null || row.odometerKm === undefined
                ? t("app.fleet.notRecorded", "Not recorded")
                : `${row.odometerKm.toLocaleString()}${
                    row.odometerAtUtc
                      ? ` · ${formatDate(row.odometerAtUtc, language)}`
                      : ""
                  }`}
            </dd>
            <dt className="text-muted-foreground">{t("app.fleet.vin", "VIN")}</dt>
            <dd className="text-foreground text-right truncate">
              {row.vin || t("app.fleet.notRecorded", "Not recorded")}
            </dd>
            {/* The cost half only exists in the payload when the member passed
                the cost-basis gate, so this is not a hidden field — it is a
                field that was never sent. */}
            {canSeeCost && row.asset && (
              <>
                <dt className="text-muted-foreground">{t("app.fleet.cost", "Cost")}</dt>
                <dd className="text-foreground text-right">{money(row.asset.cost)}</dd>
                <dt className="text-muted-foreground">
                  {t("app.fleet.bookValue", "Book value now")}
                </dt>
                <dd className="text-foreground text-right">
                  {money(row.asset.bookValue)}
                  {/* A book value nothing is being written down against is
                      just the purchase price wearing a different label. Say
                      which of the five reasons it is, in the same words
                      Settings → Overhead uses. */}
                  {row.asset.chargeable === false && row.asset.chargeReason && (
                    <span className="block text-[11px] text-amber-700 dark:text-amber-300">
                      {t(
                        `app.setOverhead.assetReason.${row.asset.chargeReason}`,
                        ASSET_REASON_FALLBACK[row.asset.chargeReason] || "",
                      )}
                    </span>
                  )}
                </dd>
              </>
            )}
          </dl>

          {canEdit && !editing && (
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setEditing(true)}
                className="inline-flex items-center gap-1.5 text-xs font-semibold border border-border rounded-full px-3 py-2 min-h-[36px]"
              >
                <Pencil size={13} /> {t("app.action.edit", "Edit")}
              </button>
              <button
                type="button"
                onClick={removeVehicle}
                className="inline-flex items-center gap-1.5 text-xs font-semibold border border-border rounded-full px-3 py-2 min-h-[36px] text-red-700 dark:text-red-300"
              >
                <Trash2 size={13} /> {t("app.fleet.removeRecord", "Remove fleet record")}
              </button>
            </div>
          )}

          {editing && (
            <VehicleForm
              mode="edit"
              vehicle={row}
              drivers={drivers}
              canManageAssets={canManageAssets}
              attachable={attachable}
              onSaved={(payload) => {
                setEditing(false);
                onChanged?.(payload);
              }}
              onCancel={() => setEditing(false)}
            />
          )}

          <div>
            <p className="text-xs font-semibold text-foreground flex items-center gap-1.5">
              <Wrench size={13} /> {t("app.fleet.maintenance", "Maintenance")}
            </p>
            <MaintenanceLog
              vehicleId={row.id}
              entries={log}
              loading={logLoading}
              errorKey={logErrorKey}
              canEdit={canEdit}
              onRetry={loadLog}
              onChanged={async (payload) => {
                await loadLog();
                // A logged service can move the odometer, which changes the
                // service-due figure on the card above — so the whole fleet is
                // reloaded rather than only the log.
                if (payload?.odometerUpdated) onChanged?.(null);
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
