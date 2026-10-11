/**
 * Returns a new array sorted A→Z by the string value of `item[key]`.
 * Case-insensitive; does not mutate the input array.
 *
 * For dropdown-shaped objects, if the primary key is missing or empty and
 * `key !== "label"`, falls back to `label` so `{ value, label }` options still sort.
 */
export function sortAlphabetically(list, key = "name") {
  if (!Array.isArray(list) || list.length === 0) return [];

  const resolve = (item) => {
    if (item == null || typeof item !== "object") return "";
    const primary = item[key];
    if (primary != null && String(primary).trim() !== "") return String(primary);
    if (key !== "label" && item.label != null && String(item.label).trim() !== "") {
      return String(item.label);
    }
    return "";
  };

  return [...list].sort((a, b) =>
    resolve(a).localeCompare(resolve(b), undefined, {
      sensitivity: "base",
      numeric: true,
    })
  );
}
