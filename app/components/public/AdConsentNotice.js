// app/components/public/AdConsentNotice.js
//
// The ad-cookie question on a company's funnel or instant estimate, shown
// only when the company switched "Ask before loading ad pixels" on and this
// visitor has not answered yet (app/components/public/useAdTracking.js).
//
// Company-branded, never FieldQuo's: the company's name in the sentence, its
// brand on the Accept button through the measured fill pair (a white or pale
// yellow brand gets ink instead, the same rule every client-facing button
// follows). The two buttons are the same size and weight — a big Accept
// beside a hidden decline is the dark pattern consent notices are known for.
//
// Standalone it floats at the bottom of the viewport. Inside an embed it is
// drawn inline at the top instead: a fixed element in an iframe sits outside
// the height EmbedFrame measures, and the host page would clip it.
"use client";

import { useMemo } from "react";
import { documentTheme, fillPair } from "@/lib/documents/theme";
import { trackingCopy } from "@/lib/i18n/trackingCopy";

export default function AdConsentNotice({ companyName, brandColor, language, onAccept, onDecline, embedded = false }) {
  const copy = trackingCopy(language);
  const fill = useMemo(() => fillPair(documentTheme({ brandColor })), [brandColor]);
  return (
    <div
      aria-live="polite"
      className={
        embedded
          ? "w-full max-w-md mx-auto mb-4"
          : "fixed inset-x-0 bottom-0 z-50 p-3 sm:p-4 flex justify-center pointer-events-none"
      }
    >
      <div className="pointer-events-auto w-full max-w-md rounded-2xl bg-white text-[#2d2520] shadow-lg border border-black/10 p-4">
        <p className="text-[13px] leading-snug">{copy.consentBody(companyName || "")}</p>
        <div className="mt-3 grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={onDecline}
            className="rounded-full border border-black/25 px-4 py-2 text-sm font-semibold text-[#2d2520] bg-white"
          >
            {copy.decline}
          </button>
          <button
            type="button"
            onClick={onAccept}
            className="rounded-full px-4 py-2 text-sm font-semibold"
            style={{ backgroundColor: fill.bg, color: fill.fg, border: `1px solid ${fill.bg}` }}
          >
            {copy.accept}
          </button>
        </div>
      </div>
    </div>
  );
}
