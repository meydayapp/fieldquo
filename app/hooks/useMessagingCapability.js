// app/hooks/useMessagingCapability.js
//
// "Can this device open a messaging app, and which sms: separator does it
// want?" — read as an external store rather than in a mount effect.
//
// Why not `useState` + `useEffect`: the server has no `window`, so the value
// has to start at the desktop default and correct itself on the client. Done
// with an effect that calls setState, that is a cascading render on every
// mount (and the lint rule React ships now says so). `useSyncExternalStore`
// exists for exactly this — it renders the server snapshot during hydration
// and swaps in the real one immediately after, with no mismatch.
"use client";

import { useSyncExternalStore } from "react";
import {
  detectMessagingCapability,
  SMS_CAPABLE_MEDIA_QUERY,
} from "@/lib/share/messagingLinks";

// Desktop: hides the SMS button. The safe default — a control that can't work
// is absent for a frame rather than present and dead.
const SERVER_SNAPSHOT = { canText: false, iosStyle: false };

// useSyncExternalStore compares snapshots by identity, so a fresh object per
// call is an infinite render loop. Cached until the query actually changes.
let cached = null;

function subscribe(onStoreChange) {
  const mq = window.matchMedia?.(SMS_CAPABLE_MEDIA_QUERY);
  // Nothing to listen to (old Safari, jsdom) is not an error: the snapshot is
  // still correct, it just never changes.
  if (!mq?.addEventListener) return () => {};
  const handler = () => {
    cached = null;
    onStoreChange();
  };
  mq.addEventListener("change", handler);
  return () => mq.removeEventListener("change", handler);
}

function getSnapshot() {
  if (!cached) cached = detectMessagingCapability(window);
  return cached;
}

/** `{ canText, iosStyle }`. */
export function useMessagingCapability() {
  return useSyncExternalStore(subscribe, getSnapshot, () => SERVER_SNAPSHOT);
}
