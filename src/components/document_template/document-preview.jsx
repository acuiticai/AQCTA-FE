

export default function DocumentPreview({ documentState }) {
  const {
    company,
    customer,
    invoice,
    items,
    totals,
    font,
    background,
    signees,
    terms,
    contentEntries,
    shippingEntries,
    paymentEntries,
    logoSettings,
    sections = [],
    documentType,
  } = documentState

  // Calculate page height based on content
  const getPageStyle = () => {
    return {
      backgroundColor: background.color,
      backgroundImage: background.image ? `url(${background.image})` : "none",
      backgroundPosition: background.position.toLowerCase().replace(" ", "-"),
      backgroundSize: "cover",
      backgroundRepeat: "no-repeat",
      fontFamily: font.family,
      minHeight: "1123px", // A4 height in pixels at 96 DPI
      position: "relative",
      breakInside: "avoid",
      pageBreakAfter: "always",
    }
  }

  // Get logo style based on position settings
  const getLogoStyle = () => {
    const position = logoSettings?.position || "top-center"
    const size = logoSettings?.size || 100
    const visible = logoSettings?.visible !== false

    if (!visible) return { display: "none" }

    let style = {
      width: `${size}px`,
      height: "auto",
      maxHeight: `${size}px`,
      objectFit: "contain",
      position: "absolute",
    }

    // Position the logo
    switch (position) {
      case "top-left":
        style = { ...style, top: "-90px", left: "20px" }; // ✅ Add top
        break;
      case "top-center":
        style = { ...style, top: "-90px", left: "50%", transform: "translateX(-50%)" }; // ✅ Add top
        break;
      case "top-right":
        style = { ...style, top: "-90px", right: "20px" }; // ✅ Add top
        break;
      case "middle-left":
        style = { ...style, top: "50%", left: "20px", transform: "translateY(-50%)" }
        break
      case "middle-center":
        style = { ...style, top: "50%", left: "50%", transform: "translate(-50%, -50%)" }
        break
      case "middle-right":
        style = { ...style, top: "50%", right: "20px", transform: "translateY(-50%)" }
        break
      case "bottom-left":
        style = { ...style, bottom: "20px", left: "20px" }
        break
      case "bottom-center":
        style = { ...style, bottom: "20px", left: "50%", transform: "translateX(-50%)" }
        break
      case "bottom-right":
        style = { ...style, bottom: "20px", right: "20px" }
        break
      default:
        style = { ...style, top: "20px", left: "50%", transform: "translateX(-50%)" }
    }

    return style
  }

  // Check if a section is visible
  const isSectionVisible = (sectionType) => {
    if (!sections || sections.length === 0) return true // Default to visible if no sections defined
    const section = sections.find((s) => s.type === sectionType)
    return section ? section.isVisible : true
  }

  // Invoice preview (ABM MYDIN style)
  if ((documentType || "").toLowerCase() === "invoice") {
    const currency = totals?.currency || invoice?.currency || "RM"
    const fmtMoney = (n) => {
      const num = Number(n || 0)
      // Keep consistent 2 decimals as per invoice
      return num.toFixed(2)
    }

    const businessName = company?.name || "COMPANY NAME"
    const businessAddress = company?.address || "Company Address"
    const businessPhone = company?.phone || ""
    const businessEmail = company?.email || ""

    const buyerName = customer?.name || "Customer Name"
    const buyerCompany = customer?.company || buyerName
    const buyerAddress = customer?.address || ""

    const invDate = invoice?.date || ""
    const dueDate = invoice?.dueDate || ""
    const invNo = invoice?.number || ""
    const salesType = invoice?.salesType || "CREDIT"
    const salesPerson = invoice?.salesPerson || ""

    const paymentMethod =
      paymentEntries?.payment ||
      "Cash / Debit & Credit Card / Cheque / Bank In / Online Transfer."
    const accountHolder =
      paymentEntries?.accountHolder ||
      "ABDUL HAMEED BIN VM MOHD MYDIN"
    const bankName = paymentEntries?.bankName || "HONG LEONG BANK"
    const accountNumber = paymentEntries?.accountNumber || "21400015058"

    const subTotal = totals?.subtotal ?? totals?.subTotal ?? 0
    const discount = totals?.discount ?? 0
    const tax = totals?.tax ?? 0
    const shippingHandling = totals?.shipping ?? totals?.shippingCharges ?? 0
    const otherCharges = totals?.adjustment ?? 0
    const total = totals?.total ?? 0
    const deposit = totals?.deposit ?? 0
    const itemRows = (items || []).map((it) => {
      const qty = Number(it.quantity || 0)
      const price = Number(it.rate ?? it.unitPrice ?? it.price ?? 0)
      const discountValue = Number(it.discount ?? it.discountAmount ?? 0)
      const discountIsPercent = Boolean(it.discountPercent) || String(it.discountType || "").toLowerCase() === "percentage"
      const discountAmt = discountIsPercent ? (qty * price * discountValue) / 100 : discountValue
      const lineSubTotal = Math.max(0, qty * price - discountAmt)
      const taxAmountFromData = Number(it.tax ?? it.taxAmount ?? 0)
      const taxRate = Number(it.taxRate ?? 0)
      const taxAmt = taxAmountFromData || (taxRate ? (lineSubTotal * taxRate) / 100 : 0)
      const providedLineTotal = Number(it.amount ?? it.total ?? it.totalValue ?? 0)
      const lineTotal =
        providedLineTotal > 0
          ? (
              Math.abs(providedLineTotal - lineSubTotal) < 0.01 && taxAmt > 0
                ? providedLineTotal + taxAmt
                : providedLineTotal
            )
          : lineSubTotal + taxAmt
      return {
        ...it,
        qty,
        price,
        discountAmt,
        taxAmt,
        lineSubTotal,
        lineTotal,
      }
    })

    const computedSubtotal = itemRows.reduce((sum, row) => sum + row.lineSubTotal, 0)
    const computedTax = itemRows.reduce((sum, row) => sum + row.taxAmt, 0)
    const computedItemsTotal = itemRows.reduce((sum, row) => sum + row.lineTotal, 0)
    const hasLineItemTax = computedTax > 0

    const providedTotal = Number(total || 0)
    const shippingNum = Number(shippingHandling || 0)
    const otherChargesNum = Number(otherCharges || 0)
    const summaryDiscountNum = Number(discount || 0)
    const fallbackTotal = Math.max(0, computedItemsTotal - summaryDiscountNum + shippingNum + otherChargesNum)
    const matchesUntaxedTotal =
      hasLineItemTax &&
      Math.abs(providedTotal - (computedSubtotal - summaryDiscountNum + shippingNum + otherChargesNum)) < 0.01
    const resolvedTotal =
      providedTotal > 0
        ? (matchesUntaxedTotal ? fallbackTotal : providedTotal)
        : fallbackTotal
    const balance = resolvedTotal - Number(deposit || 0)

    // Styles chosen to closely match the provided ABM invoice screenshot
    return (
      <div className="document-container">
        <div
          className="page"
          style={{
            ...getPageStyle(),
            padding: "36px 48px",
            minHeight: "1123px",
          }}
        >
          {/* Header Logo */}
          <div style={{ textAlign: "center", marginTop: 10 }}>
            {documentState.logo ? (
              <img
                src={documentState.logo || "/placeholder.svg"}
                alt="Company Logo"
                style={{
                  width: 120,
                  height: "auto",
                  maxHeight: 70,
                  objectFit: "contain",
                  margin: "0 auto 8px",
                }}
              />
            ) : null}

            <div
              style={{
                fontWeight: 700,
                fontSize: 14,
                letterSpacing: 0.3,
                color: font?.fontColor || "#000",
              }}
            >
              {businessName}
            </div>
            <div
              style={{
                fontSize: 10,
                lineHeight: 1.35,
                marginTop: 3,
                color: font?.fontColor || "#000",
                whiteSpace: "pre-line",
              }}
            >
              {businessAddress}
            </div>
            <div
              style={{
                fontSize: 10,
                lineHeight: 1.35,
                marginTop: 3,
                color: font?.fontFontColor || font?.fontColor || "#000",
              }}
            >
              {businessPhone ? businessPhone : ""}
            </div>
            <div
              style={{
                fontSize: 10,
                lineHeight: 1.35,
                marginTop: 3,
                color: font?.fontColor || "#000",
              }}
            >
              {businessEmail}
            </div>
          </div>

          <div style={{ borderTop: "1px solid #777", margin: "12px 0 10px" }} />

          <div
            style={{
              textAlign: "center",
              fontSize: 16,
              fontWeight: 700,
              letterSpacing: 0.6,
              margin: "10px 0 14px",
              textDecoration: "underline",
              color: font?.fontColor || "#000",
            }}
          >
            INVOICE
          </div>

          {/* Invoice details - single horizontal line */}
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              gap: 18,
              fontSize: 10,
              marginBottom: 14,
              flexWrap: "wrap",
              color: font?.fontColor || "#000",
            }}
          >
            <div style={{ display: "flex", gap: 6 }}>
              <span style={{ fontWeight: 700 }}>DATE:</span>
              <span>{invDate}</span>
            </div>
            <div style={{ display: "flex", gap: 6 }}>
              <span style={{ fontWeight: 700 }}>DUE DATE:</span>
              <span>{dueDate}</span>
            </div>
            <div style={{ display: "flex", gap: 6 }}>
              <span style={{ fontWeight: 700 }}>INVOICE NO.:</span>
              <span>{invNo}</span>
            </div>
            <div style={{ display: "flex", gap: 6 }}>
              <span style={{ fontWeight: 700 }}>SALES TYPE:</span>
              <span>{salesType}</span>
            </div>
            <div style={{ display: "flex", gap: 6 }}>
              <span style={{ fontWeight: 700 }}>SALES PERSON:</span>
              <span>{salesPerson}</span>
            </div>
          </div>

          {/* Bill To / Ship To (no border) */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: 70,
              fontSize: 10,
              marginBottom: 18,
            }}
          >
            <div>
              <div style={{ fontWeight: 700, marginBottom: 6 }}>BILL TO:</div>
              <div style={{ display: "grid", gridTemplateColumns: "70px 1fr", rowGap: 3 }}>
                <div>Attn</div>
                <div>: {buyerName}</div>
                <div>Company</div>
                <div>: {buyerCompany}</div>
                <div>Address</div>
                <div style={{ whiteSpace: "pre-line" }}>: {buyerAddress}</div>
                <div>Phone</div>
                <div>: </div>
                <div>Email</div>
                <div>: </div>
              </div>
            </div>

            <div>
              <div style={{ fontWeight: 700, marginBottom: 6 }}>SHIP TO:</div>
              <div style={{ display: "grid", gridTemplateColumns: "70px 1fr", rowGap: 3 }}>
                <div>Attn</div>
                <div>: {buyerName}</div>
                <div>Company</div>
                <div>: {buyerCompany}</div>
                <div>Address</div>
                <div style={{ whiteSpace: "pre-line" }}>: {buyerAddress}</div>
                <div>Phone</div>
                <div>: </div>
                <div>Email</div>
                <div>: </div>
              </div>
            </div>
          </div>

          {/* Items table - ABM style (minimal vertical lines, subtle row separators) */}
          <div style={{ borderBottom: "2px solid #777" }}>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "42px 1.15fr 1.7fr 0.85fr 0.85fr 0.85fr 0.85fr 0.95fr",
                padding: "8px 6px",
                fontSize: 10,
                fontWeight: 700,
                color: "#000",
              }}
            >
              <div>No</div>
              <div>Item</div>
              <div>Description</div>
              <div style={{ textAlign: "right" }}>Quantity</div>
              <div style={{ textAlign: "right" }}>Price</div>
              <div style={{ textAlign: "right" }}>Discount</div>
              <div style={{ textAlign: "right" }}>Tax</div>
              <div style={{ textAlign: "right" }}>Total</div>
            </div>
          </div>
          <div>
            {itemRows.map((it, idx) => {
              return (
                <div
                  key={idx}
                  style={{
                    display: "grid",
                    gridTemplateColumns: "42px 1.15fr 1.7fr 0.85fr 0.85fr 0.85fr 0.85fr 0.95fr",
                    padding: "10px 6px",
                    fontSize: 10,
                    borderBottom: "1px solid #e5e5e5",
                  }}
                >
                  <div>{idx + 1}</div>
                  <div>{it.name || ""}</div>
                  <div>{it.description || ""}</div>
                  <div style={{ textAlign: "right" }}>{qty}</div>
                  <div style={{ textAlign: "right" }}>
                    {currency}{fmtMoney(price)}
                  </div>
                  <div style={{ textAlign: "right" }}>
                    {currency}{fmtMoney(it.discountAmt)}
                  </div>
                  <div style={{ textAlign: "right" }}>
                    {currency}{fmtMoney(it.taxAmt)}
                  </div>
                  <div style={{ textAlign: "right" }}>
                    {currency}{fmtMoney(it.lineTotal)}
                  </div>
                </div>
              )
            })}
          </div>

          {/* Payment + Summary */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 320px",
              gap: 30,
              marginTop: 18,
              fontSize: 9.5,
              lineHeight: 1.5,
            }}
          >
            <div style={{ fontStyle: "italic" }}>
              <div>
                1. Method Of Payment: {paymentMethod}
              </div>
              <div style={{ marginTop: 10 }}>
                2. Any indirect transaction, payment must be made into {accountHolder} Bank
                Account. The details of the account are as follows:
              </div>
              <div style={{ marginTop: 6 }}>
                {accountHolder} ({bankName}): {accountNumber}
              </div>
            </div>

            <div style={{ fontSize: 10 }}>
              {[
                ["Subtotal:", `${currency}${fmtMoney(subTotal || computedSubtotal)}`],
                ["Discount:", `${currency}${fmtMoney(discount)}`],
                ["Shipping/Handling:", `${currency}${fmtMoney(shippingHandling)}`],
                ...(!hasLineItemTax ? [["Tax:", `${currency}${fmtMoney(tax || computedTax)}`]] : []),
                ["Other Charges:", `${currency}${fmtMoney(otherCharges)}`],
              ].map(([label, value]) => (
                <div
                  key={label}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    padding: "4px 0",
                  }}
                >
                  <div style={{ color: "#222" }}>{label}</div>
                  <div style={{ textAlign: "right", minWidth: 130 }}>{value}</div>
                </div>
              ))}
              <div style={{ borderTop: "2px solid #777", marginTop: 8, paddingTop: 8 }}>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <div style={{ fontWeight: 700 }}>Total ({currency}):</div>
                  <div style={{ fontWeight: 700, textDecoration: "underline", minWidth: 130, textAlign: "right" }}>
                    {currency}{fmtMoney(resolvedTotal)}
                  </div>
                </div>
              </div>
              {[
                ["Deposit:", `${currency}${fmtMoney(deposit)}`],
                ["Balance:", `${currency}${fmtMoney(balance)}`],
              ].map(([label, value]) => (
                <div
                  key={label}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    padding: "4px 0",
                  }}
                >
                  <div style={{ color: "#222" }}>{label}</div>
                  <div style={{ textAlign: "right", minWidth: 130 }}>{value}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Signature */}
          <div style={{ marginTop: 70, fontSize: 10 }}>
            <div style={{ width: 220, borderTop: "1px dotted #999" }} />
            <div style={{ marginTop: 6 }}>Authorized Signature</div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="document-container">
      <div className="page" style={getPageStyle()}>
        {/* Logo */}
        {/* Logo */}
        {documentState.logo && (
          <div className="text-center" style={{ marginBottom: "60px" }}>
            <img
              src={documentState.logo || "/placeholder.svg"}
              alt="Company Logo"
              style={getLogoStyle()}
            />
          </div>
        )}


        {/* Header - From the Managing Director Office */}
        {isSectionVisible("header") && (
          <div className="text-center mt-20 mb-8">
            <p className="italic" style={{ color: font.fontColor }}>
              From the Managing Director Office
            </p>
          </div>
        )}

        {/* Contract Details */}
        <div className="px-10">
          <div className="grid grid-cols-12 gap-2 mb-2">
            <div className="col-span-3 text-left" style={{ color: font.labelColor }}>
              {invoice.subjectLabel || "Rubber Contract No"}:
            </div>
            <div className="col-span-3 font-bold" style={{ color: font.fontColor }}>
              {invoice.number}
            </div>
            <div className="col-span-3 text-left" style={{ color: font.labelColor }}>
              {invoice.referenceLabel || "REF"}:
            </div>
            <div className="col-span-3" style={{ color: font.fontColor }}></div>
          </div>

          <div className="grid grid-cols-12 gap-2 mb-2">
            <div className="col-span-3 text-left" style={{ color: font.labelColor }}>
              {invoice.dateLabel || "Date"}:
            </div>
            <div className="col-span-3" style={{ color: font.fontColor }}>
              {invoice.date}
            </div>
            <div className="col-span-6"></div>
          </div>

          <div className="grid grid-cols-12 gap-2 mb-6">
            <div className="col-span-3 text-left" style={{ color: font.labelColor }}>
              {customer.label || "Buyer"}:
            </div>
            <div className="col-span-9" style={{ color: font.fontColor }}>
              <div className="font-bold">{customer.name}</div>
              {customer.address.split("\n").map((line, i) => (
                <div key={i}>{line}</div>
              ))}
            </div>
          </div>

          {isSectionVisible("content") && (
            <>
              <div className="grid grid-cols-12 gap-2 mb-2">
                <div className="col-span-3 text-left italic" style={{ color: font.labelColor }}>
                  {contentEntries.intermediate}:
                </div>
                <div className="col-span-9" style={{ color: font.fontColor }}>
                  {contentEntries.description}
                </div>
              </div>

              <div className="grid grid-cols-12 gap-2 mb-2 mt-8">
                <div className="col-span-3 text-left" style={{ color: font.labelColor }}>
                  {documentState.fieldLabels?.gradeQuantity?.grade || "Grade"}:
                </div>
                <div className="col-span-9 font-bold" style={{ color: font.fontColor }}>
                  {contentEntries.grade}
                </div>
              </div>

              <div className="grid grid-cols-12 gap-2 mb-2">
                <div className="col-span-3 text-left" style={{ color: font.labelColor }}>
                  {documentState.fieldLabels?.gradeQuantity?.quantity || "Quantity"}:
                </div>
                <div className="col-span-5" style={{ color: font.fontColor }}>
                  {contentEntries.quantity}
                </div>
                <div className="col-span-1 text-left" style={{ color: font.labelColor }}>
                  {documentState.fieldLabels?.gradeQuantity?.price || "Price"}:
                </div>
                <div className="col-span-3" style={{ color: font.fontColor }}>
                  {contentEntries.price}
                </div>
              </div>
            </>
          )}

          {/* Table Section */}
          {isSectionVisible("table") && documentState.items && documentState.items.length > 0 && (
            <div className="mt-8 mb-4">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="bg-gray-50">
                    {documentState.tableConfig.lineItemNumber.show && (
                      <th className="border border-gray-200 px-4 py-2 text-left">
                        {documentState.tableConfig.lineItemNumber.label || "#"}
                      </th>
                    )}
                    {documentState.tableConfig.item.show && (
                      <th className="border border-gray-200 px-4 py-2 text-left">
                        {documentState.tableConfig.item.label || "Item"}
                      </th>
                    )}
                    {documentState.tableConfig.description.show && (
                      <th className="border border-gray-200 px-4 py-2 text-left">
                        {documentState.tableConfig.description.label || "Description"}
                      </th>
                    )}
                    {documentState.tableConfig.quantity.show && (
                      <th className="border border-gray-200 px-4 py-2 text-left">
                        {documentState.tableConfig.quantity.label || "Quantity"}
                      </th>
                    )}
                    {documentState.tableConfig.rate.show && (
                      <th className="border border-gray-200 px-4 py-2 text-left">
                        {documentState.tableConfig.rate.label || "Rate"}
                      </th>
                    )}
                    {documentState.tableConfig.amount.show && (
                      <th className="border border-gray-200 px-4 py-2 text-left">
                        {documentState.tableConfig.amount.label || "Amount"}
                      </th>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {documentState.items.map((item, index) => (
                    <tr key={index} className="border-b border-gray-200">
                      {documentState.tableConfig.lineItemNumber.show && (
                        <td className="border border-gray-200 px-4 py-2">{index + 1}</td>
                      )}
                      {documentState.tableConfig.item.show && (
                        <td className="border border-gray-200 px-4 py-2">{item.name}</td>
                      )}
                      {documentState.tableConfig.description.show && (
                        <td className="border border-gray-200 px-4 py-2">{item.description}</td>
                      )}
                      {documentState.tableConfig.quantity.show && (
                        <td className="border border-gray-200 px-4 py-2">{item.quantity}</td>
                      )}
                      {documentState.tableConfig.rate.show && (
                        <td className="border border-gray-200 px-4 py-2">{item.rate}</td>
                      )}
                      {documentState.tableConfig.amount.show && (
                        <td className="border border-gray-200 px-4 py-2">{item.amount}</td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Shipping Details */}
          {isSectionVisible("shipping") && (
            <div className="mt-16 mb-4">
              <div className="grid grid-cols-12 gap-2 mb-2">
                <div className="col-span-3 text-left" style={{ color: font.labelColor }}>
                  {documentState.fieldLabels?.shipping?.totalValue || "Total Value"}:
                </div>
                <div className="col-span-9" style={{ color: font.fontColor }}>
                  {shippingEntries.totalValue}
                </div>
              </div>

              <div className="grid grid-cols-12 gap-2 mb-2">
                <div className="col-span-3 text-left" style={{ color: font.labelColor }}>
                  {documentState.fieldLabels?.shipping?.shippingTerms || "Shipping Terms"}:
                </div>
                <div className="col-span-9" style={{ color: font.fontColor }}>
                  {shippingEntries.shippingTerms}
                </div>
              </div>

              <div className="grid grid-cols-12 gap-2 mb-2">
                <div className="col-span-3 text-left" style={{ color: font.labelColor }}>
                  {documentState.fieldLabels?.shipping?.packing || "Packing"}:
                </div>
                <div className="col-span-9" style={{ color: font.fontColor }}>
                  {shippingEntries.packing}
                </div>
              </div>

              <div className="grid grid-cols-12 gap-2 mb-2">
                <div className="col-span-3 text-left" style={{ color: font.labelColor }}>
                  {documentState.fieldLabels?.shipping?.etdPortLoading || "ETD Port of Loading"}:
                </div>
                <div className="col-span-9" style={{ color: font.fontColor }}>
                  {shippingEntries.etdPortLoading}
                </div>
              </div>
            </div>
          )}

          {/* Payment Details */}
          {isSectionVisible("payment") && (
            <div className="mb-4">
              <div className="grid grid-cols-12 gap-2 mb-2">
                <div className="col-span-3 text-left" style={{ color: font.labelColor }}>
                  {documentState.fieldLabels?.payment?.payment || "Payment"}:
                </div>
                <div className="col-span-9" style={{ color: font.fontColor }}>
                  {paymentEntries.payment}
                </div>
              </div>

              <div className="grid grid-cols-12 gap-2 mb-2">
                <div className="col-span-3 text-left" style={{ color: font.labelColor }}>
                  {documentState.fieldLabels?.payment?.beneficiary || "Beneficiary"}:
                </div>
                <div className="col-span-9" style={{ color: font.fontColor }}>
                  {paymentEntries.beneficiary}
                </div>
              </div>

              <div className="grid grid-cols-12 gap-2 mb-2">
                <div className="col-span-3 text-left" style={{ color: font.labelColor }}>
                  {documentState.fieldLabels?.payment?.accountHolder || "Account Holder"}:
                </div>
                <div className="col-span-9" style={{ color: font.fontColor }}>
                  {paymentEntries.accountHolder}
                </div>
              </div>

              <div className="grid grid-cols-12 gap-2 mb-2">
                <div className="col-span-3 text-left" style={{ color: font.labelColor }}>
                  {documentState.fieldLabels?.payment?.accountNumber || "Account Number"}:
                </div>
                <div className="col-span-9" style={{ color: font.fontColor }}>
                  {paymentEntries.accountNumber}
                </div>
              </div>

              <div className="grid grid-cols-12 gap-2 mb-2">
                <div className="col-span-3 text-left" style={{ color: font.labelColor }}>
                  {documentState.fieldLabels?.payment?.accountType || "Account Type"}:
                </div>
                <div className="col-span-9" style={{ color: font.fontColor }}>
                  {paymentEntries.accountType}
                </div>
              </div>

              <div className="grid grid-cols-12 gap-2 mb-2">
                <div className="col-span-3 text-left" style={{ color: font.labelColor }}>
                  {documentState.fieldLabels?.payment?.bankName || "Bank Name"}:
                </div>
                <div className="col-span-9" style={{ color: font.fontColor }}>
                  {paymentEntries.bankName}
                </div>
              </div>

              <div className="grid grid-cols-12 gap-2 mb-2">
                <div className="col-span-3 text-left" style={{ color: font.labelColor }}>
                  {documentState.fieldLabels?.payment?.swiftCode || "SWIFT CODE"}:
                </div>
                <div className="col-span-9" style={{ color: font.fontColor }}>
                  {paymentEntries.swiftCode}
                </div>
              </div>

              <div className="grid grid-cols-12 gap-2 mb-2">
                <div className="col-span-3 text-left" style={{ color: font.labelColor }}>
                  {documentState.fieldLabels?.payment?.bankAddress || "Bank Address"}:
                </div>
                <div className="col-span-9" style={{ color: font.fontColor }}>
                  {paymentEntries.bankAddress}
                </div>
              </div>
            </div>
          )}

          {/* Terms & Conditions */}
          {isSectionVisible("terms") && (
            <div className="mb-4">
              <div className="grid grid-cols-12 gap-2 mb-2">
                <div className="col-span-3 text-left" style={{ color: font.labelColor }}>
                  Term & Condition:
                </div>
                <div className="col-span-9">
                  <div
                    className="terms-content"
                    style={{ color: font.fontColor }}
                    dangerouslySetInnerHTML={{ __html: documentState.termsHtml || "" }}
                  />
                </div>
              </div>
            </div>
          )}

          {/* Remarks */}
          {isSectionVisible("remarks") && documentState.remarksHtml && (
            <div className="mb-4">
              <div className="grid grid-cols-12 gap-2 mb-2">
                <div className="col-span-3 text-left" style={{ color: font.labelColor }}>
                  REMARKS:
                </div>
                <div className="col-span-9">
                  <div
                    className="remarks-content"
                    style={{ color: font.fontColor }}
                    dangerouslySetInnerHTML={{ __html: documentState.remarksHtml || "" }}
                  />
                </div>
              </div>
            </div>
          )}

          {/* Footer Text */}
          {isSectionVisible("footer") && (
            <div className="text-center my-8" style={{ color: font.fontColor }}>
              {documentState.footerText}
            </div>
          )}

          {/* Signees Section */}
          {isSectionVisible("signees") && signees && signees.length > 0 && (
            <div className="mt-8 grid grid-cols-2 gap-8">
              {signees.map((signee, index) => (
                <div key={index} className={index === 0 ? "text-left" : "text-right"}>
                  <p className="font-medium mb-1" style={{ color: font.labelColor }}>
                    {signee.title}
                  </p>
                  <p className="font-bold mb-1" style={{ color: font.fontColor }}>
                    {signee.name}
                  </p>
                  {signee.showSignature && <div className="h-16 border-b border-gray-300 my-2"></div>}
                  {signee.showStamp && <div className="mt-2 text-xs text-gray-500 italic">(sign & stamp)</div>}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Company Footer */}
        <div className="absolute bottom-4 left-0 right-0 text-center text-sm" style={{ color: font.fontColor }}>
          <div>{company.address}</div>
          <div>Tel : {company.phone}</div>
        </div>
      </div>
    </div>
  )
}

