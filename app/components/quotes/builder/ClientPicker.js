// app/components/quotes/builder/ClientPicker.js
//
// Choosing who the quote is for, and adding them if they're new.
//
// The picker and the new-client modal live together because they're one
// decision: a contractor standing in someone's kitchen either finds them in
// the list or types them in, and bouncing to a separate Clients page to do the
// second would lose the quote they'd started.
//
// ── Selecting a client adopts their language ────────────────────────────────
//
// Handled by the parent through onSelect, but worth knowing it happens: a
// client with a saved language preference sets the quote's language on
// selection. That's the entire point of storing it, and it stays overridable
// in the language bar underneath.
"use client";

import { Plus, Search, X } from "lucide-react";
import LanguagePicker from "@/app/components/LanguagePicker";
import AddressAutocomplete from "@/app/components/AddressAutocomplete";
import { formatPhoneInput } from "@/lib/validation";
import { useTranslation } from "@/app/hooks/useTranslation";

const inputClass = "w-full border border-border rounded px-3 py-2 text-sm";

export default function ClientPicker({
  clients = [],
  selectedClient,
  onSelect,
  onClear,
  search,
  onSearchChange,
  showNewClient,
  onOpenNewClient,
  onCloseNewClient,
  newClient,
  onNewClientChange,
  onCreateClient,
  companyLanguage = "en",
  creating,
  error,
  // Once a quote exists its client is settled: PATCH /api/quotes/[id] takes no
  // clientId, so a "Change" button here would be a control that appears to work
  // and doesn't. The client is still SHOWN, because who the quote is for is
  // information the screen should keep carrying.
  locked = false,
}) {
  const { t } = useTranslation();
  return (
    <>
      <div
        className="bg-card border border-border rounded-xl p-5"
        data-tour="client-picker"
      >
        <h2 className="font-semibold text-foreground mb-3">Client</h2>

        {selectedClient ? (
          <div className="flex items-center justify-between bg-muted rounded-lg px-4 py-3">
            <div className="min-w-0">
              <div className="font-medium text-foreground truncate">
                {selectedClient.name}
              </div>
              <div className="text-sm text-muted-foreground truncate">
                {selectedClient.email || selectedClient.phone}
              </div>
            </div>
            {!locked && (
              <button
                type="button"
                onClick={onClear}
                className="text-sm text-muted-foreground underline shrink-0 ml-3"
              >
                Change
              </button>
            )}
          </div>
        ) : locked ? (
          // A locked picker with nothing selected is a quote whose client row
          // has gone. Say so rather than offering a search that cannot attach
          // one — this route has no way to set a client.
          <p className="text-sm text-muted-foreground">
            {t("app.quoteEdit.noClientOnRecord")}
          </p>
        ) : (
          <div>
            <div className="relative mb-2">
              <Search
                size={15}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
              />
              <input
                value={search}
                onChange={(e) => onSearchChange(e.target.value)}
                placeholder="Search clients…"
                className="w-full pl-9 pr-3 py-2 border border-border rounded-lg text-sm"
              />
            </div>

            {search && (
              <div className="border border-border rounded-lg divide-y divide-border max-h-48 overflow-y-auto mb-2">
                {clients.length === 0 && (
                  <p className="px-3 py-3 text-sm text-muted-foreground">
                    No matches.
                  </p>
                )}
                {clients.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => onSelect(c)}
                    className="w-full text-left px-3 py-2.5 text-sm hover:bg-muted"
                  >
                    <div className="font-medium text-foreground">{c.name}</div>
                    <div className="text-xs text-muted-foreground">
                      {c.email || c.phone}
                    </div>
                  </button>
                ))}
              </div>
            )}

            <button
              type="button"
              onClick={onOpenNewClient}
              className="text-sm font-medium text-foreground flex items-center gap-1"
            >
              <Plus size={14} /> Add new client
            </button>
          </div>
        )}
      </div>

      {showNewClient && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-card rounded-xl w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold text-foreground">New client</h2>
              <button
                type="button"
                onClick={onCloseNewClient}
                aria-label="Close"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={onCreateClient} className="space-y-3">
              {/* Homeowner vs company changes which fields make sense, not
                  just a label — a company needs a contact person, a homeowner
                  doesn't. */}
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => onNewClientChange({ type: "individual" })}
                  className={`border rounded-lg px-3 py-2 text-sm ${
                    newClient.type !== "company"
                      ? "border-inverted bg-muted font-medium"
                      : "border-border"
                  }`}
                >
                  Homeowner
                </button>
                <button
                  type="button"
                  onClick={() => onNewClientChange({ type: "company" })}
                  className={`border rounded-lg px-3 py-2 text-sm ${
                    newClient.type === "company"
                      ? "border-inverted bg-muted font-medium"
                      : "border-border"
                  }`}
                >
                  Company / contractor
                </button>
              </div>

              <input
                required
                placeholder={
                  newClient.type === "company" ? "Company name" : "Name"
                }
                value={newClient.name}
                onChange={(e) => onNewClientChange({ name: e.target.value })}
                className={inputClass}
              />

              {newClient.type === "company" && (
                <input
                  placeholder="Contact person"
                  value={newClient.contactName}
                  onChange={(e) =>
                    onNewClientChange({ contactName: e.target.value })
                  }
                  className={inputClass}
                />
              )}

              <input
                type="email"
                placeholder="Email"
                value={newClient.email}
                onChange={(e) => onNewClientChange({ email: e.target.value })}
                className={inputClass}
              />

              <input
                placeholder="555-123-4567"
                value={newClient.phone}
                onChange={(e) =>
                  onNewClientChange({ phone: formatPhoneInput(e.target.value) })
                }
                className={inputClass}
              />

              {/* The language this client is written to, asked at the moment
                  they are created rather than left for somebody to remember
                  later. The full client form has always had this; the quick-add
                  on the fastest path in the product did not, so every client
                  born here was silently on the company default.

                  Placed above the address on purpose: the address decides tax,
                  the language decides what the person can read, and the second
                  is the one somebody notices while they are looking at a name
                  they just typed. */}
              <LanguagePicker
                value={newClient.language ?? null}
                onChange={(v) => onNewClientChange({ language: v })}
                companyDefault={companyLanguage}
              />

              <AddressAutocomplete
                value={newClient.address}
                onChange={(v) => onNewClientChange({ address: v })}
                // city and province were destructured away here, so every
                // client created through the quote flow's quick-add landed
                // with province: null — and with autoApplyLocalTax on, the
                // quote and its invoice rendered $0.00 tax. Silent
                // under-billing, on the fastest path in the product.
                //
                // The autocomplete has always supplied these, and the full
                // client pages (app/clients/new, app/clients/[id]) have always
                // kept them. This was the copy that rotted.
                //
                // `|| undefined` rather than `|| null`: an autocomplete result
                // missing a locality should leave whatever was typed alone,
                // not overwrite it with an absence.
                // address-jurisdiction: keeps city, province AND country.
                //
                // `country` used to be dropped here, and dropping it alone was
                // enough to break tax on every client quick-added from the
                // builder: resolveTaxRate refuses to guess a country from a
                // province code (deliberately — "ON" on its own is ambiguous),
                // so a client with province "ON" and country null resolves to
                // "unknown" exactly like one with no address at all. Google
                // returns it as short_name, which is already the ISO alpha-2
                // the lookup wants.
                onPlaceSelected={({ address, city, province, postalCode, country }) =>
                  onNewClientChange({
                    address,
                    city: city || undefined,
                    province: province || undefined,
                    postalCode: postalCode || undefined,
                    country: country || undefined,
                  })
                }
                placeholder={
                  newClient.type === "company"
                    ? "Business address (optional)"
                    : "Address"
                }
                className={inputClass}
              />

              {/* The page-level error banner sits behind this modal, so a
                  failed create would otherwise show its message somewhere the
                  user can't see. */}
              {error && (
                <div className="bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 text-red-700 dark:text-red-300 text-sm rounded-lg px-3 py-2">
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={creating}
                className="w-full bg-inverted text-inverted-foreground py-2 rounded-full text-sm font-semibold disabled:opacity-60"
              >
                {creating ? "Creating…" : "Create client"}
              </button>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
