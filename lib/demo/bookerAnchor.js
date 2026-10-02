// lib/demo/bookerAnchor.js
//
// Where on fieldquo.com a visitor books a demo themselves: the homepage's
// closing section (app/components/marketing/home/FinalCTA.js), which renders
// the DemoBooking picker under this element id.
//
// Its own file because two sides have to agree on one string and neither may
// import the other: Jennifer's route allowlist (server code, which must not
// pull a "use client" component into its graph) and the homepage section that
// carries the id. A typo on either side would ship a "Book a demo" button
// that lands at the top of the homepage and books nothing — the dead control
// AGENTS.md's rule exists for — so scripts/check-jennifer.mjs asserts both
// sides read this constant.

/** The element id the demo picker sits under on the homepage. */
export const DEMO_BOOKER_ANCHOR = "book-a-demo";

/** The same-origin path that lands on it — the homepage, scrolled to the picker. */
export const DEMO_BOOKER_PATH = `/#${DEMO_BOOKER_ANCHOR}`;
