// app/app/clients/page.js
"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { Users, Plus, Search, Phone, MapPin, ArrowRight , Upload } from "lucide-react";

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
            <Link
              key={client.id}
              href={`/app/clients/${client.id}`}
              className="bg-card border border-border rounded-xl p-5 hover:border-border hover:shadow-sm transition-all"
            >
              <div className="flex items-start justify-between">
                <div className="min-w-0">
                  <div className="font-semibold text-foreground truncate flex items-center gap-2">
                    <span className="truncate">{client.name}</span>
                    {client.type === "company" && (
                      <span className="text-[11px] bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 px-1.5 py-0.5 rounded-full shrink-0">
                        {t("app.clients.contractor")}
                      </span>
                    )}
                  </div>
                  {client.type === "company" && client.contactName ? (
                    <div className="text-sm text-muted-foreground truncate mt-0.5">
                      {client.contactName}
                    </div>
                  ) : (
                    client.email && (
                      <div className="text-sm text-muted-foreground truncate mt-0.5">
                        {client.email}
                      </div>
                    )
                  )}
                </div>
                <ArrowRight size={16} className="text-muted-foreground shrink-0" />
              </div>

              <div className="mt-3 space-y-1.5">
                {client.phone && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Phone size={13} className="shrink-0" /> {client.phone}
                  </div>
                )}
                {(client.city || client.address) && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <MapPin size={13} className="shrink-0" />
                    <span className="truncate">
                      {[client.city, client.province]
                        .filter(Boolean)
                        .join(", ") || client.address}
                    </span>
                  </div>
                )}
              </div>

              {/* Counted nouns, not "{n} quotes". These two were the last raw
                  English on this card — a French office read "3 quotes" beside
                  a translated everything-else — and the catalogue entries for
                  them (app.clients.quoteCount / .invoiceCount) had been written
                  and never wired up. countedNoun asks Intl.PluralRules, so
                  "1 quote" and Ukrainian's three forms both come out right. */}
              <div className="flex items-center gap-4 mt-3 pt-3 border-t border-border text-xs text-muted-foreground">
                <span>
                  {t("app.clients.quoteCount", { value: client._count?.quotes ?? 0 })}
                </span>
                <span>
                  {t("app.clients.invoiceCount", { value: client._count?.invoices ?? 0 })}
                </span>
              </div>
            </Link>
          ))}
        </div>
      </ListState>
    </div>
  );
}
