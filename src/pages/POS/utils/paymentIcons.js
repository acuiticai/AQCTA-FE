import {
  Banknote,
  CreditCard,
  Smartphone,
  Wallet,
  QrCode,
  Landmark,
  Coins,
} from "lucide-react";

// Static Tailwind class presets per color. Keeping classes fully-literal here
// is important because Tailwind's JIT only picks up complete class names that
// appear verbatim in source files — dynamic strings like `bg-${color}-50`
// would be purged in production builds.
const PRESETS = {
  emerald: {
    iconText: "text-emerald-600",
    iconBg: "bg-emerald-50",
    activeBg: "bg-emerald-50",
    activeText: "text-emerald-700",
    activeBorder: "border-emerald-300",
    checkText: "text-emerald-600",
  },
  blue: {
    iconText: "text-blue-600",
    iconBg: "bg-blue-50",
    activeBg: "bg-blue-50",
    activeText: "text-blue-700",
    activeBorder: "border-blue-300",
    checkText: "text-blue-600",
  },
  indigo: {
    iconText: "text-indigo-600",
    iconBg: "bg-indigo-50",
    activeBg: "bg-indigo-50",
    activeText: "text-indigo-700",
    activeBorder: "border-indigo-300",
    checkText: "text-indigo-600",
  },
  cyan: {
    iconText: "text-cyan-600",
    iconBg: "bg-cyan-50",
    activeBg: "bg-cyan-50",
    activeText: "text-cyan-700",
    activeBorder: "border-cyan-300",
    checkText: "text-cyan-600",
  },
  teal: {
    iconText: "text-teal-600",
    iconBg: "bg-teal-50",
    activeBg: "bg-teal-50",
    activeText: "text-teal-700",
    activeBorder: "border-teal-300",
    checkText: "text-teal-600",
  },
  slate: {
    iconText: "text-slate-600",
    iconBg: "bg-slate-50",
    activeBg: "bg-slate-50",
    activeText: "text-slate-700",
    activeBorder: "border-slate-300",
    checkText: "text-slate-600",
  },
  gray: {
    iconText: "text-gray-600",
    iconBg: "bg-gray-50",
    activeBg: "bg-gray-50",
    activeText: "text-gray-700",
    activeBorder: "border-gray-300",
    checkText: "text-gray-600",
  },
};

// Map a payment method to a Lucide icon + brand color preset. Resolution is
// based on the method's name / code / type so tenants can name methods however
// they like (e.g. "Visa", "TNG eWallet", "FPX", "Grab Pay") and still get the
// correct glyph in the POS UI and receipts.
const MATCHERS = [
  { test: /(visa|master|amex|credit|debit|\bcard\b)/i, icon: CreditCard, color: "blue" },
  { test: /(tng|touch ?n ?go|grab|boost|shopee ?pay|ewallet|e-wallet|wallet)/i, icon: Wallet, color: "indigo" },
  { test: /(fpx|online banking|bank transfer|duitnow transfer|ibg|giro)/i, icon: Landmark, color: "cyan" },
  { test: /\b(qr|duitnow)\b/i, icon: QrCode, color: "teal" },
  { test: /(apple|google|samsung) ?pay/i, icon: Smartphone, color: "slate" },
  { test: /(cash|tunai|kas|money)/i, icon: Banknote, color: "emerald" },
];

export const getPaymentMethodIcon = (method) => {
  if (!method) {
    return {
      Icon: CreditCard,
      color: "gray",
      classes: PRESETS.gray,
      label: "Payment",
    };
  }
  const label =
    (typeof method === "string"
      ? method
      : method.name ||
        method.paymentMethodName ||
        method.code ||
        method.type) || "Payment";
  const searchText = [
    method?.name,
    method?.paymentMethodName,
    method?.code,
    method?.description,
    method?.type,
  ]
    .filter(Boolean)
    .join(" ");

  for (const m of MATCHERS) {
    if (m.test.test(searchText) || m.test.test(label)) {
      return {
        Icon: m.icon,
        color: m.color,
        classes: PRESETS[m.color] || PRESETS.gray,
        label,
      };
    }
  }

  const type = String(method?.type || "").toLowerCase();
  if (type === "cash") {
    return {
      Icon: Coins,
      color: "emerald",
      classes: PRESETS.emerald,
      label,
    };
  }
  if (type === "online") {
    return { Icon: CreditCard, color: "blue", classes: PRESETS.blue, label };
  }
  return { Icon: CreditCard, color: "gray", classes: PRESETS.gray, label };
};

export default getPaymentMethodIcon;
