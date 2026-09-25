// app/platform/ai-billing/page.js
//
// Who pays for each AI feature — FieldQuo or the company — with what each cost
// last month and this month on both ledgers, and receipt reading per company.
//
// The switch is drawn ONLY for features whose code actually routes through it
// (lib/ai/featurePayer.js's `wired`). The rest are listed with the payer they
// are set to use and a plain sentence saying the switch does not reach them
// yet — a toggle that saves and changes nothing is the failure AGENTS.md
// opens with.
"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { AlertCircle, Loader2, Receipt, Wallet } from "lucide-react";
import { fetchJson } from "@/lib/fetchJson";
import PlatformWriteGate, { usePlatformAdmin } from "@/app/components/platform/PlatformWriteGate";

// USD: FieldQuo pays OpenAI in dollars and this page reports FieldQuo's cost.
const money = (micros) => {
  const v = Number(micros);
  if (!Number.isFinite(v)) return "—";
  const d = v / 1_000_000;
  return d > 0 && d < 0.01 ? "<$0.01" : `$${d.toFixed(2)}`;
};

const PAYER_LABEL = { fieldquo: "FieldQuo pays", company: "Company's AI allowance" };

export default function AiBillingPage() {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState("");
  const { status: roleStatus, error: roleError, isSuperadmin } = usePlatformAdmin();

  const load = useCallback(async () => {
    try {
      setData(await fetchJson("/api/platform/ai-billing"));
      setError("");
    } catch (err) {
      setError(err.message);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function setPayer(feature, payer) {
    setSaving(feature);
    setError("");
    try {
      await fetchJson("/api/platform/ai-billing", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ feature, payer }),
      });
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving("");
    }
  }

  if (!data && !error) return <div className="animate-pulse h-96 bg-accent rounded-xl" />;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">AI billing — who pays</h1>
        <p className="text-sm text-muted-foreground mt-1">
          For each AI feature: FieldQuo pays (its own AI budget, not the company&apos;s allowance), or it
          counts against the company&apos;s monthly AI allowance. A change reaches every server within{" "}
          {data?.cacheSeconds ?? 60} seconds.
        </p>
      </div>

      {error && (
        <div className="bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 rounded-xl px-4 py-3 flex items-start gap-2 text-sm text-red-700 dark:text-red-300">
          <AlertCircle size={16} className="shrink-0 mt-0.5" />
          {error}
        </div>
      )}

      <PlatformWriteGate
        status={roleStatus}
        allowed={isSuperadmin}
        error={roleError}
        action="Changing who pays for an AI feature"
        who="superadmin"
      >
        {null}
      </PlatformWriteGate>

      {data && (
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-border flex items-center gap-2">
            <Wallet size={16} className="text-muted-foreground" />
            <h2 className="font-semibold text-foreground">Features</h2>
          </div>
          <div className="divide-y divide-border">
            {data.features.map((f) => {
              const last = f.spend.lastMonth;
              const now = f.spend.thisMonth;
              return (
                <div key={f.feature} className="px-5 py-4 flex flex-wrap items-start justify-between gap-4">
                  <div className="min-w-0 max-w-xl">
                    <div className="font-medium text-foreground">{f.label}</div>
                    <p className="text-xs text-muted-foreground mt-0.5">{f.blurb}</p>
                    <p className="text-xs text-muted-foreground mt-1.5 tabular-nums">
                      Last month: {money(last.fieldquo.costMicros)} FieldQuo ({last.fieldquo.calls} calls) ·{" "}
                      {money(last.company.costMicros)} company allowance ({last.company.calls} calls)
                      <br />
                      This month: {money(now.fieldquo.costMicros)} FieldQuo ({now.fieldquo.calls}) ·{" "}
                      {money(now.company.costMicros)} company ({now.company.calls})
                    </p>
                    {!f.wired && (
                      <p className="text-xs text-amber-700 dark:text-amber-300 mt-1.5">
                        Not routed through this switch yet — today this feature still counts against the
                        company&apos;s allowance, whatever is set here. Set to{" "}
                        {PAYER_LABEL[f.defaultPayer].toLowerCase()} once it is moved onto the switch.
                      </p>
                    )}
                  </div>
                  <div className="shrink-0 text-right">
                    {f.wired && isSuperadmin ? (
                      <div className="inline-flex rounded-lg border border-border overflow-hidden" role="group" aria-label={`Who pays for ${f.label}`}>
                        {["fieldquo", "company"].map((p) => (
                          <button
                            key={p}
                            type="button"
                            disabled={saving === f.feature || f.payer === p}
                            onClick={() => setPayer(f.feature, p)}
                            className={`min-h-[44px] lg:min-h-0 px-3 py-1.5 text-xs font-semibold ${
                              f.payer === p
                                ? "bg-inverted text-inverted-foreground"
                                : "text-muted-foreground hover:bg-muted"
                            }`}
                          >
                            {saving === f.feature && f.payer !== p ? (
                              <Loader2 size={11} className="animate-spin inline" />
                            ) : (
                              PAYER_LABEL[p]
                            )}
                          </button>
                        ))}
                      </div>
                    ) : (
                      <span className="text-sm text-muted-foreground">
                        {f.wired ? PAYER_LABEL[f.payer] : `Planned: ${PAYER_LABEL[f.defaultPayer]}`}
                      </span>
                    )}
                    <div className="text-[11px] text-muted-foreground mt-1">
                      {f.explicit ? "Set on this page" : "Default"}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {data && (
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <div className="px-5 py-4 border-b border-border">
            <h2 className="font-semibold text-foreground flex items-center gap-2">
              <Receipt size={16} className="text-muted-foreground" />
              Receipt reading by company
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Every receipt read, on whichever ledger paid for it. Estimates from the token counts — not an
              invoice.
            </p>
          </div>
          {data.receiptScans.length === 0 ? (
            <p className="px-5 py-8 text-sm text-muted-foreground text-center">
              No receipts read this month or last.
            </p>
          ) : (
            <div className="divide-y divide-border">
              {data.receiptScans.map((r) => (
                <div key={r.companyId} className="px-5 py-3 flex flex-wrap items-center justify-between gap-2 text-sm">
                  <Link href={`/platform/companies/${r.companyId}`} className="font-medium text-foreground hover:underline">
                    {r.name}
                  </Link>
                  <span className="text-xs text-muted-foreground tabular-nums">
                    This month {r.thisMonth.calls} reads · {money(r.thisMonth.fieldquo)} FieldQuo ·{" "}
                    {money(r.thisMonth.company)} company — last month {r.lastMonth.calls} ·{" "}
                    {money(r.lastMonth.fieldquo + r.lastMonth.company)}
                  </span>
                </div>
              ))}
            </div>
          )}
          {data.receiptScansCapped && (
            <p className="px-5 py-3 text-xs text-amber-700 dark:text-amber-300 border-t border-border">
              Only the most recent 20,000 FieldQuo-paid reads are counted here.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
