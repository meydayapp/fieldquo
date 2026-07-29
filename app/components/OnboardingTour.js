// app/components/OnboardingTour.js
"use client";

import { useState, useEffect } from "react";
import { X, ArrowRight } from "lucide-react";

// steps: [{ target: "[data-tour='service-picker']", title, body }]
//
// `serverSeen` (optional): the tour was already dismissed by this user on some
// device, per the server. When true the tour won't auto-open even in a fresh
// browser that has no localStorage flag. onFinish is where the caller persists
// "seen" server-side.
export default function OnboardingTour({ steps, storageKey, serverSeen = false, onFinish }) {
  const [stepIndex, setStepIndex] = useState(0);
  const [active, setActive] = useState(false);
  const [rect, setRect] = useState(null);

  useEffect(() => {
    if (serverSeen) return;
    const seen = localStorage.getItem(`tour_seen_${storageKey}`);
    // Only auto-open once the target exists — a tour that fires before its
    // anchor renders would point at nothing and flash an empty spotlight.
    if (!seen && steps?.[0]?.target && document.querySelector(steps[0].target)) {
      setActive(true);
    }
  }, [storageKey, serverSeen, steps]);

  useEffect(() => {
    if (!active) return;
    const el = document.querySelector(steps[stepIndex]?.target);
    if (el) {
      el.scrollIntoView({ behavior: "smooth", block: "center" });
      setRect(el.getBoundingClientRect());
    }
  }, [active, stepIndex, steps]);

  function finish() {
    localStorage.setItem(`tour_seen_${storageKey}`, "true");
    setActive(false);
    onFinish?.();
  }

  if (!active || !steps[stepIndex]) return null;

  const step = steps[stepIndex];

  return (
    <div className="fixed inset-0 z-[100]">
      <div className="absolute inset-0 bg-black/50" />

      {rect && (
        <div
          className="absolute border-2 border-white rounded-lg pointer-events-none"
          style={{
            top: rect.top - 6,
            left: rect.left - 6,
            width: rect.width + 12,
            height: rect.height + 12,
            boxShadow: "0 0 0 9999px rgba(0,0,0,0.5)",
          }}
        />
      )}

      <div
        className="absolute bg-card rounded-xl p-4 w-72 shadow-xl"
        style={{
          top: rect
            ? Math.min(rect.bottom + 12, window.innerHeight - 180)
            : "50%",
          left: rect ? Math.min(rect.left, window.innerWidth - 300) : "50%",
        }}
      >
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs text-muted-foreground">
            {stepIndex + 1} of {steps.length}
          </span>
          <button onClick={finish}>
            <X size={14} className="text-muted-foreground" />
          </button>
        </div>
        <h4 className="font-semibold text-foreground text-sm">{step.title}</h4>
        <p className="text-sm text-muted-foreground mt-1">{step.body}</p>
        <button
          onClick={() =>
            stepIndex + 1 < steps.length ? setStepIndex((i) => i + 1) : finish()
          }
          className="w-full mt-3 bg-inverted text-inverted-foreground py-2 rounded-lg text-sm font-semibold flex items-center justify-center gap-1"
        >
          {stepIndex + 1 < steps.length ? "Next" : "Done"}{" "}
          <ArrowRight size={13} />
        </button>
      </div>
    </div>
  );
}
