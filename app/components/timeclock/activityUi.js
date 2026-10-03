"use client";

// app/components/timeclock/activityUi.js
//
// What an activity looks like and is called, and a duration in words — one
// copy for the clock's Track time view, its Time log, and the manager's
// timesheet, so a tile and a timesheet row can never name the same stretch
// differently.
import { Building2, Clock, Coffee, MapPin, ShoppingCart, Truck, Utensils } from "lucide-react";

const ICONS = { MapPin, Truck, Building2, ShoppingCart, Coffee, Utensils, Clock };
const ICON_BY_KEY = {
  visit: MapPin,
  driving: Truck,
  office: Building2,
  supplies: ShoppingCart,
  break: Coffee,
  lunch: Utensils,
  general: Clock,
};

/** The lucide component for an activity (a policy row or a bare key). */
export function activityIcon(activity) {
  if (activity && typeof activity === "object") return ICONS[activity.icon] || ICON_BY_KEY[activity.key] || Clock;
  return ICON_BY_KEY[activity] || Clock;
}

/**
 * What the company calls an activity: its own name when it gave one
 * ("Supply run"), else the built-in name in the reader's language.
 */
export function activityName(key, activities, t) {
  const row = (activities || []).find((a) => a.key === key);
  return row?.label || t(`app.clock.activity.${key}`);
}

/** "1 h 05 min" / "12 min" — a duration a person reads, not a decimal. */
export function fmtDuration(ms, t) {
  const total = Math.max(0, Math.round((Number(ms) || 0) / 60_000));
  const h = Math.floor(total / 60);
  const m = total % 60;
  return h > 0
    ? t("app.clock.durationHm", { h, m: String(m).padStart(2, "0") })
    : t("app.clock.durationM", { m });
}

