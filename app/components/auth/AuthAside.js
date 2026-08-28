// app/components/auth/AuthAside.js
//
// The second column of /login and /signup: what the product actually is,
// beside the form that asks you to trust it with a password or a card.
//
// ══ Everything here has to be true ═════════════════════════════════════════
//
// This is a marketing panel on a page somebody is about to enter payment
// details on, which makes it the worst possible place to overstate. Three rules
// it follows, and scripts/check-auth-pages.mjs enforces all three:
//
//   1. No mobile app, no QuickBooks, no Zapier. None of the three exist, and
//      they are the three things a field-service product is assumed to have.
//   2. No "no credit card required". Signup opens a Stripe subscription with a
//      trial and no `payment_method_collection: "if_required"`, so a card IS
//      taken — twelve marketing pages were corrected for saying otherwise
//      earlier today and this page is not going to be the thirteenth. The
//      signup panel states the opposite explicitly, off trialLabel() rather
//      than a typed number.
//   3. The trades line is COUNTED from app/data/industries.js, not written. It
//      is the one number here that cannot go stale.
//
// The screenshot is /marketing/hero-quotes.webp — the same image the homepage
// hero opens on, of a screen that exists. A stock photo standing in for a
// feature is a claim; the note in app/components/marketing/Hero.js makes the
// same argument about the tabs that deliberately have no picture.
"use client";

import Image from "next/image";
import Link from "next/link";
import { Check } from "lucide-react";
import { INDUSTRIES } from "@/app/data/industries";
import { trialLabel } from "@/lib/pricing";
import { useTranslation } from "@/app/hooks/useTranslation";

// Keys and English fallbacks, not finished sentences, so the copy can be
// translated later without this file changing shape — the same arrangement
// app/components/marketing/Hero.js uses for its tabs.
//
// Every line below describes the pipeline AGENTS.md opens with: lead → quote →
// job → invoice → payment, under the contractor's own branding.
const PANELS = {
  login: {
    heading: { key: "auth.aside.login.heading", fallback: "Everything your day runs on" },
    points: [
      {
        key: "auth.aside.login.point1",
        fallback: "Build the quote on site and send it before you leave the driveway.",
      },
      {
        key: "auth.aside.login.point2",
        fallback:
          "Book the visit, track the hours and materials, and invoice from what the job actually took.",
      },
      {
        key: "auth.aside.login.point3",
        fallback:
          "Take payment online — with your logo on the invoice and your name in the From line.",
      },
    ],
  },
  signup: {
    heading: { key: "auth.aside.signup.heading", fallback: "What you're setting up" },
    points: [
      {
        key: "auth.aside.signup.point1",
        fallback:
          "Quotes and invoices in your logo and your brand colour. Nothing your client sees mentions us.",
      },
      {
        key: "auth.aside.signup.point2",
        fallback:
          "Jobs, visits, hours and materials costed against the quote, so you know what each one made.",
      },
      {
        key: "auth.aside.signup.point3",
        fallback:
          "A booking page, a website and online payment, all pointing at the same calendar.",
      },
    ],
  },
};

export default function AuthAside({ variant = "login" }) {
  const { t } = useTranslation();
  const panel = PANELS[variant] || PANELS.login;

  return (
    <div>
      <div className="rounded-2xl border border-border bg-card shadow-sm overflow-hidden">
        {/* Intrinsic size, matching Hero's note: declaring the wrong aspect
            makes the browser reserve a box the wrong shape, which is the layout
            shift width/height exist to prevent. No `priority` — this column is
            beside the form on desktop and below it on a phone, so it must never
            compete with the form for the first bytes. */}
        <Image
          src="/marketing/hero-quotes.webp"
          alt={t(
            "hero.tabs.quotes.alt",
            "A FieldQuo quote on screen, itemised and branded to the contractor.",
          )}
          width={1400}
          height={1050}
          sizes="(min-width: 1024px) 34rem, 100vw"
          // Cropped to 16:10 rather than shown at its native 4:3. At full
          // height the panel stood roughly twice as tall as the login form
          // beside it, which reads as two unrelated pages sharing a screen.
          // object-cover on a photograph loses margin, not information.
          className="w-full aspect-[16/10] object-cover border-b border-border"
        />

        <div className="p-6 sm:p-8">
          <h2 className="text-lg font-semibold text-foreground">
            {t(panel.heading.key, panel.heading.fallback)}
          </h2>

          <ul className="mt-5 space-y-4">
            {panel.points.map((point) => (
              <li key={point.key} className="flex gap-3">
                {/* --primary, not the green tick the pricing cards use. That
                    green is one value picked against a white card; this panel
                    is --card in light AND dark, where navy lifts to #4a8fd8 and
                    stays over 4.5:1 on both. Measured in
                    scripts/check-auth-pages.mjs. */}
                <Check
                  size={18}
                  className="mt-0.5 shrink-0 text-primary"
                  aria-hidden="true"
                />
                <span className="text-sm text-foreground leading-relaxed">
                  {t(point.key, point.fallback)}
                </span>
              </li>
            ))}
          </ul>

          {variant === "signup" ? (
            // ── The card sentence ────────────────────────────────────────
            // Said here, on the panel beside the form, rather than left for
            // the Stripe page to spring on them. trialLabel() supplies the
            // offer so this cannot drift from TRIAL_PRICE the way three other
            // screens had already drifted to "$1".
            <p className="mt-6 border-t border-border pt-4 text-xs text-muted-foreground leading-relaxed">
              {t(
                "auth.aside.signup.billing",
                "{trial}. We take your card at checkout and the first charge lands when the free month ends. You choose the plan on the last step — the price depends on where your business is.",
                { trial: trialLabel() },
              )}
            </p>
          ) : (
            <p className="mt-6 border-t border-border pt-4 text-xs text-muted-foreground leading-relaxed">
              {t(
                "auth.aside.login.newHere",
                "New here? Starting a business takes a few minutes and the first month is free.",
              )}{" "}
              <Link href="/signup" className="font-medium text-foreground underline">
                {t("auth.aside.login.newHereCta", "Start your free month")}
              </Link>
            </p>
          )}
        </div>
      </div>

      {/* Counted, never typed. Adding a trade to app/data/industries.js moves
          this number without anybody remembering to come back here. */}
      <p className="mt-4 text-xs text-muted-foreground">
        {t("auth.aside.trades", "Built for {count} trades, from painting to roofing.", {
          count: INDUSTRIES.length,
        })}
      </p>
    </div>
  );
}
