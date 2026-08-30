"use client";

// app/components/designer/ColorPicker.js
//
// Ported near verbatim from `components/color-picker.tsx`.
//
// react-color is UNMAINTAINED (last publish 2020, no React 19 testing, kept
// alive only by the ecosystem still depending on it) — flagged per AGENTS.md
// item 6's instruction, not silently carried forward. It's used here anyway
// because rebuilding a colour-wheel + hex/rgb input picker from scratch is a
// much larger surface to get right (and to keep accessible) than the
// dependency risk of one small, stable, widely-used package with no
// maintenance-sensitive surface (it doesn't touch network, auth, or user
// data — it's a `<input>` + canvas colour picker). Revisit if it breaks on a
// future React major.
import { ChromePicker, CirclePicker } from "react-color";

import { colors } from "@/lib/designer/constants";
import { rgbaObjectToString } from "@/lib/designer/utils";

/**
 * @param {Object} props
 * @param {string} props.value
 * @param {(value: string) => void} props.onChange
 */
export function ColorPicker({ value, onChange }) {
  return (
    <div className="w-full space-y-4">
      <ChromePicker
        color={value}
        onChange={(color) => {
          const formattedValue = rgbaObjectToString(color.rgb);
          onChange(formattedValue);
        }}
        className="rounded-lg border"
      />
      <CirclePicker
        color={value}
        colors={colors}
        onChangeComplete={(color) => {
          const formattedValue = rgbaObjectToString(color.rgb);
          onChange(formattedValue);
        }}
      />
    </div>
  );
}
