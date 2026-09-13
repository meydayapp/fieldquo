// app/components/AnalyticsBeacon.js
//
// Mounted once, in the root layout, so every surface — marketing, help, the
// back office, the sales portal, the console, and every client-facing page —
// records a page view through lib/analytics/track.js. Renders nothing.
//
// usePathname is the only hook: it works inside a client component under a
// static layout without opting the page into dynamic rendering, which is why
// the query string (for UTM tags) is read from window.location in the tracker
// rather than through useSearchParams, whose Suspense requirement would have
// meant wrapping every static marketing page.
"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { trackPageView } from "@/lib/analytics/track";

export default function AnalyticsBeacon() {
  const pathname = usePathname();
  useEffect(() => {
    if (!pathname) return;
    trackPageView(pathname, window.location.host);
  }, [pathname]);
  return null;
}
