// lib/permissions.js
//
// Two layers, and they are not the same layer.
//
//   1. COARSE — PERMISSIONS/can/requirePermission below. Four fixed roles.
//      Every API route is gated by this, and it is the floor: a member whose
//      role lacks "quote:create" cannot create a quote whatever their grid
//      says.
//
//   2. GRANULAR — PERMISSION_CATEGORIES, the per-category editor on New User
//      and Manage Team, persisted onto Member.permissions (Json). Enforced by
//      lib/permissions/enforce.js, which narrows the coarse floor further.
//
// ── The state of layer 2, honestly ─────────────────────────────────────────
//
// This header used to say the grid was display-only and enforced nowhere.
// That stopped being true when enforce.js landed, and the stale comment was
// worse than no comment: it told the next reader the feature was inert when
// most of it had teeth.
//
// It is now enforced across the routes for quotes, invoices, clients,
// payments, expenses, payroll, schedule, time tracking, jobs and pricing
// visibility.
//
// jobCosting used to be listed here as inert. It no longer is: it gates the
// costing GET on all three surfaces (quote, job, invoice), the costing WRITE
// on both create and update of each, the costing block on the invoice
// lifecycle read, and the labour-cost figure the AI copilot reports. Left in
// the record rather than deleted, because "this was dead and now isn't" is the
// part a reader needs.
//
// It now also gates the COST BASIS those margins are computed from — the
// overhead fixed costs, the overhead salaries, the debt, the material and
// labour cost recipes, the minimum-price floor and the burn rate — read and
// write, on the API and on the two settings screens. Those six endpoints were
// gated on `user:manage`, which a supervisor holds, so a Dispatcher with
// jobCosting:false read cost per job, target margin and the itemised monthly
// costs. See lib/permissions/costBasis.js, which is the single rule they all
// resolve through.
//
// requests joined jobCosting in the same way: leads ARE the requests grid (see
// lib/permissions/nav.js, which has said so since it was written and hid the
// quick-add control at view_only while the endpoint behind it stayed open).
// /api/leads PATCH, /api/leads/[id] PATCH and /api/leads/import POST now all
// require view_create_edit.
//
// ONE CATEGORY IS STILL WRITTEN AND READ BY NOTHING:
//
//   * notes — saved, shown back, gates no note anywhere. A member set to "View
//     notes on jobs and visits only" reads and writes notes on leads, clients
//     and quotes exactly like someone set to "View all notes".
//
// That is a dead control in the sense AGENTS.md means: a company can set it,
// see it saved, and reasonably believe an employee is restricted when they are
// not — which is a staffing decision made on a false premise.
//
// What makes them survivable rather than urgent, and what would change that:
// there is no delete endpoint for either subject today. LeadNote is the only
// note model and its route exposes GET and POST only; LeadRequest has no
// DELETE anywhere. So the delete LEVELS in both categories currently withhold
// something nobody can do. The EDIT levels are the live gap — PATCH
// /api/leads/[id] consults no grid at all, so "Requests: view only" does not
// stop a lead being edited. Wiring that up is a product decision (whose leads,
// and does an owner want the assignee rule requests have never had), which is
// why it is written down here rather than guessed at.
//
// Whoever touches this next either wires them up or takes them out.
export const PERMISSIONS = {
  owner: ["*"],
  admin: ["*"],
  supervisor: [
    "quote:create",
    "quote:convert",
    // Approve an auto-generated instant estimate before it can be sent. A
    // homeowner saw a range; someone accountable confirms it. Owners/admins
    // get it via "*"; a supervisor is the lowest role trusted to sign off a
    // price. Employees create quotes but do not approve estimates.
    "quote:approve-estimate",
    "appointment:create",
    "appointment:assign",
    "followup:create",
    "task:create",
    "task:assign",
    "workarea:assign",
    "user:view",
    "user:manage",
    "job:create",
    "job:assign",
  ],
  employee: [
    "quote:create",
    "appointment:create",
    "followup:create",
    "job:create",
  ],
};

export function can(role, permission) {
  // Own-property lookup, not a bare index. `PERMISSIONS["__proto__"]` returns
  // Object.prototype — truthy, so `|| []` never fires, and `.includes` is
  // undefined on it. can("__proto__", …) therefore THREW a TypeError instead
  // of denying, and so did "constructor". No route passes an attacker-chosen
  // role today (Member.role is a Postgres enum), but a permission check whose
  // failure mode is a 500 rather than a "no" is the wrong shape regardless of
  // whether today's callers can reach it.
  const perms = Object.prototype.hasOwnProperty.call(PERMISSIONS, role)
    ? PERMISSIONS[role]
    : [];
  if (!Array.isArray(perms)) return false;
  return perms.includes("*") || perms.includes(permission);
}

// What a refused caller is told, per permission.
//
// The thrown message used to be `Forbidden: missing permission "workarea:assign"`.
// That string went straight into the error toast via reportResponseError, so a
// painter who tapped a name on the Work Areas screen read a developer's
// identifier. It says nothing about what to do next, and it leaks the internal
// permission vocabulary to anyone who wants to enumerate it.
//
// Each sentence names WHO can do the thing, because the only useful next step
// for the person reading it is knowing who to ask. Roles are spelled out rather
// than described as "someone with the right permission" — a two-person painting
// company knows who the owner is; it does not know what a permission is.
//
// Keyed by permission rather than written at each call site: nine routes gate on
// "user:manage" and would otherwise say nine different things about the same
// rule. Routes that already substitute a more specific sentence of their own
// (the booking-type wording, for instance) keep it — this is the floor, not a
// replacement for a better local message.
export const PERMISSION_DENIALS = {
  "workarea:assign":
    "Only an owner, admin or supervisor can create work areas or change who's assigned to them.",
  "user:manage":
    "Only an owner, admin or supervisor can change this. Ask one of them to make the change.",
  "quote:approve-estimate":
    "Only an owner, admin or supervisor can approve an estimate before it's sent.",
  "quote:convert": "Only an owner, admin or supervisor can turn a quote into a job.",
  "task:assign": "Only an owner, admin or supervisor can assign a task to someone else.",
  "appointment:assign":
    "Only an owner, admin or supervisor can assign an appointment to someone else.",
  "job:assign": "Only an owner, admin or supervisor can assign a job to someone else.",
  "user:view": "Only an owner, admin or supervisor can see full team records.",
};

/** The sentence for a refused permission. Never the raw permission name. */
export function permissionDenialMessage(permission) {
  return (
    PERMISSION_DENIALS[permission] ||
    "You don't have permission to do that. Ask an owner or admin."
  );
}

export function requirePermission(role, permission) {
  if (!can(role, permission)) {
    const err = new Error(permissionDenialMessage(permission));
    // Kept on the error for logs and for callers that want to branch on it.
    // Deliberately NOT in the message — see PERMISSION_DENIALS above.
    err.permission = permission;
    err.status = 403;
    throw err;
  }
}

// FieldQuo's roles are owner/admin/supervisor/employee. Better Auth's
// organization plugin only knows owner/admin/member (no custom roles are
// configured — see lib/auth.js), so passing "supervisor"/"employee" to
// createInvitation throws ROLE_NOT_FOUND. Map down to a role Better Auth
// accepts for the invitation/OrgMember row ONLY. The granular FieldQuo role is
// preserved separately on PendingTeamProfile.role and written to Member.role on
// accept, so this mapping never touches FieldQuo's own RBAC — and never lets
// the invalid value "member" (not in the MemberRole enum) reach a Member row.
export function toBetterAuthRole(role) {
  return role === "admin" ? "admin" : "member";
}

// ============================================================
// GRANULAR PERMISSION PRESETS — New User / Manage Team RBAC editor
// ============================================================

// Each category's ordered access levels, least to most access. `value` is
// what gets stored in Member.permissions[category]; `label` is what shows in
// the <select>.
export const PERMISSION_CATEGORIES = {
  schedule: {
    label: "Schedule",
    levels: [
      { value: "view_own", label: "View their own schedule" },
      {
        value: "view_complete_own",
        label: "View and complete their own schedule",
      },
      { value: "edit_own", label: "Edit their own schedule" },
      { value: "edit_all", label: "Edit everyone's schedule" },
      {
        value: "edit_delete_all",
        label: "Edit and delete everyone's schedule",
      },
    ],
  },
  // The top level says "and delete" because the top level is what deletes.
  //
  // DELETE /api/time-entries/[id] was gated on the coarse "user:manage" alone,
  // so this ladder — the control an owner uses to decide who may touch hours —
  // had no say in it at all: a supervisor whose Time Tracking dial said "their
  // own" could delete anyone's entry, and the Timesheets ✕ fired straight
  // through with no confirmation on data that feeds payroll. Naming delete
  // here without the route reading it would have been the other half of the
  // same bug, so the route requires this level now. The level VALUE is
  // deliberately unchanged: a new value would have to be written onto every
  // stored grid, and every member set to "everyone's" would silently lose
  // access the day it shipped.
  timeTracking: {
    label: "Time Tracking & Timesheets",
    levels: [
      { value: "view_record_own", label: "View and record their own" },
      {
        value: "view_record_edit_own",
        label: "View, record, and edit their own",
      },
      {
        value: "view_record_edit_all",
        label: "View, record, edit, and delete everyone's",
      },
    ],
  },
  // Payroll is the most sensitive category in the product: a payslip shows
  // someone's pay rate, and one employee seeing another's is a real incident,
  // not a UI nit. So the default is "their own only", and seeing everyone's is
  // a deliberate, separate grant — never implied by managing schedules or jobs.
  payroll: {
    label: "Payroll & Payslips",
    levels: [
      { value: "none", label: "No access" },
      { value: "view_own", label: "View their own payslips" },
      { value: "view_all", label: "View everyone's payslips" },
      { value: "run_payroll", label: "View everyone's and run payroll" },
    ],
  },
  notes: {
    label: "Notes",
    levels: [
      {
        value: "jobs_visits_only",
        label: "View notes on jobs and visits only",
      },
      { value: "view_all", label: "View all notes" },
      { value: "view_edit_all", label: "View and edit all" },
      { value: "view_edit_delete_all", label: "View, edit, and delete all" },
    ],
  },
  expenses: {
    label: "Expenses",
    levels: [
      {
        value: "view_record_edit_own",
        label: "View, record, and edit their own",
      },
      {
        value: "view_record_edit_all",
        label: "View, record, and edit everyone's",
      },
    ],
  },
  clientsProperties: {
    label: "Clients and Properties",
    levels: [
      {
        value: "name_address_only",
        label: "View client name and address only",
      },
      { value: "full_view", label: "View full client and property info" },
      {
        value: "full_edit",
        label: "View and edit full client and property info",
      },
      {
        value: "full_edit_delete",
        label: "View, edit, and delete full client and property info",
      },
    ],
  },
  // ── "none" is a NEW rung, not a renamed one ────────────────────────────
  //
  // requests/quotes/jobs/invoices each gained a `none` level BELOW view_only,
  // so the Crew preset can mean what its name says: somebody who carries
  // materials and marks work complete, and does not read the company's
  // documents. Until it existed the floor was view_only — every member on the
  // lowest tier could open every quote in the company.
  //
  // Added at the FRONT, and no existing value renamed or reordered. hasLevel
  // compares indexes within this array, so inserting a rung below shifts every
  // stored value up by one uniformly and changes nothing about who outranks
  // whom: a member stored as "view_only" still resolves to view_only, and
  // clampPermissions (same index comparison) still lets a granter hand out
  // exactly what they hold. A member is only at `none` if somebody deliberately
  // set them there. scripts/check-crew-access.mjs executes both halves.
  //
  // Deliberately NOT the default for a member with no grid at all — that is
  // hasLevel's fall-open case and it stays fall-open; see enforce.js on why
  // pre-grid members must not be locked out on deploy.
  requests: {
    label: "Requests",
    levels: [
      { value: "none", label: "No access" },
      { value: "view_only", label: "View only" },
      { value: "view_create_edit", label: "View, create, and edit" },
      {
        value: "view_create_edit_delete",
        label: "View, create, edit, and delete",
      },
    ],
  },
  quotes: {
    label: "Quotes",
    levels: [
      // See the note above `requests` — same new rung, same reasoning.
      { value: "none", label: "No access" },
      { value: "view_only", label: "View only" },
      { value: "view_create_edit", label: "View, create, and edit" },
      {
        value: "view_create_edit_delete",
        label: "View, create, edit, and delete",
      },
    ],
  },
  jobs: {
    label: "Jobs",
    levels: [
      // `none` withholds the job RECORD — the document with its client, scope
      // and costing. It does not withhold the work: the schedule, the visit
      // checklist and the clock are their own categories, and a Crew member on
      // jobs:none still sees their day.
      { value: "none", label: "No access" },
      { value: "view_only", label: "View only" },
      { value: "view_create_edit", label: "View, create, and edit" },
      {
        value: "view_create_edit_delete",
        label: "View, create, edit, and delete",
      },
    ],
  },
  invoices: {
    label: "Invoices",
    levels: [
      // See the note above `requests` — same new rung, same reasoning.
      { value: "none", label: "No access" },
      { value: "view_only", label: "View only" },
      { value: "view_create_edit", label: "View, create, and edit" },
      {
        value: "view_create_edit_delete",
        label: "View, create, edit, and delete",
      },
    ],
  },
};

// Simple on/off switches, layered on top of the category levels above.
export const PERMISSION_TOGGLES = {
  // Reads as well as writes, and the description said only the writes. The
  // toggle removes money from the quote, invoice and service-plan payloads,
  // refuses the priced PDF and document routes, and gates the price book and
  // every analytics screen. The Estimator preset below (then called "Worker
  // (full view)", described as "including pricing details") was already
  // describing the read half; this agrees with it and with the code.
  showPricing:
    "See prices on quotes, invoices and jobs, and edit them. Without it, money is removed from what this person can read as well as write.",
  jobCosting:
    "Show job profit by tracking revenue and costs from line items, labor, and expenses. Requires showPricing, timeTracking, expenses, and jobs access.",
  payments:
    "Allow payment collection on quotes and invoices. Requires showPricing, edit access to Clients and Properties, and edit access to Quotes and/or Invoices.",
};

// Read-only informational rows (derived from other permissions, not
// independently settable) — shown in the UI but not part of the stored grid.
export const PERMISSION_DERIVED_NOTES = {
  clientCommunications:
    "Users can view email/text history available to them based on their other permissions.",
  reports:
    "Users only see reports available to them based on their other permissions.",
};

// The four starting points from the spec. "custom" isn't a real preset —
// selecting it just means "start from whatever's currently set and edit
// freely," so it has no entry here.
export const PERMISSION_PRESETS = {
  // ── Crew ────────────────────────────────────────────────────────────────
  //
  // Named for the people it describes — the van, not a job grade — and it is
  // the same word lib/pricing/ladder.js already uses for the free, non-seat
  // half of a company. "Worker (limited access)" described the tier by what it
  // was missing, next to a second preset also called "Worker", and the two read
  // as one name with a qualifier rather than as two different jobs.
  //
  // The label was the smaller half. The four document categories sat at
  // view_only, which is the FLOOR of those ladders — so "limited access" could
  // read every quote, invoice, job and lead in the company, including what the
  // client was charged wherever showPricing didn't reach.
  //
  // Quotes, invoices and requests are `none` now. Jobs came back to view_only
  // once there was a way to say "only the ones assigned to them" — see the
  // note on the line itself. A crew member with no job at all could not find
  // the address they were driving to.
  //
  // Estimator is the tier above and is untouched by this: it is meant to see
  // the documents and their prices, because writing a quote requires both.
  worker: {
    label: "Crew",
    description:
      // Says what the grid now does. "No jobs" was true while jobs sat at
      // `none` and would be a false promise the moment the scope landed —
      // a description that contradicts the code is the same failure as a
      // toggle that saves and does nothing.
      "View their schedule, the jobs they're assigned to, and what to buy for them. Mark work complete and track their time. No prices, quotes, invoices or requests.",
    isAdministrator: false,
    values: {
      schedule: "view_complete_own",
      // Crew correct their own hours — a forgotten clock-out is the single most
      // common timesheet fix and it happened to the person who worked them.
      // The correction does NOT stand on its own: PATCH /api/time-entries/[id]
      // returns a self-edited entry to `pending`, so a supervisor sees it
      // again. Hours nobody re-checked are hours nobody checked.
      timeTracking: "view_record_edit_own",
      payroll: "view_own",
      notes: "jobs_visits_only",
      expenses: "view_record_edit_own",
      clientsProperties: "name_address_only",
      requests: "none",
      quotes: "none",
      // ── view_only, but SCOPED — the two land together or not at all ──────
      //
      // This was `none`, because the only alternative on the ladder showed a
      // crew member every job in the company. `none` was honest and it made
      // the tier unusable: the person driving to the address could not see the
      // address, the visit, or the list of what to buy.
      //
      // It is view_only again only because seesOnlyAssignedJobs /
      // assignedJobWhere in lib/permissions/enforce.js now narrow every job
      // read to the jobs this member has a visit on. Reverting the scope
      // without reverting this line reopens the hole exactly as it was, which
      // is why scripts/check-crew-access.mjs executes the two together.
      //
      // The money is a separate axis and unchanged: showPricing and jobCosting
      // stay false below, and Job itself carries no money columns — see the
      // report in check-crew-access.mjs section 10.
      jobs: "view_only",
      invoices: "none",
      showPricing: false,
      jobCosting: false,
      payments: false,
    },
  },
  // ── Was "Worker (full view)", and was a hole ─────────────────────────────
  //
  // That tier read every client and every price in the company at `view_only`
  // — which sits BELOW the billing threshold in lib/pricing/ladder.js, so it
  // cost nothing. A company could seat forty of them for free and hand forty
  // people the whole rate card. Non-negotiable #4 exists to stop a rate card
  // reaching a competitor; this was the same exposure with a login attached.
  //
  // It was also redundant. Crew covers the field, and nothing a crew member
  // needs was in here. Nobody was on it — checked against the live roster
  // before changing it, 0 of 21 active members — so nothing migrates.
  //
  // It becomes the role a painting business actually has and could not
  // express: somebody who writes quotes and does not run people.
  //
  // ── Why the ROLE stays `employee` ────────────────────────────────────────
  //
  // Dispatcher and Manager map to `supervisor`, which carries `user:manage` at
  // the ROLE level — "may run a crew": publish shifts, approve leave, edit the
  // booking page, set a labour rate. An estimator writes quotes; none of that
  // is their job, and granting it to reach the billing tier would be paying for
  // authority nobody asked for.
  //
  // They are a paid seat anyway, because seats are counted off the GRID and
  // this grid holds quote-create. That is the whole reason capability-based
  // billing was worth building: a role can be PAID without being SENIOR.
  estimator: {
    label: "Estimator",
    description:
      "Writes quotes and manages clients, with pricing. Doesn't manage people, payroll or job costing.",
    isAdministrator: false,
    values: {
      schedule: "view_complete_own",
      timeTracking: "view_record_edit_own",
      payroll: "view_own",
      notes: "view_all",
      expenses: "view_record_edit_own",
      // Full edit, not full_view: you cannot quote somebody you cannot add.
      clientsProperties: "full_edit",
      // The two that make them a seat. A lead becoming a quote is the same act
      // one screen earlier, so requests moves with quotes.
      requests: "view_create_edit",
      quotes: "view_create_edit",
      // Read-only. Turning a quote into a job and raising the invoice is the
      // dispatcher's and the manager's work, and an estimator who can edit the
      // invoice can quietly move a price after it was agreed.
      jobs: "view_only",
      invoices: "view_only",
      showPricing: true,
      // Deliberately off. Cost and margin are the manager's number — an
      // estimator who can see the floor can discount to it.
      jobCosting: false,
      payments: false,
    },
  },
  dispatcher: {
    label: "Dispatcher",
    description:
      "Edit job, team, and client details. Recommended for team leads.",
    isAdministrator: false,
    values: {
      schedule: "edit_all",
      timeTracking: "view_record_edit_all",
      payroll: "view_own",
      notes: "view_edit_all",
      expenses: "view_record_edit_own",
      clientsProperties: "full_edit",
      requests: "view_create_edit",
      quotes: "view_create_edit",
      jobs: "view_create_edit",
      invoices: "view_create_edit",
      showPricing: true,
      jobCosting: false,
      payments: false,
    },
  },
  manager: {
    label: "Manager",
    description:
      "Runs the day-to-day — quotes, jobs, clients, scheduling and expenses. Not payroll, and not the company's billing. Recommended for management.",
    isAdministrator: false,
    values: {
      schedule: "edit_delete_all",
      timeTracking: "view_record_edit_all",
      // The preset description says payroll is excluded, so it is. An owner who
      // wants a manager running payroll grants it deliberately.
      //
      // This line only started meaning anything when manager stopped mapping to
      // `admin` — until then the whole grid was skipped. Billing is excluded by
      // isBillingAdmin (owner|admin), which supervisor is not, so the
      // description no longer claims it.
      payroll: "view_own",
      notes: "view_edit_delete_all",
      expenses: "view_record_edit_all",
      clientsProperties: "full_edit_delete",
      requests: "view_create_edit_delete",
      quotes: "view_create_edit_delete",
      jobs: "view_create_edit_delete",
      invoices: "view_create_edit_delete",
      showPricing: true,
      jobCosting: true,
      payments: true,
    },
  },
};

// role enum <-> preset, so the New User page can also set the coarse
// Member.role that actually gates API routes today. Deliberately
// conservative — "administrator" always maps to admin (full access via
// PERMISSIONS.admin = ["*"]), everything else maps to the closest existing
// role rather than inventing new enum values you'd need a migration for.
export const PRESET_TO_ROLE = {
  worker: "employee",
  estimator: "employee",
  dispatcher: "supervisor",
  // Manager was `admin`, and `admin` is in UNRESTRICTED_ROLES — so the grid
  // below was written, displayed, and then ignored. A "Manager" got everyone's
  // pay rates, the statutory deduction editor, payout execution and the ability
  // to cancel the company's subscription, while the preset's own description
  // promised the opposite. QA hit it, and the owner read a team member showing
  // as "Admin" as an escalation, which is the correct reading of what the UI
  // said.
  //
  // supervisor is NOT unrestricted, so mapping here is what makes the grid
  // start applying and the description start being true.
  manager: "supervisor",
};

/**
 * The permission grid a role should start with.
 *
 * Quick-add doesn't show the full grid (that's the point of quick-add), but a
 * member created without one has NO granular permissions saved — so anything
 * that reads Member.permissions treats them as having nothing. Seeding from the
 * matching preset means a quick-added employee behaves like a deliberately
 * configured one, and the owner can refine it afterwards.
 */
export function presetPermissionsFor(role) {
  const preset =
    role === "admin"
      ? PERMISSION_PRESETS.manager
      : role === "supervisor"
        ? PERMISSION_PRESETS.dispatcher
        : PERMISSION_PRESETS.estimator;
  return preset ? { ...preset.values } : null;
}
