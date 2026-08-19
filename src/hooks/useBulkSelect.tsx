import { useState, useCallback, useMemo } from "react";

/** Reusable multi-select helper for list pages that support bulk delete. */
export function useBulkSelect(allIds: string[]) {
  const [selecting, setSelecting] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);

  const toggle = useCallback((id: string) => {
    setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
  }, []);

  const clear = useCallback(() => setSelected([]), []);

  const exit = useCallback(() => { setSelected([]); setSelecting(false); }, []);

  const allSelected = useMemo(
    () => allIds.length > 0 && allIds.every((i) => selected.includes(i)),
    [allIds, selected],
  );

  const selectAll = useCallback(() => {
    setSelected((s) => (allIds.every((i) => s.includes(i)) ? [] : [...allIds]));
  }, [allIds]);

  return { selecting, setSelecting, selected, toggle, clear, exit, allSelected, selectAll };
}
