import { useContext, useEffect, useMemo, useState } from "react";
import { Pencil, Plus } from "lucide-react";
import ReactSelect, { components as selectComponents } from "react-select";
import { AdminContext } from "@/context/AdminContext";
import AddBranchLocationModal from "@/pages/Settings/HR/AddBranchLocationModal";
import {
  addBranchLocation,
  updateBranchLocation,
} from "@/services/branchLocationService";
import { branchMultiSelectValue } from "@/utils/staffBranchLocationsForm";
import reactSelectConfig from "@/utils/react-select-style-config";
import { notifyError, notifySuccess } from "@/utils/toast";

export default function BranchLocationSelectWithAdd({
  businessId,
  privateStaffId = "",
  allowPrivateForStaff = false,
  value = [],
  onChange,
  branches = [],
  onBranchesRefetch,
  error,
  label = "Branch / Location",
  required = false,
  disabled = false,
  placeholder = "Select one or more branches",
  overlayClassName = "z-[9999]",
  labelClassName = "block text-gray-600",
  errorClassName = "text-red-500 text-sm mt-1",
  idleBorderColor,
  controlMinHeight,
}) {
  const { state } = useContext(AdminContext);
  const [modalOpen, setModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editingBranchId, setEditingBranchId] = useState(null);
  // Keep react-select mostly uncontrolled, but force-close the menu when opening the edit modal.
  const [menuIsOpen, setMenuIsOpen] = useState(undefined);

  useEffect(() => {
    if (modalOpen) setMenuIsOpen(false);
  }, [modalOpen]);

  const headers = {
    "Content-Type": "application/json",
    authorization: `Bearer ${state?.adminInfo?.token}`,
  };

  const canAdd = Boolean(businessId) && !disabled;
  const canEdit = Boolean(businessId) && !disabled;
  const editingBranch = useMemo(() => {
    if (!editingBranchId) return null;
    return (
      branches?.find((branch) => String(branch._id) === String(editingBranchId)) ||
      null
    );
  }, [branches, editingBranchId]);

  const handleCloseModal = () => {
    if (saving) return;
    setModalOpen(false);
    setEditingBranchId(null);
  };

  const openEditForBranchId = (branchId) => {
    if (saving) return;
    if (!canEdit) {
      notifyError("Select a business first.");
      return;
    }
    if (!branchId) return;
    // Prevent react-select dropdown menu from staying open above the modal.
    setMenuIsOpen(false);
    setEditingBranchId(String(branchId));
    setModalOpen(true);
  };

  const handleBranchSubmit = async (item) => {
    if (!businessId) {
      notifyError("Select a business first.");
      return;
    }
    setSaving(true);
    try {
      let branchIdToSelect = null;
      if (editingBranchId) {
        const privateIds = Array.isArray(item.privateStaffIds)
          ? item.privateStaffIds
          : item.isPrivate && privateStaffId
            ? [privateStaffId]
            : [];
        await updateBranchLocation(
          editingBranchId,
          item,
          businessId,
          headers,
          {
            isPrivate: Boolean(item.isPrivate),
            privateStaffIds: privateIds,
          }
        );
        branchIdToSelect = String(editingBranchId);
      } else {
        const saved = await addBranchLocation(item, businessId, headers, {
          isPrivate: allowPrivateForStaff ? Boolean(item.isPrivate) : false,
          privateStaffIds:
            allowPrivateForStaff && item.isPrivate && privateStaffId
              ? [privateStaffId]
              : [],
        });
        branchIdToSelect = saved?._id ? String(saved._id) : null;
      }
      await onBranchesRefetch?.();
      if (branchIdToSelect) {
        const next = [
          ...new Set([...(value || []).map(String), branchIdToSelect]),
        ];
        onChange?.(next);
      }
      notifySuccess(
        editingBranchId ? "Branch location updated." : "Branch location added."
      );
      setModalOpen(false);
      setEditingBranchId(null);
    } catch (err) {
      notifyError(
        err?.response?.data?.error ||
          (editingBranchId
            ? "Failed to update branch location."
            : "Failed to add branch location.")
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <div>
        <div className="flex items-center justify-between gap-2 mb-2">
          <label className={labelClassName}>
            {label}
            {required ? <span className="text-red-500"> *</span> : null}
          </label>
          <button
            type="button"
            disabled={!canAdd || saving}
            onClick={() => {
              setEditingBranchId(null);
                setMenuIsOpen(false);
              setModalOpen(true);
            }}
            className="inline-flex items-center gap-1 text-sm font-medium hover:opacity-80 disabled:opacity-40 disabled:cursor-not-allowed shrink-0"
            style={{ color: "var(--p-blue)" }}
            title={canAdd ? "Add new branch" : "Select a business first"}
          >
            <Plus className="w-4 h-4" />
            Add
          </button>
        </div>
        <ReactSelect
          isMulti
          isSearchable
          isDisabled={disabled || !businessId}
          menuIsOpen={menuIsOpen}
          onMenuOpen={() => setMenuIsOpen(true)}
          onMenuClose={() => setMenuIsOpen(undefined)}
          value={branchMultiSelectValue(value, branches)}
          onChange={(selectedOptions) =>
            onChange?.(
              selectedOptions ? selectedOptions.map((o) => o.value) : []
            )
          }
          placeholder={placeholder}
          options={branches?.map((d) => ({
            label: d.name,
            value: d._id,
          }))}
          className="react-select-container"
          classNamePrefix="react-select"
          menuPlacement="auto"
          components={{
            // Pencil next to each selected chip (cross icon remains from default remove component).
            MultiValueLabel: (props) => (
              <selectComponents.MultiValueLabel {...props}>
                <div className="flex items-center gap-2">
                  <span>{props.children}</span>
                  <button
                    type="button"
                    aria-label="Edit branch"
                    disabled={!canEdit}
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      openEditForBranchId(props.data?.value);
                    }}
                    onMouseDown={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                    }}
                    className="text-[var(--p-blue)] hover:opacity-80"
                    style={{
                      padding: 0,
                      background: "transparent",
                      border: 0,
                      cursor: canEdit ? "pointer" : "not-allowed",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                    title="Edit branch"
                  >
                    <Pencil size={14} />
                  </button>
                </div>
              </selectComponents.MultiValueLabel>
            ),
            // Pencil inside dropdown options; opens edit modal without selecting.
            Option: (props) => (
              <selectComponents.Option {...props}>
                <div className="flex items-center justify-between gap-3 w-full pr-2">
                  <span className="truncate">{props.children}</span>
                  <button
                    type="button"
                    aria-label="Edit branch"
                    disabled={!canEdit}
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      openEditForBranchId(props.data?.value);
                    }}
                    onMouseDown={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                    }}
                    className="text-white hover:opacity-90"
                    style={{
                      padding: 0,
                      background: "transparent",
                      border: 0,
                      cursor: canEdit ? "pointer" : "not-allowed",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                    title="Edit branch"
                  >
                    <Pencil size={14} />
                  </button>
                </div>
              </selectComponents.Option>
            ),
          }}
          styles={{
            ...reactSelectConfig,
            control: (base, state) => ({
              ...reactSelectConfig.control?.(base, state),
              borderWidth: "1px",
              borderColor: error
                ? "#dc2626"
                : state.isFocused
                  ? "var(--p-blue)"
                  : idleBorderColor ?? "transparent",
              ...(controlMinHeight
                ? { minHeight: controlMinHeight }
                : {}),
              "&:hover": {
                borderColor: "none",
              },
            }),
            valueContainer: (base) => ({
              ...(reactSelectConfig.valueContainer?.(base) || base),
              padding: "0px 4px",
              alignItems: "flex-start",
              gap: "6px",
            }),
            multiValue: (base, state) => ({
              ...(reactSelectConfig.multiValue?.(base, state) || base),
              margin: "0 4px 0 0",
            }),
            indicatorsContainer: (base, state) => ({
              ...(reactSelectConfig.indicatorsContainer?.(base, state) || base),
              paddingTop: 0,
              paddingBottom: 0,
            }),
          }}
        />
        {error ? <div className={errorClassName}>{error}</div> : null}
      </div>
      <AddBranchLocationModal
        isOpen={modalOpen}
        onClose={handleCloseModal}
        item={editingBranch}
        type="Branches"
        onSubmit={handleBranchSubmit}
        showPrivateToggle={allowPrivateForStaff}
        overlayClassName="z-[9999]"
      />
    </>
  );
}
