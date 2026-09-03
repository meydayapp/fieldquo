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
// ── Colours: the --sidebar-* family, not a private palette ──────────────────
//
// This rail used to paint itself `bg-[#1A1917]` (the EMAIL header neutral from
// lib/email/emailTheme.js, which had drifted onto a nav surface) and write on
// it with `text-muted-foreground` — a token whose whole job is muted text on a
// LIGHT background. In light mode that measured 2.72:1, and the group headings
// at `/70` measured 1.97:1. The owner's report was not "hard to read", it was
// "I thought there was no menu". Two further consequences of the same drift:
// `bg-card/10` as the selected fill is white-at-10% in light mode and
// #111d31-at-10% in dark, i.e. 1.00:1 against this rail — in dark mode the
// selected row had no fill at all; and `hover:text-muted-foreground` on a row
// already painted `text-muted-foreground` meant hovering changed nothing.
//
// Fixed by putting the rail on the same ladder AdminSidebar uses rather than
// inventing values for a one-off background. The near-black is gone: every
// hover and selected fill in globals.css was solved against --sidebar in both
// themes (idle 1.00 -> hover 1.61 -> selected 3.88 light, 1.00 -> 1.69 -> 5.76
// dark), and re-solving that ladder against #1A1917 would have meant three new
// colours nobody had measured. Navy is also what the console's own pages sit
// beside everywhere else. app/platform/login/page.js moved with it so the two
// dark surfaces of the console are one colour.
//
// Measured, not eyeballed: scripts/check-platform-console.mjs recomputes every
// pairing from the hex in globals.css and fails under 4.5:1 in EITHER theme.
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
  MessageCircle,
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
  Webhook,
  Gauge,
  ArrowUpDown,
  DoorOpen,
  UserRoundCheck,
  Ban,
  ListChecks,
  Headphones,
  TrendingUp,
  NotebookPen,
  GitBranch,
  SlidersHorizontal,
  Fingerprint,
  Contact,
  Radar,
  BookOpenCheck,
} from "lucide-react";

const HOME_ITEM = { label: "Dashboard", href: "/platform", icon: LayoutDashboard, exact: true };

const GROUPS = [
  {
    label: "Companies",
    items: [
      { label: "Companies", href: "/platform/companies", icon: Building2 },
      // Directly under Companies, because it is the population Companies now
      // deliberately excludes from its counts: somebody who started a signup
      // and never gave a card. Filed here rather than under "Demos & sales"
      // even though a rep is who calls them — the row IS a company record, and
      // the person looking for it is thinking "who signed up and didn't
      // finish", which is a question about the customer list.
      { label: "Incomplete signups", href: "/platform/signups", icon: DoorOpen },
      {
        label: "Subscriptions",
        href: "/platform/billing/subscriptions",
        icon: BarChart3,
      },
      // Exports of company/subscription/growth data — read as "Companies, in
      // bulk" rather than as a Business-metrics screen, since two of its
      // three CSVs are literally the two rows above it.
      { label: "Reports", href: "/platform/reports", icon: FileSpreadsheet },
      // The paid data-migration service — a company's request, the quote, and
      // (once paid) the ONE write path onto a customer's own tenant data.
      // Sits with Companies/Subscriptions rather than Billing: those two are
      // about the company's PLAN; this is a one-off job for one company, and
      // the person who'd look for it is already thinking "this company", not
      // "our price list".
      { label: "Migrations", href: "/platform/migrations", icon: ArrowUpDown },
    ],
  },
  {
    label: "Support",
    items: [
      { label: "Feedback", href: "/platform/feedback", icon: MessageSquare },
      // Conversations Jennifer (lib/ai/jennifer/) escalated rather than
      // answered — money, deletion, legal/privacy requests. Separate row from
      // Feedback on purpose: these are live conversations to REPLY into
      // (app/api/platform/jennifer/conversations/[id]), not tickets to triage
      // and close.
      { label: "Jennifer", href: "/platform/jennifer", icon: MessageCircle },
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
      // FieldQuo's own salespeople — invite one, deactivate one, see how many
      // companies each brought in. In this group rather than under Admin
      // because a rep's job IS the demo funnel above: they book the demo, they
      // give the walkthrough, and one of these ten fixture accounts is theirs.
      // Filing them with "who holds a platform login" would put the people
      // beside the console's own keys, which is a different question.
      { label: "Sales reps", href: "/platform/sales/reps", icon: UserRoundCheck },
      // Directly under the reps, because it is the same people counted. The
      // owner asked "where do i see the sales KPIs? and insights.. and the
      // leads?" and the honest answer was nowhere: SalesAttribution,
      // SalesCommissionEntry, SalesPayoutBatch and SalesLead all existed with
      // no screen over any of them. A row here rather than a panel on the reps
      // page because the two answer different questions — that one is "who
      // works here and can they send", this one is "what did they sell".
      // What the floor is doing RIGHT NOW, as opposed to what it sold. Placed
      // above performance because it is the screen somebody opens at 10am and
      // performance is the one they open on a Monday: one is a board you watch,
      // the other is a period you read.
      { label: "Sales floor", href: "/platform/sales/floor", icon: Headphones },
      { label: "Sales performance", href: "/platform/sales/performance", icon: TrendingUp },
      // Beside performance, because it is the same question asked the other
      // way round: performance is what a rep sold, this is what they heard.
      // Superadmin only, read-only, and the screen itself says so — reps are
      // told on their own compose screen that this exists, which is the whole
      // reason it is allowed to.
      { label: "Sales notes", href: "/platform/sales/notes", icon: NotebookPen },
      // Where the prospects come from. Placed directly under the reps because
      // it is the screen that fills their queue: a campaign is one territory,
      // one trade and one target, and the single-trade queue it produces is
      // the whole reason it is a campaign rather than a filter.
      { label: "Discovery campaigns", href: "/platform/sales/campaigns", icon: Radar },
      // What the campaigns actually produced. Directly under them because it
      // is the same question one step later — a campaign says how many rows it
      // wrote, this says what is IN them, and it is where the owner checks
      // whether discovery is working rather than merely running.
      { label: "Prospects", href: "/platform/sales/prospects", icon: Contact },
      // What a rep is allowed to promise. Next to the reps rather than under
      // Billing, even though it reads like a feature list: a row here is not a
      // thing FieldQuo sells at a price, it is a sentence somebody says on a
      // phone call, and the person who edits it is thinking about the call.
      // Every recommendation a prospect ever gets has a foreign key into this
      // table, so it needs to be somewhere findable rather than reachable only
      // from whichever screen happens to link it.
      { label: "Capability matrix", href: "/platform/sales/capabilities", icon: ListChecks },
      // The three tables that decide what a rep is told about a prospect, next
      // to the matrix they all depend on. They are here rather than under
      // Admin for the same reason the matrix is: a row in any of them is a
      // sentence somebody says on a phone call, and whoever edits one is
      // thinking about the call, not about the console's own configuration.
      //
      // Rules first: it is the one somebody opens after reading the matrix and
      // asking "so when does a rep actually get told this".
      { label: "Opportunity rules", href: "/platform/sales/rules", icon: GitBranch },
      // What a rep actually SAYS, built out of what the rules found. One entry
      // rather than three: the playbooks, the objection library and the
      // experiments are one screen, because nobody edits an objection response
      // without thinking about the call it comes up in.
      { label: "Playbooks", href: "/platform/sales/playbooks", icon: BookOpenCheck },
      { label: "Confidence weights", href: "/platform/sales/confidence", icon: SlidersHorizontal },
      { label: "Technology signatures", href: "/platform/sales/signatures", icon: Fingerprint },
      // FieldQuo's OWN do-not-contact list — the people who told us to stop.
      // Filed with the sales rows rather than under Support because it is
      // read by the outbound paths those rows drive, not by a support agent
      // answering a ticket. It is emphatically NOT a tenant's opt-out list:
      // CallConsent and MarketingSubscriber are a company's relationship with
      // a homeowner and are not visible from the console at all.
      { label: "Do-not-contact", href: "/platform/suppressions", icon: Ban },
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
      // Was linked ONLY from the phone-pool alert banner on /platform's own
      // dashboard (app/platform/page.js), and only when that alert was firing
      // — so the moment nobody's webhook was broken, there was no way into
      // this page at all. Next to Voice numbers because it answers the same
      // "what is Retell actually doing with this account" question, just for
      // where call events land instead of which numbers are billed.
      { label: "Voice webhooks", href: "/platform/voice-webhooks", icon: Webhook },
      // The endpoint behind this had no screen at all — it turned up in the
      // routes-with-no-caller sweep (scripts/check-route-callers.mjs). Last in
      // the Retell group because it is the only one of the three that answers
      // "should we change the price" rather than "is something broken", and
      // because the concurrency figure on it is the one nobody thinks to look
      // for until an inbound call has already failed.
      { label: "Voice economics", href: "/platform/voice-economics", icon: Gauge },
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
            ? "bg-sidebar-primary text-sidebar-primary-foreground font-semibold"
            : "text-sidebar-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
        }`}
      >
        <Icon size={16} className="shrink-0" />
        <span className="truncate">{item.label}</span>
      </Link>
    );
  }

  return (
    <aside className="w-60 shrink-0 bg-sidebar text-sidebar-foreground border-r border-sidebar-border min-h-screen px-3 py-6 flex flex-col overflow-y-auto">
      {/* Orange as a FILL, not as text. #ff5a00 measures 5.62:1 on the old
          near-black but only 3.88:1 on --sidebar, so moving the rail to navy
          would have quietly pushed the wordmark under the floor — the exact
          "contrast assumed rather than measured" trade the rest of this fix is
          about. globals.css says the same thing about --brand-accent: as a fill
          with dark text on it, it is 5.59:1 and safe in both themes. */}
      <div className="mx-3 mb-6 px-2 py-1 rounded-md bg-sidebar-primary text-sidebar-primary-foreground inline-flex items-center gap-2 self-start">
        <ShieldCheck size={16} />
        <span className="text-xs font-bold uppercase tracking-[0.18em]">
          Platform
        </span>
      </div>

      <nav className="space-y-4 flex-1">
        <Row item={HOME_ITEM} />

        {GROUPS.map((group) => (
          <div key={group.label}>
            <div className="px-3 pb-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-sidebar-muted-foreground">
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
        className="flex items-center gap-3 px-3 py-2.5 mt-4 rounded-lg text-sm font-medium text-sidebar-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
      >
        <LogOut size={16} />
        Sign out
      </button>
    </aside>
  );
}
