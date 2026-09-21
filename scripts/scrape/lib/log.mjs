// scripts/scrape/lib/log.mjs
//
// The resumable run log: one JSONL file per run, one line per event, and
// a summary.json rewritten at every checkpoint.
//
// Resumable because a run of a county is hours long and the things that
// stop it — a challenge page, the laptop lid, a lost connection — are not
// reasons to read the same three hundred places again. On `--resume` the
// log is replayed: every place id already opened is skipped, every tile
// already scrolled to its end is skipped, and the summary carries on from
// the counts it had. Nothing is ever rewritten in place; the file only
// grows.
import fs from "node:fs";
import path from "node:path";
import os from "node:os";

export const SCRAPE_HOME = path.join(os.homedir(), "Library", "Application Support", "fieldquo-scrape");
export const RUNS_DIR = path.join(SCRAPE_HOME, "runs");

export function newRunId(now = new Date()) {
  return now.toISOString().replace(/[-:]/g, "").replace(/\.\d+Z$/, "Z").replace("T", "-");
}

export function runDir(runId) {
  return path.join(RUNS_DIR, runId);
}

/** The most recent run id on disk, or null. */
export function latestRunId() {
  if (!fs.existsSync(RUNS_DIR)) return null;
  const ids = fs.readdirSync(RUNS_DIR).filter((d) => fs.existsSync(path.join(RUNS_DIR, d, "events.jsonl"))).sort();
  return ids.length ? ids[ids.length - 1] : null;
}

export class RunLog {
  constructor(runId, { dir = runDir(runId) } = {}) {
    this.runId = runId;
    this.dir = dir;
    this.file = path.join(dir, "events.jsonl");
    fs.mkdirSync(dir, { recursive: true });
  }

  /** Append one event. Synchronous on purpose: a crash between the event
   *  and the flush is the one thing a resumable log cannot afford. */
  event(type, data = {}) {
    const line = JSON.stringify({ t: new Date().toISOString(), type, ...data });
    fs.appendFileSync(this.file, line + "\n");
  }

  /** Every event so far, oldest first. */
  replay() {
    if (!fs.existsSync(this.file)) return [];
    return fs
      .readFileSync(this.file, "utf8")
      .split("\n")
      .filter(Boolean)
      .map((l) => {
        try {
          return JSON.parse(l);
        } catch {
          return null;
        }
      })
      .filter(Boolean);
  }

  writeSummary(summary) {
    fs.writeFileSync(path.join(this.dir, "summary.json"), JSON.stringify(summary, null, 2));
  }
}

/** What a replayed log says is already done. Pure over the event list. */
export function progressFrom(events = []) {
  const places = new Map();
  const tilesDone = new Set();
  const pairsDone = new Set();
  let args = null;
  for (const e of events) {
    if (e.type === "run_start") args = e.args || null;
    if (e.type === "place" && e.placeId) places.set(e.placeId, e);
    if (e.type === "tile_done" && e.tileKey) tilesDone.add(e.tileKey);
    if (e.type === "pair_done" && e.pairKey) pairsDone.add(e.pairKey);
  }
  return { args, places, tilesDone, pairsDone };
}

export function emptySummary(runId, args) {
  return {
    runId,
    args,
    startedAt: new Date().toISOString(),
    finishedAt: null,
    stopped: null,
    pairs: 0,
    tiles: 0,
    tilesSaturated: 0,
    tilesEmpty: 0,
    feedLinks: 0,
    placesOpened: 0,
    placesParsed: 0,
    placesSkippedSeen: 0,
    dedupedAcrossTerms: 0,
    parseFailures: 0,
    written: { matched: 0, matchedVerify: 0, alreadyAttached: 0, noConfidentMatch: 0, noCandidates: 0, placeIdConflict: 0, duplicatePlace: 0, unnamed: 0, errors: 0 },
    gained: { websiteUrl: 0, phoneE164: 0, contactNumber: 0, googleRating: 0, googlePlaceId: 0, location: 0, businessStatus: 0 },
    conflicts: 0,
    closed: 0,
    unmatchedNewLeadLike: 0,
    unmatchedByTrade: {},
    metered: 0,
    /** --state: the two-letter regions the run was bounded to, or null. */
    regions: null,
    /** How many prospects the regional filter dropped before ranking. */
    skippedOutside: null,
    /** What the end-of-run promotion did (lib/sales/intel/promoteListings.js). */
    promoted: null,
    notes: [],
  };
}
