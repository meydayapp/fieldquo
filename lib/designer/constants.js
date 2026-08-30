// lib/designer/constants.js
//
// Ported from the nextjs-canva-clone `features/editor/types.ts`. That file
// mixed constants with TypeScript types — this repo has zero TypeScript
// files (see AGENTS.md), so the types survive only as JSDoc typedefs below.
// The `Editor` typedef in particular is documentation, not decoration: it is
// the de-facto contract every toolbar and sidebar in app/components/designer/
// consumes, and there is no compiler left to catch a caller drifting from it.
//
// Pure data — no fabric, no DOM. Safe to import from anywhere, including
// plain Node (scripts/check-designer.mjs does exactly that).
// Default import, not `import * as material` (the source clone's form):
// material-colors is a plain CommonJS `module.exports = {...}` with no
// named-export markers, and Node's native ESM/CJS interop only reliably
// exposes that as the default export — `import *` leaves `material.red`
// undefined under plain Node (scripts/check-designer.mjs imports this file
// directly). Webpack's interop resolves a default import to the same
// object, so this works identically in the real Next build.
import material from "material-colors";

/** Keys kept when a canvas is serialised (canvas.toJSON(JSON_KEYS)). Fabric's
 * default toJSON() drops these, and the editor depends on all of them:
 * `name` to find the workspace rect, `linkData`/`extensionType`/`extension`
 * for fabric's own plugin bookkeeping, the rest for editing continuity. */
export const JSON_KEYS = [
  "name",
  "gradientAngle",
  "selectable",
  "hasControls",
  "linkData",
  "editable",
  "extensionType",
  "extension",
];

export const filters = [
  "none",
  "polaroid",
  "sepia",
  "kodachrome",
  "contrast",
  "brightness",
  "greyscale",
  "brownie",
  "vintage",
  "technicolor",
  "pixelate",
  "invert",
  "blur",
  "sharpen",
  "emboss",
  "removecolor",
  "blacknwhite",
  "vibrance",
  "blendcolor",
  "huerotate",
  "resize",
  "saturation",
  "gamma",
];

export const fonts = [
  "Arial",
  "Arial Black",
  "Verdana",
  "Helvetica",
  "Tahoma",
  "Trebuchet MS",
  "Times New Roman",
  "Georgia",
  "Garamond",
  "Courier New",
  "Brush Script MT",
  "Palatino",
  "Bookman",
  "Comic Sans MS",
  "Impact",
  "Lucida Sans Unicode",
  "Geneva",
  "Lucida Console",
];

/** Tools whose sidebar only makes sense with something selected. Deselecting
 * while one of these is open (see useCanvasEvents' clearSelectionCallback)
 * snaps the toolbar back to "select" instead of showing an empty panel. */
export const selectionDependentTools = [
  "fill",
  "font",
  "filter",
  "opacity",
  "remove-bg",
  "stroke-color",
  "stroke-width",
];

export const colors = [
  material.red["500"],
  material.pink["500"],
  material.purple["500"],
  material.deepPurple["500"],
  material.indigo["500"],
  material.blue["500"],
  material.lightBlue["500"],
  material.cyan["500"],
  material.teal["500"],
  material.green["500"],
  material.lightGreen["500"],
  material.lime["500"],
  material.yellow["500"],
  material.amber["500"],
  material.orange["500"],
  material.deepOrange["500"],
  material.brown["500"],
  material.blueGrey["500"],
  "transparent",
];

/**
 * @typedef {"select"|"shapes"|"text"|"images"|"draw"|"fill"|"stroke-color"
 *   |"stroke-width"|"font"|"opacity"|"filter"|"settings"|"templates"|"ai"
 *   |"remove-bg"} ActiveTool
 *
 * Which single sidebar panel is open. "select" means none — the default,
 * inert state.
 *
 * "templates" and "ai"/"remove-bg" were dropped in the first pass of this
 * port and restored per the owner's 2026-08-30 correction: every editor
 * feature in the source clone exists here, and only AI image generation
 * (which "ai" and "remove-bg" both spend, on the same `image_generation`
 * kind — see lib/designer/aiImageAdapter.js) is premium. "templates" is
 * free — see the DesignTemplate Prisma model and TemplateSidebar.js.
 */

export const FILL_COLOR = "rgba(0,0,0,1)";
export const STROKE_COLOR = "rgba(0,0,0,1)";
export const STROKE_WIDTH = 2;
export const STROKE_DASH_ARRAY = [];
export const FONT_FAMILY = "Arial";
export const FONT_SIZE = 32;
export const FONT_WEIGHT = 400;

export const CIRCLE_OPTIONS = {
  radius: 225,
  left: 100,
  top: 100,
  fill: FILL_COLOR,
  stroke: STROKE_COLOR,
  strokeWidth: STROKE_WIDTH,
};

export const RECTANGLE_OPTIONS = {
  left: 100,
  top: 100,
  fill: FILL_COLOR,
  stroke: STROKE_COLOR,
  strokeWidth: STROKE_WIDTH,
  width: 400,
  height: 400,
  angle: 0,
};

export const DIAMOND_OPTIONS = {
  left: 100,
  top: 100,
  fill: FILL_COLOR,
  stroke: STROKE_COLOR,
  strokeWidth: STROKE_WIDTH,
  width: 600,
  height: 600,
  angle: 0,
};

export const TRIANGLE_OPTIONS = {
  left: 100,
  top: 100,
  fill: FILL_COLOR,
  stroke: STROKE_COLOR,
  strokeWidth: STROKE_WIDTH,
  width: 400,
  height: 400,
  angle: 0,
};

export const TEXT_OPTIONS = {
  type: "textbox",
  left: 100,
  top: 100,
  fill: FILL_COLOR,
  fontSize: FONT_SIZE,
  fontFamily: FONT_FAMILY,
};

/**
 * @typedef {Object} EditorHookProps
 * @property {string} [defaultState] - initial `canvas.toJSON()` string, e.g. Project.json
 * @property {number} [defaultWidth]
 * @property {number} [defaultHeight]
 * @property {() => void} [clearSelectionCallback]
 * @property {(values: {json: string, height: number, width: number}) => (void|Promise<void>)} [saveCallback] -
 *   the injection point a caller wires to its own persistence. May be sync or
 *   return a Promise; Editor.js awaits it either way to drive the save
 *   status shown in the navbar. This module does not call an API itself —
 *   see AGENTS.md's "DO NOT build ... the save API route".
 */

/**
 * @typedef {Object} Editor
 * The full surface every toolbar/sidebar in app/components/designer/ is
 * handed. Built by `buildEditor()` in hooks/useEditor.js once a fabric
 * canvas exists; `undefined` before that, which is why every caller reads
 * it as `editor?.method()`.
 *
 * @property {() => void} savePng
 * @property {() => void} saveJpg
 * @property {() => void} saveSvg - real vector export via canvas.toSVG();
 *   see the fix note in hooks/useEditor.js — the source clone's saveSvg
 *   downloaded a PNG with a .svg extension.
 * @property {() => void} saveJson
 * @property {(json: string) => void} loadJson
 * @property {() => void} onUndo
 * @property {() => void} onRedo
 * @property {() => boolean} canUndo
 * @property {() => boolean} canRedo
 * @property {() => void} autoZoom
 * @property {() => void} zoomIn
 * @property {() => void} zoomOut
 * @property {() => import("fabric").fabric.Object | undefined} getWorkspace -
 *   the canvas object named "clip": both the page bounds and the export
 *   clip path. lib/marketing/ratios.js treats this same tag as load-bearing.
 * @property {(value: string) => void} changeBackground
 * @property {(value: {width: number, height: number}) => void} changeSize
 * @property {(ratioKey: string) => void} changeRatio - reflows the document
 *   into an AD_RATIOS preset via lib/marketing/ratios.js#reflow(); the one
 *   capability the source clone never had, wired per AGENTS.md item 8.
 * @property {() => {key: string, overflowing: string[]} | null} getRatioWarning -
 *   non-blocking overflow check for the ratio currently applied, via
 *   ratios.js#overflowing().
 * @property {() => void} enableDrawingMode
 * @property {() => void} disableDrawingMode
 * @property {() => void} onCopy
 * @property {() => void} onPaste
 * @property {(value: string) => void} changeImageFilter
 * @property {(value: string) => void} addImage
 * @property {() => void} delete
 * @property {(value: number) => void} changeFontSize
 * @property {() => number} getActiveFontSize
 * @property {(value: string) => void} changeTextAlign
 * @property {() => string} getActiveTextAlign
 * @property {(value: boolean) => void} changeFontUnderline
 * @property {() => boolean} getActiveFontUnderline
 * @property {(value: boolean) => void} changeFontLinethrough
 * @property {() => boolean} getActiveFontLinethrough
 * @property {(value: string) => void} changeFontStyle
 * @property {() => string} getActiveFontStyle
 * @property {(value: number) => void} changeFontWeight
 * @property {() => number} getActiveFontWeight
 * @property {() => string} getActiveFontFamily
 * @property {(value: string) => void} changeFontFamily
 * @property {(value: string, options?: object) => void} addText
 * @property {() => number} getActiveOpacity
 * @property {(value: number) => void} changeOpacity
 * @property {() => void} bringForward
 * @property {() => void} sendBackwards
 * @property {(value: number) => void} changeStrokeWidth
 * @property {(value: string) => void} changeFillColor
 * @property {(value: string) => void} changeStrokeColor
 * @property {(value: number[]) => void} changeStrokeDashArray
 * @property {() => void} addCircle
 * @property {() => void} addSoftRectangle
 * @property {() => void} addRectangle
 * @property {() => void} addTriangle
 * @property {() => void} addInverseTriangle
 * @property {() => void} addDiamond
 * @property {import("fabric").fabric.Canvas} canvas
 * @property {() => string} getActiveFillColor
 * @property {() => string} getActiveStrokeColor
 * @property {() => number} getActiveStrokeWidth
 * @property {() => number[]} getActiveStrokeDashArray
 * @property {import("fabric").fabric.Object[]} selectedObjects
 */
