// app/app/activity/layout.js
//
// /app/activity is a SETTINGS screen that does not live under /app/settings.
//
// SettingsSidebar has listed it since it was written —
// `{ key: "app.settings.activity", href: "/app/activity" }` — so it is reached
// from the settings menu, sits in the settings information architecture, and
// is the only row in that menu that used to throw the sidebar away on arrival.
// You clicked Activity and the navigation you were using vanished, with no
// back bar and no way to reach the next setting without the browser's Back
// button.
//
// ── Why the layout is re-used rather than re-created ───────────────────────
//
// The obvious fix is to paste the settings layout here: a flex row, the
// sidebar, the drill-down provider, the access provider. That copy is the one
// that rots (AGENTS.md failure class #4) — it would miss the next provider
// added to the real one, and the divergence would show up as "the sidebar
// works everywhere except Activity", which is where this started.
//
// So it IS the settings layout, mounted at a second route. The access and
// trade-gate lookups it does are the same two queries this page would need
// anyway.
//
// ── Why not move the route under /app/settings ─────────────────────────────
//
// /app/activity is a URL people have bookmarked and that other screens link to
// ("see who changed this"). Moving it to rename a directory would break those
// for a layout fix.
import SettingsLayout from "@/app/app/settings/layout";

export default function ActivityLayout({ children }) {
  return <SettingsLayout>{children}</SettingsLayout>;
}
