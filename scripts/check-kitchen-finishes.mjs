// scripts/check-kitchen-finishes.mjs
//
//   npm run check:finishes
//
// The finish model, executed against the values a public browser can send.
//
// Every colour here lands in an SVG `fill` that renders inside the contractor's
// app and inside the PDF a client signs, and the homeowner-facing designer
// posts this object straight from a browser. So the hostile-colour sweep is not
// theoretical: it's the boundary between "the client picked sage" and a string
// that isn't a colour reaching a renderer.
//
// The island assertions exist because a two-tone island is the single most
// common request in a kitchen — worth a first-class field rather than something
// a contractor fakes with a second design.

import { normaliseFinish, doorStyle, colorFor, describeFinish, DEFAULT_FINISH,
         CABINET_COLORS, DOOR_STYLES, COUNTER_COLORS, FLOOR_COLORS, WALL_COLORS } from "@/lib/kitchen/finishes";
let fail=0; const ok=(c,m)=>{console.log((c?"✓ ":"✗ ")+m); if(!c)fail++;};

const HEX=/^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i;
for (const [n,list] of [["cabinet",CABINET_COLORS],["counter",COUNTER_COLORS],["floor",FLOOR_COLORS],["wall",WALL_COLORS]])
  ok(list.every(x=>x.hex===null||HEX.test(x.hex)) && list.every(x=>x.key&&x.label),
     `${n} palette: ${list.length} options, all valid hex + labelled`);
ok(DOOR_STYLES.length >= 3 && DOOR_STYLES.some(d=>d.key==="shaker") && DOOR_STYLES.some(d=>d.key==="flat"),
   `door styles: ${DOOR_STYLES.map(d=>d.label).join(", ")}`);
ok(new Set(DOOR_STYLES.map(d=>d.key)).size === DOOR_STYLES.length, "no duplicate door-style keys");

// Hostile colour input — this arrives from a public browser and lands in SVG fill.
const attacks = [
  ['url(javascript:alert(1))'], ['"><script>alert(1)</script>'], ['red; behavior:url(x)'],
  ['#GGGGGG'], ['#12'], [''], [null], [undefined], [42], [{}], [[]], ['expression(alert(1))'],
];
let clean = true;
for (const [v] of attacks) {
  const f = normaliseFinish({ cabinetColor: v, floorColor: v, wallColor: v, countertopColor: v });
  for (const k of ["cabinetColor","floorColor","wallColor","countertopColor"])
    if (!HEX.test(f[k])) { clean=false; console.log(`   ✗ ${k} = ${JSON.stringify(f[k])} from ${JSON.stringify(v)}`); }
}
ok(clean, `${attacks.length} hostile colour values all reduced to a safe hex`);

ok(normaliseFinish(null).cabinetColor === DEFAULT_FINISH.cabinetColor, "null finish → defaults");
ok(normaliseFinish({}).doorStyle === "shaker", "missing door style → shaker");
ok(normaliseFinish({doorStyle:"not_a_style"}).doorStyle === "shaker", "unknown door style falls back rather than rendering nothing");
ok(doorStyle("flat").frame === 0, "a flat door has no frame");
ok(doorStyle("shaker").frame > 0, "a shaker door has a real stile width in inches");

// A partially-saved design must not paint a surface `undefined`.
const partial = normaliseFinish({ cabinetColor: "#2E3B4E" });
ok(Object.values(partial).every(v => v !== undefined), "a partial finish leaves nothing undefined");
ok(partial.floorColor === DEFAULT_FINISH.floorColor, "untouched surfaces keep their default");

// backsplash null is MEANINGFUL — "slab, matching the counter"
ok(normaliseFinish({ backsplashColor: null }).backsplashColor === null,
   "backsplash null survives — it means 'match the counter', not 'unset'");

// island colour
ok(colorFor({kind:"island"}, {cabinetColor:"#F1ECE3", islandColor:"#3F4F45"}) === "#3F4F45",
   "an island painted separately gets its own colour");
ok(colorFor({kind:"base"}, {cabinetColor:"#F1ECE3", islandColor:"#3F4F45"}) === "#F1ECE3",
   "perimeter cabinets keep the main colour");
ok(colorFor({kind:"island"}, {cabinetColor:"#F1ECE3"}) === "#F1ECE3",
   "no island colour set → island matches the perimeter");

// backsplash height clamp
ok(normaliseFinish({backsplashHeight: 1e9}).backsplashHeight === 60, "an absurd backsplash height clamps");
ok(normaliseFinish({backsplashHeight: -5}).backsplashHeight === 0, "a negative backsplash height clamps to 0");

const d = describeFinish({ cabinetColor:"#2E3B4E", doorStyle:"flat", islandColor:"#6B4A33", countertopColor:"#C08A52", floorColor:"#9C7350" });
ok(d.includes("Flat / slab") && d.includes("Navy") && d.includes("Butcher block"),
   `finish schedule reads: "${d}"`);

console.log(`\n${fail===0?"ALL PASS":fail+" FAILED"}`);
process.exit(fail?1:0);
