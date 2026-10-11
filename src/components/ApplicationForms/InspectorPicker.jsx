import React, { useEffect, useState } from "react";

import { Card, CardHeader } from "@/customer/components/ui/Card";
import { AlertIcon } from "@/customer/components/ui/icons";
import { DropdownBasic } from "@/page-layouts";
import ApplicationServices from "@/services/ApplicationServices";

/**
 * Chooses the inspector an inspection job belongs to.
 */
const InspectorPicker = ({
  value,
  onChange,
  request,
  business,
  currentName,
  action,
}) => {
  const [inspectors, setInspectors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const res = await ApplicationServices.getInspectors(
          business ? { business } : {},
          request,
        );
        if (cancelled) return;
        const list = Array.isArray(res.data?.data) ? res.data.data : [];
        setInspectors(list);
        setNotice(res.data?.message || "");
      } catch {
        if (!cancelled) setNotice("The list of inspectors could not be loaded.");
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
    if (value || !currentName || !inspectors.length) return;
    const match = inspectors.find((a) => a.name === currentName);
    if (match) onChange?.(match._id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentName, inspectors]);

  const selected = inspectors.find((a) => String(a._id) === String(value));
  const signatureHint =
    selected && !selected.hasSignature
      ? `${selected.name} has no signature saved on their profile.`
      : "";

  return (
    <Card>
      <CardHeader
        title="Inspector"
        subtitle="Only the assigned inspector can carry out the inspection work for this project."
        action={action}
      />

      {loading ? (
        <p className="epc-section__desc">Loading inspectors…</p>
      ) : inspectors.length === 0 ? (
        <p className="epc-notice epc-notice--warn">
          <AlertIcon size={16} className="epc-notice__icon" />
          <span>
            {notice ||
              "No inspectors are available. Give someone the Inspector role in Settings first."}
          </span>
        </p>
      ) : (
        <label className="flex flex-col gap-1">
          <span className="text-xs text-gray-500">Assigned to</span>
          <DropdownBasic
            options={inspectors.map((a) => ({
              value: a._id,
              label: `${a.name} (${a.email})`,
            }))}
            value={value || ""}
            onChange={(val) => onChange?.(val || "")}
            placeholder="Choose an inspector…"
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

export default InspectorPicker;
