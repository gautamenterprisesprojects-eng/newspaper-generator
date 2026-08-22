import type { ConstraintResult, NeighborResizeDirection } from "./LayoutTransactionTypes";

/** Clamps required resize space against source frame constraint limits. */
export const clampRequiredSpaceToConstraint = ({
  requiredSpace,
  direction,
  constraint,
}: {
  requiredSpace: number;
  direction: NeighborResizeDirection;
  constraint: ConstraintResult;
}) => {
  const safeRequiredSpace = Math.max(0, requiredSpace);

  if (direction === "right") {
    return Math.min(safeRequiredSpace, constraint.limits.grow.right);
  }

  if (direction === "left") {
    return Math.min(safeRequiredSpace, constraint.limits.grow.left);
  }

  if (direction === "bottom") {
    return Math.min(safeRequiredSpace, constraint.limits.grow.bottom);
  }

  if (direction === "top") {
    return Math.min(safeRequiredSpace, constraint.limits.grow.top);
  }

  if (direction === "horizontal") {
    return Math.min(safeRequiredSpace, constraint.limits.grow.left + constraint.limits.grow.right);
  }

  return Math.min(safeRequiredSpace, constraint.limits.grow.top + constraint.limits.grow.bottom);
};

/** Returns the next non-negative allocation amount. */
export const getAllocationAmount = (remainingSpace: number, candidateCapacity: number) =>
  Math.min(Math.max(0, remainingSpace), Math.max(0, candidateCapacity));
