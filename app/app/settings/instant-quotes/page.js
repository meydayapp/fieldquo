// app/app/settings/instant-quotes/page.js
//
// The company's instant-estimate rate card. Each wired trade is a card: a
// toggle, editable material sell rates, the surcharge knobs the estimate
// applies, a minimum charge and a range band. Saving a trade is what makes its
// public "instant quote" appear — until then it's off, so there's never a
// live button pricing off numbers nobody chose.
//
// Reads AND writes the same config the estimator prices off
// (lib/estimate/instantEstimate.js), so what the owner sees here is exactly
// what a homeowner is quoted.
"use client";

import { useEffect, useState } from "react";
import { Loader2, Plus, Trash2, Zap } from "lucide-react";
import { fetchJson } from "@/lib/fetchJson";
import { showError } from "@/lib/clientErrors";
import JunkGuidance from "@/app/components/settings/JunkGuidance";

// How each trade measures — copy shown to the owner so they know what the
// homeowner will be asked for.
const MEASURE_COPY = {
  roof_address: "Roof measured automatically from the address (Google satellite).",
  lawn_polygon: "Homeowner traces the lawn on a satellite map; area computed from the outline.",
  manual_area: "Homeowner enters the area and picks options.",
  manual_units: "Homeowner enters counts (doors, drawers).",
  item_picker: "Homeowner picks the items to remove; priced by volume with a built-in load discount.",
};

function money(n) {
  return Number(n) || 0;
}

// A labelled number input that keeps an empty string editable (so a field can
// be cleared without snapping to 0 mid-type).
function NumField({ label, value, onChange, prefix, suffix, step = "1", width = "w-28" }) {
  return (
    <label className="flex flex-col gap-1">
      {label && <span className="text-xs text-muted-foreground">{label}</span>}
      <span className="flex items-center gap-1">
        {prefix && <span className="text-sm text-muted-foreground">{prefix}</span>}
        <input
          type="number"
          step={step}
          value={value ?? ""}
          onChange={(e) => onChange(e.target.value === "" ? "" : Number(e.target.value))}
          className={`${width} rounded-lg border border-border bg-background px-2 py-1.5 text-sm`}
        />
        {suffix && <span className="text-sm text-muted-foreground">{suffix}</span>}
      </span>
    </label>
  );
}

// Editable surcharge map ({ good:0, fair:0.12, ... }) shown as whole percents.
function PercentMap({ title, map, onChange }) {
  if (!map) return null;
  return (
    <div>
      <div className="text-sm font-medium text-foreground mb-2">{title}</div>
      <div className="flex flex-wrap gap-3">
        {Object.entries(map).map(([key, pct]) => (
          <NumField
            key={key}
            label={key.replace(/_/g, " ")}
            value={Math.round((Number(pct) || 0) * 100)}
            suffix="%"
            width="w-20"
            onChange={(v) => onChange({ ...map, [key]: (v === "" ? 0 : v) / 100 })}
          />
        ))}
      </div>
    </div>
  );
}

function TradeCard({ trade, canEdit, onSaved }) {
  const [enabled, setEnabled] = useState(trade.enabled);
  const [config, setConfig] = useState(trade.config || {});
  const [saving, setSaving] = useState(false);
  const [savedNote, setSavedNote] = useState("");

  const rateKey = trade.trade === "roofing" ? "ratePerSquare" : "ratePerSqft";
  const rateSuffix = trade.trade === "roofing" ? "/ square" : "/ sqft";

  function patch(next) {
    setConfig((c) => ({ ...c, ...next }));
  }

  async function save() {
    setSaving(true);
    setSavedNote("");
    try {
      await fetchJson("/api/settings/instant-quote", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ trade: trade.trade, enabled, config }),
      });
      setSavedNote("Saved");
      onSaved?.();
    } catch (err) {
      // Server refuses to enable an unpriced trade; surface its message.
      showError(err.message || "Could not save");
      setEnabled(trade.enabled); // roll the toggle back to the known-good state
    } finally {
      setSaving(false);
    }
  }

  const materials = Array.isArray(config.materials) ? config.materials : [];

  // Junk rates are stored in CENTS (priceJunk's unit); the form shows dollars.
  const rates = config.rates || {};
  const centsToDollars = (c) => (Number(c) > 0 ? Math.round(Number(c) / 100) : "");
  const dollarsToCents = (d) => (d === "" || d == null ? 0 : Math.round(Number(d) * 100));
  const setRate = (field, dollars) =>
    patch({ rates: { ...rates, [field]: dollarsToCents(dollars) } });
  const setLoad = (tier, dollars) =>
    patch({ rates: { ...rates, loadCents: { ...(rates.loadCents || {}), [tier]: dollarsToCents(dollars) } } });

  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="text-base font-semibold text-foreground">{trade.label}</h3>
          <p className="text-xs text-muted-foreground mt-1 max-w-md">
            {MEASURE_COPY[trade.measure]}
          </p>
        </div>
        <label className="flex items-center gap-2 shrink-0">
          <span className="text-sm text-muted-foreground">
            {enabled ? "On" : "Off"}
          </span>
          <input
            type="checkbox"
            checked={enabled}
            disabled={!canEdit}
            onChange={(e) => setEnabled(e.target.checked)}
            className="h-5 w-5 accent-[var(--brand,#06356b)]"
          />
        </label>
      </div>

      {trade.isDefaults && (
        <p className="mt-3 text-xs rounded-lg bg-amber-50 text-amber-800 border border-amber-200 px-3 py-2">
          These are typical starting figures, not your prices. Edit them to your
          market, then save — nothing is offered to homeowners until you do.
        </p>
      )}

      <div className="mt-4 space-y-5">
        {/* ── What the homeowner sees ──────────────────────────────────────
            Per trade, because a cabinet shop is happy to flash a range and a
            GC never is. Defaults to "don't show" — a company opts INTO
            revealing a number. */}
        <div>
          <div className="text-sm font-medium text-foreground mb-2">
            What the homeowner sees
          </div>
          <div className="flex flex-col gap-2">
            {[
              { key: "gated", label: "Don't show a price", hint: "They submit and we say a quote is on the way." },
              { key: "range", label: "Show an estimated range", hint: "A range instantly; exact price after you review. Converts better." },
            ].map((opt) => {
              const current = (config.estimateVisibility || "gated") === opt.key;
              return (
                <button
                  key={opt.key}
                  type="button"
                  onClick={() => patch({ estimateVisibility: opt.key })}
                  className={`text-left rounded-lg border px-3 py-2 transition-colors ${
                    current
                      ? "border-foreground bg-inverted/5"
                      : "border-border hover:bg-muted"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span
                      className={`h-3.5 w-3.5 rounded-full border-2 ${
                        current ? "border-foreground bg-foreground" : "border-muted-foreground"
                      }`}
                    />
                    <span className="text-sm font-medium text-foreground">{opt.label}</span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5 ml-5.5">{opt.hint}</p>
                </button>
              );
            })}
          </div>
        </div>

        {/* Material sell rates */}
        {trade.hasMaterials && trade.trade !== "cabinet_refacing" && (
          <div>
            <div className="text-sm font-medium text-foreground mb-2">
              Materials &amp; sell rates
            </div>
            <div className="space-y-2">
              {materials.map((m, i) => (
                <div key={i} className="flex items-center gap-2">
                  <input
                    value={m.label ?? ""}
                    onChange={(e) => {
                      const next = [...materials];
                      next[i] = { ...m, label: e.target.value };
                      patch({ materials: next });
                    }}
                    placeholder="Material name"
                    className="flex-1 min-w-0 rounded-lg border border-border bg-background px-2 py-1.5 text-sm"
                  />
                  <span className="text-sm text-muted-foreground">$</span>
                  <input
                    type="number"
                    step="1"
                    value={m[rateKey] ?? ""}
                    onChange={(e) => {
                      const next = [...materials];
                      next[i] = { ...m, [rateKey]: e.target.value === "" ? "" : Number(e.target.value) };
                      patch({ materials: next });
                    }}
                    className="w-24 rounded-lg border border-border bg-background px-2 py-1.5 text-sm"
                  />
                  <span className="text-xs text-muted-foreground whitespace-nowrap">{rateSuffix}</span>
                  <button
                    type="button"
                    onClick={() => patch({ materials: materials.filter((_, j) => j !== i) })}
                    className="text-muted-foreground hover:text-red-600 p-1"
                    aria-label="Remove material"
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              ))}
            </div>
            <button
              type="button"
              onClick={() =>
                patch({
                  materials: [
                    ...materials,
                    { key: `custom_${materials.length}`, label: "", [rateKey]: "" },
                  ],
                })
              }
              className="mt-2 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
            >
              <Plus size={14} /> Add material
            </button>
          </div>
        )}

        {/* Cabinet refacing unit prices */}
        {trade.trade === "cabinet_refacing" && (
          <div className="flex flex-wrap gap-4">
            <NumField label="Per door" prefix="$" value={config.perDoor} onChange={(v) => patch({ perDoor: v })} />
            <NumField label="Per drawer" prefix="$" value={config.perDrawer} onChange={(v) => patch({ perDrawer: v })} />
            <NumField label="Per box linear ft" prefix="$" value={config.perBoxLinearFt} onChange={(v) => patch({ perBoxLinearFt: v })} />
          </div>
        )}

        {/* Lawn size tiers */}
        {trade.trade === "lawn_mowing" && (
          <div>
            <div className="text-sm font-medium text-foreground mb-2">Per-visit price by lot size</div>
            <div className="space-y-2">
              {(config.tiers || []).map((t, i) => (
                <div key={i} className="flex items-center gap-2 text-sm">
                  <span className="text-muted-foreground">up to</span>
                  <input
                    type="number"
                    value={t.maxSqft ?? ""}
                    onChange={(e) => {
                      const next = [...config.tiers];
                      next[i] = { ...t, maxSqft: e.target.value === "" ? "" : Number(e.target.value) };
                      patch({ tiers: next });
                    }}
                    className="w-28 rounded-lg border border-border bg-background px-2 py-1.5"
                  />
                  <span className="text-muted-foreground">sqft →</span>
                  <span className="text-muted-foreground">$</span>
                  <input
                    type="number"
                    value={t.pricePerVisit ?? ""}
                    onChange={(e) => {
                      const next = [...config.tiers];
                      next[i] = { ...t, pricePerVisit: e.target.value === "" ? "" : Number(e.target.value) };
                      patch({ tiers: next });
                    }}
                    className="w-24 rounded-lg border border-border bg-background px-2 py-1.5"
                  />
                  <span className="text-muted-foreground">/ visit</span>
                </div>
              ))}
            </div>
            <div className="mt-2">
              <NumField label="Each extra acre over the top tier" prefix="$" width="w-24" value={config.pricePerAcreOver} onChange={(v) => patch({ pricePerAcreOver: v })} />
            </div>
          </div>
        )}

        {/* Surcharge maps per trade */}
        {trade.trade === "roofing" && (
          <PercentMap title="Steep-pitch surcharge" map={config.steepnessSurcharge} onChange={(m) => patch({ steepnessSurcharge: m })} />
        )}
        {trade.trade === "roofing" && (
          <NumField label="Tear-off per square, per existing layer" prefix="$" width="w-24" value={config.tearOffPerSquarePerLayer} onChange={(v) => patch({ tearOffPerSquarePerLayer: v })} />
        )}
        {trade.trade === "epoxy" && (
          <PercentMap title="Surface-prep surcharge" map={config.prepSurcharge} onChange={(m) => patch({ prepSurcharge: m })} />
        )}
        {trade.trade === "parging" && (
          <>
            <PercentMap title="Access surcharge" map={config.accessSurcharge} onChange={(m) => patch({ accessSurcharge: m })} />
            <PercentMap title="Condition surcharge" map={config.conditionSurcharge} onChange={(m) => patch({ conditionSurcharge: m })} />
          </>
        )}
        {trade.trade === "countertop" && (
          <div>
            <div className="text-sm font-medium text-foreground mb-2">Extras (added on top of the material rate)</div>
            <div className="flex flex-wrap gap-4">
              <NumField label="Upgraded edge, per ft" prefix="$" value={config.edgePerFt} onChange={(v) => patch({ edgePerFt: v })} />
              <NumField label="Per cutout (sink/cooktop)" prefix="$" value={config.cutoutFee} onChange={(v) => patch({ cutoutFee: v })} />
              <NumField label="Backsplash, per sqft" prefix="$" value={config.backsplashPerSqft} onChange={(v) => patch({ backsplashPerSqft: v })} />
            </div>
          </div>
        )}

        {/* Junk removal rate card — the whole cost model in one place.
            Priced by VOLUME (a load discount is built in: the per-item price
            falls as the truck fills), plus the recycling fees that eat the
            margin and the access surcharges that are real labour. */}
        {trade.trade === "junk_removal" && (
          <div className="space-y-4">
            <div>
              <div className="text-sm font-medium text-foreground mb-2">The load (what a truckful costs)</div>
              <div className="flex flex-wrap gap-4">
                <NumField label="One-item / min trip" prefix="$" value={centsToDollars(rates.loadCents?.minimum)} onChange={(v) => setLoad("minimum", v)} />
                <NumField label="Quarter load" prefix="$" value={centsToDollars(rates.loadCents?.quarter)} onChange={(v) => setLoad("quarter", v)} />
                <NumField label="Half load" prefix="$" value={centsToDollars(rates.loadCents?.half)} onChange={(v) => setLoad("half", v)} />
                <NumField label="Full truck" prefix="$" value={centsToDollars(rates.loadCents?.full)} onChange={(v) => setLoad("full", v)} />
                <NumField label="Volume units in a full truck" value={rates.fullLoadUnits} onChange={(v) => patch({ rates: { ...rates, fullLoadUnits: v === "" ? 1 : Number(v) } })} />
              </div>
            </div>

            <div>
              <div className="text-sm font-medium text-foreground mb-2">Recycling &amp; disposal fees (what the depot charges you)</div>
              <div className="flex flex-wrap gap-4">
                <NumField label="Fridge / AC (Freon)" prefix="$" value={centsToDollars(rates.refrigerantFeeCents)} onChange={(v) => setRate("refrigerantFeeCents", v)} />
                <NumField label="TV / electronics" prefix="$" value={centsToDollars(rates.ewasteFeeCents)} onChange={(v) => setRate("ewasteFeeCents", v)} />
                <NumField label="Mattress" prefix="$" value={centsToDollars(rates.mattressFeeCents)} onChange={(v) => setRate("mattressFeeCents", v)} />
                <NumField label="Per tire" prefix="$" value={centsToDollars(rates.tirePerUnitCents)} onChange={(v) => setRate("tirePerUnitCents", v)} />
                <NumField label="Heavy debris, per truck-bed" prefix="$" value={centsToDollars(rates.heavyPerLoadCents)} onChange={(v) => setRate("heavyPerLoadCents", v)} />
              </div>
            </div>

            <div>
              <div className="text-sm font-medium text-foreground mb-2">Access surcharges (real labour)</div>
              <div className="flex flex-wrap gap-4">
                <NumField label="Per flight of stairs" prefix="$" value={centsToDollars(rates.stairsPerFlightCents)} onChange={(v) => setRate("stairsPerFlightCents", v)} />
                <NumField label="Disassembly" prefix="$" value={centsToDollars(rates.disassemblyCents)} onChange={(v) => setRate("disassemblyCents", v)} />
                <NumField label="Small demolition" prefix="$" value={centsToDollars(rates.demolitionCents)} onChange={(v) => setRate("demolitionCents", v)} />
                <NumField label="Long carry" prefix="$" value={centsToDollars(rates.longCarryCents)} onChange={(v) => setRate("longCarryCents", v)} />
                <NumField label="No elevator" prefix="$" value={centsToDollars(rates.noElevatorCents)} onChange={(v) => setRate("noElevatorCents", v)} />
                <NumField label="Out of free area" prefix="$" value={centsToDollars(rates.outOfAreaCents)} onChange={(v) => setRate("outOfAreaCents", v)} />
              </div>
            </div>

            <NumField label="Minimum charge" prefix="$" value={centsToDollars(rates.minimumCents)} onChange={(v) => setRate("minimumCents", v)} />

            <JunkGuidance />
          </div>
        )}

        {/* Shared knobs */}
        <div className="flex flex-wrap gap-4 pt-1">
          <NumField
            label="Range width (±)"
            suffix="%"
            width="w-20"
            value={Math.round((Number(config.rangeBandPct) || 0) * 100)}
            onChange={(v) => patch({ rangeBandPct: (v === "" ? 0 : v) / 100 })}
          />
          {/* Junk's minimum lives in its own rate card (in cents); the shared
              dollar minCharge would be a second, conflicting control. */}
          {trade.trade !== "junk_removal" && (
            <NumField label="Minimum charge" prefix="$" value={config.minCharge} onChange={(v) => patch({ minCharge: v })} />
          )}
        </div>
      </div>

      <div className="mt-5 flex items-center gap-3">
        <button
          type="button"
          onClick={save}
          disabled={!canEdit || saving}
          className="inline-flex items-center gap-2 rounded-lg bg-inverted text-inverted-foreground px-4 py-2 text-sm font-medium disabled:opacity-50"
        >
          {saving && <Loader2 size={15} className="animate-spin" />}
          {enabled ? "Save & enable" : "Save"}
        </button>
        {savedNote && <span className="text-sm text-green-600">{savedNote}</span>}
        {!canEdit && (
          <span className="text-xs text-muted-foreground">
            Only an owner or admin can edit pricing.
          </span>
        )}
      </div>
    </div>
  );
}

export default function InstantQuotesSettingsPage() {
  const [trades, setTrades] = useState(null);
  const [canEdit, setCanEdit] = useState(false);
  const [financing, setFinancing] = useState(null);
  const [error, setError] = useState("");

  async function load() {
    try {
      const data = await fetchJson("/api/settings/instant-quote");
      setTrades(data.trades);
      setCanEdit(Boolean(data.canEdit));
      setFinancing(data.financing || { enabled: false });
    } catch (err) {
      setError(err.message || "Could not load instant-quote settings");
    }
  }

  useEffect(() => {
    load();
  }, []);

  return (
    <div className="max-w-3xl px-4 sm:px-6 py-6 sm:py-8">
      <div className="flex items-center gap-2 mb-1">
        <Zap size={20} className="text-foreground" />
        <h1 className="text-2xl font-bold text-foreground">Instant Quotes</h1>
      </div>
      <p className="text-sm text-muted-foreground mb-6 max-w-xl">
        Let homeowners get a real starting estimate from your website in
        seconds — roof measured from their address, or an area they trace on a
        map. Every estimate is a range they can request, and lands in your
        review queue before anything is binding.
      </p>

      {error && (
        <p className="text-sm rounded-lg bg-red-50 text-red-700 border border-red-200 px-3 py-2 mb-4">
          {error}
        </p>
      )}

      {!trades && !error && (
        <div className="flex items-center gap-2 text-muted-foreground text-sm">
          <Loader2 size={16} className="animate-spin" /> Loading…
        </div>
      )}

      <div className="space-y-4">
        {trades?.map((t) => (
          <TradeCard key={t.trade} trade={t} canEdit={canEdit} onSaved={load} />
        ))}
      </div>

      {financing && (
        <FinancingCard financing={financing} canEdit={canEdit} onSaved={load} />
      )}
    </div>
  );
}

/**
 * Company-wide financing offer shown on estimates.
 *
 * FieldQuo computes NO monthly payment — it doesn't provide financing. This is
 * either the company's own "ask us" wording, or a link to a real provider that
 * quotes the terms itself. Off by default. See lib/estimate/financing.js.
 */
function FinancingCard({ financing, canEdit, onSaved }) {
  const [enabled, setEnabled] = useState(Boolean(financing.enabled));
  const [note, setNote] = useState(financing.note || "");
  const [url, setUrl] = useState(financing.url || "");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  async function save() {
    setSaving(true);
    setSaved(false);
    try {
      await fetchJson("/api/settings/instant-quote", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ financing: { enabled, note, url } }),
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
      onSaved?.();
    } catch (err) {
      alert(err.message || "Couldn't save financing.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="mt-4 rounded-xl border border-border bg-card p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-base font-semibold text-foreground">Financing</h3>
          <p className="text-xs text-muted-foreground mt-1 max-w-md">
            Optional. FieldQuo doesn&apos;t provide financing and never shows a
            monthly figure — this just lets homeowners know it&apos;s available,
            in your words or via your provider.
          </p>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={enabled}
          disabled={!canEdit}
          onClick={() => setEnabled((v) => !v)}
          className={`shrink-0 w-11 h-6 rounded-full transition-colors disabled:opacity-40 ${
            enabled ? "bg-emerald-600" : "bg-muted-foreground/30"
          }`}
        >
          <span className={`block w-5 h-5 rounded-full bg-white shadow transition-transform ${enabled ? "translate-x-5" : "translate-x-0.5"}`} />
        </button>
      </div>

      {enabled && (
        <div className="mt-4 space-y-3">
          <label className="block">
            <span className="text-sm text-foreground">What to tell the homeowner</span>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={2}
              maxLength={400}
              placeholder="e.g. We offer financing on approved credit — ask us for details."
              className="mt-1 w-full px-3 py-2 rounded-lg border border-border bg-background text-sm text-foreground resize-none"
            />
            <span className="text-xs text-muted-foreground">
              Your own wording — don&apos;t promise a rate or monthly amount you can&apos;t honour.
            </span>
          </label>

          <label className="block">
            <span className="text-sm text-foreground">Provider link (optional)</span>
            <input
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://… (Shop Pay, Affirm, your bank)"
              className="mt-1 w-full px-3 py-2 rounded-lg border border-border bg-background text-sm text-foreground"
            />
            <span className="text-xs text-muted-foreground">
              If set, homeowners get a button to your provider, who quotes the terms. Leave blank for &quot;ask us&quot;.
            </span>
          </label>
        </div>
      )}

      {canEdit && (
        <div className="mt-4 flex items-center gap-2">
          <button
            type="button"
            onClick={save}
            disabled={saving}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-inverted text-inverted-foreground text-sm font-semibold disabled:opacity-50"
          >
            {saving ? <Loader2 size={14} className="animate-spin" /> : null} Save
          </button>
          {saved && <span className="text-sm text-emerald-600 dark:text-emerald-400">Saved</span>}
        </div>
      )}
    </section>
  );
}
