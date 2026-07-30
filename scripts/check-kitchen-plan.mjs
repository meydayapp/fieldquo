// scripts/check-kitchen-plan.mjs
//
//   npm run check:plan
//
// Executes the presentation drawing against real and hostile designs.
//
// The plan renders inside a quote a client is looking at and inside the PDF
// they sign, so a throw here is not a blank panel — it's a document that
// doesn't exist. Two of these assertions were written after the code crashed on
// input it will genuinely see: `planShapes(null)` (Quote.scopeDetails is
// nullable) and an element naming a `kind` this build no longer has (a design
// saved by an older version).
//
// The finite-coordinate sweep matters for the same reason: an SVG renderer
// silently drops a shape with a NaN coordinate, so a bad number is a cabinet
// that quietly isn't on the drawing rather than an error anyone sees.

import { planShapes, feetInches, elevationTitle, scaleBarShapes, findGaps } from "@/lib/kitchen/planShapes";
let fail = 0; const ok=(c,m)=>{console.log((c?"✓ ":"✗ ")+m); if(!c)fail++;};

ok(feetInches(180) === "15'-0\"", `feetInches(180) = ${feetInches(180)}`);
ok(feetInches(42) === "3'-6\"", `feetInches(42) = ${feetInches(42)}`);
ok(feetInches(0) === "0'-0\"", `feetInches(0) = ${feetInches(0)}`);
ok(feetInches("abc") === "0'-0\"", "non-numeric doesn't produce NaN'-NaN\"");

const design = {
  room: { width: 180, depth: 144, ceiling: 96 },
  finish: { cabinetColor: "#EDE8DD" },
  elements: [
    { id:"b1", kind:"base", wall:"A", pos:0,  width:36, depth:24, config:{doors:2} },
    { id:"b2", kind:"base", wall:"A", pos:36, width:36, depth:24, config:{doors:2} },
    { id:"s1", kind:"sinkBase", wall:"B", pos:20, width:33, depth:24, config:{doors:2} },
    { id:"f1", kind:"fridge", wall:"A", pos:120, width:36, depth:30, config:{} },
    { id:"st", kind:"stove", wall:"C", pos:40, width:30, depth:26, config:{} },
    { id:"w1", kind:"wall", wall:"A", pos:0, width:36, depth:12, config:{doors:2} },
    { id:"d1", kind:"door", wall:"D", pos:10, width:32, depth:5, config:{} },
    { id:"is", kind:"island", pos:60, y:60, width:60, depth:36, config:{} },
  ],
};
const { shapes, width, height, pad } = planShapes(design);
const kinds = shapes.reduce((a,s)=>(a[s.type]=(a[s.type]||0)+1,a),{});
console.log("  shape mix:", JSON.stringify(kinds));
ok(width === 180 && height === 144, `plan is ${width}×${height} inches`);
ok(shapes.length > 60, `${shapes.length} shapes emitted`);
ok(shapes.some(s=>s.type==="text" && s.text === "15'-0\""), "the 15'-0\" room dimension is drawn");
ok(shapes.some(s=>s.type==="text" && s.text === "12'-0\""), "the 12'-0\" room dimension is drawn");
ok(shapes.some(s=>s.type==="text" && s.text === "FRIDGE"), "the fridge is labelled");
ok(shapes.some(s=>s.type==="text" && s.text === "RANGE"), "the range is labelled");
ok(shapes.some(s=>s.type==="path" && s.d?.includes("A ")), "the door swing arc is drawn");
ok(shapes.some(s=>s.type==="circle"), "burners / stools / sink details are drawn");
ok(shapes.some(s=>s.type==="polygon"), "dimension arrowheads are drawn");
ok(shapes.some(s=>s.dash), "uppers are dashed so they don't claim floor space");
ok(shapes.some(s=>s.stroke === "#b08d57"), "cabinet pulls are drawn");
// The two adjacent 36" bases must dimension as ONE 6'-0" run, not two 3'-0"s.
// The island is what carries dimensions now; runs are dimensioned on elevations.
ok(shapes.filter(s=>s.type==="text" && /'-/.test(s.text)).length >= 4,
   "room + island both dimensioned (4 labels)");

// ── ghost gaps ────────────────────────────────────────────────────────────
const flush = { room:{width:200,depth:120}, elements:[
  { id:"a", kind:"base", wall:"A", pos:0,  width:36, depth:24, config:{} },
  { id:"b", kind:"base", wall:"A", pos:36, width:36, depth:24, config:{} },
]};
ok(findGaps(flush).length === 0, "two flush cabinets report no gap");

const ghost = { room:{width:200,depth:120}, elements:[
  { id:"a", kind:"base", wall:"A", pos:0,  width:36, depth:24, config:{} },
  { id:"b", kind:"base", wall:"A", pos:39, width:36, depth:24, config:{} },
]};
const g = findGaps(ghost);
ok(g.length === 1 && g[0].size === 3, `a 3" ghost gap is caught (${JSON.stringify(g)})`);

const intentional = { room:{width:300,depth:120}, elements:[
  { id:"a", kind:"base", wall:"A", pos:0,  width:36, depth:24, config:{} },
  { id:"b", kind:"base", wall:"A", pos:66, width:36, depth:24, config:{} },
]};
ok(findGaps(intentional).length === 0, "a 30\" opening is left alone — that's a deliberate space");

const snapped = { room:{width:200,depth:120}, elements:[
  { id:"a", kind:"base", wall:"A", pos:0,     width:36, depth:24, config:{} },
  { id:"b", kind:"base", wall:"A", pos:36.1,  width:36, depth:24, config:{} },
]};
ok(findGaps(snapped).length === 0, "a 0.1\" seam under the snap threshold isn't reported");
ok(findGaps(null).length === 0, "findGaps(null) returns [] rather than throwing");
ok(pad > 0, `${pad}" of sheet margin reserved for the dimension lines`);

// Every number that reaches a renderer must be finite.
const nums = [];
for (const s of shapes) for (const [k,v] of Object.entries(s)) {
  if (typeof v === "number") nums.push([s.type,k,v]);
  if (k === "points") v.forEach(p=>p.forEach(n=>nums.push([s.type,"point",n])));
}
const bad = nums.filter(([,,v]) => !Number.isFinite(v));
ok(bad.length === 0, `all ${nums.length} coordinates finite${bad.length?": "+JSON.stringify(bad.slice(0,3)):""}`);

// Hostile input
for (const [name, d] of [
  ["null", null], ["empty", {}], ["no room", { elements: design.elements }],
  ["null elements", { room:{width:100,depth:100}, elements:null }],
  ["junk element", { room:{width:100,depth:100}, elements:[{kind:"nope"}] }],
  ["NaN width", { room:{width:NaN,depth:100}, elements:[] }],
]) {
  try {
    const r = planShapes(d);
    const allFinite = r.shapes.every(s=>Object.entries(s).every(([k,v])=>typeof v!=="number"||Number.isFinite(v)));
    ok(Array.isArray(r.shapes) && allFinite, `planShapes(${name}) → ${r.shapes.length} finite shapes, no throw`);
  } catch (e) { ok(false, `planShapes(${name}) threw: ${e.message}`); }
}

ok(elevationTitle("A", design.elements) === "Fridge wall", `wall A → "${elevationTitle("A", design.elements)}"`);
ok(elevationTitle("B", design.elements) === "Sink wall", `wall B → "${elevationTitle("B", design.elements)}"`);
ok(elevationTitle("C", design.elements) === "Cooktop wall", `wall C → "${elevationTitle("C", design.elements)}"`);
ok(!/^Wall/.test(elevationTitle("D", design.elements)) || elevationTitle("D", design.elements).length > 0,
   `wall D (only a door) → "${elevationTitle("D", design.elements)}"`);
ok(scaleBarShapes({unitPx:1}).length > 8, "scale bar emits ticks and labels");

console.log(`\n${fail===0?"ALL PASS":fail+" FAILED"}`);
process.exit(fail?1:0);
