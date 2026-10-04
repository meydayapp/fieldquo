// app/components/layout/CrewShell.js
"use client";

// The crew's top of every /app screen from `lg` up, in place of the rail and
// the desktop top bar: a slim header (whose company, who is signed in, the
// bell, Sign out), then ONE big clock button, then their few places as big
// plain buttons. lib/nav/crewShell.js decides who and which; this file draws
// it. Below `lg` it renders nothing — the phone keeps its bottom bar
// (MobileTabBar.js), which carries the same rows.
//
// ── Built for the person who does not want a menu ───────────────────────────
//
// The owner: "some workers are old and need to have simple UI". So: words
// over icons (every button has its word, at 18px), targets at least 64px
// tall, nothing that opens on hover, nothing folded. Colours are FieldQuo's
// own tokens and three fixed fills for the clock — never the company's brand
// colour, which themes what a CLIENT reads (app/app/layout.js). Every text
// pair here was measured (scripts/check-rbac-nav.mjs re-measures them with
// lib/brand/colour.js contrastRatio): white on the clock's green 5.48:1, red
// 6.47:1, brown 7.09:1, on navy 12.1:1 (10.7:1 dark); the buttons' ink on
// card 17.5:1 (14.5:1 dark).
//
// ── The clock button opens the clock ─────────────────────────────────────────
//
// It says "Clock in" or "Clock out" from what GET /api/time-clock answers,
// and it opens /app/clock, where the punch happens — the activity, the job,
// the location stamp and the offline queue all live there, and a second copy
// of that here would be the copy that rots. My day's clock card works the
// same way (CrewMyDay.js). While the answer is unknown it says "Time clock",
// never a guess. Switched off for this person (lib/timeclock/access.js): not
// drawn at all.
import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Briefcase, CalendarDays, Clock, LayoutGrid, LogOut, MapPin, MessagesSquare } from "lucide-react";
import { useSession, signOut } from "@/lib/auth-client";
import { useTranslation } from "@/app/hooks/useTranslation";
import { usePermissions } from "@/app/providers/PermissionProvider";
import { useFeatureFlags } from "@/app/providers/FeatureProvider";
import { clockOffered } from "@/lib/timeclock/access";
import { formatTimeOfDay } from "@/lib/format/localeDate";
import {
  CREW_CLOCK_HREF,
  crewButtonActive,
  crewButtonsFor,
  crewClockState,
  usesCrewShell,
} from "@/lib/nav/crewShell";
import Logo from "@/app/components/Logo";
import NotificationBell from "@/app/components/layout/NotificationBell";
import { useChatUnread } from "@/app/hooks/useChatUnread";
import NavUnreadBadge from "@/app/components/chat/NavUnreadBadge";

const ICONS = {
  today: MapPin,
  schedule: CalendarDays,
  chat: MessagesSquare,
  jobs: Briefcase,
  more: LayoutGrid,
};

// The clock's fills. Fixed, not tokens: white text on each holds in both
// themes (measured — see the header), and a green "go" / red "stop" reads
// before the word does.
const CLOCK_FILL = {
  in: "bg-[#047857] text-white",
  out: "bg-[#b91c1c] text-white",
  break: "bg-[#92400e] text-white",
  open: "bg-inverted text-inverted-foreground",
};

/** GET /api/time-clock, refetched on every navigation so the button follows a punch made on /app/clock. */
function useClockAnswer(enabled, pathname) {
  const [answer, setAnswer] = useState(null);
  useEffect(() => {
    if (!enabled) return undefined;
    let cancelled = false;
    fetch("/api/time-clock")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!cancelled) setAnswer(d);
      })
      // Offline or refused: the neutral "Time clock", which is still true.
      .catch(() => {
        if (!cancelled) setAnswer(null);
      });
    return () => {
      cancelled = true;
    };
  }, [enabled, pathname]);
  return answer;
}

/**
 * @param {object} p
 * @param {string|null} p.companyName  the company's own name (app/app/layout.js)
 * @param {string|null} p.logoUrl      Company.logoUrl, when they uploaded one
 */
export default function CrewShell({ companyName = null, logoUrl = null }) {
  const { t, language } = useTranslation();
  const router = useRouter();
  const pathname = usePathname();
  const caller = usePermissions();
  const flags = useFeatureFlags();
  const { data: session } = useSession();
  const crew = usesCrewShell(caller, flags);
  const clockOn = crew && clockOffered(caller);
  const answer = useClockAnswer(clockOn, pathname);
  // The big Chat button's digit. crewButtonsFor already applies the
  // team_chat flag, so the poll runs only when the button is drawn.
  const buttons = crew ? crewButtonsFor(caller, flags) : [];
  const chatUnread = useChatUnread(buttons.some((row) => row.href === "/app/chat"));

  if (!crew) return null;

  const state = crewClockState(answer);
  const since = answer?.open?.clockIn ? formatTimeOfDay(new Date(answer.open.clockIn), language) : null;
  const clockWord =
    state === "in"
      ? t("app.me.action.clockIn")
      : state === "out"
        ? t("app.me.action.clockOut")
        : state === "break"
          ? t("app.clock.endBreak")
          : t("app.nav.clock");
  const clockNote =
    state === "in"
      ? t("app.dash.myDay.notClockedIn")
      : state === "out" && since
        ? t("app.dash.myDay.clockedIn", { time: since })
        : state === "break"
          ? t("app.dash.myDay.onBreak")
          : null;

  async function logout() {
    await signOut({
      fetchOptions: {
        onSuccess: () => {
          router.replace("/login");
          router.refresh();
        },
      },
    });
  }

  return (
    <div className="hidden lg:block" data-crew-shell>
      {/* ── The header: whose company, who is here, the bell, Sign out ── */}
      <header className="sticky top-0 z-30 h-16 flex items-center gap-4 px-6 bg-card border-b border-border">
        <Link href="/app" className="flex min-w-0 items-center gap-3">
          {logoUrl ? (
            // A company's own upload on Cloudinary; next/image would need the
            // host allow-listed for a 36px mark. Decorative: the name is next to it.
            <img src={logoUrl} alt="" className="h-9 w-auto max-w-[140px] object-contain" />
          ) : null}
          {companyName ? (
            <span className="truncate text-xl font-bold text-foreground">{companyName}</span>
          ) : (
            <Logo variant="horizontal" href={null} height={26} />
          )}
        </Link>
        <div className="ml-auto flex items-center gap-3">
          {session?.user?.name ? (
            <span className="max-w-[16rem] truncate text-lg font-semibold text-foreground" data-crew-name>
              {session.user.name}
            </span>
          ) : null}
          <NotificationBell tone="bar" />
          <button
            type="button"
            onClick={logout}
            className="inline-flex min-h-12 items-center gap-2 rounded-xl border-2 border-muted-foreground px-4 text-lg font-semibold text-foreground hover:bg-muted"
          >
            <LogOut size={20} className="shrink-0" aria-hidden="true" />
            {t("app.me.more.signOut")}
          </button>
        </div>
      </header>

      <div className="mx-auto max-w-5xl space-y-3 px-6 pt-5">
        {/* ── The clock — the first thing under the header, the biggest thing on it ── */}
        {clockOn ? (
          <Link
            href={CREW_CLOCK_HREF}
            aria-current={pathname === CREW_CLOCK_HREF ? "page" : undefined}
            data-crew-clock={state}
            className={`flex min-h-[80px] w-full items-center gap-4 rounded-2xl px-6 shadow-sm hover:shadow-md ${CLOCK_FILL[state]}`}
          >
            <Clock size={34} className="shrink-0" aria-hidden="true" />
            <span className="min-w-0">
              <span className="block text-2xl font-bold leading-tight">{clockWord}</span>
              {clockNote ? <span className="block text-base font-medium leading-snug">{clockNote}</span> : null}
            </span>
          </Link>
        ) : null}

        {/* ── Their places, as big plain buttons. No menus behind them. ── */}
        <nav aria-label={t("app.nav.mainMenu")} className="flex gap-3" data-crew-buttons>
          {buttons.map((row) => {
            const Icon = ICONS[row.icon] || LayoutGrid;
            const active = crewButtonActive(row, pathname);
            return (
              <Link
                key={row.href}
                href={row.href}
                aria-current={active ? "page" : undefined}
                className={`flex min-h-16 min-w-0 flex-1 items-center justify-center gap-2.5 rounded-xl border-2 px-3 text-lg font-semibold ${
                  active
                    ? "border-transparent bg-inverted text-inverted-foreground"
                    : "border-muted-foreground bg-card text-foreground hover:bg-muted"
                }`}
              >
                <Icon size={24} className="shrink-0" aria-hidden="true" />
                <span className="truncate">{t(row.label || row.key)}</span>
                {row.href === "/app/chat" ? <NavUnreadBadge counts={chatUnread} placement="inline" /> : null}
              </Link>
            );
          })}
        </nav>
      </div>
    </div>
  );
}
