"use client";

// app/components/designer/Toolbar.js
//
// Ported from `components/toolbar.tsx`. react-icons (FaBold/FaItalic/
// FaStrikethrough/FaUnderline, TbColorFilter, BsBorderWidth,
// RxTransparencyGrid) replaced with lucide-react equivalents — this repo
// already depends on lucide-react and is told not to add react-icons.
// "Remove background" button dropped along with remove-bg-sidebar (see the
// note in Editor.js); "Filters" stays, since image filters are pure
// client-side canvas math with no AI backend dependency.
import { useState } from "react";
import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  ArrowDown,
  ArrowUp,
  Bold,
  ChevronDown,
  Copy,
  Filter,
  Italic,
  Ruler,
  Strikethrough,
  Trash,
  Underline,
  Blend,
} from "lucide-react";

import { isTextType } from "@/lib/designer/utils";
import { FontSizeInput } from "@/app/components/designer/FontSizeInput";
import { FONT_SIZE, FONT_WEIGHT } from "@/lib/designer/constants";

import { cn } from "@/lib/utils";
import { Hint } from "@/components/Hint";
import { Button } from "@/components/ui/button";

/**
 * @param {Object} props
 * @param {import("@/lib/designer/constants").Editor | undefined} props.editor
 * @param {import("@/lib/designer/constants").ActiveTool} props.activeTool
 * @param {(tool: import("@/lib/designer/constants").ActiveTool) => void} props.onChangeActiveTool
 */
export function Toolbar({ editor, activeTool, onChangeActiveTool }) {
  const initialFillColor = editor?.getActiveFillColor();
  const initialStrokeColor = editor?.getActiveStrokeColor();
  const initialFontFamily = editor?.getActiveFontFamily();
  const initialFontWeight = editor?.getActiveFontWeight() || FONT_WEIGHT;
  const initialFontStyle = editor?.getActiveFontStyle();
  const initialFontLinethrough = editor?.getActiveFontLinethrough();
  const initialFontUnderline = editor?.getActiveFontUnderline();
  const initialTextAlign = editor?.getActiveTextAlign();
  const initialFontSize = editor?.getActiveFontSize() || FONT_SIZE;

  const [properties, setProperties] = useState({
    fillColor: initialFillColor,
    strokeColor: initialStrokeColor,
    fontFamily: initialFontFamily,
    fontWeight: initialFontWeight,
    fontStyle: initialFontStyle,
    fontLinethrough: initialFontLinethrough,
    fontUnderline: initialFontUnderline,
    textAlign: initialTextAlign,
    fontSize: initialFontSize,
  });

  const selectedObject = editor?.selectedObjects[0];
  const selectedObjectType = editor?.selectedObjects[0]?.type;

  const isText = isTextType(selectedObjectType);
  const isImage = selectedObjectType === "image";

  const onChangeFontSize = (value) => {
    if (!selectedObject) return;

    editor?.changeFontSize(value);
    setProperties((current) => ({ ...current, fontSize: value }));
  };

  const onChangeTextAlign = (value) => {
    if (!selectedObject) return;

    editor?.changeTextAlign(value);
    setProperties((current) => ({ ...current, textAlign: value }));
  };

  const toggleBold = () => {
    if (!selectedObject) return;

    const newValue = properties.fontWeight > 500 ? 500 : 700;

    editor?.changeFontWeight(newValue);
    setProperties((current) => ({ ...current, fontWeight: newValue }));
  };

  const toggleItalic = () => {
    if (!selectedObject) return;

    const isItalic = properties.fontStyle === "italic";
    const newValue = isItalic ? "normal" : "italic";

    editor?.changeFontStyle(newValue);
    setProperties((current) => ({ ...current, fontStyle: newValue }));
  };

  const toggleLinethrough = () => {
    if (!selectedObject) return;

    const newValue = !properties.fontLinethrough;

    editor?.changeFontLinethrough(newValue);
    setProperties((current) => ({ ...current, fontLinethrough: newValue }));
  };

  const toggleUnderline = () => {
    if (!selectedObject) return;

    const newValue = !properties.fontUnderline;

    editor?.changeFontUnderline(newValue);
    setProperties((current) => ({ ...current, fontUnderline: newValue }));
  };

  if (editor?.selectedObjects.length === 0) {
    return (
      <div className="z-[49] flex h-[56px] w-full shrink-0 items-center gap-x-2 overflow-x-auto border-b bg-card p-2" />
    );
  }

  return (
    <div className="z-[49] flex h-[56px] w-full shrink-0 items-center gap-x-2 overflow-x-auto border-b bg-card p-2">
      {!isImage && (
        <div className="flex h-full items-center justify-center">
          <Hint label="Color" side="bottom" sideOffset={5}>
            <Button
              onClick={() => onChangeActiveTool("fill")}
              size="icon"
              variant="ghost"
              className={cn(activeTool === "fill" && "bg-muted")}
            >
              <div
                className="size-4 rounded-sm border"
                style={{ backgroundColor: properties.fillColor }}
              />
            </Button>
          </Hint>
        </div>
      )}
      {!isText && (
        <div className="flex h-full items-center justify-center">
          <Hint label="Stroke color" side="bottom" sideOffset={5}>
            <Button
              onClick={() => onChangeActiveTool("stroke-color")}
              size="icon"
              variant="ghost"
              className={cn(activeTool === "stroke-color" && "bg-muted")}
            >
              <div
                className="size-4 rounded-sm border-2 bg-background"
                style={{ borderColor: properties.strokeColor }}
              />
            </Button>
          </Hint>
        </div>
      )}
      {!isText && (
        <div className="flex h-full items-center justify-center">
          <Hint label="Stroke width" side="bottom" sideOffset={5}>
            <Button
              onClick={() => onChangeActiveTool("stroke-width")}
              size="icon"
              variant="ghost"
              className={cn(activeTool === "stroke-width" && "bg-muted")}
            >
              <Ruler className="size-4" />
            </Button>
          </Hint>
        </div>
      )}
      {isText && (
        <div className="flex h-full items-center justify-center">
          <Hint label="Font" side="bottom" sideOffset={5}>
            <Button
              onClick={() => onChangeActiveTool("font")}
              size="icon"
              variant="ghost"
              className={cn("w-auto px-2 text-sm", activeTool === "font" && "bg-muted")}
            >
              <div className="max-w-[100px] truncate">{properties.fontFamily}</div>
              <ChevronDown className="ml-2 size-4 shrink-0" />
            </Button>
          </Hint>
        </div>
      )}
      {isText && (
        <div className="flex h-full items-center justify-center">
          <Hint label="Bold" side="bottom" sideOffset={5}>
            <Button
              onClick={toggleBold}
              size="icon"
              variant="ghost"
              className={cn(properties.fontWeight > 500 && "bg-muted")}
            >
              <Bold className="size-4" />
            </Button>
          </Hint>
        </div>
      )}
      {isText && (
        <div className="flex h-full items-center justify-center">
          <Hint label="Italic" side="bottom" sideOffset={5}>
            <Button
              onClick={toggleItalic}
              size="icon"
              variant="ghost"
              className={cn(properties.fontStyle === "italic" && "bg-muted")}
            >
              <Italic className="size-4" />
            </Button>
          </Hint>
        </div>
      )}
      {isText && (
        <div className="flex h-full items-center justify-center">
          <Hint label="Underline" side="bottom" sideOffset={5}>
            <Button
              onClick={toggleUnderline}
              size="icon"
              variant="ghost"
              className={cn(properties.fontUnderline && "bg-muted")}
            >
              <Underline className="size-4" />
            </Button>
          </Hint>
        </div>
      )}
      {isText && (
        <div className="flex h-full items-center justify-center">
          <Hint label="Strike" side="bottom" sideOffset={5}>
            <Button
              onClick={toggleLinethrough}
              size="icon"
              variant="ghost"
              className={cn(properties.fontLinethrough && "bg-muted")}
            >
              <Strikethrough className="size-4" />
            </Button>
          </Hint>
        </div>
      )}
      {isText && (
        <div className="flex h-full items-center justify-center">
          <Hint label="Align left" side="bottom" sideOffset={5}>
            <Button
              onClick={() => onChangeTextAlign("left")}
              size="icon"
              variant="ghost"
              className={cn(properties.textAlign === "left" && "bg-muted")}
            >
              <AlignLeft className="size-4" />
            </Button>
          </Hint>
        </div>
      )}
      {isText && (
        <div className="flex h-full items-center justify-center">
          <Hint label="Align center" side="bottom" sideOffset={5}>
            <Button
              onClick={() => onChangeTextAlign("center")}
              size="icon"
              variant="ghost"
              className={cn(properties.textAlign === "center" && "bg-muted")}
            >
              <AlignCenter className="size-4" />
            </Button>
          </Hint>
        </div>
      )}
      {isText && (
        <div className="flex h-full items-center justify-center">
          <Hint label="Align right" side="bottom" sideOffset={5}>
            <Button
              onClick={() => onChangeTextAlign("right")}
              size="icon"
              variant="ghost"
              className={cn(properties.textAlign === "right" && "bg-muted")}
            >
              <AlignRight className="size-4" />
            </Button>
          </Hint>
        </div>
      )}
      {isText && (
        <div className="flex h-full items-center justify-center">
          <FontSizeInput value={properties.fontSize} onChange={onChangeFontSize} />
        </div>
      )}
      {isImage && (
        <div className="flex h-full items-center justify-center">
          <Hint label="Filters" side="bottom" sideOffset={5}>
            <Button
              onClick={() => onChangeActiveTool("filter")}
              size="icon"
              variant="ghost"
              className={cn(activeTool === "filter" && "bg-muted")}
            >
              <Filter className="size-4" />
            </Button>
          </Hint>
        </div>
      )}
      <div className="flex h-full items-center justify-center">
        <Hint label="Bring forward" side="bottom" sideOffset={5}>
          <Button onClick={() => editor?.bringForward()} size="icon" variant="ghost">
            <ArrowUp className="size-4" />
          </Button>
        </Hint>
      </div>
      <div className="flex h-full items-center justify-center">
        <Hint label="Send backwards" side="bottom" sideOffset={5}>
          <Button onClick={() => editor?.sendBackwards()} size="icon" variant="ghost">
            <ArrowDown className="size-4" />
          </Button>
        </Hint>
      </div>
      <div className="flex h-full items-center justify-center">
        <Hint label="Opacity" side="bottom" sideOffset={5}>
          <Button
            onClick={() => onChangeActiveTool("opacity")}
            size="icon"
            variant="ghost"
            className={cn(activeTool === "opacity" && "bg-muted")}
          >
            <Blend className="size-4" />
          </Button>
        </Hint>
      </div>
      <div className="flex h-full items-center justify-center">
        <Hint label="Duplicate" side="bottom" sideOffset={5}>
          <Button
            onClick={() => {
              editor?.onCopy();
              editor?.onPaste();
            }}
            size="icon"
            variant="ghost"
          >
            <Copy className="size-4" />
          </Button>
        </Hint>
      </div>
      <div className="flex h-full items-center justify-center">
        <Hint label="Delete" side="bottom" sideOffset={5}>
          <Button onClick={() => editor?.delete()} size="icon" variant="ghost">
            <Trash className="size-4" />
          </Button>
        </Hint>
      </div>
    </div>
  );
}
