"use client";

// app/platform/companies/[id]/CompanyInfluencer.js
//
// The company's standing in the influencer programme, and — for a
// superadmin — the control that enrols it. See the route's header
// (app/api/platform/companies/[id]/influencer/route.js) for why this is the
// one write beside extend-trial the console may make to a company row.
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Handshake, Loader2 } from "lucide-react";

import { fetchJson } from "@/lib/fetchJson";
import PlatformWriteGate, { usePlatformAdmin } from "@/app/components/platform/PlatformWriteGate";

function dollars(cents) {
  return `$${(Number(cents || 0) / 100).toFixed(0)}`;
}

export default function CompanyInfluencer({ companyId, onDone }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [planId, setPlanId] = useState("");
  const [busy, setBusy] = useState(false);
  const { status: roleStatus, error: roleError, isSuperadmin } = usePlatformAdmin();

  const load = useCallback(async () => {
    try {
      const json = await fetchJson(`/api/platform/companies/${companyId}/influencer`);
      setData(json);
      setError("");
    } catch (e) {
      setError(e.message || "Couldn't load the influencer standing.");
    }
  }, [companyId]);

  useEffect(() => {
    load();
  }, [load]);

  const [confirmStop, setConfirmStop] = useState(false);
  async function stop() {
    setBusy(true);
    setError("");
    try {
      const json = await fetchJson(`/api/platform/companies/${companyId}/influencer`, { method: "DELETE" });
      setData((d) => ({ ...(d || {}), ...json }));
      setConfirmStop(false);
      onDone?.();
    } catch (e) {
      setError(e.message || "Could not stop the influencer status.");
    } finally {
      setBusy(false);
    }
  }

  async function enrol() {
    setBusy(true);
    setError("");
    try {
      const json = await fetchJson(`/api/platform/companies/${companyId}/influencer`, {
        method: "POST",
        body: { commissionPlanId: planId },
      });
      setData((d) => ({ ...(d || {}), ...json }));
      onDone?.();
    } catch (e) {
      setError(e.message || "Enrolment failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="bg-card border border-border rounded-xl p-5">
      <h2 className="font-semibold text-foreground mb-1 flex items-center gap-2">
        <Handshake size={16} className="text-muted-foreground" />
        Influencer programme
      </h2>
      <p className="text-xs text-muted-foreground mb-4">
        An influencer&apos;s referral link earns a sales commission instead of the referrer&apos;s free
        month. Their ledger is a row on{" "}
        <Link href="/platform/sales/reps" className="underline underline-offset-2">
          /platform/sales/reps
        </Link>{" "}
        and pays out through the same weekly batches.
      </p>

      {!data && !error ? (
        <p className="text-sm text-muted-foreground flex items-center gap-2">
          <Loader2 size={14} className="animate-spin" /> Loading…
        </p>
      ) : null}

      {data?.enrolled ? (
        <dl className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm">
          <div>
            <dt className="text-xs text-muted-foreground">Enrolled</dt>
            <dd className="text-foreground">{new Date(data.influencerAt).toLocaleDateString()}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">Commission plan</dt>
            <dd className="text-foreground">
              {data.plan ? data.plan.name : <span className="text-amber-700 dark:text-amber-300">None — milestones are not recorded</span>}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">Companies referred</dt>
            <dd className="text-foreground">{data.referredCount}</dd>
          </div>
          <div className="sm:col-span-3">
            <dt className="text-xs text-muted-foreground">Ledger</dt>
            <dd className="text-foreground">
              <Link
                href={`/platform/sales/reps#rep-${encodeURIComponent(data.ledgerId)}`}
                className="underline underline-offset-2"
              >
                Open on /platform/sales/reps
              </Link>
              {data.ledgerActive === false ? " · ledger deactivated" : ""}
            </dd>
          </div>
          {/* The reverse of enrolment, on the same page as enrolment, so the
              company row and the ledger row are always changed together.
              The confirm sentence says exactly what happens — a "deactivate"
              that silently kept the company flagged would leave them earning
              neither commission nor the free month. */}
          <div className="sm:col-span-3">
            <PlatformWriteGate
              status={roleStatus}
              allowed={isSuperadmin}
              error={roleError}
              action="Stopping a company's influencer status"
              who="superadmin"
            >
              {!confirmStop ? (
                <button
                  type="button"
                  onClick={() => setConfirmStop(true)}
                  className="min-h-[44px] lg:min-h-0 inline-flex items-center gap-1.5 border border-border rounded-full px-4 py-2 text-xs font-bold"
                  data-influencer-stop
                >
                  Stop influencer status
                </button>
              ) : (
                <div className="rounded-lg border border-amber-300 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/40 p-3 text-sm space-y-2">
                  <p className="text-foreground">
                    This company goes back to the ordinary referral rules from now: their link earns them the
                    free month again, not commission. The ledger is deactivated, never deleted — everything already
                    earned is still paid in the normal batch — and the referral link keeps working. Re-enrolling
                    later reactivates the same ledger under whichever plan you choose then.
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={stop}
                      disabled={busy}
                      className="min-h-[44px] lg:min-h-0 inline-flex items-center gap-1.5 bg-inverted text-inverted-foreground rounded-full px-4 py-2 text-xs font-bold disabled:opacity-50"
                      data-influencer-stop-confirm
                    >
                      {busy ? <Loader2 size={13} className="animate-spin" /> : null}
                      Yes, stop it
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmStop(false)}
                      disabled={busy}
                      className="min-h-[44px] lg:min-h-0 inline-flex items-center rounded-full px-4 py-2 text-xs font-bold border border-border"
                    >
                      Keep it
                    </button>
                  </div>
                </div>
              )}
            </PlatformWriteGate>
          </div>
        </dl>
      ) : null}

      {data && !data.enrolled ? (
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">Not an influencer.</p>
          <PlatformWriteGate
            status={roleStatus}
            allowed={isSuperadmin}
            error={roleError}
            action="Enrolling a company as an influencer"
            who="superadmin"
          >
            <div className="flex flex-wrap items-end gap-2">
              <label className="block">
                <span className="block text-xs font-medium text-muted-foreground mb-1">Commission plan</span>
                <select
                  value={planId}
                  onChange={(e) => setPlanId(e.target.value)}
                  className="rounded-lg border border-border bg-background px-3 py-2 text-sm min-w-[16rem]"
                >
                  <option value="">Choose a plan</option>
                  {(data.plans || []).map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} — {dollars(p.activationCents)} / {dollars(p.firstPaymentCents)} / {dollars(p.retentionCents)}
                    </option>
                  ))}
                </select>
              </label>
              <button
                type="button"
                onClick={enrol}
                disabled={!planId || busy}
                className="min-h-[44px] lg:min-h-0 inline-flex items-center gap-1.5 bg-inverted text-inverted-foreground rounded-full px-4 py-2 text-xs font-bold disabled:opacity-50"
              >
                {busy ? <Loader2 size={13} className="animate-spin" /> : <Handshake size={13} />}
                Enrol as influencer
              </button>
            </div>
            {(data.plans || []).length === 0 ? (
              <p className="text-xs text-muted-foreground mt-2">
                No active commission plan. Make one on /platform/sales/plans first.
              </p>
            ) : (
              <p className="text-xs text-muted-foreground mt-2">
                Their referral code is minted if they have none, and their link starts earning under
                this plan from the next signup. Earlier referrals are not moved. A company that was an
                influencer before gets its old ledger back under this plan, with everything it earned.
              </p>
            )}
          </PlatformWriteGate>
        </div>
      ) : null}

      {error ? <p className="text-xs text-red-600 mt-2">{error}</p> : null}
    </div>
  );
}
