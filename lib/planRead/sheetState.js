// lib/planRead/sheetState.js
//
// Is a sheet's pass DONE — and may this run read it?
//
// A sheet whose model call failed every attempt is written off for the rest
// of THAT run (`read.failed`, with the run's hold ref in `failedRun`), so one
// bad sheet never sinks a 40-sheet read. It used to stay written off for
// ever: the next run picked only sheets with no `read` at all, so after "The
// read couldn't finish. Nothing was charged — try again", the retry skipped
// every sheet that had failed and re-ran the synthesis on blank notes — paid,
// and wrong (live in production, 2026-10-04). A failed pass is now pending
// again for any LATER run, and never offered to another read for reuse
// (lib/planRead/sheetCache.js already refused failed sources).
//
// Pure.

/** A pass that really happened: the sheet was read and the answer kept. */
export function sheetPassDone(sheet) {
  return Boolean(sheet?.read && !sheet.read.failed);
}

/**
 * Does this run still need to read the sheet? Unread, or failed in an
 * EARLIER run. `runRef` is the running read's reservationRef — a sheet that
 * failed in this same run stays written off until the run ends.
 */
export function sheetNeedsPass(sheet, runRef = null) {
  if (!sheet?.read) return true;
  if (!sheet.read.failed) return false;
  // Nothing to send at all (no page image saved, no text): no retry can fix
  // that, and offering one would re-run a paid synthesis for nothing.
  if (sheet.read.permanent) return false;
  return !runRef || sheet.read.failedRun !== runRef;
}

/** A failed pass a later run will try again. */
export function sheetRetryable(sheet) {
  return Boolean(sheet?.read?.failed && !sheet.read.permanent);
}
