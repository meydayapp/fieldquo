"use client";

// app/components/auth/WelcomeAside.js
//
// The right-hand panel beside /signup and every welcome question
// (2026-09-29): a picture of the product and one "Did you know…" line.
//
// The picture is FieldQuo's own marketing imagery — screenshots of screens
// that exist (public/marketing/hero-*.webp, the homepage hero's set), one per
// screen in turn. No stock photo, no competitor's imagery, no illustration of
// a feature that isn't there. The line comes from lib/signup/didYouKnow.js,
// the one list, where every entry says where its claim comes from and the
// arithmetic one computes its figure; scripts/check-welcome-flow.mjs holds
// that list to it. Nothing here writes a fact of its own.

import Image from "next/image";
import { Lightbulb } from "lucide-react";
import { useTranslation } from "@/app/hooks/useTranslation";
import { factForStep, factValues } from "@/lib/signup/didYouKnow";

/** The screenshots, in the order the screens show them. Files that exist. */
export const ASIDE_IMAGES = Object.freeze([
  "/marketing/hero-quotes.webp",
  "/marketing/hero-scheduling.webp",
  "/marketing/hero-invoicing.webp",
  "/marketing/hero-analytics.webp",
  "/marketing/ai-quote-review.webp",
]);

/** Every screen the panel is drawn beside, for the rotation. */
export const ASIDE_STEPS = Object.freeze(["account", "profile", "business", "size", "revenue", "priority", "focus", "source"]);

export default function WelcomeAside({ step = "account" }) {
  const { t } = useTranslation();
  const i = Math.max(0, ASIDE_STEPS.indexOf(step));
  const src = ASIDE_IMAGES[i % ASIDE_IMAGES.length];
  const fact = factForStep(step, ASIDE_STEPS);
  return (
    <aside className="space-y-5" data-welcome-aside>
      <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
        <Image
          src={src}
          alt={t("app.welcome.aside.imageAlt", "A FieldQuo screen")}
          width={1400}
          height={1050}
          className="h-auto w-full"
          priority={step === "account"}
        />
      </div>
      <div className="rounded-2xl border border-border bg-card p-5" data-fact={fact.key} data-fact-source={fact.source}>
        <p className="flex items-center gap-2 text-sm font-semibold text-foreground">
          <Lightbulb size={16} aria-hidden="true" />
          {t("app.welcome.aside.didYouKnow", "Did you know…")}
        </p>
        <p className="mt-2 text-sm text-muted-foreground">{t(fact.textKey, fact.text, factValues(fact))}</p>
      </div>
    </aside>
  );
}
