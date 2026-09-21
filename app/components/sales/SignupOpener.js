// app/components/sales/SignupOpener.js
//
// The opener on the call screen for a lead the signup form produced — drawn
// ABOVE the script, because the script's own opener says "you've never heard
// of me" and this person typed their number into FieldQuo this morning. The
// sentences come from lib/sales/playbook/signupOpener.js in the script's
// language (EN / FR / ES); the heading and the badge are the rep's own
// language (nine keys). Same shape and same argument as TurnaroundQuestion.
"use client";

import { PhoneCall } from "lucide-react";
import { useTranslation } from "@/app/hooks/useTranslation";
import { signupOpenerFor } from "@/lib/sales/playbook/signupOpener";
import SignupBadge, { signupFactText } from "@/app/components/sales/SignupBadge";

/**
 * @param signup   the queue route's `signup` block: { kind, badge, stateReason, fact, ... }
 *                 plus `firstName`, `businessName`, `at` as the playbook route sends them
 * @param repName  the rep on the call
 * @param language the script's language
 */
export default function SignupOpener({ signup, repName, language = "en", compact = false }) {
  const { t } = useTranslation();
  if (!signup?.kind) return null;
  const opener = signupOpenerFor({
    kind: signup.kind,
    language,
    first: signup.firstName || null,
    business: signup.businessName || "",
    rep: repName || "",
    step: signup.stepLabel || "",
    at: signup.at || null,
    stalledReason: signup.stateReason || null,
  });
  if (!opener) return null;
  return (
    <div
      className={compact ? "rounded-lg border border-border bg-muted p-3 space-y-1" : "rounded-lg border border-border bg-muted p-3 space-y-1.5"}
      data-testid="signup-opener"
      data-kind={signup.kind}
      data-language={opener.language}
    >
      <p className="text-xs font-bold uppercase tracking-[0.14em] text-foreground flex items-center gap-1.5 flex-wrap">
        <PhoneCall size={13} aria-hidden="true" /> {t("app.signupLead.opener.heading")}
        <SignupBadge kind={signup.badge || signup.kind} compact />
      </p>
      {signup.fact ? (
        <p className="text-xs text-muted-foreground break-words">{signupFactText(signup.fact, t)}</p>
      ) : null}
      <p className="text-sm text-foreground break-words">“{opener.say}”</p>
      <p className="text-sm text-foreground break-words">“{opener.ask}”</p>
      {opener.fallback ? <p className="text-xs text-muted-foreground">{t("app.signupLead.opener.englishFallback")}</p> : null}
    </div>
  );
}
