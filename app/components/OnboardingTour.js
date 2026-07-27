// app/components/OnboardingTour.js
"use client";

import { useState, useEffect } from "react";
import { X, ArrowRight } from "lucide-react";

// steps: [{ target: "[data-tour='service-picker']", title, body }]
export default function OnboardingTour({ steps, storageKey, onFinish }) {
  const [stepIndex, setStepIndex] = useState(0);
  const [active, setActive] = useState(false);
  const [rect, setRect] = useState(null);

  useEffect(() => {
    const seen = localStorage.getItem(`tour_seen_${storageKey}`);
    if (!seen) setActive(true);
  }, [storageKey]);

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
        className="absolute bg-white rounded-xl p-4 w-72 shadow-xl"
        style={{
          top: rect
            ? Math.min(rect.bottom + 12, window.innerHeight - 180)
            : "50%",
          left: rect ? Math.min(rect.left, window.innerWidth - 300) : "50%",
        }}
      >
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs text-gray-400">
            {stepIndex + 1} of {steps.length}
          </span>
          <button onClick={finish}>
            <X size={14} className="text-gray-400" />
          </button>
        </div>
        <h4 className="font-semibold text-gray-900 text-sm">{step.title}</h4>
        <p className="text-sm text-gray-600 mt-1">{step.body}</p>
        <button
          onClick={() =>
            stepIndex + 1 < steps.length ? setStepIndex((i) => i + 1) : finish()
          }
          className="w-full mt-3 bg-gray-900 text-white py-2 rounded-lg text-sm font-semibold flex items-center justify-center gap-1"
        >
          {stepIndex + 1 < steps.length ? "Next" : "Done"}{" "}
          <ArrowRight size={13} />
        </button>
      </div>
    </div>
  );
}
