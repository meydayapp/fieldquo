// app/components/designer/ShapeTool.js
// Ported near verbatim from `components/shape-tool.tsx`, minus the
// react-icons `IconType` union — lucide-react only now.
import { cn } from "@/lib/utils";

/**
 * @param {Object} props
 * @param {() => void} props.onClick
 * @param {import("lucide-react").LucideIcon} props.icon
 * @param {string} [props.iconClassName]
 */
export function ShapeTool({ onClick, icon: Icon, iconClassName }) {
  return (
    <button onClick={onClick} className="aspect-square rounded-md border p-5">
      <Icon className={cn("h-full w-full", iconClassName)} />
    </button>
  );
}
