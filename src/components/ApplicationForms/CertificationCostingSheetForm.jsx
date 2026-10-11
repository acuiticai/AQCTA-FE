import React, { useMemo } from "react";
import { Plus, Trash2 } from "lucide-react";
import Combobox from "@/customer/components/ui/Combobox";

const money = (value) => {
  const n = Number(String(value ?? "").replace(/[^0-9.-]/g, ""));
  return Number.isFinite(n) ? n : 0;
};

const formatMoney = (n) =>
  Number(n || 0).toLocaleString("en-MY", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

const MAX_FEE_ROWS = 26;

const TRAVEL_OPTIONS = [
  "Inclusive travelling and accommodation costs",
  "As agreed, air tickets to be provided by applicant",
  "As agreed, accommodation to be provided by applicant",
  "Excluding travelling and accommodation costs",
];

const COMPANY_TYPES = [
  "ML — Local Manufacturers",
  "MF — Foreign Manufacturers",
  "T-CLM — Trading with Certified Local Manufacturers",
  "T-CFM — Trading with Certified Foreign Manufacturers",
  "T-NCLM — Trading with Non-Certified Local Manufacturers",
  "T-NCFM — Trading with Non-Certified Foreign Manufacturers",
];

const CellInput = ({
  value,
  onChange,
  readOnly,
  type = "text",
  placeholder = "",
  align = "left",
  className = "",
}) => {
  if (readOnly) {
    const text = String(value ?? "").trim();
    return (
      <span className={`ccs-dv ccs-dv--${align} ${className}`.trim()}>
        {text || ""}
      </span>
    );
  }
  return (
    <input
      type={type}
      inputMode={type === "number" ? "decimal" : undefined}
      step={type === "number" ? "any" : undefined}
      className={`ccs-in ccs-in--${align} ${className}`.trim()}
      value={value ?? ""}
      placeholder={placeholder}
      onChange={(e) => onChange?.(e.target.value)}
    />
  );
};

/**
 * Certification costing fill UI — matches
 * `templates/certificationCostingSheet.html` (AQCTA-FOR-01-06).
 *
 * Fee lines are added via dropdown from Service / AQCTA-FEE-* Items.
 */
export default function CertificationCostingSheetForm({
  values = {},
  onChange,
  readOnly = false,
  feeCatalogItems = [],
  invalidKeys = [],
  editableKeys = [],
  documentTitle = "",
  documentCode = "",
}) {
  const invalid = new Set(invalidKeys);
  const editable = new Set(editableKeys);
  const canEdit = (key) => !readOnly && editable.has(key);
  const lines = Array.isArray(values.feeLines) ? values.feeLines : [];

  const catalogById = useMemo(() => {
    const map = new Map();
    for (const item of feeCatalogItems || []) {
      if (item?.itemId) map.set(String(item.itemId), item);
    }
    return map;
  }, [feeCatalogItems]);

  const itemOptions = useMemo(
    () =>
      (feeCatalogItems || []).map((item) => ({
        value: item.itemId,
        label: item.name || item.itemCode || "Fee",
      })),
    [feeCatalogItems],
  );

  const setField = (key, value) => onChange?.(key, value);
  const setLines = (next) => onChange?.("feeLines", next);

  const updateLine = (index, patch) => {
    if (readOnly) return;
    setLines(
      lines.map((line, i) => (i === index ? { ...line, ...patch } : line)),
    );
  };

  const selectItem = (index, itemId) => {
    if (readOnly || !itemId) return;
    const item = catalogById.get(String(itemId));
    if (!item) return;
    updateLine(index, {
      itemId: item.itemId,
      itemCode: item.itemCode || "",
      name: item.name || item.itemCode || "Fee",
      quotationStage: item.quotationStage || 1,
      amount:
        String(lines[index]?.amount ?? "").trim() !== ""
          ? lines[index].amount
          : item.sellingPrice > 0
            ? String(item.sellingPrice)
            : "",
    });
  };

  const addLine = () => {
    if (readOnly || lines.length >= MAX_FEE_ROWS) return;
    if (lines.some((line) => !String(line.itemId || "").trim())) return;
    if (!(feeCatalogItems || []).length) return;
    setLines([
      ...lines,
      {
        itemId: "",
        itemCode: "",
        name: "",
        amount: "",
        quotationStage: 1,
      },
    ]);
  };

  const removeLine = (index) => {
    if (readOnly) return;
    setLines(lines.filter((_, i) => i !== index));
  };

  const canAdd =
    !readOnly &&
    lines.length < MAX_FEE_ROWS &&
    (feeCatalogItems || []).length > 0 &&
    !lines.some((line) => !String(line.itemId || "").trim());

  const travelSelected = Array.isArray(values.travelBasis)
    ? values.travelBasis.map(String)
    : values.travelBasis
      ? [String(values.travelBasis)]
      : [];

  const toggleTravel = (opt) => {
    if (!canEdit("travelBasis")) return;
    const set = new Set(travelSelected);
    if (set.has(opt)) set.delete(opt);
    else set.add(opt);
    setField("travelBasis", [...set]);
  };

  const subtotal = money(values.subtotal) ||
    lines.reduce((sum, line) => sum + money(line.amount), 0);
  const discountAmt = money(values.discountAmount);
  const grand =
    String(values.grandTotal ?? "").trim() ||
    formatMoney(Math.max(0, subtotal - discountAmt));

  const showDiscountFields =
    values.discountType === "Percentage" || values.discountType === "Amount";
  const showLicensee = String(values.typeOfCompany || "").startsWith("T-");

  return (
    <div className="ccs-page">
      <div className="ccs-head">
        <h1 className="ccs-title">{documentTitle || "COSTING SHEET"}</h1>
        <div className="ccs-doc-code">
          {documentCode || "AQCTA-FOR-01-06"}
        </div>
      </div>

      <div className="ccs-app-type">
        {["New application / Renewal", "Surveillance"].map((opt) => (
          <label key={opt} className="ccs-radio">
            <input
              type="radio"
              name="applicationType"
              checked={String(values.applicationType || "") === opt}
              disabled={!canEdit("applicationType")}
              onChange={() => setField("applicationType", opt)}
            />
            <span>{opt}</span>
          </label>
        ))}
        <div className="ccs-file-no">
          File No:{" "}
          <strong>{values.fileNo || "—"}</strong>
        </div>
      </div>

      <table className="ccs-info-table">
        <tbody>
          <tr>
            <td className="ccs-label">Applicant</td>
            <td colSpan={3}>
              <CellInput value={values.applicant} readOnly />
            </td>
          </tr>
          <tr>
            <td className="ccs-label">Address</td>
            <td colSpan={3}>
              <CellInput value={values.address} readOnly />
            </td>
          </tr>
          <tr>
            <td className="ccs-label">Type of Co.*</td>
            <td colSpan={3}>
              {readOnly || !canEdit("typeOfCompany") ? (
                <CellInput value={values.typeOfCompany} readOnly />
              ) : (
                <Combobox
                  value={values.typeOfCompany || ""}
                  onChange={(v) => setField("typeOfCompany", v)}
                  options={COMPANY_TYPES.map((v) => ({ value: v, label: v }))}
                  placeholder="Select type…"
                  searchable={false}
                  clearable
                />
              )}
            </td>
          </tr>
          {showLicensee ? (
            <tr>
              <td className="ccs-label">Licensee No</td>
              <td colSpan={3} className={invalid.has("licenseeNo") ? "ccs-bad" : ""}>
                <CellInput
                  value={values.licenseeNo}
                  readOnly={!canEdit("licenseeNo")}
                  placeholder="For trading companies"
                  onChange={(v) => setField("licenseeNo", v)}
                />
              </td>
            </tr>
          ) : null}
          <tr>
            <td className="ccs-label">Product</td>
            <td colSpan={3}>
              <CellInput value={values.product} readOnly />
            </td>
          </tr>
          <tr>
            <td className="ccs-label">Standard Number</td>
            <td
              colSpan={3}
              className={invalid.has("standardNumber") ? "ccs-bad" : ""}
            >
              <CellInput
                value={values.standardNumber}
                readOnly={!canEdit("standardNumber")}
                placeholder="e.g. MS 1234:2020"
                onChange={(v) => setField("standardNumber", v)}
              />
            </td>
          </tr>
          <tr>
            <td className="ccs-label">Contact Person</td>
            <td>
              <CellInput value={values.contactPerson} readOnly />
            </td>
            <td className="ccs-label">Tel No</td>
            <td>
              <CellInput value={values.telNo} readOnly />
            </td>
          </tr>
        </tbody>
      </table>

      <table className="ccs-fee-table">
        <thead>
          <tr>
            <th className="ccs-col-act">Activities</th>
            <th className="ccs-col-amt">Amount (RM)</th>
            {!readOnly ? <th className="ccs-col-actn" /> : null}
          </tr>
        </thead>
        <tbody>
          {!lines.length ? (
            <tr>
              <td colSpan={readOnly ? 2 : 3} className="ccs-empty-hint">
                {readOnly
                  ? "No fee lines recorded."
                  : "Add fee items from the dropdown — only the lines that apply."}
              </td>
            </tr>
          ) : (
            lines.map((line, index) => (
              <tr key={`fee-${index}`}>
                <td className="ccs-col-act">
                  <span className="ccs-no">{index + 1}.0</span>{" "}
                  {readOnly ? (
                    <span className="ccs-dv">{line.name || "—"}</span>
                  ) : (
                    <Combobox
                      value={line.itemId || ""}
                      onChange={(v) => selectItem(index, v)}
                      options={itemOptions}
                      placeholder="Select fee item…"
                      emptyMessage="No fee items"
                    />
                  )}
                </td>
                <td className="ccs-col-amt">
                  <CellInput
                    type="number"
                    align="right"
                    value={line.amount}
                    readOnly={readOnly}
                    placeholder="0.00"
                    onChange={(v) => updateLine(index, { amount: v })}
                  />
                </td>
                {!readOnly ? (
                  <td className="ccs-col-actn">
                    <button
                      type="button"
                      className="ccs-trash"
                      aria-label="Remove fee line"
                      onClick={() => removeLine(index)}
                    >
                      <Trash2 size={14} />
                    </button>
                  </td>
                ) : null}
              </tr>
            ))
          )}
          {!readOnly ? (
            <tr className="ccs-add-row">
              <td colSpan={3}>
                <button
                  type="button"
                  className="ccs-add-btn"
                  disabled={!canAdd}
                  onClick={addLine}
                >
                  <Plus size={14} /> Add fee line
                </button>
                {!(feeCatalogItems || []).length ? (
                  <span className="ccs-hint">
                    {" "}
                    Create Service / AQCTA-FEE items under /items first.
                  </span>
                ) : null}
              </td>
            </tr>
          ) : null}
          <tr className="ccs-grand">
            <td>GRAND TOTAL</td>
            <td
              className="ccs-col-amt ccs-grand-amt"
              colSpan={readOnly ? 1 : 2}
            >
              {grand}
            </td>
          </tr>
          <tr>
            <td colSpan={readOnly ? 2 : 3} className={invalid.has("travelBasis") ? "ccs-bad" : ""}>
              <div className="ccs-travel">
                {TRAVEL_OPTIONS.map((opt) => (
                  <label key={opt} className="ccs-check">
                    <input
                      type="checkbox"
                      checked={travelSelected.includes(opt)}
                      disabled={!canEdit("travelBasis")}
                      onChange={() => toggleTravel(opt)}
                    />
                    <span>{opt}</span>
                  </label>
                ))}
              </div>
            </td>
          </tr>
        </tbody>
      </table>

      <div className="ccs-discount">
        <div className="ccs-discount__label">Discount</div>
        <div className="ccs-discount__radios">
          {["None", "Percentage", "Amount"].map((opt) => (
            <label key={opt} className="ccs-radio">
              <input
                type="radio"
                name="discountType"
                checked={String(values.discountType || "None") === opt}
                disabled={!canEdit("discountType")}
                onChange={() => setField("discountType", opt)}
              />
              <span>{opt}</span>
            </label>
          ))}
        </div>
        {showDiscountFields ? (
          <div className="ccs-discount__fields">
            <CellInput
              type="number"
              value={values.discountValue}
              readOnly={!canEdit("discountValue")}
              placeholder={
                values.discountType === "Percentage" ? "e.g. 10" : "e.g. 250"
              }
              onChange={(v) => setField("discountValue", v)}
            />
            <CellInput
              value={values.discountReason}
              readOnly={!canEdit("discountReason")}
              placeholder="Reason for the discount"
              className={invalid.has("discountReason") ? "ccs-bad" : ""}
              onChange={(v) => setField("discountReason", v)}
            />
            {discountAmt > 0 ? (
              <span className="ccs-hint">
                Discount RM {formatMoney(discountAmt)} · Subtotal RM{" "}
                {formatMoney(subtotal)}
              </span>
            ) : null}
          </div>
        ) : null}
      </div>

      <div className="ccs-notes">
        * ML : Local Manufacturers &nbsp; MF : Foreign Manufacturers
        <br />
        &nbsp;&nbsp; T-CLM / T-CFM / T-NCLM / T-NCFM — Trading variants
        <br />
        (*) Inclusive of report preparation
      </div>

      <div className="ccs-remarks-block">
        <strong>Remarks :</strong>
        {readOnly || !canEdit("remarks") ? (
          <div className="ccs-dv">{values.remarks || values.remarksLine || ""}</div>
        ) : (
          <textarea
            className={`ccs-textarea${invalid.has("remarks") ? " ccs-bad" : ""}`}
            rows={3}
            value={values.remarks ?? ""}
            onChange={(e) => setField("remarks", e.target.value)}
          />
        )}
      </div>

      <table className="ccs-sign-table">
        <tbody>
          <tr>
            <td>
              <div className="ccs-sig-head">Prepared by:</div>
              <div className="ccs-sig-details">
                Name: {values.preparedByName || "—"}
                <br />
                Date: {values.preparedAt || "—"}
              </div>
            </td>
            <td>
              <div className="ccs-sig-head">Approved by:</div>
              <div className="ccs-sig-details">
                Name: {values.approvedByName || "—"}
                <br />
                Date: {values.approvedAt || "—"}
              </div>
            </td>
          </tr>
        </tbody>
      </table>

      <div className="ccs-instr-title">
        INSTRUCTION FOR PREPARATION OF INVOICE/QUOTATION
      </div>
      <table className="ccs-instr-table">
        <tbody>
          <tr>
            <td>
              (Administration &amp; Finance)
              <br />
              <br />
              1.0 Please prepare invoice/quotation for the above company.
              <br />
              Cheque : Enclosed / Not Enclosed
            </td>
            <td>
              (Finance)
              <br />
              <br />
              2.0 Name of Bank : ……………… Cheque No. : ………………
              <br />
              Total : RM ……………… Invoice No : ………………
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}
