/**
 * The post-submission certification workflow, in order.
 *
 * This is the registry the Actions page renders from. Adding the next stage is
 * one entry here plus its component — nothing else needs to know the sequence.
 *
 * `statusFrom` reads the stage's state off the application document so the rail
 * can show progress without loading every form.
 *
 * AQCTA: stages are further filtered per scheme (ISO 13485 / GDPMD / CoAWOV /
 * Tech Docs) via aqctaSchemeWorkflows — see stagesForApplication.
 */

import {
  CERTIFICATION_STAGE_FORMS,
  resolveScheme,
  stageKeysForScheme,
  titleForSchemeStage,
} from "@/config/aqctaSchemeWorkflows";

export const WORKFLOW_STAGES = [
  {
    key: "contract_review",
    phase: "application",
    title: "Contract Review",
    documentCode: "",
    description:
      "One system user prepares the checklist, a second approves it. The decision notifies the customer.",
    serviceTypes: ["certification"],
    available: true,
    statusFrom: (application) =>
      application?.contractReviewStatus || "Not Started",
  },
  {
    key: "evaluation_plan",
    phase: "application",
    title: "Evaluation Plan",
    documentCode: "",
    description:
      "One system user plans the evaluation activities, another approves or rejects them. A rejection includes a reason and returns the plan so it can be corrected and resubmitted.",
    serviceTypes: ["certification"],
    available: true,
    statusFrom: (application) =>
      application?.evaluationPlanStatus || "Not Started",
  },
  {
    key: "costing",
    phase: "application",
    title: "Costing Sheet",
    documentCode: "",
    description:
      "One system user prices the work, another approves it. Discounts are recorded.",
    serviceTypes: ["certification"],
    available: true,
    /* Older records default this to "—"; treat that as not started. */
    statusFrom: (application) => {
      const raw = String(application?.costingStatus || "").trim();
      return !raw || raw === "—" ? "Not Started" : raw;
    },
  },
  {
    key: "costing",
    phase: "application",
    title: "Inspection Costing Sheet",
    documentCode: "",
    description:
      "Admin prepares pricing (PIC: Admin). Approval follows LOA: up to RM10k Senior Executive, RM50k Manager, RM500k General Manager, above Managing Director.",
    serviceTypes: ["inspection"],
    available: true,
    statusFrom: (application) => {
      const raw = String(application?.costingStatus || "").trim();
      return !raw || raw === "—" ? "Not Started" : raw;
    },
  },
  {
    key: "quotation",
    phase: "application",
    title: "Quotation",
    documentCode: "",
    description:
      "Issued to the customer when the costing sheet is approved, for them to accept or decline.",
    serviceTypes: ["certification"],
    available: true,
    /* Issued as "Sent", then the customer's own decision. */
    statusFrom: (application) => {
      const raw = String(application?.quotationStatus || "").trim();
      if (!raw || raw === "—") return "Not Started";
      return raw === "Sent" ? "Awaiting Customer" : raw;
    },
  },
  {
    key: "quotation",
    phase: "application",
    title: "Quotation",
    documentCode: "",
    description:
      "Issued to the customer when the costing sheet is approved, for them to accept or decline.",
    serviceTypes: ["inspection"],
    available: true,
    statusFrom: (application) => {
      const raw = String(application?.quotationStatus || "").trim();
      if (!raw || raw === "—") return "Not Started";
      return raw === "Sent" ? "Awaiting Customer" : raw;
    },
  },
  {
    key: "assignment",
    phase: "audit",
    title: "Assignment Letter",
    documentCode: "",
    description:
      "Appoints the auditor. A manager signs it; the auditor accepts and signs to take the job.",
    serviceTypes: ["certification"],
    available: true,
    statusFrom: (application) => {
      const raw = String(application?.assignmentLetterStatus || "").trim();
      return !raw || raw === "—" ? "Not Started" : raw;
    },
  },
  {
    key: "assignment",
    phase: "audit",
    title: "Letter of Appointment as Inspector",
    documentCode: "",
    description:
      "Admin prepares and signs the letter after an inspector is assigned (PIC: Admin).",
    serviceTypes: ["inspection"],
    available: true,
    statusFrom: (application) => {
      const raw = String(application?.assignmentLetterStatus || "").trim();
      return !raw || raw === "—" ? "Not Started" : raw;
    },
  },
  {
    key: "doc_audit",
    phase: "audit",
    title: "Documentation Audit",
    documentCode: "",
    description:
      "The auditor's review of the submitted documents. Internal — the customer never sees it.",
    serviceTypes: ["certification"],
    available: true,
    statusFrom: (application) => {
      const raw = String(application?.docAuditStatus || "").trim();
      return !raw || raw === "—" ? "Not Started" : raw;
    },
  },
  {
    key: "doc_audit",
    phase: "audit",
    title: "Checklist for Review of Engineering Inspection",
    documentCode: "",
    description:
      "Prepared by the assigned inspector or admin (PIC: Inspector / Admin). A second reviewer approves. Internal — the customer never sees it.",
    serviceTypes: ["inspection"],
    available: true,
    statusFrom: (application) => {
      const raw = String(application?.docAuditStatus || "").trim();
      return !raw || raw === "—" ? "Not Started" : raw;
    },
  },
  {
    key: "inspection_prep",
    phase: "audit",
    title: "Checklist for Preparation of Inspection",
    documentCode: "",
    description:
      "Prepared by the assigned inspector only (PIC: Inspector). Records required test equipment, hand tools and additional items. Internal.",
    serviceTypes: ["inspection"],
    available: true,
    statusFrom: (application) => {
      const raw = String(application?.inspectionPrepStatus || "").trim();
      return !raw || raw === "—" ? "Not Started" : raw;
    },
  },
  {
    key: "inspection_plan_notice",
    phase: "audit",
    title: "Inspection Plan Notice for Engineering Inspection",
    documentCode: "",
    description:
      "Issued by the assigned inspector (PIC: Inspector / Client). The customer downloads, signs, stamps and returns the slip.",
    serviceTypes: ["inspection"],
    available: true,
    statusFrom: (application) => {
      const raw = String(application?.inspectionPlanNoticeStatus || "").trim();
      return !raw || raw === "—" ? "Not Started" : raw;
    },
  },
  {
    key: "inspection_guideline",
    phase: "audit",
    title: "Inspection Guideline",
    documentCode: "",
    description:
      "Prepared by the assigned inspector only (PIC: Inspector); a manager reviews and approves. Internal.",
    serviceTypes: ["inspection"],
    available: true,
    statusFrom: (application) => {
      const raw = String(application?.inspectionGuidelineStatus || "").trim();
      return !raw || raw === "—" ? "Not Started" : raw;
    },
  },
  {
    key: "inspection_notes",
    phase: "audit",
    title: "Inspection Notes",
    documentCode: "",
    description:
      "Filed by the assigned inspector only (PIC: Inspector) — activities, equipment, NCRs and attachments.",
    serviceTypes: ["inspection"],
    available: true,
    statusFrom: (application) => {
      const raw = String(application?.inspectionNotesStatus || "").trim();
      return !raw || raw === "—" ? "Not Started" : raw;
    },
  },
  {
    key: "acceptance",
    phase: "audit",
    title: "Acceptance Letter",
    documentCode: "",
    description:
      "Tells the customer their documents are accepted, and for how long the acceptance runs.",
    serviceTypes: ["certification"],
    available: true,
    statusFrom: (application) => {
      const raw = String(application?.acceptanceLetterStatus || "").trim();
      return !raw || raw === "—" ? "Not Started" : raw;
    },
  },
  {
    key: "audit_notice",
    phase: "audit",
    title: "Factory Audit Notice",
    documentCode: "",
    description:
      "Tells the customer when the site visit is and what will be inspected. They confirm receipt.",
    serviceTypes: ["certification"],
    available: true,
    statusFrom: (application) => {
      const raw = String(application?.auditNoticeStatus || "").trim();
      return !raw || raw === "—" ? "Not Started" : raw;
    },
  },
  {
    key: "audit_checklist",
    phase: "audit",
    title: "Audit Checklist and Attendance List",
    documentCode: "",
    description:
      "On-site attendance and coverage checklist filed by the auditor after the factory visit. Internal — the customer never sees it.",
    serviceTypes: ["certification"],
    available: true,
    statusFrom: (application) => {
      const raw = String(application?.auditChecklistStatus || "").trim();
      return !raw || raw === "—" ? "Not Started" : raw;
    },
  },
  {
    key: "audit_notes",
    phase: "audit",
    title: "Audit Notes",
    documentCode: "",
    description:
      "Internal on-site audit notes. Available in parallel with the checklist once the factory audit notice is signed.",
    serviceTypes: ["certification"],
    available: true,
    statusFrom: (application) => {
      const raw = String(application?.auditNotesStatus || "").trim();
      return !raw || raw === "—" ? "Not Started" : raw;
    },
  },
  {
    key: "selected_samples",
    phase: "audit",
    title: "Identification of Selected Samples",
    documentCode: "",
    description:
      "Records samples taken from the production line or storage for testing. Available in parallel once the factory audit notice is signed.",
    serviceTypes: ["certification"],
    available: true,
    statusFrom: (application) => {
      const raw = String(application?.selectedSamplesStatus || "").trim();
      return !raw || raw === "—" ? "Not Started" : raw;
    },
  },
  {
    key: "audit_report",
    phase: "audit",
    title: "Audit Report",
    documentCode: "",
    description:
      "Customer-facing factory audit report. Issued by the auditor; the manufacturer acknowledges agreement.",
    serviceTypes: ["certification"],
    available: true,
    statusFrom: (application) => {
      const raw = String(application?.auditReportStatus || "").trim();
      return !raw || raw === "—" ? "Not Started" : raw;
    },
  },
  {
    key: "non_conformance",
    phase: "audit",
    title: "Non-Conformance Report",
    documentCode: "",
    description:
      "Raise an NCR during the factory visit. Manufacturer acknowledges; corrective action can be verified later.",
    serviceTypes: ["certification"],
    available: true,
    statusFrom: (application) => {
      const raw = String(application?.nonConformanceStatus || "").trim();
      return !raw || raw === "—" ? "Not Started" : raw;
    },
  },
  {
    key: "product_testing",
    phase: "audit",
    title: "Requisition for Product Testing",
    documentCode: "",
    description:
      "Request laboratory testing for selected samples. Manufacturer agrees to delivery and payment terms.",
    serviceTypes: ["certification"],
    available: true,
    statusFrom: (application) => {
      const raw = String(application?.productTestingStatus || "").trim();
      return !raw || raw === "—" ? "Not Started" : raw;
    },
  },
  {
    key: "lab_acceptance",
    phase: "audit",
    title: "Acceptance by Testing Laboratory",
    documentCode: "",
    description:
      "Record the laboratory’s acceptance of the product testing requisition.",
    serviceTypes: ["certification"],
    available: true,
    statusFrom: (application) => {
      const raw = String(application?.labAcceptanceStatus || "").trim();
      return !raw || raw === "—" ? "Not Started" : raw;
    },
  },
  {
    key: "certification_report",
    phase: "audit",
    title: "Certification Report",
    documentCode: "",
    description:
      "Prepare the product certification report after laboratory acceptance. Submitted for digital approval.",
    serviceTypes: ["certification"],
    available: true,
    statusFrom: (application) => {
      const raw = String(application?.certificationReportStatus || "").trim();
      return !raw || raw === "—" ? "Not Started" : raw;
    },
  },
  {
    key: "certification_report_changes",
    phase: "audit",
    title: "Certification Report Changes",
    documentCode: "",
    description:
      "Record changes to the certification report or licence. Submitted for digital approval.",
    serviceTypes: ["certification"],
    available: true,
    statusFrom: (application) => {
      const raw = String(
        application?.certificationReportChangesStatus || "",
      ).trim();
      return !raw || raw === "—" ? "Not Started" : raw;
    },
  },
  {
    key: "certification_recommendation",
    phase: "audit",
    title: "Certification Recommendation",
    documentCode: "",
    description:
      "Recommend the product for certification after report changes. Includes review checklist and digital approval.",
    serviceTypes: ["certification"],
    available: true,
    statusFrom: (application) => {
      const raw = String(
        application?.certificationRecommendationStatus || "",
      ).trim();
      return !raw || raw === "—" ? "Not Started" : raw;
    },
  },
  {
    key: "certificate_approval_letter",
    phase: "audit",
    title: "Certificate / Decision Letter",
    documentCode: "",
    description:
      "Notify the applicant that the product certification licence is approved. Submitted for digital approval, then released to the customer.",
    serviceTypes: ["certification"],
    available: true,
    statusFrom: (application) => {
      const raw = String(
        application?.certificateApprovalLetterStatus || "",
      ).trim();
      return !raw || raw === "—" ? "Not Started" : raw;
    },
  },
  {
    key: "certification_deliberation",
    phase: "audit",
    title: "Issue for Certification Deliberation",
    documentCode: "",
    description:
      "Put the case to the certification panel with recommendation and panel decision. Submitted for digital approval.",
    serviceTypes: ["certification"],
    available: true,
    statusFrom: (application) => {
      const raw = String(
        application?.certificationDeliberationStatus || "",
      ).trim();
      return !raw || raw === "—" ? "Not Started" : raw;
    },
  },
  {
    key: "official_certificate",
    phase: "audit",
    title: "Official Certificate",
    documentCode: "",
    description:
      "Issue the framed Certificate of Conformity or Registration (MDA CAB artwork). Submitted for digital approval, then released to the customer.",
    serviceTypes: ["certification"],
    available: true,
    statusFrom: (application) => {
      const raw = String(application?.officialCertificateStatus || "").trim();
      return !raw || raw === "—" ? "Not Started" : raw;
    },
  },
  {
    key: "project",
    phase: "application",
    title: "Project",
    documentCode: "",
    description:
      "Opens once the customer accepts the quotation, and carries the work from there.",
    serviceTypes: ["certification", "inspection"],
    available: true,
    statusFrom: (application) =>
      application?.projectNumber ? "Completed" : "Not Started",
  },
];

/**
 * Stages for this application.
 * Legacy inspection type keeps the inspection track; AQCTA certification apps
 * are filtered by scheme stage set (service / formData.scheme).
 */
export const stagesForApplication = (application) => {
  const type =
    application?.type === "inspection" ? "inspection" : "certification";

  if (type === "inspection") {
    return WORKFLOW_STAGES.filter((stage) =>
      stage.serviceTypes.includes("inspection"),
    );
  }

  const scheme = resolveScheme(application);
  const allowed = new Set(stageKeysForScheme(scheme));

  return WORKFLOW_STAGES.filter(
    (stage) =>
      stage.serviceTypes.includes("certification") && allowed.has(stage.key),
  ).map((stage) => {
    const formMeta = CERTIFICATION_STAGE_FORMS[stage.key];
    return {
      ...stage,
      title: titleForSchemeStage(scheme, stage.key, stage.title),
      documentCode: formMeta?.documentCode || stage.documentCode || "",
      formKey: formMeta?.formKey || stage.formKey || "",
    };
  });
};

/**
 * The workflow runs across two surfaces.
 *
 * Everything up to the project is decided on the application — it is still an
 * enquiry being assessed and priced. Once a project exists the work is
 * operational, and the audit stages are managed there, where the auditor and
 * the schedule live. The documents are the same either way; only the screen
 * that drives them changes.
 */
export const APPLICATION_PHASE = "application";
export const AUDIT_PHASE = "audit";

/** Stages worked on the application's own Actions page. */
export const applicationPhaseStages = (application) =>
  stagesForApplication(application).filter(
    (stage) => stage.phase !== AUDIT_PHASE,
  );

/** Stages worked on the project. */
export const auditPhaseStages = (application) =>
  stagesForApplication(application).filter(
    (stage) => stage.phase === AUDIT_PHASE,
  );

/** Tone used by the status pill and the rail marker. */
export const STAGE_STATUS_TONE = {
  "Not Started": "idle",
  Draft: "idle",
  "Pending Approval": "busy",
  "Awaiting Customer": "busy",
  "Awaiting Signature": "busy",
  Signed: "done",
  Sent: "busy",
  Open: "busy",
  "In Progress": "busy",
  Rejected: "stop",
  Declined: "stop",
  Accepted: "done",
  Approved: "done",
  Completed: "done",
};

/** Terminal statuses — the stage is finished and the next one is the work. */
export const STAGE_DONE_STATUSES = ["Accepted", "Approved", "Completed", "Signed"];

export const isStageDone = (status) =>
  STAGE_DONE_STATUSES.includes(String(status || "").trim());

/**
 * Stages that unlock together once their shared prerequisite is met.
 * Checklist (FOR-01-12), notes (FOR-01-13) and samples (FOR-01-15) all open
 * after the factory audit notice is signed — none waits on the others.
 */
/** Parallel peers once on-site audit notice is signed (AQCTA QMS / GDPMD path). */
export const PARALLEL_AUDIT_STAGE_KEYS = [
  "audit_checklist",
  "audit_notes",
  "audit_report",
  "non_conformance",
];

/**
 * Keys a staff user may open on the project workflow list.
 * Temporarily: every stage (except the project gate) is openable so staff can
 * jump to any step. Re-enable sequential unlock below when locking returns.
 */
export const openableWorkflowStageKeys = (workflow = []) => {
  const stages = Array.isArray(workflow) ? workflow : [];
  const openable = new Set();

  for (const stage of stages) {
    if (stage.key === "project") continue;
    openable.add(stage.key);
  }

  return openable;
};

/**
 * The single stage still needing attention, in workflow order.
 * Used by the applications list so the Actions menu only offers the next step.
 */
export const currentWorkflowStage = (workflow = []) =>
  (Array.isArray(workflow) ? workflow : []).find(
    (stage) => !isStageDone(stage?.status),
  ) || null;

/** Actions-page URL for a stage, so Open can be a real link (new tab / window). */
export const applicationActionsPath = (applicationId, stageKey) => {
  if (!applicationId) return "";
  const path = `/applications/actions/${applicationId}`;
  return stageKey ? `${path}?stage=${encodeURIComponent(stageKey)}` : path;
};

export default WORKFLOW_STAGES;
