// app/components/layout/SettingsSidebar.js
//
// The settings rows (GROUPS), and the two things that draw them: the list
// that slides INTO the one rail (SettingsPanel), and the section strip a
// phone shows at the top of every settings page (SettingsPhoneNav).
//
// ── There is no second sidebar any more ─────────────────────────────────────
//
// Until 2026-09-21 this file rendered a second 256px column beside the rail
// under /app/settings/* — its own search box, eight folding groups, 42 rows —
// and the rail's Work/People/Money/Grow groups vanished while you were in it.
// Roofr keeps ONE panel and slides a settings list over it (docs/research/
// roofr-ui-study.md §2.2); the owner asked for exactly that. So the desktop
// <aside> and the phone sheet are gone. AdminSidebar mounts SettingsPanel in
// the same column and slides it; app/app/settings/layout.js mounts
// SettingsPhoneNav above the page below `lg`; app/app/settings/page.js is
// the index (search first, eight cards). The file keeps its name because
// twenty-odd check scripts parse the GROUPS declaration out of it, and the rows
// have not moved.
//
// Grouped by what a company is actually trying to DO, not by when a screen
// happened to get built. Groups are ordered roughly by how often they're
// opened: identity first, then the day-to-day (team/scheduling,
// services/pricing), then what goes OUT (documents & templates, messaging &
// alerts), then what comes IN or OUT in money (getting paid), then the
// client-facing surfaces. The company's own audit trail (Activity) sits with
// Business rather than in a group of its own — a "Records" group holding
// exactly one row was a shelf, not a category.
"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslation } from "@/app/hooks/useTranslation";
import { useNavShell } from "@/app/components/layout/NavShell";
import { useTradeGate } from "@/app/providers/TradeGateProvider";
import { useRovingRows } from "@/app/components/layout/rovingRows";
import {
  ChevronLeft,
  MessageSquare,
  Star,
  Building2,
  Users,
  Package,
  Repeat,
  ListPlus,
  CreditCard,
  Receipt,
  Wallet,
  Percent,
  Smartphone,
  Gift,
  Megaphone,
  Link2,
  Droplet,
  Ruler,
  Headset,
  Bot,
  Mail,
  Clock,
  Palette,
  Tags,
  Tag,
  Boxes,
  Map,
  TrendingUp,
  CalendarDays,
  CalendarClock,
  CalendarPlus,
  ScrollText,
  ClipboardList,
  AtSign,
  Inbox,
  Globe,
  FileText,
  Bell,
  ListChecks,
  Languages,
  MailOpen,
  Zap,
  Sparkles,
  Activity,
  ChevronDown,
  Share2,
  ArrowUpDown,
} from "lucide-react";
import { NavFilter, NavEmptyState, useGroupDisclosure } from "@/app/components/layout/NavFilter";
import { activeGroupKey, isGroupOpen, visibleGroups } from "@/app/components/layout/navDisclosure";
import { useFeatureFlags } from "@/app/providers/FeatureProvider";
import { filterNavGroups } from "@/lib/features/nav";
import FeatureRowBadge from "@/app/components/layout/FeatureRowBadge";
import { useSettingsAccess } from "@/app/providers/SettingsAccessProvider";
import { usePermissions } from "@/app/providers/PermissionProvider";
import { filterSettingsGroups } from "@/lib/permissions/settingsAccess";
import { filterSettingsGroupsByTrade } from "@/lib/settings/tradeGateNav";

export const GROUPS = [
  {
    key: "app.settings.group.account",
    items: [
      { key: "app.settings.accountBilling", href: "/app/settings/account-billing", icon: CreditCard, helpArticle: "settings-account-billing" },
      { key: "app.settings.refer", href: "/app/settings/refer", icon: Gift, helpArticle: "settings-refer" },
      // FieldQuo billing the COMPANY for a one-off surcharge, same shelf as
      // Account & Billing — see SETTINGS_ROW_CAPABILITY, gated "billing" for
      // the same reason: the price and the payment button are the owner's
      // business, not an employee's.
      { key: "app.settings.migration", href: "/app/settings/migration", icon: ArrowUpDown, helpArticle: "settings-migration" },
      { key: "app.settings.productUpdates", href: "/app/settings/product-updates", icon: Megaphone, helpArticle: "settings-product-updates" },
    ],
  },
  {
    key: "app.settings.group.business",
    items: [
      { key: "app.settings.company", href: "/app/settings/company", icon: Building2, helpArticle: "settings-company" },
      { key: "app.settings.branding", href: "/app/settings/branding", icon: Palette, helpArticle: "settings-branding" },
      { key: "app.settings.language", href: "/app/settings/language", icon: Languages, helpArticle: "settings-language" },
      // Moved in from a "Records" group that held this one row and nothing
      // else — the owner's own rule for the main rail ("a group with one item
      // is usually a group that should not exist") applies here too. The
      // company's own action history sits with the company's own identity.
      { key: "app.settings.activity", href: "/app/activity", icon: Activity, helpArticle: "settings-activity" },
    ],
  },
  {
    key: "app.settings.group.team",
    items: [
      { key: "app.settings.team", href: "/app/settings/team", icon: Users, helpArticle: "settings-team" },
      { key: "app.settings.availability", href: "/app/settings/availability", icon: Clock, helpArticle: "settings-availability" },
      // The member's own feed link — beside Availability because both are
      // about this one person's time, and both are rows every member keeps.
      { key: "app.settings.myCalendar", href: "/app/settings/my-calendar", icon: CalendarPlus, helpArticle: "settings-my-calendar" },
      { key: "app.settings.leave", href: "/app/settings/leave", icon: CalendarClock, helpArticle: "settings-leave" },
      { key: "app.settings.policies", href: "/app/settings/policies", icon: ScrollText, helpArticle: "settings-policies" },
      { key: "app.settings.bookingPage", href: "/app/settings/booking-page", icon: CalendarDays, helpArticle: "settings-booking-page" },
      { key: "app.settings.workAreas", href: "/app/settings/work-areas", icon: Map, helpArticle: "settings-work-areas" },
      // Offline mode, the hourly rate billed for clocked hours, performance
      // pay — the switches behind the crew's phone screens. Beside Work
      // Areas because all of it is about people in the field.
      { key: "app.settings.fieldWork", href: "/app/settings/field-work", icon: Smartphone, helpArticle: "settings-field-work" },
    ],
  },
  {
    key: "app.settings.group.pricing",
    items: [
      { key: "app.settings.products", href: "/app/settings/products", icon: Package, helpArticle: "settings-products" },
      { key: "app.settings.services", href: "/app/settings/services", icon: Tags, helpArticle: "settings-services" },
      // The recurring plans a quote can carry — priced like the rest of the
      // price book, so it sits beside it. Its help is the service-plans
      // article (alsoScreens), which covers the plans these templates become.
      { key: "app.settings.planTemplates", href: "/app/settings/maintenance-plans", icon: Repeat, helpArticle: "settings-maintenance-plans" },
      { key: "app.settings.materialCosts", href: "/app/settings/material-costs", icon: Droplet, helpArticle: "settings-material-costs" },
      { key: "app.settings.cabinetRates", href: "/app/settings/cabinet-rates", icon: Ruler, helpArticle: "settings-cabinet-rates" },
      { key: "app.settings.overhead", href: "/app/settings/overhead", icon: TrendingUp, helpArticle: "settings-overhead" },
      { key: "app.settings.customFields", href: "/app/settings/custom-fields", icon: ListPlus, helpArticle: "settings-custom-fields" },
    ],
  },
  // Nine rows under one "Documents & messaging" heading was the group the
  // owner's own rule flags ("nine is usually two"). Split by what the row
  // IS rather than by a headcount: a template sits still until someone opens
  // it (this group); a rule below fires on its own schedule or configures
  // where a message comes FROM (the next group). Quote Email, Email
  // Templates, PDF Templates and Translations are all "what a document says";
  // Checklists is the same kind of thing for a job visit — a template filled
  // in on site rather than mailed out.
  {
    key: "app.settings.group.documents",
    items: [
      { key: "app.settings.quoteEmail", href: "/app/settings/quote-email", icon: MailOpen, helpArticle: "settings-quote-email" },
      { key: "app.settings.emailTemplates", href: "/app/settings/email-templates", icon: Mail, helpArticle: "settings-email-templates" },
      { key: "app.settings.pdfTemplates", href: "/app/settings/templates", icon: FileText, helpArticle: "settings-pdf-templates" },
      { key: "app.settings.translations", href: "/app/settings/translations", icon: Globe, helpArticle: "settings-translations" },
      { key: "app.settings.checklists", href: "/app/settings/checklists", icon: ListChecks, helpArticle: "settings-checklists" },
      { key: "app.settings.jobPhotoTags", href: "/app/settings/job-photo-tags", icon: Tag, helpArticle: "settings-job-photo-tags" },
    ],
  },
  {
    key: "app.settings.group.messaging",
    items: [
      { key: "app.settings.messages", href: "/app/settings/messages", icon: MessageSquare, helpArticle: "settings-messages" },
      { key: "app.settings.followUps", href: "/app/settings/follow-ups", icon: Clock, helpArticle: "settings-follow-ups" },
      { key: "app.settings.notifications", href: "/app/settings/notifications", icon: Bell, helpArticle: "settings-notifications" },
      { key: "app.settings.emailDomain", href: "/app/settings/email-domain", icon: AtSign, helpArticle: "settings-email-domain" },
      // A member's (or the company's) own mailbox, read so client email is
      // filed into history — beside Email Domain because both are about the
      // company's email, and every member sees it: connecting your OWN work
      // mailbox is yours to do (lib/mailbox/connections.js).
      { key: "app.settings.workEmail", href: "/app/settings/work-email", icon: Inbox, helpArticle: "settings-work-email" },
    ],
  },
  {
    key: "app.settings.group.paid",
    items: [
      { key: "app.settings.payments", href: "/app/settings/payments", icon: Receipt, helpArticle: "settings-payments" },
      // Same shelf as Payments — a third-party account a company connects
      // its own money/spend to, not a price charged to a client. See
      // lib/permissions/settingsAccess.js: gated "billing", same as Payments.
      { key: "app.settings.metaAds", href: "/app/settings/meta-ads", icon: Share2, helpArticle: "settings-meta-ads" },
      { key: "app.settings.expenseTracking", href: "/app/settings/expense-tracking", icon: Wallet, helpArticle: "settings-expense-tracking" },
      { key: "app.settings.aiCredit", href: "/app/settings/ai-credit", icon: Sparkles, helpArticle: "settings-ai-credit" },
      // Moved in from Services & pricing: a deduction rate isn't a price
      // charged to a client, it's money moving the OTHER way — the same
      // shelf as Payments and Expense Tracking, not the price book.
      { key: "app.settings.payroll", href: "/app/settings/payroll", icon: Wallet, helpArticle: "settings-payroll" },
      // Commission on the company's own jobs — money going to the team, the
      // same direction as a deduction rate, so the same shelf. Owner/admin
      // (lib/permissions/settingsAccess.js). Its help is the payroll article's
      // until one of its own is written.
      { key: "app.settings.commissions", href: "/app/settings/commissions", icon: Percent, helpArticle: "settings-payroll" },
    ],
  },
  {
    key: "app.settings.group.clientFacing",
    items: [
      { key: "app.settings.website", href: "/app/settings/website", icon: Globe, helpArticle: "settings-website" },
      { key: "app.settings.instantQuotes", href: "/app/settings/instant-quotes", icon: Zap, helpArticle: "settings-instant-quotes" },
      { key: "app.settings.leadForm", href: "/app/settings/lead-form", icon: ClipboardList, helpArticle: "settings-lead-form" },
      { key: "app.settings.bioLink", href: "/app/settings/links", icon: Link2, helpArticle: "settings-bio-link" },
      { key: "app.settings.voice", href: "/app/settings/voice", icon: Headset, helpArticle: "settings-voice" },
      // Beside the phone receptionist rather than under Messaging, and for the
      // same reason the receptionist is here: both are an agent a STRANGER
      // meets. The Messaging group is about the wording of what the company
      // sends; this is about who answers.
      { key: "app.settings.aiEmployee", href: "/app/settings/ai-employee", icon: Bot, helpArticle: "settings-ai-employee" },
      { key: "app.settings.reviews", href: "/app/settings/reviews", icon: Star, helpArticle: "settings-reviews" },
    ],
  },
];

// Everything open on a first visit, for the same reason the main rail's
// groups are: folding solves "this list is long" for someone who already
// knows where things live, and it does not solve discovery. With the list
// open, every settings page is two clicks from anywhere — Settings, then
// the row — which is the ceiling scripts/check-shell.mjs holds; closed by
// default it would be three (Settings, the group, the row), and the old
// second sidebar's "nothing is open until you're in it" was exactly the
// complaint that the first thing a new owner saw was eight headings and no
// pages. The user's own folds still persist (fq-settings-groups); nothing
// here anchors a tour, so no group needs pinning.
const DISCLOSURE_KEY = "fq-settings-groups";
const DEFAULT_OPEN = GROUPS.map((g) => g.key);

/** The 8 groups' icons and one-line descriptions, for the index page's cards. */
export const GROUP_META = {
  "app.settings.group.account": { icon: CreditCard, hint: "app.settings.groupHint.account" },
  "app.settings.group.business": { icon: Building2, hint: "app.settings.groupHint.business" },
  "app.settings.group.team": { icon: Users, hint: "app.settings.groupHint.team" },
  "app.settings.group.pricing": { icon: Package, hint: "app.settings.groupHint.pricing" },
  "app.settings.group.documents": { icon: FileText, hint: "app.settings.groupHint.documents" },
  "app.settings.group.messaging": { icon: MessageSquare, hint: "app.settings.groupHint.messaging" },
  "app.settings.group.paid": { icon: Receipt, hint: "app.settings.groupHint.paid" },
  "app.settings.group.clientFacing": { icon: Globe, hint: "app.settings.groupHint.clientFacing" },
};

// The settings rows that are ALSO rail / More rows. On the index they are
// drawn as links like any other row — same page, same URL — but the guide's
// "Every screen" chapter photographs each page once (screens.js `sameAs`),
// and check-shell counts them once when it proves nothing was lost.
export const SETTINGS_ROWS_ALSO_IN_NAV = {
  "app.settings.accountBilling": "app.nav.plan",
  "app.settings.refer": "app.nav.refer",
  "app.settings.team": "app.nav.team",
  "app.settings.expenseTracking": "app.nav.expenses",
  "app.settings.aiEmployee": "app.nav.aiTeam",
};

/** Longest-prefix match: /app/settings/team/timesheets is Team, not Settings. */
export function currentSettingsItem(items, pathname) {
  const p = String(pathname || "");
  return (
    items
      .filter((i) => p === i.href || p.startsWith(i.href + "/"))
      .sort((a, b) => b.href.length - a.href.length)[0] || null
  );
}

/**
 * The 42 rows after the three cosmetic filters, in the order they always
 * apply: feature flags, then the settings capability map, then the trade
 * gate. One hook, four readers (the slide panel, the phone strip, the index
 * page, the global search) — so a hidden row is hidden everywhere or nowhere.
 *
 * Removing a row is cosmetics, not access control. Every row this can remove
 * is refused server-side for the same member whether or not the row was
 * drawn — see SETTINGS_ROW_CAPABILITY in lib/permissions/settingsAccess.js.
 */
export function useSettingsGroups() {
  const featureFlags = useFeatureFlags();
  const access = useSettingsAccess();
  const caller = usePermissions();
  const tradeGate = useTradeGate();
  return useMemo(
    () =>
      filterSettingsGroupsByTrade(
        filterSettingsGroups(
          filterNavGroups(GROUPS, featureFlags),
          access.resolved ? { role: access.role, impersonation: access.impersonation } : null,
          caller,
        ),
        tradeGate,
      ),
    [featureFlags, access.resolved, access.role, access.impersonation, caller, tradeGate],
  );
}

/**
 * The list that slides over the rail. Rail tones — it sits on the navy
 * column now, not on a card — measured by scripts/check-sidebar.mjs like
 * every other pairing on the rail.
 *
 * @param onBack      slides the main list back (the rail owns the state)
 * @param onNavigate  the phone drawer closes itself after a tap
 */
export function SettingsPanel({ onBack, onNavigate }) {
  const { t } = useTranslation();
  const [query, setQuery] = useState("");
  const pathname = usePathname();
  const featureFlags = useFeatureFlags();
  const groups = useSettingsGroups();
  const allItems = useMemo(() => groups.flatMap((g) => g.items), [groups]);
  const current = currentSettingsItem(allItems, pathname);
  const isActive = (href) => pathname === href || pathname.startsWith(href + "/");
  const activeKey = activeGroupKey(groups, pathname, isActive);
  const { openKeys, toggle } = useGroupDisclosure({
    storageKey: DISCLOSURE_KEY,
    defaultOpenKeys: DEFAULT_OPEN,
    activeKey,
  });
  const onRowsKeyDown = useRovingRows();

  // A query overrides disclosure, so every link stays one search away no
  // matter what is closed. The matching lives in navDisclosure.js, shared
  // with the main rail rather than copied into it.
  const searching = query.trim().length > 0;
  const label = (key) => t(key);
  const filtered = visibleGroups({ groups, query, label });

  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="px-3 pt-3 space-y-2 shrink-0">
        <button
          type="button"
          onClick={onBack}
          data-nav-row
          className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium text-sidebar-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
        >
          <ChevronLeft size={16} className="shrink-0" />
          {t("app.settings.backToMenu")}
        </button>
        <Link
          href="/app/settings"
          onClick={onNavigate}
          data-nav-row
          aria-current={pathname === "/app/settings" ? "page" : undefined}
          className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-semibold ${
            pathname === "/app/settings"
              ? "bg-sidebar-primary text-sidebar-primary-foreground"
              : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
          }`}
        >
          {t("app.settings.title")}
        </Link>
        <NavFilter
          value={query}
          onChange={setQuery}
          placeholder={t("app.settings.search")}
          tone="rail"
        />
      </div>

      <nav
        className="flex-1 min-h-0 overflow-y-auto px-3 py-3 space-y-2"
        aria-label={t("app.settings.title")}
        onKeyDown={onRowsKeyDown}
      >
        {filtered.map((group) => {
          const open = isGroupOpen({ group, openKeys, searching });
          return (
            <div key={group.key}>
              <button
                type="button"
                onClick={() => toggle(group.key)}
                aria-expanded={open}
                data-nav-row
                className="w-full flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-semibold uppercase tracking-[0.12em] text-sidebar-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground transition-colors"
              >
                <span className="truncate">{t(group.key)}</span>
                <ChevronDown
                  size={14}
                  className={`ml-auto shrink-0 transition-transform motion-reduce:transition-none ${open ? "" : "-rotate-90"}`}
                />
              </button>
              {open && (
                <div className="space-y-0.5 pb-1">
                  {group.items.map((item) => {
                    const Icon = item.icon;
                    // Only the longest match is highlighted. A PREFIX test per
                    // item lit up every ancestor of /app/settings/team/timesheets;
                    // more than one "you are here" is no "you are here".
                    const active = current?.href === item.href;
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        onClick={onNavigate}
                        data-nav-row
                        aria-current={active ? "page" : undefined}
                        className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                          active
                            ? "bg-sidebar-primary text-sidebar-primary-foreground font-semibold"
                            : "text-sidebar-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                        }`}
                      >
                        <Icon size={16} className="shrink-0" />
                        <span className="truncate">{t(item.key)}</span>
                        <FeatureRowBadge navKey={item.key} flags={featureFlags} tone="rail" />
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}

        {filtered.length === 0 && (
          <NavEmptyState
            tone="rail"
            message={t("app.nav.noMatches", { query })}
            clearLabel={t("app.action.clear")}
            onClear={() => setQuery("")}
          />
        )}
      </nav>
    </div>
  );
}

/**
 * The phone's section list: a strip at the top of every settings page with
 * the current GROUP's rows, the current one lit, and "All settings" first.
 * Below `lg` only — on desktop the rail's slide does this job. A strip, not
 * a sheet: the page is the thing a person came for, and a full-screen list
 * over it was the old shape's complaint.
 *
 * The rail's own top bar is 52px and sticky; this sits just under it.
 */
export function SettingsPhoneNav() {
  const { t } = useTranslation();
  const pathname = usePathname();
  const groups = useSettingsGroups();
  const allItems = useMemo(() => groups.flatMap((g) => g.items), [groups]);
  const current = currentSettingsItem(allItems, pathname);
  const group = current ? groups.find((g) => g.items.some((i) => i.href === current.href)) : null;
  const shell = useNavShell();
  if (!group) return null;
  return (
    <div className="lg:hidden sticky top-[52px] z-30 border-b border-border/60 bg-card/80 supports-[backdrop-filter]:bg-card/65 backdrop-blur-xl">
      {/* 44px chips (2026-09-25): at py-1 they were 26px — the ONLY way
          between settings pages on a phone, measured on every settings
          screen in the harness. The strip loses its own py-2 instead, so it
          grows by 10px, not 26. */}
      <div className="flex items-center gap-1.5 px-3 py-1 overflow-x-auto" data-settings-phone-nav>
        <Link
          href="/app/settings"
          onClick={() => shell.close()}
          className="shrink-0 inline-flex min-h-[44px] items-center gap-1 rounded-full border border-border px-3 text-xs font-semibold text-muted-foreground hover:bg-sidebar-panel-accent hover:text-foreground"
        >
          <ChevronLeft size={14} />
          {t("app.settings.allSettings")}
        </Link>
        <span className="shrink-0 text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground px-1">
          {t(group.key)}
        </span>
        {group.items.map((item) => {
          const active = current?.href === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={`shrink-0 inline-flex min-h-[44px] items-center rounded-full px-3 text-xs font-semibold border ${
                active
                  ? "bg-sidebar-primary text-sidebar-primary-foreground border-sidebar-primary"
                  : "text-muted-foreground border-border hover:bg-sidebar-panel-accent hover:text-foreground"
              }`}
            >
              {t(item.key)}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
