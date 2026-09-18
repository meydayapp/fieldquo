// lib/sales/intel/bbbApify.js
//
// The BBB bulk source, by name. Everything is lib/sales/intel/apifyRuns.js
// with `source: "bbb"` — the actor, its input, its row reader and its
// price are the `ACTORS.bbb` entry there. This file exists so a caller can
// say what it means, and so `runBbbForWorked` has one home.
import { db as defaultDb } from "@/lib/db";
import { ACTORS, apifyStatus, nextPairs, runApifyTick } from "./apifyRuns";

export const BBB_ACTOR = ACTORS.bbb;

/** One tick: collect finished BBB runs, start what the cap allows for the
 *  (trade, city) pairs the enrichment order names next. */
export function runBbbForWorked({ db = defaultDb, now = new Date(), trigger = "cron", startLimit = null, deps = {} } = {}) {
  return runApifyTick({ db, source: "bbb", now, trigger, startLimit, deps });
}

export function bbbPairsNext({ db = defaultDb, now = new Date(), limit = null } = {}) {
  return nextPairs({ db, source: "bbb", now, limit });
}

export function bbbApifyStatus({ db = defaultDb, now = new Date() } = {}) {
  return apifyStatus({ db, source: "bbb", now });
}
