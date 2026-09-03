"use client";

// app/app/fleet/page.js
//
// The vans. What is due, what is expiring, and who has each one.
//
// ══ Scoped to three vans, not two hundred trucks ═══════════════════════════
//
// The construction audit was explicit that ServiceTitan's fleet product is
// aimed at a different company. A painter with three vans asks three
// questions, and they are all boring: what is due, what is expiring, and who
// has the van. Telematics, live GPS and route history are deliberately out of
// scope — and the routing audit already established that a browser cannot do
// background location, so a "where is the van" map would be right only while
// somebody happens to have the tab open.
//
// ══ Why the due-and-expiring panel is first ════════════════════════════════
//
// An insurance certificate that lapsed is a van that should not be on the
// road. It is the only thing on this screen with a same-day consequence, so it
// is the first thing on it — the same shape as the warranty call list at
// /app/equipment, on purpose.
//
// ══ Mobile ════════════════════════════════════════════════════════════════
//
// One column, cards not tables, 44px targets. `npm run check:mobile` walks
// only /platform, /sales and /app/clock today, so this screen is NOT covered
// by it; it is built to the same rules and the gap is stated rather than
// implied.

import { useCallback, useEffect, useState } from "react";
import { Truck, Plus } from "lucide-react";
import { useTranslation } from "@/app/hooks/useTranslation";
import { fetchList } from "@/lib/loadState";
import ListState from "@/app/components/ListState";
import ExpiryBadge from "@/app/components/ExpiryBadge";
import VehicleCard from "@/app/components/fleet/VehicleCard";
import VehicleForm from "@/app/components/fleet/VehicleForm";

export default function FleetPage() {
  const { t } = useTranslation();
  // null until the server answers. `[]` here would say "this company owns no
  // vehicles", which on a refused read is a lie about the driveway.
  const [data, setData] = useState(null);
  const [errorKey, setErrorKey] = useState("");
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const result = await fetchList("/api/fleet");
    if (result.aborted) return;
    if (!result.ok) {
      setErrorKey(result.errorKey);
      setLoading(false);
      return;
    }
    setErrorKey("");
    setData(result.data);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // Every write endpoint answers with the whole fleet, so a save can hand its
  // payload straight back here. `null` means "I changed something but don't
  // have the payload" — reload instead of guessing.
  const applied = useCallback(
    (payload) => {
      if (payload && Array.isArray(payload.vehicles)) setData(payload);
      else load();
    },
    [load],
  );

  const vehicles = data?.vehicles || [];
  const dueSoon = data?.dueSoon || [];
  const attachable = vehicles.filter((v) => !v.hasDetail);

  return (
    <div className="p-4 sm:p-6 max-w-3xl mx-auto space-y-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Truck size={22} />
            {t("app.fleet.title", "Vehicles")}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {t(
              "app.fleet.intro",
              "What's due, what's expiring, and who has the van. What each one cost lives in the asset register.",
            )}
          </p>
        </div>
        {data?.canEdit && attachable.length > 0 && !adding && (
          <button
            type="button"
            onClick={() => setAdding(true)}
            className="inline-flex items-center gap-1.5 border border-border rounded-full px-4 py-2 text-sm font-semibold min-h-[40px] shrink-0"
          >
            <Plus size={14} /> {t("app.fleet.add", "Add")}
          </button>
        )}
      </div>

      {adding && (
        <VehicleForm
          mode="create"
          attachable={attachable}
          drivers={data?.drivers || []}
          canManageAssets={!!data?.canManageAssets}
          onSaved={(payload) => {
            setAdding(false);
            applied(payload);
          }}
          onCancel={() => setAdding(false)}
        />
      )}

      {/* Due and expiring. Rendered only when the server answered AND there is
          something to report — an empty red panel reads as a broken screen,
          and "nothing is due" is stated below in the list itself. */}
      {data && dueSoon.length > 0 && (
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-border">
            <h2 className="font-semibold text-sm text-foreground">
              {t("app.fleet.dueTitle", "Due or expiring")}
            </h2>
          </div>
          <ul className="divide-y divide-border">
            {dueSoon.map((row) => (
              <li key={row.vehicleId} className="px-4 py-3 flex items-start justify-between gap-3">
                <span className="min-w-0">
                  <span className="block text-sm font-semibold text-foreground truncate">
                    {row.name || row.plate || t("app.fleet.unnamed", "Unnamed vehicle")}
                  </span>
                  <span className="block text-xs text-muted-foreground truncate">
                    {row.reasons
                      .map(
                        (r) =>
                          ({
                            insurance: t("app.fleet.insurance", "Insurance"),
                            registration: t("app.fleet.registration", "Registration"),
                            service: t("app.fleet.serviceDate", "Service (by date)"),
                            serviceKm: t("app.fleet.serviceKm", "Service (by mileage)"),
                          })[r.kind],
                      )
                      .join(" · ")}
                  </span>
                </span>
                <ExpiryBadge state={row.state} className="shrink-0" />
              </li>
            ))}
          </ul>
        </div>
      )}

      <ListState
        loading={loading}
        errorKey={errorKey}
        isEmpty={!!data && vehicles.length === 0}
        onRetry={load}
        empty={
          <div className="bg-card border border-border rounded-xl p-8 text-center space-y-2">
            <p className="text-sm font-semibold text-foreground">
              {t("app.fleet.emptyTitle", "No vehicles in the register")}
            </p>
            <p className="text-sm text-muted-foreground">
              {t(
                "app.fleet.emptyBody",
                "A van shows up here once it's in the asset register — that's the row carrying what it cost and how it depreciates.",
              )}
            </p>
            {/* Only for someone the register would actually accept. */}
            {data?.canManageAssets && (
              <a
                href="/app/settings/overhead"
                className="inline-block text-sm font-semibold underline text-foreground"
              >
                {t("app.fleet.goToRegister", "Add a vehicle to the register")}
              </a>
            )}
          </div>
        }
      >
        <div className="space-y-3">
          {vehicles.map((row) => (
            <VehicleCard
              key={row.id || row.assetId}
              row={row}
              drivers={data?.drivers || []}
              canEdit={!!data?.canEdit}
              canSeeCost={!!data?.canSeeCost}
              canManageAssets={!!data?.canManageAssets}
              attachable={attachable}
              onChanged={applied}
            />
          ))}
        </div>
      </ListState>
    </div>
  );
}
