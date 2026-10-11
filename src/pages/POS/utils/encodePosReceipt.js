import ReceiptPrinterEncoder from "@point-of-sale/receipt-printer-encoder";

const money = (value, currency = "RM") =>
  `${currency} ${Number(value || 0).toFixed(2)}`;

const formatDate = (value) => {
  if (!value) return "";
  try {
    return new Date(value).toLocaleString([], {
      year: "numeric",
      month: "short",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch (_) {
    return String(value);
  }
};

const normalizeAddress = (business) => {
  if (!business) return "";
  if (typeof business.address === "string" && business.address.trim())
    return business.address.trim();
  const primary = Array.isArray(business.addresses)
    ? business.addresses[0]
    : null;
  if (!primary) return "";
  return [
    primary.addressLine1,
    primary.addressLine2,
    [primary.city, primary.state].filter(Boolean).join(", "),
    primary.zipCode,
    primary.country,
  ]
    .map((p) => (p || "").trim())
    .filter(Boolean)
    .join(", ");
};

export function encodePosReceipt({
  order,
  business = {},
  currency = "RM",
  printerModel = "generic-escpos",
  columns = 42,
} = {}) {
  if (!order) return null;

  const items = Array.isArray(order.items) ? order.items : [];
  const payments = Array.isArray(order.payments) ? order.payments : [];

  const bizName = (
    business?.name ||
    order?.businessName ||
    "Your Business"
  ).toUpperCase();
  const bizAddr = normalizeAddress(business);
  const bizContact = [business?.tel || business?.phone, business?.email]
    .filter(Boolean)
    .join(" | ");
  const tableLabel = order.table?.tableNumber
    ? `Table ${order.table.label || order.table.tableNumber}`
    : "Walk-in";
  const customerName =
    order.customer?.basicInformation?.customerDisplayName ||
    order.customer?.basicInformation?.primaryContact?.firstName ||
    "";

  const encoder = new ReceiptPrinterEncoder({ printerModel, columns });

  // Column layout helpers
  const halfW = Math.floor(columns / 2);
  const labelValueCols = [
    { width: halfW, align: "left" },
    { width: columns - halfW, align: "right" },
  ];
  const totalsCols = [
    { width: columns - 12, align: "left" },
    { width: 12, align: "right" },
  ];
  const nameW = columns - 18; // 24 for 42-col paper
  const itemCols = [
    { width: nameW, align: "left" },
    { width: 4, align: "right" },
    { width: 7, align: "right" },
    { width: 7, align: "right" },
  ];

  let e = encoder.initialize();

  // --- Header ---
  e = e.align("center").bold(true).line(bizName).bold(false);
  e = e.line("Sales Receipt");
  if (bizAddr) e = e.line(bizAddr);
  if (bizContact) e = e.line(bizContact);
  e = e.rule().newline();

  // --- Order info ---
  e = e.align("center").bold(true).line(order.orderNumber || "").bold(false);
  e = e.line(tableLabel);
  e = e.line(formatDate(order.completedAt || order.createdAt));
  e = e.newline();

  const metaRows = [
    ...(customerName ? [["Customer", customerName]] : []),
    ...(order.cashierName ? [["Cashier", order.cashierName]] : []),
    ...(order.salesChannelName || order.salesChannel?.name
      ? [["Sales Channel", order.salesChannelName || order.salesChannel?.name]]
      : []),
    ...(order.salesOrderNumber ? [["Ref", order.salesOrderNumber]] : []),
  ];
  if (metaRows.length) {
    e = e.align("left").table(labelValueCols, metaRows);
  }

  e = e.rule();

  // --- Items ---
  e = e.align("left").table(itemCols, [
    ["Item", "Qty", "Rate", "Amt"],
    ...items.map((item) => [
      String(item?.name || "Item"),
      String(Number(item?.quantity || 0)),
      Number(item?.rate || 0).toFixed(2),
      Number(item?.amount || 0).toFixed(2),
    ]),
  ]);

  e = e.rule();

  // --- Totals ---
  const totRows = [["Subtotal", money(order.subtotal, currency)]];

  if (Number(order.discountAmount || 0) > 0) {
    const label =
      order.discountType === "percentage"
        ? `Discount (${order.discountValue}%)`
        : "Discount";
    totRows.push([label, `-${money(order.discountAmount, currency)}`]);
  }

  if (Number(order.serviceChargeAmount || 0) > 0) {
    const label =
      order.serviceChargeType === "fixed"
        ? `Svc Charge (${Number(order.serviceChargeValue ?? 0).toFixed(2)})`
        : `Svc Charge (${order.serviceChargeValue ?? 0}%)`;
    totRows.push([label, money(order.serviceChargeAmount, currency)]);
  }

  const taxBreakdown =
    Array.isArray(order.taxBreakdown) && order.taxBreakdown.length > 0
      ? order.taxBreakdown
      : Number(order.taxAmount || 0) > 0
        ? [
            {
              taxRate: order.taxRate ?? 0,
              taxName: order.taxName || "",
              taxableAmount: Number(order.taxableAmount || 0),
              taxAmount: Number(order.taxAmount || 0),
            },
          ]
        : [];

  if (Number(order.nonTaxableAmount || 0) > 0 && taxBreakdown.length > 0) {
    totRows.push([
      "Non-Taxable Sales",
      money(order.nonTaxableAmount, currency),
    ]);
  }

  for (const bd of taxBreakdown) {
    totRows.push([
      `Taxable (${bd.taxName || `${bd.taxRate}%`})`,
      money(bd.taxableAmount, currency),
    ]);
    totRows.push([
      bd.taxName || `Tax ${bd.taxRate}%`,
      money(bd.taxAmount, currency),
    ]);
  }

  e = e.table(totalsCols, totRows);

  // Grand total — bold + larger
  e = e
    .rule()
    .bold(true)
    .table(totalsCols, [["TOTAL", money(order.total, currency)]])
    .bold(false)
    .rule();

  // --- Payments ---
  const cashTendered = Number(order.cashTendered || 0);
  const totalValue = Number(order.total || 0);
  if (payments.length > 0 || cashTendered > totalValue) {
    const payRows = payments.map((p) => {
      const method =
        (p.paymentMethodName || p.method || "Payment") +
        (p.reference ? ` (${p.reference})` : "");
      return [method, money(p.amount, currency)];
    });
    if (cashTendered > totalValue) {
      payRows.push(["Cash Tendered", money(cashTendered, currency)]);
      payRows.push(["Change", money(order.changeGiven, currency)]);
    }
    e = e.table(totalsCols, payRows).rule();
  }

  // --- Footer ---
  e = e
    .align("center")
    .bold(true)
    .line("Thank you for your visit!")
    .bold(false)
    .line(bizName)
    .newline()
    .cut();

  return e.encode();
}
