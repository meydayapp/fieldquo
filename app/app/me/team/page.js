"use client";

// app/app/me/team/page.js — the team directory: names, titles, phone,
// a chat link for anyone with a login. The roster rule is the chat
// directory's (lib/company/chat/store.js directoryFor); a Worker with no
// login is listed too, with no chat link, because a directory that hid the
// yard hand would be a directory of logins, not of the team.
import { useState } from "react";
import Link from "next/link";
import { MessagesSquare, Phone, Search, UserCog } from "lucide-react";
import { useTranslation } from "@/app/hooks/useTranslation";
import { usePermissions } from "@/app/providers/PermissionProvider";
import { can } from "@/lib/permissions";
import MeShell from "@/app/components/me/MeShell";
import { EmptyNote, MeLoad, PersonAvatar, useMeData } from "@/app/components/me/bits";

export default function MeTeamPage() {
  const { t } = useTranslation();
  const caller = usePermissions();
  const [q, setQ] = useState("");
  const { data, errorKey, loading, reload } = useMeData(`/api/me/team?q=${encodeURIComponent(q)}`);
  const manages = can(caller?.role, "user:manage");
  return (
    <MeShell title={t("app.me.tab.team")}>
      <div className="mb-3 flex items-center gap-2">
        <label className="relative flex-1">
          <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("app.me.team.search")} className="w-full rounded-xl border border-border bg-background py-3 pl-9 pr-3 text-base" />
        </label>
        {manages ? (
          <Link href="/app/settings/team" className="inline-flex min-h-[44px] items-center gap-1.5 rounded-xl border border-border px-3 text-sm font-semibold text-foreground">
            <UserCog size={15} /> {t("app.me.team.manage")}
          </Link>
        ) : null}
      </div>
      <MeLoad loading={loading} errorKey={errorKey} reload={reload}>
        {data?.people?.length ? (
          <ul className="divide-y divide-border rounded-2xl border border-border bg-card">
            {data.people.map((p) => (
              <li key={p.id} className="flex items-center gap-3 px-4 py-3">
                <PersonAvatar name={p.name} image={p.image} />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-base font-semibold text-foreground">
                    {p.name}
                    {p.isYou ? <span className="ml-1 text-xs font-normal text-muted-foreground">({t("app.me.team.you")})</span> : null}
                  </div>
                  <div className="truncate text-sm text-muted-foreground">{p.title || (p.kind === "worker" ? t("app.me.team.noLogin") : p.label)}</div>
                </div>
                {p.phone ? (
                  <a href={`tel:${p.phone}`} aria-label={t("app.me.team.call", { name: p.name })} className="grid h-11 w-11 place-items-center rounded-xl border border-border text-foreground">
                    <Phone size={16} />
                  </a>
                ) : null}
                {p.kind === "member" && !p.isYou ? (
                  <Link href="/app/chat" aria-label={t("app.me.team.message", { name: p.name })} className="grid h-11 w-11 place-items-center rounded-xl border border-border text-foreground">
                    <MessagesSquare size={16} />
                  </Link>
                ) : null}
              </li>
            ))}
          </ul>
        ) : (
          <EmptyNote>{t("app.me.team.empty")}</EmptyNote>
        )}
      </MeLoad>
    </MeShell>
  );
}
