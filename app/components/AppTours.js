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

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import OnboardingTour from "./OnboardingTour";
import { tourForPath } from "./tours";

export default function AppTours() {
  const pathname = usePathname();
  const [seenTours, setSeenTours] = useState(null); // null = still loading

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

  if (seenTours === null) return null;

  const tour = tourForPath(pathname);
  if (!tour || seenTours.includes(tour.key)) return null;

  return (
    <OnboardingTour
      key={tour.key}
      steps={tour.steps}
      storageKey={tour.key}
      serverSeen={false}
      onFinish={() => {
        setSeenTours((s) => (s.includes(tour.key) ? s : [...s, tour.key]));
        fetch("/api/ui-state", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ tour: tour.key }),
        }).catch(() => {});
      }}
    />
  );
}
