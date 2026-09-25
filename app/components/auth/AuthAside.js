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
//
// ══ The reactive signup panel (2026-09-24) ═════════════════════════════════
//
// With a `preview` prop the signup variant stops being a static panel and
// becomes the side screen the owner pointed at in Housecall Pro's and
// Jobber's signups: a headline per step ("Feature | one-line benefit"), a
// live picture drawn from what has been typed (SignupPreviews.js), and two
// or three benefit lines. The account step shows the client's email with
// their company name in the From line; an address adds the booking page
// with the tax line their province carries; the team step's chips change
// the calendar's shape; the trades step shows a sample quote whose two lines
// are the trade's own services; the services step shows the price book.
//
// Without `preview` — /login, and check:auth-pages' bare render — the panel
// is exactly what it was. Nothing static was replaced; the three rules above
// still hold for every sentence in the reactive panel, and the trial line
// and the counted trades line are drawn under it too.
"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { Check, ChevronDown, ChevronUp } from "lucide-react";
import { INDUSTRIES } from "@/app/data/industries";
import { trialLabel } from "@/lib/pricing";
import { useTranslation } from "@/app/hooks/useTranslation";
import {
  BookingPreview,
  CalendarPreview,
  EmailPreview,
  GoalPreview,
  PriceBookPreview,
  QuoteSamplePreview,
} from "@/app/components/auth/SignupPreviews";
import { taxPreviewFor } from "@/lib/signup/signupPreview";

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

/**
 * What the reactive panel says and shows on each step. Keys and English
 * fallbacks like PANELS above; the picture is a SignupPreviews component fed
 * the form. Pure apart from t(), so the check renders every branch.
 *
 * @param preview  { step, form, language, teamSizeBand, signupGoal,
 *                   sampleServices, fallbackLines, groupLabel, currency,
 *                   serviceLabels }
 */
export function signupPanelFor(preview, t) {
  const { step, form, language = "en" } = preview || {};
  const point = (key, fallback) => ({ key, fallback });
  switch (step) {
    case "team":
      return {
        feature: t("app.signup.aside.team.headline", "Multi-view scheduling"),
        benefit: t("app.signup.aside.team.benefit", "A calendar that fits a crew of one or twenty — day, week or dispatch board."),
        points: [
          point("app.signup.aside.team.point1", "Every visit, shift and job on one calendar, per person."),
          point("app.signup.aside.team.point2", "Hours clock in from the field and land on the pay run."),
          point("app.signup.aside.team.point3", "Breaks, time off and who is on site, at a glance."),
        ],
        picture: <CalendarPreview form={form} band={preview.teamSizeBand || null} />,
      };
    case "goals": {
      const goal = preview.signupGoal || null;
      const copy = {
        look_professional: [
          "Quotes clients say yes to",
          "A branded, itemised quote with photos and a clear next step.",
          point("app.signup.aside.goals.look.point1", "Your logo, your colour, your story and your reviews beside the price."),
          point("app.signup.aside.goals.look.point2", "Approve, sign and pay from the same link."),
        ],
        feel_in_control: [
          "Know where the money is",
          "Quotes out, jobs booked, invoices paid — one screen, every morning.",
          point("app.signup.aside.goals.control.point1", "Job costing against the quote, so you know what each one made."),
          point("app.signup.aside.goals.control.point2", "Overdue invoices chased for you, with a record of every nudge."),
        ],
        win_more_jobs: [
          "Never miss a lead",
          "Every call, text and web enquiry lands in one inbox and gets an answer.",
          point("app.signup.aside.goals.win.point1", "A booking link and an instant estimate on your website."),
          point("app.signup.aside.goals.win.point2", "Follow-ups on quotes that have gone quiet, in your name."),
        ],
      }[goal] || [
        "Lead to paid, in one place",
        "Win the job, do the job, get paid — without leaving the app.",
        point("app.signup.aside.goals.default.point1", "Quote, schedule, invoice and take payment under your own name."),
        point("app.signup.aside.goals.default.point2", "Start with what you need today; the rest is there when you do."),
      ];
      const headlineKey = { look_professional: "look", feel_in_control: "control", win_more_jobs: "win" }[goal] || "default";
      return {
        feature: t(`app.signup.aside.goals.${headlineKey}.headline`, copy[0]),
        benefit: t(`app.signup.aside.goals.${headlineKey}.benefit`, copy[1]),
        points: [copy[2], copy[3]],
        picture: <GoalPreview goal={goal} quoteProps={quotePropsOf(preview)} />,
      };
    }
    case "industry":
      return {
        feature: t("app.signup.aside.industry.headline", "Industry-specific quotes"),
        benefit: t("app.signup.aside.industry.benefit", "Start from your trade's own services, then send a quote that reads like a proposal, not a receipt."),
        points: [
          point("app.signup.aside.industry.point1", "Line items with plain-language scope, so nothing is argued about later."),
          point("app.signup.aside.industry.point2", "Photos, your story and your reviews beside the price."),
          point("app.signup.aside.industry.point3", "The same quote comes off your website as an instant estimate."),
        ],
        picture: <QuoteSamplePreview {...quotePropsOf(preview)} />,
      };
    case "services":
      return {
        feature: t("app.signup.aside.services.headline", "Your price book"),
        benefit: t("app.signup.aside.services.benefit", "Templates for the work you do, priced once and reused on every quote."),
        points: [
          point("app.signup.aside.services.point1", "Each service becomes a template with its own line items."),
          point("app.signup.aside.services.point2", "You see cost and margin while you quote, not after."),
          point("app.signup.aside.services.point3", "Add-ons your client can tick on the quote page."),
        ],
        picture: <PriceBookPreview labels={preview.serviceLabels || []} />,
      };
    default: {
      // account / business: the email, and the booking page once the
      // address resolves to somewhere the tax table knows.
      const tax = taxPreviewFor({ country: form?.country, province: form?.province }, language);
      return {
        feature: t("app.signup.aside.account.headline", "Your name on everything"),
        benefit: t("app.signup.aside.account.benefit", "Every quote, invoice and email looks like it came from you, not from us."),
        points: [
          point("app.signup.aside.account.point1", "Your logo, your brand colour and your name in the From line."),
          point("app.signup.aside.account.point2", "One link to view, approve and pay — on a phone, in a driveway."),
          point("app.signup.aside.account.point3", "Online booking into the same calendar, with the right tax for where you are."),
        ],
        picture: (
          <div className="space-y-3">
            <EmailPreview form={form} language={language} />
            {tax ? <BookingPreview form={form} language={language} /> : null}
          </div>
        ),
      };
    }
  }
}

function quotePropsOf(preview) {
  return {
    form: preview?.form,
    language: preview?.language || "en",
    services: preview?.sampleServices || [],
    fallbackLines: preview?.fallbackLines || [],
    groupLabel: preview?.groupLabel || "",
    currency: preview?.currency || "",
  };
}

/** The reactive signup panel — see the header. */
function ReactiveSignupAside({ preview }) {
  const { t } = useTranslation();
  const panel = signupPanelFor(preview, t);
  return (
    <div data-signup-aside={preview.step}>
      <div className="rounded-2xl border border-border bg-card shadow-sm overflow-hidden">
        <div className="border-b border-border bg-muted/40 p-4 sm:p-5">{panel.picture}</div>
        <div className="p-6 sm:p-8">
          <p className="text-xs font-semibold uppercase tracking-wider text-brand-accent-text">{panel.feature}</p>
          <h2 className="mt-1 text-lg font-semibold text-foreground">{panel.benefit}</h2>
          <ul className="mt-4 space-y-3">
            {panel.points.map((point) => (
              <li key={point.key} className="flex gap-3">
                <Check size={18} className="mt-0.5 shrink-0 text-primary" aria-hidden="true" />
                <span className="text-sm text-foreground leading-relaxed">{t(point.key, point.fallback)}</span>
              </li>
            ))}
          </ul>
          <p className="mt-6 border-t border-border pt-4 text-xs text-muted-foreground leading-relaxed">
            {t(
              "auth.aside.signup.billing",
              "{trial}. No card and no plan today \u2014 you pick a plan from inside the app before the free month is up, and nothing is charged until you do.",
              { trial: trialLabel() },
            )}
          </p>
        </div>
      </div>
      <p className="mt-4 text-xs text-muted-foreground">
        {t("auth.aside.trades", "Built for {count} trades, from painting to roofing.", {
          count: INDUSTRIES.length,
        })}
      </p>
    </div>
  );
}

/**
 * The phone's version: a strip above the form — the feature and its benefit
 * in one line, and a button that opens the full panel in place. Never hidden
 * and never a sideways scroll; never in the way of the email field either,
 * which is the reason AuthShell puts the full panel AFTER the form on a
 * phone and this strip is a single line until it is asked to grow.
 */
export function SignupAsideStrip({ preview }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const panel = signupPanelFor(preview, t);
  return (
    <div className="rounded-xl border border-border bg-card shadow-sm" data-signup-aside-strip={preview.step}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center gap-3 px-4 py-3 text-left"
      >
        <span className="min-w-0 flex-1">
          <span className="block text-[11px] font-semibold uppercase tracking-wider text-brand-accent-text">{panel.feature}</span>
          <span className="block truncate text-sm text-foreground">{panel.benefit}</span>
        </span>
        <span className="inline-flex shrink-0 items-center gap-1 text-xs font-semibold text-foreground">
          {open ? t("app.signup.aside.strip.hide", "Hide preview") : t("app.signup.aside.strip.show", "Show preview")}
          {open ? <ChevronUp size={14} aria-hidden="true" /> : <ChevronDown size={14} aria-hidden="true" />}
        </span>
      </button>
      {open ? <div className="border-t border-border p-3">{panel.picture}</div> : null}
    </div>
  );
}

export default function AuthAside({ variant = "login", preview = null }) {
  const { t } = useTranslation();
  const panel = PANELS[variant] || PANELS.login;

  if (variant === "signup" && preview) return <ReactiveSignupAside preview={preview} />;

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
            // Said here, on the panel beside the form. Since 2026-09-24 the
            // sentence is that there IS no card step — signup ends at
            // Services and the plan is chosen from the app's trial banner
            // (the owner's decision) — so the panel must not promise a
            // checkout the form no longer opens. trialLabel() supplies the
            // offer so this cannot drift from TRIAL_PRICE the way three other
            // screens had already drifted to "$1".
            <p className="mt-6 border-t border-border pt-4 text-xs text-muted-foreground leading-relaxed">
              {t(
                "auth.aside.signup.billing",
                "{trial}. No card and no plan today \u2014 you pick a plan from inside the app before the free month is up, and nothing is charged until you do.",
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
