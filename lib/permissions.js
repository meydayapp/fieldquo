// lib/permissions.js — update the map
export const PERMISSIONS = {
  owner: ["*"],
  admin: ["*"],
  supervisor: [
    "quote:create",
    "quote:convert",
    "appointment:create",
    "appointment:assign",
    "followup:create",
    "task:create",
    "task:assign",
    "workarea:assign",
    "user:view",
  ],
  employee: ["quote:create", "appointment:create", "followup:create"],
};
