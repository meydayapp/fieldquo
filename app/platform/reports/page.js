// app/platform/reports/page.js
//
// Exports rather than charts. Growth analysis is exploratory — whatever cut I
// build into a dashboard won't be the one you want next month. A file you can
// pivot beats a chart you can't change.
"use client";

import { useState } from "react";
import { Download, Loader2, FileSpreadsheet, AlertCircle } from "lucide-react";

const REPORTS = [
  {
    key: "growth",
    title: "Growth by month",
    description:
      "New and cumulative companies, quotes created and their value, payments and their value — one row per month. The one to open first.",
    columns: "Month · New companies · Cumulative · Quotes · Quoted value · Payments · Payment value",
  },
  {
    key: "companies",
    title: "All companies",
    description:
      "Every company with plan, subscription status, usage counts, Stripe status and sending domain. Useful for segmentation and for spotting accounts that signed up and never did anything.",
    columns: "Company · Status · Signed up · Plan · Members · Clients · Quotes · Invoices",
  },
  {
    key: "subscriptions",
    title: "Subscriptions",
    description:
      "Billing detail per company, including whether a Stripe subscription is actually linked. Reconcile this against Stripe when MRR looks wrong.",
    columns: "Company · Plan · Monthly · Status · Started · Renews · Stripe linked",
  },
];

export default function PlatformReportsPage() {
  const [busy, setBusy] = useState(null);
  const [error, setError] = useState("");

  async function download(key) {
    setBusy(key);
    setError("");
    try {
      const res = await fetch(`/api/platform/reports?report=${key}`);
      if (!res.ok) {
        const d = await res.json().catch(() => null);
        throw new Error(d?.error || `Export failed (${res.status}).`);
      }

      // Blob rather than navigating to the URL — a plain link would work, but
      // this surfaces a failed request as an error message instead of dumping
      // an error page into a downloaded file.
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;

      const disposition = res.headers.get("Content-Disposition") || "";
      a.download =
        disposition.match(/filename="(.+?)"/)?.[1] || `${key}.csv`;

      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Reports</h1>
        <p className="text-sm text-muted-foreground mt-1">
          CSV exports for growth analysis and board updates.
        </p>
      </div>

      {error && (
        <div className="bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 rounded-xl p-4 flex items-center gap-2 text-sm text-red-700 dark:text-red-300">
          <AlertCircle size={16} /> {error}
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {REPORTS.map((r) => (
          <div
            key={r.key}
            className="bg-card border border-border rounded-xl p-5 flex flex-col"
          >
            <FileSpreadsheet size={20} className="text-[#bd9d60]" />
            <h2 className="mt-3 font-semibold text-foreground">{r.title}</h2>
            <p className="mt-1 text-sm text-muted-foreground flex-1">{r.description}</p>
            <p className="mt-3 text-xs text-muted-foreground">{r.columns}</p>
            <button
              onClick={() => download(r.key)}
              disabled={busy === r.key}
              className="mt-4 inline-flex items-center justify-center gap-2 bg-inverted text-inverted-foreground text-sm font-semibold px-4 py-2 rounded-lg disabled:opacity-60"
            >
              {busy === r.key ? (
                <Loader2 size={14} className="animate-spin" />
              ) : (
                <Download size={14} />
              )}
              Download CSV
            </button>
          </div>
        ))}
      </div>

      <div className="bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900 rounded-xl p-4 text-sm text-amber-900 dark:text-amber-200">
        <p className="font-medium">These files contain customer data.</p>
        <p className="mt-1 text-amber-800 dark:text-amber-300">
          Company names, contact emails and revenue figures. Treat them the way
          you&apos;d treat a database dump — they&apos;re fine on your machine,
          less fine in a shared drive or an email thread.
        </p>
      </div>
    </div>
  );
}
