import React from "react";
import { Document, Page, Text, View, StyleSheet, Image } from "@react-pdf/renderer";

const ACCENT      = "#0f172a";
const ACCENT_SOFT = "#1f2937";
const MUTED       = "#64748b";
const LINE        = "#e5e7eb";
const LINE_STRONG = "#cbd5e1";
const WHITE       = "#ffffff";
const RED         = "#dc2626";
const GREEN_BG    = "#ecfdf5";
const GREEN_TEXT  = "#047857";
const GRAY_BG     = "#f8fafc";
const SLATE_BG    = "#f1f5f9";

// 80mm thermal paper ≈ 226pt
const PW  = 226;
const PAD = 8;

const S = StyleSheet.create({
  page:        { fontFamily: "Helvetica", backgroundColor: WHITE, color: ACCENT },
  wrap:        { padding: PAD },

  // ── Brand ──────────────────────────────────────────────────────────────────
  brand:       { textAlign: "center", paddingBottom: 5, borderBottomWidth: 1, borderBottomStyle: "dashed", borderBottomColor: LINE, marginBottom: 4 },
  logo:        { width: 80, height: 30, alignSelf: "center", marginBottom: 3 },
  bizName:     { fontSize: 12, fontWeight: "bold", letterSpacing: 0.5, textAlign: "center", color: ACCENT },
  brandPill:   { alignSelf: "center", marginVertical: 4, paddingVertical: 3, paddingHorizontal: 10, borderRadius: 999, backgroundColor: ACCENT, color: WHITE, fontSize: 8, fontWeight: "bold", letterSpacing: 1 },
  bizMeta:     { fontSize: 8, color: MUTED, textAlign: "center", lineHeight: 1.4 },

  // ── Hero ───────────────────────────────────────────────────────────────────
  hero:        { marginVertical: 4, padding: 6, borderRadius: 5, backgroundColor: ACCENT, color: WHITE },
  heroTitle:   { fontSize: 8, letterSpacing: 2, fontWeight: "bold", textAlign: "center", color: WHITE, opacity: 0.85 },
  heroOrdNo:   { fontSize: 13, fontWeight: "bold", textAlign: "center", marginTop: 2, letterSpacing: 0.2, color: WHITE },
  heroPills:   { flexDirection: "row", justifyContent: "center", flexWrap: "wrap", gap: 3, marginTop: 4 },
  heroPill:    { paddingVertical: 2, paddingHorizontal: 6, borderRadius: 999, backgroundColor: "rgba(255,255,255,0.18)", fontSize: 8, fontWeight: "bold", letterSpacing: 0.3, color: WHITE },

  // ── Order meta ─────────────────────────────────────────────────────────────
  metaRow:     { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 1 },
  metaKey:     { color: MUTED, fontSize: 9, fontWeight: "bold", flexShrink: 0 },
  metaVal:     { fontSize: 9, fontWeight: "bold", color: ACCENT, textAlign: "right" },

  // ── Divider ────────────────────────────────────────────────────────────────
  divider:     { borderTopWidth: 1, borderTopStyle: "dashed", borderTopColor: LINE_STRONG, marginVertical: 4 },

  // ── Items table ────────────────────────────────────────────────────────────
  itemsHead:   { flexDirection: "row", paddingBottom: 5, borderBottomWidth: 1.5, borderBottomColor: LINE_STRONG, marginBottom: 2 },
  thItem:      { flex: 3, fontSize: 8, fontWeight: "bold", color: MUTED },
  thQty:       { width: 25, fontSize: 8, fontWeight: "bold", color: MUTED, textAlign: "center" },
  thRate:      { width: 38, fontSize: 8, fontWeight: "bold", color: MUTED, textAlign: "right" },
  thAmt:       { width: 42, fontSize: 8, fontWeight: "bold", color: MUTED, textAlign: "right" },

  itemRow:     { flexDirection: "row", paddingVertical: 2.5, borderBottomWidth: 1, borderBottomStyle: "dotted", borderBottomColor: LINE },
  tdName:      { flex: 3 },
  itemTitle:   { fontSize: 9, fontWeight: "bold", color: ACCENT },
  itemDisc:    { fontSize: 8, color: RED, marginTop: 1 },
  itemNote:    { fontSize: 8, color: ACCENT_SOFT, marginTop: 2, paddingVertical: 2, paddingHorizontal: 4, backgroundColor: GRAY_BG, fontStyle: "italic" },
  tdQty:       { width: 25, fontSize: 9, fontWeight: "bold", textAlign: "center", color: ACCENT },
  tdRate:      { width: 38, fontSize: 9, color: MUTED, textAlign: "right" },
  tdAmt:       { width: 42, fontSize: 9, fontWeight: "bold", color: ACCENT, textAlign: "right" },

  // ── Totals ─────────────────────────────────────────────────────────────────
  totals:      { marginTop: 4, padding: 6, backgroundColor: GRAY_BG, borderRadius: 4, borderWidth: 1, borderColor: LINE },
  totalRow:    { flexDirection: "row", justifyContent: "space-between", paddingVertical: 1.5 },
  totalKey:    { color: MUTED, fontSize: 9, fontWeight: "bold", flexShrink: 0 },
  totalVal:    { fontSize: 9, fontWeight: "bold", color: ACCENT, textAlign: "right" },
  totalValRed: { fontSize: 9, fontWeight: "bold", color: RED, textAlign: "right" },
  vatKey:      { color: MUTED, fontSize: 8, flexShrink: 0 },
  vatVal:      { fontSize: 8, color: MUTED, textAlign: "right" },

  // ── Grand total ────────────────────────────────────────────────────────────
  grand:       { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 3, padding: 8, backgroundColor: ACCENT, borderRadius: 6 },
  grandLabel:  { fontSize: 13, fontWeight: "bold", color: WHITE },
  grandValue:  { fontSize: 13, fontWeight: "bold", color: WHITE, textAlign: "right" },

  // ── Payments ───────────────────────────────────────────────────────────────
  payments:    { marginTop: 8 },
  payRow:      { flexDirection: "row", justifyContent: "space-between", paddingVertical: 2.5 },
  payKey:      { color: MUTED, fontWeight: "bold", flexShrink: 0, fontSize: 9 },
  payVal:      { fontWeight: "bold", color: ACCENT, textAlign: "right", fontSize: 9 },
  changeRow:   { flexDirection: "row", justifyContent: "space-between", paddingVertical: 4, paddingHorizontal: 7, backgroundColor: GREEN_BG, borderRadius: 4, marginTop: 3 },
  changeKey:   { color: GREEN_TEXT, fontWeight: "bold", fontSize: 9 },
  changeVal:   { color: GREEN_TEXT, fontWeight: "bold", textAlign: "right", fontSize: 9 },

  // ── Footer ─────────────────────────────────────────────────────────────────
  footer:      { marginTop: 6, textAlign: "center" },
  footerThanks: { fontSize: 11, fontWeight: "bold", color: ACCENT, marginBottom: 3, textAlign: "center" },
  footerBiz:   { fontSize: 9, color: MUTED, textAlign: "center" },
});

const money = (value, currency = "RM") =>
  `${currency} ${Number(value || 0).toFixed(2)}`;

const fmt = (value) => {
  if (!value) return "";
  try {
    return new Date(value).toLocaleString([], {
      year: "numeric", month: "short", day: "2-digit",
      hour: "2-digit", minute: "2-digit",
    });
  } catch (_) { return String(value); }
};

const normalizeAddress = (biz = {}) => {
  if (typeof biz.address === "string" && biz.address.trim()) return biz.address.trim();
  const p = Array.isArray(biz.addresses) ? biz.addresses[0] : null;
  if (!p) return "";
  return [p.addressLine1, p.addressLine2,
    [p.city, p.state].filter(Boolean).join(", "),
    p.zipCode, p.country,
  ].map((s) => (s || "").trim()).filter(Boolean).join(", ");
};

export const buildPosReceiptPdfDoc = ({
  order,
  business = {},
  logo = "",
  currency = "RM",
  footerMessage = "Thank you for your visit!",
} = {}) => {
  if (!order) return null;

  const items    = Array.isArray(order.items)    ? order.items    : [];
  const payments = Array.isArray(order.payments) ? order.payments : [];

  const customerName = order.customer?.basicInformation?.customerDisplayName ||
    order.customer?.basicInformation?.primaryContact?.firstName || "";
  const tableLabel = order.table?.tableNumber
    ? `Table ${order.table.label || order.table.tableNumber}` : "Walk-in";

  const bizName    = business?.name || order.businessName || "Your Business";
  const bizEmail   = business?.email || "";
  const bizTel     = business?.tel || business?.phone || "";
  const bizAddress = normalizeAddress(business);

  const hasDiscount      = Number(order.discountAmount     || 0) > 0;
  const hasServiceCharge = Number(order.serviceChargeAmount|| 0) > 0;
  const hasTax           = Number(order.taxAmount          || 0) > 0;
  const cashTendered     = Number(order.cashTendered       || 0);
  const totalValue       = Number(order.total              || 0);
  const hasChange        = cashTendered > totalValue;

  const taxLines = Array.isArray(order.taxBreakdown) && order.taxBreakdown.length > 0
    ? order.taxBreakdown
    : (hasTax ? [{ taxRate: order.taxRate ?? 0, taxName: order.taxName || "",
        taxableAmount: Number(order.taxableAmount || 0), taxAmount: Number(order.taxAmount || 0) }] : []);
  const nonTaxable = Number(order.nonTaxableAmount || 0);

  const noteCount = items.filter((i) => i.note).length;
  const PH = Math.max(
    Math.ceil((300 + items.length * 20 + noteCount * 14 +
      taxLines.length * 30 + payments.length * 16 + (hasChange ? 24 : 0)) * 1.35),
    400,
  );

  return (
    <Document>
      <Page size={[PW, PH]} style={S.page}>
        <View wrap={false} style={S.wrap}>

          {/* Brand */}
          <View style={S.brand}>
            {logo ? <Image src={logo} style={S.logo} /> : null}
            <Text style={S.bizName}>{bizName.toUpperCase()}</Text>
            <Text style={S.brandPill}>SALES RECEIPT</Text>
            {bizAddress ? <Text style={S.bizMeta}>{bizAddress}</Text> : null}
            {(bizTel || bizEmail)
              ? <Text style={S.bizMeta}>{[bizTel, bizEmail].filter(Boolean).join(" • ")}</Text>
              : null}
          </View>

          {/* Hero — no status pill */}
          <View style={S.hero}>
            <Text style={S.heroTitle}>ORDER</Text>
            <Text style={S.heroOrdNo}>{order.orderNumber || "-"}</Text>
            <View style={S.heroPills}>
              <Text style={S.heroPill}>{tableLabel}</Text>
              <Text style={S.heroPill}>{fmt(order.completedAt || order.createdAt)}</Text>
            </View>
          </View>

          {/* Meta */}
          {(customerName || order.cashierName || order.salesOrderNumber || order.salesChannelName || order.salesChannel?.name) ? (
            <View style={{ marginVertical: 2 }}>
              {customerName ? (
                <View style={S.metaRow}>
                  <Text style={S.metaKey}>CUSTOMER</Text>
                  <Text style={S.metaVal}>{customerName}</Text>
                </View>
              ) : null}
              {order.cashierName ? (
                <View style={S.metaRow}>
                  <Text style={S.metaKey}>CASHIER</Text>
                  <Text style={S.metaVal}>{order.cashierName}</Text>
                </View>
              ) : null}
              {order.salesChannelName || order.salesChannel?.name ? (
                <View style={S.metaRow}>
                  <Text style={S.metaKey}>SALES CHANNEL</Text>
                  <Text style={S.metaVal}>
                    {order.salesChannelName || order.salesChannel?.name}
                  </Text>
                </View>
              ) : null}
              {order.salesOrderNumber ? (
                <View style={S.metaRow}>
                  <Text style={S.metaKey}>SALES ORDER</Text>
                  <Text style={S.metaVal}>{order.salesOrderNumber}</Text>
                </View>
              ) : null}
            </View>
          ) : null}

          <View style={S.divider} />

          {/* Items */}
          <View style={S.itemsHead}>
            <Text style={S.thItem}>ITEM</Text>
            <Text style={S.thQty}>QTY</Text>
            <Text style={S.thRate}>RATE</Text>
            <Text style={S.thAmt}>TOTAL</Text>
          </View>
          {items.length === 0
            ? <Text style={{ fontSize: 9, color: MUTED, textAlign: "center", paddingVertical: 8 }}>No items</Text>
            : items.map((item, idx) => (
              <View key={idx} style={S.itemRow}>
                <View style={S.tdName}>
                  <Text style={S.itemTitle}>{item.name || "Item"}</Text>
                  {Number(item.discount || 0) > 0
                    ? <Text style={S.itemDisc}>-{item.discount}% line discount</Text>
                    : null}
                  {item.note ? <Text style={S.itemNote}>Note: {item.note}</Text> : null}
                </View>
                <Text style={S.tdQty}>{Number(item.quantity || 0)}</Text>
                <Text style={S.tdRate}>{Number(item.rate || 0).toFixed(2)}</Text>
                <Text style={S.tdAmt}>{Number(item.amount || 0).toFixed(2)}</Text>
              </View>
            ))}

          {/* Totals */}
          <View style={S.totals}>
            <View style={S.totalRow}>
              <Text style={S.totalKey}>Subtotal</Text>
              <Text style={S.totalVal}>{money(order.subtotal, currency)}</Text>
            </View>
            {hasDiscount ? (
              <View style={S.totalRow}>
                <Text style={S.totalKey}>
                  Discount{order.discountType === "percentage" ? ` (${order.discountValue}%)` : ""}
                </Text>
                <Text style={S.totalValRed}>- {money(order.discountAmount, currency)}</Text>
              </View>
            ) : null}
            {hasServiceCharge ? (
              <View style={S.totalRow}>
                <Text style={S.totalKey}>
                  Service Charge ({order.serviceChargeType === "fixed"
                    ? `RM ${Number(order.serviceChargeValue ?? order.serviceChargeRate ?? 0).toFixed(2)}`
                    : `${order.serviceChargeValue ?? order.serviceChargeRate ?? 0}%`})
                </Text>
                <Text style={S.totalVal}>{money(order.serviceChargeAmount, currency)}</Text>
              </View>
            ) : null}
            {nonTaxable > 0 && hasTax ? (
              <View style={S.totalRow}>
                <Text style={S.vatKey}>Non-Taxable Sales</Text>
                <Text style={S.vatVal}>{money(nonTaxable, currency)}</Text>
              </View>
            ) : null}
            {taxLines.map((bd, i) => (
              <View key={i}>
                <View style={S.totalRow}>
                  <Text style={S.vatKey}>Taxable ({bd.taxName || `${bd.taxRate}%`})</Text>
                  <Text style={S.vatVal}>{money(bd.taxableAmount, currency)}</Text>
                </View>
                <View style={S.totalRow}>
                  <Text style={S.totalKey}>{bd.taxName || `Tax ${bd.taxRate}%`}</Text>
                  <Text style={S.totalVal}>{money(bd.taxAmount, currency)}</Text>
                </View>
              </View>
            ))}
          </View>

          {/* Grand total */}
          <View style={S.grand}>
            <Text style={S.grandLabel}>TOTAL</Text>
            <Text style={S.grandValue}>{money(order.total, currency)}</Text>
          </View>

          {/* Payments */}
          {(payments.length > 0 || hasChange) ? (
            <>
              <View style={S.divider} />
              <View style={S.payments}>
                {payments.map((p, i) => (
                  <View key={i} style={S.payRow}>
                    <Text style={S.payKey}>
                      {p.paymentMethodName || p.method || "Payment"}
                      {p.reference ? ` (${p.reference})` : ""}
                    </Text>
                    <Text style={S.payVal}>{money(p.amount, currency)}</Text>
                  </View>
                ))}
                {hasChange ? (
                  <>
                    <View style={S.payRow}>
                      <Text style={S.payKey}>Cash Tendered</Text>
                      <Text style={S.payVal}>{money(cashTendered, currency)}</Text>
                    </View>
                    <View style={S.changeRow}>
                      <Text style={S.changeKey}>Change</Text>
                      <Text style={S.changeVal}>{money(order.changeGiven, currency)}</Text>
                    </View>
                  </>
                ) : null}
              </View>
            </>
          ) : null}

          <View style={S.divider} />

          {/* Footer — no duplicate order number */}
          <View style={S.footer}>
            <Text style={S.footerThanks}>{footerMessage}</Text>
            <Text style={S.footerBiz}>{bizName}</Text>
          </View>

        </View>
      </Page>
    </Document>
  );
};
