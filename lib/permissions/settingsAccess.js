// lib/permissions/settingsAccess.js
//
// Which settings screens a member may OPEN, and which they may CHANGE.
//
// ── This is not a second permission vocabulary ──────────────────────────────
//
// Every capability below resolves through a gate that already exists and is
// already what the API routes check:
//
//   "user:manage"     → can(role, "user:manage")            lib/permissions.js
//   "workarea:assign" → can(role, "workarea:assign")        lib/permissions.js
//   "billing"         → isBillingAdmin(role)                lib/billing/billingAdmin.js
//   "payroll"         → isPayrollAdmin(role)                here, imported by the route
//
// Nothing here invents a new permission string, and nothing here is the
// security boundary. Hiding a sidebar row is a UX fix; the route it points at
// refuses the same person whether or not the row was ever drawn. AGENTS.md is
// explicit about that, and the check script asserts the pairing rather than
// trusting this comment.
//
// ── Why "billing" and "payroll" are role predicates, not permission strings ─
//
// PERMISSIONS.owner/admin are ["*"], so any string at all would resolve true
// for them and false for a supervisor — which happens to be the right answer,
// and is exactly why it would be a trap. `can(role, "billing:manage")` would
// look like a declared permission while being a coincidence of the wildcard.
// isBillingAdmin() states the rule instead, and billingAdmin.js already
// explains why holding "user:manage" must not carry authority over the
// company's card.
//
// ── Impersonation ──────────────────────────────────────────────────────────
//
// A read-only support session (role "viewer") holds no permission at all, so
// the naive answer would hide almost every settings screen from the platform
// console. That contradicts non-negotiable #3: the console views everything and
// edits nothing. So canSee() waves impersonation through and canChange() always
// refuses it — which lands a support admin on the same read-only rendering an
// employee gets, instead of live-looking inputs whose saves the server rejects.

import { can } from "@/lib/permissions";
import { isBillingAdmin } from "@/lib/billing/billingAdmin";
import { hasLevel, hasToggle } from "./enforce";

/**
 * Who may see or change payroll deductions and payslip components.
 *
 * Its own predicate rather than a reuse of isBillingAdmin: the two happen to
 * agree today (owner/admin), but they answer different questions — one is
 * "may you spend the company's money on FieldQuo", the other is "may you see
 * what lands in someone's bank account". Collapsing them would mean a future
 * change to one silently changing the other.
 *
 * app/api/settings/payroll-components/route.js imports this rather than
 * keeping the copy it used to have.
 */
export function isPayrollAdmin(role) {
  return role === "owner" || role === "admin";
}

/** capability → does this role hold it. */
const CAPABILITIES = {
  "user:manage": (role) => can(role, "user:manage"),
  "workarea:assign": (role) => can(role, "workarea:assign"),
  billing: (role) => isBillingAdmin(role),
  payroll: (role) => isPayrollAdmin(role),
  // Owner-or-admin, for screens that are neither the company's card nor
  // anyone's payslip. Two routes gate exactly on that set and on nothing else —
  // /api/activity ("Only an owner or admin can view the activity log.") and
  // /api/settings/leave-policies ("Only an owner or admin can manage leave
  // policies.") — and both used to borrow "billing" because it happened to
  // resolve the same way. That worked and read as a mistake, which is its own
  // cost: the next person to change what a billing admin is would have silently
  // changed who can read the activity log. Named for what it is instead.
  "owner-admin": (role) => role === "owner" || role === "admin",
  // Not a gate — a DECLARATION. Since SETTINGS_ROW_CAPABILITY became
  // deny-by-default (see canSeeSettingsRow), "this row is for everybody" can no
  // longer be expressed by leaving the row out of the map; absence now means
  // hidden. A row that genuinely belongs to every member says so out loud, and
  // scripts/check-settings-access.mjs fails the build when a row says nothing
  // at all.
  //
  // Written as a predicate rather than special-cased in holdsCapability so it
  // travels through canSee/canChange like any other capability and needs no
  // branch anywhere.
  everyone: () => true,
};

export const SETTINGS_CAPABILITIES = Object.keys(CAPABILITIES);

/**
 * The `app.settings.*` keys in SettingsSidebar that are NOT navigable rows.
 *
 * `title` is the sidebar's own <h1> and the "you are here" label on the mobile
 * bar; `search` is the filter box's placeholder. Both were counted as ungated
 * rows in an audit of this file, which is what this list exists to stop
 * happening again — a rule attached to a heading is noise, and the reader who
 * finds one reasonably concludes the map is guesswork.
 *
 * The completeness check subtracts these before demanding a capability, and
 * asserts they are still chrome (no href) rather than trusting this comment.
 */
export const SETTINGS_SIDEBAR_CHROME_KEYS = [
  "app.settings.title",
  "app.settings.search",
];

/**
 * EVERY settings sidebar row, and who it is for. Keyed by the row's i18n key,
 * which is what SettingsSidebar carries as data and what
 * scripts/check-settings-access.mjs parses back out.
 *
 * ── This map used to be a deny-list, and that was the bug ──────────────────
 *
 * It listed only the rows to HIDE, and canSeeSettingsRow fell through to
 * `return true` for anything absent. Sixteen rows had a rule; the other twenty
 * were visible to every member of every company because nobody had written a
 * line about them — not as a decision, as an omission. Some of those omissions
 * were deliberate at the time and written up; most were simply rows that got
 * added later than the sweep. Nothing in the code could tell the two apart,
 * which is the whole problem: the file read as complete and was not.
 *
 * So the default is inverted. An unlisted row is HIDDEN (canSeeSettingsRow),
 * and every row carries an explicit answer — including "everyone", which is now
 * something you say rather than something you omit.
 *
 * ── Deny-by-default alone would be a worse bug ─────────────────────────────
 *
 * Flipping the default without a completeness check trades an open row for an
 * invisible one. Row 37 gets added, nobody touches this file, and the screen
 * silently never appears for anyone below owner — which reads as a broken
 * product and is far harder to notice than an extra row. So the two halves
 * ship together: scripts/check-settings-access.mjs parses SettingsSidebar and
 * FAILS when a row has no entry here. `npm run check:settings-access` is in
 * check:all. Do not weaken one half without removing the other.
 *
 * ── How to pick a value ────────────────────────────────────────────────────
 *
 * Read it off the ROUTE, not off the row's name. The question is "what does the
 * screen behind this refuse, and to whom" — every entry below cites the check
 * in the route it belongs to. Where the answer is a per-member grid value
 * rather than a role, the capability is "everyone" and the real rule lives in
 * SETTINGS_ROW_REQUIREMENTS; the two are ANDed.
 *
 * A row that stays visible while PART of it refuses belongs in
 * SETTINGS_ROWS_VISIBLE_WITH_PARTIAL_ACCESS below, with the reason written
 * down — check-settings-access.mjs reads the endpoints each visible row's page
 * fetches and fails if one of them refuses the member it is shown to.
 */
export const SETTINGS_ROW_CAPABILITY = {
  // The plan, the price and the card. An employee seeing what the company pays
  // FieldQuo is the owner's business, not theirs, and every control on the page
  // is refused by isBillingAdmin server-side anyway.
  "app.settings.accountBilling": "billing",
  // The referral link is the company's to share, but the page also lists which
  // companies were referred and how much credit was earned — other people's
  // commercial data — and only an owner/admin can actually send an invite.
  // Both halves point the same way: hide it.
  "app.settings.refer": "billing",
  // Deduction rates and tax bands. The route already answers 403 to everyone
  // else, so the row led nowhere but an error.
  "app.settings.payroll": "payroll",
  // The Activity Log is owner/admin only — /api/activity answers "Only an
  // owner or admin can view the activity log." to everyone else, and the page
  // exposes actions across every user: payments, pay-rate changes, who
  // deactivated whom. The row was still in the sidebar for a Manager, leading
  // to nothing but that refusal.
  //
  // This said "billing" and explained that isBillingAdmin happens to be
  // owner-or-admin. It now says owner-admin, which is the rule the route
  // actually states. Same set today, same rendering today; what changes is that
  // a future narrowing of who may touch the company's card can no longer
  // silently narrow who may read the activity log.
  "app.settings.activity": "owner-admin",
  // Configures the company's PUBLIC booking page — bookable visit types and
  // what a homeowner is charged to hold a slot. Nothing on it is information a
  // crew member needs; their own bookable hours live on Availability, which
  // stays visible and correctly says "your hours".
  "app.settings.bookingPage": "user:manage",
  // The Stripe connection itself, with live "Manage in Stripe" and
  // "Disconnect" buttons. QA reached this as an employee across two passes and
  // declined to click Disconnect, correctly — severing a company's payment
  // processing is not a control a crew member should be one click from. Rated
  // as billing, because that is what it is.
  "app.settings.payments": "billing",
  // A company's own Meta ad account connection — same shelf as Payments, and
  // gated the same way: app/api/meta-ads/status/route.js (and every other
  // route under app/api/meta-ads) refuses with isBillingAdmin(member.role).
  "app.settings.metaAds": "billing",

  // ── Rows whose route already refused, added after QA walked the sidebar ──
  //
  // The first pass hid six rows and left these, which is the wrong way round:
  // every one of them was drawn for a Worker and every one led to a refusal.
  // The capability is read off the ROUTE in each case, not off the row's name —
  // scripts/check-settings-access.mjs now parses each visible row's read
  // endpoint and fails if it refuses, which is what would have caught them.

  // GET /api/settings/cabinet-rates → requirePermission(member.role,
  // "user:manage"). The whole screen is one rate card; there is no half of it a
  // crew member reads.
  "app.settings.cabinetRates": "user:manage",

  // GET /api/settings/email-domain → requirePermission(member.role,
  // "user:manage"). Verified by QA as a Worker: 403.
  "app.settings.emailDomain": "user:manage",

  // GET /api/settings/website → requirePermission(member.role, "user:manage").
  // Verified by QA as a Worker: 403. PUT/POST/DELETE were already closed.
  "app.settings.website": "user:manage",

  // GET /api/settings/voice → requirePermission(member.role, "user:manage"),
  // and so does the top-up route beside it. Verified by QA as a Worker: 403.
  "app.settings.voice": "user:manage",

  // GET /api/settings/ai/credit → requirePermission(member.role,
  // "user:manage"), and so do the topup/bundle routes beside it — the same
  // gate as the phone credit row directly above, for the same reason: this is
  // a company's money.
  "app.settings.aiCredit": "user:manage",

  // Leave was NOT in the report either; the converse assertion found it too.
  // GET /api/settings/leave-policies refuses anyone who is not owner or admin —
  // "Only an owner or admin can manage leave policies." — with no scoped-down
  // payload for anybody else, so a supervisor got a screen built from one 403.
  // This is the company's policy set, not a person's time off: an employee's
  // own leave lives on the leave request screens, which are untouched.
  "app.settings.leave": "owner-admin",

  // Overhead was NOT in the report; the converse assertion found it. Four of
  // the five endpoints it reads refuse an employee: /api/debt and
  // /api/overhead/fixed-costs on requirePermission(member.role, "user:manage"),
  // /api/analytics/minimum-price on the showPricing toggle, /api/salaries on
  // the payroll grid — every wage in the company is on that screen. What an
  // employee got was a page assembled from four refusals. "user:manage" is the
  // gate that decides it: a supervisor holds it, and holds showPricing under
  // every preset that maps to the role.
  //
  // That reasoning was about which ROW to draw, and it is still right about
  // the employee. It was never a decision that a supervisor may read the
  // company's margin — QA later signed in as a Dispatcher and did exactly
  // that. The role capability below is now the FLOOR; the grid rule in
  // SETTINGS_ROW_REQUIREMENTS narrows it further, which is the fix this file
  // has been describing since it was written.
  "app.settings.overhead": "user:manage",

  // Material Costs: per-gallon paint cost, consumables, labour minutes. Its
  // GET had no server check at all until the cost-basis sweep, which is why it
  // was never in either list here — a row that refused nobody. Now that the
  // read is gated like the write, the row follows the same floor as Overhead,
  // and the same grid rule below.
  "app.settings.materialCosts": "user:manage",

  // ── Rows hidden for the WRITES, not for a refused read ──────────────────
  //
  // These three are a different case and are marked as such on purpose. GET
  // /api/settings/document-templates and GET /api/settings/follow-up-rules are
  // open to any member — an employee CAN read them, and the QA report's claim
  // that they answered 403 does not match the routes.
  //
  // They are hidden anyway because every control on the three screens (create,
  // rename, activate, delete, seed defaults) is requirePermission(member.role,
  // "user:manage") or owner/admin, and none of the three pages calls
  // useSettingsAccess — so an employee opening them gets a page of live-looking
  // buttons, every one of which answers 403. That is the dead-control failure
  // AGENTS.md names, and hiding the row is the version of the fix that lives in
  // this file.
  //
  // The better fix is the one Company Settings got: a read-only rendering, so
  // the screen keeps informing and stops pretending. If one of these pages
  // grows that, delete its line here — the row should come back visible.
  "app.settings.emailTemplates": "user:manage",
  "app.settings.pdfTemplates": "user:manage",
  "app.settings.followUps": "user:manage",

  // ═══ The twenty rows that had no rule at all ═══════════════════════════
  //
  // The owner's spec for Crew — the lowest tier, PERMISSION_PRESETS.worker, the
  // people in the van — is that their entire settings surface is three rows:
  // what's new in the product, the language they read the app in, and the hours
  // they can be scheduled. Everything under Account, Services & Pricing,
  // Documents & Messaging, Getting Paid and Client Facing is theirs to use, not
  // theirs to configure.
  //
  // Crew is a PRESET, not a role: worker and estimator both map to `employee`
  // (PRESET_TO_ROLE). So the rows an Estimator legitimately needs and Crew does
  // not — the price book, the rate cards — cannot be decided by role, and are
  // gated on the grid in SETTINGS_ROW_REQUIREMENTS instead. Everything else
  // below is a role question, and each one is the gate its own route already
  // applies.

  // ── The three Crew keeps ────────────────────────────────────────────────

  // Release notes. No API, nothing to refuse, nothing company-specific on it.
  "app.settings.productUpdates": "everyone",
  // Their own UI language. GET /api/settings/language answers any member, and
  // PATCH { language } writes User.language for the caller — a personal
  // preference, not a company setting. The company default on the same screen
  // IS company-wide and requires user:manage, which is why the page now renders
  // that half read-only instead of drawing buttons that all answer 403.
  "app.settings.language": "everyone",
  // Their own bookable hours. /api/availability and /api/working-hours serve
  // the caller's own rows and refuse only a `?userId=` naming somebody else, so
  // the screen is exactly as usable as it claims to be.
  "app.settings.availability": "everyone",

  // ── Priced screens: a role cannot answer this, the grid can ─────────────
  //
  // All four say "everyone" and carry a grid rule below. An Estimator is
  // role `employee` and holds showPricing; Crew is role `employee` and does
  // not. Writing a role here would take the price book off the one person
  // whose job is writing quotes.
  "app.settings.products": "everyone",
  "app.settings.services": "everyone",
  "app.settings.instantQuotes": "everyone",
  "app.settings.expenseTracking": "everyone",

  // ── Company identity and the roster ─────────────────────────────────────

  // PATCH /api/settings/business-info → requirePermission(member.role,
  // "user:manage"), and so does POST /api/settings/tax-rate beside it. The GET
  // is open and the page has a genuine read-only rendering (CompanyReadOnly),
  // which is why this row was deliberately left visible in the first sweep.
  //
  // The owner's ruling overrides that: the company's registered address, tax
  // rate and opening hours are not a crew member's screen, and the read-only
  // view still serves the audience it was built for — a support session, which
  // canSeeSettingsRow waves through every row regardless of this map.
  "app.settings.company": "user:manage",
  // The logo and the brand colour, on the same PATCH as Company Settings.
  "app.settings.branding": "user:manage",
  // Invitations, licensed seats, pay rates and the owner's email address. The
  // MAIN RAIL already hides this exact page — AdminSidebar's "app.nav.team"
  // points at /app/settings/team and NAV_REQUIREMENTS gates it on
  // role ["owner", "admin", "supervisor"], which is character-for-character who
  // holds user:manage. The settings sidebar was a second door to a page the
  // other menu had already closed, and two menus disagreeing about one page is
  // the bug this file's header warns about.
  //
  // Scoped deliberately to the SETTINGS row. Nothing here touches a read-only
  // team directory or the schedule's view of who is on a job — those are about
  // "who am I working with", not about administering accounts, and
  // canGrantAccess in lib/permissions/roleManagement.js already keeps the
  // access grid itself to owner/admin.
  "app.settings.team": "user:manage",
  // POST/PATCH /api/work-areas → requirePermission(member.role,
  // "workarea:assign"). Supervisors hold it, employees do not. The GET is open
  // and the page renders read-only ("these are the zones you can be assigned
  // to"), which is worth keeping for a support session but is not a screen a
  // crew member goes looking for.
  "app.settings.workAreas": "workarea:assign",
  // POST /api/custom-fields → requirePermission(member.role, "user:manage").
  // Defining the extra boxes is administration; filling them in happens on the
  // quote and the job, which is untouched.
  "app.settings.customFields": "user:manage",

  // ── Documents & messaging: every write is user:manage ───────────────────
  //
  // Same shape as emailTemplates/pdfTemplates/followUps above and hidden for
  // the same reason — the GET is open, every control on the screen refuses. A
  // page of live-looking buttons that all answer 403 is the dead-control
  // failure AGENTS.md names first.

  // PATCH /api/settings/quote-email → user:manage.
  "app.settings.quoteEmail": "user:manage",
  // PATCH /api/settings/translations → user:manage (and the draft route beside
  // it refuses too).
  "app.settings.translations": "user:manage",
  // PUT /api/settings/message-templates → user:manage.
  "app.settings.messages": "user:manage",
  // POST/PATCH/DELETE /api/settings/checklists → the route's own requireManage,
  // ["owner", "admin", "supervisor"] — the same set as user:manage. The GET
  // stays open on purpose and is NOT gated by this: VisitChecklist.js and the
  // new-visit screen read it, and those are exactly the screens a crew member
  // works from.
  "app.settings.checklists": "user:manage",
  // POST/PATCH/DELETE /api/settings/notification-rules → the route's own
  // requireManage, ["owner", "admin"], with a header explaining why it is a
  // coarse role check rather than a grid one. PATCH
  // /api/settings/appointment-reminders answers 403 to the same people.
  // owner-admin rather than user:manage because that is what the route says.
  "app.settings.notifications": "owner-admin",

  // ── Client-facing surfaces ─────────────────────────────────────────────

  // POST/PATCH /api/funnels → the route's requireManage on
  // requirePermission(member.role, "user:manage").
  "app.settings.leadForm": "user:manage",
  // PATCH /api/settings/links → user:manage.
  "app.settings.bioLink": "user:manage",
  // PATCH /api/settings/reviews → user:manage.
  "app.settings.reviews": "user:manage",
};

/**
 * The grid half of the same question: rows a member's PERMISSIONS hide, on top
 * of whatever their role allows.
 *
 * Shaped like NAV_REQUIREMENTS in lib/permissions/nav.js on purpose — same
 * `{ toggle }` / `{ category, level }` vocabulary, same helpers, same
 * fail-open posture — because the two menus answering the same question
 * differently is a bug this codebase has already shipped once.
 *
 * ── Where the grid comes from ─────────────────────────────────────────────
 *
 * SettingsAccessProvider carries a role and nothing else, and the note under
 * SETTINGS_ROWS_VISIBLE_WITH_PARTIAL_ACCESS below said that made a grid-shaped
 * rule impossible here. That was true of THAT provider and false of the tree:
 * app/app/layout.js already mounts PermissionProvider one layout up, so
 * SettingsSidebar can read the same `{ role, permissions }` the main rail
 * reads. No new query, no new payload.
 *
 * Passing no member falls open, exactly as navRowAllowed does: a sidebar that
 * empties itself because a provider was slow looks like a broken account, and
 * every screen behind these rows refuses server-side regardless.
 */
export const SETTINGS_ROW_REQUIREMENTS = {
  // Cost per job, target margin, the itemised fixed costs, the debt. A
  // Dispatcher holds user:manage and read all of it; jobCosting is the toggle
  // whose whole promise is that they don't. See lib/permissions/costBasis.js,
  // which is what the five endpoints behind this row now enforce.
  "app.settings.overhead": { toggle: "jobCosting" },
  // What a gallon of paint costs and what an hour of labour costs — the other
  // half of the same cost basis, on the other screen.
  "app.settings.materialCosts": { toggle: "jobCosting" },

  // ── The four the note under SETTINGS_ROWS_VISIBLE_WITH_PARTIAL_ACCESS
  //    asked for, moved ────────────────────────────────────────────────────
  //
  // That note named products and expenseTracking as "the obvious next
  // candidates" and deliberately left them for a separate, visible decision
  // rather than folding them into a security fix. This is that decision: the
  // owner's spec for Crew is three rows, and these four are the ones no role
  // can decide, because Crew and Estimator are both role `employee`.

  // GET /api/products and /api/products/export → requireToggle(full,
  // "showPricing"). A price book is prices. Crew holds showPricing:false and
  // the route refuses them; an Estimator holds it and this screen is their tool.
  "app.settings.products": { toggle: "showPricing" },
  // GET /api/settings/instant-quote → requireToggle(full, "showPricing"). One
  // rate card per estimator — the per-unit rates a stranger is quoted from.
  "app.settings.instantQuotes": { toggle: "showPricing" },
  // Settings > Services redacts its rate card rather than refusing, so this is
  // not a route matching a gate — it is the owner's line about which screens
  // are Crew's. What the page is FOR is deciding what the company sells and at
  // what rate; the trades a crew member works on reach them through the job.
  // Same toggle as the two above because it is the same rate card, and because
  // it keeps the screen for exactly the audience that can read the prices on it.
  "app.settings.services": { toggle: "showPricing" },
  // GET /api/expenses/summary → hasLevel(full, "expenses",
  // "view_record_edit_all"). Character-for-character what NAV_REQUIREMENTS
  // already says about the same page under "app.nav.expenses" — so this ends
  // the one page the two menus knowingly disagreed about. Recording your own
  // receipt is untouched: that lives on the expenses screens the main rail
  // still shows, and POST /api/expenses still accepts your own row.
  "app.settings.expenseTracking": {
    category: "expenses",
    level: "view_record_edit_all",
  },
};

/**
 * Rows whose ROLE says "everyone" while part of the page refuses — because the
 * rule that actually hides them is the GRID, which a static scan cannot run.
 *
 * These four all carry `"everyone"` above and a real rule in
 * SETTINGS_ROW_REQUIREMENTS. The member who is genuinely shown the row holds
 * showPricing (or expenses:view_record_edit_all) and opens every endpoint on
 * it; the member the endpoint refuses never sees the row at all. So nothing
 * here is a live hole any more — what it is, is the seam between two checks.
 *
 * scripts/check-settings-access.mjs resolves each visible row's page to its
 * route files and greps the GET for a refusal. That is a source scan: it can
 * see `requireToggle(full, "showPricing")` but it cannot evaluate the grid, so
 * it evaluates row visibility on the ROLE alone and sees four rows an
 * `employee` "can see" whose reads refuse. Listing them here is how that seam
 * gets named rather than silently skipped.
 *
 * The check asserts each entry STILL refuses — so when a route stops gating,
 * the line fails and gets deleted rather than lingering as a description of a
 * restriction that no longer exists.
 *
 * ── What would delete this map ────────────────────────────────────────────
 *
 * A check that evaluates the row's grid requirement against the gate it found:
 * `{ toggle: "showPricing" }` on the row and `requireToggle(…, "showPricing")`
 * in the route are the same statement, and matching them would prove the pair
 * rather than excuse it. That is a better assertion than this list and it is
 * not written yet; whoever writes it removes this map.
 *
 * Value = why, for the reader and for the failure message.
 */
export const SETTINGS_ROWS_VISIBLE_WITH_PARTIAL_ACCESS = {
  // GET /api/products (and /export) → requireToggle(full, "showPricing").
  // A price book is prices, so the route refuses rather than redacting; but
  // showPricing is a per-member switch an owner sets deliberately, and the
  // employees who hold it read this screen legitimately.
  "app.settings.products":
    "read is gated on the showPricing toggle, not on a role",
  // GET /api/expenses/summary → hasLevel(full, "expenses",
  // "view_record_edit_all"), which is now also the row's grid rule, so the two
  // menus have stopped disagreeing about this page. Recording your own receipt
  // is untouched and lives on the main rail's expenses screens: GET
  // /api/expenses scopes to your own rows and POST accepts your own expense.
  "app.settings.expenseTracking":
    "the company roll-up needs expenses:view_record_edit_all, which is the row's own grid rule",
  // GET /api/settings/instant-quote → requireToggle(full, "showPricing").
  // The screen is one rate card per estimator — the per-unit rates a stranger
  // is quoted from — so it refuses rather than redacting, exactly as the price
  // book does. Added when Settings > Services was gated: that screen reads this
  // endpoint too (for the "homeowners can get an instant price" badge) and the
  // rate card behind it was the same $150 per door.
  //
  // It is now IN SETTINGS_ROW_REQUIREMENTS, beside app.settings.products, on
  // the same toggle the route checks. It stays listed here because the check
  // script still evaluates visibility on the role alone.
  "app.settings.instantQuotes":
    "read is gated on the showPricing toggle, which is also the row's grid rule",
  // Settings > Services is genuinely half-usable without showPricing — GET
  // /api/settings/service-categories redacts the rate card rather than refusing
  // (its own header explains why), and the screen prints the reason where the
  // rates were. That is what kept it visible until now.
  //
  // The owner's Crew spec moves it anyway: the screen exists to decide what the
  // company sells and at what rate, and the trades a crew member works on reach
  // them through the job, not through here. It carries the same
  // `{ toggle: "showPricing" }` rule as the price book, so the audience that
  // still sees it is the audience the rate card is not redacted for.
  //
  // What lands it in THIS list is the badge: the page also reads
  // /api/settings/instant-quote to say "homeowners can get an instant price for
  // this", and that endpoint refuses on the same toggle. The fetch is written as
  // progressive enhancement — `if (!res.ok) return`, no error surfaced — so the
  // badge is simply absent, which is the correct rendering of "we could not ask".
  "app.settings.services":
    "the instant-quote badge it reads needs showPricing, which is also the row's grid rule",
};

/** Does this role hold a capability? Unknown capability → no restriction. */
export function holdsCapability(role, capability) {
  const check = CAPABILITIES[capability];
  if (!check) return true;
  return check(role);
}

/**
 * @param access  { role, impersonation } — the shape SettingsAccessProvider carries
 */
export function canSee(access, capability) {
  if (!access) return false;
  if (access.impersonation) return true; // non-negotiable #3: view everything
  return holdsCapability(access.role, capability);
}

export function canChange(access, capability) {
  if (!access) return false;
  if (access.impersonation) return false; // …edit nothing
  return holdsCapability(access.role, capability);
}

/**
 * Does the member's GRID allow this row? Separate from the role question so a
 * check script can execute either half on its own.
 *
 * @param member  { role, permissions } from PermissionProvider, or null
 */
export function gridAllowsSettingsRow(member, navKey) {
  const requirement = SETTINGS_ROW_REQUIREMENTS[navKey];
  if (!requirement) return true; // no rule — the common case
  if (!member) return true; // provider missing; see the note on the map
  if (requirement.toggle) return hasToggle(member, requirement.toggle);
  if (requirement.category)
    return hasLevel(member, requirement.category, requirement.level);
  return true;
}

/**
 * Should this settings sidebar row be drawn?
 *
 * Two independent questions, ANDed: does the ROLE hold the capability, and
 * does the member's GRID allow it. Kept apart rather than folded into one
 * predicate because they fail in opposite directions — a missing grid shows
 * everything, an unlisted row shows nothing — and conflating them would let one
 * silently stand in for the other.
 *
 * ── An unlisted row is HIDDEN ──────────────────────────────────────────────
 *
 * This used to end `return true` for a row with no entry, and twenty rows
 * reached every member of every company on the strength of that line. The
 * default is the decision: with fall-through-to-visible, forgetting is the same
 * as publishing, and nothing distinguishes a row somebody thought about from a
 * row nobody has read. Now forgetting fails a build instead — see
 * SETTINGS_ROW_CAPABILITY's header and scripts/check-settings-access.mjs, which
 * refuses a row that has no answer here.
 *
 * Note the asymmetry with `access` and `member`, which is deliberate. A missing
 * PROVIDER still falls open (filterSettingsGroups returns the menu untouched, a
 * missing grid hides nothing): a sidebar that empties itself because a query
 * was slow looks like a broken account, and every screen behind these rows is
 * refused server-side regardless. A missing RULE is different — that is not a
 * lookup failing, it is nobody having decided, and the honest rendering of "we
 * have not decided" is not "show it to everyone".
 *
 * @param member  optional { role, permissions }; omitted means "grid unknown",
 *                which does not hide anything.
 */
export function canSeeSettingsRow(access, navKey, member = null) {
  // Non-negotiable #3 again: a support session sees every row, including one
  // nobody has written a rule for. Checked before both questions, because an
  // impersonated member carries no permissions object of its own and must not
  // be narrowed by one — and because a console blinded by a missing map entry
  // would be the deny-by-default failure landing on the one caller that is
  // supposed to see everything.
  if (access?.impersonation) return true;

  const capability = SETTINGS_ROW_CAPABILITY[navKey];
  if (!capability) return false; // no rule = not decided = not shown
  if (!canSee(access, capability)) return false;
  return gridAllowsSettingsRow(member, navKey);
}

/**
 * Drop hidden rows from the settings sidebar's group list.
 *
 * Mirrors filterNavGroups in lib/features/nav.js deliberately — same shape,
 * same "a group left with nothing disappears" rule — because a heading over
 * empty space announces that something was taken away.
 *
 * A null `access` (the provider missing, or still resolving) leaves the menu
 * intact. Same reasoning as the feature flags: a nav that empties itself when a
 * lookup fails looks like the account broke, and every row behind it is gated
 * server-side regardless.
 */
export function filterSettingsGroups(groups, access, member = null) {
  if (!Array.isArray(groups)) return [];
  if (!access) return groups;
  return groups
    .map((g) => ({
      ...g,
      items: (g.items || []).filter((i) =>
        canSeeSettingsRow(access, i.key, member),
      ),
    }))
    .filter((g) => g.items.length > 0);
}
