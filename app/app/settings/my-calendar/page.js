// app/app/settings/my-calendar/page.js
//
// Settings → My calendar: how this member's FieldQuo schedule reaches the
// calendar app on their own phone.
//
// ── This page is a shell ───────────────────────────────────────────────────
//
// It renders a heading and mounts sections that each live in their own file
// under app/components/calendar/. Two ways of connecting a calendar are
// being built by two people at once — the subscribe feed below, and a
// Google Calendar OAuth connection (ConnectGoogleSection) that will be
// mounted beside it — and a page that held both cards' state and fetches
// inline would be the file both of them had to edit. Keep it that way: a
// new way of connecting is a new component and one line here.
//
// Every member sees this row (lib/permissions/settingsAccess.js): the feed
// is THEIR schedule, scoped by their own grid, and there is nothing on the
// page that belongs to the company.
"use client";

import { Suspense } from "react";
import { CalendarPlus } from "lucide-react";
import { useTranslation } from "@/app/hooks/useTranslation";
import BackToHome from "@/app/components/BackToHome";
import SubscribeFeedSection from "@/app/components/calendar/SubscribeFeedSection";
import GoogleConnect from "@/app/components/calendar/GoogleConnect";

export default function MyCalendarSettingsPage() {
  const { t } = useTranslation();
  return (
    <div className="max-w-3xl p-4 sm:p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
          <CalendarPlus size={20} className="text-muted-foreground" />
          {t("app.myCalendar.title", "My calendar")}
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          {t("app.myCalendar.subtitle", "Put your FieldQuo schedule in the calendar you already look at.")}
        </p>
        <BackToHome />
      </div>

      {/* useSearchParams inside GoogleConnect needs a boundary for the
          static shell; the section renders its own loading line. */}
      <Suspense fallback={null}>
        <GoogleConnect />
      </Suspense>
      <SubscribeFeedSection />
    </div>
  );
}
