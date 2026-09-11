"use client";

// app/app/subcontractors/page.js
//
// The subs: the companies this contractor hires per job. Who they are,
// whether their paperwork is in date, and — for someone who may see cost —
// what each was paid this year.
//
// ══ Why the due-and-expiring panel is first ════════════════════════════════
//
// A lapsed certificate of insurance is a sub who must not step on site
// tomorrow: if they do and something goes wrong, the GC is the one insured.
// It is the only thing on this screen with a same-day consequence, so it is
// the first thing on it — the same shape as /app/fleet and the warranty call
// list at /app/equipment, on purpose.
//
// ══ Mobile ════════════════════════════════════════════════════════════════
//
// One column, cards not tables, 44px targets. `npm run check:mobile` does not
// walk this screen; it is built to the same rules and the gap is stated
// rather than implied.

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { HardHat, Plus, Download } from "lucide-react";
import { useTranslation } from "@/app/hooks/useTranslation";
import { useCompanyMoney } from "@/app/providers/CompanyPreferencesProvider";
import { fetchList } from "@/lib/loadState";
import ListState from "@/app/components/ListState";
import ExpiryBadge from "@/app/components/ExpiryBadge";

export default function SubcontractorsPage() {
  const { t } = useTranslation();
  const money = useCompanyMoney();
  // null until the server answers — `[]` would claim "no subs" on a refused read.
  const [data, setData] = useState(null);
  const [errorKey, setErrorKey] = useState("");
  const [loading, setLoading] = useState(true);
  const [year, setYear] = useState(() => new Date().getUTCFullYear());

  const load = useCallback(async () => {
    setLoading(true);
    const result = await fetchList(`/api/subcontractors?year=${year}`);
    if (result.aborted) return;
    if (!result.ok) {
      setErrorKey(result.errorKey);
      setLoading(false);
      return;
    }
    setErrorKey("");
    setData(result.data);
    setLoading(false);
  }, [year]);

  useEffect(() => {
    load();
  }, [load]);

  const subs = data?.subcontractors || [];
  const dueSoon = data?.dueSoon || [];
  const thisYear = new Date().getUTCFullYear();
  const years = [thisYear, thisYear - 1, thisYear - 2];

  const reasonLabel = (kind) =>
    ({
      insurance: t("app.subcontractors.insurance", "Insurance"),
      clearance: t("app.subcontractors.clearance", "Clearance"),
    })[kind] || kind;

  return (
    <div className="p-4 sm:p-6 max-w-3xl mx-auto space-y-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <HardHat size={22} />
            {t("app.subcontractors.title", "Subcontractors")}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {t(
              "app.subcontractors.intro",
              "The companies you hire per job — the electrician, the roofer. Their insurance and clearance dates, what you've agreed with them on each job, and what you've paid them this year.",
            )}
          </p>
        </div>
        {data?.canEdit && (
          <Link
            href="/app/subcontractors/new"
            className="inline-flex items-center gap-1.5 border border-border rounded-full px-4 py-2 text-sm font-semibold min-h-[44px] shrink-0"
          >
            <Plus size={14} /> {t("app.subcontractors.add", "Add")}
          </Link>
        )}
      </div>

      {/* Due and expiring. Rendered only when the server answered AND there is
          something to report — an empty red panel reads as a broken screen. */}
      {data && dueSoon.length > 0 && (
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-border">
            <h2 className="font-semibold text-sm text-foreground">
              {t("app.subcontractors.dueTitle", "Insurance or clearance expiring")}
            </h2>
          </div>
          <ul className="divide-y divide-border">
            {dueSoon.map((row) => (
              <li key={row.subcontractorId} className="px-4 py-3 flex items-start justify-between gap-3">
                <Link href={`/app/subcontractors/${row.subcontractorId}`} className="min-w-0">
                  <span className="block text-sm font-semibold text-foreground truncate">{row.name}</span>
                  <span className="block text-xs text-muted-foreground truncate">
                    {row.reasons.map((r) => reasonLabel(r.kind)).join(" · ")}
                  </span>
                </Link>
                <ExpiryBadge state={row.state} className="shrink-0" />
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* The year the paid column and the export refer to. Money only —
          without jobCosting there is no column and no export to pick a year for. */}
      {data?.canSeeMoney && (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <label className="text-sm text-muted-foreground flex items-center gap-2">
            {t("app.subcontractors.paidIn", "Paid in")}
            <select
              value={year}
              onChange={(e) => setYear(Number(e.target.value))}
              className="border border-border rounded-lg px-3 py-2 text-sm bg-card text-foreground min-h-[44px]"
            >
              {years.map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
          </label>
          <a
            href={`/api/subcontractors/export?year=${year}`}
            className="inline-flex items-center gap-1.5 border border-border rounded-full px-4 py-2 text-sm font-semibold min-h-[44px]"
          >
            <Download size={14} /> {t("app.subcontractors.exportYear", "Year-end list (CSV)")}
          </a>
        </div>
      )}

      <ListState
        loading={loading}
        errorKey={errorKey}
        isEmpty={!!data && subs.length === 0}
        onRetry={load}
        empty={
          <div className="bg-card border border-border rounded-xl p-8 text-center space-y-2">
            <p className="text-sm font-semibold text-foreground">{t("app.subcontractors.emptyTitle", "No subcontractors yet")}</p>
            <p className="text-sm text-muted-foreground">
              {t(
                "app.subcontractors.emptyBody",
                "Add the companies you hire — then put one on a job, file their insurance certificate, and record what you pay them.",
              )}
            </p>
            {data?.canEdit && (
              <Link href="/app/subcontractors/new" className="inline-block text-sm font-semibold underline text-foreground">
                {t("app.subcontractors.addFirst", "Add your first subcontractor")}
              </Link>
            )}
          </div>
        }
      >
        <div className="space-y-3">
          {subs.map((sub) => (
            <Link
              key={sub.id}
              href={`/app/subcontractors/${sub.id}`}
              className={`block bg-card border border-border rounded-xl p-4 ${sub.active ? "" : "opacity-60"}`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-foreground truncate">
                    {sub.name}
                    {!sub.active && (
                      <span className="ml-2 text-xs font-normal text-muted-foreground">{t("app.subcontractors.inactive", "Inactive")}</span>
                    )}
                  </p>
                  <p className="text-xs text-muted-foreground truncate">
                    {[sub.trade, sub.contactName, sub.phone].filter(Boolean).join(" · ") || t("app.subcontractors.noDetails", "No details yet")}
                  </p>
                </div>
                <ExpiryBadge state={sub.attention?.state} className="shrink-0" />
              </div>
              {data?.canSeeMoney && (
                <p className="mt-2 text-xs text-muted-foreground">
                  {t("app.subcontractors.paidThisYear", "{amount} paid in {year} ({count} payments)", {
                    amount: money(sub.paidThisYear || 0),
                    year: data.year,
                    count: sub.paymentsThisYear || 0,
                  })}
                  {!sub.taxFormRequired && ` · ${t("app.subcontractors.noTaxForm", "No tax form")}`}
                </p>
              )}
            </Link>
          ))}
        </div>
      </ListState>
    </div>
  );
}
