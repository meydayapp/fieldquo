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
// then notes, then the Today screen — six, then fourteen. Still tabs in the
// header rather than a sidebar from `lg` up: a rep works one screen at a time,
// and a rail costs horizontal space the queue's two-column console needs. The
// alternative — leaving the rail out — would have shipped screens with no way
// to reach them, which is the "route with no caller" failure
// scripts/check-route-callers.mjs exists for, and which
// scripts/check-sales-home.mjs now asserts for this whole surface.
//
// Below `lg` the header and the tab row are gone, and the chrome is the /app
// model instead: a sticky top bar with a menu button, a bottom tab bar with
// five screens, and a drawer with the other nine —
// app/components/sales/SalesMobileTabBar.js. The owner's words were "not
// mobile friendly, not like /app", and the specific failure was fourteen tabs
// in a three-column grid: five rows of chrome above the first word of every
// screen at 390px, and no way back to the nav without scrolling to the top.
// The list below is the ONE list; the tab bar is handed it and never names a
// tab of its own.
"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";

import IncomingCallDock from "@/app/components/sales/IncomingCallDock";
import { RepPresenceProvider, RepStatusPicker } from "@/app/components/sales/RepStatus";
import SalesMobileTabBar from "@/app/components/sales/SalesMobileTabBar";
import SalesTour from "@/app/components/sales/SalesTour";
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

  // ── The one list of what the portal has ─────────────────────────────────
  //
  // Mapped twice — the desktop row below, and SalesMobileTabBar's bar and
  // drawer — and declared once. Twelve check scripts parse this literal for
  // the href/label pairs, which is why it stays an array literal in this file
  // rather than moving to a module: it is the single source of "what the
  // portal HAS", and everything that names a tab is checked against it.
  const tabs = [
    // ── Every tab is a key now, and that reversed a decision ──────
    //
    // Seven of these were English LITERALS on purpose, and the reason
    // was written here at length: the screen behind each of them was
    // English, and a translated tab opening an English page is a worse
    // inconsistency than an English tab. That reasoning was correct
    // while it was true, and it stopped being true when the screens
    // were translated. The order mattered — screen first, then its tab
    // — so that at no point did a Spanish word open an English page.
    //
    // What the old arrangement actually shipped was the thing it was
    // trying to avoid: the owner opened the portal on a Spanish rep
    // account and read "Today | Cola | Playbook | Mis prospectos |
    // Conversaciones | Texts | Team | Notes", five words in one
    // language and seven in another, side by side in one row.
    //
    // The front door, and the only tab that answers "what do I do next".
    { href: "/sales", label: t("app.salesPortal.navToday") },
    // The prospecting queue, before the rep's own typed-in leads:
    // it is the screen a rep opens first in the morning, and the one
    // the whole discovery pipeline exists to fill.
    { href: "/sales/queue", label: t("app.salesPortal.navQueue") },
    // The script, the twenty objections and the five battlecards, read
    // before the call rather than only inside a claimed prospect's
    // card.
    { href: "/sales/playbook", label: t("app.salesPortal.navPlaybook") },
    { href: "/sales/leads", label: t("app.salesPortal.navLeads") },
    { href: "/sales/threads", label: t("app.salesPortal.navConversations") },
    // Texts, which are a different channel from the email threads next
    // to them: a reply to a text arrives at FieldQuo's sales number and
    // is filed by phone, not by thread token.
    { href: "/sales/messages", label: t("app.salesPortal.navTexts") },
    // FieldQuo's own team chat, and a THIRD distinct thing beside the
    // two above it: Conversations is email to a prospect, Texts is SMS
    // to a prospect, and this is the people a rep works with. Placed
    // next to them because it is the same verb — the difference is who
    // is on the other end, not what you do.
    { href: "/sales/team", label: t("app.salesPortal.navTeam") },
    // The day the notes screens were translated, which the previous
    // comment here named as the condition for this becoming a key.
    { href: "/sales/notes", label: t("app.salesPortal.navNotes") },
    // The rep's own calendar — appointments and callbacks.
    { href: "/sales/calendar", label: t("app.salesPortal.navCalendar") },
    // The attributed-companies book. It was the portal root until the
    // Today screen took that slot; it keeps its translated label
    // because the screen behind THIS one is still translated.
    { href: "/sales/companies", label: t("app.salesPortal.myCompanies") },
    // The account a rep drives in front of a prospect.
    { href: "/sales/demo", label: t("app.salesPortal.navDemo") },
    // Where a rep sends a technical problem they heard from one of
    // their contractors. Beside the companies book rather than at the
    // end: a rep opens it FROM a conversation about a company, and
    // burying it under Pay would make the channel that exists to stop
    // reports evaporating hard to find.
    { href: "/sales/support", label: t("app.salesPortal.navSupport") },
    // Messages left on the rep's own number. Before this screen the
    // only place a sales voicemail could be played was the superadmin
    // floor board, so the person the message was FOR could not hear it.
    { href: "/sales/voicemail", label: t("app.salesPortal.navVoicemail") },
    // How the rep gets paid. Last, because it is a settings screen
    // rather than a working one — visited once when they join and
    // again when their bank changes, not every morning.
    { href: "/sales/pay", label: t("app.salesPortal.navPay") },
  ];

  return (
    // ── Presence is held above every screen ──────────────────────────────
    //
    // RepPresenceProvider loads the rep's own status once, beats the
    // heartbeat, and hands the same object to the header picker, the drawer
    // picker, the incoming-call dock and the queue's autodialler. It wraps the
    // chrome as well as <main> because the dock — which reports "a call is
    // ringing" into it — is mounted here, beside the tour.
    <RepPresenceProvider>
    {/* fq-sales-shell sets --fq-tab-bar-height for everything inside it below
        lg — the one place the bottom bar's footprint is declared, exactly as
        .fq-app-shell does for /app. See the "bottom dock" section of
        app/globals.css. The tour launcher and the incoming-call dock read the
        same variable to sit ABOVE the bar rather than under it. */}
    <div className="min-h-screen bg-muted fq-sales-shell">
      {/* Hidden below lg: SalesMobileTabBar draws the top bar there, with the
          same wordmark, and its drawer carries the name and the sign-out. */}
      <header className="hidden lg:block bg-card border-b border-border">
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
          {/* ── The status picker, from lg up ──────────────────────────────
              Available · Break · Dinner · Meeting · Training · Off, with the
              current state and how long. In the header rather than on a
              screen because a rep goes to dinner from wherever they are; the
              drawer carries the same control below lg. See RepStatus.js. */}
          <RepStatusPicker layout="row" />
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
        {/* ── The tab row, from `lg` up ────────────────────────────────────
            This used to be a three-column grid below sm: and one row above it,
            at every width. The grid was the honest fix for its day — two of
            six tabs had been hiding behind a horizontal scroll — and it stopped
            being honest at fourteen tabs: five rows of chrome on a phone.
            Below lg the bar and drawer in SalesMobileTabBar carry every one of
            these same entries; this row is hidden there, not duplicated.
            No whitespace-nowrap and no truncate — a label that needs two lines
            gets two lines, which is legible, where a clipped one is not. */}
        <nav className={`${container} hidden lg:flex gap-1 -mb-px`}>
          {tabs.map((tab) => {
            // Exact match for the portal root, prefix for the rest: /sales is a
            // prefix of every other tab, so "starts with" would light all six
            // at once and the rail would never say where you are.
            const active =
              tab.href === "/sales" ? pathname === "/sales" : pathname.startsWith(tab.href);
            return (
              <Link
                key={tab.href}
                href={tab.href}
                // What the portal tour draws its ring around. Keyed on the
                // href rather than on a second slug, so there is no third
                // vocabulary to keep in step with this array — a tab that
                // moves takes its anchor with it, and a tab that is REMOVED
                // takes the anchor away, which is what makes
                // scripts/check-sales-tour.mjs's target assertion mean
                // something. See app/sales/tourSteps.js.
                data-sales-tour={tab.href}
                // Left-aligned at its content width — this row only renders
                // from lg up now. Still no whitespace-nowrap: a label that
                // needs two lines gets two lines, which is the honest failure
                // mode where clipping is not.
                className={`min-h-[44px] flex items-center shrink-0 px-3 py-2 text-sm font-medium border-b-2 ${
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
      {/* The phone chrome: top bar, bottom bar, drawer. Renders nothing from
          lg up. Handed the same list the row above maps over. Mounted BEFORE
          <main> because the top bar is sticky in normal flow — mounted after
          it, the bar rendered at the foot of the document, measured at
          y=2336 on a 844px phone. The bottom bar and the drawer are fixed,
          so their place in the tree does not matter. */}
      {/* drawerExtra: the same picker the header carries from lg up, as a
          list of rows at the top of the drawer. Passed as a node so the bar
          never names a status. */}
      <SalesMobileTabBar tabs={tabs} name={me?.name || null} onSignOut={signOut} drawerExtra={<RepStatusPicker layout="list" />} />
      {/* The bottom padding reserves exactly what is pinned over the bottom
          of the viewport below lg — the tab bar's row plus the safe-area
          inset, through the variable app/globals.css declares — and only the
          ordinary page padding from lg up, where the variable is 0. Every
          screen inherits it, so no page needs its own pb-24 guess. */}
      <main
        className={`${container} pt-6 sm:pt-8 pb-[calc(var(--fq-tab-bar-height)+1.5rem)] sm:pb-[calc(var(--fq-tab-bar-height)+2rem)]`}
      >
        {children}
      </main>
      {/* Mounted once, here, so a contractor ringing back reaches the rep
          wherever they are in the portal. A listener that only existed on the
          dialler screen would ring only while somebody happened to be looking
          at it — see the component's header. */}
      <IncomingCallDock />
      {/* Mounted beside the dock, and below it: the tour needs the tabs above
          to point at, so it belongs to the chrome rather than to any one
          screen, and a rep should be able to follow it from wherever they are.
          Deliberately AFTER the dock in the tree and at a lower z-index — a
          contractor ringing back outranks a walkthrough. Nothing renders here
          for a rep who dismissed it, and nothing renders on /sales/login or
          /sales/invite, which return above this. */}
      <SalesTour />
    </div>
    </RepPresenceProvider>
  );
}
