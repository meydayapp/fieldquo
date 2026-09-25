"use client";

// app/components/commissions/useCommissionSettings.js
//
// Whether the company pays commission on its own jobs, and what this reader
// may do about it — GET /api/commissions/settings. Every commission control
// (the job card, the team rates, the price-book fields, the pay-run block)
// asks this first and draws nothing while it is off: a commission field on a
// company that pays none is a control that appears to work and doesn't.
//
// `null` until it answers, and stays null if the read fails — every caller
// treats null as "draw nothing", never as "off" made up from a failure.

import { useEffect, useState } from "react";

export function useCommissionSettings(refreshKey = 0) {
  const [settings, setSettings] = useState(null);
  useEffect(() => {
    let live = true;
    fetch("/api/commissions/settings")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => live && setSettings(d))
      .catch(() => live && setSettings(null));
    return () => {
      live = false;
    };
  }, [refreshKey]);
  return settings;
}
