import { useCallback, useContext, useEffect, useMemo, useState } from "react";
import { useHistory, useLocation } from "react-router-dom";
import { Plus, X } from "lucide-react";
import { FiEdit, FiTrash2 } from "react-icons/fi";
import Header from "@/components/header/Header";
import AppLayout from "../app-layout";
import SettingsOrgBanner from "../SettingsOrgBanner";
import FleetManagementServices from "@/services/FleetManagementServices";
import { notifyError, notifySuccess } from "@/utils/toast";
import {
  DEFAULT_FLEET_TERMINOLOGY,
  broadcastFleetTerminologyChange,
  normalizeFleetTerminology,
} from "@/utils/fleetTerminology";
import ToggleSwitch from "@/components/toggle/ToggleSwitch";
import { AdminContext } from "@/context/AdminContext";
import { useSettingsCrudPermissions } from "@/hooks/useSettingsCrudPermissions";

const TAB = {
  VEHICLE_TYPES: "vehicle-types",
  VEHICLES: "vehicles",
  SCHEDULE: "schedule",
  TERMINOLOGY: "terminology",
};

const TAB_ORDER = [TAB.VEHICLE_TYPES, TAB.VEHICLES, TAB.SCHEDULE, TAB.TERMINOLOGY];

function activeTabFromSearch(search) {
  const slug = new URLSearchParams(search || "").get("fleetTab");
  if (slug && TAB_ORDER.includes(slug)) return slug;
  return TAB.VEHICLE_TYPES;
}

function tabNavLabel(tabId, terms) {
  switch (tabId) {
    case TAB.VEHICLE_TYPES:
      return terms.vehicleTypeLabelPlural;
    case TAB.VEHICLES:
      return terms.vehicleLabelPlural;
    case TAB.SCHEDULE:
      return "Schedule";
    case TAB.TERMINOLOGY:
      return "Custom names";
    default:
      return tabId;
  }
}


const defaultScheduleForm = {
  businessStartHour: 6,
  businessEndHour: 20,
  slotIntervalMinutes: 30,
  workingDays: [1, 2, 3, 4, 5, 6],
  dispatchAddress: "",
  dispatchLatitude: "",
  dispatchLongitude: "",
};

function normalizeScheduleFromApi(data) {
  if (!data) return { ...defaultScheduleForm };
  const wd = Array.isArray(data.workingDays) && data.workingDays.length
    ? [...new Set(data.workingDays.map((d) => Number(d)).filter((d) => d >= 0 && d <= 6))]
    : defaultScheduleForm.workingDays;
  return {
    businessStartHour: Number(data.businessStartHour) || defaultScheduleForm.businessStartHour,
    businessEndHour: Number(data.businessEndHour) || defaultScheduleForm.businessEndHour,
    slotIntervalMinutes: [15, 30].includes(Number(data.slotIntervalMinutes))
      ? Number(data.slotIntervalMinutes)
      : defaultScheduleForm.slotIntervalMinutes,
    workingDays: wd.length ? wd : defaultScheduleForm.workingDays,
    dispatchAddress: data.dispatchAddress ?? "",
    dispatchLatitude: data.dispatchLatitude ?? "",
    dispatchLongitude: data.dispatchLongitude ?? "",
  };
}

function DeleteConfirmationModal({ isOpen, onClose, onConfirm, entityLabel }) {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-[350px] max-w-[90%]">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Are you sure?</h2>
        <p className="text-sm text-gray-600">
          Do you really want to delete this {entityLabel}? This action cannot be undone.
        </p>
        <div className="flex justify-end mt-6 space-x-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-gray-300 text-gray-800 rounded-lg hover:bg-gray-400 transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
          >
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}

function VehicleTypeModal({ isOpen, onClose, item, terms, onSubmit }) {
  const [name, setName] = useState("");
  useEffect(() => {
    if (isOpen) {
      setName(item?.name || "");
    }
  }, [item, isOpen]);
  if (!isOpen) return null;
  const label = terms.vehicleTypeLabelSingular;
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-[400px] max-w-[90%]">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-semibold">{item ? "Edit" : "Add New"} {label}</h2>
          <button type="button" onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="w-5 h-5" />
          </button>
        </div>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            onSubmit({ name: name.trim(), status: item?.status || "active" });
          }}
          className="space-y-4"
        >
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full p-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#A6C437] focus:border-transparent"
              required
            />
          </div>
          <div className="flex justify-end">
            <button
              type="submit"
              className="px-4 py-2 bg-[#A6C437] text-white rounded-lg hover:bg-opacity-90 transition-colors"
            >
              {item ? "Update" : "Add"} {label}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function VehicleModal({ isOpen, onClose, item, terms, types, onSubmit }) {
  const [form, setForm] = useState({
    name: "",
    vehicleId: "",
    plateNumber: "",
    vehicleType: "",
    status: "active",
  });
  useEffect(() => {
    if (!isOpen) return;
    if (item) {
      setForm({
        name: item.name || "",
        vehicleId: item.vehicleId || "",
        plateNumber: item.plateNumber || "",
        vehicleType: item.vehicleType?._id || item.vehicleType || "",
        status: item.status || "active",
      });
    } else {
      setForm({
        name: "",
        vehicleId: "",
        plateNumber: "",
        vehicleType: "",
        status: "active",
      });
    }
  }, [item, isOpen]);
  if (!isOpen) return null;
  const vLabel = terms.vehicleLabelSingular;
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-[440px] max-w-[95%] max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-semibold">{item ? "Edit" : "Add New"} {vLabel}</h2>
          <button type="button" onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="w-5 h-5" />
          </button>
        </div>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            onSubmit(form);
          }}
          className="space-y-4"
        >
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{vLabel} name</label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
              className="w-full p-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#A6C437] focus:border-transparent"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{vLabel} ID</label>
            <input
              type="text"
              value={form.vehicleId}
              onChange={(e) => setForm((p) => ({ ...p, vehicleId: e.target.value }))}
              className="w-full p-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#A6C437] focus:border-transparent"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Plate / registration #</label>
            <input
              type="text"
              value={form.plateNumber}
              onChange={(e) => setForm((p) => ({ ...p, plateNumber: e.target.value }))}
              className="w-full p-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#A6C437] focus:border-transparent"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{terms.vehicleTypeLabelSingular}</label>
            <select
              value={form.vehicleType}
              onChange={(e) => setForm((p) => ({ ...p, vehicleType: e.target.value }))}
              className="w-full p-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#A6C437] focus:border-transparent"
              required
            >
              <option value="">Select {terms.vehicleTypeLabelSingular}</option>
              {types.map((type) => (
                <option key={type._id} value={type._id}>
                  {type.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
            <select
              value={form.status}
              onChange={(e) => setForm((p) => ({ ...p, status: e.target.value }))}
              className="w-full p-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#A6C437] focus:border-transparent"
            >
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
          </div>
          <div className="flex justify-end">
            <button
              type="submit"
              className="px-4 py-2 bg-[#A6C437] text-white rounded-lg hover:bg-opacity-90 transition-colors"
            >
              {item ? "Update" : "Add"} {vLabel}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function FleetJobSchedulingSettings() {
  const history = useHistory();
  const location = useLocation();
  const { state } = useContext(AdminContext);
  const { adminInfo } = state || {};
  const {
    canAdd: allowAdd,
    canUpdate: allowUpdate,
    canDelete: allowDelete,
  } = useSettingsCrudPermissions();

  const [activeTab, setActiveTab] = useState(() =>
    activeTabFromSearch(typeof window !== "undefined" ? window.location.search : ""),
  );
  const [types, setTypes] = useState([]);
  const [vehicles, setVehicles] = useState([]);
  const [scheduleForm, setScheduleForm] = useState(defaultScheduleForm);
  const [scheduleSaving, setScheduleSaving] = useState(false);
  const [terminologyForm, setTerminologyForm] = useState(DEFAULT_FLEET_TERMINOLOGY);
  const [terminologySaving, setTerminologySaving] = useState(false);

  const [entityModalOpen, setEntityModalOpen] = useState(false);
  const [editTypeItem, setEditTypeItem] = useState(null);
  const [editVehicleItem, setEditVehicleItem] = useState(null);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [deletePayload, setDeletePayload] = useState({ id: null, kind: null });

  const selectedOrg = useMemo(
    () => new URLSearchParams(location.search).get("selectedOrg") || "",
    [location.search],
  );

  const load = useCallback(async () => {
    if (!selectedOrg) return;
    try {
      const orgParams = { business: selectedOrg };
      const [typesRes, vehiclesRes, schedRes] = await Promise.all([
        FleetManagementServices.getVehicleTypes(orgParams),
        FleetManagementServices.getVehicles(orgParams),
        FleetManagementServices.getFleetScheduleSettings(orgParams),
      ]);
      setTypes(typesRes?.data || []);
      setVehicles(vehiclesRes?.data || []);
      const schedData = schedRes?.data;
      setScheduleForm(normalizeScheduleFromApi(schedData));
      setTerminologyForm(normalizeFleetTerminology(schedData));
    } catch (error) {
      notifyError(error?.response?.data?.message || "Failed to load fleet settings");
    }
  }, [selectedOrg]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    setActiveTab(activeTabFromSearch(location.search));
  }, [location.search]);

  useEffect(() => {
    setEntityModalOpen(false);
    setEditTypeItem(null);
    setEditVehicleItem(null);
  }, [activeTab]);

  const selectTab = (tabId) => {
    const params = new URLSearchParams(location.search);
    params.set("fleetTab", tabId);
    history.replace({ pathname: location.pathname, search: params.toString() });
  };

  const handleAddNew = () => {
    if (!allowAdd) return;
    if (activeTab === TAB.VEHICLE_TYPES) {
      setEditTypeItem(null);
      setEditVehicleItem(null);
      setEntityModalOpen(true);
    } else if (activeTab === TAB.VEHICLES) {
      setEditVehicleItem(null);
      setEditTypeItem(null);
      setEntityModalOpen(true);
    }
  };

  const handleEditType = (item) => {
    if (!allowUpdate) return;
    setEditTypeItem(item);
    setEditVehicleItem(null);
    setEntityModalOpen(true);
  };

  const handleEditVehicle = (item) => {
    if (!allowUpdate) return;
    setEditVehicleItem(item);
    setEditTypeItem(null);
    setEntityModalOpen(true);
  };

  const submitVehicleType = async ({ name, status }) => {
    if ((editTypeItem && !allowUpdate) || (!editTypeItem && !allowAdd)) return;
    if (!selectedOrg) {
      notifyError("Missing organization — open this page from All Settings with a business selected.");
      return;
    }
    const t = terminologyForm;
    try {
      const payload = { name, status: status || "active", businessId: selectedOrg };
      if (editTypeItem) {
        await FleetManagementServices.updateVehicleType(editTypeItem._id, payload);
        notifySuccess(`${t.vehicleTypeLabelSingular} updated`);
      } else {
        await FleetManagementServices.createVehicleType(payload);
        notifySuccess(`${t.vehicleTypeLabelSingular} created`);
      }
      setEntityModalOpen(false);
      setEditTypeItem(null);
      await load();
    } catch (error) {
      notifyError(error?.response?.data?.message || "Failed to save");
    }
  };

  const submitVehicle = async (form) => {
    if ((editVehicleItem && !allowUpdate) || (!editVehicleItem && !allowAdd)) return;
    if (!selectedOrg) {
      notifyError("Missing organization — open this page from All Settings with a business selected.");
      return;
    }
    const t = terminologyForm;
    try {
      const payload = {
        vehicleId: form.vehicleId,
        name: form.name,
        plateNumber: form.plateNumber,
        vehicleType: form.vehicleType,
        status: form.status,
        businessId: selectedOrg,
      };
      if (editVehicleItem) {
        await FleetManagementServices.updateVehicle(editVehicleItem._id, payload);
        notifySuccess(`${t.vehicleLabelSingular} updated`);
      } else {
        await FleetManagementServices.createVehicle(payload);
        notifySuccess(`${t.vehicleLabelSingular} created`);
      }
      setEntityModalOpen(false);
      setEditVehicleItem(null);
      await load();
    } catch (error) {
      notifyError(error?.response?.data?.message || "Failed to save");
    }
  };

  const openDelete = (id, kind) => {
    if (!allowDelete) return;
    setDeletePayload({ id, kind });
    setDeleteModalOpen(true);
  };

  const confirmDelete = async () => {
    const { id, kind } = deletePayload;
    if (!id || !allowDelete) return;
    const t = terminologyForm;
    try {
      const delParams = { business: selectedOrg };
      if (kind === "type") {
        await FleetManagementServices.deleteVehicleType(id, delParams);
        notifySuccess(`${t.vehicleTypeLabelSingular} deleted`);
      } else {
        await FleetManagementServices.deleteVehicle(id, delParams);
        notifySuccess(`${t.vehicleLabelSingular} deleted`);
      }
      setDeleteModalOpen(false);
      setDeletePayload({ id: null, kind: null });
      await load();
    } catch (error) {
      notifyError(error?.response?.data?.message || "Delete failed");
    }
  };

  const toggleVehicleTypeStatus = async (item) => {
    if (!allowUpdate) return;
    const t = terminologyForm;
    try {
      await FleetManagementServices.updateVehicleType(item._id, {
        name: item.name,
        status: item.status === "active" ? "inactive" : "active",
        businessId: selectedOrg,
      });
      notifySuccess(`${t.vehicleTypeLabelSingular} updated`);
      await load();
    } catch (error) {
      notifyError(error?.response?.data?.message || "Failed to update status");
    }
  };

  const toggleVehicleStatus = async (item) => {
    if (!allowUpdate) return;
    const t = terminologyForm;
    try {
      await FleetManagementServices.updateVehicle(item._id, {
        vehicleId: item.vehicleId,
        name: item.name,
        plateNumber: item.plateNumber,
        vehicleType: item.vehicleType?._id || item.vehicleType,
        status: item.status === "active" ? "inactive" : "active",
        businessId: selectedOrg,
      });
      notifySuccess(`${t.vehicleLabelSingular} updated`);
      await load();
    } catch (error) {
      notifyError(error?.response?.data?.message || "Failed to update status");
    }
  };

  const saveScheduleSettings = async (e) => {
    e.preventDefault();
    if (!selectedOrg) {
      notifyError("Select a business first (open from All Settings with an organization selected).");
      return;
    }
    setScheduleSaving(true);
    try {
      await FleetManagementServices.updateFleetScheduleSettings({
        ...scheduleForm,
        businessId: selectedOrg,
      });
      notifySuccess("Schedule settings saved");
      const res = await FleetManagementServices.getFleetScheduleSettings({ business: selectedOrg });
      setScheduleForm(normalizeScheduleFromApi(res?.data));
      setTerminologyForm(normalizeFleetTerminology(res?.data));
    } catch (error) {
      notifyError(error?.response?.data?.message || "Failed to save schedule settings");
    } finally {
      setScheduleSaving(false);
    }
  };

  const saveTerminology = async (e) => {
    e.preventDefault();
    if (!selectedOrg) {
      notifyError("Select a business first (open from All Settings with an organization selected).");
      return;
    }
    setTerminologySaving(true);
    try {
      await FleetManagementServices.updateFleetScheduleSettings({
        ...terminologyForm,
        businessId: selectedOrg,
      });
      notifySuccess("Custom names saved");
      const res = await FleetManagementServices.getFleetScheduleSettings({ business: selectedOrg });
      setTerminologyForm(normalizeFleetTerminology(res?.data));
      broadcastFleetTerminologyChange(selectedOrg);
    } catch (error) {
      notifyError(error?.response?.data?.message || "Failed to save custom names");
    } finally {
      setTerminologySaving(false);
    }
  };

  const toggleWorkingDay = (day) => {
    setScheduleForm((prev) => {
      const set = new Set(prev.workingDays);
      if (set.has(day)) {
        if (set.size <= 1) return prev;
        set.delete(day);
      } else {
        set.add(day);
      }
      return { ...prev, workingDays: Array.from(set).sort((a, b) => a - b) };
    });
  };

  const showEntitySection = activeTab === TAB.VEHICLE_TYPES || activeTab === TAB.VEHICLES;
  const inputClass =
    "w-full p-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#A6C437] focus:border-transparent";

  if (!selectedOrg) {
    return (
      <AppLayout>
        <Header />
        <div className="p-6 bg-white h-full max-h-[90vh] overflow-y-auto">
          <h1 className="text-xl font-semibold text-gray-900 mb-2">Fleet management</h1>
          <SettingsOrgBanner />
          <div className="bg-amber-50 border border-amber-200 text-amber-800 px-4 py-3 rounded text-sm">
            Select a business on <span className="font-medium">All Settings</span>, then open Fleet management links so
            dispatch schedule and labels save for that organization.
          </div>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <Header />
      <div className="p-6 bg-white h-full max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-start mb-6 gap-4 flex-wrap">
          <div>
            <h1 className="text-xl font-semibold text-gray-900">Fleet management</h1>
            <p className="text-sm text-gray-500 mt-1 max-w-3xl">
              {terminologyForm.vehicleTypeLabelPlural}, {terminologyForm.vehicleLabelPlural.toLowerCase()}, dispatch
              schedule, and optional custom labels — same area as{" "}
              <span className="font-medium text-gray-600">All Settings → Fleet management</span>.
            </p>
          </div>
          {showEntitySection && allowAdd ? (
            <button
              type="button"
              onClick={handleAddNew}
              className="flex items-center px-4 py-2 bg-[#A6C437] text-white rounded-lg hover:bg-opacity-90 transition-colors shrink-0"
            >
              <Plus className="w-5 h-5 mr-2" />
              Add New
            </button>
          ) : null}
        </div>
        <SettingsOrgBanner />

        <div className="border-b border-gray-200 mb-6">
          <nav className="flex flex-wrap -mb-px gap-x-6">
            {TAB_ORDER.map((tabId) => (
              <button
                key={tabId}
                type="button"
                onClick={() => selectTab(tabId)}
                className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                  activeTab === tabId
                    ? "border-[#A6C437] text-[#A6C437]"
                    : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                }`}
              >
                {tabNavLabel(tabId, terminologyForm)}
              </button>
            ))}
          </nav>
        </div>

        {activeTab === TAB.SCHEDULE ? (
          <div className="bg-gray-50 rounded-lg p-6 mb-6">
            <form
              onSubmit={saveScheduleSettings}
              className="bg-white rounded-lg shadow-sm border border-gray-100 p-6 space-y-4"
            >
              <p className="text-sm text-gray-600 -mt-1 mb-2">
                Dispatch hours, slot length, and working days are saved <strong>only for this organization</strong> (see
                banner above). Nothing here is shared across businesses.
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Business start (hour)</label>
                  <select
                    className={inputClass}
                    value={scheduleForm.businessStartHour}
                    onChange={(e) =>
                      setScheduleForm((p) => ({ ...p, businessStartHour: Number(e.target.value) }))
                    }
                  >
                    {Array.from({ length: 24 }, (_, h) => (
                      <option key={h} value={h}>
                        {h === 0 ? "12:00 AM (midnight)" : h < 12 ? `${h}:00 AM` : h === 12 ? "12:00 PM" : `${h - 12}:00 PM`}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Business end (hour)</label>
                  <select
                    className={inputClass}
                    value={scheduleForm.businessEndHour}
                    onChange={(e) =>
                      setScheduleForm((p) => ({ ...p, businessEndHour: Number(e.target.value) }))
                    }
                  >
                    {Array.from({ length: 24 }, (_, i) => i + 1).map((h) => (
                      <option key={h} value={h}>
                        {h === 24
                          ? "12:00 AM (end of day)"
                          : h < 12
                            ? `${h}:00 AM`
                            : h === 12
                              ? "12:00 PM"
                              : `${h - 12}:00 PM`}
                      </option>
                    ))}
                  </select>
                  <p className="text-xs text-gray-500 mt-1">
                    Grid shows slots from start up to (but not including) this hour.
                  </p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Time interval</label>
                  <select
                    className={inputClass}
                    value={scheduleForm.slotIntervalMinutes}
                    onChange={(e) =>
                      setScheduleForm((p) => ({ ...p, slotIntervalMinutes: Number(e.target.value) }))
                    }
                  >
                    <option value={30}>30 minutes</option>
                    <option value={15}>15 minutes</option>
                  </select>
                </div>
                <div className="md:col-span-2">
                  <span className="block text-sm font-medium text-gray-700 mb-2">Working days</span>
                  <div className="flex flex-wrap gap-3">
                    {[
                      { d: 0, label: "Sun" },
                      { d: 1, label: "Mon" },
                      { d: 2, label: "Tue" },
                      { d: 3, label: "Wed" },
                      { d: 4, label: "Thu" },
                      { d: 5, label: "Fri" },
                      { d: 6, label: "Sat" },
                    ].map(({ d, label }) => (
                      <label key={d} className="inline-flex items-center gap-1.5 text-sm cursor-pointer">
                        <input
                          type="checkbox"
                          checked={scheduleForm.workingDays.includes(d)}
                          onChange={() => toggleWorkingDay(d)}
                        />
                        {label}
                      </label>
                    ))}
                  </div>
                </div>
                {/*
                Dispatch map origin fields — hidden in UI for now; values still load/save with schedule payload.
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Dispatch address</label>
                  <input
                    className={inputClass}
                    placeholder="Street, city, state (used for map search)"
                    value={scheduleForm.dispatchAddress}
                    onChange={(e) => setScheduleForm((p) => ({ ...p, dispatchAddress: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Latitude (optional)</label>
                  <input
                    className={inputClass}
                    placeholder="e.g. 40.7128"
                    value={scheduleForm.dispatchLatitude}
                    onChange={(e) => setScheduleForm((p) => ({ ...p, dispatchLatitude: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Longitude (optional)</label>
                  <input
                    className={inputClass}
                    placeholder="e.g. -74.0060"
                    value={scheduleForm.dispatchLongitude}
                    onChange={(e) => setScheduleForm((p) => ({ ...p, dispatchLongitude: e.target.value }))}
                  />
                </div>
                */}
              </div>
              <button
                type="submit"
                disabled={scheduleSaving}
                className="px-4 py-2 bg-[#A6C437] text-white rounded-lg hover:bg-opacity-90 transition-colors disabled:opacity-60"
              >
                {scheduleSaving ? "Saving…" : "Save schedule settings"}
              </button>
            </form>
          </div>
        ) : null}

        {activeTab === TAB.TERMINOLOGY ? (
          <div className="bg-gray-50 rounded-lg p-6 mb-6">
            <form
              onSubmit={saveTerminology}
              className="bg-white rounded-lg shadow-sm border border-gray-100 p-6 space-y-4 max-w-2xl"
            >
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Type category — singular</label>
                  <input
                    className={inputClass}
                    value={terminologyForm.vehicleTypeLabelSingular}
                    onChange={(e) =>
                      setTerminologyForm((p) => ({ ...p, vehicleTypeLabelSingular: e.target.value }))
                    }
                    placeholder="e.g. Fleet type"
                    maxLength={64}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Type category — plural (tab title)
                  </label>
                  <input
                    className={inputClass}
                    value={terminologyForm.vehicleTypeLabelPlural}
                    onChange={(e) =>
                      setTerminologyForm((p) => ({ ...p, vehicleTypeLabelPlural: e.target.value }))
                    }
                    placeholder="e.g. Fleet types"
                    maxLength={64}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Resource — singular</label>
                  <input
                    className={inputClass}
                    value={terminologyForm.vehicleLabelSingular}
                    onChange={(e) =>
                      setTerminologyForm((p) => ({ ...p, vehicleLabelSingular: e.target.value }))
                    }
                    placeholder="e.g. Truck"
                    maxLength={64}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Resource — plural (tab title)
                  </label>
                  <input
                    className={inputClass}
                    value={terminologyForm.vehicleLabelPlural}
                    onChange={(e) =>
                      setTerminologyForm((p) => ({ ...p, vehicleLabelPlural: e.target.value }))
                    }
                    placeholder="e.g. Trucks"
                    maxLength={64}
                  />
                </div>
              </div>
              <button
                type="submit"
                disabled={terminologySaving}
                className="px-4 py-2 bg-[#A6C437] text-white rounded-lg hover:bg-opacity-90 transition-colors disabled:opacity-60"
              >
                {terminologySaving ? "Saving…" : "Save custom names"}
              </button>
            </form>
          </div>
        ) : null}

        {showEntitySection ? (
          <div className="bg-gray-50 rounded-lg p-6">
            <div className="flex justify-between items-center mb-6 flex-wrap gap-2">
              <span className="text-sm font-medium text-gray-700">
                {activeTab === TAB.VEHICLE_TYPES
                  ? terminologyForm.vehicleTypeLabelPlural
                  : terminologyForm.vehicleLabelPlural}
              </span>
            </div>
            <div className="bg-white rounded-lg shadow-sm overflow-x-auto">
              {activeTab === TAB.VEHICLE_TYPES ? (
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        {terminologyForm.vehicleTypeLabelSingular} name
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Status
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {types.map((item) => (
                      <tr key={item._id}>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{item.name}</td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <ToggleSwitch
                            isOn={item.status === "active"}
                            handleToggle={() => toggleVehicleTypeStatus(item)}
                            disabled={!allowUpdate}
                          />
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                          {allowUpdate ? (
                            <button
                              type="button"
                              onClick={() => handleEditType(item)}
                              className="text-blue-600 hover:text-blue-900 mr-2"
                            >
                              <FiEdit className="w-5 h-5" />
                            </button>
                          ) : null}
                          {allowDelete ? (
                            <button
                              type="button"
                              onClick={() => openDelete(item._id, "type")}
                              className="text-red-600 hover:text-red-900"
                            >
                              <FiTrash2 className="w-5 h-5" />
                            </button>
                          ) : null}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        {terminologyForm.vehicleLabelSingular} ID
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        {terminologyForm.vehicleLabelSingular} name
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Plate #
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        {terminologyForm.vehicleTypeLabelSingular}
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Status
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {vehicles.map((item) => (
                      <tr key={item._id}>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{item.vehicleId}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{item.name}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{item.plateNumber}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {item.vehicleType?.name || "—"}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <ToggleSwitch
                            isOn={item.status === "active"}
                            handleToggle={() => toggleVehicleStatus(item)}
                            disabled={!allowUpdate}
                          />
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                          {allowUpdate ? (
                            <button
                              type="button"
                              onClick={() => handleEditVehicle(item)}
                              className="text-blue-600 hover:text-blue-900 mr-2"
                            >
                              <FiEdit className="w-5 h-5" />
                            </button>
                          ) : null}
                          {allowDelete ? (
                            <button
                              type="button"
                              onClick={() => openDelete(item._id, "vehicle")}
                              className="text-red-600 hover:text-red-900"
                            >
                              <FiTrash2 className="w-5 h-5" />
                            </button>
                          ) : null}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        ) : null}

        <VehicleTypeModal
          isOpen={entityModalOpen && activeTab === TAB.VEHICLE_TYPES}
          onClose={() => {
            setEntityModalOpen(false);
            setEditTypeItem(null);
          }}
          item={editTypeItem}
          terms={terminologyForm}
          onSubmit={submitVehicleType}
        />
        <VehicleModal
          isOpen={entityModalOpen && activeTab === TAB.VEHICLES}
          onClose={() => {
            setEntityModalOpen(false);
            setEditVehicleItem(null);
          }}
          item={editVehicleItem}
          terms={terminologyForm}
          types={types}
          onSubmit={submitVehicle}
        />
        <DeleteConfirmationModal
          isOpen={deleteModalOpen}
          onClose={() => {
            setDeleteModalOpen(false);
            setDeletePayload({ id: null, kind: null });
          }}
          onConfirm={confirmDelete}
          entityLabel={
            deletePayload.kind === "type"
              ? terminologyForm.vehicleTypeLabelSingular.toLowerCase()
              : terminologyForm.vehicleLabelSingular.toLowerCase()
          }
        />
      </div>
    </AppLayout>
  );
}
