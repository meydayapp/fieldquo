"use client";

// app/app/settings/voice/page.js
//
// The AI receptionist, set up by the contractor.
//
// ── Order of the page is the order of the decisions ────────────────────────
//
// Credit, then a number, then the words, then the switch.
//
// Credit moved to the front when the number's first month started being charged
// up front (lib/voice/spendGate.js). A number costs FieldQuo real money from the
// moment it exists, so it cannot be handed out before the company has paid — and
// a screen whose step 1 is permanently blocked by something in step 2 is a maze.
//
// The switch stays last and refuses to turn on without the first two: a toggle
// that flips to "on" and then doesn't answer is the worst kind of broken,
// because the company believes their calls are covered and finds out from a
// customer who rang and got nothing.
//
// ── Every price on this page is priced by the SERVER ───────────────────────
//
// `pricing.numberTypes[].afford` is computed in /api/settings/voice from the
// company's own balance. The browser posts a number TYPE and never an amount,
// and it never decides affordability for itself — so the button it disables and
// the gate the route enforces cannot drift apart.
//
// ── Forwarding leads ───────────────────────────────────────────────────────
//
// It's the right answer for almost every established contractor, and it's the
// one they won't pick unless it's first and explained. See lib/voice/numbers.js.

import { useEffect, useState, useCallback } from "react";
import {
  MessageSquare,
  Headset, Phone, Loader2, Check, Plus, AlertTriangle, Copy, Info,
} from "lucide-react";
import { reportResponseError, showError } from "@/lib/clientErrors";
import { useTranslation } from "@/app/hooks/useTranslation";

const money = (c) => `$${(Number(c || 0) / 100).toFixed(2)}`;

function Card({ title, hint, children, step, dataTour }) {
  return (
    <section data-tour={dataTour} className="bg-card border border-border rounded-xl p-5">
      <div className="flex items-baseline gap-2">
        {step && (
          <span className="text-xs font-bold text-muted-foreground tabular-nums">{step}</span>
        )}
        <h2 className="font-semibold text-foreground">{title}</h2>
      </div>
      {hint && <p className="text-sm text-muted-foreground mt-1">{hint}</p>}
      <div className="mt-4">{children}</div>
    </section>
  );
}

export default function VoiceSettingsPage() {
  const { t } = useTranslation();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [form, setForm] = useState({ greeting: "", instructions: "", transferTo: "" });
  const [copied, setCopied] = useState(null);
  const [liveWarning, setLiveWarning] = useState(false);
  // What just happened, in a sentence. Sticky rather than a 2-second toast: the
  // thing it usually says is "now go and dial this on your phone".
  const [notice, setNotice] = useState(null);

  const load = useCallback(async () => {
    const res = await fetch("/api/settings/voice");
    if (!res.ok) {
      await reportResponseError(res, t("app.setVoice.loadError", "Couldn't load the receptionist settings."));
      return null;
    }
    const d = await res.json();
    setData(d);
    setForm({
      greeting: d.agent?.greeting || "",
      instructions: d.agent?.instructions || "",
      transferTo: d.agent?.transferTo || "",
    });
    return d;
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const topup = params.get("topup");

    (async () => {
      // Confirm a top-up against STRIPE before showing a balance — the success
      // URL is just a URL, and anyone can visit it.
      if (topup) {
        await fetch(`/api/settings/voice/topup?session_id=${encodeURIComponent(topup)}`).catch(
          () => {},
        );
        window.history.replaceState({}, "", window.location.pathname);
      }
      await load();
      setLoading(false);
    })();
  }, [load]);

  async function save(patch) {
    setBusy(true);
    try {
      const res = await fetch("/api/settings/voice", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      if (!res.ok) {
        await reportResponseError(res, t("app.setVoice.saveError", "Couldn't save."));
        return false;
      }
      const d = await res.json().catch(() => ({}));
      // Saved locally but not pushed to the phone is its own state, and it has
      // to be visible. "Saved" over a greeting the caller will never hear is
      // the kind of quiet lie that costs a company a week of wrong calls.
      setLiveWarning(d.live === false && d.liveError !== "not_configured");
      await load();
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
      return true;
    } finally {
      setBusy(false);
    }
  }

  // ── Setting up a number has to SAY something ────────────────────────────
  //
  // This used to be `await load()` and nothing else. On success the page simply
  // re-rendered, and while the number was invisible to the API (it was written
  // with a status nothing read — see the route) the re-render was identical to
  // what was already on screen. A contractor typed his number, pressed Set it
  // up, watched nothing happen, and pressed it again — buying a second live
  // number, which is what the duplicate activity entries were.
  //
  // The underlying bug is fixed, but silence on success was a defect on its own
  // merits: it is indistinguishable from a broken button. So the outcome is now
  // stated, in the words of what actually happened, and it does not time out —
  // the forwarding codes below it are something to act on, not a flash message.
  async function getNumber(source, numberType, extra = {}) {
    setBusy(true);
    setNotice(null);
    try {
      const res = await fetch("/api/settings/voice/number", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ source, numberType, ...extra }),
      });
      if (!res.ok) {
        await reportResponseError(res, t("app.setVoice.numberError", "Couldn't set up a number."));
        return;
      }
      const result = await res.json().catch(() => ({}));
      await load();
      setNotice(
        result.source === "ported"
          ? {
              tone: "info",
              text: `We've recorded your request to move ${result.e164}. This one is not automatic — somebody here has to action it with your current provider, and we'll be in touch. Your existing number keeps working the whole time, and you can cancel below.`,
            }
          : result.source === "forwarded"
            ? {
                tone: "ok",
                text: `Done — your number is ${result.publicNumber || result.e164} and it now forwards to ${result.e164}. The last step is on your own phone: dial one of the codes below from it, or nothing will reach the receptionist.`,
              }
            : {
                tone: "ok",
                text: `Done — your new number is ${result.e164}.`,
              },
      );
    } catch (err) {
      // A thrown fetch (offline, DNS, a killed request) never reached the
      // res.ok branch above, so without this the button was silent on exactly
      // the failure a contractor in a driveway is most likely to hit.
      showError(
        t("app.setVoice.numberNetworkError", "Couldn't reach FieldQuo — check your signal and try again.") +
          (err?.message ? ` (${err.message})` : ""),
      );
    } finally {
      setBusy(false);
    }
  }

  /** Withdraw a port request nobody has actioned yet. Costs nothing, undoes cleanly. */
  async function cancelPort() {
    setBusy(true);
    setNotice(null);
    try {
      const res = await fetch("/api/settings/voice/number", { method: "DELETE" });
      if (!res.ok) {
        await reportResponseError(res, t("app.setVoice.cancelPortError", "Couldn't cancel that."));
        return;
      }
      await load();
      setNotice({ tone: "ok", text: "That port request is cancelled. You can pick a different option now." });
    } catch (err) {
      showError(err?.message || "Couldn't cancel that.");
    } finally {
      setBusy(false);
    }
  }

  async function topUp(cents) {
    setBusy(true);
    try {
      const res = await fetch("/api/settings/voice/topup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cents }),
      });
      if (!res.ok) {
        await reportResponseError(res, t("app.setVoice.paymentError", "Couldn't start the payment."));
        return;
      }
      const { checkoutUrl } = await res.json();
      window.location.href = checkoutUrl;
    } finally {
      setBusy(false);
    }
  }

  function copy(text, key) {
    navigator.clipboard.writeText(text);
    setCopied(key);
    setTimeout(() => setCopied(null), 1500);
  }

  if (loading) {
    return (
      <div className="max-w-3xl p-4 sm:p-6 space-y-4 animate-pulse">
        <div className="h-8 bg-accent rounded w-1/3" />
        <div className="h-40 bg-accent rounded-xl" />
        <div className="h-40 bg-accent rounded-xl" />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="p-4 sm:p-6 text-sm text-muted-foreground">
        {t("app.setVoice.loadFailed", "This page couldn't be loaded.")}
      </div>
    );
  }

  const { agent, number, credit, pricing, sources, configured, readiness } = data;
  // The server's verdict, not a second opinion. It is computed from the same
  // checkSpend() the PUT gate enforces, so the button this page disables and the
  // request the route would refuse cannot disagree — and `readiness.message` is
  // the reason, which is the half that was missing entirely.
  const canEnable = Boolean(readiness?.ready);

  // The 30 free trial minutes are a real balance granted with the first number
  // (see lib/voice/credits.js — grantFreeTrial). When that grant is still
  // visibly present and nothing has been bought, say so: it's a live balance the
  // receptionist works on, not a prompt to pay.
  //
  // The note regex is the fallback for grants written before the entry had its
  // own kind. New rows are kind "trial" and don't depend on wording that a
  // translation or an edit could change underneath this check.
  const freeOnly =
    credit.cents > 0 &&
    credit.entries.some(
      (e) => e.kind === "trial" || (e.kind === "adjustment" && /free/i.test(e.note || "")),
    ) &&
    !credit.entries.some((e) => e.kind === "topup");

  // Priced and decided server-side; the page only renders the verdict.
  const affordFor = (key) =>
    pricing.numberTypes.find((t) => t.key === key)?.afford || { allowed: false, shortfallCents: 0 };
  // Forwarding still BUYS a number to forward to, so it costs the same as a
  // local one. Showing it as free would be the dead control in reverse: a button
  // that looks free and returns a payment error.
  const forwardAfford = affordFor("local");
  const rent = number?.rent || null;
  const showDate = (d) => (d ? new Date(d).toLocaleDateString() : "");

  return (
    <div className="max-w-3xl p-4 sm:p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
          <Headset size={20} className="text-muted-foreground" />
          {t("app.setVoice.title", "Phone receptionist")}
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          {t("app.setVoice.subtitle", "Answers the calls you can't, takes the details, and books visits against your real availability. It never quotes a price.")}
        </p>
      </div>

      {/* Honest about the deployment rather than failing mysteriously when
          someone presses a button. */}
      {!configured && (
        <div className="rounded-xl border border-amber-300 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/40 px-4 py-3 flex gap-3">
          <Info size={17} className="text-amber-700 dark:text-amber-400 shrink-0 mt-0.5" />
          <p className="text-sm text-amber-900 dark:text-amber-200">
            {t("app.setVoice.notConfigured", "The phone service isn't connected on this deployment yet, so numbers can't be set up. Everything else on this page works.")}
          </p>
        </div>
      )}

      {/* What the last action actually did. Stays until the next one — the
          forwarding instruction it usually carries is a task, not a flash. */}
      {notice && (
        <div
          className={`rounded-xl border px-4 py-3 flex gap-3 ${
            notice.tone === "ok"
              ? "border-emerald-300 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/40"
              : "border-border bg-muted"
          }`}
        >
          {notice.tone === "ok" ? (
            <Check size={17} className="text-emerald-700 dark:text-emerald-400 shrink-0 mt-0.5" />
          ) : (
            <Info size={17} className="text-muted-foreground shrink-0 mt-0.5" />
          )}
          <p
            className={`text-sm ${
              notice.tone === "ok"
                ? "text-emerald-900 dark:text-emerald-200"
                : "text-foreground"
            }`}
          >
            {notice.text}
          </p>
        </div>
      )}

      {/* ── 1. Credit ───────────────────────────────────────────────────────
          First, because a number's first month comes out of this balance
          before the number is bought. */}
      <Card
        dataTour="voice-credit"
        step="1."
        title={t("app.setVoice.creditTitle", "Credit")}
        hint={t("app.setVoice.creditHint", "{cents}¢ a minute, rounded up, one minute minimum. Your number's monthly rental comes out of this same credit.", { cents: credit.centsPerMinute })}
      >
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
          {/* "Balance" and not just a bare number: it sits right above the
              purchase buttons, and a lone "$10.50" there reads as a price. */}
          <span className="text-sm font-medium text-muted-foreground">Balance:</span>
          <span className="text-2xl font-bold text-foreground">{money(credit.cents)}</span>
          <span className="text-sm text-muted-foreground">
            ({t("app.setVoice.about", "about")} {credit.minutes} {t("app.setVoice.minute", "minute")}{credit.minutes === 1 ? "" : "s"})
          </span>
          {credit.low && (
            <span className="inline-flex items-center gap-1 text-xs text-amber-700 dark:text-amber-400">
              <AlertTriangle size={13} /> {t("app.setVoice.runningLow", "running low")}
            </span>
          )}
        </div>

        {freeOnly && (
          <p className="text-xs text-muted-foreground mt-1.5">
            Free trial minutes included — the receptionist can start answering on this now, no top-up needed.
          </p>
        )}

        {/* Retitled so the buttons below read as "buy more", not the balance
            above. They are Stripe purchases; the two were easy to conflate. */}
        <p className="text-sm font-medium text-foreground mt-4">Add credit</p>
        <div className="mt-2 flex flex-wrap gap-2">
          {pricing.topups.map((topup) => (
            <button
              key={topup.cents}
              type="button"
              disabled={busy}
              onClick={() => topUp(topup.cents)}
              className={`px-4 py-2 rounded-full border text-sm disabled:opacity-50 ${
                topup.popular
                  ? "border-inverted bg-inverted text-inverted-foreground font-semibold"
                  : "border-border text-foreground hover:bg-muted"
              }`}
            >
              {topup.label}
              <span className="opacity-70">
                {" "}
                · {Math.floor(topup.cents / credit.centsPerMinute)} min
              </span>
            </button>
          ))}
        </div>

        {credit.entries.length > 0 && (
          <details className="mt-4">
            <summary className="text-sm text-muted-foreground cursor-pointer">
              {t("app.setVoice.creditLog", "Where the credit went")}
            </summary>
            <ul className="mt-2 space-y-1">
              {credit.entries.map((e, i) => (
                <li key={i} className="flex justify-between text-sm">
                  <span className="text-muted-foreground">
                    {e.note || e.kind}
                    <span className="opacity-60">
                      {" "}
                      {new Date(e.at).toLocaleDateString()}
                    </span>
                  </span>
                  <span
                    className={
                      e.cents >= 0
                        ? "text-emerald-600 dark:text-emerald-400 tabular-nums"
                        : "text-foreground tabular-nums"
                    }
                  >
                    {e.cents >= 0 ? "+" : "−"}
                    {money(Math.abs(e.cents))}
                  </span>
                </li>
              ))}
            </ul>
          </details>
        )}
      </Card>

      {/* ── 2. A number ─────────────────────────────────────────────────── */}
      <Card
        dataTour="voice-number"
        step="2."
        title={t("app.setVoice.numberTitle", "Your number")}
        hint={t("app.setVoice.numberHint", "What the receptionist answers on.")}
      >
        {number ? (
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-3">
              <Phone size={17} className="text-muted-foreground" />
              <span className="text-lg font-semibold text-foreground tabular-nums">
                {number.display}
              </span>
              <span className="text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
                {number.source === "forwarded"
                  ? t("app.setVoice.badgeForwarded", "your number, forwarded")
                  : number.numberType === "toll_free"
                    ? t("app.setVoice.badgeTollFree", "toll-free")
                    : t("app.setVoice.badgeLocal", "local")}
              </span>
              {number.monthlyCents > 0 && (
                <span className="text-xs text-muted-foreground">
                  {money(number.monthlyCents)}{t("app.setVoice.perMonth", "/month")}
                </span>
              )}
            </div>

            {/* ── The number they are actually paying for ──────────────────
                A forwarded setup has TWO numbers: the one on the van, which
                they keep and which is printed above, and a receptionist line
                we buy for their calls to land on. Only the first was ever
                shown, with "$4.00/month" beside it — so the card read as a
                monthly charge for a number they already owned, and the owner
                reasonably asked why forwarding needed to cost anything.

                It also made the setup impossible to finish. Forwarding is a
                code dialled on their own handset that names a DESTINATION,
                and the destination was on screen exactly once, in a toast
                that disappeared. Printed here it is answerable at any time,
                including from a phone in a driveway. */}
            {number.source === "forwarded" && (number.forwardsToDisplay || number.e164) && (
              <div className="rounded-lg border border-border bg-muted/50 px-4 py-3">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">
                  {t("app.setVoice.forwardsToLabel", "Forwards to")}
                </p>
                <p className="text-base font-semibold text-foreground tabular-nums mt-0.5">
                  {number.forwardsToDisplay || number.e164}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  {t(
                    "app.setVoice.forwardsToNote",
                    "The receptionist's own line — this is what the monthly rental pays for, and what your forwarding code has to point at. Your clients never dial it; keep giving out the number above.",
                  )}
                </p>
              </div>
            )}

            {/* ── A number that isn't answering yet, and why ─────────────────
                Porting especially. The row exists, so the card renders, and
                without this it looked identical to a working number — a
                contractor would advertise it and wonder why nothing rang.
                Nothing here is automatic and it says so, because it isn't:
                a port is actioned by a person, and it has no queue yet. */}
            {number.status === "porting" && (
              <div className="rounded-lg border border-border bg-muted px-4 py-3 space-y-2">
                <p className="text-sm font-semibold text-foreground">
                  Requested — not moved yet
                </p>
                <p className="text-sm text-muted-foreground">
                  Moving a number is not something a button can finish. Your old provider needs
                  paperwork and account details from you, and it takes two to four weeks on their
                  schedule. Somebody here has to action it with them, and we&apos;ll contact you
                  about what they need.
                  {number.portExpectedAt
                    ? ` Best estimate: ${showDate(number.portExpectedAt)}.`
                    : ""}
                </p>
                <p className="text-sm text-muted-foreground">
                  Until it lands, this number is still with your old provider and works exactly as
                  it always did. The receptionist cannot answer on it.
                </p>
                <button
                  type="button"
                  disabled={busy}
                  onClick={cancelPort}
                  className="mt-1 px-4 py-2 rounded-full border border-border text-sm text-foreground hover:bg-muted disabled:opacity-50"
                >
                  Cancel this request
                </button>
                <p className="text-xs text-muted-foreground">
                  Cancelling costs nothing and frees you to forward or buy instead — which is what
                  most people should do anyway.
                </p>
              </div>
            )}

            {/* A row that never finished activating. It exists at the provider
                and is being paid for, so it must not be silently hidden — but
                nothing in the app can repair it, and saying "try again" would
                sell them a second one. */}
            {number.status !== "porting" && number.status !== "active" && (
              <div className="rounded-lg border border-amber-300 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/40 px-4 py-3 flex gap-3">
                <AlertTriangle size={17} className="text-amber-700 dark:text-amber-400 shrink-0 mt-0.5" />
                <p className="text-sm text-amber-900 dark:text-amber-200">
                  This number was set up but never finished activating, so nothing can answer on it.
                  Please get in touch — don&apos;t buy another one, this one is already yours and
                  already being charged for.
                </p>
              </div>
            )}

            {/* ── The rental, said out loud ───────────────────────────────────
                It comes out of the same balance the calls do, on a date, and it
                can take the number away. A charge that only appears in a
                statement after the fact is the kind of surprise this whole
                prepaid model exists to avoid. */}
            {rent && (
              rent.pastDue ? (
                <div className="rounded-lg border border-amber-300 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/40 px-4 py-3 flex gap-3">
                  <AlertTriangle size={17} className="text-amber-700 dark:text-amber-400 shrink-0 mt-0.5" />
                  <div className="text-sm text-amber-900 dark:text-amber-200">
                    <p className="font-semibold">
                      {t("app.setVoice.rentPastDueTitle", "This number's rental hasn't been paid")}
                    </p>
                    <p className="mt-0.5">
                      {rent.graceUntil
                        ? t("app.setVoice.rentPastDueDated", "It keeps working until {date}. After that the number is released and you lose it — add credit to keep it.", { date: showDate(rent.graceUntil) })
                        : t("app.setVoice.rentPastDueNow", "The {amount} rental is due now and your balance won't cover it. Add credit to keep the number — we'll email you before anything is released.", { amount: money(rent.monthlyCents) })}
                    </p>
                  </div>
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">
                  {rent.dueAt
                    ? t("app.setVoice.rentNext", "Next rental {amount} on {date}, taken from the credit above.", { amount: money(rent.monthlyCents), date: showDate(rent.dueAt) })
                    : t("app.setVoice.rentSoon", "The {amount} monthly rental starts coming out of the credit above once this number is live.", { amount: money(rent.monthlyCents) })}
                  {!rent.coversNext && (
                    <span className="text-amber-700 dark:text-amber-400">
                      {" "}
                      {t("app.setVoice.rentWontCover", "Your balance won't cover it — top up before then.")}
                    </span>
                  )}
                </p>
              )
            )}

            {/* Only for a forwarded setup, and only the codes for THEIR
                number — see the API. */}
            {number.forwarding && number.status === "active" && (
              <div className="rounded-lg bg-muted p-4">
                <p className="text-sm text-foreground font-medium">
                  {t("app.setVoice.dialTitle", "Dial one of these from the phone you want forwarded")}
                </p>
                <p className="text-xs text-muted-foreground mt-0.5 mb-3">
                  {t("app.setVoice.dialHint", "Most people want the first one. Your phone rings as usual, and only the calls you miss reach the receptionist.")}
                </p>
                <div className="space-y-2">
                  {number.forwarding.map((f) => (
                    <div key={f.code} className="flex flex-wrap items-center gap-2">
                      <code className="px-2 py-1 rounded bg-background border border-border text-sm tabular-nums">
                        {f.code}
                      </code>
                      <span className="text-xs text-muted-foreground flex-1 min-w-[10rem]">
                        {f.when}
                        {f.note ? ` — ${f.note}` : ""}
                      </span>
                      <button
                        type="button"
                        onClick={() => copy(f.code, f.code)}
                        className="text-muted-foreground hover:text-foreground"
                        aria-label={t("app.setVoice.copyCode", "Copy {code}", { code: f.code })}
                      >
                        {copied === f.code ? <Check size={14} /> : <Copy size={14} />}
                      </button>
                    </div>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground mt-3">
                  {t("app.setVoice.carriersNote", "These work on most carriers. If yours doesn't take them, their support can set it up in a minute.")}
                </p>
                {/* The common failure: an ignored call lands in the carrier's
                    OWN voicemail instead of the receptionist. The carrier's
                    no-answer voicemail can fire before the conditional forward,
                    and tapping Decline usually triggers the busy path, not "no
                    answer". Both are on the carrier's side, so name the fix
                    rather than let it read as our bug. */}
                <p className="text-xs text-muted-foreground mt-2">
                  If ignored calls still reach your voicemail, your carrier&apos;s voicemail is
                  answering first. Turn off carrier voicemail with your provider, or let the call
                  ring out rather than tapping Decline — declining can send it straight to voicemail.
                  Advanced: some carriers let you set the ring time before forwarding with{" "}
                  <code className="px-1 py-0.5 rounded bg-background border border-border tabular-nums">
                    *61*&lt;number&gt;*11*&lt;seconds&gt;#
                  </code>
                  .
                </p>
              </div>
            )}

            {/* ── "How do I undo this?" — asked before it's needed ───────────
                Two different answers, and only one of them is self-serve. A
                forwarded setup is genuinely reversible from their own handset in
                a few seconds, which is most of why it's the recommended option.
                A number we bought is not: releasing it means deleting it at the
                provider, it can't be got back, and there is no control for it
                yet. Saying so is the honest version — an absent answer reads as
                "trapped", and a fake button would be worse than both. */}
            {number.status === "active" && (
              <p className="text-xs text-muted-foreground">
                {number.source === "forwarded"
                  ? "To stop: dial ##002# from your own phone and calls stop reaching the receptionist immediately — your number is unchanged. To stop paying for the forwarding number as well, get in touch."
                  : "To give this number up: get in touch. Releasing it is permanent — the number goes back to the pool and can't be recovered — so it isn't a button on this page."}
              </p>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {sources.map((s) => (
              <div
                key={s.key}
                className={`rounded-xl border p-4 ${
                  s.recommended ? "border-inverted bg-muted" : "border-border"
                }`}
              >
                <div className="flex items-baseline gap-2">
                  <p className="font-semibold text-foreground">{s.label}</p>
                  {s.recommended && (
                    <span className="text-[11px] font-bold uppercase tracking-wide text-emerald-600 dark:text-emerald-400">
                      {t("app.setVoice.recommended", "Recommended")}
                    </span>
                  )}
                </div>
                <p className="text-sm text-muted-foreground mt-1">{s.blurb}</p>
                {/* The downside, stated before they choose rather than after.
                    Porting especially — two to four weeks on someone else's
                    schedule is not a detail to discover afterwards. */}
                <p className="text-xs text-muted-foreground mt-1.5">{s.caveat}</p>

                {/* Each path gets the control that path actually needs.
                    An earlier version showed the same "Local / Toll-free"
                    buttons under "Move my number over" — pressing one would
                    have BOUGHT A NEW NUMBER while the company believed they
                    were porting theirs. A control that appears to work and
                    does something else is worse than one that isn't there. */}
                {/* Forwarding still buys a number to forward TO, so it costs
                    the same as a local one and is gated the same way. */}
                {s.key === "forwarded" && (
                  <>
                    <NumberInput
                      placeholder={t("app.setVoice.forwardedPlaceholder", "Your current business number")}
                      cta={t("app.setVoice.forwardedCta", "Set it up")}
                      disabled={busy || !configured || !forwardAfford.allowed}
                      onSubmit={(n) => getNumber("forwarded", "local", { publicNumber: n })}
                    />
                    <PriceNote
                      afford={forwardAfford}
                      money={money}
                      t={t}
                      configured={configured}
                    />
                  </>
                )}

                {s.key === "purchased" && (
                  <div className="mt-3 space-y-2">
                    <div className="flex flex-wrap gap-2">
                      {pricing.numberTypes.map((type) => (
                        <button
                          key={type.key}
                          type="button"
                          // Disabled with a reason underneath, not a button that
                          // takes the click and comes back with "insufficient
                          // balance". The verdict is the server's.
                          disabled={busy || !configured || !type.afford.allowed}
                          onClick={() => getNumber(s.key, type.key)}
                          className="px-4 py-2 rounded-full border border-border text-sm text-foreground hover:bg-muted disabled:opacity-50"
                        >
                          {type.label} — {money(type.monthlyCents)}/mo, {type.perMinuteCents}¢/min
                        </button>
                      ))}
                    </div>
                    {/* One line per type they CAN'T have, naming the gap. The
                        affordable case gets a single line rather than one per
                        button — the same sentence twice reads as a warning. */}
                    {pricing.numberTypes.some((type) => type.afford.allowed) && configured && (
                      <p className="text-xs text-muted-foreground">
                        {t("app.setVoice.firstMonthUpFront", "The first month's rental comes out of your credit as soon as you pick one.")}
                      </p>
                    )}
                    {pricing.numberTypes
                      .filter((type) => !type.afford.allowed)
                      .map((type) => (
                        <PriceNote
                          key={type.key}
                          label={type.label}
                          afford={type.afford}
                          money={money}
                          t={t}
                          configured={configured}
                        />
                      ))}
                    {pricing.freeTrialAvailable && (
                      <p className="text-xs text-muted-foreground">
                        {t("app.setVoice.trialWithNumber", "{minutes} free minutes are added to your credit with your first number.", { minutes: pricing.freeTrialMinutes })}
                      </p>
                    )}
                  </div>
                )}

                {s.key === "ported" && (
                  <>
                    <NumberInput
                      placeholder={t("app.setVoice.portedPlaceholder", "The number you want to move")}
                      cta={t("app.setVoice.portedCta", "Start the port")}
                      disabled={busy || !configured}
                      onSubmit={(n) => getNumber("ported", "local", { publicNumber: n })}
                    />
                    {/* Not gated on credit, because a port request costs
                        nothing — the rental starts when the number actually
                        moves, which is weeks away and may never happen. */}
                    <p className="text-xs text-muted-foreground mt-2">
                      {t("app.setVoice.portNoCharge", "Nothing is charged to start. The monthly rental begins only once the number has actually moved over.")}
                    </p>
                    {/* Said before they start, not after. A port needs details
                        from their losing carrier that no button here can
                        obtain, so this is a REQUEST someone picks up — and
                        pretending it's instant is how a business line goes
                        dark on a Tuesday.

                        The previous wording here promised "we'll email you what
                        your current provider needs", and nothing in the codebase
                        sends that email — the request writes one row and one
                        activity entry, both of which live inside the company's
                        own account. Promising a message that never arrives is
                        the same failure as a button that does nothing; it just
                        takes a week to notice. So it now says what actually
                        happens, and it says that a person is involved. */}
                    <p className="text-xs text-muted-foreground mt-2">
                      {t("app.setVoice.portedNote", "This records a request — it isn't automatic. Someone here has to arrange it with your current provider, who will need account details from you, so expect to hear from us rather than a confirmation on this screen. Your existing number keeps working the whole time, nothing switches over until the transfer completes, and you can cancel the request at any point before then.")}
                    </p>
                  </>
                )}
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* ── 3. What it says ─────────────────────────────────────────────── */}
      <Card
        step="3."
        title={t("app.setVoice.saysTitle", "What it says")}
        hint={t("app.setVoice.saysHint", "It will never give a price, promise a time it hasn't checked, or claim to be a person.")}
      >
        <div className="space-y-4">
          <label className="block">
            <span className="text-sm font-medium text-foreground">{t("app.setVoice.greeting", "Greeting")}</span>
            <input
              value={form.greeting}
              onChange={(e) => setForm({ ...form, greeting: e.target.value })}
              placeholder={t("app.setVoice.greetingPlaceholder", "Thanks for calling, how can I help?")}
              className="mt-1.5 w-full px-3 py-2 rounded-lg border border-border bg-background text-foreground text-sm"
            />
          </label>

          <label className="block">
            <span className="text-sm font-medium text-foreground">
              {t("app.setVoice.instructions", "Anything it should know")}
            </span>
            <span className="block text-xs text-muted-foreground mt-0.5 mb-1.5">
              {t("app.setVoice.instructionsHint", "Tone, what to emphasise, what you don't do. It can't override the rules above — it still won't quote.")}
            </span>
            <textarea
              value={form.instructions}
              onChange={(e) => setForm({ ...form, instructions: e.target.value })}
              rows={4}
              placeholder={t("app.setVoice.instructionsPlaceholder", "We don't do commercial work. If they mention a leak, treat it as urgent.")}
              className="w-full px-3 py-2 rounded-lg border border-border bg-background text-foreground text-sm"
            />
          </label>

          {liveWarning && (
            <p className="text-sm text-amber-700 dark:text-amber-400 flex items-start gap-1.5">
              <AlertTriangle size={15} className="shrink-0 mt-0.5" />
              {t("app.setVoice.liveWarning", "Saved here, but we couldn't update the live phone agent. It's still using the previous wording — try saving again in a moment.")}
            </p>
          )}

          <button
            type="button"
            disabled={busy}
            onClick={() => save(form)}
            className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-lg bg-inverted text-inverted-foreground text-sm font-semibold disabled:opacity-50"
          >
            {busy ? <Loader2 size={15} className="animate-spin" /> : saved ? <Check size={15} /> : null}
            {saved ? t("app.action.saved", "Saved") : t("app.action.save", "Save")}
          </button>
        </div>
      </Card>

      {/* ── 4. The switch ───────────────────────────────────────────────── */}
      <Card
        dataTour="voice-answer"
        step="4."
        title={t("app.setVoice.answerTitle", "Answer my calls")}
        hint={
          canEnable
            ? freeOnly
              ? "Your free trial minutes are ready to use — turn it on whenever you like, no top-up needed."
              : t("app.setVoice.answerHintReady", "Turn it on when you're ready. You can turn it off just as fast.")
            // The server's sentence, naming the ONE thing that's missing.
            // The old text said "set up a number and add some credit" to
            // everybody, including people looking at their own number two cards
            // further up the same screen.
            : readiness?.message
        }
      >
        <button
          type="button"
          disabled={busy || (!agent?.enabled && !canEnable)}
          onClick={() => save({ enabled: !agent?.enabled })}
          className={`inline-flex items-center gap-2 px-6 py-3 rounded-full text-sm font-bold disabled:opacity-40 ${
            agent?.enabled
              ? "bg-emerald-600 text-white"
              : "bg-inverted text-inverted-foreground"
          }`}
        >
          {busy ? <Loader2 size={16} className="animate-spin" /> : <Headset size={16} />}
          {agent?.enabled ? t("app.setVoice.answerOn", "It's answering — turn off") : t("app.setVoice.answerOff", "Start answering calls")}
        </button>
        <BlockedReason show={!agent?.enabled && !canEnable} readiness={readiness} />
      </Card>

      {/* ── 5. Outbound ─────────────────────────────────────────────────────
          A separate switch on purpose — answering a call someone placed is a
          different consent story from placing one they didn't. Off by default;
          the same number-and-credit floor as answering. */}
      <Card
        step="5."
        title={t("app.setVoice.outboundTitle", "Call clients back automatically")}
        hint={t("app.setVoice.outboundHint", "The assistant rings clients who asked to be contacted — when you approve their quote, to confirm a booked visit the day before, and to follow up on a new enquiry. Always within calling hours, and anyone who says stop is taken off for good.")}
      >
        <button
          type="button"
          disabled={busy || (!data?.outbound?.enabled && !canEnable)}
          onClick={() => save({ outboundCallsEnabled: !data?.outbound?.enabled })}
          className={`inline-flex items-center gap-2 px-6 py-3 rounded-full text-sm font-bold disabled:opacity-40 ${
            data?.outbound?.enabled
              ? "bg-emerald-600 text-white"
              : "bg-inverted text-inverted-foreground"
          }`}
        >
          {busy ? <Loader2 size={16} className="animate-spin" /> : <Phone size={16} />}
          {data?.outbound?.enabled ? t("app.setVoice.outboundOn", "It's calling clients — turn off") : t("app.setVoice.outboundOff", "Turn on quote callbacks")}
        </button>

        {/* This card had no explanation at all when its button was dead — the
            precondition (a live number and enough credit for one minute) was
            enforced in the PUT route and stated nowhere. */}
        <BlockedReason show={!data?.outbound?.enabled && !canEnable} readiness={readiness} />

        {data?.outbound?.enabled && (
          <p className="text-xs text-muted-foreground mt-3">
            {data.outbound.queued > 0
              ? t("app.setVoice.outboundQueued", "{count} call{plural} waiting to go out.", { count: data.outbound.queued, plural: data.outbound.queued === 1 ? "" : "s" })
              : t("app.setVoice.outboundNone", "No calls waiting. The next approved quote will queue one.")}{" "}
            {t("app.setVoice.outboundStopNote", "A client who asks to stop being called is taken off immediately and for good.")}
          </p>
        )}
      </Card>

      {/* ── 6. Crew inbox ───────────────────────────────────────────────────
          Crew text photos and updates to your number; the assistant files each
          one to the right job on their schedule, and asks when it's not sure.
          Needs a phone number; crew are matched by the phone on their profile. */}
      <Card
        step="6."
        title={t("app.setVoice.crewTitle", "Let the crew text in photos and updates")}
        hint={t("app.setVoice.crewHint", "Your crew send photos or a quick note to your number, and it files them to the right job automatically — asking which one when the day has more than one.")}
      >
        <button
          type="button"
          // An ACTIVE number, not merely a row. The inbound webhook resolves the
          // company with `status: "active"`, so switching this on against a
          // number that is still porting sets a flag that nothing can ever act
          // on — the switch would say "on" and no text would ever be filed.
          disabled={busy || (!data?.crewInbox?.enabled && number?.status !== "active")}
          onClick={() => save({ crewInboxEnabled: !data?.crewInbox?.enabled })}
          className={`inline-flex items-center gap-2 px-6 py-3 rounded-full text-sm font-bold disabled:opacity-40 ${
            data?.crewInbox?.enabled
              ? "bg-emerald-600 text-white"
              : "bg-inverted text-inverted-foreground"
          }`}
        >
          {busy ? <Loader2 size={16} className="animate-spin" /> : <MessageSquare size={16} />}
          {data?.crewInbox?.enabled ? t("app.setVoice.crewOn", "Crew inbox is on — turn off") : t("app.setVoice.crewOff", "Turn on the crew inbox")}
        </button>

        {!data?.crewInbox?.enabled && number?.status !== "active" && (
          <p className="text-xs text-amber-700 dark:text-amber-400 mt-3">
            {number
              ? "Your number isn't live yet, so there's nothing for the crew to text."
              : "Set up a number above first — the crew inbox is texts sent TO your number."}
          </p>
        )}

        {/* ── Turning this on sends nobody anything ─────────────────────────
            Worth saying, because "turn on the crew inbox" reads like it
            invites the crew in. It doesn't: this is a switch on a webhook.
            Nothing is texted to anyone when it's enabled, no invitation goes
            out, and the crew have no way to discover it — the contractor has to
            tell them, with the right number, which is the part that goes wrong.

            And the number is the trap. On a forwarded setup the number on the
            van is theirs and sits at their own carrier; carrier forwarding
            forwards CALLS, never texts. A crew member texting the number they
            already know reaches nothing. So the one they must use is printed
            here rather than described. */}
        {data?.crewInbox?.enabled && (
          <div className="mt-3 space-y-2">
            {data.crewInbox.textTo && (
              <div className="rounded-lg bg-muted p-3 space-y-1">
                <p className="text-sm text-foreground">
                  Your crew text{" "}
                  <code className="px-1.5 py-0.5 rounded bg-background border border-border text-sm tabular-nums">
                    {data.crewInbox.textTo}
                  </code>
                  <button
                    type="button"
                    onClick={() => copy(data.crewInbox.textTo, "crewTextTo")}
                    className="ml-2 align-middle text-muted-foreground hover:text-foreground"
                    aria-label="Copy the number crew should text"
                  >
                    {copied === "crewTextTo" ? <Check size={14} /> : <Copy size={14} />}
                  </button>
                </p>
                {data.crewInbox.textToDiffersFromPublic && (
                  <p className="text-xs text-amber-700 dark:text-amber-400">
                    Not the number on your van — that one is still with your own carrier, and call
                    forwarding does not forward texts. Give the crew the number above or nothing
                    will arrive.
                  </p>
                )}
              </div>
            )}
            <p className="text-xs text-muted-foreground">
              Nothing is sent to your crew when you switch this on — it only opens the door. Tell
              them the number yourself, and save it in their phones.
            </p>
            <p className="text-xs text-muted-foreground">
              {t("app.setVoice.crewNote", "Crew are matched by the phone number on their profile (Settings → Team). A text from an unknown number is logged but not filed.")}
            </p>
          </div>
        )}
      </Card>
    </div>
  );
}

/**
 * What this number costs, and — when they can't have it — why not.
 *
 * The reason has to be next to the control, before it's pressed. A disabled
 * button with no explanation is the same dead end as one that fails on click;
 * the only difference is which of the two the contractor phones about.
 *
 * `afford` is the server's verdict (`spendVerdict` in lib/voice/spendGate.js),
 * shortfall included, so the number quoted here is the number the route would
 * have enforced.
 */
function PriceNote({ afford, label, money, t, configured }) {
  // Nothing to say about affording a number on a deployment that can't sell
  // one — the banner at the top of the page already explains that.
  if (!configured || !afford) return null;

  if (afford.allowed) {
    return (
      <p className="text-xs text-muted-foreground mt-2">
        {t("app.setVoice.firstMonthNow", "{amount} — the first month — comes out of your credit now.", { amount: money(afford.needCents) })}
      </p>
    );
  }

  return (
    <p className="text-xs text-amber-700 dark:text-amber-400 mt-2">
      {label ? `${label}: ` : ""}
      {t("app.setVoice.cantAfford", "Add {amount} more credit first — the first month's {rental} rental is charged up front.", {
        amount: money(afford.shortfallCents),
        rental: money(afford.needCents),
      })}
    </p>
  );
}

/**
 * Why a switch is off, printed under the switch.
 *
 * Both call switches were disabled with nothing beside them but a hint that
 * assumed the reason ("set up a number and add some credit"), which was wrong
 * for anyone whose number existed but wasn't answering yet — the exact case a
 * porting request produces, and the one that got reported.
 *
 * `readiness` is the server's, computed by the same checkSpend() the PUT gate
 * runs, so this can't tell someone to top up when the real blocker was the
 * number, or tell them the number is fine when the route would refuse.
 */
function BlockedReason({ show, readiness }) {
  if (!show || !readiness?.message) return null;
  return (
    <p className="text-xs text-amber-700 dark:text-amber-400 mt-3 flex items-start gap-1.5">
      <AlertTriangle size={13} className="shrink-0 mt-0.5" />
      {readiness.message}
    </p>
  );
}

/** One number field. Shared by forwarding and porting — both need theirs. */
function NumberInput({ onSubmit, disabled, placeholder, cta }) {
  const [value, setValue] = useState("");
  return (
    <div className="mt-3 flex flex-wrap gap-2">
      <input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder={placeholder}
        type="tel"
        inputMode="tel"
        autoComplete="tel"
        className="flex-1 min-w-[12rem] px-3 py-2 rounded-lg border border-border bg-background text-foreground text-sm"
      />
      <button
        type="button"
        disabled={disabled || !value.trim()}
        onClick={() => onSubmit(value)}
        className="px-4 py-2 rounded-full bg-inverted text-inverted-foreground text-sm font-semibold disabled:opacity-50"
      >
        <Plus size={14} className="inline mr-1" />
        {cta}
      </button>
    </div>
  );
}
