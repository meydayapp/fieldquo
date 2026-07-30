// app/app/settings/layout.js
//
// `lg:flex`, not `flex`. Below lg the sidebar becomes a sticky bar plus a sheet
// (see SettingsSidebar), and that bar has to be a full-width block ABOVE the
// page rather than a 256px column beside it. As a permanent flex row this
// layout left 119px of a 375px phone for the actual settings screen.
import SettingsSidebar from "@/app/components/layout/SettingsSidebar";

export default function SettingsLayout({ children }) {
  return (
    <div className="lg:flex min-h-screen">
      <SettingsSidebar />
      <main className="flex-1 min-w-0">{children}</main>
    </div>
  );
}
