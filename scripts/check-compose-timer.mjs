// scripts/check-compose-timer.mjs
//
//   npm run check:compose-timer
//
// The compose timer, executed. It exists to back a marketing claim — "a quote
// in under a minute" — so the assertions here are mostly about the ways it
// could flatter the product.
//
// The direction of every guard is the same: the timer must UNDER-count. A
// figure that overstates our own speed is worthless the first time somebody
// checks it.
import { startComposeTimer, summariseComposeTimes } from "../lib/analytics/composeTimer.js";

let pass = 0;
const failures = [];
const check = (label, ok) => {
  if (ok) { pass += 1; console.log(`  ok   ${label}`); }
  else { failures.push(label); console.log(`  FAIL ${label}`); }
};

// A minimal fake document: records listeners so the test can fire them.
function fakeDoc() {
  const listeners = new Map();
  return {
    visibilityState: "visible",
    addEventListener(type, fn) {
      if (!listeners.has(type)) listeners.set(type, new Set());
      listeners.get(type).add(fn);
    },
    removeEventListener(type, fn) {
      listeners.get(type)?.delete(fn);
    },
    fire(type) {
      for (const fn of listeners.get(type) || []) fn();
    },
    listenerCount() {
      let n = 0;
      for (const set of listeners.values()) n += set.size;
      return n;
    },
  };
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

console.log("\nAn untouched form reports nothing — not zero\n");
{
  const doc = fakeDoc();
  const t = startComposeTimer({ doc });
  await sleep(60);
  check("no interaction → null, never 0", t.stop() === null);
}

console.log("\nA real session counts\n");
{
  const doc = fakeDoc();
  const t = startComposeTimer({ doc });
  doc.fire("keydown");
  await sleep(1800);
  doc.fire("keydown");
  const s = t.stop();
  check("about two seconds of typing is recorded", s !== null && s >= 1 && s <= 3);
}

console.log("\nToo short to be a quote\n");
{
  const doc = fakeDoc();
  const t = startComposeTimer({ doc });
  doc.fire("pointerdown");
  await sleep(200);
  check("a 200ms open-and-close reports null", t.stop() === null);
}

console.log("\nA hidden tab stops the clock immediately\n");
{
  const doc = fakeDoc();
  const t = startComposeTimer({ doc });
  doc.fire("keydown");
  await sleep(1600);
  doc.visibilityState = "hidden";
  doc.fire("visibilitychange");
  const atHide = t.elapsedMs();
  await sleep(400);
  check("time does not accrue while hidden", t.elapsedMs() === atHide);

  // Some browsers still deliver pointer events to a background tab.
  doc.fire("pointermove");
  await sleep(150);
  check("a stray event in a hidden tab does not restart it", t.elapsedMs() === atHide);

  doc.visibilityState = "visible";
  doc.fire("visibilitychange");
  await sleep(200);
  check("returning to the tab alone does not restart it", t.elapsedMs() === atHide);

  doc.fire("keydown");
  await sleep(300);
  check("the next real interaction does", t.elapsedMs() > atHide);
  t.stop();
}

console.log("\nIdle time is not work\n");
{
  const doc = fakeDoc();
  const t = startComposeTimer({ doc });
  doc.fire("keydown");
  await sleep(300);
  const afterTyping = t.elapsedMs();
  // Idle timeout is 6s; wait past it without touching anything.
  await sleep(6400);
  const afterIdle = t.elapsedMs();
  check("the clock stopped rather than running through the gap",
    afterIdle - afterTyping < 6000);
  t.stop();
}

console.log("\nCleanup\n");
{
  const doc = fakeDoc();
  const t = startComposeTimer({ doc });
  doc.fire("keydown");
  const before = doc.listenerCount();
  check("listeners were attached", before > 0);
  t.stop();
  check("stop() removes every listener", doc.listenerCount() === 0);
}
{
  const doc = fakeDoc();
  const t = startComposeTimer({ doc });
  doc.fire("keydown");
  await sleep(1700);
  check("cancel() reports nothing even after real work", t.cancel() === null);
  check("cancel() also detaches", doc.listenerCount() === 0);
}
{
  const doc = fakeDoc();
  const t = startComposeTimer({ doc });
  doc.fire("keydown");
  await sleep(1600);
  const first = t.stop();
  check("stop() is idempotent", t.stop() === first);
}

console.log("\nSummarising — nulls must never become zeroes\n");
check("no data → nulls, not 0", summariseComposeTimes([]).median === null);
check("null input doesn't throw", summariseComposeTimes(null).count === 0);
check("nulls are dropped, not counted", summariseComposeTimes([null, null, 40]).count === 1);
check("zeroes are dropped too", summariseComposeTimes([0, 0, 40]).count === 1);
check("non-numeric dropped", summariseComposeTimes(["abc", 40]).count === 1);
{
  const s = summariseComposeTimes([20, 30, 40, 50, 900]);
  check("median ignores the 15-minute outlier", s.median === 40);
  check("p90 still shows the tail exists", s.p90 > s.median);
  check("fastest is reported", s.fastest === 20);
  check("under-a-minute is a COUNT, not a rounded average", s.underMinute === 4);
}

console.log(`\n${pass + failures.length} checks, ${failures.length} failure(s).\n`);
if (failures.length) process.exitCode = 1;
