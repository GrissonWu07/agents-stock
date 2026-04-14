import { useCallback, useEffect, useMemo, useState } from "react";

const sameItems = (left: string[], right: string[]) =>
  left.length === right.length && left.every((item, index) => item === right[index]);

export function useSelection(ids: string[]) {
  const key = useMemo(() => ids.join("|"), [ids]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  useEffect(() => {
    setSelectedIds((current) => {
      const next = current.filter((id) => ids.includes(id));
      return sameItems(current, next) ? current : next;
    });
  }, [ids, key]);

  const toggle = useCallback((id: string) => {
    setSelectedIds((current) =>
      current.includes(id) ? current.filter((value) => value !== id) : [...current, id],
    );
  }, []);

  const toggleAll = useCallback(() => {
    setSelectedIds((current) => (current.length === ids.length ? [] : [...ids]));
  }, [ids, key]);

  const clear = useCallback(() => setSelectedIds([]), []);

  return {
    selectedIds,
    selectedCount: selectedIds.length,
    allSelected: ids.length > 0 && selectedIds.length === ids.length,
    someSelected: selectedIds.length > 0 && selectedIds.length < ids.length,
    isSelected: (id: string) => selectedIds.includes(id),
    toggle,
    toggleAll,
    clear,
  };
}
