import React, { useContext, useEffect, useMemo, useState } from "react";
import { useHistory, useLocation, useParams } from "react-router-dom";
import { ArrowLeft, Briefcase, FileText } from "lucide-react";

import { notifyError, notifySuccess } from "@/utils/toast";
import { AdminContext } from "@/context/AdminContext";
import { useRouteModulePermissions } from "@/utils/permissionUtils";
import ProjectServices from "@/services/ProjectServices";
import ApplicationServices from "@/services/ApplicationServices";
import StageFormCard from "@/pages/Applications/StageFormCard";
import AuditorPicker from "@/components/ApplicationForms/AuditorPicker";
import InspectorPicker from "@/components/ApplicationForms/InspectorPicker";
import WorkflowMenu from "@/components/Epc/WorkflowMenu";
import DocumentPreview from "@/components/ApplicationForms/DocumentPreview";
import FlexaQuotationPreview from "@/components/Certification/FlexaQuotationPreview";
import { EpcPage } from "@/components/Epc/EpcSurface";
import Button from "@/customer/components/ui/Button";
import StatusPill from "@/customer/components/ui/StatusPill";
import { Card, CardHeader } from "@/customer/components/ui/Card";
import {
  AUDIT_PHASE,
  stagesForApplication,
  isStageDone,
  openableWorkflowStageKeys,
  applicationActionsPath,
} from "@/pages/Applications/workflowStages";
import { CERTIFICATION_STAGE_FORMS as AQCTA_CERT_FORMS } from "@/config/aqctaSchemeWorkflows";
import WorkflowStageList from "@/pages/Applications/WorkflowStageList";

/** Status fields for audit stages — formKey comes from AQCTA_CERT_FORMS. */
const CERTIFICATION_STAGE_STATUS = {
  assignment: "assignmentLetterStatus",
  doc_audit: "docAuditStatus",
  acceptance: "acceptanceLetterStatus",
  audit_notice: "auditNoticeStatus",
  audit_checklist: "auditChecklistStatus",
  audit_notes: "auditNotesStatus",
  selected_samples: "selectedSamplesStatus",
  audit_report: "auditReportStatus",
  non_conformance: "nonConformanceStatus",
  product_testing: "productTestingStatus",
  lab_acceptance: "labAcceptanceStatus",
  certification_report: "certificationReportStatus",
  certification_report_changes: "certificationReportChangesStatus",
  certification_recommendation: "certificationRecommendationStatus",
  certificate_approval_letter: "certificateApprovalLetterStatus",
  certification_deliberation: "certificationDeliberationStatus",
};

/** Legacy Type-5-only keys still used when present on an old application. */
const LEGACY_CERT_FORM_KEYS = {
  selected_samples: "FOR-01-15",
  product_testing: "FOR-01-17",
  lab_acceptance: "FOR-01-18",
  certification_report_changes: "FOR-01-19.1",
};

/** The audit stages, each a controlled AQCTA form on the application. */
const CERTIFICATION_STAGE_FORMS = Object.fromEntries(
  Object.entries(CERTIFICATION_STAGE_STATUS).map(([stageKey, statusField]) => [
    stageKey,
    {
      formKey:
        AQCTA_CERT_FORMS[stageKey]?.formKey || LEGACY_CERT_FORM_KEYS[stageKey],
      statusField,
    },
  ]),
);

const INSPECTION_STAGE_FORMS = {
  assignment: { formKey: "FOR-06-06", statusField: "assignmentLetterStatus" },
  doc_audit: { formKey: "FOR-06-05", statusField: "docAuditStatus" },
  inspection_prep: {
    formKey: "FOR-06-07-03",
    statusField: "inspectionPrepStatus",
  },
  inspection_plan_notice: {
    formKey: "FOR-06-07-02",
    statusField: "inspectionPlanNoticeStatus",
  },
  inspection_guideline: {
    formKey: "FOR-06-11",
    statusField: "inspectionGuidelineStatus",
  },
  inspection_notes: {
    formKey: "FOR-06-07",
    statusField: "inspectionNotesStatus",
  },
};

const formatDate = (value) => {
  if (!value) return "—";
  const d = new Date(value);
  return Number.isNaN(d.getTime())
    ? "—"
    : d.toLocaleDateString("en-GB", {
        day: "numeric",
        month: "short",
        year: "numeric",
      });
};

const money = (value, currency = "MYR") =>
  `${currency === "MYR" ? "RM" : currency} ${Number(value || 0).toLocaleString(
    "en-MY",
    { minimumFractionDigits: 2, maximumFractionDigits: 2 },
  )}`;

const SummaryTiles = ({ tiles = [] }) => (
  <div className="mb-5 overflow-hidden rounded-2xl border border-gray-200/90 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
    <div className="grid grid-cols-1 divide-y divide-gray-100 sm:grid-cols-2 sm:divide-y-0 xl:grid-cols-4 2xl:grid-cols-7">
      {tiles.map((tile, index) => (
        <article
          key={tile.label}
          className={`flex flex-col gap-1.5 px-5 py-4 ${
            index > 0 ? "sm:border-l sm:border-gray-100" : ""
          }`}
        >
          <span className="text-[11px] font-semibold uppercase tracking-[0.06em] text-gray-400">
            {tile.label}
          </span>
          <span className="text-base font-bold leading-snug text-gray-900">
            {tile.value}
          </span>
          {tile.note ? (
            <span className="text-xs text-gray-400">{tile.note}</span>
          ) : null}
        </article>
      ))}
    </div>
  </div>
);

const DefinitionList = ({ items = [] }) => (
  <dl className="m-0 flex flex-col gap-0 divide-y divide-gray-100 p-0">
    {items.map((item) => (
      <div
        key={item.label}
        className="grid grid-cols-[minmax(110px,0.4fr)_minmax(0,1fr)] items-start gap-3 py-2.5 first:pt-0 last:pb-0"
      >
        <dt className="text-[11px] font-medium uppercase tracking-wide text-gray-400">
          {item.label}
        </dt>
        <dd className="m-0 break-words text-sm text-gray-900">
          {item.value || "—"}
        </dd>
      </div>
    ))}
  </dl>
);

/**
 * Projects → one project
 *
 * Where the audit is run. Organised so someone opening a job can see:
 * what to do next, what is already done, and the project facts / documents.
 */
const ProjectDetail = () => {
  const { id } = useParams();
  const history = useHistory();
  const location = useLocation();
  const { state } = useContext(AdminContext);
  const { adminInfo } = state;
  const routePerms = useRouteModulePermissions();

  const [project, setProject] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [activeKey, setActiveKey] = useState("");
  /* Stage forms stay closed on the project overview — open only when asked. */
  const [workOpen, setWorkOpen] = useState(false);
  const [assigning, setAssigning] = useState(false);
  const [pickedAuditor, setPickedAuditor] = useState("");
  const [pickedInspector, setPickedInspector] = useState("");

  const authHeaders = useMemo(
    () => ({
      "Content-Type": "application/json",
      authorization: `Bearer ${adminInfo?.token}`,
    }),
    [adminInfo?.token],
  );
  const request = useMemo(
    () => ({ headers: authHeaders, withCredentials: true }),
    [authHeaders],
  );

  const load = async () => {
    if (!adminInfo?.token) return;
    try {
      const res = await ProjectServices.getProjectById(id, request);
      setProject(res.data?.data || null);
      setLoadError("");
    } catch (error) {
      setLoadError(
        error?.response?.data?.message || "This project could not be loaded.",
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, adminInfo?.token]);

  const application = project?.application || null;
  const isInspection =
    application?.type === "inspection" || project?.serviceType === "inspection";
  const STAGE_FORMS = isInspection
    ? INSPECTION_STAGE_FORMS
    : CERTIFICATION_STAGE_FORMS;
  const stages = useMemo(
    () =>
      application
        ? stagesForApplication(application).filter(
            (s) => s.phase === AUDIT_PHASE,
          )
        : [],
    [application],
  );

  const allWorkflowStages = useMemo(() => {
    if (!application) return [];
    return stagesForApplication(application).map((stage) => ({
      key: stage.key,
      title: stage.title,
      documentCode: stage.documentCode,
      phase: stage.phase,
      description: stage.description,
      status: stage.statusFrom(application),
    }));
  }, [application]);

  const openableStageKeys = useMemo(
    () => openableWorkflowStageKeys(allWorkflowStages),
    [allWorkflowStages],
  );

  const currentStageKey = useMemo(() => {
    const next = allWorkflowStages.find(
      (stage) => stage.key !== "project" && !isStageDone(stage.status),
    );
    return next?.key || null;
  }, [allWorkflowStages]);

  /* Keep the open stage in sync with the URL. Projects list and workflow
     Start both land on ?stage=… — that must open the form every time. */
  useEffect(() => {
    if (!application) return;
    const asked = new URLSearchParams(location.search).get("stage");
    if (!asked) return;
    const known =
      stages.some((s) => s.key === asked) || Boolean(STAGE_FORMS[asked]);
    if (!known) return;
    setActiveKey(asked);
    setWorkOpen(true);
  }, [location.search, application, stages, STAGE_FORMS]);

  /* When there is no ?stage=, remember which audit stage is next so Do next
     and the form know what to open. */
  useEffect(() => {
    if (!stages.length || !application) return;
    if (new URLSearchParams(location.search).get("stage")) return;
    if (activeKey) return;
    const open = stages.find((s) => !isStageDone(s.statusFrom(application)));
    setActiveKey((open || stages[stages.length - 1]).key);
  }, [stages, application, activeKey, location.search]);

  /** Keep the project card, picker and letter form in sync without a full reload. */
  const applyAssigneeLocally = ({ id, name, kind }) => {
    const assigneeId = id ? String(id) : "";
    const assigneeName = name || "";
    if (kind === "inspector") setPickedInspector(assigneeId);
    else setPickedAuditor(assigneeId);

    setProject((prev) => {
      if (!prev) return prev;
      const applicationPatch =
        kind === "inspector"
          ? {
              assignedInspector: assigneeId || null,
              assignedInspectorName: assigneeName,
            }
          : {
              assignedAuditor: assigneeId || null,
              assignedAuditorName: assigneeName,
            };
      return {
        ...prev,
        assignedTo: assigneeId || null,
        assignedToName: assigneeName,
        application: prev.application
          ? { ...prev.application, ...applicationPatch }
          : prev.application,
      };
    });
  };

  const assignAuditor = async () => {
    if (!pickedAuditor || !application) return;
    setAssigning(true);
    try {
      const res = await ApplicationServices.assignAuditor(
        application._id,
        { auditorId: pickedAuditor },
        request,
      );
      if (res.data?.status) {
        const data = res.data.data || {};
        notifySuccess(res.data.message || "Auditor assigned");
        applyAssigneeLocally({
          id: data.assignedAuditor || pickedAuditor,
          name: data.assignedAuditorName,
          kind: "auditor",
        });
        await load();
      }
    } catch (error) {
      notifyError(
        error?.response?.data?.message || "Could not assign that auditor",
      );
    } finally {
      setAssigning(false);
    }
  };

  const assignInspector = async () => {
    if (!pickedInspector || !application) return;
    setAssigning(true);
    try {
      const res = await ApplicationServices.assignInspector(
        application._id,
        { inspectorId: pickedInspector },
        request,
      );
      if (res.data?.status) {
        const data = res.data.data || {};
        notifySuccess(res.data.message || "Inspector assigned");
        applyAssigneeLocally({
          id: data.assignedInspector || pickedInspector,
          name: data.assignedInspectorName,
          kind: "inspector",
        });
        await load();
      }
    } catch (error) {
      notifyError(
        error?.response?.data?.message || "Could not assign that inspector",
      );
    } finally {
      setAssigning(false);
    }
  };

  if (loading) {
    return (
      <EpcPage title="Project">
        <p className="epc-section__desc">Loading project…</p>
      </EpcPage>
    );
  }

  if (loadError || !project) {
    return (
      <EpcPage title="Project">
        <Card>
          <p className="epc-section__desc">
            {loadError || "Project not found."}
          </p>
          <div className="epc-actions" style={{ marginTop: 12 }}>
            <Button variant="secondary" onClick={() => history.push("/projects")}>
              Back to Projects
            </Button>
          </div>
        </Card>
      </EpcPage>
    );
  }

  const active = stages.find((s) => s.key === activeKey) || stages[0];
  const activeForm = active ? STAGE_FORMS[active.key] : null;
  const activeStatus = active ? active.statusFrom(application) : null;
  const activeDone = isStageDone(activeStatus);

  /* The same stages the Projects list offers — the server decides which of
     them the audit has reached. */
  const openableStages = (project.workflow || [])
    .filter((stage) => STAGE_FORMS[stage.key])
    .map((stage) => ({
      ...stage,
      title: stages.find((s) => s.key === stage.key)?.title || stage.title,
    }));

  const assignedPersonId = project.assignedTo ? String(project.assignedTo) : "";
  const applicationId = application?._id ? String(application._id) : "";

  const openWorkflowStage = (stageKey) => {
    const stage = allWorkflowStages.find((s) => s.key === stageKey);
    if (!stage) return;

    /* Audit / inspection forms stay on this project URL with ?stage=. */
    if (STAGE_FORMS[stageKey]) {
      setActiveKey(stageKey);
      setWorkOpen(true);
      history.push({
        pathname: `/projects/${id}`,
        search: `?stage=${encodeURIComponent(stageKey)}`,
      });
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }

    /* Earlier application-phase forms (e.g. Contract Review) open on the
       application Actions screen in a new window so this project stays put. */
    if (stageKey === "project" || !applicationId) return;
    const href = applicationActionsPath(applicationId, stageKey);
    const opened = window.open(href, "_blank");
    if (opened) opened.opener = null;
  };

  const openStageWork = (stageKey) => {
    if (!STAGE_FORMS[stageKey]) return;
    setActiveKey(stageKey);
    setWorkOpen(true);
    history.push({
      pathname: `/projects/${id}`,
      search: `?stage=${encodeURIComponent(stageKey)}`,
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const closeStageWork = () => {
    setWorkOpen(false);
    if (new URLSearchParams(location.search).get("stage")) {
      history.replace(`/projects/${id}`);
    }
  };

  /* Deciding who does the work is kept to super admins only. */
  const canAssign = adminInfo?.role?.isSuperAdmin === true;
  const assigneeLabel = isInspection ? "Inspector" : "Auditor";
  const workflowTitle = isInspection
    ? "Inspection Workflow"
    : "Certification Workflow";
  const stagesMenuLabel = isInspection ? "Inspection stages" : "Audit stages";
  const stagesEmptyMessage = isInspection
    ? "No inspection stage can be opened yet."
    : "No audit stage can be opened yet.";
  const noStagesMessage = isInspection
    ? "No inspection stages apply to this project yet. Assign an inspector above, then prepare the appointment letter once an invoice is raised."
    : "No audit stages apply to this project.";

  const needsAssignee = !project.assignedToName;
  const doneCount = allWorkflowStages.filter((s) =>
    isStageDone(s.status),
  ).length;
  const remainingCount = Math.max(allWorkflowStages.length - doneCount, 0);

  const formData = application?.formData || {};
  const applicationTypeLabel =
    application?.service ||
    (isInspection ? "Engineering Inspection" : "Conformity Assessment");
  const applicationTypeNote = isInspection
    ? "Inspection application"
    : formData.certificationType || undefined;

  const summaryTiles = [
    {
      label: "Application Type",
      value: applicationTypeLabel,
      note: applicationTypeNote,
    },
    {
      label: "Status",
      value: <StatusPill status={project.status} />,
    },
    {
      label: assigneeLabel,
      value: project.assignedToName || "Not assigned",
      note: needsAssignee ? "Assign to continue" : undefined,
    },
    {
      label: "Quotation",
      value: project.quotationRef || "—",
    },
    {
      label: "Contract value",
      value: money(project.contractValue, project.currency),
    },
    {
      label: "Invoice",
      value: project.invoiceNumber || "Not raised",
      note: project.invoiceStatus || undefined,
    },
    {
      label: "Accepted",
      value: formatDate(project.quotationAcceptedAt),
    },
  ];

  const projectFacts = [
    { label: "Project no.", value: project.projectNumber },
    { label: "Job no.", value: project.jobNo || "—" },
    ...(isInspection
      ? [{ label: "Report no.", value: project.reportNo || "—" }]
      : [{ label: "Certificate no.", value: project.certificateNumber || "—" }]),
    { label: "Company", value: project.companyName },
    { label: "Product / scope", value: project.productName },
    {
      label: "Application Type",
      value: applicationTypeNote
        ? `${applicationTypeLabel} · ${applicationTypeNote}`
        : applicationTypeLabel,
    },

    {
      label: "Application",
      value: project.applicationNumber || "—",
    },
    {
      label: assigneeLabel,
      value: project.assignedToName || "Not assigned",
    },
    {
      label: "Quotation",
      value: project.quotationRef || "—",
    },
    {
      label: "Contract value",
      value: money(project.contractValue, project.currency),
    },
    {
      label: "Invoice",
      value: project.invoiceNumber
        ? `${project.invoiceNumber}${
            project.invoiceStatus ? ` · ${project.invoiceStatus}` : ""
          }`
        : "Not raised",
    },
    {
      label: "Quotation accepted",
      value: formatDate(project.quotationAcceptedAt),
    },
  ];

  const nextWorkflowStage =
    allWorkflowStages.find((stage) => stage.key === currentStageKey) || null;
  const nextIsAuditForm = Boolean(
    nextWorkflowStage &&
      nextWorkflowStage.phase === AUDIT_PHASE &&
      STAGE_FORMS[nextWorkflowStage.key],
  );

  const nextStepTitle = needsAssignee
    ? `1. Assign an ${assigneeLabel.toLowerCase()}`
    : nextWorkflowStage
      ? nextWorkflowStage.title
      : active
        ? active.title
        : "No open stage";
  const nextStepNote = needsAssignee
    ? `Assign an ${assigneeLabel.toLowerCase()} first. After that, prepare the ${
        nextWorkflowStage?.title || active?.title || "appointment letter"
      }.`
    : nextWorkflowStage
      ? [
          nextWorkflowStage.documentCode,
          isStageDone(nextWorkflowStage.status)
            ? "Completed — open another stage from the workflow if needed"
            : nextWorkflowStage.status,
        ]
          .filter(Boolean)
          .join(" · ")
      : noStagesMessage;
  const followingStep =
    needsAssignee && (nextWorkflowStage || active)
      ? `Next after assign: ${nextWorkflowStage?.title || active?.title || ""}`
      : !needsAssignee &&
          nextWorkflowStage &&
          !isStageDone(nextWorkflowStage.status)
        ? nextWorkflowStage.description || null
        : null;

  const assignPicker =
    canAssign && application ? (
      isInspection ? (
        <InspectorPicker
          value={pickedInspector}
          onChange={setPickedInspector}
          request={request}
          business={project.business_id}
          currentName={project.assignedToName}
          action={
            pickedInspector && pickedInspector !== assignedPersonId ? (
              <Button disabled={assigning} onClick={assignInspector}>
                {assigning
                  ? "Assigning…"
                  : project.assignedToName
                    ? "Reassign"
                    : "Assign"}
              </Button>
            ) : null
          }
        />
      ) : (
        <AuditorPicker
          value={pickedAuditor}
          onChange={setPickedAuditor}
          request={request}
          business={project.business_id}
          currentName={project.assignedToName}
          action={
            pickedAuditor && pickedAuditor !== assignedPersonId ? (
              <Button disabled={assigning} onClick={assignAuditor}>
                {assigning
                  ? "Assigning…"
                  : project.assignedToName
                    ? "Reassign"
                    : "Assign"}
              </Button>
            ) : null
          }
        />
      )
    ) : null;

  return (
    <EpcPage flush>
      <div className="mx-auto w-full max-w-[1400px] px-1 py-2 sm:px-2">
        <header className="mb-5 overflow-hidden rounded-2xl border border-gray-200/90 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
          <div className="h-1.5 w-full bg-[var(--p-blue)]" />
          <div className="flex flex-wrap items-start justify-between gap-4 px-5 py-5">
            <div className="flex min-w-0 items-start gap-3">
              <button
                type="button"
                className="mt-0.5 rounded-lg border border-gray-300 bg-white p-2 text-gray-600 hover:bg-gray-50"
                onClick={() => history.push("/projects")}
                aria-label="Back to Projects"
              >
                <ArrowLeft size={18} />
              </button>
              <div className="min-w-0">
                <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-gray-400">
                  Project view
                </p>
                <h1 className="mt-1 text-2xl font-bold tracking-tight text-gray-900">
                  {project.projectNumber}
                </h1>
                <p className="mt-1 text-sm text-gray-600">
                  {project.companyName || "—"}
                  {project.productName ? ` · ${project.productName}` : ""}
                </p>
                <p className="mt-1 text-xs text-gray-400">
                  {applicationTypeLabel}
                  {applicationTypeNote ? ` · ${applicationTypeNote}` : ""}
                  {project.applicationNumber
                    ? ` · ${project.applicationNumber}`
                    : ""}
                  {project.jobNo ? ` · Job ${project.jobNo}` : ""}
                  {isInspection && project.reportNo
                    ? ` · Report ${project.reportNo}`
                    : !isInspection && project.certificateNumber
                      ? ` · Cert ${project.certificateNumber}`
                      : ""}
                  {` · ${doneCount} done · ${remainingCount} remaining`}
                </p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <StatusPill status={project.status} />
              <WorkflowMenu
                label={stagesMenuLabel}
                stages={openableStages}
                emptyMessage={stagesEmptyMessage}
                onSelect={(stage) => openStageWork(stage.key)}
              />
              {project.applicationNumber && applicationId ? (
                <Button
                  variant="secondary"
                  onClick={() =>
                    history.push(`/applications/actions/${applicationId}`)
                  }
                >
                  {project.applicationNumber}
                </Button>
              ) : null}
            </div>
          </div>
        </header>

        <SummaryTiles tiles={summaryTiles} />

        {/* Overview: what to do next — full forms open only on demand */}
        {!workOpen ? (
          <Card className="mb-5">
            <CardHeader
              title="Do next"
              subtitle={
                needsAssignee
                  ? `Step 1 of the job — then ${
                      active?.title || "the appointment letter"
                    }`
                  : activeDone
                    ? "This stage is done — pick the next one from the workflow"
                    : "Open the stage only when you are ready to work it"
              }
              action={
                needsAssignee ? (
                  <StatusPill status="Action Required" />
                ) : nextWorkflowStage?.status ? (
                  <StatusPill status={nextWorkflowStage.status} />
                ) : activeStatus ? (
                  <StatusPill status={activeStatus} />
                ) : null
              }
            />
            <div className="rounded-xl border border-[rgba(var(--p-blue-rgb),0.25)] bg-[rgba(var(--p-blue-rgb),0.04)] px-4 py-4">
              <p className="text-base font-semibold text-gray-900">
                {nextStepTitle}
              </p>
              <p className="mt-1 text-sm leading-relaxed text-gray-600">
                {nextStepNote}
              </p>
              {followingStep ? (
                <p className="mt-2 text-xs text-gray-500">{followingStep}</p>
              ) : null}

              {needsAssignee && !canAssign ? (
                <p className="mt-3 text-xs text-amber-700">
                  Ask a super admin to assign an {assigneeLabel.toLowerCase()}{" "}
                  before this stage can start.
                </p>
              ) : null}

              {!needsAssignee && nextWorkflowStage ? (
                <div className="mt-4 flex flex-wrap gap-2">
                  {nextIsAuditForm ? (
                    <Button
                      onClick={() => openStageWork(nextWorkflowStage.key)}
                    >
                      {isStageDone(nextWorkflowStage.status)
                        ? "Review form"
                        : "Open form"}
                    </Button>
                  ) : null}
                  <Button
                    variant={nextIsAuditForm ? "secondary" : undefined}
                    onClick={() => openWorkflowStage(nextWorkflowStage.key)}
                  >
                    {nextWorkflowStage.phase === AUDIT_PHASE
                      ? isStageDone(nextWorkflowStage.status)
                        ? "Open stage"
                        : "Go to stage"
                      : "Go to stage page"}
                  </Button>
                </div>
              ) : null}
            </div>

            {needsAssignee && canAssign ? (
              <div className="mt-4">{assignPicker}</div>
            ) : null}

            {!needsAssignee && canAssign && project.assignedToName ? (
              <details className="mt-4 border-t border-gray-100 pt-4">
                <summary className="cursor-pointer text-xs font-medium uppercase tracking-wide text-gray-400">
                  Change {assigneeLabel.toLowerCase()}
                </summary>
                <div className="mt-3">{assignPicker}</div>
              </details>
            ) : null}
          </Card>
        ) : (
          <Card className="mb-5">
            <CardHeader
              title={active?.title || "Stage form"}
              subtitle={
                active?.documentCode
                  ? `${active.documentCode}${
                      active.description ? ` — ${active.description}` : ""
                    }`
                  : active?.description
              }
              action={
                <Button variant="secondary" onClick={closeStageWork}>
                  Back to project
                </Button>
              }
            />
            {active && activeForm && application ? (
              <StageFormCard
                key={`${active.key}-${assignedPersonId || "unassigned"}`}
                application={application}
                authHeaders={authHeaders}
                canUpdate={routePerms.canUpdate}
                onChanged={load}
                formKey={activeForm.formKey}
                statusField={activeForm.statusField}
              />
            ) : (
              <p className="epc-section__desc">{noStagesMessage}</p>
            )}
          </Card>
        )}

        <div className="mb-5 grid grid-cols-1 items-start gap-5 lg:grid-cols-2">
          <div className="min-w-0">
            {allWorkflowStages.length > 0 ? (
              <Card>
                <WorkflowStageList
                  title={workflowTitle}
                  subtitle="Done, current, and remaining — open a stage when you are ready"
                  stages={allWorkflowStages}
                  currentKey={currentStageKey}
                  openableKeys={openableStageKeys}
                  onOpen={openWorkflowStage}
                  hrefFor={(stage) =>
                    STAGE_FORMS[stage.key] ||
                    stage.key === "project" ||
                    !applicationId
                      ? undefined
                      : applicationActionsPath(applicationId, stage.key)
                  }
                  openInNewWindow
                  variant="stepper"
                  collapsible={false}
                  emptyMessage={
                    isInspection
                      ? "No inspection workflow stages apply to this project."
                      : "No certification workflow stages apply to this project."
                  }
                />
              </Card>
            ) : (
              <Card>
                <CardHeader title={workflowTitle} />
                <p className="epc-section__desc">
                  {isInspection
                    ? "No inspection workflow stages apply to this project."
                    : "No certification workflow stages apply to this project."}
                </p>
              </Card>
            )}
          </div>

          <div className="flex min-w-0 flex-col gap-5">
            <Card>
              <CardHeader
                title="Project information"
                subtitle="Facts for this job"
                action={
                  <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-gray-100 text-gray-500">
                    <Briefcase size={15} />
                  </span>
                }
              />
              <DefinitionList items={projectFacts} />
            </Card>

            {applicationId ? (
              <Card>
                <CardHeader
                  title="Related application"
                  subtitle="Earlier application-phase forms and review history"
                />
                <div className="flex flex-wrap gap-2">
                  <Button
                    variant="secondary"
                    onClick={() =>
                      history.push(`/applications/view/${applicationId}`)
                    }
                  >
                    <span className="inline-flex items-center gap-1.5">
                      <FileText size={14} />
                      View application
                    </span>
                  </Button>
                  <Button
                    variant="secondary"
                    onClick={() =>
                      history.push(`/applications/actions/${applicationId}`)
                    }
                  >
                    Application actions
                  </Button>
                </div>
              </Card>
            ) : null}
          </div>
        </div>

        <Card>
          <CardHeader
            title="Project documents"
            subtitle="All commercial documents for this project — expand a row to preview"
          />
          <div className="flex flex-col gap-3">
            {project.serviceType === "inspection" ? (
              <DocumentPreview
                title="Quotation"
                documentCode="AQCTA-FOR-06-03"
                audience="customer"
                state="Issued"
                note="Official inspection quotation (AQCTA-FOR-06-03)."
                available={Boolean(project.quotationRef)}
                unavailableNote="No quotation is linked to this project yet."
                fileName={`${project.quotationRef || "Inspection-Quotation"}.pdf`}
                fetchPdf={async () => {
                  const res = await ProjectServices.getProjectQuotationPdf(
                    project._id,
                    request,
                  );
                  return new Blob([res.data], { type: "application/pdf" });
                }}
              />
            ) : (
              <details className="rounded-xl border border-gray-200 bg-white open:shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
                <summary className="cursor-pointer list-none px-4 py-3 marker:content-none [&::-webkit-details-marker]:hidden">
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-gray-900">
                        Quotation
                      </p>
                      <p className="mt-0.5 text-xs text-gray-500">
                        {project.quotationRef || "No quotation linked yet"}
                      </p>
                    </div>
                    <span className="shrink-0 text-xs font-medium text-gray-400">
                      Expand
                    </span>
                  </div>
                </summary>
                <div className="border-t border-gray-100 px-3 pb-3 pt-2">
                  {project.quotationRef ? (
                    <FlexaQuotationPreview quoteNumber={project.quotationRef} />
                  ) : (
                    <p className="px-1 py-2 text-sm text-gray-500">
                      No quotation is linked to this project yet.
                    </p>
                  )}
                </div>
              </details>
            )}
            <DocumentPreview
              title="Tax Invoice"
              documentCode={project.invoiceNumber}
              audience="customer"
              state={project.invoiceStatus}
              note="The exact document the customer received."
              available={Boolean(project.invoiceNumber)}
              unavailableNote="No invoice has been raised for this project yet."
              fileName={`${project.invoiceNumber || "invoice"}.pdf`}
              fetchPdf={async () => {
                const res = await ProjectServices.getProjectInvoicePdf(
                  project._id,
                  request,
                );
                return new Blob([res.data], { type: "application/pdf" });
              }}
            />
          </div>
        </Card>
      </div>
    </EpcPage>
  );
};

export default ProjectDetail;
