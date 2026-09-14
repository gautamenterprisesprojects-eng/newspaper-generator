import { writeFile } from "node:fs/promises";
import path from "node:path";
import { buildReferenceLayoutPrototypePdf } from "./buildPrototypePdf";
import { buildReferenceLayoutPrototype } from "./geometry";

const outPath = path.resolve(process.cwd(), "tmp_pdf_analysis", "reference-layout-prototype.pdf");

const main = async () => {
  const layout = buildReferenceLayoutPrototype();
  const bytes = await buildReferenceLayoutPrototypePdf(layout);
  await writeFile(outPath, bytes);
  console.log(`wrote ${bytes.byteLength} bytes to ${outPath}`);
};

void main();
