// app/portal/[token]/PlansAndVisits.js
//
// The portal's "when is somebody coming?" half: the next visit, the client's
// service plans with their next dates, and the upcoming / past visit lists.
//
// Draws only what GET /api/portal/[token] sends — lib/portal/view.js built
// every item field by field — and the one thing a client can DO here is ask:
// "Request to reschedule" on a visit, "Skip this visit" on a plan date. Both
// file a to-do for the office (lib/portal/changeRequest.js); nothing on this
// page moves a date, and the sentence under the button says so.
//
// Colours come from the company's one brand hex through lib/documents/theme.js
// — accentText for the kickers (measured against white, 4.5:1), fillPair for
// the button, washPair for the next-visit panel — never the raw hex as text,
// which is how a yellow or mid-grey brand becomes unreadable.
"use client";

import { useMemo, useState } from "react";
import { CalendarClock, CalendarSync, History, Loader2, MapPin, User, Check, Phone, Video } from "lucide-react";
import { documentTheme, fillPair, washPair } from "@/lib/documents/theme";
import { jsonBody } from "@/lib/jsonBody";

const INK = "#2d2520";
// Secondary text on white: #2d2520 at 72% measures 5.9:1 on #ffffff — the
// /50 the older cards use is 3.2:1, under the bar for 12px text.
const MUTED = "text-[#2d2520]/[0.72]";

function makeFormatters(locale, timeZone) {
  const tz = timeZone || undefined;
  const safe = (fn) => (v) => {
    try {
      return fn(v);
    } catch {
      return new Date(v).toISOString().slice(0, 16).replace("T", " ");
    }
  };
  return {
    day: safe((v) => new Date(v).toLocaleDateString(locale, { weekday: "long", month: "long", day: "numeric", timeZone: tz })),
    shortDay: safe((v) => new Date(v).toLocaleDateString(locale, { weekday: "short", month: "short", day: "numeric", timeZone: tz })),
    time: safe((v) => new Date(v).toLocaleTimeString(locale, { hour: "numeric", minute: "2-digit", timeZone: tz })),
    // Plan dates are calendar dates stored as UTC midnight.
    planDay: safe((v) => new Date(v).toLocaleDateString(locale, { weekday: "short", month: "long", day: "numeric", timeZone: "UTC" })),
  };
}

export default function PlansAndVisits({ plans = [], visits = {}, token, copy, locale, timeZone, money, date, brandColor, companyName, onReportIssue = null }) {
  const c = copy.portal;
  const theme = useMemo(() => documentTheme({ brandColor }), [brandColor]);
  const fill = useMemo(() => fillPair(theme), [theme]);
  const wash = useMemo(() => washPair(theme), [theme]);
  const f = useMemo(() => makeFormatters(locale, timeZone), [locale, timeZone]);

  // Requests sent from this page since it loaded, keyed like the server's.
  const [sent, setSent] = useState(() => new Set());
  const [open, setOpen] = useState(null); // { key, kind, id, occurrence, action }
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const keyOf = (kind, id, occurrence) => `${kind}:${id}:${occurrence || "-"}`;

  async function submit() {
    if (!open) return;
    setBusy(true);
    setError("");
    try {
      const res = await fetch(`/api/portal/${token}/change-request`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: jsonBody(
          { kind: open.kind, id: open.id, occurrence: open.occurrence || null, action: open.action, message: note },
          "change request",
        ),
      });
      const d = await res.json().catch(() => null);
      if (!res.ok) {
        setError(d?.error === "too_late" ? c.requestTooLate : c.requestFailed);
        return;
      }
      setSent((prev) => new Set(prev).add(open.key));
      setOpen(null);
      setNote("");
    } catch {
      setError(c.requestFailed);
    } finally {
      setBusy(false);
    }
  }

  const upcoming = visits.upcoming || [];
  const past = visits.past || [];
  const next = visits.next || null;
  const later = next ? upcoming.filter((v) => !(v.kind === next.kind && v.id === next.id)) : upcoming;

  if (!next && plans.length === 0 && upcoming.length === 0 && past.length === 0) return null;

  const whenLine = (v) => {
    const day = f.day(v.at);
    if (v.windowStart && v.windowEnd) return `${day} · ${c.between(f.time(v.windowStart), f.time(v.windowEnd))}`;
    return `${day} · ${c.at(f.time(v.at))}`;
  };
  const typeLabel = (v) =>
    ({ crew: c.typeVisit, return: c.typeReturn, appointment: c.typeAppointment, call: c.typeCall, video: c.typeVideo })[v.type] || c.typeVisit;

  // The ask, inline under the row it is about. One open at a time.
  const requestControl = ({ kind, id, occurrence, action, requested, canRequest }) => {
    const key = keyOf(kind, id, occurrence);
    if (requested || sent.has(key)) {
      return (
        <span data-portal-requested className="inline-flex items-center gap-1.5 text-xs font-semibold text-green-800 bg-green-50 border border-green-200 rounded-full px-2.5 py-1">
          <Check size={12} /> {c.requested}
        </span>
      );
    }
    if (!canRequest) return <span className={`text-xs ${MUTED}`}>{c.callToChange}</span>;
    if (open?.key === key) return null;
    return (
      <button
        type="button"
        data-portal-request={action}
        onClick={() => {
          setOpen({ key, kind, id, occurrence, action });
          setNote("");
          setError("");
        }}
        className="inline-flex items-center min-h-11 text-sm font-semibold underline"
        style={{ color: INK }}
      >
        {action === "skip" ? c.skip : c.reschedule}
      </button>
    );
  };

  const requestForm = (key) =>
    open?.key === key ? (
      <div className="mt-2 rounded-xl border border-black/10 p-3 bg-[#faf8f5]">
        <label className="block text-xs font-semibold" style={{ color: INK }}>
          {open.action === "skip" ? c.skipQuestion : c.rescheduleQuestion}
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={2}
            maxLength={1000}
            placeholder={c.requestPlaceholder}
            className="mt-1.5 w-full rounded-lg border border-black/15 bg-white px-3 py-2 text-sm font-normal"
          />
        </label>
        <p className={`text-xs mt-1.5 ${MUTED}`}>{c.requestExplain(companyName)}</p>
        {error && <p className="text-xs text-red-700 mt-1.5">{error}</p>}
        <div className="flex items-center gap-3 mt-2.5">
          <button
            type="button"
            onClick={submit}
            disabled={busy}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-semibold disabled:opacity-60"
            style={{ backgroundColor: fill.bg, color: fill.fg }}
          >
            {busy && <Loader2 size={13} className="animate-spin" />}
            {c.requestSend}
          </button>
          <button type="button" onClick={() => setOpen(null)} className="text-sm font-semibold underline min-h-11" style={{ color: INK }}>
            {c.cancel}
          </button>
        </div>
      </div>
    ) : null;

  const typeIcon = (type, size = 14) =>
    type === "call" ? <Phone size={size} /> : type === "video" ? <Video size={size} /> : <CalendarClock size={size} />;

  return (
    <>
      {next && (
        <div className="rounded-2xl p-5 sm:p-6 mb-6 border border-black/10" style={{ backgroundColor: wash.bg }} data-portal-next-visit>
          <div className="text-[10.5px] font-bold tracking-[0.1em] uppercase" style={{ color: wash.accent }}>
            {c.nextVisitKicker}
          </div>
          <div className="flex items-start gap-3 mt-1.5">
            <span className="mt-0.5 shrink-0" style={{ color: wash.accent }}>
              {typeIcon(next.type, 18)}
            </span>
            <div className="min-w-0 flex-1">
              <div className="text-lg font-bold leading-snug" style={{ color: wash.ink }}>
                {whenLine(next)}
              </div>
              <div className="text-sm mt-1" style={{ color: wash.muted }}>
                {[typeLabel(next), next.title].filter(Boolean).join(" · ")}
              </div>
              {next.crew && (
                <div className="flex items-center gap-1.5 text-sm mt-1" style={{ color: wash.muted }}>
                  <User size={13} className="shrink-0" /> {c.withCrew(next.crew)}
                </div>
              )}
              {next.address && (
                <div className="flex items-center gap-1.5 text-sm mt-1" style={{ color: wash.muted }}>
                  <MapPin size={13} className="shrink-0" /> {next.address}
                </div>
              )}
              <div className="mt-2">
                {requestControl({ kind: next.kind, id: next.id, action: "reschedule", requested: next.requested, canRequest: next.canRequest })}
              </div>
              {requestForm(keyOf(next.kind, next.id))}
            </div>
          </div>
        </div>
      )}

      {plans.map((p) => (
        <div key={p.id} className="bg-white border border-black/10 rounded-2xl p-5 sm:p-6 mb-6" data-portal-plan={p.id}>
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div className="min-w-0">
              <div className="text-[10.5px] font-bold tracking-[0.1em] uppercase" style={{ color: theme.accentText }}>
                {c.planKicker}
              </div>
              <div className="font-semibold text-base mt-0.5" style={{ color: INK }}>
                {p.name}
              </div>
              <div className={`text-sm mt-0.5 ${MUTED}`}>{c.frequency[p.frequency] || ""}</div>
            </div>
            <div className="text-right shrink-0">
              <div className="font-bold tabular-nums" style={{ color: INK }}>
                {c.perVisit(money(p.perVisit))}
              </div>
              {p.taxIncluded && <div className={`text-xs ${MUTED}`}>{c.taxIncluded}</div>}
              {p.discountPct > 0 && (
                <div className="text-xs font-semibold text-green-800 mt-0.5">{c.memberDiscount(Number(p.discountPct).toLocaleString(locale))}</div>
              )}
            </div>
          </div>

          {p.serviceName && (
            <div className="mt-3 text-sm" style={{ color: INK }}>
              <span className={`text-xs font-semibold uppercase tracking-wide ${MUTED}`}>{c.included}</span>
              <div className="mt-0.5">{p.serviceName}</div>
            </div>
          )}

          {p.dates?.length > 0 && (
            <div className="mt-3">
              <div className={`text-xs font-semibold uppercase tracking-wide ${MUTED}`}>{c.nextDates}</div>
              <div className="divide-y divide-black/5">
                {p.dates.map((d) => {
                  const key = keyOf("plan", p.id, d.occurrence);
                  return (
                    <div key={d.occurrence} className="py-1.5">
                      <div className="flex items-center justify-between gap-3 flex-wrap">
                        <span className="flex items-center gap-2 text-sm" style={{ color: INK }}>
                          <CalendarSync size={14} className="shrink-0" style={{ color: theme.accentText }} />
                          {f.planDay(d.at)}
                        </span>
                        {requestControl({ kind: "plan", id: p.id, occurrence: d.occurrence, action: "skip", requested: d.requested, canRequest: d.canRequest })}
                      </div>
                      {requestForm(key)}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {(p.endsOn || p.visitsSold) && (
            <p className={`text-xs mt-3 ${MUTED}`}>
              {p.endsOn ? c.endsOn(date(p.endsOn)) : c.visitsSold(p.visitsSold)}
            </p>
          )}
        </div>
      ))}

      {later.length > 0 && (
        <VisitSection icon={CalendarClock} title={c.upcomingHeading}>
          {later.map((v) => (
            <div key={`${v.kind}:${v.id}`} className="py-3" data-portal-upcoming={v.id}>
              <div className="flex items-start justify-between gap-x-4 gap-y-1 flex-wrap">
                <div className="min-w-0">
                  <div className="font-medium text-sm" style={{ color: INK }}>
                    {whenLine(v)}
                  </div>
                  <div className={`text-xs mt-0.5 ${MUTED}`}>
                    {[typeLabel(v), v.title, v.crew ? c.withCrew(v.crew) : null].filter(Boolean).join(" · ")}
                  </div>
                </div>
                {requestControl({ kind: v.kind, id: v.id, action: "reschedule", requested: v.requested, canRequest: v.canRequest })}
              </div>
              {requestForm(keyOf(v.kind, v.id))}
            </div>
          ))}
        </VisitSection>
      )}

      {past.length > 0 && (
        <VisitSection icon={History} title={c.pastHeading}>
          {past.map((v) => (
            <div key={`${v.kind}:${v.id}`} className="py-3" data-portal-past={v.id}>
              <div className="flex items-start justify-between gap-3">
                <div className="font-medium text-sm" style={{ color: INK }}>
                  {f.shortDay(v.at)}
                </div>
                {/* Something wrong after a crew visit — the ticket is filed
                    about THIS visit (and so its job), proved server-side. */}
                {onReportIssue && v.kind === "visit" && (
                  <button
                    type="button"
                    data-portal-report-visit={v.id}
                    onClick={() => onReportIssue({ jobVisitId: v.id, label: f.shortDay(v.at) })}
                    className="text-xs font-semibold underline shrink-0"
                    style={{ color: INK }}
                  >
                    {c.tickets.reportOnVisit}
                  </button>
                )}
              </div>
              <div className={`text-xs mt-0.5 ${MUTED}`}>
                {[typeLabel(v), v.title, v.crew ? c.withCrew(v.crew) : null].filter(Boolean).join(" · ")}
              </div>
              {v.photos?.length > 0 && (
                <div className="flex gap-1.5 mt-2 flex-wrap">
                  {v.photos.map((p) => (
                    <a key={p.id} href={p.url} target="_blank" rel="noopener noreferrer">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={p.url} alt={c.photoAlt} className="w-20 h-16 object-cover rounded-lg border border-black/10" loading="lazy" />
                    </a>
                  ))}
                </div>
              )}
            </div>
          ))}
        </VisitSection>
      )}
    </>
  );
}

function VisitSection({ icon: Icon, title, children }) {
  return (
    <div className="bg-white border border-black/10 rounded-2xl px-6 py-2 mb-6">
      <h2 className="flex items-center gap-2 font-semibold pt-4 pb-1" style={{ color: INK }}>
        <Icon size={16} className="text-[#2d2520]/60" />
        {title}
      </h2>
      <div className="divide-y divide-black/5">{children}</div>
    </div>
  );
}
