// lib/sales/intel/mapsApify.js
//
// The Google Maps bulk source, by name — compass/crawler-google-places
// through lib/sales/intel/apifyRuns.js with `source: "google_maps"`. The
// official Places API (places.js) stays the per-claim corroboration; this
// covers trade × city in bulk, and a matched row is written through the
// SAME planPlacesWrite so the lead gains exactly what a Places lookup gives.
import { db as defaultDb } from "@/lib/db";
import { ACTORS, apifyStatus, nextPairs, runApifyTick } from "./apifyRuns";

export const MAPS_ACTOR = ACTORS.google_maps;

export function runMapsForWorked({ db = defaultDb, now = new Date(), trigger = "cron", startLimit = null, deps = {} } = {}) {
  return runApifyTick({ db, source: "google_maps", now, trigger, startLimit, deps });
}

export function mapsPairsNext({ db = defaultDb, now = new Date(), limit = null } = {}) {
  return nextPairs({ db, source: "google_maps", now, limit });
}

export function mapsApifyStatus({ db = defaultDb, now = new Date() } = {}) {
  return apifyStatus({ db, source: "google_maps", now });
}
