// app/components/designer/SidebarItem.js
// Ported near verbatim from `components/sidebar-item.tsx`.
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

/**
 * @param {Object} props
 * @param {import("lucide-react").LucideIcon} props.icon
 * @param {string} props.label
 * @param {boolean} [props.isActive]
 * @param {() => void} props.onClick
 */
export function SidebarItem({ icon: Icon, label, isActive, onClick }) {
  return (
    <Button
      variant="ghost"
      onClick={onClick}
      className={cn(
        "flex h-full w-full aspect-video flex-col rounded-none p-3 py-4",
        isActive && "bg-muted text-primary",
      )}
    >
      <Icon className="size-5 shrink-0 stroke-2" />
      <span className="mt-2 text-xs">{label}</span>
    </Button>
  );
}
