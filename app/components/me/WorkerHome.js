"use client";

// app/components/me/WorkerHome.js
//
// The Homebase dashboard, in FieldQuo's brand: a greeting, the next thing
// on your day, three big actions, today's hours, and the shout-outs.
//
// "Next up" is not only a shift — lib/me/timeline.js folds in the visits
// dispatched to you, the appointments booked with you (only if you can
// quote — a crew member never sees that section, not even empty), the
// tasks due, and the company's events for the day. The money line under a
// shift exists only when the payload carries `estimate`; the server decides
// that (lib/payroll/ownPayGate.js), and this file renders what it is given.
import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowRightLeft, Clock, MapPin, MessagesSquare, Megaphone, Navigation, Phone, Send, Users, Video } from "lucide-react";
import { bookingModeLine } from "@/lib/booking/bookingModes";
import { useTranslation } from "@/app/hooks/useTranslation";
import { useCompanyPreferences } from "@/app/providers/CompanyPreferencesProvider";
import { formatTimeOfDay } from "@/lib/format/localeDate";
import { reportResponseError } from "@/lib/clientErrors";
import { Action, BigRow, Card, CardTitle, EmptyNote, KindChip, MeLoad, PersonAvatar, RowList, hoursWords, useMeData, whenWords } from "./bits";
import ShiftRequestDialog from "./ShiftRequestDialog";

/** Morning / afternoon / evening by the phone's clock — the greeting is for the reader, where they are. */
export function greetingKey(hour) {
  if (hour < 12) return "app.me.greeting.morning";
  if (hour < 18) return "app.me.greeting.afternoon";
  return "app.me.greeting.evening";
}

function firstName(name) {
  return String(name || "").trim().split(/\s+/)[0] || "";
}

export default function WorkerHome() {
  const { t, language } = useTranslation();
  const { money } = useCompanyPreferences();
  const { data, errorKey, loading, reload } = useMeData("/api/me/home", { every: 60_000 });
  const [dialog, setDialog] = useState(null); // { shift, mode }
  const [shout, setShout] = useState(false);
  const now = useMemo(() => new Date(), [data]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <MeLoad loading={loading} errorKey={errorKey} reload={reload}>
      {data ? (
        <div className="space-y-4">
          {/* ── Greeting ────────────────────────────────────────────── */}
          <div className="flex items-center gap-3">
            <PersonAvatar name={data.me.name} image={data.me.image} size="lg" />
            <div className="min-w-0">
              <h1 className="truncate text-2xl font-bold text-foreground">
                {t(greetingKey(now.getHours()), { name: firstName(data.me.name) })}
              </h1>
              {data.me.title ? <p className="text-sm text-muted-foreground">{data.me.title}</p> : null}
            </div>
          </div>

          {/* ── Events today ──────────────────────────────────────── */}
          {data.eventsToday?.length ? (
            <div className="rounded-2xl border border-border bg-muted/40 px-4 py-3">
              {data.eventsToday.map((e) => (
                <div key={e.id} className="text-sm">
                  <span className="font-semibold text-foreground">{e.title}</span>
                  {e.note ? <span className="text-muted-foreground"> — {e.note}</span> : null}
                </div>
              ))}
            </div>
          ) : null}

          {/* ── Next up ─────────────────────────────────────────────── */}
          <NextUp item={data.next} t={t} language={language} money={money} now={now} onCover={(shift) => setDialog({ shift, mode: "cover" })} onTrade={(shift) => setDialog({ shift, mode: "trade" })} onClaim={(shift) => setDialog({ shift, mode: "claim" })} onRoster={data.me.onRoster} />

          {/* ── Quick actions ───────────────────────────────────────── */}
          <div className="grid grid-cols-3 gap-2">
            <Action href="/app/clock" variant="good" icon={Clock} className="flex-col gap-1 py-3 text-sm">
              {data.clock.open ? t("app.me.action.clockOut") : t("app.me.action.clockIn")}
            </Action>
            <Action href="/app/chat" variant="secondary" icon={MessagesSquare} className="flex-col gap-1 py-3 text-sm">
              {t("app.me.action.message")}
            </Action>
            <Action
              variant="secondary"
              icon={ArrowRightLeft}
              className="flex-col gap-1 py-3 text-sm"
              disabled={!data.next || data.next.kind !== "shift"}
              onClick={() => data.next?.kind === "shift" && setDialog({ shift: data.next, mode: "cover" })}
            >
              {t("app.me.action.findCover")}
            </Action>
          </div>

          {/* ── Today ───────────────────────────────────────────────── */}
          {data.clock.entries.length ? <TodayCard clock={data.clock} t={t} language={language} money={money} now={now} /> : null}

          {/* ── Coming up ───────────────────────────────────────────── */}
          {data.upcoming?.length ? (
            <Card>
              <CardTitle action={<Link href="/app/me/schedule" className="text-xs font-semibold text-foreground underline">{t("app.me.seeSchedule")}</Link>}>
                {t("app.me.comingUp")}
              </CardTitle>
              <ul className="divide-y divide-border">
                {data.upcoming.map((i) => {
                  const w = whenWords(i.start, i.end, language, t, now);
                  return (
                    <li key={`${i.kind}:${i.id}`} className="flex items-center gap-3 py-2.5">
                      <KindChip kind={i.kind} t={t} />
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-semibold text-foreground">
                          {w.day} · {w.time}
                        </div>
                        <div className="truncate text-xs text-muted-foreground">
                          {[
                            i.title,
                            i.address,
                            // A call or a video call names itself where a visit names its street.
                            i.booking?.mode && i.booking.mode !== "visit"
                              ? bookingModeLine({ mode: i.booking.mode, phone: i.booking.phone, email: i.booking.email, language })
                              : null,
                          ]
                            .filter(Boolean)
                            .join(" · ") || t("app.me.noJob")}
                        </div>
                      </div>
                      {i.kind === "open" ? (
                        <button type="button" onClick={() => onClaimOpen(i, setDialog)} className="min-h-[44px] shrink-0 rounded-xl border border-border px-3 text-sm font-semibold text-foreground hover:bg-muted">
                          {i.myRequestId ? t("app.me.claimRequested") : t("app.me.claim")}
                        </button>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
            </Card>
          ) : null}

          {/* ── Shout-outs ──────────────────────────────────────────── */}
          <Card>
            <CardTitle
              action={
                <button type="button" onClick={() => setShout(true)} className="inline-flex min-h-[44px] items-center gap-1 text-xs font-semibold text-foreground underline">
                  <Megaphone size={14} /> {t("app.me.shoutouts.send")}
                </button>
              }
            >
              {t("app.me.shoutouts.title")}
            </CardTitle>
            {data.shoutOuts.length === 0 ? (
              <EmptyNote>{t("app.me.shoutouts.empty")}</EmptyNote>
            ) : (
              <ul className="space-y-3">
                {data.shoutOuts.map((s) => (
                  <li key={s.id} className={`flex gap-3 rounded-xl px-3 py-2.5 ${s.forMe ? "bg-emerald-50 dark:bg-emerald-950/30" : "bg-muted/40"}`}>
                    <PersonAvatar name={s.from.name} image={s.from.image} size="sm" />
                    <div className="min-w-0">
                      <div className="text-xs text-muted-foreground">
                        {t("app.me.shoutouts.fromTo", { from: s.from.name || "—", to: s.forMe ? t("app.me.shoutouts.you") : s.to.name || "—" })}
                      </div>
                      <div className="text-sm text-foreground">{s.message}</div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          {dialog ? (
            <RequestSheet dialog={dialog} onClose={() => setDialog(null)} onDone={async () => { setDialog(null); await reload(); }} />
          ) : null}
          {shout ? <ShoutOutSheet onClose={() => setShout(false)} onDone={async () => { setShout(false); await reload(); }} /> : null}
        </div>
      ) : null}
    </MeLoad>
  );
}

function onClaimOpen(item, setDialog) {
  if (item.myRequestId) return;
  setDialog({ shift: { id: item.id, start: item.start, end: item.end, job: item.job }, mode: "claim" });
}

/** The partners list is only needed once a sheet opens; loaded then. */
function RequestSheet({ dialog, onClose, onDone }) {
  const { data } = useMeData("/api/shift-requests");
  return (
    <ShiftRequestDialog
      shift={dialog.shift}
      mode={dialog.mode}
      partners={data?.partners || []}
      needsApproval={data?.needsApproval !== false}
      onClose={onClose}
      onDone={onDone}
    />
  );
}

function NextUp({ item, t, language, money, now, onCover, onTrade, onClaim, onRoster }) {
  if (!item) {
    return (
      <Card tone="accent">
        <div className="text-xs font-semibold uppercase tracking-[0.15em] opacity-70">{t("app.me.nextShift")}</div>
        <p className="mt-2 text-lg font-semibold">{onRoster ? t("app.me.noShiftsYet") : t("app.me.notOnRoster")}</p>
      </Card>
    );
  }
  const w = whenWords(item.start, item.end, language, t, now);
  const isShift = item.kind === "shift";
  const isOpen = item.kind === "open";
  return (
    <Card tone="accent">
      <div className="flex items-center justify-between">
        <div className="text-xs font-semibold uppercase tracking-[0.15em] opacity-70">
          {isShift ? t("app.me.nextShift") : t("app.me.nextUp")}
        </div>
        <span className="rounded-full bg-background/15 px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide">{t(`app.me.kind.${item.kind}`)}</span>
      </div>
      <div className="mt-1 text-2xl font-bold leading-tight">
        {w.day}, {w.time}
      </div>
      {item.title ? <div className="mt-2 text-base font-semibold">{item.title}{item.subtitle ? <span className="opacity-80"> · {item.subtitle}</span> : null}</div> : null}
      {item.address ? (
        <div className="mt-0.5 flex items-center gap-1.5 text-sm opacity-90">
          <MapPin size={14} /> {item.address}
        </div>
      ) : null}
      {/* A phone or video booking has nowhere to drive to; it says which it
          is and what to ring, in the reader's language, from the same words
          the client was sent. */}
      {item.booking?.mode && item.booking.mode !== "visit" ? (
        <div className="mt-0.5 flex items-center gap-1.5 text-sm opacity-90" data-booking-mode={item.booking.mode}>
          {item.booking.mode === "video" ? <Video size={14} /> : <Phone size={14} />}{" "}
          {bookingModeLine({ mode: item.booking.mode, phone: item.booking.phone, email: item.booking.email, language })}
        </div>
      ) : null}
      {item.label ? <div className="mt-0.5 text-sm opacity-80">{item.label}</div> : null}
      {item.estimate ? (
        <div className="mt-2 text-sm opacity-90">
          {t("app.me.estEarnings", { amount: money(item.estimate.amount), hours: item.estimate.hours.toFixed(2) })}
        </div>
      ) : null}
      {item.coworkers?.length ? (
        <div className="mt-3 flex items-center gap-2">
          <div className="flex -space-x-2">
            {item.coworkers.slice(0, 5).map((c) => (
              <PersonAvatar key={c.id} name={c.name} image={c.image} size="sm" className="ring-2 ring-foreground" />
            ))}
          </div>
          <span className="text-xs opacity-80">{t("app.me.withCoworkers", { names: item.coworkers.map((c) => c.name.split(" ")[0]).join(", ") })}</span>
        </div>
      ) : null}
      {item.note ? (
        <div className="mt-3 rounded-xl bg-background/10 px-3 py-2 text-sm">
          <div className="text-[11px] font-semibold uppercase tracking-wide opacity-70">{t("app.me.notesForShift")}</div>
          <div>{item.note}</div>
        </div>
      ) : null}
      {item.overridden ? <div className="mt-2 text-xs opacity-80">{t("app.scheduler.outsideAvailability")}</div> : null}
      {item.pendingRequest ? <div className="mt-2 text-xs opacity-80">{t("app.me.requestPending", { kind: t(`app.me.kindRequest.${item.pendingRequest.kind}`) })}</div> : null}

      <div className="mt-4 flex flex-wrap gap-2">
        {isShift && !item.pendingRequest ? (
          <>
            <button type="button" onClick={() => onCover(item)} className="inline-flex min-h-[44px] items-center gap-1.5 rounded-xl bg-background/15 px-3 text-sm font-semibold hover:bg-background/25">
              <Users size={15} /> {t("app.me.action.findCover")}
            </button>
            <button type="button" onClick={() => onTrade(item)} className="inline-flex min-h-[44px] items-center gap-1.5 rounded-xl bg-background/15 px-3 text-sm font-semibold hover:bg-background/25">
              <ArrowRightLeft size={15} /> {t("app.me.action.trade")}
            </button>
          </>
        ) : null}
        {isOpen ? (
          <button type="button" disabled={Boolean(item.myRequestId)} onClick={() => onClaim({ id: item.id, start: item.start, end: item.end, job: item.job })} className="inline-flex min-h-[44px] items-center gap-1.5 rounded-xl bg-background/15 px-3 text-sm font-semibold hover:bg-background/25 disabled:opacity-60">
            {item.myRequestId ? t("app.me.claimRequested") : t("app.me.openShiftClaim")}
          </button>
        ) : null}
        {item.kind === "visit" && item.href ? (
          <Link href={item.href} className="inline-flex min-h-[44px] items-center gap-1.5 rounded-xl bg-background/15 px-3 text-sm font-semibold hover:bg-background/25">
            <Navigation size={15} /> {t("app.me.action.openVisit")}
          </Link>
        ) : null}
        {item.kind === "appointment" ? (
          <Link href="/app/appointments" className="inline-flex min-h-[44px] items-center gap-1.5 rounded-xl bg-background/15 px-3 text-sm font-semibold hover:bg-background/25">
            {t("app.me.action.openAppointment")}
          </Link>
        ) : null}
        {item.kind === "task" ? (
          <Link href="/app/tasks" className="inline-flex min-h-[44px] items-center gap-1.5 rounded-xl bg-background/15 px-3 text-sm font-semibold hover:bg-background/25">
            {t("app.me.action.openTask")}
          </Link>
        ) : null}
      </div>
    </Card>
  );
}

function TodayCard({ clock, t, language, money, now }) {
  const first = clock.entries[0];
  const last = clock.entries[clock.entries.length - 1];
  const startMs = new Date(first.clockIn).getTime();
  const endMs = last.clockOut ? new Date(last.clockOut).getTime() : now.getTime();
  // The bar: from the first clock-in to now (or the last clock-out), over
  // a ten-hour scale so a normal day fills most of it and a long one hits
  // the edge rather than shrinking the rest.
  const span = Math.max(1, endMs - startMs);
  const scale = Math.max(span, 10 * 3_600_000);
  return (
    <Card>
      <CardTitle action={<Link href="/app/me/earnings" className="text-xs font-semibold text-foreground underline">{t("app.me.viewTimecard")}</Link>}>
        {t("app.me.when.today")}
      </CardTitle>
      <p className="text-lg font-semibold text-foreground">
        {clock.earnedToday != null
          ? t("app.me.earnedToday", { amount: money(clock.earnedToday), hours: hoursWords(clock.hoursToday, t) })
          : t("app.me.workedToday", { hours: hoursWords(clock.hoursToday, t) })}
      </p>
      <div className="mt-3 h-3 w-full overflow-hidden rounded-full bg-muted">
        <div className={`h-full rounded-full ${clock.open ? (clock.open.onBreak ? "bg-amber-500" : "bg-emerald-500") : "bg-foreground/70"}`} style={{ width: `${Math.min(100, (span / scale) * 100)}%` }} />
      </div>
      <div className="mt-1 flex justify-between text-xs text-muted-foreground tabular-nums">
        <span>{formatTimeOfDay(first.clockIn, language)}</span>
        <span>{last.clockOut ? formatTimeOfDay(last.clockOut, language) : clock.open?.onBreak ? t("app.me.onBreakNow") : t("app.me.stillOn")}</span>
      </div>
    </Card>
  );
}

function ShoutOutSheet({ onClose, onDone }) {
  const { t } = useTranslation();
  const { data } = useMeData("/api/shout-outs");
  const [toWorkerId, setTo] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const max = data?.max || 240;
  async function send() {
    setBusy(true);
    try {
      const res = await fetch("/api/shout-outs", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ toWorkerId, message }) });
      if (!res.ok) return reportResponseError(res, t("app.me.shoutouts.sendError"));
      await onDone();
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 backdrop-blur-sm sm:items-center sm:p-4" onClick={onClose}>
      <div role="dialog" aria-modal="true" className="fq-dialog-card w-full max-w-md rounded-t-2xl bg-card p-5 shadow-2xl sm:rounded-2xl pb-[calc(1.25rem+env(safe-area-inset-bottom))]" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-lg font-bold text-foreground">{t("app.me.shoutouts.send")}</h2>
        <label className="mt-3 block">
          <span className="text-sm font-medium text-foreground">{t("app.me.shoutouts.to")}</span>
          <select value={toWorkerId} onChange={(e) => setTo(e.target.value)} className="mt-1 w-full rounded-xl border border-border bg-background px-3 py-3 text-base">
            <option value="">{t("app.me.requests.pickColleague")}</option>
            {(data?.colleagues || []).map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
                {c.title ? ` — ${c.title}` : ""}
              </option>
            ))}
          </select>
        </label>
        <label className="mt-3 block">
          <span className="text-sm font-medium text-foreground">{t("app.me.shoutouts.message")}</span>
          <textarea value={message} onChange={(e) => setMessage(e.target.value.slice(0, max))} rows={3} className="mt-1 w-full rounded-xl border border-border bg-background px-3 py-3 text-base" placeholder={t("app.me.shoutouts.placeholder")} />
          <span className="mt-1 block text-right text-xs text-muted-foreground tabular-nums">
            {message.length}/{max}
          </span>
        </label>
        <div className="mt-3 grid grid-cols-2 gap-2">
          <Action variant="secondary" onClick={onClose}>{t("app.action.cancel")}</Action>
          <Action onClick={send} disabled={busy || !toWorkerId || !message.trim()} icon={Send}>{t("app.me.shoutouts.sendAction")}</Action>
        </div>
      </div>
    </div>
  );
}
