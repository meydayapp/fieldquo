// app/components/auth/samples/DashboardSample.js
//
// "Feel in control"'s sample: the top of the dashboard (/app), drawn by the
// dashboard's own components — HeroRevenue, SecondaryMetrics and
// RevenueGoalCard, ranked by lib/dashboard/rank.js's buildDashboardRank, the
// same pure function the page calls — over the app-guide harness's overview
// and receivables bodies (fixtures/work-data.js: $24,890.50 invoiced and
// paid this month, 16 quotes sent, 6 accepted, a goal of $420,000 with
// $301,850 year to date, the aging of three open invoices). The owner said
// the old tiles looked realistic but must match the actual dashboard; these
// are the actual dashboard, at the width the office sees it.
"use client";

import { useMemo } from "react";
import HeroRevenue from "@/app/components/dashboard/HeroRevenue";
import SecondaryMetrics from "@/app/components/dashboard/SecondaryMetrics";
import RevenueGoalCard from "@/app/components/dashboard/RevenueGoalCard";
import { sparklineMonthsFor, trendSentenceFor } from "@/app/components/dashboard/trendSentence";
import { buildDashboardRank } from "@/lib/dashboard/rank";
import { countUpcoming } from "@/lib/schedule/jobVisits";
import { useTranslation } from "@/app/hooks/useTranslation";
import { TODAY } from "@/docs/screens/app-guide/harness/fixtures/company.js";
import { APPOINTMENTS, OVERVIEW, receivablesBody } from "@/docs/screens/app-guide/harness/fixtures/work-data.js";
import SampleFrame from "./SampleFrame";

/**
 * The dashboard's three inputs, exactly as the page assembles them from its
 * three requests — exported so the check asserts the panel's numbers are the
 * fixture's, run through the page's own ranking.
 */
export function dashboardSample() {
  // The page asks for twelve months when it draws the received-money chart.
  const money = receivablesBody(12);
  const upcomingCount = countUpcoming(APPOINTMENTS, TODAY);
  return { overview: OVERVIEW, money, upcomingCount, rank: buildDashboardRank({ overview: OVERVIEW, money, upcomingCount }) };
}

export default function DashboardSample() {
  const { t } = useTranslation();
  const { overview, money, rank } = useMemo(() => dashboardSample(), []);
  return (
    <SampleFrame width={900} maxHeight={700} label={t("app.signup.aside.insights.label", "your dashboard — this month's money, quotes and jobs")}>
      <div className="space-y-4 bg-background p-6" data-dashboard-sample>
        <HeroRevenue hero={rank.hero} trendSentence={trendSentenceFor(money, t)} monthLabels={sparklineMonthsFor(rank.hero.received)} t={t} />
        <SecondaryMetrics metrics={rank.metrics} t={t} />
        {overview.goal ? <RevenueGoalCard goal={overview.goal} canEdit={false} onSaved={() => {}} /> : null}
      </div>
    </SampleFrame>
  );
}
