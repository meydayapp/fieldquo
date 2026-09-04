"use client";

// app/app/marketing/designer/calendar/page.js
//
// Every Instagram/Facebook post that's scheduled, published, or failed,
// company-wide, in a month grid — the owner's ask, verbatim: "a calendar
// display all the scheduled posts, reels, videos etc., including the time.
// They can select a date and time."
//
// ══ "posts, reels, videos" — and what this actually shows ══════════════════
//
// Today only image posts can be scheduled at all (lib/social/metaSpecs.js's
// INSTAGRAM_IMAGE_SPEC — no video/carousel container shape is implemented;
// see docs/SOCIAL-PUBLISHING.md's "what was NOT built"). AGENTS.md's rule
// against "padding absent data with defaults" applies to a FEATURE list the
// same way it applies to a data field: a "Reels" filter tab that always
// shows nothing would be exactly the empty affordance that rule exists to
// stop. So this calendar has no per-media-type tabs at all — it shows every
// SocialPublish row there is (which, today, can only ever be an image post)
// and says so plainly in the banner below, rather than implying video
// scheduling exists somewhere it doesn't.
//
// ══ Reuse, not a second calendar ═══════════════════════════════════════════
//
// The month-grid math (dayKey/monthGrid/localeFormat/localeDateTime) is
// lib/calendar/monthGrid.js, extracted from app/app/appointments/page.js
// rather than re-copied here — see that file's own header for why the grid
// JSX itself was NOT extracted alongside it: appointments' month view is
// filtered by crew member and travel legs; this one is filtered by platform
// and shows a caption/thumbnail. Genuinely different screens, identical
// date math.
//
// ══ Visibility ══════════════════════════════════════════════════════════
//
// Gated the same way the Publish button itself is
// (isSocialPublishingVisible — see CampaignEditor.js and
// docs/SOCIAL-SCHEDULING.md): the API's own GET reports `visible`, and this
// page renders nothing and redirects back to the designer index when it's
// false, rather than showing an empty calendar for a feature nobody can
// reach yet.
import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, ChevronLeft, ChevronRight, FlaskConical, TriangleAlert, X } from "lucide-react";
import { useTranslation } from "@/app/hooks/useTranslation";
import { useCompanyPreferences } from "@/app/providers/CompanyPreferencesProvider";
import { fetchList } from "@/lib/loadState";
import { reportResponseError } from "@/lib/clientErrors";
import ListState from "@/app/components/ListState";
import { dayKey, monthGrid, localeFormat, localeDateTime } from "@/lib/calendar/monthGrid";

// Exhaustive against `enum SocialPublishStatus` in prisma/schema.prisma —
// checked against the schema, not against the values another page happened to
// list. `container_created` was the one missing: Instagram's publish is two
// calls, and a row sits in that state between them. Its LABEL already existed
// (app.marketingDesigner.calendar.status.container_created), so the chip
// read "Publishing" in the fallback grey while the row beside it read
// "Publishing" in blue — the same state, two colours, on one calendar.
const STATUS_STYLES = {
  scheduled: "bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300",
  pending: "bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300",
  container_created: "bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300",
  publishing: "bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300",
  published: "bg-green-50 dark:bg-green-950/40 text-green-700 dark:text-green-300",
  failed: "bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-300",
  rate_limited: "bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300",
  canceled: "bg-muted text-muted-foreground",
};
const DOT_STYLES = {
  scheduled: "bg-blue-500",
  pending: "bg-blue-500",
  container_created: "bg-blue-500",
  publishing: "bg-blue-500",
  published: "bg-green-500",
  failed: "bg-red-500",
  rate_limited: "bg-amber-500",
  canceled: "bg-muted-foreground/50",
};

// The instant a row should be filed under and shown next to: the INTENDED
// time for anything still waiting or in flight (scheduledFor), the ACTUAL
// time once it has one (publishedAt), createdAt as the last resort for an
// immediate publish that failed before either was ever meaningfully set.
// Mirrors the same "intended vs actual" distinction SocialPublish itself
// keeps as two separate columns — see prisma/schema.prisma.
function eventTime(row) {
  return row.scheduledFor || row.publishedAt || row.createdAt;
}

export default function SocialCalendarPage() {
  const { t, language } = useTranslation();
  const { weekStartsOn } = useCompanyPreferences();
  const router = useRouter();

  const [monthAnchor, setMonthAnchor] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  const [rows, setRows] = useState(null); // null = not loaded yet (lib/loadState.js's convention)
  const [loading, setLoading] = useState(true);
  const [errorKey, setErrorKey] = useState("");
  const [selectedDay, setSelectedDay] = useState("");
  const [cancelingId, setCancelingId] = useState(null);

  const cells = useMemo(() => monthGrid(monthAnchor, weekStartsOn), [monthAnchor, weekStartsOn]);

  const load = useCallback(async () => {
    setLoading(true);
    setErrorKey("");
    const from = cells[0];
    const to = cells[cells.length - 1];
    const result = await fetchList(
      `/api/marketing/designer/social-schedule?from=${from.toISOString()}&to=${to.toISOString()}`,
    );
    if (result.aborted) return;
    if (!result.ok) {
      setErrorKey(result.errorKey);
      setLoading(false);
      return;
    }
    // Not there — not "there but empty" — is the render for an invisible
    // company, so a real 403 never briefly flashes real (or fabricated)
    // schedule data before the redirect below lands.
    if (!result.data.visible) {
      router.replace("/app/marketing/designer");
      return;
    }
    setRows(Array.isArray(result.data.rows) ? result.data.rows : []);
    setLoading(false);
  }, [cells, router]);

  useEffect(() => {
    load();
  }, [load]);

  const byDay = useMemo(() => {
    const map = new Map();
    for (const r of rows || []) {
      const when = eventTime(r);
      if (!when) continue;
      const d = new Date(when);
      if (Number.isNaN(d.getTime())) continue;
      const key = dayKey(d);
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(r);
    }
    for (const list of map.values()) {
      list.sort((a, b) => new Date(eventTime(a)) - new Date(eventTime(b)));
    }
    return map;
  }, [rows]);

  const weekdayNames = useMemo(
    () =>
      Array.from({ length: 7 }, (_, i) =>
        localeFormat(new Date(2024, 0, 7 + ((weekStartsOn + i) % 7)), language, { weekday: "short" }),
      ),
    [weekStartsOn, language],
  );

  const todayKey = dayKey(new Date());
  const shown = selectedDay ? byDay.get(selectedDay) || [] : rows || [];

  async function cancelPost(id) {
    setCancelingId(id);
    try {
      const res = await fetch(`/api/marketing/designer/social-schedule/${id}`, { method: "DELETE" });
      if (!res.ok) {
        await reportResponseError(res);
        return;
      }
      await load();
    } finally {
      setCancelingId(null);
    }
  }

  return (
    <div className="p-4 md:p-6 max-w-4xl mx-auto">
      <Link
        href="/app/marketing/designer"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-2"
      >
        <ArrowLeft size={14} /> {t("app.marketingDesigner.backToDesigns")}
      </Link>
      <h1 className="text-lg md:text-xl font-semibold mb-1">
        {t("app.marketingDesigner.calendar.title", "Social calendar")}
      </h1>
      <p className="text-sm text-muted-foreground mb-3">
        {t(
          "app.marketingDesigner.calendar.subtitle",
          "Every Instagram and Facebook post that's scheduled, published, or failed, with the time it was meant to go out.",
        )}
      </p>

      <p className="text-xs text-muted-foreground bg-muted rounded-lg px-3 py-2 mb-4 flex items-start gap-1.5">
        <TriangleAlert size={13} className="mt-0.5 shrink-0" />
        {t(
          "app.marketingDesigner.calendar.imagesOnly",
          "FieldQuo can schedule image posts today. Reels and video aren't supported yet, so they never appear here.",
        )}
      </p>

      <section className="rounded-xl border border-border bg-card overflow-hidden mb-5">
        <div className="flex items-center justify-between gap-2 px-3 py-2.5 border-b border-border">
          <h2 className="text-sm font-semibold text-foreground capitalize truncate">
            {localeFormat(monthAnchor, language, { month: "long", year: "numeric" })}
          </h2>
          <div className="flex items-center gap-1 shrink-0">
            <button
              onClick={() => setMonthAnchor((m) => new Date(m.getFullYear(), m.getMonth() - 1, 1))}
              aria-label={t("app.action.previous")}
              className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg border border-border hover:bg-muted"
            >
              <ChevronLeft size={15} />
            </button>
            <button
              onClick={() => {
                const now = new Date();
                setMonthAnchor(new Date(now.getFullYear(), now.getMonth(), 1));
              }}
              className="px-2.5 py-1.5 rounded-lg border border-border text-xs font-medium hover:bg-muted"
            >
              {t("app.time.today")}
            </button>
            <button
              onClick={() => setMonthAnchor((m) => new Date(m.getFullYear(), m.getMonth() + 1, 1))}
              aria-label={t("app.action.next")}
              className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg border border-border hover:bg-muted"
            >
              <ChevronRight size={15} />
            </button>
          </div>
        </div>

        <div className="grid grid-cols-7 border-b border-border">
          {weekdayNames.map((name, i) => (
            <div
              key={i}
              className="px-1 py-1.5 text-center text-[10px] sm:text-xs font-semibold uppercase tracking-wide text-muted-foreground truncate"
            >
              {name}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-7">
          {cells.map((day) => {
            const key = dayKey(day);
            const items = byDay.get(key) || [];
            const outside = day.getMonth() !== monthAnchor.getMonth();
            const isToday = key === todayKey;
            const isPicked = key === selectedDay;

            const cellLabel = [
              localeFormat(day, language, { weekday: "long", day: "numeric", month: "long" }),
              ...items.map(
                (r) =>
                  `${new Date(eventTime(r)).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })} ${r.platform}`,
              ),
            ].join(", ");

            return (
              <button
                key={key}
                type="button"
                onClick={() => setSelectedDay((prev) => (prev === key ? "" : key))}
                aria-pressed={isPicked}
                aria-label={cellLabel}
                className={`min-h-[62px] sm:min-h-[92px] text-left align-top p-1 sm:p-1.5 border-b border-r border-border [&:nth-child(7n)]:border-r-0 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-inset ${
                  isPicked ? "bg-muted" : "hover:bg-muted/60"
                } ${outside ? "opacity-45" : ""}`}
              >
                <span
                  className={`inline-flex items-center justify-center h-5 w-5 sm:h-6 sm:w-6 rounded-full text-[11px] sm:text-xs tabular-nums ${
                    isToday ? "bg-inverted text-inverted-foreground font-bold" : "text-foreground"
                  }`}
                >
                  {day.getDate()}
                </span>
                <div className="mt-1 space-y-0.5">
                  {items.slice(0, 3).map((r) => (
                    <div
                      key={r.id}
                      className={`hidden sm:block truncate text-[10px] px-1 py-0.5 rounded ${STATUS_STYLES[r.status] || "bg-muted text-muted-foreground"}`}
                    >
                      {new Date(eventTime(r)).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}{" "}
                      {r.platform === "instagram" ? "IG" : "FB"}
                    </div>
                  ))}
                  {items.length > 0 && (
                    <div className="sm:hidden flex gap-0.5 flex-wrap">
                      {items.slice(0, 5).map((r) => (
                        <span key={r.id} className={`h-1.5 w-1.5 rounded-full ${DOT_STYLES[r.status] || "bg-muted-foreground/50"}`} />
                      ))}
                    </div>
                  )}
                  {items.length > 3 && (
                    <div className="hidden sm:block text-[10px] text-muted-foreground px-1">
                      +{items.length - 3}
                    </div>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </section>

      {selectedDay && (
        <div className="flex items-center justify-between mb-2">
          <p className="text-sm font-semibold text-foreground">
            {localeFormat(new Date(`${selectedDay}T00:00:00`), language, {
              weekday: "long",
              day: "numeric",
              month: "long",
            })}
          </p>
          <button
            type="button"
            onClick={() => setSelectedDay("")}
            className="text-xs text-muted-foreground hover:text-foreground"
          >
            {t("app.marketingDesigner.calendar.showAll", "Show everything")}
          </button>
        </div>
      )}

      <ListState
        loading={loading}
        errorKey={errorKey}
        isEmpty={Boolean(rows) && shown.length === 0}
        onRetry={load}
        empty={
          <p className="text-sm text-muted-foreground text-center py-10">
            {t("app.marketingDesigner.calendar.empty", "Nothing scheduled.")}
          </p>
        }
      >
        <div className="space-y-2">
          {shown.map((r) => (
            <PostRow
              key={r.id}
              row={r}
              t={t}
              language={language}
              onCancel={() => cancelPost(r.id)}
              canceling={cancelingId === r.id}
            />
          ))}
        </div>
      </ListState>
    </div>
  );
}

function PostRow({ row, t, language, onCancel, canceling }) {
  const when = eventTime(row);
  const whenDate = when ? new Date(when) : null;
  const platformLabel = row.platform === "instagram" ? "Instagram" : "Facebook";

  return (
    <div className="rounded-xl border border-border bg-card p-3 flex items-start gap-3">
      {row.imageUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={row.imageUrl} alt="" className="h-14 w-14 rounded-lg object-cover shrink-0" />
      )}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs font-semibold text-foreground">{platformLabel}</span>
          <span
            className={`text-[10px] px-1.5 py-0.5 rounded-full ${STATUS_STYLES[row.status] || "bg-muted text-muted-foreground"}`}
          >
            {t(`app.marketingDesigner.calendar.status.${row.status}`, row.status)}
          </span>
          {row.isMock && (
            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300 flex items-center gap-1">
              <FlaskConical size={10} />
              {t("app.marketingDesigner.publishModal.mockBadge", "FieldQuo demo mock")}
            </span>
          )}
        </div>
        <p className="text-xs text-muted-foreground mt-0.5">
          {whenDate && !Number.isNaN(whenDate.getTime())
            ? localeDateTime(whenDate, language, {
                weekday: "short",
                month: "short",
                day: "numeric",
                hour: "numeric",
                minute: "2-digit",
              })
            : "—"}
          {row.design?.name ? ` · ${row.design.name}` : ""}
        </p>
        {row.caption && <p className="text-xs text-foreground mt-1 line-clamp-2">{row.caption}</p>}
        {row.errorMessage && (
          <p className="text-xs text-red-600 dark:text-red-400 mt-1 flex items-center gap-1">
            <TriangleAlert size={11} className="shrink-0" />
            {row.errorMessage}
          </p>
        )}
      </div>
      {row.status === "scheduled" && (
        <button
          type="button"
          onClick={onCancel}
          disabled={canceling}
          className="text-xs text-muted-foreground hover:text-red-600 shrink-0 flex items-center gap-1 disabled:opacity-60"
        >
          <X size={12} />
          {t("app.marketingDesigner.calendar.cancel", "Cancel")}
        </button>
      )}
    </div>
  );
}
