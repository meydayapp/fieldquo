"use client";

// app/components/jobs/JobSubcontractors.js
//
// "Subs on this job": which companies are hired for this job, for how much,
// where each stands, and a way to write down what they have been paid.
//
// Sits directly under the costing panel because it IS a line of that
// costing: JobSubcontractor.agreedAmount is the subcontract cost the panel
// above reports (lib/costing/actualJobCost.js), and this is where the number
// comes from. The imported-quote path on the QUOTE page
// (app/app/quotes/[id]/ImportedCostsPanel.js) is how a sub's price got onto
// the bid; this is how the same sub gets onto the job — the "adopt" rows
// below are those imports, one click each.
//
// What the server decides, the panel does not re-decide: `canManage` and
// `canSeeMoney` come off the payload, agreed amounts are absent (not zero)
// for a member without jobCosting, and every write answers with the whole
// panel so nothing here has to guess what changed.

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { HardHat, Plus, X } from "lucide-react";
import { useTranslation } from "@/app/hooks/useTranslation";
import { useCompanyPreferences } from "@/app/providers/CompanyPreferencesProvider";
import { reportResponseError } from "@/lib/clientErrors";
import ExpiryBadge from "@/app/components/ExpiryBadge";
import RecordPaymentForm from "@/app/components/subcontractors/RecordPaymentForm";
import { JOB_SUBCONTRACTOR_STATUSES } from "@/lib/subcontractors/money";

const inputClass =
  "w-full border border-border rounded-lg px-3 py-2.5 text-sm bg-card text-foreground focus:outline-none focus:ring-2 focus:ring-ring/10 min-h-[44px]";

export default function JobSubcontractors({ jobId, onChanged }) {
  const { t } = useTranslation();
  const { money, formatDate } = useCompanyPreferences();
  const [data, setData] = useState(null);
  const [adding, setAdding] = useState(false);
  const [payingId, setPayingId] = useState(null);
  const [busyId, setBusyId] = useState(null);
  const [form, setForm] = useState({ subcontractorId: "", agreedAmount: "", description: "", visitId: "" });
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    if (!jobId) return;
    const res = await fetch(`/api/jobs/${jobId}/subcontractors`);
    // 403/404 is the ordinary answer for somebody the job isn't shown to;
    // the panel is simply not theirs, the same posture as JobCosting.
    if (!res.ok) {
      setData(null);
      return;
    }
    setData(await res.json());
  }, [jobId]);

  useEffect(() => {
    load();
  }, [load]);

  // Every write answers with the whole panel; a payment answers with less,
  // so that one reloads. Either way the costing panel above is told.
  const applied = useCallback(
    async (payload) => {
      if (payload && Array.isArray(payload.rows)) setData(payload);
      else await load();
      onChanged?.();
    },
    [load, onChanged],
  );

  if (!data) return null;
  const { rows, roster, visits, imports, canManage, canSeeMoney } = data;
  const pendingImports = (imports || []).filter((i) => !i.adopted);
  if (rows.length === 0 && !canManage) return null;

  const statusLabel = (s) =>
    ({
      quoted: t("app.subcontractors.status.quoted", "Quoted"),
      agreed: t("app.subcontractors.status.agreed", "Agreed"),
      done: t("app.subcontractors.status.done", "Done"),
      paid: t("app.subcontractors.status.paid", "Paid"),
    })[s] || s;

  async function post(body) {
    const res = await fetch(`/api/jobs/${jobId}/subcontractors`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const message = await reportResponseError(res, t("app.subcontractors.saveFailed", "Couldn't save that."));
      setError(message || t("app.subcontractors.saveFailed", "Couldn't save that."));
      return false;
    }
    await applied(await res.json());
    return true;
  }

  async function submitAdd(e) {
    e.preventDefault();
    setError("");
    if (!form.subcontractorId) {
      setError(t("app.subcontractors.pickSub", "Pick which subcontractor."));
      return;
    }
    setBusyId("new");
    try {
      const ok = await post({
        subcontractorId: form.subcontractorId,
        agreedAmount: form.agreedAmount === "" ? null : form.agreedAmount,
        description: form.description,
        visitId: form.visitId || null,
      });
      if (ok) {
        setAdding(false);
        setForm({ subcontractorId: "", agreedAmount: "", description: "", visitId: "" });
      }
    } finally {
      setBusyId(null);
    }
  }

  async function adopt(imp) {
    setError("");
    setBusyId(imp.id);
    try {
      await post({ quoteImportId: imp.id, subcontractorId: imp.matchedSubcontractorId || undefined });
    } finally {
      setBusyId(null);
    }
  }

  async function patch(row, body) {
    setError("");
    setBusyId(row.id);
    try {
      const res = await fetch(`/api/jobs/${jobId}/subcontractors/${row.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const message = await reportResponseError(res, t("app.subcontractors.saveFailed", "Couldn't save that."));
        setError(message || t("app.subcontractors.saveFailed", "Couldn't save that."));
        return;
      }
      await applied(null);
    } finally {
      setBusyId(null);
    }
  }

  async function remove(row) {
    setError("");
    setBusyId(row.id);
    try {
      const res = await fetch(`/api/jobs/${jobId}/subcontractors/${row.id}`, { method: "DELETE" });
      if (!res.ok) {
        const message = await reportResponseError(res, t("app.subcontractors.removeFailed", "Couldn't take them off the job."));
        setError(message || t("app.subcontractors.removeFailed", "Couldn't take them off the job."));
        return;
      }
      await applied(null);
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="bg-card border border-border rounded-xl p-5">
      <div className="flex items-start justify-between gap-3 mb-3">
        <div>
          <h2 className="font-semibold text-foreground flex items-center gap-2">
            <HardHat size={16} /> {t("app.subcontractors.onJobTitle", "Subs on this job")}
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            {canSeeMoney
              ? t("app.subcontractors.onJobIntro", "Companies hired for a fixed price. The agreed amount is what this job costs, whatever you quoted the client; payments are how it gets settled.")
              : t("app.subcontractors.onJobIntroNoMoney", "Companies hired for this job. Amounts aren't shown at your access level.")}
          </p>
        </div>
        {canManage && !adding && (
          <button
            type="button"
            onClick={() => setAdding(true)}
            className="inline-flex items-center gap-1.5 border border-border rounded-full px-3 py-2 text-sm font-semibold min-h-[44px] shrink-0"
          >
            <Plus size={14} /> {t("app.subcontractors.addToJob", "Add a sub")}
          </button>
        )}
      </div>

      {error && <p className="mb-3 text-sm text-red-600 dark:text-red-400">{error}</p>}

      {/* Imported quotes not yet on the job — one click each. Only rendered
          when there is one to adopt; a heading over nothing is noise. */}
      {canManage && pendingImports.length > 0 && (
        <div className="mb-4 border border-border rounded-lg p-3 space-y-2">
          <p className="text-xs font-semibold text-foreground">
            {t("app.subcontractors.fromQuoteTitle", "From the quote's imported prices")}
          </p>
          {pendingImports.map((imp) => (
            <div key={imp.id} className="flex items-center justify-between gap-3">
              <span className="min-w-0 text-sm text-foreground truncate">
                {imp.sourceCompanyName || imp.label || t("app.subcontractors.importedQuote", "Imported quote")}
                {imp.label && imp.sourceCompanyName ? ` — ${imp.label}` : ""}
                {canSeeMoney && imp.amount != null ? ` · ${money(imp.amount)}` : ""}
              </span>
              <button
                type="button"
                disabled={busyId === imp.id}
                onClick={() => adopt(imp)}
                className="shrink-0 border border-border rounded-full px-3 py-1.5 text-xs font-semibold min-h-[44px] disabled:opacity-50"
              >
                {t("app.subcontractors.putOnJob", "Put on this job")}
              </button>
            </div>
          ))}
        </div>
      )}

      {adding && (
        <form onSubmit={submitAdd} className="mb-4 border border-border rounded-lg p-3 space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-foreground">{t("app.subcontractors.addToJob", "Add a sub")}</p>
            <button type="button" onClick={() => setAdding(false)} aria-label={t("app.subcontractors.cancel", "Cancel")} className="p-2 -m-2 text-muted-foreground min-h-[44px] min-w-[44px]">
              <X size={16} />
            </button>
          </div>
          {roster.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {t("app.subcontractors.rosterEmpty", "No subcontractors on your list yet.")}{" "}
              <Link href="/app/subcontractors/new" className="underline font-semibold text-foreground">
                {t("app.subcontractors.addFirst", "Add your first subcontractor")}
              </Link>
            </p>
          ) : (
            <>
              <label className="block text-xs text-muted-foreground">
                {t("app.subcontractors.which", "Which subcontractor")}
                <select className={`${inputClass} mt-1`} value={form.subcontractorId} onChange={(e) => setForm({ ...form, subcontractorId: e.target.value })}>
                  <option value="">{t("app.subcontractors.pickOne", "Pick one…")}</option>
                  {roster.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                      {s.trade ? ` — ${s.trade}` : ""}
                    </option>
                  ))}
                </select>
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {canSeeMoney && (
                  <label className="block text-xs text-muted-foreground">
                    {t("app.subcontractors.agreedAmount", "Agreed amount")}
                    <input className={`${inputClass} mt-1`} inputMode="decimal" value={form.agreedAmount} onChange={(e) => setForm({ ...form, agreedAmount: e.target.value })} placeholder={t("app.subcontractors.amountLater", "Leave blank if not agreed yet")} />
                  </label>
                )}
                <label className="block text-xs text-muted-foreground">
                  {t("app.subcontractors.visit", "Visit (optional)")}
                  <select className={`${inputClass} mt-1`} value={form.visitId} onChange={(e) => setForm({ ...form, visitId: e.target.value })}>
                    <option value="">{t("app.subcontractors.noVisit", "Not tied to a visit")}</option>
                    {visits.map((v) => (
                      <option key={v.id} value={v.id}>
                        {formatDate(v.scheduledAt)}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <input className={inputClass} placeholder={t("app.subcontractors.scopePlaceholder", "What they're doing (optional)")} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
              <button type="submit" disabled={busyId === "new"} className="min-h-[44px] rounded-lg bg-foreground px-4 text-sm font-semibold text-background disabled:opacity-50">
                {t("app.subcontractors.putOnJob", "Put on this job")}
              </button>
            </>
          )}
        </form>
      )}

      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t("app.subcontractors.noneOnJob", "No subcontractors on this job.")}</p>
      ) : (
        <ul className="divide-y divide-border">
          {rows.map((row) => (
            <li key={row.id} className="py-3 space-y-2">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <Link href={`/app/subcontractors/${row.subcontractor.id}`} className="block text-sm font-semibold text-foreground underline truncate">
                    {row.subcontractor.name}
                  </Link>
                  <p className="text-xs text-muted-foreground truncate">
                    {[row.subcontractor.trade, row.description, row.visit ? formatDate(row.visit.scheduledAt) : null].filter(Boolean).join(" · ")}
                  </p>
                  {row.subcontractor.attention.state !== "ok" && (
                    <ExpiryBadge
                      state={row.subcontractor.attention.state}
                      className="mt-1"
                      label={
                        row.subcontractor.attention.state === "unknown"
                          ? t("app.subcontractors.paperworkUnknown", "Insurance not recorded")
                          : row.subcontractor.attention.state === "expired"
                            ? t("app.subcontractors.paperworkExpired", "Insurance or clearance expired")
                            : t("app.subcontractors.paperworkSoon", "Insurance or clearance expiring")
                      }
                    />
                  )}
                </div>
                <div className="shrink-0 text-right">
                  {canManage && canSeeMoney ? (
                    <select
                      value={row.status}
                      disabled={busyId === row.id || row.status === "paid"}
                      onChange={(e) => patch(row, { status: e.target.value })}
                      aria-label={t("app.subcontractors.statusLabel", "Status")}
                      className="border border-border rounded-lg px-2 py-1.5 text-xs font-semibold bg-card text-foreground min-h-[44px] disabled:opacity-70"
                    >
                      {JOB_SUBCONTRACTOR_STATUSES.map((s) => (
                        <option key={s} value={s} disabled={s === "paid" && row.status !== "paid"}>
                          {statusLabel(s)}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <span className="text-xs font-semibold text-foreground">{statusLabel(row.status)}</span>
                  )}
                  {!row.restricted && (
                    <p className="text-sm font-semibold text-foreground tabular-nums mt-1">
                      {row.agreedAmount > 0 ? money(row.agreedAmount) : t("app.subcontractors.noAmountYet", "No amount yet")}
                    </p>
                  )}
                  {!row.restricted && row.agreedAmount > 0 && (
                    <p className="text-xs text-muted-foreground tabular-nums">
                      {row.remaining > 0
                        ? t("app.subcontractors.paidOfAgreed", "{paid} paid, {remaining} to go", { paid: money(row.paid), remaining: money(row.remaining) })
                        : row.remaining < 0
                          ? t("app.subcontractors.overpaid", "Overpaid by {amount}", { amount: money(-row.remaining) })
                          : t("app.subcontractors.paidInFull", "Paid in full")}
                    </p>
                  )}
                </div>
              </div>

              {canManage && (
                <div className="flex flex-wrap items-center gap-3">
                  {canSeeMoney && row.status !== "paid" && payingId !== row.id && (
                    <button type="button" onClick={() => setPayingId(row.id)} className="text-xs font-semibold underline text-foreground min-h-[44px]">
                      {t("app.subcontractors.recordPayment", "Record a payment")}
                    </button>
                  )}
                  {canSeeMoney && row.status === "quoted" && (
                    <button
                      type="button"
                      disabled={busyId === row.id}
                      onClick={() => {
                        const raw = window.prompt(t("app.subcontractors.agreedPrompt", "Agreed amount with this subcontractor:"), row.agreedAmount > 0 ? String(row.agreedAmount) : "");
                        if (raw == null) return;
                        patch(row, { agreedAmount: raw, status: "agreed" });
                      }}
                      className="text-xs font-semibold underline text-foreground min-h-[44px] disabled:opacity-50"
                    >
                      {t("app.subcontractors.setAgreed", "Set agreed amount")}
                    </button>
                  )}
                  {!row.hasPayments && (
                    <button type="button" disabled={busyId === row.id} onClick={() => remove(row)} className="text-xs underline text-muted-foreground min-h-[44px] disabled:opacity-50">
                      {t("app.subcontractors.takeOff", "Take off this job")}
                    </button>
                  )}
                </div>
              )}

              {payingId === row.id && (
                <RecordPaymentForm
                  subcontractorId={row.subcontractor.id}
                  jobSubcontractorId={row.id}
                  remaining={row.remaining}
                  onSaved={() => {
                    setPayingId(null);
                    applied(null);
                  }}
                  onCancel={() => setPayingId(null)}
                />
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
