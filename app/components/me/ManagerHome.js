"use client";

// app/components/me/ManagerHome.js
//
// The manager's Home — the same data on the phone and on the web, stacked
// for one thumb on the phone and in two columns from lg up.
//
//   Report      Paid hours · Wages · Labour % for today or this week
//   Dispatch    today's visits with nobody on them, or somebody who is out
//   Team status one row per person, a bar from clock-in to now, the site
//               they are at, filter chips with counts
//   Needs review time off · trade/cover · availability · timesheets, each
//               approvable inline
//   Quick links add a person, announce, add a timecard, add time off, clock
//
// Wages and Labour % render only when the payload carries them — the
// server's canSeeAllPay decides (lib/me/home.js). "— add revenue" is what
// Labour % says with no revenue in the period; never 0%.
import { useState } from "react";
import Link from "next/link";
import { CalendarClock, Clock, Loader2, Megaphone, UserPlus, Users, Check, X, MapPin, ChevronDown, ChevronUp, Navigation } from "lucide-react";
import { useTranslation } from "@/app/hooks/useTranslation";
import { useCompanyPreferences } from "@/app/providers/CompanyPreferencesProvider";
import { formatDayMonth, formatTimeOfDay } from "@/lib/format/localeDate";
import { reportResponseError } from "@/lib/clientErrors";
import { Action, BigRow, Card, CardTitle, EmptyNote, MeLoad, PersonAvatar, RowList, useMeData } from "./bits";
import { greetingKey } from "./WorkerHome";

const STATE_TONE = {
  clocked_in: "bg-emerald-500",
  on_break: "bg-amber-500",
  late: "bg-red-500",
  scheduled: "bg-blue-400",
  clocked_out: "bg-foreground/50",
  no_show: "bg-red-700",
  off: "bg-muted-foreground/40",
};

export default function ManagerHome() {
  const { t, language } = useTranslation();
  const { money } = useCompanyPreferences();
  const [period, setPeriod] = useState("today");
  const { data, errorKey, loading, reload } = useMeData(`/api/me/manager?period=${period}`, { every: 60_000 });
  const [filter, setFilter] = useState(null);
  const [open, setOpen] = useState({ timeOff: true, swaps: true, availability: true, timesheets: false });
  const now = new Date();

  return (
    <MeLoad loading={loading} errorKey={errorKey} reload={reload}>
      {data ? (
        <div className="space-y-4 lg:grid lg:grid-cols-[2fr_1fr] lg:gap-4 lg:space-y-0">
          <div className="space-y-4">
            <h1 className="text-2xl font-bold text-foreground">{t(greetingKey(now.getHours()), { name: (data.me.name || "").split(" ")[0] })}</h1>

            {/* ── Today in one line ─────────────────────────────────── */}
            <div className="rounded-2xl border border-border bg-muted/40 px-4 py-3 text-sm text-foreground">
              {t("app.me.manager.todayLine", {
                working: data.counts.clocked_in + data.counts.on_break,
                onBreak: data.counts.on_break,
                late: data.counts.late,
                noShow: data.counts.no_show,
                scheduled: data.today.shiftsToday,
              })}
              {data.today.draftsToday > 0 ? (
                <Link href="/app/scheduler" className="ml-2 font-semibold text-amber-700 underline dark:text-amber-300">
                  {t("app.me.manager.draftsToday", { n: data.today.draftsToday })}
                </Link>
              ) : (
                <span className="ml-2 text-emerald-700 dark:text-emerald-300">{t("app.me.manager.published")}</span>
              )}
              {data.today.openToday > 0 ? <span className="ml-2 text-muted-foreground">{t("app.me.manager.openToday", { n: data.today.openToday })}</span> : null}
            </div>

            {/* ── Report ─────────────────────────────────────────────── */}
            <Card>
              <CardTitle
                action={
                  <select value={period} onChange={(e) => setPeriod(e.target.value)} aria-label={t("app.me.manager.reportFor")} className="rounded-lg border border-border bg-background px-2 py-1.5 text-sm">
                    <option value="today">{t("app.me.when.today")}</option>
                    <option value="week">{t("app.me.manager.thisWeek")}</option>
                  </select>
                }
              >
                {t("app.me.manager.reportFor")}
              </CardTitle>
              <div className={`grid gap-3 ${data.seesWages ? "grid-cols-3" : "grid-cols-1"}`}>
                <Tile label={t("app.me.manager.paidHours")} value={data.report.paidHours.toFixed(2)} />
                {data.seesWages ? (
                  <>
                    <Tile label={t("app.me.manager.wages")} value={money(data.report.wages)} note={data.report.unpricedEntries ? t("app.me.manager.unpriced", { n: data.report.unpricedEntries }) : null} />
                    <Tile label={t("app.me.manager.labourPct")} value={data.report.labourPct == null ? "—" : `${data.report.labourPct}%`} note={data.report.labourPct == null ? t("app.me.manager.addRevenue") : t("app.me.manager.ofRevenue", { amount: money(data.report.revenue) })} />
                  </>
                ) : null}
              </div>
              <Link href="/app/payroll" className="mt-3 inline-block text-xs font-semibold text-foreground underline">
                {t("app.me.manager.viewMore")}
              </Link>
            </Card>

            {/* ── Dispatch ───────────────────────────────────────────── */}
            {data.dispatch.length ? (
              <Card>
                <CardTitle>{t("app.me.manager.dispatch")}</CardTitle>
                <ul className="divide-y divide-border">
                  {data.dispatch.map((v) => (
                    <li key={v.id} className="flex items-center gap-3 py-2.5">
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-semibold text-foreground">
                          {formatTimeOfDay(v.scheduledAt, language)} · {[v.client, v.title].filter(Boolean).join(" · ")}
                        </div>
                        <div className="truncate text-xs text-muted-foreground">
                          {v.address ? `${v.address} · ` : ""}
                          {t(`app.me.manager.dispatchReason.${v.reason}`, { name: v.assignee || "" })}
                        </div>
                      </div>
                      <Link href={`/app/jobs/${v.jobId}`} className="inline-flex min-h-[44px] items-center gap-1 rounded-xl bg-foreground px-3 text-sm font-semibold text-background">
                        <Navigation size={14} /> {t("app.me.manager.assign")}
                      </Link>
                    </li>
                  ))}
                </ul>
              </Card>
            ) : null}

            {/* ── Team status ────────────────────────────────────────── */}
            <Card>
              <CardTitle action={<Link href="/app/scheduler" className="text-xs font-semibold text-foreground underline">{t("app.me.manager.openBoard")}</Link>}>{t("app.me.manager.teamStatus")}</CardTitle>
              <div className="mb-3 flex flex-wrap gap-1.5">
                {["clocked_in", "on_break", "late", "scheduled", "clocked_out", "no_show", "off"].map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setFilter(filter === s ? null : s)}
                    className={`inline-flex min-h-[36px] items-center gap-1.5 rounded-full border px-2.5 text-xs font-semibold ${filter === s ? "border-foreground bg-foreground text-background" : "border-border text-foreground"}`}
                  >
                    <span className={`h-2 w-2 rounded-full ${STATE_TONE[s]}`} />
                    {t(`app.me.manager.state.${s}`)} <span className="tabular-nums opacity-70">{data.counts[s]}</span>
                  </button>
                ))}
              </div>
              {data.team.length === 0 ? (
                <EmptyNote>{t("app.me.manager.noTeam")}</EmptyNote>
              ) : (
                <ul className="divide-y divide-border">
                  {data.team
                    .filter((r) => !filter || r.state === filter)
                    .map((r) => (
                      <TeamRow key={r.id} row={r} t={t} language={language} now={now} />
                    ))}
                </ul>
              )}
            </Card>
          </div>

          <div className="space-y-4">
            {/* ── Needs review ───────────────────────────────────────── */}
            <Card>
              <CardTitle>{t("app.me.manager.needsReview")}</CardTitle>
              <ReviewSection
                title={t("app.me.manager.timeOffRequests")}
                count={data.needsReview.timeOff.length}
                open={open.timeOff}
                onToggle={() => setOpen((o) => ({ ...o, timeOff: !o.timeOff }))}
                href="/app/time-off"
              >
                {data.needsReview.timeOff.map((l) => (
                  <ReviewRow
                    key={l.id}
                    title={`${l.worker} · ${l.policy}`}
                    subtitle={`${formatDayMonth(l.startDate, language)} – ${formatDayMonth(l.endDate, language)} · ${t("app.me.manager.days", { n: l.days })}${l.reason ? ` · ${l.reason}` : ""}`}
                    onDecide={(action) => decideLeave(l.id, action, t, reload)}
                    t={t}
                  />
                ))}
              </ReviewSection>
              <ReviewSection
                title={t("app.me.manager.swapRequests")}
                count={data.needsReview.swaps.length}
                open={open.swaps}
                onToggle={() => setOpen((o) => ({ ...o, swaps: !o.swaps }))}
                href="/app/me/requests"
              >
                {data.needsReview.swaps.map((r) => (
                  <ReviewRow
                    key={r.id}
                    title={t("app.me.requests.line", { kind: t(`app.me.kindRequest.${r.kind}`), from: r.from || r.to || "", to: r.to || t("app.me.requests.anyone") })}
                    subtitle={`${formatDayMonth(r.start, language)} ${formatTimeOfDay(r.start, language)}–${formatTimeOfDay(r.end, language)}${r.client ? ` · ${r.client}` : ""}${r.note ? ` · ${r.note}` : ""}`}
                    onDecide={(action) => decideSwap(r.id, action, t, reload)}
                    t={t}
                  />
                ))}
              </ReviewSection>
              <ReviewSection
                title={t("app.me.manager.availabilityRequests")}
                count={data.needsReview.availability.length}
                open={open.availability}
                onToggle={() => setOpen((o) => ({ ...o, availability: !o.availability }))}
                href="/app/me/availability"
              >
                {data.needsReview.availability.map((r) => (
                  <ReviewRow
                    key={r.id}
                    title={r.worker}
                    subtitle={`${t("app.me.availability.effective", { date: formatDayMonth(r.effectiveFrom, language) })}${r.desired != null ? ` · ${t("app.me.availability.desiredShort", { n: r.desired })}` : ""}${r.note ? ` · ${r.note}` : ""}`}
                    onDecide={(action) => decideAvailability(r.id, action, t, reload)}
                    t={t}
                    detailHref="/app/me/availability"
                  />
                ))}
              </ReviewSection>
              <ReviewSection
                title={t("app.me.manager.timesheetsToApprove")}
                count={data.needsReview.timesheets.length}
                open={open.timesheets}
                onToggle={() => setOpen((o) => ({ ...o, timesheets: !o.timesheets }))}
                href="/app/settings/team/timesheets"
              >
                {data.needsReview.timesheets.map((e) => (
                  <ReviewRow
                    key={e.id}
                    title={e.worker}
                    subtitle={`${formatDayMonth(e.clockIn, language)} ${formatTimeOfDay(e.clockIn, language)}–${formatTimeOfDay(e.clockOut, language)}${e.hours != null ? ` · ${e.hours.toFixed(2)} h` : ""}${e.job ? ` · ${e.job}` : ""}`}
                    onDecide={(action) => (action === "approve" ? approveEntry(e.id, t, reload) : null)}
                    approveOnly
                    t={t}
                  />
                ))}
              </ReviewSection>
            </Card>

            {/* ── Quick links ────────────────────────────────────────── */}
            <RowList>
              <BigRow icon={UserPlus} title={t("app.me.manager.addTeamMember")} href="/app/settings/team/new" />
              <BigRow icon={Megaphone} title={t("app.me.manager.sendAnnouncement")} subtitle={t("app.me.manager.announcementNote")} href="/app/chat" />
              <BigRow icon={Clock} title={t("app.me.manager.addTimecard")} href="/app/settings/team/timesheets" />
              <BigRow icon={CalendarClock} title={t("app.me.manager.addTimeOff")} href="/app/time-off" />
              <BigRow icon={Users} title={t("app.me.tab.team")} href="/app/me/team" />
              <BigRow icon={Clock} title={t("app.me.manager.launchClock")} href="/app/clock" />
            </RowList>
          </div>
        </div>
      ) : null}
    </MeLoad>
  );
}

function Tile({ label, value, note = null }) {
  return (
    <div className="rounded-xl bg-muted/50 px-3 py-3">
      <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="mt-1 text-xl font-bold tabular-nums text-foreground sm:text-2xl">{value}</div>
      {note ? <div className="mt-0.5 text-xs text-muted-foreground">{note}</div> : null}
    </div>
  );
}

/** One person's row: dot, name, a bar from clock-in to now, where they are. */
function TeamRow({ row, t, language, now }) {
  const dayStart = new Date(now);
  dayStart.setHours(6, 0, 0, 0);
  const scale = 14 * 3_600_000; // 06:00 → 20:00
  const from = row.clockIn ? new Date(row.clockIn).getTime() : row.shift ? new Date(row.shift.start).getTime() : null;
  const to = row.clockIn ? (row.clockOut ? new Date(row.clockOut).getTime() : now.getTime()) : row.shift ? new Date(row.shift.end).getTime() : null;
  const left = from != null ? Math.max(0, Math.min(100, ((from - dayStart.getTime()) / scale) * 100)) : 0;
  const width = from != null && to != null ? Math.max(1, Math.min(100 - left, ((to - from) / scale) * 100)) : 0;
  const planned = !row.clockIn && row.shift;
  return (
    <li className="flex items-center gap-3 py-2.5">
      <PersonAvatar name={row.name} image={row.image} size="sm" />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${STATE_TONE[row.state]}`} />
          <span className="truncate text-sm font-semibold text-foreground">{row.name}</span>
          <span className="shrink-0 text-xs text-muted-foreground">{t(`app.me.manager.state.${row.state}`)}</span>
        </div>
        <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-muted">
          {width > 0 ? <div className={`h-full rounded-full ${planned ? "bg-blue-300/70 dark:bg-blue-800/60" : STATE_TONE[row.state]}`} style={{ marginLeft: `${left}%`, width: `${width}%` }} /> : null}
        </div>
        <div className="mt-0.5 flex items-center gap-1 truncate text-xs text-muted-foreground">
          {row.clockIn ? `${formatTimeOfDay(row.clockIn, language)} – ${row.clockOut ? formatTimeOfDay(row.clockOut, language) : t("app.me.manager.now")}` : row.shift ? `${formatTimeOfDay(row.shift.start, language)} – ${formatTimeOfDay(row.shift.end, language)}` : t("app.me.manager.nothingToday")}
          {row.where ? (
            <>
              <MapPin size={11} className="ml-1 shrink-0" />
              <span className="truncate">{[row.where.client, row.where.address].filter(Boolean).join(", ") || row.where.title}</span>
            </>
          ) : null}
        </div>
      </div>
    </li>
  );
}

function ReviewSection({ title, count, open, onToggle, href, children }) {
  return (
    <div className="border-b border-border py-2 last:border-b-0">
      <button type="button" onClick={onToggle} className="flex min-h-[44px] w-full items-center justify-between gap-2 text-left">
        <span className="text-sm font-semibold text-foreground">
          {title} <span className="ml-1 rounded-full bg-muted px-2 py-0.5 text-xs tabular-nums">{count}</span>
        </span>
        {open ? <ChevronUp size={16} className="text-muted-foreground" /> : <ChevronDown size={16} className="text-muted-foreground" />}
      </button>
      {open ? (
        <div className="space-y-2 pb-1">
          {count === 0 ? <p className="text-xs text-muted-foreground">—</p> : children}
          <Link href={href} className="inline-block text-xs font-semibold text-foreground underline">
            {title} →
          </Link>
        </div>
      ) : null}
    </div>
  );
}

function ReviewRow({ title, subtitle, onDecide, approveOnly = false, t, detailHref = null }) {
  const [busy, setBusy] = useState(false);
  async function go(action) {
    setBusy(true);
    try {
      await onDecide(action);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="rounded-xl bg-muted/40 px-3 py-2.5">
      <div className="text-sm font-semibold text-foreground">{title}</div>
      <div className="text-xs text-muted-foreground">{subtitle}</div>
      <div className="mt-2 flex gap-2">
        <button type="button" disabled={busy} onClick={() => go("approve")} className="inline-flex min-h-[40px] flex-1 items-center justify-center gap-1 rounded-lg bg-emerald-600 px-3 text-sm font-semibold text-white disabled:opacity-60">
          {busy ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />} {t("app.me.action.approve")}
        </button>
        {!approveOnly ? (
          <button type="button" disabled={busy} onClick={() => go("decline")} className="inline-flex min-h-[40px] flex-1 items-center justify-center gap-1 rounded-lg border border-border px-3 text-sm font-semibold text-foreground disabled:opacity-60">
            <X size={14} /> {t("app.me.action.decline")}
          </button>
        ) : null}
        {detailHref ? (
          <Link href={detailHref} className="inline-flex min-h-[40px] items-center rounded-lg border border-border px-3 text-sm font-semibold text-foreground">
            {t("app.me.manager.seeDiff")}
          </Link>
        ) : null}
      </div>
    </div>
  );
}

async function decideLeave(id, action, t, reload) {
  const res = await fetch(`/api/leave/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action }) });
  if (!res.ok) return reportResponseError(res, t("app.me.manager.decideError"));
  await reload();
}
async function decideSwap(id, action, t, reload) {
  const res = await fetch(`/api/shift-requests/${id}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action }) });
  if (!res.ok) return reportResponseError(res, t("app.me.manager.decideError"));
  await reload();
}
async function decideAvailability(id, action, t, reload) {
  const res = await fetch(`/api/availability-requests/${id}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action }) });
  if (!res.ok) return reportResponseError(res, t("app.me.manager.decideError"));
  await reload();
}
async function approveEntry(id, t, reload) {
  const res = await fetch(`/api/time-entries/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status: "approved" }) });
  if (!res.ok) return reportResponseError(res, t("app.me.manager.decideError"));
  await reload();
}
