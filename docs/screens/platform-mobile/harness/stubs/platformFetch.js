// window.fetch for the platform harness. Every /api/* read the pages and the
// rail make is answered from ../fixtures/; anything else is a loud error so a
// page that quietly depends on a route nobody stubbed cannot render a wrong
// screen. The real lib/fetchJson stays in the bundle — it only wraps fetch —
// so the pages run their shipped request code.
//
// /api/staff/* (the team chat on /platform/chat) is answered by the team-chat
// harness's own stub, docs/screens/team-chat/harness/staffFetch.js, so the
// rooms and people on that screen are the ones its frames already show.
import { FIXTURES } from "../fixtures/index.js";
import { fetchJson as staffFetch } from "../../../team-chat/harness/staffFetch.js";

const json = (body, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

async function answer(ctx) {
  if (ctx.path.startsWith("/api/staff/")) {
    try {
      return json(await staffFetch(ctx.path + ctx.url.search, { method: ctx.method, body: ctx.rawBody }));
    } catch (err) {
      return json({ error: String(err?.message || err) }, 400);
    }
  }
  for (const fixture of FIXTURES) {
    const out = fixture(ctx);
    if (out !== undefined) return out instanceof Response ? out : json(out);
  }
  return null;
}

const realFetch = window.fetch.bind(window);
window.fetch = async (url, options = {}) => {
  const u = new URL(String(url), "http://harness.local");
  if (!u.pathname.startsWith("/api/")) return realFetch(url, options);
  const method = (options.method || "GET").toUpperCase();
  let body = null;
  const rawBody = options.body;
  try { body = typeof rawBody === "string" ? JSON.parse(rawBody) : rawBody instanceof FormData ? Object.fromEntries(rawBody.entries()) : null; } catch {}
  (window.__harnessCalls ||= []).push({ url: u.pathname + u.search, method, body });
  await new Promise((r) => setTimeout(r, 20));
  const out = await answer({ method, path: u.pathname, url: u, body, rawBody });
  if (out === null) {
    (window.__harnessUnanswered ||= []).push(method + " " + u.pathname);
    return json({ error: "Harness has no answer for " + method + " " + u.pathname }, 500);
  }
  return out;
};
