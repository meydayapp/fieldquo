// Harness stub for @/lib/db. The fixtures build their rows with the shipped
// PURE functions (fixtures/salesTeam.js → lib/sales/calls/dialTable.js's
// dialTableRow), and since dialTable reads `rate` from lib/sales/
// performance.js that import graph reaches repStats.js and commission.js,
// which import the Prisma client and, through @prisma/adapter-pg, `pg` —
// `net`, `tls`, `util`, none of which exist in a browser bundle. No /platform
// page reaches lib/db (the pages fetch; the harness answers the fetches), so
// the module is swapped here rather than the fixture re-deriving the row by
// hand, which is the copy that would drift from the real one.
//
// Every property access throws: a page or fixture that starts calling the
// database in the harness fails by name instead of rendering an empty state.
export const db = new Proxy(
  {},
  {
    get(_target, prop) {
      throw new Error(`harness: lib/db is server-only — something reached db.${String(prop)} in the browser bundle`);
    },
  },
);
