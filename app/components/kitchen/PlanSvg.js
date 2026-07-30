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

import { planShapes, scaleBarShapes, PLAN_COLORS } from "@/lib/kitchen/planShapes";

/** One shape → one SVG node. The only place shape types are interpreted. */
function Shape({ s, i }) {
  const dash = s.dash ? s.dash.join(" ") : undefined;
  const common = {
    stroke: s.stroke,
    strokeWidth: s.width,
    strokeDasharray: dash,
    strokeLinecap: "round",
    fill: s.fill ?? "none",
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
  const { shapes, width, height, pad } = planShapes(design);

  // Header and scale bar live in the SHEET, outside the room, so the viewBox
  // has to make room for them. Sized in the same inch units as everything else.
  const headTop = title ? 26 : 0;
  const scaleH = showScale ? 26 : 0;

  const vbX = -pad;
  const vbY = -pad - headTop;
  const vbW = width + pad * 2;
  const vbH = height + pad * 2 + headTop + scaleH;

  const scale = showScale ? scaleBarShapes({ x: -pad + 4, y: height + pad - 6, unitPx: 1 }) : [];

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
    </svg>
  );
}
