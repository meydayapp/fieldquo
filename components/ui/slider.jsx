"use client";

// components/ui/slider.jsx
//
// FieldQuo has no Radix (AGENTS.md: "@base-ui/react only") and no existing
// Slider — the designer port is the first thing in the repo that needs one,
// for stroke width, opacity and brush width. Built on @base-ui/react/slider,
// which splits into Root > Control > Track > Indicator > Thumb rather than
// Radix's flatter Root > Track > Range > Thumb; the DOM this renders differs
// from shadcn's Radix-based Slider, but the props (`value`, `onValueChange`,
// `min`, `max`, `step`, arrays for both) are kept compatible so every ported
// sidebar (stroke-width, opacity, draw) works unmodified.
import { Slider as SliderPrimitive } from "@base-ui/react/slider";

import { cn } from "@/lib/utils";

function Slider({ className, ...props }) {
  return (
    <SliderPrimitive.Root
      data-slot="slider"
      className={cn(
        "relative flex w-full touch-none select-none items-center",
        className,
      )}
      {...props}
    >
      <SliderPrimitive.Control className="relative flex w-full items-center py-2">
        <SliderPrimitive.Track className="relative h-1.5 w-full grow overflow-hidden rounded-full bg-muted">
          <SliderPrimitive.Indicator className="absolute h-full bg-primary" />
        </SliderPrimitive.Track>
        <SliderPrimitive.Thumb className="block size-4 shrink-0 rounded-full border-2 border-primary bg-background shadow transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40 disabled:pointer-events-none disabled:opacity-50" />
      </SliderPrimitive.Control>
    </SliderPrimitive.Root>
  );
}

export { Slider };
