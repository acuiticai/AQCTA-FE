import ReceiptPrinterEncoder from "@point-of-sale/receipt-printer-encoder";

export function encodeKitchenTicket(ticket, { columns = 42 } = {}) {
  if (!ticket) return null;

  const items    = Array.isArray(ticket.items) ? ticket.items : [];
  const totalQty = items.reduce((s, it) => s + Number(it.quantity || 0), 0);
  const tableNum  = String(ticket.tableNumber || "WALK-IN");
  const ticketNo  = ticket.ticketNumber ? String(ticket.ticketNumber) : "";
  const tableLabel= ticket.tableLabel   ? String(ticket.tableLabel)   : "";
  const orderNo   = ticket.orderNumber  ? String(ticket.orderNumber)  : "";
  const section   = ticket.sectionName  || "Kitchen";
  const pax       = ticket.pax || ticket.covers || "";
  const dateStr   = ticket.createdAt
    ? new Date(ticket.createdAt).toLocaleString([], {
        year: "numeric", month: "short", day: "2-digit",
        hour: "2-digit", minute: "2-digit",
      })
    : "";

  const header   = ticketNo ? `${tableNum} - ${ticketNo}` : tableNum;
  const subtitle = [tableLabel, orderNo].filter(Boolean).join(" | ");

  const encoder = new ReceiptPrinterEncoder({ printerModel: "generic-escpos", columns });
  const halfW   = Math.floor(columns / 2);
  const nameW   = columns - 5;

  let e = encoder.initialize();

  // Header — large bold table + ticket number
  e = e.align("center").bold(true).line(header).bold(false);
  if (subtitle) e = e.line(subtitle);
  e = e.rule();

  // Date + PAX on one line
  if (dateStr) {
    if (pax) {
      e = e.align("left").table(
        [{ width: columns - 8, align: "left" }, { width: 8, align: "right" }],
        [[dateStr, `PAX ${pax}`]],
      );
    } else {
      e = e.align("left").line(dateStr);
    }
  }
  e = e.rule();

  // Item rows: name left, qty right
  e = e.align("left").table(
    [{ width: nameW, align: "left" }, { width: columns - nameW, align: "right" }],
    items.map((it) => [String(it.name || ""), String(it.quantity || 0)]),
  );
  // Notes below each item
  for (const it of items) {
    if (it.note) e = e.line(`  (${it.note})`);
  }

  e = e.rule();

  // Footer: section + total qty
  e = e.align("left").table(
    [{ width: halfW, align: "left" }, { width: columns - halfW, align: "right" }],
    [[section, `${totalQty} item${totalQty !== 1 ? "s" : ""}`]],
  );

  e = e.newline().cut();
  return e.encode();
}
