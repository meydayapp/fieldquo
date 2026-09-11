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

import { Fragment, useCallback, useEffect, useState } from "react";
import { AlertCircle, ExternalLink, Loader2, RefreshCw, Wrench, KeyRound, HandGrab } from "lucide-react";
import { fetchJson } from "@/lib/fetchJson";
import { useTranslation } from "@/app/hooks/useTranslation";

/**
 * A translated sentence whose moving parts are MARKUP — a bold company name, a
 * monospaced login address — rather than text.
 *
 * t() stringifies its values, so a React element interpolated through it
 * arrives as "[object Object]". Splitting the sentence into two keys either
 * side of the bold bit would hand a translator half a clause and, worse, freeze
 * English word order: German and Chinese put the address somewhere else in the
 * sentence. So the sentence stays ONE key with named {placeholders}, and the
 * split happens after translation, in whatever order that language wrote them.
 *
 * MessageThread.js's sentenceAround() does the same job for ONE token; the
 * request quoted on this screen has four, and importing a one-token helper to
 * call it four times is worse than the eight lines.
 */
function withParts(text, parts) {
  return String(text)
    .split(/(\{\w+\})/g)
    .map((chunk, index) => {
      const name = /^\{(\w+)\}$/.exec(chunk)?.[1];
      // An unknown placeholder renders as itself rather than disappearing: a
      // visible {slug} in one language is a bug report, a silent gap is not.
      if (!name || !(name in parts)) return chunk;
      return <Fragment key={index}>{parts[name]}</Fragment>;
    });
}

const BTN =
  "inline-flex items-center justify-center gap-2 min-h-[44px] px-4 py-2.5 rounded-lg text-sm font-semibold disabled:opacity-60";
const FIELD =
  "w-full border border-border rounded-lg px-3 py-2.5 min-h-[44px] text-base bg-card text-foreground disabled:opacity-60";
const CARD = "rounded-xl border border-border bg-card p-4 space-y-3";

export default function SalesDemoPage() {
  const { t } = useTranslation();
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState("");
  const [confirmReset, setConfirmReset] = useState(false);

  const load = useCallback(async () => {
    setError("");
    try {
      setData(await fetchJson("/api/sales/demo"));
    } catch (err) {
      setError(err?.message || t("app.salesCal.demoLoadFailed"));
    }
  }, [t]);

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
      setError(err?.message || t("app.salesCal.demoActionFailed"));
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
        <Wrench size={16} /> {t("app.salesCal.demoTradeHeading")}
      </h2>
      <p className="text-sm text-muted-foreground break-words">
        {t("app.salesCal.demoTradeBody")}
      </p>
      <select
        className={FIELD}
        value={company.demoIndustry || ""}
        disabled={Boolean(busy)}
        onChange={(e) => act({ action: "industry", industry: e.target.value })}
      >
        <option value="">{t("app.salesCal.demoTradeNotSet")}</option>
        {/* The trade labels come from lib/demo/industries via the API — server
            data, not copy on this screen, and English there today. */}
        {(data?.industries || []).map((i) => (
          <option key={i.key} value={i.key}>
            {i.label}
          </option>
        ))}
      </select>
      {busy === "industry" ? (
        <p className="flex items-center gap-2 text-xs text-muted-foreground">
          <Loader2 className="animate-spin" size={13} /> {t("app.salesCal.demoTradeRebuilding")}
        </p>
      ) : null}
    </section>
  );

  const resetCard = !company ? null : (
    <section className={CARD}>
      <h2 className="text-base font-semibold text-foreground flex items-center gap-2">
        <RefreshCw size={16} /> {t("app.salesCal.demoResetHeading")}
      </h2>
      <p className="text-sm text-muted-foreground break-words">
        {t("app.salesCal.demoResetBody")}
      </p>
      {/* Two presses. It is only a fixture, and it is still somebody's
          half-built walkthrough twenty minutes before a call. */}
      {confirmReset ? (
        <div className="space-y-2">
          <p className="text-sm text-amber-900 dark:text-amber-200 break-words">
            {t("app.salesCal.demoResetConfirm", { company: company.name })}
          </p>
          <div className="flex flex-col sm:flex-row gap-2">
            <button
              type="button"
              disabled={Boolean(busy)}
              onClick={() => act({ action: "reset" })}
              className={`${BTN} bg-red-600 text-white flex-1`}
            >
              {busy === "reset" ? <Loader2 className="animate-spin" size={16} /> : <RefreshCw size={16} />}
              {t("app.salesCal.demoResetYes")}
            </button>
            <button
              type="button"
              onClick={() => setConfirmReset(false)}
              className={`${BTN} border border-border text-foreground flex-1`}
            >
              {t("app.salesCal.demoResetNo")}
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
          <RefreshCw size={16} /> {t("app.salesCal.demoResetButton")}
        </button>
      )}
    </section>
  );

  return (
    <div className="space-y-6" data-tour="sales-demo">
      <header className="space-y-1">
        <h1 className="text-xl font-semibold text-foreground">{t("app.salesCal.demoTitle")}</h1>
        <p className="text-sm text-muted-foreground max-w-2xl">
          {t("app.salesCal.demoIntro")}
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
          <Loader2 className="animate-spin" size={15} /> {t("app.salesCal.demoLoading")}
        </p>
      ) : !company ? (
        // STATE 1 — no demo. Never a blank screen, and never a button that
        // would 409: Claim renders only when the pool says something is
        // actually free.
        <section className={CARD}>
          <h2 className="text-base font-semibold text-foreground">{t("app.salesCal.demoNoneHeading")}</h2>
          {data.pool?.free > 0 ? (
            <>
              <p className="text-sm text-muted-foreground break-words">
                {t("app.salesCal.demoClaimBody")}{" "}
                {/* The "is/are" toggle that used to be here was English's
                    agreement rule spelled out in JS, which is the one thing
                    AGENTS.md and the i18n brief both forbid — four of the nine
                    languages count differently. The noun is declined by
                    Intl.PluralRules through the __counted__ entry instead. */}
                {t("app.salesCal.demoPoolFreeLine", {
                  free: data.pool.free,
                  count: t("app.salesCal.demoPoolCount", { value: data.pool.total }),
                })}
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
                {t("app.salesCal.demoClaimButton")}
              </button>
              <p className="text-xs text-muted-foreground break-words">
                {t("app.salesCal.demoClaimNote")}
              </p>
            </>
          ) : (
            // The honest refusal, with the real numbers. Not a button that
            // fails, and not a generic "try again later".
            <p className="text-sm text-muted-foreground break-words">
              {data.pool?.total > 0
                ? // A second counted entry, not a reuse of demoPoolCount: this
                  // sentence needs the verb agreeing with the count as well as
                  // the noun ("1 demo company IS taken", "3 demo companies
                  // ARE"), and the free line above needs the bare noun.
                  t("app.salesCal.demoPoolTakenLine", {
                    count: t("app.salesCal.demoPoolTakenCount", { value: data.pool.total }),
                  })
                : t("app.salesCal.demoPoolEmpty")}
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
                <KeyRound size={15} /> {t("app.salesCal.demoNoLoginHeading")}
              </p>
              <p className="text-sm text-amber-900 dark:text-amber-200 break-words">
                {withParts(t("app.salesCal.demoNoLoginBody"), {
                  role: <strong>{t("app.salesCal.demoSuperadminRole")}</strong>,
                })}
              </p>
              <p className="text-sm text-amber-900 dark:text-amber-200 break-words">
                {withParts(t("app.salesCal.demoAskQuote"), {
                  name: <strong>{company.name}</strong>,
                  slug: <span className="font-mono">{company.slug}</span>,
                  // NOT translated: "Assign" is the literal label on the button
                  // at /platform/demo, and the platform console is English for
                  // everyone. Translating it would send a rep to ask for a
                  // control nobody can find.
                  assign: <strong>Assign</strong>,
                  email: <span className="font-mono">{data.loginEmail}</span>,
                })}
              </p>
              <p className="text-xs text-amber-800 dark:text-amber-300 break-words">
                {t("app.salesCal.demoAddressFixed")}
              </p>
            </div>
            <p className="text-xs text-muted-foreground break-words">
              {t("app.salesCal.demoWorksWithoutLogin")}
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
              {withParts(t("app.salesCal.demoSignInLine"), {
                email: <span className="font-mono">{data.loginEmail}</span>,
              })}
            </p>
            <a
              href="/app"
              target="_blank"
              rel="noopener noreferrer"
              className={`${BTN} bg-primary text-primary-foreground w-full`}
            >
              <ExternalLink size={16} /> {t("app.salesCal.demoOpenButton")}
            </a>
            <p className="text-xs text-muted-foreground break-words">
              {t("app.salesCal.demoOpenNote")}
            </p>
          </section>

          {tradeCard}
          {resetCard}
        </>
      )}
    </div>
  );
}
