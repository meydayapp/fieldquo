// app/components/jobs/EquipmentUseLog.js
//
// Which of the company's equipment was on this job, logged as fast as
// ticking a materials box — see app/api/jobs/[id]/asset-use/route.js for why
// this is gated the same way (jobs:view_only, not the asset register's
// stricter cost-basis gate): saying "the compressor came along today" is not
// the same act as editing what the compressor is worth.
//
// Deliberately does NOT show a dollar figure here — see
// lib/costing/actualJobCost.js's double-count note. The cost this equipment
// represents (if any lands on this job at all) shows on JobCosting's own
// panel, which is the one place that already knows whether the company's
// overhead is absorbing it.
"use client";

import { useCallback, useEffect, useState } from "react";
import { Wrench, Plus } from "lucide-react";
import { reportResponseError } from "@/lib/clientErrors";
import { useTranslation } from "@/app/hooks/useTranslation";

export default function EquipmentUseLog({ jobId }) {
  const { t, language } = useTranslation();
  const [data, setData] = useState(null);
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState({ assetId: "", usedOn: "", hours: "" });
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch(`/api/jobs/${jobId}/asset-use`);
    if (!res.ok) {
      setData({ logs: [], assets: [] });
      return;
    }
    setData(await res.json());
  }, [jobId]);

  useEffect(() => {
    load();
  }, [load]);

  async function submit(e) {
    e.preventDefault();
    if (!draft.assetId) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/jobs/${jobId}/asset-use`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          logs: [
            {
              assetId: draft.assetId,
              usedOn: draft.usedOn || undefined,
              hours: draft.hours === "" ? null : Number(draft.hours),
            },
          ],
        }),
      });
      if (!res.ok) {
        await reportResponseError(res, t("app.jobEquipment.error", "Couldn't log that."));
        return;
      }
      setDraft({ assetId: "", usedOn: "", hours: "" });
      setAdding(false);
      await load();
    } finally {
      setSaving(false);
    }
  }

  if (!data) return null;

  // No assets at all in the register — nothing to pick from, and the
  // register lives on a screen this member may not even see. Say nothing
  // rather than an empty picker that goes nowhere.
  if (data.assets.length === 0 && data.logs.length === 0) return null;

  return (
    <div className="bg-card border border-border rounded-xl p-4">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
          <Wrench size={15} />
          {t("app.jobEquipment.title", "Equipment used")}
        </h3>
        {!adding && data.assets.length > 0 && (
          <button
            type="button"
            onClick={() => setAdding(true)}
            className="text-xs font-semibold text-foreground flex items-center gap-1"
          >
            <Plus size={13} />
            {t("app.jobEquipment.add", "Log equipment")}
          </button>
        )}
      </div>

      {data.logs.length === 0 ? (
        <p className="text-xs text-muted-foreground">
          {t("app.jobEquipment.empty", "Nothing logged yet.")}
        </p>
      ) : (
        <ul className="space-y-1.5">
          {data.logs.map((log) => (
            <li key={log.id} className="flex items-center justify-between text-sm gap-2">
              <span className="text-foreground truncate">{log.asset?.name || "—"}</span>
              <span className="text-xs text-muted-foreground shrink-0">
                {new Date(log.usedOn).toLocaleDateString(language)}
                {log.hours != null && ` · ${log.hours}${t("app.jobEquipment.hoursShort", "h")}`}
              </span>
            </li>
          ))}
        </ul>
      )}

      {adding && (
        <form onSubmit={submit} className="mt-3 pt-3 border-t border-border grid grid-cols-2 gap-2">
          <select
            value={draft.assetId}
            onChange={(e) => setDraft({ ...draft, assetId: e.target.value })}
            className="col-span-2 border border-border rounded px-2 py-1.5 text-sm bg-background"
            required
          >
            <option value="">{t("app.jobEquipment.pickAsset", "Which piece of equipment")}</option>
            {data.assets.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>
          <input
            type="date"
            value={draft.usedOn}
            onChange={(e) => setDraft({ ...draft, usedOn: e.target.value })}
            className="border border-border rounded px-2 py-1.5 text-sm bg-background"
          />
          <input
            type="number"
            min="0"
            max="24"
            step="0.5"
            placeholder={t("app.jobEquipment.hoursOptional", "Hours (optional)")}
            value={draft.hours}
            onChange={(e) => setDraft({ ...draft, hours: e.target.value })}
            className="border border-border rounded px-2 py-1.5 text-sm bg-background"
          />
          <button
            type="submit"
            disabled={saving || !draft.assetId}
            className="bg-inverted text-inverted-foreground rounded px-3 py-1.5 text-xs font-semibold disabled:opacity-50"
          >
            {t("app.jobEquipment.save", "Log it")}
          </button>
          <button
            type="button"
            onClick={() => setAdding(false)}
            className="text-xs text-muted-foreground"
          >
            {t("app.jobEquipment.cancel", "Cancel")}
          </button>
        </form>
      )}
    </div>
  );
}
