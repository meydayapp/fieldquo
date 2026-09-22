// app/app/settings/layout.js
//
// No second sidebar. Until 2026-09-21 this layout rendered SettingsSidebar
// beside the page — a second 256px column with its own search and eight
// folding groups — and the main rail's Work/People/Money/Grow groups
// disappeared while you were in it. Roofr keeps one panel and slides a
// settings list over it (docs/research/roofr-ui-study.md §2.2); that slide
// now lives in AdminSidebar.js, driven by the route, so this layout only has
// to mount what survives a navigation between two settings pages:
//
//   · the drill-down provider — "where did you come from" is answerable only
//     by something that stays mounted across settings pages (SettingsDrillDown.js);
//   · the phone's section strip — the current group's rows across the top of
//     the page below `lg`, where there is no rail to slide (SettingsPhoneNav).
//
// The member's role and the company's trade gate, which this layout used to
// resolve for its sidebar, are resolved once by app/app/layout.js now
// (resolveSettingsShell) and provided to every reader of the settings rows.
import {
  SettingsDrillDownProvider,
  SettingsBackBar,
} from "@/app/components/settings/SettingsDrillDown";
import { SettingsPhoneNav } from "@/app/components/layout/SettingsSidebar";

export default function SettingsLayout({ children }) {
  return (
    <SettingsDrillDownProvider>
      <div className="min-h-screen">
        <SettingsPhoneNav />
        <div className="min-w-0">
          {/* Renders nothing unless this visit was a confirmed drill-down. */}
          <SettingsBackBar />
          {children}
        </div>
      </div>
    </SettingsDrillDownProvider>
  );
}
