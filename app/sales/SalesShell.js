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
// Deliberately not a sidebar. One screen does not need navigation, and a rail
// with a single row is the "group of one" the nav audit flags everywhere else.
// When a second screen lands, this is where the rail goes.
"use client";

import { useCallback, useEffect, useState } from "react";
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
          <div className="flex items-center gap-2 min-w-0">
            <BadgeDollarSign size={16} className="text-[#ff5a00] shrink-0" />
            <span className="text-xs font-bold uppercase tracking-[0.18em] text-[#ff5a00]">
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
      </header>
      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-8">{children}</main>
    </div>
  );
}
