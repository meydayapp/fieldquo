// Harness stub for @/lib/auth-client: a signed-in member of the fixture
// company. Better Auth's client would try to reach a server. The owner
// unless the row being photographed says who is looking (guide.jsx sets
// window.__harness.user: Léo for the crew scenes, and null for a public
// row — a stranger on /signup or at an invitation link has no session, and
// the marketing header must not draw the owner's initials over their head).
import { OWNER } from "../fixtures/company.js";
const noop = async () => {};
const me = () => (typeof window !== "undefined" && "user" in (window.__harness || {}) ? window.__harness.user : OWNER);
export function useSession() { const u = me(); return { data: u ? { user: { id: u.userId, name: u.name, email: u.email } } : null, isPending: false }; }
export const signOut = noop;
export const signIn = noop;
export const signUp = noop;
export const authClient = { useSession, signOut };
export const twoFactor = {};
