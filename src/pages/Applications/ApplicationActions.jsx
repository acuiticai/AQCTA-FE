import React, { useContext, useEffect, useMemo, useState } from "react";
import { useHistory, useLocation, useParams } from "react-router-dom";

import { notifyError } from "@/utils/toast";
import useCheckTokenExpired from "@/hooks/useCheckTokenExpired";
import { AdminContext } from "@/context/AdminContext";
import { useRouteModulePermissions } from "@/utils/permissionUtils";
import ApplicationServices from "@/services/ApplicationServices";
import StageFormCard from "./StageFormCard";
import QuotationStagePanel from "./QuotationStagePanel";
import ProjectStagePanel from "./ProjectStagePanel";
import WorkflowMenu from "@/components/Epc/WorkflowMenu";
import { EpcPage } from "@/components/Epc/EpcSurface";
import Button from "@/customer/components/ui/Button";
import { Card, CardHeader } from "@/customer/components/ui/Card";
import { applicationPhaseStages } from "./workflowStages";
import { CERTIFICATION_STAGE_FORMS } from "@/config/aqctaSchemeWorkflows";

/**
 * Stages that are built. Each is the same component with a different form —
 * the stage's behaviour comes from the server's stage config, not from here.
 */
/* A stage is either a form the two-person rule runs on, or a `panel` that
   reports state reached without anyone filling anything in. */
const STAGE_COMPONENTS = {
  contract_review: {
    formKey: CERTIFICATION_STAGE_FORMS.contract_review.formKey,
    statusField: "contractReviewStatus",
  },
  evaluation_plan: { formKey: "FOR-01-25", statusField: "evaluationPlanStatus" },
  costing: {
    formKey: CERTIFICATION_STAGE_FORMS.costing.formKey,
    inspectionFormKey: "FOR-06-02",
    statusField: "costingStatus",
  },
  quotation: { panel: QuotationStagePanel },
  project: { panel: ProjectStagePanel },
};

/**
 * Applications → Actions
 *
 * One stage of the certification process at a time, chosen from the list
 * screen or from the workflow menu in the header. Stages come from
 * workflowStages.js, so this page does not change as more forms are added.
 */
const ApplicationActions = () => {
  const { id } = useParams();
  const history = useHistory();
  const location = useLocation();
  const { state } = useContext(AdminContext);
  const { adminInfo } = state;
  const checkTokenExpired = useCheckTokenExpired();
  const routePerms = useRouteModulePermissions("/applications");

  const [row, setRow] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeKey, setActiveKey] = useState("");

  const authHeaders = useMemo(
    () => ({
      "Content-Type": "application/json",
      authorization: `Bearer ${adminInfo?.token}`,
    }),
    [adminInfo?.token],
  );

  const load = async () => {
    if (!id || !adminInfo?.token) return;
    setLoading(true);
    try {
      const response = await ApplicationServices.getApplicationById(id, {
        headers: authHeaders,
        withCredentials: true,
      });
      if (checkTokenExpired(response)) return;
      if (response.data?.status) setRow(response.data.data);
      else {
        notifyError(response.data?.message || "Application not found");
        setRow(null);
      }
    } catch (error) {
      notifyError(
        error?.response?.data?.message || "Failed to load application",
      );
      setRow(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, adminInfo?.token]);

  /* The audit stages moved to the project, where the auditor and the schedule
     live. This page keeps everything decided before a project exists. */
  const stages = useMemo(
    () => (row ? applicationPhaseStages(row) : []),
    [row],
  );

  /* The list screen links straight to a stage, so that choice wins. Otherwise
     open the first stage still needing attention rather than always the first. */
  useEffect(() => {
    if (!stages.length || activeKey) return;
    const asked = new URLSearchParams(location.search).get("stage");
    if (asked && stages.some((s) => s.key === asked)) {
      setActiveKey(asked);
      return;
    }
    const firstOpen = stages.find(
      (s) => s.available && !["Accepted", "Approved", "Completed"].includes(s.statusFrom(row)),
    );
    setActiveKey((firstOpen || stages.find((s) => s.available) || stages[0]).key);
  }, [stages, activeKey, row, location.search]);

  if (loading) {
    return (
      <EpcPage title="Actions">
        <p className="epc-section__desc">Loading application…</p>
      </EpcPage>
    );
  }

  if (!row) {
    return (
      <EpcPage title="Actions">
        <Card>
          <p className="epc-section__desc">
            This application could not be loaded.
          </p>
          <div className="epc-actions" style={{ marginTop: 12 }}>
            <Button
              variant="secondary"
              onClick={() => history.push("/applications")}
            >
              Back to applications
            </Button>
          </div>
        </Card>
      </EpcPage>
    );
  }

  const active = stages.find((s) => s.key === activeKey);
  const ActiveComponent = active ? STAGE_COMPONENTS[active.key] : null;
  const company = row.formData?.companyName || row.companyName || "—";

  /* The same stages the list offers, so the menu here and the menu there say
     the same thing — the server decides which have been reached, and only a
     stage that is actually built can be opened. */
  const openableStages = (row.workflow || [])
    .filter((stage) => STAGE_COMPONENTS[stage.key])
    .map((stage) => ({
      ...stage,
      title: stages.find((s) => s.key === stage.key)?.title || stage.title,
    }));

  return (
    <EpcPage
      title="Actions"
      subtitle={`${row.applicationNumber} · ${company}`}
      back={{
        label: "Back to application",
        onClick: () => history.push(`/applications/view/${id}`),
      }}
      /* The stages used to run down a rail beside the form, which cost it most
         of a column of width for something clicked once. They are reached from
         the list now, and from here through the same menu, so the form gets
         the whole page. */
      action={
        <WorkflowMenu
          label="Workflow"
          stages={openableStages}
          emptyMessage="No stage of this application can be opened yet."
          onSelect={(stage) => setActiveKey(stage.key)}
        />
      }
    >
      {active ? (
        <Card>
          <CardHeader
            title={active.title}
            subtitle={`${
              active.documentCode ? `${active.documentCode} — ` : ""
            }${active.description}`}
          />
          {ActiveComponent?.panel ? (
            <ActiveComponent.panel
              key={active.key}
              application={row}
              authHeaders={authHeaders}
              onChanged={load}
            />
          ) : ActiveComponent ? (
            <StageFormCard
              key={active.key}
              application={row}
              authHeaders={authHeaders}
              canUpdate={routePerms.canUpdate}
              onChanged={load}
              formKey={
                row.type === "inspection" && ActiveComponent.inspectionFormKey
                  ? ActiveComponent.inspectionFormKey
                  : ActiveComponent.formKey
              }
              statusField={ActiveComponent.statusField}
            />
          ) : (
            <p className="epc-section__desc">
              This stage has not been built yet.
            </p>
          )}
        </Card>
      ) : (
        <Card>
          <p className="epc-section__desc">
            No workflow stages apply to this application.
          </p>
        </Card>
      )}
    </EpcPage>
  );
};

export default ApplicationActions;
