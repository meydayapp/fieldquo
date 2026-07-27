// lib/auth-cleanup.js
import { db } from "@/lib/db";

// A User row with no matching Account means signup crashed partway through —
// they can never log in, but their email is permanently blocked. Safe to delete
// if it's more than a few minutes old (long enough that it's clearly not an
// in-progress signup happening right now).
export async function cleanupOrphanedUser(email) {
  const user = await db.user.findUnique({
    where: { email },
    include: { accounts: true },
  });

  if (!user) return false;

  const isOrphaned = user.accounts.length === 0;
  const isOldEnough = Date.now() - user.createdAt.getTime() > 5 * 60 * 1000; // 5 minutes

  if (isOrphaned && isOldEnough) {
    await db.user.delete({ where: { id: user.id } });
    return true;
  }

  return false;
}
