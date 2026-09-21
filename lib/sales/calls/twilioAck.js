// lib/sales/calls/twilioAck.js
//
// How a Twilio NOTIFICATION webhook answers — and the one shape it must not.
//
// ══ 2026-09-18: forty-eight alerts and no recordings ══════════════════════
//
// Every outbound call-status callback and every recording callback answered
// 500 for a day. Nothing in the handlers was wrong; the last line was:
//
//     return new NextResponse("", { status: 204 });
//
// The Fetch standard's Response constructor refuses a body — and an empty
// string IS a body — on a null-body status (204, 205, 304). Node's own
// undici says so with "Response constructor: Invalid response status code
// 204", and Vercel's runtime threw exactly that sentence on
// /api/rep-dial/status and /api/rep-dial/recording, after the handler had
// already done its work. Twilio saw the 500, raised error 15003 on each
// event, and — because a status callback is sent once — never retried.
//
// Three route files had written the same line by hand, and the inbound
// route, written later, had `null`. This helper exists so the answer is
// written once, and so scripts/check-sales-recording.mjs can refuse the
// string form wherever it reappears.
//
// ══ A throw is a logged error and a 204, never a 500 ══════════════════════
//
// A notification route has nobody to tell. Twilio reads nothing but the
// status, retries nothing on a call-progress event, and files a warning the
// owner sees days later. So `acknowledged()` runs the handler and turns
// anything it throws into a PlatformErrorLog row — the platform's own error
// page, where it is seen the same day — and an empty 204. The write the
// handler was doing has either landed or not by then; a 500 would not undo
// it and would only hide the reason.
//
// Not for TwiML stages. A `<Dial>` action or a `<Gather>` callback is a
// request for instructions, and an empty 204 there leaves the caller in
// silence; those keep their own answers.
import { recordError } from "@/lib/platform/errorLog";

/**
 * An empty 204. The body is `null`, not `""` — see the header. Exported
 * under a name rather than inlined so a grep finds every notification
 * answer and the check can assert none of them carries a body.
 *
 * A plain Response, not NextResponse: a route handler may return either,
 * and the plain one lets scripts/check-sales-recording.mjs execute this
 * file under bare Node, where `next/server` does not resolve.
 */
export function noContent() {
  return new Response(null, { status: 204 });
}

/**
 * Run `work` and answer whatever it returns; if it throws, record why and
 * answer 204.
 *
 * @param {() => Promise<Response>} work
 * @param {{ area: string, code?: string, what: string, log?: Function }} about
 *   `what` names the event in the error message — "a call status for
 *   attempt x" — so the log row says which webhook lost what. `log` is
 *   recordError unless the check script hands in a stub.
 */
export async function acknowledged(work, { area, code = "webhook_threw", what, log = recordError }) {
  try {
    return await work();
  } catch (err) {
    await log({
      area,
      code,
      message: `${what} could not be handled and was answered 204: ${err?.message || String(err)}`,
      detail: {
        name: err?.name || null,
        stack: typeof err?.stack === "string" ? err.stack.split("\n").slice(0, 4).join("\n") : null,
      },
    }).catch(() => {});
    return noContent();
  }
}
