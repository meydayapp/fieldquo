"use client";

// app/components/kitchen/ApplianceGlyph.js
//
// The appliances on a kitchen elevation, drawn as SVG.
//
// Written for FieldQuo rather than adapted: the TrueFinish source imported an
// ApplianceGlyph that wasn't included in what the owner supplied, and the
// designer renders nothing recognisable without it.
//
// ── Why drawn rather than iconography ─────────────────────────────────────
//
// These sit INSIDE the elevation at the appliance's real measured size, next to
// cabinet faces drawn the same way. A lucide icon would be a fixed-size pictogram
// floating in a scale drawing — it wouldn't tell you the fridge is 36" wide and
// won't fit the 33" gap, which is the entire question a homeowner is asking when
// they look at this.
//
// So every glyph is proportional to the rect it's given: the fridge's freezer
// split sits at a real fraction of its height, the range has four burners laid
// out across its actual width. Scale is the information.
//
// Deliberately line-work over a light fill, not photorealism. This is a technical
// drawing that goes on a quote — a homeowner needs to see the LAYOUT, and a
// rendered stainless fridge would suggest FieldQuo is promising a specific
// appliance the contractor may not be supplying.

/** Every appliance the designer can place. */
const KINDS = ["fridge", "stove", "dishwasher", "hoodVent"];

export default function ApplianceGlyph({
  kind,
  x = 0,
  y = 0,
  w = 0,
  h = 0,
  theme = {},
  variant = "standalone",
}) {
  if (!KINDS.includes(kind) || w <= 0 || h <= 0) return null;

  const stroke = theme.textMuted || "#9ca3af";
  const line = theme.border || "#2a2d36";
  const accent = theme.gold || "#bd9d60";
  // A wash rather than a solid: the elevation behind carries the wall, and a
  // filled box would read as a cabinet.
  const fill = "rgba(148,163,184,0.10)";

  // Detail scales with the box, and stops shrinking below hairline — at the zoom
  // levels a phone uses, a 0.3px stroke disappears entirely and the appliance
  // reads as an empty rectangle.
  const sw = Math.max(0.6, Math.min(w, h) * 0.012);
  const r = Math.min(3, w * 0.05);

  const common = { fill: "none", stroke, strokeWidth: sw, strokeLinecap: "round" };

  return (
    <g pointerEvents="none">
      <rect x={x} y={y} width={w} height={h} rx={r} fill={fill} stroke={line} strokeWidth={sw} />

      {kind === "fridge" && (
        <>
          {/* Freezer-over-fridge: the divider sits at the top third, which is
              where it is on the overwhelming majority of units this size. */}
          <line x1={x} y1={y + h * 0.34} x2={x + w} y2={y + h * 0.34} {...common} />
          {/* Handles, inset from the opening edge on both doors. */}
          <line
            x1={x + w * 0.82} y1={y + h * 0.10}
            x2={x + w * 0.82} y2={y + h * 0.26}
            {...common} stroke={accent}
          />
          <line
            x1={x + w * 0.82} y1={y + h * 0.42}
            x2={x + w * 0.82} y2={y + h * 0.88}
            {...common} stroke={accent}
          />
        </>
      )}

      {kind === "stove" && (
        <>
          {/* Cooktop band, then the oven door and its handle. */}
          <line x1={x} y1={y + h * 0.22} x2={x + w} y2={y + h * 0.22} {...common} />
          {[0.28, 0.72].map((cx) =>
            [0.09, 0.15].map((cy) => (
              <circle
                key={`${cx}-${cy}`}
                cx={x + w * cx}
                cy={y + h * cy}
                r={Math.min(w, h) * 0.045}
                {...common}
              />
            )),
          )}
          <rect
            x={x + w * 0.1} y={y + h * 0.34}
            width={w * 0.8} height={h * 0.52}
            rx={r} {...common}
          />
          <line
            x1={x + w * 0.18} y1={y + h * 0.30}
            x2={x + w * 0.82} y2={y + h * 0.30}
            {...common} stroke={accent}
          />
        </>
      )}

      {kind === "dishwasher" && (
        <>
          {/* Control fascia above the door, and the door pull. */}
          <line x1={x} y1={y + h * 0.17} x2={x + w} y2={y + h * 0.17} {...common} />
          <line
            x1={x + w * 0.15} y1={y + h * 0.09}
            x2={x + w * 0.5} y2={y + h * 0.09}
            {...common}
          />
          <line
            x1={x + w * 0.15} y1={y + h * 0.28}
            x2={x + w * 0.85} y2={y + h * 0.28}
            {...common} stroke={accent}
          />
        </>
      )}

      {kind === "hoodVent" && (
        <>
          {/*
            Two shapes, because the choice changes the cabinetry around it and
            that is what the drawing is for. A chimney hood needs a clear run of
            wall above it — no cabinet — where an insert sits inside one. Getting
            this wrong on the drawing means ordering the wrong cabinet.
          */}
          {variant === "chimney" ? (
            <>
              <path
                d={`M ${x} ${y + h} L ${x + w * 0.28} ${y + h * 0.42} L ${x + w * 0.72} ${y + h * 0.42} L ${x + w} ${y + h}`}
                {...common}
              />
              <rect
                x={x + w * 0.34} y={y}
                width={w * 0.32} height={h * 0.42}
                {...common}
              />
            </>
          ) : (
            <>
              <rect
                x={x} y={y + h * 0.3}
                width={w} height={h * 0.7}
                rx={r} {...common}
              />
              {/* Filter baffles. */}
              {[0.3, 0.5, 0.7].map((cx) => (
                <line
                  key={cx}
                  x1={x + w * cx} y1={y + h * 0.45}
                  x2={x + w * cx} y2={y + h * 0.85}
                  {...common}
                />
              ))}
            </>
          )}
        </>
      )}
    </g>
  );
}
