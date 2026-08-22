export interface RichTextSpan {
  text: string;
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  color?: string;
  backgroundColor?: string;
  opacity?: number;
  fontSize?: number;
  fontWeight?: number;
  characterSpacing?: number;
  horizontalScale?: number;
  verticalScale?: number;
  superscript?: boolean;
  subscript?: boolean;
  smallCaps?: boolean;
  openTypeFeatures?: string[];
}

export interface RichTextDocument {
  spans: RichTextSpan[];
}

export type RichTextContent = string | RichTextDocument;

export type RichTextStyle = Omit<RichTextSpan, "text">;
