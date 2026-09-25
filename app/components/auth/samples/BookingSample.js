// app/components/auth/samples/BookingSample.js
//
// The business step's sample: the booking page's calendar — the REAL
// SlotCalendar (app/components/public/SlotCalendar.js), the one grid the
// booking page, the website's booking block and the visit page all render —
// coloured by the same documentTheme / fillPair / washPair the booking page
// uses, in the neutral brand (sampleCompany.js).
//
// Its times are not invented either: they are lib/booking/slotGrid.js run
// over the fixture company's opening hours (Mon–Thu 8–5, Fri 8–4, weekends
// closed) at its one-hour visit length — the pure slot maths the booking
// routes share — for the month on screen, from now on. Nothing is fetched.
"use client";

import { useCallback, useMemo } from "react";
import SlotCalendar from "@/app/components/public/SlotCalendar";
import { documentTheme, fillPair, washPair } from "@/lib/documents/theme";
import { clientDocCopy } from "@/lib/i18n/clientDocCopy";
import { documentFormatters } from "@/lib/i18n/documentLabels";
import { slotGrid } from "@/lib/booking/slotGrid";
import { useTranslation } from "@/app/hooks/useTranslation";
import SampleFrame from "./SampleFrame";
import { FIXTURE_COMPANY } from "./sampleCompany";

const deviceZone = () => {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  } catch {
    return "UTC";
  }
};

/** The fixture's opening hours as slotGrid windows, in the viewer's zone. */
export function sampleWindows(timezone = deviceZone()) {
  return (FIXTURE_COMPANY.businessHours || [])
    .filter((h) => h && !h.closed)
    .map((h) => ({ dayOfWeek: h.day, startTime: h.open, endTime: h.close, timezone }));
}

/**
 * SlotCalendar's loadSlots for the sample: { "YYYY-MM-DD": [iso…] } between
 * two local dates, from now on, at the fixture's visit length.
 */
export function sampleSlots(fromYmd, toYmd, { now = new Date(), timezone = deviceZone() } = {}) {
  const [fy, fm, fd] = String(fromYmd).split("-").map(Number);
  const [ty, tm, td] = String(toYmd).split("-").map(Number);
  const from = new Date(fy, fm - 1, fd);
  const to = new Date(ty, tm - 1, td + 1);
  const minutes = Number(FIXTURE_COMPANY.defaultVisitMinutes) || 60;
  const days = slotGrid({ windows: sampleWindows(timezone), from, to, slotMinutes: minutes, stepMinutes: minutes, now, timezone });
  return Object.fromEntries(days.map((d) => [d.day, d.starts.map((s) => s.toISOString())]));
}

const ymd = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

export default function BookingSample({ language = "en", title = "" }) {
  const { t } = useTranslation();
  const theme = useMemo(() => documentTheme({ brandColor: null }), []);
  const solid = useMemo(() => fillPair(theme), [theme]);
  const wash = useMemo(() => washPair(theme), [theme]);
  const copy = useMemo(() => clientDocCopy(language).visit, [language]);
  const locale = documentFormatters(language).locale;
  const loadSlots = useCallback(async (from, to) => sampleSlots(from, to), []);
  // Open on the first day this month (or next) that has times, so the
  // sample shows the times panel rather than "pick a day".
  const initialDay = useMemo(() => {
    const now = new Date();
    const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    const first = Object.keys(sampleSlots(ymd(now), ymd(end), { now })).sort()[0];
    return first || null;
  }, []);
  // The title is the panel's caption, outside the frame: inside it would
  // read as the booking page's own heading, which it is not.
  return (
    <div className="space-y-2" data-booking-sample>
      {title ? (
        <p className="truncate text-[13px] font-semibold text-foreground" data-booking-title>
          {title}
        </p>
      ) : null}
      <SampleFrame width={780} maxHeight={560} background={theme.paper} label={t("app.signup.aside.booking.label", "your online booking page")}>
        <div className="p-6" style={{ backgroundColor: theme.paper }}>
          <SlotCalendar theme={theme} solid={solid} wash={wash} copy={copy} locale={locale} loadSlots={loadSlots} onPick={() => {}} initialDay={initialDay} />
        </div>
      </SampleFrame>
    </div>
  );
}
