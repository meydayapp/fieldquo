// app/sales/demo/page.js
//
// The accounts a rep drives while a prospect watches — their own, one per
// trade.
//
// ══ Why this is not "Run the demo" ════════════════════════════════════════
//
// The platform console opens a demo through impersonation, which is read-only
// and superadmin-only — twice enforced, deliberately. A rep impersonating
// could not write a quote, and watching a quote get written is the only part
// of a demo a prospect cares about. So a rep signs in for real, to a fixture
// company FieldQuo seeded for them, and can do everything in it.
//
// ══ One rep, their own companies ═════════════════════════════════════════
//
// Until 2026-09-12 this screen handed out one of ten shared fixtures, and in
// practice every rep signed in as the one that had a login and watched each
// other's quotes appear. Now GET /api/sales/demo seeds a company FOR the rep
// the first time it runs (lib/sales/repDemo.js), so this screen never has a
// "you don't have one" state: the list below is never empty once the request
// has answered. What it can lack is a LOGIN, and that is the one thing the rep
// sets here — a password, once, for an address derived from their code.
//
// ══ It says what it cannot do ═════════════════════════════════════════════
//
// The password is chosen here and never shown again: nothing on the server
// can read one back, and nothing can reset one (lib/demo/demoLogin.js's
// argument for not hand-writing a hash). So "lost it" is answered honestly —
// a replacement address is minted and every company moves to it — rather than
// with a "Reset password" control that could not work.
//
// ══ Reset deletes nothing ═════════════════════════════════════════════════
//
// "Reset this demo" retires the company and seeds a fresh one for the same
// trade. The copy the rep used stays in the database, marked retired,
// excluded from every figure a demo is excluded from. The confirmation says
// so, because the previous wording ("It cannot be undone") described a wipe
// this screen no longer performs.
"use client";

import { Fragment, useCallback, useEffect, useState } from "react";
import {
  AlertCircle,
  CheckCircle2,
  ExternalLink,
  KeyRound,
  Loader2,
  Plus,
  RefreshCw,
  Wrench,
} from "lucide-react";
import { fetchJson } from "@/lib/fetchJson";
import { useTranslation } from "@/app/hooks/useTranslation";

/**
 * A translated sentence whose moving parts are MARKUP — a bold company name, a
 * monospaced login address — rather than text.
 *
 * t() stringifies its values, so a React element interpolated through it
 * arrives as "[object Object]". The sentence stays ONE key with named
 * {placeholders}, and the split happens after translation, in whatever order
 * that language wrote them.
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

const MIN_PASSWORD = 12;

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
  const [confirmReset, setConfirmReset] = useState(null);
  const [password, setPassword] = useState("");
  const [replacing, setReplacing] = useState(false);
  const [trade, setTrade] = useState("");

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

  async function act(body, key = body.action) {
    setBusy(key);
    setError("");
    try {
      const next = await fetchJson("/api/sales/demo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      setConfirmReset(null);
      setData(next);
      return next;
    } catch (err) {
      setError(err?.message || t("app.salesCal.demoActionFailed"));
      return null;
    } finally {
      setBusy("");
    }
  }

  /**
   * Open a demo in a new tab.
   *
   * The tab is opened BEFORE the request, synchronously inside the click, and
   * pointed at /app after it: a window.open that happens after an await is
   * what popup blockers exist to stop, and a demo that "opens nothing" mid-call
   * is the failure this screen must not have. If the switch fails the blank
   * tab is closed and the error shows here.
   */
  async function openDemo(company) {
    const tab = window.open("", "_blank");
    const next = await act({ action: "open", companyId: company.id }, `open:${company.id}`);
    if (!next) {
      tab?.close();
      return;
    }
    if (tab) tab.location = "/app";
    else window.open("/app", "_blank");
  }

  async function submitLogin(e) {
    e.preventDefault();
    if (password.length < MIN_PASSWORD) return;
    const next = await act({ action: "login", password }, "login");
    if (next) {
      setPassword("");
      setReplacing(false);
    }
  }

  const demos = data?.demos || [];
  const usedTrades = new Set(demos.map((d) => d.demoIndustry));
  const freeTrades = (data?.industries || []).filter((i) => !usedTrades.has(i.key));
  const loginExists = Boolean(data?.login?.exists);

  // ── The login card: set once, replace if lost ─────────────────────────────
  //
  // One card for both states, so the password form is defined once. In the
  // "exists" state it hides behind a deliberate "lost it" link — a rep who has
  // a working login must not be offered a form that would quietly move every
  // company to a new address.
  const passwordForm = (submitKey) => (
    <form onSubmit={submitLogin} className="space-y-2">
      <label className="block text-sm text-foreground">
        {t("app.salesCal.demoPasswordLabel", { min: MIN_PASSWORD })}
        <input
          type="password"
          autoComplete="new-password"
          minLength={MIN_PASSWORD}
          className={`${FIELD} mt-1`}
          value={password}
          disabled={Boolean(busy)}
          onChange={(e) => setPassword(e.target.value)}
        />
      </label>
      <button
        type="submit"
        disabled={Boolean(busy) || password.length < MIN_PASSWORD}
        className={`${BTN} bg-primary text-primary-foreground w-full`}
      >
        {busy === "login" ? <Loader2 className="animate-spin" size={16} /> : <KeyRound size={16} />}
        {t(submitKey)}
      </button>
    </form>
  );

  const loginCard = !data ? null : (
    <section className={CARD}>
      <h2 className="text-base font-semibold text-foreground flex items-center gap-2">
        <KeyRound size={16} /> {t("app.salesCal.demoLoginHeading")}
      </h2>
      {loginExists ? (
        <>
          <p className="text-sm text-foreground break-words flex items-start gap-2">
            <CheckCircle2 size={16} className="mt-0.5 shrink-0 text-emerald-600" />
            <span>
              {withParts(t("app.salesCal.demoLoginReadyLine"), {
                email: <span className="font-mono">{data.login.email}</span>,
              })}
            </span>
          </p>
          <p className="text-xs text-muted-foreground break-words">{t("app.salesCal.demoLoginKeep")}</p>
          {replacing ? (
            <div className="rounded-lg border border-amber-300 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/30 p-3 space-y-2">
              <p className="text-sm text-amber-900 dark:text-amber-200 break-words">
                {t("app.salesCal.demoLoginReplaceBody")}
              </p>
              {passwordForm("app.salesCal.demoLoginReplaceButton")}
              <button
                type="button"
                onClick={() => {
                  setReplacing(false);
                  setPassword("");
                }}
                className={`${BTN} border border-border text-foreground w-full`}
              >
                {t("app.salesCal.demoResetNo")}
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setReplacing(true)}
              className="min-h-[44px] text-sm underline text-muted-foreground"
            >
              {t("app.salesCal.demoLoginReplaceLink")}
            </button>
          )}
        </>
      ) : (
        <>
          <p className="text-sm text-muted-foreground break-words">
            {withParts(t("app.salesCal.demoLoginSetBody"), {
              email: <span className="font-mono">{data.login.plannedEmail}</span>,
            })}
          </p>
          {passwordForm("app.salesCal.demoLoginCreateButton")}
        </>
      )}
    </section>
  );

  return (
    <div className="space-y-6" data-tour="sales-demo">
      <header className="space-y-1">
        <h1 className="text-xl font-semibold text-foreground">{t("app.salesCal.demoTitle")}</h1>
        <p className="text-sm text-muted-foreground max-w-2xl">{t("app.salesCal.demoIntro")}</p>
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
        // The first load can take a few seconds when it is also the seed —
        // thirty inserts on a database that may have been asleep — so the
        // wait is named rather than left as a blank screen.
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="animate-spin" size={15} /> {t("app.salesCal.demoLoading")}
        </p>
      ) : (
        <>
          {loginCard}

          <section className="space-y-3">
            <h2 className="text-base font-semibold text-foreground">{t("app.salesCal.demoMineHeading")}</h2>
            {demos.map((company) => (
              <article key={company.id} className={CARD}>
                <div className="flex items-baseline justify-between gap-3 flex-wrap">
                  <h3 className="text-base font-semibold text-foreground break-words">{company.name}</h3>
                  <span className="text-xs text-muted-foreground font-mono">{company.slug}</span>
                </div>
                <p className="text-sm text-muted-foreground flex items-center gap-2 flex-wrap">
                  <Wrench size={14} />
                  {t("app.salesCal.demoTradeLine", { trade: company.tradeLabel })}
                  {company.current ? (
                    <span className="rounded-full bg-primary/10 text-primary px-2 py-0.5 text-xs font-semibold">
                      {t("app.salesCal.demoCurrentBadge")}
                    </span>
                  ) : null}
                </p>

                {loginExists ? (
                  <>
                    <button
                      type="button"
                      disabled={Boolean(busy)}
                      onClick={() => openDemo(company)}
                      className={`${BTN} bg-primary text-primary-foreground w-full`}
                    >
                      {busy === `open:${company.id}` ? (
                        <Loader2 className="animate-spin" size={16} />
                      ) : (
                        <ExternalLink size={16} />
                      )}
                      {t("app.salesCal.demoOpenButton")}
                    </button>
                    <p className="text-xs text-muted-foreground break-words">{t("app.salesCal.demoOpenNote")}</p>
                  </>
                ) : (
                  // No sign-in control without a sign-in. The card still shows
                  // the company — it exists and its data is being kept — and
                  // names the one thing that is missing.
                  <p className="text-sm text-amber-900 dark:text-amber-200 break-words">
                    {t("app.salesCal.demoOpenNeedsLogin")}
                  </p>
                )}

                {/* Two presses. It is only a fixture, and it is still somebody's
                    half-built walkthrough twenty minutes before a call. */}
                {confirmReset === company.id ? (
                  <div className="space-y-2">
                    <p className="text-sm text-amber-900 dark:text-amber-200 break-words">
                      {t("app.salesCal.demoResetConfirm", { company: company.name })}
                    </p>
                    <div className="flex flex-col sm:flex-row gap-2">
                      <button
                        type="button"
                        disabled={Boolean(busy)}
                        onClick={() => act({ action: "reset", companyId: company.id }, `reset:${company.id}`)}
                        className={`${BTN} bg-red-600 text-white flex-1`}
                      >
                        {busy === `reset:${company.id}` ? (
                          <Loader2 className="animate-spin" size={16} />
                        ) : (
                          <RefreshCw size={16} />
                        )}
                        {t("app.salesCal.demoResetYes")}
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmReset(null)}
                        className={`${BTN} border border-border text-foreground flex-1`}
                      >
                        {t("app.salesCal.demoResetNo")}
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-1">
                    <button
                      type="button"
                      disabled={Boolean(busy)}
                      onClick={() => setConfirmReset(company.id)}
                      className={`${BTN} border border-border text-foreground w-full`}
                    >
                      <RefreshCw size={16} /> {t("app.salesCal.demoResetButton")}
                    </button>
                    <p className="text-xs text-muted-foreground break-words">{t("app.salesCal.demoResetBody")}</p>
                  </div>
                )}
              </article>
            ))}
          </section>

          <section className={CARD}>
            <h2 className="text-base font-semibold text-foreground flex items-center gap-2">
              <Plus size={16} /> {t("app.salesCal.demoAddHeading")}
            </h2>
            <p className="text-sm text-muted-foreground break-words">{t("app.salesCal.demoAddBody")}</p>
            {freeTrades.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t("app.salesCal.demoAddAllUsed")}</p>
            ) : (
              <div className="flex flex-col sm:flex-row gap-2">
                {/* The trade labels come from lib/demo/industries via the API —
                    server data, not copy on this screen, and English there. */}
                <select
                  className={FIELD}
                  value={trade}
                  disabled={Boolean(busy)}
                  onChange={(e) => setTrade(e.target.value)}
                >
                  <option value="">{t("app.salesCal.demoAddPick")}</option>
                  {freeTrades.map((i) => (
                    <option key={i.key} value={i.key}>
                      {i.label}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  disabled={Boolean(busy) || !trade}
                  onClick={async () => {
                    const next = await act({ action: "create", trade }, "create");
                    if (next) setTrade("");
                  }}
                  className={`${BTN} bg-primary text-primary-foreground sm:w-auto`}
                >
                  {busy === "create" ? <Loader2 className="animate-spin" size={16} /> : <Plus size={16} />}
                  {t("app.salesCal.demoAddButton")}
                </button>
              </div>
            )}
            {busy === "create" ? (
              <p className="flex items-center gap-2 text-xs text-muted-foreground">
                <Loader2 className="animate-spin" size={13} /> {t("app.salesCal.demoCreating")}
              </p>
            ) : null}
          </section>
        </>
      )}
    </div>
  );
}
