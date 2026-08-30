// app/components/designer/SidebarItem.js
//
// Ported from `components/sidebar-item.tsx`, then rebuilt per the owner's
// complaint that the tool rail wasted vertical space and wasn't mobile
// friendly. Two changes from the source clone:
//
//   - `aspect-video` is gone. On a 100px-wide rail that forced every button
//     into a 56px-tall 16:9 box before padding was even added — the exact
//     "too much vertical space between each button" the owner named. A
//     plain fixed height (h-14 on the mobile bottom bar, h-16 on the desktop
//     rail) replaces it; icon-above-label stays, since the owner only
//     objected to the box shape, not the layout.
//   - The label is `sr-only` below the `md` breakpoint. Sidebar.js turns the
//     rail into a bottom tab bar on phones (see its own module doc), and
//     seven labelled columns don't fit a 375px screen without truncating
//     into illegible text — icon-only with an `aria-label` for the name is
//     the honest choice there, matching what most mobile creative-tool bottom
//     bars actually do. Desktop keeps the label, since the 72px-wide rail has
//     room for it.
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
      type="button"
      variant="ghost"
      onClick={onClick}
      aria-label={label}
      aria-pressed={!!isActive}
      className={cn(
        "flex h-14 flex-1 flex-col items-center justify-center gap-1 rounded-none px-1 py-1.5 md:h-16 md:w-full md:flex-none md:px-2",
        isActive && "bg-muted text-primary",
      )}
    >
      <Icon className="size-5 shrink-0 stroke-2" />
      <span className="sr-only w-full truncate text-center text-[11px] leading-none font-medium md:not-sr-only">
        {label}
      </span>
    </Button>
  );
}
