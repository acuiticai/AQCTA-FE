import { useContext, useEffect, useMemo, useState } from "react";
import { Pencil, Plus } from "lucide-react";
import ReactSelect, { components as selectComponents } from "react-select";
import { AdminContext } from "@/context/AdminContext";
import AddDepartmentModal from "@/pages/Settings/HR/AddDepartmentModal";
import {
  addDepartment,
  fetchStaffForDepartmentManager,
  updateDepartment,
} from "@/services/departmentService";
import reactSelectConfig from "@/utils/react-select-style-config";
import { notifyError, notifySuccess } from "@/utils/toast";

export default function DepartmentSelectWithAdd({
  businessId,
  privateStaffId = "",
  allowPrivateForStaff = false,
  value = "",
  onChange,
  departments = [],
  onDepartmentsRefetch,
  error,
  label = "Department / Team",
  required = false,
  disabled = false,
  placeholder = "Select Department",
  overlayClassName = "z-[70]",
  labelClassName = "block text-gray-600",
  errorClassName = "text-red-500 text-sm mt-1",
  idleBorderColor,
  controlMinHeight,
  controlBackgroundColor,
}) {
  const { state } = useContext(AdminContext);
  const [modalOpen, setModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editingDepartmentId, setEditingDepartmentId] = useState(null);
  const [staffList, setStaffList] = useState([]);
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
  const editingDepartment = useMemo(() => {
    if (!editingDepartmentId) return null;
    return (
      departments?.find((d) => String(d._id) === String(editingDepartmentId)) ||
      null
    );
  }, [departments, editingDepartmentId]);

  useEffect(() => {
    if (!modalOpen || !businessId) return;
    let cancelled = false;
    (async () => {
      const staff = await fetchStaffForDepartmentManager(
        businessId,
        state?.adminInfo?.token
      );
      if (!cancelled) setStaffList(staff);
    })();
    return () => {
      cancelled = true;
    };
  }, [modalOpen, businessId, state?.adminInfo?.token]);

  const openEditForId = (id) => {
    if (saving) return;
    if (!canEdit) {
      notifyError("Select a business first.");
      return;
    }
    if (!id) return;
    setMenuIsOpen(false);
    setEditingDepartmentId(String(id));
    setModalOpen(true);
  };

  const handleCloseModal = () => {
    if (saving) return;
    setModalOpen(false);
    setEditingDepartmentId(null);
  };

  const handleSubmit = async (item) => {
    if (!businessId) {
      notifyError("Select a business first.");
      return;
    }
    setSaving(true);
    try {
      let selectedId = null;
      if (editingDepartmentId) {
        const privateIds = Array.isArray(item.privateStaffIds)
          ? item.privateStaffIds
          : item.isPrivate && privateStaffId
            ? [privateStaffId]
            : [];
        await updateDepartment(editingDepartmentId, item, businessId, headers, {
          isPrivate: Boolean(item.isPrivate),
          privateStaffIds: privateIds,
        });
        selectedId = String(editingDepartmentId);
      } else {
        const saved = await addDepartment(item, businessId, headers, {
          isPrivate: allowPrivateForStaff ? Boolean(item.isPrivate) : false,
          privateStaffIds:
            allowPrivateForStaff && item.isPrivate && privateStaffId
              ? [privateStaffId]
              : [],
        });
        selectedId = saved?._id ? String(saved._id) : null;
      }
      await onDepartmentsRefetch?.();
      if (selectedId) {
        onChange?.(selectedId);
      }
      notifySuccess(
        editingDepartmentId ? "Department updated." : "Department added."
      );
      setModalOpen(false);
      setEditingDepartmentId(null);
    } catch (err) {
      notifyError(
        err?.response?.data?.error ||
          (editingDepartmentId
            ? "Failed to update department."
            : "Failed to add department.")
      );
    } finally {
      setSaving(false);
    }
  };

  const selectValue = value
    ? {
        value,
        label: departments?.find((d) => String(d._id) === String(value))?.name,
      }
    : null;

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
              setEditingDepartmentId(null);
              setMenuIsOpen(false);
              setModalOpen(true);
            }}
            className="inline-flex items-center gap-1 text-sm font-medium hover:opacity-80 disabled:opacity-40 disabled:cursor-not-allowed shrink-0"
            style={{ color: "var(--p-blue)" }}
            title={canAdd ? "Add new department" : "Select a business first"}
          >
            <Plus className="w-4 h-4" />
            Add
          </button>
        </div>
        <ReactSelect
          isSearchable
          isDisabled={disabled || !businessId}
          menuIsOpen={menuIsOpen}
          onMenuOpen={() => setMenuIsOpen(true)}
          onMenuClose={() => setMenuIsOpen(undefined)}
          value={selectValue}
          onChange={(opt) => onChange?.(opt ? opt.value : "")}
          placeholder={placeholder}
          options={departments?.map((d) => ({
            label: d.name,
            value: d._id,
          }))}
          className="react-select-container"
          classNamePrefix="react-select"
          menuPlacement="auto"
          components={{
            SingleValue: (props) => (
              <selectComponents.SingleValue {...props}>
                <div className="inline-flex items-center gap-2">
                  <span>{props.children}</span>
                  <button
                    type="button"
                    aria-label="Edit department"
                    disabled={!canEdit}
                    onMouseDown={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                    }}
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      openEditForId(props.data?.value);
                    }}
                    className="text-[var(--p-blue)] hover:opacity-80"
                    style={{
                      padding: 0,
                      background: "transparent",
                      border: 0,
                      cursor: canEdit ? "pointer" : "not-allowed",
                      display: "flex",
                      alignItems: "center",
                    }}
                    title="Edit department"
                  >
                    <Pencil size={14} />
                  </button>
                </div>
              </selectComponents.SingleValue>
            ),
            Option: (props) => (
              <selectComponents.Option {...props}>
                <div className="flex items-center justify-between gap-3 w-full pr-2">
                  <span className="truncate">{props.children}</span>
                  <button
                    type="button"
                    aria-label="Edit department"
                    disabled={!canEdit}
                    onMouseDown={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                    }}
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      openEditForId(props.data?.value);
                    }}
                    className="text-white hover:opacity-90"
                    style={{
                      padding: 0,
                      background: "transparent",
                      border: 0,
                      cursor: canEdit ? "pointer" : "not-allowed",
                      display: "flex",
                      alignItems: "center",
                    }}
                    title="Edit department"
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
              borderColor: error
                ? "#dc2626"
                : state.isFocused
                  ? "var(--p-blue)"
                  : idleBorderColor ?? "transparent",
              ...(controlMinHeight ? { minHeight: controlMinHeight } : {}),
              ...(controlBackgroundColor
                ? { backgroundColor: controlBackgroundColor }
                : {}),
              "&:hover": {
                borderColor: "none",
              },
            }),
          }}
        />
        {error ? <div className={errorClassName}>{error}</div> : null}
      </div>
      <AddDepartmentModal
        isOpen={modalOpen}
        onClose={handleCloseModal}
        item={editingDepartment}
        staffList={staffList}
        onSubmit={handleSubmit}
        showPrivateToggle={allowPrivateForStaff}
        overlayClassName="z-[9999]"
      />
    </>
  );
}
