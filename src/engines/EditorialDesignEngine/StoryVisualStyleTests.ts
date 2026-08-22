import { selectStoryVisualStyle, type StoryVisualStyle } from "./StoryVisualStyleEngine";
import type { StoryPriority } from "@/types/editor";

const runPage = (priorities: StoryPriority[]): StoryVisualStyle[] => {
  const styles: StoryVisualStyle[] = [];
  let previous: StoryVisualStyle | null = null;
  priorities.forEach((priority, index) => {
    const style = selectStoryVisualStyle({
      slotIndex: index,
      priority,
      previousStyle: previous,
      isLeadStory: index === 0 && priority === "lead",
    });
    styles.push(style);
    previous = style;
  });
  return styles;
};

let failed = 0;

// 1. Lead story is always non-plain
{
  const styles = runPage(["lead", "major", "secondary", "brief", "brief", "brief", "filler"]);
  if (styles[0] === "plain") {
    console.error("FAIL: lead story should never be plain, got", styles[0]);
    failed++;
  }
}

// 2. No two adjacent stories share the same non-plain treatment
{
  const styles = runPage(["lead", "major", "major", "secondary", "secondary", "brief", "brief", "major", "major", "major"]);
  for (let i = 1; i < styles.length; i++) {
    if (styles[i] !== "plain" && styles[i] === styles[i - 1]) {
      console.error(`FAIL: adjacent non-plain duplicates at index ${i}:`, styles);
      failed++;
      break;
    }
  }
}

// 3. Distribution across a large sample — plain should dominate, tinted+boxed
// together should be a meaningful minority (>15%, <50%).
{
  const large: StoryPriority[] = [];
  for (let i = 0; i < 200; i++) {
    const p: StoryPriority = i === 0 ? "lead" : (["major", "secondary", "secondary", "brief", "brief"] as StoryPriority[])[i % 5];
    large.push(p);
  }
  const styles = runPage(large);
  const plain = styles.filter((s) => s === "plain").length;
  const tinted = styles.filter((s) => s === "tinted").length;
  const boxed = styles.filter((s) => s === "boxed").length;
  const nonPlainRatio = (tinted + boxed) / styles.length;
  if (nonPlainRatio < 0.10 || nonPlainRatio > 0.5) {
    console.error(`FAIL: non-plain ratio ${nonPlainRatio.toFixed(2)} outside [0.10, 0.5] — plain=${plain} tinted=${tinted} boxed=${boxed}`);
    failed++;
  }
  if (boxed === 0) {
    console.error("FAIL: boxed style never selected across 200-story sample");
    failed++;
  }
  console.log(`  distribution across 200 stories: plain=${plain} tinted=${tinted} boxed=${boxed} (non-plain ${(nonPlainRatio * 100).toFixed(1)}%)`);
}

// 4. Deterministic — same input produces same output
{
  const a = runPage(["lead", "major", "secondary", "brief", "brief"]);
  const b = runPage(["lead", "major", "secondary", "brief", "brief"]);
  if (JSON.stringify(a) !== JSON.stringify(b)) {
    console.error("FAIL: selector not deterministic", { a, b });
    failed++;
  }
}

if (failed > 0) {
  console.error(`\n${failed} test(s) failed`);
  process.exit(1);
}
console.log("StoryVisualStyle tests passed");
