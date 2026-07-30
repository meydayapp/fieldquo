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
//   billing:manage — extend a trial, apply credit (see
//                    app/api/platform/companies/[id]/extend-trial)
export const SUPERADMIN_ONLY_PERMISSIONS = ["billing:manage"];

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
