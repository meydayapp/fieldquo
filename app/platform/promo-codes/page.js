// app/platform/promo-codes/page.js
//
// Superadmin tool: mint influencer / tester promo codes and see who used them.
// A code gives the company that signs up with it extra free months (no referrer,
// no credit to anyone). Single-use per link by default — generate more as needed.
"use client";

import { useEffect, useState } from "react";
import { Copy, Check, Ticket, Loader2, Plus, Ban, RotateCcw } from "lucide-react";
import { fetchJson } from "@/lib/fetchJson";
import PlatformWriteGate, {
  usePlatformAdmin,
} from "@/app/components/platform/PlatformWriteGate";

export default function PromoCodesPage() {
  // Starts null, not []. An empty array before the server has said anything is
  // the page claiming "no codes have ever been issued" — which, on a screen
  // that tracks free months given away, is a claim worth being sure about.
  const [codes, setCodes] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  // Which row is mid-request. Per-row rather than a page-wide flag so revoking
  // one code doesn't grey out every other button on the screen.
  const [busyId, setBusyId] = useState(null);
  const [creating, setCreating] = useState(false);
  const [copied, setCopied] = useState("");
  const [form, setForm] = useState({
    label: "",
    notes: "",
    kind: "influencer",
    rewardMonths: 3,
    maxRedemptions: 1,
    expiresAt: "",
  });

  // Minting a code is superadmin-only in the route (an explicit role check —
  // "Minting free months is a superadmin action, like adding a platform
  // teammate"). Everyone else used to fill this form in and meet the 403.
  const { status: roleStatus, error: roleError, isSuperadmin, can } =
    usePlatformAdmin();
  // Revoking is a different gate from minting: PATCH /promo-codes/[id] takes
  // "plan:manage", which an admin holds and support does not. Two permissions,
  // so two decisions — collapsing them into one flag is how a screen ends up
  // hiding a control its owner is allowed to use.
  const canRevoke = can("plan:manage");

  async function load() {
    try {
      setCodes(await fetchJson("/api/platform/promo-codes"));
    } catch (e) {
      setError(e.message || "Couldn't load codes.");
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    load();
  }, []);

  // Both are money. `Number(x) || 3` silently turned a cleared field into three
  // free months and a typo into one redemption — a substituted value nobody was
  // told about, on the two fields that decide what the code is worth.
  const months = Number(form.rewardMonths);
  const redemptions = Number(form.maxRedemptions);
  const monthsValid = Number.isInteger(months) && months >= 1 && months <= 24;
  const redemptionsValid = Number.isInteger(redemptions) && redemptions >= 1;
  const labelValid = form.label.trim().length > 0;
  const canGenerate =
    isSuperadmin && labelValid && monthsValid && redemptionsValid && !creating;

  async function generate(e) {
    e.preventDefault();
    setCreating(true);
    setError("");
    try {
      await fetchJson("/api/platform/promo-codes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          rewardMonths: months,
          maxRedemptions: redemptions,
          expiresAt: form.expiresAt || null,
        }),
      });
      setForm((f) => ({ ...f, label: "", notes: "" }));
      await load();
    } catch (e) {
      setError(e.message || "Couldn't generate the code.");
    } finally {
      setCreating(false);
    }
  }

  const origin = typeof window !== "undefined" ? window.location.origin : "";
  function copy(text, key) {
    navigator.clipboard?.writeText(text);
    setCopied(key);
    setTimeout(() => setCopied(""), 1500);
  }

  async function setActive(code, active) {
    // Revoking is reversible and takes effect immediately at redemption, so no
    // confirm() — the row flips to "Revoked" and the button becomes
    // "Reinstate", which is a clearer answer than a dialog.
    setBusyId(code.id);
    setError("");
    try {
      const updated = await fetchJson(`/api/platform/promo-codes/${code.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ active }),
      });
      setCodes((prev) =>
        prev.map((c) => (c.id === code.id ? { ...c, ...updated } : c)),
      );
    } catch (err) {
      setError(
        err?.message ||
          `Couldn't ${active ? "reinstate" : "revoke"} that code. Try again.`,
      );
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="p-4 sm:p-6 max-w-5xl mx-auto space-y-6">
      <div className="flex items-center gap-2">
        <Ticket size={20} className="text-foreground" />
        <h1 className="text-2xl font-bold text-foreground">Influencer &amp; tester codes</h1>
      </div>
      <p className="text-sm text-muted-foreground -mt-3">
        Each code gives the company that signs up with it a longer free trial. No
        referrer, no credit to anyone — just extra free months. Single-use by
        default; generate one per person and label who you gave it to.
      </p>

      {error && (
        <div className="bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 text-red-700 dark:text-red-300 text-sm rounded-lg px-4 py-3">
          {error}
        </div>
      )}

      {/* Generate */}
      <PlatformWriteGate
        status={roleStatus}
        allowed={isSuperadmin}
        error={roleError}
        action="Minting a code for free months"
        who="superadmin"
      >
      <form onSubmit={generate} className="bg-card border border-border rounded-xl p-5 space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <label className="block">
            <span className="block text-xs font-medium text-muted-foreground mb-1">Given to (label)</span>
            <input
              value={form.label}
              onChange={(e) => setForm({ ...form, label: e.target.value })}
              placeholder="e.g. @trade_influencer / Jane at ABC Reno"
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
            />
          </label>
          <label className="block">
            <span className="block text-xs font-medium text-muted-foreground mb-1">Type</span>
            <select
              value={form.kind}
              onChange={(e) => setForm({ ...form, kind: e.target.value })}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
            >
              <option value="influencer">Influencer</option>
              <option value="tester">Tester</option>
            </select>
          </label>
          <label className="block">
            <span className="block text-xs font-medium text-muted-foreground mb-1">Free months</span>
            <input
              type="number"
              min="1"
              max="24"
              value={form.rewardMonths}
              onChange={(e) => setForm({ ...form, rewardMonths: e.target.value })}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
            />
          </label>
          <label className="block">
            <span className="block text-xs font-medium text-muted-foreground mb-1">Max redemptions</span>
            <input
              type="number"
              min="1"
              value={form.maxRedemptions}
              onChange={(e) => setForm({ ...form, maxRedemptions: e.target.value })}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
            />
            <span className="block text-[11px] text-muted-foreground mt-1">1 = single use.</span>
          </label>
          <label className="block sm:col-span-2">
            <span className="block text-xs font-medium text-muted-foreground mb-1">Notes (optional, internal)</span>
            <input
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              placeholder="Campaign, contact details, expiry reason…"
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
            />
          </label>
          <label className="block">
            <span className="block text-xs font-medium text-muted-foreground mb-1">Expires (optional)</span>
            <input
              type="date"
              value={form.expiresAt}
              onChange={(e) => setForm({ ...form, expiresAt: e.target.value })}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
            />
          </label>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <button
            type="submit"
            disabled={!canGenerate}
            className="inline-flex items-center gap-2 bg-inverted text-inverted-foreground px-5 py-2.5 rounded-full text-sm font-semibold disabled:opacity-60"
          >
            {creating ? <Loader2 size={15} className="animate-spin" /> : <Plus size={15} />}
            Generate code
          </button>
          {/* Said before the click, not after it. The route rejects an
              unlabelled code with a good explanation, but learning the rule
              from a red box you triggered is learning it the expensive way. */}
          {!labelValid && (
            <span className="text-xs text-muted-foreground">
              Say who it&apos;s for first — an unlabelled code can&apos;t be
              traced back to anyone.
            </span>
          )}
          {labelValid && !monthsValid && (
            <span className="text-xs text-muted-foreground">
              Free months must be a whole number from 1 to 24.
            </span>
          )}
          {labelValid && monthsValid && !redemptionsValid && (
            <span className="text-xs text-muted-foreground">
              Max redemptions must be a whole number, 1 or more.
            </span>
          )}
        </div>
      </form>
      </PlatformWriteGate>

      {/* List */}
      {loading ? (
        <div className="h-32 bg-accent rounded-xl animate-pulse" />
      ) : !codes ? (
        // The load failed. The red banner above says why; what must NOT happen
        // here is "No codes yet", which reads as a fact about how many free
        // months FieldQuo has given away.
        <p className="text-sm text-muted-foreground">
          The list of codes couldn&apos;t be loaded. Nothing has been revoked or
          deleted — this is a display failure, not an empty ledger.
        </p>
      ) : codes.length === 0 ? (
        <p className="text-sm text-muted-foreground">No codes yet.</p>
      ) : (
        <div className="space-y-3">
          {codes.map((c) => {
            const link = `${origin}/signup?ref=${c.code}`;
            const exhausted = c.redeemedCount >= c.maxRedemptions;
            return (
              <div key={c.id} className="bg-card border border-border rounded-xl p-4">
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono font-semibold text-foreground">{c.code}</span>
                      <button
                        onClick={() => copy(c.code, `code-${c.id}`)}
                        className="text-muted-foreground hover:text-foreground"
                        aria-label="Copy code"
                      >
                        {copied === `code-${c.id}` ? <Check size={13} /> : <Copy size={13} />}
                      </button>
                      <span className="text-[11px] uppercase tracking-wide px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground">
                        {c.kind}
                      </span>
                      {(!c.active || exhausted) && (
                        <span className="text-[11px] px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground">
                          {exhausted ? "used up" : "inactive"}
                        </span>
                      )}
                    </div>
                    {c.label && <p className="text-sm text-foreground mt-1">{c.label}</p>}
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {!c.active && (
                        <span className="font-semibold text-foreground">Revoked · </span>
                      )}
                      {c.rewardMonths} free months · {c.redeemedCount}/{c.maxRedemptions} used
                      {c.expiresAt && ` · expires ${new Date(c.expiresAt).toLocaleDateString()}`}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={() => copy(link, `link-${c.id}`)}
                      className="inline-flex items-center gap-1.5 text-xs font-semibold border border-border rounded-full px-3 py-1.5"
                    >
                      {copied === `link-${c.id}` ? <Check size={13} /> : <Copy size={13} />}
                      Copy signup link
                    </button>
                    {/* Revoke, not delete. The redemptions below this row point
                        at the code, and removing it would orphan the record of
                        why a company has free months. */}
                    {canRevoke && (
                    <button
                      onClick={() => setActive(c, !c.active)}
                      disabled={busyId === c.id}
                      className={`inline-flex items-center gap-1.5 text-xs font-semibold border rounded-full px-3 py-1.5 disabled:opacity-50 ${
                        c.active
                          ? "border-border text-muted-foreground hover:text-foreground"
                          : "border-border text-foreground"
                      }`}
                    >
                      {busyId === c.id ? (
                        <Loader2 size={13} className="animate-spin" />
                      ) : c.active ? (
                        <Ban size={13} />
                      ) : (
                        <RotateCcw size={13} />
                      )}
                      {c.active ? "Revoke" : "Reinstate"}
                    </button>
                    )}
                  </div>
                </div>
                {c.redemptions.length > 0 && (
                  <div className="mt-3 pt-3 border-t border-border text-xs text-muted-foreground space-y-1">
                    {c.redemptions.map((r, i) => (
                      <div key={i} className="flex justify-between gap-3">
                        <span className="truncate">{r.companyName}</span>
                        <span className="shrink-0">
                          {r.monthsGranted} mo · {new Date(r.redeemedAt).toLocaleDateString()}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
