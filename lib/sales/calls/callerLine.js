// lib/sales/calls/callerLine.js
//
// Whose lines count as a rep's own, beyond the one assigned to them.
//
// An agency's employee (lib/sales/agency.js: engagement "agency", managerId
// the agency) may present the AGENCY's line when they have none of their own
// — it is the team's number, and a callback to it reaches the team. Nobody
// else's line is ever theirs: chooseCallerIdFor() in browserDial.js refuses
// the dial rather than borrow one, because a callback to another rep's
// personal line reaches the wrong person.
//
// One read, fresh per dial. Kept out of browserDial.js so that file stays
// pure and its check keeps executing every branch offline.

import { db } from "@/lib/db";
import { AGENCY_ENGAGEMENT, AGENCY_KIND } from "../agencyLabel";

/**
 * The ids whose assigned line a rep may present as the team's: the rep's
 * agency, when they are an agency employee. Empty for everybody else — a
 * team lead who is not an agency is not a line-holder for their reports,
 * and an agency account itself has its own line or none.
 */
export async function agencyLineHoldersFor(salesRepId, client = db) {
  if (!salesRepId) return [];
  const rep = await client.salesRep.findUnique({
    where: { id: salesRepId },
    select: { engagement: true, managerId: true, manager: { select: { id: true, kind: true } } },
  });
  if (!rep) return [];
  if (rep.engagement === AGENCY_ENGAGEMENT && rep.managerId && rep.manager?.kind === AGENCY_KIND) return [rep.managerId];
  return [];
}
