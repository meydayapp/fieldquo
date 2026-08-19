// lib/marketing/ogCard.js
//
// The 1200×630 social card behind opengraph-image.js.
//
// Drawn rather than shipped as a PNG because the only mark in the repo is
// public/logo/FieldQuo_logo_horizontal_outlined.png — 1200×360 with a
// TRANSPARENT background. Messaging apps composite that onto whatever they
// like (several use black), and at 10:3 it gets cropped to fit a 2:1 card.
// A transparent, cropped logo is a worse first impression than no image.
//
// Deliberately plain: brand navy, the wordmark, one line of what this is. No
// screenshot, because a screenshot goes stale the next time the app changes
// and nobody remembers this file exists.
//
// Colours are the literal brand values, not tokens: ImageResponse renders with
// Satori, which has no CSS variables and no Tailwind.
import { ImageResponse } from "next/og";

const NAVY = "#06356b";
const ORANGE = "#f5821f";
const CREAM = "#f5f2ec";

export const OG_SIZE = { width: 1200, height: 630 };
export const OG_CONTENT_TYPE = "image/png";

/**
 * @param headline  the big line. Keep it short — Satori does not hyphenate.
 * @param sub       one supporting line, or null for none.
 */
export function renderOgCard({ headline, sub }) {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          backgroundColor: NAVY,
          padding: "80px",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "18px" }}>
          <div
            style={{
              width: "28px",
              height: "28px",
              borderRadius: "8px",
              backgroundColor: ORANGE,
            }}
          />
          <div
            style={{
              fontSize: "34px",
              fontWeight: 700,
              color: "#ffffff",
              letterSpacing: "-0.5px",
            }}
          >
            FieldQuo
          </div>
        </div>

        <div
          style={{
            marginTop: "40px",
            fontSize: "68px",
            fontWeight: 700,
            color: "#ffffff",
            lineHeight: 1.1,
            letterSpacing: "-2px",
            // Satori needs an explicit width to wrap.
            maxWidth: "980px",
          }}
        >
          {headline}
        </div>

        {sub ? (
          <div
            style={{
              marginTop: "28px",
              fontSize: "32px",
              color: CREAM,
              lineHeight: 1.35,
              maxWidth: "900px",
            }}
          >
            {sub}
          </div>
        ) : null}
      </div>
    ),
    OG_SIZE,
  );
}
