// app/sales/demo/page.js
//
// The account a rep drives while a prospect watches.
//
// ══ Why this is not "Run the demo" ════════════════════════════════════════
//
// The platform console opens a demo through impersonation, which is read-only
// and superadmin-only — twice enforced, deliberately. A rep impersonating
// could not write a quote, and watching a quote get written is the only part
// of a demo a prospect cares about. So a rep signs in for real, to a fixture
// company FieldQuo owns, and can do everything in it.
//
// ══ It says what it cannot do ═════════════════════════════════════════════
//
// The password is not on this screen and cannot be: creating and resetting a
// login is superadmin-only (non-negotiable #1, and the one exception is gated
// and derives the address from the slug). A screen that showed a blank field
// labelled "password" would be a control that appears to work. This one names
// who to ask.
//
// ══ Three states, because getting a demo is a chain of two ════════════════
//
// A demo is usable when BOTH are true: some SalesRep row points at it, and
// demoN@fieldquo.com exists as an active owner of it. They are set by
// different people through different doors, so they fail independently:
//
//   1. NO DEMO. Claim one — a free demo is one nobody holds, and taking it
//      creates no user and touches no company. If none are free, say how many
//      exist and that they are all taken, rather than offering a button that
//      would 409.
//   2. DEMO, NO LOGIN. The address exists as a string and as nothing else.
//      This state used to render "Sign in at demo6@fieldquo.com" and an
//      "Open the demo company" button — a sign-in control against an account
//      that does not exist, which fails at the password box, mid-call, with no
//      explanation. It now names the exact thing to ask for and who has it.
//   3. READY. The address, and the way in.
//
// The screen used to have a fourth state that was a lie: "Ask a FieldQuo admin
// to assign you one on the platform demo screen — it takes them a click."
// There was no such click. SalesRep.demoCompanyId was read in three places and
// written in none, on either side of the product.
"use client";

import { useCallback, useEffect, useState } from "react";
import { AlertCircle, ExternalLink, Loader2, RefreshCw, Wrench, KeyRound, HandGrab } from "lucide-react";
import { fetchJson } from "@/lib/fetchJson";

const BTN =
  "inline-flex items-center justify-center gap-2 min-h-[44px] px-4 py-2.5 rounded-lg text-sm font-semibold disabled:opacity-60";
const FIELD =
  "w-full border border-border rounded-lg px-3 py-2.5 min-h-[44px] text-base bg-card text-foreground disabled:opacity-60";
const CARD = "rounded-xl border border-border bg-card p-4 space-y-3";

export default function SalesDemoPage() {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState("");
  const [confirmReset, setConfirmReset] = useState(false);

  const load = useCallback(async () => {
    setError("");
    try {
      setData(await fetchJson("/api/sales/demo"));
    } catch (err) {
      setError(err?.message || "Could not load your demo.");
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function act(body) {
    setBusy(body.action);
    setError("");
    try {
      await fetchJson("/api/sales/demo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      setConfirmReset(false);
      await load();
    } catch (err) {
      setError(err?.message || "That did not work.");
    } finally {
      setBusy("");
    }
  }

  const company = data?.company;

  // ── The two controls that work WITHOUT a login ──────────────────────────
  //
  // Extracted so states 2 and 3 render exactly the same markup rather than two
  // copies that drift — the copy-paste failure class this repo names, and the
  // copy that rots is always the one nobody looks at. Both go through this
  // portal's own API, not through the demo company, so a rep who is still
  // waiting on a password can set the trade up for tomorrow's call today.
  //
  // `demoIndustry`, not `industry`: Company has no `industry` column. The
  // select on this page read one, which meant it always showed "Not set"
  // regardless of the trade the demo was actually dressed as.
  const tradeCard = !company ? null : (
    <section className={CARD}>
      <h2 className="text-base font-semibold text-foreground flex items-center gap-2">
        <Wrench size={16} /> What trade it is set up as
      </h2>
      <p className="text-sm text-muted-foreground break-words">
        A roofer watching a cabinet maker&rsquo;s quote is doing translation work while you talk.
        Switch it to their trade before the call and the services, the prices and the wording are
        all theirs.
      </p>
      <select
        className={FIELD}
        value={company.demoIndustry || ""}
        disabled={Boolean(busy)}
        onChange={(e) => act({ action: "industry", industry: e.target.value })}
      >
        <option value="">Not set</option>
        {(data?.industries || []).map((i) => (
          <option key={i.key} value={i.key}>
            {i.label}
          </option>
        ))}
      </select>
      {busy === "industry" ? (
        <p className="flex items-center gap-2 text-xs text-muted-foreground">
          <Loader2 className="animate-spin" size={13} /> Rebuilding it as that trade…
        </p>
      ) : null}
    </section>
  );

  const resetCard = !company ? null : (
    <section className={CARD}>
      <h2 className="text-base font-semibold text-foreground flex items-center gap-2">
        <RefreshCw size={16} /> Start it clean
      </h2>
      <p className="text-sm text-muted-foreground break-words">
        Wipes everything you did in it and puts the sample data back. Worth doing after every demo,
        so the next prospect does not open a quote addressed to the last one.
      </p>
      {/* Two presses. It is only a fixture, and it is still somebody's
          half-built walkthrough twenty minutes before a call. */}
      {confirmReset ? (
        <div className="space-y-2">
          <p className="text-sm text-amber-900 dark:text-amber-200 break-words">
            This clears every quote, job, invoice and client in {company.name}. It cannot be undone,
            and it affects nobody but you.
          </p>
          <div className="flex flex-col sm:flex-row gap-2">
            <button
              type="button"
              disabled={Boolean(busy)}
              onClick={() => act({ action: "reset" })}
              className={`${BTN} bg-red-600 text-white flex-1`}
            >
              {busy === "reset" ? <Loader2 className="animate-spin" size={16} /> : <RefreshCw size={16} />}
              Yes, wipe it
            </button>
            <button
              type="button"
              onClick={() => setConfirmReset(false)}
              className={`${BTN} border border-border text-foreground flex-1`}
            >
              Leave it alone
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          disabled={Boolean(busy)}
          onClick={() => setConfirmReset(true)}
          className={`${BTN} border border-border text-foreground w-full`}
        >
          <RefreshCw size={16} /> Reset the data
        </button>
      )}
    </section>
  );

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        <h1 className="text-xl font-semibold text-foreground">Your demo account</h1>
        <p className="text-sm text-muted-foreground max-w-2xl">
          A real FieldQuo company with real data in it, that belongs to you. Sign into it and drive
          it while somebody watches — write a quote, send it, take the payment. Nothing in it is a
          customer&rsquo;s, so you can break it and put it back.
        </p>
      </header>

      {error ? (
        <div className="rounded-lg border border-red-300 bg-red-50 dark:bg-red-950/40 p-3 text-sm text-red-800 dark:text-red-200">
          <div className="flex items-start gap-2">
            <AlertCircle size={16} className="mt-0.5 shrink-0" />
            <p className="break-words">{error}</p>
          </div>
        </div>
      ) : null}

      {!data ? (
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="animate-spin" size={15} /> Loading…
        </p>
      ) : !company ? (
        // STATE 1 — no demo. Never a blank screen, and never a button that
        // would 409: Claim renders only when the pool says something is
        // actually free.
        <section className={CARD}>
          <h2 className="text-base font-semibold text-foreground">You don&rsquo;t have one yet</h2>
          {data.pool?.free > 0 ? (
            <>
              <p className="text-sm text-muted-foreground break-words">
                Take one. It becomes yours and stays yours, so the data you set up for your own
                walkthrough is where you left it next time. {data.pool.free} of {data.pool.total}{" "}
                {data.pool.total === 1 ? "is" : "are"} free right now.
              </p>
              <button
                type="button"
                disabled={Boolean(busy)}
                onClick={() => act({ action: "claim" })}
                className={`${BTN} bg-primary text-primary-foreground w-full`}
              >
                {busy === "claim" ? (
                  <Loader2 className="animate-spin" size={16} />
                ) : (
                  <HandGrab size={16} />
                )}
                Claim a demo account
              </button>
              <p className="text-xs text-muted-foreground break-words">
                Claiming assigns you the company. Signing into it needs a password, which only a
                FieldQuo superadmin can set — this screen will tell you exactly what to ask for
                once you have one.
              </p>
            </>
          ) : (
            // The honest refusal, with the real numbers. Not a button that
            // fails, and not a generic "try again later".
            <p className="text-sm text-muted-foreground break-words">
              {data.pool?.total > 0
                ? `All ${data.pool.total} demo ${data.pool.total === 1 ? "company is" : "companies are"} already taken by other reps, so there is none to claim. Ask a FieldQuo superadmin to add one, or to release one that a rep who has left is still holding.`
                : "There are no demo companies at all yet. Ask a FieldQuo superadmin to seed them — nothing on this screen creates one."}
            </p>
          )}
        </section>
      ) : !data.loginReady ? (
        // STATE 2 — assigned, no login. Deliberately no "Open the demo
        // company" link and no sign-in instructions: the address below is a
        // string, not an account, and telling a rep to sign in with it would
        // send them to a password box that can never be satisfied.
        <>
          <section className={CARD}>
            <div className="flex items-baseline justify-between gap-3">
              <h2 className="text-base font-semibold text-foreground break-words">{company.name}</h2>
              <span className="text-xs text-muted-foreground">{company.slug}</span>
            </div>
            <div className="rounded-lg border border-amber-300 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/30 p-3 space-y-2">
              <p className="text-sm font-semibold text-amber-900 dark:text-amber-200 flex items-center gap-2">
                <KeyRound size={15} /> It has no sign-in yet
              </p>
              <p className="text-sm text-amber-900 dark:text-amber-200 break-words">
                The company is yours; the login on it does not exist. Ask a FieldQuo{" "}
                <strong>superadmin</strong> — not an admin, not support, only a superadmin can
                create one — for this exactly:
              </p>
              <p className="text-sm text-amber-900 dark:text-amber-200 break-words">
                &ldquo;Please open /platform/demo, find <strong>{company.name}</strong> (
                <span className="font-mono">{company.slug}</span>), and press{" "}
                <strong>Assign</strong> with a password so{" "}
                <span className="font-mono">{data.loginEmail}</span> can sign in.&rdquo;
              </p>
              <p className="text-xs text-amber-800 dark:text-amber-300 break-words">
                The address is fixed — it is built from the slug and cannot be pointed at your own
                mailbox. They tell you the password once and it keeps working.
              </p>
            </div>
            <p className="text-xs text-muted-foreground break-words">
              Everything below already works without the login: it goes through this portal, not
              through the demo company.
            </p>
          </section>
          {tradeCard}
          {resetCard}
        </>
      ) : (
        <>
          <section className={CARD}>
            <div className="flex items-baseline justify-between gap-3">
              <h2 className="text-base font-semibold text-foreground break-words">{company.name}</h2>
              <span className="text-xs text-muted-foreground">{company.slug}</span>
            </div>
            <p className="text-sm text-muted-foreground break-words">
              Sign in at <span className="font-mono">{data.loginEmail}</span>. The password is set by
              a FieldQuo admin — ask for it once and it keeps working. It is not shown here because
              this screen cannot set it.
            </p>
            <a
              href="/app"
              target="_blank"
              rel="noopener noreferrer"
              className={`${BTN} bg-primary text-primary-foreground w-full`}
            >
              <ExternalLink size={16} /> Open the demo company
            </a>
            <p className="text-xs text-muted-foreground break-words">
              Opens in a new tab so this portal stays where it is — mid-demo you may want to change
              the trade or wipe the data without navigating out of what the prospect is looking at.
            </p>
          </section>

          {tradeCard}
          {resetCard}
        </>
      )}
    </div>
  );
}
