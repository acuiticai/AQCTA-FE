import { useEffect, useState } from "react";
import axios from "axios";
import DropdownBasic from "../DropdownBasic";
import {
  readAssignedBusinessesFallback,
  writeSessionAssignedBusinesses,
} from "@/utils/sessionAssignedBusinesses";

const Base_URL = import.meta.env.VITE_APP_API_BASE_URL;

const BusinessDropdown = ({
  adminId,
  selectedBusiness,
  selectedBusinesses,
  onChange,
  selectionMode, // optional: "single" | "multiple"
  isActive = true,
  customClassName = "",
  selectProps = {},
  size = "md",
  setAssignedBusinesses = () => {},
  onAssignedLoadComplete,
  isClearable = true,
  appearance = "default",
  hideWhenSingleBusiness = true,
  ...props
}) => {
  const [businesses, setBusinesses] = useState(() =>
    readAssignedBusinessesFallback()
  );
  const isMulti = selectionMode
    ? selectionMode === "multiple"
    : Boolean(props?.isMulti);

  const applySingleBusinessSelection = (assigned) => {
    if (assigned.length !== 1) return;
    const onlyId = assigned[0]._id;
    if (isMulti) {
      const current = selectedBusinesses || [];
      if (!current.length) onChange([onlyId]);
    } else if (!selectedBusiness) {
      onChange(onlyId);
    }
  };

  // console.log("adminId", adminId);
  const fetchAssignedBusinesses = async () => {
    if (!adminId) return;

    let assigned = [];
    try {
      const res = await axios.get(`${Base_URL}/admin/assigned/${adminId}`);
      assigned = res.data.businesses || [];
      setBusinesses(assigned);
      writeSessionAssignedBusinesses(assigned);
      setAssignedBusinesses(assigned.map((business) => business._id));
      applySingleBusinessSelection(assigned);
    } catch (err) {
      console.error("Failed to fetch assigned businesses:", err);
      const fallback = readAssignedBusinessesFallback();
      assigned = fallback;
      setBusinesses(fallback);
      applySingleBusinessSelection(fallback);
    } finally {
      onAssignedLoadComplete?.(assigned);
    }
  };
  useEffect(() => {
    // Ensure single-business auto-select even when using cached session list.
    applySingleBusinessSelection(businesses);
    if (adminId) {
      fetchAssignedBusinesses();
    } else {
      onAssignedLoadComplete?.(businesses);
    }
  }, [adminId]);

  if (hideWhenSingleBusiness && businesses.length === 1) {
    return null;
  }

  return (
    <DropdownBasic
      {...props}
      appearance={appearance}
      value={
        isMulti
          ? selectedBusinesses ||
            (selectedBusiness ? [selectedBusiness].filter(Boolean) : [])
          : selectedBusiness
      }
      onChange={onChange}
      isClearable={isClearable}
      isActive={isActive}
      className={size ? "text-${size} " + customClassName : customClassName}
      customClassName={selectProps?.customClassName}
      placeholder={props?.placeholder || "Select Business"}
      isMulti={isMulti}
      options={businesses.map((business) => ({
        label: business.name,
        value: business._id,
      }))}
    />
  );
};

export default BusinessDropdown;
