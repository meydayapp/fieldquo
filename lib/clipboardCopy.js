// lib/clipboardCopy.js
//
// Copy something the browser has to FETCH first, without losing the click.
//
// ── The bug this exists for ─────────────────────────────────────────────────
//
// "Copy quote link" has to ask the server for the share token before it has a
// URL to copy, so the handler read:
//
//     const url = await fetchClientLink(id);
//     await navigator.clipboard.writeText(url);
//
// Safari and every WebKit view (an iPhone, an iPad, a desktop app's embedded
// browser) grant the clipboard only to the gesture that asked for it, and an
// `await` in between ends the gesture. The second line then throws
// NotAllowedError — "The request is not allowed by the user agent or the
// platform in the current context, possibly because the user denied
// permission" — which the owner hit as the owner, signed in, on a page that
// had never worked on that browser. Chrome is more forgiving, which is why it
// survived review.
//
// ── Why ClipboardItem and not a reordering ──────────────────────────────────
//
// The obvious alternative — fetch the link earlier, on page load or on menu
// open — was rejected: the share token is MINTED on first use (POST
// /api/quotes/[id]/share), so fetching it before anyone asks would create a
// public link for every quote somebody merely looked at.
//
// `ClipboardItem` takes a PROMISE of the contents. The write is therefore
// issued inside the gesture, before any await, and the network round trip
// resolves into a clipboard entry the browser has already committed to. That
// is precisely what the API was added for.
//
// ── And when it is refused anyway ───────────────────────────────────────────
//
// Plain http has no `navigator.clipboard` at all, and an embedded browser may
// refuse regardless. Then this throws an error carrying the TEXT, so the
// caller can put the link on screen to copy by hand. A copy button that fails
// silently, or one that leaves a red banner and no link, is the dead control
// AGENTS.md forbids — the person still needs the URL.

/** The error a refusal throws: `code` to branch on, `text` to show. */
export class ClipboardRefused extends Error {
  constructor(text, cause) {
    super("clipboard_refused");
    this.code = "clipboard_refused";
    this.text = text;
    this.cause = cause;
  }
}

/**
 * @param textPromise  a promise of the string to copy — ALREADY STARTED by the
 *   caller, inside the click handler. Do not `await` it first; that is the
 *   whole bug.
 * @returns the copied text.
 * @throws  whatever `textPromise` rejects with (the fetch failed — nothing to
 *   copy and nothing to show), or ClipboardRefused carrying the text.
 */
export async function copyFromPromise(textPromise) {
  const pending = Promise.resolve(textPromise);

  if (typeof ClipboardItem !== "undefined" && navigator?.clipboard?.write) {
    // Constructed and handed over synchronously: nothing is awaited above
    // this line, so the gesture is still live when write() is called.
    const item = new ClipboardItem({
      "text/plain": pending.then((t) => new Blob([String(t)], { type: "text/plain" })),
    });
    try {
      await navigator.clipboard.write([item]);
      return await pending;
    } catch (err) {
      // The fetch itself failing is the caller's error, not a refusal: there
      // is no link to show by hand either, so it is re-thrown as-is.
      const text = await pending;
      throw new ClipboardRefused(text, err);
    }
  }

  const text = await pending;
  if (!navigator?.clipboard?.writeText) throw new ClipboardRefused(text);
  try {
    await navigator.clipboard.writeText(text);
    return text;
  } catch (err) {
    throw new ClipboardRefused(text, err);
  }
}
