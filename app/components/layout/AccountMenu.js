// app/components/layout/AccountMenu.js
//
// The account rows — who is signed in, Settings, Account & billing, Your
// team, Help, Language, Appearance, Log out — as ONE list drawn in two
// places: the avatar popover in the desktop top bar, and the tail of the
// phone's More sheet. They used to be five rows of the scrolling rail
// (Help · Plan · Settings · Appearance · Log Out); Jobber's cog menu holds
// exactly these, and taking them out of the work list is what the study
// ranked fifth of twelve (docs/research/jobber-ui-study.md §4).
//
// Same filters as the rail for the rows that are rail rows (Help, Plan,
// Settings come from BOTTOM_ITEMS; Your team is the More row) — so a
// Worker who cannot open billing is not offered "Account & billing" here
// either. Language and Appearance are everybody's.
//
// During a support session the identity block shows the ADMIN's email with
// the company named underneath, the way the rail's chip did: the answer to
// "whose account am I in" has to be on screen, not only in a banner that
// scrolls away.
"use client";

import { createElement } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Eye, Languages, LogOut, UserCog } from "lucide-react";
import { useSession, signOut } from "@/lib/auth-client";
import { useImpersonation } from "@/app/hooks/useImpersonation";
import { useTranslation } from "@/app/hooks/useTranslation";
import ThemeToggle from "@/app/components/ThemeToggle";
import { BOTTOM_ITEMS, MORE_GROUPS, initials, useNavItems } from "@/app/components/layout/AdminSidebar";

const TEAM_ROW = MORE_GROUPS.flatMap((g) => g.items).find((i) => i.key === "app.nav.team");
const LANGUAGE_ROW = { key: "app.settings.language", href: "/app/settings/language", icon: Languages };

/** The avatar disc: the person's photo, or their initials on the accent. */
export function Avatar({ user, size = 30 }) {
  if (user?.image) {
    return (
      <img
        src={user.image}
        alt={user.name || "Profile"}
        className="rounded-full object-cover shrink-0"
        style={{ width: size, height: size }}
      />
    );
  }
  return (
    <span
      className="rounded-full bg-sidebar-primary text-sidebar-primary-foreground flex items-center justify-center text-[11px] font-bold shrink-0"
      style={{ width: size, height: size }}
    >
      {initials(user?.name || user?.email)}
    </span>
  );
}

/**
 * @param onNavigate  closes whatever holds the menu
 * @param tone        "card" (the popover) | "sheet" (the phone's More sheet)
 */
export default function AccountMenu({ onNavigate, tone = "card" }) {
  const { t } = useTranslation();
  const router = useRouter();
  const { data: session } = useSession();
  const impersonation = useImpersonation();
  const bottom = useNavItems(BOTTOM_ITEMS);
  const team = useNavItems(TEAM_ROW ? [TEAM_ROW] : []);
  const settings = bottom.find((i) => i.key === "app.nav.settings");
  const plan = bottom.find((i) => i.key === "app.nav.plan");
  const help = bottom.find((i) => i.key === "app.nav.help");

  async function handleLogout() {
    await signOut({
      fetchOptions: {
        onSuccess: () => {
          router.replace("/login");
          router.refresh();
        },
      },
    });
  }

  const rowClass =
    tone === "sheet"
      ? "flex items-center gap-3 px-3 py-3 rounded-lg text-base font-medium text-foreground active:bg-muted"
      : "flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium text-foreground hover:bg-muted";

  const rows = [
    settings,
    plan && { ...plan, key: "app.settings.accountBilling" },
    ...team.map((r) => ({ ...r, icon: UserCog })),
    help,
    LANGUAGE_ROW,
  ].filter(Boolean);

  return (
    <div data-account-menu>
      {/* Identity */}
      {impersonation ? (
        <div className="flex items-center gap-2.5 px-3 py-2 rounded-lg bg-amber-500/15">
          <span className="w-8 h-8 rounded-full bg-amber-500 text-[#2d2520] flex items-center justify-center shrink-0">
            <Eye size={15} />
          </span>
          <span className="min-w-0">
            <span className="block text-sm font-semibold text-foreground truncate">
              {impersonation.adminEmail || t("app.nav.support", "Support")}
            </span>
            <span className="block text-xs text-muted-foreground truncate">
              {t("app.nav.viewingCompany", "viewing {company}", { company: impersonation.companyName })}
            </span>
          </span>
        </div>
      ) : session?.user ? (
        createElement(
          plan ? Link : "div",
          {
            ...(plan ? { href: plan.href, onClick: onNavigate } : {}),
            className: `flex items-center gap-2.5 px-3 py-2 rounded-lg ${plan ? "hover:bg-muted" : ""}`,
          },
          <>
            <Avatar user={session.user} size={32} />
            <span className="min-w-0">
              <span className="block text-sm font-semibold text-foreground truncate">{session.user.name}</span>
              <span className="block text-xs text-muted-foreground truncate">{session.user.email}</span>
            </span>
          </>,
        )
      ) : null}

      <div className="my-1.5 border-t border-border" />

      {rows.map((item) => {
        const Icon = item.icon;
        return (
          <Link key={item.href} href={item.href} onClick={onNavigate} className={rowClass} role="menuitem">
            <Icon size={16} className="shrink-0 text-muted-foreground" />
            <span className="truncate">{t(item.key)}</span>
          </Link>
        );
      })}

      {/* Theme — /app and /platform are the only themeable surfaces. */}
      <div className={`flex items-center justify-between px-3 ${tone === "sheet" ? "py-3" : "py-2"}`}>
        <span className={`${tone === "sheet" ? "text-base" : "text-sm"} font-medium text-foreground`}>
          {t("app.nav.appearance")}
        </span>
        <ThemeToggle compact />
      </div>

      <div className="my-1.5 border-t border-border" />

      <button type="button" onClick={handleLogout} className={`w-full ${rowClass}`} role="menuitem">
        <LogOut size={16} className="shrink-0 text-muted-foreground" />
        {t("app.nav.logOut")}
      </button>
    </div>
  );
}
