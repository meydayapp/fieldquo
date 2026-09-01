// lib/platform/permissions.js
export const PLATFORM_PERMISSIONS = {
  superadmin: ["*"],
  admin: [
    "company:view",
    "company:manage",
    "company:suspend",
    "plan:view",
    "plan:manage",
    "service_category:manage",
    "analytics:view",
    "impersonate",
  ],
  support: ["company:view", "impersonate", "analytics:view"],
};

// Permissions no role below superadmin holds, listed so they're discoverable
// rather than only appearing at a call site. Superadmin matches them via "*";
// every other role is refused, which is the intent — these move money or
// change FieldQuo's billing relationship with a customer.
//
//   billing:manage    — extend a trial, apply credit (see
//                        app/api/platform/companies/[id]/extend-trial)
//   migration:quote    — set the price on a paid data-migration request
//                        (moves the company's money — same class as
//                        billing:manage)
//   migration:write    — the sanctioned exception to non-negotiable #3: create
//                        Client/Quote rows inside a company's own tenant data.
//                        See lib/migrations/writes.js. Never granted to
//                        "admin" or "support" — a superadmin's own write is
//                        narrow enough already (gated on a paid, accepted
//                        MigrationRequest); widening WHO can use it is not a
//                        tradeoff this feature makes lightly.
//   migration:cancel   — call off a request, including one already paid (a
//                        refund handled outside the product) — see
//                        lib/migrations/state.js's TRANSITIONS comment.
export const SUPERADMIN_ONLY_PERMISSIONS = [
  "billing:manage",
  "migration:quote",
  "migration:write",
  "migration:cancel",
];

export function canPlatform(role, permission) {
  const perms = PLATFORM_PERMISSIONS[role] || [];
  return perms.includes("*") || perms.includes(permission);
}

export function requirePlatformPermission(role, permission) {
  if (!canPlatform(role, permission)) {
    const err = new Error(
      `Forbidden: missing platform permission "${permission}"`,
    );
    err.status = 403;
    throw err;
  }
}
