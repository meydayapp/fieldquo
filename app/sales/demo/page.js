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
"use client";

import { useCallback, useEffect, useState } from "react";
import { AlertCircle, ExternalLink, Loader2, RefreshCw, Wrench } from "lucide-react";
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
        // Never a blank screen, and never a button that would 409. There is no
        // self-serve path on purpose — a demo is a real tenant FieldQuo owns —
        // so the honest answer is who to ask.
        <section className={CARD}>
          <h2 className="text-base font-semibold text-foreground">You don&rsquo;t have one yet</h2>
          <p className="text-sm text-muted-foreground break-words">
            A demo is a real company account, so it is handed to you rather than created on demand.
            Ask a FieldQuo admin to assign you one on the platform demo screen — it takes them a
            click, and you keep the same one, so the data you set up for your own walkthrough stays
            where you left it.
          </p>
        </section>
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

          {/* ── Match the trade to whoever is watching ────────────────────── */}
          <section className={CARD}>
            <h2 className="text-base font-semibold text-foreground flex items-center gap-2">
              <Wrench size={16} /> What trade it is set up as
            </h2>
            <p className="text-sm text-muted-foreground break-words">
              A roofer watching a cabinet maker&rsquo;s quote is doing translation work while you
              talk. Switch it to their trade before the call and the services, the prices and the
              wording are all theirs.
            </p>
            <select
              className={FIELD}
              value={company.industry || ""}
              disabled={Boolean(busy)}
              onChange={(e) => act({ action: "industry", industry: e.target.value })}
            >
              <option value="">Not set</option>
              {(data.industries || []).map((i) => (
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

          {/* ── Put it back ──────────────────────────────────────────────── */}
          <section className={CARD}>
            <h2 className="text-base font-semibold text-foreground flex items-center gap-2">
              <RefreshCw size={16} /> Start it clean
            </h2>
            <p className="text-sm text-muted-foreground break-words">
              Wipes everything you did in it and puts the sample data back. Worth doing after every
              demo, so the next prospect does not open a quote addressed to the last one.
            </p>
            {/* Two presses. It is only a fixture, and it is still somebody's
                half-built walkthrough twenty minutes before a call. */}
            {confirmReset ? (
              <div className="space-y-2">
                <p className="text-sm text-amber-900 dark:text-amber-200 break-words">
                  This clears every quote, job, invoice and client in {company.name}. It cannot be
                  undone, and it affects nobody but you.
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
        </>
      )}
    </div>
  );
}
