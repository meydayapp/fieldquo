// app/components/dashboard/TourLauncher.js
"use client";

// "Take the tour" — the dashboard's way back into the welcome walkthrough.
//
// The walkthrough runs once, on a first visit, and was then reachable only
// from the Help centre (and that door was broken — see HelpCenter.js). The
// owner wanted it beside the set-up lists, where somebody who is still finding
// their way around is already looking. It sits at the foot of whichever
// set-up card is showing (page.js decides), so it disappears with them rather
// than living on the dashboard forever.
//
// It does not navigate and does not reset anything server-side: it asks
// AppTours to run the tour for THIS page by name (startTour), which runs it
// whether or not it has been seen. The button only renders where that tour
// matches the page — the dashboard — so it cannot start a tour whose anchors
// are on another screen.
import { PlayCircle } from "lucide-react";
import { useTranslation } from "@/app/hooks/useTranslation";
import { startTour, WELCOME_TOUR_KEY } from "@/app/components/tours";

export default function TourLauncher() {
  const { t } = useTranslation();
  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
      <span className="min-w-0">
        <span className="block text-sm font-medium text-foreground">
          {t("app.tourLauncher.title", "New here, or finding your way round the new menu?")}
        </span>
        <span className="block text-xs text-muted-foreground mt-0.5">
          {t("app.tourLauncher.body", "A short walk round the menu — where leads, quotes, scheduling and settings live.")}
        </span>
      </span>
      <button
        type="button"
        onClick={() => startTour(WELCOME_TOUR_KEY)}
        className="shrink-0 inline-flex items-center justify-center gap-1.5 rounded-full border border-border px-3.5 min-h-11 text-sm font-semibold text-foreground hover:bg-muted"
      >
        <PlayCircle size={16} aria-hidden="true" />
        {t("app.tourLauncher.start", "Take the tour")}
      </button>
    </div>
  );
}
