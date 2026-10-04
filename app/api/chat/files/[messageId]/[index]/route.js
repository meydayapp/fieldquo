// app/api/chat/files/[messageId]/[index]/route.js
//
// The ONLY way a team-chat photo or file is opened. Chat files are private
// (owner decision 2026-10-04 — like HR documents): stored under Cloudinary's
// "authenticated" type, whose plain URL Cloudinary refuses. Every link on a
// screen is this route, carrying a reader-bound, expiring signature
// (lib/company/chat/fileLinks.js), and every open re-checks:
//
//   1. a session (memberOrRefusal);
//   2. the link's signature — for THIS reader, this file, this size — and
//      its expiry: an expired link answers 410 `link_expired` (the screen
//      re-reads the thread for fresh links); a link minted for somebody
//      else, or altered, answers 404;
//   3. that the reader can read the message's room NOW — company first, then
//      their open membership (a private channel answers a non-member 404,
//      exactly like a file that does not exist) — and that the message has
//      not been removed (lib/company/chat/store.js chatFileFor).
//
// GET ?v=full  → 302 to a Cloudinary download link that expires in five
//                minutes (the HR signer). The stored URL never reaches a
//                browser.
// GET ?v=thumb → the bytes of a 640 px JPEG, fetched server-side from a
//                signed transformation URL that never leaves this server
//                (a signed delivery URL never expires, so it is not handed
//                out). Photos only.
//
// A GET that writes nothing, so it behaves under read-only impersonation
// exactly as the thread that links to it does — the support session reads
// every room, and so may open what is in them.
//
// `params` is a Promise in Next 16.
export const runtime = "nodejs";

import { NextResponse } from "next/server";
import { memberOrRefusal } from "@/lib/apiMember";
import { chatFileFor } from "@/lib/company/chat/store";
import { verifyFileLink } from "@/lib/company/chat/fileLinks";
import { cloudinaryReady, expiringFileLink, thumbnailSourceUrl } from "@/lib/company/chat/cloudinaryFiles";

const PRIVATE = { "Cache-Control": "private, no-store", "Referrer-Policy": "no-referrer" };
const answer = (status, code, error) => NextResponse.json({ error, code }, { status, headers: PRIVATE });

export async function GET(request, { params }) {
  const { member, response } = await memberOrRefusal(request);
  if (response) return response;
  const { messageId, index } = await params;
  const url = new URL(request.url);
  const variant = url.searchParams.get("v") === "thumb" ? "thumb" : "full";

  const link = verifyFileLink(member, {
    messageId,
    index,
    variant,
    exp: url.searchParams.get("exp"),
    sig: url.searchParams.get("sig"),
  });
  if (!link.ok) {
    if (link.code === "expired") return answer(410, "link_expired", "This link has expired. Reopen the conversation to see the file.");
    if (link.code === "unavailable") return answer(503, "unavailable", "Files can't be opened right now.");
    return answer(404, "no_file", "No such file.");
  }

  const file = await chatFileFor(member, messageId, index);
  if (!file) return answer(404, "no_file", "No such file.");
  if (!cloudinaryReady()) return answer(503, "unavailable", "Files can't be opened right now — file storage isn't configured.");

  if (variant === "thumb") {
    if (file.type !== "photo") return answer(404, "no_file", "No such file.");
    let upstream;
    try {
      upstream = await fetch(thumbnailSourceUrl(file.location), { signal: AbortSignal.timeout(15000) });
    } catch {
      return answer(502, "unavailable", "The photo couldn't be loaded just now.");
    }
    if (!upstream.ok || !upstream.body) return answer(502, "unavailable", "The photo couldn't be loaded just now.");
    return new Response(upstream.body, {
      status: 200,
      headers: {
        "Content-Type": "image/jpeg",
        // The link itself expires within the hour; the browser may keep the
        // picture for as long as the link it came from is good, and no shared
        // cache may keep it at all.
        "Cache-Control": "private, max-age=3600",
        "Referrer-Policy": "no-referrer",
        "X-Content-Type-Options": "nosniff",
      },
    });
  }

  const res = NextResponse.redirect(expiringFileLink(file.location), 302);
  for (const [k, v] of Object.entries(PRIVATE)) res.headers.set(k, v);
  return res;
}
