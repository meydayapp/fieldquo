// app/app/settings/layout.js
//
// `lg:flex`, not `flex`. Below lg the sidebar becomes a sticky bar plus a sheet
// (see SettingsSidebar), and that bar has to be a full-width block ABOVE the
// page rather than a 256px column beside it. As a permanent flex row this
// layout left 119px of a 375px phone for the actual settings screen.
//
// The drill-down provider is mounted HERE rather than on any page because this
// layout is the only thing that survives a navigation from one settings page to
// the next — which is what makes "where did you come from" answerable at all.
// See SettingsDrillDown.js.
import SettingsSidebar from "@/app/components/layout/SettingsSidebar";
import {
  SettingsDrillDownProvider,
  SettingsBackBar,
} from "@/app/components/settings/SettingsDrillDown";

export default function SettingsLayout({ children }) {
  return (
    <SettingsDrillDownProvider>
      <div className="lg:flex min-h-screen">
        <SettingsSidebar />
        <main className="flex-1 min-w-0">
          {/* Renders nothing unless this visit was a confirmed drill-down. */}
          <SettingsBackBar />
          {children}
        </main>
      </div>
    </SettingsDrillDownProvider>
  );
}
