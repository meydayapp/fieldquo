// Harness stub for @/lib/clientErrors: the real one toasts; here the server's
// sentence lands in the setter (three-arg form) and on the console.
export function showError(message) { console.log("[showError]", message); window.__lastError = message; }
export async function reportResponseError(res, setterOrFallback, maybeFallback) {
  const setter = typeof setterOrFallback === "function" ? setterOrFallback : null;
  const fallback = setter ? maybeFallback : setterOrFallback;
  let msg = fallback;
  try { const data = await res.json(); if (data?.error) msg = data.error; } catch {}
  if (setter) setter(msg);
  showError(msg);
}
