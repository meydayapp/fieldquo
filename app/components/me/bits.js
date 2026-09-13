"use client";

// app/components/me/bits.js
//
// The small pieces every employee-home screen is built from: a card, a big
// tappable row, a kind chip, a person avatar, and a loader that holds the
// three states (loading / failed / loaded) apart — the same discipline
// /app/clock keeps, for the same reason: a payload that never arrived must
// not render as "no shifts".
//
// Everything here is phone-first: 44px targets, 16px+ type on controls (iOS
// zooms anything smaller on focus), one column. The same components render
// on the web inside the sidebar layout, so the two never drift.
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ChevronRight, Loader2 } from "lucide-react";
import { fetchList } from "@/lib/loadState";
import ListState from "@/app/components/ListState";
import { formatTimeOfDay, formatWeekdayDayMonth } from "@/lib/format/localeDate";

/** Load one JSON payload with the three states held apart. */
export function useMeData(url, { every = 0 } = {}) {
  const [data, setData] = useState(null);
  const [errorKey, setErrorKey] = useState("");
  const [loading, setLoading] = useState(true);
  const load = useCallback(async () => {
    const result = await fetchList(url);
    if (result.aborted) return;
    if (!result.ok) {
      setData(null);
      setErrorKey(result.errorKey);
      return;
    }
    setErrorKey("");
    setData(result.data);
  }, [url]);
  useEffect(() => {
    setLoading(true);
    load().finally(() => setLoading(false));
  }, [load]);
  useEffect(() => {
    if (!every) return undefined;
    const id = setInterval(() => {
      if (document.visibilityState === "visible") load();
    }, every);
    return () => clearInterval(id);
  }, [every, load]);
  return { data, errorKey, loading, reload: load };
}

/** The loading / failed frame around a screen. Children render only once loaded. */
export function MeLoad({ loading, errorKey, reload, children }) {
  if (loading) {
    return (
      <div className="min-h-[40vh] grid place-items-center">
        <Loader2 className="animate-spin text-muted-foreground" />
      </div>
    );
  }
  if (errorKey) {
    return (
      <ListState loading={false} isEmpty={false} errorKey={errorKey} onRetry={reload}>
        {null}
      </ListState>
    );
  }
  return children;
}

export function Card({ children, className = "", tone = "card" }) {
  const tones = {
    card: "border-border bg-card",
    accent: "border-foreground/15 bg-foreground text-background",
    soft: "border-border bg-muted/40",
  };
  return <section className={`rounded-2xl border p-4 sm:p-5 ${tones[tone] || tones.card} ${className}`}>{children}</section>;
}

export function CardTitle({ children, action = null }) {
  return (
    <div className="mb-3 flex items-center justify-between gap-2">
      <h2 className="text-sm font-bold uppercase tracking-[0.12em] text-muted-foreground">{children}</h2>
      {action}
    </div>
  );
}

/** A big row: icon, title, subtitle, chevron. `href` makes it a link; `onClick` a button. */
export function BigRow({ icon: Icon, title, subtitle, href, onClick, right = null, badge = null, danger = false }) {
  const inner = (
    <>
      {Icon ? (
        <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl ${danger ? "bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-300" : "bg-muted text-foreground"}`}>
          <Icon size={18} />
        </span>
      ) : null}
      <span className="min-w-0 flex-1 text-left">
        <span className={`block truncate text-base font-semibold ${danger ? "text-red-700 dark:text-red-300" : "text-foreground"}`}>{title}</span>
        {subtitle ? <span className="block truncate text-sm text-muted-foreground">{subtitle}</span> : null}
      </span>
      {badge != null && badge !== 0 ? (
        <span className="rounded-full bg-foreground px-2 py-0.5 text-xs font-bold tabular-nums text-background">{badge}</span>
      ) : null}
      {right}
      {(href || onClick) && !right ? <ChevronRight size={18} className="shrink-0 text-muted-foreground" /> : null}
    </>
  );
  const cls = "flex min-h-[56px] w-full items-center gap-3 px-4 py-3 active:bg-muted/60 transition-colors";
  if (href) {
    return (
      <Link href={href} className={cls}>
        {inner}
      </Link>
    );
  }
  if (onClick) {
    return (
      <button type="button" onClick={onClick} className={cls}>
        {inner}
      </button>
    );
  }
  return <div className={cls}>{inner}</div>;
}

export function RowList({ children }) {
  return <div className="divide-y divide-border rounded-2xl border border-border bg-card overflow-hidden">{children}</div>;
}

/** A primary / secondary action button sized for a thumb. */
export function Action({ children, onClick, href, variant = "primary", disabled = false, icon: Icon = null, type = "button", className = "" }) {
  const variants = {
    primary: "bg-foreground text-background hover:opacity-90",
    secondary: "border border-border bg-background text-foreground hover:bg-muted",
    good: "bg-emerald-600 text-white hover:bg-emerald-700",
    danger: "border border-red-300 text-red-700 hover:bg-red-50 dark:border-red-900 dark:text-red-300 dark:hover:bg-red-950/40",
  };
  const cls = `inline-flex min-h-[44px] items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-base font-semibold transition-colors disabled:opacity-60 ${variants[variant] || variants.primary} ${className}`;
  if (href) {
    return (
      <Link href={href} className={cls}>
        {Icon ? <Icon size={18} /> : null}
        {children}
      </Link>
    );
  }
  return (
    <button type={type} onClick={onClick} disabled={disabled} className={cls}>
      {Icon ? <Icon size={18} /> : null}
      {children}
    </button>
  );
}

/** The kind chip on a timeline item: Shift / Visit / Appointment / Task / Open / Event. */
export function KindChip({ kind, t }) {
  const tones = {
    shift: "bg-blue-50 text-blue-800 dark:bg-blue-950/40 dark:text-blue-200",
    open: "bg-amber-50 text-amber-900 dark:bg-amber-950/40 dark:text-amber-200",
    visit: "bg-purple-50 text-purple-800 dark:bg-purple-950/40 dark:text-purple-200",
    appointment: "bg-emerald-50 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200",
    task: "bg-muted text-foreground",
    event: "bg-muted text-muted-foreground",
  };
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide ${tones[kind] || tones.task}`}>
      {t(`app.me.kind.${kind}`)}
    </span>
  );
}

/** Initials or the person's photo. */
export function PersonAvatar({ name, image, size = "md", className = "" }) {
  const sizes = { sm: "h-8 w-8 text-[11px]", md: "h-10 w-10 text-xs", lg: "h-14 w-14 text-base" };
  const initials =
    String(name || "")
      .trim()
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((w) => w[0].toUpperCase())
      .join("") || "?";
  if (image) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={image} alt={name || ""} className={`${sizes[size] || sizes.md} shrink-0 rounded-full object-cover ${className}`} />;
  }
  return (
    <span aria-hidden="true" className={`grid shrink-0 place-items-center rounded-full bg-muted font-semibold text-foreground ${sizes[size] || sizes.md} ${className}`}>
      {initials}
    </span>
  );
}

/** "Tomorrow, 9 AM – 4 PM" style pieces, in the reader's language. */
export function whenWords(start, end, language, t, now = new Date()) {
  const s = new Date(start);
  const dayOf = (d) => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
  const today = dayOf(now);
  const tomorrow = dayOf(new Date(now.getTime() + 86_400_000));
  const yesterday = dayOf(new Date(now.getTime() - 86_400_000));
  const key = dayOf(s);
  const day =
    key === today ? t("app.me.when.today") : key === tomorrow ? t("app.me.when.tomorrow") : key === yesterday ? t("app.me.when.yesterday") : formatWeekdayDayMonth(s, language);
  const time = end ? `${formatTimeOfDay(s, language)} – ${formatTimeOfDay(end, language)}` : formatTimeOfDay(s, language);
  return { day, time };
}

export function hoursWords(hours, t) {
  const h = Number(hours) || 0;
  return t("app.me.hoursShort", { hours: h.toFixed(2) });
}

export function EmptyNote({ children }) {
  return <p className="rounded-2xl border border-dashed border-border px-4 py-6 text-center text-sm text-muted-foreground">{children}</p>;
}
