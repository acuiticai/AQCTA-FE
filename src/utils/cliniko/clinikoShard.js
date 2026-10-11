/**
 * Cliniko shard helpers — API keys end with -{shard} e.g. ...-au5
 * @see https://docs.api.cliniko.com/guides/urls
 */

export const CLINIKO_SHARD_OPTIONS = [
  { value: "au1", label: "AU1 (Australia)" },
  { value: "au2", label: "AU2 (Australia)" },
  { value: "au3", label: "AU3 (Australia)" },
  { value: "au4", label: "AU4 (Australia)" },
  { value: "au5", label: "AU5 (Australia)" },
  { value: "uk1", label: "UK1 (United Kingdom)" },
  { value: "uk2", label: "UK2 (United Kingdom)" },
  { value: "uk3", label: "UK3 (United Kingdom)" },
  { value: "ca1", label: "CA1 (Canada)" },
  { value: "eu1", label: "EU1 (Europe)" },
];

const SHARD_PATTERN = /^[a-z]{2}\d{1,2}$/i;
const KEY_SUFFIX_PATTERN = /-([a-z]{2}\d{1,2})$/i;

/** @param {string} apiKey */
export function parseShardFromApiKey(apiKey) {
  const key = String(apiKey || "").trim();
  const match = key.match(KEY_SUFFIX_PATTERN);
  if (!match) return null;
  const shard = match[1].toLowerCase();
  return SHARD_PATTERN.test(shard) ? shard : null;
}

/**
 * Prefer shard embedded in the API key; fall back to user selection or au1.
 * @param {string} apiKey
 * @param {string} [selectedShard]
 */
export function resolveClinikoShard(apiKey, selectedShard) {
  const fromKey = parseShardFromApiKey(apiKey);
  if (fromKey) return fromKey;
  const selected = String(selectedShard || "")
    .trim()
    .toLowerCase();
  if (selected && SHARD_PATTERN.test(selected)) return selected;
  return "au1";
}

/** @param {string} shard */
export function isValidClinikoShard(shard) {
  return SHARD_PATTERN.test(String(shard || "").trim());
}

/**
 * @param {string} apiKey
 * @param {string} selectedShard
 * @param {(key: string, fallback: string, opts?: object) => string} [translate]
 * @returns {string | null} Warning when dropdown disagrees with key suffix
 */
export function shardMismatchWarning(apiKey, selectedShard, translate) {
  const fromKey = parseShardFromApiKey(apiKey);
  const selected = String(selectedShard || "")
    .trim()
    .toLowerCase();
  if (fromKey && selected && fromKey !== selected) {
    const from = fromKey.toUpperCase();
    const selectedUpper = selected.toUpperCase();
    if (typeof translate === "function") {
      return translate(
        "shardMismatch",
        `Your API key is for shard ${from}. Using ${from} (not ${selectedUpper}).`,
        { from, selected: selectedUpper },
      );
    }
    return `Your API key is for shard ${from}. Using ${from} (not ${selectedUpper}).`;
  }
  return null;
}
