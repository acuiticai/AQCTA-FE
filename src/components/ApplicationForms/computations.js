/**
 * Client-side twin of the server's computations in
 * AQCTA-BE/ApplicationForms/computations.js (+ feeLines.js).
 *
 * The server is authoritative — what it computes is what gets stamped on the
 * PDF and emailed. This exists only so totals move as the user types, instead
 * of staying at whatever the last save returned. Keep the two in step; a
 * divergence shows up as an on-screen figure that changes the moment you save.
 */

const LEGACY_FEE_KEYS = [
  "fee_1",
  "fee_2",
  "fee_3",
  "fee_4",
  "fee_5",
  "fee_6",
  "fee_7",
];

const STAGE2_ITEM_CODES = new Set([
  "PCI-FEE-04",
  "PCI-FEE-05",
  "AQCTA-FEE-04",
  "AQCTA-FEE-05",
]);

/** Parses a money entry; anything unparseable counts as zero, never NaN. */
const money = (value) => {
  const n = Number(String(value ?? "").replace(/[^0-9.-]/g, ""));
  return Number.isFinite(n) ? n : 0;
};

const formatMoney = (n) =>
  Number(n || 0).toLocaleString("en-MY", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

const quotationStageFor = (itemCode, key) => {
  const code = String(itemCode || "").trim();
  const normalized = code.replace(/^PCI-FEE-/i, "AQCTA-FEE-");
  if (STAGE2_ITEM_CODES.has(code) || STAGE2_ITEM_CODES.has(normalized)) return 2;
  if (key === "fee_4" || key === "fee_5") return 2;
  return 1;
};

const normalizeFeeLines = (values = {}) => {
  const raw = values.feeLines;
  if (Array.isArray(raw) && raw.length) {
    return raw
      .map((row, index) => {
        if (!row || typeof row !== "object") return null;
        const itemId = String(row.itemId || row._id || "").trim();
        const itemCode = String(row.itemCode || "").trim();
        const name = String(row.name || row.label || "").trim();
        if (!itemId && !itemCode && !name) return null;
        return {
          itemId,
          itemCode,
          name: name || itemCode || `Fee ${index + 1}`,
          amount:
            row.amount === undefined || row.amount === null
              ? ""
              : String(row.amount),
          quotationStage:
            Number(row.quotationStage) === 2
              ? 2
              : quotationStageFor(itemCode),
        };
      })
      .filter(Boolean);
  }

  return LEGACY_FEE_KEYS.map((key) => {
    const amount = values[key];
    if (amount === undefined || amount === null || String(amount).trim() === "") {
      return null;
    }
    return {
      itemId: "",
      itemCode: key.replace("fee_", "AQCTA-FEE-0"),
      name: key,
      amount: String(amount),
      quotationStage: quotationStageFor("", key),
    };
  }).filter(Boolean);
};

const subtotalOf = (values) =>
  normalizeFeeLines(values).reduce((sum, line) => sum + money(line.amount), 0);

/** Never exceeds the subtotal and never goes negative. */
const discountOf = (values) => {
  const subtotal = subtotalOf(values);
  const type = String(values.discountType || "None");
  const raw = money(values.discountValue);
  if (type === "None" || raw <= 0) return 0;
  const amount = type === "Percentage" ? (subtotal * raw) / 100 : raw;
  return Math.min(Math.max(amount, 0), subtotal);
};

const COSTING = {
  subtotal: (v) => formatMoney(subtotalOf(v)),
  discountAmount: (v) => {
    const amount = discountOf(v);
    return amount > 0 ? formatMoney(amount) : "";
  },
  grandTotal: (v) => formatMoney(subtotalOf(v) - discountOf(v)),
};

const staffCostOf = (values) => {
  const raw = values.feeLines;
  if (!Array.isArray(raw)) return 0;
  return raw.reduce((sum, line) => {
    if (!line || typeof line !== "object") return sum;
    const cost = money(line.manhourCost);
    const hours = money(line.hours);
    if (
      String(line.manhourCost ?? "").trim() !== "" ||
      String(line.hours ?? "").trim() !== ""
    ) {
      return sum + cost * hours;
    }
    return sum + money(line.amount);
  }, 0);
};

const roundNearest5 = (n) => Math.round(money(n) / 5) * 5;

const INSPECTION_COSTING = (() => {
  const equipmentOf = (values) => {
    const unit = money(values.equipmentCost);
    const hours = money(values.equipmentHours);
    const util = money(values.expectedUtilization) || 1;
    if (unit <= 0 || hours <= 0) return 0;
    return (unit * hours) / util;
  };

  const directOf = (values) =>
    staffCostOf(values) +
    money(values.materialCost) +
    money(values.utilityCost) +
    equipmentOf(values);

  const overheadOf = (values) => directOf(values) * 0.5;

  const totalCostOf = (values) =>
    directOf(values) + overheadOf(values) + money(values.reimbursableCost);

  const profitOf = (values) => {
    const type = String(values.profitMarginType || "None");
    const raw = money(values.profitMarginValue);
    if (type === "None" || raw <= 0) return 0;
    const base = totalCostOf(values);
    if (type === "Percentage") return (base * raw) / 100;
    return raw;
  };

  const proposedOf = (values) => totalCostOf(values) + profitOf(values);
  const roundedOf = (values) => roundNearest5(proposedOf(values));
  const finalOf = (values) => {
    const override = String(values.finalPrice ?? "").trim();
    if (override !== "") return money(override);
    return roundedOf(values);
  };
  const profitPercentOf = (values) => {
    const type = String(values.profitMarginType || "None");
    if (type === "Percentage") return money(values.profitMarginValue);
    const base = totalCostOf(values);
    const profit = profitOf(values);
    if (base <= 0 || profit <= 0) return 0;
    return (profit / base) * 100;
  };

  return {
    staffCostTotal: (v) => formatMoney(staffCostOf(v)),
    materialCostDisplay: (v) => formatMoney(money(v.materialCost)),
    utilityCostDisplay: (v) => formatMoney(money(v.utilityCost)),
    reimbursableDisplay: (v) => formatMoney(money(v.reimbursableCost)),
    equipmentTotal: (v) => formatMoney(equipmentOf(v)),
    directCostTotal: (v) => formatMoney(directOf(v)),
    overheadCost: (v) => formatMoney(overheadOf(v)),
    totalCost: (v) => formatMoney(totalCostOf(v)),
    profitAmount: (v) => formatMoney(profitOf(v)),
    profitPercentDisplay: (v) => {
      const p = profitPercentOf(v);
      return p > 0 ? `${p.toFixed(2)}%` : "";
    },
    proposedPrice: (v) => formatMoney(proposedOf(v)),
    roundedPrice: (v) => formatMoney(roundedOf(v)),
    finalPriceDisplay: (v) => formatMoney(finalOf(v)),
  };
})();

const BY_FORM = {
  "FOR-01-06": COSTING,
  "FOR-06-02": INSPECTION_COSTING,
};

/**
 * Recomputes a form's derived values over the current entries.
 * Returns the values unchanged for forms that derive nothing.
 */
export const applyComputations = (formKey, values = {}) => {
  const computations = BY_FORM[String(formKey || "").trim()];
  if (!computations) return values;

  const next = { ...values };
  for (const [key, compute] of Object.entries(computations)) {
    try {
      next[key] = compute(next);
    } catch {
      next[key] = "";
    }
  }
  return next;
};

export default applyComputations;
