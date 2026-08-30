// components/ui/input.jsx
//
// A plain styled <input>. @base-ui/react ships an Input primitive but it
// adds no behaviour over the native element for a simple text/number field —
// it exists in that package for composition inside Field/Form, which the
// designer's settings sidebar doesn't use — so this wraps the native tag
// directly, matching how components/ui/card.jsx wraps native divs.
import { cn } from "@/lib/utils";

function Input({ className, type, ...props }) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        "flex h-8 w-full min-w-0 rounded-lg border border-border bg-background px-3 py-1 text-sm shadow-xs outline-none transition-[color,box-shadow] file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/30 disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
      {...props}
    />
  );
}

export { Input };
