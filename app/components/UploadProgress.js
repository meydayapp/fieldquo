"use client";

// app/components/UploadProgress.js
//
// The one upload progress UI. Every upload through lib/media/uploadClient.js
// reports here on its own, so no caller draws a bar of its own and no two
// screens show progress differently.
//
// Mounted in the /app shell and inside the shared MediaUploader (which also
// runs on the public forms and the client portal, where there is no /app
// shell). Only the first mounted instance draws — see registerProgressHost —
// so an /app page with an uploader still shows one bar.
//
// Client-facing too, so it carries no FieldQuo wording or colour: neutral
// theme tokens, the file's own name, and a percentage. No sentence to
// translate, which is what lets the same bar sit on a French self-quote form.

import { useEffect, useState, useSyncExternalStore } from "react";
import {
  subscribeUploads,
  getUploadsSnapshot,
  getServerUploadsSnapshot,
  registerProgressHost,
  subscribeHosts,
  activeProgressHost,
} from "@/lib/media/uploadProgress";

export default function UploadProgress() {
  // A stable identity for this instance, compared by reference.
  const [token] = useState(() => ({}));
  const [isHost, setIsHost] = useState(false);

  useEffect(() => {
    const unregister = registerProgressHost(token);
    const check = () => setIsHost(activeProgressHost() === token);
    const unsubscribe = subscribeHosts(check);
    check();
    return () => {
      unsubscribe();
      unregister();
    };
  }, [token]);

  const uploads = useSyncExternalStore(subscribeUploads, getUploadsSnapshot, getServerUploadsSnapshot);
  if (!isHost || uploads.length === 0) return null;

  const loaded = uploads.reduce((s, u) => s + (u.loaded || 0), 0);
  const total = uploads.reduce((s, u) => s + (u.total || 0), 0);
  const pct = total > 0 ? Math.min(100, Math.round((loaded / total) * 100)) : 0;
  const label = uploads.length === 1 ? uploads[0].name : `${uploads.length} × ${uploads[0].name}`;

  return (
    <div
      className="pointer-events-none fixed inset-x-0 z-[70] flex justify-center px-4"
      // Above the mobile tab bar where there is one (--fq-tab-bar-height is
      // set by the /app shell and absent — so 0 — everywhere else).
      style={{ bottom: "calc(var(--fq-tab-bar-height, 0px) + 16px + env(safe-area-inset-bottom, 0px))" }}
    >
      <div
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={pct}
        aria-valuetext={`${pct}%`}
        className="w-full max-w-sm rounded-lg border border-border bg-background px-3 py-2 text-foreground shadow-lg"
      >
        <div className="flex items-center justify-between gap-3 text-xs">
          <span className="min-w-0 truncate">{label}</span>
          <span className="shrink-0 tabular-nums text-muted-foreground">{pct}%</span>
        </div>
        <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-muted">
          <div className="h-full rounded-full bg-foreground transition-[width] duration-150" style={{ width: `${pct}%` }} />
        </div>
      </div>
    </div>
  );
}
