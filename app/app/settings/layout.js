// app/app/settings/layout.js
import SettingsSidebar from "@/app/components/layout/SettingsSidebar";

export default function SettingsLayout({ children }) {
  return (
    <div className="flex min-h-screen">
      <SettingsSidebar />
      <main className="flex-1 min-w-0">{children}</main>
    </div>
  );
}
