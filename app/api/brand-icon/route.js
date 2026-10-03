// app/api/brand-icon/route.js
//
// The favicon of a company with no logo Cloudinary can square: its initial
// on its brand colour. Referenced only from lib/whiteLabel/pageMetadata.js,
// which builds the URL — see that file for why this exists at all.
//
// ── Why the query string and not a company slug ───────────────────────────
//
// Everything this draws is in the URL: a colour and a letter, both already
// printed on every document the company sends. So the route reads no
// database row, cannot be used to probe whether a slug exists, and is the
// same bytes for the same URL forever — which is what makes the year-long
// immutable cache honest.
//
// ── Why under /api ─────────────────────────────────────────────────────────
//
// middleware.js passes /api through untouched on a tenant subdomain (a
// contractor's own site asks for its icon from its own host), and a path with
// no file extension would otherwise be rewritten to /site/<subdomain>/….
//
// Contrast is not decided here: brandIconSpec narrows every input and takes
// both colours from lib/documents/theme.js's fillPair, which measures them.
import { ImageResponse } from "next/og";
import { brandIconSpec } from "@/lib/whiteLabel/pageMetadata";

export async function GET(request) {
  const q = new URL(request.url).searchParams;
  const { size, letter, bg, fg } = brandIconSpec({ colour: q.get("c"), letter: q.get("l"), size: q.get("s") });
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: bg,
          color: fg,
          fontSize: `${Math.round(size * 0.62)}px`,
          fontWeight: 700,
          fontFamily: "sans-serif",
          lineHeight: 1,
        }}
      >
        {letter}
      </div>
    ),
    {
      width: size,
      height: size,
      headers: { "Cache-Control": "public, max-age=31536000, immutable" },
    },
  );
}
