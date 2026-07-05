// app/components/marketing/LanguageSwitcher.js
"use client";

import { useTranslation } from "@/app/hooks/useTranslation";

const LANGUAGES = [
  { code: "en", label: "EN" },
  { code: "fr", label: "FR" },
  { code: "es", label: "ES" },
  { code: "uk", label: "УК" },
];

export default function LanguageSwitcher({ compact = false }) {
  const { language, changeLanguage } = useTranslation();

  return (
    <div className="flex items-center gap-0.5 rounded-full border border-gray-200 px-1 py-1">
      {LANGUAGES.map(({ code, label }) => (
        <button
          key={code}
          type="button"
          onClick={() => changeLanguage(code)}
          className={`rounded-full px-2 py-1 text-xs font-semibold tracking-wide transition-colors ${
            language === code
              ? "bg-gray-900 text-white"
              : "text-gray-500 hover:text-gray-900"
          } ${compact ? "px-1.5" : "px-2.5"}`}
          aria-label={`Switch to ${code}`}
        >
          {label}
        </button>
      ))}
    </div>
  );
}
