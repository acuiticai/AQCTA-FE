import React, { useState, useEffect, useContext, useCallback, useMemo, useRef } from "react";
import { AdminContext } from "@/context/AdminContext";
import { useHistory, useLocation } from "react-router-dom";
import { notifyError, notifySuccess } from "@/utils/toast";
import PosServices from "@/services/PosServices";
import Header from "@/components/header/Header";
import AppLayout from "@/pages/Settings/app-layout";
import SettingsOrgBanner from "@/pages/Settings/SettingsOrgBanner";
import {
  ArrowLeft,
  LayoutGrid,
  Plus,
  Pencil,
  Trash2,
  Layers,
  Save,
  X,
  Upload,
  RefreshCw,
  Settings,
  AlertCircle,
  QrCode,
  ChefHat,
  Landmark,
} from "lucide-react";
import TableQrManagerModal from "@/pages/POS/components/TableQrManagerModal";
import { KitchenSectionsPanel } from "@/pages/Kitchen/components/KitchenSectionsManager";
import { useSettingsCrudPermissions } from "@/hooks/useSettingsCrudPermissions";

// ────────────────────────────────── helpers ──────────────────────

const SHAPES = [
  { value: "rectangle", label: "Rectangle" },
  { value: "circle", label: "Circle" },
  { value: "square", label: "Square" },
];

const STATUS_COLORS = {
  available: "bg-emerald-50 text-emerald-700 border-emerald-200",
  occupied: "bg-amber-50 text-amber-700 border-amber-200",
  reserved: "bg-red-50 text-red-700 border-red-200",
};

const emptyTable = {
  tableNumber: "",
  label: "",
  capacity: 4,
  shape: "rectangle",
  floor: "Main",
  sortOrder: 0,
};

const SEED_LABELS = [
  { index: 0, label: "VIP Booth" },
  { index: 2, label: "Window Seat" },
  { index: 4, label: "Family Table" },
  { index: 7, label: "Counter Seat" },
  { index: 10, label: "Corner Table" },
];

// ────────────────────────────────── component ───────────────────

const PosSettings = () => {
  const {
    state: { adminInfo },
  } = useContext(AdminContext);
  const history = useHistory();
  const location = useLocation();
  const token = adminInfo?.token;
  // Stabilize headers so they don't cause effect thrash in production.
  const headers = useMemo(
    () => (token ? { Authorization: `Bearer ${token}` } : {}),
    [token]
  );
  const { canAdd, canUpdate, canDelete } = useSettingsCrudPermissions();

  const selectedOrgFromQuery = useMemo(() => {
    const params = new URLSearchParams(location.search || "");
    return params.get("selectedOrg") || "";
  }, [location.search]);

  // Business selector
  const businesses = useMemo(
    () => adminInfo?.businesses || [],
    [adminInfo?.businesses]
  );
  const [selectedBusiness, setSelectedBusiness] = useState("");

  useEffect(() => {
    if (!businesses.length) return;

    if (selectedOrgFromQuery) {
      const exists = businesses.some((b) => b._id === selectedOrgFromQuery);
      if (exists && selectedBusiness !== selectedOrgFromQuery) {
        setSelectedBusiness(selectedOrgFromQuery);
        return;
      }
    }

    if (!selectedBusiness) {
      setSelectedBusiness(businesses[0]._id);
    }
  }, [businesses, selectedBusiness, selectedOrgFromQuery]);

  // Sync ?selectedOrg= using the browser History API to avoid potential
  // react-router history reference churn that can trigger re-render loops
  // in some production bundles.
  const lastSyncedOrgRef = useRef("");
  useEffect(() => {
    if (!selectedBusiness) return;
    if (lastSyncedOrgRef.current === selectedBusiness) return;
    try {
      const params = new URLSearchParams(window.location.search || "");
      if (params.get("selectedOrg") !== selectedBusiness) {
        params.set("selectedOrg", selectedBusiness);
        const nextUrl = `${window.location.pathname}?${params.toString()}${window.location.hash || ""}`;
        window.history.replaceState(window.history.state, "", nextUrl);
      }
      lastSyncedOrgRef.current = selectedBusiness;
    } catch (_) {
      // no-op
    }
  }, [selectedBusiness]);

  // Tab state
  const [activeTab, setActiveTab] = useState("tables");

  // Table state
  const [tables, setTables] = useState([]);
  const [floors, setFloors] = useState([]);
  const [loading, setLoading] = useState(false);
  const [editingTable, setEditingTable] = useState(null); // null = closed, {} = new, {_id} = editing
  const [formData, setFormData] = useState({ ...emptyTable });
  const [saving, setSaving] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [deletingAll, setDeletingAll] = useState(false);
  const [showDeleteAllConfirm, setShowDeleteAllConfirm] = useState(false);
  const [charges, setCharges] = useState({
    serviceChargeEnabled: false,
    serviceChargeType: "percentage",
    serviceChargeValue: 0,
    serviceChargeDineInOnly: true,
  });
  const [chargesLoading, setChargesLoading] = useState(false);
  const [chargesSaving, setChargesSaving] = useState(false);

  // POS → ledger accounting wiring.
  const [ledger, setLedger] = useState({
    postingEnabled: false,
    cashAccount: "",
    cardAccount: "",
  });
  const [bankAccounts, setBankAccounts] = useState([]);
  const [clearingMethods, setClearingMethods] = useState([]);
  const [ledgerLoading, setLedgerLoading] = useState(false);
  const [ledgerSaving, setLedgerSaving] = useState(false);

  // Receipt logo toggle — stored in localStorage, default enabled
  const [showLogoInReceipt, setShowLogoInReceipt] = useState(
    () => localStorage.getItem("pos.receipt.showLogo") !== "false"
  );

  // QR manager state
  const [qrManagerTable, setQrManagerTable] = useState(null);

  // Bulk create state
  const [showBulk, setShowBulk] = useState(false);
  const [bulkData, setBulkData] = useState({
    count: 10,
    floor: "Main",
    prefix: "T",
    startNumber: 1,
  });

  const nextSeedStart = useMemo(() => {
    const usedNumbers = tables
      .map((t) => {
        const m = String(t.tableNumber || "").match(/^T(\d+)$/i);
        return m ? Number(m[1]) : null;
      })
      .filter((n) => Number.isFinite(n));

    if (!usedNumbers.length) return 1;
    return Math.max(...usedNumbers) + 1;
  }, [tables]);

  // ── Fetch tables ─────────────────────────────────────────────
  const fetchTables = useCallback(async () => {
    if (!selectedBusiness) return;
    setLoading(true);
    try {
      const res = await PosServices.getTables(
        { business: selectedBusiness },
        headers
      );
      if (res.data?.success) {
        setTables(res.data.data || []);
        setFloors(
          Array.isArray(res.data.floors)
            ? res.data.floors.filter((f) => f !== "All")
            : []
        );
      }
    } catch (err) {
      notifyError(err?.response?.data?.message || "Failed to load tables");
    } finally {
      setLoading(false);
    }
  }, [selectedBusiness, headers]);

  useEffect(() => {
    fetchTables();
  }, [fetchTables]);

  const fetchChargeSettings = useCallback(async () => {
    if (!selectedBusiness) return;
    setChargesLoading(true);
    try {
      const res = await PosServices.getChargeSettings(selectedBusiness, headers);
      if (res.data?.success && res.data?.data) {
        const d = res.data.data;
        setCharges({
          serviceChargeEnabled: !!d.serviceChargeEnabled,
          serviceChargeType: d.serviceChargeType === "fixed" ? "fixed" : "percentage",
          serviceChargeValue: Number(
            d.serviceChargeValue !== undefined ? d.serviceChargeValue : d.serviceChargeRate || 0,
          ),
          serviceChargeDineInOnly: d.serviceChargeDineInOnly !== false,
        });
      }
    } catch (err) {
      notifyError(
        err?.response?.data?.message || "Failed to load charge settings",
      );
    } finally {
      setChargesLoading(false);
    }
  }, [selectedBusiness, headers]);

  useEffect(() => {
    fetchChargeSettings();
  }, [fetchChargeSettings]);

  const fetchLedgerSettings = useCallback(async () => {
    if (!selectedBusiness) return;
    setLedgerLoading(true);
    try {
      const res = await PosServices.getLedgerSettings(selectedBusiness, headers);
      if (res.data?.success && res.data?.data) {
        const { settings, bankAccounts: accts, clearingMethods: cm } = res.data.data;
        setBankAccounts(accts || []);
        setClearingMethods(cm || []);
        setLedger({
          postingEnabled: !!settings?.postingEnabled,
          cashAccount: settings?.cashAccount || "",
          cardAccount: settings?.cardAccount || "",
        });
      }
    } catch (err) {
      notifyError(
        err?.response?.data?.message || "Failed to load POS accounting settings"
      );
    } finally {
      setLedgerLoading(false);
    }
  }, [selectedBusiness, headers]);

  useEffect(() => {
    fetchLedgerSettings();
  }, [fetchLedgerSettings]);

  const handleSaveLedger = async () => {
    if (!canUpdate) return;
    if (ledger.postingEnabled && (!ledger.cashAccount || !ledger.cardAccount)) {
      notifyError(
        "Choose both a cash account and a card/online account before turning posting on."
      );
      return;
    }
    setLedgerSaving(true);
    try {
      const res = await PosServices.updateLedgerSettings(
        {
          business: selectedBusiness,
          postingEnabled: ledger.postingEnabled,
          cashAccount: ledger.cashAccount || null,
          cardAccount: ledger.cardAccount || null,
        },
        headers
      );
      if (res.data?.success) {
        notifySuccess("POS accounting settings saved");
        fetchLedgerSettings();
      }
    } catch (err) {
      notifyError(
        err?.response?.data?.message || "Failed to save POS accounting settings"
      );
    } finally {
      setLedgerSaving(false);
    }
  };

  // ── Single table CRUD ────────────────────────────────────────
  const handleOpenCreate = () => {
    if (!canAdd) {
      notifyError("You do not have permission to add POS tables.");
      return;
    }
    setEditingTable({});
    setFormData({ ...emptyTable });
  };

  const handleOpenEdit = (table) => {
    if (!canUpdate) {
      notifyError("You do not have permission to edit POS tables.");
      return;
    }
    setEditingTable(table);
    setFormData({
      tableNumber: table.tableNumber,
      label: table.label || "",
      capacity: table.capacity || 4,
      shape: table.shape || "rectangle",
      floor: table.floor || "Main",
      sortOrder: table.sortOrder || 0,
    });
  };

  const handleFormChange = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleSaveTable = async () => {
    if ((editingTable?._id && !canUpdate) || (!editingTable?._id && !canAdd)) {
      notifyError(
        editingTable?._id
          ? "You do not have permission to update POS tables."
          : "You do not have permission to add POS tables.",
      );
      return;
    }
    if (!formData.tableNumber?.trim()) {
      notifyError("Table number is required");
      return;
    }
    if (formData.capacity < 1) {
      notifyError("Capacity must be at least 1");
      return;
    }
    setSaving(true);
    try {
      if (editingTable._id) {
        // Update
        const res = await PosServices.updateTable(
          editingTable._id,
          formData,
          headers
        );
        if (res.data?.success) {
          notifySuccess("Table updated");
        }
      } else {
        // Create
        const res = await PosServices.createTable(
          { ...formData, business: selectedBusiness },
          headers
        );
        if (res.data?.success) {
          notifySuccess("Table created");
        }
      }
      setEditingTable(null);
      fetchTables();
    } catch (err) {
      notifyError(
        err?.response?.data?.message || "Failed to save table"
      );
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteTable = async (tableId) => {
    if (!canDelete) {
      notifyError("You do not have permission to delete POS tables.");
      return;
    }
    try {
      const res = await PosServices.deleteTable(tableId, headers);
      if (res.data?.success) {
        notifySuccess("Table deleted");
        setDeleteConfirm(null);
        fetchTables();
      }
    } catch (err) {
      notifyError(
        err?.response?.data?.message || "Failed to delete table"
      );
    }
  };

  // ── Bulk create ──────────────────────────────────────────────
  const handleBulkCreate = async () => {
    if (!canAdd) {
      notifyError("You do not have permission to add POS tables.");
      return;
    }
    if (bulkData.count < 1 || bulkData.count > 100) {
      notifyError("Count must be between 1 and 100");
      return;
    }
    if (!bulkData.prefix?.trim()) {
      notifyError("Prefix is required");
      return;
    }
    setSaving(true);
    try {
      const res = await PosServices.bulkCreateTables(
        { ...bulkData, business: selectedBusiness },
        headers
      );
      if (res.data?.success) {
        notifySuccess(res.data.message || "Tables created");
        setShowBulk(false);
        fetchTables();
      }
    } catch (err) {
      notifyError(
        err?.response?.data?.message || "Failed to bulk create tables"
      );
    } finally {
      setSaving(false);
    }
  };

  const handleSeedTables = async () => {
    if (!canAdd) {
      notifyError("You do not have permission to add POS tables.");
      return;
    }
    if (!selectedBusiness) {
      notifyError("Please select a business first");
      return;
    }

    const shouldSeed =
      tables.length === 0 ||
      window.confirm(
        `This will add 12 default tables (T${nextSeedStart} to T${nextSeedStart + 11}) for this business. Continue?`
      );

    if (!shouldSeed) return;

    setSaving(true);
    try {
      const res = await PosServices.bulkCreateTables(
        {
          business: selectedBusiness,
          count: 12,
          floor: "Main",
          prefix: "T",
          startNumber: nextSeedStart,
        },
        headers
      );

      if (res.data?.success) {
        const affected = Array.isArray(res.data.data) ? res.data.data : [];
        if (affected.length === 0) {
          notifyError(res.data.message || "No tables were seeded");
          return;
        }

        // Apply default labels to a few seeded tables for a ready-to-use layout.
        const labelRequests = SEED_LABELS.map(({ index, label }) => {
          const tableNumber = `T${nextSeedStart + index}`;
          const target = affected.find(
            (t) => String(t.tableNumber) === tableNumber
          );
          if (!target?._id) return null;
          return PosServices.updateTable(
            target._id,
            { label },
            headers
          );
        }).filter(Boolean);

        if (labelRequests.length > 0) {
          await Promise.allSettled(labelRequests);
        }

        notifySuccess(res.data.message || "Seed tables created with default labels");
        fetchTables();
      }
    } catch (err) {
      notifyError(err?.response?.data?.message || "Failed to seed tables");
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteAllTables = async () => {
    if (!canDelete) {
      notifyError("You do not have permission to delete POS tables.");
      return;
    }
    if (!selectedBusiness) {
      notifyError("Please select a business first");
      return;
    }

    if (tables.length === 0) {
      notifyError("No tables available to delete");
      return;
    }

    const occupiedCount = tables.filter((t) => t.status === "occupied").length;
    const targetTables = tables.filter((t) => t.status !== "occupied");

    if (targetTables.length === 0) {
      notifyError("No deletable tables found. Occupied tables cannot be deleted.");
      return;
    }

    setDeletingAll(true);
    try {
      const results = await Promise.allSettled(
        targetTables.map((t) => PosServices.deleteTable(t._id, headers))
      );

      const successCount = results.filter((r) => r.status === "fulfilled").length;
      const failCount = targetTables.length - successCount;

      if (successCount > 0) {
        notifySuccess(
          occupiedCount > 0 || failCount > 0
            ? `Deleted ${successCount} table(s). Skipped: ${occupiedCount + failCount}`
            : "All tables deleted"
        );
      } else {
        notifyError("Unable to delete tables");
      }

      fetchTables();
    } catch (err) {
      notifyError(err?.response?.data?.message || "Failed to delete all tables");
    } finally {
      setDeletingAll(false);
      setShowDeleteAllConfirm(false);
    }
  };

  const deleteAllSummary = useMemo(() => {
    const occupiedCount = tables.filter((t) => t.status === "occupied").length;
    const deletableCount = tables.filter((t) => t.status !== "occupied").length;
    return { occupiedCount, deletableCount };
  }, [tables]);

  const handleSaveCharges = async () => {
    if (!canUpdate) {
      notifyError("You do not have permission to update POS settings.");
      return;
    }
    if (!selectedBusiness) return;
    const serviceChargeValue = Math.max(0, Number(charges.serviceChargeValue) || 0);
    setChargesSaving(true);
    try {
      const res = await PosServices.updateChargeSettings(
        {
          business: selectedBusiness,
          serviceChargeEnabled: !!charges.serviceChargeEnabled,
          serviceChargeType: charges.serviceChargeType === "fixed" ? "fixed" : "percentage",
          serviceChargeValue,
          serviceChargeDineInOnly: charges.serviceChargeDineInOnly !== false,
        },
        headers,
      );
      if (res.data?.success) {
        notifySuccess("POS charges updated");
        if (res.data?.data) {
          const d = res.data.data;
          setCharges({
            serviceChargeEnabled: !!d.serviceChargeEnabled,
            serviceChargeType: d.serviceChargeType === "fixed" ? "fixed" : "percentage",
            serviceChargeValue: Number(
              d.serviceChargeValue !== undefined ? d.serviceChargeValue : d.serviceChargeRate || 0,
            ),
            serviceChargeDineInOnly: d.serviceChargeDineInOnly !== false,
          });
        }
      } else {
        notifyError(res.data?.message || "Failed to save POS charges");
      }
    } catch (err) {
      notifyError(err?.response?.data?.message || "Failed to save POS charges");
    } finally {
      setChargesSaving(false);
    }
  };

  // ── Group tables by floor ────────────────────────────────────
  const tablesByFloor = useMemo(() => {
    const grouped = {};
    tables.forEach((t) => {
      const floor = t.floor || "Main";
      if (!grouped[floor]) grouped[floor] = [];
      grouped[floor].push(t);
    });
    return grouped;
  }, [tables]);

  // ── No business guard ────────────────────────────────────────
  if (!adminInfo) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-50">
        <div className="text-center">
          <AlertCircle size={40} className="mx-auto text-gray-400 mb-3" />
          <p className="text-sm text-gray-600">Please log in to access POS Settings</p>
        </div>
      </div>
    );
  }

  if (businesses.length === 0) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-50">
        <div className="text-center">
          <AlertCircle size={40} className="mx-auto text-gray-400 mb-3" />
          <p className="text-sm text-gray-600">No business found on your account.</p>
          <p className="text-xs text-gray-400 mt-1">
            Create a business first in Settings &gt; Business.
          </p>
        </div>
      </div>
    );
  }

  return (
    <AppLayout>
      <Header title="POS Settings" />
      <div className="min-h-screen bg-gray-50 max-h-[90vh] overflow-y-auto pb-[120px]">
      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => history.push(`/Settings?selectedOrg=${selectedBusiness || ""}`)}
                className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
              >
                <ArrowLeft size={18} />
              </button>
              <div>
                <h1 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                  <Settings size={20} className="text-[var(--p-blue)]" />
                  POS Settings
                </h1>
                <p className="text-xs text-gray-400 mt-0.5">
                  Manage tables, floors, and POS configuration
                </p>
              </div>
            </div>
          </div>
          <div className="mt-2">
            <SettingsOrgBanner />
          </div>

          {/* Tabs */}
          <div className="flex gap-1 mt-4">
            {[
              { key: "tables", label: "Tables & Floors", icon: LayoutGrid },
              { key: "kitchen", label: "Kitchen Sections", icon: ChefHat },
              { key: "accounting", label: "Accounting", icon: Landmark },
              { key: "general", label: "General", icon: Settings },
            ].map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => setActiveTab(tab.key)}
                  className={`flex items-center gap-1.5 px-4 py-2 text-xs font-medium rounded-t-lg transition-colors ${
                    activeTab === tab.key
                      ? "bg-white text-[var(--p-blue)] border border-gray-200 border-b-white -mb-[1px]"
                      : "text-gray-500 hover:text-gray-700"
                  }`}
                >
                  <Icon size={14} />
                  {tab.label}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-6 py-6">
        {activeTab === "tables" && (
          <div className="space-y-4">
            {/* Action bar */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-semibold text-gray-800">
                  All Tables ({tables.length})
                </h2>
                <button
                  type="button"
                  onClick={fetchTables}
                  className="p-1 text-gray-400 hover:text-gray-600 transition-colors"
                  title="Refresh"
                >
                  <RefreshCw
                    size={13}
                    className={loading ? "animate-spin" : ""}
                  />
                </button>
              </div>
              <div className="flex items-center gap-2">
                {canDelete && (
                <button
                  type="button"
                  onClick={() => setShowDeleteAllConfirm(true)}
                  disabled={deletingAll || saving || !selectedBusiness || tables.length === 0}
                  className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-red-600 bg-white border border-red-200 rounded-xl hover:bg-red-50 transition-colors disabled:opacity-50"
                >
                  <Trash2 size={13} />
                  {deletingAll ? "Deleting..." : "Delete All"}
                </button>
                )}
                {canAdd && (
                <>
                <button
                  type="button"
                  onClick={handleSeedTables}
                  disabled={saving || !selectedBusiness}
                  className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-gray-600 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors disabled:opacity-50"
                >
                  <Layers size={13} />
                  Seed Tables
                </button>
                <button
                  type="button"
                  onClick={() => setShowBulk(true)}
                  className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-gray-600 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors"
                >
                  <Upload size={13} />
                  Bulk Create
                </button>
                <button
                  type="button"
                  onClick={handleOpenCreate}
                  className="flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-white bg-[var(--p-blue)] rounded-xl hover:opacity-90 transition-colors"
                >
                  <Plus size={13} />
                  Add Table
                </button>
                </>
                )}
              </div>
            </div>

            {/* Table list grouped by floor */}
            {loading && tables.length === 0 ? (
              <div className="flex items-center justify-center py-20">
                <div className="w-6 h-6 border-2 border-gray-300 border-t-[var(--p-blue)] rounded-full animate-spin" />
              </div>
            ) : tables.length === 0 ? (
              <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
                <LayoutGrid size={40} className="mx-auto text-gray-300 mb-3" />
                <h3 className="text-sm font-semibold text-gray-700 mb-1">
                  No tables yet
                </h3>
                <p className="text-xs text-gray-400 mb-4">
                  Create tables to get started with your POS terminal.
                </p>
                {canAdd && (
                <div className="flex items-center justify-center gap-2">
                  <button
                    type="button"
                    onClick={handleSeedTables}
                    disabled={saving || !selectedBusiness}
                    className="flex items-center gap-1.5 px-4 py-2 text-xs font-medium text-gray-600 bg-gray-50 border border-gray-200 rounded-xl hover:bg-gray-100 transition-colors disabled:opacity-50"
                  >
                    <Layers size={13} />
                    Seed 12 Default Tables
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowBulk(true)}
                    className="flex items-center gap-1.5 px-4 py-2 text-xs font-medium text-gray-600 bg-gray-50 border border-gray-200 rounded-xl hover:bg-gray-100 transition-colors"
                  >
                    <Upload size={13} />
                    Quick Setup (Bulk Create)
                  </button>
                  <button
                    type="button"
                    onClick={handleOpenCreate}
                    className="flex items-center gap-1.5 px-4 py-2 text-xs font-medium text-white bg-[var(--p-blue)] rounded-xl hover:opacity-90 transition-colors"
                  >
                    <Plus size={13} />
                    Add Single Table
                  </button>
                </div>
                )}
              </div>
            ) : (
              Object.entries(tablesByFloor).map(([floor, floorTables]) => (
                <div key={floor} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                  {/* Floor header */}
                  <div className="flex items-center gap-2 px-4 py-2.5 bg-gray-50 border-b border-gray-200">
                    <Layers size={14} className="text-gray-400" />
                    <span className="text-xs font-semibold text-gray-700">
                      {floor}
                    </span>
                    <span className="text-[10px] text-gray-400">
                      ({floorTables.length} tables)
                    </span>
                  </div>

                  {/* Table rows */}
                  <div className="divide-y divide-gray-100">
                    {floorTables.map((table) => (
                      <div
                        key={table._id}
                        className="flex items-center justify-between px-4 py-3 hover:bg-gray-50/50 transition-colors"
                      >
                        <div className="flex items-center gap-4">
                          {/* Table number */}
                          <div className="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center">
                            <span className="text-xs font-bold text-gray-600">
                              {table.tableNumber}
                            </span>
                          </div>
                          <div>
                            <p className="text-xs font-medium text-gray-800">
                              {table.label || `Table ${table.tableNumber}`}
                            </p>
                            <p className="text-[10px] text-gray-400 mt-0.5">
                              Capacity: {table.capacity} &bull;{" "}
                              {table.shape}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          {/* Status badge */}
                          <span
                            className={`px-2 py-0.5 text-[10px] font-medium rounded-full border capitalize ${
                              STATUS_COLORS[table.status] || STATUS_COLORS.available
                            }`}
                          >
                            {table.status}
                          </span>
                          {/* Actions */}
                          {canUpdate && (
                          <button
                            type="button"
                            onClick={() => setQrManagerTable(table)}
                            className={`p-1.5 rounded-lg transition-colors ${
                              table.qrEnabled && table.qrToken
                                ? "text-indigo-600 bg-indigo-50 hover:bg-indigo-100"
                                : "text-gray-400 hover:text-indigo-600 hover:bg-indigo-50"
                            }`}
                            title={
                              table.qrEnabled && table.qrToken
                                ? "QR active - click to manage"
                                : "Generate QR for this table"
                            }
                          >
                            <QrCode size={13} />
                          </button>
                          )}
                          {canUpdate && (
                          <button
                            type="button"
                            onClick={() => handleOpenEdit(table)}
                            className="p-1.5 text-gray-400 hover:text-[var(--p-blue)] hover:bg-[var(--p-blue)]/5 rounded-lg transition-colors"
                            title="Edit"
                          >
                            <Pencil size={13} />
                          </button>
                          )}
                          {canDelete && (
                          <button
                            type="button"
                            onClick={() => setDeleteConfirm(table)}
                            disabled={table.status === "occupied"}
                            className={`p-1.5 rounded-lg transition-colors ${
                              table.status === "occupied"
                                ? "text-gray-300 cursor-not-allowed"
                                : "text-gray-400 hover:text-red-500 hover:bg-red-50"
                            }`}
                            title={
                              table.status === "occupied"
                                ? "Cannot delete occupied table"
                                : "Delete"
                            }
                          >
                            <Trash2 size={13} />
                          </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {activeTab === "kitchen" && (
          <div className="bg-white rounded-xl border border-gray-200 p-4 sm:p-6">
            <div className="mb-4">
              <h3 className="text-sm font-semibold text-gray-800 flex items-center gap-2">
                <ChefHat size={16} className="text-amber-500" />
                Kitchen Sections
              </h3>
              <p className="text-xs text-gray-500 mt-1">
                Configure kitchen stations (e.g. Drinks, Grill, Bar) and route
                each menu item to the correct section. During checkout, POS and
                QR orders will be split and sent to the kitchen accordingly.
              </p>
            </div>
            <KitchenSectionsPanel
              businessId={selectedBusiness}
              headers={headers}
              canAdd={canAdd}
              canUpdate={canUpdate}
              canDelete={canDelete}
            />
          </div>
        )}

        {activeTab === "accounting" && (
          <div className="bg-white rounded-xl border border-gray-200 p-6 max-w-3xl">
            <div className="flex items-start justify-between gap-3 mb-1">
              <h3 className="text-sm font-semibold text-gray-800">
                POS Accounting &amp; Bank Reconciliation
              </h3>
              {canUpdate && (
                <button
                  type="button"
                  onClick={handleSaveLedger}
                  disabled={ledgerLoading || ledgerSaving}
                  className="h-8 px-3 text-[11px] font-semibold rounded-lg bg-[var(--p-blue)] text-white hover:opacity-90 disabled:opacity-50"
                >
                  {ledgerSaving ? "Saving..." : "Save"}
                </button>
              )}
            </div>
            <p className="text-[11px] text-gray-500 mb-5 max-w-prose">
              Send POS takings to the accounting ledger so they can be reconciled
              against your bank statement. Card and online payments go straight to
              the bank account below <strong>unless</strong> the payment method is
              set to settle through a clearing account (see Payment Methods) — those
              post to their clearing account and are banked later via a settlement.
              Cash goes to a holding account — it stays there until you record a
              deposit, which moves it to the bank as one line that matches your
              deposit slip.
            </p>

            {bankAccounts.length === 0 ? (
              <div className="p-4 rounded-xl border border-amber-200 bg-amber-50/50 text-xs text-amber-800">
                This business has no bank accounts yet. Add them under{" "}
                <strong>Treasury &amp; Finance &gt; Banking Accounts</strong>{" "}
                first, then choose the cash and card accounts here.
              </div>
            ) : (
              <div className="space-y-4">
                <label className="flex items-center gap-2.5 p-3 rounded-lg border border-gray-200 bg-gray-50/60 cursor-pointer">
                  <input
                    type="checkbox"
                    disabled={!canUpdate}
                    checked={ledger.postingEnabled}
                    onChange={(e) =>
                      setLedger((p) => ({ ...p, postingEnabled: e.target.checked }))
                    }
                    className="w-4 h-4 accent-[var(--p-blue)]"
                  />
                  <span className="text-xs font-semibold text-gray-700">
                    Post POS sales to the accounting ledger
                  </span>
                </label>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">
                      Cash account
                    </label>
                    <select
                      disabled={!canUpdate}
                      value={ledger.cashAccount}
                      onChange={(e) =>
                        setLedger((p) => ({ ...p, cashAccount: e.target.value }))
                      }
                      className="w-full h-9 px-2.5 text-xs border border-gray-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-[rgba(var(--p-blue-rgb),0.3)]"
                    >
                      <option value="">Select a holding account…</option>
                      {bankAccounts.map((a) => (
                        <option key={a._id} value={a._id}>
                          {a.accountName}
                          {a.currencyType ? ` (${a.currencyType})` : ""}
                        </option>
                      ))}
                    </select>
                    <p className="text-[11px] text-gray-400 mt-1">
                      Where till cash is held until banked. A "Cash in Hand" or
                      "Undeposited Funds" account is ideal.
                    </p>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-gray-700 mb-1">
                      Card / online account
                    </label>
                    <select
                      disabled={!canUpdate}
                      value={ledger.cardAccount}
                      onChange={(e) =>
                        setLedger((p) => ({ ...p, cardAccount: e.target.value }))
                      }
                      className="w-full h-9 px-2.5 text-xs border border-gray-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-[rgba(var(--p-blue-rgb),0.3)]"
                    >
                      <option value="">Select a bank account…</option>
                      {bankAccounts.map((a) => (
                        <option key={a._id} value={a._id}>
                          {a.accountName}
                          {a.currencyType ? ` (${a.currencyType})` : ""}
                        </option>
                      ))}
                    </select>
                    <p className="text-[11px] text-gray-400 mt-1">
                      The bank account card and online payments settle into,
                      unless the method settles through clearing (below).
                    </p>
                  </div>
                </div>

                {clearingMethods.length > 0 && (
                  <div className="p-3 rounded-lg border border-[rgba(var(--p-blue-rgb),0.25)] bg-[rgba(var(--p-blue-rgb),0.05)]">
                    <p className="text-[11px] font-semibold text-gray-700 mb-1.5">
                      Settles through a clearing account (bypasses the card/online
                      account above)
                    </p>
                    <ul className="space-y-1">
                      {clearingMethods.map((m) => {
                        const acct = bankAccounts.find(
                          (a) => a._id === m.clearingAccount
                        );
                        return (
                          <li
                            key={m._id}
                            className="text-[11px] text-gray-600 flex flex-wrap items-center gap-x-1.5"
                          >
                            <span className="font-medium text-gray-800">{m.name}</span>
                            <span className="text-gray-400">→</span>
                            <span>{acct ? acct.accountName : "a clearing account"}</span>
                            {m.feePercent ? (
                              <span className="text-gray-400">· fee {m.feePercent}%</span>
                            ) : null}
                          </li>
                        );
                      })}
                    </ul>
                    <p className="text-[10px] text-gray-400 mt-1.5">
                      Change these under <strong>Settings › Payment Methods</strong>.
                      Everything else settles into the card/online account above.
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {activeTab === "general" && (
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h3 className="text-sm font-semibold text-gray-800 mb-4">
              General POS Settings
            </h3>
            <div className="space-y-4 text-xs text-gray-500">
              <div className="p-4 rounded-xl border border-amber-200 bg-amber-50/40">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <h4 className="text-sm font-semibold text-gray-800">
                      Service Charge
                    </h4>
                    <p className="text-[11px] text-gray-500 mt-1">
                      Tax is configured per item under{" "}
                      <strong>Catalog &gt; Products &gt; Sales Information</strong>.
                      Service charge is applied at the outlet level here.
                    </p>
                  </div>
                  {canUpdate && (
                  <button
                    type="button"
                    onClick={handleSaveCharges}
                    disabled={chargesLoading || chargesSaving}
                    className="h-8 px-3 text-[11px] font-semibold rounded-lg bg-amber-500 text-white hover:opacity-90 disabled:opacity-50"
                  >
                    {chargesSaving ? "Saving..." : "Save"}
                  </button>
                  )}
                </div>

                <div className="mt-3 space-y-3">
                  {/* Service Charge Section */}
                  <div className="p-3 rounded-lg border border-gray-200 bg-white">
                    <label className="flex items-center gap-2 text-xs font-semibold text-gray-700 mb-2">
                      <input
                        type="checkbox"
                        disabled={!canUpdate}
                        checked={!!charges.serviceChargeEnabled}
                        onChange={(e) =>
                          setCharges((prev) => ({
                            ...prev,
                            serviceChargeEnabled: e.target.checked,
                            ...(!e.target.checked ? { serviceChargeValue: 0 } : {}),
                          }))
                        }
                      />
                      Enable Service Charge
                    </label>
                    <div className="flex items-center gap-2">
                      <select
                        value={charges.serviceChargeType}
                        onChange={(e) =>
                          setCharges((prev) => ({
                            ...prev,
                            serviceChargeType: e.target.value === "fixed" ? "fixed" : "percentage",
                          }))
                        }
                        disabled={!canUpdate || !charges.serviceChargeEnabled}
                        className="h-8 px-2 text-xs bg-gray-50 rounded-lg border border-gray-200 focus:border-[var(--p-blue)] focus:outline-none disabled:opacity-60"
                      >
                        <option value="percentage">%</option>
                        <option value="fixed">RM</option>
                      </select>
                      <input
                        type="number"
                        min={0}
                        step="0.01"
                        value={charges.serviceChargeValue}
                        onChange={(e) =>
                          setCharges((prev) => ({
                            ...prev,
                            serviceChargeValue: e.target.value,
                          }))
                        }
                        disabled={!canUpdate || !charges.serviceChargeEnabled}
                        className="h-8 w-24 px-2 text-xs bg-gray-50 rounded-lg border border-gray-200 focus:border-[var(--p-blue)] focus:outline-none disabled:opacity-60"
                      />
                      <span className="text-xs text-gray-500">
                        {charges.serviceChargeType === "fixed" ? "RM / order" : "% of subtotal"}
                      </span>
                    </div>
                    <label className="flex items-center gap-2 text-[11px] text-gray-500 mt-2 cursor-pointer">
                      <input
                        type="checkbox"
                        disabled={!canUpdate || !charges.serviceChargeEnabled}
                        checked={charges.serviceChargeDineInOnly !== false}
                        onChange={(e) =>
                          setCharges((prev) => ({
                            ...prev,
                            serviceChargeDineInOnly: e.target.checked,
                          }))
                        }
                      />
                      Apply to dine-in orders only (excludes walk-in &amp; takeaway)
                    </label>
                  </div>
                </div>
              </div>

              {/* Receipt Appearance */}
              <div className="p-4 rounded-xl border border-blue-200 bg-blue-50/40">
                <h4 className="text-sm font-semibold text-gray-800 mb-1">Receipt Appearance</h4>
                <p className="text-[11px] text-gray-500 mb-3">
                  Control what appears on printed and downloaded POS receipts.
                </p>
                <div className="p-3 rounded-lg border border-gray-200 bg-white flex items-center justify-between gap-3">
                  <div>
                    <p className="text-xs font-semibold text-gray-700">Show Business Logo</p>
                    <p className="text-[11px] text-gray-400 mt-0.5">
                      Display the business logo at the top of receipts. Disable to save paper or for text-only terminals.
                    </p>
                  </div>
                  {canUpdate && (
                  <button
                    type="button"
                    role="switch"
                    aria-checked={showLogoInReceipt}
                    onClick={() => {
                      const next = !showLogoInReceipt;
                      setShowLogoInReceipt(next);
                      localStorage.setItem("pos.receipt.showLogo", String(next));
                      notifySuccess(next ? "Logo enabled on receipts" : "Logo disabled on receipts");
                    }}
                    className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none ${
                      showLogoInReceipt ? "bg-[var(--p-blue)]" : "bg-gray-200"
                    }`}
                  >
                    <span
                      className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                        showLogoInReceipt ? "translate-x-5" : "translate-x-0"
                      }`}
                    />
                  </button>
                  )}
                </div>
              </div>

              <div className="p-4 bg-blue-50 rounded-lg border border-blue-100">
                <p className="font-medium text-blue-700 mb-1">
                  POS Setup Checklist
                </p>
                <ul className="space-y-1.5 text-blue-600">
                  <li className="flex items-center gap-2">
                    <span className={tables.length > 0 ? "text-emerald-500" : "text-gray-400"}>
                      {tables.length > 0 ? "✓" : "○"}
                    </span>
                    Create tables ({tables.length} configured)
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="text-gray-400">○</span>
                    Add items with selling prices in Catalog &gt; Products
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="text-gray-400">○</span>
                    Configure document numbering for &quot;pos_order&quot; and
                    &quot;sales_order&quot; in Settings &gt; Document Numbering
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="text-gray-400">○</span>
                    Add categories in Catalog &gt; Categories
                  </li>
                </ul>
              </div>
              <p className="text-gray-400 italic">
                More settings (default tax rate, receipt header/footer, etc.)
                will be added here in future updates.
              </p>
            </div>
          </div>
        )}
      </div>

      {/* ── Create/Edit Table Modal ─────────────────────────────── */}
      {editingTable !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            onClick={() => setEditingTable(null)}
          />
          <div className="relative w-full max-w-md mx-4 bg-white rounded-2xl shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
              <h3 className="text-sm font-bold text-gray-900">
                {editingTable._id ? "Edit Table" : "Add New Table"}
              </h3>
              <button
                type="button"
                onClick={() => setEditingTable(null)}
                className="p-1 rounded-lg text-gray-400 hover:text-gray-600 transition-colors"
              >
                <X size={16} />
              </button>
            </div>
            <div className="px-5 py-4 space-y-3">
              {/* Table number */}
              <div>
                <label className="text-[11px] font-medium text-gray-600 mb-1 block">
                  Table Number *
                </label>
                <input
                  type="text"
                  value={formData.tableNumber}
                  onChange={(e) =>
                    handleFormChange("tableNumber", e.target.value)
                  }
                  placeholder="e.g. T1, A1, 101"
                  maxLength={20}
                  className="w-full h-[38px] px-3 text-sm bg-gray-50 rounded-xl border border-gray-200 focus:border-[var(--p-blue)] focus:ring-1 focus:ring-[var(--p-blue)] focus:outline-none"
                />
              </div>
              {/* Label */}
              <div>
                <label className="text-[11px] font-medium text-gray-600 mb-1 block">
                  Label (optional)
                </label>
                <input
                  type="text"
                  value={formData.label}
                  onChange={(e) => handleFormChange("label", e.target.value)}
                  placeholder="e.g. Window Seat, VIP Booth"
                  maxLength={50}
                  className="w-full h-[38px] px-3 text-sm bg-gray-50 rounded-xl border border-gray-200 focus:border-[var(--p-blue)] focus:ring-1 focus:ring-[var(--p-blue)] focus:outline-none"
                />
              </div>
              {/* Floor + Capacity */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-medium text-gray-600 mb-1 block">
                    Floor
                  </label>
                  <input
                    type="text"
                    value={formData.floor}
                    onChange={(e) => handleFormChange("floor", e.target.value)}
                    placeholder="Main"
                    list="floor-list"
                    className="w-full h-[38px] px-3 text-sm bg-gray-50 rounded-xl border border-gray-200 focus:border-[var(--p-blue)] focus:ring-1 focus:ring-[var(--p-blue)] focus:outline-none"
                  />
                  <datalist id="floor-list">
                    {floors.map((f) => (
                      <option key={f} value={f} />
                    ))}
                  </datalist>
                </div>
                <div>
                  <label className="text-[11px] font-medium text-gray-600 mb-1 block">
                    Capacity
                  </label>
                  <input
                    type="number"
                    value={formData.capacity}
                    onChange={(e) =>
                      handleFormChange("capacity", Number(e.target.value))
                    }
                    min={1}
                    max={50}
                    className="w-full h-[38px] px-3 text-sm bg-gray-50 rounded-xl border border-gray-200 focus:border-[var(--p-blue)] focus:ring-1 focus:ring-[var(--p-blue)] focus:outline-none"
                  />
                </div>
              </div>
              {/* Shape + Sort Order */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-medium text-gray-600 mb-1 block">
                    Shape
                  </label>
                  <select
                    value={formData.shape}
                    onChange={(e) => handleFormChange("shape", e.target.value)}
                    className="w-full h-[38px] px-3 text-sm bg-gray-50 rounded-xl border border-gray-200 focus:border-[var(--p-blue)] focus:outline-none"
                  >
                    {SHAPES.map((s) => (
                      <option key={s.value} value={s.value}>
                        {s.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-[11px] font-medium text-gray-600 mb-1 block">
                    Sort Order
                  </label>
                  <input
                    type="number"
                    value={formData.sortOrder}
                    onChange={(e) =>
                      handleFormChange("sortOrder", Number(e.target.value))
                    }
                    min={0}
                    className="w-full h-[38px] px-3 text-sm bg-gray-50 rounded-xl border border-gray-200 focus:border-[var(--p-blue)] focus:ring-1 focus:ring-[var(--p-blue)] focus:outline-none"
                  />
                </div>
              </div>
            </div>
            <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-gray-100 bg-gray-50/50">
              <button
                type="button"
                onClick={() => setEditingTable(null)}
                className="px-4 py-2 text-xs font-medium text-gray-600 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              {(editingTable._id ? canUpdate : canAdd) && (
              <button
                type="button"
                onClick={handleSaveTable}
                disabled={saving}
                className="flex items-center gap-1.5 px-4 py-2 text-xs font-medium text-white bg-[var(--p-blue)] rounded-xl hover:opacity-90 transition-colors disabled:opacity-50"
              >
                <Save size={13} />
                {saving ? "Saving..." : editingTable._id ? "Update" : "Create"}
              </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Bulk Create Modal ───────────────────────────────────── */}
      {showBulk && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            onClick={() => setShowBulk(false)}
          />
          <div className="relative w-full max-w-sm mx-4 bg-white rounded-2xl shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
              <h3 className="text-sm font-bold text-gray-900">
                Bulk Create Tables
              </h3>
              <button
                type="button"
                onClick={() => setShowBulk(false)}
                className="p-1 rounded-lg text-gray-400 hover:text-gray-600 transition-colors"
              >
                <X size={16} />
              </button>
            </div>
            <div className="px-5 py-4 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-medium text-gray-600 mb-1 block">
                    Number of Tables *
                  </label>
                  <input
                    type="number"
                    value={bulkData.count}
                    onChange={(e) =>
                      setBulkData((p) => ({
                        ...p,
                        count: Number(e.target.value),
                      }))
                    }
                    min={1}
                    max={100}
                    className="w-full h-[38px] px-3 text-sm bg-gray-50 rounded-xl border border-gray-200 focus:border-[var(--p-blue)] focus:outline-none"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-medium text-gray-600 mb-1 block">
                    Floor
                  </label>
                  <input
                    type="text"
                    value={bulkData.floor}
                    onChange={(e) =>
                      setBulkData((p) => ({ ...p, floor: e.target.value }))
                    }
                    placeholder="Main"
                    className="w-full h-[38px] px-3 text-sm bg-gray-50 rounded-xl border border-gray-200 focus:border-[var(--p-blue)] focus:outline-none"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-medium text-gray-600 mb-1 block">
                    Prefix
                  </label>
                  <input
                    type="text"
                    value={bulkData.prefix}
                    onChange={(e) =>
                      setBulkData((p) => ({ ...p, prefix: e.target.value }))
                    }
                    placeholder="T"
                    maxLength={5}
                    className="w-full h-[38px] px-3 text-sm bg-gray-50 rounded-xl border border-gray-200 focus:border-[var(--p-blue)] focus:outline-none"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-medium text-gray-600 mb-1 block">
                    Start Number
                  </label>
                  <input
                    type="number"
                    value={bulkData.startNumber}
                    onChange={(e) =>
                      setBulkData((p) => ({
                        ...p,
                        startNumber: Number(e.target.value),
                      }))
                    }
                    min={1}
                    className="w-full h-[38px] px-3 text-sm bg-gray-50 rounded-xl border border-gray-200 focus:border-[var(--p-blue)] focus:outline-none"
                  />
                </div>
              </div>
              {/* Preview */}
              <div className="p-3 bg-gray-50 rounded-lg">
                <p className="text-[10px] text-gray-500 mb-1">Preview:</p>
                <p className="text-xs text-gray-700 font-mono">
                  {bulkData.prefix}
                  {bulkData.startNumber} — {bulkData.prefix}
                  {bulkData.startNumber + bulkData.count - 1}
                </p>
                <p className="text-[10px] text-gray-400 mt-0.5">
                  Floor: {bulkData.floor || "Main"} &bull; {bulkData.count}{" "}
                  tables
                </p>
              </div>
            </div>
            <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-gray-100 bg-gray-50/50">
              <button
                type="button"
                onClick={() => setShowBulk(false)}
                className="px-4 py-2 text-xs font-medium text-gray-600 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              {canAdd && (
              <button
                type="button"
                onClick={handleBulkCreate}
                disabled={saving}
                className="flex items-center gap-1.5 px-4 py-2 text-xs font-medium text-white bg-[var(--p-blue)] rounded-xl hover:opacity-90 transition-colors disabled:opacity-50"
              >
                <Upload size={13} />
                {saving
                  ? "Creating..."
                  : `Create ${bulkData.count} Tables`}
              </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Delete All Confirmation Modal ───────────────────────── */}
      {showDeleteAllConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            onClick={() => setShowDeleteAllConfirm(false)}
          />
          <div className="relative w-full max-w-sm mx-4 bg-white rounded-2xl shadow-2xl overflow-hidden">
            <div className="px-5 py-5 text-center">
              <div className="w-10 h-10 mx-auto mb-3 rounded-full bg-red-50 flex items-center justify-center">
                <Trash2 size={18} className="text-red-500" />
              </div>
              <h3 className="text-sm font-bold text-gray-900 mb-1">
                Delete All Tables?
              </h3>
              <p className="text-xs text-gray-500">
                This will delete {deleteAllSummary.deletableCount} table(s) for this business.
                {deleteAllSummary.occupiedCount > 0
                  ? ` ${deleteAllSummary.occupiedCount} occupied table(s) will be skipped.`
                  : ""}
              </p>
            </div>
            <div className="flex border-t border-gray-100">
              <button
                type="button"
                onClick={() => setShowDeleteAllConfirm(false)}
                className="flex-1 py-3 text-xs font-medium text-gray-600 hover:bg-gray-50 transition-colors border-r border-gray-100"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeleteAllTables}
                disabled={deletingAll}
                className="flex-1 py-3 text-xs font-medium text-red-600 hover:bg-red-50 transition-colors disabled:opacity-50"
              >
                {deletingAll ? "Deleting..." : "Delete All"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Delete Confirmation Modal ───────────────────────────── */}
      {deleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            onClick={() => setDeleteConfirm(null)}
          />
          <div className="relative w-full max-w-xs mx-4 bg-white rounded-2xl shadow-2xl overflow-hidden">
            <div className="px-5 py-5 text-center">
              <div className="w-10 h-10 mx-auto mb-3 rounded-full bg-red-50 flex items-center justify-center">
                <Trash2 size={18} className="text-red-500" />
              </div>
              <h3 className="text-sm font-bold text-gray-900 mb-1">
                Delete Table {deleteConfirm.tableNumber}?
              </h3>
              <p className="text-xs text-gray-500">
                This action cannot be undone. The table will be removed from the
                POS terminal.
              </p>
            </div>
            <div className="flex border-t border-gray-100">
              <button
                type="button"
                onClick={() => setDeleteConfirm(null)}
                className="flex-1 py-3 text-xs font-medium text-gray-600 hover:bg-gray-50 transition-colors border-r border-gray-100"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => handleDeleteTable(deleteConfirm._id)}
                className="flex-1 py-3 text-xs font-medium text-red-600 hover:bg-red-50 transition-colors"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
      </div>

      {/* QR Manager Modal */}
      <TableQrManagerModal
        open={!!qrManagerTable}
        table={qrManagerTable}
        headers={headers}
        businessName={
          (businesses.find((b) => b._id === selectedBusiness) || {}).name || ""
        }
        onClose={() => setQrManagerTable(null)}
        onChanged={(data) => {
          setTables((prev) =>
            prev.map((t) =>
              t._id === (data?._id || data?.tableId)
                ? { ...t, ...data }
                : t
            )
          );
          setQrManagerTable((prev) => (prev ? { ...prev, ...data } : prev));
        }}
      />
    </AppLayout>
  );
};

export default PosSettings;
