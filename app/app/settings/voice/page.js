"use client";

// app/app/settings/voice/page.js
//
// The AI receptionist, set up by the contractor.
//
// ── Order of the page is the order of the decisions ────────────────────────
//
// A number, then credit, then the words, then the switch. The switch is last
// and refuses to turn on without the first two — a toggle that flips to "on"
// and then doesn't answer is the worst kind of broken, because the company
// believes their calls are covered and finds out from a customer who rang and
// got nothing.
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
import { reportResponseError } from "@/lib/clientErrors";

const money = (c) => `$${(Number(c || 0) / 100).toFixed(2)}`;

function Card({ title, hint, children, step }) {
  return (
    <section className="bg-card border border-border rounded-xl p-5">
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
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);
  const [form, setForm] = useState({ greeting: "", instructions: "", transferTo: "" });
  const [copied, setCopied] = useState(null);
  const [liveWarning, setLiveWarning] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch("/api/settings/voice");
    if (!res.ok) {
      await reportResponseError(res, "Couldn't load the receptionist settings.");
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
        await reportResponseError(res, "Couldn't save.");
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

  async function getNumber(source, numberType, extra = {}) {
    setBusy(true);
    try {
      const res = await fetch("/api/settings/voice/number", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ source, numberType, ...extra }),
      });
      if (!res.ok) {
        await reportResponseError(res, "Couldn't set up a number.");
        return;
      }
      await load();
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
        await reportResponseError(res, "Couldn't start the payment.");
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
        This page couldn&apos;t be loaded.
      </div>
    );
  }

  const { agent, number, credit, pricing, sources, configured } = data;
  const canEnable = number?.status === "active" && credit.cents >= credit.centsPerMinute;

  return (
    <div className="max-w-3xl p-4 sm:p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
          <Headset size={20} className="text-muted-foreground" />
          Phone receptionist
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Answers the calls you can&apos;t, takes the details, and books visits
          against your real availability. It never quotes a price.
        </p>
      </div>

      {/* Honest about the deployment rather than failing mysteriously when
          someone presses a button. */}
      {!configured && (
        <div className="rounded-xl border border-amber-300 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/40 px-4 py-3 flex gap-3">
          <Info size={17} className="text-amber-700 dark:text-amber-400 shrink-0 mt-0.5" />
          <p className="text-sm text-amber-900 dark:text-amber-200">
            The phone service isn&apos;t connected on this deployment yet, so
            numbers can&apos;t be set up. Everything else on this page works.
          </p>
        </div>
      )}

      {/* ── 1. A number ─────────────────────────────────────────────────── */}
      <Card
        step="1."
        title="Your number"
        hint="What the receptionist answers on."
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
                  ? "your number, forwarded"
                  : number.numberType === "toll_free"
                    ? "toll-free"
                    : "local"}
              </span>
              {number.monthlyCents > 0 && (
                <span className="text-xs text-muted-foreground">
                  {money(number.monthlyCents)}/month
                </span>
              )}
            </div>

            {/* Only for a forwarded setup, and only the codes for THEIR
                number — see the API. */}
            {number.forwarding && (
              <div className="rounded-lg bg-muted p-4">
                <p className="text-sm text-foreground font-medium">
                  Dial one of these from the phone you want forwarded
                </p>
                <p className="text-xs text-muted-foreground mt-0.5 mb-3">
                  Most people want the first one. Your phone rings as usual, and
                  only the calls you miss reach the receptionist.
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
                        aria-label={`Copy ${f.code}`}
                      >
                        {copied === f.code ? <Check size={14} /> : <Copy size={14} />}
                      </button>
                    </div>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground mt-3">
                  These work on most carriers. If yours doesn&apos;t take them,
                  their support can set it up in a minute.
                </p>
              </div>
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
                      Recommended
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
                {s.key === "forwarded" && (
                  <NumberInput
                    placeholder="Your current business number"
                    cta="Set it up"
                    disabled={busy || !configured}
                    onSubmit={(n) => getNumber("forwarded", "local", { publicNumber: n })}
                  />
                )}

                {s.key === "purchased" && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {pricing.numberTypes.map((t) => (
                      <button
                        key={t.key}
                        type="button"
                        disabled={busy || !configured}
                        onClick={() => getNumber(s.key, t.key)}
                        className="px-4 py-2 rounded-full border border-border text-sm text-foreground hover:bg-muted disabled:opacity-50"
                      >
                        {t.label} — {money(t.monthlyCents)}/mo, {t.perMinuteCents}¢/min
                      </button>
                    ))}
                  </div>
                )}

                {s.key === "ported" && (
                  <>
                    <NumberInput
                      placeholder="The number you want to move"
                      cta="Start the port"
                      disabled={busy || !configured}
                      onSubmit={(n) => getNumber("ported", "local", { publicNumber: n })}
                    />
                    {/* Said before they start, not after. A port needs details
                        from their losing carrier that no button here can
                        obtain, so this is a REQUEST someone picks up — and
                        pretending it's instant is how a business line goes
                        dark on a Tuesday. */}
                    <p className="text-xs text-muted-foreground mt-2">
                      We&apos;ll email you what your current provider needs.
                      Your existing number keeps working the whole time, and
                      nothing switches over until the transfer completes.
                    </p>
                  </>
                )}
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* ── 2. Credit ───────────────────────────────────────────────────── */}
      <Card
        step="2."
        title="Credit"
        hint={`${credit.centsPerMinute}¢ a minute, rounded up, one minute minimum. No monthly fee — you only pay for calls it actually takes.`}
      >
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <span className="text-2xl font-bold text-foreground">{money(credit.cents)}</span>
          <span className="text-sm text-muted-foreground">
            about {credit.minutes} minute{credit.minutes === 1 ? "" : "s"}
          </span>
          {credit.low && (
            <span className="inline-flex items-center gap-1 text-xs text-amber-700 dark:text-amber-400">
              <AlertTriangle size={13} /> running low
            </span>
          )}
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          {pricing.topups.map((t) => (
            <button
              key={t.cents}
              type="button"
              disabled={busy}
              onClick={() => topUp(t.cents)}
              className={`px-4 py-2 rounded-full border text-sm disabled:opacity-50 ${
                t.popular
                  ? "border-inverted bg-inverted text-inverted-foreground font-semibold"
                  : "border-border text-foreground hover:bg-muted"
              }`}
            >
              {t.label}
              <span className="opacity-70">
                {" "}
                · {Math.floor(t.cents / credit.centsPerMinute)} min
              </span>
            </button>
          ))}
        </div>

        {credit.entries.length > 0 && (
          <details className="mt-4">
            <summary className="text-sm text-muted-foreground cursor-pointer">
              Where the credit went
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

      {/* ── 3. What it says ─────────────────────────────────────────────── */}
      <Card
        step="3."
        title="What it says"
        hint="It will never give a price, promise a time it hasn't checked, or claim to be a person."
      >
        <div className="space-y-4">
          <label className="block">
            <span className="text-sm font-medium text-foreground">Greeting</span>
            <input
              value={form.greeting}
              onChange={(e) => setForm({ ...form, greeting: e.target.value })}
              placeholder="Thanks for calling, how can I help?"
              className="mt-1.5 w-full px-3 py-2 rounded-lg border border-border bg-background text-foreground text-sm"
            />
          </label>

          <label className="block">
            <span className="text-sm font-medium text-foreground">
              Anything it should know
            </span>
            <span className="block text-xs text-muted-foreground mt-0.5 mb-1.5">
              Tone, what to emphasise, what you don&apos;t do. It can&apos;t
              override the rules above — it still won&apos;t quote.
            </span>
            <textarea
              value={form.instructions}
              onChange={(e) => setForm({ ...form, instructions: e.target.value })}
              rows={4}
              placeholder="We don't do commercial work. If they mention a leak, treat it as urgent."
              className="w-full px-3 py-2 rounded-lg border border-border bg-background text-foreground text-sm"
            />
          </label>

          {liveWarning && (
            <p className="text-sm text-amber-700 dark:text-amber-400 flex items-start gap-1.5">
              <AlertTriangle size={15} className="shrink-0 mt-0.5" />
              Saved here, but we couldn&apos;t update the live phone agent.
              It&apos;s still using the previous wording — try saving again in a
              moment.
            </p>
          )}

          <button
            type="button"
            disabled={busy}
            onClick={() => save(form)}
            className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-lg bg-inverted text-inverted-foreground text-sm font-semibold disabled:opacity-50"
          >
            {busy ? <Loader2 size={15} className="animate-spin" /> : saved ? <Check size={15} /> : null}
            {saved ? "Saved" : "Save"}
          </button>
        </div>
      </Card>

      {/* ── 4. The switch ───────────────────────────────────────────────── */}
      <Card
        step="4."
        title="Answer my calls"
        hint={
          canEnable
            ? "Turn it on when you're ready. You can turn it off just as fast."
            : "Set up a number and add some credit first — otherwise it would pick up and fail."
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
          {agent?.enabled ? "It's answering — turn off" : "Start answering calls"}
        </button>
      </Card>

      {/* ── 5. Outbound ─────────────────────────────────────────────────────
          A separate switch on purpose — answering a call someone placed is a
          different consent story from placing one they didn't. Off by default;
          the same number-and-credit floor as answering. */}
      <Card
        step="5."
        title="Call clients back automatically"
        hint="The assistant rings clients who asked to be contacted — when you approve their quote, to confirm a booked visit the day before, and to follow up on a new enquiry. Always within calling hours, and anyone who says stop is taken off for good."
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
          {data?.outbound?.enabled ? "It's calling clients — turn off" : "Turn on quote callbacks"}
        </button>

        {data?.outbound?.enabled && (
          <p className="text-xs text-muted-foreground mt-3">
            {data.outbound.queued > 0
              ? `${data.outbound.queued} call${data.outbound.queued === 1 ? "" : "s"} waiting to go out.`
              : "No calls waiting. The next approved quote will queue one."}{" "}
            A client who asks to stop being called is taken off immediately and for good.
          </p>
        )}
      </Card>

      {/* ── 6. Crew inbox ───────────────────────────────────────────────────
          Crew text photos and updates to your number; the assistant files each
          one to the right job on their schedule, and asks when it's not sure.
          Needs a phone number; crew are matched by the phone on their profile. */}
      <Card
        step="6."
        title="Let the crew text in photos and updates"
        hint="Your crew send photos or a quick note to your number, and it files them to the right job automatically — asking which one when the day has more than one."
      >
        <button
          type="button"
          disabled={busy || (!data?.crewInbox?.enabled && !number)}
          onClick={() => save({ crewInboxEnabled: !data?.crewInbox?.enabled })}
          className={`inline-flex items-center gap-2 px-6 py-3 rounded-full text-sm font-bold disabled:opacity-40 ${
            data?.crewInbox?.enabled
              ? "bg-emerald-600 text-white"
              : "bg-inverted text-inverted-foreground"
          }`}
        >
          {busy ? <Loader2 size={16} className="animate-spin" /> : <MessageSquare size={16} />}
          {data?.crewInbox?.enabled ? "Crew inbox is on — turn off" : "Turn on the crew inbox"}
        </button>
        {data?.crewInbox?.enabled && (
          <p className="text-xs text-muted-foreground mt-3">
            Crew are matched by the phone number on their profile (Settings →
            Team). A text from an unknown number is logged but not filed.
          </p>
        )}
      </Card>
    </div>
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
