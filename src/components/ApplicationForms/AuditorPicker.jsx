import React, { useEffect, useState } from "react";

import { Card, CardHeader } from "@/customer/components/ui/Card";
import { AlertIcon } from "@/customer/components/ui/icons";
import { DropdownBasic } from "@/page-layouts";
import ApplicationServices from "@/services/ApplicationServices";

/**
 * Chooses the auditor a job belongs to.
 *
 * Everything after this point — who may fill in the documentation audit, who
 * issues the notice — follows from this choice, so it is made where the
 * appointment is made rather than reflected from somewhere else.
 */
const AuditorPicker = ({
  value,
  onChange,
  request,
  business,
  currentName,
  action,
}) => {
  const [auditors, setAuditors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const res = await ApplicationServices.getAuditors(
          business ? { business } : {},
          request,
        );
        if (cancelled) return;
        const list = Array.isArray(res.data?.data) ? res.data.data : [];
        setAuditors(list);
        setNotice(res.data?.message || "");
      } catch {
        if (!cancelled) setNotice("The list of auditors could not be loaded.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [business]);

  /* Keep the dropdown on whoever currently holds the job after assign/reload. */
  useEffect(() => {
    if (value || !currentName || !auditors.length) return;
    const match = auditors.find((a) => a.name === currentName);
    if (match) onChange?.(match._id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentName, auditors]);

  const selected = auditors.find((a) => String(a._id) === String(value));
  const signatureHint =
    selected && !selected.hasSignature
      ? `${selected.name} has no signature saved on their profile. They can still draw one when they accept.`
      : "";

  return (
    <Card>
      <CardHeader
        title="Auditor"
        subtitle="Only the assigned auditor can complete the documentation audit and issue the factory audit notice."
        action={action}
      />

      {loading ? (
        <p className="epc-section__desc">Loading auditors…</p>
      ) : auditors.length === 0 ? (
        <p className="epc-notice epc-notice--warn">
          <AlertIcon size={16} className="epc-notice__icon" />
          <span>
            {notice ||
              "No auditors are available. Give someone the Auditor role in Settings first."}
          </span>
        </p>
      ) : (
        <label className="flex flex-col gap-1">
          <span className="text-xs text-gray-500">Assigned to</span>
          <DropdownBasic
            options={auditors.map((a) => ({
              value: a._id,
              label: `${a.name} (${a.email})`,
            }))}
            value={value || ""}
            onChange={(val) => onChange?.(val || "")}
            placeholder="Choose an auditor…"
            className="w-full"
            isClearable={false}
            sortOptions={false}
          />
          {signatureHint ? (
            <span className="text-xs text-amber-600">{signatureHint}</span>
          ) : null}
        </label>
      )}
    </Card>
  );
};

export default AuditorPicker;
