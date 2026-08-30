// app/components/designer/ToolSidebarHeader.js
// Ported near verbatim from `components/tool-sidebar-header.tsx`.

/**
 * @param {Object} props
 * @param {string} props.title
 * @param {string} [props.description]
 */
export function ToolSidebarHeader({ title, description }) {
  return (
    <div className="h-[68px] space-y-1 border-b p-4">
      <p className="text-sm font-medium">{title}</p>
      {description && <p className="text-xs text-muted-foreground">{description}</p>}
    </div>
  );
}
