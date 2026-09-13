"use client";

// app/app/time-off/TeamTimeOff.js
//
// The manager's time-off screen, in the Homebase shape the owner sent:
//
//   left   Requests (N) — a table of what is waiting, ✓ / ✕ / › per row;
//          View history; Hours approved this year, filtered by type.
//   right  Upcoming time off (N) as cards; the Policies card, with the
//          blackout ranges and the "most off at once" number beside them.
//
// Same rows as before (GET /api/leave?scope=team), same PATCH to approve or
// decline, plus two things the route grew for this screen: `othersOff` on
// every request (who else is approved off on those dates — the
// max-concurrent rule showing its work in the details modal) and
// `hoursPerDay` per person (from their WorkingHours) so a request can be
// shown in hours the way the owner's screenshot does. No hours per day set
// means the row says days, not an invented 8.
//
// Phone: rows become cards, the details modal a bottom sheet.

import { useMemo, useState } from "react";
import Link from "next/link";
import { Check, ChevronRight, Info, Loader2, Plus, Settings, X } from "lucide-react";
import { fetchJson } from "@/lib/fetchJson";
import { useTranslation } from "@/app/hooks/useTranslation";
import { useCompanyMoney } from "@/app/providers/CompanyPreferencesProvider";
import Avatar, { initialsOf } from "@/app/components/chat/Avatar";
import { personTitle } from "@/lib/team/personLabel";
import { formatDateOnly, isoDateOnly } from "@/lib/format/companyDate";
import RequestForm from "./RequestForm";

const KIND_LABEL = { vacation: "Vacation", sick: "Sick", personal: "Personal", unpaid: "Unpaid", other: "Other" };

const date = (d) => formatDateOnly(d);
function range(a, b) {
  return isoDateOnly(a) === isoDateOnly(b) ? date(a) : `${date(a)} → ${date(b)}`;
}

/** "16 h" when the person has hours per day, else "2 days". */
function amountLabel(request, t) {
  const days = Number(request.days);
  if (request.hoursPerDay) {
    const hours = Math.round(days * request.hoursPerDay * 10) / 10;
    return t("app.timeOff.hoursShort", { hours });
  }
  return t("app.timeOff.daysCount", { days });
}

function kindLabel(kind, t) {
  return KIND_LABEL[kind] ? t(`app.setLeave.kind.${kind}`, KIND_LABEL[kind]) : kind || "";
}

export default function TeamTimeOff({ data, reload }) {
  const { t } = useTranslation();
  const [adding, setAdding] = useState(false);
  const [detail, setDetail] = useState(null);
  const [showHistory, setShowHistory] = useState(false);
  const [notice, setNotice] = useState("");

  const now = useMemo(() => new Date(), []);
  const pending = useMemo(() => (data?.requests || []).filter((r) => r.status === "pending"), [data]);
  const upcoming = useMemo(
    () =>
      (data?.requests || [])
        .filter((r) => r.status === "approved" && new Date(r.endDate) >= now)
        .sort((a, b) => new Date(a.startDate) - new Date(b.startDate)),
    [data, now],
  );
  const history = useMemo(
    () => (data?.requests || []).filter((r) => !pending.includes(r) && !upcoming.includes(r)),
    [data, pending, upcoming],
  );

  if (!data) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground py-10 justify-center">
        <Loader2 className="animate-spin" size={16} /> {t("app.state.loading")}
      </div>
    );
  }

  const canApprove = Boolean(data.canApprove);

  return (
    <div className="space-y-4">
      {/* ── Toolbar: the gear and Add time off ──────────────────────────── */}
      <div className="flex flex-wrap items-center justify-end gap-2">
        <Link
          href="/app/settings/leave"
          aria-label={t("app.timeOff.policySettings")}
          title={t("app.timeOff.policySettings")}
          className="inline-flex size-11 items-center justify-center rounded-lg border border-border text-muted-foreground hover:bg-muted hover:text-foreground"
        >
          <Settings size={16} />
        </Link>
        {canApprove && data.policies?.length > 0 && (
          <button
            type="button"
            onClick={() => setAdding((v) => !v)}
            className="inline-flex min-h-[44px] items-center gap-1.5 rounded-lg bg-inverted text-inverted-foreground px-4 text-sm font-medium"
          >
            <Plus size={15} /> {t("app.timeOff.addTimeOff")}
          </button>
        )}
      </div>

      {adding && (
        <RequestForm
          policies={data.policies}
          balances={[]}
          rules={data.rules}
          holidays={data.holidays || []}
          workers={data.workers || []}
          onDone={() => {
            setAdding(false);
            setNotice(t("app.timeOff.addedNotice"));
            reload();
          }}
          onCancel={() => setAdding(false)}
        />
      )}
      {notice && (
        <div className="flex items-start justify-between gap-2 rounded-lg border border-border bg-muted/40 px-3 py-2 text-sm text-foreground">
          <span className="flex items-start gap-2">
            <Check size={15} className="mt-0.5 shrink-0" /> {notice}
          </span>
          <button type="button" onClick={() => setNotice("")} aria-label={t("app.action.close")}>
            <X size={14} />
          </button>
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_20rem]">
        {/* ── Left column ─────────────────────────────────────────────── */}
        <div className="min-w-0 space-y-4">
          <section className="rounded-xl border border-border bg-card">
            <header className="flex items-center justify-between px-4 py-3 border-b border-border">
              <h2 className="font-semibold text-foreground">
                {t("app.timeOff.requestsCount", { n: pending.length })}
              </h2>
              <button
                type="button"
                onClick={() => setShowHistory((v) => !v)}
                className="text-xs font-medium text-foreground underline"
              >
                {showHistory ? t("app.timeOff.hideHistory") : t("app.timeOff.viewHistory")}
              </button>
            </header>
            {pending.length === 0 ? (
              <p className="px-4 py-6 text-sm text-muted-foreground">{t("app.timeOff.nothingToApprove")}</p>
            ) : (
              <RequestTable
                rows={pending}
                canActFor={(r) => (r.routing ? r.routing.canAct : canApprove)}
                onDetail={setDetail}
                reload={reload}
                t={t}
              />
            )}
            {pending.length > 0 && !pending.some((r) => (r.routing ? r.routing.canAct : canApprove)) && (
              <p className="px-4 pb-3 text-xs text-muted-foreground flex items-start gap-1.5">
                <Info size={13} className="mt-0.5 shrink-0" />
                {t("app.timeOff.viewOnly")}
              </p>
            )}
            {showHistory && (
              <div className="border-t border-border">
                <h3 className="px-4 pt-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  {t("app.timeOff.earlier")}
                </h3>
                {history.length === 0 ? (
                  <p className="px-4 py-4 text-sm text-muted-foreground">{t("app.timeOff.noHistory")}</p>
                ) : (
                  <RequestTable rows={history.slice(0, 40)} canActFor={() => false} onDetail={setDetail} reload={reload} t={t} />
                )}
              </div>
            )}
          </section>

          <HoursApproved data={data} t={t} />
        </div>

        {/* ── Right column ────────────────────────────────────────────── */}
        <div className="space-y-4">
          <section className="rounded-xl border border-border bg-card p-4">
            <h2 className="font-semibold text-foreground mb-2">
              {t("app.timeOff.upcomingCount", { n: upcoming.length })}
            </h2>
            {upcoming.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t("app.timeOff.noneUpcoming")}</p>
            ) : (
              <ul className="space-y-2">
                {upcoming.slice(0, 12).map((r) => (
                  <li key={r.id}>
                    <button
                      type="button"
                      onClick={() => setDetail(r)}
                      className="w-full rounded-lg border border-border px-3 py-2 text-left hover:bg-muted/60"
                    >
                      <div className="flex items-center gap-2">
                        <Avatar initials={initialsOf(r.worker?.name || "")} size="sm" tone="them" />
                        <div className="min-w-0">
                          <div className="truncate text-sm font-semibold text-foreground">{r.worker?.name}</div>
                          <div className="text-xs text-muted-foreground">
                            {range(r.startDate, r.endDate)} · {r.policy?.name}
                          </div>
                        </div>
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <PoliciesCard data={data} t={t} />
        </div>
      </div>

      {detail && (
        <DetailModal
          request={detail}
          canAct={detail.status === "pending" && (detail.routing ? detail.routing.canAct : canApprove)}
          onClose={() => setDetail(null)}
          reload={() => {
            setDetail(null);
            reload();
          }}
          t={t}
        />
      )}
    </div>
  );
}

// ── The requests table (cards on a phone) ───────────────────────────────────

function RequestTable({ rows, canActFor, onDetail, reload, t }) {
  return (
    <>
      {/* ≥ sm: a table */}
      <div className="hidden sm:block overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-left text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-4 py-2">{t("app.timeOff.person")}</th>
              <th className="px-4 py-2 min-w-[11rem]">{t("app.timeOff.category")}</th>
              <th className="px-4 py-2">{t("app.timeOff.dates")}</th>
              <th className="px-4 py-2 text-right">{t("app.timeOff.total")}</th>
              <th className="w-px px-2 py-2" />
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <RequestTr key={r.id} request={r} canAct={canActFor(r)} onDetail={onDetail} reload={reload} t={t} />
            ))}
          </tbody>
        </table>
      </div>
      {/* < sm: cards */}
      <ul className="sm:hidden divide-y divide-border">
        {rows.map((r) => (
          <li key={r.id} className="px-4 py-3">
            <RequestCard request={r} canAct={canActFor(r)} onDetail={onDetail} reload={reload} t={t} />
          </li>
        ))}
      </ul>
    </>
  );
}

function useAct(request, reload) {
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  async function act(action) {
    setBusy(action);
    setError("");
    try {
      await fetchJson(`/api/leave/${request.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      reload();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy("");
    }
  }
  return { busy, error, act };
}

function ActionButtons({ request, canAct, busy, act, onDetail, t }) {
  return (
    <div className="flex items-center gap-1">
      {canAct && request.status === "pending" && (
        <>
          <button
            type="button"
            onClick={() => act("approve")}
            disabled={Boolean(busy)}
            aria-label={t("app.timeOff.approve")}
            title={t("app.timeOff.approve")}
            className="inline-flex size-10 items-center justify-center rounded-lg bg-emerald-600 text-white disabled:opacity-60"
          >
            {busy === "approve" ? <Loader2 size={14} className="animate-spin" /> : <Check size={16} />}
          </button>
          <button
            type="button"
            onClick={() => act("decline")}
            disabled={Boolean(busy)}
            aria-label={t("app.timeOff.decline")}
            title={t("app.timeOff.decline")}
            className="inline-flex size-10 items-center justify-center rounded-lg border border-border text-foreground disabled:opacity-60"
          >
            {busy === "decline" ? <Loader2 size={14} className="animate-spin" /> : <X size={16} />}
          </button>
        </>
      )}
      <button
        type="button"
        onClick={() => onDetail(request)}
        aria-label={t("app.timeOff.details")}
        title={t("app.timeOff.details")}
        className="inline-flex size-10 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground"
      >
        <ChevronRight size={18} />
      </button>
    </div>
  );
}

function RequestTr({ request, canAct, onDetail, reload, t }) {
  const { busy, error, act } = useAct(request, reload);
  return (
    <>
      <tr className="border-t border-border align-top">
        <td className="px-4 py-2.5">
          <div className="flex items-center gap-2">
            <Avatar initials={initialsOf(request.worker?.name || "")} size="sm" tone="them" />
            <div className="min-w-0">
              <div className="truncate font-semibold text-foreground">{request.worker?.name}</div>
              {personTitle(request.worker) && (
                <div className="truncate text-xs text-muted-foreground">{personTitle(request.worker)}</div>
              )}
            </div>
          </div>
        </td>
        <td className="px-4 py-2.5">
          <div className="text-foreground">
            {request.policy?.name}
            <span className="text-muted-foreground"> · {kindLabel(request.policy?.kind, t)}</span>
          </div>
          <div className="text-xs text-muted-foreground">
            {t("app.timeOff.submittedOn", { date: date(request.createdAt) })}
          </div>
        </td>
        <td className="px-4 py-2.5 whitespace-nowrap text-foreground">{range(request.startDate, request.endDate)}</td>
        <td className="px-4 py-2.5 text-right tabular-nums text-foreground">{amountLabel(request, t)}</td>
        <td className="w-px whitespace-nowrap px-2 py-1.5 text-right">
          <ActionButtons request={request} canAct={canAct} busy={busy} act={act} onDetail={onDetail} t={t} />
        </td>
      </tr>
      {error && (
        <tr>
          <td colSpan={5} className="px-4 pb-2 text-xs text-red-700 dark:text-red-300">
            {error}
          </td>
        </tr>
      )}
    </>
  );
}

function RequestCard({ request, canAct, onDetail, reload, t }) {
  const { busy, error, act } = useAct(request, reload);
  return (
    <div>
      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <Avatar initials={initialsOf(request.worker?.name || "")} size="sm" tone="them" />
          <div className="min-w-0">
            <div className="truncate text-sm font-semibold text-foreground">{request.worker?.name}</div>
            <div className="text-xs text-muted-foreground">
              {request.policy?.name} · {kindLabel(request.policy?.kind, t)}
            </div>
          </div>
        </div>
        <ActionButtons request={request} canAct={canAct} busy={busy} act={act} onDetail={onDetail} t={t} />
      </div>
      <div className="mt-1 text-sm text-foreground">
        {range(request.startDate, request.endDate)} · {amountLabel(request, t)}
      </div>
      <div className="text-xs text-muted-foreground">{t("app.timeOff.submittedOn", { date: date(request.createdAt) })}</div>
      {error && <p className="mt-1 text-xs text-red-700 dark:text-red-300">{error}</p>}
    </div>
  );
}

// ── Hours approved this year, by type ───────────────────────────────────────

function HoursApproved({ data, t }) {
  const years = useMemo(() => {
    const set = new Set([new Date().getUTCFullYear()]);
    for (const r of data.requests || []) set.add(new Date(r.startDate).getUTCFullYear());
    return [...set].sort((a, b) => b - a);
  }, [data]);
  const [year, setYear] = useState(years[0]);
  const [kind, setKind] = useState("");

  const kinds = useMemo(() => {
    const set = new Set((data.policies || []).map((p) => p.kind).filter(Boolean));
    return [...set];
  }, [data]);

  const rows = useMemo(() => {
    const byWorkerKind = new Map();
    for (const r of data.requests || []) {
      if (r.status !== "approved") continue;
      if (new Date(r.startDate).getUTCFullYear() !== year) continue;
      const k = r.policy?.kind || "other";
      if (kind && k !== kind) continue;
      const key = `${r.workerId}|${k}`;
      const cur = byWorkerKind.get(key) || { workerId: r.workerId, name: r.worker?.name || "", kind: k, days: 0, hours: 0, hoursKnown: true };
      cur.days += Number(r.days);
      if (r.hoursPerDay) cur.hours += Number(r.days) * r.hoursPerDay;
      else cur.hoursKnown = false;
      byWorkerKind.set(key, cur);
    }
    return [...byWorkerKind.values()].sort((a, b) => a.name.localeCompare(b.name) || a.kind.localeCompare(b.kind));
  }, [data, year, kind]);

  return (
    <section className="rounded-xl border border-border bg-card">
      <header className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 border-b border-border">
        <h2 className="font-semibold text-foreground flex items-center gap-2">
          {t("app.timeOff.hoursApproved")}
          <select
            value={year}
            onChange={(e) => setYear(Number(e.target.value))}
            aria-label={t("app.timeOff.year")}
            className="rounded-lg border border-border bg-background px-2 py-1 text-sm font-normal"
          >
            {years.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
        </h2>
        <div className="flex flex-wrap gap-1">
          <Chip active={kind === ""} onClick={() => setKind("")} label={t("app.timeOff.allTypes")} />
          {kinds.map((k) => (
            <Chip key={k} active={kind === k} onClick={() => setKind(k)} label={kindLabel(k, t)} />
          ))}
        </div>
      </header>
      {rows.length === 0 ? (
        <p className="px-4 py-6 text-sm text-muted-foreground">{t("app.timeOff.noApprovedYet")}</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-4 py-2">{t("app.timeOff.person")}</th>
                <th className="px-4 py-2">{t("app.timeOff.type")}</th>
                <th className="px-4 py-2 text-right">{t("app.timeOff.hoursApprovedCol")}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={`${r.workerId}-${r.kind}`} className="border-t border-border">
                  <td className="px-4 py-2 text-foreground">{r.name}</td>
                  <td className="px-4 py-2 text-muted-foreground">{kindLabel(r.kind, t)}</td>
                  <td className="px-4 py-2 text-right tabular-nums text-foreground">
                    {r.hoursKnown
                      ? t("app.timeOff.hoursShort", { hours: Math.round(r.hours * 10) / 10 })
                      : t("app.timeOff.daysCount", { days: Math.round(r.days * 100) / 100 })}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function Chip({ active, onClick, label }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`rounded-full border px-2.5 py-1 text-xs font-medium ${
        active ? "border-foreground bg-inverted text-inverted-foreground" : "border-border text-muted-foreground hover:bg-muted"
      }`}
    >
      {label}
    </button>
  );
}

// ── Policies, with the limits beside them ───────────────────────────────────

function PoliciesCard({ data, t }) {
  const members = useMemo(() => {
    const byPolicy = {};
    for (const b of data.balances || []) (byPolicy[b.policyId] ||= new Set()).add(b.workerId);
    return byPolicy;
  }, [data]);
  const rules = data.rules || { blackouts: [], maxConcurrent: null };
  return (
    <section className="rounded-xl border border-border bg-card p-4">
      <div className="flex items-center justify-between mb-2">
        <h2 className="font-semibold text-foreground">{t("app.timeOff.policies")}</h2>
        <Link href="/app/settings/leave" className="text-xs font-medium text-foreground underline">
          {t("app.action.edit")}
        </Link>
      </div>
      {data.policies?.length ? (
        <ul className="divide-y divide-border">
          {data.policies.map((p) => (
            <li key={p.id} className="flex items-center justify-between gap-2 py-1.5 text-sm">
              <span className="min-w-0 truncate text-foreground">
                {p.name}
                <span className="text-muted-foreground"> · {kindLabel(p.kind, t)}</span>
              </span>
              <span className="shrink-0 text-xs text-muted-foreground">
                {t("app.timeOff.memberCount", { n: members[p.id]?.size || 0 })}
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-muted-foreground">{t("app.timeOff.noPoliciesShort")}</p>
      )}
      <div className="mt-3 border-t border-border pt-3 space-y-1.5 text-xs">
        <div className="flex items-center justify-between gap-2">
          <span className="text-muted-foreground">{t("app.timeOff.maxOffLabel")}</span>
          <span className="font-semibold text-foreground">
            {rules.maxConcurrent == null ? t("app.timeOff.noLimit") : rules.maxConcurrent}
          </span>
        </div>
        <div>
          <span className="text-muted-foreground">{t("app.timeOff.blackoutsLabel")}</span>
          {rules.blackouts?.length ? (
            <ul className="mt-1 space-y-0.5">
              {rules.blackouts.map((b) => (
                <li key={`${b.from}-${b.to}`} className="text-foreground">
                  {date(b.from)} → {date(b.to)}
                  {b.label ? <span className="text-muted-foreground"> — {b.label}</span> : null}
                </li>
              ))}
            </ul>
          ) : (
            <span className="ml-1 text-foreground">{t("app.timeOff.noBlackouts")}</span>
          )}
        </div>
        {data.holidayRegion && data.holidays?.length > 0 && (
          <div className="text-muted-foreground">
            {t("app.timeOff.holidayCalendar", {
              n: data.holidays.filter((h) => h.observed.startsWith(String(new Date().getUTCFullYear()))).length,
              region: data.holidayRegion.province ? `${data.holidayRegion.country}-${data.holidayRegion.province}` : data.holidayRegion.country,
            })}
          </div>
        )}
      </div>
    </section>
  );
}

// ── The details modal / bottom sheet ────────────────────────────────────────

function DetailModal({ request, canAct, onClose, reload, t }) {
  const money = useCompanyMoney();
  const { busy, error, act } = useAct(request, reload);
  const others = request.othersOff || [];
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center sm:justify-center" role="dialog" aria-modal="true">
      <button type="button" aria-label={t("app.action.close")} onClick={onClose} className="absolute inset-0 bg-black/40" />
      <div className="relative w-full max-h-[90vh] overflow-y-auto rounded-t-2xl bg-card p-5 shadow-xl sm:max-w-lg sm:rounded-2xl">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2">
            <Avatar initials={initialsOf(request.worker?.name || "")} size="md" tone="them" />
            <div>
              <h2 className="text-base font-bold text-foreground">{request.worker?.name}</h2>
              {personTitle(request.worker) && <div className="text-xs text-muted-foreground">{personTitle(request.worker)}</div>}
            </div>
          </div>
          <button type="button" onClick={onClose} aria-label={t("app.action.close")} className="inline-flex size-10 items-center justify-center rounded-lg hover:bg-muted">
            <X size={18} />
          </button>
        </div>

        <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
          <div className="col-span-2">
            <dt className="text-xs text-muted-foreground">{t("app.timeOff.category")}</dt>
            <dd className="text-foreground">
              {request.policy?.name} · {kindLabel(request.policy?.kind, t)}
              <span className="block text-xs text-muted-foreground">{t("app.timeOff.submittedOn", { date: date(request.createdAt) })}</span>
            </dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">{t("app.timeOff.firstDay")}</dt>
            <dd className="text-foreground">{date(request.startDate)}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">{t("app.timeOff.lastDay")}</dt>
            <dd className="text-foreground">{date(request.endDate)}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">{t("app.timeOff.timeRequested")}</dt>
            <dd className="text-foreground tabular-nums">{amountLabel(request, t)}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">{t("app.timeOff.postBalance")}</dt>
            <dd className="text-foreground tabular-nums">
              <PostBalance request={request} money={money} t={t} />
            </dd>
          </div>
          {request.reason && (
            <div className="col-span-2">
              <dt className="text-xs text-muted-foreground">{t("app.timeOff.noteLabel")}</dt>
              <dd className="italic text-foreground">“{request.reason}”</dd>
            </div>
          )}
          {request.reviewNote && (
            <div className="col-span-2">
              <dt className="text-xs text-muted-foreground">{t("app.timeOff.managerNote")}</dt>
              <dd className="text-foreground">{request.reviewNote}</dd>
            </div>
          )}
          <div className="col-span-2">
            <dt className="text-xs text-muted-foreground">{t("app.timeOff.othersOff")}</dt>
            <dd className="text-foreground">
              {others.length === 0 ? (
                t("app.timeOff.noOthersOff")
              ) : (
                <ul className="mt-0.5 space-y-0.5">
                  {others.map((o) => (
                    <li key={o.workerId}>
                      {o.workerName}
                      <span className="text-muted-foreground">
                        {" "}· {range(o.startDate, o.endDate)}
                        {o.policyName ? ` · ${o.policyName}` : ""}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </dd>
          </div>
          {request.status === "pending" && request.routing?.label && (
            <div className="col-span-2 text-xs text-muted-foreground">
              {request.routing.label}
              {request.routing.note ? <span className="block text-amber-600 dark:text-amber-400">{request.routing.note}</span> : null}
            </div>
          )}
        </dl>

        {error && (
          <div className="mt-3 rounded-lg bg-red-50 dark:bg-red-950/30 px-3 py-2 text-sm text-red-700 dark:text-red-300">{error}</div>
        )}

        {canAct && (
          <div className="mt-4 flex gap-2">
            <button
              type="button"
              onClick={() => act("decline")}
              disabled={Boolean(busy)}
              className="inline-flex min-h-[44px] flex-1 items-center justify-center gap-1.5 rounded-lg border border-border text-sm font-medium disabled:opacity-60"
            >
              {busy === "decline" ? <Loader2 size={14} className="animate-spin" /> : <X size={14} />}
              {t("app.timeOff.decline")}
            </button>
            <button
              type="button"
              onClick={() => act("approve")}
              disabled={Boolean(busy)}
              className="inline-flex min-h-[44px] flex-1 items-center justify-center gap-1.5 rounded-lg bg-emerald-600 text-sm font-semibold text-white disabled:opacity-60"
            >
              {busy === "approve" ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
              {t("app.timeOff.approve")}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

/** Balance after this request, from the balances the same payload carries. */
function PostBalance({ request, money, t }) {
  const data = request.balanceAfter;
  if (data === undefined) return <span className="text-muted-foreground">{t("app.timeOff.postBalanceUnknown")}</span>;
  if (data === null) return <span className="text-muted-foreground">{t("app.timeOff.unpaidNoBalance")}</span>;
  return data.isMoney ? money(data.remaining) : t("app.timeOff.daysCount", { days: data.remaining });
}
