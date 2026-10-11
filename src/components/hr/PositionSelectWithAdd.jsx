import { useContext, useEffect, useMemo, useState } from "react";
import { Pencil, Plus } from "lucide-react";
import ReactSelect, { components as selectComponents } from "react-select";
import { AdminContext } from "@/context/AdminContext";
import AddPositionModal from "@/pages/Settings/HR/AddPositionModal";
import { addPosition, updatePosition } from "@/services/positionService";
import reactSelectConfig from "@/utils/react-select-style-config";
import { notifyError, notifySuccess } from "@/utils/toast";

export default function PositionSelectWithAdd({
  businessId,
  privateStaffId = "",
  allowPrivateForStaff = false,
  value = "",
  onChange,
  positions = [],
  onPositionsRefetch,
  error,
  label = "Position",
  required = false,
  disabled = false,
  placeholder = "Select Position",
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
  const [editingPositionId, setEditingPositionId] = useState(null);
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
  const editingPosition = useMemo(() => {
    if (!editingPositionId) return null;
    return (
      positions?.find((p) => String(p._id) === String(editingPositionId)) || null
    );
  }, [positions, editingPositionId]);

  const openEditForId = (id) => {
    if (saving) return;
    if (!canEdit) {
      notifyError("Select a business first.");
      return;
    }
    if (!id) return;
    setMenuIsOpen(false);
    setEditingPositionId(String(id));
    setModalOpen(true);
  };

  const handleCloseModal = () => {
    if (saving) return;
    setModalOpen(false);
    setEditingPositionId(null);
  };

  const handleSubmit = async (item) => {
    if (!businessId) {
      notifyError("Select a business first.");
      return;
    }
    setSaving(true);
    try {
      let selectedId = null;
      if (editingPositionId) {
        const privateIds = Array.isArray(item.privateStaffIds)
          ? item.privateStaffIds
          : item.isPrivate && privateStaffId
            ? [privateStaffId]
            : [];
        await updatePosition(editingPositionId, item, businessId, headers, {
          isPrivate: Boolean(item.isPrivate),
          privateStaffIds: privateIds,
        });
        selectedId = String(editingPositionId);
      } else {
        const saved = await addPosition(item, businessId, headers, {
          isPrivate: allowPrivateForStaff ? Boolean(item.isPrivate) : false,
          privateStaffIds:
            allowPrivateForStaff && item.isPrivate && privateStaffId
              ? [privateStaffId]
              : [],
        });
        selectedId = saved?._id ? String(saved._id) : null;
      }
      await onPositionsRefetch?.();
      if (selectedId) {
        onChange?.(selectedId);
      }
      notifySuccess(editingPositionId ? "Position updated." : "Position added.");
      setModalOpen(false);
      setEditingPositionId(null);
    } catch (err) {
      notifyError(
        err?.response?.data?.error ||
          (editingPositionId
            ? "Failed to update position."
            : "Failed to add position.")
      );
    } finally {
      setSaving(false);
    }
  };

  const selectValue = value
    ? {
        value,
        label: positions?.find((p) => String(p._id) === String(value))?.name,
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
              setEditingPositionId(null);
              setMenuIsOpen(false);
              setModalOpen(true);
            }}
            className="inline-flex items-center gap-1 text-sm font-medium hover:opacity-80 disabled:opacity-40 disabled:cursor-not-allowed shrink-0"
            style={{ color: "var(--p-blue)" }}
            title={canAdd ? "Add new position" : "Select a business first"}
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
          options={positions?.map((p) => ({
            label: p.name,
            value: p._id,
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
                    aria-label="Edit position"
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
                    title="Edit position"
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
                    aria-label="Edit position"
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
                    title="Edit position"
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
      <AddPositionModal
        isOpen={modalOpen}
        onClose={handleCloseModal}
        item={editingPosition}
        onSubmit={handleSubmit}
        showPrivateToggle={allowPrivateForStaff}
        overlayClassName="z-[9999]"
      />
    </>
  );
}
