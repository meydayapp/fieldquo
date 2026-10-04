"use client";

// app/app/me/more/page.js
//
// More: Profile · Requests · Team · Settings · Support · Sign out — and, for
// a manager, the approval queues. Big rows, one column.
//
// No clock-in PIN card: there is no PIN mechanism in the product, and a
// card for one would be a control that appears to work and doesn't.
//
// Profile is READ-ONLY here. There is no self-serve route that edits a
// person's own name, phone or photo — Manage Team edits the roster — so
// the row shows what is on file and says who can change it, rather than
// offering fields that would not save.
import { useRouter } from "next/navigation";
import { Briefcase, CalendarClock, ClipboardCheck, ClipboardList, Clock, FileBadge, Inbox, LifeBuoy, LogOut, PackagePlus, ScrollText, Settings, User, Users, Bell, Calendar, Wallet } from "lucide-react";
import { useTranslation } from "@/app/hooks/useTranslation";
import { usePermissions } from "@/app/providers/PermissionProvider";
import { signOut } from "@/lib/auth-client";
import { helpPath } from "@/lib/help/urls";
import { meTabSetFor } from "@/lib/me/tabs";
import { navRowAllowed } from "@/lib/permissions/nav";
import { clockOffered } from "@/lib/timeclock/access";
import { HR_MORE_LINKS } from "@/lib/me/moreLinks";
import { HOME_ITEM, NAV_GROUPS, MORE_GROUPS, BOTTOM_ITEMS, QUICK_ADD_ITEMS, useNavGroups, useNavItems } from "@/app/components/layout/AdminSidebar";
import { useFeatureFlags } from "@/app/providers/FeatureProvider";
import { CREW_CLOCK_HREF, usesCrewShell } from "@/lib/nav/crewShell";
import { phoneBarFor } from "@/lib/nav/phoneBar";
import ThemeToggle from "@/app/components/ThemeToggle";
import MeShell from "@/app/components/me/MeShell";
import { BigRow, MeLoad, PersonAvatar, RowList, useMeData } from "@/app/components/me/bits";

const HELP_LANGS = new Set(["en", "fr", "es"]);

// ── Everything else, for crew (2026-10-03) ──────────────────────────────────
//
// Crew have no rail and no phone drawer any more (lib/nav/crewShell.js — the
// owner: "for crews I don't think we need the accordion"). Every row those
// two offered them still has to be somewhere, so it is here, on the page the
// last button of their bar opens: the rail's rows, the account rows and the
// Create rows, through the SAME filters the rail ran (useNavGroups /
// useNavItems — feature flags, the grid, the trade gate), minus what this
// page and their phone bar already show. Big rows, one column,
// nothing folded. scripts/check-rbac-nav.mjs holds the source to that shape.
const CREW_ALL_GROUPS = [
  { key: "app.me.more.allPages", items: [HOME_ITEM, ...NAV_GROUPS.flatMap((g) => g.items), ...MORE_GROUPS.flatMap((g) => g.items)] },
];
const CREW_ALL_ITEMS = [...BOTTOM_ITEMS, ...QUICK_ADD_ITEMS];

// The rows this page draws below, by href — what "Everything else" must not repeat.
const PAGE_HREFS = [
  "/app/me/requests", "/app/time-off", "/app/me/availability", "/app/me/supplies", "/app/me/team",
  "/app/me/earnings", "/app/jobs", "/app/settings/notifications", "/app/me/schedule", "/app/settings",
];

/** @param {{ pageDrawn: boolean }} p  whether this page's own rows (PAGE_HREFS) are on screen */
function CrewEverythingElse({ pageDrawn }) {
  const { t } = useTranslation();
  const caller = usePermissions();
  const flags = useFeatureFlags();
  const groups = useNavGroups(CREW_ALL_GROUPS);
  const items = useNavItems(CREW_ALL_ITEMS);
  // What the phone bar and this page already draw. Not the desktop buttons:
  // a phone has none, and each of them is a bar tab or a row here anyway
  // (check-rbac-nav holds that).
  const taken = new Set([
    ...(pageDrawn ? PAGE_HREFS : []),
    CREW_CLOCK_HREF,
    "/app/me/more",
    ...phoneBarFor(caller, flags).tabs.map((r) => r.href),
  ]);
  const seen = new Set();
  const keep = (row) => {
    if (!row || taken.has(row.href) || seen.has(row.href)) return false;
    seen.add(row.href);
    return true;
  };
  const pages = groups.flatMap((g) => g.items).filter(keep);
  const others = items.filter(keep);
  return (
    <section className="space-y-2" data-crew-everything-else>
      <h2 className="px-1 text-lg font-bold text-foreground">{t("app.me.more.allPages")}</h2>
      <RowList>
        {[...pages, ...others].map((row) => (
          <BigRow key={row.href} icon={row.icon} title={t(row.key)} href={row.href} />
        ))}
        {/* Light or dark — it lived in the avatar menu, which crew no longer have. */}
        <BigRow title={t("app.nav.appearance")} right={<ThemeToggle compact />} />
      </RowList>
    </section>
  );
}

export default function MeMorePage() {
  const { t, language } = useTranslation();
  const router = useRouter();
  const caller = usePermissions();
  const manager = meTabSetFor(caller) === "manager";
  const crewShell = usesCrewShell(caller, useFeatureFlags());
  const { data, errorKey, loading, reload } = useMeData("/api/me/home");
  // The HR rows' counts — policies to sign, checklist items open, documents
  // about to lapse (lib/me/moreLinks.js `badge` names). Its own read so a
  // failed count never costs the page; with no Worker behind this login
  // the rows are not drawn at all rather than drawn to pages that 404.
  const hr = useMeData("/api/hr/me/summary");
  const helpLang = HELP_LANGS.has(language) ? language : "en";
  const HR_ICONS = { ClipboardCheck, ScrollText, FileBadge };

  async function logout() {
    await signOut({
      fetchOptions: {
        onSuccess: () => {
          router.replace("/login");
          router.refresh();
        },
      },
    });
  }

  return (
    <MeShell title={t("app.me.tab.more")}>
      <MeLoad loading={loading} errorKey={errorKey} reload={reload}>
        {data ? (
          <div className="space-y-4">
            {/* ── Profile ─────────────────────────────────────────── */}
            <section className="flex items-center gap-4 rounded-2xl border border-border bg-card p-4">
              <PersonAvatar name={data.me.name} image={data.me.image} size="lg" />
              <div className="min-w-0 flex-1">
                <div className="truncate text-lg font-bold text-foreground">{data.me.name || "—"}</div>
                <div className="truncate text-sm text-muted-foreground">{data.me.title || t("app.me.more.noTitle")}</div>
                <div className="mt-1 text-xs text-muted-foreground">{t("app.me.more.profileNote")}</div>
              </div>
            </section>

            <RowList>
              <BigRow icon={Inbox} title={t("app.me.more.requests")} subtitle={t("app.me.more.requestsNote")} href="/app/me/requests" badge={data.counts.pendingRequests + data.counts.pendingAvailability} />
              <BigRow icon={CalendarClock} title={t("app.me.more.timeOff")} href="/app/time-off" />
              <BigRow icon={Calendar} title={t("app.me.more.availability")} subtitle={data.me.quoter ? t("app.me.availability.labelQuoter") : t("app.me.availability.labelCrew")} href="/app/me/availability" />
              {/* The mouth of the purchasing funnel, from the van: ask the
                  office for what the site is short of. app/app/me/supplies. */}
              <BigRow icon={PackagePlus} title={t("app.supplies.title")} subtitle={t("app.supplies.moreNote")} href="/app/me/supplies" />
              <BigRow icon={Users} title={t("app.me.tab.team")} href="/app/me/team" />
              {/* Everyone's own pay page — GET /api/me/earnings answers every
                  member (lib/payroll/ownPayGate.js decides what money it
                  shows). It was drawn for the worker set only, so a
                  supervisor entitled to their own timecard had no way to it. */}
              <BigRow icon={Wallet} title={t("app.me.tab.earnings")} href="/app/me/earnings" />
              {/* The clock is a tab for the worker set; a manager clocks in
                  from here. */}
              {manager && clockOffered(caller) ? <BigRow icon={Clock} title={t("app.nav.clock")} href="/app/clock" /> : null}
              {/* The jobs list, for the worker set — a crew member's bar is
                  Clock · Today · Chat · More (lib/nav/phoneBar.js) and this
                  page is its More, so their jobs list is a row here, behind
                  the same navRowAllowed the rail uses: /api/jobs serves Crew
                  their assigned jobs only, and refuses below view_only. */}
              {!manager && navRowAllowed("app.nav.jobs", caller) ? (
                <BigRow icon={Briefcase} title={t("app.nav.jobs")} href="/app/jobs" />
              ) : null}
            </RowList>

            {/* ── The HR file: onboarding, policies, documents ────────
                Drawn only for a login with a Worker row behind it. */}
            {hr.data?.hasWorker ? (
              <RowList>
                {HR_MORE_LINKS.map((l) => (
                  <BigRow key={l.href} icon={HR_ICONS[l.icon] || ClipboardList} title={t(l.labelKey)} href={l.href} badge={hr.data[l.badge] || 0} />
                ))}
              </RowList>
            ) : null}

            {manager ? (
              <RowList>
                <BigRow icon={ClipboardList} title={t("app.me.manager.timeOffRequests")} href="/app/time-off" />
                <BigRow icon={Clock} title={t("app.me.manager.timesheetsToApprove")} href="/app/settings/team/timesheets" />
                <BigRow icon={Users} title={t("app.me.team.manage")} href="/app/settings/team" />
              </RowList>
            ) : null}

            {crewShell ? <CrewEverythingElse pageDrawn /> : null}

            <RowList>
              <BigRow icon={Bell} title={t("app.me.more.notifications")} href="/app/settings/notifications" />
              <BigRow icon={Calendar} title={t("app.me.more.calendarSync")} subtitle={t("app.me.more.calendarSyncNote")} href="/app/me/schedule" />
              <BigRow icon={Settings} title={t("app.me.more.settings")} href="/app/settings" />
              <BigRow icon={LifeBuoy} title={t("app.me.more.support")} href={helpPath(helpLang)} />
              <BigRow icon={LogOut} title={t("app.me.more.signOut")} onClick={logout} danger />
            </RowList>
          </div>
        ) : null}
      </MeLoad>
      {/* /api/me/home failed or never answered: the rows above are not
          drawn, and for crew this page is the only menu — so the list stands
          on its own, minus nothing but the bar. */}
      {crewShell && !data && !loading ? (
        <div className="mt-4">
          <CrewEverythingElse pageDrawn={false} />
        </div>
      ) : null}
    </MeShell>
  );
}
