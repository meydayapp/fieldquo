// app/api/showcase/roof-measure/route.js
//
// The roofing walk-through (/industries/roofing#instant-quote-example)
// measuring a real address a visitor typed. Public, no session, no tenant.
//
// Everything is in the handler (app/(marketing)/industries/[slug]/showcase/
// liveMeasure.js): same-origin only, a burst limit, Canada/US only, a 30-day
// cache per address and a durable daily cap (SHOWCASE_MEASURE_DAILY_CAP)
// reserved before the first Google call — every call here is FieldQuo's money.
// This file only plugs in the real pieces: the product's own measurement
// (lib/measure/roofMeasurement.js measureRoof, unchanged) and the store in
// FieldQuo's PlatformSetting table. It returns a house, never a price
// (non-negotiable #4): the prices are the sample company's preset, priced in
// the browser by the showcase's own run.
export const runtime = "nodejs";

import { db } from "@/lib/db";
import { measureRoof } from "@/lib/measure/roofMeasurement";
import { createShowcaseMeasureHandler } from "@/app/(marketing)/industries/[slug]/showcase/liveMeasure";
import { platformSettingStore } from "@/app/(marketing)/industries/[slug]/showcase/liveStore";

const handle = createShowcaseMeasureHandler({ store: platformSettingStore(db), measure: measureRoof });

export async function POST(request) {
  return handle(request);
}
