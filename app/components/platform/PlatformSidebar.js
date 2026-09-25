// app/components/platform/PlatformSidebar.js
//
// Nav for the internal console. Hides itself on /platform/login so the
// sign-in screen isn't wrapped in chrome for a session that doesn't exist yet.
//
// ── Grouped by whose money and whose data, not by which feature shipped ──────
//
// This used to be one flat list of twenty-one rows in file order — the order
// features shipped in, not an order anyone would choose on purpose. It was
// then grouped by the job a staffer was doing (Companies / Support / Billing /
// Demos & sales / FieldQuo's own systems / Admin), and that held until the
// sales machinery arrived: "Demos & sales" grew to twenty-five rows, and the
// money rows split across three groups — Subscriptions under Companies, Plans
// under Billing, Costs and Sales payouts under two others. The owner,
// 2026-09-19: "the side menu seems all bunched up — it's hard to distinguish
// earnings from expenditure, and sales team, and /app, and FieldQuo's own."
//
// So the groups now answer that sentence directly, in this order:
//
//   Earnings         — money coming IN. What FieldQuo charges (Plans,
//                      Promotions, Promo codes), who is paying it
//                      (Subscriptions), how that is trending (Growth) and
//                      the exports of it (Reports).
//   Spending         — money going OUT. Costs first (the total), then one
//                      row per thing paid for: OpenAI, Retell's per-minute
//                      economics and its numbers, Twilio's numbers, and the
//                      sales team's commission plans and payouts. Payouts
//                      and commission plans are here and not under Sales
//                      team on purpose — the rep's screen answers "who works
//                      here"; this shelf answers "what do they cost".
//   Companies (/app) — the contractors' own accounts: the customer list, the
//                      signups that never finished and where each came from,
//                      the paid migrations into a tenant, the feature flags
//                      per company, and the demo fixture accounts with their
//                      bookings and calendar (a demo account IS an /app
//                      company, one of ours).
//   Sales team       — the reps as people at work: who they are, the floor
//                      right now, the period's performance, call quality,
//                      the funnel, what they wrote and said, the calling
//                      windows they must obey, and the two lists their
//                      queue drains into (Review folder, Retry pool).
//   Lead data        — what the reps work FROM, none of it a person: the
//                      prospects, the campaigns that discover them, the
//                      snapshot library, and the five tables that decide
//                      which pitch a prospect gets (capability matrix,
//                      opportunity rules, playbooks, confidence weights,
//                      technology signatures) plus the do-not-contact list
//                      those pitches are gated by.
//   Support          — what needs a person today: tickets, escalations,
//                      Jennifer's hand-offs, deletion requests, errors.
//                      Read daily, not configured.
//   FieldQuo's own systems — our own plumbing, no customer's data at all:
//                      the inbound line that answers on FieldQuo's behalf,
//                      Retell's webhooks, the service catalogue every
//                      onboarding reads, the audit log, the runbook, the
//                      platform team and the admin's own settings. Analytics
//                      (fieldquo.com's own traffic and /app usage) stays
//                      here too: it is FieldQuo's count of itself, neither a
//                      customer's data nor a dollar.
//
// Every row that existed before the regroup still exists, once, under one of
// those seven; none was added. The per-row comments below were carried over
// and re-anchored where their old neighbour moved.
//
// Dashboard stays OUTSIDE every group and renders first, same reasoning as
// AdminSidebar's HOME_ITEM: it's where you land, not a category member, and
// a lone "Overview" group holding one row is the "group of one" this exact
// audit flags everywhere else.
//
// Each group carries a one-line `description`, shown as the heading's title
// on hover — "Money coming in", "What FieldQuo pays" — so the split is
// STATED on the rail itself, not inferred from which rows sit together.
//
// ── Collapsible groups, on the shared disclosure rules ──────────────────────
//
// The old header comment here said "no collapse/disclosure — twenty rows in
// six short groups reads fine without folding … if this list keeps growing,
// that's the next thing to add". It grew to fifty-four. Headings are now
// buttons that fold their group, on the SAME machinery the two /app sidebars
// use (app/components/layout/navDisclosure.js + useGroupDisclosure in
// NavFilter.js) rather than a private copy, because that module carries the
// one promise that matters — folding a group is never the reason a page is
// unreachable — and scripts/check-sidebar.mjs proves it against the real
// functions. What that buys here:
//
//   - Every group is open by default. A new admin sees the whole console; a
//     fold is a choice, remembered.
//   - The group holding the current route is opened on every load and every
//     route change, whatever is stored — a deep link never lands you in a
//     folded group. It is a LOAD-time rule, not a render-time one: forced open
//     on every render, the heading of the group you are in would be a button
//     that does nothing (navDisclosure.js says the same).
//   - The preference is per admin: the storage key carries the admin's id
//     (from /api/platform/me), so two admins on one machine do not share
//     folds. The id is remembered beside it so the key is known before the
//     fetch answers and the rail does not redraw once it does. localStorage
//     only, inside try/catch — a private window, a quota, a hand-edited value
//     all fall back to "everything open".
//   - Keyboard: each heading is a real <button aria-expanded>, so Tab reaches
//     it and Space/Enter fold it. The chevron turns; the heading keeps the
//     same tokens as the rows (text-sidebar-muted-foreground on --sidebar,
//     hover on --sidebar-accent), which check-platform-console.mjs measures
//     in both themes.
//   - The drawer folds the same groups: railContent() is drawn once for both,
//     so the rail and the drawer cannot disagree about what is open.
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
// ── Below lg: a top bar and a drawer, not a 240px rail ──────────────────────
//
// The owner, 2026-09-13: "the platform is not mobile friendly". Measured
// (docs/screens/platform-mobile/before/audit.json): this <aside> kept its
// w-60 at every width, so on a 375px phone <main> was 135px wide and every
// screen rendered as a 240px navy column beside a strip of squeezed text.
// Below lg it is now the /app model — AdminSidebar's sticky top bar with a
// hamburger, and a slide-over drawer (app/components/layout/NavDrawer.js,
// the same container the /app and /sales sidebars render) carrying the same
// rows and the sign-out. From lg up the rail is what it was, now sticky for
// the viewport and scrolling its own rows.
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
import { useGroupDisclosure } from "@/app/components/layout/NavFilter";
import { activeGroupKey, isGroupOpen } from "@/app/components/layout/navDisclosure";
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
  ClipboardCheck,
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
  Coins,
  Trash2,
  Inbox,
  Clock3,
  Globe,
  ChevronDown,
  Menu,
  X,
} from "lucide-react";

/** How often the console re-reads its two counts while the tab is visible. */
const NOTIFY_POLL_MS = 60 * 1000;

/**
 * Where the fold state lives, and the admin it belongs to.
 *
 * DISCLOSURE_KEY_PREFIX + ":" + the admin id is the key useGroupDisclosure
 * reads and writes; ADMIN_ID_KEY remembers which admin this browser last
 * signed in as, so the per-admin key is known on the very first effect —
 * before /api/platform/me has answered — and a returning admin's folds are
 * drawn on the first paint rather than a beat later. A first visit, or a
 * browser that refuses storage, uses the bare prefix until the id arrives.
 */
const DISCLOSURE_KEY_PREFIX = "fq-platform-groups";
const ADMIN_ID_KEY = "fq-platform-admin";

const HOME_ITEM = { label: "Dashboard", href: "/platform", icon: LayoutDashboard, exact: true };

const GROUPS = [
  {
    key: "earnings",
    label: "Earnings",
    description: "Money coming in: what FieldQuo charges, who pays it, and how that is growing",
    items: [
      // Who is paying, on what plan, in what state — the list the four rows
      // below it price, discount and export.
      { label: "Subscriptions", href: "/platform/billing/subscriptions", icon: BarChart3 },
      { label: "Plans", href: "/platform/billing/plans", icon: CreditCard },
      // Directly under Plans, and a separate row rather than a panel on that
      // page: Plans edits what we charge permanently, Promotions is a dated
      // rule that crosses every plan and expires. One screen holding both is
      // the screen where somebody changes a price intending to run a sale.
      { label: "Promotions", href: "/platform/billing/promotions", icon: Percent },
      { label: "Promo codes", href: "/platform/promo-codes", icon: Ticket },
      // The trend of the three rows above: MRR, churn, the growth model. Was
      // filed with the sales rows because reps drive it; it is filed with the
      // money it measures now, because that is what the owner opens it for.
      { label: "Growth", href: "/platform/growth", icon: TrendingUp },
      // Exports of company/subscription/growth data — read as "the rows
      // above, in bulk": two of its three CSVs are literally Subscriptions
      // and Growth.
      { label: "Reports", href: "/platform/reports", icon: FileSpreadsheet },
    ],
  },
  {
    key: "spending",
    label: "Spending",
    description: "What FieldQuo pays: vendors, phone numbers, and the sales team's commission",
    items: [
      // What FieldQuo PAYS — Twilio, OpenAI, Retell — by day, week and
      // month, and what it buys: cost per conversation and per signup, per
      // rep and per agency. First in this group because it is the question
      // the group exists to answer; the rows below it are one cost each.
      // Superadmin-only (the API refuses everyone else).
      { label: "Costs", href: "/platform/costs", icon: Coins },
      { label: "AI usage", href: "/platform/ai-usage", icon: Sparkles },
      // The endpoint behind this had no screen at all — it turned up in the
      // routes-with-no-caller sweep (scripts/check-route-callers.mjs). It is
      // the one Retell row that answers "should we change the price" rather
      // than "is something broken", and the concurrency figure on it is the
      // one nobody thinks to look for until an inbound call has already
      // failed.
      { label: "Voice economics", href: "/platform/voice-economics", icon: Gauge },
      // FieldQuo's Retell estate. Answers the question neither a tenant
      // screen nor our own tables can: which numbers is Retell billing this
      // account for that nobody holds. A released row that never reached the
      // provider is invisible everywhere else and costs money monthly —
      // which is why it is a Spending row. "Retell numbers (voice)" rather
      // than "Voice numbers" since 2026-09-19: named by the vendor billing
      // for them, beside the Twilio row named the same way, so the owner can
      // tell the two phone estates apart from the label alone.
      { label: "Retell numbers (voice)", href: "/platform/voice-numbers", icon: PhoneOff },
      // FieldQuo's Twilio estate: which numbers we hold, who we've lent each
      // one to, and where its texts are really being delivered — plus the
      // screen that BUYS one. It moved here off /app/crew-inbox, where a
      // contractor was being shown our inbound webhook URL and clicking it.
      // Was "Crew lines" until 2026-09-19, when the owner could not find
      // where to buy the outbound SMS number because nothing in that label
      // said Twilio or said "buy". The page's own H1 says the same words.
      {
        label: "Twilio numbers",
        title: "Crew inboxes, sales reps' numbers, the system outbound number — buy and audit",
        href: "/platform/crew-lines",
        icon: MessageSquareText,
      },
      // What FieldQuo owes each rep by week or month, the closed batches to
      // pay, and — once a person has paid one through Wise or Interac — where
      // and when, with the receipt. No money moves from it; lib/sales/payouts.js
      // says why. A Spending row, not a Sales team row: the reps' screens
      // answer "who works here"; this one answers "what do they cost".
      { label: "Sales payouts", href: "/platform/sales/payouts", icon: Receipt },
      // Under the payouts it produces. SalesCommissionPlan decides every
      // figure in a rep's ledger and had NO screen and no create path
      // anywhere in the product: amountForMilestone() returns null without a
      // plan and earnMilestone() refuses a null amount, so an unassigned rep
      // earned $0 on every milestone, silently. "Commission plans" rather
      // than "Plans" on purpose — Earnings' Plans row is what FieldQuo
      // CHARGES a contractor, and the two answering to one word is how
      // somebody edits the wrong one.
      { label: "Commission plans", href: "/platform/sales/plans", icon: HandCoins },
    ],
  },
  {
    key: "companies",
    label: "Companies (/app)",
    description: "The contractors' own accounts: who signed up, what they have on, and our demo fixtures",
    items: [
      { label: "Companies", href: "/platform/companies", icon: Building2 },
      // Directly under Companies, because it is the population Companies now
      // deliberately excludes from its counts: somebody who started a signup
      // and never gave a card. Filed here rather than under Sales team even
      // though a rep is who calls them — the row IS a company record, and
      // the person looking for it is thinking "who signed up and didn't
      // finish", which is a question about the customer list.
      { label: "Signups", href: "/platform/signups", icon: DoorOpen },
      // Where each signup's request came from and the flag decided on it
      // (outside CA/US, stated-country mismatch, repeat IP). The badge is the
      // number waiting for review — the owner asked for a FIRST-level flag,
      // seen without opening anything. Same family as the row above: a
      // question about the customer list, not about the sales team, even
      // though a rep's link is the case it exists for.
      { label: "Signup origins", href: "/platform/signup-origins", icon: Globe, badge: "signups" },
      // The paid data-migration service — a company's request, the quote, and
      // (once paid) the ONE write path onto a customer's own tenant data.
      // Sits with Companies rather than Earnings even though it is paid for:
      // it is a one-off job for one company, and the person who'd look for
      // it is already thinking "this company", not "our price list".
      { label: "Migrations", href: "/platform/migrations", icon: ArrowUpDown },
      // Which features are on for which company. Was under Billing because
      // "is this on for them" is asked in the same breath as "what plan are
      // they on" — it now sits with the companies it is asked about. It
      // edits FieldQuo's own data — see the page header.
      { label: "Features", href: "/platform/features", icon: ToggleLeft },
      // The demo fixture accounts are /app companies — ours, ten of them, one
      // per rep — so they file with the companies rather than with the reps.
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
    key: "salesTeam",
    label: "Sales team",
    description: "The reps: who they are, what the floor is doing now, and how each is performing",
    items: [
      // FieldQuo's own salespeople — invite one, deactivate one, see how many
      // companies each brought in. First, because every other row in the
      // group is about what these people did. Filing them with "who holds a
      // platform login" would put the people beside the console's own keys,
      // which is a different question.
      { label: "Sales reps", href: "/platform/sales/reps", icon: UserRoundCheck, badge: "repSetup" },
      // What the floor is doing RIGHT NOW, as opposed to what it sold. Placed
      // above performance because it is the screen somebody opens at 10am and
      // performance is the one they open on a Monday: one is a board you watch,
      // the other is a period you read.
      { label: "Sales floor", href: "/platform/sales/floor", icon: Headphones },
      // The owner asked "where do i see the sales KPIs? and insights.. and the
      // leads?" and the honest answer was nowhere: SalesAttribution,
      // SalesCommissionEntry, SalesPayoutBatch and SalesLead all existed with
      // no screen over any of them. A row here rather than a panel on the reps
      // page because the two answer different questions — that one is "who
      // works here and can they send", this one is "what did they sell".
      { label: "Sales performance", href: "/platform/sales/performance", icon: TrendingUp },
      // The review queue behind the performance page's "Call quality"
      // section: the recording, the flagged transcript, the scorecard, and
      // the owner's own pass — lib/sales/calls/qaQueue.js.
      { label: "Call quality", href: "/platform/sales/call-quality", icon: ClipboardCheck },
      // Per rep per month, dial to retained-at-60-days, with the owner's
      // bands and the ramp — the screen performance's "what did they sell"
      // does not answer, which is "how many calls did that take".
      { label: "Sales funnel", href: "/platform/sales/funnel", icon: Filter },
      // Beside performance, because it is the same question asked the other
      // way round: performance is what a rep sold, this is what they heard.
      // Superadmin only, read-only, and the screen itself says so — reps are
      // told on their own compose screen that this exists, which is the whole
      // reason it is allowed to.
      { label: "Sales notes", href: "/platform/sales/notes", icon: NotebookPen },
      // Beside the notes, because it is the same act one step further: what
      // a rep actually SAID to a prospect, by text and by email, read by the
      // owner. Superadmin-only ("chat:audit"), read-only, and the rep sees
      // "Reviewed by the owner" on the thread — lib/sales/conversationAudit.js.
      { label: "Rep conversations", href: "/platform/sales/conversations", icon: MessageSquareText },
      // How hard each state's calling window and 24-hour cap are applied on
      // the rep's screens — enforce, warn only, off — laid over the law in
      // lib/sales/callingRules.js. A rule about when a REP may dial, so it
      // sits with the reps; the registration list that gates it lives on
      // Discovery campaigns (Lead data), and a registration outstanding holds
      // every override at enforce.
      { label: "Calling windows", href: "/platform/sales/windows", icon: Clock3 },
      // The rows discovery could not finish: contractors with no trade,
      // rows the classifier could not place, possible duplicates — every
      // campaign in one list, with a trade picker. Here rather than under
      // Lead data because it is a queue a PERSON works, and the badge is the
      // number waiting (superadmin only; the count route answers null for
      // anyone else and no badge is drawn).
      { label: "Review folder", href: "/platform/sales/review", icon: Inbox, badge: "review" },
      // The other list a rep's queue drains into: prospects the retry rule
      // has finished with (four no-answers, three voicemails —
      // lib/sales/retryRules.js). Under the review folder because it is the
      // same kind of screen — rows that left the pool and a superadmin
      // deciding whether they go back — and the rule table is printed beside
      // them so the owner can read the numbers the queue is ordered by.
      { label: "Retry pool", href: "/platform/sales/retry-pool", icon: RotateCcw },
      // The second pass on outcomes: the sub-reason lists under each one,
      // the callback agenda (due, overdue, per rep), and the settings behind
      // the service level, the transcription and review samples and
      // answering-machine detection — each with its cost printed beside it.
      // docs/SALES-OUTCOMES.md.
      { label: "Outcomes", href: "/platform/sales/outcomes", icon: ListChecks },
    ],
  },
  {
    key: "leadData",
    label: "Lead data",
    description: "What the reps work from: prospects, the campaigns that find them, and the rules that pick a pitch",
    items: [
      // What the campaigns actually produced, first: it is where the owner
      // checks whether discovery is working rather than merely running.
      { label: "Prospects", href: "/platform/sales/prospects", icon: Contact },
      // Where the prospects come from: a campaign is one territory, one trade
      // and one target, and the single-trade queue it produces is the whole
      // reason it is a campaign rather than a filter.
      { label: "Discovery campaigns", href: "/platform/sales/campaigns", icon: Radar },
      // Directly under campaigns, because it is the one thing a campaign needs
      // that a campaign cannot ask for: the public base URL of the bucket the
      // snapshot files were uploaded to. Set once. Every campaign's snapshot
      // URL is derived from it and from the object key in the measured library,
      // which is why no campaign form has a URL field any more.
      { label: "Snapshot library", href: "/platform/sales/snapshots", icon: Database },
      // What a rep is allowed to promise. Here rather than under Earnings,
      // even though it reads like a feature list: a row here is not a thing
      // FieldQuo sells at a price, it is a sentence somebody says on a phone
      // call, and the person who edits it is thinking about the call. Every
      // recommendation a prospect ever gets has a foreign key into this
      // table, so it needs to be somewhere findable rather than reachable only
      // from whichever screen happens to link it.
      { label: "Capability matrix", href: "/platform/sales/capabilities", icon: ListChecks },
      // The tables that decide what a rep is told about a prospect, next to
      // the matrix they all depend on. Rules first: it is the one somebody
      // opens after reading the matrix and asking "so when does a rep
      // actually get told this".
      { label: "Opportunity rules", href: "/platform/sales/rules", icon: GitBranch },
      // What a rep actually SAYS, built out of what the rules found. One entry
      // rather than three: the playbooks, the objection library and the
      // experiments are one screen, because nobody edits an objection response
      // without thinking about the call it comes up in.
      { label: "Playbooks", href: "/platform/sales/playbooks", icon: BookOpenCheck },
      { label: "Confidence weights", href: "/platform/sales/confidence", icon: SlidersHorizontal },
      { label: "Technology signatures", href: "/platform/sales/signatures", icon: Fingerprint },
      // FieldQuo's OWN do-not-contact list — the people who told us to stop.
      // Filed with the lead data rather than under Support because it is
      // read by the outbound paths those rows drive, not by a support agent
      // answering a ticket. It is emphatically NOT a tenant's opt-out list:
      // CallConsent and MarketingSubscriber are a company's relationship with
      // a homeowner and are not visible from the console at all.
      { label: "Do-not-contact", href: "/platform/suppressions", icon: Ban },
    ],
  },
  {
    key: "support",
    label: "Support",
    description: "What needs a person today: tickets, escalations, Jennifer's hand-offs, errors",
    items: [
      // The same rooms a rep sees at /sales/team. Beside Escalations on
      // purpose: an escalation is a ticket about one company, and this is the
      // conversation that usually happens either side of raising one.
      { label: "Team chat", href: "/platform/chat", icon: MessageSquare },
      // Escalations from sales reps — the only channel in the product through
      // which a customer's technical problem reaches FieldQuo from the person
      // who heard it. The one with somebody waiting on the other end of it.
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
    key: "own",
    label: "FieldQuo's own systems",
    description: "Our own plumbing, no customer's data: the inbound line, webhooks, the catalogue, the audit log, this login",
    items: [
      // FieldQuo's OWN phone agent, not a tenant's receptionist. Nowhere near
      // Companies for exactly that reason — this row is about what FieldQuo
      // says on its own line, and putting it beside the company list is how
      // somebody opens it expecting a customer's receptionist.
      // "Sales agent" until the owner asked what Retell had to do with the
      // sales team — which is the question the label invites. It is FieldQuo's
      // INBOUND line: the AI that answers when a contractor a rep called rings
      // the number back. It is not the reps' dialler (that is Twilio, and it
      // lives on the rep console), and it is not the AI employee a tenant
      // gets. The word doing the work is "inbound".
      { label: "Inbound sales line", href: "/platform/sales-agent", icon: PhoneCall },
      // Was linked ONLY from the phone-pool alert banner on /platform's own
      // dashboard (app/platform/page.js), and only when that alert was firing
      // — so the moment nobody's webhook was broken, there was no way into
      // this page at all. Answers "what is Retell actually doing with this
      // account" for where call events land; the numbers it bills for are a
      // Spending row (Retell numbers).
      { label: "Voice webhooks", href: "/platform/voice-webhooks", icon: Webhook },
      // Whether texts actually ARRIVED — carrier receipts per number, per
      // company, per error code (30034 = an unregistered A2P 10DLC number).
      // Beside voice webhooks because it is the same kind of question: is
      // the provider's side doing what our side believes it did.
      { label: "SMS delivery", href: "/platform/sms-health", icon: MessageSquareText },
      // Where fieldquo.com's traffic goes, the signup funnel, which /app
      // screens are used and by how many companies. FieldQuo's own count
      // (lib/analytics/product/), so it sits with FieldQuo's own systems.
      { label: "Analytics", href: "/platform/analytics", icon: BarChart3 },
      // The catalogue every company's onboarding reads from.
      { label: "Service categories", href: "/platform/service-categories", icon: Tags },
      // The record of what platform staff did, the reference doc, and who
      // else holds a platform login. Configured rarely, read for context.
      { label: "Audit log", href: "/platform/audit-log", icon: ScrollText },
      { label: "Support runbook", href: "/platform/help", icon: LifeBuoy },
      { label: "Platform team", href: "/platform/team", icon: ShieldCheck },
      // The admin's OWN preferences — browser notifications for new tickets
      // and escalations. Last: it is about the person at the console, not
      // about any company.
      { label: "My settings", href: "/platform/settings", icon: UserCog },
    ],
  },
];

/** Every group open unless the admin folded it — a new admin sees the whole console. */
const DEFAULT_OPEN = GROUPS.map((g) => g.key);

/** The admin id this browser last signed in as, if storage will say. */
function readRememberedAdminId() {
  try {
    const raw = window.localStorage.getItem(ADMIN_ID_KEY);
    return raw && /^[\w-]{1,64}$/.test(raw) ? raw : null;
  } catch {
    return null;
  }
}

function rememberAdminId(id) {
  try {
    window.localStorage.setItem(ADMIN_ID_KEY, id);
  } catch {
    /* nothing to do — the folds fall back to the shared key */
  }
}

/** The localStorage key the folds live under: per admin once the id is known. */
export function disclosureStorageKey(adminId) {
  return adminId ? `${DISCLOSURE_KEY_PREFIX}:${adminId}` : DISCLOSURE_KEY_PREFIX;
}

/** Every row in every group — the lookup activeGroupKey() and the checks read. */
const ALL_ITEMS = GROUPS.flatMap((g) => g.items);

/** Whether a row is the current route: exact where the row says so, prefix otherwise. */
function isActive(item, pathname) {
  return item.exact ? pathname === item.href : pathname.startsWith(item.href);
}

// ── Row and GroupHeading live at module level on purpose ────────────────────
//
// Declared INSIDE the component they would be a new function identity on every
// render, and React would unmount and remount every row and heading each time
// a count arrived or a group folded. For a heading that is a keyboard fault:
// press Enter, the group folds, the re-render replaces the button under the
// caret, and focus falls to <body>. scripts/check-sidebar-focus.mjs names the
// same fault on AdminSidebar. So both take what they need as props.

/** A pill in the selected fill's own pair — the same one on rows, headings and the top bar. */
function CountPill({ count, className = "" }) {
  return (
    <span className={`${className} rounded-full bg-sidebar-primary text-sidebar-primary-foreground px-2 py-0.5 text-[11px] font-semibold tabular-nums normal-case tracking-normal`} data-review-badge>
      {count > 999 ? `${Math.floor(count / 1000)}k` : count}
    </span>
  );
}

function Row({ item, pathname, badge }) {
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      // A row may carry a longer sentence than its label has room for —
      // "Twilio numbers" says what, the title says which numbers and that
      // this is where one is bought. Undefined for the rest: no attribute.
      title={item.title}
      // min-h-[44px] below lg: in the drawer every row is a thumb target.
      // From lg up the rail keeps py-2.5's 40px so sixty rows stay scannable.
      className={`flex items-center gap-3 px-3 py-2.5 min-h-[44px] lg:min-h-0 rounded-lg text-sm font-medium ${
        isActive(item, pathname)
          ? "bg-sidebar-primary text-sidebar-primary-foreground font-semibold"
          : "text-sidebar-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
      }`}
    >
      <Icon size={16} className="shrink-0" />
      <span className="truncate">{item.label}</span>
      {/* The selected fill's own foreground pair, so the pill measures the
          same as the selected row — no new colour on this rail. */}
      {badge !== null && badge > 0 ? <CountPill count={badge} className="ml-auto" /> : null}
    </Link>
  );
}

// ── A group's heading: a button that folds it ──────────────────────────────
//
// The same tokens as an idle row (text-sidebar-muted-foreground on
// --sidebar, the accent pair on hover) so the heading measures exactly what
// the rows measure in both themes — no new colour on this rail. The
// description rides on `title`, so hovering the heading says what the group
// IS ("Money coming in…") rather than leaving it to be inferred from the rows
// underneath. aria-expanded is the fold state, so a screen reader hears
// "Spending, button, collapsed"; the chevron is decoration and hidden from it.
function GroupHeading({ group, open, foldedBadge, onToggle }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-expanded={open}
      aria-controls={`platform-group-${group.key}`}
      title={group.description}
      data-platform-group={group.key}
      className="w-full flex items-center gap-1.5 px-3 py-1.5 min-h-[44px] lg:min-h-0 mb-1 rounded-lg text-[10px] font-semibold uppercase tracking-[0.12em] text-sidebar-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground transition-colors"
    >
      <span className="truncate">{group.label}</span>
      {foldedBadge > 0 ? <CountPill count={foldedBadge} className="ml-auto" /> : null}
      <ChevronDown
        size={13}
        aria-hidden="true"
        className={`${foldedBadge > 0 ? "" : "ml-auto"} shrink-0 transition-transform ${open ? "" : "-rotate-90"}`}
      />
    </button>
  );
}

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
  // The third, same lifecycle: reps an agency added (or a superadmin moved
  // under one) who still have no phone number or no work mailbox. This used
  // to be a PlatformErrorLog row that nobody cleared — see
  // app/api/platform/sales/reps/count for why it is a derived badge now. It
  // goes away on its own when both are assigned.
  const [repSetupCount, setRepSetupCount] = useState(null);
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
    readCount("/api/platform/sales/reps/count", setRepSetupCount);
    return () => {
      cancelled = true;
    };
  }, [pathname]);

  // ── Whose folds these are ──────────────────────────────────────────────
  //
  // Null on the server and on the first client render (both must agree), the
  // remembered id from storage on the first effect, and the id
  // /api/platform/me answers once it has — which only differs from the
  // remembered one when a different admin signed in on this browser. Read
  // once per mount, not per route: the sidebar lives in the layout, so this
  // is one small request per full page load.
  const [adminId, setAdminId] = useState(null);
  useEffect(() => {
    if (pathname === "/platform/login") return undefined;
    const remembered = readRememberedAdminId();
    if (remembered) setAdminId(remembered);
    let cancelled = false;
    fetch("/api/platform/me")
      .then((res) => (res.ok ? res.json() : null))
      .then((body) => {
        const id = typeof body?.id === "string" && /^[\w-]{1,64}$/.test(body.id) ? body.id : null;
        if (cancelled || !id || id === remembered) return;
        rememberAdminId(id);
        setAdminId(id);
      })
      .catch(() => {
        /* the shared key is a fine answer; the rail still works */
      });
    return () => {
      cancelled = true;
    };
    // Once per mount on purpose — see above.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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

  // The group holding the current route, by the same rule the rows light up
  // with (exact for Demo accounts, prefix for the rest) — so the group that
  // opens is the group whose row is painted selected, never a neighbour whose
  // href happens to be a prefix.
  const activeKey = activeGroupKey(GROUPS, pathname, (href) => {
    const item = ALL_ITEMS.find((i) => i.href === href);
    return item ? isActive(item, pathname) : false;
  });
  // Hooks run on every render, including the login screen's, so this sits
  // above the early return below rather than after it.
  const { openKeys, toggle } = useGroupDisclosure({
    storageKey: disclosureStorageKey(adminId),
    defaultOpenKeys: DEFAULT_OPEN,
    activeKey,
  });

  if (pathname === "/platform/login") return null;

  async function signOut() {
    await fetch("/api/platform/auth/logout", { method: "POST" });
    window.location.href = "/platform/login";
  }

  // Which count a row wears, if any. Null draws nothing rather than a zero.
  const badgeFor = (item) =>
    item.badge === "review" ? reviewCount : item.badge === "signups" ? signupFlagCount : item.badge === "repSetup" ? repSetupCount : null;

  // ── The rail's contents, drawn twice ─────────────────────────────────────
  //
  // Once in the desktop <aside>, once in the phone drawer. Same rows, same
  // sign-out, same badges, same folds — the drawer additionally carries the
  // close button the tour presses (data-tour-close), exactly where
  // AdminSidebar puts its.
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
          <Row item={HOME_ITEM} pathname={pathname} badge={null} />

          {GROUPS.map((group) => {
            const open = isGroupOpen({ group, openKeys });
            // A folded group's badge would vanish with its rows, and a badge
            // you have to unfold a group to see is a badge that never gets
            // looked at — so the sum of the folded group's counts rides on
            // the heading instead. Zero while open: the rows carry their own.
            const foldedBadge = open
              ? 0
              : group.items.reduce((sum, item) => {
                  const n = badgeFor(item);
                  return sum + (n !== null && n > 0 ? n : 0);
                }, 0);
            return (
              <div key={group.key}>
                <GroupHeading group={group} open={open} foldedBadge={foldedBadge} onToggle={() => toggle(group.key)} />
                {open ? (
                  <div className="space-y-1" id={`platform-group-${group.key}`}>
                    {group.items.map((item) => (
                      <Row key={item.href} item={item} pathname={pathname} badge={badgeFor(item)} />
                    ))}
                  </div>
                ) : null}
              </div>
            );
          })}
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
            {repSetupCount ? <TopBadge href="/platform/sales/reps" label="reps waiting for a number and a mailbox" count={repSetupCount} /> : null}
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
      <CountPill count={count} />
    </Link>
  );
}
