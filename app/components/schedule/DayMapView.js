// app/components/schedule/DayMapView.js
//
// One day on a map, with the same rows as a list beside it.
//
// ── Two surfaces, one order ────────────────────────────────────────────────
//
// The list is not a legend for the map; it IS the day, in time order, one
// row per stop, with the same number and colour the pin carries. On a phone
// the list is what somebody reads in a driveway and the map is a button
// away; on a desk the two sit side by side. A row with no coordinates is in
// the list with "no location on the map" — the map does not get to decide
// how many places a person is going today.
//
// ── Who sees what is not decided here ──────────────────────────────────────
//
// /api/schedule/map returns the rows the caller may see, already scoped and
// redacted by lib/schedule/feed.js. This component filters by person only
// among what it was given, and the popover prints what the row carries: a
// crew member's row carries the client's name and address and nothing
// else, so that is all the popover can show them.
//
// ── Two readers ────────────────────────────────────────────────────────────
//
// The calendar (?view=map) colours by assignee. Settings → Work areas passes
// `groupOf` to colour by the assignee's work area instead, plus the zones to
// draw — same rows, same numbering, a different legend.
"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { MapPin, MapPinOff, ChevronLeft, ChevronRight, Map as MapIcon, X } from "lucide-react";
import { fetchJson } from "@/lib/fetchJson";
import { buildMapStops, mapCentre } from "@/lib/schedule/mapStops";
import { useTranslation } from "@/app/hooks/useTranslation";
import { useCompanyPreferences } from "@/app/providers/CompanyPreferencesProvider";
import { appointmentStatusLabel } from "@/lib/appointments/statusLabels";

// The Maps SDK and the map chunk reach the browser only when this view is
// rendered — never on the calendar's month grid. See ScheduleMap's header.
const ScheduleMap = dynamic(() => import("@/app/components/schedule/ScheduleMap"), {
  ssr: false,
  loading: () => <div className="animate-pulse rounded-xl bg-accent h-full min-h-[280px]" aria-busy="true" />,
});

/** Local YYYY-MM-DD for a Date. */
export function ymdOf(d) {
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function shiftDay(ymd, delta) {
  const [y, m, d] = ymd.split("-").map(Number);
  return ymdOf(new Date(y, m - 1, d + delta));
}

const ALL = "__all__";

/**
 * What a stop is, in words. `what` comes from describeStop; the kind word is
 * translated here and the ref/title is the record's own.
 */
function whatText(stop, t) {
  switch (stop.what) {
    case "visit":
      return stop.title || t("app.map.what.visit", "Job visit");
    case "site_visit":
      return stop.ref ? t("app.map.what.siteVisit", "Site visit · {ref}", { ref: stop.ref }) : t("app.map.what.siteVisitNoRef", "Site visit");
    case "job":
      return stop.title ? t("app.map.what.aboutJob", "About the job · {title}", { title: stop.title }) : t("app.map.what.aboutJobNoTitle", "About a job");
    case "invoice":
      return stop.ref ? t("app.map.what.aboutInvoice", "About invoice {ref}", { ref: stop.ref }) : t("app.map.what.aboutInvoiceNoRef", "About an invoice");
    case "booking":
      return stop.title || t("app.map.what.booking", "Client booking");
    default:
      return t("app.map.what.appointment", "Appointment");
  }
}

/** The popover, as DOM — InfoWindow takes a node, and a node cannot inject. */
function buildPopover(stop, { t, timeText, whatLine, openText }) {
  const root = document.createElement("div");
  root.className = "fq-map-popover";
  root.style.cssText = "font: 13px/1.4 system-ui,-apple-system,'Segoe UI',Roboto,sans-serif;color:#0b1a2e;max-width:260px";
  const add = (tag, text, css) => {
    const el = document.createElement(tag);
    el.textContent = text;
    if (css) el.style.cssText = css;
    root.appendChild(el);
    return el;
  };
  const head = document.createElement("div");
  head.style.cssText = "display:flex;align-items:center;gap:8px;margin-bottom:4px";
  const badge = document.createElement("span");
  badge.textContent = stop.label;
  badge.style.cssText = `display:inline-flex;align-items:center;justify-content:center;min-width:22px;height:22px;border-radius:999px;background:${stop.fill};color:${stop.ink};font-weight:700;font-size:12px`;
  head.appendChild(badge);
  const time = document.createElement("strong");
  time.textContent = timeText;
  head.appendChild(time);
  root.appendChild(head);
  if (stop.assigneeName) add("div", stop.assigneeName, "color:#4b5563");
  else add("div", t("app.map.unassigned", "Unassigned"), "color:#4b5563");
  add("div", whatLine, "margin-top:4px;font-weight:600");
  if (stop.clientName) add("div", stop.clientName);
  if (stop.address) add("div", stop.address, "color:#4b5563");
  if (stop.href) {
    const a = document.createElement("a");
    a.href = stop.href;
    a.textContent = openText;
    a.style.cssText = "display:inline-block;margin-top:6px;color:#1d4ed8;text-decoration:underline";
    root.appendChild(a);
  }
  return root;
}

/**
 * @param day          YYYY-MM-DD; the view fetches this day.
 * @param onDayChange  (ymd) => void
 * @param groupOf      optional (entry) => group id — colour BY this instead of by assignee.
 * @param legend       optional [{ id, name }] for `groupOf` groups (the work areas).
 * @param polygons     optional [{ id, name, path }] — coloured by the same group colour.
 * @param drawing      optional { forId, onComplete(path), onProgress(count), finishNonce } — passed through to the map.
 * @param editingId / onEdited  polygon editing, passed through.
 * @param explain      optional one-line note under the heading (Work areas says what the polygon is for).
 */
export default function DayMapView({
  day,
  onDayChange,
  groupOf = null,
  legend = null,
  polygons = null,
  drawing = null,
  editingId = null,
  onEdited,
  explain = null,
}) {
  const { t, language } = useTranslation();
  const { formatDate } = useCompanyPreferences();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [person, setPerson] = useState(ALL);
  const [selectedKey, setSelectedKey] = useState(null);
  const [mapOpen, setMapOpen] = useState(false);
  // `centre` is kept as its own state and only replaced when the VALUE
  // changes: the map component treats a new centre object as "recentre",
  // and a refetch of the same day must not yank the viewport back.
  const [centre, setCentre] = useState(null);
  // Is the map column on screen at all? On a phone it is behind the button,
  // and the map is not MOUNTED until it is shown — a Google map created in
  // a display:none box draws nothing when the box appears, and an SDK load
  // for a map nobody opened is a map load somebody pays for.
  const [wide, setWide] = useState(false);
  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return undefined;
    const mq = window.matchMedia("(min-width: 768px)");
    const apply = () => setWide(mq.matches);
    apply();
    mq.addEventListener?.("change", apply);
    return () => mq.removeEventListener?.("change", apply);
  }, []);

  const load = useCallback(async (ymd) => {
    setError("");
    setLoading(true);
    try {
      const d = await fetchJson(`/api/schedule/map?day=${encodeURIComponent(ymd)}`);
      setData(d);
      setCentre((prev) => {
        const next = d.centre || null;
        if (!next && !prev) return prev;
        if (next && prev && next.lat === prev.lat && next.lng === prev.lng) return prev;
        return next;
      });
    } catch (err) {
      setError(err.message || t("app.load.network"));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    if (day) load(day);
  }, [day, load]);

  const built = useMemo(
    () =>
      buildMapStops(data?.entries || [], {
        groupOf: groupOf || null,
        // Every legend group gets a colour even with nothing on it today, so
        // a work area's polygon is the same colour on a quiet Sunday.
        groups: Array.isArray(legend) ? legend.map((g) => g.id) : [],
      }),
    [data, groupOf, legend],
  );

  // The people on the day, for the filter — from the rows, so the list never
  // offers a name that has nothing on it.
  const people = useMemo(() => {
    const seen = new Map();
    for (const s of built.stops) {
      if (s.assigneeId && !seen.has(s.assigneeId)) seen.set(s.assigneeId, s.assigneeName || s.assigneeId);
    }
    return Array.from(seen, ([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name));
  }, [built]);

  const hasUnassigned = built.stops.some((s) => !s.assigneeId);

  const shown = useMemo(() => {
    if (person === ALL) return built.stops;
    if (person === "__none__") return built.stops.filter((s) => !s.assigneeId);
    return built.stops.filter((s) => s.assigneeId === person);
  }, [built, person]);

  // Numbering is per person over the WHOLE day, so filtering to one person
  // keeps their 1, 2, 3 — the filter narrows, it never renumbers.
  // Memoised by value: the map recentres whenever this object's IDENTITY
  // changes, so a fresh object per render would drag the viewport back on
  // every keystroke in the person filter.
  const mapCentreValue = useMemo(() => {
    if (centre) return { lat: centre.lat, lng: centre.lng };
    const c = mapCentre(null, built.stops);
    return c ? { lat: c.lat, lng: c.lng } : null;
  }, [centre, built]);

  const groupColours = built.groups;
  const drawnPolygons = useMemo(() => {
    if (!Array.isArray(polygons)) return [];
    return polygons
      .filter((p) => Array.isArray(p.path) && p.path.length >= 3)
      .map((p) => ({ ...p, fill: groupColours.get(String(p.id))?.fill || "#5b6472" }));
  }, [polygons, groupColours]);

  const fitKey = `${day}|${person}|${drawnPolygons.length}`;

  const timeOf = (at) =>
    new Date(at).toLocaleTimeString(language || undefined, { hour: "numeric", minute: "2-digit" });

  const renderPopover = useCallback(
    (stop) =>
      buildPopover(stop, {
        t,
        timeText: timeOf(stop.scheduledAt),
        whatLine: whatText(stop, t),
        openText: t("app.map.open", "Open"),
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [t, language],
  );

  const listRef = useRef(null);
  const select = (key) => {
    setSelectedKey(key);
    if (key) setMapOpen(true);
  };

  // What the backfill did on this load, said only when it did something:
  // "0 of 0 placed" is noise, and "3 more next time" is a promise worth
  // making only when there are three more.
  const geocodeNote = data?.geocoded
    ? [
        data.geocoded.tried > 0
          ? t("app.map.geocodeNote", "{placed} of {tried} addresses placed on the map just now.", {
              placed: data.geocoded.placed,
              tried: data.geocoded.tried,
            })
          : null,
        data.geocoded.remaining > 0
          ? t("app.map.geocodeMore", "{remaining} more will be placed next time.", { remaining: data.geocoded.remaining })
          : null,
      ]
        .filter(Boolean)
        .join(" ") || null
    : null;

  const legendItems = useMemo(() => {
    if (Array.isArray(legend)) {
      return legend
        .filter((g) => groupColours.has(String(g.id)))
        .map((g) => ({ id: String(g.id), name: g.name, ...groupColours.get(String(g.id)) }));
    }
    return people
      .filter((p) => groupColours.has(p.id))
      .map((p) => ({ id: p.id, name: p.name, ...groupColours.get(p.id) }));
  }, [legend, people, groupColours]);

  const mapNode = (
    <ScheduleMap
      className="h-[320px] md:h-[520px]"
      centre={mapCentreValue}
      stops={shown}
      selectedKey={selectedKey}
      onSelect={select}
      renderPopover={renderPopover}
      polygons={drawnPolygons}
      drawing={drawing ? { active: Boolean(drawing.forId), onComplete: drawing.onComplete, onProgress: drawing.onProgress, finishNonce: drawing.finishNonce } : null}
      editingId={editingId}
      onEdited={onEdited}
      fitKey={fitKey}
      unavailableText={t("app.map.unavailable", "The map could not load. The list below is complete.")}
      missingKeyText={t("app.map.noKey", "No Google Maps key is configured, so there is no map — the list is complete.")}
    />
  );

  return (
    <section data-tour="schedule-map" className="space-y-3">
      {/* Day and person, above both surfaces because they govern both. */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => onDayChange?.(shiftDay(day, -1))}
            aria-label={t("app.action.previous")}
            className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg border border-border hover:bg-muted"
          >
            <ChevronLeft size={15} />
          </button>
          <input
            type="date"
            value={day}
            onChange={(e) => /^\d{4}-\d{2}-\d{2}$/.test(e.target.value) && onDayChange?.(e.target.value)}
            aria-label={t("app.map.day", "Day")}
            className="min-h-[44px] rounded-lg border border-border bg-card px-3 text-sm"
          />
          <button
            type="button"
            onClick={() => onDayChange?.(shiftDay(day, 1))}
            aria-label={t("app.action.next")}
            className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg border border-border hover:bg-muted"
          >
            <ChevronRight size={15} />
          </button>
          <button
            type="button"
            onClick={() => onDayChange?.(ymdOf(new Date()))}
            className="inline-flex items-center min-h-[44px] px-3 rounded-lg border border-border text-xs font-medium hover:bg-muted"
          >
            {t("app.time.today")}
          </button>
        </div>
        {(people.length > 0 || hasUnassigned) && (
          <select
            value={person}
            onChange={(e) => setPerson(e.target.value)}
            aria-label={t("app.map.person", "Person")}
            className="min-h-[44px] rounded-lg border border-border bg-card px-3 text-sm"
          >
            <option value={ALL}>{t("app.map.everyone", "Everyone")}</option>
            {people.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
            {hasUnassigned && <option value="__none__">{t("app.map.unassigned", "Unassigned")}</option>}
          </select>
        )}
        {/* Phones: the list is primary and the map is a button away. */}
        <button
          type="button"
          onClick={() => setMapOpen((v) => !v)}
          aria-expanded={mapOpen}
          className="md:hidden inline-flex items-center gap-2 min-h-[44px] px-3 rounded-lg border border-border text-sm font-medium hover:bg-muted"
        >
          {mapOpen ? <X size={14} /> : <MapIcon size={14} />}
          {mapOpen ? t("app.map.hideMap", "Hide map") : t("app.map.showMap", "Show map")}
        </button>
      </div>

      {explain && <p className="text-xs text-muted-foreground">{explain}</p>}

      {error && (
        <div className="flex flex-wrap items-center justify-between gap-3 text-sm rounded-lg bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-900 px-3 py-2">
          <p className="min-w-0">{error}</p>
          <button
            type="button"
            onClick={() => load(day)}
            disabled={loading}
            className="shrink-0 inline-flex items-center min-h-[44px] px-3 rounded-lg border border-red-300 dark:border-red-800 font-medium disabled:opacity-50"
          >
            {t("app.action.retry", "Try again")}
          </button>
        </div>
      )}

      {/* Legend: one chip per colour on the map, in the caller's grouping. */}
      {legendItems.length > 0 && (
        <ul className="flex flex-wrap gap-2 text-xs" aria-label={t("app.map.legend", "Colours")}>
          {legendItems.map((g) => (
            <li key={g.id} className="inline-flex items-center gap-1.5 rounded-full border border-border px-2 py-1">
              <span className="h-3 w-3 rounded-full" style={{ background: g.fill }} aria-hidden="true" />
              {g.name}
            </li>
          ))}
          {hasUnassigned && !legend && (
            <li className="inline-flex items-center gap-1.5 rounded-full border border-border px-2 py-1">
              <span className="h-3 w-3 rounded-full bg-[#5b6472]" aria-hidden="true" />
              {t("app.map.unassigned", "Unassigned")}
            </li>
          )}
        </ul>
      )}

      <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
        {/* The list — first in the DOM, so it is what a phone reads first. */}
        <div ref={listRef} className="space-y-2 md:order-1">
          {loading && !data && (
            <div className="animate-pulse space-y-2">
              <div className="h-16 bg-accent rounded-lg" />
              <div className="h-16 bg-accent rounded-lg" />
            </div>
          )}
          {!loading && data && shown.length === 0 && (
            <div className="glass-effect rounded-lg p-6 text-center text-sm text-muted-foreground">
              {t("app.map.empty", "Nothing scheduled on {day}.", { day: formatDate(`${day}T12:00:00`) })}
            </div>
          )}
          {shown.map((s) => {
            const active = s.key === selectedKey;
            return (
              <div
                key={s.key}
                data-stop={s.key}
                data-sequence={s.label}
                data-located={s.located ? "1" : "0"}
                className={`rounded-lg border p-3 bg-card ${active ? "border-inverted ring-2 ring-ring" : "border-border"}`}
              >
                <div className="flex items-start gap-3">
                  <button
                    type="button"
                    onClick={() => select(active ? null : s.key)}
                    disabled={!s.located}
                    aria-label={s.located ? t("app.map.showOnMap", "Show on the map") : t("app.map.noLocation", "No location on the map")}
                    className="shrink-0 inline-flex items-center justify-center h-8 w-8 rounded-full font-bold text-sm disabled:opacity-60"
                    style={{ background: s.fill, color: s.ink }}
                  >
                    {s.label}
                  </button>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-baseline gap-x-2 text-sm">
                      <span className="font-semibold tabular-nums">{timeOf(s.scheduledAt)}</span>
                      <span className="text-muted-foreground">{s.assigneeName || t("app.map.unassigned", "Unassigned")}</span>
                      {s.status && s.status !== "scheduled" && s.status !== "confirmed" && (
                        <span className="text-xs text-muted-foreground">{appointmentStatusLabel(s.status, t)}</span>
                      )}
                    </div>
                    <div className="text-sm font-medium text-foreground truncate">{whatText(s, t)}</div>
                    {s.clientName && <div className="text-sm truncate">{s.clientName}</div>}
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                      {s.located ? <MapPin size={12} /> : <MapPinOff size={12} />}
                      <span className="truncate">
                        {s.located ? s.address || "" : t("app.map.noLocation", "No location on the map")}
                        {!s.located && s.address ? ` · ${s.address}` : ""}
                      </span>
                    </div>
                    {s.href && (
                      <Link href={s.href} className="inline-flex items-center min-h-[32px] text-xs font-medium underline text-foreground">
                        {t("app.map.open", "Open")}
                      </Link>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
          {(built.cancelled > 0 || geocodeNote) && (
            <p className="text-xs text-muted-foreground">
              {built.cancelled > 0 && t("app.map.cancelledNote", "{n} cancelled, not shown.", { n: built.cancelled })}
              {built.cancelled > 0 && geocodeNote ? " " : ""}
              {geocodeNote}
            </p>
          )}
        </div>

        {/* The map — beside the list from md up; on a phone, behind the button. */}
        <div className={`${mapOpen ? "block" : "hidden"} md:block md:order-2 md:sticky md:top-4 md:self-start`}>
          {(wide || mapOpen) && mapNode}
          {built.unlocated > 0 && (
            <p className="mt-1 text-xs text-muted-foreground">
              {t("app.map.unlocatedNote", "{n} stop(s) have no location on the map — they are in the list.", { n: built.unlocated })}
            </p>
          )}
        </div>
      </div>
    </section>
  );
}
