// docs/screens/app-guide/harness/fixtures/api.js
//
// window.fetch, answered from fixtures. Every route a photographed page
// reads is listed in routes.js; anything else is answered 404 with a JSON
// error and recorded in window.__unanswered so the capture run can print
// "this page asked for X and got nothing" instead of hiding an empty state
// behind a real-looking screen.
import { ROUTES } from "./routes.js";

const json = (body, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
const delay = (ms) => new Promise((r) => setTimeout(r, ms));

export function installFetch({ screen, lang }) {
  window.__calls = [];
  window.__unanswered = [];
  window.__inflight = 0;
  window.fetch = async (url, options = {}) => {
    const method = (options.method || "GET").toUpperCase();
    const u = new URL(String(url), "http://harness.local");
    const key = u.pathname;
    window.__calls.push({ url: key + u.search, method });
    window.__inflight++;
    window.__onFetch?.();
    try {
      await delay(30);
      // First match wins — unless its reply calls ctx.next(), which hands
      // the request to the next route that matches. That is how
      // routes-help.js answers a route for the crew and leaves the owner's
      // answer where it always was.
      const answer = async (from) => {
        for (let i = from; i < ROUTES.length; i++) {
          const route = ROUTES[i];
          const m = typeof route.path === "string" ? (route.path === key ? [] : null) : key.match(route.path);
          if (!m) continue;
          if (route.method && route.method !== method) continue;
          const body = await route.reply({ params: m, search: u.searchParams, method, body: options.body, screen, lang, next: () => answer(i + 1) });
          if (body instanceof Response) return body;
          return json(body, route.status || 200);
        }
        window.__unanswered.push(method + " " + key + u.search);
        return json({ error: `Harness has no answer for ${method} ${key}` }, 404);
      };
      return await answer(0);
    } finally {
      window.__inflight--;
      window.__onFetch?.();
    }
  };
}
