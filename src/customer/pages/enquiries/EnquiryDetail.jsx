import React, { useEffect, useState } from "react";
import { useHistory, useParams } from "react-router-dom";

import PortalLayout from "../../layouts/PortalLayout";
import { Card, CardHeader } from "../../components/ui/Card";
import Button from "../../components/ui/Button";
import StatusPill from "../../components/ui/StatusPill";
import {
  DefinitionList,
  DetailHeader,
  SummaryTiles,
  Timeline,
} from "../../components/ui/DetailBlocks";
import { customerPath } from "../../routes/paths";
import CustomerEnquiryServices from "../../services/enquiryService";

export default function EnquiryDetail() {
  const history = useHistory();
  const { id } = useParams();
  const [enquiry, setEnquiry] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError("");
      try {
        const res = await CustomerEnquiryServices.getMyEnquiryById(id);
        if (!cancelled) setEnquiry(res?.data?.data || null);
      } catch (err) {
        if (!cancelled) {
          setEnquiry(null);
          setError(
            err?.response?.data?.message || "Enquiry not found or not yours.",
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id]);

  if (loading) {
    return (
      <PortalLayout crumbs={[{ label: "Customer Portal" }, { label: "My Enquiries" }]}>
        <div className="epc-placeholder">
          <p className="epc-placeholder__title">Loading enquiry…</p>
        </div>
      </PortalLayout>
    );
  }

  if (!enquiry) {
    return (
      <PortalLayout crumbs={[{ label: "Customer Portal" }, { label: "My Enquiries" }]}>
        <div className="epc-placeholder">
          <p className="epc-placeholder__title">Enquiry not found</p>
          <p className="epc-placeholder__text">
            {error || `${id} is not in your enquiry list.`}
          </p>
          <Button onClick={() => history.push(customerPath.enquiries)}>
            Back to enquiries
          </Button>
        </div>
      </PortalLayout>
    );
  }

  const recordId = enquiry._id || id;

  return (
    <PortalLayout crumbs={[{ label: "Customer Portal" }, { label: "My Enquiries" }]}>
      <DetailHeader
        title={`Enquiry ${enquiry.id}`}
        subtitle="Review your enquiry and its current status with AQCTA."
        meta={`Submitted ${enquiry.submitted} · Updated ${enquiry.updated}`}
        onBack={() => history.push(customerPath.enquiries)}
        action={
          enquiry.canEdit ? (
            <Button
              onClick={() =>
                history.push(`${customerPath.enquiries}/${recordId}/edit`)
              }
            >
              Edit Enquiry
            </Button>
          ) : null
        }
      />

      <SummaryTiles
        tiles={[
          { label: "Enquiry No.", value: enquiry.id },
          { label: "Enquiring For", value: enquiry.enquiringFor },
          {
            label: "Status",
            value: enquiry.status,
            note: `Updated ${enquiry.updated}`,
          },
          { label: "Submitted", value: enquiry.submitted },
        ]}
      />

      <div className="epc-detailgrid">
        <div className="epc-detailcol">
          <Card>
            <CardHeader
              title="Enquiry"
              subtitle="What you sent to AQCTA"
              action={<StatusPill status={enquiry.status} />}
            />
            <DefinitionList
              items={[
                { label: "Subject", value: enquiry.subject },
                { label: "Enquiring For", value: enquiry.enquiringFor },
                { label: "Message", value: enquiry.message || "—" },
                ...(enquiry.enquiringFor === "Inspection"
                  ? [
                      {
                        label: "Mandatory Inspection Services",
                        value:
                          (enquiry.mandatoryInspectionServices || []).length > 0
                            ? (enquiry.mandatoryInspectionServices || []).join(
                                "; ",
                              )
                            : "—",
                      },
                      ...(enquiry.mandatoryInspectionOthers
                        ? [
                            {
                              label: "Others (Section A)",
                              value: enquiry.mandatoryInspectionOthers,
                            },
                          ]
                        : []),
                      {
                        label: "Third Party Inspection",
                        value:
                          (enquiry.thirdPartyInspectionServices || []).length >
                          0
                            ? (
                                enquiry.thirdPartyInspectionServices || []
                              ).join("; ")
                            : "—",
                      },
                      ...(enquiry.thirdPartyInspectionOthers
                        ? [
                            {
                              label: "Others (Section B)",
                              value: enquiry.thirdPartyInspectionOthers,
                            },
                          ]
                        : []),
                    ]
                  : []),
              ]}
            />
          </Card>

          <Card>
            <CardHeader title="Contact" subtitle="Who AQCTA will reply to" />
            <DefinitionList
              items={[
                { label: "Contact Person", value: enquiry.contact?.name },
                { label: "Email", value: enquiry.contact?.email },
                { label: "Phone", value: enquiry.contact?.phone },
              ]}
            />
          </Card>
        </div>

        <div className="epc-detailcol">
          <Card>
            <CardHeader
              title="Enquiry Progress"
              subtitle="Customer-visible activity"
              action={<StatusPill status={enquiry.status} />}
            />
            <Timeline
              entries={[
                {
                  date: enquiry.submitted,
                  title: "Enquiry submitted",
                  note: "Received by AQCTA",
                  tone: "done",
                },
                {
                  date: enquiry.updated,
                  title:
                    enquiry.status === "Closed"
                      ? "Enquiry closed"
                      : enquiry.status === "Converted"
                        ? "Converted to customer"
                        : "Under review",
                  note:
                    enquiry.status === "Converted"
                      ? "Taken forward into a customer account"
                      : "Latest update on this enquiry",
                  tone:
                    enquiry.status === "Open" ? "current" : "done",
                },
              ]}
            />
          </Card>

          <Card>
            <CardHeader title="Enquiry Actions" subtitle="Manage this enquiry" />
            <div className="epc-wizard__foot-right">
              {enquiry.canConvert && (
                <Button
                  onClick={() =>
                    history.push(customerPath.applicationsNew, {
                      enquiryId: recordId,
                      enquiringFor: enquiry.enquiringFor,
                    })
                  }
                >
                  Start Application
                </Button>
              )}
              <Button
                variant="secondary"
                onClick={() => history.push(customerPath.enquiries)}
              >
                Back to Enquiries
              </Button>
            </div>
          </Card>
        </div>
      </div>
    </PortalLayout>
  );
}
