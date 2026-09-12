// Harness stub for @/lib/notify/swClient: no service worker in a file:// page.
export const SW_PATH = "/sw.js";
export function pushSupported() { return false; }
export function urlBase64ToUint8Array() { return new Uint8Array(); }
export async function ensureRegistered() { return null; }
export async function currentSubscription() { return null; }
export async function subscribePush() { return null; }
export async function unsubscribePush() { return null; }
export function onPushMessage() { return () => {}; }
