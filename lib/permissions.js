// lib/permissions.js
//
// Everything above the new "GRANULAR PERMISSION PRESETS" section is your
// existing code, byte-for-byte — PERMISSIONS/can/requirePermission still
// gate every API route exactly as they do today. What's new is additive:
// PERMISSION_CATEGORY_PRESETS backs the Jobber-style per-category editor on
// the New User / Manage Team pages, and gets persisted onto
// Member.permissions (Json) for display and future use. It does NOT yet
// replace the coarse role-based checks below — a member with role
// "employee" is still gated by the PERMISSIONS.employee list no matter what
// their granular grid says, until each route is individually updated to
// consult member.permissions instead. Treat this as "the UI and the data
// model are real; the enforcement is still coarse" until that follow-up
// happens.
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
  const perms = PERMISSIONS[role] || [];
  return perms.includes("*") || perms.includes(permission);
}

export function requirePermission(role, permission) {
  if (!can(role, permission)) {
    const err = new Error(`Forbidden: missing permission "${permission}"`);
    err.status = 403;
    throw err;
  }
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
        label: "View, record, and edit everyone's",
      },
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
  showPricing: "Allows editing of quotes, invoices, and line items on jobs",
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
      "Manages all areas including billing — excludes reports and payroll. Recommended for management.",
    isAdministrator: false,
    values: {
      schedule: "edit_delete_all",
      timeTracking: "view_record_edit_all",
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
  manager: "admin",
};
