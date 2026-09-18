#!/bin/bash
# PageMint — NMS typography verifier (runs on the VPS, host side).
#
#   bash scripts/verify-nms-typography.sh <base-url> <bundle.json> [templateId ...]
#
# 1) static guards: allowlist, no wizard-visible recipe access on shared paths, wizard typography
#    functions byte-identical to the wizard baseline tag (default: wizard-baseline = 02c3679, the
#    15 Sep wizard; override with WIZARD_BASELINE_REF) except the documented getNmsExportRecipe() gates
# 2) posts <bundle.json> once per template (recipe values from the NMS repo's golden set injected),
#    waits for the PDF, asserts the export debug (fonts loaded / no fallbacks / palette / template)
# 3) contact sheet + optional pixel diff against scripts/nms-verify/golden/<templateId>.png
#
# Exit 0 = every check passed. Never posts to NMS: callback URLs are blanked.
# Docs: docs/NMS_PAGEMINT_PDF_RUNBOOK.md §5
set -u
BASE="${1:-http://127.0.0.1:3003}"; BUNDLE="${2:-}"; shift 2 2>/dev/null || true
TEMPLATES=("$@"); [ ${#TEMPLATES[@]} -eq 0 ] && TEMPLATES=(CliffFrontEditorRail8A CliffFront8A)
REPO="$(cd "$(dirname "$0")/.." && pwd)"
OUT="$REPO/verify-out/$(date -u +%Y%m%d-%H%M%S)"; mkdir -p "$OUT"
FAIL=0; pass() { echo "  PASS  $*"; }; fail() { echo "  FAIL  $*"; FAIL=1; }

echo "== 1. static guards ($REPO) =="
grep -q 'export const ALLOWED_NMS_PAGEMINT_IDS = new Set(\["cliffdemo3"\]);' "$REPO/src/lib/nms/nmsBundleTypes.ts" \
  && pass "allowlist is exactly cliffdemo3" || fail "ALLOWED_NMS_PAGEMINT_IDS changed"
if grep -rn "getActivePageMintRecipe()" "$REPO/src" --include=*.ts --include=*.tsx | grep -v "cliffDemo3ManualRecipe.ts\|NmsHeadlessExportBridge\|Tests" >/dev/null; then
  fail "getActivePageMintRecipe() used on a shared path (must be getNmsExportRecipe())"; else pass "no wizard-visible recipe access on shared paths"; fi
grep -q 'bodyJustifyEngineMode: language === "english" && options?.professionalJustification' "$REPO/src/store/editorStore.ts" \
  && pass "editorStore justification rule = HEAD (Hindi -> browser engine)" || fail "editorStore justification rule differs from HEAD"
grep -q 'quoteFontFamily(fontFamily)}' "$REPO/src/engines/TypographyEngine/TextMeasure.ts" \
  && pass "TextMeasure measures with the full font stack (HEAD)" || fail "TextMeasure measures with a different font than it paints"
BASELINE="${WIZARD_BASELINE_REF:-wizard-baseline}"
if ! git -C "$REPO" rev-parse --git-dir >/dev/null 2>&1; then
  echo "  skip  wizard baseline comparison (not a git checkout)"
elif ! git -C "$REPO" rev-parse --verify --quiet "$BASELINE^{commit}" >/dev/null; then
  fail "wizard baseline ref '$BASELINE' not found (run: git fetch origin --tags)"
else
  fnblock() { awk "/^$2/,/^$3\$/" "$1"; }
  headblock() { git -C "$REPO" show "$BASELINE:$1" | awk "/^$2/,/^$3\$/"; }
  d=$(diff <(headblock src/engines/FontManager/FontManagerEngine.ts 'const headlineDisplayFonts' '\];') <(fnblock "$REPO/src/engines/FontManager/FontManagerEngine.ts" 'const headlineDisplayFonts' '\];') | grep -c '^[<>]')
  [ "$d" = "0" ] && pass "headlineDisplayFonts identical to $BASELINE" || fail "headlineDisplayFonts differs from $BASELINE ($d lines)"
  extra=$(diff <(headblock src/engines/FontManager/FontManagerEngine.ts 'export const selectNewspaperHeadlineFont' '};') <(fnblock "$REPO/src/engines/FontManager/FontManagerEngine.ts" 'export const selectNewspaperHeadlineFont' '};') | grep '^[<>]' | grep -v 'getNmsExportRecipe\|recipePick\|NMS export only\|role from the recipe\|rotation below\|^> *}$\|^> *$' | wc -l)
  [ "$extra" = "0" ] && pass "selectNewspaperHeadlineFont = $BASELINE + NMS gate only" || fail "selectNewspaperHeadlineFont has non-gate differences ($extra lines)"
  extra=$(diff <(headblock src/engines/ArticleComposer/composeArticleBox.ts 'const fillHeadlineLineEdges' '};') <(fnblock "$REPO/src/engines/ArticleComposer/composeArticleBox.ts" 'const fillHeadlineLineEdges' '};') | grep '^[<>]' | grep -v 'getNmsExportRecipe\|NMS export only\|committed fill\|return block;\|^> *}$\|^> *$' | wc -l)
  [ "$extra" = "0" ] && pass "fillHeadlineLineEdges = $BASELINE + NMS gate only" || fail "fillHeadlineLineEdges has non-gate differences ($extra lines)"
fi

[ -z "$BUNDLE" ] && { echo "no bundle given; static guards only"; exit $FAIL; }
[ -f "$BUNDLE" ] || { fail "bundle not found: $BUNDLE"; exit 1; }

echo "== 2. render sweep on $BASE =="
KEY=$(docker inspect newspaper_generator --format '{{range .Config.Env}}{{println .}}{{end}}' 2>/dev/null | grep '^NMS_BUNDLE_API_KEY=\|^NEWSPAPER_GENERATOR_API_KEY=' | head -1 | cut -d= -f2-)
AUTH=(); [ -n "$KEY" ] && AUTH=(-H "x-api-key: $KEY")
if curl -s -o /dev/null "$BASE/" ; then :; else fail "cannot reach $BASE"; exit 1; fi
PDFDIR=$(docker inspect newspaper_generator --format '{{range .Mounts}}{{if eq .Destination "/app/data/nms-generated-pdfs"}}{{.Source}}{{end}}{{end}}' 2>/dev/null)
case "$BASE" in *3003*) PDFDIR=/tmp/pagemint-sandbox-data/nms-generated-pdfs;; esac
[ -d "$PDFDIR" ] || PDFDIR="$REPO/data/nms-generated-pdfs"
echo "  pdf dir: $PDFDIR"
TS=$(date +%s)
for T in "${TEMPLATES[@]}"; do
  JOB="VERIFY-$T-$TS"
  python3 - "$BUNDLE" "$T" "$JOB" "$OUT/bundle-$T.json" <<'EOF'
import json, sys
src, tpl, job, out = sys.argv[1:5]
b = json.load(open(src, encoding="utf-8"))
b["job_id"] = job; b["bundle_id"] = job; b["layout"] = tpl; b["frontPageLayout"] = tpl
for k in ("callback", "pdfCallback"):
    v = b.get(k)
    if isinstance(v, dict):
        for kk in list(v):
            if "url" in kk.lower(): v[kk] = ""
    elif isinstance(v, str): b[k] = ""
r = b.setdefault("pageMintRecipe", {"schemaVersion": "verify"})
r.setdefault("schemaVersion", "verify")
noto = {"family": "Cliff Noto Sans Devanagari", "weight": "700"}
r["fonts"] = {**r.get("fonts", {}), "primaryOnlyNoStackFallback": False,
              "headlineByPriority": {k: dict(noto) for k in ("lead", "major", "secondary", "brief", "filler")},
              "body": {"hindi": "Cliff Noto Sans Devanagari", "english": "Tinos"}}
r["typographyFit"] = {**r.get("typographyFit", {}), "stretchDisplayHeadlines": True}
r["importOptions"] = {**r.get("importOptions", {}), "paletteMode": "classic_fixed", "subheadingBandOpacity": 1, "bylineSource": "newspaper_name"}
r["subheads"] = {**r.get("subheads", {}), "bandBackgroundOpacity": 1, "useManualBatchPaletteRotation": False, "maxSubheadingsPerStory": 3}
json.dump(b, open(out, "w", encoding="utf-8"), ensure_ascii=False)
EOF
  resp=$(curl -s "${AUTH[@]}" -H "Content-Type: application/json" --data-binary @"$OUT/bundle-$T.json" "$BASE/api/nms-bundle")
  echo "$resp" | grep -q '"queuedPdf":true' && pass "$T: bundle accepted and queued" || { fail "$T: not queued: ${resp:0:160}"; continue; }
  for i in $(seq 1 72); do ls "$PDFDIR" 2>/dev/null | grep -q "$JOB.*\.pdf$" && break; sleep 5; done
  PDF=$(ls "$PDFDIR"/*"$JOB"*.pdf 2>/dev/null | head -1)
  [ -n "$PDF" ] || { fail "$T: no PDF after 6 minutes"; continue; }
  python3 - "$PDF" "$T" <<'EOF' && pass "$T: export debug ok" || fail "$T: export debug assertions failed"
import json, sys
pdf, tpl = sys.argv[1:3]
d = json.load(open(pdf + ".json")); dbg = d["exportDebug"]; ok = True
def chk(c, m):
    global ok
    print(("      ok    " if c else "      BAD   ") + m); ok = ok and c
chk(dbg["fonts"]["status"] == "loaded" and dbg["fonts"]["fallbacks"] == [], f"fonts {dbg['fonts']}")
p = dbg["cliffdemo3Palettes"][0]
chk(p["paletteId"] == "classic" and float(p["subheadingStyle"]["backgroundOpacity"]) == 1.0, f"palette {p['paletteId']} @ {p['subheadingStyle']['backgroundOpacity']}")
chk(dbg.get("cliffdemo3PaletteSource") == "recipe-classic-fixed", f"paletteSource {dbg.get('cliffdemo3PaletteSource')}")
chk(dbg["editionPlan"][0]["templateId"] == tpl, f"template {dbg['editionPlan'][0]['templateId']}")
chk(int(d["pageCount"]) >= 1, f"pages {d['pageCount']}")
sys.exit(0 if ok else 1)
EOF
  nfonts=$(pdffonts "$PDF" 2>/dev/null | tail -n +3 | wc -l); [ "$nfonts" = "0" ] && pass "$T: PDF is a flat image (0 embedded fonts)" || fail "$T: PDF embeds $nfonts fonts"
  pdftoppm -r 100 -f 1 -l 1 -png "$PDF" "$OUT/$T" 2>/dev/null
  G="$REPO/scripts/nms-verify/golden/$T.png"
  if [ -f "$G" ]; then
    python3 - "$OUT/$T-1.png" "$G" <<'EOF' && pass "$T: matches golden" || fail "$T: differs from golden"
import sys
from PIL import Image, ImageChops
a = Image.open(sys.argv[1]).convert("RGB"); g = Image.open(sys.argv[2]).convert("RGB")
if a.size != g.size: g = g.resize(a.size)
m = ImageChops.difference(a, g).convert("L").point(lambda v: 255 if v > 24 else 0); h = m.histogram()
pct = 100.0 * h[255] / (m.size[0] * m.size[1]); print(f"      diff vs golden: {pct:.4f}%"); sys.exit(0 if pct <= 0.5 else 1)
EOF
  else echo "      (no golden for $T; to create one: cp $OUT/$T-1.png scripts/nms-verify/golden/$T.png)"; fi
done
python3 - "$OUT" "${TEMPLATES[@]}" <<'EOF'
import sys, os
from PIL import Image, ImageDraw
out = sys.argv[1]; names = [t for t in sys.argv[2:] if os.path.exists(f"{out}/{t}-1.png")]
if names:
    ims = [Image.open(f"{out}/{t}-1.png").convert("RGB") for t in names]; w, h = ims[0].size
    sheet = Image.new("RGB", ((w + 20) * len(ims), h + 30), "white"); d = ImageDraw.Draw(sheet)
    for i, (im, t) in enumerate(zip(ims, names)): sheet.paste(im.resize((w, h)), (i * (w + 20), 30)); d.text((i * (w + 20) + 6, 8), t, fill="black")
    sheet.save(f"{out}/sheet.png"); print(f"  contact sheet: {out}/sheet.png")
EOF
echo; [ $FAIL = 0 ] && echo "RESULT: ALL CHECKS PASSED" || echo "RESULT: FAILURES (see FAIL lines)"
exit $FAIL
