"use client";

// app/components/mobile/AppBar.js
//
// A focused mobile page header — back chevron, title, one optional action —
// for the detail-style screens a contractor actually opens on a phone (a
// quote, a job, an invoice), as opposed to AdminSidebar's own `lg:hidden`
// mobile bar, which is the hamburger + logo that opens the whole nav. The two
// are not meant to stack by default: AppBar REPLACES that bar on a page that
// wants "< Quote #204" instead of a hamburger, the same way a native app
// swaps its top bar per screen. A page that keeps AdminSidebar's bar AND adds
// this one should offset it (`top-14` via `className`, matching how
// SettingsSidebar's own mobile bar sticks at `top-14` below AdminSidebar's —
// see the comment on AdminSidebar's mobile bar for why that height is
// load-bearing) rather than let the two overlap.
//
// `lg:hidden` — above that breakpoint the page's own heading does this job;
// a second title bar on a desktop screen is decoration bolted onto a page
// that already has one.
//
// ── The translucent-blur treatment, copied from AdminSidebar ───────────────
//
// `bg-x/80 supports-[backdrop-filter]:bg-x/65 backdrop-blur-xl
// backdrop-saturate-150` is AdminSidebar's mobile bar technique verbatim —
// see its own comment for why the fallback matters (a browser without
// backdrop-filter support gets a plainer but still-legible solid bar rather
// than a half-transparent one no OS bothered blurring). The TOKENS are
// different on purpose: AdminSidebar's bar is brand chrome sitting on
// `--sidebar` (navy by default, the company's colour under white-label);
// AppBar sits on top of ordinary page content, so it uses `--background`
// instead. Reusing `--sidebar` here would make a content-surface header
// paint itself in the company's brand colour, which is wrong for a header
// that isn't the brand rail.
import { useRouter } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { useTranslation } from "@/app/hooks/useTranslation";
import { cn } from "@/lib/utils";
import TouchFeedback from "@/app/components/mobile/TouchFeedback";

export default function AppBar({ title, backHref, onBack, rightAction, className }) {
  const router = useRouter();
  const { t } = useTranslation();

  function handleBack() {
    if (onBack) {
      onBack();
      return;
    }
    // Next's router has no public "can I go back" API (useRouter() exposes
    // push/replace/back/forward/refresh/prefetch only — see next/navigation's
    // own docs) — so this falls back to a plain DOM signal instead of an
    // undocumented one.
    //
    // `window.history.length > 1` is honestly imperfect: it counts the WHOLE
    // tab's history, not navigations inside FieldQuo, so a contractor who
    // browsed two other sites before opening the app in the same tab reads
    // as "has history" even though pressing back leaves the app entirely —
    // which is exactly what a real back button does in that situation, so
    // it's not a wrong answer, just a native-browser one rather than an
    // in-app one. The case this line exists to catch is the common one: a
    // link opened from an SMS, an email, or a QR code opens a NEW tab, whose
    // history length is 1 — that's the "cold load into a deep link" the task
    // named, and it's exactly what this check catches correctly every time.
    const hasHistory = typeof window !== "undefined" && window.history.length > 1;
    if (hasHistory) {
      router.back();
    } else if (backHref) {
      router.push(backHref);
    } else if (process.env.NODE_ENV !== "production") {
      // Not a dead click in production — worst case it's a no-op tap, never
      // a navigation to the wrong place — but AGENTS.md's "never ship a
      // control that appears to work and doesn't" means a page reachable by
      // deep link (a quote, an invoice — most things this bar goes on)
      // MUST pass `backHref` or a first-time visitor's chevron does nothing.
      console.warn(
        "AppBar: no browser history and no backHref was given — the back chevron will do nothing for a visitor who opened this page directly.",
      );
    }
  }

  return (
    <header
      className={cn(
        "lg:hidden sticky top-0 z-40 flex h-14 items-center gap-1 border-b border-border bg-background/80 px-2 text-foreground backdrop-blur-xl backdrop-saturate-150 supports-[backdrop-filter]:bg-background/65",
        className,
      )}
    >
      <TouchFeedback
        onClick={handleBack}
        // Reuses the existing "app.action.back" key rather than minting a
        // new one — it's already translated into all six app languages, and
        // check-translations.mjs's typo scan only recognises "app.*" keys
        // that already exist in the catalogue, so a novel key here would be
        // both untranslated and invisible to that check.
        aria-label={t("app.action.back", "Back")}
        // 44px+ tap target (AdminSidebar's own hamburger comment: "below that
        // a target is genuinely hard to hit on a phone"), -ml-1 so the
        // chevron's own glyph — not its invisible padding — lines up with
        // the page's left margin.
        className="-ml-1 flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-foreground"
      >
        <ChevronLeft size={22} />
      </TouchFeedback>

      <h1 className="min-w-0 flex-1 truncate text-base font-semibold text-foreground">
        {title}
      </h1>

      {rightAction && <div className="shrink-0">{rightAction}</div>}
    </header>
  );
}
