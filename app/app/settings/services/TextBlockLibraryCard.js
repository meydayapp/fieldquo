// app/app/settings/services/TextBlockLibraryCard.js
//
// The company's text-block library and its quote templates, on Settings ›
// Services — beside the per-service quote wording, because both are "what
// your quotes say". The same rows the builder's "+ Add area or line item"
// dialog opens on (app/components/quotes/builder/LineItemLibrary.js); this
// card is where they are written, reordered and removed without a quote
// open.
//
// Every write goes through /api/quote-text-blocks and /api/quote-templates
// and the row shown is the row the route returned — never the draft that
// was sent — so a refused save cannot leave the screen claiming otherwise.
"use client";

import { useEffect, useState } from "react";
import { Plus, Pencil, Trash2, Loader2, ChevronUp, ChevronDown, ChevronRight, X, AlertCircle } from "lucide-react";
import { useTranslation } from "@/app/hooks/useTranslation";
import { fetchJson, errorText } from "@/lib/fetchJson";
import { showError } from "@/lib/clientErrors";
import { useCompanyMoney } from "@/app/providers/CompanyPreferencesProvider";
import { LANGUAGES } from "@/app/i18n/languages";
import { PRICE_MODES, textBlockChip } from "@/lib/quotes/textBlocks";
import RichTextEditor from "@/app/components/quotes/builder/RichTextEditor";
import RichTextBody from "@/app/components/quotes/RichTextBody";

const inputClass = "w-full border border-border rounded px-2 py-1.5 text-sm bg-background text-foreground";

const CHIP_KEYS = {
  quantity: "app.textBlocks.chipQuantity",
  hourly: "app.textBlocks.chipHourly",
  text: "app.textBlocks.chipText",
  scope: "app.textBlocks.chipScope",
};

const blank = () => ({ name: "", body: "", priceMode: "none", price: "", unit: "sqft", hiddenOnWorkOrder: false, tags: "" });

export default function TextBlockLibraryCard({ canEdit }) {
  const { t } = useTranslation();
  // The company's currency, the reader's locale — the provider's own rule.
  const money = useCompanyMoney();
  const [blocks, setBlocks] = useState(null);
  const [templates, setTemplates] = useState(null);
  const [editing, setEditing] = useState(null); // { id|null, form }
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  // Folded by default: nine paragraphs of prose above the services list
  // would push the page's own subject below the fold. The header says how
  // many there are, and opens on a click; a screen that renders the panel
  // shut is what the harness photographs unless a scene opens it.
  const [open, setOpen] = useState(false);

  useEffect(() => {
    let alive = true;
    fetchJson("/api/quote-text-blocks")
      .then((rows) => alive && setBlocks(Array.isArray(rows) ? rows : []))
      .catch((err) => {
        if (!alive) return;
        setBlocks([]);
        showError(errorText(t, err));
      });
    fetchJson("/api/quote-templates")
      .then((rows) => alive && setTemplates(Array.isArray(rows) ? rows : []))
      .catch(() => alive && setTemplates([]));
    return () => {
      alive = false;
    };
  }, [t]);

  function startEdit(b) {
    setError("");
    setEditing({
      id: b?.id || null,
      form: b
        ? { name: b.name, body: b.body, priceMode: b.priceMode, price: b.price ?? "", unit: b.unit || "sqft", hiddenOnWorkOrder: b.hiddenOnWorkOrder, tags: (b.tags || []).join(", ") }
        : blank(),
    });
  }

  async function save() {
    if (!editing) return;
    const f = editing.form;
    if (!f.name.trim()) {
      setError(t("app.textBlocks.titleRequired", "Give the item a title."));
      return;
    }
    setBusy("save");
    setError("");
    try {
      const body = {
        name: f.name.trim(),
        body: f.body,
        priceMode: f.priceMode,
        price: f.price === "" ? null : Number(f.price),
        unit: f.priceMode === "quantity" ? f.unit : null,
        hiddenOnWorkOrder: f.hiddenOnWorkOrder,
        tags: f.tags.split(",").map((x) => x.trim()).filter(Boolean),
      };
      const row = editing.id
        ? await fetchJson(`/api/quote-text-blocks/${editing.id}`, { method: "PATCH", body })
        : await fetchJson("/api/quote-text-blocks", { method: "POST", body });
      setBlocks((prev) => (editing.id ? prev.map((b) => (b.id === row.id ? row : b)) : [...(prev || []), row]));
      setEditing(null);
    } catch (err) {
      setError(errorText(t, err));
    } finally {
      setBusy("");
    }
  }

  async function remove(b) {
    if (typeof window !== "undefined" && !window.confirm(t("app.textBlocks.removeConfirm", "Remove “{name}” from the library? Quotes that already use it keep their copy.", { name: b.name }))) return;
    setBusy(`remove:${b.id}`);
    try {
      await fetchJson(`/api/quote-text-blocks/${b.id}`, { method: "DELETE" });
      setBlocks((prev) => prev.filter((x) => x.id !== b.id));
    } catch (err) {
      showError(errorText(t, err));
    } finally {
      setBusy("");
    }
  }

  async function move(b, dir) {
    const list = blocks;
    const i = list.findIndex((x) => x.id === b.id);
    const j = i + dir;
    if (i < 0 || j < 0 || j >= list.length) return;
    const other = list[j];
    setBusy(`move:${b.id}`);
    try {
      // Swap the two sortOrders on the server, then show what it stored.
      const [a2, b2] = await Promise.all([
        fetchJson(`/api/quote-text-blocks/${b.id}`, { method: "PATCH", body: { sortOrder: other.sortOrder } }),
        fetchJson(`/api/quote-text-blocks/${other.id}`, { method: "PATCH", body: { sortOrder: b.sortOrder } }),
      ]);
      setBlocks((prev) => prev.map((x) => (x.id === a2.id ? a2 : x.id === b2.id ? b2 : x)).sort((x, y) => x.sortOrder - y.sortOrder));
    } catch (err) {
      showError(errorText(t, err));
    } finally {
      setBusy("");
    }
  }

  async function removeTemplate(tpl) {
    if (typeof window !== "undefined" && !window.confirm(t("app.quoteTemplates.removeConfirm", "Remove the template “{name}”? Quotes made from it are unaffected.", { name: tpl.name }))) return;
    setBusy(`tpl:${tpl.id}`);
    try {
      await fetchJson(`/api/quote-templates/${tpl.id}`, { method: "DELETE" });
      setTemplates((prev) => prev.filter((x) => x.id !== tpl.id));
    } catch (err) {
      showError(errorText(t, err));
    } finally {
      setBusy("");
    }
  }

  const langName = (code) => LANGUAGES.find((l) => l.code === code)?.nativeName || code;

  return (
    <div className="mb-4 rounded-lg border border-border p-4 space-y-4" data-text-block-library-card>
      <div className="flex items-start justify-between gap-3">
        <button type="button" onClick={() => setOpen((v) => !v)} aria-expanded={open} className="flex items-start gap-2 text-left min-w-0">
          <ChevronRight size={16} className={`shrink-0 mt-0.5 text-muted-foreground transition-transform ${open ? "rotate-90" : ""}`} />
          <span className="min-w-0">
            <span className="block text-sm font-medium">
              {t("app.textBlocks.libraryTitle", "Text block library")}
              {blocks !== null && templates !== null ? (
                <span className="ml-2 text-xs font-normal text-muted-foreground">
                  {t("app.textBlocks.librarySummary", "{blocks} blocks · {templates} templates", { blocks: blocks.length, templates: templates.length })}
                </span>
              ) : null}
            </span>
            <span className="block text-xs text-muted-foreground">
              {t(
                "app.textBlocks.libraryIntro",
                "The paragraphs your quotes reuse — preparation, exclusions, deposit terms, an upgrade with a price. Add one to any quote from “+ Add area or line item”. A block keeps the language it was written in; a quote in another language gets it translated once, checked by you, and kept.",
              )}
            </span>
          </span>
        </button>
        {canEdit && !editing && (
          <button type="button" onClick={() => { setOpen(true); startEdit(null); }} className="shrink-0 inline-flex items-center gap-1 text-sm font-medium text-foreground">
            <Plus size={14} /> {t("app.textBlocks.newBlock", "New block")}
          </button>
        )}
      </div>

      {open && (<>
      {editing && (
        <div className="rounded-lg border border-border p-3 space-y-3 bg-background" data-text-block-form>
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium">{editing.id ? t("app.textBlocks.editBlock", "Edit block") : t("app.textBlocks.newBlock", "New block")}</p>
            <button type="button" onClick={() => setEditing(null)} aria-label={t("app.action.close", "Close")} className="p-1 text-muted-foreground hover:text-foreground"><X size={14} /></button>
          </div>
          <div>
            <label className="block text-xs text-muted-foreground mb-1">{t("app.textBlocks.title", "Title")}</label>
            <input value={editing.form.name} onChange={(e) => setEditing({ ...editing, form: { ...editing.form, name: e.target.value } })} className={inputClass} autoFocus />
          </div>
          <div>
            <label className="block text-xs text-muted-foreground mb-1">{t("app.textBlocks.body", "Text (shown to the homeowner)")}</label>
            <RichTextEditor value={editing.form.body} onChange={(body) => setEditing({ ...editing, form: { ...editing.form, body } })} rows={5} />
          </div>
          <label className="flex items-start gap-2 text-sm">
            <input type="checkbox" checked={editing.form.hiddenOnWorkOrder} onChange={(e) => setEditing({ ...editing, form: { ...editing.form, hiddenOnWorkOrder: e.target.checked } })} className="mt-0.5" />
            <span>
              {t("app.textBlocks.hiddenOnWorkOrder", "Hidden on work order")}
              <span className="block text-xs text-muted-foreground">{t("app.textBlocks.hiddenOnWorkOrderHint", "The crew sees the scope, not this wording.")}</span>
            </span>
          </label>
          <div className="grid sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs text-muted-foreground mb-1">{t("app.textBlocks.price", "Price")}</label>
              <select value={editing.form.priceMode} onChange={(e) => setEditing({ ...editing, form: { ...editing.form, priceMode: e.target.value } })} className={inputClass}>
                {PRICE_MODES.map((m) => (
                  <option key={m} value={m}>{t(`app.textBlocks.mode.${m}`, m)}</option>
                ))}
              </select>
            </div>
            {editing.form.priceMode !== "none" && (
              <div>
                <label className="block text-xs text-muted-foreground mb-1">
                  {editing.form.priceMode === "custom" ? t("app.textBlocks.amount", "Amount") : editing.form.priceMode === "hourly" ? t("app.textBlocks.ratePerHour", "Rate per hour") : t("app.textBlocks.ratePerUnit", "Rate per unit")}
                </label>
                <input type="number" min="0" step="0.01" value={editing.form.price} onChange={(e) => setEditing({ ...editing, form: { ...editing.form, price: e.target.value } })} className={inputClass} placeholder={t("app.textBlocks.askWhenAdding", "Ask when adding")} />
              </div>
            )}
            {editing.form.priceMode === "quantity" && (
              <div>
                <label className="block text-xs text-muted-foreground mb-1">{t("app.textBlocks.unit", "Unit")}</label>
                <input value={editing.form.unit} onChange={(e) => setEditing({ ...editing, form: { ...editing.form, unit: e.target.value } })} className={inputClass} />
              </div>
            )}
          </div>
          <div>
            <label className="block text-xs text-muted-foreground mb-1">{t("app.textBlocks.tags", "Tags (comma-separated: painting, interior…)")}</label>
            <input value={editing.form.tags} onChange={(e) => setEditing({ ...editing, form: { ...editing.form, tags: e.target.value } })} className={inputClass} />
          </div>
          {error ? <p className="text-xs text-red-600 flex items-center gap-1.5"><AlertCircle size={12} /> {error}</p> : null}
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setEditing(null)} className="px-3 py-1.5 rounded-full text-sm border border-border">{t("app.action.cancel", "Cancel")}</button>
            <button type="button" onClick={save} disabled={busy === "save"} className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-semibold bg-inverted text-inverted-foreground disabled:opacity-60" data-text-block-save>
              {busy === "save" ? <Loader2 size={14} className="animate-spin" /> : null}
              {t("app.action.save", "Save")}
            </button>
          </div>
        </div>
      )}

      {blocks === null ? (
        <div className="h-10 bg-accent rounded animate-pulse" aria-busy="true" />
      ) : blocks.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t("app.textBlocks.empty", "No blocks yet — write one below and save it to the library.")}</p>
      ) : (
        <ul className="divide-y divide-border">
          {blocks.map((b, i) => {
            const chip = textBlockChip(b, money);
            const translated = Object.keys(b.translations || {}).filter((k) => b.translations[k]?.name);
            return (
              <li key={b.id} className="py-2.5 flex items-start gap-3" data-text-block-row>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-medium">{b.name}</span>
                    <span className="rounded-full border border-border px-2 py-0.5 text-[10px] text-muted-foreground">{CHIP_KEYS[chip.key] ? t(CHIP_KEYS[chip.key], chip.label) : chip.label}</span>
                    <span className="text-[11px] text-muted-foreground">
                      {langName(b.language)}
                      {translated.length ? ` · ${translated.map(langName).join(", ")}` : ""}
                    </span>
                  </div>
                  {b.body ? <RichTextBody body={b.body} className="mt-1 text-xs text-muted-foreground line-clamp-3" /> : null}
                </div>
                {canEdit && (
                  <div className="flex items-center gap-1 shrink-0">
                    <button type="button" onClick={() => move(b, -1)} disabled={i === 0 || Boolean(busy)} aria-label={t("app.textBlocks.moveUp", "Move up")} className="p-1 text-muted-foreground hover:text-foreground disabled:opacity-30"><ChevronUp size={14} /></button>
                    <button type="button" onClick={() => move(b, 1)} disabled={i === blocks.length - 1 || Boolean(busy)} aria-label={t("app.textBlocks.moveDown", "Move down")} className="p-1 text-muted-foreground hover:text-foreground disabled:opacity-30"><ChevronDown size={14} /></button>
                    <button type="button" onClick={() => startEdit(b)} aria-label={t("app.action.edit", "Edit")} className="p-1 text-muted-foreground hover:text-foreground"><Pencil size={14} /></button>
                    <button type="button" onClick={() => remove(b)} disabled={busy === `remove:${b.id}`} aria-label={t("app.action.delete", "Delete")} className="p-1 text-muted-foreground hover:text-red-600">
                      {busy === `remove:${b.id}` ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                    </button>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}

      <div className="pt-2 border-t border-border">
        <p className="text-sm font-medium">{t("app.quoteTemplates.title", "Quote templates")}</p>
        <p className="text-xs text-muted-foreground mb-2">
          {t("app.quoteTemplates.intro", "Saved from a quote with “Save as template” in its Send… menu; offered on every new quote.")}
        </p>
        {templates === null ? (
          <div className="h-6 bg-accent rounded animate-pulse" aria-busy="true" />
        ) : templates.length === 0 ? (
          <p className="text-xs text-muted-foreground">{t("app.quoteTemplates.empty", "No templates yet.")}</p>
        ) : (
          <ul className="divide-y divide-border">
            {templates.map((tpl) => (
              <li key={tpl.id} className="py-2 flex items-center justify-between gap-3 text-sm" data-quote-template-row>
                <span className="min-w-0 truncate">
                  {tpl.name}
                  <span className="ml-2 text-xs text-muted-foreground">
                    {t("app.quoteTemplates.groupsAndLanguage", "{count} services · {language}", { count: tpl.groups.length, language: langName(tpl.language) })}
                  </span>
                </span>
                {canEdit && (
                  <button type="button" onClick={() => removeTemplate(tpl)} disabled={busy === `tpl:${tpl.id}`} aria-label={t("app.action.delete", "Delete")} className="p-1 text-muted-foreground hover:text-red-600 shrink-0">
                    {busy === `tpl:${tpl.id}` ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
      </>)}
    </div>
  );
}
