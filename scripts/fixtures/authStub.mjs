// scripts/fixtures/authStub.mjs
//
// `@/lib/auth` for a bundled check that executes a route handler. The real
// module constructs Better Auth against the database; a check only needs to
// say who is signed in. Set `authStub.session` before calling the route:
// null for a stranger, { user: { id, email } } for a signed-in person.

export const authStub = { session: null };

export const auth = {
  api: {
    getSession: async () => authStub.session,
  },
};
