import { useMemo } from "react";
import { sortAlphabetically } from "@/utils/sortAlphabetically";

/**
 * Memoized A→Z sort for list UIs. See {@link sortAlphabetically}.
 */
export function useAlphabeticalList(list, key = "name") {
  return useMemo(() => sortAlphabetically(list, key), [list, key]);
}
