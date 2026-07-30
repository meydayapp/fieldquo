// scripts/check-lead-consent.mjs
//
//   npm run check:leadconsent
//
// Every route that creates a lead must also record call consent.
//
// A lead IS a request to be contacted — that's what a lead is. But the outbound
// gate only knows what's in CallConsent, so a lead path that skips it produces
// somebody who obviously wanted a call and whom the agent silently refuses to
// ring. That failure is invisible: the lead looks normal, and the call just
// never happens.
//
// Enumerated from source rather than listed by hand, so a NEW lead path added
// later fails this check instead of quietly joining the gap.

import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
let fail=0; const ok=(c,m)=>{console.log((c?"✓ ":"✗ ")+m); if(!c)fail++;};

function walk(dir, out=[]) {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const f = join(dir, e.name);
    if (e.isDirectory()) walk(f, out);
    else if (e.name.endsWith(".js")) out.push(f);
  }
  return out;
}
const creators = walk("app/api").filter(f => /leadRequest\.create/.test(readFileSync(f,"utf8")));
console.log(`${creators.length} routes create a lead:\n`);
for (const f of creators) {
  const src = readFileSync(f, "utf8");
  const has = /recordConsent/.test(src);
  ok(has, `${f.replace("app/api/","")}`);
}
console.log(`\n${fail===0?"ALL PASS — every inbound lead path records consent":fail+" MISSING"}`);
process.exit(fail?1:0);
