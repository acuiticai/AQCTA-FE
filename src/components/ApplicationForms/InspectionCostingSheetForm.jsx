import React, { useMemo } from "react";
import { Plus, Trash2 } from "lucide-react";
import Combobox from "@/customer/components/ui/Combobox";
import SignaturePad from "@/components/ApplicationForms/SignaturePad";

const money = (value) => {
  const n = Number(String(value ?? "").replace(/[^0-9.-]/g, ""));
  return Number.isFinite(n) ? n : 0;
};

const formatMoney = (n) =>
  Number(n || 0).toLocaleString("en-MY", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

/** Official sheet rule: round proposed price to the nearest RM5.00. */
const roundNearest5 = (n) => Math.round(money(n) / 5) * 5;

const staffLetter = (index) => String.fromCharCode(97 + (index % 26));

const MAX_STAFF_LINES = 26;

/** Fallback when API / Settings has no Inspection Service options yet. */
const DEFAULT_SERVICE_OPTIONS = [
  "Engineering Inspection",
  "Inspection Service",
  "Factory Assessment",
];

const PCI_LOGO_SRC = `${process.env.PUBLIC_URL || ""}/aqcta-logo.png`;

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
      <span className={`ics-dv ics-dv--${align} ${className}`.trim()}>
        {text || ""}
      </span>
    );
  }
  return (
    <input
      type={type}
      inputMode={type === "number" ? "decimal" : undefined}
      step={type === "number" ? "any" : undefined}
      className={`ics-in ics-in--${align} ${className}`.trim()}
      value={value ?? ""}
      placeholder={placeholder}
      onChange={(e) => onChange?.(e.target.value)}
    />
  );
};

/**
 * Inspection costing fill UI — same structure/labels as
 * `templates/inspectionCostingSheet.html` (AQCTA-FOR-06-02).
 *
 * Staff Manhours items may be selected on more than one line. A4 amount is
 * always (equipment cost × machine hours) ÷ expected utilization. PRICE is
 * the proposed price rounded to the nearest RM5.00.
 */
export default function InspectionCostingSheetForm({
  values = {},
  onChange,
  readOnly = false,
  feeCatalogItems = [],
  invalidKeys = [],
  editableKeys = [],
  servicesRequiredOptions = [],
  servicesRequiredPlaceholder = "Select inspection service",
  preparedSignature = "",
  onPreparedSignatureChange,
  profileSignature = "",
  preparedSignatureUrl = "",
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
        label: item.name || item.itemCode || "Staff",
      })),
    [feeCatalogItems],
  );

  const serviceOptionsList = useMemo(() => {
    const raw =
      Array.isArray(servicesRequiredOptions) && servicesRequiredOptions.length
        ? servicesRequiredOptions
        : DEFAULT_SERVICE_OPTIONS;
    const mapped = raw
      .map((opt) =>
        typeof opt === "string"
          ? { value: opt, label: opt }
          : {
              value: String(opt?.value || opt?.label || opt?.name || "").trim(),
              label: String(opt?.label || opt?.value || opt?.name || "").trim(),
            },
      )
      .filter((opt) => opt.value);
    const current = String(values.servicesRequired || "").trim();
    if (current && !mapped.some((opt) => opt.value === current)) {
      mapped.unshift({ value: current, label: current });
    }
    return mapped.length ? mapped : DEFAULT_SERVICE_OPTIONS.map((v) => ({
      value: v,
      label: v,
    }));
  }, [servicesRequiredOptions, values.servicesRequired]);

  const setField = (key, value) => onChange?.(key, value);
  const setLines = (next) => onChange?.("feeLines", next);

  const updateLine = (index, patch) => {
    if (readOnly) return;
    const next = lines.map((line, i) => {
      if (i !== index) return line;
      const merged = { ...line, ...patch };
      const cost = money(merged.manhourCost);
      const hours = money(merged.hours);
      const hasParts =
        String(merged.manhourCost ?? "").trim() !== "" ||
        String(merged.hours ?? "").trim() !== "";
      return {
        ...merged,
        amount: hasParts ? String(cost * hours) : "",
      };
    });
    setLines(next);
  };

  const selectItem = (index, itemId) => {
    if (readOnly || !itemId) return;
    const item = catalogById.get(String(itemId));
    if (!item) return;
    /* Same Staff Manhours item may appear on more than one line. */
    updateLine(index, {
      itemId: item.itemId,
      itemCode: item.itemCode || "",
      name: item.name || item.itemCode || "Staff",
      sellingPrice: item.sellingPrice || 0,
      manhourCost:
        item.sellingPrice > 0
          ? String(item.sellingPrice)
          : lines[index]?.manhourCost || "",
    });
  };

  const addLine = () => {
    if (readOnly || lines.length >= MAX_STAFF_LINES) return;
    if (lines.some((line) => !String(line.itemId || "").trim())) return;
    if (!(feeCatalogItems || []).length) return;
    setLines([
      ...lines,
      {
        itemId: "",
        itemCode: "",
        name: "",
        manhourCost: "",
        hours: "",
        amount: "",
        sellingPrice: 0,
      },
    ]);
  };

  const removeLine = (index) => {
    if (readOnly) return;
    setLines(lines.filter((_, i) => i !== index));
  };

  const canAdd =
    !readOnly &&
    lines.length < MAX_STAFF_LINES &&
    (feeCatalogItems || []).length > 0 &&
    !lines.some((line) => !String(line.itemId || "").trim());

  /* Live totals — same rules as computations.js / PDF. */
  const staffTotal = lines.reduce((sum, line) => {
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

  const unitCost = money(values.equipmentCost);
  const machineHours = money(values.equipmentHours);
  const utilization = money(values.expectedUtilization) || 1;
  const a4Total =
    unitCost > 0 && machineHours > 0
      ? (unitCost * machineHours) / utilization
      : 0;

  const directTotal =
    staffTotal +
    money(values.materialCost) +
    money(values.utilityCost) +
    a4Total;
  const overhead = directTotal * 0.5;
  const totalCost = directTotal + overhead + money(values.reimbursableCost);

  const profitType = String(values.profitMarginType || "None");
  const profitRaw = money(values.profitMarginValue);
  let profitRm = 0;
  let profitPct = 0;
  if (profitType === "Percentage" && profitRaw > 0) {
    profitRm = (totalCost * profitRaw) / 100;
    profitPct = profitRaw;
  } else if (profitType === "Amount" && profitRaw > 0) {
    profitRm = profitRaw;
    profitPct = totalCost > 0 ? (profitRm / totalCost) * 100 : 0;
  }

  const proposed = totalCost + profitRm;
  const rounded = roundNearest5(proposed);
  const staffLetters =
    lines.length > 0 ? lines.map((_, i) => staffLetter(i)).join("+") : "a";

  return (
    <div className="ics-page">
      <header className="ics-header">
        <div className="ics-logo-wrap">
          <img
            className="ics-logo"
            src={PCI_LOGO_SRC}
            alt="AQCTA logo"
          />
        </div>
        <div className="ics-company-heading">
          <div className="ics-company-name">AQC Technical Assessors (M) Sdn. Bhd.</div>
          <div className="ics-title">COSTING SHEET</div>
          <div className="ics-title">INSPECTION GROUP</div>
          <div className="ics-subtitle">
            CONFORMITY ASSESSMENT DEPARTMENT
          </div>
        </div>
      </header>

      <table className="ics-info-table">
        <tbody>
          <tr>
            <td className="ics-section-no">(i)</td>
            <td className="ics-labels">
              <div>Company:</div>
              <div>Address:</div>
              <div>Telephone:</div>
              <div>Email:</div>
              <div>Attn:</div>
            </td>
            <td className="ics-value">
              <div className={invalid.has("companyName") ? "ics-bad" : ""}>
                <CellInput
                  value={values.companyName}
                  readOnly={!canEdit("companyName")}
                  onChange={(v) => setField("companyName", v)}
                />
              </div>
              <div className={invalid.has("address") ? "ics-bad" : ""}>
                <CellInput
                  value={values.address}
                  readOnly={!canEdit("address")}
                  onChange={(v) => setField("address", v)}
                />
              </div>
              <div className={invalid.has("telephone") ? "ics-bad" : ""}>
                <CellInput
                  value={values.telephone}
                  readOnly={!canEdit("telephone")}
                  onChange={(v) => setField("telephone", v)}
                />
              </div>
              <div className={invalid.has("email") ? "ics-bad" : ""}>
                <CellInput
                  value={values.email}
                  readOnly={!canEdit("email")}
                  onChange={(v) => setField("email", v)}
                />
              </div>
              <div className={invalid.has("attn") ? "ics-bad" : ""}>
                <CellInput
                  value={values.attn}
                  readOnly={!canEdit("attn")}
                  onChange={(v) => setField("attn", v)}
                />
              </div>
            </td>
          </tr>
          <tr>
            <td className="ics-section-no">(ii)</td>
            <td className="ics-services-label">Services required:</td>
            <td
              className={`ics-value ${
                invalid.has("servicesRequired") ? "ics-bad" : ""
              }`}
            >
              {readOnly ? (
                <span className="ics-dv">{values.servicesRequired || ""}</span>
              ) : serviceOptionsList.length > 0 ? (
                <Combobox
                  searchable={serviceOptionsList.length > 6}
                  clearable={false}
                  placeholder={servicesRequiredPlaceholder}
                  emptyMessage="No inspection services configured"
                  value={values.servicesRequired || ""}
                  options={serviceOptionsList}
                  onChange={(val) => setField("servicesRequired", val || "")}
                />
              ) : (
                <CellInput
                  value={values.servicesRequired}
                  onChange={(v) => setField("servicesRequired", v)}
                  placeholder="Services required"
                />
              )}
            </td>
          </tr>
          <tr>
            <td className="ics-section-no">(iii)</td>
            <td className="ics-job-label">Job&apos;s Number:</td>
            <td className="ics-value">
              <CellInput value={values.jobNumber} readOnly />
            </td>
          </tr>
        </tbody>
      </table>

      <table className="ics-cost-table">
        <thead>
          <tr>
            <th className="ics-code" />
            <th className="ics-category">STAFF COST</th>
            <th className="ics-manhour-cost">RM</th>
            <th className="ics-manhour">Hour</th>
            <th className="ics-amount">RM</th>
            {!readOnly ? <th className="ics-act" /> : null}
          </tr>
          <tr>
            <th />
            <th>Staff category</th>
            <th>Manhour Cost</th>
            <th>Manhour*</th>
            <th />
            {!readOnly ? <th /> : null}
          </tr>
        </thead>
        <tbody>
          {lines.length === 0 ? (
            <tr className="ics-staff-row">
              <td className="ics-staff-code">a</td>
              <td colSpan={readOnly ? 4 : 5} className="ics-empty-hint">
                {readOnly
                  ? "No staff lines."
                  : "Add staff lines below — the same item can be used more than once."}
              </td>
            </tr>
          ) : (
            lines.map((line, index) => {
              const cost = money(line.manhourCost);
              const hours = money(line.hours);
              const hasParts =
                String(line.manhourCost ?? "").trim() !== "" ||
                String(line.hours ?? "").trim() !== "";
              const total = hasParts ? formatMoney(cost * hours) : "";
              return (
                <tr
                  key={`staff-${index}-${line.itemId || "new"}`}
                  className="ics-staff-row"
                >
                  <td className="ics-staff-code">{staffLetter(index)}</td>
                  <td>
                    {readOnly ? (
                      <span className="ics-dv">
                        {line.name || line.itemCode || ""}
                      </span>
                    ) : (
                      <Combobox
                        searchable={itemOptions.length > 6}
                        clearable={false}
                        placeholder="Select staff item…"
                        emptyMessage="No Staff Manhours items"
                        value={line.itemId || ""}
                        options={itemOptions}
                        onChange={(val) => selectItem(index, val)}
                      />
                    )}
                  </td>
                  <td>
                    <CellInput
                      type="number"
                      align="right"
                      value={line.manhourCost}
                      readOnly={readOnly}
                      placeholder="0.00"
                      onChange={(v) => updateLine(index, { manhourCost: v })}
                    />
                  </td>
                  <td>
                    <CellInput
                      type="number"
                      align="right"
                      value={line.hours}
                      readOnly={readOnly}
                      placeholder="0"
                      onChange={(v) => updateLine(index, { hours: v })}
                    />
                  </td>
                  <td className="ics-amount">{total}</td>
                  {!readOnly ? (
                    <td className="ics-act">
                      <button
                        type="button"
                        className="ics-trash"
                        onClick={() => removeLine(index)}
                        aria-label="Remove line"
                        title="Remove line"
                      >
                        <Trash2 size={13} />
                      </button>
                    </td>
                  ) : null}
                </tr>
              );
            })
          )}

          {!readOnly ? (
            <tr className="ics-add-row">
              <td colSpan={6}>
                <button
                  type="button"
                  className="ics-add-btn"
                  disabled={!canAdd}
                  onClick={addLine}
                >
                  <Plus size={14} />
                  Add staff line
                </button>
                {!(feeCatalogItems || []).length ? (
                  <span className="ics-hint">
                    Create Items under category &quot;Staff Manhours&quot; first.
                  </span>
                ) : null}
              </td>
            </tr>
          ) : null}

          <tr className="ics-summary-row">
            <td className="ics-summary-code">A1</td>
            <td colSpan={3} className="ics-summary-label">
              Total staff cost ({staffLetters})
            </td>
            <td className="ics-amount">{formatMoney(staffTotal)}</td>
            {!readOnly ? <td /> : null}
          </tr>

          <tr className="ics-summary-row">
            <td className="ics-summary-code">A2</td>
            <td colSpan={3} className="ics-summary-label">
              Direct Material Cost
            </td>
            <td className="ics-amount">
              <CellInput
                type="number"
                align="right"
                value={values.materialCost}
                readOnly={readOnly}
                placeholder="0.00"
                onChange={(v) => setField("materialCost", v)}
              />
            </td>
            {!readOnly ? <td /> : null}
          </tr>

          <tr className="ics-summary-row">
            <td className="ics-summary-code">A3</td>
            <td colSpan={3} className="ics-summary-label">
              Utility Cost
            </td>
            <td className="ics-amount">
              <CellInput
                type="number"
                align="right"
                value={values.utilityCost}
                readOnly={readOnly}
                placeholder="0.00"
                onChange={(v) => setField("utilityCost", v)}
              />
            </td>
            {!readOnly ? <td /> : null}
          </tr>

          {/* A4 — formula matches PDF; amount = (unit × hours) ÷ utilization */}
          <tr className="ics-equipment-row">
            <td className="ics-summary-code">A4</td>
            <td colSpan={2} className="ics-equipment-formula">
              <div className="ics-underline">Equipment cost X Machine Hour</div>
              <div>Expected Utilization</div>
              {!readOnly ? (
                <div className="ics-a4-inputs">
                  <label>
                    Equipment cost (RM)
                    <CellInput
                      type="number"
                      align="right"
                      value={values.equipmentCost}
                      onChange={(v) => setField("equipmentCost", v)}
                      placeholder="0.00"
                    />
                  </label>
                  <label>
                    Expected utilization
                    <CellInput
                      type="number"
                      align="right"
                      value={values.expectedUtilization}
                      onChange={(v) => setField("expectedUtilization", v)}
                      placeholder="1"
                    />
                  </label>
                </div>
              ) : (
                <div className="ics-a4-readonly">
                  Unit {formatMoney(unitCost)} · Util {utilization}
                </div>
              )}
            </td>
            <td style={{ textAlign: "center" }}>
              <CellInput
                type="number"
                align="right"
                value={values.equipmentHours}
                readOnly={readOnly}
                placeholder="0"
                onChange={(v) => setField("equipmentHours", v)}
              />
            </td>
            <td className="ics-amount">{formatMoney(a4Total)}</td>
            {!readOnly ? <td /> : null}
          </tr>

          <tr className="ics-summary-row">
            <td className="ics-summary-code">A</td>
            <td colSpan={3} className="ics-bold">
              TOTAL DIRECT COST (A1 + A2 + A3 + A4)
            </td>
            <td className="ics-amount">{formatMoney(directTotal)}</td>
            {!readOnly ? <td /> : null}
          </tr>

          <tr className="ics-summary-row">
            <td className="ics-summary-code">B</td>
            <td colSpan={3}>
              <span className="ics-bold">Overhead Cost (50%)</span>
              <br />
              0.5 X (A1 + A2 + A3 + A4)
            </td>
            <td className="ics-amount">{formatMoney(overhead)}</td>
            {!readOnly ? <td /> : null}
          </tr>

          <tr className="ics-summary-row">
            <td className="ics-summary-code">C</td>
            <td colSpan={3}>
              <span className="ics-bold">REIMBURSEABLE</span>
              <br />
              Travelling &amp; Lodging (Estimate)
            </td>
            <td className="ics-amount">
              <CellInput
                type="number"
                align="right"
                value={values.reimbursableCost}
                readOnly={readOnly}
                placeholder="0.00"
                onChange={(v) => setField("reimbursableCost", v)}
              />
            </td>
            {!readOnly ? <td /> : null}
          </tr>

          <tr className="ics-summary-row">
            <td className="ics-summary-code">D</td>
            <td colSpan={3} className="ics-bold">
              TOTAL COST (A + B + C)
            </td>
            <td className="ics-amount">{formatMoney(totalCost)}</td>
            {!readOnly ? <td /> : null}
          </tr>

          <tr className="ics-profit-row">
            <td className="ics-summary-code">E</td>
            <td colSpan={3} className="ics-bold">
              Profit Margin (RM)
              {!readOnly ? (
                <div className="ics-profit-controls">
                  {["None", "Amount", "Percentage"].map((opt) => (
                    <label key={opt} className="ics-radio">
                      <input
                        type="radio"
                        name="profitMarginType"
                        checked={profitType === opt}
                        onChange={() => setField("profitMarginType", opt)}
                      />
                      {opt}
                    </label>
                  ))}
                  {profitType === "Amount" || profitType === "Percentage" ? (
                    <CellInput
                      type="number"
                      align="right"
                      className="ics-profit-val"
                      value={values.profitMarginValue}
                      placeholder={
                        profitType === "Percentage" ? "% e.g. 10" : "RM"
                      }
                      onChange={(v) => setField("profitMarginValue", v)}
                    />
                  ) : null}
                </div>
              ) : null}
            </td>
            <td className="ics-amount ics-yellow">{formatMoney(profitRm)}</td>
            {!readOnly ? <td /> : null}
          </tr>

          <tr className="ics-profit-row">
            <td />
            <td colSpan={3} className="ics-bold">
              Profit Margin (%)
            </td>
            <td className="ics-amount ics-yellow">
              {profitPct > 0 ? `${profitPct.toFixed(2)}%` : ""}
            </td>
            {!readOnly ? <td /> : null}
          </tr>

          <tr className="ics-price-row">
            <td className="ics-summary-code">F</td>
            <td colSpan={3} className="ics-bold">
              PROPOSED PRICE (D + E)
            </td>
            <td className="ics-amount">{formatMoney(proposed)}</td>
            {!readOnly ? <td /> : null}
          </tr>

          <tr className="ics-price-row">
            <td />
            <td colSpan={3}>
              PRICE (Nearest to RM5.00)
              <span className="ics-round-hint">
                {" "}
                — rounds {formatMoney(proposed)} → {formatMoney(rounded)}
              </span>
            </td>
            <td className="ics-amount">{formatMoney(rounded)}</td>
            {!readOnly ? <td /> : null}
          </tr>
        </tbody>
      </table>

      <table className="ics-signatures">
        <tbody>
          <tr>
            <td className="ics-sig-head">Prepared by:</td>
            <td className="ics-sig-head">Checked by:</td>
            <td className="ics-sig-head ics-approved">Approved by**</td>
          </tr>
          <tr>
            <td className="ics-prepared-cell">
              {!readOnly ? (
                <SignaturePad
                  compact
                  label="Prepared by signature"
                  value={preparedSignature}
                  onChange={onPreparedSignatureChange}
                  profileSignature={profileSignature}
                  hint="Draw or upload your signature for this costing sheet."
                />
              ) : preparedSignatureUrl || preparedSignature ? (
                <img
                  className="ics-sig-image"
                  src={preparedSignature || preparedSignatureUrl}
                  alt="Prepared by signature"
                />
              ) : (
                <div className="ics-sig-placeholder">No signature</div>
              )}
              <div className="ics-sig-details">
                Name: {values.preparedByName || "—"}
                <br />
                Date: {values.preparedAt || "—"}
              </div>
            </td>
            <td>
              <div className="ics-sig-details">
                Name: {values.checkedByName || "—"}
                <br />
                Date: {values.checkedAt || "—"}
              </div>
            </td>
            <td className="ics-approved">
              <div className="ics-sig-details">
                Name: {values.approvedByName || "—"}
                <br />
                Date: {values.approvedAt || "—"}
              </div>
              <div className="ics-final-price">
                ***Final Price:{" "}
                {readOnly ? (
                  formatMoney(
                    String(values.finalPrice ?? "").trim() !== ""
                      ? money(values.finalPrice)
                      : rounded,
                  )
                ) : (
                  <CellInput
                    type="number"
                    align="right"
                    className="ics-final-in"
                    value={values.finalPrice}
                    placeholder={formatMoney(rounded)}
                    onChange={(v) => setField("finalPrice", v)}
                  />
                )}
              </div>
            </td>
          </tr>
        </tbody>
      </table>

      <div className="ics-justification">
        *** Justification For Final Price (if vary with Proposal Price)
        {readOnly ? (
          <span className="ics-dv"> {values.justification || ""}</span>
        ) : (
          <textarea
            className="ics-textarea"
            rows={2}
            value={values.justification || ""}
            onChange={(e) => setField("justification", e.target.value)}
            placeholder="Required when final price differs from proposed / rounded price"
          />
        )}
      </div>

      <div className="ics-notes">
        <div className="ics-notes-title">Note:</div>
        <div className="ics-note-line">
          <div className="ics-note-symbol">*</div>
          <div>Nearest 15 minutes</div>
        </div>
        <div className="ics-note-line">
          <div className="ics-note-symbol">**</div>
          <div>
            LOA:&nbsp;&nbsp; 1. Up To RM10,000 - Senior Executive
            <br />
            &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; 2. Up To RM50,000 -
            Manager
            <br />
            &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; 3. Up To RM500,000
            - General Manager
            <br />
            &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp; 4. Above RM500,000
            - Managing Director
          </div>
        </div>
      </div>

      <footer className="ics-footer">
        <div>
          AQC Technical Assessors (M) Sdn. Bhd.
          <br />
          Issue : 1 Rev. 0
        </div>
        <div className="ics-center">Inspection</div>
        <div className="ics-right">AQCTA-FOR-06-02</div>
      </footer>
    </div>
  );
}
