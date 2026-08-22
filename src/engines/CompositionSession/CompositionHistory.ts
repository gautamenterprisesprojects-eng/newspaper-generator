import type { CompositionTransaction } from "./CompositionTransaction";

export type CompositionHistoryState = {
  transactions: CompositionTransaction[];
  cursor: number;
  maxEntries: number;
};

export const createCompositionHistory = (maxEntries = 100): CompositionHistoryState => ({
  transactions: [],
  cursor: -1,
  maxEntries: Math.max(1, Math.floor(maxEntries)),
});

/** Appends a committed transaction and drops redo history. */
export const pushCompositionTransaction = (
  history: CompositionHistoryState,
  transaction: CompositionTransaction,
): CompositionHistoryState => {
  const retained = history.transactions.slice(0, history.cursor + 1);
  const next = [...retained, transaction].slice(-history.maxEntries);

  return {
    ...history,
    transactions: next,
    cursor: next.length - 1,
  };
};

/** Moves the history cursor backward and returns the transaction to undo. */
export const undoCompositionTransaction = (history: CompositionHistoryState) => {
  if (history.cursor < 0) {
    return {
      history,
      transaction: null,
    };
  }

  return {
    history: {
      ...history,
      cursor: history.cursor - 1,
    },
    transaction: history.transactions[history.cursor],
  };
};

/** Moves the history cursor forward and returns the transaction to redo. */
export const redoCompositionTransaction = (history: CompositionHistoryState) => {
  const nextCursor = history.cursor + 1;

  if (nextCursor >= history.transactions.length) {
    return {
      history,
      transaction: null,
    };
  }

  return {
    history: {
      ...history,
      cursor: nextCursor,
    },
    transaction: history.transactions[nextCursor],
  };
};

/** Jumps to an absolute revision cursor when it exists. */
export const jumpToCompositionRevision = (
  history: CompositionHistoryState,
  cursor: number,
): CompositionHistoryState => {
  if (cursor < -1 || cursor >= history.transactions.length) {
    return history;
  }

  return {
    ...history,
    cursor,
  };
};
