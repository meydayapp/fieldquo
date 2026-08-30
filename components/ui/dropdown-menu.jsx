"use client";

// components/ui/dropdown-menu.jsx
//
// FieldQuo has no Radix — built on @base-ui/react/menu instead. Base UI has
// no `asChild`/Slot mechanism; it uses a `render` prop that takes the
// replacement element directly. `asChild` is kept as this wrapper's prop
// name (not Base UI's) so the ported navbar (File / Export menus, copied
// close to verbatim from the source clone) reads the same way shadcn's
// Radix-based DropdownMenu would.
import { Menu } from "@base-ui/react/menu";

import { cn } from "@/lib/utils";

function DropdownMenu({ modal = true, ...props }) {
  return <Menu.Root data-slot="dropdown-menu" modal={modal} {...props} />;
}

function DropdownMenuTrigger({ asChild, children, ...props }) {
  if (asChild) {
    return <Menu.Trigger data-slot="dropdown-menu-trigger" render={children} {...props} />;
  }
  return (
    <Menu.Trigger data-slot="dropdown-menu-trigger" {...props}>
      {children}
    </Menu.Trigger>
  );
}

function DropdownMenuContent({ className, align = "start", sideOffset = 6, children, ...props }) {
  return (
    <Menu.Portal>
      <Menu.Positioner
        align={align}
        sideOffset={sideOffset}
        className="z-50 outline-none"
      >
        <Menu.Popup
          data-slot="dropdown-menu-content"
          className={cn(
            "min-w-[8rem] overflow-hidden rounded-xl border border-border bg-card p-1 text-card-foreground shadow-md",
            "origin-[var(--transform-origin)] transition-[transform,opacity] data-[ending-style]:scale-95 data-[ending-style]:opacity-0 data-[starting-style]:scale-95 data-[starting-style]:opacity-0",
            className,
          )}
          {...props}
        >
          {children}
        </Menu.Popup>
      </Menu.Positioner>
    </Menu.Portal>
  );
}

function DropdownMenuItem({ className, ...props }) {
  return (
    <Menu.Item
      data-slot="dropdown-menu-item"
      className={cn(
        "relative flex cursor-pointer select-none items-center rounded-lg px-2 py-1.5 text-sm outline-none data-[highlighted]:bg-muted data-[highlighted]:text-foreground data-[disabled]:pointer-events-none data-[disabled]:opacity-50",
        className,
      )}
      {...props}
    />
  );
}

export { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem };
