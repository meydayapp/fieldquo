// app/components/jobs/DirectionsButtons.js
//
// "Directions" for the crew on the job page: turn-by-turn from wherever the
// phone is to the job, in one tap. Google Maps everywhere (its documented
// Maps URLs directions form opens navigation in the app when installed); on an
// Apple device a second button for Apple Maps, which is what most iPhones in
// a van actually use. Both links are keyless and free — lib/maps/streetView.js
// directionsLinks.
//
// Additive: the address on the job page keeps its existing maps.google.com
// link (a map of the place). This is the other question — how do I get there.
"use client";

import { useEffect, useState } from "react";
import { Navigation } from "lucide-react";
import { directionsLinks, isAppleDevice } from "@/lib/maps/streetView";

const BTN =
  "inline-flex items-center gap-2 min-h-[40px] px-3 rounded-lg border border-border bg-card text-sm font-medium text-foreground hover:bg-accent";

export default function DirectionsButtons({ address, t, className = "" }) {
  // Decided after mount: the server has no navigator, and rendering the Apple
  // button on the server and removing it on the client would flash.
  const [apple, setApple] = useState(false);
  useEffect(() => {
    try {
      setApple(
        isAppleDevice({
          userAgent: navigator.userAgent || "",
          platform: navigator.platform || "",
          maxTouchPoints: navigator.maxTouchPoints || 0,
        }),
      );
    } catch {
      setApple(false);
    }
  }, []);

  const links = directionsLinks(address);
  if (!links) return null;

  return (
    <div className={`flex flex-wrap gap-2 ${className}`}>
      <a href={links.google} target="_blank" rel="noopener noreferrer" className={BTN}>
        <Navigation size={16} aria-hidden="true" />
        {t("app.job.directions")}
      </a>
      {apple && (
        <a href={links.apple} target="_blank" rel="noopener noreferrer" className={BTN}>
          <Navigation size={16} aria-hidden="true" />
          {t("app.job.directionsApple")}
        </a>
      )}
    </div>
  );
}
