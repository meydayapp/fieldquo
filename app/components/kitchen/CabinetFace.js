"use client";

// app/components/kitchen/CabinetFace.js
//
/**
 * CabinetFace — procedural painted cabinet face.
 *
 * Drop-in replacement for the old outline-only <CabinetFace>. Keeps the EXACT
 * same face geometry (door grid, drawer bands, sink basin, drawersAtBottom)
 * but PAINTS each door/drawer in the client's chosen colour with a Shaker
 * frame + soft bevel, instead of drawing gold outlines.
 *
 * Props:
 *   x, y, w, h  — pixel rect of the face (same as before)
 *   el          — the element ({ height, config }) — same as before
 *   color       — paint hex (e.g. "#EDE8DD"). Falls back to el.config.paintColor
 *                 then a warm white. This is the ONLY new prop.
 *
 * The Shaker stile width is derived from real inches (~2.25") via the face's
 * px-per-inch, so the frame stays a constant, believable thickness across every
 * cabinet in a drawing — exactly what a stretched photo gets wrong.
 */

const DEFAULT_PAINT = "#EDE8DD";

function norm(hex) {
  let h = (hex || DEFAULT_PAINT).replace("#", "").trim();
  if (h.length === 3)
    h = h
      .split("")
      .map((c) => c + c)
      .join("");
  if (h.length < 6) h = "ede8dd";
  return h;
}
function shade(hex, amt) {
  const n = parseInt(norm(hex), 16);
  let r = (n >> 16) & 255,
    g = (n >> 8) & 255,
    b = n & 255;
  const f = amt < 0 ? 0 : 255,
    t = Math.abs(amt);
  r = Math.round((f - r) * t) + r;
  g = Math.round((f - g) * t) + g;
  b = Math.round((f - b) * t) + b;
  return "#" + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
}
function isDark(hex) {
  const n = parseInt(norm(hex), 16);
  const r = (n >> 16) & 255,
    g = (n >> 8) & 255,
    b = n & 255;
  return 0.299 * r + 0.587 * g + 0.114 * b < 140;
}

export default function CabinetFace({ x, y, w, h, el, color }) {
  const paint = color || el?.config?.paintColor || DEFAULT_PAINT;
  const c = el.config || {};
  const gap = 1.5;
  const items = [];
  const innerW = w - gap * 2;
  const left = x + gap;
  const pxPerIn = h / (el.height || 1);
  const drawers = c.drawers || [];
  const doors = c.doors || 0;
  const doorRows = doors > 0 ? c.doorRows || 1 : 0;
  const drawersAtBottom = !!c.drawersAtBottom;
  const drawerInches = (dz) => (dz === "big" ? 11 : dz === "medium" ? 8.5 : 6);
  const weight = (dz) => (dz === "big" ? 1.7 : dz === "medium" ? 1.4 : 1);
  const faceTop = y + gap;
  const faceBot = y + h - gap;

  // dimensionally-honest Shaker stile (~2.25"), clamped so it never vanishes
  // or swallows a tiny face.
  const FRAME = Math.max(2.5, Math.min(2.25 * pxPerIn, w * 0.3, h * 0.3));
  const light = shade(paint, 0.16);
  const dark = shade(paint, -0.16);
  const darker = shade(paint, -0.3);
  const panelFill = shade(paint, -0.05);
  const edgeDark = shade(paint, -0.22);
  const handle = isDark(paint) ? "rgba(255,255,255,.82)" : "rgba(45,32,20,.6)";

  // whole-cabinet paint base — stiles/rails between cells read as paint
  items.push(
    <rect key="base" x={x} y={y} width={w} height={h} fill={paint} rx={2} />,
  );

  // a recessed Shaker panel inside a given cell rect
  const recessed = (cx, cy, cw, ch, key) => {
    if (cw < FRAME * 2 + 2 || ch < FRAME * 2 + 2) {
      // too small for a frame → flat painted slab w/ edge bevel
      return (
        <g key={key}>
          <rect x={cx} y={cy} width={cw} height={ch} fill={paint} rx={1.2} />
          <rect x={cx} y={cy} width={cw} height={1} fill={light} />
          <rect x={cx} y={cy + ch - 1} width={cw} height={1} fill={dark} />
        </g>
      );
    }
    const px = cx + FRAME,
      py = cy + FRAME,
      pw = cw - FRAME * 2,
      ph = ch - FRAME * 2;
    return (
      <g key={key}>
        <rect x={cx} y={cy} width={cw} height={ch} fill={paint} rx={1.5} />
        <rect x={px} y={py} width={pw} height={ph} fill={darker} rx={1.2} />
        <rect
          x={px + 1}
          y={py + 1}
          width={pw - 2}
          height={ph - 2}
          fill={panelFill}
          rx={1}
        />
        {/* inner bevel: dark top/left, light bottom/right */}
        <rect x={px} y={py} width={pw} height={1} fill={edgeDark} />
        <rect x={px} y={py} width={1} height={ph} fill={edgeDark} />
        <rect x={px} y={py + ph - 1} width={pw} height={1} fill={light} />
        <rect x={px + pw - 1} y={py} width={1} height={ph} fill={light} />
        {/* outer frame bevel */}
        <rect x={cx} y={cy} width={cw} height={0.8} fill={light} />
        <rect x={cx} y={cy + ch - 0.8} width={cw} height={0.8} fill={dark} />
      </g>
    );
  };

  const doorHandle = (cx, cy, cw, ch, near) => {
    const hx = near === "left" ? cx + FRAME * 0.5 : cx + cw - FRAME * 0.5;
    const len = Math.min(ch * 0.32, 22);
    return (
      <rect
        key={`h_${cx}_${cy}`}
        x={hx - 1.4}
        y={cy + ch / 2 - len / 2}
        width={2.8}
        height={len}
        rx={1.4}
        fill={handle}
      />
    );
  };

  const drawerFace = (cy, dh, key) => {
    const shaker = dh > 10 && dh > FRAME * 2 + 3; // big drawers get a panel
    return (
      <g key={key}>
        {shaker ? (
          recessed(left, cy, innerW, dh, `${key}_p`)
        ) : (
          <g>
            <rect
              x={left}
              y={cy}
              width={innerW}
              height={dh}
              fill={paint}
              rx={1.2}
            />
            <rect x={left} y={cy} width={innerW} height={1} fill={light} />
            <rect
              x={left}
              y={cy + dh - 1}
              width={innerW}
              height={1}
              fill={dark}
            />
          </g>
        )}
        <rect
          x={x + w / 2 - Math.min(innerW * 0.18, 14)}
          y={cy + dh / 2 - 1.4}
          width={Math.min(innerW * 0.36, 28)}
          height={2.8}
          rx={1.4}
          fill={handle}
        />
      </g>
    );
  };

  const doorGrid = (ay, ah, cols, rows, kp) => {
    if (cols <= 0 || rows <= 0 || ah <= 2) return;
    const cw = (innerW - gap * (cols - 1)) / cols;
    const rh = (ah - gap * (rows - 1)) / rows;
    for (let r = 0; r < rows; r++)
      for (let ci = 0; ci < cols; ci++) {
        const dx = left + ci * (cw + gap);
        const dy = ay + r * (rh + gap);
        items.push(recessed(dx, dy, cw, rh, `${kp}_${r}_${ci}`));
        const near = cols === 1 ? "right" : ci === 0 ? "right" : "left";
        items.push(doorHandle(dx, dy, cw, rh, near));
      }
  };

  // 1) drawer-only face
  if (!c.sink && drawers.length && doors === 0) {
    const avail = faceBot - faceTop - gap * (drawers.length - 1);
    const wsum = drawers.reduce((s, d) => s + weight(d), 0) || 1;
    let cy = faceTop;
    drawers.forEach((dz, i) => {
      const dh = avail * (weight(dz) / wsum);
      items.push(drawerFace(cy, dh, `dr${i}`));
      cy += dh + gap;
    });
    return <g>{items}</g>;
  }

  // 2) sink base
  if (c.sink) {
    const basinH = Math.min(9 * pxPerIn, h * 0.32);
    items.push(
      <g key="sink">
        <rect
          x={left}
          y={faceTop}
          width={innerW}
          height={basinH}
          fill={shade(paint, -0.08)}
          rx={2}
        />
        <ellipse
          cx={x + w / 2}
          cy={faceTop + basinH / 2}
          rx={innerW * 0.3}
          ry={basinH * 0.3}
          fill="none"
          stroke={dark}
          strokeWidth={0.8}
          opacity={0.7}
        />
      </g>,
    );
    const ay = faceTop + basinH + gap;
    doorGrid(ay, faceBot - ay, doors, doorRows, "door");
    return <g>{items}</g>;
  }

  // 3) drawers + doors
  if (drawers.length) {
    const innerGaps = gap * (drawers.length - 1);
    let raw = drawers.map((d) => drawerInches(d) * pxPerIn);
    let sum = raw.reduce((a, b) => a + b, 0);
    const maxStackInner = faceBot - faceTop - gap - 10 * pxPerIn;
    if (sum + innerGaps > maxStackInner && maxStackInner > innerGaps) {
      const sf = (maxStackInner - innerGaps) / sum;
      raw = raw.map((r) => r * sf);
      sum = raw.reduce((a, b) => a + b, 0);
    }
    const stackH = sum + innerGaps;
    const placeStack = (startY) => {
      let cy = startY;
      raw.forEach((dh, i) => {
        items.push(drawerFace(cy, dh, `dr${i}`));
        cy += dh + gap;
      });
    };
    if (drawersAtBottom) {
      const drawerTop = faceBot - stackH;
      doorGrid(faceTop, drawerTop - gap - faceTop, doors, doorRows, "door");
      placeStack(drawerTop);
    } else {
      placeStack(faceTop);
      const ay = faceTop + stackH + gap;
      doorGrid(ay, faceBot - ay, doors, doorRows, "door");
    }
    return <g>{items}</g>;
  }

  // 4) doors only
  doorGrid(faceTop, faceBot - faceTop, doors, doorRows, "door");
  return <g>{items}</g>;
}

