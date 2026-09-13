// Every /platform route the console has, keyed by pathname, each rendering
// the shipped page component. Dynamic routes get `params` as a resolved
// Promise, the way Next 16 hands them over, with the fixture's id.
//
// scripts/check-platform-mobile.mjs compares this map against the page.js
// files under app/platform, so a route added to the console without a row
// here fails the check by name rather than silently going unaudited.
import React from "react";

import PlatformDashboard from "@/app/platform/page";
import AiUsagePage from "@/app/platform/ai-usage/page";
import AuditLogPage from "@/app/platform/audit-log/page";
import BillingPlansPage from "@/app/platform/billing/plans/page";
import BillingPromotionsPage from "@/app/platform/billing/promotions/page";
import BillingSubscriptionsPage from "@/app/platform/billing/subscriptions/page";
import ChatPage from "@/app/platform/chat/page";
import CompaniesPage from "@/app/platform/companies/page";
import CompanyDetailPage from "@/app/platform/companies/[id]/page";
import CrewLinesPage from "@/app/platform/crew-lines/page";
import DataDeletionPage from "@/app/platform/data-deletion/page";
import DemoAvailabilityPage from "@/app/platform/demo-availability/page";
import DemoPage from "@/app/platform/demo/page";
import DemosPage from "@/app/platform/demos/page";
import ErrorsPage from "@/app/platform/errors/page";
import FeaturesPage from "@/app/platform/features/page";
import FeedbackPage from "@/app/platform/feedback/page";
import GrowthPage from "@/app/platform/growth/page";
import HelpPage from "@/app/platform/help/page";
import JenniferPage from "@/app/platform/jennifer/page";
import LoginPage from "@/app/platform/login/page";
import MigrationsPage from "@/app/platform/migrations/page";
import MigrationDetailPage from "@/app/platform/migrations/[id]/page";
import PromoCodesPage from "@/app/platform/promo-codes/page";
import ReportsPage from "@/app/platform/reports/page";
import SalesAgentPage from "@/app/platform/sales-agent/page";
import CampaignsPage from "@/app/platform/sales/campaigns/page";
import CampaignDetailPage from "@/app/platform/sales/campaigns/[id]/page";
import CapabilitiesPage from "@/app/platform/sales/capabilities/page";
import ConfidencePage from "@/app/platform/sales/confidence/page";
import FloorPage from "@/app/platform/sales/floor/page";
import FunnelPage from "@/app/platform/sales/funnel/page";
import SalesNotesPage from "@/app/platform/sales/notes/page";
import PayoutsPage from "@/app/platform/sales/payouts/page";
import PerformancePage from "@/app/platform/sales/performance/page";
import CommissionPlansPage from "@/app/platform/sales/plans/page";
import PlaybooksPage from "@/app/platform/sales/playbooks/page";
import PlaybookPreviewPage from "@/app/platform/sales/playbooks/preview/page";
import ProspectsPage from "@/app/platform/sales/prospects/page";
import RepsPage from "@/app/platform/sales/reps/page";
import RetryPoolPage from "@/app/platform/sales/retry-pool/page";
import ReviewPage from "@/app/platform/sales/review/page";
import RulesPage from "@/app/platform/sales/rules/page";
import SignaturesPage from "@/app/platform/sales/signatures/page";
import SnapshotsPage from "@/app/platform/sales/snapshots/page";
import WindowsPage from "@/app/platform/sales/windows/page";
import ServiceCategoriesPage from "@/app/platform/service-categories/page";
import SettingsPage from "@/app/platform/settings/page";
import SignupOriginsPage from "@/app/platform/signup-origins/page";
import SignupsPage from "@/app/platform/signups/page";
import SupportPage from "@/app/platform/support/page";
import SuppressionsPage from "@/app/platform/suppressions/page";
import TeamPage from "@/app/platform/team/page";
import VoiceEconomicsPage from "@/app/platform/voice-economics/page";
import VoiceNumbersPage from "@/app/platform/voice-numbers/page";
import VoiceWebhooksPage from "@/app/platform/voice-webhooks/page";

import { COMPANY_ID, MIGRATION_ID, CAMPAIGN_ID } from "./fixtures/ids.js";

const page = (Component, props = {}) => () => <Component {...props} />;
// A server-shell page (`async function Page({ params })`) returns a Promise
// of an element; React 19 renders a promise-returning component through
// `use`, but only under Suspense — so the shells are awaited by hand.
// The promise is made once (useMemo) — `use` on a promise created during
// render is "suspended by an uncached promise", a console error on every
// re-render of the dynamic pages.
const AwaitedShell = ({ promise }) => React.use(promise);
const asyncPage = (Component, params) => {
  // A component, so the hook runs inside a render — `render()` itself is
  // called once at the harness's top level to build the element.
  function ServerShell() {
    const promise = React.useMemo(() => Component({ params: Promise.resolve(params) }), []);
    return (
      <React.Suspense fallback={null}>
        <AwaitedShell promise={promise} />
      </React.Suspense>
    );
  }
  return () => <ServerShell />;
};

export const PAGES = {
  "/platform": { render: page(PlatformDashboard) },
  "/platform/ai-usage": { render: page(AiUsagePage) },
  "/platform/audit-log": { render: page(AuditLogPage) },
  "/platform/billing/plans": { render: page(BillingPlansPage) },
  "/platform/billing/promotions": { render: page(BillingPromotionsPage) },
  "/platform/billing/subscriptions": { render: page(BillingSubscriptionsPage) },
  "/platform/chat": { render: page(ChatPage) },
  "/platform/companies": { render: page(CompaniesPage) },
  [`/platform/companies/${COMPANY_ID}`]: { render: asyncPage(CompanyDetailPage, { id: COMPANY_ID }), params: { id: COMPANY_ID }, file: "companies/[id]" },
  "/platform/crew-lines": { render: page(CrewLinesPage) },
  "/platform/data-deletion": { render: page(DataDeletionPage) },
  "/platform/demo-availability": { render: page(DemoAvailabilityPage) },
  "/platform/demo": { render: page(DemoPage) },
  "/platform/demos": { render: page(DemosPage) },
  "/platform/errors": { render: page(ErrorsPage) },
  "/platform/features": { render: page(FeaturesPage) },
  "/platform/feedback": { render: page(FeedbackPage) },
  "/platform/growth": { render: page(GrowthPage) },
  "/platform/help": { render: page(HelpPage) },
  "/platform/jennifer": { render: page(JenniferPage) },
  "/platform/login": { render: page(LoginPage) },
  "/platform/migrations": { render: page(MigrationsPage) },
  [`/platform/migrations/${MIGRATION_ID}`]: { render: asyncPage(MigrationDetailPage, { id: MIGRATION_ID }), params: { id: MIGRATION_ID }, file: "migrations/[id]" },
  "/platform/promo-codes": { render: page(PromoCodesPage) },
  "/platform/reports": { render: page(ReportsPage) },
  "/platform/sales-agent": { render: page(SalesAgentPage) },
  "/platform/sales/campaigns": { render: page(CampaignsPage) },
  [`/platform/sales/campaigns/${CAMPAIGN_ID}`]: { render: page(CampaignDetailPage, { params: Promise.resolve({ id: CAMPAIGN_ID }) }), params: { id: CAMPAIGN_ID }, file: "sales/campaigns/[id]" },
  "/platform/sales/capabilities": { render: page(CapabilitiesPage) },
  "/platform/sales/confidence": { render: page(ConfidencePage) },
  "/platform/sales/floor": { render: page(FloorPage) },
  "/platform/sales/funnel": { render: page(FunnelPage) },
  "/platform/sales/notes": { render: page(SalesNotesPage) },
  "/platform/sales/payouts": { render: page(PayoutsPage) },
  "/platform/sales/performance": { render: page(PerformancePage) },
  "/platform/sales/plans": { render: page(CommissionPlansPage) },
  "/platform/sales/playbooks": { render: page(PlaybooksPage) },
  "/platform/sales/playbooks/preview": { render: page(PlaybookPreviewPage) },
  "/platform/sales/prospects": { render: page(ProspectsPage) },
  "/platform/sales/reps": { render: page(RepsPage) },
  "/platform/sales/retry-pool": { render: page(RetryPoolPage) },
  "/platform/sales/review": { render: page(ReviewPage) },
  "/platform/sales/rules": { render: page(RulesPage) },
  "/platform/sales/signatures": { render: page(SignaturesPage) },
  "/platform/sales/snapshots": { render: page(SnapshotsPage) },
  "/platform/sales/windows": { render: page(WindowsPage) },
  "/platform/service-categories": { render: page(ServiceCategoriesPage) },
  "/platform/settings": { render: page(SettingsPage) },
  "/platform/signup-origins": { render: page(SignupOriginsPage) },
  "/platform/signups": { render: page(SignupsPage) },
  "/platform/support": { render: page(SupportPage) },
  "/platform/suppressions": { render: page(SuppressionsPage) },
  "/platform/team": { render: page(TeamPage) },
  "/platform/voice-economics": { render: page(VoiceEconomicsPage) },
  "/platform/voice-numbers": { render: page(VoiceNumbersPage) },
  "/platform/voice-webhooks": { render: page(VoiceWebhooksPage) },
};

/** The routes, in map order — what shoot.mjs and the check walk. */
export const ROUTES = Object.keys(PAGES);
