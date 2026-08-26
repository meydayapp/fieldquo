// app/components/kitchen/PlanSvg.js
//
// The browser half of the presentation drawing. Takes the shape list from
// lib/kitchen/planShapes and turns it into SVG.
//
// Deliberately thin — every decision about WHAT to draw was made in planShapes,
// so the PDF adapter can make the same picture from the same list. If a shape
// type gets special handling here that it doesn't get there, the quote a client
// signs stops matching the drawing they approved. That's the whole reason this
// file has no geometry in it.
//
// Not a client component: it renders identical markup on server and client from
// the same input, so it can go straight into a server-rendered quote page
// without shipping any JavaScript.

import {
  planShapes,
  elevationShapes,
  scaleBarShapes,
  legendShapes,
  PLAN_COLORS,
} from "@/lib/kitchen/planShapes";

/** One shape → one SVG node. The only place shape types are interpreted. */
function Shape({ s, i }) {
  const dash = s.dash ? s.dash.join(" ") : undefined;
  const common = {
    stroke: s.stroke,
    strokeWidth: s.width,
    strokeDasharray: dash,
    strokeLinecap: "round",
    fill: s.fill ?? "none",
    // Shadows are stacked translucent shapes rather than an SVG filter, so the
    // PDF adapter can draw them too — filters don't survive it.
    opacity: s.opacity,
  };

  switch (s.type) {
    case "rect":
      return <rect key={i} x={s.x} y={s.y} width={s.w} height={s.h} rx={s.rx} {...common} />;
    case "line":
      return <line key={i} x1={s.x1} y1={s.y1} x2={s.x2} y2={s.y2} {...common} fill="none" />;
    case "circle":
      return <circle key={i} cx={s.cx} cy={s.cy} r={s.r} {...common} />;
    case "path":
      return <path key={i} d={s.d} {...common} />;
    case "polygon":
      return (
        <polygon key={i} points={s.points.map((p) => p.join(",")).join(" ")} {...common} />
      );
    case "text":
      return (
        <text
          key={i}
          x={s.x}
          y={s.y}
          fill={s.fill}
          fontSize={s.size}
          fontWeight={s.weight}
          textAnchor={s.anchor}
          // Rotated about its own anchor, so a vertical dimension label reads
          // bottom-to-top the way it does on a drafted sheet.
          transform={s.rotate ? `rotate(${s.rotate} ${s.x} ${s.y})` : undefined}
          style={{ fontFamily: "ui-sans-serif, system-ui, sans-serif" }}
        >
          {s.text}
        </text>
      );
    default:
      // An unknown shape type draws nothing rather than throwing. This renders
      // inside a quote a client is looking at.
      return null;
  }
}

/**
 * @param design    { room, elements, finish }
 * @param title     heading above the drawing, e.g. "Kitchen plan"
 * @param subtitle  e.g. "12' × 15' room"
 * @param showScale include the scale bar (off for thumbnails)
 */
export default function PlanSvg({
  design,
  title,
  subtitle,
  showScale = true,
  className,
}) {
  const { shapes, width, height, pad, legend = [] } = planShapes(design);

  // Header, scale bar and legend live in the SHEET, outside the room, so the
  // viewBox has to make room for them. Sized in the same inch units as
  // everything else.
  const headTop = title ? 26 : 0;
  // The legend needs the foot band too. Reserved for it even on a thumbnail
  // with no scale bar — a drawing that hatches cabinets and then crops off the
  // line saying what the hatching means is worse than one that never hatched.
  const footH = showScale || legend.length ? 26 : 0;

  const vbX = -pad;
  const vbY = -pad - headTop;
  const vbW = width + pad * 2;
  const vbH = height + pad * 2 + headTop + footH;

  const scale = showScale ? scaleBarShapes({ x: -pad + 4, y: height + pad - 6, unitPx: 1 }) : [];
  const key = legendShapes(legend, {
    x: -pad + 4,
    // Below the scale bar's own "SCALE" caption when there is one, on the
    // caption's line when there isn't.
    y: height + pad + (showScale ? 16 : 6),
  });

  return (
    <svg
      viewBox={`${vbX} ${vbY} ${vbW} ${vbH}`}
      // No fixed height: the aspect ratio comes from the room, so a galley
      // kitchen renders wide and a square one square, and both stay legible on
      // a phone without their own breakpoint.
      width="100%"
      className={className}
      style={{ display: "block", background: "#ffffff" }}
      role="img"
      aria-label={
        title ? `${title}${subtitle ? `, ${subtitle}` : ""}` : "Kitchen plan drawing"
      }
    >
      {title && (
        <text
          x={vbX + 4}
          y={vbY + 14}
          fill={PLAN_COLORS.ink}
          fontSize={13}
          fontWeight={700}
          style={{ fontFamily: "ui-sans-serif, system-ui, sans-serif", letterSpacing: "0.02em" }}
        >
          {title.toUpperCase()}
        </text>
      )}
      {subtitle && (
        <text
          x={vbX + 4}
          y={vbY + 25}
          fill={PLAN_COLORS.inkMuted}
          fontSize={9}
          style={{ fontFamily: "ui-sans-serif, system-ui, sans-serif" }}
        >
          {subtitle}
        </text>
      )}

      {shapes.map((s, i) => (
        <Shape key={i} s={s} i={i} />
      ))}
      {scale.map((s, i) => (
        <Shape key={`sc${i}`} s={s} i={`sc${i}`} />
      ))}
      {key.map((s, i) => (
        <Shape key={`lg${i}`} s={s} i={`lg${i}`} />
      ))}
    </svg>
  );
}

/**
 * One wall, seen straight on.
 *
 * Separate component rather than a mode of PlanSvg: an elevation has a
 * different aspect ratio, a different title and no scale bar, and folding both
 * into one component means every caller passes a flag to say which drawing it
 * wanted.
 */
export function ElevationSvg({ design, wallId, className }) {
  const { shapes, width, height, title } = elevationShapes(design, wallId);
  const pad = 10;
  const head = 16;

  return (
    <figure style={{ margin: 0 }}>
      <svg
        viewBox={`${-pad} ${-pad - head} ${width + pad * 2} ${height + pad * 2 + head}`}
        width="100%"
        className={className}
        style={{ display: "block", background: "#ffffff" }}
        role="img"
        aria-label={title}
      >
        <text
          x={-pad + 2}
          y={-pad - 4}
          fill={PLAN_COLORS.ink}
          fontSize={7}
          fontWeight={700}
          style={{ fontFamily: "ui-sans-serif, system-ui, sans-serif", letterSpacing: "0.04em" }}
        >
          {title.toUpperCase()}
        </text>
        {shapes.map((s, i) => (
          <Shape key={i} s={s} i={i} />
        ))}
      </svg>
    </figure>
  );
}

/**
 * The whole sheet: plan, then the elevations that have anything on them.
 *
 * Empty walls are skipped rather than drawn blank. Four elevations where two
 * are bare rectangles makes the sheet look padded, and a homeowner counts the
 * empty ones as walls the contractor forgot.
 */
export function KitchenSheet({ design, title = "Kitchen plan", subtitle, className }) {
  const elements = Array.isArray(design?.elements) ? design.elements : [];
  const walls = ["A", "B", "C", "D"].filter((id) =>
    elements.some((el) => el?.wall === id),
  );

  return (
    <div className={className}>
      <PlanSvg design={design} title={title} subtitle={subtitle} />
      {walls.length > 0 && (
        <>
          <p
            style={{
              margin: "1.25rem 0 0.5rem",
              fontSize: "0.7rem",
              fontWeight: 700,
              letterSpacing: "0.06em",
              color: PLAN_COLORS.ink,
            }}
          >
            ELEVATIONS
          </p>
          {/* auto-fit rather than a fixed column count: three elevations sit in
              a row on a laptop and stack on a phone with no breakpoint of their
              own, and a kitchen with one wall doesn't get a lonely third-width
              drawing. */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
              gap: "0.75rem",
            }}
          >
            {walls.map((id) => (
              <ElevationSvg key={id} design={design} wallId={id} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
