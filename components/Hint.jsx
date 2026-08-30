"use client";

// components/Hint.jsx
//
// Ported from the source clone's `components/hint.tsx` (there built on
// Radix). Same name and API — `label`/`side`/`align`/`sideOffset` wrapping a
// single child — so every toolbar/sidebar button in app/components/designer/
// that reads `<Hint label="..." side="bottom" sideOffset={5}><Button/></Hint>`
// needed no changes beyond the import path.
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

export function Hint({ label, children, side, align, sideOffset = 0 }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild delay={150}>
        {children}
      </TooltipTrigger>
      <TooltipContent side={side} align={align} sideOffset={sideOffset}>
        <p className="font-medium">{label}</p>
      </TooltipContent>
    </Tooltip>
  );
}
