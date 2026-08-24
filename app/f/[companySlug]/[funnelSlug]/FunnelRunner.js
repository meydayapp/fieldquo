// app/f/[companySlug]/[funnelSlug]/FunnelRunner.js
//
// Walks a visitor through a funnel one full-screen step at a time — the
// Instagram-Stories shape that mobile ad traffic expects. Records a step-view
// beacon as each step is reached and a completion beacon at the end, so the
// builder's analytics can show where people drop off. Branching follows the
// chosen answer's `next`; otherwise it's linear. Everything client-facing about
// the brand comes from the company's hex through the same measured-contrast rule
// the rest of the product uses.
"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Loader2, Check, ArrowLeft, Building2, AlertCircle, Lock } from "lucide-react";
import { readableForeground, ensureContrast } from "@/lib/brand/colour";
import { currencyMeta } from "@/lib/currency";
import MediaUploader from "@/app/components/MediaUploader";

const FALLBACK_ACCENT = "#06356b";

// Money for an ESTIMATE, which is not money for an invoice. formatMoney renders
// cents, and the estimator rounds to the nearest $10 precisely so a figure reads
// as measured rather than as a machine guessing — "$940.00 – $1,270.00" throws
// that away. Same Intl formatting, same currency table, no fraction digits.
function money(n, currency) {
  const v = Math.round(Number(n) || 0);
  const meta = currencyMeta(currency);
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency: meta.code,
      maximumFractionDigits: 0,
    }).format(v);
  } catch {
    return `${meta.symbol}${v.toLocaleString()}`;
  }
}

// Anonymous per-visit id for drop-off analysis. Not tied to a person; derived
// without Math.random so it also works if this ever renders server-side.
function makeSession() {
  return `${Date.now().toString(36)}${performance.now().toString(36).replace(".", "")}`;
}

export default function FunnelRunner({ companySlug, funnelSlug }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

  const [idx, setIdx] = useState(0);
  const [answers, setAnswers] = useState({}); // { stepId: value | value[] }
  const [contact, setContact] = useState({ name: "", email: "", phone: "" });
  const [media, setMedia] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);
  // Estimates the SERVER has returned, keyed by step id. Never computed here —
  // this component has no rates and no arithmetic, only a range to render.
  const [estimates, setEstimates] = useState({});
  const [estimating, setEstimating] = useState("");
  const [submitted, setSubmitted] = useState(false);

  const sessionRef = useRef("");
  if (!sessionRef.current && typeof window !== "undefined") sessionRef.current = makeSession();

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/funnels/public/${companySlug}/${funnelSlug}`);
        const d = await res.json().catch(() => null);
        if (cancelled) return;
        if (!res.ok) throw new Error(d?.error || "This funnel isn't available.");
        setData(d);
      } catch (err) {
        if (!cancelled) setLoadError(err.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [companySlug, funnelSlug]);

  const steps = data?.funnel?.steps || [];
  const step = steps[idx] || null;

  // Fire a view beacon whenever a new step is shown (best-effort).
  const beacon = useCallback(
    (kind, stepId) => {
      if (!stepId) return;
      fetch(`/api/funnels/public/${companySlug}/${funnelSlug}/event`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        keepalive: true,
        body: JSON.stringify({ kind, stepId, sessionId: sessionRef.current }),
      }).catch(() => {});
    },
    [companySlug, funnelSlug],
  );

  useEffect(() => {
    if (step?.id) beacon("view", step.id);
    // One `error` serves every step, so it has to be cleared when the step
    // changes — otherwise a failed estimate follows the visitor onto the
    // contact form and reads as the form being broken.
    setError("");
  }, [step?.id, beacon]);

  const accent = data?.company?.brandColor || FALLBACK_ACCENT;
  const accentOn = useMemo(() => readableForeground(accent), [accent]);
  // The logo-stand-in glyph, drawn in the company's colour on an accentOn chip.
  // ensureContrast leaves a dark brand exactly as it is (navy on white is
  // already 12:1) and only steps a mid-tone far enough to clear the floor, so
  // it stays their colour rather than being thrown away for black.
  const monogramInk = useMemo(() => ensureContrast(accent, accentOn, 4.5), [accent, accentOn]);

  // The end of the run: the thank-you step if the funnel has one, else the
  // built-in done state.
  function goEnd() {
    const tyIdx = steps.findIndex((s) => s.kind === "thankyou");
    if (tyIdx >= 0) setIdx(tyIdx);
    else setDone(true);
  }

  // Next step: an answer's branch target wins, else linear.
  function goNext(branchToId) {
    if (branchToId) {
      const target = steps.findIndex((s) => s.id === branchToId);
      if (target >= 0) return setIdx(target);
    }
    setIdx((i) => Math.min(steps.length - 1, i + 1));
  }

  function pickSingle(step, value) {
    setAnswers((p) => ({ ...p, [step.id]: value }));
    const answer = (step.answers || []).find((a) => a.value === value);
    goNext(answer?.next);
  }

  function toggleMulti(step, value) {
    setAnswers((p) => {
      const cur = Array.isArray(p[step.id]) ? p[step.id] : [];
      return {
        ...p,
        [step.id]: cur.includes(value) ? cur.filter((v) => v !== value) : [...cur, value],
      };
    });
  }

  // ── Tapping a size on an instant-estimate step ────────────────────────────
  //
  // Price-first asks the server for the number now; details-first walks on and
  // reveals it after the contact form (see submit()). That ordering is the
  // company's choice on the step and it defaults to price-first, because
  // putting a number in front of a cold visitor before asking for their phone
  // number is the entire reason this step exists — it wins fewer, warmer leads,
  // and details-first wins more, colder ones.
  async function pickBand(step, bandId) {
    setAnswers((p) => ({ ...p, [step.id]: bandId }));
    if (step.order === "details_first") return goNext();

    setError("");
    setEstimating(step.id);
    try {
      const res = await fetch(`/api/funnels/public/${companySlug}/${funnelSlug}/estimate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ stepId: step.id, bandId }),
      });
      const d = await res.json().catch(() => null);
      if (!res.ok) throw new Error(d?.error || "Couldn't work that out just now.");
      setEstimates((p) => ({ ...p, [step.id]: d }));
    } catch (err) {
      // A failed estimate must not trap the visitor on a dead screen: say so,
      // and the Continue button below still moves them on to the form.
      setError(err.message);
    } finally {
      setEstimating("");
    }
  }

  async function submit() {
    setError("");
    if (!contact.name.trim()) return setError("Please tell us your name.");
    if (!contact.email.trim() && !contact.phone.trim())
      return setError("Add an email or phone so we can reply.");
    setSubmitting(true);
    try {
      const res = await fetch(`/api/funnels/public/${companySlug}/${funnelSlug}/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          answers,
          name: contact.name.trim(),
          email: contact.email.trim() || null,
          phone: contact.phone.trim() || null,
          media,
        }),
      });
      const d = await res.json().catch(() => null);
      if (!res.ok) throw new Error(d?.error || "Couldn't send that.");
      beacon("complete", step?.id || "done");
      setSubmitted(true);
      setEstimates((p) => ({ ...p, ...(d?.estimates || {}) }));

      // A number that was withheld until now goes on screen before the
      // thank-you rather than after it — either because the step is
      // details-first, or because the company's trade is set to "show the range
      // after they submit" and this is that moment. Going straight to
      // "thanks, we'll be in touch" would bury the thing they filled the form
      // in for.
      const reveal = steps.find(
        (s) =>
          s.kind === "instant_estimate" &&
          d?.estimates?.[s.id] &&
          !d.estimates[s.id].gated &&
          (s.order === "details_first" || !estimates[s.id] || estimates[s.id].gated),
      );
      if (reveal) return setIdx(steps.findIndex((s) => s.id === reveal.id));

      goEnd();
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) return <Shell><div className="animate-pulse h-40 w-full max-w-md bg-black/10 rounded-2xl" /></Shell>;

  if (loadError)
    return (
      <Shell>
        <div className="bg-white rounded-2xl p-8 text-center max-w-md w-full">
          <p className="text-lg font-semibold text-[#2d2520]">{loadError}</p>
        </div>
      </Shell>
    );

  const c = data.company;
  const total = steps.length;
  const isForm = step?.kind === "form";

  return (
    <Shell accent={accent}>
      <div className="w-full max-w-md">
        {/* Progress */}
        <div className="flex items-center gap-1.5 mb-5">
          {steps.map((s, i) => (
            <span
              key={s.id}
              className="h-1 flex-1 rounded-full transition-colors"
              style={{ backgroundColor: i <= idx ? accentOn : `${accentOn}44` }}
            />
          ))}
        </div>

        {/* Brand */}
        <div className="flex items-center gap-2 mb-6">
          {c.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={c.logoUrl} alt={c.name} className="h-8 w-auto max-w-[140px] object-contain" />
          ) : (
            // No logo: a chip standing in for one. The bubble was hardcoded
            // white, which is a coin-flip — a pale brand put its own colour on
            // white and vanished, and on a page whose background IS the accent
            // an accent-on-accent bubble vanishes the other way. accentOn is
            // already the measured partner of the accent, so it is both visible
            // against the page and something the glyph can sit on; monogramInk
            // then guarantees the glyph itself clears 4.5:1 on it.
            <div className="h-8 w-8 rounded-lg grid place-items-center" style={{ backgroundColor: accentOn, color: monogramInk }}>
              <Building2 size={16} />
            </div>
          )}
          <span className="font-semibold" style={{ color: accentOn }}>{c.name}</span>
        </div>

        {idx > 0 && !done && !submitted && step?.kind !== "thankyou" && (
          <button
            onClick={() => setIdx((i) => Math.max(0, i - 1))}
            className="inline-flex items-center gap-1 text-xs mb-3 opacity-80"
            style={{ color: accentOn }}
          >
            <ArrowLeft size={13} /> Back
          </button>
        )}

        <div className="bg-white rounded-2xl p-6 shadow-lg">
          {done || step?.kind === "thankyou" ? (
            <div className="text-center py-6">
              <div className="w-14 h-14 rounded-full grid place-items-center mx-auto mb-4" style={{ backgroundColor: accent, color: accentOn }}>
                <Check size={26} />
              </div>
              <h1 className="text-xl font-bold text-[#2d2520]">{step?.headline || "Thanks!"}</h1>
              {step?.subhead && <p className="text-sm text-[#2d2520]/70 mt-2">{step.subhead}</p>}
              {c.phone && (
                <p className="text-sm text-[#2d2520]/60 mt-4">
                  Need it sooner? <a href={`tel:${c.phone}`} className="underline font-medium">{c.phone}</a>
                </p>
              )}
            </div>
          ) : step?.kind === "intro" ? (
            <div className="text-center">
              {step.image && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={step.image} alt="" className="w-full h-40 object-cover rounded-xl mb-4" />
              )}
              <h1 className="text-2xl font-bold text-[#2d2520]">{step.headline}</h1>
              {step.subhead && <p className="text-sm text-[#2d2520]/70 mt-2">{step.subhead}</p>}
              <button
                onClick={() => goNext()}
                className="w-full mt-6 py-3.5 rounded-full text-sm font-bold"
                style={{ backgroundColor: accent, color: accentOn }}
              >
                {step.buttonText || "Get started"}
              </button>
            </div>
          ) : step?.kind === "question_single" ? (
            <div>
              <h2 className="text-lg font-bold text-[#2d2520]">{step.question}</h2>
              {step.help && <p className="text-sm text-[#2d2520]/60 mt-1">{step.help}</p>}
              <div className="mt-4 space-y-2">
                {(step.answers || []).map((a) => (
                  <button
                    key={a.id}
                    onClick={() => pickSingle(step, a.value)}
                    className="w-full text-left rounded-xl border px-4 py-3 text-sm font-medium text-[#2d2520] transition-colors"
                    style={
                      answers[step.id] === a.value
                        ? { borderColor: accent, backgroundColor: `${accent}12` }
                        : { borderColor: "rgba(0,0,0,0.12)" }
                    }
                  >
                    {a.label}
                  </button>
                ))}
              </div>
            </div>
          ) : step?.kind === "question_multi" ? (
            <div>
              <h2 className="text-lg font-bold text-[#2d2520]">{step.question}</h2>
              {step.help && <p className="text-sm text-[#2d2520]/60 mt-1">{step.help}</p>}
              <div className="mt-4 space-y-2">
                {(step.answers || []).map((a) => {
                  const on = Array.isArray(answers[step.id]) && answers[step.id].includes(a.value);
                  return (
                    <button
                      key={a.id}
                      onClick={() => toggleMulti(step, a.value)}
                      className="w-full text-left rounded-xl border px-4 py-3 text-sm font-medium text-[#2d2520] flex items-center justify-between"
                      style={on ? { borderColor: accent, backgroundColor: `${accent}12` } : { borderColor: "rgba(0,0,0,0.12)" }}
                    >
                      {a.label}
                      {on && <Check size={15} style={{ color: accent }} />}
                    </button>
                  );
                })}
              </div>
              <button
                onClick={() => goNext()}
                className="w-full mt-5 py-3.5 rounded-full text-sm font-bold"
                style={{ backgroundColor: accent, color: accentOn }}
              >
                {step.buttonText || "Continue"}
              </button>
            </div>
          ) : step?.kind === "photo_upload" ? (
            <div>
              <h2 className="text-lg font-bold text-[#2d2520]">{step.headline}</h2>
              {step.subhead && <p className="text-sm text-[#2d2520]/60 mt-1">{step.subhead}</p>}
              <div className="mt-4">
                <MediaUploader uploadUrl={`/api/self-quote/${companySlug}/upload`} value={media} onChange={setMedia} />
              </div>
              <button
                onClick={() => goNext()}
                className="w-full mt-5 py-3.5 rounded-full text-sm font-bold"
                style={{ backgroundColor: accent, color: accentOn }}
              >
                {step.buttonText || "Continue"}
              </button>
            </div>
          ) : step?.kind === "instant_estimate" ? (
            <EstimateStep
              step={step}
              result={estimates[step.id]}
              chosen={answers[step.id]}
              busy={estimating === step.id}
              error={error}
              accent={accent}
              accentOn={accentOn}
              currency={c.currency}
              companyName={c.name}
              onPick={(bandId) => pickBand(step, bandId)}
              onContinue={() => (submitted ? goEnd() : goNext())}
            />
          ) : isForm ? (
            <div>
              <h2 className="text-lg font-bold text-[#2d2520]">{step.headline || "Where should we send it?"}</h2>
              {step.subhead && <p className="text-sm text-[#2d2520]/60 mt-1">{step.subhead}</p>}
              <div className="mt-4 space-y-3">
                {(step.fields || ["name", "email", "phone"]).includes("name") && (
                  <input value={contact.name} onChange={(e) => setContact((p) => ({ ...p, name: e.target.value }))}
                    placeholder="Your name" className="w-full border border-black/15 rounded-lg px-3 py-2.5 text-sm" />
                )}
                {(step.fields || ["name", "email", "phone"]).includes("email") && (
                  <input type="email" value={contact.email} onChange={(e) => setContact((p) => ({ ...p, email: e.target.value }))}
                    placeholder="Email" className="w-full border border-black/15 rounded-lg px-3 py-2.5 text-sm" />
                )}
                {(step.fields || ["name", "email", "phone"]).includes("phone") && (
                  <input type="tel" value={contact.phone} onChange={(e) => setContact((p) => ({ ...p, phone: e.target.value }))}
                    placeholder="Phone" className="w-full border border-black/15 rounded-lg px-3 py-2.5 text-sm" />
                )}
              </div>
              {error && (
                <div className="mt-3 flex items-start gap-2 text-sm text-red-700">
                  <AlertCircle size={15} className="shrink-0 mt-0.5" />
                  {error}
                </div>
              )}
              <button
                onClick={submit}
                disabled={submitting}
                className="w-full mt-5 py-3.5 rounded-full text-sm font-bold inline-flex items-center justify-center gap-2 disabled:opacity-60"
                style={{ backgroundColor: accent, color: accentOn }}
              >
                {submitting && <Loader2 size={15} className="animate-spin" />}
                {step.buttonText || "Submit"}
              </button>
              {step.consent && <p className="text-[11px] text-[#2d2520]/50 mt-3 text-center">{step.consent}</p>}
            </div>
          ) : null}
        </div>
      </div>
    </Shell>
  );
}

/**
 * The instant-estimate step: pick a size, see a real number.
 *
 * Three states, and none of them is blank — a card that shows nothing mid-funnel
 * reads as a broken page to someone standing in a driveway:
 *
 *   collect   the size bands. Locked wording underneath if the company reveals
 *             the range only after the form, so the tap has a stated payoff.
 *   priced    the range (or one range per material), the "we'll confirm this"
 *             line, and Continue.
 *   gated     the company's own sentence about not showing prices, and Continue.
 *
 * Every figure here arrives from the server already rounded and already allowed.
 * There is no rate, no measurement and no arithmetic in this component, so
 * nothing a devtools console can dig out of it that the company didn't publish.
 */
function EstimateStep({
  step,
  result,
  chosen,
  busy,
  error,
  accent,
  accentOn,
  currency,
  companyName,
  onPick,
  onContinue,
}) {
  const priced = result && !result.gated && (result.options || []).length > 0;
  const options = priced ? result.options : [];
  // "Submit to reveal" wording, not "we don't publish prices" — the second is a
  // lie in this mode (the price IS shown, thirty seconds later) and a homeowner
  // told there's no number stops filling in the form. Shown both before the tap
  // and after it, because in this mode the tap doesn't produce a figure.
  const locked = !priced && step.estimateDisplay === "after_submit" && step.lockedMessage;
  const gatedText = !priced && !locked && (result?.message || step.gatedMessage);

  return (
    <div>
      <h2 className="text-lg font-bold text-[#2d2520]">{step.headline || "Your estimate"}</h2>
      {step.subhead && <p className="text-sm text-[#2d2520]/60 mt-1">{step.subhead}</p>}

      {/* Collect: the size bands. Gone once an answer has come back, so the
          number gets the whole card rather than sharing it with the question. */}
      {!result && (
        <>
          {step.sizeQuestion && (
            <p className="text-sm font-semibold text-[#2d2520] mt-4">{step.sizeQuestion}</p>
          )}
          <div className="mt-3 space-y-2">
            {(step.bands || []).map((b) => (
              <button
                key={b.id}
                onClick={() => onPick(b.id)}
                disabled={busy}
                className="w-full text-left rounded-xl border px-4 py-3 text-sm font-medium text-[#2d2520] disabled:opacity-60 flex items-center justify-between gap-2"
                style={
                  chosen === b.id
                    ? { borderColor: accent, backgroundColor: `${accent}12` }
                    : { borderColor: "rgba(0,0,0,0.12)" }
                }
              >
                {b.label}
                {busy && chosen === b.id && <Loader2 size={15} className="animate-spin shrink-0" />}
              </button>
            ))}
          </div>
        </>
      )}

      {/* Priced: one range, or one per material the company offers. */}
      {priced && (
        <div className="mt-4 space-y-2">
          {options.map((o, i) => (
            <div key={o.label || i} className="rounded-xl border border-black/10 px-4 py-4 text-center">
              {o.label && <div className="text-xs text-[#2d2520]/60 mb-1">{o.label}</div>}
              <div className="text-2xl font-bold" style={{ color: accent }}>
                {money(o.low, currency)} – {money(o.high, currency)}
              </div>
              {o.unit && <div className="text-xs text-[#2d2520]/60 mt-1">{o.unit}</div>}
              {/* Why a small job and a slightly bigger one can quote the same
                  figure. Says a minimum exists, never what it is — the floor is
                  a rate, and rates stay on the server. */}
              {o.minimumApplied && (
                <div className="text-[11px] text-[#2d2520]/60 mt-2 border-t border-black/10 pt-2">
                  This job comes in under our minimum charge, so the minimum applies.
                </div>
              )}
            </div>
          ))}
          <p className="text-[11px] text-[#2d2520]/50">
            This is an estimate from the details you gave us, not a final quote.{" "}
            {companyName} will confirm it before anything is binding.
          </p>
        </div>
      )}

      {/* Locked: the company reveals the range after the form. The stand-in is
          LITERAL X's, never the real figure under a blur — a blur is a filter,
          not a secret. The real low/high are not in this component's props at
          this stage; the estimate endpoint refuses to send them before the
          form (see its header). */}
      {locked && (
        <>
          <div className="relative rounded-xl border border-black/10 overflow-hidden mt-4">
            <div
              aria-hidden="true"
              className="text-center px-4 py-6 select-none pointer-events-none opacity-50 blur-[9px]"
            >
              <div className="text-3xl font-bold" style={{ color: accent }}>
                {step.lockedMessage.placeholder}
              </div>
            </div>
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 text-center px-4">
              <Lock size={18} style={{ color: accent }} />
              <div className="text-sm font-bold text-[#2d2520]">{step.lockedMessage.title}</div>
            </div>
          </div>
          <p className="text-xs text-[#2d2520]/60 mt-2">{step.lockedMessage.body}</p>
        </>
      )}

      {/* Gated: this company doesn't put a number on a public screen for this
          trade. Their sentence, not ours, and never an empty card. */}
      {gatedText && (
        <div className="mt-4 rounded-xl border border-black/10 px-4 py-4 text-sm text-[#2d2520]/70">
          {gatedText}
        </div>
      )}

      {error && (
        <div className="mt-3 flex items-start gap-2 text-sm text-red-700">
          <AlertCircle size={15} className="shrink-0 mt-0.5" />
          {error}
        </div>
      )}

      {/* Shown once they've answered — including when the estimate failed, so a
          bad moment on our side can never trap someone mid-funnel. */}
      {(result || error) && (
        <button
          onClick={onContinue}
          className="w-full mt-5 py-3.5 rounded-full text-sm font-bold"
          style={{ backgroundColor: accent, color: accentOn }}
        >
          {step.buttonText || "Continue"}
        </button>
      )}
    </div>
  );
}

function Shell({ accent = FALLBACK_ACCENT, children }) {
  // Full-bleed brand background — this is a standalone ad landing page, not an
  // embed. A subtle darker band at the bottom gives depth without a gradient lib.
  return (
    <div className="min-h-screen w-full flex items-center justify-center p-4" style={{ backgroundColor: accent }}>
      {children}
    </div>
  );
}
