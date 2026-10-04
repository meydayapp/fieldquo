"use client";

// app/components/billing/TrialPhoneCard.js
//
// On Account & Billing, BEFORE anyone hits the wall: a card-free trial that
// still has to verify a mobile is told so, with the link, here where it is
// already looking at its trial. Renders nothing for everyone else — a paying
// company, a verified trial, or one FieldQuo can't text yet
// (GET /api/settings/phone-verification `required`).
import { useEffect, useState } from "react";
import Link from "next/link";
import { Smartphone } from "lucide-react";
import { fetchJson } from "@/lib/fetchJson";
import { useTranslation } from "@/app/hooks/useTranslation";

export default function TrialPhoneCard() {
  const { t } = useTranslation();
  const [required, setRequired] = useState(false);

  useEffect(() => {
    fetchJson("/api/settings/phone-verification")
      .then((d) => setRequired(d?.required === true))
      // Silent on purpose: the card is a heads-up, and the gate itself still
      // explains itself at the moment it refuses (PhoneVerifyPrompt).
      .catch(() => setRequired(false));
  }, []);

  if (!required) return null;
  return (
    <div className="bg-card border border-amber-300 dark:border-amber-800 rounded-xl p-5 flex items-start gap-3" data-trial-phone-card>
      <Smartphone size={18} className="text-amber-700 dark:text-amber-300 shrink-0 mt-0.5" aria-hidden="true" />
      <div className="text-sm">
        <p className="font-semibold text-foreground">{t("app.phoneVerify.title", "Verify your mobile number")}</p>
        <p className="text-muted-foreground mt-1">
          {t("app.phoneVerify.cardBody", "Texting, phone numbers, AI calls, video posts and email campaigns need one verified mobile during your free trial.")}
        </p>
        <Link href="/app/settings/verify-phone" className="inline-block mt-2 font-medium text-foreground underline">
          {t("app.phoneVerify.cta", "Verify my mobile")}
        </Link>
      </div>
    </div>
  );
}
