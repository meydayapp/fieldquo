// components/ui/textarea.jsx
//
// A plain styled <textarea>, matching input.jsx's reasoning: nothing here
// needs a primitive beyond the native element. Restored alongside
// AiSidebar.js — the source clone's prompt box is a <Textarea>, and this was
// the one designer sidebar that needed one.
import { cn } from "@/lib/utils";

function Textarea({ className, ...props }) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        "flex min-h-16 w-full resize-none rounded-lg border border-border bg-background px-3 py-2 text-sm shadow-xs outline-none transition-[color,box-shadow] placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/30 disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
      {...props}
    />
  );
}

export { Textarea };
