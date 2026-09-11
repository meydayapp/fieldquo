"use client";

// app/app/subcontractors/[id]/SubcontractorDetail.js
//
// One sub: the record, the two expiry badges, the paperwork, the jobs it has
// been on, and — behind the money gate — what it was paid, by year.
//
// The year-to-date figure IS the T5018 / 1099-NEC number. It is computed on
// the server (lib/subcontractors/money.js's yearToDatePaid) over the same rows
// listed underneath it, so the total and the ledger cannot disagree, and the
// year-end CSV uses the same function so the accountant's list agrees too.

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Pencil, Briefcase, Wallet } from "lucide-react";
import { useTranslation } from "@/app/hooks/useTranslation";
import { useCompanyPreferences } from "@/app/providers/CompanyPreferencesProvider";
import { fetchList } from "@/lib/loadState";
import { reportResponseError } from "@/lib/clientErrors";
import { paymentMethodLabel } from "@/lib/payments/methodLabels";
import ListState from "@/app/components/ListState";
import ExpiryBadge from "@/app/components/ExpiryBadge";
import SubcontractorForm from "@/app/components/subcontractors/SubcontractorForm";
import SubcontractorDocuments from "@/app/components/subcontractors/SubcontractorDocuments";
import RecordPaymentForm from "@/app/components/subcontractors/RecordPaymentForm";

export default function SubcontractorDetail({ id }) {
  const { t } = useTranslation();
  const { money, formatDate } = useCompanyPreferences();
  const [data, setData] = useState(null);
  const [errorKey, setErrorKey] = useState("");
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [paying, setPaying] = useState(false);
  const [year, setYear] = useState(() => new Date().getUTCFullYear());
  const [toggling, setToggling] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const result = await fetchList(`/api/subcontractors/${id}?year=${year}`);
    if (result.aborted) return;
    if (!result.ok) {
      setErrorKey(result.errorKey);
      setLoading(false);
      return;
    }
    setErrorKey("");
    setData(result.data);
    setLoading(false);
  }, [id, year]);

  useEffect(() => {
    load();
  }, [load]);

  const sub = data?.subcontractor;
  const methodLabel = (m) => t(`app.subcontractors.method.${m}`, paymentMethodLabel(m));
  const statusLabel = (s) =>
    ({
      quoted: t("app.subcontractors.status.quoted", "Quoted"),
      agreed: t("app.subcontractors.status.agreed", "Agreed"),
      done: t("app.subcontractors.status.done", "Done"),
      paid: t("app.subcontractors.status.paid", "Paid"),
    })[s] || s;

  async function toggleActive() {
    if (!sub) return;
    setToggling(true);
    try {
      const res = await fetch(`/api/subcontractors/${sub.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ active: !sub.active }),
      });
      if (!res.ok) {
        await reportResponseError(res, t("app.subcontractors.saveFailed", "Couldn't save that."));
        return;
      }
      await load();
    } finally {
      setToggling(false);
    }
  }

  return (
    <div className="p-4 sm:p-6 max-w-3xl mx-auto space-y-5">
      <Link href="/app/subcontractors" className="inline-flex items-center gap-1.5 text-sm text-muted-foreground min-h-[44px]">
        <ArrowLeft size={14} /> {t("app.subcontractors.backToList", "All subcontractors")}
      </Link>

      <ListState loading={loading} errorKey={errorKey} isEmpty={false} onRetry={load}>
        {sub && (
          <div className="space-y-5">
            {editing ? (
              <SubcontractorForm
                mode="edit"
                sub={sub}
                onSaved={() => {
                  setEditing(false);
                  load();
                }}
                onCancel={() => setEditing(false)}
              />
            ) : (
              <div className="bg-card border border-border rounded-xl p-5 space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h1 className="text-2xl font-bold text-foreground truncate">{sub.name}</h1>
                    <p className="text-sm text-muted-foreground">
                      {[sub.trade, sub.contactName, sub.phone, sub.email].filter(Boolean).join(" · ") ||
                        t("app.subcontractors.noDetails", "No details yet")}
                    </p>
                    {!sub.active && (
                      <p className="text-xs text-muted-foreground mt-1">{t("app.subcontractors.inactiveNote", "Inactive — not offered when adding a sub to a job.")}</p>
                    )}
                  </div>
                  {data.canEdit && (
                    <button
                      type="button"
                      onClick={() => setEditing(true)}
                      className="inline-flex items-center gap-1.5 border border-border rounded-full px-3 py-2 text-sm font-semibold min-h-[44px] shrink-0"
                    >
                      <Pencil size={14} /> {t("app.subcontractors.edit", "Edit")}
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {sub.attention.expiries.map((e) => (
                    <div key={e.kind} className="border border-border rounded-lg p-3 flex items-center justify-between gap-3">
                      <span>
                        <span className="block text-xs text-muted-foreground">
                          {e.kind === "insurance"
                            ? t("app.subcontractors.insurance", "Insurance")
                            : t("app.subcontractors.clearance", "Clearance")}
                        </span>
                        <span className="block text-sm text-foreground">
                          {e.endsAt ? formatDate(e.endsAt) : t("app.subcontractors.notRecorded", "Not recorded")}
                        </span>
                      </span>
                      <ExpiryBadge state={e.state} />
                    </div>
                  ))}
                </div>

                <p className="text-xs text-muted-foreground">
                  {sub.taxFormRequired
                    ? t("app.subcontractors.taxFormYes", "Goes on the year-end contractor form.")
                    : t("app.subcontractors.taxFormNo", "Not on the year-end contractor form.")}
                </p>

                {sub.notes && <p className="text-sm text-foreground whitespace-pre-wrap">{sub.notes}</p>}

                {data.canEdit && (
                  <button
                    type="button"
                    disabled={toggling}
                    onClick={toggleActive}
                    className="text-sm underline text-muted-foreground min-h-[44px] disabled:opacity-50"
                  >
                    {sub.active ? t("app.subcontractors.markInactive", "Mark inactive") : t("app.subcontractors.markActive", "Mark active again")}
                  </button>
                )}
              </div>
            )}

            <SubcontractorDocuments subcontractorId={sub.id} onExpiryChanged={load} />

            {/* Jobs history — money only with the toggle; the route already
                stripped it, so `restricted` is what says why the column is
                blank rather than the browser guessing. */}
            <div className="bg-card border border-border rounded-xl p-5">
              <h2 className="font-semibold text-foreground flex items-center gap-2 mb-3">
                <Briefcase size={16} /> {t("app.subcontractors.jobs", "Jobs")}
              </h2>
              {data.jobs.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  {t("app.subcontractors.noJobs", "Not on any job yet. Add them from a job's own page, under \"Subs on this job\".")}
                </p>
              ) : (
                <ul className="divide-y divide-border">
                  {data.jobs.map((row) => (
                    <li key={row.id} className="py-2.5 flex items-start justify-between gap-3">
                      <Link href={`/app/jobs/${row.jobId}`} className="min-w-0">
                        <span className="block text-sm font-semibold text-foreground underline truncate">
                          {row.job?.title || t("app.subcontractors.untitledJob", "Untitled job")}
                        </span>
                        <span className="block text-xs text-muted-foreground truncate">
                          {[row.job?.client?.name, row.description].filter(Boolean).join(" · ")}
                        </span>
                      </Link>
                      <span className="shrink-0 text-right">
                        <span className="block text-xs font-semibold text-foreground">{statusLabel(row.status)}</span>
                        {!row.restricted && (
                          <span className="block text-xs text-muted-foreground tabular-nums">{money(row.agreedAmount)}</span>
                        )}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {/* Payments. Absent entirely without the money gate — not a blank
                panel, because "no payments" and "you may not see payments"
                are different sentences. */}
            {data.canSeeMoney && (
              <div className="bg-card border border-border rounded-xl p-5 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <h2 className="font-semibold text-foreground flex items-center gap-2">
                    <Wallet size={16} /> {t("app.subcontractors.payments", "Payments")}
                  </h2>
                  <label className="text-sm text-muted-foreground flex items-center gap-2">
                    {t("app.subcontractors.year", "Year")}
                    <select
                      value={year}
                      onChange={(e) => setYear(Number(e.target.value))}
                      className="border border-border rounded-lg px-3 py-2 text-sm bg-card text-foreground min-h-[44px]"
                    >
                      {data.years.map((y) => (
                        <option key={y} value={y}>
                          {y}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>

                <div className="border border-border rounded-lg p-3">
                  <p className="text-xs text-muted-foreground">
                    {t("app.subcontractors.ytdLabel", "Paid in {year} — the year-end contractor form figure", { year: data.yearToDate.year })}
                  </p>
                  <p className="text-2xl font-bold text-foreground tabular-nums">{money(data.yearToDate.total)}</p>
                  <p className="text-xs text-muted-foreground">
                    {t("app.subcontractors.ytdCount", "{count} payments", { count: data.yearToDate.count })}
                  </p>
                </div>

                {paying ? (
                  <RecordPaymentForm
                    subcontractorId={sub.id}
                    onSaved={() => {
                      setPaying(false);
                      load();
                    }}
                    onCancel={() => setPaying(false)}
                  />
                ) : (
                  <button
                    type="button"
                    onClick={() => setPaying(true)}
                    className="inline-flex items-center gap-1.5 border border-border rounded-full px-4 py-2 text-sm font-semibold min-h-[44px]"
                  >
                    {t("app.subcontractors.recordPayment", "Record a payment")}
                  </button>
                )}

                {data.payments.length === 0 ? (
                  <p className="text-sm text-muted-foreground">{t("app.subcontractors.noPayments", "No payments recorded.")}</p>
                ) : (
                  <ul className="divide-y divide-border">
                    {data.payments.map((p) => (
                      <li key={p.id} className="py-2.5 flex items-start justify-between gap-3">
                        <span className="min-w-0">
                          <span className="block text-sm text-foreground">
                            {formatDate(p.date)} · {methodLabel(p.method)}
                          </span>
                          {p.notes && <span className="block text-xs text-muted-foreground truncate">{p.notes}</span>}
                        </span>
                        <span className="shrink-0 text-sm font-semibold text-foreground tabular-nums">{money(p.amount)}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </div>
        )}
      </ListState>
    </div>
  );
}
