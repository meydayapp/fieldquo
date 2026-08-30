"use client";

// lib/designer/filters.js
//
// createFilter(), split out of lib/designer/utils.js for one reason: this is
// the only function in the ported editor that touches `fabric.Image.filters`,
// and importing "fabric" (the "-browser" build pinned in AGENTS.md) runs
// window/document-touching code at import time. Isolating that import to a
// single small, clearly-marked file means the rest of lib/designer/ stays
// importable from plain Node — which is exactly what
// scripts/check-designer.mjs needs to execute transformText() and the other
// utils.js functions for real instead of only reading their source text.
//
// "use client" here is belt-and-braces: every caller already lives under the
// app/components/designer/ client tree, but marking the fabric import site
// itself is what scripts/check-designer.mjs verifies mechanically — grep for
// `from "fabric"` outside a file that opens with this pragma is exactly the
// mistake that would crash Next's SSR pass.
import { fabric } from "fabric";

export const createFilter = (value) => {
  let effect;

  switch (value) {
    case "greyscale":
      effect = new fabric.Image.filters.Grayscale();
      break;
    case "polaroid":
      effect = new fabric.Image.filters.Polaroid();
      break;
    case "sepia":
      effect = new fabric.Image.filters.Sepia();
      break;
    case "kodachrome":
      effect = new fabric.Image.filters.Kodachrome();
      break;
    case "contrast":
      effect = new fabric.Image.filters.Contrast({ contrast: 0.3 });
      break;
    case "brightness":
      effect = new fabric.Image.filters.Brightness({ brightness: 0.8 });
      break;
    case "brownie":
      effect = new fabric.Image.filters.Brownie();
      break;
    case "vintage":
      effect = new fabric.Image.filters.Vintage();
      break;
    case "technicolor":
      effect = new fabric.Image.filters.Technicolor();
      break;
    case "pixelate":
      effect = new fabric.Image.filters.Pixelate();
      break;
    case "invert":
      effect = new fabric.Image.filters.Invert();
      break;
    case "blur":
      effect = new fabric.Image.filters.Blur();
      break;
    case "sharpen":
      effect = new fabric.Image.filters.Convolute({
        matrix: [0, -1, 0, -1, 5, -1, 0, -1, 0],
      });
      break;
    case "emboss":
      effect = new fabric.Image.filters.Convolute({
        matrix: [1, 1, 1, 1, 0.7, -1, -1, -1, -1],
      });
      break;
    case "removecolor":
      effect = new fabric.Image.filters.RemoveColor({
        threshold: 0.2,
        distance: 0.5,
      });
      break;
    case "blacknwhite":
      effect = new fabric.Image.filters.BlackWhite();
      break;
    case "vibrance":
      effect = new fabric.Image.filters.Vibrance({
        vibrance: 1,
      });
      break;
    case "blendcolor":
      effect = new fabric.Image.filters.BlendColor({
        color: "#00ff00",
        mode: "multiply",
      });
      break;
    case "huerotate":
      effect = new fabric.Image.filters.HueRotation({
        rotation: 0.5,
      });
      break;
    case "resize":
      effect = new fabric.Image.filters.Resize();
      break;
    // BUG FIX: the source clone's "gamma" case had no `break;`, so it fell
    // through into "saturation" and constructed *that* filter instead —
    // choosing Gamma from the sidebar silently applied Saturation. The
    // `gamma` options below are now dead code without the break, which is
    // exactly the bug: the constructor call executed, its result was
    // discarded, and execution continued into the next case.
    case "gamma":
      effect = new fabric.Image.filters.Gamma({
        gamma: [1, 0.5, 2.1],
      });
      break;
    case "saturation":
      effect = new fabric.Image.filters.Saturation({
        saturation: 0.7,
      });
      break;
    default:
      effect = null;
      return effect;
  }

  return effect;
};
