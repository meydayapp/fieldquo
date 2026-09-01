// app/components/HelpButton.js
"use client";
import { HelpCircle } from "lucide-react";

export default function HelpButton({ onClick }) {
  return (
    <button
      onClick={onClick}
      // bottom-6 alone put this inside MobileTabBar's own row below `lg` —
      // the only caller (QuoteBuilder.js) always renders this alongside
      // QuoteTotalsBar, whose own bottom-0 was the reference point this 24px
      // gap was measured from. QuoteTotalsBar now clears the tab bar the same
      // way below `lg`, so this adds the identical offset to keep the same
      // 24px relationship to it instead of drifting apart.
      className="fixed bottom-[calc(4rem+1.5rem+env(safe-area-inset-bottom))] lg:bottom-6 right-6 z-50 w-11 h-11 rounded-full bg-inverted text-inverted-foreground flex items-center justify-center shadow-lg"
      aria-label="Help"
    >
      <HelpCircle size={20} />
    </button>
  );
}
