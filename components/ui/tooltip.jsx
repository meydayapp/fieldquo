"use client";

// components/ui/tooltip.jsx
//
// Built on @base-ui/react/tooltip. Only consumer today is components/Hint.jsx
// (the designer toolbar's icon-button labels), kept generic rather than
// folded into Hint directly in case something outside the designer needs a
// tooltip later.
import { Tooltip as TooltipPrimitive } from "@base-ui/react/tooltip";

import { cn } from "@/lib/utils";

function Tooltip(props) {
  return <TooltipPrimitive.Root {...props} />;
}

function TooltipTrigger({ asChild, children, ...props }) {
  if (asChild) {
    return <TooltipPrimitive.Trigger render={children} {...props} />;
  }
  return <TooltipPrimitive.Trigger {...props}>{children}</TooltipPrimitive.Trigger>;
}

function TooltipContent({ className, side = "top", align = "center", sideOffset = 4, children, ...props }) {
  return (
    <TooltipPrimitive.Portal>
      <TooltipPrimitive.Positioner side={side} align={align} sideOffset={sideOffset}>
        <TooltipPrimitive.Popup
          className={cn(
            "z-50 rounded-md bg-foreground px-2 py-1 text-xs text-background shadow-sm",
            "origin-[var(--transform-origin)] transition-[transform,opacity] data-[ending-style]:scale-95 data-[ending-style]:opacity-0 data-[starting-style]:scale-95 data-[starting-style]:opacity-0",
            className,
          )}
          {...props}
        >
          {children}
        </TooltipPrimitive.Popup>
      </TooltipPrimitive.Positioner>
    </TooltipPrimitive.Portal>
  );
}

export { Tooltip, TooltipTrigger, TooltipContent };
