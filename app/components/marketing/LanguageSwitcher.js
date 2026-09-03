// app/components/marketing/LanguageSwitcher.js
"use client";

import { useTranslation } from "@/app/hooks/useTranslation";
import { LANGUAGES } from "@/app/i18n/languages";

export default function LanguageSwitcher({ compact = false }) {
  const { language, changeLanguage } = useTranslation();

  return (
    <div
      className="flex items-center gap-0.5 rounded-full border border-border px-1 py-1"
      role="group"
      aria-label="Language"
    >
      {LANGUAGES.map(({ code, label, name, nativeName }) => (
        <button
          key={code}
          type="button"
          onClick={() => changeLanguage(code)}
          aria-pressed={language === code}
          // Native name in the tooltip: someone looking for Punjabi is
          // scanning for "ਪੰਜਾਬੀ", not "Punjabi".
          title={nativeName}
          // Two floors, not one. `compact` only ever renders inside the
          // header's `hidden lg:flex` row — a mouse pointer on a desktop — so
          // it takes the 36px this repo treats as the line between a sized
          // control and a bare text node (see MIN_TOUCH_PX in
          // scripts/check-mobile-surfaces.mjs); 44 there would add a centimetre
          // to every marketing page's header for no one's benefit. The
          // full-size one renders in the mobile menu, where a thumb picks
          // between six 24px-tall pills, and gets the real 44.
          className={`inline-flex items-center justify-center rounded-full py-1 text-xs font-semibold tracking-wide transition-colors ${
            language === code
              ? "bg-primary text-primary-foreground"
              : "text-muted-foreground hover:text-foreground"
          } ${compact ? "min-h-[36px] px-2" : "min-h-[44px] min-w-[44px] px-2.5"}`}
          aria-label={`Switch to ${name}`}
        >
          {label}
        </button>
      ))}
    </div>
  );
}
