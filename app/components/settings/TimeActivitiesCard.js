// app/components/settings/TimeActivitiesCard.js
//
// The time clock's activity tiles: which ones the crew see, what this
// company calls them, and which are paid. Beside the pay cycle on the
// payroll settings page, because "is a drive paid" is the same kind of
// decision as "when do we pay" — and made by the same two seats (owner,
// admin; PATCH /api/settings/time-activities refuses everyone else, and this
// card shows them the policy read-only rather than controls that would not
// save).
//
// Every control here is read back: the tiles on /app/clock are drawn from
// the same resolved policy (GET /api/time-clock `activities`), the server
// refuses a switched-off tile, and `paid` is stamped on each entry when it
// opens (TimeEntry.paid) — the note under the table says that a change
// applies from the next tap, because a setting that silently re-priced last
// week would be the worse surprise.
"use client";

import { useEffect, useState } from "react";
import { fetchJson } from "@/lib/fetchJson";
import { useTranslation } from "@/app/hooks/useTranslation";
import { LABEL_MAX } from "@/lib/timeclock/activities";
import { activityIcon } from "@/app/components/timeclock/activityUi";

export default function TimeActivitiesCard() {
  const { t } = useTranslation();
  const [data, setData] = useState(null);
  const [loadError, setLoadError] = useState("");
  const [draft, setDraft] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    fetchJson("/api/settings/time-activities")
      .then((next) => {
        setData(next);
        setDraft(next.activities);
      })
      // Said, not swallowed: a card that silently vanished on a failed load
      // would read as "this company has no activity settings".
      .catch((err) => setLoadError(err.message || t("app.settings.timeActivities.loadError")));
  }, [t]);

  if (loadError) {
    return (
      <div className="rounded-xl border border-border p-5">
        <h2 className="text-sm font-semibold text-foreground">{t("app.settings.timeActivities.title")}</h2>
        <p className="mt-2 text-xs text-red-600 dark:text-red-400">{loadError}</p>
      </div>
    );
  }
  if (!data || !draft) return null;
  const { canEdit } = data;

  const setRow = (key, patch) => {
    setSaved(false);
    setDraft((rows) => rows.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  };

  async function save() {
    setSaving(true);
    setError("");
    setSaved(false);
    try {
      const activities = Object.fromEntries(
        draft.map((r) => [r.key, { enabled: r.enabled, label: r.label || null, paid: r.paid }]),
      );
      const next = await fetchJson("/api/settings/time-activities", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ activities }),
      });
      // Redrawn from what the server stored, so a label it trimmed or a
      // switch it would not allow shows as it really is.
      setData(next);
      setDraft(next.activities);
      setSaved(true);
    } catch (err) {
      setError(err.message || t("app.settings.timeActivities.saveError"));
    } finally {
      setSaving(false);
    }
  }

  const dirty = JSON.stringify(draft) !== JSON.stringify(data.activities);

  return (
    <div className="rounded-xl border border-border p-5">
      <h2 className="text-sm font-semibold text-foreground">{t("app.settings.timeActivities.title")}</h2>
      <p className="mt-1 text-xs text-muted-foreground">{t("app.settings.timeActivities.intro")}</p>

      <ul className="mt-3 divide-y divide-border">
        {draft.map((row) => {
          const Icon = activityIcon(row);
          const builtIn = t(`app.clock.activity.${row.key}`);
          return (
            <li key={row.key} className="flex flex-wrap items-center gap-x-4 gap-y-2 py-3">
              <div className="flex min-w-[9rem] flex-1 items-center gap-2">
                <Icon size={16} className="shrink-0 text-muted-foreground" />
                {canEdit ? (
                  <input
                    type="text"
                    value={row.label || ""}
                    maxLength={LABEL_MAX}
                    placeholder={builtIn}
                    aria-label={t("app.settings.timeActivities.nameFor", { activity: builtIn })}
                    onChange={(e) => setRow(row.key, { label: e.target.value })}
                    className="w-full min-w-0 rounded border border-border bg-background px-2 py-1.5 text-base sm:text-sm"
                  />
                ) : (
                  <span className="text-sm text-foreground">{row.label || builtIn}</span>
                )}
              </div>
              <label className="inline-flex min-h-[36px] items-center gap-1.5 text-xs text-foreground">
                <input
                  type="checkbox"
                  checked={row.enabled}
                  disabled={!canEdit || row.alwaysOn}
                  onChange={(e) => setRow(row.key, { enabled: e.target.checked })}
                />
                {row.alwaysOn ? t("app.settings.timeActivities.alwaysOn") : t("app.settings.timeActivities.shown")}
              </label>
              <label className="inline-flex min-h-[36px] items-center gap-1.5 text-xs text-foreground">
                <input
                  type="checkbox"
                  checked={row.paid}
                  disabled={!canEdit || row.fixedPaid}
                  onChange={(e) => setRow(row.key, { paid: e.target.checked })}
                />
                {row.fixedPaid ? t("app.settings.timeActivities.alwaysPaid") : t("app.settings.timeActivities.paid")}
              </label>
            </li>
          );
        })}
      </ul>

      <p className="mt-2 text-xs text-muted-foreground">{t("app.settings.timeActivities.paidNote")}</p>

      {canEdit ? (
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={save}
            disabled={saving || !dirty}
            className="min-h-[40px] rounded-lg bg-inverted px-4 text-sm font-semibold text-inverted-foreground disabled:opacity-50"
          >
            {saving ? t("app.settings.timeActivities.saving") : t("app.settings.timeActivities.save")}
          </button>
          {saved && !error ? (
            <span className="text-xs text-emerald-600 dark:text-emerald-400">{t("app.settings.timeActivities.saved")}</span>
          ) : null}
        </div>
      ) : (
        <p className="mt-2 text-xs text-muted-foreground">{t("app.settings.timeActivities.setByOwner")}</p>
      )}
      {error ? <p className="mt-2 text-xs text-red-600 dark:text-red-400">{error}</p> : null}
    </div>
  );
}
