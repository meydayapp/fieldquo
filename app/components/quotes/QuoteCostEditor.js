// app/components/quotes/QuoteCostEditor.js
//
// Cost a quote from the quote itself.
//
// ── Why this exists ─────────────────────────────────────────────────────────
//
// The cost panel lives in the BUILDER. Once a quote is saved there is no way
// back to it: the edit page has never had one. So a quote saved before costing
// was kept — every quote that predates QuoteCosting — showed "this quote's cost
// can't be worked out" above a "Cost it now" button that opened an editor with
// no cost panel in it. A dead end dressed as a remedy, which is worse than no
// button at all.
//
// This is the remedy made real. It writes the same QuoteCosting row the builder
// writes, through the same PATCH, and the server re-derives every figure from
// the quote's own scope groups — the browser sends inputs, never money.
//
// ── Why the inputs are only these four ──────────────────────────────────────
//
// Takeoff hours and the bill of materials come from the scope groups and are
// not editable here; changing those means changing the quote, which is the
// editor's job. What an estimator adds AFTER the takeoff is: who is doing it,
// hours the takeoff could not know about, materials bought outside the recipe,
// and the overhead basis. Those are exactly the four the builder collects.
"use client";

import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { reportResponseError } from "@/lib/clientErrors";

const inputClass =
  "w-full rounded border border-border bg-background px-2 py-1 text-sm";

const num = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0);

export default function QuoteCostEditor({ quoteId, existing, onSaved, t }) {
  // Seeded from whatever is already stored, so opening this on a costed quote
  // shows what was costed rather than an empty form inviting a re-type.
  const [crew, setCrew] = useState(() =>
    (existing?.crew || []).map((m) => ({
      name: m.name || "",
      rate: m.hourlyRate ?? "",
      // Only hours the estimator PINNED come back as an input. A resolved
      // share is an output — putting it in the box would turn "split the pool
      // evenly" into three hard-coded numbers the next save could not undo.
      hours: m.hoursExplicit ? (m.hours ?? "") : "",
    })),
  );
  const [addedLabourHours, setAddedLabourHours] = useState(
    existing?.addedLabourHours ?? "",
  );
  const [addedMaterialCost, setAddedMaterialCost] = useState(
    existing?.addedMaterialCost ?? "",
  );
  const [labourRate, setLabourRate] = useState(existing?.labourRate ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function save() {
    setSaving(true);
    setError("");
    try {
      const res = await fetch(`/api/quotes/${quoteId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        // Inputs only. Every total is re-derived server-side from the quote's
        // own scope groups — a browser cannot assert which price book applies.
        body: JSON.stringify({
          costing: {
            crew: crew
              .filter((m) => m.name.trim() || m.rate !== "" || m.hours !== "")
              .map((m) => ({
                name: m.name.trim(),
                rate: m.rate === "" ? null : num(m.rate),
                hours: m.hours === "" ? null : num(m.hours),
              })),
            addedLabourHours:
              addedLabourHours === "" ? 0 : num(addedLabourHours),
            addedMaterialCost:
              addedMaterialCost === "" ? 0 : num(addedMaterialCost),
            labourRate: labourRate === "" ? 0 : num(labourRate),
          },
        }),
      });
      if (!res.ok) {
        await reportResponseError(res).catch(() => {});
        setError(t("app.quoteDetail.costSaveError", "That didn't save."));
        return;
      }
      await onSaved();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="rounded-lg border border-border p-3">
      <p className="text-xs text-muted-foreground">
        {t(
          "app.quoteDetail.costEditorHint",
          "Who is doing the work, and anything the takeoff couldn't know. Hours and materials from the scope itself are worked out for you.",
        )}
      </p>

      <div className="mt-2 space-y-1.5">
        {crew.map((m, i) => (
          <div key={i} className="flex flex-wrap items-center gap-1.5">
            <input
              value={m.name}
              placeholder={t("app.quoteDetail.crewName", "Name")}
              onChange={(e) => {
                const next = [...crew];
                next[i] = { ...next[i], name: e.target.value };
                setCrew(next);
              }}
              className={`${inputClass} min-w-[8rem] flex-1`}
            />
            <input
              type="number"
              min="0"
              step="0.01"
              value={m.rate}
              placeholder={t("app.quoteDetail.crewRate", "$/hr")}
              onChange={(e) => {
                const next = [...crew];
                next[i] = { ...next[i], rate: e.target.value };
                setCrew(next);
              }}
              className={`${inputClass} w-24`}
            />
            <input
              type="number"
              min="0"
              step="0.25"
              value={m.hours}
              placeholder={t("app.quoteDetail.crewHours", "hrs (optional)")}
              onChange={(e) => {
                const next = [...crew];
                next[i] = { ...next[i], hours: e.target.value };
                setCrew(next);
              }}
              className={`${inputClass} w-32`}
            />
            <button
              type="button"
              onClick={() => setCrew(crew.filter((_, j) => j !== i))}
              aria-label={t("app.action.delete", "Remove")}
              className="text-muted-foreground hover:text-red-600"
            >
              <Trash2 size={14} />
            </button>
          </div>
        ))}
      </div>

      <button
        type="button"
        onClick={() => setCrew([...crew, { name: "", rate: "", hours: "" }])}
        className="mt-1.5 flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
      >
        <Plus size={13} />{" "}
        {t("app.quoteDetail.addCrew", "Add someone to the crew")}
      </button>

      {/* Leaving every crew rate blank is a real state — a solo operator who
          has not set a rate — so a fallback rate is offered rather than the
          panel silently costing their labour at nothing. */}
      <div className="mt-3 grid gap-2 sm:grid-cols-3">
        <label className="text-xs text-muted-foreground">
          {t("app.quoteDetail.fallbackRate", "Rate if nobody above has one")}
          <input
            type="number"
            min="0"
            step="0.01"
            value={labourRate}
            onChange={(e) => setLabourRate(e.target.value)}
            className={`${inputClass} mt-0.5`}
          />
        </label>
        <label className="text-xs text-muted-foreground">
          {t("app.quoteDetail.extraHours", "Extra hours")}
          <input
            type="number"
            min="0"
            step="0.25"
            value={addedLabourHours}
            onChange={(e) => setAddedLabourHours(e.target.value)}
            className={`${inputClass} mt-0.5`}
          />
        </label>
        <label className="text-xs text-muted-foreground">
          {t("app.quoteDetail.extraMaterials", "Extra materials $")}
          <input
            type="number"
            min="0"
            step="0.01"
            value={addedMaterialCost}
            onChange={(e) => setAddedMaterialCost(e.target.value)}
            className={`${inputClass} mt-0.5`}
          />
        </label>
      </div>

      <button
        type="button"
        onClick={save}
        disabled={saving}
        className="mt-3 rounded-full bg-foreground px-4 py-1.5 text-sm font-semibold text-background disabled:opacity-50"
      >
        {saving
          ? t("app.state.saving", "Saving…")
          : t("app.quoteDetail.saveCosting", "Save the costing")}
      </button>

      {error && (
        <p className="mt-2 text-xs text-red-600 dark:text-red-400">{error}</p>
      )}
    </div>
  );
}
