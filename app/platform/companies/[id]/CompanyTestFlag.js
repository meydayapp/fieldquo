// app/platform/companies/[id]/CompanyTestFlag.js
//
// The "Test company" switch (owner, 2026-10-03). Marking a company as a test
// takes it out of every /platform number — revenue/MRR, paying and trialing
// counts, signups, funnels, cohorts, cost per signup — and changes nothing
// for the company itself. Route and rules: app/api/platform/companies/[id]/
// test-company, lib/platform/metricsScope.js.
//
// The heading and the explanation show for everyone (support has to know the
// switch exists to ask for it); the control is superadmin-only, by the same
// PlatformWriteGate the other support actions use, and the server refuses
// anyone else whatever the page draws.
"use client";

import { useState } from "react";
import { FlaskConical, Loader2 } from "lucide-react";
import PlatformWriteGate, { usePlatformAdmin } from "@/app/components/platform/PlatformWriteGate";

export default function CompanyTestFlag({ companyId, companyName, isDemo, isTestCompany, testMarkedAt, testMarkedByEmail, onDone }) {
  const { status: roleStatus, error: roleError, can } = usePlatformAdmin();
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function flip() {
    const next = !isTestCompany;
    const question = next
      ? `Mark ${companyName || "this company"} as a test company? It leaves every FieldQuo number (MRR, paying, trialing, signups, funnels). Nothing changes for the company.`
      : `Count ${companyName || "this company"} again? It goes back into every FieldQuo number.`;
    if (!window.confirm(question)) return;
    setBusy(true);
    setError("");
    try {
      const res = await fetch(`/api/platform/companies/${companyId}/test-company`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isTest: next, reason }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || `Failed (${res.status})`);
      setReason("");
      onDone?.();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="bg-card border border-border rounded-xl p-5" data-test-company-switch>
      <h2 className="font-semibold text-foreground mb-1 flex items-center gap-2">
        <FlaskConical size={16} className="text-muted-foreground" />
        Test company
        {isTestCompany ? (
          <span className="text-xs px-2 py-0.5 rounded-full border bg-violet-50 dark:bg-violet-950/40 text-violet-800 dark:text-violet-200 border-violet-300 dark:border-violet-800 font-semibold">
            Test
          </span>
        ) : null}
      </h2>
      <p className="text-xs text-muted-foreground mb-3">
        A test company is left out of every FieldQuo number — revenue and MRR, paying and trialing counts, signups,
        funnels, cohorts and cost per signup. It keeps working exactly as before; only our own numbers stop counting it.
      </p>
      {isDemo ? (
        <p className="text-sm text-foreground">This is a FieldQuo demo — already left out of every number.</p>
      ) : (
        <>
          <p className="text-sm text-foreground">
            {isTestCompany
              ? `Marked test${testMarkedByEmail ? ` by ${testMarkedByEmail}` : ""}${testMarkedAt ? ` on ${new Date(testMarkedAt).toLocaleDateString()}` : ""} — in no count.`
              : "Counted as a real company."}
          </p>
          <div className="mt-3">
            <PlatformWriteGate
              status={roleStatus}
              allowed={can("company:mark_test")}
              error={roleError}
              action="Marking a company as a test"
              who="superadmin"
            >
              <div className="flex items-end gap-2 flex-wrap">
                <label className="flex flex-col gap-1 flex-1 min-w-[12rem]">
                  <span className="text-[11px] text-muted-foreground">Reason (required) — goes in the audit log</span>
                  <input
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    placeholder={isTestCompany ? "e.g. Became a real customer" : "e.g. Owner's live payment test"}
                    className="w-full min-h-[44px] lg:min-h-0 rounded-lg border border-border bg-background px-2 py-1.5 text-sm"
                  />
                </label>
                <button
                  onClick={flip}
                  disabled={busy || reason.trim().length < 3}
                  className="min-h-[44px] lg:min-h-0 inline-flex items-center gap-1.5 border border-border text-foreground rounded-full px-4 py-2 text-xs font-bold disabled:opacity-50"
                >
                  {busy ? <Loader2 size={13} className="animate-spin" /> : <FlaskConical size={13} />}
                  {isTestCompany ? "Count it again" : "Mark as test company"}
                </button>
              </div>
            </PlatformWriteGate>
          </div>
          {error && <p className="mt-2 text-xs text-red-700 dark:text-red-300 break-words">{error}</p>}
        </>
      )}
    </div>
  );
}
