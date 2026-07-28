// app/components/LanguagePicker.js
//
// Picks the language a client's documents get written in.
//
// Labelled in each language's own name, not translated into the operator's
// language: someone choosing "Punjabi" for a homeowner is more confident
// picking "ਪੰਜਾਬੀ" than a row that says "Punjabi" in English, because it's the
// same string the client will recognise on the quote.
//
// The empty option is meaningful. Null means "follow the company default", so
// a company that later switches its own default carries every client with it.
// Writing the current default into each client row would freeze them.
"use client";

import { LANGUAGES } from "@/app/i18n/languages";

export default function LanguagePicker({
  value,
  onChange,
  companyDefault = "en",
  label = "Language for their documents",
  hint,
  includeInherit = true,
  disabled,
}) {
  const defaultName =
    LANGUAGES.find((l) => l.code === companyDefault)?.nativeName ||
    companyDefault;

  return (
    <div>
      {label && (
        <label className="block text-sm font-medium text-gray-700 mb-1">
          {label}
        </label>
      )}
      <select
        value={value || ""}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value || null)}
        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white disabled:bg-gray-50"
      >
        {includeInherit && (
          <option value="">Company default ({defaultName})</option>
        )}
        {LANGUAGES.map((l) => (
          <option key={l.code} value={l.code}>
            {l.nativeName}
            {l.nativeName !== l.name ? ` — ${l.name}` : ""}
          </option>
        ))}
      </select>
      <p className="text-xs text-gray-400 mt-1">
        {hint ??
          "Quotes, invoices and emails to this client are written in this language."}
      </p>
    </div>
  );
}
