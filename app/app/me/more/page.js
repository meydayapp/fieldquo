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
import { CalendarClock, ClipboardCheck, ClipboardList, Clock, FileBadge, Inbox, LifeBuoy, LogOut, PackagePlus, ScrollText, Settings, User, Users, Bell, Calendar } from "lucide-react";
import { useTranslation } from "@/app/hooks/useTranslation";
import { usePermissions } from "@/app/providers/PermissionProvider";
import { signOut } from "@/lib/auth-client";
import { helpPath } from "@/lib/help/urls";
import { meTabSetFor } from "@/lib/me/tabs";
import { HR_MORE_LINKS } from "@/lib/me/moreLinks";
import MeShell from "@/app/components/me/MeShell";
import { BigRow, MeLoad, PersonAvatar, RowList, useMeData } from "@/app/components/me/bits";

const HELP_LANGS = new Set(["en", "fr", "es"]);

export default function MeMorePage() {
  const { t, language } = useTranslation();
  const router = useRouter();
  const caller = usePermissions();
  const manager = meTabSetFor(caller) === "manager";
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
              {!manager ? <BigRow icon={Clock} title={t("app.me.tab.earnings")} href="/app/me/earnings" /> : null}
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
    </MeShell>
  );
}
