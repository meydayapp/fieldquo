// lib/sales/discovery/snapshotProbe.js
//
// Does this snapshot URL actually serve this snapshot file?
//
// ══ Why a derived URL still has to be proved ═══════════════════════════════
//
// The object key comes from the library, so it cannot be mistyped. The BASE
// cannot be anything but typed — it is the one thing the owner pastes — and
// every way of getting it slightly wrong produces a URL that looks perfect and
// fetches nothing: the wrong bucket, public access never switched on, a custom
// domain that serves the root but not the prefix, a bucket whose objects were
// uploaded under a different prefix than the manifest recorded.
//
// A campaign saved against one of those does not fail. It runs, reads zero
// rows, and reports a completed campaign that found nobody — days later, with
// the pipeline budget already spent. So the URL is fetched at the moment it is
// saved, and a save that cannot prove the file is there is REFUSED.
//
// ══ Why the first line and not a HEAD ══════════════════════════════════════
//
// A HEAD proves an object exists at that key. The first line proves it is the
// file we think it is: every snapshot begins with a header naming its provider,
// its release and its row count, so reading it catches the case a HEAD cannot —
// a base URL that serves a DIFFERENT bucket's objects under the same names.
//
// It is a ranged read, and the stream is closed after the first newline
// whatever the origin does with the Range header. The largest part is 63 MB and
// an origin that ignores Range would otherwise download all of it to look at
// its first 300 bytes.
//
// `fetchImpl` is injected so the check can drive every branch — a 404, a
// non-JSON first line, another provider's file — without a bucket.

/** How much of the file may be read before giving up on finding a newline. */
const MAX_HEADER_BYTES = 64 * 1024;

/**
 * The first line of a URL, without downloading the rest of it.
 *
 * @returns {{ line: string|null, status: number|null, error: string|null }}
 */
async function fetchFirstLine(url, { fetchImpl = fetch, signal = null } = {}) {
  let response;
  try {
    response = await fetchImpl(url, {
      redirect: "follow",
      headers: { Range: `bytes=0-${MAX_HEADER_BYTES - 1}` },
      ...(signal ? { signal } : {}),
    });
  } catch (err) {
    return { line: null, status: null, error: `could not be fetched: ${err?.message || err}` };
  }
  // 206 is a served range, 200 is an origin that ignored it. Both are fine —
  // the read below stops at the first newline either way.
  if (!response?.ok) {
    return { line: null, status: response?.status ?? null, error: `answered ${response?.status ?? "no status"}` };
  }

  let text = "";
  const body = response.body;
  if (body && typeof body.getReader === "function") {
    const reader = body.getReader();
    const decoder = new TextDecoder();
    try {
      while (text.length < MAX_HEADER_BYTES) {
        const { done, value } = await reader.read();
        if (done) break;
        text += decoder.decode(value, { stream: true });
        if (text.includes("\n")) break;
      }
    } catch (err) {
      return { line: null, status: response.status, error: `could not be read: ${err?.message || err}` };
    } finally {
      // Never left open. An abandoned reader on a 63 MB object holds the
      // connection until the whole body arrives.
      reader.cancel().catch(() => {});
    }
  } else {
    // A stubbed or buffered response. `text()` is the only way in, and the
    // slice keeps the cost the same as the streamed path.
    try {
      text = String(await response.text()).slice(0, MAX_HEADER_BYTES);
    } catch (err) {
      return { line: null, status: response.status, error: `could not be read: ${err?.message || err}` };
    }
  }

  const newline = text.indexOf("\n");
  const line = (newline === -1 ? text : text.slice(0, newline)).trim();
  if (!line) return { line: null, status: response.status, error: "served an empty file" };
  return { line, status: response.status, error: null };
}

/**
 * Prove that `url` serves the snapshot `file` describes.
 *
 * @param {string} url          the derived URL
 * @param {object|null} file    the library row it was derived from, or null to
 *                              accept any FieldQuo snapshot (used when proving
 *                              a base URL against whichever file is cheapest)
 * @returns {{ ok: boolean, problem: string|null, header: object|null }}
 */
export async function probeSnapshot(url, file = null, { fetchImpl = fetch, signal = null } = {}) {
  const target = typeof url === "string" ? url.trim() : "";
  if (!target) return { ok: false, problem: "There is no URL to check.", header: null };

  const { line, error } = await fetchFirstLine(target, { fetchImpl, signal });
  if (error) return { ok: false, problem: `${target} ${error}.`, header: null };

  let header;
  try {
    header = JSON.parse(line);
  } catch {
    return {
      ok: false,
      problem:
        `${target} answered, but its first line is not a snapshot header. That is usually a base URL ` +
        `pointing at a bucket index or an error page rather than at the files.`,
      header: null,
    };
  }
  if (!header || typeof header !== "object" || header.fieldquoSnapshot !== 1) {
    return { ok: false, problem: `${target} is not a FieldQuo snapshot file.`, header: null };
  }
  if (file?.provider && header.provider !== file.provider) {
    return {
      ok: false,
      problem:
        `${target} holds ${JSON.stringify(header.provider)} rows, but that key is ` +
        `${file.provider} in the library. The base URL is serving a different bucket.`,
      header,
    };
  }
  if (file?.release && header.release !== file.release) {
    return {
      ok: false,
      problem:
        `${target} is release ${JSON.stringify(header.release)}; the library measured ` +
        `${JSON.stringify(file.release)}. Re-run scripts/build-snapshot-library.mjs against the files that ` +
        `were actually uploaded, or upload the ones that were measured.`,
      header,
    };
  }
  // The count is NOT held to the library's row count. The Overture splitter
  // copied each region's header verbatim into its parts, so part 1 of
  // California says 78,247 — the region's total — and a part that is entirely
  // correct would fail a count comparison. The count is reported, never gated
  // on; the row totals the screens show come from the measured library.
  return { ok: true, problem: null, header };
}
