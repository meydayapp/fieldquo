"use client";

// app/components/hr/ComplianceOverview.js
//
// The HR & compliance screen: one row per person, four things to chase.
// A table on a desk, a stack of cards on a phone — the same rows, the
// same order (people with something to chase first, then by name). Every
// count is a link into the person's file, where the thing is fixed.
//
// No labour-law column, on purpose — see lib/hr/compliance.js.

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ShieldCheck, AlertTriangle } from "lucide-react";
import { useTranslation } from "@/app/hooks/useTranslation";
import { fetchList } from "@/lib/loadState";
import ListState from "@/app/components/ListState";
import ExpiryBadge from "@/app/components/ExpiryBadge";

function Cell({ children, tone = "muted" }) {
  const cls = tone === "bad" ? "text-red-700 dark:text-red-300 font-semibold" : tone === "warn" ? "text-amber-700 dark:text-amber-300 font-semibold" : "text-muted-foreground";
  return <span className={`text-sm ${cls}`}>{children}</span>;
}

export default function ComplianceOverview() {
  const { t } = useTranslation();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [errorKey, setErrorKey] = useState("");
  const [onlyAttention, setOnlyAttention] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const result = await fetchList("/api/hr/compliance");
    if (result.aborted) return;
    if (!result.ok) {
      setErrorKey(result.errorKey);
      setLoading(false);
      return;
    }
    setErrorKey("");
    setData(result.data);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const rows = (data?.rows || []).slice().sort((a, b) => (a.attention === b.attention ? a.name.localeCompare(b.name) : a.attention ? -1 : 1));
  const shown = onlyAttention ? rows.filter((r) => r.attention) : rows;
  const attentionCount = rows.filter((r) => r.attention).length;

  const docCell = (r) => {
    if (r.documents.expired) return <Cell tone="bad">{t("app.hr.compliance.expired", { count: r.documents.expired })}</Cell>;
    if (r.documents.dueSoon) return <Cell tone="warn">{t("app.hr.compliance.dueSoon", { count: r.documents.dueSoon })}</Cell>;
    if (r.documents.unverified) return <Cell tone="warn">{t("app.hr.compliance.unverified", { count: r.documents.unverified })}</Cell>;
    return <Cell>{t("app.hr.compliance.ok")}</Cell>;
  };
  const onbCell = (r) => {
    if (!r.onboarding) return <Cell>{t("app.hr.compliance.noChecklist")}</Cell>;
    if (r.onboarding.complete) return <Cell>{t("app.hr.compliance.complete")}</Cell>;
    const text = t("app.hr.onboarding.progress", { done: r.onboarding.done, total: r.onboarding.total });
    return <Cell tone={r.onboarding.overdue ? "bad" : "warn"}>{r.onboarding.overdue ? `${text} · ${t("app.hr.compliance.overdue", { count: r.onboarding.overdue })}` : text}</Cell>;
  };
  const polCell = (r) => (r.policies.pending ? <Cell tone="warn">{t("app.hr.compliance.policiesPending", { count: r.policies.pending })}</Cell> : <Cell>{t("app.hr.compliance.ok")}</Cell>);
  const noteCell = (r) => (r.notes.pending ? <Cell tone="warn">{t("app.hr.compliance.notesPending", { count: r.notes.pending })}</Cell> : <Cell>{t("app.hr.compliance.ok")}</Cell>);

  return (
    <div className="space-y-4" data-hr-compliance>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground flex items-center gap-2">
          {attentionCount ? <AlertTriangle size={16} className="text-amber-600" /> : <ShieldCheck size={16} className="text-emerald-600" />}
          {attentionCount ? t("app.hr.compliance.summaryAttention", { count: attentionCount, total: rows.length }) : t("app.hr.compliance.summaryClear", { total: rows.length })}
        </p>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={onlyAttention} onChange={(e) => setOnlyAttention(e.target.checked)} />
          {t("app.hr.compliance.onlyAttention")}
        </label>
      </div>

      <ListState loading={loading} errorKey={errorKey} isEmpty={data !== null && rows.length === 0} onRetry={load} empty={<p className="text-sm text-muted-foreground">{t("app.hr.compliance.empty")}</p>}>
        {/* Desk: a table. */}
        <div className="hidden md:block bg-card border border-border rounded-xl overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="text-xs font-semibold text-muted-foreground uppercase tracking-wide border-b border-border">
                <th className="px-5 py-3">{t("app.hr.compliance.person")}</th>
                <th className="px-5 py-3">{t("app.hr.compliance.documents")}</th>
                <th className="px-5 py-3">{t("app.hr.compliance.onboarding")}</th>
                <th className="px-5 py-3">{t("app.hr.compliance.policies")}</th>
                <th className="px-5 py-3">{t("app.hr.compliance.notes")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {shown.map((r) => (
                <tr key={r.workerId} data-hr-compliance-row data-hr-attention={r.attention ? "1" : "0"}>
                  <td className="px-5 py-3">
                    <Link href={`/app/settings/team/people/${r.workerId}`} className="text-sm font-medium text-foreground underline">
                      {r.name}
                    </Link>
                    {r.title ? <span className="block text-xs text-muted-foreground">{r.title}</span> : null}
                  </td>
                  <td className="px-5 py-3">
                    <span className="inline-flex items-center gap-2">
                      {r.documents.expired || r.documents.dueSoon ? <ExpiryBadge state={r.documents.worst} /> : null}
                      {docCell(r)}
                    </span>
                  </td>
                  <td className="px-5 py-3">{onbCell(r)}</td>
                  <td className="px-5 py-3">{polCell(r)}</td>
                  <td className="px-5 py-3">{noteCell(r)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Phone: cards. */}
        <ul className="md:hidden space-y-3">
          {shown.map((r) => (
            <li key={r.workerId} className="bg-card border border-border rounded-xl p-4" data-hr-compliance-card>
              <Link href={`/app/settings/team/people/${r.workerId}`} className="text-sm font-semibold text-foreground underline">
                {r.name}
              </Link>
              {r.title ? <span className="block text-xs text-muted-foreground">{r.title}</span> : null}
              <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-sm">
                <dt className="text-xs text-muted-foreground uppercase tracking-wide pt-0.5">{t("app.hr.compliance.documents")}</dt>
                <dd>{docCell(r)}</dd>
                <dt className="text-xs text-muted-foreground uppercase tracking-wide pt-0.5">{t("app.hr.compliance.onboarding")}</dt>
                <dd>{onbCell(r)}</dd>
                <dt className="text-xs text-muted-foreground uppercase tracking-wide pt-0.5">{t("app.hr.compliance.policies")}</dt>
                <dd>{polCell(r)}</dd>
                <dt className="text-xs text-muted-foreground uppercase tracking-wide pt-0.5">{t("app.hr.compliance.notes")}</dt>
                <dd>{noteCell(r)}</dd>
              </dl>
            </li>
          ))}
        </ul>
      </ListState>
      <p className="text-xs text-muted-foreground">{t("app.hr.compliance.noLabourLaw")}</p>
    </div>
  );
}
