const delay = (ms) => new Promise((r) => setTimeout(r, ms));
export async function fetchJson(url, options = {}) {
  await delay(20);
  const params = new URLSearchParams(window.location.search);
  const on = params.get("push") === "on";
  if (url.includes("push-subscription")) {
    if ((options.method || "GET") === "GET") return { configured: on, publicKey: on ? "BPUBLICKEY" : null, live: on ? 1 : 0 };
    return { ok: true, sent: 1 };
  }
  return {};
}
export function errorText() { return ""; }
export default fetchJson;
