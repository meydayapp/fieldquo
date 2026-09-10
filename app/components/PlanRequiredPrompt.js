// app/components/PlanRequiredPrompt.js
//
// What a company that never finished checkout sees when it tries to send.
//
// The route refuses (lib/signup/planGate.js) and this is the "maybe prompting
// them to complete it" half the owner asked for: the reason, and the button
// that fixes it. A refusal that only toasts "no plan" is a wall — the person
// reading it has no idea that /signup will resume their own checkout rather
// than start a second company.
//
// Mounted once in app/app/layout.js, beside ErrorToast and for the same reason
// (see lib/clientErrors.js): every screen that can send something gets the
// prompt without wiring its own.
//
// The sentence comes from the server rather than being written here, so the
// refusal a script sees and the refusal a person reads are the same sentence,
// and an invited estimator — who has no way to pay and must NOT be sent to
// /signup — gets "ask the owner" with no button at all.
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { CreditCard, X } from "lucide-react";
import { PLAN_REQUIRED_EVENT } from "@/lib/signup/planRequired";

export default function PlanRequiredPrompt() {
  const [prompt, setPrompt] = useState(null);

  useEffect(() => {
    function onPlanRequired(e) {
      if (!e.detail) return;
      setPrompt(e.detail);
    }
    window.addEventListener(PLAN_REQUIRED_EVENT, onPlanRequired);
    return () => window.removeEventListener(PLAN_REQUIRED_EVENT, onPlanRequired);
  }, []);

  if (!prompt) return null;

  const close = () => setPrompt(null);

  return (
    <div
      className="fixed inset-0 z-[110] flex items-end sm:items-center justify-center bg-black/40 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="fq-plan-required-title"
    >
      <div className="bg-card border border-border rounded-2xl shadow-xl w-full sm:max-w-md p-5">
        <div className="flex items-start gap-3">
          <span className="rounded-full bg-amber-100 dark:bg-amber-900/40 p-2 shrink-0">
            <CreditCard size={18} className="text-amber-700 dark:text-amber-300" />
          </span>
          <div className="flex-1 min-w-0">
            <h2
              id="fq-plan-required-title"
              className="text-base font-semibold text-foreground"
            >
              Finish choosing your plan
            </h2>
            <p className="mt-1.5 text-sm text-muted-foreground">
              {prompt.message ||
                "Your company hasn't finished signing up, so nothing can go out to a client under your name yet."}
            </p>
          </div>
          <button
            onClick={close}
            className="text-muted-foreground hover:text-foreground shrink-0"
            aria-label="Dismiss"
          >
            <X size={16} />
          </button>
        </div>

        <div className="mt-4 flex flex-col-reverse sm:flex-row sm:justify-end gap-2">
          <button
            onClick={close}
            className="px-3.5 py-2 rounded-lg text-sm border border-border text-foreground hover:bg-muted"
          >
            Not now
          </button>
          {/* Only when the server said this person may actually pay. A button
              here for an invited estimator would 403 at the checkout route and,
              worse, /signup would offer them a business of their own beside the
              one they were invited to — the failure lib/signup/setupGate.js
              splits `redirect` from `setup_incomplete` to avoid. */}
          {prompt.canFinish && prompt.path ? (
            <Link
              href={prompt.path}
              onClick={close}
              className="px-3.5 py-2 rounded-lg text-sm font-medium bg-primary text-primary-foreground hover:opacity-90 text-center"
            >
              Choose a plan
            </Link>
          ) : null}
        </div>
      </div>
    </div>
  );
}
