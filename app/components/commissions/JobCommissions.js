"use client";

// app/components/commissions/JobCommissions.js
//
// The job page's Commissions card: who earns on this job, on what terms, what
// they would earn if every invoice were collected, and what they HAVE earned
// — commission is earned on money collected, so a sent invoice shows a
// potential and an earned figure of $0 until the client pays.
//
// Three readers, one card:
//   • payroll view_all — everyone's figures, and the editor: splits, a fixed
//     override, the lines each person earns on, add/remove, reset, the
//     change history, and "Recalculate" when the ledger is behind.
//   • jobCosting — everyone's figures, read only.
//   • anyone else — their own row, if they earn on this job, and nothing
//     else; the server filters it (lib/commissions/access.js).
//
// Renders nothing while commissions are off, and nothing for a reader with no
// row and no right to see anyone else's.

import { useCallback, useEffect, useMemo, useState } from "react";
import { Percent, Loader2, AlertTriangle, RotateCcw, Plus, Trash2, History, Pencil } from "lucide-react";
import { fetchJson } from "@/lib/fetchJson";
import { useTranslation } from "@/app/hooks/useTranslation";
import { useCompanyMoney } from "@/app/providers/CompanyPreferencesProvider";
import { evenSplits, toCents } from "@/lib/commissions/compute";
import { formatShortDate } from "@/lib/format/localeDate";

const cell = "rounded-lg border border-border bg-background px-2 py-1.5 text-sm tabular-nums";

function roleLabel(t, role) {
  return role === "sold" ? t("app.commissions.soldBy") : t("app.commissions.workedBy");
}

/**
 * One audit change in the reader's language. The route stores changes as data
 * ({ kind, name, role, from, to }); an older row that stored a plain string
 * is printed as it was written rather than dropped.
 */
function auditSentence(t, money, c) {
  if (typeof c === "string") return c;
  const who = `${c.name || t("app.commissions.someone")} (${roleLabel(t, c.role)})`;
  switch (c.kind) {
    case "reset":
      return t("app.commissions.audit.reset");
    case "added":
      return t("app.commissions.audit.added", { who, split: c.to });
    case "removed":
      return t("app.commissions.audit.removed", { who });
    case "split":
      return t("app.commissions.audit.split", { who, from: c.from, to: c.to });
    case "fixed":
      return t("app.commissions.audit.fixed", {
        who,
        from: c.from == null ? t("app.commissions.audit.none") : money(c.from),
        to: c.to == null ? t("app.commissions.audit.none") : money(c.to),
      });
    case "lines":
      return t("app.commissions.audit.lines", { who, count: c.to });
    default:
      return c.text || "";
  }
}

/** The editor's working copy of one earner. */
function draftOf(e) {
  return {
    memberId: e.memberId,
    role: e.role,
    splitPct: e.splitPct ?? 0,
    fixedAmount: e.fixedAmount ?? "",
    excludedLines: Array.isArray(e.excludedLines) ? e.excludedLines : [],
  };
}

function Editor({ data, onCancel, onSaved }) {
  const { t } = useTranslation();
  const money = useCompanyMoney();
  const [rows, setRows] = useState(() => data.earners.filter((e) => !e.removed).map(draftOf));
  const [adding, setAdding] = useState({ memberId: "", role: "worked" });
  const [openLines, setOpenLines] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const nameOf = (id) => data.team?.find((m) => m.memberId === id)?.name || t("app.commissions.unnamed");

  // Live per-role sums, in cents, so 33.33 + 33.33 + 33.34 reads as 100.
  const sums = useMemo(() => {
    const out = {};
    for (const r of rows) out[r.role] = (out[r.role] || 0) + toCents(Number(r.splitPct) || 0);
    return out;
  }, [rows]);
  const badRoles = Object.entries(sums).filter(([, c]) => c !== 10000).map(([role]) => role);

  const update = (i, patch) => setRows((list) => list.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  const evenOut = (role) => {
    const idx = rows.map((r, i) => (r.role === role ? i : -1)).filter((i) => i >= 0);
    const splits = evenSplits(idx.length);
    setRows((list) => list.map((r, i) => (r.role === role ? { ...r, splitPct: splits[idx.indexOf(i)] } : r)));
  };
  const add = () => {
    if (!adding.memberId) return;
    if (rows.some((r) => r.memberId === adding.memberId && r.role === adding.role)) return;
    const next = [...rows, { memberId: adding.memberId, role: adding.role, splitPct: 0, fixedAmount: "", excludedLines: [] }];
    setRows(next);
    setAdding({ memberId: "", role: adding.role });
  };

  async function save(body) {
    setBusy(true);
    setError("");
    try {
      await fetchJson(`/api/jobs/${data.jobId}/commissions`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      onSaved();
    } catch (err) {
      setError(err.message || t("app.commissions.saveFailed"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-3" data-commission-editor>
      {rows.length === 0 && <p className="text-sm text-muted-foreground">{t("app.commissions.noEarnersYet")}</p>}
      {rows.map((r, i) => (
        <div key={`${r.memberId}:${r.role}`} className="rounded-lg border border-border p-3 space-y-2">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-sm font-medium text-foreground flex-1 min-w-0 truncate">
              {nameOf(r.memberId)} <span className="text-xs text-muted-foreground">· {roleLabel(t, r.role)}</span>
            </p>
            <button
              type="button"
              onClick={() => setRows((list) => list.filter((_, j) => j !== i))}
              className="text-muted-foreground hover:text-red-600 min-h-[36px] px-1"
              aria-label={t("app.commissions.remove")}
            >
              <Trash2 size={14} />
            </button>
          </div>
          <div className="flex items-end gap-3 flex-wrap">
            <label className="flex flex-col gap-1 text-[11px] text-muted-foreground">
              {t("app.commissions.split")}
              <span className="flex items-center gap-1">
                <input
                  type="number"
                  min="0"
                  max="100"
                  step="0.01"
                  value={r.splitPct}
                  onChange={(e) => update(i, { splitPct: e.target.value })}
                  className={`${cell} w-24`}
                />
                %
              </span>
            </label>
            <label className="flex flex-col gap-1 text-[11px] text-muted-foreground">
              {t("app.commissions.fixedOverride")}
              <input
                type="number"
                min="0"
                step="0.01"
                value={r.fixedAmount}
                placeholder={t("app.commissions.fixedPlaceholder")}
                onChange={(e) => update(i, { fixedAmount: e.target.value })}
                className={`${cell} w-32`}
              />
            </label>
            {data.lines?.length > 0 && r.fixedAmount === "" && (
              <button
                type="button"
                onClick={() => setOpenLines(openLines === i ? null : i)}
                className="text-xs underline text-muted-foreground min-h-[36px]"
              >
                {r.excludedLines.length
                  ? t("app.commissions.linesSome", { count: data.lines.length - r.excludedLines.filter((k) => data.lines.some((l) => l.key === k)).length, total: data.lines.length })
                  : t("app.commissions.linesAll")}
              </button>
            )}
          </div>
          {openLines === i && (
            <div className="border border-border rounded-lg divide-y divide-border">
              {data.lines.map((l) => (
                <label key={l.key} className="flex items-center gap-2 px-3 py-1.5 text-sm cursor-pointer">
                  <input
                    type="checkbox"
                    checked={!r.excludedLines.includes(l.key)}
                    onChange={(e) =>
                      update(i, {
                        excludedLines: e.target.checked
                          ? r.excludedLines.filter((k) => k !== l.key)
                          : [...r.excludedLines, l.key],
                      })
                    }
                  />
                  <span className="flex-1 min-w-0 truncate">{l.description || "—"}</span>
                  <span className="text-xs text-muted-foreground tabular-nums">{money(l.net)}</span>
                </label>
              ))}
            </div>
          )}
        </div>
      ))}

      {badRoles.map((role) => (
        <p key={role} className="text-xs text-amber-700 dark:text-amber-400 flex items-center gap-2 flex-wrap">
          <AlertTriangle size={13} />
          {t("app.commissions.splitSum", { role: roleLabel(t, role), sum: (sums[role] / 100).toFixed(2) })}
          <button type="button" onClick={() => evenOut(role)} className="underline">
            {t("app.commissions.splitEvenly")}
          </button>
        </p>
      ))}

      <div className="flex items-center gap-2 flex-wrap">
        <select
          value={adding.memberId}
          onChange={(e) => setAdding({ ...adding, memberId: e.target.value })}
          className={`${cell} min-w-[10rem]`}
          aria-label={t("app.commissions.addPerson")}
        >
          <option value="">{t("app.commissions.addPerson")}</option>
          {(data.team || []).map((m) => (
            <option key={m.memberId} value={m.memberId}>
              {m.name || t("app.commissions.unnamed")}
            </option>
          ))}
        </select>
        <select
          value={adding.role}
          onChange={(e) => setAdding({ ...adding, role: e.target.value })}
          className={cell}
          aria-label={t("app.commissions.role")}
        >
          <option value="worked">{t("app.commissions.workedBy")}</option>
          <option value="sold">{t("app.commissions.soldBy")}</option>
        </select>
        <button
          type="button"
          onClick={add}
          disabled={!adding.memberId}
          className="inline-flex items-center gap-1 border border-border rounded-full px-3 py-1.5 text-xs font-semibold disabled:opacity-50 min-h-[36px]"
        >
          <Plus size={12} /> {t("app.commissions.add")}
        </button>
      </div>

      {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}

      <div className="flex items-center gap-2 flex-wrap pt-1">
        <button
          type="button"
          disabled={busy || badRoles.length > 0}
          onClick={() =>
            save({
              earners: rows.map((r) => ({
                memberId: r.memberId,
                role: r.role,
                splitPct: Number(r.splitPct),
                fixedAmount: r.fixedAmount === "" ? null : Number(r.fixedAmount),
                excludedLines: r.fixedAmount === "" ? r.excludedLines : [],
              })),
            })
          }
          className="inline-flex items-center gap-2 bg-inverted text-inverted-foreground rounded-full px-4 py-2 text-sm font-bold disabled:opacity-60"
        >
          {busy && <Loader2 size={13} className="animate-spin" />}
          {t("app.commissions.saveSplits")}
        </button>
        <button type="button" onClick={onCancel} className="border border-border rounded-full px-4 py-2 text-sm">
          {t("app.action.cancel")}
        </button>
        {data.storedEarners && (
          <button
            type="button"
            disabled={busy}
            onClick={() => save({ reset: true })}
            className="text-xs underline text-muted-foreground ml-auto"
          >
            {t("app.commissions.resetDefaults")}
          </button>
        )}
      </div>
      <p className="text-[11px] text-muted-foreground">{t("app.commissions.editorHint")}</p>
    </div>
  );
}

export default function JobCommissions({ jobId, refreshKey = 0 }) {
  const { t, language } = useTranslation();
  const money = useCompanyMoney();
  const [data, setData] = useState(null);
  const [reload, setReload] = useState(0);
  const [editing, setEditing] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(() => {
    if (!jobId) return () => {};
    let live = true;
    fetch(`/api/jobs/${jobId}/commissions`)
      // A 403/404 is "not yours to see", which is not an error to show on a
      // job page — the card is simply absent, like the costing panel.
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => live && setData(d ? { ...d, jobId } : null))
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [jobId]);
  useEffect(() => load(), [load, reload, refreshKey]);

  async function recalculate() {
    setBusy(true);
    setError("");
    try {
      await fetchJson(`/api/jobs/${jobId}/commissions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "recalculate" }),
      });
      setReload((k) => k + 1);
    } catch (err) {
      setError(err.message || t("app.commissions.saveFailed"));
    } finally {
      setBusy(false);
    }
  }

  if (!data?.enabled) return null;
  if (!data.earners?.length && !data.canEdit && !data.seesAll) return null;

  const gp = data.basis === "gross_profit";

  return (
    <section className="rounded-xl border border-border bg-card p-4 sm:p-5 mt-4" data-job-commissions>
      <div className="flex items-start justify-between gap-3 flex-wrap mb-2">
        <div>
          <h2 className="font-semibold text-foreground flex items-center gap-2">
            <Percent size={15} className="text-muted-foreground" />
            {t("app.commissions.title")}
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            {gp ? t("app.commissions.basisGp") : t("app.commissions.basisRevenue")}
            {gp && data.grossProfitRatio != null && data.revenue != null && (
              <>
                {" · "}
                {t("app.commissions.marginLine", {
                  pct: Math.round(data.grossProfitRatio * 1000) / 10,
                  revenue: money(data.revenue),
                  cost: money(data.cost ?? 0),
                })}
              </>
            )}
          </p>
        </div>
        {data.canEdit && !editing && (
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="inline-flex items-center gap-1.5 border border-border rounded-full px-3 py-1.5 text-xs font-semibold min-h-[36px]"
          >
            <Pencil size={12} /> {t("app.commissions.editSplits")}
          </button>
        )}
      </div>

      {gp && data.costDetail?.unratedHours > 0 && (
        <p className="text-xs text-amber-700 dark:text-amber-400 flex items-start gap-1.5 mb-2">
          <AlertTriangle size={13} className="mt-0.5 shrink-0" />
          {t("app.commissions.unratedHours", { hours: data.costDetail.unratedHours })}
        </p>
      )}

      {data.stale && data.canEdit && (
        <div className="rounded-lg border border-amber-300 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/40 px-3 py-2 text-xs text-amber-900 dark:text-amber-200 flex items-center gap-2 flex-wrap mb-3">
          <AlertTriangle size={13} />
          <span className="flex-1 min-w-0">{t("app.commissions.stale")}</span>
          <button
            type="button"
            onClick={recalculate}
            disabled={busy}
            className="inline-flex items-center gap-1 font-semibold underline disabled:opacity-60"
          >
            {busy ? <Loader2 size={12} className="animate-spin" /> : <RotateCcw size={12} />}
            {t("app.commissions.recalculate")}
          </button>
        </div>
      )}
      {error && <p className="text-sm text-red-600 dark:text-red-400 mb-2">{error}</p>}

      {editing ? (
        <Editor
          data={data}
          onCancel={() => setEditing(false)}
          onSaved={() => {
            setEditing(false);
            setReload((k) => k + 1);
          }}
        />
      ) : (
        <>
          {data.earners.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {data.canEdit ? t("app.commissions.noEarnersEdit") : t("app.commissions.noEarners")}
            </p>
          ) : (
            <div className="divide-y divide-border rounded-lg border border-border">
              {data.earners.map((e) => (
                <div key={`${e.memberId}:${e.role}`} className="px-3 py-2.5 flex items-start justify-between gap-3 flex-wrap">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-foreground">
                      {e.name || t("app.commissions.unnamed")}{" "}
                      <span className="text-xs text-muted-foreground">· {roleLabel(t, e.role)}</span>
                    </p>
                    <p className="text-[11px] text-muted-foreground">
                      {e.removed
                        ? t("app.commissions.removedEarner")
                        : e.fixedAmount != null
                          ? t("app.commissions.fixedLine", { amount: money(e.fixedAmount) })
                          : t("app.commissions.rateLine", {
                              rate: e.memberPct == null ? "—" : `${e.memberPct}%`,
                              split: `${e.splitPct}%`,
                            })}
                      {e.excludedLines?.length > 0 && !e.removed ? ` · ${t("app.commissions.someLines")}` : ""}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold text-foreground tabular-nums">
                      {money(e.ledger?.earned ?? 0)}{" "}
                      <span className="text-[11px] font-normal text-muted-foreground">{t("app.commissions.earned")}</span>
                    </p>
                    <p className="text-[11px] text-muted-foreground tabular-nums">
                      {t("app.commissions.ifPaidInFull", { amount: money(e.potential ?? 0) })}
                    </p>
                    {(e.ledger?.paid > 0 || e.ledger?.inPayRun > 0) && (
                      <p className="text-[11px] text-muted-foreground tabular-nums">
                        {t("app.commissions.settledLine", {
                          paid: money(e.ledger.paid),
                          inRun: money(e.ledger.inPayRun),
                        })}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
          <p className="text-[11px] text-muted-foreground mt-2">{t("app.commissions.earnedHint")}</p>
        </>
      )}

      {data.canEdit && data.audit?.length > 0 && !editing && (
        <div className="mt-3">
          <button
            type="button"
            onClick={() => setShowHistory((v) => !v)}
            className="inline-flex items-center gap-1.5 text-xs text-muted-foreground underline"
          >
            <History size={12} /> {t("app.commissions.history")}
          </button>
          {showHistory && (
            <ul className="mt-2 space-y-1.5 text-xs text-muted-foreground" data-commission-audit>
              {data.audit.map((a, i) => (
                <li key={i}>
                  <span className="text-foreground">{a.byName || t("app.commissions.someone")}</span>{" "}
                  · {formatShortDate(a.at, language)} — {(a.changes || []).map((c) => auditSentence(t, money, c)).join("; ")}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </section>
  );
}
