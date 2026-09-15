import type {
  NewspaperCharacterStyleSettings,
  NewspaperDocument,
  NewspaperFrameStyleSettings,
  NewspaperObjectStyleSettings,
  NewspaperParagraphStyleRole,
  NewspaperParagraphStyleSettings,
  NewspaperStyle,
  NewspaperStyleId,
  NewspaperStyleKind,
  NewspaperStyleLibrary,
  NewspaperStyleTheme,
} from "@/types/document";
import type {
  StyleCreateInput,
  StyleExportFormat,
  StyleFilter,
  StyleImportFormat,
  StyleManagerStatus,
  StyleMutationResult,
  StyleOverrideSummary,
  StylePackage,
  StyleUpdateInput,
} from "./StyleManagerTypes";
import { DEFAULT_BODY_JUSTIFY_ENGINE } from "@/engines/UniversalTypography/UniversalTypographyEngine";

const now = () => new Date().toISOString();

const createId = (prefix: string) =>
  `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

const createParagraphSettings = (
  role: NewspaperParagraphStyleRole,
  fontSize: number,
  weight: number,
  alignment: NewspaperParagraphStyleSettings["alignment"] = "left",
): NewspaperParagraphStyleSettings => ({
  role,
  fontFamily: role === "headline" ? "Noto Serif Devanagari" : "Noto Sans Devanagari",
  fontWeight: weight,
  fontSize,
  leading: fontSize,
  leadingMode: "auto",
  leadingValue: fontSize,
  tracking: 0,
  characterSpacing: 0,
  alignment,
  color: role === "caption" || role === "byline" || role === "source" ? "#4f4a42" : "#161412",
  spaceBefore: 0,
  spaceAfter: role === "headline" ? 2 : 3,
  indent: {
    left: 0,
    right: 0,
    firstLine: role === "body" ? 8 : 0,
  },
  tabs: [],
  dropCaps: {
    enabled: false,
    lines: 3,
    characters: 1,
  },
  rulesAbove: {},
  rulesBelow: {},
  background: "transparent",
  border: {},
  hyphenation: role === "body",
  justification: role === "body" ? DEFAULT_BODY_JUSTIFY_ENGINE : "browser",
  keepOptions: {},
  widowOrphan: {
    widowLines: 2,
    orphanLines: 2,
  },
  baseline: {
    align: true,
    gridSize: 12,
  },
});

const createCharacterSettings = (
  role: NewspaperCharacterStyleSettings["role"],
  overrides: NewspaperCharacterStyleSettings["overrides"],
): NewspaperCharacterStyleSettings => ({
  role,
  overrides,
});

const normalizeStyle = (item: NewspaperStyle): NewspaperStyle => {
  if (item.kind === "paragraph") {
    const settings = item.settings;
    const leadingValue = settings.leadingValue ?? settings.fontSize * (settings.leading || 1);

    return {
      ...item,
      settings: {
        ...settings,
        leading: settings.leading ?? settings.fontSize,
        leadingMode: settings.leadingMode ?? "auto",
        leadingValue,
        tracking: settings.tracking ?? 0,
        characterSpacing: settings.characterSpacing ?? 0,
      },
    };
  }

  if (item.kind === "character") {
    return {
      ...item,
      settings: {
        ...item.settings,
        overrides: {
          ...item.settings.overrides,
          characterSpacing: item.settings.overrides.characterSpacing ?? 0,
        },
      },
    };
  }

  return item;
};

const createObjectSettings = (role: NewspaperObjectStyleSettings["role"]): NewspaperObjectStyleSettings => ({
  role,
  border: { width: role === "advertisement-frame" ? 1 : 0, color: "#c8bfae" },
  padding: { top: 4, right: 4, bottom: 4, left: 4 },
  shadow: {},
  opacity: 1,
  cornerRadius: role === "advertisement-frame" ? 2 : 0,
  fill: role === "advertisement-frame" ? "#fff4cf" : "transparent",
  stroke: role === "advertisement-frame" ? "#ca8a04" : "transparent",
});

const createFrameSettings = (role: NewspaperFrameStyleSettings["role"]): NewspaperFrameStyleSettings => ({
  role,
  containerPadding: { top: 4, right: 4, bottom: 4, left: 4 },
  margins: { top: 0, right: 0, bottom: 0, left: 0 },
  background: "transparent",
  border: { width: 0, color: "transparent" },
  grid: {},
});

const style = <Style extends NewspaperStyle>(styleValue: Style): Style => styleValue;

export const createDefaultStyleLibrary = (): NewspaperStyleLibrary => {
  const createdAt = now();
  const styles: Record<NewspaperStyleId, NewspaperStyle> = {
    "paragraph-headline": style({
      id: "paragraph-headline",
      name: "Headline",
      kind: "paragraph",
      theme: "hindi",
      createdAt,
      updatedAt: createdAt,
      settings: createParagraphSettings("headline", 40, 900, "left"),
    }),
    "paragraph-subheadline": style({
      id: "paragraph-subheadline",
      name: "Subheadline",
      kind: "paragraph",
      theme: "hindi",
      createdAt,
      updatedAt: createdAt,
      settings: createParagraphSettings("subheadline", 16, 700, "left"),
    }),
    "paragraph-body": style({
      id: "paragraph-body",
      name: "Body",
      kind: "paragraph",
      theme: "hindi",
      createdAt,
      updatedAt: createdAt,
      settings: createParagraphSettings("body", 12, 400, "justify"),
    }),
    "paragraph-caption": style({
      id: "paragraph-caption",
      name: "Caption",
      kind: "paragraph",
      theme: "hindi",
      createdAt,
      updatedAt: createdAt,
      settings: createParagraphSettings("caption", 9, 500, "left"),
    }),
    "paragraph-byline": style({
      id: "paragraph-byline",
      name: "Byline",
      kind: "paragraph",
      theme: "hindi",
      createdAt,
      updatedAt: createdAt,
      settings: createParagraphSettings("byline", 9, 700, "left"),
    }),
    "paragraph-advertisement": style({
      id: "paragraph-advertisement",
      name: "Advertisement",
      kind: "paragraph",
      theme: "broadsheet",
      createdAt,
      updatedAt: createdAt,
      settings: createParagraphSettings("advertisement", 10, 700, "center"),
    }),
    "character-bold": style({
      id: "character-bold",
      name: "Bold",
      kind: "character",
      theme: "hindi",
      createdAt,
      updatedAt: createdAt,
      settings: createCharacterSettings("bold", { fontWeight: 800 }),
    }),
    "character-highlight": style({
      id: "character-highlight",
      name: "Highlight",
      kind: "character",
      theme: "hindi",
      createdAt,
      updatedAt: createdAt,
      settings: createCharacterSettings("highlight", { backgroundColor: "#fff1a8" }),
    }),
    "object-image-frame": style({
      id: "object-image-frame",
      name: "Image Frame",
      kind: "object",
      theme: "broadsheet",
      createdAt,
      updatedAt: createdAt,
      settings: createObjectSettings("image-frame"),
    }),
    "object-advertisement-frame": style({
      id: "object-advertisement-frame",
      name: "Advertisement Frame",
      kind: "object",
      theme: "broadsheet",
      createdAt,
      updatedAt: createdAt,
      settings: createObjectSettings("advertisement-frame"),
    }),
    "frame-body": style({
      id: "frame-body",
      name: "Body Frame",
      kind: "frame",
      theme: "broadsheet",
      createdAt,
      updatedAt: createdAt,
      settings: createFrameSettings("body-frame"),
    }),
    "frame-caption": style({
      id: "frame-caption",
      name: "Caption Frame",
      kind: "frame",
      theme: "broadsheet",
      createdAt,
      updatedAt: createdAt,
      settings: createFrameSettings("caption-frame"),
    }),
    "table-classic": style({
      id: "table-classic",
      name: "Classic Table",
      kind: "table",
      theme: "broadsheet",
      createdAt,
      updatedAt: createdAt,
      settings: {
        headerFill: "#eee7d8",
        bodyFill: "#fffdf8",
        border: { width: 1, color: "#b9ad9d" },
        alternateRows: true,
      },
    }),
    "cell-classic": style({
      id: "cell-classic",
      name: "Classic Cell",
      kind: "cell",
      theme: "broadsheet",
      createdAt,
      updatedAt: createdAt,
      settings: {
        padding: { top: 3, right: 4, bottom: 3, left: 4 },
        fill: "transparent",
        border: { width: 0, color: "transparent" },
        alignment: "left",
      },
    }),
  };

  return {
    styles,
    assignments: {
      headline: "paragraph-headline",
      subheadline: "paragraph-subheadline",
      body: "paragraph-body",
      caption: "paragraph-caption",
      byline: "paragraph-byline",
      "advertisement-frame": "object-advertisement-frame",
      "image-frame": "object-image-frame",
    },
    overrides: {},
    activeTheme: "hindi",
  };
};

export const normalizeStyleLibrary = (styles: unknown): NewspaperStyleLibrary => {
  const defaults = createDefaultStyleLibrary();

  if (!styles || typeof styles !== "object") {
    return defaults;
  }

  const candidate = styles as Partial<NewspaperStyleLibrary> & Record<string, unknown>;
  const rawStyles = candidate.styles && typeof candidate.styles === "object" ? candidate.styles : candidate;
  const normalizedStyles = Object.values(rawStyles as Record<string, unknown>)
    .filter((item): item is NewspaperStyle => Boolean(item && typeof item === "object" && "id" in item && "kind" in item))
    .reduce<Record<NewspaperStyleId, NewspaperStyle>>((acc, item) => {
      acc[item.id] = normalizeStyle({
        ...item,
        updatedAt: item.updatedAt ?? item.createdAt ?? now(),
      } as NewspaperStyle);
      return acc;
    }, {});

  return {
    styles: {
      ...defaults.styles,
      ...normalizedStyles,
    },
    assignments: {
      ...defaults.assignments,
      ...(candidate.assignments ?? {}),
    },
    overrides: {
      ...(candidate.overrides ?? {}),
    },
    activeTheme: candidate.activeTheme ?? defaults.activeTheme,
  };
};

export const ensureStyleLibrary = (document: NewspaperDocument): NewspaperDocument => ({
  ...document,
  styles: normalizeStyleLibrary(document.styles),
});

const applyStyleToFrame = (document: NewspaperDocument, targetId: string, style: NewspaperStyle): NewspaperDocument => {
  const frame = document.frames[targetId];

  if (!frame) {
    return document;
  }

  if (style.kind === "object") {
    return {
      ...document,
      frames: {
        ...document.frames,
        [targetId]: {
          ...frame,
          frameStyle: {
            ...frame.frameStyle,
            ...style.settings,
          },
          metadata: {
            ...frame.metadata,
            styleId: style.id,
            updatedAt: now(),
          },
        },
      },
    };
  }

  if (style.kind === "frame") {
    return {
      ...document,
      frames: {
        ...document.frames,
        [targetId]: {
          ...frame,
          containerStyle: {
            ...frame.containerStyle,
            ...style.settings,
          },
          metadata: {
            ...frame.metadata,
            styleId: style.id,
            updatedAt: now(),
          },
        },
      },
    };
  }

  return document;
};

const propagateStyleToAssignedFrames = (
  document: NewspaperDocument,
  library: NewspaperStyleLibrary,
  styleId: NewspaperStyleId,
): NewspaperDocument => {
  const style = library.styles[styleId];

  if (!style) {
    return document;
  }

  return Object.entries(library.assignments)
    .filter(([, assignedStyleId]) => assignedStyleId === styleId)
    .reduce((nextDocument, [targetId]) => applyStyleToFrame(nextDocument, targetId, style), document);
};

export const listStyles = (document: NewspaperDocument, filter: StyleFilter): NewspaperStyle[] => {
  const library = normalizeStyleLibrary(document.styles);
  const query = filter.query.trim().toLowerCase();

  return Object.values(library.styles)
    .filter((candidate) => filter.kind === "all" || candidate.kind === filter.kind)
    .filter((candidate) => filter.theme === "all" || candidate.theme === filter.theme)
    .filter((candidate) => !query || candidate.name.toLowerCase().includes(query) || candidate.kind.includes(query))
    .sort((a, b) => a.kind.localeCompare(b.kind) || a.name.localeCompare(b.name));
};

const createBlankStyle = ({ name, kind, theme = "hindi" }: StyleCreateInput): NewspaperStyle => {
  const id = createId(`style-${kind}`);
  const base = {
    id,
    name,
    kind,
    theme,
    createdAt: now(),
    updatedAt: now(),
  };

  if (kind === "paragraph") {
    return { ...base, kind, settings: createParagraphSettings("body", 12, 400, "left") };
  }
  if (kind === "character") {
    return { ...base, kind, settings: createCharacterSettings("custom", {}) };
  }
  if (kind === "object") {
    return { ...base, kind, settings: createObjectSettings("custom") };
  }
  if (kind === "frame") {
    return { ...base, kind, settings: createFrameSettings("custom") };
  }
  if (kind === "table") {
    return { ...base, kind, settings: { headerFill: "#eee7d8", bodyFill: "#fffdf8", border: {}, alternateRows: false } };
  }

  return { ...base, kind, settings: { padding: {}, fill: "transparent", border: {}, alignment: "left" } };
};

export const createStyle = (document: NewspaperDocument, input: StyleCreateInput): NewspaperDocument => {
  const library = normalizeStyleLibrary(document.styles);
  const newStyle = createBlankStyle(input);

  return {
    ...document,
    styles: {
      ...library,
      styles: {
        ...library.styles,
        [newStyle.id]: newStyle,
      },
    },
  };
};

export const duplicateStyle = (document: NewspaperDocument, styleId: NewspaperStyleId): NewspaperDocument => {
  const library = normalizeStyleLibrary(document.styles);
  const source = library.styles[styleId];

  if (!source) {
    return document;
  }

  const id = createId(`style-${source.kind}`);
  const copy = {
    ...source,
    id,
    name: `${source.name} Copy`,
    basedOnId: source.id,
    createdAt: now(),
    updatedAt: now(),
  } as NewspaperStyle;

  return {
    ...document,
    styles: {
      ...library,
      styles: {
        ...library.styles,
        [id]: copy,
      },
    },
  };
};

export const renameStyle = (
  document: NewspaperDocument,
  styleId: NewspaperStyleId,
  name: string,
): NewspaperDocument => updateStyle(document, styleId, { name });

export const updateStyle = (
  document: NewspaperDocument,
  styleId: NewspaperStyleId,
  patch: StyleUpdateInput,
): NewspaperDocument => {
  const library = normalizeStyleLibrary(document.styles);
  const existing = library.styles[styleId];

  if (!existing) {
    return document;
  }

  const nextLibrary: NewspaperStyleLibrary = {
    ...library,
    styles: {
      ...library.styles,
      [styleId]: {
        ...existing,
        ...patch,
        id: existing.id,
        kind: existing.kind,
        settings: patch.settings ? { ...existing.settings, ...patch.settings } as NewspaperStyle["settings"] : existing.settings,
        updatedAt: now(),
      } as NewspaperStyle,
    },
  };

  return propagateStyleToAssignedFrames({
    ...document,
    styles: nextLibrary,
  }, nextLibrary, styleId);
};

export const deleteStyle = (document: NewspaperDocument, styleId: NewspaperStyleId): NewspaperDocument => {
  const library = normalizeStyleLibrary(document.styles);
  const { [styleId]: _deleted, ...styles } = library.styles;

  return {
    ...document,
    styles: {
      ...library,
      styles,
      assignments: Object.fromEntries(
        Object.entries(library.assignments).filter(([, assignedStyleId]) => assignedStyleId !== styleId),
      ),
      overrides: Object.fromEntries(
        Object.entries(library.overrides).filter(([targetId]) => library.assignments[targetId] !== styleId),
      ),
    },
  };
};

export const applyStyle = (
  document: NewspaperDocument,
  targetId: string,
  styleId: NewspaperStyleId,
): StyleMutationResult => {
  const library = normalizeStyleLibrary(document.styles);

  if (!library.styles[styleId]) {
    return { document, affectedTargets: [] };
  }

  const nextDocument = applyStyleToFrame({
      ...document,
      styles: {
        ...library,
        assignments: {
          ...library.assignments,
          [targetId]: styleId,
        },
        overrides: {
          ...library.overrides,
          [targetId]: false,
        },
      },
    },
    targetId,
    library.styles[styleId],
  );

  return {
    document: nextDocument,
    affectedTargets: [targetId],
  };
};

export const clearStyleOverrides = (document: NewspaperDocument, targetId: string): NewspaperDocument => {
  const library = normalizeStyleLibrary(document.styles);

  return {
    ...document,
    styles: {
      ...library,
      overrides: {
        ...library.overrides,
        [targetId]: false,
      },
    },
  };
};

export const markStyleOverride = (document: NewspaperDocument, targetId: string): NewspaperDocument => {
  const library = normalizeStyleLibrary(document.styles);

  return {
    ...document,
    styles: {
      ...library,
      overrides: {
        ...library.overrides,
        [targetId]: true,
      },
    },
  };
};

export const redefineStyleFromTarget = (
  document: NewspaperDocument,
  targetId: string,
  settings: NewspaperStyle["settings"],
): NewspaperDocument => {
  const library = normalizeStyleLibrary(document.styles);
  const styleId = library.assignments[targetId];

  if (!styleId) {
    return document;
  }

  return clearStyleOverrides(updateStyle(document, styleId, { settings }), targetId);
};

export const getStyleOverrideSummary = (document: NewspaperDocument): StyleOverrideSummary => {
  const library = normalizeStyleLibrary(document.styles);
  const overriddenTargets = Object.entries(library.overrides)
    .filter(([, overridden]) => overridden)
    .map(([targetId]) => targetId);

  return {
    totalAssignments: Object.keys(library.assignments).length,
    overrideCount: overriddenTargets.length,
    overriddenTargets,
  };
};

export const getStyleManagerStatus = (document: NewspaperDocument): StyleManagerStatus => {
  const library = normalizeStyleLibrary(document.styles);
  const styles = Object.values(library.styles);
  const count = (kind: NewspaperStyleKind) => styles.filter((candidate) => candidate.kind === kind).length;

  return {
    total: styles.length,
    paragraph: count("paragraph"),
    character: count("character"),
    object: count("object"),
    frame: count("frame"),
    table: count("table"),
    cell: count("cell"),
    assignments: Object.keys(library.assignments).length,
    overrides: Object.values(library.overrides).filter(Boolean).length,
  };
};

export const exportStyles = (document: NewspaperDocument, format: StyleExportFormat): string => {
  const library = normalizeStyleLibrary(document.styles);
  const stylePackage: StylePackage = {
    name: `${document.publication} Styles`,
    theme: library.activeTheme,
    library,
  };

  if (format === "json" || format === "package") {
    return JSON.stringify(stylePackage, null, 2);
  }
  if (format === "xml") {
    return `<stylePackage name="${stylePackage.name}" theme="${stylePackage.theme}">${Object.values(library.styles)
      .map((candidate) => `<style id="${candidate.id}" kind="${candidate.kind}" name="${candidate.name}" />`)
      .join("")}</stylePackage>`;
  }

  return [
    `name: ${stylePackage.name}`,
    `theme: ${stylePackage.theme}`,
    "styles:",
    ...Object.values(library.styles).map((candidate) => `  - ${candidate.kind}: ${candidate.name} (${candidate.id})`),
  ].join("\n");
};

export const importStyles = (
  document: NewspaperDocument,
  source: string,
  format: StyleImportFormat,
): NewspaperDocument => {
  if (format !== "json" && format !== "package") {
    return document;
  }

  try {
    const parsed = JSON.parse(source) as Partial<StylePackage> | NewspaperStyleLibrary;
    const importedLibrary = normalizeStyleLibrary("library" in parsed ? parsed.library : parsed);
    const library = normalizeStyleLibrary(document.styles);

    return {
      ...document,
      styles: {
        ...library,
        styles: {
          ...library.styles,
          ...importedLibrary.styles,
        },
        assignments: {
          ...library.assignments,
          ...importedLibrary.assignments,
        },
      },
    };
  } catch {
    return document;
  }
};
