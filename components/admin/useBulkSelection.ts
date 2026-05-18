"use client";

import { useCallback, useMemo, useState } from "react";

export interface BulkSelectableItem {
  id: string;
  canApprove: boolean;
  canReject: boolean;
}

export function useBulkSelection(items: BulkSelectableItem[]) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());

  const selectableIds = useMemo(
    () => items.filter((item) => item.canApprove || item.canReject).map((item) => item.id),
    [items],
  );

  const approvableSelectedIds = useMemo(
    () =>
      items
        .filter((item) => selectedIds.has(item.id) && item.canApprove)
        .map((item) => item.id),
    [items, selectedIds],
  );

  const rejectableSelectedIds = useMemo(
    () =>
      items
        .filter((item) => selectedIds.has(item.id) && item.canReject)
        .map((item) => item.id),
    [items, selectedIds],
  );

  const allSelectableSelected =
    selectableIds.length > 0 && selectableIds.every((id) => selectedIds.has(id));

  const someSelectableSelected =
    selectableIds.some((id) => selectedIds.has(id)) && !allSelectableSelected;

  const toggleOne = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const selectAll = useCallback(() => {
    setSelectedIds(new Set(selectableIds));
  }, [selectableIds]);

  const clearSelection = useCallback(() => {
    setSelectedIds(new Set());
  }, []);

  const toggleSelectAll = useCallback(() => {
    if (allSelectableSelected) clearSelection();
    else selectAll();
  }, [allSelectableSelected, clearSelection, selectAll]);

  return {
    selectedIds,
    selectableIds,
    approvableSelectedIds,
    rejectableSelectedIds,
    allSelectableSelected,
    someSelectableSelected,
    toggleOne,
    selectAll,
    clearSelection,
    toggleSelectAll,
    isSelected: (id: string) => selectedIds.has(id),
  };
}
