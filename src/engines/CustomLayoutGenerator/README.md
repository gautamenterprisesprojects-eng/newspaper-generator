# Custom Layout Generator Engine (`CustomLayoutGeneratorEngine`)

This engine converts high-level prompts and descriptive layout specifications into deterministic, fully validated newspaper layouts instantly. It enforces strict editorial invariants across all layout generations:

## Core Responsibilities & Invariants

1. **Word Counter & Zero Blank Space Guarantee (`selectOptimisticNewswireWordTier`)**:
   - Accurately counts the maximum possible words that can fit in an article box based on actual physical typography dimensions and available vertical body lines.
   - Automatically applies an optimistic buffer ($\ge 1.5\times$) when selecting between API word lengths (**`250`**, **`500`**, or **`1000` words**).
   - **Rule**: Always select the higher word range so no empty white space is ever left blank at the bottom of the article frame. The text composition engine terminates cleanly at the nearest complete full-stop sentence at the bottom edge.

2. **Image Availability & Reflow Rule**:
   - Whenever an article does not have an available image in the API feed or image asset registration fails, `imageEnabled` is instantly set to `false`.
   - Removing the image frame allows the body text to reflow instantly to occupy the complete vertical box height without leaving empty gaps or placeholder frames.

3. **Internal Newspaper Text Columns (`determineInternalTextColumnCount`)**:
   - Automatically converts frame width from typographic points to physical centimeters ($1\text{ cm} = \frac{72}{2.54}\text{ pt}$).
   - Width $< 8\text{ cm} \rightarrow$ **1 Column**.
   - Width $8\text{--}14\text{ cm} \rightarrow$ **2 Columns**.
   - Width $> 14\text{ cm} \rightarrow$ **3 Columns**.
   - Clamps internal column widths strictly between $4\text{ cm}$ and $8\text{ cm}$.

## Rapid Prompt-to-Layout Usage (Example for Future Generations)

```typescript
import { compilePromptToBlueprint, generateCustomLayoutFromBlueprint } from "@/engines/CustomLayoutGenerator";

// Step 1: Convert descriptive prompt row requirements into a structured blueprint in seconds
const blueprint = compilePromptToBlueprint({
  id: "CustomFront9A",
  name: "Custom 9-Story Newspaper Page",
  rowLayouts: [
    { heightPercent: 35, colSpans: [4, 2], priorities: ["lead", "major"], images: [true, false] },
    { heightPercent: 25, colSpans: [2, 2, 2], priorities: ["secondary", "secondary", "secondary"], images: [true, false, true] },
    { heightPercent: 20, colSpans: [3, 3], priorities: ["major", "secondary"], images: [false, true] },
    { heightPercent: 20, colSpans: [3, 3], priorities: ["secondary", "secondary"], images: [false, false] },
  ],
});

// Step 2: Compile to full TemplateDefinition, story word targets (250/500/1000), and internal column spans
const layoutResult = generateCustomLayoutFromBlueprint(blueprint);
```
