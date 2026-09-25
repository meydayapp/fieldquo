// app/app/clients/page.js
"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { Users, Plus, Search, Upload } from "lucide-react";
import ClientListRow from "./ClientListRow";

import { useTranslation } from "@/app/hooks/useTranslation";
import { fetchArray } from "@/lib/loadState";
import ListState, { ListCount } from "@/app/components/ListState";
import { useHasLevel } from "@/app/providers/PermissionProvider";

export default function ClientsPage() {
  const { t } = useTranslation();
  // null, not [] — see lib/loadState.js. An empty array is a claim that there
  // are zero clients, and this page used to make that claim before the server
  // had answered, which is how a 401 rendered "0 clients total / No clients
  // yet" to someone with a full client list.
  const [clients, setClients] = useState(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [errorKey, setErrorKey] = useState("");
  // The level both write routes behind the buttons below already take.
  const canWriteClients = useHasLevel("clientsProperties", "full_edit");

  const load = useCallback(async () => {
    setLoading(true);
    setErrorKey("");
    const result = await fetchArray("/api/clients");
    if (result.aborted) return;
    if (result.ok) setClients(result.data);
    else setErrorKey(result.errorKey);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const filtered = (clients ?? []).filter((c) => {
    const s = search.toLowerCase();
    return (
      c.name?.toLowerCase().includes(s) ||
      c.email?.toLowerCase().includes(s) ||
      c.phone?.toLowerCase().includes(s)
    );
  });

  return (
    <div className="p-4 sm:p-6 max-w-6xl mx-auto space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground">{t("app.clients.title")}</h1>
          {/* Renders nothing while the count is unknown. Not "0", not a dash —
              a number you were refused is not a number you can print. */}
          <ListCount count={clients?.length}>
            {clients?.length === 1
              ? t("app.clients.countOne")
              : t("app.clients.count", { count: clients?.length })}
          </ListCount>
          {/* The past-client callback list, for whoever the rotation is
              assigned to (owners and admins see every list). The page
              refuses anyone else, so the link is the honest offer. */}
          <p className="text-xs mt-1">
            <Link href="/app/callbacks" className="underline text-muted-foreground hover:text-foreground">
              {t("app.callbacks.clientsLink")}
            </Link>
          </p>
        </div>
        {/* Both writes require clientsProperties: full_edit — the level POST
            /api/clients and POST /api/clients/import have always taken, and
            the one AdminSidebar's quick-add already asks for. This pair was
            offered to everyone, so a member at view_only followed them into a
            form or a CSV preview and was refused at the end of it. Both target
            pages now refuse on arrival as well; this only stops offering. */}
        {canWriteClients && (
          <div className="flex items-center gap-2">
            {/* /app/clients/import worked and was linked from NOTHING — a
                contractor switching from another system had a CSV importer they
                could only reach by typing the URL. It belongs beside "New
                client", which is where someone with a list to load looks. */}
            <Link
              href="/app/clients/import"
              className="flex items-center gap-2 border border-border text-foreground px-4 py-2.5 rounded-full text-sm font-semibold"
            >
              <Upload size={16} /> {t("app.clients.import")}
            </Link>
            <Link
              href="/app/clients/new"
              className="flex items-center gap-2 bg-inverted text-inverted-foreground px-4 py-2.5 rounded-full text-sm font-semibold"
            >
              <Plus size={16} /> {t("app.clients.new")}
            </Link>
          </div>
        )}
      </div>

      {/* The search box stays mounted through every state — hiding it on error
          would move the page under the user the moment a retry succeeds. */}
      <div className="relative max-w-sm">
        <Search
          size={16}
          className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
        />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={t("app.clients.search")}
          className="w-full pl-9 pr-3 py-2.5 border border-border rounded-lg text-sm"
        />
      </div>

      <ListState
        loading={loading}
        errorKey={errorKey}
        onRetry={load}
        isEmpty={filtered.length === 0}
        skeleton={
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 animate-pulse">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-32 bg-accent rounded-xl" />
            ))}
          </div>
        }
        empty={
          <div className="bg-card border border-border rounded-xl p-12 text-center">
            <Users size={40} className="mx-auto text-muted-foreground mb-3" />
            <p className="text-sm text-muted-foreground">
              {search ? t("app.clients.noMatch") : t("app.clients.emptyTitle")}
            </p>
            {/* Same gate as the header pair. "Add your first client" is a
                worse dead end than the buttons above it — it is the only thing
                on an empty screen, so following it and being refused leaves
                somebody with nowhere else to have gone. */}
            {!search && canWriteClients && (
              <Link
                href="/app/clients/new"
                className="text-sm font-medium text-foreground underline mt-2 inline-block"
              >
                {t("app.clients.empty")}
              </Link>
            )}
          </div>
        }
      >
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((client) => (
            <ClientListRow key={client.id} client={client} />
          ))}
        </div>
      </ListState>
    </div>
  );
}
