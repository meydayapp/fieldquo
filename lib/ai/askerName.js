// lib/ai/askerName.js
//
// The first name of the person typing into an assistant, for the one
// greeting voiceRule (lib/ai/copilotClient.js) allows.
//
// getCurrentMember hands a route a userId and nothing about the person; the
// name lives on User.name as one free-text field ("Emilio  Boves", two
// spaces and all). Both assistants want the same first word of it, so the
// split lives here once rather than as two slightly different regexes.
//
// Never throws. A greeting without a name is a smaller failure than a 500 on
// the question they asked.
import { db } from "@/lib/db";

/** "Emilio  Boves" → "Emilio"; anything unusable → null. */
export function firstNameFrom(fullName) {
  const first = String(fullName || "").trim().split(/\s+/)[0] || "";
  // A name shorter than two characters is an initial or a typo, and "Hi E"
  // reads worse than no name at all.
  return first.length >= 2 ? first : null;
}

export async function askerFirstName({ userId } = {}) {
  if (!userId) return null;
  try {
    const user = await db.user.findUnique({ where: { id: userId }, select: { name: true } });
    return firstNameFrom(user?.name);
  } catch (err) {
    console.error("[askerName] couldn't read the asker's name:", err?.message);
    return null;
  }
}
