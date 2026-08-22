import type {
  NewspaperDocument,
  NewspaperStyle,
  NewspaperStyleId,
  NewspaperStyleKind,
  NewspaperStyleLibrary,
  NewspaperStyleTheme,
} from "@/types/document";

export type StyleFilter = {
  query: string;
  kind: NewspaperStyleKind | "all";
  theme: NewspaperStyleTheme | "all";
};

export type StyleImportFormat = "json" | "yaml" | "xml" | "package";

export type StyleExportFormat = StyleImportFormat;

export type StyleOverrideSummary = {
  totalAssignments: number;
  overrideCount: number;
  overriddenTargets: string[];
};

export type StyleManagerStatus = {
  total: number;
  paragraph: number;
  character: number;
  object: number;
  frame: number;
  table: number;
  cell: number;
  assignments: number;
  overrides: number;
};

export type StyleMutationResult = {
  document: NewspaperDocument;
  affectedTargets: string[];
};

export type StylePackage = {
  name: string;
  theme: NewspaperStyleTheme;
  library: NewspaperStyleLibrary;
};

export type StyleCreateInput = {
  name: string;
  kind: NewspaperStyleKind;
  theme?: NewspaperStyleTheme;
};

export type StyleUpdateInput = Partial<Omit<NewspaperStyle, "id" | "kind">> & {
  settings?: NewspaperStyle["settings"];
};

export type StyleApplicationTarget = {
  targetId: string;
  styleId: NewspaperStyleId;
};
