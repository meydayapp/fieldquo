"use client";

// app/components/platform/PlatformWriteGate.js
//
// Who is allowed to write, on the console where writing is the exception.
//
// ── The bug this exists to kill ────────────────────────────────────────────
//
// Four screens in /platform rendered a complete editor to every platform admin
// and let the API refuse it: the AI cap editor and the promo-code generator
// (both superadmin-only in their routes), the extend-trial panel (billing:manage
// — superadmin-only), and the service-category creator (service_category:manage
// — refused for support). You filled the form in, pressed the button, and got a
// red 403. That is the one rule this codebase is swept for — never ship a
// control that appears to work and doesn't.
//
// The /platform/sales pages already solved it, five times, by hand. This is
// that solution in one file, because the sixth hand-rolled copy is the one
// that rots.
//
// ── Why identity has three states, not two ─────────────────────────────────
//
// Every hand-rolled copy does `const isSuperadmin = me?.role === "superadmin"`
// after a fetch that swallows its failure. So when /api/platform/me is down,
// `me` is null, `isSuperadmin` is false, and a real superadmin is shown a
// refusal telling them they lack a permission they hold. Never-loaded rendered
// as restricted — the same four-states mistake as an empty list on a failed
// fetch, one screen over.
//
// So: loading shows nothing (a refusal that might be wrong is worse than a
// blank half-second), a failed identity check says the check failed and names
// the remedy, and only a role we actually read can refuse anyone.

import { useEffect, useState } from "react";
import { AlertCircle, Lock } from "lucide-react";
import { fetchJson } from "@/lib/fetchJson";

/**
 * The signed-in platform admin, with the "we don't know yet" and "we couldn't
 * find out" cases kept apart from the answer.
 *
 * @returns {{
 *   admin: object|null,
 *   status: "loading"|"ready"|"failed",
 *   error: string,
 *   isSuperadmin: boolean,
 *   can: (permission: string) => boolean,
 * }}
 *
 * `can` and `isSuperadmin` are false while loading and while failed. They are
 * the answer to "may this person write", and the honest answer before the role
 * is known is no — but callers must branch on `status` before rendering a
 * refusal, which is exactly what <PlatformWriteGate> does for them.
 */
export function usePlatformAdmin() {
  const [admin, setAdmin] = useState(null);
  const [status, setStatus] = useState("loading");
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    fetchJson("/api/platform/me")
      .then((me) => {
        if (cancelled) return;
        setAdmin(me);
        setStatus("ready");
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err.message || "Couldn't confirm your role.");
        setStatus("failed");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // The permission list comes from the server (app/api/platform/me re-reads the
  // role from the database rather than trusting the JWT), so this never
  // second-guesses the matrix in lib/platform/permissions.js — it reports what
  // that matrix said. A superadmin holds "*".
  const permissions = admin?.permissions || [];
  const can = (permission) =>
    status === "ready" &&
    (permissions.includes("*") || permissions.includes(permission));

  return {
    admin,
    status,
    error,
    isSuperadmin: status === "ready" && admin?.role === "superadmin",
    can,
  };
}

/**
 * Renders `children` only when the signed-in admin may actually perform the
 * write, and otherwise renders ONE coherent block saying why.
 *
 * @param {object}  props
 * @param {"loading"|"ready"|"failed"} props.status  from usePlatformAdmin()
 * @param {boolean} props.allowed  whether the write is permitted
 * @param {string}  props.action   what the controls would do, as a noun phrase
 *   read after "…": e.g. "Setting a company's AI cap".
 * @param {string}  props.who      who may do it: "Superadmins" / "Admins and
 *   superadmins". Written out rather than derived from the permission string,
 *   because "service_category:manage" is not a sentence.
 * @param {string}  [props.error]  from usePlatformAdmin()
 * @param {React.ReactNode} props.children  the controls themselves
 *
 * One block, not a sentence floating above a greyed-out form: a reason and a
 * disabled form read as two unrelated things, and the commonest reading of
 * that pair is "the feature is gone".
 */
export default function PlatformWriteGate({
  status,
  allowed,
  action,
  who,
  error,
  children,
}) {
  if (allowed) return children;

  // Nothing at all while we're asking. Half a second of blank beats half a
  // second of a refusal that may be about to be withdrawn.
  if (status === "loading") return null;

  if (status === "failed") {
    return (
      <div
        role="alert"
        className="bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900 rounded-xl p-4 flex items-start gap-2.5"
      >
        <AlertCircle
          size={16}
          className="shrink-0 mt-0.5 text-amber-700 dark:text-amber-400"
        />
        <div className="text-sm text-amber-800 dark:text-amber-300">
          <p className="font-semibold text-amber-900 dark:text-amber-200">
            Couldn&apos;t confirm what you&apos;re allowed to do.
          </p>
          <p className="mt-0.5">
            {action} is hidden until we can check — this is not a refusal, and
            nothing about your account has changed. Reload the page.
            {error ? ` (${error})` : ""}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-muted border border-border rounded-xl p-4 flex items-start gap-2.5">
      <Lock size={16} className="shrink-0 mt-0.5 text-muted-foreground" />
      <div className="text-sm text-muted-foreground">
        <p className="font-semibold text-foreground">
          You can read this. {action} is {who} only.
        </p>
        <p className="mt-0.5">
          The controls aren&apos;t shown rather than shown and refused. Ask a
          superadmin if you need this done.
        </p>
      </div>
    </div>
  );
}
