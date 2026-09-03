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
// It landed: leads and conversations (docs/SALES-OUTREACH.md). Three tabs in
// the header rather than a sidebar, because three is not a sidebar's worth and
// a rep works one screen at a time. The alternative — leaving the rail out —
// would have shipped two screens with no way to reach them, which is the
// "route with no caller" failure scripts/check-route-callers.mjs exists for.
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

  return (
    <div className="min-h-screen bg-muted">
      <header className="bg-card border-b border-border">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between gap-4">
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
            <button
              onClick={signOut}
              className="inline-flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground"
            >
              <LogOut size={14} />
              {t("app.salesPortal.signOut")}
            </button>
          </div>
        </div>
        <nav className="max-w-5xl mx-auto px-4 sm:px-6 flex gap-1 -mb-px">
          {[
            { href: "/sales", label: t("app.salesPortal.myCompanies") },
            { href: "/sales/leads", label: t("app.salesPortal.navLeads") },
            { href: "/sales/threads", label: t("app.salesPortal.navConversations") },
          ].map((tab) => {
            // Exact match for the portal root, prefix for the rest: /sales is a
            // prefix of every other tab, so "starts with" would light all three
            // at once and the rail would never say where you are.
            const active =
              tab.href === "/sales" ? pathname === "/sales" : pathname.startsWith(tab.href);
            return (
              <Link
                key={tab.href}
                href={tab.href}
                className={`px-3 py-2 text-sm font-medium border-b-2 ${
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
      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-8">{children}</main>
    </div>
  );
}
