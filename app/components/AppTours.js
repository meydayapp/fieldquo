// app/components/AppTours.js
//
// Mounted once in the app layout. Watches the route and runs the first-visit
// walkthrough for the current page (see tours.js), then records it as seen —
// per user, server-side — so it never re-appears, even on a different device.
//
// Deliberately non-blocking: while the seen-state is loading it renders
// nothing, so a slow /api/ui-state call can never flash a tour then yank it.
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
