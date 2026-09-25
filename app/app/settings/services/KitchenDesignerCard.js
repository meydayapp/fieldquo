// app/app/settings/services/KitchenDesignerCard.js
//
// Whether this company has the Kitchen Designer, why, and its own override.
//
// The rule is the owner's 2026-09-25 decision (lib/kitchen/key.js): on by
// itself for the trades that build kitchens, and a company-level override
// either way. Before this card, a company had no screen that said the
// designer was on or off at all — it found out by whether a button appeared
// on a quote.
//
// ── Why the status reads the TICKED boxes, not the saved ones ──────────────
//
// The override saves the moment it is picked (it is one company-level value,
// and PATCH /api/settings/kitchen-designer refuses anything but owner/admin);
// the trade switches below save on the page's Save button. Previewing from
// the saved state would say "Off" right after someone ticked Remodeling and
// before they saved — the status contradicting the box they just ticked. So
// the status is computed from the ticked boxes with the SAME pure rule the
// server gate uses (kitchenDesignerOnPure), and a line says so when the two
// differ, instead of a guess that silently disagrees with the server.
//
// ── Handyman ───────────────────────────────────────────────────────────────
//
// "Maybe handyman if they enable that": not automatic. Kitchen Design & New
// Installs belongs to no industry preset (lib/trades/catalog.js), so a
// handyman company's list hides it behind "Show other trades" — the button
// here reveals and scrolls to it, so the one switch the owner named is never
// two clicks of guessing away.
"use client";

import { useEffect, useMemo, useState } from "react";
import { ChefHat } from "lucide-react";
import {
  KITCHEN_DESIGN_KEY,
  kitchenDesignerOnPure,
  kitchenGrantingKeys,
} from "@/lib/kitchen/key";
import { fetchJson, errorText } from "@/lib/fetchJson";
import { reportResponseError } from "@/lib/clientErrors";
import { useTranslation } from "@/app/hooks/useTranslation";

const MODES = [
  { value: "follow", override: null, key: "follow" },
  { value: "on", override: true, key: "alwaysOn" },
  { value: "off", override: false, key: "alwaysOff" },
];

function modeFor(override) {
  return override === true ? "on" : override === false ? "off" : "follow";
}

export default function KitchenDesignerCard({ categories, canEdit, onFindKitchenDesign }) {
  const { t } = useTranslation();
  const k = (key) => t(`app.setServices.kitchen.${key}`);
  // null until GET answers: no status line is drawn over an unknown override,
  // because "Off — none of your services builds kitchens" is a claim.
  const [server, setServer] = useState(null);
  const [loadError, setLoadError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let live = true;
    (async () => {
      try {
        const data = await fetchJson("/api/settings/kitchen-designer");
        if (live) setServer(data);
      } catch (err) {
        if (live) setLoadError(errorText(t, err));
      }
    })();
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const tickedKeys = useMemo(
    () => (categories || []).filter((c) => c.enabled).map((c) => c.key),
    [categories],
  );

  if (loadError) {
    return (
      <div className="mb-6 rounded-lg border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950/30 p-4 text-sm text-red-700 dark:text-red-300">
        {loadError}
      </div>
    );
  }
  if (!server) return null;

  const override = server.override ?? null;
  const on = kitchenDesignerOnPure(tickedKeys, override);
  const granting = kitchenGrantingKeys(tickedKeys);
  const grantingLabels = granting
    .map((key) => categories.find((c) => c.key === key)?.label)
    .filter(Boolean)
    .join(", ");
  const status =
    override === true
      ? k("onForced")
      : override === false
        ? k("offForced")
        : on
          ? t("app.setServices.kitchen.onBecause", { trades: grantingLabels })
          : k("offNoTrade");
  // The ticked boxes and the saved ones give different answers: say so.
  const unsaved = on !== server.on;
  const kitchenDesignTicked = tickedKeys.includes(KITCHEN_DESIGN_KEY);

  async function pick(value) {
    const next = MODES.find((m) => m.value === value);
    if (!next || next.override === override) return;
    setSaving(true);
    try {
      const res = await fetch("/api/settings/kitchen-designer", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ override: next.override }),
      });
      if (!res.ok) {
        await reportResponseError(res);
        return;
      }
      setServer(await res.json());
    } catch (err) {
      await reportResponseError(err);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mb-6 border rounded-lg p-4">
      <div className="flex items-center gap-2 font-medium">
        <ChefHat size={16} aria-hidden="true" />
        {k("title")}
      </div>
      <p className="text-sm mt-1">{status}</p>
      {unsaved && <p className="text-xs text-muted-foreground mt-0.5">{k("saveToApply")}</p>}
      <p className="text-xs text-muted-foreground mt-2">{k("explain")}</p>

      <div className="mt-3 flex flex-col sm:flex-row sm:items-center gap-2">
        <select
          value={modeFor(override)}
          onChange={(e) => pick(e.target.value)}
          disabled={!canEdit || saving}
          aria-label={k("title")}
          className="border border-border rounded-lg px-3 py-2 text-sm bg-background min-h-10 disabled:opacity-60"
        >
          {MODES.map((m) => (
            <option key={m.value} value={m.value}>
              {k(m.key)}
            </option>
          ))}
        </select>
        {!canEdit && <span className="text-xs text-muted-foreground">{k("ownerOnly")}</span>}
      </div>

      {!kitchenDesignTicked && (
        <div className="mt-3 text-xs text-muted-foreground">
          <p>{k("handyman")}</p>
          <button
            type="button"
            onClick={onFindKitchenDesign}
            className="mt-1 font-medium text-foreground underline underline-offset-2"
          >
            {k("findToggle")}
          </button>
        </div>
      )}
    </div>
  );
}
