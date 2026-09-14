import { NextResponse } from "next/server";
import { buildReferenceLayoutPrototypePdf } from "@/lib/referenceLayoutPrototype/buildPrototypePdf";
import { buildReferenceLayoutPrototype, validatePrototypeLayout } from "@/lib/referenceLayoutPrototype/geometry";

export const runtime = "nodejs";

export async function GET() {
  const layout = buildReferenceLayoutPrototype();
  const issues = validatePrototypeLayout(layout);
  if (issues.length > 0) {
    return NextResponse.json({ ok: false, issues }, { status: 500 });
  }
  const bytes = await buildReferenceLayoutPrototypePdf(layout);
  return new NextResponse(Buffer.from(bytes), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": "attachment; filename=reference-layout-prototype.pdf",
      "Cache-Control": "no-store",
    },
  });
}
