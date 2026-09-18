// lib/sales/intel/registerPeople.js
//
// The regulators' answer to "who owns this licence" — read from the files
// they publish, never scraped from their lookup pages.
//
// ══ Which registers carry a person, measured ══════════════════════════════
//
//   California CSLB   YES — a separate PERSONNEL file on the same Data
//                     Portal as the master file (fName=PersonnelData):
//                     licence number, name, titles, classes, association
//                     dates. 406,161 rows, 244,300 licences on 2026-09-17.
//                     The per-licence detail page is NOT usable: a GET of
//                     LicenseDetail.aspx?LicNum=… answers 302 to the search
//                     form, and the form's POST answers 503 "The requested
//                     URL was rejected" from the F5 edge, with a browser UA
//                     and a seeded session alike. So the file, loaded whole
//                     into RegisterPersonnel by scripts/cslb-personnel-load.mjs,
//                     and looked up here by licence number.
//   Washington L&I    YES — `PrimaryPrincipalName` on every row of the
//                     master file; already read by usBoard/record.js into
//                     `licence.principal` and, until now, dropped there.
//   Oregon CCB        YES — `rmi_name`, the responsible managing individual,
//                     the same way.
//   Quebec RBQ        NO — the open dataset (rdl01_ExtractionDonneesOuvertes,
//                     24 columns, read on 2026-09-17) carries the licence,
//                     the business, its address, phone, email, NEQ and
//                     categories, and no répondant or dirigeant column. The
//                     RBQ's own site shows répondants per licence, but that
//                     is a lookup page, not the dataset, and nothing here
//                     scrapes it. A Quebec row gets its name from BBB or
//                     from the rep.
//
// ══ Where the licence number is ═══════════════════════════════════════════
//
// `Prospect.licenceNumber` is written by the RBQ ingest only; the US boards
// put the licence number in `sourceRecordId` (usBoard/record.js: "The
// licence number. The board's own stable key"). Measured 2026-09-17:
// 217,927 us_ca_cslb rows, every `licenceNumber` null, every
// `sourceRecordId` set. So the lookup key is `licenceNumber ?? sourceRecordId`,
// and this file says so rather than silently reading the wrong column.
import { db as defaultDb } from "@/lib/db";
import { cslbPersonName, recordPeople } from "./people";

export const CSLB_PERSONNEL_URL = "https://www.cslb.ca.gov/Onlineservices/DataPortal/DownLoadFile.ashx?fName=PersonnelData&type=C";
export const CSLB_PERSONNEL_PROVIDER = "us_ca_cslb";
export const CSLB_PERSONNEL_SOURCE = "cslb_personnel";
export const CSLB_LICENCE_URL = (n) => `https://www.cslb.ca.gov/OnlineServices/CheckLicenseII/LicenseDetail.aspx?LicNum=${encodeURIComponent(n)}`;
/** Re-ask a register about a prospect after this long. */
export const PRINCIPAL_RECHECK_DAYS = 180;
export const REGISTER_PEOPLE_DETECTOR_VERSION = "1";

/** The personnel file's header, exactly. A file whose header differs is a
 *  different file, and the loader refuses it rather than mapping by guess. */
export const CSLB_PERSONNEL_COLUMNS = Object.freeze([
  "LIC-NO", "LastUpdated", "REC-TP", "SEQ-NO", "Name-TP", "Name", "EMP-Titl-CDE", "CL-CDE",
  "CL-CDE-STAT", "ASSN-DT", "DIS-ASSN-DT", "SURETY-TP", "SuretyCompany", "BOND-NO", "BOND-AMT",
  "EffectiveDate", "CancellationDate", "JointVentureLicenseType", "JointVentureLicenseNumber",
]);

/** Providers whose register names a person, and the ProspectPerson source
 *  each writes under. */
export const REGISTERS_WITH_PEOPLE = Object.freeze({
  us_ca_cslb: CSLB_PERSONNEL_SOURCE,
  us_wa_lni: "us_wa_lni",
  us_or_ccb: "us_or_ccb",
});

/** The register's licence number for a prospect — see the header. */
export function registerLicenceNumber(prospect = {}) {
  const n = prospect?.licenceNumber || prospect?.sourceRecordId || null;
  return typeof n === "string" && n.trim() ? n.trim() : null;
}

const cell = (v) => String(v ?? "").replace(/[\u0000-\u001f]/g, " ").trim();
const pipes = (v) => cell(v).split("|").map((s) => s.trim());

/** "04/22/2022" → Date (UTC midnight), else null. */
export function parseCslbDate(value) {
  const m = cell(value).match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!m) return null;
  const d = new Date(Date.UTC(Number(m[3]), Number(m[1]) - 1, Number(m[2])));
  return Number.isNaN(d.getTime()) ? null : d;
}

/**
 * One personnel row (already split into columns) → the people it names,
 * with CURRENT titles only, or [] when nobody current is on it.
 *
 * The file packs a person's several stints into pipe-joined columns:
 * titles "Officer| Responsible Managing Officer", classes "| C57",
 * association dates "03/05/2003| 04/30/2003", disassociation dates
 * "04/30/2003| 11/28/2011". Stint i is current when its disassociation
 * date is blank. A row whose every stint has ended is a person the board
 * still lists but who has LEFT — kept out, because "Officer" on the card
 * must mean officer today.
 *
 * "Principal| AKA" rows carry two names in the Name column ("SMITH  JANE|
 * JONES  JANE") — the same person under a former name. The first is the
 * name; the AKA is not a second person.
 *
 * A "Business" name type is a company holding a role in another company
 * (an LLC member that is itself an LLC). Not a person to ask for; skipped.
 */
export function cslbPeopleFromRow(row) {
  const cols = Object.fromEntries(CSLB_PERSONNEL_COLUMNS.map((c, i) => [c, row?.[i]]));
  const licence = cell(cols["LIC-NO"]);
  if (!licence || !/^\d+$/.test(licence)) return [];
  const nameTypes = pipes(cols["Name-TP"]);
  if (!nameTypes.some((t) => /^principal$/i.test(t))) return [];
  const rawName = pipes(cols["Name"])[0];
  const person = cslbPersonName(rawName);
  if (!person?.name) return [];
  const titles = pipes(cols["EMP-Titl-CDE"]);
  const classes = pipes(cols["CL-CDE"]);
  const assoc = pipes(cols["ASSN-DT"]);
  const disassoc = pipes(cols["DIS-ASSN-DT"]);
  const current = [];
  const currentClasses = new Set();
  let earliest = null;
  titles.forEach((title, i) => {
    if (!title) return;
    if (disassoc[i]) return; // this stint ended
    current.push(title);
    if (classes[i]) currentClasses.add(classes[i]);
    const at = parseCslbDate(assoc[i]);
    if (at && (!earliest || at < earliest)) earliest = at;
  });
  if (!current.length) return [];
  return [
    {
      provider: CSLB_PERSONNEL_PROVIDER,
      licenceNumber: licence,
      name: person.name,
      givenName: person.givenName,
      titles: [...new Set(current)],
      classes: [...currentClasses],
      associatedAt: earliest,
      lastUpdated: parseCslbDate(cols["LastUpdated"]),
    },
  ];
}

/**
 * The people on one licence, best role first, as ProspectPerson inputs.
 * The register's compound titles are kept verbatim as the role — the card
 * shows what the board printed, and people.js's ROLE_RANK reads through
 * the slashes.
 */
export function peopleFromRegisterRows(rows = []) {
  return (Array.isArray(rows) ? rows : [])
    .filter((r) => r?.name)
    .map((r) => ({ name: r.name, givenName: r.givenName || null, role: (r.titles || []).join(" / ") || null }));
}

/**
 * Look a prospect's people up in RegisterPersonnel and record them.
 *
 * Idempotent: a row checked inside PRINCIPAL_RECHECK_DAYS is skipped, a
 * re-run finds the people already there and adds nothing. A prospect from
 * a register with no personnel (RBQ, Overture) is stamped `not_a_register`
 * and never re-asked — the stamp is what keeps the sweep from re-selecting
 * it every hour.
 *
 * @returns { outcome: "checked" | "skipped", reason?, people, added }
 */
export async function lookupRegisterPeople({ db = defaultDb, prospectId, force = false, now = new Date() } = {}) {
  const prospect = await db.prospect.findUnique({
    where: { id: prospectId },
    select: { id: true, sourceProvider: true, sourceRecordId: true, licenceNumber: true, principalCheckedAt: true, mergedIntoId: true, sourceRelease: true },
  });
  if (!prospect) return { outcome: "skipped", reason: "prospect_not_found", people: [], added: 0 };
  if (prospect.mergedIntoId) return { outcome: "skipped", reason: "retired_into_survivor", people: [], added: 0 };
  if (!force && checkedRecently(prospect.principalCheckedAt, now)) {
    return { outcome: "skipped", reason: "checked_recently", people: [], added: 0 };
  }
  const source = REGISTERS_WITH_PEOPLE[prospect.sourceProvider || ""];
  const licence = registerLicenceNumber(prospect);
  if (!source || !licence) {
    await db.prospect.update({ where: { id: prospect.id }, data: { principalCheckedAt: now } });
    return { outcome: "checked", reason: "not_a_register_with_people", people: [], added: 0 };
  }
  // Only CSLB has a loaded file today; WA and OR write at ingest (below).
  // A WA/OR row that predates that ingest change is stamped and left —
  // the next full snapshot ingest fills it, and nothing here guesses.
  if (prospect.sourceProvider !== CSLB_PERSONNEL_PROVIDER) {
    await db.prospect.update({ where: { id: prospect.id }, data: { principalCheckedAt: now } });
    return { outcome: "checked", reason: "register_writes_at_ingest", people: [], added: 0 };
  }
  const rows = await db.registerPersonnel.findMany({
    where: { provider: CSLB_PERSONNEL_PROVIDER, licenceNumber: licence },
    select: { name: true, givenName: true, titles: true, classes: true, associatedAt: true, release: true, loadedAt: true },
  });
  // The latest load only. A person the board dropped keeps an older row
  // (the loader never deletes) and must not reach the card.
  const latest = rows.reduce((m, r) => (r.loadedAt && (!m || r.loadedAt > m) ? r.loadedAt : m), null);
  const current = latest ? rows.filter((r) => r.loadedAt && r.loadedAt.getTime() === latest.getTime()) : rows;
  const people = peopleFromRegisterRows(current);
  let added = 0;
  if (people.length) {
    const release = current[0]?.release || null;
    const seenAt = release && /^\d{4}-\d{2}-\d{2}$/.test(release) ? new Date(`${release}T00:00:00Z`) : current[0]?.loadedAt || now;
    const r = await recordPeople({
      db,
      prospectId: prospect.id,
      people,
      source,
      sourceUrl: CSLB_LICENCE_URL(licence),
      seenAt,
      detector: "cslb.personnel",
      detectorVersion: REGISTER_PEOPLE_DETECTOR_VERSION,
    });
    added = r.added;
  }
  await db.prospect.update({ where: { id: prospect.id }, data: { principalCheckedAt: now } });
  return { outcome: "checked", reason: people.length ? "found" : "no_personnel_on_file", people, added, licence };
}

export function checkedRecently(at, now = new Date(), days = PRINCIPAL_RECHECK_DAYS) {
  if (!at) return false;
  const d = at instanceof Date ? at : new Date(at);
  if (Number.isNaN(d.getTime())) return false;
  return now.getTime() - d.getTime() < days * 24 * 60 * 60 * 1000;
}

/**
 * Many prospects, in the order given, with a report. No vendor is called —
 * this is a table read — so there is no cost and no rate to honour beyond
 * the caller's batch size.
 */
export async function lookupRegisterPeopleFor({ db = defaultDb, ids = [], force = false, now = new Date() } = {}) {
  const report = { asked: 0, checked: 0, skipped: 0, found: 0, added: 0, notRegister: 0, errors: 0, rows: [] };
  for (const id of [...new Set(ids)]) {
    report.asked += 1;
    try {
      const r = await lookupRegisterPeople({ db, prospectId: id, force, now });
      if (r.outcome === "skipped") report.skipped += 1;
      else {
        report.checked += 1;
        if (r.reason === "found") report.found += 1;
        if (r.reason === "not_a_register_with_people" || r.reason === "register_writes_at_ingest") report.notRegister += 1;
        report.added += r.added;
      }
      report.rows.push({ prospectId: id, ...r, people: r.people.map((p) => p.name) });
    } catch (err) {
      report.errors += 1;
      report.rows.push({ prospectId: id, outcome: "error", message: err?.message || String(err) });
    }
  }
  return report;
}

/**
 * The people a board's master file names, for the ingest: Washington's
 * PrimaryPrincipalName and Oregon's rmi_name reach the prospect the day the
 * row is ingested, with the board as the source. Called by the discovery
 * ingest after a board row is written; a null principal writes nothing.
 */
export async function recordBoardPrincipal({ db = defaultDb, prospectId, providerKey, principal, licenceNumber = null, release = null, now = new Date() } = {}) {
  const source = REGISTERS_WITH_PEOPLE[providerKey || ""];
  if (!source || source === CSLB_PERSONNEL_SOURCE || !principal) return { added: 0, skipped: 0 };
  const seenAt = release && /^\d{4}-\d{2}-\d{2}$/.test(release) ? new Date(`${release}T00:00:00Z`) : now;
  const role = providerKey === "us_or_ccb" ? "Responsible Managing Individual" : "Primary Principal";
  return recordPeople({
    db,
    prospectId,
    people: [{ name: String(principal), role }],
    source,
    sourceUrl: null,
    seenAt,
    detector: `${providerKey}.master`,
    detectorVersion: REGISTER_PEOPLE_DETECTOR_VERSION,
  });
}
