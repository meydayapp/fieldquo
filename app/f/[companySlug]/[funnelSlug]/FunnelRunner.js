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
import { Loader2, Check, ArrowLeft, Building2, AlertCircle } from "lucide-react";
import { readableForeground } from "@/lib/brand/colour";
import MediaUploader from "@/app/components/MediaUploader";

const FALLBACK_ACCENT = "#06356b";

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
  }, [step?.id, beacon]);

  const accent = data?.company?.brandColor || FALLBACK_ACCENT;
  const accentOn = useMemo(() => readableForeground(accent), [accent]);

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
      // Advance to the thank-you step if there is one, else show the done state.
      const tyIdx = steps.findIndex((s) => s.kind === "thankyou");
      if (tyIdx >= 0) setIdx(tyIdx);
      else setDone(true);
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
            <div className="h-8 w-8 rounded-lg grid place-items-center" style={{ backgroundColor: "#fff", color: accent }}>
              <Building2 size={16} />
            </div>
          )}
          <span className="font-semibold" style={{ color: accentOn }}>{c.name}</span>
        </div>

        {idx > 0 && !done && step?.kind !== "thankyou" && (
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

function Shell({ accent = FALLBACK_ACCENT, children }) {
  // Full-bleed brand background — this is a standalone ad landing page, not an
  // embed. A subtle darker band at the bottom gives depth without a gradient lib.
  return (
    <div className="min-h-screen w-full flex items-center justify-center p-4" style={{ backgroundColor: accent }}>
      {children}
    </div>
  );
}
