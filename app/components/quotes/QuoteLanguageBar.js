// app/components/quotes/QuoteLanguageBar.js
//
// Sets the language a quote is written in, and warns before it's sent rather
// than after.
//
// The rule this enforces: a quote is written ONCE, in one language, and stays
// in that language for its whole life. It is not machine-translated at send
// time. A quote is a commercial commitment — the person signing it should be
// reading words somebody at the company has actually read.
//
// So the moment to catch a gap is here, while the quote is being built and the
// author can still fix it, not at 6pm when the PDF renders half in Spanish.
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Languages, AlertTriangle } from "lucide-react";
import { LANGUAGES } from "@/app/i18n/languages";

export default function QuoteLanguageBar({
  language,
  onChange,
  companyDefault = "en",
  client,
}) {
  const [gaps, setGaps] = useState(null);

  const effective = language || companyDefault;
  const meta = LANGUAGES.find((l) => l.code === effective);

  useEffect(() => {
    // Nothing to check when writing in the source language — that text is
    // whatever the company typed, and it always exists.
    if (effective === companyDefault) {
      setGaps(null);
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(
          `/api/settings/translations?language=${encodeURIComponent(effective)}`,
        );
        if (!res.ok) return;
        const data = await res.json();
        if (!cancelled) setGaps(data);
      } catch {
        // A failed check shouldn't block quoting. Worst case the author
        // doesn't get a warning they'd have got.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [effective, companyDefault]);

  const clientPrefers = client?.language;
  const mismatch = clientPrefers && clientPrefers !== effective;

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-4 space-y-3">
      <div className="flex items-center gap-3 flex-wrap">
        <Languages size={16} className="text-gray-400 shrink-0" />
        <span className="text-sm font-medium text-gray-900">
          Write this quote in
        </span>
        <select
          value={effective}
          onChange={(e) => onChange(e.target.value)}
          className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm bg-white"
        >
          {LANGUAGES.map((l) => (
            <option key={l.code} value={l.code}>
              {l.nativeName}
            </option>
          ))}
        </select>
      </div>

      {/* The client's saved preference is a suggestion, not a lock — someone
          may be quoting a Punjabi-speaking homeowner's English-speaking son.
          But the mismatch should be visible. */}
      {mismatch && (
        <p className="text-xs text-amber-700">
          {client.name} is set to receive documents in{" "}
          {LANGUAGES.find((l) => l.code === clientPrefers)?.nativeName ||
            clientPrefers}
          .{" "}
          <button
            type="button"
            onClick={() => onChange(clientPrefers)}
            className="underline font-semibold"
          >
            Use that instead
          </button>
        </p>
      )}

      {gaps?.missing > 0 && (
        <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 text-xs text-amber-900">
          <AlertTriangle size={14} className="shrink-0 mt-0.5" />
          <div>
            {gaps.missing} of your {gaps.total} services don&apos;t have{" "}
            {meta?.nativeName || effective} wording yet — those line items will
            come out in {LANGUAGES.find((l) => l.code === companyDefault)
              ?.nativeName || companyDefault}
            .{" "}
            <Link
              href="/app/settings/translations"
              className="underline font-semibold"
            >
              Review translations
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
