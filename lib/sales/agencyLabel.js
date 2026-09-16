// lib/sales/agencyLabel.js
//
// The agency's name beside a rep — pure, no imports, so the funnel, the
// performance dashboard and the floor (all executed by check scripts without
// a database) can label a rep without pulling lib/sales/agency.js's
// database and email dependencies in with it.
export const AGENCY_KIND = "agency";
export const AGENCY_ENGAGEMENT = "agency";

/**
 * Takes a row read with `manager: { select: { id, kind, name } }`; anyone
 * without an agency manager gets null, so the boards print nothing extra
 * for FieldQuo's own reps and freelancers.
 */
export function agencyOf(rep) {
  const m = rep?.manager;
  return rep?.engagement === AGENCY_ENGAGEMENT && m?.kind === AGENCY_KIND ? { id: m.id, name: m.name } : null;
}
