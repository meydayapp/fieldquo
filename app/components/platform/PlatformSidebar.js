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
//
// ── Below lg: a top bar and a drawer, not a 240px rail ──────────────────────
//
// The owner, 2026-09-13: "the platform is not mobile friendly". Measured
// (docs/screens/platform-mobile/before/audit.json): this <aside> kept its
// w-60 at every width, so on a 375px phone <main> was 135px wide and every
// screen rendered as a 240px navy column beside a strip of squeezed text.
// Below lg it is now the /app model — AdminSidebar's sticky top bar with a
// hamburger, and a slide-over drawer (app/components/layout/NavDrawer.js,
// the same container the /app and /sales sidebars render) carrying the same
// sixty rows and the sign-out. From lg up the rail is what it was, now
// sticky for the viewport and scrolling its own rows.
//
// The rows are drawn once, in railContent(), for both places — the rail and
// the drawer cannot disagree about what the console has. The tour/check hooks
// follow the convention the other two sidebars set: data-tour-open=
// "platform-nav" on the hamburger, data-tour-close="platform-nav" on the
// drawer's X. scripts/check-platform-mobile.mjs opens and closes it through
// those and measures every route at 375.
"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { notify } from "@/lib/notify/browser";
import NavDrawer from "@/app/components/layout/NavDrawer";
import {
  Beaker,
  Filter,
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
  SirenIcon,
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
  UserCog,
  Fingerprint,
  Contact,
  Radar,
  RotateCcw,
  Database,
  BookOpenCheck,
  HandCoins,
  Receipt,
  Trash2,
  Inbox,
  Clock3,
  Globe,
  Menu,
  X,
} from "lucide-react";

/** How often the console re-reads its two counts while the tab is visible. */
const NOTIFY_POLL_MS = 60 * 1000;

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
      // Where each signup's request came from and the flag decided on it
      // (outside CA/US, stated-country mismatch, repeat IP). The badge is the
      // number waiting for review — the owner asked for a FIRST-level flag,
      // seen without opening anything. Same family as the row above: a
      // question about the customer list, not about the sales team, even
      // though a rep's link is the case it exists for.
      { label: "Signup origins", href: "/platform/signup-origins", icon: Globe, badge: "signups" },
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
      // Escalations from sales reps — the only channel in the product through
      // which a customer's technical problem reaches FieldQuo from the person
      // who heard it. First in the group because it is the one with somebody
      // waiting on the other end of it.
      // The same rooms a rep sees at /sales/team. Beside Escalations on
      // purpose: an escalation is a ticket about one company, and this is the
      // conversation that usually happens either side of raising one.
      { label: "Team chat", href: "/platform/chat", icon: MessageSquare },
      { label: "Escalations", href: "/platform/support", icon: SirenIcon },
      { label: "Feedback", href: "/platform/feedback", icon: MessageSquare },
      // Conversations Jennifer (lib/ai/jennifer/) escalated rather than
      // answered — money, deletion, legal/privacy requests. Separate row from
      // Feedback on purpose: these are live conversations to REPLY into
      // (app/api/platform/jennifer/conversations/[id]), not tickets to triage
      // and close.
      { label: "Jennifer", href: "/platform/jennifer", icon: MessageCircle },
      // The register behind /data-deletion and Meta's deletion callback. Under
      // Support because that is who answers it, but the deletion itself is the
      // owner's manual act and the page is superadmin-only; the one button on
      // it records "done" and emails the person, it deletes nothing.
      { label: "Data deletion", href: "/platform/data-deletion", icon: Trash2 },
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
      // Immediately under the reps, because it is the thing a rep cannot be
      // hired without. SalesCommissionPlan decides every figure in a rep's
      // ledger and had NO screen and no create path anywhere in the product:
      // amountForMilestone() returns null without a plan and earnMilestone()
      // refuses a null amount, so an unassigned rep earned $0 on every
      // milestone, silently. "Commission plans" rather than "Plans" on
      // purpose — Billing's Plans row is what FieldQuo CHARGES a contractor,
      // and the two answering to one word is how somebody edits the wrong one.
      { label: "Commission plans", href: "/platform/sales/plans", icon: HandCoins },
      // Under the plans, because it is the plans paid out: what FieldQuo owes
      // each rep by week or month, the closed batches to pay, and — once a
      // person has paid one through Wise or Interac — where and when, with
      // the receipt. No money moves from it; lib/sales/payouts.js says why.
      { label: "Sales payouts", href: "/platform/sales/payouts", icon: Receipt },
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
      // Per rep per month, dial to retained-at-60-days, with the owner's
      // bands and the ramp — the screen performance's "what did they sell"
      // does not answer, which is "how many calls did that take".
      { label: "Sales funnel", href: "/platform/sales/funnel", icon: Filter },
      { label: "Growth", href: "/platform/growth", icon: TrendingUp },
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
      // How hard each state's calling window and 24-hour cap are applied on
      // the rep's screens — enforce, warn only, off — laid over the law in
      // lib/sales/callingRules.js. Under campaigns because the registration
      // list lives there and this control is the one thing that list gates:
      // a registration outstanding holds every override at enforce.
      { label: "Calling windows", href: "/platform/sales/windows", icon: Clock3 },
      // The rows discovery could not finish: contractors with no trade,
      // rows the classifier could not place, possible duplicates — every
      // campaign in one list, with a trade picker. Directly under campaigns
      // because it is where a campaign's output goes when it needs a human,
      // and the badge is the number waiting (superadmin only; the count
      // route answers null for anyone else and no badge is drawn).
      { label: "Review folder", href: "/platform/sales/review", icon: Inbox, badge: "review" },
      // The other list a rep's queue drains into: prospects the retry rule
      // has finished with (four no-answers, three voicemails —
      // lib/sales/retryRules.js). Under the review folder because it is the
      // same kind of screen — rows that left the pool and a superadmin
      // deciding whether they go back — and the rule table is printed beside
      // them so the owner can read the numbers the queue is ordered by.
      { label: "Retry pool", href: "/platform/sales/retry-pool", icon: RotateCcw },
      // Directly under campaigns, because it is the one thing a campaign needs
      // that a campaign cannot ask for: the public base URL of the bucket the
      // snapshot files were uploaded to. Set once. Every campaign's snapshot
      // URL is derived from it and from the object key in the measured library,
      // which is why no campaign form has a URL field any more.
      { label: "Snapshot library", href: "/platform/sales/snapshots", icon: Database },
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
      // "Sales agent" until the owner asked what Retell had to do with the
      // sales team — which is the question the label invites. It is FieldQuo's
      // INBOUND line: the AI that answers when a contractor a rep called rings
      // the number back. It is not the reps' dialler (that is Twilio, and it
      // lives on the rep console), and it is not the AI employee a tenant
      // gets. The word doing the work is "inbound".
      { label: "Inbound sales line", href: "/platform/sales-agent", icon: PhoneCall },
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
      // The admin's OWN preferences — browser notifications for new tickets
      // and escalations. Last, and in Admin: it is about the person at the
      // console, not about any company.
      { label: "My settings", href: "/platform/settings", icon: UserCog },
    ],
  },
];

export default function PlatformSidebar() {
  const pathname = usePathname();
  const router = useRouter();
  // The first badge on this rail: rows waiting in the Review folder. Fetched
  // once per mount and again when the pathname changes, so leaving the folder
  // after a session of decisions shows the new number. Null (no count, or not
  // a superadmin) draws nothing rather than a zero.
  const [reviewCount, setReviewCount] = useState(null);
  // The second badge, same lifecycle: flagged signups waiting for review
  // (/api/platform/signup-origins/count). Two fetches rather than one merged
  // endpoint because they answer to different roles — the review folder is
  // superadmin-only and answers null to everyone else; the signup count is
  // for anyone who may view companies.
  const [signupFlagCount, setSignupFlagCount] = useState(null);
  // The phone drawer. Closed whenever the route changes — the row that was
  // tapped is now the screen, and a drawer still over it would need a second
  // tap for nothing (the same effect AdminSidebar runs on pathname).
  const [mobileOpen, setMobileOpen] = useState(false);
  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);
  useEffect(() => {
    if (pathname === "/platform/login") return undefined;
    let cancelled = false;
    const readCount = (url, set) =>
      fetch(url)
        .then((res) => (res.ok ? res.json() : null))
        .then((body) => {
          if (!cancelled) set(Number.isFinite(body?.count) ? body.count : null);
        })
        .catch(() => {
          if (!cancelled) set(null);
        });
    readCount("/api/platform/sales/review/count", setReviewCount);
    readCount("/api/platform/signup-origins/count", setSignupFlagCount);
    return () => {
      cancelled = true;
    };
  }, [pathname]);

  // ── The in-tab half of browser notifications for the console ───────────
  //
  // Open tickets and escalated Jennifer conversations, re-read once a
  // minute while the tab is visible; a count that ROSE is announced through
  // notify() — a toast on a focused tab, a system notification on a
  // background one (lib/notify/browser.js). Only from the second read on,
  // so a reload does not announce the existing queue. Null (not permitted,
  // could not count) is never compared. The server pushes the same events
  // with the ticket's subject; this one, from counts, says only that there
  // is a new one and where.
  const countsSeen = useRef(null);
  useEffect(() => {
    if (pathname === "/platform/login") return undefined;
    let cancelled = false;
    const read = () =>
      fetch("/api/platform/notifications/count")
        .then((res) => (res.ok ? res.json() : null))
        .then((body) => {
          if (cancelled || !body) return;
          const prev = countsSeen.current;
          if (prev) {
            if (Number.isFinite(body.tickets) && Number.isFinite(prev.tickets) && body.tickets > prev.tickets) {
              notify({ title: "New support ticket", body: `${body.tickets} open`, tag: "platform-tickets", url: "/platform/support" });
            }
            if (Number.isFinite(body.escalations) && Number.isFinite(prev.escalations) && body.escalations > prev.escalations) {
              notify({ title: "Jennifer escalated a conversation", body: `${body.escalations} waiting`, tag: "platform-escalations", url: "/platform/jennifer" });
            }
          }
          countsSeen.current = { tickets: body.tickets, escalations: body.escalations };
        })
        .catch(() => {
          /* chrome: a missed read is corrected by the next one */
        });
    read();
    const tick = () => {
      if (typeof document !== "undefined" && document.hidden) return;
      read();
    };
    const id = setInterval(tick, NOTIFY_POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [pathname]);

  if (pathname === "/platform/login") return null;

  const isActive = (item) =>
    item.exact ? pathname === item.href : pathname.startsWith(item.href);

  async function signOut() {
    await fetch("/api/platform/auth/logout", { method: "POST" });
    window.location.href = "/platform/login";
  }

  function Row({ item }) {
    const Icon = item.icon;
    // Which count this row wears, if any. Null draws nothing rather than a zero.
    const badge =
      item.badge === "review" ? reviewCount : item.badge === "signups" ? signupFlagCount : null;
    return (
      <Link
        href={item.href}
        // min-h-[44px] below lg: in the drawer every row is a thumb target.
        // From lg up the rail keeps py-2.5's 40px so sixty rows stay scannable.
        className={`flex items-center gap-3 px-3 py-2.5 min-h-[44px] lg:min-h-0 rounded-lg text-sm font-medium ${
          isActive(item)
            ? "bg-sidebar-primary text-sidebar-primary-foreground font-semibold"
            : "text-sidebar-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
        }`}
      >
        <Icon size={16} className="shrink-0" />
        <span className="truncate">{item.label}</span>
        {badge !== null && badge > 0 ? (
          // The selected fill's own foreground pair, so the pill measures the
          // same as the selected row — no new colour on this rail.
          <span className="ml-auto rounded-full bg-sidebar-primary text-sidebar-primary-foreground px-2 py-0.5 text-[11px] font-semibold tabular-nums" data-review-badge>
            {badge > 999 ? `${Math.floor(badge / 1000)}k` : badge}
          </span>
        ) : null}
      </Link>
    );
  }

  // ── The rail's contents, drawn twice ─────────────────────────────────────
  //
  // Once in the desktop <aside>, once in the phone drawer. Same rows, same
  // sign-out, same badges — the drawer additionally carries the close button
  // the tour presses (data-tour-close), exactly where AdminSidebar puts its.
  function railContent({ inDrawer = false } = {}) {
    return (
      <>
        <div className="flex items-center justify-between gap-2 px-3 pt-4 pb-4 shrink-0">
          {/* Orange as a FILL, not as text. #ff5a00 measures 5.62:1 on the old
              near-black but only 3.88:1 on --sidebar, so moving the rail to
              navy would have quietly pushed the wordmark under the floor — the
              exact "contrast assumed rather than measured" trade the rest of
              this fix is about. globals.css says the same thing about
              --brand-accent: as a fill with dark text on it, it is 5.59:1 and
              safe in both themes. */}
          <Wordmark />
          {inDrawer ? (
            <button
              type="button"
              onClick={() => setMobileOpen(false)}
              aria-label="Close menu"
              data-tour-close="platform-nav"
              className="inline-flex items-center justify-center min-h-[44px] min-w-[44px] -mr-2 rounded-lg text-sidebar-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
            >
              <X size={20} />
            </button>
          ) : null}
        </div>

        <nav className="space-y-4 flex-1 overflow-y-auto px-3 pb-2">
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

        <div className="px-3 pb-4 pt-2 shrink-0 border-t border-sidebar-border">
          <button
            onClick={signOut}
            className="w-full flex items-center gap-3 px-3 min-h-[44px] rounded-lg text-sm font-medium text-sidebar-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
          >
            <LogOut size={16} />
            Sign out
          </button>
        </div>
      </>
    );
  }

  return (
    <>
      {/* ── Phone top bar ─────────────────────────────────────────────────
          Below lg. Sticky and in normal flow — AdminSidebar's header explains
          why not a floating button: pages start at their padding, and a
          floating hamburger lands on the page's own <h1>. h-14 is the row;
          the safe-area inset pads ABOVE it. Painted --sidebar like the rail it
          stands in for, so the console keeps its dark chrome on a phone and
          is still not mistakable for the tenant app. */}
      <div
        data-platform-topbar
        className="lg:hidden sticky top-0 z-40 pt-[env(safe-area-inset-top)] text-sidebar-foreground border-b border-sidebar-border/60 bg-sidebar/80 supports-[backdrop-filter]:bg-sidebar/65 backdrop-blur-xl backdrop-saturate-150"
      >
        <div className="h-14 flex items-center gap-2 px-3">
          <button
            type="button"
            onClick={() => setMobileOpen(true)}
            aria-label="Open menu"
            aria-expanded={mobileOpen}
            // The one node a tour (or a check) opens the drawer through —
            // the same convention as AdminSidebar's [data-tour-open="nav"]
            // and SalesMobileTabBar's "sales-nav".
            data-tour-open="platform-nav"
            className="inline-flex items-center justify-center min-h-[44px] min-w-[44px] -ml-2 rounded-lg hover:bg-sidebar-accent"
          >
            <Menu size={20} />
          </button>
          <Link href="/platform" className="inline-flex items-center min-h-[44px] min-w-0" aria-label="Dashboard">
            <Wordmark />
          </Link>
          {/* The two counts that matter first thing, at the right edge and
              NOT inside the drawer: a badge you have to open a menu to see is
              a badge that never gets looked at (AdminSidebar's bell says the
              same). Each is the row's own link. */}
          <div className="ml-auto flex items-center gap-1">
            {signupFlagCount ? <TopBadge href="/platform/signup-origins" label="signups to review" count={signupFlagCount} /> : null}
            {reviewCount ? <TopBadge href="/platform/sales/review" label="rows in the review folder" count={reviewCount} /> : null}
          </div>
        </div>
      </div>

      {/* ── Desktop rail ──────────────────────────────────────────────────
          From lg up. Sticky for the viewport's height and scrolling its own
          sixty rows, so the group you want is reachable from the foot of a
          long page — it used to be min-h-screen in the flow, and on a tall
          companies list the rail had scrolled away with the page. */}
      <aside data-platform-rail className="hidden lg:flex w-60 shrink-0 bg-sidebar text-sidebar-foreground border-r border-sidebar-border h-screen sticky top-0 flex-col">
        {railContent()}
      </aside>

      {/* ── Phone drawer ──────────────────────────────────────────────────
          The shared slide-over (app/components/layout/NavDrawer.js), with
          the same rows the desktop rail draws. data-platform-drawer is what
          scripts/check-platform-mobile.mjs opens and closes. */}
      <NavDrawer open={mobileOpen} onClose={() => setMobileOpen(false)} label="Platform" safeArea panelAttrs={{ "data-platform-drawer": "" }}>
        {railContent({ inDrawer: true })}
      </NavDrawer>
    </>
  );
}

/** The "Platform" chip — one drawing for the rail, the drawer and the top bar. */
function Wordmark() {
  return (
    <span className="px-2 py-1 rounded-md bg-sidebar-primary text-sidebar-primary-foreground inline-flex items-center gap-2 self-start">
      <ShieldCheck size={16} />
      <span className="text-xs font-bold uppercase tracking-[0.18em]">Platform</span>
    </span>
  );
}

/** A count on the phone top bar, linking to the screen it counts. */
function TopBadge({ href, label, count }) {
  return (
    <Link
      href={href}
      aria-label={`${count} ${label}`}
      className="inline-flex items-center justify-center min-h-[44px] min-w-[44px] px-1"
    >
      <span className="rounded-full bg-sidebar-primary text-sidebar-primary-foreground px-2 py-0.5 text-[11px] font-semibold tabular-nums" data-review-badge>
        {count > 999 ? `${Math.floor(count / 1000)}k` : count}
      </span>
    </Link>
  );
}
