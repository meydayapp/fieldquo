// app/sales/SalesShell.js
//
// The portal's chrome: a wordmark, who you're signed in as, and sign out.
//
// Hides itself on the two pages reached WITHOUT a session — /sales/login and
// /sales/invite/* — exactly as PlatformSidebar early-returns on
// /platform/login. Rendering a "Signed in as …" bar above a sign-in form is a
// small lie, and the sign-out button on it would be a control with nothing to
// sign out of.
//
// Deliberately not a sidebar. A rail with a single row is the "group of one"
// the nav audit flags everywhere else — so when this file was written, with one
// screen in the portal, it said "when a second screen lands, this is where the
// rail goes".
//
// It landed: leads and conversations (docs/SALES-OUTREACH.md), then the queue,
// then notes, then the Today screen — six. Still tabs in the header rather than
// a sidebar: a rep works one screen at a time on a phone, and a rail costs
// horizontal space a 375px screen does not have. The alternative — leaving the
// rail out — would have shipped screens with no way to reach them, which is the
// "route with no caller" failure scripts/check-route-callers.mjs exists for,
// and which scripts/check-sales-home.mjs now asserts for this whole surface.
"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LogOut, BadgeDollarSign } from "lucide-react";
import { useTranslation } from "@/app/hooks/useTranslation";

export default function SalesShell({ children }) {
  const pathname = usePathname();
  const { t } = useTranslation();
  const [me, setMe] = useState(null);

  const chromeless =
    pathname === "/sales/login" || pathname.startsWith("/sales/invite");

  const load = useCallback(async () => {
    if (chromeless) return;
    try {
      const res = await fetch("/api/sales/me");
      // A failure here is not worth an error banner: middleware has already
      // bounced anyone without a session, so the only way to get here and fail
      // is a token that expired between the page load and this fetch. The name
      // is chrome; the page below it says its own truth.
      if (res.ok) setMe(await res.json());
    } catch {
      /* leave the name off rather than showing a wrong one */
    }
  }, [chromeless]);

  useEffect(() => {
    load();
  }, [load]);

  async function signOut() {
    await fetch("/api/sales/auth/logout", { method: "POST" });
    window.location.href = "/sales/login";
  }

  if (chromeless) {
    return <div className="min-h-screen bg-muted">{children}</div>;
  }

  // ── One width for reading, a wider one for the console ────────────────────
  //
  // max-w-5xl is right for the five single-column screens: they are prose and
  // cards a rep reads top to bottom, and a 1400px line of body text is worse
  // than an 1024px one. /sales/queue is not that — it is a working surface with
  // a persistent list beside a detail pane, and squeezing both into 1024px puts
  // the pane at roughly 640px, which is narrower than the single-column screen
  // it replaced. Widened for that route only rather than everywhere, because
  // "make it all wider" would have cost the four reading screens their measure
  // to fix one console. Header, tabs and body share the constant so the three
  // stay aligned.
  const container = `${pathname.startsWith("/sales/queue") ? "max-w-7xl" : "max-w-5xl"} mx-auto px-4 sm:px-6`;

  return (
    <div className="min-h-screen bg-muted">
      <header className="bg-card border-b border-border">
        {/* py-2, not py-4: the sign-out button below is now a 44px target, so
            the old padding would have added 24px of dead chrome to the top of
            every phone screen in the portal. */}
        <div className={`${container} py-2 flex items-center justify-between gap-4`}>
          {/* text-brand-accent-text, not the raw #ff5a00 this used to hardcode.
              Raw orange on --card measures 3.13:1 in light mode — under the
              4.5:1 floor. --brand-accent-text is the darkened value globals.css
              defines for exactly this case (5.09:1 light, 6.49:1 dark). This
              header is NOT the sidebar problem the audit expected to find here:
              it sits on --card, a light surface, so its
              text-muted-foreground below is the correct token and measures
              6.46:1 / 7.78:1. The orange was the only thing failing. */}
          <div className="flex items-center gap-2 min-w-0">
            <BadgeDollarSign size={16} className="text-brand-accent-text shrink-0" />
            <span className="text-xs font-bold uppercase tracking-[0.18em] text-brand-accent-text">
              {t("app.salesPortal.title")}
            </span>
          </div>
          <div className="flex items-center gap-4 min-w-0">
            {me?.name && (
              <span className="text-sm text-muted-foreground truncate hidden sm:inline">
                {t("app.salesPortal.signedInAs", { name: me.name })}
              </span>
            )}
            {/* min-h-[44px]: it was a 20px-tall text button, which is the one
                target on this header and the one a thumb misses. Height only —
                no padding — so the header does not grow. */}
            <button
              onClick={signOut}
              className="inline-flex items-center gap-2 min-h-[44px] text-sm font-medium text-muted-foreground hover:text-foreground"
            >
              <LogOut size={14} />
              {t("app.salesPortal.signOut")}
            </button>
          </div>
        </div>
        {/* ── Six tabs, all of them on screen at 375px ─────────────────────
            This used to be one row with overflow-x-auto. Measured in a browser
            at 375px: four tabs fitted and TWO — Notes and My companies — sat
            off the right edge behind a horizontal scroll with no scrollbar, no
            fade and no arrow. Nobody discovers that. It is the same failure as
            a screen with no nav entry, which is what
            scripts/check-sales-home.mjs's reachability section exists to
            catch, except the link was present and merely invisible.
            The previous note claimed wrapping "pushes the content down"; it
            does, by one 36px row, once. An undiscoverable tab costs more.
            So: two rows of three below sm:, one row above it. No
            whitespace-nowrap and no truncate — a label that needs two lines in
            a 106px cell gets two lines, which is legible, where a clipped one
            is not. */}
        <nav className={`${container} grid grid-cols-3 sm:flex gap-1 -mb-px`}>
          {[
            // The front door, and the only tab that answers "what do I do
            // next". English literal for the same reason "Notes" is one, below.
            { href: "/sales", label: "Today" },
            // The prospecting queue, before the rep's own typed-in leads:
            // it is the screen a rep opens first in the morning, and the one
            // the whole discovery pipeline exists to fill.
            { href: "/sales/queue", label: t("app.salesPortal.navQueue") },
            { href: "/sales/leads", label: t("app.salesPortal.navLeads") },
            { href: "/sales/threads", label: t("app.salesPortal.navConversations") },
            // English, and not a t() key, deliberately. The screen behind it is
            // English — docs/sales-intel/STATUS.md records that the outreach
            // surfaces are, while the shell is translated — and a translated tab
            // opening an English page is a worse inconsistency than an English
            // tab. It becomes a key the day the notes screens are translated.
            { href: "/sales/notes", label: "Notes" },
            // The attributed-companies book. It was the portal root until the
            // Today screen took that slot; it keeps its translated label
            // because the screen behind THIS one is still translated.
            { href: "/sales/companies", label: t("app.salesPortal.myCompanies") },
          ].map((tab) => {
            // Exact match for the portal root, prefix for the rest: /sales is a
            // prefix of every other tab, so "starts with" would light all six
            // at once and the rail would never say where you are.
            const active =
              tab.href === "/sales" ? pathname === "/sales" : pathname.startsWith(tab.href);
            return (
              <Link
                key={tab.href}
                href={tab.href}
                // Centred in its grid cell below sm:, left-aligned and at its
                // content width above it. Still no whitespace-nowrap: a label
                // that needs two lines gets two lines, which is the honest
                // failure mode where clipping is not.
                className={`min-h-[44px] flex items-center justify-center sm:justify-start text-center sm:text-left sm:shrink-0 px-3 py-2 text-sm font-medium border-b-2 ${
                  active
                    ? // The underline is a non-text indicator, so 3:1 against the
                      // card is the applicable floor and raw orange clears it at
                      // 3.13:1 — tokenised, not darkened, because darkening the
                      // rule would break the one colour the brand is recognised by
                      // for no accessibility gain.
                      "border-brand-accent text-foreground"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                }`}
              >
                {tab.label}
              </Link>
            );
          })}
        </nav>
      </header>
      <main className={`${container} py-6 sm:py-8`}>{children}</main>
    </div>
  );
}
