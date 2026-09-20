"use client";

// app/app/settings/my-calendar/page.js
//
// Settings → My calendar: the member's OWN calendar plumbing, one row every
// member sees (SETTINGS_ROW_CAPABILITY "everyone") because nothing here is
// the company's — it is where this person's visits go and what this
// person's other commitments block.
//
// Sections, each in its own component file so the two can be worked on
// independently:
//   Connect Google Calendar   app/components/calendar/GoogleConnect.js
//                             (two-way: FieldQuo writes its own events onto
//                             the member's primary calendar; the member's
//                             busy time feeds every booker)
//   Subscribe (.ics)          the read-only feed for any calendar app — its
//                             component lands beside this one; until it
//                             does nothing is drawn for it, rather than a
//                             heading over nothing.
import { Suspense } from "react";
import { useTranslation } from "@/app/hooks/useTranslation";
import BackToHome from "@/app/components/BackToHome";
import GoogleConnect from "@/app/components/calendar/GoogleConnect";

export default function MyCalendarPage() {
  const { t } = useTranslation();
  return (
    <div className="max-w-2xl">
      <h1 className="text-2xl font-bold text-foreground">{t("app.settings.myCalendar")}</h1>
      <p className="text-sm text-muted-foreground mt-1">{t("app.calendar.settings.subtitle")}</p>
      <BackToHome />

      <div className="mt-6 space-y-6">
        {/* useSearchParams inside GoogleConnect needs a boundary for the
            static shell; the section renders its own loading line. */}
        <Suspense fallback={null}>
          <GoogleConnect />
        </Suspense>
      </div>
    </div>
  );
}
