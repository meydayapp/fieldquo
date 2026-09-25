// app/components/AppTours.js
//
// Mounted once in the app layout. Watches the route and runs the first-visit
// walkthrough for the current page (see tours.js), then records it as seen —
// per user, server-side — so it never re-appears, even on a different device.
//
// Deliberately non-blocking: while the seen-state is loading it renders
// nothing, so a slow /api/ui-state call can never flash a tour then yank it.
//
// ══ Why this component is mounted where it cannot see the account ═════════
//
// The app shell mounts this AFTER `</LanguageProvider>` — it is a sibling of
// the provider that holds the signed-in user's language, not a descendant of
// it. So t() inside OnboardingTour resolves against the ROOT provider from
// app/layout.js, which has no account to consult and follows localStorage
// instead. That key is shared with the marketing site on this origin, which
// is how a Spanish account read every first-visit tour in Ukrainian while the
// rest of the same screen was Spanish. Nothing about the three pages the
// owner happened to report — crew-inbox, settings/refer, settings/ai-credit —
// was special; they were simply the three tours he had not yet dismissed.
//
// The repair is in lib/i18n/statedLanguage.js, and it is deliberately NOT
// "move the tag inside the provider": that fixes this one mount point and
// leaves the trap armed for the next thing added beside it — ErrorToast,
// PlanRequiredPrompt and JenniferPanel are already out here too. A stated
// account preference now holds for the whole page, wherever it was announced.
"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import OnboardingTour from "./OnboardingTour";
import { tourForPath, TOURS, START_TOUR_EVENT, takePendingTour } from "./tours";

export default function AppTours() {
  const pathname = usePathname();
  const [seenTours, setSeenTours] = useState(null); // null = still loading
  // A tour the reader ASKED for ("Take the tour" on the dashboard), run even
  // if seen. `run` is a counter so pressing the button twice restarts rather
  // than being swallowed as the same state.
  const [requested, setRequested] = useState(null); // { key, path, run } | null

  useEffect(() => {
    let cancelled = false;
    fetch("/api/ui-state")
      .then((r) => (r.ok ? r.json() : { seenTours: [] }))
      .then((d) => !cancelled && setSeenTours(Array.isArray(d.seenTours) ? d.seenTours : []))
      .catch(() => !cancelled && setSeenTours([]));
    return () => {
      cancelled = true;
    };
  }, []);

  // A request carries the path it was made on and only runs there — leaving
  // the page drops it, so a dashboard tour never starts itself on the next
  // screen. Compared by path rather than blindly cleared on navigation: a
  // clear-on-pathname effect runs AFTER the page's own mount effect has
  // asked, and would wipe the request /app?tour=welcome had just made.
  //
  // The path is the router's (usePathname), kept in a ref by a LAYOUT effect
  // — every layout effect in a commit runs before any passive one, so by the
  // time the page's own mount effect asks, the ref already holds the new
  // page's path. Not window.location: the two can disagree (a rewrite, the
  // app-guide harness), and the router's is the one `match` is written
  // against.
  const pathRef = useRef(pathname);
  useLayoutEffect(() => {
    pathRef.current = pathname;
  }, [pathname]);
  useEffect(() => {
    const accept = (detail) => {
      const key = detail?.key;
      if (!TOURS.some((t) => t.key === key)) return;
      takePendingTour();
      setRequested((r) => ({ key, path: pathRef.current, run: (r?.run || 0) + 1 }));
    };
    const onStart = (e) => accept(e?.detail);
    window.addEventListener(START_TOUR_EVENT, onStart);
    // Asked before this listener existed — see takePendingTour.
    const pending = takePendingTour();
    if (pending) accept(pending);
    return () => window.removeEventListener(START_TOUR_EVENT, onStart);
  }, []);

  // …and a request left behind by leaving mid-tour is dropped, so coming back
  // to the dashboard later does not restart a tour nobody just asked for. A
  // request made BY the page just arrived at carries that page's path and
  // survives this — which is why it compares paths instead of clearing.
  useEffect(() => {
    setRequested((r) => (r && r.path !== pathname ? null : r));
  }, [pathname]);

  const record = (key) => {
    setSeenTours((s) => (s || []).includes(key) ? s : [...(s || []), key]);
    fetch("/api/ui-state", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tour: key }),
    }).catch(() => {});
  };

  // Asked for, and it belongs to this page: run it whatever the seen-list
  // says. One that doesn't match the page is refused — its anchors are on
  // another screen, and a tour that rings nothing is the dead control.
  const asked = requested && requested.path === pathname && TOURS.find((t) => t.key === requested.key);
  if (asked && asked.match(pathname)) {
    return (
      <OnboardingTour
        key={`${asked.key}:${requested.run}`}
        steps={asked.steps}
        storageKey={asked.key}
        force
        onFinish={() => {
          setRequested(null);
          record(asked.key);
        }}
      />
    );
  }

  if (seenTours === null) return null;

  const tour = tourForPath(pathname);
  if (!tour || seenTours.includes(tour.key)) return null;

  return (
    <OnboardingTour
      key={tour.key}
      steps={tour.steps}
      storageKey={tour.key}
      serverSeen={false}
      onFinish={() => record(tour.key)}
    />
  );
}
