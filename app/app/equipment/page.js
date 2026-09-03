"use client";

// app/app/equipment/page.js
//
// The call list: whose warranty is about to run out, across every client.
//
// ══ Why this screen is the feature ═════════════════════════════════════════
//
// A serial number in a database earns nothing. Twelve households whose
// furnaces come out of cover in April, with a phone number beside each one, is
// a morning's work and a month's revenue. Everything under lib/equipment/
// exists to make this list correct.
//
// ══ What is deliberately missing from it ═══════════════════════════════════
//
// Equipment with no warranty date on file. A blank is UNKNOWN, not expired
// (lib/expiry/window.js), and a list padded with two hundred rows nobody can
// act on buries the twelve that are real. Their count is printed at the top
// instead, because "180 with no warranty date" is a data-entry problem worth
// naming and is not a call list.
//
// ══ Mobile ════════════════════════════════════════════════════════════════
//
// One column, no table, tap-to-call and tap-to-email on each row — this is
// read in a van between jobs. `npm run check:mobile` walks only /platform,
// /sales and /app/clock today, so this screen is NOT covered by it; it is
// built to the same rules and the gap is stated rather than implied.

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ShieldCheck, Phone, Mail } from "lucide-react";
import { useTranslation } from "@/app/hooks/useTranslation";
import { fetchList } from "@/lib/loadState";
import ListState from "@/app/components/ListState";
import ExpiryBadge from "@/app/components/ExpiryBadge";

/** The windows offered. 0 is "already lapsed only" and says so. */
const WINDOWS = [30, 60, 90, 180, 365];

function formatDate(value, locale) {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString(locale || undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export default function EquipmentExpiringPage() {
  const { t, language } = useTranslation();
  const [withinDays, setWithinDays] = useState(60);
  // null until the server answers — never [], which would claim zero.
  const [rows, setRows] = useState(null);
  const [tally, setTally] = useState(null);
  const [errorKey, setErrorKey] = useState("");
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const result = await fetchList(`/api/equipment/expiring?withinDays=${withinDays}`);
    if (result.aborted) return;
    if (!result.ok) {
      setErrorKey(result.errorKey);
      // Both left as they were: a refused read must not be redrawn as "nothing
      // is expiring", which is the one wrong answer this screen can give.
      setLoading(false);
      return;
    }
    setErrorKey("");
    setRows(Array.isArray(result.data?.equipment) ? result.data.equipment : []);
    setTally(result.data?.tally || null);
    setLoading(false);
  }, [withinDays]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="p-4 sm:p-6 max-w-3xl mx-auto space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
          <ShieldCheck size={22} />
          {t("app.equipmentList.title", "Warranties running out")}
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          {t(
            "app.equipmentList.intro",
            "Equipment you've installed whose cover has ended or is about to. This is a call list.",
          )}
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        {WINDOWS.map((days) => (
          <button
            key={days}
            type="button"
            onClick={() => setWithinDays(days)}
            aria-pressed={withinDays === days}
            className={`px-3 py-2 rounded-full text-xs font-semibold border min-h-[36px] ${
              withinDays === days
                ? "border-inverted bg-muted text-foreground"
                : "border-border text-muted-foreground"
            }`}
          >
            {t("app.equipmentList.window", "Next {days} days", { days })}
          </button>
        ))}
      </div>

      {/* The honest third number. Printed only when the server answered — a
          count is a claim, and this screen makes none it cannot back. */}
      {tally && (
        <p className="text-sm text-muted-foreground">
          {t(
            "app.equipmentList.tally",
            "{expired} out of warranty · {dueSoon} ending soon · {unknown} with no warranty date recorded",
            {
              expired: tally.expired,
              dueSoon: tally.dueSoon,
              unknown: tally.unknown,
            },
          )}
        </p>
      )}

      <ListState
        loading={loading}
        errorKey={errorKey}
        isEmpty={!!rows && rows.length === 0}
        onRetry={load}
        empty={
          <div className="bg-card border border-border rounded-xl p-8 text-center">
            <p className="text-sm font-semibold text-foreground">
              {t("app.equipmentList.emptyTitle", "Nothing coming up in this window")}
            </p>
            <p className="text-sm text-muted-foreground mt-1">
              {t(
                "app.equipmentList.emptyBody",
                "Equipment with no warranty date isn't listed here — a blank date means nobody recorded one, not that cover has ended.",
              )}
            </p>
          </div>
        }
      >
        <div className="space-y-3">
          {(rows || []).map((row) => {
            const state = row.warranty?.state || "unknown";
            const ends = formatDate(row.warranty?.endsAt, language);
            return (
              <div key={row.id} className="bg-card border border-border rounded-xl p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <Link
                      href={`/app/clients/${row.clientId}`}
                      className="block font-semibold text-sm text-foreground truncate hover:underline"
                    >
                      {row.client?.name || t("app.equipmentList.unnamedClient", "Client")}
                    </Link>
                    <p className="text-xs text-muted-foreground truncate">
                      {[row.name, row.manufacturer, row.modelNumber]
                        .filter(Boolean)
                        .join(" · ")}
                    </p>
                    {row.siteAddress && (
                      <p className="text-xs text-muted-foreground truncate">
                        {row.siteAddress}
                      </p>
                    )}
                  </div>
                  <ExpiryBadge
                    state={state}
                    label={
                      state === "expired"
                        ? t("app.equipment.badgeExpired", "Out of warranty")
                        : t("app.equipment.badgeSoon", "Warranty ending")
                    }
                  />
                </div>

                <p className="text-xs text-muted-foreground mt-2">
                  {state === "expired"
                    ? t("app.equipment.warrantyEnded", "Cover ended {date}", { date: ends })
                    : t("app.equipment.warrantyUntil", "Covered until {date}", { date: ends })}
                </p>

                {/* Tap to ring, tap to write. Rendered only when the contact
                    detail is actually there — a dead tel: link is a control
                    that appears to work and doesn't. */}
                <div className="flex flex-wrap gap-2 mt-3">
                  {row.client?.phone && (
                    <a
                      href={`tel:${row.client.phone}`}
                      className="inline-flex items-center gap-1.5 text-xs font-semibold border border-border rounded-full px-3 py-2 min-h-[36px]"
                    >
                      <Phone size={13} /> {row.client.phone}
                    </a>
                  )}
                  {row.client?.email && (
                    <a
                      href={`mailto:${row.client.email}`}
                      className="inline-flex items-center gap-1.5 text-xs font-semibold border border-border rounded-full px-3 py-2 min-h-[36px]"
                    >
                      <Mail size={13} /> {t("app.equipmentList.email", "Email")}
                    </a>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </ListState>
    </div>
  );
}
