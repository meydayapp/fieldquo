"use client";

// app/components/auth/WelcomeAside.js
//
// The right-hand panel beside /signup and every welcome question
// (2026-09-29): a picture of the product with one "Did you know…" fact laid
// over it.
//
// The picture is FieldQuo's own marketing imagery — screenshots of screens
// that exist (public/marketing/*.webp, the homepage hero's set), one per
// screen in turn. No stock photo, no competitor's imagery. The fact comes from
// lib/signup/didYouKnow.js, the one list, where every entry says where its
// claim comes from and the arithmetic one computes its figure;
// scripts/check-welcome-flow.mjs holds that list to it.
//
// ══ The overlay (the owner's review, 2026-09-29) ═══════════════════════════
//
// The first version put the fact in a separate white card under the photo —
// one short line in a large empty box, which the owner read as unfinished.
// Now the fact is a panel ON the photo, the key figure large ("$6,500 a
// year", "Every feature, on every plan."), the sentence under it. The panel is
// SOLID --inverted with --inverted-foreground text — never text on the image
// itself, whose pixels nobody measured — the pair check:auth-pages measures at
// 4.5:1 or better in both themes (it is the primary button's). No opacity on
// the text: a faded line is a contrast ratio nobody computed.
//
// On a phone the form comes first (AuthShell puts the aside after it in the
// DOM); there the photo is dropped and only the fact panel remains, so the
// page does not end in a tall screenshot under the button.

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
  const values = factValues(fact);
  const sentence = t(fact.textKey, fact.text, values);
  // A short fact is its own headline; a longer one leads with its figure.
  const headline = fact.headlineKey ? t(fact.headlineKey, fact.headline, values) : sentence;
  return (
    <aside data-welcome-aside>
      <div className="relative lg:overflow-hidden lg:rounded-2xl lg:border lg:border-border lg:bg-card lg:shadow-sm">
        <Image
          src={src}
          alt={t("app.welcome.aside.imageAlt", "A FieldQuo screen")}
          width={1400}
          height={1050}
          className="hidden lg:block h-auto w-full"
          priority={step === "account"}
        />
        <div
          className="rounded-2xl bg-inverted text-inverted-foreground p-5 shadow-lg lg:absolute lg:bottom-4 lg:left-4 lg:right-4 lg:rounded-xl lg:p-6"
          data-fact={fact.key}
          data-fact-source={fact.source}
          data-fact-panel
        >
          <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider">
            <Lightbulb size={14} aria-hidden="true" />
            {t("app.welcome.aside.didYouKnow", "Did you know…")}
          </p>
          <p className="mt-2 text-2xl lg:text-3xl font-bold leading-tight tracking-tight">{headline}</p>
          {fact.headlineKey ? <p className="mt-2 text-sm leading-relaxed">{sentence}</p> : null}
        </div>
      </div>
    </aside>
  );
}
