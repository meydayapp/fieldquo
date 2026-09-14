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
    // Mark a flagged signup reviewed on /platform/signup-origins. Admin and
    // superadmin, not support: the note names why a signup from outside CA/US
    // was let stand, which is a judgement about a customer, not a lookup.
    "signup:review",
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
//   support:manage     — read and work the escalation queue: the technical
//                        problems sales reps report about the companies they
//                        signed up (SupportTicket). Superadmin-only because
//                        every row names a customer and describes something
//                        wrong with their account, and because the owner's
//                        brief puts these on the owner account — assignment
//                        resolves to the first active superadmin, so widening
//                        this permission would widen who tickets land on too.
//   data_deletion:manage — read the register of data-deletion requests
//                        (strangers' names, emails and free text — see
//                        DataDeletionRequest) and mark one completed, which
//                        emails the person that their data was deleted. The
//                        deletion itself is the owner's own manual act; the
//                        person who can say "it is done" is the person who
//                        did it, and that is the owner account, not support.
//   chat:audit         — read ANY staff conversation (a DM between two reps,
//                        a private group) and any rep's texts and emails
//                        with a prospect, from the console. Superadmin-only
//                        because the staff chat's whole permission model is
//                        "membership is the permission" (lib/staff/store.js),
//                        and the one exception to it has to be the owner
//                        reading their own company's conversations — not a
//                        support session, not an admin. Read-only: the
//                        auditor is never made a member (a member changes
//                        the room's mentions and unread for everyone), never
//                        posts, and cannot write to a rep's thread. And
//                        AUDITED, twice: every open writes a PlatformAuditLog
//                        row, and in the staff chat a system line is posted
//                        into the room — "Emilio (owner) viewed this
//                        conversation on <date>" — visible to its
//                        participants. Transparency is the design, not a
//                        setting: a chat people are secretly read in is not a
//                        chat people use honestly, so the reading is never
//                        secret. See lib/staff/audit.js and
//                        lib/sales/conversationAudit.js.
export const SUPERADMIN_ONLY_PERMISSIONS = [
  "billing:manage",
  "migration:quote",
  "migration:write",
  "migration:cancel",
  "data_deletion:manage",
  "support:manage",
  "chat:audit",
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
