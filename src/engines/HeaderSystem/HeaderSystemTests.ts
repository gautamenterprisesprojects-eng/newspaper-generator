import { addPage, createDocument, deletePage, movePage, updatePageProperties } from "@/engines/DocumentEngine/DocumentEngine";
import { parseDocumentPayload, saveDocument } from "@/engines/DocumentEngine/DocumentSerializer";
import { createDefaultHeaderSet, createDefaultPublicationProfile } from "./HeaderDefaults";
import { normalizeHeaderSystemState } from "./HeaderNormalizer";
import { insideHeaderLayouts } from "./HeaderLayoutTemplates";
import { buildHeaderPrintModel } from "./HeaderPrintModel";
import { resolveDocumentHeaders, resolveHeaderReservedContentBounds, resolvePageHeader } from "./HeaderResolver";
import { buildHeaderWorkflowValidationReport } from "./HeaderWorkflowValidation";
import {
  activateHeaderSet,
  deleteHeaderSet,
  duplicateActiveHeaderSet,
  exportActiveHeaderSetJson,
  importHeaderSetJson,
  removePageHeaderOverride,
  removeSectionHeaderOverride,
  resetActiveHeaderLayouts,
  renameHeaderSet,
  saveHeaderSetAs,
  setActiveHeaderHidden,
  setActiveHeaderLocked,
  setDefaultHeaderSet,
  setPageInsideHeaderOverride,
  setSectionInsideHeaderOverride,
  validateHeaderAssets,
  validateHeaderSystemState,
} from "./HeaderSetManager";
import { resolveHeaderTokens } from "./HeaderTokenResolver";

type TestCase = {
  name: string;
  run: () => void | Promise<void>;
};

const assert = (condition: boolean, message: string) => {
  if (!condition) {
    throw new Error(message);
  }
};

const assertEqual = <Value>(actual: Value, expected: Value, message: string) => {
  if (actual !== expected) {
    throw new Error(`${message}. Expected ${String(expected)}, got ${String(actual)}`);
  }
};

/**
 * The masthead is driven by `pageType`, not page order, so any test that wants
 * a front page has to say so explicitly.
 */
const typeAsFront = (document: ReturnType<typeof createDocument>, pageIndex = 0) =>
  updatePageProperties(document, document.pages[pageIndex].id, { pageType: "front" });

const tests: TestCase[] = [
  {
    name: "Resolves publication and dynamic page tokens",
    run: () => {
      const profile = createDefaultPublicationProfile({
        publicationName: "DAILY STANDARD",
        editionName: "Morning",
        date: "2026-07-31",
        city: "Mumbai",
        price: "Rs. 10",
      });
      const text = resolveHeaderTokens("{{publicationName}} {{editionName}} {{pageNumber}} {{section}} {{city}} {{price}}", {
        profile,
        pageNumber: 7,
        totalPages: 12,
        sectionName: "Sports",
      });

      assertEqual(text, "DAILY STANDARD Morning 7 Sports Mumbai Rs. 10", "header tokens should resolve deterministically");
    },
  },
  {
    name: "Does not auto-enable headers while normalizing a legacy load",
    run: () => {
      const normalized = normalizeHeaderSystemState(undefined, {}, { enableDefaultHeader: false });

      assertEqual(normalized.activeHeaderSetId, null, "legacy documents should not receive active headers by normalization alone");
      assertEqual(Object.keys(normalized.headerSets).length, 0, "legacy header set registry should remain empty");
    },
  },
  {
    name: "Missing optional values resolve to empty text",
    run: () => {
      const profile = createDefaultPublicationProfile({
        publicationName: "CITY JOURNAL",
        publicationNameHindi: "",
        website: "",
        registrationNumber: "",
      });
      const text = resolveHeaderTokens("{{publicationNameHindi}} {{website}} {{registrationNumber}}", {
        profile,
        pageNumber: 1,
        totalPages: 1,
        sectionName: "City",
      });

      assert(!text.includes("undefined"), "optional token resolver must never print undefined");
    },
  },
  {
    name: "Resolves front masthead on front-typed pages and inside folio elsewhere",
    run: () => {
      const document = typeAsFront(addPage(createDocument()));
      const front = resolvePageHeader(document, document.pages[0].id);
      const inside = resolvePageHeader(document, document.pages[1].id);

      assert(front?.header.kind === "front", "a front-typed page must use the front masthead");
      assert(inside?.header.kind === "inside", "page two must use inside folio");
      assertEqual(inside?.pageNumber, 2, "inside header page number should follow current page order");
      assert(
        (front?.reservedHeight ?? 0) > (inside?.reservedHeight ?? 0),
        "the masthead band must reserve more height than the folio strip",
      );
    },
  },
  {
    name: "An untyped first page keeps the inside folio strip",
    run: () => {
      // The editor's working document is a single `city` page. It must not be
      // promoted to a masthead page just for sitting first.
      const document = createDocument();
      const header = resolvePageHeader(document, document.pages[0].id);

      assert(header?.header.kind === "inside", "an untyped page one must keep the inside folio strip");
    },
  },
  {
    name: "Page move updates resolved folio numbers without cloning header data",
    run: () => {
      const document = typeAsFront(addPage(addPage(createDocument())), 2);
      const moved = movePage(document, document.pages[2].id, 0);
      const headers = resolveDocumentHeaders(moved);

      assertEqual(headers.length, 3, "all pages should resolve headers");
      assertEqual(headers[0].pageNumber, 1, "moved page should now resolve as page one");
      assert(headers[0].header.kind === "front", "the front-typed page keeps its masthead after reorder");
      assert(headers[1].header.kind === "inside", "second page after reorder should use inside folio");
    },
  },
  {
    name: "Page deletion recalculates resolved folio numbers",
    run: () => {
      const document = addPage(addPage(createDocument()));
      const next = deletePage(document, document.pages[1].id);
      const headers = resolveDocumentHeaders(next);

      assertEqual(headers.length, 2, "remaining pages should still resolve headers");
      assertEqual(headers[0].pageNumber, 1, "first remaining page should resolve as page one");
      assertEqual(headers[1].pageNumber, 2, "second remaining page should resolve as page two");
      assert(headers[1].header.kind === "inside", "second remaining page should use inside folio");
    },
  },
  {
    name: "Mirrored inside folio swaps outer edge on even pages",
    run: () => {
      const document = addPage(createDocument({
        headerSystem: {
          ...createDocument().headerSystem,
          headerSets: {
            "header-set-default": createDefaultHeaderSet(createDefaultPublicationProfile(), {
              inside: insideHeaderLayouts["mirrored-facing-pages"],
            }),
          },
          activeHeaderSetId: "header-set-default",
        },
      }));
      const pageTwo = resolvePageHeader(document, document.pages[1].id);

      if (!pageTwo || pageTwo.header.kind !== "inside") {
        throw new Error("page two should resolve an inside folio");
      }

      assert(pageTwo.header.left.text.includes("Section") || pageTwo.header.left.text.includes("|"), "even-page mirrored folio should move section/date to the left edge");
      assert(pageTwo.header.right.text.includes("Page 2"), "even-page mirrored folio should move page number to the right edge after swap");
    },
  },
  {
    name: "Section override customizes inside folio",
    run: () => {
      const base = addPage(createDocument());
      const profile = Object.values(base.headerSystem.publicationProfiles)[0];
      const headerSet = createDefaultHeaderSet(profile, {
        sectionOverrides: {
          Sports: {
            sectionName: "Sports",
            inside: {
              ...insideHeaderLayouts["local-edition-folio"],
              center: {
                ...insideHeaderLayouts["local-edition-folio"].center,
                template: "SPORTS SPECIAL",
              },
            },
          },
        },
      });
      const document = updatePageProperties(
        {
          ...base,
          headerSystem: {
            ...base.headerSystem,
            headerSets: {
              [headerSet.id]: headerSet,
            },
            activeHeaderSetId: headerSet.id,
          },
        },
        base.pages[1].id,
        { sectionName: "Sports" },
      );
      const inside = resolvePageHeader(document, document.pages[1].id);

      if (!inside || inside.header.kind !== "inside") {
        throw new Error("sports page should still use inside header");
      }

      assertEqual(inside.header.center.text, "SPORTS SPECIAL", "section override should resolve custom folio text");
    },
  },
  {
    name: "Page override wins over section override and can return to master",
    run: () => {
      const base = addPage(createDocument());
      const sectioned = setSectionInsideHeaderOverride(base.headerSystem, "City", {
        displayName: "CITY EDITION",
        layout: "section-color-band",
      });
      const pageOverride = setPageInsideHeaderOverride(sectioned, base.pages[1].id, {
        sectionName: "PAGE ONLY",
        layout: "local-edition-folio",
      });
      const withOverride = {
        ...base,
        headerSystem: pageOverride,
      };
      const resolvedOverride = resolvePageHeader(withOverride, base.pages[1].id);

      if (!resolvedOverride || resolvedOverride.header.kind !== "inside") {
        throw new Error("page override should resolve an inside header");
      }

      assertEqual(resolvedOverride.header.center.text, "PAGE ONLY", "page override should win over section override");

      const returned = {
        ...base,
        headerSystem: removePageHeaderOverride(pageOverride, base.pages[1].id),
      };
      const resolvedReturned = resolvePageHeader(returned, base.pages[1].id);

      if (!resolvedReturned || resolvedReturned.header.kind !== "inside") {
        throw new Error("returned page should resolve an inside header");
      }

      assertEqual(resolvedReturned.header.center.text, "CITY EDITION", "return to master should restore section override");
    },
  },
  {
    name: "Header controls lock hide reset and remove section overrides",
    run: () => {
      const document = createDocument();
      const locked = setActiveHeaderLocked(document.headerSystem, false);
      const hidden = setActiveHeaderHidden(locked, true);
      const hiddenDocument = {
        ...document,
        headerSystem: hidden,
      };

      assertEqual(hidden.headerSets[hidden.activeHeaderSetId ?? ""].locked, false, "header lock should update");
      assertEqual(resolvePageHeader(hiddenDocument, document.pages[0].id), null, "hidden header should not resolve");

      const reset = resetActiveHeaderLayouts(hidden, "heritage-institutional", "mirrored-facing-pages");
      const active = reset.headerSets[reset.activeHeaderSetId ?? ""];

      assertEqual(active.front.layout, "heritage-institutional", "reset should set front layout");
      assertEqual(active.inside.layout, "mirrored-facing-pages", "reset should set inside layout");

      const sectioned = setSectionInsideHeaderOverride(reset, "Sports", { displayName: "SPORTS" });
      const removed = removeSectionHeaderOverride(sectioned, "Sports");

      assert(!removed.headerSets[removed.activeHeaderSetId ?? ""].sectionOverrides.Sports, "section override should be removable");
    },
  },
  {
    name: "Save/open preserves active Header Set",
    run: () => {
      const document = createDocument();
      const payload = saveDocument(document);
      const parsed = parseDocumentPayload(payload);

      assertEqual(parsed.document.headerSystem.activeHeaderSetId, document.headerSystem.activeHeaderSetId, "header set selection should survive serialization");
      assertEqual(Object.keys(parsed.document.headerSystem.headerSets).length, 1, "header set registry should survive serialization");
    },
  },
  {
    name: "Header Set manager supports save-as, duplicate, rename, delete and default selection",
    run: () => {
      const document = createDocument();
      const saved = saveHeaderSetAs(document.headerSystem, "Metro Morning");
      const savedId = saved.activeHeaderSetId;

      assert(Boolean(savedId), "save-as should activate a new Header Set");
      assertEqual(savedId ? saved.headerSets[savedId].name : "", "Metro Morning", "save-as should preserve requested name");

      const duplicated = duplicateActiveHeaderSet(saved);
      const duplicateId = duplicated.activeHeaderSetId;

      assert(Boolean(duplicateId), "duplicate should activate the duplicated Header Set");
      assert(Object.keys(duplicated.headerSets).length === 3, "duplicate should add one Header Set");

      const renamed = duplicateId ? renameHeaderSet(duplicated, duplicateId, "Renamed Header") : duplicated;
      assertEqual(duplicateId ? renamed.headerSets[duplicateId].name : "", "Renamed Header", "rename should update the Header Set name");

      const defaulted = duplicateId ? setDefaultHeaderSet(renamed, duplicateId) : renamed;
      assertEqual(defaulted.defaultHeaderSetId, duplicateId, "default Header Set should update");

      const reactivated = savedId ? activateHeaderSet(defaulted, savedId) : defaulted;
      assertEqual(reactivated.activeHeaderSetId, savedId, "activate should switch active Header Set");

      const deleted = duplicateId ? deleteHeaderSet(reactivated, duplicateId) : reactivated;
      assert(!duplicateId || !deleted.headerSets[duplicateId], "delete should remove the requested Header Set");
    },
  },
  {
    name: "Header Set JSON export/import round trips a reusable set",
    run: () => {
      const document = createDocument();
      const exported = exportActiveHeaderSetJson(document.headerSystem);
      const imported = importHeaderSetJson(document.headerSystem, exported);

      assert(Object.keys(imported.headerSets).length >= 2, "import should add a Header Set when id collides");
      assert(Boolean(imported.activeHeaderSetId), "imported Header Set should become active");
      assert(validateHeaderSystemState(imported).every((issue) => issue.severity !== "error"), "imported Header System should validate without errors");
    },
  },
  {
    name: "Reserved content bounds move below front masthead",
    run: () => {
      const document = typeAsFront(createDocument());
      const bounds = resolveHeaderReservedContentBounds(document, document.pages[0].id);
      const header = resolvePageHeader(document, document.pages[0].id);

      assert(Boolean(bounds), "reserved content bounds should resolve");
      assert(Boolean(header), "front header should resolve");
      assert((bounds?.y ?? 0) >= (header?.reservedHeight ?? 0), "content y should be below the resolved header reserve");
    },
  },
  {
    name: "Header print model emits front and inside export operations",
    run: async () => {
      const document = typeAsFront(addPage(createDocument()));
      const frontModel = await buildHeaderPrintModel(document, document.pages[0].id);
      const insideModel = await buildHeaderPrintModel(document, document.pages[1].id);

      assertEqual(frontModel?.headerKind, "front", "page one print model should be front");
      assertEqual(insideModel?.headerKind, "inside", "page two print model should be inside");
      assert(Boolean(frontModel?.operations.some((operation) => operation.kind === "image" && operation.id === "header-banner")), "front print model should include header banner");
      assert(!frontModel?.operations.some((operation) => operation.kind === "text"), "front print model should not include text operations");
      assert(Boolean(insideModel?.operations.some((operation) => operation.kind === "image" && operation.id === "header-banner")), "inside print model should include header banner");
      assert(!insideModel?.operations.some((operation) => operation.kind === "text"), "inside print model should not include text operations");
    },
  },
  {
    name: "Header print model respects hidden headers and mirroring",
    run: async () => {
      const document = addPage(createDocument());
      const hidden = {
        ...document,
        headerSystem: setActiveHeaderHidden(document.headerSystem, true),
      };

      assertEqual(await buildHeaderPrintModel(hidden, hidden.pages[0].id), null, "hidden header should not produce print operations");

      const mirrored = {
        ...document,
        headerSystem: resetActiveHeaderLayouts(document.headerSystem, "classic-centered", "mirrored-facing-pages"),
      };
      const model = await buildHeaderPrintModel(mirrored, mirrored.pages[1].id);
      assert(Boolean(model?.operations.some((op) => op.kind === "image" && op.id === "header-banner")), "mirrored page model should include header banner");
    },
  },
  {
    name: "Header workflow report validates multi-page add reorder date save reload flow",
    run: async () => {
      const original = typeAsFront(addPage(addPage(createDocument())));
      const originalReport = await buildHeaderWorkflowValidationReport(original);

      assert(originalReport.passed, `initial workflow report should pass: ${originalReport.issues.map((issue) => issue.code).join(", ")}`);
      assertEqual(originalReport.pages[0].headerKind, "front", "page one should report front masthead");
      assertEqual(originalReport.pages[1].headerKind, "inside", "page two should report inside folio");
      assertEqual(originalReport.pages[2].headerKind, "inside", "page three should report inside folio");

      const added = addPage(original);
      const addedReport = await buildHeaderWorkflowValidationReport(added);
      assert(addedReport.passed, "added-page workflow report should pass");
      assertEqual(addedReport.pages[3].resolvedPageNumber, 4, "added page should resolve page number 4");

      const reordered = movePage(added, added.pages[3].id, 0);
      const reorderedReport = await buildHeaderWorkflowValidationReport(reordered);
      assert(reorderedReport.passed, "reordered workflow report should pass");
      // The masthead follows the front-typed page, not the first slot: an
      // untyped page moved to the top stays an inside page.
      assertEqual(reorderedReport.pages[0].headerKind, "inside", "the moved untyped page should stay inside");
      assertEqual(reorderedReport.pages[1].headerKind, "front", "the front-typed page keeps its masthead after reorder");

      const activeHeaderSetId = reordered.headerSystem.activeHeaderSetId;
      const activeHeaderSet = activeHeaderSetId ? reordered.headerSystem.headerSets[activeHeaderSetId] : null;
      const profile = activeHeaderSet ? reordered.headerSystem.publicationProfiles[activeHeaderSet.publicationProfileId] : null;
      assert(Boolean(activeHeaderSet && profile), "expected active header profile");

      const changedDate = {
        ...reordered,
        metadata: {
          ...reordered.metadata,
          date: "2026-08-15",
        },
        headerSystem: {
          ...reordered.headerSystem,
          publicationProfiles: {
            ...reordered.headerSystem.publicationProfiles,
            [profile!.id]: {
              ...profile!,
              date: "2026-08-15",
            },
          },
        },
      };
      // pages[1] is the front-typed page after the reorder, so pick a page that
      // actually renders a folio.
      const dateHeader = resolvePageHeader(changedDate, changedDate.pages[2].id);
      if (!dateHeader || dateHeader.header.kind !== "inside") {
        throw new Error("date-changed inside header should resolve");
      }

      // The default inside template ("{{city}},{{day}} {{dayOfMonth}} {{monthYear}}")
      // never rendered the raw ISO "2026-08-15" — neither did its predecessor
      // ("{{day}}, {{mastheadDateShort}}", e.g. "Saturday, 15 Aug-2026"). Check
      // for what the resolved text actually contains instead: the day-of-month
      // and the full month name + year the template does produce.
      assert(
        dateHeader.header.right.text.includes("15") && dateHeader.header.right.text.includes("August 2026"),
        `changed issue date should resolve into inside folio: ${dateHeader.header.right.text}`,
      );

      const reloaded = parseDocumentPayload(saveDocument(changedDate)).document;
      const reloadedReport = await buildHeaderWorkflowValidationReport(reloaded);

      assert(reloadedReport.passed, "save/reload workflow report should pass");
      assertEqual(reloadedReport.activeHeaderSetId, changedDate.headerSystem.activeHeaderSetId, "active Header Set should survive reload");
    },
  },
  {
    name: "Missing logo asset validates as text masthead fallback",
    run: () => {
      const document = createDocument();
      const profile = Object.values(document.headerSystem.publicationProfiles)[0];
      const headerSet = Object.values(document.headerSystem.headerSets)[0];
      const next = {
        ...document,
        headerSystem: {
          ...document.headerSystem,
          publicationProfiles: {
            ...document.headerSystem.publicationProfiles,
            [profile.id]: {
              ...profile,
              logoAssetId: "missing-logo",
            },
          },
        },
      };
      const issues = validateHeaderAssets(next);

      assert(issues.some((issue) => issue.code === "missing-logo-asset"), "missing logo should be reported");
      assert(Boolean(headerSet.front.masthead.template), "text masthead fallback should remain configured");
    },
  },
  {
    name: "Valid logo asset is included in front header print model",
    run: async () => {
      const document = createDocument();
      const profile = Object.values(document.headerSystem.publicationProfiles)[0];
      const withLogo = {
        ...document,
        assets: {
          ...document.assets,
          "header-logo": {
            id: "header-logo",
            type: "image" as const,
            name: "Header logo",
            filename: "header-logo.png",
            format: "png",
            source: "data:image/png;base64,iVBORw0KGgo=",
            previewUrl: "data:image/png;base64,iVBORw0KGgo=",
            thumbnailUrl: "data:image/png;base64,iVBORw0KGgo=",
            linkStatus: "ok" as const,
          },
        },
        headerSystem: {
          ...document.headerSystem,
          publicationProfiles: {
            ...document.headerSystem.publicationProfiles,
            [profile.id]: {
              ...profile,
              logoAssetId: "header-logo",
            },
          },
        },
      };
      const model = await buildHeaderPrintModel(withLogo, withLogo.pages[0].id);

      assert(Boolean(model?.operations.some((operation) => operation.kind === "image" && operation.id === "header-banner")), "front print model should include header banner");
      assert(!model?.operations.some((operation) => operation.kind === "text"), "front print model should not include any text operations");
    },
  },
  {
    name: "Unsafe SVG logo content is rejected",
    run: () => {
      const document = createDocument();
      const profile = Object.values(document.headerSystem.publicationProfiles)[0];
      const next = {
        ...document,
        assets: {
          ...document.assets,
          "logo-svg": {
            id: "logo-svg",
            type: "svg" as const,
            name: "Unsafe Logo",
            filename: "unsafe.svg",
            size: 128,
            format: "svg",
            source: "<svg onload=\"alert(1)\"></svg>",
          },
        },
        headerSystem: {
          ...document.headerSystem,
          publicationProfiles: {
            ...document.headerSystem.publicationProfiles,
            [profile.id]: {
              ...profile,
              logoAssetId: "logo-svg",
            },
          },
        },
      };
      const issues = validateHeaderAssets(next);

      assert(issues.some((issue) => issue.code === "unsafe-svg-logo"), "unsafe SVG logo content should be rejected");
    },
  },
  {
    name: "Front and inside header image banner operations are generated for print",
    run: async () => {
      const document = typeAsFront(addPage(createDocument()));
      const frontModel = await buildHeaderPrintModel(document, document.pages[0].id);
      assert(
        Boolean(frontModel?.operations.some((op) => op.kind === "image" && op.id === "header-banner")),
        "front page print model should include the masthead banner image operation",
      );
      const insidePrintModelForHeightCheck = await buildHeaderPrintModel(document, document.pages[1].id);
      assert(
        (frontModel?.reservedHeight ?? 0) > (insidePrintModelForHeightCheck?.reservedHeight ?? 0),
        "the front masthead band must be taller than the inside folio strip",
      );

      const insideModel = await buildHeaderPrintModel(document, document.pages[1].id);
      assert(
        Boolean(insideModel?.operations.some((op) => op.kind === "image" && op.id === "header-banner")),
        "inside page print model should include header banner image operation",
      );
    },
  },
];

export const runHeaderSystemTests = async () => {
  for (const test of tests) {
    await test.run();
  }

  return {
    passed: tests.length,
  };
};

if (typeof require !== "undefined" && require.main === module) {
  runHeaderSystemTests().then((result) => {
    console.log(`Header system tests passed: ${result.passed}`);
  });
}
