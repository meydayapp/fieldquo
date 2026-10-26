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

import { useId } from "react";

import { doorStyle } from "@/lib/kitchen/finishes";

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

export default function CabinetFace({
  x,
  y,
  w,
  h,
  el,
  color,
  style: styleKey,
}) {
  // SVG gradient ids have to be unique across the whole document, and a
  // drawing holds one of these per cabinet. useId gives a stable one per
  // instance that survives hydration; a module counter would not.
  const gid = useId().replace(/:/g, "");
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

  // ── The chosen door style ───────────────────────────────────────────────
  //
  // This used to be hardcoded Shaker. Once a client can pick a flat slab, a
  // hardcoded frame here means the editor draws Shaker doors while the quote
  // drawing and the PDF draw slabs — two pictures of the same kitchen, and the
  // one the client signs is not the one they were looking at while choosing.
  const style = doorStyle(styleKey ?? el?.config?.doorStyle);

  // Dimensionally honest: the stile width is real inches converted through this
  // face's own px-per-inch, so a 2.25" frame looks the same thickness on an 18"
  // door and a 36" one — as it does in the room. Clamped so it can neither
  // vanish at small zoom nor swallow a tiny drawer front.
  const FRAME =
    style.frame > 0
      ? Math.max(2.5, Math.min(style.frame * pxPerIn, w * 0.3, h * 0.3))
      : 0;
  const light = shade(paint, 0.16);
  const dark = shade(paint, -0.16);
  const darker = shade(paint, -0.3);
  // Raised panels stand proud and catch light, so their fill is LIGHTER than
  // the frame; recessed ones sit back and read darker. Same field, opposite
  // sign — which is why panelDepth is signed in finishes.js rather than being
  // an "isRecessed" boolean that only ever darkens.
  const panelFill = shade(paint, -(style.panelDepth ?? 0.05));
  const raisedPanel = (style.panelDepth ?? 0) < 0;
  const edgeDark = shade(paint, -0.22);
  const handle = isDark(paint) ? "rgba(255,255,255,.82)" : "rgba(45,32,20,.6)";

  // Flat fills read as paper. Real doors are one surface under one light, so
  // every face here is a gradient off the SAME paint rather than a different
  // colour — the form comes from the light, not from repainting the panel.
  items.push(
    <defs key="defs">
      <linearGradient id={`${gid}-face`} x1="0" y1="0" x2="0.35" y2="1">
        <stop offset="0%" stopColor={shade(paint, 0.11)} />
        <stop offset="52%" stopColor={paint} />
        <stop offset="100%" stopColor={shade(paint, -0.09)} />
      </linearGradient>
      <linearGradient id={`${gid}-panel`} x1="0" y1="0" x2="0.3" y2="1">
        <stop
          offset="0%"
          stopColor={shade(panelFill, raisedPanel ? 0.09 : -0.06)}
        />
        <stop
          offset="100%"
          stopColor={shade(panelFill, raisedPanel ? -0.07 : 0.06)}
        />
      </linearGradient>
    </defs>,
  );

  // whole-cabinet paint base — stiles/rails between cells read as paint
  items.push(
    <rect
      key="base"
      x={x}
      y={y}
      width={w}
      height={h}
      fill={`url(#${gid}-face)`}
      rx={2}
    />,
  );

  // Beadboard's vertical beads, at a REAL spacing, so a wide panel gets more
  // beads rather than the same few stretched — the thing a tiled bitmap gets
  // wrong and a drafted elevation gets right. Each bead carries its own shaded
  // and lit side, which is what makes it read as a groove and not a pinstripe.
  const beads = (bx, by, bw, bh, key) => {
    const step = Math.max(3, 2.25 * pxPerIn);
    const out = [];
    let i = 0;
    for (let gx = bx + step; gx < bx + bw - 0.6; gx += step, i += 1) {
      out.push(
        <rect
          key={`${key}_bd${i}`}
          x={gx - 0.45}
          y={by}
          width={0.9}
          height={bh}
          fill={edgeDark}
          opacity={0.75}
        />,
      );
      out.push(
        <rect
          key={`${key}_bl${i}`}
          x={gx + 0.45}
          y={by}
          width={0.8}
          height={bh}
          fill={light}
          opacity={0.55}
        />,
      );
    }
    return <g key={`${key}_beads`}>{out}</g>;
  };

  // A framed panel inside a cell, drawn to the STYLE'S OWN profile.
  //
  // `profile` was declared on all four styles in finishes.js and read by
  // nothing: bevel and bead drew the identical square reveal as Shaker, so a
  // picker offering four doors produced two shapes. Written and never read —
  // the picker kept a choice the drawing threw away.
  //
  // Light is top-left throughout. A RECESSED panel puts its top and left bevel
  // faces in shadow; a RAISED one tilts those same faces toward the light, so
  // the geometry reads proud instead of sunk. That sign is the only difference
  // between them, which is why panelDepth is signed rather than a boolean.
  const recessed = (cx, cy, cw, ch, key) => {
    // A slab door HAS no panel. Falling through to the frame branch below would
    // draw one anyway and make every style look like Shaker.
    if (FRAME <= 0 || cw < FRAME * 2 + 2 || ch < FRAME * 2 + 2) {
      // too small for a frame → flat painted slab w/ edge bevel
      return (
        <g key={key}>
          <rect
            x={cx}
            y={cy}
            width={cw}
            height={ch}
            fill={`url(#${gid}-face)`}
            rx={1.2}
          />
          <rect x={cx} y={cy} width={cw} height={0.9} fill={light} />
          <rect
            x={cx}
            y={cy}
            width={0.9}
            height={ch}
            fill={light}
            opacity={0.7}
          />
          <rect x={cx} y={cy + ch - 0.9} width={cw} height={0.9} fill={dark} />
          <rect
            x={cx + cw - 0.9}
            y={cy}
            width={0.9}
            height={ch}
            fill={dark}
            opacity={0.7}
          />
        </g>
      );
    }
    const px = cx + FRAME,
      py = cy + FRAME,
      pw = cw - FRAME * 2,
      ph = ch - FRAME * 2;

    // The bevel ring's width, in real inches like FRAME. A raised panel's
    // chamfer is the wide one you can read across a room; Shaker's and
    // beadboard's is a crisp step.
    const B = Math.max(
      1,
      Math.min(
        (style.profile === "bevel" ? 0.6 : 0.16) * pxPerIn,
        pw / 2 - 1,
        ph / 2 - 1,
      ),
    );
    const ix = px + B,
      iy = py + B,
      iw = pw - B * 2,
      ih = ph - B * 2;
    // top/left bevel faces, then bottom/right
    const tl = raisedPanel ? light : edgeDark;
    const br = raisedPanel ? edgeDark : light;

    return (
      <g key={key}>
        <rect
          x={cx}
          y={cy}
          width={cw}
          height={ch}
          fill={`url(#${gid}-face)`}
          rx={1.5}
        />
        {/* the opening: a hairline of true shadow, so the panel does not look
            painted onto the frame */}
        <rect x={px} y={py} width={pw} height={ph} fill={darker} rx={1} />
        {/* the bevel ring, mitred — four faces meeting on the diagonal, not
            four 1px lines crossing at the corners */}
        <polygon
          points={`${px},${py} ${px + pw},${py} ${ix + iw},${iy} ${ix},${iy}`}
          fill={tl}
        />
        <polygon
          points={`${px},${py} ${ix},${iy} ${ix},${iy + ih} ${px},${py + ph}`}
          fill={tl}
          opacity={0.82}
        />
        <polygon
          points={`${px},${py + ph} ${ix},${iy + ih} ${ix + iw},${iy + ih} ${px + pw},${py + ph}`}
          fill={br}
        />
        <polygon
          points={`${px + pw},${py} ${ix + iw},${iy} ${ix + iw},${iy + ih} ${px + pw},${py + ph}`}
          fill={br}
          opacity={0.82}
        />
        {/* the panel field */}
        <rect
          x={ix}
          y={iy}
          width={iw}
          height={ih}
          fill={`url(#${gid}-panel)`}
        />
        {style.profile === "bead" ? beads(ix, iy, iw, ih, key) : null}
        {/* the door's own outer bevel, so it reads proud of the carcass */}
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
