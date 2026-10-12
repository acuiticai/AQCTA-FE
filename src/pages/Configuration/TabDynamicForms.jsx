import React, { useEffect, useMemo, useState } from "react";
import { useLocation } from "react-router-dom";
import axios from "axios";

import { notifyError, notifySuccess } from "@/utils/toast";
import {
  isSingleAssignedBusiness,
  syncAssignedBusinessesFromApi,
} from "@/utils/sessionAssignedBusinesses";
import { useSettingsCrudPermissions } from "@/hooks/useSettingsCrudPermissions";
import { EpcPage } from "@/components/Epc/EpcSurface";
import InspectionCostingSheetForm from "@/components/ApplicationForms/InspectionCostingSheetForm";
import EvaluationPlanForm from "@/components/ApplicationForms/EvaluationPlanForm";
import CertificationCostingSheetForm from "@/components/ApplicationForms/CertificationCostingSheetForm";
import InspectorAppointmentLetterForm from "@/components/ApplicationForms/InspectorAppointmentLetterForm";
import EngineeringInspectionReviewForm from "@/components/ApplicationForms/EngineeringInspectionReviewForm";
import InspectionPreparationForm from "@/components/ApplicationForms/InspectionPreparationForm";
import InspectionPlanNoticeForm from "@/components/ApplicationForms/InspectionPlanNoticeForm";
import InspectionGuidelineForm from "@/components/ApplicationForms/InspectionGuidelineForm";
import InspectionNotesForm from "@/components/ApplicationForms/InspectionNotesForm";
import CertificationAssignmentLetterForm from "@/components/ApplicationForms/CertificationAssignmentLetterForm";
import DocAuditChecklistForm, {
  DOC_AUDIT_EDITABLE_KEYS,
} from "@/components/ApplicationForms/DocAuditChecklistForm";
import CertificationAcceptanceLetterForm, {
  ACCEPTANCE_LETTER_EDITABLE_KEYS,
} from "@/components/ApplicationForms/CertificationAcceptanceLetterForm";
import CertificationAuditNoticeForm, {
  AUDIT_NOTICE_EDITABLE_KEYS,
} from "@/components/ApplicationForms/CertificationAuditNoticeForm";
import CertificationAuditChecklistAttendanceForm, {
  AUDIT_CHECKLIST_ATTENDANCE_EDITABLE_KEYS,
} from "@/components/ApplicationForms/CertificationAuditChecklistAttendanceForm";
import CertificationAuditNotesForm, {
  AUDIT_NOTES_EDITABLE_KEYS,
} from "@/components/ApplicationForms/CertificationAuditNotesForm";
import CertificationSelectedSamplesForm, {
  SELECTED_SAMPLES_EDITABLE_KEYS,
} from "@/components/ApplicationForms/CertificationSelectedSamplesForm";
import CertificationAuditReportForm, {
  AUDIT_REPORT_EDITABLE_KEYS,
} from "@/components/ApplicationForms/CertificationAuditReportForm";
import CertificationNonConformanceForm, {
  NON_CONFORMANCE_EDITABLE_KEYS,
} from "@/components/ApplicationForms/CertificationNonConformanceForm";
import CertificationProductTestingForm, {
  PRODUCT_TESTING_EDITABLE_KEYS,
} from "@/components/ApplicationForms/CertificationProductTestingForm";
import CertificationLabAcceptanceForm, {
  LAB_ACCEPTANCE_EDITABLE_KEYS,
} from "@/components/ApplicationForms/CertificationLabAcceptanceForm";
import CertificationReportForm, {
  CERTIFICATION_REPORT_EDITABLE_KEYS,
} from "@/components/ApplicationForms/CertificationReportForm";
import CertificationReportChangesForm from "@/components/ApplicationForms/CertificationReportChangesForm";
import CertificationRecommendationForm, {
  CERTIFICATION_RECOMMENDATION_EDITABLE_KEYS,
} from "@/components/ApplicationForms/CertificationRecommendationForm";
import CertificateApprovalLetterForm, {
  CERTIFICATE_APPROVAL_LETTER_EDITABLE_KEYS,
} from "@/components/ApplicationForms/CertificateApprovalLetterForm";
import CertificationDeliberationForm, {
  CERTIFICATION_DELIBERATION_EDITABLE_KEYS,
} from "@/components/ApplicationForms/CertificationDeliberationForm";
import Button from "@/customer/components/ui/Button";
import StatusPill from "@/customer/components/ui/StatusPill";
import { Card, CardHeader } from "@/customer/components/ui/Card";
import {
  TextField,
  TextareaField,
  SelectField,
  FormGrid,
} from "@/customer/components/ui/Field";
import {
  AlertIcon,
  ChevronDownIcon,
  ChevronRightIcon,
  DocumentIcon,
  RefreshIcon,
  SearchIcon,
} from "@/customer/components/ui/icons";

const Base_URL = import.meta.env.VITE_APP_API_BASE_URL;

const INSPECTION_COSTING_PREVIEW_KEYS = [
  "companyName",
  "address",
  "telephone",
  "email",
  "attn",
  "servicesRequired",
  "jobNumber",
  "feeLines",
  "materialCost",
  "utilityCost",
  "equipmentCost",
  "equipmentHours",
  "expectedUtilization",
  "reimbursableCost",
  "profitMarginType",
  "profitMarginValue",
  "finalPrice",
  "justification",
];

const emptyInspectionPreview = () => ({
  companyName: "Sample Company Sdn Bhd",
  address: "1 Sample Street, Kuala Lumpur",
  telephone: "03-0000 0000",
  email: "sample@example.com",
  attn: "Contact Person",
  servicesRequired: "",
  jobNumber: "INS-DEMO-001",
  feeLines: [],
  materialCost: "",
  utilityCost: "",
  equipmentCost: "",
  equipmentHours: "",
  expectedUtilization: "",
  reimbursableCost: "",
  profitMarginType: "None",
  profitMarginValue: "",
  finalPrice: "",
  justification: "",
  preparedByName: "PCI",
  preparedAt: new Date().toLocaleDateString("en-GB"),
});

const CERTIFICATION_COSTING_PREVIEW_KEYS = [
  "standardNumber",
  "applicationType",
  "typeOfCompany",
  "licenseeNo",
  "travelBasis",
  "discountType",
  "discountValue",
  "discountReason",
  "remarks",
  "feeLines",
];

const emptyCertificationPreview = () => ({
  fileNo: "APP-CERT-DEMO-001",
  applicant: "Sample Company Sdn Bhd",
  address: "1 Sample Street, Kuala Lumpur",
  product: "Sample Product",
  standardNumber: "",
  contactPerson: "Contact Person",
  telNo: "03-0000 0000",
  applicationType: "New application / Renewal",
  typeOfCompany: "",
  licenseeNo: "",
  feeLines: [],
  travelBasis: [],
  discountType: "None",
  discountValue: "",
  discountReason: "",
  remarks: "",
  subtotal: "0.00",
  discountAmount: "",
  grandTotal: "0.00",
  preparedByName: "PCI",
  preparedAt: new Date().toLocaleDateString("en-GB"),
});

const EVALUATION_PLAN_PREVIEW_KEYS = [
  "productStandard",
  "remarks",
  "activityLines",
];

const DEFAULT_EVALUATION_ACTIVITIES = [
  "Standard Suitability Study",
  "Pre-Assessment / Gap Analysis",
  "Documentation Review",
  "Factory Audit",
  "Product Sampling",
  "Product Testing",
  "Certification Recommendation",
  "Certification Review and Certification Decision",
  "Issuance of Certificate",
];

const emptyEvaluationPreview = () => ({
  fileNo: "APP-CERT-DEMO-001",
  companyName: "Sample Company Sdn Bhd",
  companyAddress: "1 Sample Street, Kuala Lumpur",
  productStandard: "",
  productName: "Sample Product",
  activityLines: [],
  remarks: "",
  preparedByName: "PCI",
  preparedByPosition: "Officer",
  preparedAt: new Date().toLocaleDateString("en-GB"),
  approvedByName: "—",
  approvedByPosition: "—",
  approvedAt: "—",
});

const INSPECTOR_APPOINTMENT_PREVIEW_KEYS = [
  "assignedCoordinator",
  "from",
  "letterDate",
];

const emptyInspectorAppointmentPreview = () => ({
  assignedInspector: "Ahmad Inspector",
  assignedCoordinator: "",
  from: "PCI Manager",
  letterDate: new Date().toISOString().slice(0, 10),
  projectName: "Sample Engineering Inspection",
  applicantCompany: "Sample Company Sdn Bhd",
  jobFileNo: "JOB-DEMO-001 / INS-DEMO-001",
  managerName: "PCI Manager",
});

const ENGINEERING_REVIEW_PREVIEW_KEYS = [
  "inspectionWork",
  "inspectionWorkRemarks",
  "workInstruction",
  "wiRefNo",
  "isMiNo",
  "standard",
  "standardNo",
  "competentPersonnel",
  "subcontractor",
  "subcontractorRemarks",
  "equipment",
  "equipmentRemarks",
  "regulatory",
  "regulatoryRemarks",
  "safety",
  "safetyRemarks",
  "otherObservations",
  "ppe",
  "ppeOthers",
  "proceed",
  "proceedRemarks",
  "notifyCustomer",
  "notificationRemarks",
  "comments",
];

const emptyEngineeringReviewPreview = () => ({
  fileNoJobNo: "JOB-DEMO-001 / INS-DEMO-001",
  inspectionWork: "",
  inspectionWorkRemarks: "",
  workInstruction: "",
  wiRefNo: "",
  isMiNo: "",
  standard: "",
  standardNo: "",
  competentPersonnel: "",
  assignmentInspector: "Ahmad Inspector",
  subcontractor: "",
  subcontractorRemarks: "",
  equipment: "",
  equipmentRemarks: "",
  regulatory: "",
  regulatoryRemarks: "",
  safety: "",
  safetyRemarks: "",
  otherObservations: "",
  ppe: [],
  ppeOthers: "",
  proceed: "",
  proceedRemarks: "",
  notifyCustomer: [],
  notificationRemarks: "",
  comments: "",
  reviewedByName: "—",
  reviewedDate: "—",
  approvedByName: "—",
  approvedDate: "—",
});

const INSPECTION_PREP_PREVIEW_KEYS = [
  "inspectionDate",
  "eq_thermography_required",
  "eq_thermography_availability",
  "eq_thermometer_required",
  "eq_thermometer_availability",
  "eq_ultrasonic_required",
  "eq_ultrasonic_availability",
  "eq_clamp_required",
  "eq_clamp_availability",
  "eq_others_required",
  "eq_others_availability",
  "eq_others_specify",
  "tool_calliper_required",
  "tool_calliper_availability",
  "tool_welding_gauge_required",
  "tool_welding_gauge_availability",
  "tool_stopwatch_required",
  "tool_stopwatch_availability",
  "tool_mirror_required",
  "tool_mirror_availability",
  "tool_torch_required",
  "tool_torch_availability",
  "tool_ruler_required",
  "tool_ruler_availability",
  "tool_others_required",
  "tool_others_availability",
  "tool_others_specify",
  "add_inspector_stamp_required",
  "add_hard_stamp_required",
  "add_others_required",
  "add_others_specify",
];

const emptyInspectionPrepPreview = () => ({
  project: "Sample Engineering Inspection",
  client: "Sample Company Sdn Bhd",
  inspectionDate: "",
  inspectorName: "—",
  inspectorDate: "—",
});

const PLAN_NOTICE_PREVIEW_KEYS = [
  "inspectionType",
  "standard",
  "scheduleDate",
  "scheduleTime",
  "inspectorEmail",
  "telephone",
  "ackPosition",
  "material_id",
  "welding_procedure",
  "welder_qualification",
  "visual_fitup",
  "welding_consumables",
  "inprocess_welding",
  "dimensional",
  "radiographs",
  "mt_pt",
  "ultrasonic",
  "nde_reports",
  "internal_inspection",
  "pwht",
  "hardness",
  "hardness_hv",
  "hardness_hb",
  "hardness_hrc",
  "visual_completed",
  "mechanical_testing",
  "pressure_leak",
  "balancing",
  "shaft_runout",
  "clearance",
  "vibration_noise",
  "mechanical_running",
  "overspeed_trip",
  "trip_systems",
  "load_noload",
  "operational",
  "npsh",
  "cleaning_painting",
  "marking_id",
  "vendor_data",
];

const emptyPlanNoticePreview = () => ({
  fileNo: "INS-DEMO-001",
  jobNo: "JOB-DEMO-001",
  noticeDate: new Date().toLocaleDateString("en-GB"),
  companyName: "Sample Company Sdn Bhd",
  companyAddress: "1 Sample Street, Kuala Lumpur",
  contactPerson: "Contact Person",
  inspectionType: "",
  standard: "",
  scheduleDate: "",
  scheduleTime: "",
  inspectorTitle: "Ahmad Inspector",
  inspectorEmail: "",
  telephone: "",
  ackName: "Contact Person",
  ackPosition: "",
});

const GUIDELINE_PREVIEW_KEYS = [
  "productProject",
  "standards",
  "scope",
  "description",
  "criticalComponents",
  "testingFacilities",
  "mandatoryMarking",
  "reporting",
  "verificationChecklist",
  "other",
  "comment",
];

const emptyGuidelinePreview = () => ({
  productProject: "Sample Engineering Inspection",
  standards: "",
  scope: "",
  description: "",
  criticalComponents: "",
  testingFacilities: "",
  mandatoryMarking: "",
  reporting: "",
  verificationChecklist: "",
  other: "",
  comment: "",
  preparedByName: "—",
  reviewedByName: "—",
});

const NOTES_ACTIVITY_KEYS = [
  "material_id",
  "welding_procedure",
  "welder_qualification",
  "visual_fitup",
  "welding_consumables",
  "inprocess_welding",
  "dimensional",
  "radiographs",
  "mt_pt",
  "ultrasonic",
  "nde_reports",
  "internal_inspection",
  "pwht",
  "hardness",
  "hardness_hv",
  "hardness_hb",
  "hardness_hrc",
  "visual_completed",
  "mechanical_testing",
  "pressure_leak",
  "balancing",
  "shaft_runout",
  "clearance",
  "vibration_noise",
  "mechanical_running",
  "overspeed_trip",
  "trip_systems",
  "load_noload",
  "operational",
  "npsh",
  "cleaning_painting",
  "marking_id",
  "vendor_data",
];

const NOTES_PREVIEW_KEYS = [
  "visitTypes",
  "visitTypes",
  "poNo",
  "description",
  "lastVisitDate",
  "visitDates",
  "lastInspector",
  "nextVisit",
  "ncrIssued",
  "ncrNumber",
  "outstandingNcr",
  "outstandingNumber",
  "releaseIssued",
  "releaseNumber",
  "actionPoints",
  "references",
  "inspectionActivities",
  "continuationDetails",
  ...NOTES_ACTIVITY_KEYS,
];

const emptyNotesPreview = () => ({
  reportNo: "IN-DEMO-001",
  projectNo: "PRJ-DEMO-001",
  inspector: "Ahmad Inspector",
  visitTypes: [],
  client: "Sample Company Sdn Bhd",
  contact: "Contact Person",
  projectRef: "Sample Engineering Inspection",
  poNo: "",
  description: "",
  lastVisitDate: "",
  visitDates: "",
  lastInspector: "",
  nextVisit: "",
  ncrIssued: "",
  ncrNumber: "",
  outstandingNcr: "",
  outstandingNumber: "",
  releaseIssued: "",
  releaseNumber: "",
  actionPoints: "",
  references: "",
  inspectionActivities: "",
  continuationDetails: "",
  inspectorName: "—",
  signatureDate: "—",
});

const ASSIGNMENT_LETTER_PREVIEW_KEYS = [
  "auditorCompetency",
  "coordinatorName",
  "coordinatorCompetency",
  "appointmentType",
  "sectionName",
  "workDescription",
  "nameOfMR",
  "sicCode",
  "productCategory",
  "productStandard",
  "formsToReturn",
];

const emptyAssignmentLetterPreview = () => ({
  auditorName: "Ali Auditor",
  auditorCompetency: "",
  coordinatorName: "",
  coordinatorCompetency: "",
  appointmentType: "",
  sectionName: "",
  workDescription: "",
  companyName: "Sample Company Sdn Bhd",
  companyAddress: "1 Sample Street, Kuala Lumpur",
  nameOfMR: "",
  fileNo: "APP-CERT-DEMO-001",
  sicCode: "",
  productName: "Sample Product",
  productCategory: "",
  productStandard: "",
  formsToReturn: "",
  managerName: "—",
  managerSignedDate: "—",
  auditorDeclaredName: "—",
  auditorNric: "—",
  auditorSignedDate: "—",
});

const DOC_AUDIT_PREVIEW_KEYS = DOC_AUDIT_EDITABLE_KEYS;

const emptyDocAuditPreview = () => ({
  companyName: "Sample Company Sdn Bhd",
  dateReceived: "01/01/2026",
  productName: "Sample Product",
  fileReference: "APP-CERT-DEMO-001",
  productStandard: "MS 1234:2020",
  workInstruction: "",
  acceptedToPreCert: "",
  preCertDate: "",
  acceptancePeriodFrom: "",
  acceptancePeriodTo: "",
  outcomeNotes: "",
  recommendedBy: "—",
  auditorDeclaredName: "—",
  auditorSignedDate: "—",
});

const emptyAcceptanceLetterPreview = () => ({
  fileNo: "APP-CERT-DEMO-001",
  letterDate: "17/09/2026",
  companyName: "Sample Company Sdn Bhd",
  companyAddress: "1 Sample Street, Kuala Lumpur",
  contactPerson: "Contact Person",
  companyEmail: "sample@example.com",
  productName: "Sample Product",
  productBrand: "Sample Brand",
  modelType: "",
  ratingSize: "",
  productStandard: "MS 1234:2020",
  testStatus: "",
  testingLaboratory: "",
  acceptanceFrom: "01/01/2026",
  acceptanceTo: "01/01/2028",
  managerName: "—",
  managerSignedDate: "—",
});

const emptyAuditNoticePreview = () => ({
  fileNo: "APP-CERT-DEMO-001",
  jobNo: "JOB-DEMO-001",
  noticeDate: "17/09/2026",
  companyName: "Sample Company Sdn Bhd",
  companyAddress: "1 Sample Street, Kuala Lumpur",
  contactPerson: "Contact Person",
  companyEmail: "sample@example.com",
  productName: "Sample Product",
  productStandard: "MS 1234:2020",
  auditType: "",
  visitDate: "",
  visitTime: "",
  ncrReference: "",
  testReportValid: "",
  auditorName: "Ali Auditor",
  auditorSection: "",
  auditorTel: "",
  customerName: "—",
  customerAckDate: "—",
  customerPosition: "—",
});

const emptyAuditChecklistAttendancePreview = () => ({
  date: "25/09/2026",
  applicantLicensee: "Sample Company Sdn Bhd",
  fileReference: "APP-CERT-DEMO-001",
  standard: "MS 1234:2020",
  cov_1_1: "",
  cov_2_1: "",
  cov_21_1: "",
  cov_3_1: "",
  cov_4_1: "",
  cov_5_1: "",
  attachAuditNotes: "",
  attachAuditReport: "",
  attachSamples: "",
  auditorName: "Ali Auditor",
  auditorDeclaredName: "—",
  auditorSignedDate: "—",
});

const emptyAuditNotesPreview = () => ({
  manufacturer: "Sample Company Sdn Bhd",
  date: "25/09/2026",
  fileReference: "APP-CERT-DEMO-001",
  reportNo: "",
  note_1_item: "",
  note_1_observation: "",
  note_1_reference: "",
  auditorName: "Ali Auditor",
  auditorDeclaredName: "—",
  auditorSignedDate: "—",
});

const emptySelectedSamplesPreview = () => ({
  sample1LaboratoriesTests: "",
  sample1Quantity: "",
  sample1ProductTypeModelClass: "",
  sample1SelectedFrom: "",
  sample1ProductionDateCodeSerial: "",
  auditorName: "Ali Auditor",
  auditorDeclaredName: "—",
  auditorSignedDate: "—",
});

/* Keys must match FORM_STAGES in AQCTA-BE/ApplicationForms/model.js.
   Insertion order also sets the order the groups render in. */
const STAGE_LABELS = {
  contract_review: "Contract Review",
  evaluation_plan: "Evaluation Plan",
  costing: "Costing",
  quotation: "Quotation",
  assignment: "Assignment Letter",
  doc_audit: "Documentation / Inspection Review",
  inspection_prep: "Inspection Preparation",
  inspection_plan_notice: "Inspection Plan Notice",
  inspection_guideline: "Inspection Guideline",
  inspection_notes: "Inspection Notes",
  acceptance: "Acceptance Letter",
  audit_notice: "Factory Audit Notice",
  audit_checklist: "Audit Checklist and Attendance List",
  audit_notes: "Audit Notes",
  selected_samples: "Identification of Selected Samples",
  audit_report: "Audit Report",
  non_conformance: "Non-Conformance Report",
  product_testing: "Requisition for Product Testing",
  lab_acceptance: "Acceptance by Testing Laboratory",
  certification_report: "Certification Report",
  certification_report_changes: "Certification Report Changes",
  certification_recommendation: "Certification Recommendation",
  certificate_approval_letter: "Certificate Approval Letter",
  certification_deliberation: "Issue for Certification Deliberation",
  official_certificate: "Official Certificate",
};

const TYPE_LABELS = {
  text: "Text",
  textarea: "Long text",
  number: "Number",
  date: "Date",
  select: "Dropdown",
  checkbox: "Checkbox",
  checkboxes: "Multi-select",
  radio: "Choice",
  file: "File upload",
  signature: "Signature",
  itemMultiSelect: "Catalogue items",
};

const SERVICE_TYPE_LABELS = {
  certification: "Certification",
  inspection: "Inspection",
};

const normalizeServiceType = (value) =>
  String(value || "").toLowerCase() === "inspection"
    ? "inspection"
    : "certification";

const serviceTypeLabel = (value) =>
  SERVICE_TYPE_LABELS[normalizeServiceType(value)];

const MAX_FEE_ROWS = 24;

/** Options are edited as one-per-line text — simpler than a list widget. */
const optionsToText = (options) => (options || []).join("\n");
const textToOptions = (text) =>
  String(text || "")
    .split("\n")
    .map((s) => s.trim())
    .filter(Boolean);

const fieldTypeLabel = (type) => TYPE_LABELS[type] || type || "Field";

/**
 * One editable field. Numbered clearly so each block is easy to tell apart.
 */
const FieldRow = ({
  index,
  field,
  draft,
  onPatch,
  disabled,
  feeItemChoices = [],
  feeCatalogDefaultIds = [],
}) => {
  const value = draft || {};
  const displayName = value.label || field.key;
  const selectedIds = Array.isArray(value.options)
    ? value.options.map(String)
    : [];
  const effectiveSelected =
    selectedIds.length > 0 ? selectedIds : feeCatalogDefaultIds.map(String);

  const toggleFeeItem = (itemId) => {
    if (disabled) return;
    const id = String(itemId);
    const current = new Set(effectiveSelected);
    if (current.has(id)) current.delete(id);
    else {
      if (current.size >= MAX_FEE_ROWS) {
        notifyError(
          `You can tick at most ${MAX_FEE_ROWS} fee items.`,
        );
        return;
      }
      current.add(id);
    }
    onPatch(field.key, { options: [...current] });
  };

  return (
    <article className="df-field">
      <header className="df-field__head">
        <span className="df-field__num" aria-hidden="true">
          {index}
        </span>
        <div className="df-field__intro">
          <div className="df-field__title">{displayName}</div>
          <div className="df-field__meta">
            <span className="df-field__type">{fieldTypeLabel(field.type)}</span>
            {field.isBound ? (
              <span className="df-field__flag">Auto-filled</span>
            ) : null}
            {field.settingsOnly ? (
              <span className="df-field__flag">Settings only</span>
            ) : null}
            {field.conditionText ? (
              <span className="df-field__flag">Conditional</span>
            ) : null}
          </div>
        </div>
      </header>

      <div className="df-field__body">
        {field.conditionText ? (
          <p className="epc-section__desc" style={{ marginBottom: 12 }}>
            {field.conditionText}
          </p>
        ) : null}

        {field.isBound ? (
          <p className="epc-notice epc-notice--info df-field__bound">
            <AlertIcon size={14} className="epc-notice__icon" />
            <span>
              Filled from the application automatically — you can only change
              the label.
            </span>
          </p>
        ) : null}

        <FormGrid>
          <TextField
            label="Label"
            disabled={disabled}
            value={value.label ?? ""}
            onChange={(e) => onPatch(field.key, { label: e.target.value })}
          />

          {!field.isBound && !field.supportsItemPicker ? (
            <TextField
              label="Placeholder"
              disabled={disabled}
              value={value.placeholder ?? ""}
              onChange={(e) =>
                onPatch(field.key, { placeholder: e.target.value })
              }
            />
          ) : null}

          <TextField
            label="Help text"
            full
            disabled={disabled}
            value={value.helpText ?? ""}
            onChange={(e) => onPatch(field.key, { helpText: e.target.value })}
          />

          {field.supportsItemPicker ? (
            <div className="epc-field epc-grid__full">
              <div className="epc-field__label">
                Catalogue items (tick up to {MAX_FEE_ROWS})
              </div>
              <p className="epc-section__desc" style={{ marginBottom: 10 }}>
                Certification costing uses fee/service items ticked here. Those
                lines appear on the fill form for the preparer.
              </p>
              {!feeItemChoices.length ? (
                <p className="epc-notice epc-notice--warning">
                  <AlertIcon size={14} className="epc-notice__icon" />
                  <span>
                    No catalogue Items found. Create fee/service Items under
                    /items first.
                  </span>
                </p>
              ) : (
                <div className="epc-choice epc-choice--stack">
                  {feeItemChoices.map((item) => {
                    const id = String(item.itemId);
                    const on = effectiveSelected.includes(id);
                    return (
                      <label
                        key={id}
                        className={[
                          "epc-choice__option",
                          on ? "is-selected" : "",
                          disabled ? "is-disabled" : "",
                        ]
                          .filter(Boolean)
                          .join(" ")}
                      >
                        <input
                          type="checkbox"
                          checked={on}
                          disabled={disabled}
                          onChange={() => toggleFeeItem(id)}
                        />
                        <span>
                          {item.name}
                          {item.itemCode ? (
                            <span className="df-field__flag" style={{ marginLeft: 8 }}>
                              {item.itemCode}
                            </span>
                          ) : null}
                        </span>
                      </label>
                    );
                  })}
                </div>
              )}
            </div>
          ) : null}

          {field.supportsOptions && !field.supportsItemPicker ? (
            <TextareaField
              label="Choices (one per line)"
              full
              rows={Math.max(2, (value.options || []).length)}
              disabled={disabled}
              value={optionsToText(value.options)}
              onChange={(e) =>
                onPatch(field.key, { options: textToOptions(e.target.value) })
              }
            />
          ) : null}

          {!field.isBound && !field.supportsItemPicker ? (
            <>
              <TextField
                label="Order on form"
                type="number"
                disabled={disabled}
                value={value.order ?? 0}
                onChange={(e) =>
                  onPatch(field.key, { order: Number(e.target.value) })
                }
              />

              <SelectField
                label="Width"
                placeholder="Half width"
                options={[
                  { value: "1", label: "Half width" },
                  { value: "2", label: "Full width" },
                ]}
                disabled={disabled}
                value={String(value.colSpan ?? 1)}
                onChange={(e) =>
                  onPatch(field.key, { colSpan: Number(e.target.value) })
                }
              />

              <div className="epc-field epc-grid__full">
                <label
                  className={`df-check${disabled ? " is-disabled" : ""}`}
                >
                  <input
                    type="checkbox"
                    disabled={disabled}
                    checked={Boolean(value.required)}
                    onChange={(e) =>
                      onPatch(field.key, { required: e.target.checked })
                    }
                  />
                  <span>Required field</span>
                </label>
              </div>
            </>
          ) : null}
        </FormGrid>
      </div>
    </article>
  );
};

/**
 * Global Settings → Dynamic Forms
 *
 * Pick a form from the workflow stages, then edit the wording users see.
 * Field keys and PDF bindings stay locked.
 */
const TabDynamicForms = () => {
  const { canUpdate } = useSettingsCrudPermissions();
  const location = useLocation();

  const [businesses, setBusinesses] = useState([]);
  const [businessId, setBusinessId] = useState("");
  const [templates, setTemplates] = useState([]);
  /* Empty means the list is showing; a form key means that form is open. */
  const [activeKey, setActiveKey] = useState("");
  const [listSearch, setListSearch] = useState("");
  const [stageFilter, setStageFilter] = useState("all");
  const [serviceTypeFilter, setServiceTypeFilter] = useState("all");
  const [drafts, setDrafts] = useState({});
  const [openSections, setOpenSections] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [inspectionPreview, setInspectionPreview] = useState(
    emptyInspectionPreview,
  );
  const [evaluationPreview, setEvaluationPreview] = useState(
    emptyEvaluationPreview,
  );
  const [certificationPreview, setCertificationPreview] = useState(
    emptyCertificationPreview,
  );
  const [appointmentPreview, setAppointmentPreview] = useState(
    emptyInspectorAppointmentPreview,
  );
  const [engineeringReviewPreview, setEngineeringReviewPreview] = useState(
    emptyEngineeringReviewPreview,
  );
  const [inspectionPrepPreview, setInspectionPrepPreview] = useState(
    emptyInspectionPrepPreview,
  );
  const [planNoticePreview, setPlanNoticePreview] = useState(
    emptyPlanNoticePreview,
  );
  const [guidelinePreview, setGuidelinePreview] = useState(
    emptyGuidelinePreview,
  );
  const [notesPreview, setNotesPreview] = useState(emptyNotesPreview);
  const [assignmentLetterPreview, setAssignmentLetterPreview] = useState(
    emptyAssignmentLetterPreview,
  );
  const [docAuditPreview, setDocAuditPreview] = useState(emptyDocAuditPreview);
  const [acceptanceLetterPreview, setAcceptanceLetterPreview] = useState(
    emptyAcceptanceLetterPreview,
  );
  const [auditNoticePreview, setAuditNoticePreview] = useState(
    emptyAuditNoticePreview,
  );
  const [auditChecklistAttendancePreview, setAuditChecklistAttendancePreview] =
    useState(emptyAuditChecklistAttendancePreview);
  const [auditNotesPreview, setAuditNotesPreview] = useState(
    emptyAuditNotesPreview,
  );
  const [selectedSamplesPreview, setSelectedSamplesPreview] = useState(
    emptySelectedSamplesPreview,
  );
  const [auditReportPreview, setAuditReportPreview] = useState(() => ({
    auditDate: "25/09/2026",
    reportNo: "AR-DEMO-001",
    jobNo: "JOB-DEMO-001",
    fileNo: "APP-CERT-DEMO-001",
    standardNo: "MS 1234:2020",
    applicant: "Sample Company Sdn Bhd",
    manufacturer: "Sample Company Sdn Bhd",
    address: "1 Sample Street, Kuala Lumpur",
    products: "Sample Product",
    scopeOfAudit: "",
    samplesSelected: "Yes",
    markingCompliance: "Yes",
    recordsSatisfactory: "Yes",
  }));
  const [nonConformancePreview, setNonConformancePreview] = useState(() => ({
    date: "25/09/2026",
    manufacturer: "Sample Company Sdn Bhd",
    reportNo: "AR-DEMO-001",
    fileRef: "APP-CERT-DEMO-001",
    ncrNo: "NCR-001",
    standardClause: "MS 1234:2020 / Clause 5.2",
    findings: "",
    correctiveActionType: "Corrective action plan within 30 days",
    caSubmissionDate: "",
    completionDate: "",
    correctiveAction: "",
    pciRepName: "",
    manufacturerRepName: "",
    manufacturerRepTel: "",
    manufacturerRepFax: "",
    verification: "",
    clearedNewNcrNo: "",
    verificationDate: "",
  }));
  const [productTestingPreview, setProductTestingPreview] = useState(() => ({
    laboratoryName: "Sample Laboratory Sdn Bhd",
    laboratoryPhone: "+603 0000 0000",
    laboratoryFax: "",
    laboratoryAttention: "Lab Manager",
    product1Name: "Sample Product × 2 units",
    product1Serial: "TAG-001",
    product1Tests: "Type test / Clause 5",
    requestedByName: "",
    requestedBySection: "Product Certification",
    requestedByTel: "",
    requestedByFax: "",
    requestedByDate: "25/09/2026",
    testingConductedBy: "",
    samplesDeliveredTo: "",
    paymentMadeTo: "",
    companyRepresentative: "",
    companyName: "Sample Company Sdn Bhd",
    companyTel: "",
    companyFax: "",
  }));
  const [labAcceptancePreview, setLabAcceptancePreview] = useState(() => ({
    agreeUndertakeTesting: "true",
    requisitionDate: "25/09/2026",
    productName: "Sample Product",
    agreeNotInvolvedDesign: "true",
    undertakeConfidentiality: "true",
    authorisedSignatory: "",
    laboratoryNameAndAddress:
      "Sample Laboratory Sdn Bhd\n1 Lab Street\nKuala Lumpur",
  }));
  const [certificationReportPreview, setCertificationReportPreview] = useState(
    () => ({
      fileNo: "PC-DEMO-001",
      edition: "1",
      dateIssued: "01/10/2026",
      issuedBy: "Sample Auditor",
      pages: "8",
      photographs: "",
      drawings: "",
      annexes: "",
      applicant: "Sample Company Sdn Bhd",
      factory: "1 Sample Street, Kuala Lumpur",
      product: "Sample Product",
      standards: "MS XXX:2020",
      certificationRequirements:
        "Product Certification Requirements in accordance to the Conformity Assessment Agreement",
      workInstruction: "",
      reportNo: "",
      reportDateIssued: "01/10/2026",
      reportIssuedBy: "Sample Auditor",
      replacesPageNo: "",
      replacesPageDate: "",
      productName: "Sample Product",
      brand: "Sample Brand",
      model: "M-01",
      type: "Type A",
      rating: "",
      size: "",
      componentList: "",
      drawingSketch: "",
      manufacturingProcess: "",
      typeTestReport: "",
      processFlowChart: "",
      qcCheckPoints: "",
      testEquipment: "",
      markingRequirements: "",
      productReEvaluationRequirements: "",
      verifiedBy: "Sample Auditor",
      verifiedDate: "",
      approvedBy: "",
      approvedDate: "",
    })
  );
  const [certificationReportChangesPreview, setCertificationReportChangesPreview] =
    useState(() => ({
      fileNo: "PC-DEMO-001",
      change_1_edition: "01",
      change_1_pageNoDate: "01 / 01-10-2026",
      change_1_details: "Updated certification information",
      change_1_annex: "Yes",
      change_1_licenseNo: "CERT-001",
      change_1_approvedDate: "01/10/2026",
      change_1_auditor: "Sample Auditor",
      change_1_verificationAuditor: "",
      preparedByName: "Sample Auditor",
      approvedByName: "",
    }));
  const [certificationRecommendationPreview, setCertificationRecommendationPreview] =
    useState(() => ({
      reportDate: "01/10/2026",
      fileNo: "PC-DEMO-001",
      clientName: "Sample Company Sdn Bhd",
      factoryAddress: "1 Sample Street, Kuala Lumpur",
      product: "Sample Product",
      brands: "Sample Brand",
      standards: "MS XXX:2020",
      managementRepresentative: "",
      applicationDate: "01/09/2026",
      acceptanceDate: "",
      audit_1_date: "10/09/2026",
      audit_1_officer: "Sample Auditor",
      audit_1_findings: "Audit completed satisfactorily.",
      check_1_1_answer: "Y",
      check_1_1_remarks: "",
      reviewingAuditorResponse: "",
      auditorResponse: "",
      page1Name: "Sample Auditor",
      page1ApprovalDate: "",
      reviewerName: "",
      reviewerDate: "",
    }));
  const [certificateApprovalLetterPreview, setCertificateApprovalLetterPreview] =
    useState(() => ({
      fileNo: "PC-DEMO-001",
      letterDate: "01/10/2026",
      companyName: "Sample Company Sdn Bhd",
      attention: "Contact Person",
      product: "Sample Product",
      brand: "Sample Brand",
      modelType: "Model A",
      ratingSize: "10A / 250V",
      standards: "MS XXX:2020",
      approvalDate: "01/10/2026",
      invoiceNo: "INV-2026-001",
      bankName: "HONG LEONG BANK",
      accountHolder: "AQC TECHNICAL ASSESSORS (M) SDN. BHD.",
      accountNumber: "24901060808",
      managerName: "(Name of Manager)",
    }));
  const [certificationDeliberationPreview, setCertificationDeliberationPreview] =
    useState(() => ({
      issue: "Initial Certification",
      company: "Sample Company Sdn Bhd",
      fileNo: "PC-DEMO-001",
      product: "Sample Product",
      standard: "MS XXX:2020",
      description: "Product description and applicable certification details.",
      recommendation:
        "Recommended for certification based on the submitted audit and testing records.",
      panelDecision: "Approved",
      comments: "",
      submittedByName: "Sample Auditor",
      submittedDate: "01/10/2026",
      supportedByName: "Sample Manager",
      supportedDate: "01/10/2026",
      approvedByName: "",
      approvedDate: "",
    }));

  const selectedOrgFromUrl = useMemo(() => {
    const raw = new URLSearchParams(location.search).get("selectedOrg");
    if (!raw || raw === "null" || raw === "undefined") return "";
    return raw;
  }, [location.search]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const list = await syncAssignedBusinessesFromApi(Base_URL);
      if (cancelled) return;
      setBusinesses(list || []);
      if (!list?.length) {
        setLoading(false);
        return;
      }
      const ids = list.map((b) => String(b._id || b.id));
      const fromUrl =
        selectedOrgFromUrl && ids.includes(selectedOrgFromUrl)
          ? selectedOrgFromUrl
          : "";
      setBusinessId(fromUrl || ids[0]);
    })();
    return () => {
      cancelled = true;
    };
  }, [selectedOrgFromUrl]);

  const load = async () => {
    if (!businessId) return;
    setLoading(true);
    try {
      const res = await axios.get(`${Base_URL}/application-form-templates`, {
        params: { businessId },
      });
      const rows = Array.isArray(res?.data?.data) ? res.data.data : [];
      setTemplates(rows);
      /* Land on the list, not inside a form. A previously open form is kept
         only if it still exists — switching business should not silently
         reopen a different business's form under the same name. */
      setActiveKey((prev) => (rows.some((r) => r.formKey === prev) ? prev : ""));
      setDrafts(
        Object.fromEntries(
          rows.map((t) => [
            t.formKey,
            {
              title: t.title,
              sections: Object.fromEntries(
                (t.sections || []).map((s) => [s.key, { ...s }]),
              ),
              fields: Object.fromEntries(
                (t.fields || []).map((f) => {
                  const copy = { ...f };
                  return [f.key, copy];
                }),
              ),
            },
          ]),
        ),
      );
    } catch (err) {
      setTemplates([]);
      notifyError(
        err?.response?.data?.message || "Failed to load the form templates",
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [businessId]);

  const active = useMemo(
    () => templates.find((t) => t.formKey === activeKey) || null,
    [templates, activeKey],
  );

  const serviceTypeCounts = useMemo(() => {
    let certification = 0;
    let inspection = 0;
    for (const t of templates) {
      if (normalizeServiceType(t.serviceType) === "inspection") inspection += 1;
      else certification += 1;
    }
    return {
      all: templates.length,
      certification,
      inspection,
    };
  }, [templates]);

  const templatesForList = useMemo(() => {
    if (serviceTypeFilter === "all") return templates;
    return templates.filter(
      (t) => normalizeServiceType(t.serviceType) === serviceTypeFilter,
    );
  }, [templates, serviceTypeFilter]);

  /* Grouped by workflow stage, in the order the stages actually run. */
  const grouped = useMemo(() => {
    const order = Object.keys(STAGE_LABELS);
    const byStage = new Map();
    for (const t of templatesForList) {
      const stage = t.stage || "other";
      if (!byStage.has(stage)) byStage.set(stage, []);
      byStage.get(stage).push(t);
    }
    return [...byStage.entries()]
      .sort(
        (a, b) =>
          (order.indexOf(a[0]) + 1 || 99) - (order.indexOf(b[0]) + 1 || 99),
      )
      .map(([stage, items]) => ({
        stage,
        label: STAGE_LABELS[stage] || stage,
        items,
      }));
  }, [templatesForList]);

  const draft = drafts[activeKey];

  const patchField = (key, patch) =>
    setDrafts((prev) => ({
      ...prev,
      [activeKey]: {
        ...prev[activeKey],
        fields: {
          ...prev[activeKey].fields,
          [key]: { ...prev[activeKey].fields[key], ...patch },
        },
      },
    }));

  const patchSection = (key, patch) =>
    setDrafts((prev) => ({
      ...prev,
      [activeKey]: {
        ...prev[activeKey],
        sections: {
          ...prev[activeKey].sections,
          [key]: { ...prev[activeKey].sections[key], ...patch },
        },
      },
    }));

  const save = async () => {
    if (!active || !draft) return;
    setSaving(true);
    try {
      const fields =
        active.formKey === "FOR-06-02" || active.formKey === "FOR-01-06"
          ? Object.values(draft.fields).filter(
              (f) => f.key !== "feeCatalog" && f.sectionKey !== "fees",
            )
          : active.formKey === "FOR-01-25"
            ? Object.values(draft.fields).filter(
                (f) =>
                  f.sectionKey !== "activities" &&
                  f.sectionKey !== "extras" &&
                  !String(f.key || "").startsWith("act_") &&
                  !String(f.key || "").startsWith("extra_"),
              )
            : Object.values(draft.fields);
      const sections =
        active.formKey === "FOR-06-02" || active.formKey === "FOR-01-06"
          ? Object.values(draft.sections).filter((s) => s.key !== "fees")
          : active.formKey === "FOR-01-25"
            ? Object.values(draft.sections).filter(
                (s) => s.key !== "activities" && s.key !== "extras",
              )
            : Object.values(draft.sections);
      const res = await axios.put(
        `${Base_URL}/application-form-templates/${active.formKey}`,
        {
          businessId,
          title: draft.title,
          sections,
          fields,
        },
      );
      if (res.data?.status) {
        notifySuccess(res.data.message || "Saved");
        await load();
      }
    } catch (err) {
      notifyError(
        err?.response?.data?.message || "Failed to save the form template",
      );
    } finally {
      setSaving(false);
    }
  };

  const reset = async () => {
    if (!active) return;
    if (
      !window.confirm(
        `Restore "${active.title}" to the default labels and options? Your changes to this form will be lost.`,
      )
    ) {
      return;
    }
    setSaving(true);
    try {
      const res = await axios.post(
        `${Base_URL}/application-form-templates/${active.formKey}/reset`,
        { businessId },
      );
      if (res.data?.status) {
        notifySuccess(res.data.message || "Restored");
        await load();
      }
    } catch (err) {
      notifyError(err?.response?.data?.message || "Failed to restore");
    } finally {
      setSaving(false);
    }
  };

  const isInspectionCosting = active?.formKey === "FOR-06-02";
  const isCertificationCosting = active?.formKey === "FOR-01-06";
  const isEvaluationPlan = active?.formKey === "FOR-01-25";
  const isInspectorAppointment = active?.formKey === "FOR-06-06";
  const isEngineeringReview = active?.formKey === "FOR-06-05";
  const isInspectionPrep = active?.formKey === "FOR-06-07-03";
  const isPlanNotice = active?.formKey === "FOR-06-07-02";
  const isGuideline = active?.formKey === "FOR-06-11";
  const isInspectionNotes = active?.formKey === "FOR-06-07";
  const isAssignmentLetter = active?.formKey === "FOR-01-10";
  const isDocAudit = active?.formKey === "FOR-01-08";
  const isAcceptanceLetter = active?.formKey === "FOR-01-09";
  const isAuditNotice = active?.formKey === "FOR-01-11";
  const isAuditChecklistAttendance = active?.formKey === "FOR-01-12";
  const isAuditNotes = active?.formKey === "FOR-01-13";
  const isSelectedSamples = active?.formKey === "FOR-01-15";
  const isAuditReport = active?.formKey === "FOR-01-16";
  const isNonConformance = active?.formKey === "FOR-01-14";
  const isProductTesting = active?.formKey === "FOR-01-17";
  const isLabAcceptance = active?.formKey === "FOR-01-18";
  const isCertificationReport = active?.formKey === "FOR-01-19";
  const isCertificationReportChanges = active?.formKey === "FOR-01-19.1";
  const isCertificationRecommendation = active?.formKey === "FOR-01-19.2";
  const isCertificateApprovalLetter = active?.formKey === "FOR-01-19.3";
  const isCertificationDeliberation = active?.formKey === "FOR-01-20";
  const isSheetForm =
    isInspectionCosting ||
    isCertificationCosting ||
    isEvaluationPlan ||
    isInspectorAppointment ||
    isEngineeringReview ||
    isInspectionPrep ||
    isPlanNotice ||
    isGuideline ||
    isInspectionNotes ||
    isAssignmentLetter ||
    isDocAudit ||
    isAcceptanceLetter ||
    isAuditNotice ||
    isAuditChecklistAttendance ||
    isAuditNotes ||
    isSelectedSamples ||
    isAuditReport ||
    isNonConformance ||
    isProductTesting ||
    isLabAcceptance ||
    isCertificationReport ||
    isCertificationReportChanges ||
    isCertificationRecommendation ||
    isCertificateApprovalLetter ||
    isCertificationDeliberation;

  const sections = useMemo(() => {
    if (!active || !draft) return [];
    const fields = [...(active.fields || [])]
      .filter((f) => {
        if (
          (active.formKey === "FOR-06-02" || active.formKey === "FOR-01-06") &&
          (f.key === "feeCatalog" || f.sectionKey === "fees")
        ) {
          return false;
        }
        if (
          active.formKey === "FOR-01-25" &&
          (f.sectionKey === "activities" ||
            f.sectionKey === "extras" ||
            String(f.key || "").startsWith("act_") ||
            String(f.key || "").startsWith("extra_"))
        ) {
          return false;
        }
        return true;
      })
      .sort(
        (a, b) =>
          (draft.fields[a.key]?.order || 0) - (draft.fields[b.key]?.order || 0),
      );
    return [...(active.sections || [])]
      .filter((s) => {
        if (
          (active.formKey === "FOR-06-02" || active.formKey === "FOR-01-06") &&
          s.key === "fees"
        ) {
          return false;
        }
        if (
          active.formKey === "FOR-01-25" &&
          (s.key === "activities" || s.key === "extras")
        ) {
          return false;
        }
        return true;
      })
      .sort(
        (a, b) =>
          (draft.sections[a.key]?.order || 0) -
          (draft.sections[b.key]?.order || 0),
      )
      .map((section) => ({
        section,
        items: fields.filter((f) => f.sectionKey === section.key),
      }))
      .filter((g) => g.items.length);
  }, [active, draft]);

  const servicesRequiredOptions = useMemo(() => {
    const fromDraft = draft?.fields?.servicesRequired?.options;
    if (Array.isArray(fromDraft) && fromDraft.length) return fromDraft;
    const fromTemplate = (active?.fields || []).find(
      (f) => f.key === "servicesRequired",
    )?.options;
    return Array.isArray(fromTemplate) ? fromTemplate : [];
  }, [active, draft]);

  const openForm = (formKey) => {
    setOpenSections({});
    setInspectionPreview(emptyInspectionPreview());
    setEvaluationPreview(emptyEvaluationPreview());
    setCertificationPreview(emptyCertificationPreview());
    setAppointmentPreview(emptyInspectorAppointmentPreview());
    setEngineeringReviewPreview(emptyEngineeringReviewPreview());
    setInspectionPrepPreview(emptyInspectionPrepPreview());
    setPlanNoticePreview(emptyPlanNoticePreview());
    setGuidelinePreview(emptyGuidelinePreview());
    setNotesPreview(emptyNotesPreview());
    setAssignmentLetterPreview(emptyAssignmentLetterPreview());
    setDocAuditPreview(emptyDocAuditPreview());
    setAcceptanceLetterPreview(emptyAcceptanceLetterPreview());
    setAuditNoticePreview(emptyAuditNoticePreview());
    setAuditChecklistAttendancePreview(emptyAuditChecklistAttendancePreview());
    setAuditNotesPreview(emptyAuditNotesPreview());
    setSelectedSamplesPreview(emptySelectedSamplesPreview());
    setActiveKey(formKey);
  };
  const closeForm = () => setActiveKey("");

  const filteredGrouped = useMemo(() => {
    const needle = listSearch.trim().toLowerCase();
    return grouped
      .filter(({ stage }) => stageFilter === "all" || stage === stageFilter)
      .map(({ stage, label, items }) => ({
        stage,
        label,
        items: items.filter((row) => {
          if (!needle) return true;
          return [
            row.title,
            row.documentCode,
            row.formKey,
            STAGE_LABELS[stage] || stage,
            serviceTypeLabel(row.serviceType),
          ]
            .filter(Boolean)
            .some((value) => String(value).toLowerCase().includes(needle));
        }),
      }))
      .filter(({ items }) => items.length > 0);
  }, [grouped, listSearch, stageFilter]);

  const totalVisible = filteredGrouped.reduce(
    (n, g) => n + g.items.length,
    0,
  );

  const businessPicker =
    !isSingleAssignedBusiness() && businesses.length > 1 ? (
      <div style={{ minWidth: 220 }}>
        <SelectField
          label="Business"
          placeholder="Choose a business"
          options={businesses.map((b) => ({
            value: String(b._id || b.id),
            label: b.name || b.businessName || "Business",
          }))}
          value={businessId}
          onChange={(e) => setBusinessId(e.target.value)}
        />
      </div>
    ) : null;

  /* ---- the list ---- */
  if (!active || !draft) {
    return (
      <EpcPage
        flush
        title="Dynamic Forms"
        subtitle="Update the labels, help text, and choices people see on certification and inspection forms."
        action={businessPicker}
      >
        <Card>
          <CardHeader
            title="Choose a form to edit"
            subtitle={
              loading
                ? "Loading forms…"
                : `${templates.length} form${templates.length === 1 ? "" : "s"} across certification and inspection`
            }
          />

          {!loading && templates.length > 0 ? (
            <div className="df-toolbar">
              <div className="df-search">
                <SearchIcon size={16} aria-hidden="true" />
                <input
                  type="search"
                  className="df-search__input"
                  placeholder="Search forms…"
                  value={listSearch}
                  onChange={(e) => setListSearch(e.target.value)}
                  aria-label="Search forms"
                />
              </div>

              {(serviceTypeCounts.certification > 0 &&
                serviceTypeCounts.inspection > 0) ||
              serviceTypeFilter !== "all" ? (
                <div
                  className="df-stages"
                  role="tablist"
                  aria-label="Filter by service type"
                >
                  {[
                    { key: "all", label: "All services", count: serviceTypeCounts.all },
                    {
                      key: "certification",
                      label: "Certification",
                      count: serviceTypeCounts.certification,
                    },
                    {
                      key: "inspection",
                      label: "Inspection",
                      count: serviceTypeCounts.inspection,
                    },
                  ].map(({ key, label, count }) => (
                    <button
                      key={key}
                      type="button"
                      role="tab"
                      aria-selected={serviceTypeFilter === key}
                      className={`df-stages__chip${
                        serviceTypeFilter === key ? " is-active" : ""
                      }`}
                      onClick={() => {
                        setServiceTypeFilter(key);
                        setStageFilter("all");
                      }}
                    >
                      {label}
                      <span className="df-stages__count">{count}</span>
                    </button>
                  ))}
                </div>
              ) : null}

              {grouped.length > 1 ? (
                <div className="df-stages" role="tablist" aria-label="Filter by stage">
                  <button
                    type="button"
                    role="tab"
                    aria-selected={stageFilter === "all"}
                    className={`df-stages__chip${
                      stageFilter === "all" ? " is-active" : ""
                    }`}
                    onClick={() => setStageFilter("all")}
                  >
                    All stages
                  </button>
                  {grouped.map(({ stage, label, items }) => (
                    <button
                      key={stage}
                      type="button"
                      role="tab"
                      aria-selected={stageFilter === stage}
                      className={`df-stages__chip${
                        stageFilter === stage ? " is-active" : ""
                      }`}
                      onClick={() => setStageFilter(stage)}
                    >
                      {label}
                      <span className="df-stages__count">{items.length}</span>
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
          ) : null}

          {loading ? (
            <p className="epc-table-empty">Loading forms…</p>
          ) : !templates.length ? (
            <p className="epc-notice epc-notice--warn">
              <AlertIcon size={16} className="epc-notice__icon" />
              <span>
                No forms are set up for this business yet. Restart the API
                server so the default templates can be created, then reload
                this page.
              </span>
            </p>
          ) : totalVisible === 0 ? (
            <p className="epc-table-empty">No forms match your search.</p>
          ) : (
            <div className="df-groups">
              {filteredGrouped.map(({ stage, label, items }) => (
                <section key={stage} className="df-group">
                  <header className="df-group__head">
                    <h3 className="df-group__title">{label}</h3>
                    <span className="df-group__count">
                      {items.length} form{items.length === 1 ? "" : "s"}
                    </span>
                  </header>

                  <ul className="df-list">
                    {items.map((row) => {
                      const fieldCount = (row.fields || []).length;
                      const service = normalizeServiceType(row.serviceType);
                      return (
                        <li key={row.formKey}>
                          <button
                            type="button"
                            className="df-list__item"
                            onClick={() => openForm(row.formKey)}
                          >
                            <span className="df-list__icon" aria-hidden="true">
                              <DocumentIcon size={18} />
                            </span>
                            <span className="df-list__body">
                              <span className="df-list__title">{row.title}</span>
                              <span className="df-list__meta">
                                {serviceTypeLabel(service)}
                                {" · "}
                                {row.documentCode}
                                {" · "}
                                {fieldCount} field
                                {fieldCount === 1 ? "" : "s"}
                              </span>
                            </span>
                            <span className="df-list__side">
                              <StatusPill
                                status={serviceTypeLabel(service)}
                                tone={
                                  service === "inspection"
                                    ? "warning"
                                    : "info"
                                }
                              />
                              <StatusPill
                                status={
                                  row.customerVisible
                                    ? "Customer sees this"
                                    : "Internal only"
                                }
                                tone={
                                  row.customerVisible ? "info" : "neutral"
                                }
                              />
                              <span className="df-list__action">
                                {canUpdate ? "Edit" : "View"}
                                <ChevronRightIcon size={14} />
                              </span>
                            </span>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                </section>
              ))}
            </div>
          )}
        </Card>
      </EpcPage>
    );
  }

  /* ---- one form, opened ---- */
  return (
    <EpcPage
      flush
      title={active.title}
      subtitle={
        isSheetForm
          ? "Preview matches the PDF sheet. Labels stay editable below."
          : "Change the wording on this form. Field structure stays fixed so printed documents stay correct."
      }
      back={{ label: "All forms", onClick: closeForm }}
      action={
        canUpdate ? (
          <div className="df-page-actions">
            <Button variant="secondary" disabled={saving} onClick={reset}>
              <RefreshIcon size={15} /> Restore default
            </Button>
            <Button disabled={saving} onClick={save}>
              {saving ? "Saving…" : "Save changes"}
            </Button>
          </div>
        ) : null
      }
    >
      <div className="epc-stack">
        <Card>
          <div className="epc-facts">
            <div>
              <div className="epc-facts__label">Service</div>
              <div className="epc-facts__value">
                <StatusPill
                  status={serviceTypeLabel(active.serviceType)}
                  tone={
                    normalizeServiceType(active.serviceType) === "inspection"
                      ? "warning"
                      : "info"
                  }
                />
              </div>
            </div>
            <div>
              <div className="epc-facts__label">Document</div>
              <div className="epc-facts__value">{active.documentCode}</div>
            </div>
            <div>
              <div className="epc-facts__label">Stage</div>
              <div className="epc-facts__value">
                {STAGE_LABELS[active.stage] || active.stage}
              </div>
            </div>
            <div>
              <div className="epc-facts__label">Who fills it</div>
              <div className="epc-facts__value">
                {active.customerVisible ? "Customer & staff" : "Staff only"}
              </div>
            </div>
            <div>
              <div className="epc-facts__label">Version</div>
              <div className="epc-facts__value">{active.version}</div>
            </div>
          </div>
        </Card>

        {!active.isFillable ? (
          <p className="epc-notice epc-notice--info">
            <AlertIcon size={16} className="epc-notice__icon" />
            <span>
              This document is built from the application automatically — nobody
              types into it. Labels here only change how it reads on screen.
            </span>
          </p>
        ) : null}

        <Card>
          <CardHeader
            title="Form name"
            subtitle="Shown at the top when someone opens this form."
          />
          <TextField
            label="Title"
            disabled={!canUpdate}
            value={draft.title ?? ""}
            onChange={(e) =>
              setDrafts((p) => ({
                ...p,
                [activeKey]: { ...p[activeKey], title: e.target.value },
              }))
            }
          />
        </Card>

        {isInspectionCosting ? (
          <Card>
            <CardHeader
              title="Costing sheet preview"
              subtitle="Same layout as the fill form and PDF. Staff Manhours items come from /items — no ticks needed here. Try the sheet below; sample data is not saved."
            />
            {!(active.feeCatalogItems || []).length ? (
              <p className="epc-notice epc-notice--warning" style={{ marginBottom: 16 }}>
                <AlertIcon size={14} className="epc-notice__icon" />
                <span>
                  No Staff Manhours Items yet. Create items under that category
                  in /items — they appear in the sheet dropdown automatically.
                </span>
              </p>
            ) : null}
            <InspectionCostingSheetForm
              values={inspectionPreview}
              onChange={(key, value) =>
                setInspectionPreview((prev) => ({ ...prev, [key]: value }))
              }
              readOnly={false}
              feeCatalogItems={active.feeCatalogItems || active.feeItemChoices || []}
              editableKeys={INSPECTION_COSTING_PREVIEW_KEYS}
              servicesRequiredOptions={servicesRequiredOptions}
              servicesRequiredPlaceholder={
                draft.fields?.servicesRequired?.placeholder ||
                "Select inspection service"
              }
            />
          </Card>
        ) : null}

        {isCertificationCosting ? (
          <Card>
            <CardHeader
              title="Costing sheet preview"
              subtitle="Same layout as the fill form and PDF. Fee items come from /items (Service / AQCTA-FEE) — no ticks needed here. Sample data is not saved."
            />
            {!(active.feeCatalogItems || active.feeItemChoices || []).length ? (
              <p className="epc-notice epc-notice--warning" style={{ marginBottom: 16 }}>
                <AlertIcon size={14} className="epc-notice__icon" />
                <span>
                  No fee Items yet. Create Service or AQCTA-FEE-* items under
                  /items — they appear in the sheet dropdown automatically.
                </span>
              </p>
            ) : null}
            <CertificationCostingSheetForm
              values={certificationPreview}
              onChange={(key, value) =>
                setCertificationPreview((prev) => ({ ...prev, [key]: value }))
              }
              readOnly={false}
              feeCatalogItems={active.feeCatalogItems || active.feeItemChoices || []}
              editableKeys={CERTIFICATION_COSTING_PREVIEW_KEYS}
            />
          </Card>
        ) : null}

        {isEvaluationPlan ? (
          <Card>
            <CardHeader
              title="Evaluation plan preview"
              subtitle="Same layout as the fill form and PDF. Add activities from the dropdown — no catalogue ticks in Settings. Sample data is not saved."
            />
            <EvaluationPlanForm
              values={evaluationPreview}
              onChange={(key, value) =>
                setEvaluationPreview((prev) => ({ ...prev, [key]: value }))
              }
              readOnly={false}
              editableKeys={EVALUATION_PLAN_PREVIEW_KEYS}
              activityCatalog={DEFAULT_EVALUATION_ACTIVITIES}
            />
          </Card>
        ) : null}

        {isInspectorAppointment ? (
          <Card>
            <CardHeader
              title="Appointment letter preview"
              subtitle="Same layout as the fill form and PDF. Co-ordinator options come from other inspectors at fill time. Sample data is not saved."
            />
            <InspectorAppointmentLetterForm
              values={appointmentPreview}
              onChange={(key, value) =>
                setAppointmentPreview((prev) => ({ ...prev, [key]: value }))
              }
              readOnly={false}
              editableKeys={INSPECTOR_APPOINTMENT_PREVIEW_KEYS}
              coordinatorOptions={[
                "Sample Co-ordinator A",
                "Sample Co-ordinator B",
              ]}
            />
          </Card>
        ) : null}

        {isEngineeringReview ? (
          <Card>
            <CardHeader
              title="Review checklist preview"
              subtitle="Same layout as the fill form and PDF. Tick findings and add remarks — sample data is not saved."
            />
            <EngineeringInspectionReviewForm
              values={engineeringReviewPreview}
              onChange={(key, value) =>
                setEngineeringReviewPreview((prev) => ({
                  ...prev,
                  [key]: value,
                }))
              }
              readOnly={false}
              editableKeys={ENGINEERING_REVIEW_PREVIEW_KEYS}
            />
          </Card>
        ) : null}

        {isInspectionPrep ? (
          <Card>
            <CardHeader
              title="Preparation checklist preview"
              subtitle="Same layout as the fill form and PDF. Circle Yes/No and availability — sample data is not saved."
            />
            <InspectionPreparationForm
              values={inspectionPrepPreview}
              onChange={(key, value) =>
                setInspectionPrepPreview((prev) => ({ ...prev, [key]: value }))
              }
              readOnly={false}
              editableKeys={INSPECTION_PREP_PREVIEW_KEYS}
            />
          </Card>
        ) : null}

        {isPlanNotice ? (
          <Card>
            <CardHeader
              title="Plan notice preview"
              subtitle="Same layout as the fill form and PDF. Mark activities with X — sample data is not saved."
            />
            <InspectionPlanNoticeForm
              values={planNoticePreview}
              onChange={(key, value) =>
                setPlanNoticePreview((prev) => ({ ...prev, [key]: value }))
              }
              readOnly={false}
              editableKeys={PLAN_NOTICE_PREVIEW_KEYS}
            />
          </Card>
        ) : null}

        {isGuideline ? (
          <Card>
            <CardHeader
              title="Guideline preview"
              subtitle="Same layout as the fill form and PDF. Fill each guideline item — sample data is not saved."
            />
            <InspectionGuidelineForm
              values={guidelinePreview}
              onChange={(key, value) =>
                setGuidelinePreview((prev) => ({ ...prev, [key]: value }))
              }
              readOnly={false}
              editableKeys={GUIDELINE_PREVIEW_KEYS}
            />
          </Card>
        ) : null}

        {isInspectionNotes ? (
          <Card>
            <CardHeader
              title="Inspection notes preview"
              subtitle="Same multi-page layout as the fill form and PDF. Sample data is not saved."
            />
            <InspectionNotesForm
              values={notesPreview}
              onChange={(key, value) =>
                setNotesPreview((prev) => ({ ...prev, [key]: value }))
              }
              readOnly={false}
              editableKeys={NOTES_PREVIEW_KEYS}
            />
          </Card>
        ) : null}

        {isAssignmentLetter ? (
          <Card>
            <CardHeader
              title="Assignment letter preview"
              subtitle="Same layout as the fill form and PDF. Manager signs on issue; auditor accepts later. Sample data is not saved."
            />
            <CertificationAssignmentLetterForm
              values={assignmentLetterPreview}
              onChange={(key, value) =>
                setAssignmentLetterPreview((prev) => ({
                  ...prev,
                  [key]: value,
                }))
              }
              readOnly={false}
              editableKeys={ASSIGNMENT_LETTER_PREVIEW_KEYS}
            />
          </Card>
        ) : null}

        {isDocAudit ? (
          <Card>
            <CardHeader
              title="Documentation audit preview"
              subtitle="Same checklist layout as the fill form and PDF. Auditor signs on issue. Sample data is not saved."
            />
            <DocAuditChecklistForm
              values={docAuditPreview}
              onChange={(key, value) =>
                setDocAuditPreview((prev) => ({ ...prev, [key]: value }))
              }
              readOnly={false}
              editableKeys={DOC_AUDIT_PREVIEW_KEYS}
              documentTitle="DOCUMENTATION AUDIT CHECKLIST"
              documentCode="AQCTA-FOR-01-08"
            />
          </Card>
        ) : null}

        {isAcceptanceLetter ? (
          <Card>
            <CardHeader
              title="Acceptance letter preview"
              subtitle="Same letter layout as the fill form and PDF. Manager signs on issue. Sample data is not saved."
            />
            <CertificationAcceptanceLetterForm
              values={acceptanceLetterPreview}
              onChange={(key, value) =>
                setAcceptanceLetterPreview((prev) => ({
                  ...prev,
                  [key]: value,
                }))
              }
              readOnly={false}
              editableKeys={ACCEPTANCE_LETTER_EDITABLE_KEYS}
            />
          </Card>
        ) : null}

        {isAuditNotice ? (
          <Card>
            <CardHeader
              title="Factory audit notice preview"
              subtitle="Same notice layout as the fill form and PDF. Auditor signs on issue; customer acknowledges later. Sample data is not saved."
            />
            <CertificationAuditNoticeForm
              values={auditNoticePreview}
              onChange={(key, value) =>
                setAuditNoticePreview((prev) => ({ ...prev, [key]: value }))
              }
              readOnly={false}
              editableKeys={AUDIT_NOTICE_EDITABLE_KEYS}
            />
          </Card>
        ) : null}

        {isAuditChecklistAttendance ? (
          <Card>
            <CardHeader
              title="Audit checklist and attendance preview"
              subtitle="Same checklist layout as the fill form and PDF. Auditor signs on issue. Sample data is not saved."
            />
            <CertificationAuditChecklistAttendanceForm
              values={auditChecklistAttendancePreview}
              onChange={(key, value) =>
                setAuditChecklistAttendancePreview((prev) => ({
                  ...prev,
                  [key]: value,
                }))
              }
              readOnly={false}
              editableKeys={AUDIT_CHECKLIST_ATTENDANCE_EDITABLE_KEYS}
            />
          </Card>
        ) : null}

        {isAuditNotes ? (
          <Card>
            <CardHeader
              title="Audit notes preview"
              subtitle="Same notes layout as the fill form and PDF. Auditor signs on issue. Sample data is not saved."
            />
            <CertificationAuditNotesForm
              values={auditNotesPreview}
              onChange={(key, value) =>
                setAuditNotesPreview((prev) => ({ ...prev, [key]: value }))
              }
              readOnly={false}
              editableKeys={AUDIT_NOTES_EDITABLE_KEYS}
            />
          </Card>
        ) : null}

        {isSelectedSamples ? (
          <Card>
            <CardHeader
              title="Selected samples preview"
              subtitle="Same landscape layout as the fill form and PDF. Auditor signs on issue. Sample data is not saved."
            />
            <CertificationSelectedSamplesForm
              values={selectedSamplesPreview}
              onChange={(key, value) =>
                setSelectedSamplesPreview((prev) => ({
                  ...prev,
                  [key]: value,
                }))
              }
              readOnly={false}
              editableKeys={SELECTED_SAMPLES_EDITABLE_KEYS}
            />
          </Card>
        ) : null}

        {isAuditReport ? (
          <Card>
            <CardHeader
              title="Audit report preview"
              subtitle="Same field set as the fill form and PDF. Auditor issues; manufacturer acknowledges. Sample data is not saved."
            />
            <CertificationAuditReportForm
              values={auditReportPreview}
              onChange={(key, value) =>
                setAuditReportPreview((prev) => ({ ...prev, [key]: value }))
              }
              readOnly={false}
              editableKeys={AUDIT_REPORT_EDITABLE_KEYS}
            />
          </Card>
        ) : null}

        {isNonConformance ? (
          <Card>
            <CardHeader
              title="Non-conformance report preview"
              subtitle="Same field set as the fill form and PDF. Auditor issues; manufacturer acknowledges. Sample data is not saved."
            />
            <CertificationNonConformanceForm
              values={nonConformancePreview}
              onChange={(key, value) =>
                setNonConformancePreview((prev) => ({
                  ...prev,
                  [key]: value,
                }))
              }
              readOnly={false}
              editableKeys={NON_CONFORMANCE_EDITABLE_KEYS}
            />
          </Card>
        ) : null}

        {isProductTesting ? (
          <Card>
            <CardHeader
              title="Product testing requisition preview"
              subtitle="Same field set as the fill form and PDF. Auditor issues; manufacturer agrees. Sample data is not saved."
            />
            <CertificationProductTestingForm
              values={productTestingPreview}
              onChange={(key, value) =>
                setProductTestingPreview((prev) => ({
                  ...prev,
                  [key]: value,
                }))
              }
              readOnly={false}
              editableKeys={PRODUCT_TESTING_EDITABLE_KEYS}
            />
          </Card>
        ) : null}

        {isLabAcceptance ? (
          <Card>
            <CardHeader
              title="Laboratory acceptance preview"
              subtitle="Same field set as the fill form and PDF. Auditor records the laboratory authorised signature. Sample data is not saved."
            />
            <CertificationLabAcceptanceForm
              values={labAcceptancePreview}
              onChange={(key, value) =>
                setLabAcceptancePreview((prev) => ({
                  ...prev,
                  [key]: value,
                }))
              }
              readOnly={false}
              editableKeys={LAB_ACCEPTANCE_EDITABLE_KEYS}
            />
          </Card>
        ) : null}

        {isCertificationReport ? (
          <Card>
            <CardHeader
              title="Certification report preview"
              subtitle="Same field set as the fill form and PDF (AQCTA-FOR-01-19). Sample data is not saved."
            />
            <CertificationReportForm
              values={certificationReportPreview}
              onChange={(key, value) =>
                setCertificationReportPreview((prev) => ({
                  ...prev,
                  [key]: value,
                }))
              }
              readOnly={false}
              editableKeys={CERTIFICATION_REPORT_EDITABLE_KEYS}
            />
          </Card>
        ) : null}

        {isCertificationReportChanges ? (
          <Card>
            <CardHeader
              title="Certification report changes preview"
              subtitle="Same field set as the fill form and PDF (AQCTA-FOR-01-19.1). Sample data is not saved."
            />
            <CertificationReportChangesForm
              values={certificationReportChangesPreview}
              onChange={(key, value) =>
                setCertificationReportChangesPreview((prev) => ({
                  ...prev,
                  [key]: value,
                }))
              }
              readOnly={false}
              repeatableRows={{ changes: 1 }}
            />
          </Card>
        ) : null}

        {isCertificationRecommendation ? (
          <Card>
            <CardHeader
              title="Certification recommendation preview"
              subtitle="Same field set as the fill form and PDF (AQCTA-FOR-01-19.2). Sample data is not saved."
            />
            <CertificationRecommendationForm
              values={certificationRecommendationPreview}
              onChange={(key, value) =>
                setCertificationRecommendationPreview((prev) => ({
                  ...prev,
                  [key]: value,
                }))
              }
              readOnly={false}
              editableKeys={CERTIFICATION_RECOMMENDATION_EDITABLE_KEYS}
              repeatableRows={{ audit_summary: 1 }}
            />
          </Card>
        ) : null}

        {isCertificateApprovalLetter ? (
          <Card>
            <CardHeader
              title="Certificate approval letter preview"
              subtitle="Same field set as the fill form and PDF (AQCTA-FOR-01-19.3). Sample data is not saved."
            />
            <CertificateApprovalLetterForm
              values={certificateApprovalLetterPreview}
              onChange={(key, value) =>
                setCertificateApprovalLetterPreview((prev) => ({
                  ...prev,
                  [key]: value,
                }))
              }
              readOnly={false}
              editableKeys={CERTIFICATE_APPROVAL_LETTER_EDITABLE_KEYS}
            />
          </Card>
        ) : null}

        {isCertificationDeliberation ? (
          <Card>
            <CardHeader
              title="Certification deliberation preview"
              subtitle="Same field set as the fill form and PDF (AQCTA-FOR-01-20). Sample data is not saved."
            />
            <CertificationDeliberationForm
              values={certificationDeliberationPreview}
              onChange={(key, value) =>
                setCertificationDeliberationPreview((prev) => ({
                  ...prev,
                  [key]: value,
                }))
              }
              readOnly={false}
              editableKeys={CERTIFICATION_DELIBERATION_EDITABLE_KEYS}
            />
          </Card>
        ) : null}

        <div className="df-sections-intro">
          <h2 className="df-sections-intro__title">
            {isSheetForm ? "Labels & options" : "Sections & fields"}
          </h2>
          <p className="df-sections-intro__desc">
            {isInspectionCosting
              ? "Adjust wording and the Services required choices. Staff lines are selected on the sheet itself."
              : isCertificationCosting
                ? "Adjust job labels, travel options, and discount wording. Fee lines are added on the sheet via dropdown."
                : isEvaluationPlan
                  ? "Adjust job-detail labels and remarks wording. Activities are added on the sheet via dropdown."
                  : isInspectorAppointment
                    ? "Adjust field labels for the assignment letter. Layout matches the HTML/PDF sheet."
                    : isEngineeringReview
                      ? "Adjust checklist item labels if needed. Layout and ticks match the HTML/PDF sheet."
                      : isInspectionPrep
                        ? "Adjust equipment/tool labels if needed. Circle choices match the HTML/PDF sheet."
                        : isPlanNotice
                          ? "Adjust visit field labels and inspection-type options. Activity ticks match the HTML/PDF sheet."
                          : isGuideline
                            ? "Adjust guideline item labels if needed. Table layout matches the HTML/PDF sheet."
                            : isInspectionNotes
                              ? "Adjust notes field labels if needed. Multi-page layout matches the HTML/PDF sheet."
                              : isAssignmentLetter
                                ? "Adjust assignment field labels if needed. Layout matches the HTML/PDF sheet."
                                : isDocAudit
                                  ? "Adjust checklist and outcome field labels if needed. Layout matches the HTML/PDF sheet."
                                  : isAcceptanceLetter
                                    ? "Adjust product-detail labels if needed. Letter layout matches the HTML/PDF sheet."
                                    : isAuditNotice
                                      ? "Adjust visit and scope field labels if needed. Notice layout matches the HTML/PDF sheet."
                                      : isAuditChecklistAttendance
                                        ? "Adjust coverage and attachment field labels if needed. Layout matches the HTML/PDF sheet."
                                        : isAuditNotes
                                          ? "Adjust header field labels if needed. Notes rows and layout match the HTML/PDF sheet."
                                          : isSelectedSamples
                                            ? "Adjust sample field labels if needed. Landscape layout matches the HTML/PDF sheet."
                                        : "Open a section to edit its heading and the fields inside it."}
          </p>
        </div>

        {sections.map(({ section, items }) => {
          const open = openSections[section.key] !== false;
          const sectionTitle =
            draft.sections[section.key]?.title || section.key;
          return (
            <Card padded={false} key={section.key}>
              <button
                type="button"
                className="epc-doc__head df-section-toggle"
                onClick={() =>
                  setOpenSections((p) => ({ ...p, [section.key]: !open }))
                }
                aria-expanded={open}
              >
                {open ? (
                  <ChevronDownIcon size={16} />
                ) : (
                  <ChevronRightIcon size={16} />
                )}
                <span className="epc-doc__grow">
                  <span className="epc-doc__title">{sectionTitle}</span>
                  {draft.sections[section.key]?.description ? (
                    <span className="epc-doc__meta">
                      {draft.sections[section.key].description}
                    </span>
                  ) : null}
                </span>
                <span className="epc-doc__meta">
                  {items.length} field{items.length === 1 ? "" : "s"}
                </span>
              </button>

              {open ? (
                <div className="epc-doc__body df-section-body">
                  <FormGrid>
                    <TextField
                      label="Section title"
                      disabled={!canUpdate}
                      value={draft.sections[section.key]?.title ?? ""}
                      onChange={(e) =>
                        patchSection(section.key, { title: e.target.value })
                      }
                    />
                    <TextField
                      label="Section description"
                      disabled={!canUpdate}
                      value={draft.sections[section.key]?.description ?? ""}
                      onChange={(e) =>
                        patchSection(section.key, {
                          description: e.target.value,
                        })
                      }
                    />
                  </FormGrid>

                  <div className="df-fields">
                    {items.map((field, i) => (
                      <FieldRow
                        key={field.key}
                        index={i + 1}
                        field={field}
                        draft={draft.fields[field.key]}
                        onPatch={patchField}
                        disabled={!canUpdate}
                        feeItemChoices={active.feeItemChoices || []}
                        feeCatalogDefaultIds={active.feeCatalogDefaultIds || []}
                      />
                    ))}
                  </div>
                </div>
              ) : null}
            </Card>
          );
        })}

        {canUpdate ? (
          <Card>
            <div className="epc-actions df-save-bar">
              <Button disabled={saving} onClick={save}>
                {saving ? "Saving…" : "Save changes"}
              </Button>
              <Button variant="secondary" disabled={saving} onClick={reset}>
                Restore default
              </Button>
              <span className="epc-section__desc df-save-hint">
                New checklists will use your saved wording. Forms already in
                progress keep what they started with.
              </span>
            </div>
          </Card>
        ) : null}
      </div>
    </EpcPage>
  );
};

export default TabDynamicForms;
