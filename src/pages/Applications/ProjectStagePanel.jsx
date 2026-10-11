import React, { useEffect, useMemo, useState } from "react";
import { useHistory } from "react-router-dom";

import DocumentPreview from "@/components/ApplicationForms/DocumentPreview";
import ProjectServices from "@/services/ProjectServices";
import Button from "@/customer/components/ui/Button";
import { ArrowRightIcon } from "@/customer/components/ui/icons";
import StatusPill from "@/customer/components/ui/StatusPill";
import { DefinitionList } from "@/customer/components/ui/DetailBlocks";

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

/**
 * Project stage — read-only.
 *
 * The project opens by itself when the customer accepts the quotation, and the
 * audit is run on its own screen. This panel is the view from the application
 * it came from.
 */
const ProjectStagePanel = ({ application, authHeaders }) => {
  const history = useHistory();
  const [project, setProject] = useState(null);
  const [loading, setLoading] = useState(true);

  const request = useMemo(
    () => ({ headers: authHeaders, withCredentials: true }),
    [authHeaders],
  );

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const res = await ProjectServices.getProjectByApplication(
          application._id,
          request,
        );
        if (!cancelled) setProject(res?.data?.data || null);
      } catch {
        if (!cancelled) setProject(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [application._id, request]);

  if (loading) {
    return <p className="epc-section__desc">Loading project…</p>;
  }

  if (!project) {
    return (
      <p className="epc-notice epc-notice--info">
        <span>
          No project yet. One opens automatically when the customer accepts the
          quotation.
        </span>
      </p>
    );
  }

  return (
    <div className="epc-stack">
      <div className="epc-recordhead">
        <span className="epc-recordhead__ref">{project.projectNumber}</span>
        <StatusPill status={project.status} />
        <span className="epc-recordhead__spacer" />
        <Button onClick={() => history.push(`/projects/${project._id}`)}>
          Open audit <ArrowRightIcon size={15} />
        </Button>
      </div>

      <DefinitionList
        items={[
          { label: "Job no.", value: project.jobNo || "—" },
          ...(String(project.serviceType || "").toLowerCase() === "inspection"
            ? [{ label: "Report no.", value: project.reportNo || "—" }]
            : [
                {
                  label: "Certificate no.",
                  value: project.certificateNumber || "—",
                },
              ]),
          { label: "Quotation", value: project.quotationRef || "—" },
          {
            label: "Contract value",
            value: money(project.contractValue, project.currency),
          },
          { label: "Accepted", value: formatDate(project.quotationAcceptedAt) },
          { label: "Accepted by", value: project.quotationAcceptedBy || "—" },
          { label: "Assigned to", value: project.assignedToName || "Not assigned" },
          { label: "Invoice", value: project.invoiceNumber || "Not raised" },
        ]}
      />

      <p className="epc-notice epc-notice--info">
        <span>
          The audit — assignment letter, documentation audit, acceptance letter
          and factory audit notice — is run on the project, where the auditor
          and the schedule live. The documents stay on this application.
        </span>
      </p>

      {project.invoiceNumber ? (
        <DocumentPreview
          title="Tax Invoice"
          documentCode={project.invoiceNumber}
          audience="customer"
          state={project.invoiceStatus}
          note="The exact document the customer received."
          defaultOpen
          fileName={`${project.invoiceNumber}.pdf`}
          fetchPdf={async () => {
            const res = await ProjectServices.getProjectInvoicePdf(
              project._id,
              request,
            );
            return new Blob([res.data], { type: "application/pdf" });
          }}
        />
      ) : null}
    </div>
  );
};

export default ProjectStagePanel;
