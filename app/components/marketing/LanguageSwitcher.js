// app/components/marketing/LanguageSwitcher.js
"use client";

import { useTranslation } from "@/app/hooks/useTranslation";
import { LANGUAGES } from "@/app/i18n/languages";

export default function LanguageSwitcher({ compact = false }) {
  const { language, changeLanguage } = useTranslation();

  return (
    <div
      className="flex items-center gap-0.5 rounded-full border border-gray-200 px-1 py-1"
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
          className={`rounded-full py-1 text-xs font-semibold tracking-wide transition-colors ${
            language === code
              ? "bg-gray-900 text-white"
              : "text-gray-500 hover:text-gray-900"
          } ${compact ? "px-1.5" : "px-2.5"}`}
          aria-label={`Switch to ${name}`}
        >
          {label}
        </button>
      ))}
    </div>
  );
}
