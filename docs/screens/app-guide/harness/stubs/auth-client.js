// Harness stub for @/lib/auth-client: a signed-in owner of the fixture
// company. Better Auth's client would try to reach a server.
import { OWNER } from "../fixtures/company.js";
const noop = async () => {};
export function useSession() { return { data: { user: { id: OWNER.userId, name: OWNER.name, email: OWNER.email } }, isPending: false }; }
export const signOut = noop;
export const signIn = noop;
export const signUp = noop;
export const authClient = { useSession, signOut };
export const twoFactor = {};
