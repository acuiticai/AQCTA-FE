import { formatAmount } from "@/components/formatAmount";

const isConversionCurrencyPlaceholder = (v) => {
  const s = String(v ?? "").trim().toUpperCase();
  return !s || s === "N/A" || s === "—" || s === "-";
};

/**
 * One-line summary for payment conversionDetails, or null if data is unusable
 * (empty object, missing amounts/currencies, placeholder currencies — avoids bare "=" UI).
 */
export const getCurrencyConversionDisplayLine = (cd) => {
  if (!cd || typeof cd !== "object") return null;
  const nonEmpty = Object.keys(cd).filter((k) => {
    const v = cd[k];
    return v != null && v !== "";
  });
  if (nonEmpty.length === 0) return null;

  const fromCur = [cd.fromCurrency, cd.originalCurrency].find(
    (c) => c != null && String(c).trim() !== ""
  );
  const toCur = [cd.toCurrency, cd.convertedCurrency, cd.targetCurrency].find(
    (c) => c != null && String(c).trim() !== ""
  );

  if (
    isConversionCurrencyPlaceholder(fromCur) ||
    isConversionCurrencyPlaceholder(toCur)
  ) {
    return null;
  }

  const fromAmtRaw = cd.paidAmount ?? cd.originalAmount;
  const toAmtRaw = cd.requiredAmount ?? cd.convertedAmount;

  if (
    fromAmtRaw === undefined ||
    fromAmtRaw === null ||
    fromAmtRaw === "" ||
    toAmtRaw === undefined ||
    toAmtRaw === null ||
    toAmtRaw === ""
  ) {
    return null;
  }

  const fromAmt = Number(fromAmtRaw);
  const toAmt = Number(toAmtRaw);
  if (Number.isNaN(fromAmt) || Number.isNaN(toAmt)) {
    return null;
  }

  return `${fromCur} ${formatAmount(fromAmt)} = ${toCur} ${formatAmount(toAmt)}`;
};
