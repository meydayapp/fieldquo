"use client";

// app/app/settings/cabinet-rates/page.js
//
// What this company charges for cabinetry.
//
// The single most important screen in the kitchen feature, because without it
// every company quotes at the numbers the adapted source shipped with — one real
// cabinet maker's real prices. Those are a starting point, not a default anyone
// should accept silently, so this page says which of the two you're on.

import { useEffect, useState } from "react";
import { Loader2, Check, RotateCcw, Info } from "lucide-react";
import { reportResponseError } from "@/lib/clientErrors";
import { useTranslation } from "@/app/hooks/useTranslation";

/** One money field. */
function Rate({
  label,
  value,
  onChange,
  prefix = "$",
  suffix,
  hint,
  step = 1,
}) {
  return (
    <label className="block">
      <span className="text-sm text-foreground">{label}</span>
      {hint && (
        <span className="block text-xs text-muted-foreground mt-0.5">
          {hint}
        </span>
      )}
      <span className="mt-1.5 flex items-center gap-1.5">
        {prefix && (
          <span className="text-sm text-muted-foreground">{prefix}</span>
        )}
        <input
          type="number"
          inputMode="decimal"
          step={step}
          min={0}
          value={value ?? ""}
          onChange={(e) =>
            onChange(e.target.value === "" ? "" : Number(e.target.value))
          }
          className="w-full max-w-[8rem] px-3 py-2 rounded-lg border border-border bg-background text-foreground text-sm"
        />
        {suffix && (
          <span className="text-sm text-muted-foreground">{suffix}</span>
        )}
      </span>
    </label>
  );
}

function Card({ title, blurb, children }) {
  return (
    <section className="bg-card border border-border rounded-xl p-5">
      <h2 className="font-semibold text-foreground">{title}</h2>
      {blurb && (
        <p className="text-sm text-muted-foreground mt-1 mb-4">{blurb}</p>
      )}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{children}</div>
    </section>
  );
}

export default function CabinetRatesPage() {
  const { t } = useTranslation();
  const [rates, setRates] = useState(null);
  const [usingDefaults, setUsingDefaults] = useState(true);
  const [materials, setMaterials] = useState({ door: {}, box: {} });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    fetch("/api/settings/cabinet-rates")
      .then(async (res) => {
        if (!res.ok) {
          await reportResponseError(
            res,
            t(
              "app.setCabinetRates.loadError",
              "Couldn't load your cabinet pricing.",
            ),
          );
          return null;
        }
        return res.json();
      })
      .then((d) => {
        if (!d) return;
        setRates(d.rates);
        setUsingDefaults(d.usingDefaults);
        setMaterials({
          door: d.doorMaterials || {},
          box: d.boxMaterials || {},
        });
      })
      .finally(() => setLoading(false));
  }, []);

  function set(key, value) {
    setRates((r) => ({ ...r, [key]: value }));
    setSaved(false);
  }
  function setMult(group, key, value) {
    setRates((r) => ({ ...r, [group]: { ...r[group], [key]: value } }));
    setSaved(false);
  }

  async function save() {
    setSaving(true);
    try {
      const res = await fetch("/api/settings/cabinet-rates", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rates }),
      });
      if (!res.ok) {
        await reportResponseError(
          res,
          t("app.setCabinetRates.saveError", "Couldn't save your pricing."),
        );
        return;
      }
      const d = await res.json();
      setRates(d.rates);
      setUsingDefaults(false);
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } finally {
      setSaving(false);
    }
  }

  async function reset() {
    setSaving(true);
    try {
      const res = await fetch("/api/settings/cabinet-rates", {
        method: "DELETE",
      });
      if (!res.ok) {
        await reportResponseError(
          res,
          t("app.setCabinetRates.resetError", "Couldn't reset your pricing."),
        );
        return;
      }
      const d = await res.json();
      setRates(d.rates);
      setUsingDefaults(true);
    } finally {
      setSaving(false);
    }
  }

  if (loading || !rates) {
    return (
      <div className="max-w-4xl p-4 sm:p-6 space-y-4 animate-pulse">
        <div className="h-8 bg-accent rounded w-1/3" />
        <div className="h-48 bg-accent rounded-xl" />
        <div className="h-48 bg-accent rounded-xl" />
      </div>
    );
  }

  const perLf = rates.cabinetPricingMode === "perLinearFt";

  return (
    <div className="max-w-4xl p-4 sm:p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">
          {t("app.setCabinetRates.title", "Cabinet pricing")}
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          {t(
            "app.setCabinetRates.subtitle",
            "What the kitchen designer charges for cabinetry. Every quote is priced from these on the server, so changing them here changes what new designs cost — it does not touch quotes you've already sent.",
          )}
        </p>
      </div>

      {/* ── Said out loud, not implied ─────────────────────────────────────
          The starting rates are one real cabinet maker's real prices. They look
          entirely plausible, which is the problem: a shop could quote a dozen
          kitchens at someone else's numbers without ever noticing they hadn't
          set their own. */}
      {usingDefaults && (
        <div className="rounded-xl border border-amber-300 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/40 px-4 py-3 flex gap-3">
          <Info
            size={17}
            className="text-amber-700 dark:text-amber-400 shrink-0 mt-0.5"
          />
          <p className="text-sm text-amber-900 dark:text-amber-200">
            <strong>
              {t(
                "app.setCabinetRates.warnStrong",
                "These are starting rates, not yours.",
              )}
            </strong>{" "}
            {t(
              "app.setCabinetRates.warnBody",
              "They came from a working cabinet shop and are here so the designer prices something sensible on day one. Set your own before you send a kitchen quote — they are believable enough to go out unnoticed.",
            )}
          </p>
        </div>
      )}

      <Card
        title={t("app.setCabinetRates.modeTitle", "How you price a cabinet")}
        blurb={t(
          "app.setCabinetRates.modeBlurb",
          "Per linear foot is how custom shops quote: a width, a tier rate, and finishing and install bundled in. Cost-plus builds up from box material and adds install separately.",
        )}
      >
        <div className="sm:col-span-2 lg:col-span-3 flex flex-wrap gap-2">
          {[
            [
              "perLinearFt",
              t("app.setCabinetRates.modePerLf", "Per linear foot"),
            ],
            [
              "material",
              t("app.setCabinetRates.modeMaterial", "Material cost-plus"),
            ],
          ].map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => set("cabinetPricingMode", key)}
              className={`px-4 py-2 rounded-full border text-sm ${
                rates.cabinetPricingMode === key
                  ? "border-inverted bg-inverted text-inverted-foreground"
                  : "border-border text-foreground hover:bg-muted"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </Card>

      {perLf ? (
        <Card
          title={t("app.setCabinetRates.lfTitle", "Rates per linear foot")}
          blurb={t(
            "app.setCabinetRates.lfBlurb",
            "Each cabinet is its width in feet × the rate for its tier, adjusted for the door and box material.",
          )}
        >
          <Rate
            label={t("app.setCabinetRates.base", "Base")}
            value={rates.lfBase}
            onChange={(v) => set("lfBase", v)}
            suffix={t("app.setCabinetRates.perLf", "/ lf")}
          />
          <Rate
            label={t("app.setCabinetRates.wallUpper", "Wall / upper")}
            value={rates.lfUpper}
            onChange={(v) => set("lfUpper", v)}
            suffix={t("app.setCabinetRates.perLf", "/ lf")}
          />
          <Rate
            label={t("app.setCabinetRates.tallPantry", "Tall / pantry")}
            value={rates.lfTall}
            onChange={(v) => set("lfTall", v)}
            suffix={t("app.setCabinetRates.perLf", "/ lf")}
          />
          <Rate
            label={t("app.setCabinetRates.island", "Island")}
            value={rates.lfIsland}
            onChange={(v) => set("lfIsland", v)}
            suffix={t("app.setCabinetRates.perLf", "/ lf")}
          />
          <Rate
            label={t("app.setCabinetRates.drawerSurcharge", "Drawer surcharge")}
            value={rates.drawerSurcharge}
            onChange={(v) => set("drawerSurcharge", v)}
            suffix={t("app.setCabinetRates.perDrawer", "/ drawer")}
            hint={t(
              "app.setCabinetRates.drawerHint",
              "A multi-drawer box costs more to build than a door box of the same width.",
            )}
          />
          {/* Optional. Blank means the box bills at the kitchen tier it
              belongs to — a hanging section as a tall, a drawer bank as a
              base — which is what a closet is. Filling one in detaches those
              boxes and nothing else, and clearing it puts them back to
              inheriting rather than pinning them to today's number. */}
          <Rate
            label={t("app.setCabinetRates.closet", "Closet casework")}
            value={rates.lfCloset}
            onChange={(v) => set("lfCloset", v)}
            suffix={t("app.setCabinetRates.perLf", "/ lf")}
            hint={t("app.setCabinetRates.closetHint", {
              // Values, not a built sentence: the rates move, so the catalogue
              // keeps one translatable string with {placeholders} in it rather
              // than the page assembling French out of English word order.
              tall: Number(rates.lfTall) || 0,
              base: Number(rates.lfBase) || 0,
            })}
          />
          <Rate
            label={t(
              "app.setCabinetRates.vanity",
              "Vanity / laundry sink base",
            )}
            value={rates.lfVanity}
            onChange={(v) => set("lfVanity", v)}
            suffix={t("app.setCabinetRates.perLf", "/ lf")}
            hint={t("app.setCabinetRates.vanityHint", {
              base: Number(rates.lfBase) || 0,
            })}
          />

          <label className="flex items-start gap-2.5 text-sm text-foreground">
            <input
              type="checkbox"
              checked={rates.installIncludedInLf !== false}
              onChange={(e) => set("installIncludedInLf", e.target.checked)}
              className="mt-0.5"
            />
            <span>
              {t(
                "app.setCabinetRates.installIncluded",
                "Install is included in the rate",
              )}
              <span className="block text-xs text-muted-foreground mt-0.5">
                {t(
                  "app.setCabinetRates.installIncludedHint",
                  "Off adds a separate installation line to the quote.",
                )}
              </span>
            </span>
          </label>
        </Card>
      ) : (
        <Card
          title={t("app.setCabinetRates.cpTitle", "Cost-plus")}
          blurb={t(
            "app.setCabinetRates.cpBlurb",
            "Box cost is an intercept plus a per-inch figure, then marked up. Install is billed separately.",
          )}
        >
          {["base", "wall", "tall", "island"].map((tier) => (
            <div key={tier} className="space-y-3">
              <Rate
                label={t(
                  "app.setCabinetRates.tierBaseCost",
                  "{tier} — base cost",
                  { tier: `${tier[0].toUpperCase()}${tier.slice(1)}` },
                )}
                value={rates[tier]?.intercept}
                onChange={(v) =>
                  setRates((r) => ({
                    ...r,
                    [tier]: { ...r[tier], intercept: v },
                  }))
                }
              />
              <Rate
                label={t(
                  "app.setCabinetRates.tierPerInch",
                  "{tier} — per inch",
                  { tier: `${tier[0].toUpperCase()}${tier.slice(1)}` },
                )}
                value={rates[tier]?.perIn}
                onChange={(v) =>
                  setRates((r) => ({ ...r, [tier]: { ...r[tier], perIn: v } }))
                }
                step={0.1}
              />
            </div>
          ))}
          <Rate
            label={t("app.setCabinetRates.markup", "Markup")}
            value={rates.materialMarkup}
            onChange={(v) => set("materialMarkup", v)}
            prefix="×"
            step={0.01}
            hint={t(
              "app.setCabinetRates.markupHint",
              "0.18 = an 18% markup on material.",
            )}
          />
          <Rate
            label={t("app.setCabinetRates.installPerBox", "Install per box")}
            value={rates.installPerBox}
            onChange={(v) => set("installPerBox", v)}
          />
          <Rate
            label={t(
              "app.setCabinetRates.installPerLf",
              "Install per linear ft",
            )}
            value={rates.installPerLinearFt}
            onChange={(v) => set("installPerLinearFt", v)}
            suffix={t("app.setCabinetRates.perLf", "/ lf")}
          />
        </Card>
      )}

      <Card
        title={t("app.setCabinetRates.matTitle", "Material multipliers")}
        blurb={t(
          "app.setCabinetRates.matBlurb",
          "Applied to the cabinet price. 1.0 is your baseline; 1.4 means white oak costs 40% more than that baseline.",
        )}
      >
        {Object.entries(materials.door).map(([key, m]) => (
          <Rate
            key={key}
            label={m.label}
            value={rates.doorMaterialMult?.[key]}
            onChange={(v) => setMult("doorMaterialMult", key, v)}
            prefix="×"
            step={0.01}
          />
        ))}
        {Object.entries(materials.box).map(([key, m]) => (
          <Rate
            key={key}
            label={m.label}
            value={rates.boxMaterialMult?.[key]}
            onChange={(v) => setMult("boxMaterialMult", key, v)}
            prefix="×"
            step={0.01}
          />
        ))}
        <Rate
          label={t("app.setCabinetRates.cornerPremium", "Corner premium")}
          value={rates.cornerPremium}
          onChange={(v) => set("cornerPremium", v)}
          prefix="×"
          step={0.01}
          hint={t(
            "app.setCabinetRates.cornerHint",
            "Corner boxes are more work than their width suggests.",
          )}
        />
      </Card>

      <Card
        title={t(
          "app.setCabinetRates.finTitle",
          "Finishing, delivery and tear-out",
        )}
        blurb={t(
          "app.setCabinetRates.finBlurb",
          "Charged per piece and per box, and switched on or off per design in the designer.",
        )}
      >
        <Rate
          label={t("app.setCabinetRates.refinishDoor", "Finishing — per door")}
          value={rates.refinishPerDoor}
          onChange={(v) => set("refinishPerDoor", v)}
        />
        <Rate
          label={t(
            "app.setCabinetRates.refinishDrawer",
            "Finishing — per drawer front",
          )}
          value={rates.refinishPerDrawer}
          onChange={(v) => set("refinishPerDrawer", v)}
        />
        <Rate
          label={t("app.setCabinetRates.delivery", "Delivery")}
          value={rates.deliveryFlat}
          onChange={(v) => set("deliveryFlat", v)}
          suffix={t("app.setCabinetRates.flat", "flat")}
        />
        <Rate
          label={t("app.setCabinetRates.removal", "Remove old cabinetry")}
          value={rates.removalPerBox}
          onChange={(v) => set("removalPerBox", v)}
          suffix={t("app.setCabinetRates.perBox", "/ box")}
        />
      </Card>

      <div className="flex flex-wrap items-center gap-3 pb-2">
        <button
          type="button"
          onClick={save}
          disabled={saving}
          className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-lg bg-inverted text-inverted-foreground text-sm font-semibold disabled:opacity-50"
        >
          {saving ? (
            <Loader2 size={15} className="animate-spin" />
          ) : saved ? (
            <Check size={15} />
          ) : null}
          {saving
            ? t("app.action.saving", "Saving…")
            : saved
              ? t("app.action.saved", "Saved")
              : t("app.setCabinetRates.savePricing", "Save pricing")}
        </button>
        {!usingDefaults && (
          <button
            type="button"
            onClick={reset}
            disabled={saving}
            className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-lg border border-border text-sm text-foreground hover:bg-muted disabled:opacity-50"
          >
            <RotateCcw size={14} />{" "}
            {t(
              "app.setCabinetRates.backToStarting",
              "Back to the starting rates",
            )}
          </button>
        )}
      </div>
    </div>
  );
}
