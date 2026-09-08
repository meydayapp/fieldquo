// app/components/HelpButton.js
"use client";
import { HelpCircle } from "lucide-react";

export default function HelpButton({ onClick }) {
  return (
    <button
      onClick={onClick}
      // ── Stacked ABOVE the Jennifer launcher, never beside or on it ──────
      //
      // This and JenniferPanel's launcher both lived in the bottom-right
      // corner — this at bottom-6 right-6, Jennifer at bottom-5 right-5 —
      // two circles four pixels apart, on the quote builder's create page
      // where both render. Whichever painted last won, and the other's tap
      // target was under it.
      //
      // Not merged into Jennifer's panel: she is tier-1 SUPPORT for the
      // company (lib/ai/jennifer/), while this starts the quote builder's
      // onboarding TOUR (OnboardingTour, TOUR_STEPS in QuoteBuilder.js). Two
      // different functions; hiding one inside the other's chat window would
      // make the tour unfindable, which is the fate "Save & review" had.
      //
      // The column is shared arithmetic: Jennifer is h-14 (3.5rem) at a
      // 1.25rem gap above the dock, so this starts 0.75rem above her top
      // edge — 1.25 + 3.5 + 0.75 = 5.5rem — and right-[1.625rem] centres
      // a 44px circle on her 56px one (1.25rem + (3.5rem − 2.75rem) / 2).
      // The dock terms are the same two variables she reads, so the pair
      // rides above a Save bar together. See app/globals.css "bottom dock".
      className="fixed bottom-[calc(var(--fq-tab-bar-height)+var(--fq-dock-height)+5.5rem)] right-[1.625rem] z-30 w-11 h-11 rounded-full bg-inverted text-inverted-foreground flex items-center justify-center shadow-lg"
      aria-label="Help"
    >
      <HelpCircle size={20} />
    </button>
  );
}
