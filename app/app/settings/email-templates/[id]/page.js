// app/app/settings/email-templates/[id]/page.js
//
// Mobile-first block editor. A company builds an email by adding typed blocks
// (heading, text, image, button, divider, spacer, quote/invoice summary),
// reorders them with touch-friendly drag-and-drop (dnd-kit), styles each block
// (alignment, heading size, image width, button colours), drops in
// {{mergeField}} tokens, and previews it on phone or desktop widths. Saving
// writes the full `sections` array back to DocumentTemplate.
"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  Trash2,
  Plus,
  Save,
  GripVertical,
  AlignLeft,
  AlignCenter,
  AlignRight,
  Send,
  Smartphone,
  Monitor,
  Star,
  Pencil,
  Eye,
} from "lucide-react";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  TouchSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
  arrayMove,
  sortableKeyboardCoordinates,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  BLOCK_TYPES,
  MERGE_FIELDS,
  STAGE_INDEX,
  newBlock,
} from "@/app/data/emailTemplateBlocks";
import { renderTemplateSections } from "@/lib/email/renderTemplateSections";
import ReplyToPromptModal from "@/app/components/settings/ReplyToPromptModal";
import { reportResponseError } from "@/lib/clientErrors";
import { useTranslation } from "@/app/hooks/useTranslation";

const PREVIEW_MERGE_DATA = {
  clientName: "Jane Doe",
  clientAddress: "123 Maple Street, Toronto, ON",
  clientPhone: "(416) 555-0142",
  companyName: "Your Company",
  companyPhone: "(555) 123-4567",
  companyEmail: "info@yourcompany.com",
  quoteNumber: "Q-1042",
  quoteTotal: "$4,250.00",
  quoteUrl: "https://example.com/quote/preview",
  invoiceNumber: "INV-1042",
  invoiceTotal: "$4,250.00",
  invoiceUrl: "https://example.com/invoice/preview",
  dueDate: "Aug 1, 2026",
  balanceDue: "$1,250.00",
  projectStartDate: "Jul 28, 2026",
  projectEndDate: "Jul 30, 2026",
  jobTitle: "Kitchen Cabinet Refinishing",
  depositAmount: "$1,275.00",
  amountPaid: "$3,000.00",
  subtotal: "$3,900.00",
  discount: "$150.00",
  tax: "$500.00",
  // NOTE: progressStage is deliberately NOT set here. It's derived from the
  // template's type below (see previewMergeData) so a quote template previews
  // at "Quote" instead of showing the invoice stage as already done.
  // Shape matches Quote.lineItems / Invoice.lineItems (`Json?` columns).
  lineItems: [
    {
      name: "Cabinet doors & drawer fronts — spray refinish",
      quantity: 24,
      unitPrice: 125,
      total: 3000,
    },
    {
      name: "Cabinet boxes — on-site refinish",
      quantity: 1,
      unitPrice: 750,
      total: 750,
    },
    { name: "Premium hardware replacement", quantity: 24, unitPrice: 6.25, total: 150 },
  ],
};

// Sensible per-template theme defaults shown in the editor controls. `null`
// theme on the record means "inherit the company's branding".
const FONT_OPTIONS = [
  { value: "sans", label: "Sans (Arial)" },
  { value: "serif", label: "Serif (Georgia)" },
  { value: "system", label: "System UI" },
];

const inputClass =
  "w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring/10 focus:border-border";

// ── Small reusable alignment segmented control ──────────────────────────
function AlignControl({ value = "left", onChange }) {
  const { t } = useTranslation();
  const opts = [
    { v: "left", Icon: AlignLeft },
    { v: "center", Icon: AlignCenter },
    { v: "right", Icon: AlignRight },
  ];
  return (
    <div className="inline-flex rounded-lg border border-border overflow-hidden">
      {opts.map(({ v, Icon }) => (
        <button
          key={v}
          type="button"
          onClick={() => onChange(v)}
          aria-label={t("app.emailEditor.alignAria", "Align {dir}", { dir: v })}
          aria-pressed={value === v}
          className={`px-2.5 py-1.5 ${
            value === v
              ? "bg-inverted text-inverted-foreground"
              : "bg-card text-muted-foreground hover:bg-muted"
          }`}
        >
          <Icon size={14} />
        </button>
      ))}
    </div>
  );
}

// ── Per-block fields (switches on block type) ───────────────────────────
function BlockFields({ block, update, setFocus }) {
  const { t } = useTranslation();
  const fieldRow = "flex flex-wrap items-center gap-2";

  if (block.type === "heading") {
    return (
      <div className="space-y-3">
        <input
          className={inputClass}
          value={block.text || ""}
          onFocus={() => setFocus("text")}
          onChange={(e) => update("text", e.target.value)}
        />
        <div className={fieldRow}>
          <AlignControl
            value={block.align}
            onChange={(v) => update("align", v)}
          />
          <select
            value={block.size || "large"}
            onChange={(e) => update("size", e.target.value)}
            className="border border-border rounded-lg px-2 py-1.5 text-sm bg-card"
          >
            <option value="small">{t("app.emailEditor.sizeSmall", "Small")}</option>
            <option value="medium">{t("app.emailEditor.sizeMedium", "Medium")}</option>
            <option value="large">{t("app.emailEditor.sizeLarge", "Large")}</option>
          </select>
        </div>
      </div>
    );
  }

  if (block.type === "text") {
    return (
      <div className="space-y-3">
        <textarea
          rows={4}
          className={inputClass}
          value={block.text || ""}
          onFocus={() => setFocus("text")}
          onChange={(e) => update("text", e.target.value)}
        />
        <AlignControl value={block.align} onChange={(v) => update("align", v)} />
      </div>
    );
  }

  if (block.type === "image") {
    return (
      <div className="space-y-2">
        <input
          placeholder={t("app.emailEditor.imageUrlPlaceholder", "Image URL")}
          className={inputClass}
          value={block.url || ""}
          onFocus={() => setFocus("url")}
          onChange={(e) => update("url", e.target.value)}
        />
        <input
          placeholder={t("app.emailEditor.altTextPlaceholder", "Alt text")}
          className={inputClass}
          value={block.alt || ""}
          onFocus={() => setFocus("alt")}
          onChange={(e) => update("alt", e.target.value)}
        />
        <div className={fieldRow}>
          <AlignControl
            value={block.align}
            onChange={(v) => update("align", v)}
          />
          <select
            value={block.width || "full"}
            onChange={(e) => update("width", e.target.value)}
            className="border border-border rounded-lg px-2 py-1.5 text-sm bg-card"
          >
            <option value="full">{t("app.emailEditor.widthFull", "Full width")}</option>
            <option value="half">{t("app.emailEditor.widthHalf", "Half width")}</option>
          </select>
        </div>
      </div>
    );
  }

  if (block.type === "button") {
    return (
      <div className="space-y-2">
        <input
          placeholder={t("app.emailEditor.buttonLabelPlaceholder", "Button label")}
          className={inputClass}
          value={block.label || ""}
          onFocus={() => setFocus("label")}
          onChange={(e) => update("label", e.target.value)}
        />
        <input
          placeholder={t("app.emailEditor.linkUrlPlaceholder", "Link URL (or {{quoteUrl}})")}
          className={inputClass}
          value={block.url || ""}
          onFocus={() => setFocus("url")}
          onChange={(e) => update("url", e.target.value)}
        />
        <div className={fieldRow}>
          <AlignControl
            value={block.align}
            onChange={(v) => update("align", v)}
          />
          <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
            {t("app.emailEditor.buttonColorLabel", "Button")}
            <input
              type="color"
              value={block.bg || "#111827"}
              onChange={(e) => update("bg", e.target.value)}
              className="h-7 w-9 rounded border border-border bg-card p-0.5"
            />
          </label>
          <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
            {t("app.emailEditor.textColorLabel", "Text")}
            <input
              type="color"
              value={block.color || "#ffffff"}
              onChange={(e) => update("color", e.target.value)}
              className="h-7 w-9 rounded border border-border bg-card p-0.5"
            />
          </label>
        </div>
      </div>
    );
  }

  if (block.type === "spacer") {
    return (
      <div className="flex items-center gap-3">
        <input
          type="range"
          min={4}
          max={120}
          step={4}
          value={block.height ?? 24}
          onChange={(e) => update("height", Number(e.target.value))}
          className="flex-1 accent-primary"
        />
        <span className="text-xs text-muted-foreground w-12 text-right">
          {block.height ?? 24}px
        </span>
      </div>
    );
  }

  if (block.type === "divider") {
    return <p className="text-xs text-muted-foreground">{t("app.emailEditor.dividerDesc", "A horizontal divider line.")}</p>;
  }

  if (block.type === "summary") {
    return (
      <p className="text-xs text-muted-foreground">
        {t("app.emailEditor.summaryDesc", "Automatically shows the quote or invoice number and total — nothing to configure.")}
      </p>
    );
  }

  if (block.type === "lineItems") {
    const toggles = [
      ["showQuantity", t("app.emailEditor.toggleQuantity", "Quantity")],
      ["showUnitPrice", t("app.emailEditor.toggleUnitPrice", "Unit price")],
      ["showSubtotals", t("app.emailEditor.toggleLineTotals", "Line totals")],
    ];
    return (
      <div className="space-y-3">
        <input
          placeholder={t("app.emailEditor.sectionTitlePlaceholder", "Section title (optional)")}
          className={inputClass}
          value={block.title ?? ""}
          onFocus={() => setFocus("title")}
          onChange={(e) => update("title", e.target.value)}
        />
        <div className="flex flex-wrap gap-3">
          {toggles.map(([key, label]) => (
            <label
              key={key}
              className="flex items-center gap-1.5 text-xs text-muted-foreground"
            >
              <input
                type="checkbox"
                checked={block[key] !== false}
                onChange={(e) => update(key, e.target.checked)}
                className="rounded border-border accent-primary"
              />
              {label}
            </label>
          ))}
        </div>
        <p className="text-xs text-muted-foreground">
          {t("app.emailEditor.lineItemsHelp", "Pulls the real line items from the quote or invoice this email is sent for. Hidden automatically when there aren't any.")}
        </p>
      </div>
    );
  }

  if (block.type === "progress") {
    const stages = Array.isArray(block.stages) ? block.stages : [];
    return (
      <div className="space-y-3">
        <div className="space-y-2">
          {stages.map((stage, i) => (
            <div key={i} className="flex items-center gap-2">
              <input
                className={inputClass}
                value={stage}
                onChange={(e) => {
                  const next = [...stages];
                  next[i] = e.target.value;
                  update("stages", next);
                }}
              />
              <button
                type="button"
                onClick={() =>
                  update(
                    "stages",
                    stages.filter((_, idx) => idx !== i),
                  )
                }
                className="text-muted-foreground hover:text-red-500 p-1 shrink-0"
                aria-label={t("app.emailEditor.removeStageAria", "Remove stage {num}", { num: i + 1 })}
              >
                <Trash2 size={14} />
              </button>
            </div>
          ))}
        </div>
        <button
          type="button"
          onClick={() => update("stages", [...stages, t("app.emailEditor.newStage", "New stage")])}
          className="text-xs text-muted-foreground hover:text-foreground underline"
        >
          {t("app.emailEditor.addStage", "+ Add stage")}
        </button>

        <label className="flex items-start gap-2 text-xs text-muted-foreground">
          <input
            type="checkbox"
            checked={block.useMergeField !== false}
            onChange={(e) => update("useMergeField", e.target.checked)}
            className="mt-0.5 rounded border-border accent-primary"
          />
          <span>
            {t("app.emailEditor.autoStageLabel", "Set the current stage automatically from the project's status when the email sends.")}
          </span>
        </label>

        {block.useMergeField === false && (
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground shrink-0">
              {t("app.emailEditor.currentStage", "Current stage")}
            </span>
            <select
              value={block.activeStage ?? 0}
              onChange={(e) => update("activeStage", Number(e.target.value))}
              className="border border-border rounded-lg px-2 py-1.5 text-sm bg-card"
            >
              {stages.map((s, i) => (
                <option key={i} value={i}>
                  {s}
                </option>
              ))}
            </select>
          </div>
        )}
        {block.useMergeField !== false && (
          <p className="text-xs text-muted-foreground">
            {t("app.emailEditor.previewStageNote", "The preview shows the stage this template is normally sent at.")}
          </p>
        )}
      </div>
    );
  }

  return null;
}

// ── One sortable block card ─────────────────────────────────────────────
function SortableBlock({ block, update, remove, setFocus }) {
  const { t } = useTranslation();
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: block.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 50 : undefined,
  };

  const label =
    BLOCK_TYPES.find((bt) => bt.type === block.type)?.label || block.type;

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`bg-card border border-border rounded-xl p-4 ${
        isDragging ? "shadow-lg ring-2 ring-ring/10 opacity-90" : ""
      }`}
    >
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2 min-w-0">
          <button
            type="button"
            {...attributes}
            {...listeners}
            aria-label={t("app.emailEditor.dragToReorder", "Drag to reorder")}
            className="touch-none cursor-grab active:cursor-grabbing text-muted-foreground hover:text-foreground -ml-1 p-1 rounded"
          >
            <GripVertical size={18} />
          </button>
          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide truncate">
            {label}
          </span>
        </div>
        <button
          type="button"
          onClick={() => remove(block.id)}
          className="text-muted-foreground hover:text-red-500 p-1"
          aria-label={t("app.emailEditor.removeBlock", "Remove block")}
        >
          <Trash2 size={15} />
        </button>
      </div>

      <BlockFields
        block={block}
        update={(field, value) => update(block.id, field, value)}
        setFocus={(field) => setFocus({ blockId: block.id, field })}
      />
    </div>
  );
}

export default function EmailTemplateEditorPage() {
  const { t } = useTranslation();
  const { id } = useParams();

  const [template, setTemplate] = useState(null);
  const [name, setName] = useState("");
  const [subject, setSubject] = useState("");
  const [sections, setSections] = useState([]);
  // Per-template overrides. null = inherit the company's branding.
  const [theme, setTheme] = useState(null);
  // Company branding, so the preview shows the same header/footer the client
  // will actually receive rather than a generic placeholder.
  const [company, setCompany] = useState({});
  const [themeOpen, setThemeOpen] = useState(false);
  const [isActive, setIsActive] = useState(false);
  const [activating, setActivating] = useState(false);
  const [lastFocused, setLastFocused] = useState(null); // { blockId, field }
  const [addOpen, setAddOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savedFlash, setSavedFlash] = useState(false);
  const [loading, setLoading] = useState(true);

  const [testEmail, setTestEmail] = useState("");
  const [sendingTest, setSendingTest] = useState(false);
  const [testMsg, setTestMsg] = useState(null); // { ok, text }

  const [mobileView, setMobileView] = useState("edit"); // edit | preview
  const [previewDevice, setPreviewDevice] = useState("desktop"); // desktop | mobile

  // Touch-first sensors: a dedicated grip handle starts the drag, so the rest
  // of the card stays scrollable/tappable on a phone. Small distance/delay
  // thresholds keep normal taps and page scrolling working.
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 120, tolerance: 6 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  useEffect(() => {
    fetch(`/api/settings/document-templates/${id}`)
      .then((r) => r.json())
      .then((data) => {
        setTemplate(data);
        setName(data.name || "");
        setSubject(data.subject || "");
        setSections(Array.isArray(data.sections) ? data.sections : []);
        setTheme(data.theme || null);
        setIsActive(!!data.isDefault);
        setLoading(false);
      });
  }, [id]);

  // Branding is read-only here — it's edited on Settings > Branding. Failing
  // quietly is fine: resolveTheme() falls back to a complete default palette,
  // so the preview still renders if this request doesn't land.
  useEffect(() => {
    fetch("/api/settings/business-info")
      .then((r) => r.json())
      .then((data) => setCompany(data || {}))
      .catch(() => {});
  }, []);

  // The lifecycle stage this template's emails actually go out at. A quote
  // email previews at "Quote"; a receipt/invoice email at "Invoice &
  // scheduling". Types with no lifecycle position (marketing, custom) fall
  // back to the first stage.
  const previewStage = STAGE_INDEX[template?.type] ?? 0;

  const previewMergeData = useMemo(
    () => ({ ...PREVIEW_MERGE_DATA, progressStage: previewStage }),
    [previewStage],
  );

  // `preview: true` makes links inert so clicking a CTA can't navigate the
  // preview iframe away to the sample-data placeholder URL.
  const previewHtml = useMemo(
    () =>
      renderTemplateSections(sections, previewMergeData, {
        preview: true,
        company,
        theme,
      }),
    [sections, previewMergeData, company, theme],
  );

  // Merge one key into the theme override object, creating it on first edit.
  function updateTheme(key, value) {
    setTheme((prev) => ({ ...(prev || {}), [key]: value }));
  }

  function updateBlockField(blockId, field, value) {
    setSections((prev) =>
      prev.map((b) => (b.id === blockId ? { ...b, [field]: value } : b)),
    );
  }

  function removeBlock(blockId) {
    setSections((prev) => prev.filter((b) => b.id !== blockId));
  }

  function addBlock(type) {
    setSections((prev) => [...prev, newBlock(type)]);
    setAddOpen(false);
  }

  function handleDragEnd(event) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    setSections((prev) => {
      const from = prev.findIndex((b) => b.id === active.id);
      const to = prev.findIndex((b) => b.id === over.id);
      if (from === -1 || to === -1) return prev;
      return arrayMove(prev, from, to);
    });
  }

  function insertToken(token) {
    if (!lastFocused) return;
    // The subject line is not a block, so it gets its own branch.
    if (lastFocused.subject) {
      setSubject((prev) => `${prev}{{${token}}}`);
      return;
    }
    const block = sections.find((b) => b.id === lastFocused.blockId);
    if (!block) return;
    const current = block[lastFocused.field] || "";
    updateBlockField(
      lastFocused.blockId,
      lastFocused.field,
      `${current}{{${token}}}`,
    );
  }

  async function handleSave() {
    setSaving(true);
    const res = await fetch(`/api/settings/document-templates/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, subject, sections, theme }),
    });
    if (res.ok) {
      setSavedFlash(true);
      setTimeout(() => setSavedFlash(false), 2000);
    } else {
      // Was silent: a failed request did nothing visible at all.
      await reportResponseError(res);
    }
    setSaving(false);
  }

  async function handleActivate() {
    if (isActive) return;
    setActivating(true);
    const res = await fetch(
      `/api/settings/document-templates/${id}/activate`,
      { method: "POST" },
    );
    if (res.ok) setIsActive(true); else {
      // Was silent: a failed request did nothing visible at all.
      await reportResponseError(res);
    }
    setActivating(false);
  }

  async function handleSendTest() {
    if (!testEmail.trim()) return;
    setSendingTest(true);
    setTestMsg(null);
    // Save first so the test reflects the latest edits.
    await fetch(`/api/settings/document-templates/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, subject, sections, theme }),
    });
    const res = await fetch(`/api/settings/document-templates/${id}/test`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ to: testEmail.trim() }),
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok) {
      setTestMsg({ ok: true, text: t("app.emailEditor.testSent", "Test sent to {email}", { email: testEmail.trim() }) });
    } else {
      setTestMsg({ ok: false, text: data.error || t("app.emailEditor.testError", "Couldn't send the test.") });
    }
    setSendingTest(false);
  }

  if (loading) {
    return (
      <div className="p-4 sm:p-6 max-w-6xl mx-auto animate-pulse space-y-4">
        <div className="h-8 bg-accent rounded w-1/3" />
        <div className="h-96 bg-accent rounded-xl" />
      </div>
    );
  }

  if (!template) {
    return (
      <div className="p-4 sm:p-6 max-w-5xl mx-auto">
        <p className="text-sm text-muted-foreground">{t("app.editPdf.templateNotFound", "Template not found.")}</p>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto">
      {/* Asks for a company email if none is set — otherwise client replies
          to this template's emails go to an unmonitored address. */}
      <ReplyToPromptModal
        context="emails"
        onSaved={(email) => setCompany((c) => ({ ...c, email }))}
      />

      {/* Sticky header — always reachable on mobile while scrolling blocks */}
      <div className="sticky top-0 z-20 bg-card/90 backdrop-blur border-b border-border">
        <div className="p-4 sm:px-6 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 min-w-0">
            <Link
              href="/app/settings/email-templates"
              className="text-muted-foreground hover:text-foreground shrink-0"
              aria-label={t("app.emailEditor.backToTemplates", "Back to templates")}
            >
              <ArrowLeft size={18} />
            </Link>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="text-base sm:text-xl font-bold text-foreground border-none focus:outline-none focus:ring-0 px-0 min-w-0 w-full"
            />
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={handleActivate}
              disabled={activating || isActive}
              className={`hidden sm:flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-lg border ${
                isActive
                  ? "border-emerald-200 dark:border-emerald-900 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 cursor-default"
                  : "border-border text-foreground hover:bg-muted"
              }`}
            >
              <Star size={13} className={isActive ? "fill-emerald-700" : ""} />
              {isActive ? t("app.status.active", "Active") : activating ? t("app.emailEditor.activating", "Activating…") : t("app.emailEditor.setActive", "Set active")}
            </button>
            {savedFlash && (
              <span className="text-xs text-emerald-600 dark:text-emerald-400 hidden sm:inline">
                {t("app.action.saved", "Saved")}
              </span>
            )}
            <button
              onClick={handleSave}
              disabled={saving}
              className="bg-inverted text-inverted-foreground text-sm font-semibold px-4 py-2 rounded-lg flex items-center gap-2 disabled:opacity-60"
            >
              <Save size={14} />
              {saving ? t("app.action.saving", "Saving…") : t("app.action.save", "Save")}
            </button>
          </div>
        </div>

        {/* Mobile Edit/Preview switch */}
        <div className="lg:hidden flex border-t border-border">
          <button
            onClick={() => setMobileView("edit")}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-medium ${
              mobileView === "edit"
                ? "text-foreground border-b-2 border-inverted"
                : "text-muted-foreground"
            }`}
          >
            <Pencil size={14} /> {t("app.action.edit", "Edit")}
          </button>
          <button
            onClick={() => setMobileView("preview")}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-medium ${
              mobileView === "preview"
                ? "text-foreground border-b-2 border-inverted"
                : "text-muted-foreground"
            }`}
          >
            <Eye size={14} /> {t("app.action.preview", "Preview")}
          </button>
        </div>
      </div>

      <div className="p-4 sm:p-6 grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* ── Editor column ──────────────────────────────────────── */}
        <div
          className={`${
            mobileView === "edit" ? "block" : "hidden"
          } lg:block space-y-3`}
        >
          {/* Active row for mobile */}
          <button
            onClick={handleActivate}
            disabled={activating || isActive}
            className={`sm:hidden w-full flex items-center justify-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-lg border ${
              isActive
                ? "border-emerald-200 dark:border-emerald-900 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300"
                : "border-border text-foreground"
            }`}
          >
            <Star size={13} className={isActive ? "fill-emerald-700" : ""} />
            {isActive
              ? t("app.emailEditor.activeTemplate", "Active template")
              : activating
                ? t("app.emailEditor.activating", "Activating…")
                : t("app.emailEditor.setAsActive", "Set as active")}
          </button>

          {/* Subject line */}
          <div className="bg-card border border-border rounded-xl p-4">
            <label
              htmlFor="template-subject"
              className="block text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2"
            >
              {t("app.emailEditor.subjectLabel", "Subject line")}
            </label>
            <input
              id="template-subject"
              className={inputClass}
              placeholder={t("app.emailEditor.subjectPlaceholder", "Your quote from {{companyName}} is ready")}
              value={subject}
              onFocus={() => setLastFocused({ subject: true })}
              onChange={(e) => setSubject(e.target.value)}
            />
            <p className="text-xs text-muted-foreground mt-1.5">
              {t("app.emailEditor.subjectHelper", "Merge fields work here too. Left blank, the built-in subject for this template type is used.")}
            </p>
          </div>

          {/* Theme */}
          <div className="bg-card border border-border rounded-xl p-4">
            <button
              type="button"
              onClick={() => setThemeOpen((v) => !v)}
              className="w-full flex items-center justify-between text-left"
            >
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                {t("app.emailEditor.lookAndFeel", "Look & feel")}
              </span>
              <span className="text-xs text-muted-foreground">
                {theme ? t("app.emailEditor.customized", "Customized") : t("app.emailEditor.usingBranding", "Using your branding")}
              </span>
            </button>

            {themeOpen && (
              <div className="mt-3 space-y-3">
                <div className="flex flex-wrap items-center gap-3">
                  <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    {t("app.emailEditor.accentLabel", "Accent")}
                    <input
                      type="color"
                      value={theme?.accent || company.brandColor || "#06356b"}
                      onChange={(e) => updateTheme("accent", e.target.value)}
                      className="h-7 w-9 rounded border border-border bg-card p-0.5"
                    />
                  </label>
                  <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    {t("app.emailEditor.headerLabel", "Header")}
                    <input
                      type="color"
                      value={theme?.headerBg || "#1A1917"}
                      onChange={(e) => updateTheme("headerBg", e.target.value)}
                      className="h-7 w-9 rounded border border-border bg-card p-0.5"
                    />
                  </label>
                  <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    {t("app.emailEditor.backgroundLabel", "Background")}
                    <input
                      type="color"
                      value={theme?.bg || "#F8F4EF"}
                      onChange={(e) => updateTheme("bg", e.target.value)}
                      className="h-7 w-9 rounded border border-border bg-card p-0.5"
                    />
                  </label>
                </div>

                <div className="flex flex-wrap items-center gap-4">
                  <select
                    value={theme?.font || "sans"}
                    onChange={(e) => updateTheme("font", e.target.value)}
                    className="border border-border rounded-lg px-2 py-1.5 text-sm bg-card"
                  >
                    {FONT_OPTIONS.map((f) => (
                      <option key={f.value} value={f.value}>
                        {t(`app.emailEditor.font_${f.value}`, f.label)}
                      </option>
                    ))}
                  </select>
                  <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <input
                      type="checkbox"
                      checked={theme?.showHeader !== false}
                      onChange={(e) =>
                        updateTheme("showHeader", e.target.checked)
                      }
                      className="rounded border-border accent-primary"
                    />
                    {t("app.emailEditor.headerLabel", "Header")}
                  </label>
                  <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <input
                      type="checkbox"
                      checked={theme?.showFooter !== false}
                      onChange={(e) =>
                        updateTheme("showFooter", e.target.checked)
                      }
                      className="rounded border-border accent-primary"
                    />
                    {t("app.emailEditor.footerLabel", "Footer")}
                  </label>
                </div>

                {theme && (
                  <button
                    type="button"
                    onClick={() => setTheme(null)}
                    className="text-xs text-muted-foreground hover:text-foreground underline"
                  >
                    {t("app.emailEditor.resetBranding", "Reset to my company branding")}
                  </button>
                )}
                {!company.logoUrl && (
                  <p className="text-xs text-muted-foreground">
                    {t("app.emailEditor.noLogoNote", "No logo uploaded — the header shows your company name instead. Add one in Settings > Branding.")}
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Merge fields */}
          <div className="bg-card border border-border rounded-xl p-4">
            <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
              {t("app.emailEditor.insertMergeField", "Insert a merge field")}
            </div>
            <div className="flex flex-wrap gap-1.5">
              {MERGE_FIELDS.map((f) => (
                <button
                  key={f.token}
                  onClick={() => insertToken(f.token)}
                  disabled={!lastFocused}
                  title={
                    lastFocused
                      ? t("app.emailEditor.mergeFieldEnabledTitle", "Insert into the field you last clicked")
                      : t("app.emailEditor.mergeFieldDisabledTitle", "Click into a text field first")
                  }
                  className="text-xs bg-muted hover:bg-accent disabled:opacity-40 disabled:hover:bg-muted text-foreground px-2 py-1 rounded-full"
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          {sections.length === 0 && (
            <p className="text-sm text-muted-foreground px-1">
              {t("app.emailEditor.noBlocks", "No blocks yet — add one below.")}
            </p>
          )}

          {/* Sortable blocks */}
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext
              items={sections.map((b) => b.id)}
              strategy={verticalListSortingStrategy}
            >
              <div className="space-y-3">
                {sections.map((block) => (
                  <SortableBlock
                    key={block.id}
                    block={block}
                    update={updateBlockField}
                    remove={removeBlock}
                    setFocus={setLastFocused}
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>

          {/* Add block */}
          <div className="relative">
            <button
              onClick={() => setAddOpen((v) => !v)}
              className="w-full flex items-center justify-center gap-2 border-2 border-dashed border-border rounded-xl py-3 text-sm font-medium text-muted-foreground hover:border-border hover:text-foreground"
            >
              <Plus size={14} /> {t("app.emailEditor.addBlock", "Add block")}
            </button>
            {addOpen && (
              <div className="absolute z-10 mt-1 w-full bg-card border border-border rounded-xl shadow-lg p-1.5">
                {BLOCK_TYPES.map((bt) => (
                  <button
                    key={bt.type}
                    onClick={() => addBlock(bt.type)}
                    className="w-full text-left text-sm px-3 py-2 rounded-lg hover:bg-muted text-foreground"
                  >
                    {bt.label}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Send a test */}
          <div className="bg-card border border-border rounded-xl p-4">
            <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
              {t("app.emailEditor.sendTest", "Send a test")}
            </div>
            <div className="flex flex-col sm:flex-row gap-2">
              <input
                type="email"
                placeholder={t("app.emailEditor.testEmailPlaceholder", "you@email.com")}
                value={testEmail}
                onChange={(e) => setTestEmail(e.target.value)}
                className={inputClass}
              />
              <button
                onClick={handleSendTest}
                disabled={sendingTest || !testEmail.trim()}
                className="bg-inverted text-inverted-foreground text-sm font-semibold px-4 py-2 rounded-lg flex items-center justify-center gap-2 disabled:opacity-60 shrink-0"
              >
                <Send size={14} />
                {sendingTest ? t("app.action.sending", "Sending…") : t("app.action.send", "Send")}
              </button>
            </div>
            {testMsg && (
              <p
                className={`text-xs mt-2 ${
                  testMsg.ok ? "text-emerald-600 dark:text-emerald-400" : "text-red-500"
                }`}
              >
                {testMsg.text}
              </p>
            )}
          </div>
        </div>

        {/* ── Preview column ─────────────────────────────────────── */}
        <div
          className={`${
            mobileView === "preview" ? "block" : "hidden"
          } lg:block`}
        >
          <div className="lg:sticky lg:top-32">
            <div className="flex items-center justify-between mb-2">
              <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                {t("app.emailEditor.previewSampleData", "Preview (sample data)")}
              </div>
              <div className="inline-flex rounded-lg border border-border overflow-hidden">
                <button
                  onClick={() => setPreviewDevice("mobile")}
                  aria-label={t("app.emailEditor.mobilePreview", "Mobile preview")}
                  aria-pressed={previewDevice === "mobile"}
                  className={`px-2.5 py-1.5 ${
                    previewDevice === "mobile"
                      ? "bg-inverted text-inverted-foreground"
                      : "bg-card text-muted-foreground hover:bg-muted"
                  }`}
                >
                  <Smartphone size={14} />
                </button>
                <button
                  onClick={() => setPreviewDevice("desktop")}
                  aria-label={t("app.emailEditor.desktopPreview", "Desktop preview")}
                  aria-pressed={previewDevice === "desktop"}
                  className={`px-2.5 py-1.5 ${
                    previewDevice === "desktop"
                      ? "bg-inverted text-inverted-foreground"
                      : "bg-card text-muted-foreground hover:bg-muted"
                  }`}
                >
                  <Monitor size={14} />
                </button>
              </div>
            </div>
            <div className="bg-muted border border-border rounded-xl p-3 flex justify-center">
              <iframe
                title={t("app.emailEditor.emailPreview", "Email preview")}
                srcDoc={previewHtml}
                // Belt-and-braces with the inert-link styles: no scripts, no
                // form submits, no top-level navigation out of the editor.
                sandbox=""
                className="bg-card rounded-lg border border-border transition-all"
                style={{
                  width: previewDevice === "mobile" ? 390 : "100%",
                  maxWidth: "100%",
                  height: 620,
                }}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
