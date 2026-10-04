// app/platform/companies/[id]/CompanyActions.js
//
// Support actions that change FieldQuo's relationship with a customer — never
// their own data. Each one asks for a reason and writes an audit row, so
// "why is this account free until March" always has an answer.
//
// ── The comment that was wrong, and what it now describes ──────────────────
//
// This header used to read "Superadmin-only server-side; the panel says so
// rather than hiding". Half of that was true: extend-trial requires
// billing:manage, which is in SUPERADMIN_ONLY_PERMISSIONS. The other half was
// not — the panel said nothing of the kind. An admin or a support agent got a
// working-looking form, typed a reason, pressed Extend and got a 403.
//
// The intent was right, so the panel now does what the comment claimed: the
// heading and the explanation stay visible for everyone (a support agent has
// to know this exists in order to ask for it), and only the CONTROLS are
// replaced — by one block naming who can do it, never by a greyed-out form
// beside a floating sentence.
"use client";

import { useState } from "react";
import { Loader2, Gift, ShieldAlert, RefreshCw, Ban, LockOpen } from "lucide-react";
import PlatformWriteGate, {
  usePlatformAdmin,
} from "@/app/components/platform/PlatformWriteGate";

export default function CompanyActions({ companyId, companyName, trialEndsAt, subscription, cancelOptions, unlock, onDone }) {
  const [days, setDays] = useState(30);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");
  const { status: roleStatus, error: roleError, can } = usePlatformAdmin();
  const canExtend = can("billing:manage");

  async function extendTrial() {
    setBusy(true);
    setError("");
    setResult(null);
    try {
      const res = await fetch(`/api/platform/companies/${companyId}/extend-trial`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ days: Number(days), reason }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || `Request failed (${res.status}).`);
      setResult(json);
      setReason("");
      onDone?.();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  const canSubmit = Number(days) >= 1 && reason.trim().length >= 3 && !busy;

  // ── End the trial now ──────────────────────────────────────────────────
  // The other direction: bill the first invoice today. Its own reason and
  // its own result, because "free until March" and "charged just now" must
  // never share a success line.
  const [endReason, setEndReason] = useState("");
  const [endBusy, setEndBusy] = useState(false);
  const [endResult, setEndResult] = useState(null);
  const [endError, setEndError] = useState("");

  // Whether there is a Stripe subscription for "End trial now" to act on.
  // The card-free trial (TRIAL_CARD_REQUIRED = false since 2026-09-24) has
  // no Subscription row at all, and a cancelled one has nothing to bill; the
  // route refuses both with a 409 before it ever asks Stripe. So the panel
  // says why instead of offering a form that can only fail. `undefined`
  // (a caller that did not pass the row) keeps the form — the route still
  // decides, and absence of the prop is not a statement that there is no card.
  // Whether a subscription that IS present is still trialing stays Stripe's
  // call, as the route's own comment explains; our status column can lag.
  const endTrialBlocked =
    subscription === undefined
      ? null
      : !subscription?.stripeSubscriptionId
        ? "nostripe"
        : subscription.status === "canceled"
          ? "canceled"
          : null;

  async function endTrial() {
    if (!window.confirm(`Charge ${companyName} now? Stripe will create and pay the first invoice immediately.`)) return;
    setEndBusy(true);
    setEndError("");
    setEndResult(null);
    try {
      const res = await fetch(`/api/platform/companies/${companyId}/end-trial`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: endReason }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || `Request failed (${res.status}).`);
      setEndResult(json);
      setEndReason("");
      onDone?.();
    } catch (e) {
      setEndError(e.message);
    } finally {
      setEndBusy(false);
    }
  }

  // ── Sync from Stripe ──────────────────────────────────────────────────
  // Rewrites OUR row from what Stripe holds. No reason asked: it changes
  // nothing about what the company pays, and the audit row carries the
  // fields that moved. Its result is shown field by field because "synced"
  // alone would hide the one thing worth knowing — whether anything was wrong.
  const [syncBusy, setSyncBusy] = useState(false);
  const [syncResult, setSyncResult] = useState(null);
  const [syncError, setSyncError] = useState("");

  async function syncFromStripe() {
    setSyncBusy(true);
    setSyncError("");
    setSyncResult(null);
    try {
      const res = await fetch(`/api/platform/companies/${companyId}/sync-subscription`, {
        method: "POST",
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || `Request failed (${res.status}).`);
      setSyncResult(json);
      onDone?.();
    } catch (e) {
      setSyncError(e.message);
    } finally {
      setSyncBusy(false);
    }
  }

  const fmt = (v) => {
    if (v === null || v === undefined) return "—";
    const d = typeof v === "string" && /^\d{4}-\d{2}-\d{2}T/.test(v) ? new Date(v) : null;
    return d && !Number.isNaN(d.getTime()) ? d.toLocaleString() : String(v);
  };

  // ── Cancel the subscription ─────────────────────────────────────────────
  //
  // Three modes, three different acts (the route's header): at the period
  // end (kind, default), now (thirty days read-only), or for a terms breach
  // (locked at once, no read-only window). The confirm sentence names the
  // consequence for the mode chosen, because "cancel" alone hides which of
  // the three the owner is about to do.
  //
  // ── Every company, not only a Stripe-subscribed one (2026-09-28) ──────
  //
  // The modes, their words and which of them this company may take come
  // from lib/platform/cancelOptions.js via the company route — the function
  // the cancel route decides with — so a card-free trial reads "At the end
  // of the free trial — full access until {date}…" and a demo reads why
  // there is nothing to do, instead of three radios that answered "there is
  // nothing to cancel". For a Stripe-subscribed company the words are the
  // exact strings this panel printed before.
  const cancelKind = cancelOptions?.kind || null;
  const cancelModes = cancelOptions?.modes || [];
  const firstAvailable = cancelModes.find((m) => m.available)?.value || null;
  const [cancelMode, setCancelMode] = useState(firstAvailable);
  const [cancelReason, setCancelReason] = useState("");
  const [cancelBusy, setCancelBusy] = useState(false);
  const [cancelResult, setCancelResult] = useState(null);
  const [cancelError, setCancelError] = useState("");
  // A reload after a press can take the chosen mode away (an ending only
  // tightens) — fall back to what is still on offer rather than submit a
  // radio that is no longer there.
  const chosenMode = cancelModes.find((m) => m.value === cancelMode && m.available) ? cancelMode : firstAvailable;
  const CANCEL_CONSEQUENCE = Object.fromEntries(cancelModes.map((m) => [m.value, m.consequence]));
  const chosen = cancelModes.find((m) => m.value === chosenMode) || null;

  async function cancelSubscription() {
    if (!chosen) return;
    const question =
      cancelKind === "stripe"
        ? `Cancel ${companyName}'s subscription? ${CANCEL_CONSEQUENCE[chosenMode]}`
        : `End ${companyName}'s access? ${CANCEL_CONSEQUENCE[chosenMode]}`;
    if (!window.confirm(question)) return;
    setCancelBusy(true);
    setCancelError("");
    setCancelResult(null);
    try {
      const res = await fetch(`/api/platform/companies/${companyId}/cancel-subscription`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: chosenMode, reason: cancelReason }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || `Failed (${res.status})`);
      setCancelResult(json);
      setCancelReason("");
      onDone?.();
    } catch (e) {
      setCancelError(e.message);
    } finally {
      setCancelBusy(false);
    }
  }

  // ── Unlock company (2026-10-03) ────────────────────────────────────────
  //
  // The reversal the cancel panel never had. Drawn only when the company
  // route says FieldQuo locked or ended this company (lib/platform/unlock.js
  // reads the rows) — a trial that ran out or a failed card is not ours to
  // unlock, and a button that answered "nothing to unlock" would be a dead
  // control. What Unlock gives back, and what it leaves off (auto top-up,
  // released numbers, Stripe), is printed before the press, not after.
  const [unlockReason, setUnlockReason] = useState("");
  const [unlockBusy, setUnlockBusy] = useState(false);
  const [unlockResult, setUnlockResult] = useState(null);
  const [unlockError, setUnlockError] = useState("");
  const canUnlock = can("company:unlock");

  async function unlockCompany() {
    if (!window.confirm(`Unlock ${companyName}? ${unlock?.after || ""}`)) return;
    setUnlockBusy(true);
    setUnlockError("");
    setUnlockResult(null);
    try {
      const res = await fetch(`/api/platform/companies/${companyId}/unlock`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: unlockReason }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || `Failed (${res.status})`);
      setUnlockResult(json);
      setUnlockReason("");
      onDone?.();
    } catch (e) {
      setUnlockError(e.message);
    } finally {
      setUnlockBusy(false);
    }
  }

  return (
    <div className="bg-card border border-border rounded-xl p-5">
      <h2 className="font-semibold text-foreground mb-1 flex items-center gap-2">
        <ShieldAlert size={16} className="text-muted-foreground" />
        Support actions
      </h2>
      <p className="text-xs text-muted-foreground mb-4">
        These change billing, never {companyName}&apos;s own records. Every action is
        logged against your name with the reason you give.
      </p>

      <div className="rounded-lg border border-border p-4">
        <div className="flex items-center gap-2 mb-3">
          <Gift size={15} className="text-muted-foreground" />
          <span className="text-sm font-semibold text-foreground">Extend free period</span>
          {trialEndsAt && (
            <span className="text-xs text-muted-foreground">
              · currently until {new Date(trialEndsAt).toLocaleDateString()}
            </span>
          )}
        </div>

        <PlatformWriteGate
          status={roleStatus}
          allowed={canExtend}
          error={roleError}
          action="Extending a free period"
          who="superadmin"
        >
        <div className="flex items-end gap-2 flex-wrap">
          <label className="flex flex-col gap-1">
            <span className="text-[11px] text-muted-foreground">Days</span>
            <input
              type="number"
              min="1"
              max="365"
              value={days}
              onChange={(e) => setDays(e.target.value)}
              className="w-20 rounded-lg border border-border bg-background px-2 py-1.5 text-sm"
            />
          </label>
          <label className="flex flex-col gap-1 flex-1 min-w-[12rem]">
            <span className="text-[11px] text-muted-foreground">Reason (required)</span>
            <input
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. promised at the trade show"
              className="w-full rounded-lg border border-border bg-background px-2 py-1.5 text-sm"
            />
          </label>
          <button
            onClick={extendTrial}
            disabled={!canSubmit}
            className="min-h-[44px] lg:min-h-0 inline-flex items-center gap-1.5 bg-inverted text-inverted-foreground rounded-full px-4 py-2 text-xs font-bold disabled:opacity-50"
          >
            {busy && <Loader2 size={13} className="animate-spin" />}
            Extend
          </button>
        </div>
        </PlatformWriteGate>

        {error && <p className="text-xs text-red-600 mt-2">{error}</p>}
        {result && (
          <div className="mt-2 text-xs">
            <p className="text-emerald-700 dark:text-emerald-300 font-semibold">
              Free until {new Date(result.trialEndsAt).toLocaleDateString()}
              {result.stripeSynced ? " · Stripe updated" : ""}
            </p>
            {/* Said out loud: a grant Stripe doesn't know about still bills. */}
            {result.note && <p className="text-amber-700 dark:text-amber-400 mt-0.5">{result.note}</p>}
          </div>
        )}
      </div>

      <div className="rounded-lg border border-border p-4 mt-3">
        <div className="flex items-center gap-2 mb-3">
          <ShieldAlert size={15} className="text-muted-foreground" />
          <span className="text-sm font-semibold text-foreground">End trial now</span>
          {!endTrialBlocked && (
            <span className="text-xs text-muted-foreground">· Stripe bills the first invoice today</span>
          )}
        </div>
        {endTrialBlocked === "nostripe" ? (
          <p className="text-xs text-muted-foreground">
            Not available: {companyName} has no Stripe subscription — it is on the free trial with no card, so
            there is nothing for Stripe to bill. The trial ends by itself
            {trialEndsAt ? ` on ${new Date(trialEndsAt).toLocaleDateString()}` : ""}, or sooner when they choose
            a plan from Account &amp; Billing.
          </p>
        ) : endTrialBlocked === "canceled" ? (
          <p className="text-xs text-muted-foreground">
            Not available: the subscription is cancelled, so there is no trial to end.
          </p>
        ) : (
        <PlatformWriteGate
          status={roleStatus}
          allowed={canExtend}
          error={roleError}
          action="Ending a free period"
          who="superadmin"
        >
          <div className="flex items-end gap-2 flex-wrap">
            <label className="flex flex-col gap-1 flex-1 min-w-[12rem]">
              <span className="text-[11px] text-muted-foreground">Reason (required)</span>
              <input
                value={endReason}
                onChange={(e) => setEndReason(e.target.value)}
                placeholder="e.g. owner's live payment test"
                className="w-full rounded-lg border border-border bg-background px-2 py-1.5 text-sm"
              />
            </label>
            <button
              onClick={endTrial}
              disabled={endReason.trim().length < 3 || endBusy}
              className="min-h-[44px] lg:min-h-0 inline-flex items-center gap-1.5 border border-border text-foreground rounded-full px-4 py-2 text-xs font-bold disabled:opacity-50"
            >
              {endBusy && <Loader2 size={13} className="animate-spin" />}
              End trial and charge now
            </button>
          </div>
        </PlatformWriteGate>
        )}
        {endError && <p className="text-xs text-red-600 mt-2">{endError}</p>}
        {endResult && (
          <p className="text-xs text-emerald-700 dark:text-emerald-300 font-semibold mt-2">
            Stripe status now &quot;{endResult.stripeStatus}&quot;
            {endResult.latestInvoice ? ` · invoice ${endResult.latestInvoice}` : ""}
            {endResult.currentPeriodEnd ? ` · next renewal ${new Date(endResult.currentPeriodEnd).toLocaleDateString()}` : ""}
          </p>
        )}
      </div>

      <div className="rounded-lg border border-border p-4 mt-3">
        <div className="flex items-center gap-2 mb-3">
          <RefreshCw size={15} className="text-muted-foreground" />
          <span className="text-sm font-semibold text-foreground">Sync from Stripe</span>
          <span className="text-xs text-muted-foreground">
            · rewrites our status, period end, trial end and cancelled-at from what Stripe holds
          </span>
        </div>
        <PlatformWriteGate
          status={roleStatus}
          allowed={canExtend}
          error={roleError}
          action="Syncing a subscription from Stripe"
          who="superadmin"
        >
          <button
            onClick={syncFromStripe}
            disabled={syncBusy}
            className="min-h-[44px] lg:min-h-0 inline-flex items-center gap-1.5 border border-border text-foreground rounded-full px-4 py-2 text-xs font-bold disabled:opacity-50"
          >
            {syncBusy ? <Loader2 size={13} className="animate-spin" /> : <RefreshCw size={13} />}
            Sync from Stripe
          </button>
        </PlatformWriteGate>
        {syncError && <p className="text-xs text-red-600 mt-2">{syncError}</p>}
        {syncResult && (
          <div className="mt-2 text-xs">
            <p className="text-emerald-700 dark:text-emerald-300 font-semibold">
              Stripe says &quot;{syncResult.stripeStatus}&quot;
              {syncResult.changed?.length
                ? ` · ${syncResult.changed.length} field${syncResult.changed.length === 1 ? "" : "s"} corrected`
                : " · our row already agreed"}
            </p>
            {syncResult.changed?.length > 0 && (
              <ul className="mt-1 space-y-0.5 font-mono text-muted-foreground">
                {syncResult.changed.map((c) => (
                  <li key={c.field}>
                    {c.field}: {fmt(c.before)} → {fmt(c.after)}
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>

      <div className="rounded-lg border border-red-300 dark:border-red-900 p-4 mt-3" data-cancel-subscription>
        <div className="flex items-center gap-2 mb-3">
          <Ban size={15} className="text-red-700 dark:text-red-300" />
          <span className="text-sm font-semibold text-foreground">{cancelOptions?.heading || "Cancel the subscription"}</span>
          {cancelOptions?.subtitle ? (
            <span className="text-xs text-muted-foreground">· {cancelOptions.subtitle}</span>
          ) : null}
        </div>
        {!cancelOptions ? (
          // No answer about which kind of company this is: say so, never
          // fall back to the Stripe radios — on a trial they would lie.
          <p className="text-xs text-muted-foreground">
            Couldn&apos;t work out whether this company has a Stripe subscription — reload the page.
          </p>
        ) : cancelOptions.refusal ? (
          <p className="text-sm text-foreground" data-cancel-refusal>
            {cancelOptions.refusal}
          </p>
        ) : (
        <PlatformWriteGate
          status={roleStatus}
          allowed={canExtend}
          error={roleError}
          action="Cancelling a subscription"
          who="superadmin"
        >
          <div className="space-y-2">
            {cancelOptions.ended?.note ? (
              <p className="text-xs text-amber-800 dark:text-amber-300">{cancelOptions.ended.note}</p>
            ) : null}
            {cancelModes.map((m) => (
              <label
                key={m.value}
                className={`flex items-start gap-2 text-sm min-h-[44px] lg:min-h-0 ${m.available ? "text-foreground" : "text-muted-foreground"}`}
              >
                <input
                  type="radio"
                  name="cancel-mode"
                  value={m.value}
                  checked={chosenMode === m.value}
                  disabled={!m.available}
                  onChange={() => setCancelMode(m.value)}
                  className="mt-1"
                />
                <span>
                  {m.label}
                  <span className="block text-xs text-muted-foreground">{m.available ? m.consequence : m.unavailable}</span>
                </span>
              </label>
            ))}
            <label className="block text-xs text-muted-foreground">
              Reason — goes in the audit log{chosenMode === "terms" ? " and on the locked screen" : ""}
              <input
                type="text"
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                placeholder={chosenMode === "terms" ? "e.g. Sent unsolicited texts through FieldQuo after a warning" : "e.g. Asked to stop by email on Sep 18"}
                className="mt-1 block w-full min-h-[44px] rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground"
              />
            </label>
            <button
              onClick={cancelSubscription}
              disabled={cancelBusy || !chosen || cancelReason.trim().length < 3}
              className="min-h-[44px] lg:min-h-0 inline-flex items-center gap-1.5 rounded-full bg-red-700 px-4 py-2 text-xs font-bold text-white disabled:opacity-50"
            >
              {cancelBusy ? <Loader2 size={13} className="animate-spin" /> : <Ban size={13} />}
              {chosen?.button || "Nothing to choose"}
            </button>
          </div>
        </PlatformWriteGate>
        )}
        {cancelError && <p className="mt-2 text-xs text-red-700 dark:text-red-300 break-words">{cancelError}</p>}
        {cancelResult && (
          <p className="mt-2 text-xs text-emerald-800 dark:text-emerald-300 break-words">
            {cancelResult.stripeStatus ? (
              <>
                Done — Stripe says {cancelResult.stripeStatus}
                {cancelResult.currentPeriodEnd ? ` · period ends ${new Date(cancelResult.currentPeriodEnd).toLocaleDateString()}` : ""}
                {" · "}{cancelResult.access}.
              </>
            ) : (
              <>Done — no Stripe subscription to cancel · {cancelResult.access}.</>
            )}
          </p>
        )}
      </div>

      {(unlock?.locked || unlockResult) && (
        <div className="rounded-lg border border-border p-4 mt-3" data-unlock-company>
          <div className="flex items-center gap-2 mb-3">
            <LockOpen size={15} className="text-muted-foreground" />
            <span className="text-sm font-semibold text-foreground">Unlock company</span>
            <span className="text-xs text-muted-foreground">· reverses FieldQuo&apos;s lock or ending, nothing else</span>
          </div>
          {unlock?.locked && (
            <>
              <p className="text-xs text-foreground break-words">{unlock.summary}</p>
              <p className="text-xs text-muted-foreground mt-1 break-words">{unlock.after}</p>
              {unlock.notRestored?.length > 0 && (
                <ul className="mt-1 list-disc pl-5 text-xs text-amber-800 dark:text-amber-300 space-y-0.5">
                  {unlock.notRestored.map((line) => (
                    <li key={line}>{line}</li>
                  ))}
                </ul>
              )}
              <div className="mt-3">
                <PlatformWriteGate
                  status={roleStatus}
                  allowed={canUnlock}
                  error={roleError}
                  action="Unlocking a company"
                  who="superadmin"
                >
                  <div className="flex items-end gap-2 flex-wrap">
                    <label className="flex flex-col gap-1 flex-1 min-w-[12rem]">
                      <span className="text-[11px] text-muted-foreground">Reason (required) — goes in the audit log</span>
                      <input
                        value={unlockReason}
                        onChange={(e) => setUnlockReason(e.target.value)}
                        placeholder="e.g. Locked the wrong company; or: put things right after the warning"
                        className="w-full min-h-[44px] lg:min-h-0 rounded-lg border border-border bg-background px-2 py-1.5 text-sm"
                      />
                    </label>
                    <button
                      onClick={unlockCompany}
                      disabled={unlockBusy || unlockReason.trim().length < 3}
                      className="min-h-[44px] lg:min-h-0 inline-flex items-center gap-1.5 border border-border text-foreground rounded-full px-4 py-2 text-xs font-bold disabled:opacity-50"
                    >
                      {unlockBusy ? <Loader2 size={13} className="animate-spin" /> : <LockOpen size={13} />}
                      Unlock company
                    </button>
                  </div>
                  <p className="text-[11px] text-muted-foreground mt-1">
                    Refused while you are in a View as company session — end it first.
                  </p>
                </PlatformWriteGate>
              </div>
            </>
          )}
          {unlockError && <p className="mt-2 text-xs text-red-700 dark:text-red-300 break-words">{unlockError}</p>}
          {unlockResult && (
            <p className="mt-2 text-xs text-emerald-800 dark:text-emerald-300 break-words">
              Unlocked — {unlockResult.after}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
