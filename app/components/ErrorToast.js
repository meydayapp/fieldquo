// app/components/ErrorToast.js
//
// Superseded by app/components/ToastLayer.js on 2026-09-12 — the one layer
// for every surface, mounted through a portal so nothing in a shell can clip
// it. This file stays as an alias rather than being deleted, so an import of
// the old name still renders the real thing; there is nothing else here.
//
// New code mounts <ToastLayer surface="…" /> and calls showToast() /
// showError() (lib/toast.js, lib/clientErrors.js).
"use client";

export { default } from "@/app/components/ToastLayer";
