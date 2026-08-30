// app/components/platform/PlatformSidebar.js
//
// Nav for the internal console. Hides itself on /platform/login so the
// sign-in screen isn't wrapped in chrome for a session that doesn't exist yet.
//
// ── Grouped, like the two tenant-facing sidebars ────────────────────────────
//
// This used to be one flat list of twenty-one rows in file order — the order
// features shipped in, not an order anyone would choose on purpose. The
// individual placement decisions were already reasoned about (see the
// per-row comments below, carried over unchanged: Promotions next to Plans,
// Sales agent next to AI usage, Demo availability next to Demo bookings) —
// what was missing was a shape bigger than "next to." Grouped the same way
// AdminSidebar and SettingsSidebar are: by the job a FieldQuo staffer is
// doing, not by when the screen shipped.
//
//   Companies       — the customer list, its billing status, and the export
//                      of both. What "how's a customer doing" means here.
//   Support         — things that need a person's attention: a bug report, a
//                      failed webhook. Read daily, not configured.
//   Billing         — what FieldQuo SELLS: plans, promotions, feature
//                      availability, referral codes. Pricing decisions.
//   Demos & sales   — the demo-booking funnel: fixture accounts, the
//                      bookings made against them, the calendar they're
//                      booked into.
//   FieldQuo's own systems — vendor accounts FieldQuo itself pays for
//                      (OpenAI, Twilio, Retell) plus the phone line that
//                      answers on FieldQuo's own behalf. Not a customer's
//                      data at all, which is exactly why grouping it apart
//                      matters — this is the one shelf where "whose account
//                      is this" needs to be obvious from the group alone.
//   Admin           — the catalogue every company's onboarding reads from,
//                      the record of what platform staff did, the reference
//                      doc, and who else holds a platform login. Configured
//                      rarely, read for context.
//
// Dashboard stays OUTSIDE every group and renders first, same reasoning as
// AdminSidebar's HOME_ITEM: it's where you land, not a category member, and
// a lone "Overview" group holding one row is the "group of one" this exact
// audit flags everywhere else.
//
// No collapse/disclosure here, unlike the two /app sidebars — twenty rows in
// six short groups reads fine without folding, and building that machinery
// for a console with no walkthrough to protect and no check exercising it
// would be new surface area the audit didn't ask for. If this list keeps
// growing, that's the next thing to add — see check-sidebar.mjs, which
// currently parses AdminSidebar and SettingsSidebar only.
"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Beaker,
  LayoutDashboard,
  Building2,
  CreditCard,
  Tags,
  ScrollText,
  MessageSquare,
  BarChart3,
  LogOut,
  ShieldCheck,
  FileSpreadsheet,
  Sparkles,
  LifeBuoy,
  AlertTriangle,
  CalendarCheck,
  CalendarClock,
  Ticket,
  ToggleLeft,
  PhoneCall,
  PhoneOff,
  MessageSquareText,
  Percent,
} from "lucide-react";

const HOME_ITEM = { label: "Dashboard", href: "/platform", icon: LayoutDashboard, exact: true };

const GROUPS = [
  {
    label: "Companies",
    items: [
      { label: "Companies", href: "/platform/companies", icon: Building2 },
      {
        label: "Subscriptions",
        href: "/platform/billing/subscriptions",
        icon: BarChart3,
      },
      // Exports of company/subscription/growth data — read as "Companies, in
      // bulk" rather than as a Business-metrics screen, since two of its
      // three CSVs are literally the two rows above it.
      { label: "Reports", href: "/platform/reports", icon: FileSpreadsheet },
    ],
  },
  {
    label: "Support",
    items: [
      { label: "Feedback", href: "/platform/feedback", icon: MessageSquare },
      { label: "Errors", href: "/platform/errors", icon: AlertTriangle },
    ],
  },
  {
    label: "Billing",
    items: [
      { label: "Plans", href: "/platform/billing/plans", icon: CreditCard },
      // Directly under Plans, and a separate row rather than a panel on that
      // page: Plans edits what we charge permanently, Promotions is a dated
      // rule that crosses every plan and expires. One screen holding both is
      // the screen where somebody changes a price intending to run a sale.
      { label: "Promotions", href: "/platform/billing/promotions", icon: Percent },
      // Next to Plans, not next to Companies: this is what FieldQuo SELLS,
      // and the question "is this on for them" is asked in the same breath
      // as "what plan are they on". It edits FieldQuo's own data — see the
      // page header.
      { label: "Features", href: "/platform/features", icon: ToggleLeft },
      { label: "Promo codes", href: "/platform/promo-codes", icon: Ticket },
    ],
  },
  {
    label: "Demos & sales",
    items: [
      // exact: the active test is a prefix match, so without it /platform/demo
      // lights up on /platform/demos and /platform/demo-availability as well,
      // and three rows claim to be the page you're on.
      { label: "Demo accounts", href: "/platform/demo", icon: Beaker, exact: true },
      { label: "Demo bookings", href: "/platform/demos", icon: CalendarCheck },
      // Sits next to the bookings it produces: this screen IS the marketing
      // hero's calendar, and reading one without the other explains nothing.
      { label: "Demo availability", href: "/platform/demo-availability", icon: CalendarClock },
    ],
  },
  {
    label: "FieldQuo's own systems",
    items: [
      { label: "AI usage", href: "/platform/ai-usage", icon: Sparkles },
      // FieldQuo's OWN phone agent, not a tenant's receptionist. Sits next to
      // AI usage rather than anywhere near Companies for exactly that reason
      // — this row is about what FieldQuo says on its own line, and putting
      // it beside the company list is how somebody opens it expecting a
      // customer's receptionist.
      { label: "Sales agent", href: "/platform/sales-agent", icon: PhoneCall },
      // FieldQuo's Twilio estate: which numbers we hold, who we've lent each
      // one to, and where its texts are really being delivered. Next to
      // Sales agent because it is the same kind of row — our own provider
      // account, not a tenant's data. It moved here off /app/crew-inbox,
      // where a contractor was being shown our inbound webhook URL and
      // clicking it.
      { label: "Crew lines", href: "/platform/crew-lines", icon: MessageSquareText },
      // FieldQuo's Retell estate, next to its Twilio one. Answers the
      // question neither a tenant screen nor our own tables can: which
      // numbers is Retell billing this account for that nobody holds. A
      // released row that never reached the provider is invisible
      // everywhere else and costs money monthly.
      { label: "Voice numbers", href: "/platform/voice-numbers", icon: PhoneOff },
    ],
  },
  {
    label: "Admin",
    items: [
      {
        label: "Service categories",
        href: "/platform/service-categories",
        icon: Tags,
      },
      { label: "Audit log", href: "/platform/audit-log", icon: ScrollText },
      { label: "Support runbook", href: "/platform/help", icon: LifeBuoy },
      { label: "Platform team", href: "/platform/team", icon: ShieldCheck },
    ],
  },
];

export default function PlatformSidebar() {
  const pathname = usePathname();
  const router = useRouter();

  if (pathname === "/platform/login") return null;

  const isActive = (item) =>
    item.exact ? pathname === item.href : pathname.startsWith(item.href);

  async function signOut() {
    await fetch("/api/platform/auth/logout", { method: "POST" });
    window.location.href = "/platform/login";
  }

  function Row({ item }) {
    const Icon = item.icon;
    return (
      <Link
        href={item.href}
        className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium ${
          isActive(item)
            ? "bg-card/10 text-white"
            : "text-muted-foreground hover:bg-card/5 hover:text-muted-foreground"
        }`}
      >
        <Icon size={16} className="shrink-0" />
        <span className="truncate">{item.label}</span>
      </Link>
    );
  }

  return (
    <aside className="w-60 shrink-0 bg-[#1A1917] text-muted-foreground min-h-screen px-3 py-6 flex flex-col overflow-y-auto">
      <div className="px-3 mb-6 flex items-center gap-2">
        <ShieldCheck size={16} className="text-[#ff5a00]" />
        <span className="text-xs font-bold uppercase tracking-[0.18em] text-[#ff5a00]">
          Platform
        </span>
      </div>

      <nav className="space-y-4 flex-1">
        <Row item={HOME_ITEM} />

        {GROUPS.map((group) => (
          <div key={group.label}>
            <div className="px-3 pb-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground/70">
              {group.label}
            </div>
            <div className="space-y-1">
              {group.items.map((item) => (
                <Row key={item.href} item={item} />
              ))}
            </div>
          </div>
        ))}
      </nav>

      <button
        onClick={signOut}
        className="flex items-center gap-3 px-3 py-2.5 mt-4 rounded-lg text-sm font-medium text-muted-foreground hover:bg-card/5 hover:text-muted-foreground"
      >
        <LogOut size={16} />
        Sign out
      </button>
    </aside>
  );
}
