// components/ui/label.jsx
//
// A plain styled <label>. See input.jsx for why this wraps the native
// element rather than a primitive: nothing here needs @base-ui/react's
// Field-context-aware label behaviour outside of a Field/Form composition.
import { cn } from "@/lib/utils";

function Label({ className, ...props }) {
  return (
    <label
      data-slot="label"
      className={cn(
        "flex select-none items-center gap-2 text-sm leading-none font-medium peer-disabled:cursor-not-allowed peer-disabled:opacity-50",
        className,
      )}
      {...props}
    />
  );
}

export { Label };
