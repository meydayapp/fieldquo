// app/platform/sales/windows/page.js
//
// How hard each jurisdiction's calling window and 24-hour cap are applied on
// the rep's screens.
//
// ══ What this screen is ═══════════════════════════════════════════════════
//
// lib/sales/callingRules.js holds the law — a window, a cap, a registration
// duty per state, each with its citation. This screen does not edit any of
// that. It sets, per jurisdiction, whether FieldQuo's own gate REFUSES on the
// window and cap (enforce — the default), lets the call through beside a
// warning (warn), or does not apply them (off). Three words, one row each,
// and every gate reads the row through the same resolver.
//
// ══ The one thing a radio here cannot do ══════════════════════════════════
//
// Relax a registration gate. Where a state requires a telemarketer
// registration FieldQuo has not recorded, the resolver holds the mode at
// enforce whatever the row says, and this screen prints "held" beside the
// radio rather than letting a selected "off" look like it did something. The
// row is still saved — it takes effect the day the certificate is recorded on
// the campaigns screen — because the owner's instruction was to build the
// control and not feed it to the reps until the registration is checked off.
//
// ══ Superadmin writes, everyone reads ═════════════════════════════════════
//
// The write is gated the way the registration write is, and PlatformWriteGate
// says so before a support admin fills in a form the route would refuse.
"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertCircle, Loader2, Lock, Save, ShieldAlert } from "lucide-react";
import { fetchJson } from "@/lib/fetchJson";
import PlatformWriteGate, { usePlatformAdmin } from "@/app/components/platform/PlatformWriteGate";

const MODE_LABEL = {
  enforce: "Enforce",
  warn: "Warn only",
  off: "Off",
};

const MODE_HELP = {
  enforce: "Outside the window or over the cap, the rep gets no Call button and no Send. Today's behaviour.",
  warn: "The call or text is allowed, and the rep's screen shows a warning naming the rule it is outside.",
  off: "The window and the cap are not applied. The rep's screen still says so — nothing is silent.",
};

const REGISTRATION_WORD = {
  not_required: "not required",
  outstanding: "outstanding",
  registered: "registered",
  expired: "lapsed",
  revoked: "withdrawn",
  not_yet_effective: "not yet in effect",
};

function when(iso) {
  if (!iso) return "";
  try {
    return new Date(iso).toLocaleString("en-CA", { dateStyle: "medium", timeStyle: "short" });
  } catch {
    return iso;
  }
}

export default function PlatformSalesWindowsPage() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  // Per-row drafts: { mode, note }. A row with no draft shows what the
  // server said; Save appears only when the draft differs from it.
  const [drafts, setDrafts] = useState({});

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      setData(await fetchJson("/api/platform/sales/windows"));
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const { status: roleStatus, error: roleError, isSuperadmin } = usePlatformAdmin();

  const rows = useMemo(() => data?.jurisdictions || [], [data]);

  function draftFor(row) {
    const d = drafts[row.key];
    return { mode: d?.mode ?? row.requestedMode, note: d?.note ?? (row.note || "") };
  }

  function dirty(row) {
    const d = draftFor(row);
    return d.mode !== row.requestedMode || (d.note || "") !== (row.note || "");
  }

  function setDraft(row, patch) {
    setDrafts((all) => ({ ...all, [row.key]: { ...draftFor(row), ...patch } }));
  }

  async function save(row) {
    const d = draftFor(row);
    if (
      d.mode !== "enforce" &&
      !row.registrationGated &&
      !confirm(
        `Set ${row.name} to "${MODE_LABEL[d.mode]}"?\n\n${MODE_HELP[d.mode]}\n\n` +
          "The law is unchanged; only what the rep's screen refuses changes. This is logged with your name.",
      )
    ) {
      return;
    }
    setBusy(row.key);
    setError("");
    setNotice("");
    try {
      const next = await fetchJson("/api/platform/sales/windows", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ country: row.country, region: row.region || null, mode: d.mode, note: d.note }),
      });
      setData(next);
      setDrafts((all) => {
        const copy = { ...all };
        delete copy[row.key];
        return copy;
      });
      const saved = next.jurisdictions.find((j) => j.key === row.key);
      setNotice(
        saved?.heldByRegistration
          ? `${row.name} saved as "${MODE_LABEL[d.mode]}" — HELD at enforce until its registration is recorded.`
          : `${row.name} is now "${MODE_LABEL[d.mode]}".`,
      );
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy("");
    }
  }

  const relaxed = rows.filter((r) => r.mode !== "enforce").length;
  const held = rows.filter((r) => r.heldByRegistration).length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Calling windows</h1>
        <p className="text-sm text-muted-foreground mt-1 max-w-3xl">
          How hard each state&apos;s calling window and 24-hour cap are applied on the rep&apos;s
          screens. The law itself lives in lib/sales/callingRules.js and is not edited here; a row
          here decides whether FieldQuo&apos;s own gate refuses on it, warns beside a working button,
          or leaves it unapplied. Every dial, every batch claim and every text reads the same answer.
        </p>
      </div>

      <div className="bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900 rounded-xl p-4 text-sm text-amber-900 dark:text-amber-200 flex items-start gap-2">
        <ShieldAlert size={16} className="shrink-0 mt-0.5" />
        <p>
          <strong>A registration gate is never relaxed by this screen.</strong> Where a state requires a
          telemarketer registration that has not been recorded on the Discovery campaigns screen, the
          resolver holds the window at <em>enforce</em> whatever is chosen below, and the row shows{" "}
          <em>held</em>. The choice is kept and takes effect the day the certificate is recorded.
          Prohibitions (Arizona&apos;s ban on mobiles) and unread states are not windows and are not
          touched either.
        </p>
      </div>

      {error && (
        <div className="bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 rounded-xl p-4 flex items-start gap-2 text-sm text-red-700 dark:text-red-300">
          <AlertCircle size={16} className="shrink-0 mt-0.5" /> {error}
        </div>
      )}
      {notice && (
        <div className="bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900 rounded-xl p-4 text-sm text-emerald-800 dark:text-emerald-300">
          {notice}
        </div>
      )}

      <PlatformWriteGate
        status={roleStatus}
        allowed={isSuperadmin}
        error={roleError}
        action="Changing how hard a calling window is applied"
        who="superadmin"
      >
        {null}
      </PlatformWriteGate>

      {loading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 size={16} className="animate-spin" /> Loading…
        </div>
      ) : (
        <>
          <p className="text-sm text-muted-foreground">
            {rows.length} jurisdictions · {relaxed} relaxed
            {held ? ` · ${held} held by an outstanding registration` : ""}
          </p>
          <div className="bg-card border border-border rounded-xl overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted text-left text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-3 py-2">Jurisdiction</th>
                  <th className="px-3 py-2">Window</th>
                  <th className="px-3 py-2">Cap / 24 h</th>
                  <th className="px-3 py-2">Registration</th>
                  <th className="px-3 py-2">Mode</th>
                  <th className="px-3 py-2">Note</th>
                  <th className="px-3 py-2">Set by</th>
                  <th className="px-3 py-2" />
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {rows.map((row) => {
                  const d = draftFor(row);
                  const isDirty = dirty(row);
                  const canEdit = isSuperadmin && !row.prohibition && row.verified;
                  return (
                    <tr key={row.key} className="align-top">
                      <td className="px-3 py-2 whitespace-nowrap">
                        <div className="font-medium text-foreground">{row.name}</div>
                        <div className="text-xs text-muted-foreground font-mono">{row.key}</div>
                      </td>
                      <td className="px-3 py-2 min-w-[14rem]">
                        {row.prohibition ? (
                          <span className="text-red-700 dark:text-red-300">Flat prohibition — not a window</span>
                        ) : !row.verified ? (
                          <span className="text-muted-foreground">Unread — refuses as unknown</span>
                        ) : row.window ? (
                          <span>{row.window}</span>
                        ) : (
                          <span className="text-muted-foreground">None in law — FieldQuo&apos;s courtesy 08:00–20:00</span>
                        )}
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap">{row.cap ?? "—"}</td>
                      <td className="px-3 py-2 whitespace-nowrap">
                        {row.registrationRequired ? (
                          <span className={row.registrationGated ? "text-amber-800 dark:text-amber-300 font-medium" : ""}>
                            {row.registrationGated ? <Lock size={12} className="inline mr-1" /> : null}
                            {REGISTRATION_WORD[row.registrationState] || row.registrationState}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">not required</span>
                        )}
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap">
                        {row.prohibition || !row.verified ? (
                          <span className="text-muted-foreground text-xs">n/a</span>
                        ) : (
                          <div className="flex flex-col gap-1">
                            {data.modes.map((mode) => (
                              <label key={mode} className={`inline-flex items-center gap-1.5 ${canEdit ? "" : "opacity-70"}`}>
                                <input
                                  type="radio"
                                  name={`mode-${row.key}`}
                                  value={mode}
                                  checked={d.mode === mode}
                                  disabled={!canEdit || busy === row.key}
                                  onChange={() => setDraft(row, { mode })}
                                  title={MODE_HELP[mode]}
                                />
                                <span>{MODE_LABEL[mode]}</span>
                              </label>
                            ))}
                            {row.heldByRegistration ? (
                              <span className="text-xs text-amber-800 dark:text-amber-300 font-medium" data-held>
                                Held at enforce — registration outstanding
                              </span>
                            ) : row.mode !== "enforce" ? (
                              <span className="text-xs text-amber-800 dark:text-amber-300" data-relaxed>
                                In force: {MODE_LABEL[row.mode]}
                              </span>
                            ) : null}
                          </div>
                        )}
                      </td>
                      <td className="px-3 py-2 min-w-[14rem]">
                        {row.prohibition || !row.verified ? null : canEdit ? (
                          <textarea
                            value={d.note}
                            onChange={(e) => setDraft(row, { note: e.target.value })}
                            disabled={busy === row.key}
                            rows={2}
                            maxLength={500}
                            placeholder={d.mode === "enforce" ? "Optional" : "Why — shown to the rep"}
                            className="w-full text-sm rounded-md border border-border bg-background px-2 py-1"
                          />
                        ) : (
                          <span className="text-muted-foreground">{row.note || "—"}</span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-xs text-muted-foreground whitespace-nowrap">
                        {row.setBy ? (
                          <>
                            {row.setBy}
                            <br />
                            {when(row.updatedAt)}
                          </>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap">
                        {canEdit && isDirty ? (
                          <button
                            onClick={() => save(row)}
                            disabled={busy === row.key}
                            className="inline-flex items-center gap-1.5 bg-inverted text-inverted-foreground text-xs font-semibold px-3 py-1.5 rounded-lg disabled:opacity-60"
                          >
                            {busy === row.key ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />}
                            Save
                          </button>
                        ) : null}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
