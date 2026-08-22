import { resolveConstraintRequest } from "./ConstraintResolver";
import type { ConstraintRequest, ConstraintResult, LayoutSnapshot } from "./LayoutTransactionTypes";

/**
 * Evaluates legal layout capabilities for a frame operation without mutating
 * geometry. This is the public entry point for Smart Auto Resize constraint
 * checks before any future layout solver creates geometry patches.
 */
export const solveConstraints = (
  snapshot: LayoutSnapshot,
  request: ConstraintRequest,
): ConstraintResult => resolveConstraintRequest(snapshot, request);

/** Public facade for deterministic constraint capability analysis. */
export const ConstraintSolver = {
  solveConstraints,
};
