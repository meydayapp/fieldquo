// app/components/sales/RepDemoHours.js
//
// The rep's demo page card on /sales/settings: the link, the zone, the
// bookable hours. Reads and writes /api/sales/demo-hours and nothing else.
//
// ══ The default is printed, not hidden ═══════════════════════════════════
//
// A rep who has set nothing is offered Monday–Friday 09:00–17:00 in
// FieldQuo's own zone (lib/sales/demoBooking/slots.js). The card says both
// facts in words rather than pre-filling the rows as if the rep had typed
// them, so what a prospect is shown is always something the rep can read
// here. Pressing "Add a day" starts from the default rows, so editing is a
// tweak rather than a blank form.
//
// Day names come from Intl in the portal's language — no key per weekday.
"use client";

import { useEffect, useMemo, useState } from "react";
import { CalendarClock, Loader2 } from "lucide-react";
import { fetchJson } from "@/lib/fetchJson";
import { useTranslation } from "@/app/hooks/useTranslation";
import { useLanguageContext } from "@/app/providers/LanguageProvider";

const ZONES = [
  "America/St_Johns",
  "America/Halifax",
  "America/Toronto",
  "America/Winnipeg",
  "America/Regina",
  "America/Edmonton",
  "America/Vancouver",
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Phoenix",
  "America/Los_Angeles",
  "America/Anchorage",
  "Pacific/Honolulu",
  "Europe/London",
  "Europe/Paris",
  "Europe/Madrid",
  "Europe/Berlin",
  "Europe/Rome",
  "Europe/Kyiv",
  "Asia/Manila",
  "Asia/Kolkata",
  "Asia/Shanghai",
];

export default function RepDemoHours() {
  const { t } = useTranslation();
  const { language } = useLanguageContext();
  const [state, setState] = useState({ loading: true, failed: false, data: null });
  const [zone, setZone] = useState("");
  const [rows, setRows] = useState(null);
  const [saving, setSaving] = useState(false);
  const [note, setNote] = useState("");

  const dayName = useMemo(() => {
    const fmt = new Intl.DateTimeFormat(language || "en", { weekday: "long", timeZone: "UTC" });
    // 2024-09-01 is a Sunday.
    return (d) => fmt.format(new Date(Date.UTC(2024, 8, 1 + d)));
  }, [language]);

  useEffect(() => {
    let cancelled = false;
    fetchJson("/api/sales/demo-hours")
      .then((data) => {
        if (cancelled) return;
        setState({ loading: false, failed: false, data });
        setZone(data.timeZone || "");
        setRows(data.demoHours);
      })
      .catch(() => {
        if (!cancelled) setState({ loading: false, failed: true, data: null });
      });
    return () => {
      cancelled = true;
    };
  }, []);

  async function save() {
    setSaving(true);
    setNote("");
    try {
      const data = await fetchJson("/api/sales/demo-hours", { method: "PUT", body: { timeZone: zone || null, demoHours: rows } });
      setState({ loading: false, failed: false, data });
      setZone(data.timeZone || "");
      setRows(data.demoHours);
      setNote(t("app.salesSettings.demoSaved"));
    } catch (err) {
      setNote(t("app.salesSettings.demoSaveFailed", { error: err?.message || "" }));
    } finally {
      setSaving(false);
    }
  }

  const data = state.data;
  const zoneOptions = zone && !ZONES.includes(zone) ? [zone, ...ZONES] : ZONES;
  const input = "min-h-[40px] rounded-md border border-border bg-background px-2 text-sm text-foreground";

  return (
    <section className="space-y-3" data-rep-demo-hours>
      <div className="flex items-center gap-2">
        <CalendarClock size={16} className="text-muted-foreground shrink-0" />
        <h2 className="text-base font-semibold text-foreground">{t("app.salesSettings.demoHeading")}</h2>
      </div>
      <p className="text-sm text-muted-foreground">{t("app.salesSettings.demoIntro")}</p>

      {state.failed ? (
        <p className="text-sm text-muted-foreground">{t("app.salesSettings.demoLoadFailed")}</p>
      ) : state.loading ? (
        <p className="text-sm text-muted-foreground flex items-center gap-2">
          <Loader2 size={14} className="animate-spin motion-reduce:animate-none" />
          {t("app.salesPay.loading")}
        </p>
      ) : (
        <div className="space-y-4">
          {data.url ? (
            <div className="grid gap-0.5 sm:grid-cols-[180px_1fr] sm:gap-3">
              <span className="text-xs font-medium text-muted-foreground">{t("app.salesSettings.demoLinkLabel")}</span>
              <a href={data.url} target="_blank" rel="noreferrer" className="text-sm break-all underline text-foreground" data-rep-demo-url>
                {data.url}
              </a>
            </div>
          ) : null}

          <label className="grid gap-1 sm:grid-cols-[180px_1fr] sm:gap-3 sm:items-center">
            <span className="text-xs font-medium text-muted-foreground">{t("app.salesSettings.demoZoneLabel")}</span>
            <span className="space-y-1">
              <select className={`${input} w-full`} value={zone} onChange={(e) => setZone(e.target.value)} data-rep-demo-zone>
                <option value="">—</option>
                {zoneOptions.map((z) => (
                  <option key={z} value={z}>
                    {z}
                  </option>
                ))}
              </select>
              {!zone ? <span className="block text-xs text-muted-foreground">{t("app.salesSettings.demoZoneFallback", { zone: data.effectiveTimeZone })}</span> : null}
            </span>
          </label>

          <div className="space-y-2">
            <p className="text-xs font-medium text-muted-foreground">{t("app.salesSettings.demoHoursLabel")}</p>
            {rows === null ? (
              <p className="text-sm text-muted-foreground">{t("app.salesSettings.demoHoursDefault")}</p>
            ) : rows.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t("app.salesSettings.demoNoneBookable")}</p>
            ) : (
              <ul className="space-y-2" data-rep-demo-rows>
                {rows.map((r, i) => (
                  <li key={i} className="flex flex-wrap items-center gap-2">
                    <select className={input} value={r.dayOfWeek} onChange={(e) => setRows(rows.map((x, j) => (j === i ? { ...x, dayOfWeek: Number(e.target.value) } : x)))}>
                      {[1, 2, 3, 4, 5, 6, 0].map((d) => (
                        <option key={d} value={d}>
                          {dayName(d)}
                        </option>
                      ))}
                    </select>
                    <input type="time" className={input} value={r.startTime} onChange={(e) => setRows(rows.map((x, j) => (j === i ? { ...x, startTime: e.target.value } : x)))} />
                    <span className="text-sm text-muted-foreground">{t("app.salesSettings.demoTo")}</span>
                    <input type="time" className={input} value={r.endTime} onChange={(e) => setRows(rows.map((x, j) => (j === i ? { ...x, endTime: e.target.value } : x)))} />
                    <button type="button" className="text-sm underline text-muted-foreground" onClick={() => setRows(rows.filter((_, j) => j !== i))}>
                      {t("app.salesSettings.demoRemove")}
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <button
              type="button"
              className="text-sm underline text-foreground"
              onClick={() => setRows([...(rows === null ? data.defaultHours : rows), { dayOfWeek: 1, startTime: "09:00", endTime: "17:00" }])}
              data-rep-demo-add
            >
              {t("app.salesSettings.demoAddDay")}
            </button>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={save}
              disabled={saving}
              className="inline-flex items-center gap-2 min-h-[40px] rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground disabled:opacity-60"
              data-rep-demo-save
            >
              {saving ? <Loader2 size={14} className="animate-spin motion-reduce:animate-none" /> : null}
              {t("app.salesSettings.demoSave")}
            </button>
            {note ? <span className="text-sm text-muted-foreground" role="status">{note}</span> : null}
          </div>
        </div>
      )}
    </section>
  );
}
