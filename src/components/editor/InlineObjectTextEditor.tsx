"use client";

import { useEffect, useRef, type CSSProperties, type KeyboardEvent } from "react";
import type { ArticleTextStyle, EditorObjectType, EditorSelectionBounds } from "@/types/editor";

type InlineObjectTextEditorProps = {
  objectType: EditorObjectType;
  bounds: EditorSelectionBounds;
  textStyle: ArticleTextStyle | null;
  zoom: number;
  value: string;
  onChange: (value: string) => void;
  onSelectionChange: (start: number, end: number) => void;
  onCommit: () => void;
  onCancel: () => void;
};

// `fontStyle` here follows the same convention Konva's Text uses: a
// space-separated mix of an italic keyword and a weight, e.g. "italic 700",
// "700", "bold", or "" — split it into the two CSS properties a textarea
// actually understands.
const splitFontStyle = (fontStyle: string | undefined): { fontStyle: string; fontWeight: string } => {
  const tokens = (fontStyle ?? "").split(/\s+/).filter(Boolean);
  const italic = tokens.includes("italic") || tokens.includes("oblique");
  const weightToken = tokens.find((token) => token !== "italic" && token !== "oblique");

  return {
    fontStyle: italic ? "italic" : "normal",
    fontWeight: weightToken ?? "normal",
  };
};

/**
 * Matches the textarea's look to the real composed typography (font, size,
 * weight, colour, alignment, line-height) so editing happens visually in
 * place on the page rather than in a generic textbox dropped on top of it.
 * Exact line-wrap during typing can still differ from the print composition
 * engine's hyphenation-justification — it re-settles the moment the edit
 * commits — but nothing about that layout math is touched here.
 */
const getTypographyStyle = (textStyle: ArticleTextStyle | null, zoom: number): CSSProperties => {
  if (!textStyle) {
    return {};
  }

  const { fontStyle, fontWeight } = splitFontStyle(textStyle.fontStyle);

  return {
    fontFamily: textStyle.fontFamily,
    fontSize: textStyle.fontSize * zoom,
    lineHeight: textStyle.lineHeight,
    color: textStyle.fill,
    // Matches a reversed banner or tinted chip's own fill so the overlay
    // reads as that same field, not a mismatched box dropped over it.
    backgroundColor: textStyle.backgroundColor || undefined,
    fontStyle,
    fontWeight,
    letterSpacing: textStyle.letterSpacing ? textStyle.letterSpacing * zoom : undefined,
    // A textarea can't ragged-justify text, so a justified block edits
    // left-aligned — the real justification returns once composition re-runs.
    textAlign: textStyle.align === "justify" ? "left" : (textStyle.align ?? "left"),
  };
};

export function InlineObjectTextEditor({
  objectType,
  bounds,
  textStyle,
  zoom,
  value,
  onChange,
  onSelectionChange,
  onCommit,
  onCancel,
}: InlineObjectTextEditorProps) {
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    const textarea = textareaRef.current;

    if (!textarea) {
      return;
    }

    // Focus without causing the page to scroll
    try {
      textarea.focus({ preventScroll: true });
    } catch (e) {
      // fallback for older browsers
      textarea.focus();
    }

    textarea.select();
  }, []);

  const updateSelection = () => {
    const textarea = textareaRef.current;

    if (!textarea) {
      return;
    }

    onSelectionChange(textarea.selectionStart, textarea.selectionEnd);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Escape") {
      event.preventDefault();
      onCancel();
      return;
    }

    if ((event.ctrlKey || event.metaKey) && event.key === "Enter") {
      event.preventDefault();
      onCommit();
    }
  };

  return (
    <textarea
      ref={textareaRef}
      className="inline-object-editor"
      aria-label={`Edit ${objectType}`}
      value={value}
      style={{
        left: bounds.x,
        top: bounds.y,
        width: Math.max(60, bounds.width),
        height: Math.max(24, bounds.height),
        ...getTypographyStyle(textStyle, zoom),
      }}
      spellCheck={false}
      onBlur={onCommit}
      onChange={(event) => onChange(event.target.value)}
      onKeyDown={handleKeyDown}
      onKeyUp={updateSelection}
      onMouseUp={updateSelection}
      onSelect={updateSelection}
    />
  );
}
