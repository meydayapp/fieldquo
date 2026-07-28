// app/app/clients/page.js
"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Users, Plus, Search, Phone, MapPin, ArrowRight } from "lucide-react";

export default function ClientsPage() {
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => {
    fetch("/api/clients")
      .then((r) => r.json())
      .then((data) => setClients(Array.isArray(data) ? data : []))
      .finally(() => setLoading(false));
  }, []);

  const filtered = clients.filter((c) => {
    const s = search.toLowerCase();
    return (
      c.name?.toLowerCase().includes(s) ||
      c.email?.toLowerCase().includes(s) ||
      c.phone?.toLowerCase().includes(s)
    );
  });

  if (loading) {
    return (
      <div className="p-6 max-w-6xl mx-auto animate-pulse space-y-4">
        <div className="h-8 w-40 bg-accent rounded" />
        <div className="grid grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-32 bg-accent rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Clients</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {clients.length} client{clients.length !== 1 ? "s" : ""} total.
          </p>
        </div>
        <Link
          href="/app/clients/new"
          className="flex items-center gap-2 bg-inverted text-inverted-foreground px-4 py-2.5 rounded-full text-sm font-semibold"
        >
          <Plus size={16} /> New Client
        </Link>
      </div>

      <div className="relative max-w-sm">
        <Search
          size={16}
          className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
        />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search clients..."
          className="w-full pl-9 pr-3 py-2.5 border border-border rounded-lg text-sm"
        />
      </div>

      {filtered.length === 0 ? (
        <div className="bg-card border border-border rounded-xl p-12 text-center">
          <Users size={40} className="mx-auto text-muted-foreground mb-3" />
          <p className="text-sm text-muted-foreground">
            {search ? "No clients match your search." : "No clients yet."}
          </p>
          {!search && (
            <Link
              href="/app/clients/new"
              className="text-sm font-medium text-foreground underline mt-2 inline-block"
            >
              Add your first client
            </Link>
          )}
        </div>
      ) : (
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
                        Contractor
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

              <div className="flex items-center gap-4 mt-3 pt-3 border-t border-border text-xs text-muted-foreground">
                <span>{client.quotes?.length ?? 0} quotes</span>
                <span>{client.invoices?.length ?? 0} invoices</span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
