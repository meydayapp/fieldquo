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
  requests: {
    label: "Requests",
    levels: [
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
  // every analytics screen. workerFullView's own description ("including
  // pricing details") was already describing the read half; this now agrees
  // with it and with the code.
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
  worker: {
    label: "Worker (limited access)",
    description:
      "View their schedule, mark work complete, and track their time.",
    isAdministrator: false,
    values: {
      schedule: "view_complete_own",
      timeTracking: "view_record_own",
      payroll: "view_own",
      notes: "jobs_visits_only",
      expenses: "view_record_edit_own",
      clientsProperties: "name_address_only",
      requests: "view_only",
      quotes: "view_only",
      jobs: "view_only",
      invoices: "view_only",
      showPricing: false,
      jobCosting: false,
      payments: false,
    },
  },
  workerFullView: {
    label: "Worker",
    description:
      "View all clients, quotes, and jobs, including pricing details.",
    isAdministrator: false,
    values: {
      schedule: "view_complete_own",
      timeTracking: "view_record_edit_own",
      payroll: "view_own",
      notes: "view_all",
      expenses: "view_record_edit_own",
      clientsProperties: "full_view",
      requests: "view_only",
      quotes: "view_only",
      jobs: "view_only",
      invoices: "view_only",
      showPricing: true,
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
  workerFullView: "employee",
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
        : PERMISSION_PRESETS.workerFullView;
  return preset ? { ...preset.values } : null;
}
