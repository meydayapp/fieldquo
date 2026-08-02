// scripts/reset-platform-admin-password.mjs
//
// Recovers a locked-out platform (superadmin) account. Platform admins live in
// their OWN table (PlatformAdmin: email + bcrypt passwordHash + role), entirely
// separate from company Better Auth — there is no self-serve "forgot password"
// for the console by design, so recovery is this deliberate, DB-side script.
//
// Two modes, driven by env vars so a password never lands in shell history:
//
//   LIST  — no NEW_ADMIN_PASSWORD set: prints the admin emails/roles so you can
//           confirm which account is yours. Read-only.
//
//   RESET — ADMIN_EMAIL + NEW_ADMIN_PASSWORD set: bcrypt-hashes the new password
//           and updates that admin's row. The password is only ever in the env
//           you pass; it is never printed or logged.
//
// Run (from the repo root, with DATABASE_URL available — e.g. via --env-file):
//
//   List:   node --env-file=.env --import ./scripts/alias-loader.mjs \
//             scripts/reset-platform-admin-password.mjs
//
//   Reset:  ADMIN_EMAIL="you@example.com" NEW_ADMIN_PASSWORD="choose-a-strong-one" \
//             node --env-file=.env --import ./scripts/alias-loader.mjs \
//             scripts/reset-platform-admin-password.mjs
import bcrypt from "bcryptjs";
import { db } from "@/lib/db";

const email = (process.env.ADMIN_EMAIL || "").trim().toLowerCase();
const newPassword = process.env.NEW_ADMIN_PASSWORD || "";

async function main() {
  if (!newPassword) {
    // LIST mode — help identify the account. Hashes are never printed.
    const admins = await db.platformAdmin.findMany({
      select: { email: true, role: true, active: true, createdAt: true },
      orderBy: { createdAt: "asc" },
    });
    if (!admins.length) {
      console.log("No platform admins exist. Create one with scripts/... or the admins API.");
      return;
    }
    console.log(`\n${admins.length} platform admin(s):\n`);
    for (const a of admins) {
      console.log(
        `  ${a.email.padEnd(34)} ${a.role.padEnd(11)} ${a.active ? "active" : "DISABLED"}  created ${a.createdAt.toISOString().slice(0, 10)}`,
      );
    }
    console.log(
      "\nTo reset one, re-run with ADMIN_EMAIL and NEW_ADMIN_PASSWORD set (see the header of this file).\n",
    );
    return;
  }

  // RESET mode.
  if (!email) {
    throw new Error("NEW_ADMIN_PASSWORD is set but ADMIN_EMAIL is not — set both.");
  }
  if (newPassword.length < 8) {
    throw new Error("Choose a password of at least 8 characters.");
  }

  const admin = await db.platformAdmin.findUnique({ where: { email } });
  if (!admin) {
    throw new Error(
      `No platform admin with email "${email}". Run in LIST mode (unset NEW_ADMIN_PASSWORD) to see the exact addresses.`,
    );
  }

  const passwordHash = await bcrypt.hash(newPassword, 10);
  await db.platformAdmin.update({
    where: { email },
    // Re-enable in the same breath — a disabled admin who resets their password
    // still couldn't log in, and being locked out is exactly why you're here.
    data: { passwordHash, active: true },
  });

  console.log(`\n✅ Password reset for ${email} (role: ${admin.role}). You can log in at /platform/login.\n`);
}

main()
  .catch((err) => {
    console.error("\n✖", err.message, "\n");
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect?.());
