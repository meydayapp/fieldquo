// app/components/PhoneVerifyPrompt.js
//
// What a card-free trial sees when it tries something that spends FieldQuo's
// money before verifying a mobile (lib/trial/phoneGate.js): why, and the one
// button that fixes it. Mounted once in app/app/layout.js beside
// PlanRequiredPrompt; opened by lib/trial/phoneRequired.js from
// lib/fetchJson.js and lib/clientErrors.js, so no screen wires it by hand.
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Smartphone, X } from "lucide-react";
import { PHONE_REQUIRED_EVENT } from "@/lib/trial/phoneRequired";
import { useTranslation } from "@/app/hooks/useTranslation";

export default function PhoneVerifyPrompt() {
  const { t } = useTranslation();
  const [prompt, setPrompt] = useState(null);

  useEffect(() => {
    function onRequired(e) {
      if (e.detail) setPrompt(e.detail);
    }
    window.addEventListener(PHONE_REQUIRED_EVENT, onRequired);
    return () => window.removeEventListener(PHONE_REQUIRED_EVENT, onRequired);
  }, []);

  if (!prompt) return null;
  const close = () => setPrompt(null);
  const feature = prompt.feature ? t(`app.phoneVerify.feature.${prompt.feature}`, "") : "";

  return (
    <div
      className="fixed inset-0 z-[110] flex items-end sm:items-center justify-center bg-black/40 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="fq-phone-required-title"
    >
      <div className="fq-dialog-card bg-card border border-border rounded-2xl shadow-xl w-full sm:max-w-md p-5">
        <div className="flex items-start gap-3">
          <span className="rounded-full bg-amber-100 dark:bg-amber-900/40 p-2 shrink-0">
            <Smartphone size={18} className="text-amber-700 dark:text-amber-300" />
          </span>
          <div className="flex-1 min-w-0">
            <h2 id="fq-phone-required-title" className="text-base font-semibold text-foreground">
              {t("app.phoneVerify.title", "Verify your mobile number")}
            </h2>
            {feature && <p className="mt-1 text-sm font-medium text-foreground">{feature}</p>}
            <p className="mt-1.5 text-sm text-muted-foreground">
              {t(
                "app.phoneVerify.why",
                "During your free trial, a few features cost FieldQuo real money every time they run. To keep them for real businesses, we ask for one mobile number first. We text you a code — it takes a minute. Choosing a plan unlocks them too.",
              )}
            </p>
          </div>
          <button onClick={close} className="text-muted-foreground hover:text-foreground shrink-0" aria-label={t("app.phoneVerify.notNow", "Not now")}>
            <X size={16} />
          </button>
        </div>
        <div className="mt-4 flex flex-col-reverse sm:flex-row sm:justify-end gap-2">
          <button onClick={close} className="px-3.5 py-2 rounded-lg text-sm border border-border text-foreground hover:bg-muted">
            {t("app.phoneVerify.notNow", "Not now")}
          </button>
          <Link
            href={prompt.path || "/app/settings/verify-phone"}
            onClick={close}
            className="px-3.5 py-2 rounded-lg text-sm font-medium bg-primary text-primary-foreground hover:opacity-90 text-center"
          >
            {t("app.phoneVerify.cta", "Verify my mobile")}
          </Link>
        </div>
      </div>
    </div>
  );
}
