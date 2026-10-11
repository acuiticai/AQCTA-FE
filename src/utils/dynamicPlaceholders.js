/**
 * Dynamic placeholder parser (frontend mirror of PCI-BE/utils/dynamicPlaceholders.js).
 *
 * Resolves date-driven placeholders embedded inside arbitrary user text so the
 * Create / Edit / View screens render the same final values that the backend
 * will emit when the next invoice is generated.
 *
 * Grammar:
 *   - Single: %(token)%  e.g. %(d)% %(m)% %(y+1)%
 *   - Compound: %(d)(m)(y)%  → 25/5/2026  (also %( (d)(m)(y) )% with explicit parens)
 *     e.g. (%(d)(m)(y)% - %(d)(m)(y+1)%) → (25/5/2026 - 25/5/2027)
 *   %(d)% %(dd)% %(m)% %(mm)% %(mon)% %(month)% %(y)% %(yy)% %(yyyy)%
 *   %(d±N)% %(m±N)% %(y±N)%
 *   %(today)% %(today:FMT)%   (FMT = DD, MM, YYYY, YY, MMM, MMMM)
 *
 * Context tokens (when options.context is provided):
 *   %(invoice_number)% %(customer_name)% %(business_name)%
 *   %(currency)% %(amount)% %(grand_total)%
 *
 * When `options.dateFormat` is provided, any compound placeholder made up
 * entirely of date tokens (e.g. %(d)(m)(y)%, %(d)(m)(y+1)%) is rendered
 * with that pattern instead of the default `dd/mm/yyyy` join. The pattern
 * matches Configuration > Date Format (DD/MM/YYYY, MM-DD-YYYY,
 * DD MMM YYYY, MMMM DD, YYYY, …) so the template output matches the rest
 * of the app.
 *
 * Unknown placeholders are returned unchanged.
 */

/**
 * Consume one %( … )% from `text` starting at `%(` (index must point at `%` of `%(`).
 * Non-greedy regex fails on compound groups like %(d)(m)(y)% (it closes at `(y)%`).
 */
function consumeNextPlaceholderSlice(text, openPercentIdx) {
  if (
    text[openPercentIdx] !== "%" ||
    text[openPercentIdx + 1] !== "(" ||
    openPercentIdx + 2 >= text.length
  ) {
    return null;
  }
  const innerStart = openPercentIdx + 2;

  /** Starts with '(' → walk balanced parens until we hit `)%` immediately after closing. */
  if (text[innerStart] === "(") {
    let depth = 0;
    let j = innerStart;
    for (; j < text.length; j++) {
      const ch = text[j];
      if (ch === "(") depth++;
      else if (ch === ")") {
        depth--;
        if (
          depth === 0 &&
          j + 1 < text.length &&
          text[j + 1] === "%"
        ) {
          const inner = text.slice(innerStart, j + 1);
          const endExclusive = j + 2;
          return { inner, start: openPercentIdx, endExclusive };
        }
      }
    }
    return null;
  }

  const close = text.indexOf(")%", innerStart);
  if (close === -1) return null;
  const inner = text.slice(innerStart, close);
  return {
    inner,
    start: openPercentIdx,
    endExclusive: close + 2,
  };
}

function substituteAllPlaceholders(text, referenceDate, context, dateFormat) {
  let out = "";
  let scan = 0;
  while (scan < text.length) {
    const open = text.indexOf("%(", scan);
    if (open === -1) {
      out += text.slice(scan);
      break;
    }
    out += text.slice(scan, open);
    const blk = consumeNextPlaceholderSlice(text, open);
    if (!blk) {
      out += "%(";
      scan = open + 2;
      continue;
    }
    const parts = splitInnerPlaceholderSegments(blk.inner);
    if (!parts.length) {
      out += text.slice(blk.start, blk.endExclusive);
      scan = blk.endExclusive;
      continue;
    }

    /**
     * Compound date expressions like %(d)(m)(y)% or %(d)(m)(y+1)% are the
     * standard "date" template (Zoho-style). When the global Configuration
     * has a `dateFormat` (e.g. "MM-DD-YYYY", "DD MMM YYYY") we honor it so
     * (%(d)(m)(y)% - %(d)(m)(y+1)%) renders as "26 May 2026 - 26 May 2027"
     * or "05-26-2026 - 05-26-2027" instead of the default "26/5/2026".
     */
    if (parts.length >= 2 && dateFormat) {
      const parsedTokens = parts.map(parseDateOnlyToken);
      if (parsedTokens.every((t) => t !== null)) {
        const composed = composeDateFromTokens(referenceDate, parsedTokens);
        out += formatDateWithPattern(composed, dateFormat);
        scan = blk.endExclusive;
        continue;
      }
    }

    const vals = parts.map((p) => resolveToken(p, referenceDate, context));
    out += vals.some((r) => r == null)
      ? text.slice(blk.start, blk.endExclusive)
      : vals.join("/");
    scan = blk.endExclusive;
  }
  return out;
}

/**
 * Recognize a single segment from a compound placeholder as a pure date
 * token (no context tokens, no `today:FMT`). Returns `{ unit, offset }` or
 * `null`. `unit` is normalized to one of "d" | "m" | "y" so callers can
 * shift the matching component of the reference date.
 */
function parseDateOnlyToken(rawToken) {
  if (rawToken == null) return null;
  const token = String(rawToken).trim();
  if (!token) return null;

  const offsetMatch = token.match(/^([dDmMyY])\s*([+-])\s*(\d+)$/);
  if (offsetMatch) {
    const sign = offsetMatch[2] === "-" ? -1 : 1;
    return {
      unit: offsetMatch[1].toLowerCase(),
      offset: parseInt(offsetMatch[3], 10) * sign,
    };
  }

  const lower = token.toLowerCase();
  if (lower === "d" || lower === "dd") return { unit: "d", offset: 0 };
  if (
    lower === "m" ||
    lower === "mm" ||
    lower === "mon" ||
    lower === "month"
  ) {
    return { unit: "m", offset: 0 };
  }
  if (lower === "y" || lower === "yy" || lower === "yyyy") {
    return { unit: "y", offset: 0 };
  }
  return null;
}

/**
 * Build a Date from the reference date by applying the per-unit offsets
 * carried by the compound's tokens. Each unit is shifted independently
 * (year+1 keeps the same day/month) and JS normalizes overflow naturally.
 */
function composeDateFromTokens(referenceDate, tokens) {
  let day = referenceDate.getDate();
  let month = referenceDate.getMonth();
  let year = referenceDate.getFullYear();
  for (const t of tokens) {
    if (!t || !t.offset) continue;
    if (t.unit === "d") day += t.offset;
    else if (t.unit === "m") month += t.offset;
    else if (t.unit === "y") year += t.offset;
  }
  return new Date(year, month, day);
}

/**
 * Format a Date using a Configuration-style pattern (DD/MM/YYYY,
 * MM-DD-YYYY, DD MMM YYYY, MMMM DD, YYYY, etc.). Mirrors the token set
 * exposed in `pages/Configuration/Configurations.jsx` so every option in
 * the dropdown is rendered correctly here too.
 */
function formatDateWithPattern(date, pattern) {
  const fmt = String(pattern || "").trim();
  if (!fmt) {
    return `${pad2(date.getDate())}/${pad2(date.getMonth() + 1)}/${date.getFullYear()}`;
  }
  const map = {
    DD: pad2(date.getDate()),
    D: String(date.getDate()),
    MMMM: LONG_MONTHS[date.getMonth()],
    MMM: SHORT_MONTHS[date.getMonth()],
    MM: pad2(date.getMonth() + 1),
    M: String(date.getMonth() + 1),
    YYYY: String(date.getFullYear()),
    YY: String(date.getFullYear()).slice(-2),
  };
  return fmt.replace(/YYYY|YY|MMMM|MMM|MM|M|DD|D/g, (m) => map[m] ?? m);
}

const SHORT_MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];
const LONG_MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

function toDate(value) {
  if (!value) return new Date();
  if (value instanceof Date) {
    return Number.isNaN(value.getTime())
      ? new Date()
      : new Date(value.getTime());
  }
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? new Date() : d;
}

function pad2(n) {
  const v = Number(n);
  return (v < 10 ? "0" : "") + String(v);
}

function shiftByUnit(base, unit, amount) {
  const d = new Date(base.getTime());
  const n = Number(amount) || 0;
  if (unit === "d") d.setDate(d.getDate() + n);
  else if (unit === "m") d.setMonth(d.getMonth() + n);
  else if (unit === "y") d.setFullYear(d.getFullYear() + n);
  return d;
}

function resolveTodayFormat(format, date) {
  const fmt = String(format || "").trim();
  const map = {
    DD: pad2(date.getDate()),
    D: String(date.getDate()),
    MM: pad2(date.getMonth() + 1),
    M: String(date.getMonth() + 1),
    MMMM: LONG_MONTHS[date.getMonth()],
    MMM: SHORT_MONTHS[date.getMonth()],
    YYYY: String(date.getFullYear()),
    YY: String(date.getFullYear()).slice(-2),
  };
  if (!fmt) {
    return `${pad2(date.getDate())}/${pad2(date.getMonth() + 1)}/${date.getFullYear()}`;
  }
  return fmt.replace(/YYYY|YY|MMMM|MMM|MM|M|DD|D/g, (m) => map[m] ?? m);
}

function resolveToken(rawToken, referenceDate, context) {
  if (rawToken == null) return null;
  const token = String(rawToken).trim();
  if (!token) return null;

  if (/^today(?::(.+))?$/i.test(token)) {
    const match = token.match(/^today(?::(.+))?$/i);
    return resolveTodayFormat(match[1] || "", referenceDate);
  }

  const offset = token.match(/^([dDmMyY])\s*([+-])\s*(\d+)$/);
  if (offset) {
    const unit = offset[1].toLowerCase();
    const sign = offset[2] === "-" ? -1 : 1;
    const amount = parseInt(offset[3], 10) * sign;
    const shifted = shiftByUnit(referenceDate, unit, amount);
    if (unit === "d") return String(shifted.getDate());
    if (unit === "m") return String(shifted.getMonth() + 1);
    return String(shifted.getFullYear());
  }

  const simpleDate = {
    d: () => String(referenceDate.getDate()),
    dd: () => pad2(referenceDate.getDate()),
    m: () => String(referenceDate.getMonth() + 1),
    mm: () => pad2(referenceDate.getMonth() + 1),
    mon: () => SHORT_MONTHS[referenceDate.getMonth()],
    month: () => LONG_MONTHS[referenceDate.getMonth()],
    y: () => String(referenceDate.getFullYear()),
    yy: () => String(referenceDate.getFullYear()).slice(-2),
    yyyy: () => String(referenceDate.getFullYear()),
  };
  if (Object.prototype.hasOwnProperty.call(simpleDate, token.toLowerCase())) {
    return simpleDate[token.toLowerCase()]();
  }

  if (context && typeof context === "object") {
    const ctxKey = token.toLowerCase();
    const ctxMap = {
      invoice_number: context.invoice_number ?? context.invoiceNumber,
      customer_name: context.customer_name ?? context.customerName,
      business_name: context.business_name ?? context.businessName,
      currency: context.currency,
      amount: context.amount ?? context.grand_total ?? context.grandTotal,
      grand_total:
        context.grand_total ?? context.grandTotal ?? context.amount,
    };
    if (
      Object.prototype.hasOwnProperty.call(ctxMap, ctxKey) &&
      ctxMap[ctxKey] != null &&
      ctxMap[ctxKey] !== ""
    ) {
      return String(ctxMap[ctxKey]);
    }
  }

  return null;
}

function splitInnerPlaceholderSegments(innerRaw) {
  const inner = String(innerRaw ?? "").trim();
  if (!inner) return [];
  if (inner.startsWith("(")) {
    const segments = [];
    const pairRe = /\(([^)]*)\)/g;
    let m;
    while ((m = pairRe.exec(inner)) !== null) {
      const piece = String(m[1] ?? "").trim();
      if (piece) segments.push(piece);
    }
    if (segments.length > 0) return segments;
  }
  if (/\)\(/.test(inner)) {
    return inner
      .split(/\)\(/)
      .map((s) => s.trim())
      .filter(Boolean);
  }
  return [inner];
}

/**
 * Replace every %( … )% group (simple or compound) inside a single string.
 */
export function parseDynamicPlaceholders(text, options = {}) {
  if (typeof text !== "string" || text.indexOf("%(") === -1) return text;
  const referenceDate = toDate(options.referenceDate);
  const context = options.context || null;
  const dateFormat = options.dateFormat || null;
  return substituteAllPlaceholders(text, referenceDate, context, dateFormat);
}

/**
 * Walk an object/array and parse every string leaf. Dates and Buffer-like
 * values are left untouched so we don't accidentally serialize them.
 */
export function parsePlaceholdersDeep(data, options = {}, seen) {
  if (data == null) return data;
  if (typeof data === "string") return parseDynamicPlaceholders(data, options);
  if (typeof data !== "object") return data;
  if (data instanceof Date) return data;

  const cycleGuard = seen instanceof WeakSet ? seen : new WeakSet();
  if (cycleGuard.has(data)) return data;
  cycleGuard.add(data);

  if (Array.isArray(data)) {
    return data.map((item) =>
      parsePlaceholdersDeep(item, options, cycleGuard),
    );
  }

  const out = {};
  for (const key of Object.keys(data)) {
    out[key] = parsePlaceholdersDeep(data[key], options, cycleGuard);
  }
  return out;
}

/**
 * Quick boolean check for previews / hint banners — true when the text holds
 * at least one %(...)% group.
 */
export function hasDynamicPlaceholders(text) {
  if (typeof text !== "string") return false;
  return /%\([\s\S]*?\)%/.test(text);
}

export default parseDynamicPlaceholders;
