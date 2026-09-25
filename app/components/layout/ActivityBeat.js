// app/components/layout/ActivityBeat.js
//
// The /app half of "who is signed in right now": once a minute, while this
// tab is visible and someone has touched it recently, tell POST /api/presence
// that a person is here. Renders nothing.
//
// The route's header argues why this is a browser beat rather than a stamp
// on every authenticated request. The two conditions here are the point of
// that choice, so they are both enforced:
//
//   · VISIBLE — document.visibilityState. A background tab, a minimised
//     window and a locked phone are not somebody using FieldQuo.
//   · TOUCHED — any pointer, key, wheel or touch input in the last
//     IDLE_AFTER_MS. A visible tab on an office monitor nobody is sitting at
//     would otherwise read "Online now" all weekend. Ten minutes is generous
//     on purpose: reading a long quote without moving the mouse is still
//     using the product, and the cost of the generosity is one company that
//     reads "Online now" for a few minutes after someone walked away.
//
// Fire-and-forget. The response is not read except to stop beating after a
// 401/403 (the session ended, or this is a support session the server
// refused) — nothing here is a control, so there is no error to show anyone,
// and a failed beat costs one badge being a minute stale.
"use client";

import { useEffect } from "react";

/** How often a present tab beats. The server writes at most every two minutes. */
const BEAT_MS = 60 * 1000;
/** No input for this long and the tab stops counting as a person. */
const IDLE_AFTER_MS = 10 * 60 * 1000;
/** Input events that mean a hand is on the tab. Passive, capture: never in anyone's way. */
const INPUT_EVENTS = ["pointerdown", "pointermove", "keydown", "wheel", "touchstart", "scroll"];

export default function ActivityBeat({ enabled = true }) {
  useEffect(() => {
    if (!enabled || typeof document === "undefined") return undefined;

    // The page having just loaded is itself input: someone navigated here.
    let lastInput = Date.now();
    let lastBeat = 0;
    let stopped = false;

    const present = () =>
      document.visibilityState === "visible" && Date.now() - lastInput < IDLE_AFTER_MS;

    const beat = async () => {
      if (stopped || !present()) return;
      lastBeat = Date.now();
      try {
        const res = await fetch("/api/presence", { method: "POST", keepalive: true });
        // Signed out, or a support session the server will never stamp: there
        // is nothing to retry, so stop asking.
        if (res.status === 401 || res.status === 403) stopped = true;
      } catch {
        /* offline or a blip; the next interval tries again */
      }
    };

    const onInput = () => {
      lastInput = Date.now();
    };
    const onVisibility = () => {
      if (document.visibilityState !== "visible") return;
      // Coming back to the tab is a person arriving. Beat now unless one went
      // out within the interval — flipping between tabs must not become a
      // request per flip.
      lastInput = Date.now();
      if (Date.now() - lastBeat >= BEAT_MS) beat();
    };

    beat();
    const id = setInterval(beat, BEAT_MS);
    for (const e of INPUT_EVENTS) {
      document.addEventListener(e, onInput, { passive: true, capture: true });
    }
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      stopped = true;
      clearInterval(id);
      for (const e of INPUT_EVENTS) {
        document.removeEventListener(e, onInput, { capture: true });
      }
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [enabled]);

  return null;
}
