export const calculateTotalClaimableAmount = (items) => {
  if (!items || !Array.isArray(items)) return 0
  return items.reduce((total, item) => total + (item.claimableAmount || 0), 0)
}

// Helper function to extract currency symbol from currency name
const extractCurrencySymbol = (currencyName) => {
  if (!currencyName) return null
  // Extract symbol from format like "United Arab Emirates (AED)" -> "AED"
  const match = currencyName.match(/\(([A-Z]{3})\)$/)
  return match ? match[1] : currencyName
}

export const getUniqueCurrencies = (items) => {
  if (!items || !Array.isArray(items)) return []
  const currencies = items
    .map((item) => extractCurrencySymbol(item.currency?.name))
    .filter((currency) => currency)
  return [...new Set(currencies)]
}

// New helper: Get currency-wise totals
export const getCurrencyWiseTotals = (items) => {
  if (!items || !Array.isArray(items)) return {}

  const totals = {}
  items.forEach((item) => {
    const currency = extractCurrencySymbol(item.currency?.name)
    const amount = item.claimableAmount || 0

    if (currency) {
      totals[currency] = (totals[currency] || 0) + amount
    }
  })

  return totals
}

// New helper: Check if all items have the same currency
export const hasSingleCurrency = (items) => {
  const currencies = getUniqueCurrencies(items)
  return currencies.length <= 1
}

// New helper: Format amount with currency-aware logic
export const formatClaimAmount = (items, formatAmount) => {
  if (!items || !Array.isArray(items) || items.length === 0) {
    return formatAmount(0)
  }

  const currencies = getUniqueCurrencies(items)

  // If single currency or no currency info, show total
  if (currencies.length <= 1) {
    const total = calculateTotalClaimableAmount(items)
    return formatAmount(total)
  }

  // Multiple currencies - show currency-wise breakdown
  const currencyTotals = getCurrencyWiseTotals(items)
  return Object.entries(currencyTotals)
    .map(([currency, amount]) => `${formatAmount(amount)} ${currency}`)
    .join(" + ")
}
