// app/platform/team/page.js
//
// FieldQuo's own staff accounts. Separate from tenant Members entirely —
// PlatformAdmin has its own table, its own bcrypt passwords and its own JWT.
// There is no signup page for these, deliberately: they're created here by an
// existing superadmin, or by scripts/seed-platform-admin.mjs for the first one.
"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Loader2,
  Plus,
  ShieldCheck,
  AlertCircle,
  UserX,
  UserCheck,
} from "lucide-react";
import {
  PLATFORM_PERMISSIONS,
  SUPERADMIN_ONLY_PERMISSIONS,
} from "@/lib/platform/permissions";

// ── Role descriptions, derived rather than retyped ─────────────────────────
//
// The old descriptions were three hand-written sentences that had already
// drifted from lib/platform/permissions.js: "admin" was missing
// service_category:manage (a write every tenant reads), and "superadmin" said
// "Everything, including creating other staff accounts" — which named the
// least consequential of its exclusive powers and omitted the four that
// matter. This is the screen where a role is CHOSEN, so an incomplete
// description here is how somebody gets handed more than was intended.
//
// The lists below are built from the matrix itself, so adding a permission
// there changes what this screen says. Only the wording of each permission is
// local, and a permission with no wording still prints — its raw code, marked
// as such — rather than silently vanishing from the description.
const PERMISSION_WORDS = {
  "company:view": "view companies",
  "company:manage": "edit company settings",
  "company:suspend": "suspend companies",
  "plan:view": "view plans",
  "plan:manage": "manage plans, promotions and promo codes",
  "service_category:manage": "edit the global service catalogue every tenant reads",
  "analytics:view": "view analytics and export reports",
  impersonate: "impersonate a company, read-only",
  "sales_attribution:manage": "manage sales attribution",
  "sales_attribution:correct": "correct sales attribution",
  "billing:manage": "extend trials and apply credit",
  "migration:quote": "price a paid data migration",
  "migration:write":
    "create records inside a company's own data — the one sanctioned exception to view-everything-edit-nothing",
  "migration:cancel": "cancel a migration, including one already paid",
};

function describe(permissions) {
  return permissions
    .map((p) => PERMISSION_WORDS[p] || `${p} (no description written yet)`)
    .join(", ");
}

function roleDescription(role) {
  const held = PLATFORM_PERMISSIONS[role] || [];
  if (held.includes("*")) {
    // "*" is not a list, so it cannot be enumerated the same way. What it
    // means is spelled out instead of summarised as "everything", because
    // "everything" is the word that let the tenant-write power go unmentioned.
    return `Everything: ${describe(
      PLATFORM_PERMISSIONS.admin,
    )}, create and deactivate staff accounts, and the superadmin-only powers — ${describe(
      SUPERADMIN_ONLY_PERMISSIONS,
    )}.`;
  }
  const missing = SUPERADMIN_ONLY_PERMISSIONS.length
    ? " Cannot extend trials, price or run a data migration, or add staff."
    : "";
  return `Can ${describe(held)}.${missing}`;
}

const ROLE_STYLES = {
  superadmin:
    "bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-300 border-red-200 dark:border-red-900",
  admin:
    "bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-900",
  support:
    "bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-900",
};

const ROLE_LABELS = {
  superadmin: "Superadmin",
  admin: "Admin",
  support: "Support",
};

const ROLE_META = Object.fromEntries(
  Object.keys(PLATFORM_PERMISSIONS).map((role) => [
    role,
    {
      label: ROLE_LABELS[role] || role,
      description: roleDescription(role),
      className: ROLE_STYLES[role] || "bg-muted text-muted-foreground border-border",
    },
  ]),
);

export default function PlatformTeamPage() {
  // null until the server answers: `[]` is this page asserting FieldQuo has no
  // staff accounts, which on a failed request is both false and alarming.
  const [admins, setAdmins] = useState(null);
  const [me, setMe] = useState(null);
  const [meFailed, setMeFailed] = useState(false);
  const [draft, setDraft] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/platform/admins");
      if (!res.ok) {
        const d = await res.json().catch(() => null);
        throw new Error(d?.error || `Request failed (${res.status}).`);
      }
      setAdmins(await res.json());

      // ── Who you are is a separate question from what went wrong ─────────
      //
      // This used to swallow the failure: `if (meRes?.ok) setMe(...)`, leaving
      // `me` null. Downstream, `isSuperadmin` is false when `me` is null, so a
      // superadmin whose identity call 401'd or timed out lost the "Add staff"
      // button and every Deactivate control — a screen that says, silently and
      // wrongly, "you don't have permission". Never-loaded is not restricted.
      const meRes = await fetch("/api/platform/me").catch(() => null);
      if (meRes?.ok) {
        setMe(await meRes.json());
        setMeFailed(false);
      } else {
        setMe(null);
        setMeFailed(true);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function create() {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const res = await fetch("/api/platform/admins", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(draft),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) throw new Error(data?.error || "Couldn't create account.");

      setDraft(null);
      setNotice(
        `Created ${data.email}. Send them the password over something other than email — it's the only copy.`,
      );
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function setActive(target, active) {
    if (
      !confirm(
        active
          ? `Reactivate ${target.email}?`
          : `Deactivate ${target.email}? They'll be signed out and unable to log in.`,
      )
    )
      return;

    setBusy(true);
    setError("");
    try {
      const res = await fetch(`/api/platform/admins/${target.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ active }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => null);
        throw new Error(d?.error || "Couldn't update.");
      }
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  const isSuperadmin = me?.role === "superadmin";
  const activeSuperadmins = (admins || []).filter(
    (a) => a.role === "superadmin" && a.active,
  ).length;

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Platform team</h1>
          <p className="text-sm text-muted-foreground mt-1">
            FieldQuo staff accounts. These can see across every company.
          </p>
        </div>
        {isSuperadmin && (
          <button
            onClick={() =>
              setDraft({ email: "", password: "", role: "support" })
            }
            className="inline-flex items-center gap-2 bg-inverted text-inverted-foreground text-sm font-semibold px-4 py-2 rounded-lg"
          >
            <Plus size={14} /> Add staff
          </button>
        )}
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

      {/* Said out loud, because the alternative is a screen that quietly looks
          like a demotion. The controls really are absent — we cannot honestly
          draw them without knowing the role — but the reason is stated. */}
      {meFailed && (
        <div
          role="alert"
          className="bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900 rounded-xl p-4 flex items-start gap-2 text-sm text-amber-800 dark:text-amber-300"
        >
          <AlertCircle size={16} className="shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold text-amber-900 dark:text-amber-200">
              Couldn&apos;t confirm which role you hold.
            </p>
            <p className="mt-0.5">
              Add and deactivate are hidden until we can check. This is not a
              refusal and your account has not changed — reload the page.
            </p>
          </div>
        </div>
      )}

      {draft && (
        <div className="bg-card border border-inverted rounded-xl p-5 space-y-4">
          <h2 className="font-semibold text-foreground">New staff account</h2>

          <div className="grid gap-4 sm:grid-cols-3">
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">
                Email
              </label>
              <input
                type="email"
                value={draft.email}
                onChange={(e) => setDraft({ ...draft, email: e.target.value })}
                className={inputClass}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">
                Password
              </label>
              <input
                type="text"
                value={draft.password}
                onChange={(e) =>
                  setDraft({ ...draft, password: e.target.value })
                }
                placeholder="At least 12 characters"
                className={`${inputClass} font-mono text-xs`}
              />
              {/* Deliberately not a password input. There's no reset flow for
                  these accounts, so whoever creates it needs to read it back
                  to send it on. Hiding it just causes typos. */}
              <p className="text-xs text-muted-foreground mt-1">
                Visible so you can copy it. There&apos;s no reset email for
                platform accounts.
              </p>
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-1">
                Role
              </label>
              <select
                value={draft.role}
                onChange={(e) => setDraft({ ...draft, role: e.target.value })}
                className={inputClass}
              >
                <option value="support">Support</option>
                <option value="admin">Admin</option>
                <option value="superadmin">Superadmin</option>
              </select>
              <p className="text-xs text-muted-foreground mt-1">
                {ROLE_META[draft.role]?.description}
              </p>
            </div>
          </div>

          <div className="flex gap-2">
            <button
              onClick={create}
              disabled={
                busy || !draft.email.trim() || draft.password.length < 12
              }
              className="inline-flex items-center gap-2 bg-inverted text-inverted-foreground text-sm font-semibold px-4 py-2 rounded-lg disabled:opacity-60"
            >
              {busy && <Loader2 size={14} className="animate-spin" />}
              Create
            </button>
            <button
              onClick={() => setDraft(null)}
              className="border border-border text-foreground text-sm font-semibold px-4 py-2 rounded-lg"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground py-8">
          <Loader2 size={16} className="animate-spin" /> Loading…
        </div>
      ) : !admins ? (
        <div className="bg-card border border-border rounded-xl p-8 text-center text-sm text-muted-foreground">
          The staff list couldn&apos;t be loaded. No account has been removed —
          this page just couldn&apos;t read the table.
        </div>
      ) : (
        <div className="bg-card border border-border rounded-xl divide-y divide-border overflow-hidden">
          {admins.map((a) => {
            const meta = ROLE_META[a.role] || {};
            // Never let the last active superadmin be switched off — there'd
            // be nobody left who can create staff accounts, and recovery is a
            // manual database edit.
            const isLastSuperadmin =
              a.role === "superadmin" && a.active && activeSuperadmins <= 1;

            return (
              <div
                key={a.id}
                className="flex items-center justify-between gap-4 px-5 py-4"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span
                      className={`font-medium truncate ${a.active ? "text-foreground" : "text-muted-foreground line-through"}`}
                    >
                      {a.email}
                    </span>
                    <span
                      className={`text-xs px-2 py-0.5 rounded-full border ${meta.className || "bg-muted text-muted-foreground border-border"}`}
                    >
                      {meta.label || a.role}
                    </span>
                    {me?.id === a.id && (
                      <span className="text-xs text-muted-foreground">you</span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {meta.description}
                  </p>
                </div>

                {isSuperadmin && me?.id !== a.id && (
                  <button
                    onClick={() => setActive(a, !a.active)}
                    disabled={busy || isLastSuperadmin}
                    title={
                      isLastSuperadmin
                        ? "The last superadmin can't be deactivated"
                        : undefined
                    }
                    className="inline-flex items-center gap-1.5 border border-border text-sm px-3 py-1.5 rounded-lg hover:bg-muted disabled:opacity-40 shrink-0"
                  >
                    {a.active ? (
                      <>
                        <UserX size={13} /> Deactivate
                      </>
                    ) : (
                      <>
                        <UserCheck size={13} /> Reactivate
                      </>
                    )}
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}

      <div className="bg-muted border border-border rounded-xl p-4 text-sm text-muted-foreground flex gap-2">
        <ShieldCheck size={16} className="shrink-0 mt-0.5 text-muted-foreground" />
        <div>
          <p className="font-medium text-foreground">
            No self-signup, by design.
          </p>
          <p className="mt-1">
            Staff accounts exist only if a superadmin creates one here, or via{" "}
            <span className="font-mono text-xs">
              scripts/seed-platform-admin.mjs
            </span>
            . There&apos;s no password reset email either — re-running the seed
            script for an existing address resets it.
          </p>
        </div>
      </div>
    </div>
  );
}

const inputClass =
  "w-full border border-border rounded-lg px-3 py-2 text-sm bg-card focus:outline-none focus:ring-2 focus:ring-ring/10 focus:border-border";
