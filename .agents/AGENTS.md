# Newspaper Generator — AGENTS & LAYOUT GENERATOR RULES (PERMANENT KNOWLEDGE)

## 1. Locked-in Rule: Zero Blank White Space & Optimistic Word Range Matching
When composing article boxes or generating new layouts (both existing 14 layouts and any future custom layouts):
- **Always take the higher word range from the API (`250`, `500`, or `1000` words)** relative to the estimated capacity of the article box so that **NO empty white space is left blank** at the bottom of any newspaper column.
- **Why**: The composition and layout engine automatically stops naturally at a complete sentence full-stop (`SentenceEndFitting`) at the printable bottom edge of the box. Under-supplying words leaves stark blank white gaps at the bottom of columns. Over-supplying (optimistic sizing with at least a 1.5x buffer) ensures perfect column-to-column bottom alignment and tight newspaper density.
- **Standard API Tier Mapping (`selectOptimisticNewswireWordTier`)**:
  - Estimate the word capacity possible to fit in the box based on physical typography dimensions (`estimateStoryWordCapacity`).
  - Multiply by a large safety buffer (1.5x minimum).
  - Buffered capacity $\le 220 \rightarrow$ take **250 words** (`shortBody`).
  - Buffered capacity $221\text{--}450 \rightarrow$ take **500 words** (`mediumBody`).
  - Buffered capacity $> 450 \rightarrow$ take **1000 words** (`longBody`).
  - *Fallback*: If the longest text available in the feed item falls short of target words, always default to the largest available text body (`longBody` or `body`).

## 2. Locked-in Rule: Image Availability & Instant Reflow
- **If an image is NOT available in any article (e.g. `!item.imageUrl` or asset registration returns `null`), place that article without an image box (`imageEnabled: false`, `photo: null`).**
- **Why**: Setting `imageEnabled: false` ensures zero vertical space is reserved for empty placeholder image frames. The body flow engine instantly reflows the text upwards directly below the headline and subheadline to fill the entire article box cleanly without gaps.

## 3. Locked-in Rule: Automatic Internal Text Column Determination
Every article must automatically determine internal newspaper columns based on actual typographical point width converted to centimeters ($1\text{ cm} = \frac{72}{2.54}\text{ pt} \approx 28.3465\text{ pt}$):
- **If article width $< 8\text{ cm}$** ($\approx 226.77\text{ pt}$) $\rightarrow$ **1 text column**.
- **If width between $8\text{--}14\text{ cm}$** ($226.77\text{--}396.85\text{ pt}$) $\rightarrow$ **2 text columns**.
- **If width $> 14\text{ cm}$** ($> 396.85\text{ pt}$) $\rightarrow$ **3 text columns**.
- **Boundary Constraints**: Never create internal columns narrower than $4\text{ cm}$ (~$113.38\text{ pt}$) nor wider than $8\text{ cm}$ (~$226.77\text{ pt}$). Adjust column counts dynamically if bounds are violated.

## 4. Custom Layout Generator Engine (`src/engines/CustomLayoutGenerator`)
A dedicated layout generation engine is installed at `src/engines/CustomLayoutGenerator/` to make generating custom layouts from conversational prompts effortless and rapid in future tasks.
- **Workflow for Future Prompts**:
  1. Define a quick layout blueprint using `compilePromptToBlueprint({ id, name, rowLayouts: [...] })`.
  2. Specify each row's height percentage and column spans (e.g. `colSpans: [4, 2]` for lead + sidebar, `colSpans: [3, 3]` for lower bands).
  3. Invoke `generateCustomLayoutFromBlueprint(blueprint)` to auto-compile non-overlapping grid coordinates, automatically assign internal text columns using physical centimeter measurements, calculate word capacities, and enforce optimistic API word tier selection (`250 | 500 | 1000` words).
