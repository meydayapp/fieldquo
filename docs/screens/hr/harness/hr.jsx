// docs/screens/hr/harness/hr.jsx
//
// The four HR screens, rendered from the REAL components inside the real
// providers, against fixture.js instead of a server. ?scene= picks one:
//
//   checklist   — /app/me/onboarding: Léo's checklist, three items overdue
//   documents   — /app/me/documents: his four documents, one expired
//   policy      — /app/me/policies with "Vehicle use" open and the
//                 acknowledgement form showing (the scene opens it)
//   compliance  — /app/settings/team/compliance as Julie, the manager
//
// ?lang=en|fr|es picks the interface language through the app's own
// LanguageProvider. Same approach as docs/screens/app-guide/harness.
import React from "react";
import { createRoot } from "react-dom/client";
import CompanyPreferencesProvider from "@/app/providers/CompanyPreferencesProvider";
import { LanguageProvider } from "@/app/providers/LanguageProvider";
import { FeatureProvider } from "@/app/providers/FeatureProvider";
import { PermissionProvider } from "@/app/providers/PermissionProvider";
import { SettingsAccessProvider } from "@/app/providers/SettingsAccessProvider";
import { ThemeProvider } from "@/app/providers/ThemeProvider";
import { PERMISSION_PRESETS } from "@/lib/permissions";
import MeOnboardingPage from "@/app/app/me/onboarding/page";
import MeDocumentsPage from "@/app/app/me/documents/page";
import MePoliciesPage from "@/app/app/me/policies/page";
import CompliancePage from "@/app/app/settings/team/compliance/page";
import { installFetch } from "./fixture.js";

const params = new URLSearchParams(window.location.search);
const scene = params.get("scene") || "checklist";
const lang = params.get("lang") || "en";
const HREFS = { checklist: "/app/me/onboarding", documents: "/app/me/documents", policy: "/app/me/policies", compliance: "/app/settings/team/compliance" };
window.__harness = { href: HREFS[scene] || "/app/me", slug: scene, lang, params: {}, user: { userId: "u_leo", name: "Léo Bouchard", email: "leo@erabledesign.ca" } };
try { window.localStorage.clear(); } catch {}
document.documentElement.lang = lang;
{
  const RealDate = Date;
  const FIXED = RealDate.parse("2026-09-14T13:00:00-04:00");
  class FixedDate extends RealDate {
    constructor(...a) { if (a.length) super(...a); else super(FIXED); }
    static now() { return FIXED; }
  }
  window.Date = FixedDate;
}
installFetch();

const crew = { role: "employee", permissions: { ...PERMISSION_PRESETS.worker.values } };
const manager = { role: "supervisor", permissions: { ...PERMISSION_PRESETS.manager.values } };
const member = scene === "compliance" ? manager : crew;
const PAGES = { checklist: MeOnboardingPage, documents: MeDocumentsPage, policy: MePoliciesPage, compliance: CompliancePage };
const Page = PAGES[scene];
if (!Page) throw new Error(`unknown scene "${scene}"`);

createRoot(document.getElementById("root")).render(
  <ThemeProvider>
    <LanguageProvider initialLanguage={lang} fromAccount>
      <CompanyPreferencesProvider initialCurrency="CAD">
        <FeatureProvider flags={{}}>
          <PermissionProvider role={member.role} permissions={member.permissions}>
            <SettingsAccessProvider access={{ role: member.role, impersonation: false }}>
              <div className="min-h-screen bg-background text-foreground">
                <Page />
              </div>
            </SettingsAccessProvider>
          </PermissionProvider>
        </FeatureProvider>
      </CompanyPreferencesProvider>
    </LanguageProvider>
  </ThemeProvider>,
);

// ── Scene driver ──────────────────────────────────────────────────────────
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const until = async (sel, tries = 60) => {
  for (let i = 0; i < tries; i++) {
    const el = document.querySelector(sel);
    if (el) return el;
    await wait(100);
  }
  throw new Error(`scene: never found ${sel}`);
};
(async () => {
  try {
    if (scene === "checklist") await until("[data-hr-items] [data-hr-item]");
    if (scene === "documents") await until("[data-hr-document]");
    if (scene === "compliance") await until("[data-hr-compliance-row], [data-hr-compliance-card]");
    if (scene === "policy") {
      await until("[data-hr-policy]");
      const rows = document.querySelectorAll("[data-hr-policy] > button");
      rows[1].click();
      const input = await until("[data-hr-ack-form] input");
      const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value").set;
      setter.call(input, "Léo Bouchard");
      input.dispatchEvent(new Event("input", { bubbles: true }));
    }
    await wait(300);
    document.documentElement.setAttribute("data-harness-done", "1");
  } catch (err) {
    document.documentElement.setAttribute("data-scene-error", String(err?.message || err));
    document.documentElement.setAttribute("data-harness-done", "1");
  }
})();
