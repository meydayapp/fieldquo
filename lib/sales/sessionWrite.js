// lib/sales/sessionWrite.js
//
// The two writes behind "one active session" — the fenced place they
// happen, so a check can assert nothing else touches the columns.
//
//   beginSession    the login route, with the new token's iat: the boundary
//                   every older token is refused against, and OMniLeads's
//                   _close_open_session — a dangling pause from the last
//                   session is closed so the fresh sign-in is Available.
//   endSessionByAdmin  a supervisor's Sign out (app/api/platform/sales/floor/
//                   rep-state): the boundary moves to now under
//                   sessionEndedBy = "supervisor", which refuses every token
//                   the rep holds with the "signed out by a supervisor" code,
//                   and the rep is Off on the ledger under the admin's id.
//
// Neither is reachable from a rep route: the login route runs before there
// is a session, and the supervisor route is superadmin-only.
import { db } from "@/lib/db";
import { STATE_OFFLINE } from "./calls/agentState";
import { callStoreState, setRepState } from "./calls/store";

/**
 * The two columns of SalesRep this file writes, and the only two — named as
 * data so scripts/check-sales-auth.mjs can assert both updates set exactly
 * these. Neither decides what a rep is owed, who a company is credited to
 * or whether a batch pays; they decide which of the rep's OWN tokens is the
 * current one.
 */
export const SESSION_WRITES_ON_SALES_REP = ["sessionIssuedAt", "sessionEndedBy"];

/** @param issuedAt  the JWT's iat, in seconds */
export async function beginSession({ salesRepId, issuedAt, now = new Date(), client = db } = {}) {
  if (!salesRepId) return { ok: false };
  const at = Number.isFinite(issuedAt) ? new Date(issuedAt * 1000) : now;
  await client.salesRep.update({ where: { id: salesRepId }, data: { sessionIssuedAt: at, sessionEndedBy: "login" } });
  // A fresh sign-in resets whatever the last session left open — a pause,
  // an after_call, an offline row. Closed at now, not deleted: the ledger
  // keeps the row for the reports.
  let closed = 0;
  if (callStoreState(client).ready) {
    const res = await client.salesRepActivity.updateMany({ where: { salesRepId, endedAt: null }, data: { endedAt: now } }).catch(() => ({ count: 0 }));
    closed = res.count;
  }
  return { ok: true, sessionIssuedAt: at, closed };
}

export async function endSessionByAdmin({ salesRepId, adminId, now = new Date(), client = db } = {}) {
  if (!salesRepId || !adminId) return { ok: false, error: "Which rep, and which admin?" };
  await client.salesRep.update({ where: { id: salesRepId }, data: { sessionIssuedAt: now, sessionEndedBy: "supervisor" } });
  let state = null;
  if (callStoreState(client).ready) {
    state = await setRepState({ salesRepId, to: STATE_OFFLINE, setByAdminId: adminId, now, client }).catch(() => null);
  }
  return { ok: true, state };
}
