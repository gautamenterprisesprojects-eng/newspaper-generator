import type { NewspaperDocument } from "@/types/document";
import { buildHeaderPrintModel } from "./HeaderPrintModel";
import { resolveHeaderReservedContentBounds, resolvePageHeader } from "./HeaderResolver";
import { validateHeaderAssets, validateHeaderSystemState, type HeaderValidationIssue } from "./HeaderSetManager";

export type HeaderWorkflowPageReport = {
  pageId: string;
  pageIndex: number;
  pageNumber: number;
  sectionName: string;
  headerKind: "front" | "inside" | "none";
  resolvedPageNumber: number | null;
  reservedHeight: number;
  contentY: number | null;
  printOperationCount: number;
  hasMastheadText: boolean;
  hasFolioText: boolean;
};

export type HeaderWorkflowValidationReport = {
  documentId: string;
  pageCount: number;
  activeHeaderSetId: string | null;
  pages: HeaderWorkflowPageReport[];
  issues: HeaderValidationIssue[];
  passed: boolean;
};

const workflowIssue = (
  code: string,
  message: string,
  severity: HeaderValidationIssue["severity"] = "error",
): HeaderValidationIssue => ({
  severity,
  code,
  message,
});

/** Builds a deterministic validation report for the master-header page workflow. */
export const buildHeaderWorkflowValidationReport = async (
  document: NewspaperDocument,
): Promise<HeaderWorkflowValidationReport> => {
  const issues: HeaderValidationIssue[] = [
    ...validateHeaderSystemState(document.headerSystem),
    ...validateHeaderAssets(document),
  ];
  const pages = await Promise.all(document.pages.map(async (page, index): Promise<HeaderWorkflowPageReport> => {
    const resolvedHeader = resolvePageHeader(document, page.id);
    const printModel = await buildHeaderPrintModel(document, page.id);
    const bounds = resolveHeaderReservedContentBounds(document, page.id);
    const textOperations = printModel?.operations.filter((operation) => operation.kind === "text") ?? [];
    const headerKind = resolvedHeader?.header.kind ?? "none";

    if (document.headerSystem.activeHeaderSetId && !resolvedHeader) {
      issues.push(workflowIssue("missing-page-header", `Page ${index + 1} did not resolve a master header.`));
    }

    if (resolvedHeader && resolvedHeader.pageNumber !== index + 1) {
      issues.push(workflowIssue("stale-page-number", `Page ${page.id} resolved stale page number ${resolvedHeader.pageNumber}.`));
    }

    // The masthead follows `pageType`, not page order — a page is the front
    // page because it is typed as one, wherever it sits in the edition.
    const expectsMasthead = page.pageType === "front";

    if (expectsMasthead && headerKind !== "front") {
      issues.push(
        workflowIssue("front-page-header-mismatch", `Page ${index + 1} is typed front but did not resolve the masthead.`),
      );
    }

    if (!expectsMasthead && headerKind !== "inside") {
      issues.push(workflowIssue("inside-page-header-mismatch", `Page ${index + 1} must resolve an inside folio.`));
    }

    if (resolvedHeader && bounds && bounds.y < resolvedHeader.reservedHeight) {
      issues.push(workflowIssue("header-reservation-mismatch", `Page ${index + 1} content bounds overlap the header reserve.`));
    }

    if (resolvedHeader && !printModel) {
      issues.push(workflowIssue("missing-print-model", `Page ${index + 1} resolved a header but no print model.`));
    }

    return {
      pageId: page.id,
      pageIndex: index,
      pageNumber: page.pageNumber,
      sectionName: page.sectionName ?? page.pageType,
      headerKind,
      resolvedPageNumber: resolvedHeader?.pageNumber ?? null,
      reservedHeight: resolvedHeader?.reservedHeight ?? 0,
      contentY: bounds?.y ?? null,
      printOperationCount: printModel?.operations.length ?? 0,
      hasMastheadText: textOperations.some((operation) => operation.kind === "text" && operation.id === "masthead"),
      hasFolioText: textOperations.some((operation) => operation.kind === "text" && operation.id.startsWith("inside-")),
    };
  }));

  return {
    documentId: document.id,
    pageCount: document.pages.length,
    activeHeaderSetId: document.headerSystem.activeHeaderSetId,
    pages,
    issues,
    passed: issues.every((issue) => issue.severity !== "error"),
  };
};
