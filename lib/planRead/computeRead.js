// lib/planRead/computeRead.js
//
// A stored read, computed — one function for every path that shows or prices
// a read (the screen, the draft quote, the pricing paths, the margin notice),
// so they cannot disagree about a quantity. Nothing is stored: the takeoff,
// every quantity, its height bands and its sources are worked out from the
// sheets and the model on each call.
//
// Pure (readInputs is pure; it lives in run.js beside the reader that writes
// what it reads).

import { readInputs } from "./run";
import { buildDimIndex, computeProject } from "./projectModel";
import { computeTrades, buildCountIndex, buildScheduleIndex } from "./tradeModel";
import { buildTakeoff } from "./takeoff";

/** Is the set drawn in metric? Its scales say. Pure. */
export function setIsMetric(sheets) {
  return (Array.isArray(sheets) ? sheets : []).some((s) => s?.scale?.system === "metric");
}

/**
 * @param read   a PlanRead with its documents
 * @param books  loadPaintBooks().books
 * @param model  the model to compute (the stored one unless trying a change on)
 */
export function computeRead(read, { books, model = read?.model } = {}) {
  const inputs = readInputs(read);
  const dims = buildDimIndex(inputs.sheets);
  const takeoff = buildTakeoff(inputs.sheets, dims);
  const metric = setIsMetric(inputs.sheets);
  const computed = model
    ? computeProject(model, { dims, book: books?.interior_painting, excel: inputs.excel, photoRead: read.photoRead, takeoff, metric })
    : null;
  const trades = model
    ? computeTrades(model, { dims, counts: buildCountIndex(inputs.sheets), schedules: buildScheduleIndex(inputs.sheets), excel: inputs.excel, photoRead: read.photoRead })
    : [];
  return { inputs, dims, takeoff, metric, computed, trades };
}
