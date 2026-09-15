import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { NEWSPAPER_FONT_DEFINITIONS } from "@/engines/FontManager/FontManagerEngine";

const extraHeadlessFontSources = ["/fonts/Tinos-Regular.ttf", "/fonts/Tinos-Bold.ttf"];

export const getNmsHeadlessFontSources = () => [
  ...NEWSPAPER_FONT_DEFINITIONS.map((font) => font.source),
  ...extraHeadlessFontSources,
];

export const resolveNmsFontDiskPath = (source: string) => {
  const relative = source.replace(/^\/+/, "");
  const candidates = [
    path.join(process.cwd(), "public", relative),
    path.join(process.cwd(), relative),
  ];
  return candidates.find((candidate) => existsSync(candidate)) ?? null;
};

export const readNmsFontFileAsBase64 = async (source: string) => {
  const disk = resolveNmsFontDiskPath(source);
  if (!disk) return "";
  return (await readFile(disk)).toString("base64");
};
