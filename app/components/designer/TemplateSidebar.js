"use client";

// app/components/designer/TemplateSidebar.js
//
// Restored per the owner's 2026-08-30 correction: dropped in the first pass
// because its backend was Drizzle/Hono (ai-sidebar's usePaywall was also
// dropped there and stays dropped — this gallery is free). Backend is
// GET /api/designer/templates + the DesignTemplate Prisma model.
//
// ══ Two shelves (2026-09-29) ══════════════════════════════════════════════
//
// "Your templates" — the company's own, made with "Save as template" in the
// campaign editor — above "FieldQuo templates", the contractor catalogue
// grouped by what a post is FOR (before/after, winning work, trust, tips,
// people). A company template can be removed here; that archives it (the
// route never hard-deletes). A FieldQuo one cannot.
//
// ══ Previews are rendered, in the company's colours ═══════════════════════
//
// The route sends each template's first 4:5 slide already filled with this
// company's brand colour, name, phone and language; this panel draws it with
// fabric at thumbnail size. So the picture is what the person will actually
// get — not a stock thumbnail in somebody else's colours — and there is no
// image file per template to fall out of step with its layout. Photo slots
// show as "Add a photo" here; the company's job photos go in on apply.
//
// ══ Applying ══════════════════════════════════════════════════════════════
//
// Inside the campaign editor, `onApplyTemplate` replaces the design — every
// slide and every format (CampaignEditor.js applyTemplate()). Without it
// (nothing else embeds the editor today) the preview replaces the canvas on
// screen, which is all a template could ever do before. Either way a native
// window.confirm() comes first: the design's current contents are lost.
import { useEffect, useRef, useState } from "react";
import { fabric } from "fabric";
import { AlertTriangle, Layers, Loader, Trash2 } from "lucide-react";

import { ToolSidebarClose } from "@/app/components/designer/ToolSidebarClose";
import { ToolSidebarHeader } from "@/app/components/designer/ToolSidebarHeader";
import { useTranslation } from "@/app/hooks/useTranslation";
import { reportResponseError } from "@/lib/clientErrors";
import { TEMPLATE_CATEGORIES } from "@/lib/designer/templateCatalog";

import { cn } from "@/lib/utils";

const THUMB_WIDTH = 150;

/** One preview document drawn to a PNG data URL, off screen. */
function renderPreview(preview) {
  return new Promise((resolve) => {
    try {
      const scale = THUMB_WIDTH / (Number(preview.width) || 1080);
      const el = document.createElement("canvas");
      const canvas = new fabric.StaticCanvas(el, {
        width: Math.round((Number(preview.width) || 1080) * scale),
        height: Math.round((Number(preview.height) || 1350) * scale),
        enableRetinaScaling: false,
      });
      canvas.setZoom(scale);
      canvas.loadFromJSON(preview.json, () => {
        // The workspace rect of a legacy starter may sit anywhere on its
        // original canvas; draw from its corner.
        const clip = canvas.getObjects().find((o) => o.name === "clip");
        if (clip) canvas.absolutePan(new fabric.Point((clip.left || 0) * scale, (clip.top || 0) * scale));
        canvas.renderAll();
        let url = null;
        try {
          url = canvas.toDataURL({ format: "png" });
        } catch {
          url = null; // a tainted canvas: the name card below stands in
        }
        canvas.dispose();
        resolve(url);
      });
    } catch {
      resolve(null);
    }
  });
}

/**
 * @param {Object} props
 * @param {import("@/lib/designer/constants").Editor | undefined} props.editor
 * @param {import("@/lib/designer/constants").ActiveTool} props.activeTool
 * @param {(tool: import("@/lib/designer/constants").ActiveTool) => void} props.onChangeActiveTool
 * @param {(template: object) => Promise<boolean>} [props.onApplyTemplate]
 * @param {number} [props.templatesVersion]
 */
export function TemplateSidebar({ editor, activeTool, onChangeActiveTool, onApplyTemplate, templatesVersion = 0 }) {
  const { t } = useTranslation();
  const [data, setData] = useState(null); // null = loading; { own, catalog }
  const [error, setError] = useState(false);
  const [loadedVersion, setLoadedVersion] = useState(-1);
  const [thumbs, setThumbs] = useState({});
  const [applying, setApplying] = useState(null);
  const rendering = useRef(new Set());

  useEffect(() => {
    if (activeTool !== "templates" || loadedVersion === templatesVersion) return;

    let cancelled = false;
    setError(false);
    fetch("/api/designer/templates")
      .then((res) => (res.ok ? res.json() : Promise.reject(res)))
      .then((body) => {
        if (cancelled) return;
        setData({
          own: Array.isArray(body.own) ? body.own : [],
          catalog: Array.isArray(body.catalog) ? body.catalog : [],
        });
        setLoadedVersion(templatesVersion);
      })
      .catch(() => {
        if (!cancelled) setError(true);
      });

    return () => {
      cancelled = true;
    };
  }, [activeTool, templatesVersion, loadedVersion]);

  // Draw the previews one after another, not forty at once — each is a
  // fabric canvas, and a phone should stay responsive while they come in.
  useEffect(() => {
    if (!data || activeTool !== "templates") return;
    let cancelled = false;
    (async () => {
      for (const tpl of [...data.own, ...data.catalog]) {
        if (cancelled) return;
        if (tpl.thumbnailUrl || rendering.current.has(tpl.id) || !tpl.preview?.json) continue;
        rendering.current.add(tpl.id);
        // eslint-disable-next-line no-await-in-loop
        const url = await renderPreview(tpl.preview);
        if (!cancelled) setThumbs((prev) => ({ ...prev, [tpl.id]: url || "" }));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [data, activeTool]);

  const onClose = () => onChangeActiveTool("select");

  const nameOf = (tpl) => (tpl.own || !tpl.key ? tpl.name : t(`app.designerTemplates.name.${tpl.key}`, tpl.name));

  const onClick = async (template) => {
    if (applying) return;
    const replaceAll = Boolean(onApplyTemplate);
    if (
      !window.confirm(
        replaceAll
          ? t(
              "app.designerTemplates.confirmReplaceAll",
              "Replace this design with the template? Every slide and every format is replaced, and what's there now is lost.",
            )
          : t(
              "app.designerTemplates.confirmReplace",
              "Replace the current design with this template? Anything on the canvas now will be lost.",
            ),
      )
    ) {
      return;
    }
    if (!replaceAll) {
      editor?.loadJson(JSON.stringify(template.preview.json));
      return;
    }
    setApplying(template.id);
    try {
      const ok = await onApplyTemplate(template);
      if (ok) onClose();
    } finally {
      setApplying(null);
    }
  };

  const onArchive = async (template) => {
    if (!window.confirm(t("app.designerTemplates.confirmRemove", "Remove “{name}” from your templates?", { name: template.name }))) return;
    const res = await fetch(`/api/designer/templates/${template.id}`, { method: "DELETE" });
    if (!res.ok) {
      await reportResponseError(res);
      return;
    }
    setData((prev) => (prev ? { ...prev, own: prev.own.filter((x) => x.id !== template.id) } : prev));
  };

  const card = (template) => {
    const thumb = template.thumbnailUrl || thumbs[template.id];
    const aspect = `${template.preview?.width || 1080}/${template.preview?.height || 1350}`;
    return (
      <div key={template.id} className="group relative">
        <button
          type="button"
          style={{ aspectRatio: aspect }}
          onClick={() => onClick(template)}
          disabled={Boolean(applying)}
          className="relative w-full overflow-hidden rounded-sm border bg-muted transition hover:opacity-80 disabled:opacity-60"
          data-template-key={template.key || undefined}
        >
          {thumb ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={thumb} alt={nameOf(template)} className="h-full w-full object-cover" />
          ) : thumb === "" ? (
            // Honest fallback, not a broken <img>: a preview that could not be
            // drawn shows the template's name instead of implying an image.
            <div className="flex h-full w-full items-center justify-center bg-secondary p-2 text-center">
              <span className="text-xs font-medium text-secondary-foreground">{nameOf(template)}</span>
            </div>
          ) : (
            <div className="flex h-full w-full items-center justify-center">
              <Loader className="size-3 animate-spin text-muted-foreground" />
            </div>
          )}
          {applying === template.id && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/40">
              <Loader className="size-4 animate-spin text-white" />
            </div>
          )}
          {template.slideCount > 1 && (
            <span className="absolute right-1 top-1 rounded-full bg-black/70 px-1.5 py-0.5 text-[10px] font-semibold text-white">
              {t("app.marketingDesigner.publishModal.slideCount", { value: template.slideCount })}
            </span>
          )}
        </button>
        <p className="mt-1 truncate text-[11px] text-foreground">{nameOf(template)}</p>
        {template.own && (
          <button
            type="button"
            onClick={() => onArchive(template)}
            aria-label={t("app.designerTemplates.remove", "Remove template")}
            title={t("app.designerTemplates.remove", "Remove template")}
            className="absolute left-1 top-1 rounded-full bg-black/60 p-1 text-white opacity-100 md:opacity-0 md:group-hover:opacity-100"
          >
            <Trash2 size={11} />
          </button>
        )}
      </div>
    );
  };

  const byCategory = (list) => {
    const groups = TEMPLATE_CATEGORIES.map((c) => ({ key: c, items: list.filter((x) => x.category === c) }));
    const other = list.filter((x) => !TEMPLATE_CATEGORIES.includes(x.category));
    if (other.length) groups.push({ key: "other", items: other });
    return groups.filter((g) => g.items.length);
  };

  const empty = data && data.own.length === 0 && data.catalog.length === 0;

  return (
    <aside
      className={cn(
        "fixed inset-x-0 bottom-16 z-40 flex max-h-[75vh] flex-col rounded-t-2xl border-t bg-card shadow-xl md:relative md:inset-x-auto md:bottom-auto md:h-full md:max-h-none md:w-[360px] md:rounded-none md:border-r md:border-t-0 md:shadow-none",
        activeTool === "templates" ? "visible" : "hidden",
      )}
    >
      <ToolSidebarHeader
        title={t("app.designerTemplates.title", "Templates")}
        description={t("app.designerTemplates.description", "Start from a ready-made design in your colours")}
      />
      {data === null && !error && (
        <div className="flex flex-1 items-center justify-center">
          <Loader className="size-4 animate-spin text-muted-foreground" />
        </div>
      )}
      {error && (
        <div className="flex flex-1 flex-col items-center justify-center gap-y-4">
          <AlertTriangle className="size-4 text-muted-foreground" />
          <p className="text-xs text-muted-foreground">{t("app.designerTemplates.loadError", "Failed to load templates")}</p>
        </div>
      )}
      {empty && !error && (
        <div className="flex flex-1 flex-col items-center justify-center gap-y-4 p-4 text-center">
          <Layers className="size-5 text-muted-foreground" />
          <p className="text-sm font-medium">{t("app.designerTemplates.emptyTitle", "No templates yet")}</p>
          <p className="text-xs text-muted-foreground">
            {t(
              "app.designerTemplates.emptyBody",
              "There are no starter designs on this deployment yet. Start from a blank canvas — nothing here is broken.",
            )}
          </p>
        </div>
      )}
      {data && !empty && !error && (
        <div className="overflow-y-auto p-4 space-y-6">
          <section>
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {t("app.designerTemplates.yours", "Your templates")}
            </h3>
            {data.own.length ? (
              <div className="grid grid-cols-2 gap-3">{data.own.map(card)}</div>
            ) : (
              <p className="text-xs text-muted-foreground">
                {t(
                  "app.designerTemplates.yoursEmpty",
                  "None yet. Use “Save as template” at the top of the editor to keep a design your team can reuse.",
                )}
              </p>
            )}
          </section>
          {data.catalog.length > 0 && (
            <section>
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {t("app.designerTemplates.fieldquo", "FieldQuo templates")}
              </h3>
              <div className="space-y-4">
                {byCategory(data.catalog).map((group) => (
                  <div key={group.key}>
                    <p className="mb-2 text-xs font-medium text-foreground">
                      {t(`app.designerTemplates.category.${group.key}`, group.key)}
                    </p>
                    <div className="grid grid-cols-2 gap-3">{group.items.map(card)}</div>
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>
      )}
      <ToolSidebarClose onClick={onClose} />
    </aside>
  );
}
