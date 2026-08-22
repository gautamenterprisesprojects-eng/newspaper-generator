param(
  [string]$OutputDir = "artifacts/body-renderer-validation"
)

$ErrorActionPreference = "Stop"

$repoRoot = (Resolve-Path (Join-Path $PSScriptRoot "..")).Path
$outputPath = Join-Path $repoRoot $OutputDir
New-Item -ItemType Directory -Force -Path $outputPath | Out-Null

$chrome = @(
  "C:\Program Files\Google\Chrome\Application\chrome.exe",
  "C:\Program Files (x86)\Google\Chrome\Application\chrome.exe"
) | Where-Object { Test-Path $_ } | Select-Object -First 1

if (-not $chrome) {
  throw "Chrome was not found. Install Chrome or update the path list in this validation script."
}

$konvaPath = (Resolve-Path (Join-Path $repoRoot "node_modules/konva/konva.min.js")).Path.Replace("\", "/")
$fontPath = Resolve-Path (Join-Path $repoRoot "public/fonts/NotoSansDevanagari-Regular.ttf")
$fontData = [Convert]::ToBase64String([System.IO.File]::ReadAllBytes($fontPath))
$textFixturePath = Resolve-Path (Join-Path $repoRoot "tools/body-renderer-validation-text.json")
$textFixture = Get-Content -LiteralPath $textFixturePath -Raw -Encoding UTF8
$htmlPath = Join-Path $outputPath "body-renderer-validation.html"
$screenshotPath = Join-Path $outputPath "body-renderer-validation.png"
$dumpPath = Join-Path $outputPath "body-renderer-validation-dump.html"
$reportPath = Join-Path $outputPath "body-renderer-validation-report.json"

$html = @'
<!doctype html>
<html lang="hi">
<head>
<meta charset="utf-8" />
<title>Body Renderer Validation</title>
<style>
@font-face {
  font-family: "Cliff Noto Sans Devanagari";
  src: url("__FONT_DATA__") format("truetype");
  font-weight: 400;
  font-style: normal;
  font-display: block;
}
html, body {
  margin: 0;
  padding: 0;
  background: #ffffff;
  color: #101010;
  font-family: "Cliff Noto Sans Devanagari", sans-serif;
}
body { padding: 18px; }
.row { display: flex; gap: 18px; align-items: flex-start; }
.panel { border: 1px solid #d7d7d7; padding: 8px; background: #fff; }
.label { font: 12px Arial, sans-serif; margin-bottom: 6px; color: #333; }
#native {
  width: 330px;
  min-height: 430px;
  font-family: "Cliff Noto Sans Devanagari", sans-serif;
  font-size: 19px;
  line-height: 1.18;
  font-weight: 400;
  font-style: normal;
  text-align: justify;
  text-justify: inter-word;
  hyphens: auto;
  word-break: normal;
  overflow-wrap: normal;
  white-space: normal;
  letter-spacing: 0;
}
pre { white-space: pre-wrap; font: 12px Consolas, monospace; margin-top: 18px; }
</style>
<script src="file:///__KONVA_PATH__"></script>
</head>
<body>
<div class="row">
  <div class="panel"><div class="label">A Legacy segmented renderer</div><div id="segmented"></div></div>
  <div class="panel"><div class="label">B Hybrid line renderer</div><div id="line"></div></div>
  <div class="panel"><div class="label">C Native HTML reference</div><div id="native"></div></div>
</div>
<pre id="report">waiting</pre>
<script>
const validationText = __TEXT_FIXTURE__;
const paragraphs = validationText.paragraphs;
const paragraph = paragraphs.join(" ");
const width = 330;
const height = 430;
const fontFamily = "Cliff Noto Sans Devanagari";
const fontSize = 19;
const lineHeightRatio = 1.18;
const lineHeightPx = fontSize * lineHeightRatio;
const fontWeight = "400";
const fontStyle = "normal";
const fontString = `${fontStyle} ${fontWeight} ${fontSize}px "${fontFamily}"`;
const measureCanvas = document.createElement("canvas");
const measureContext = measureCanvas.getContext("2d");
measureContext.font = fontString;

function measure(text) {
  measureContext.font = fontString;
  return measureContext.measureText(text).width;
}

function tokenize(text) {
  return text.trim().replace(/\s+/gu, " ").split(" ").filter(Boolean);
}

function codePoints(text) {
  return Array.from(text).map((ch) => `U+${ch.codePointAt(0).toString(16).toUpperCase().padStart(4, "0")}`);
}

function graphemes(text) {
  try {
    return Array.from(new Intl.Segmenter("hi", { granularity: "grapheme" }).segment(text), (item) => item.segment);
  } catch {
    return Array.from(text);
  }
}

function compose(words, targetWidth) {
  const normalGap = measure(" ");
  const rawLines = [];
  let current = [];

  for (const word of words) {
    const candidate = current.concat(word);
    const candidateWidth =
      candidate.reduce((sum, candidateWord) => sum + measure(candidateWord), 0) +
      normalGap * Math.max(0, candidate.length - 1);

    if (current.length > 0 && candidateWidth > targetWidth) {
      rawLines.push(current);
      current = [word];
    } else {
      current = candidate;
    }
  }

  if (current.length > 0) {
    rawLines.push(current);
  }

  return rawLines.map((lineWords, lineIndex) => {
    const wordWidths = lineWords.map(measure);
    const isLast = lineIndex === rawLines.length - 1;
    const wordTotal = wordWidths.reduce((sum, wordWidth) => sum + wordWidth, 0);
    const normalWidth = wordTotal + normalGap * Math.max(0, lineWords.length - 1);
    const gap = !isLast && lineWords.length > 1 ? (targetWidth - wordTotal) / (lineWords.length - 1) : normalGap;
    let cursor = 0;
    const words = lineWords.map((text, wordIndex) => {
      const x = cursor;
      const naturalWidth = wordWidths[wordIndex];
      const gapAfter = wordIndex < lineWords.length - 1 ? gap : 0;
      cursor += naturalWidth + gapAfter;
      return {
        text,
        x,
        width: naturalWidth,
        gapAfter,
        advance: naturalWidth + gapAfter,
        codePoints: codePoints(text),
        graphemes: graphemes(text),
      };
    });

    const line = {
      index: lineIndex,
      text: lineWords.join(" "),
      y: lineIndex * lineHeightPx,
      width: targetWidth,
      normalWidth,
      renderedWidth: cursor,
      gap,
      justified: !isLast,
      words,
    };

    return line;
  });
}

function createStage(containerId, mode, lines) {
  const startedAt = performance.now();
  const stage = new Konva.Stage({ container: containerId, width, height });
  const layer = new Konva.Layer();
  const story = new Konva.Group({ name: "Story Group" });
  const article = new Konva.Group({ name: "Article Group" });
  const frame = new Konva.Group({ name: "Frame Group" });
  const body = new Konva.Group({ name: "Body Group" });
  stage.add(layer);
  layer.add(story);
  story.add(article);
  article.add(frame);
  frame.add(body);

  if (mode === "segmented") {
    for (const line of lines) {
      for (let wordIndex = 0; wordIndex < line.words.length; wordIndex += 1) {
        const word = line.words[wordIndex];
        body.add(
          new Konva.Text({
            name: `word-${line.index}-${wordIndex}`,
            x: word.x,
            y: line.y,
            height: lineHeightPx,
            text: word.text,
            fontFamily,
            fontSize,
            fontStyle,
            fontVariant: "normal",
            fontWeight,
            lineHeight: lineHeightRatio,
            fill: "#101010",
            align: "justify",
            wrap: "none",
            letterSpacing: 0,
          }),
        );
      }
    }
  } else {
    for (const line of lines) {
      body.add(
        new Konva.Shape({
          name: `line-${line.index}`,
          x: 0,
          y: 0,
          width,
          height: lineHeightPx,
          listening: false,
          sceneFunc: (context) => {
            const nativeContext = context._context;
            for (const word of line.words) {
              nativeContext.save();
              nativeContext.font = fontString;
              nativeContext.fillStyle = "#101010";
              nativeContext.textAlign = "left";
              nativeContext.textBaseline = "alphabetic";
              nativeContext.direction = "ltr";
              nativeContext.fillText(word.text, word.x, line.y + fontSize * 0.78);
              nativeContext.restore();
            }
          },
        }),
      );
    }
  }

  const beforeDraw = performance.now();
  layer.draw();
  const afterDraw = performance.now();

  return {
    stage,
    layer,
    body,
    timings: {
      renderMs: beforeDraw - startedAt,
      drawMs: afterDraw - beforeDraw,
    },
  };
}

function getGapMetrics(lines) {
  const gaps = lines.flatMap((line) => line.words.slice(0, -1).map((word) => word.gapAfter));
  const average = gaps.reduce((sum, gap) => sum + gap, 0) / Math.max(1, gaps.length);
  const variance =
    gaps.reduce((sum, gap) => sum + (gap - average) ** 2, 0) / Math.max(1, gaps.length);
  return {
    average,
    minimum: gaps.length ? Math.min(...gaps) : 0,
    maximum: gaps.length ? Math.max(...gaps) : 0,
    variance,
    count: gaps.length,
  };
}

function getInkDensity(stage) {
  const canvas = stage.toCanvas({ pixelRatio: 1 });
  const data = canvas.getContext("2d").getImageData(0, 0, canvas.width, canvas.height).data;
  let ink = 0;
  for (let index = 0; index < data.length; index += 4) {
    if (data[index + 3] > 0 && data[index] < 245) {
      ink += 1;
    }
  }
  return ink / (canvas.width * canvas.height);
}

function getRiverScore(lines) {
  const spaceCentersByLine = lines.map((line) => {
    const centers = [];
    for (const word of line.words.slice(0, -1)) {
      centers.push(word.x + word.width + word.gapAfter / 2);
    }
    return centers;
  });
  let aligned = 0;
  let comparisons = 0;
  for (let lineIndex = 0; lineIndex < spaceCentersByLine.length - 1; lineIndex += 1) {
    for (const center of spaceCentersByLine[lineIndex]) {
      for (const nextCenter of spaceCentersByLine[lineIndex + 1]) {
        comparisons += 1;
        if (Math.abs(center - nextCenter) < 5) {
          aligned += 1;
        }
      }
    }
  }
  return comparisons ? (aligned / comparisons) * 100 : 0;
}

async function run() {
  document.getElementById("native").textContent = paragraph;
  await document.fonts.ready;

  const compositionStart = performance.now();
  const lines = compose(tokenize(paragraph), width);
  const compositionMs = performance.now() - compositionStart;
  const segmented = createStage("segmented", "segmented", lines);
  const line = createStage("line", "line", lines);
  const nativeRect = document.getElementById("native").getBoundingClientRect();

  const glyphWords = validationText.glyphWords;
  const glyphValidation = glyphWords.map((word) => {
    const sample = new Konva.Text({ text: word, fontFamily, fontSize, fontStyle, fontWeight, lineHeight: lineHeightRatio });
    const span = document.createElement("span");
    span.style.font = fontString;
    span.textContent = word;
    document.body.appendChild(span);
    const rect = span.getBoundingClientRect();
    span.remove();
    return {
      word,
      codePoints: codePoints(word),
      graphemes: graphemes(word),
      canvasWidth: measure(word),
      konvaWidth: sample.width(),
      htmlWidth: rect.width,
      widthDeltaPx: Math.abs(measure(word) - rect.width),
    };
  });

  const lineFills = lines.map((line) => ({
    line: line.index,
    text: line.text,
    fillPercent: (line.renderedWidth / width) * 100,
    normalFillPercent: (line.normalWidth / width) * 100,
    gap: line.gap,
    widowRisk: line.words.length <= 2,
    orphanRisk: line.words.at(-1)?.text.length <= 2,
  }));

  const report = {
    font: {
      fontString,
      loaded: document.fonts.check(`${fontWeight} ${fontSize}px "${fontFamily}"`),
      entries: Array.from(document.fonts).map((font) => ({ family: font.family, weight: font.weight, status: font.status })),
    },
    rendererRects: {
      segmented: (() => { const rect = document.querySelector("#segmented .konvajs-content").getBoundingClientRect(); return { x: rect.x, y: rect.y, width: rect.width, height: rect.height }; })(),
      line: (() => { const rect = document.querySelector("#line .konvajs-content").getBoundingClientRect(); return { x: rect.x, y: rect.y, width: rect.width, height: rect.height }; })(),
      native: { x: nativeRect.x, y: nativeRect.y, width: nativeRect.width, height: nativeRect.height },
    },
    composition: {
      width,
      fontSize,
      lineHeightRatio,
      lineCount: lines.length,
      wordCount: tokenize(paragraph).length,
      compositionMs,
    lineFills,
      gapMetrics: getGapMetrics(lines),
      riverScore: getRiverScore(lines),
    },
    glyphValidation,
    greyValue: {
      segmentedInkDensity: getInkDensity(segmented.stage),
      lineInkDensity: getInkDensity(line.stage),
    },
    performance: {
      segmentedTextNodes: segmented.stage.find("Text").length,
      lineTextNodes: line.stage.find("Text").length,
      lineShapeNodes: line.stage.find("Shape").length,
      segmentedRenderMs: segmented.timings.renderMs,
      segmentedDrawMs: segmented.timings.drawMs,
      lineRenderMs: line.timings.renderMs,
      lineDrawMs: line.timings.drawMs,
      nodeReductionPercent: (1 - line.stage.find("Shape").length / Math.max(1, segmented.stage.find("Text").length)) * 100,
    },
  };

  document.getElementById("report").textContent = JSON.stringify(report, null, 2);
}

run().catch((error) => {
  document.getElementById("report").textContent = `ERROR: ${error && error.stack ? error.stack : String(error)}`;
});
</script>
</body>
</html>
'@

$html = $html.Replace("__FONT_DATA__", "data:font/ttf;base64,$fontData").Replace("__KONVA_PATH__", $konvaPath).Replace("__TEXT_FIXTURE__", $textFixture)
Set-Content -LiteralPath $htmlPath -Value $html -Encoding UTF8

& $chrome --headless=new --disable-gpu --allow-file-access-from-files --virtual-time-budget=7000 --window-size=1400,760 "--screenshot=$screenshotPath" $htmlPath | Out-Null
& $chrome --headless=new --disable-gpu --allow-file-access-from-files --virtual-time-budget=7000 --dump-dom $htmlPath | Set-Content -LiteralPath $dumpPath -Encoding UTF8

$dump = Get-Content -LiteralPath $dumpPath -Raw
$match = [regex]::Match($dump, '<pre id="report">(?<json>[\s\S]*?)</pre>')
if (-not $match.Success) {
  throw "Validation report was not found in Chrome dump."
}

$json = [System.Net.WebUtility]::HtmlDecode($match.Groups["json"].Value)
if ($json.StartsWith("ERROR:")) {
  throw $json
}
Set-Content -LiteralPath $reportPath -Value $json -Encoding UTF8
$report = $json | ConvertFrom-Json

Add-Type -AssemblyName System.Drawing

function Get-Luma([System.Drawing.Color]$color) {
  return 0.2126 * $color.R + 0.7152 * $color.G + 0.0722 * $color.B
}

function Compare-Crops {
  param(
    [System.Drawing.Bitmap]$Bitmap,
    [object]$First,
    [object]$Second,
    [int]$Width,
    [int]$Height,
    [string]$HeatmapPath
  )

  $diffPixels = 0
  $sumSq = 0.0
  $sumX = 0.0
  $sumY = 0.0
  $sumX2 = 0.0
  $sumY2 = 0.0
  $sumXY = 0.0
  $count = [double]($Width * $Height)
  $heatmap = New-Object System.Drawing.Bitmap $Width, $Height

  for ($y = 0; $y -lt $Height; $y++) {
    for ($x = 0; $x -lt $Width; $x++) {
      $a = $Bitmap.GetPixel([int]($First.x + $x), [int]($First.y + $y))
      $b = $Bitmap.GetPixel([int]($Second.x + $x), [int]($Second.y + $y))
      $dr = $a.R - $b.R
      $dg = $a.G - $b.G
      $db = $a.B - $b.B
      $px = $dr * $dr + $dg * $dg + $db * $db
      if ($px -ne 0) { $diffPixels++ }
      $sumSq += $px

      $lx = Get-Luma $a
      $ly = Get-Luma $b
      $sumX += $lx
      $sumY += $ly
      $sumX2 += $lx * $lx
      $sumY2 += $ly * $ly
      $sumXY += $lx * $ly

      $intensity = [Math]::Min(255, [Math]::Sqrt($px / 3))
      $heatmap.SetPixel($x, $y, [System.Drawing.Color]::FromArgb(255, [int]$intensity, 0, [int](255 - $intensity)))
    }
  }

  $meanX = $sumX / $count
  $meanY = $sumY / $count
  $varianceX = $sumX2 / $count - $meanX * $meanX
  $varianceY = $sumY2 / $count - $meanY * $meanY
  $covariance = $sumXY / $count - $meanX * $meanY
  $c1 = 6.5025
  $c2 = 58.5225
  $ssim = ((2 * $meanX * $meanY + $c1) * (2 * $covariance + $c2)) /
    (($meanX * $meanX + $meanY * $meanY + $c1) * ($varianceX + $varianceY + $c2))

  $heatmap.Save($HeatmapPath, [System.Drawing.Imaging.ImageFormat]::Png)
  $heatmap.Dispose()

  [pscustomobject]@{
    width = $Width
    height = $Height
    differingPixels = $diffPixels
    rmsError = [Math]::Sqrt($sumSq / $count)
    ssim = $ssim
    heatmap = $HeatmapPath
  }
}

$bitmap = [System.Drawing.Bitmap]::FromFile($screenshotPath)
$textHeight = [Math]::Min([int][Math]::Ceiling($report.rendererRects.native.height), [int]$report.rendererRects.line.height)
$comparison = [pscustomobject]@{
  segmentedVsNative = Compare-Crops $bitmap $report.rendererRects.segmented $report.rendererRects.native 330 $textHeight (Join-Path $outputPath "heatmap-segmented-vs-native.png")
  lineVsNative = Compare-Crops $bitmap $report.rendererRects.line $report.rendererRects.native 330 $textHeight (Join-Path $outputPath "heatmap-line-vs-native.png")
  segmentedVsLine = Compare-Crops $bitmap $report.rendererRects.segmented $report.rendererRects.line 330 $textHeight (Join-Path $outputPath "heatmap-segmented-vs-line.png")
}
$bitmap.Dispose()

$finalReport = [pscustomobject]@{
  generatedAt = (Get-Date).ToString("o")
  screenshot = $screenshotPath
  html = $htmlPath
  report = $report
  pixelComparison = $comparison
}

$finalPath = Join-Path $outputPath "body-renderer-validation-final.json"
$finalReport | ConvertTo-Json -Depth 20 | Set-Content -LiteralPath $finalPath -Encoding UTF8

Write-Output "Body renderer validation complete"
Write-Output "Final report: $finalPath"
Write-Output "Screenshot: $screenshotPath"
Write-Output "Line vs native RMS: $([Math]::Round($comparison.lineVsNative.rmsError, 4))"
Write-Output "Legacy vs native RMS: $([Math]::Round($comparison.segmentedVsNative.rmsError, 4))"
Write-Output "Line render nodes: $($report.performance.lineShapeNodes)"
Write-Output "Legacy text nodes: $($report.performance.segmentedTextNodes)"





