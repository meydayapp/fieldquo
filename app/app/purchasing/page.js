// app/app/purchasing/page.js
//
// Purchasing: requests from the field, suppliers, purchase orders, and what
// is on the shelf.
//
// ── Why three panels on one page and not three nav rows ────────────────────
//
// They are one job. A contractor raises an order with a supplier, takes
// delivery of it, and the delivery is what changes the stock — so the three
// screens are three views of one movement of goods, and splitting them across
// the sidebar would put three rows in a menu the nav audit already describes as
// too long to scan. AdminSidebar's own comment makes the same call for the
// analytics hub: one destination with a fan-out inside it, not six rows.
//
// ── Mobile first, because delivery happens outdoors ────────────────────────
//
// The delivery form and the stock movement form are both used standing up,
// one-handed, at a tailgate. Everything stacks, inputs are at least 16px so
// iOS does not zoom on focus, and no panel depends on a table that only makes
// sense at 1200px.
"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { PackageSearch, Truck, Boxes, Inbox } from "lucide-react";
import { useTranslation } from "@/app/hooks/useTranslation";
import { usePermissions } from "@/app/providers/PermissionProvider";
import { hasLevel } from "@/lib/permissions/enforce";
import { PURCHASING_CATEGORY, PURCHASING_LEVEL } from "@/lib/purchasing/access";
import PurchaseOrdersPanel from "@/app/components/purchasing/PurchaseOrdersPanel";
import SuppliersPanel from "@/app/components/purchasing/SuppliersPanel";
import StockPanel from "@/app/components/purchasing/StockPanel";
import SupplyRequestsPanel from "@/app/components/purchasing/SupplyRequestsPanel";

const TABS = [
  { key: "orders", icon: Truck, labelKey: "app.purchasing.tab.orders" },
  { key: "stock", icon: Boxes, labelKey: "app.purchasing.tab.stock" },
  { key: "suppliers", icon: PackageSearch, labelKey: "app.purchasing.tab.suppliers" },
  // The mouth of the funnel: what the field asked for, and where each ask
  // stands. Last rather than first so the page still opens on Orders, the
  // tab every existing capture and tour of it shows.
  { key: "requests", icon: Inbox, labelKey: "app.purchasing.tab.requests" },
];
const TAB_KEYS = new Set(TABS.map((t) => t.key));

export default function PurchasingPage() {
  // The boundary useSearchParams asks for, around the whole page rather than
  // a fragment of it: the fallback renders for one frame on a static paint.
  return (
    <Suspense fallback={null}>
      <Purchasing />
    </Suspense>
  );
}

function Purchasing() {
  const { t } = useTranslation();
  const caller = usePermissions();
  const [tab, setTab] = useState("orders");
  const params = useSearchParams();

  // ?tab=stock — where the global search's Purchasing entries land, and where
  // the "supply requested" notification already pointed
  // (lib/notifications/render.js).
  //
  // This was read ONCE on mount, from window.location, to avoid the Suspense
  // boundary useSearchParams asks for. That was fine while the only way in
  // was a fresh navigation from a notification. It stopped being fine the
  // moment search could offer these tabs: a soft navigation from
  // /app/purchasing?tab=orders to ?tab=stock does not remount this page, so
  // the address would say stock and the screen would still show orders — a
  // link that appears to work and doesn't.
  const wanted = params.get("tab");
  useEffect(() => {
    if (wanted && TAB_KEYS.has(wanted)) setTab(wanted);
    // An address with no ?tab is NOT a request for Orders: somebody who
    // clicked Stock and then cleared the query is still on Stock. Only a
    // named tab moves the screen.
  }, [wanted]);

  // The sidebar already hides this row for a member without the level (see
  // NAV_REQUIREMENTS), and hiding a row is not access control — every route
  // behind this page refuses independently. This branch exists so somebody who
  // arrives by URL reads a sentence rather than three panels of red banners.
  const allowed = hasLevel(caller, PURCHASING_CATEGORY, PURCHASING_LEVEL);

  return (
    <div className="mx-auto w-full max-w-5xl px-4 py-6 sm:px-6">
      <header className="mb-5">
        <h1 className="text-xl font-semibold text-foreground">
          {t("app.purchasing.title")}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {t("app.purchasing.subtitle")}
        </p>
      </header>

      {!allowed ? (
        <div className="rounded-xl border border-border bg-card p-5 text-sm text-muted-foreground">
          {t("app.purchasing.noAccess")}
        </div>
      ) : (
        <>
          <div
            role="tablist"
            aria-label={t("app.purchasing.title")}
            className="mb-4 flex gap-1 overflow-x-auto rounded-lg border border-border bg-card p-1"
          >
            {TABS.map((entry) => {
              const Icon = entry.icon;
              const active = tab === entry.key;
              return (
                <button
                  key={entry.key}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => setTab(entry.key)}
                  // min-h-11 (44px). The header above says this screen is used
                  // standing up at a tailgate; px-3 py-2 on 20px text is a
                  // 36px target, which is the size the mobile rules exist to
                  // stop. Stated as a claim and not met is worse than not
                  // claimed.
                  className={`flex min-h-11 flex-1 items-center justify-center gap-1.5 whitespace-nowrap rounded-md px-3 py-2 text-sm font-medium transition ${
                    active
                      ? "bg-foreground text-background"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <Icon size={15} />
                  {t(entry.labelKey)}
                </button>
              );
            })}
          </div>

          {tab === "requests" && <SupplyRequestsPanel />}
          {tab === "orders" && <PurchaseOrdersPanel />}
          {tab === "stock" && <StockPanel />}
          {tab === "suppliers" && <SuppliersPanel />}
        </>
      )}
    </div>
  );
}
