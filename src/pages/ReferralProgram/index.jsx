import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import AsyncSelect from "react-select/async";
import referralProgramService from "@/services/referralProgramService";
import VendorServices from "@/services/VendorServices";
import CustomerServices from "@/services/CustomerServices";
import reactSelectConfig from "@/utils/react-select-style-config";
import { notifyError, notifySuccess } from "@/utils/toast";
import {
  CustomModal,
  DataTable,
  FormInput,
  Page,
  PageHeader,
  SummaryCards,
} from "@/page-layouts/index";
import { ACTION_BUTTON_TYPES } from "@/utils/constants";
import ActionButtons from "@/page-layouts/components/ActionButtons";
import SummarySvg from "@/assets/img/summary.svg";
import CompletedSvg from "@/assets/img/completed.svg";
import PendingApprovalSvg from "@/assets/img/pending-approval.svg";

const REFERRER_TYPES = [
  { value: "system", label: "System" },
  { value: "rider", label: "Rider" },
  { value: "vendor", label: "Vendor" },
  { value: "customer", label: "Customer" },
  { value: "other", label: "Other" },
];

const CREATE_REFERRER_TYPES = REFERRER_TYPES.filter((t) => t.value !== "rider");

const typeFilterOptions = [{ value: "all", label: "All types" }, ...REFERRER_TYPES];

const formatVendorLabel = (v) => {
  if (!v) return "";
  const d = v.basicInformation || {};
  const name =
    d.vendorDisplayName ||
    d.companyName ||
    [d.primaryContact?.firstName, d.primaryContact?.lastName].filter(Boolean).join(" ").trim() ||
    "";
  const email = d.vendorEmail || "";
  const bits = [name, email].filter(Boolean);
  return bits.length ? bits.join(" · ") : String(v._id);
};

const formatCustomerLabel = (c) => {
  if (!c) return "";
  const d = c.basicInformation || {};
  const name = d.customerDisplayName || d.companyName || "";
  const email = d.customerEmail || "";
  const bits = [name, email].filter(Boolean);
  return bits.length ? bits.join(" · ") : String(c._id);
};

/** AsyncSelect loads options from the server — disable built-in filtering so results are not hidden. */
const asyncFilterNone = () => true;

/** API returns `{ success, data: { items, pagination } }`; tolerate other shapes. */
const extractReferrerListPayload = (res) => {
  if (!res || typeof res !== "object") {
    return { items: [], pagination: undefined };
  }
  const inner =
    res.data && typeof res.data === "object" && !Array.isArray(res.data) ? res.data : null;
  const items = Array.isArray(inner?.items)
    ? inner.items
    : Array.isArray(res.items)
      ? res.items
      : [];
  const pagination = inner?.pagination ?? res.pagination;
  return { items, pagination };
};

const getReferrerDisplayLabel = (row) => {
  const fromCamel =
    typeof row?.referrerDisplayName === "string" ? row.referrerDisplayName.trim() : "";
  const fromSnake =
    typeof row?.referrer_display_name === "string" ? row.referrer_display_name.trim() : "";
  return fromCamel || fromSnake || "";
};

export default function ReferralProgramPage() {
  const [loading, setLoading] = useState(false);
  const [overviewLoading, setOverviewLoading] = useState(true);
  const [overview, setOverview] = useState({
    totalReferrers: 0,
    activeReferrers: 0,
    totalReferralEventsRecorded: 0,
  });
  const [items, setItems] = useState([]);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 20,
    total: 0,
    pages: 1,
  });
  const [typeFilter, setTypeFilter] = useState("all");
  const [searchValue, setSearchValue] = useState("");

  const [modalOpen, setModalOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    referrerType: "vendor",
    referrerId: "",
    code: "",
    label: "",
  });
  const [showCustomCodeField, setShowCustomCodeField] = useState(false);
  /** Selected option for vendor / rider / customer search pickers */
  const [entitySelection, setEntitySelection] = useState(null);
  const searchDebounceRef = useRef(null);

  const [deleteOpen, setDeleteOpen] = useState(false);
  const [pendingDelete, setPendingDelete] = useState(null);

  /** Above react-responsive-modal root (z-index 1000) so portaled menus are visible */
  const asyncSelectStyles = useMemo(
    () => ({
      ...reactSelectConfig,
      menu: (base, state) => ({
        ...(typeof reactSelectConfig.menu === "function"
          ? reactSelectConfig.menu(base, state)
          : base),
        zIndex: 10050,
      }),
      menuPortal: (base) => ({ ...base, zIndex: 10050 }),
    }),
    []
  );

  const fetchOverview = useCallback(async () => {
    try {
      setOverviewLoading(true);
      const res = await referralProgramService.getOverview();
      const d = res?.data || {};
      setOverview({
        totalReferrers: d.totalReferrers ?? 0,
        activeReferrers: d.activeReferrers ?? 0,
        totalReferralEventsRecorded: d.totalReferralEventsRecorded ?? 0,
      });
    } catch (e) {
      notifyError(e?.response?.data?.message || "Failed to load overview");
    } finally {
      setOverviewLoading(false);
    }
  }, []);

  const fetchList = useCallback(async () => {
    try {
      setLoading(true);
      const res = await referralProgramService.listReferrers({
        page: pagination.page,
        limit: pagination.limit,
        referrerType: typeFilter === "all" ? undefined : typeFilter,
        search: searchValue?.trim() || undefined,
      });
      const { items: listItems, pagination: pageMeta } = extractReferrerListPayload(res);
      setItems(Array.isArray(listItems) ? listItems : []);
      if (pageMeta) {
        setPagination((prev) => ({
          ...prev,
          ...pageMeta,
        }));
      }
    } catch (e) {
      notifyError(e?.response?.data?.message || "Failed to load referrers");
    } finally {
      setLoading(false);
    }
  }, [pagination.page, pagination.limit, typeFilter, searchValue]);

  useEffect(() => {
    fetchOverview();
  }, [fetchOverview]);

  useEffect(() => {
    fetchList();
  }, [fetchList]);

  const summaryCardsData = useMemo(
    () => [
      {
        title: "Referrers",
        value: overviewLoading ? "…" : overview.totalReferrers.toLocaleString(),
        backgroundColor: "summary-light",
        iconColor: "summary-dark",
        Icon: SummarySvg,
      },
      {
        title: "Active codes",
        value: overviewLoading ? "…" : overview.activeReferrers.toLocaleString(),
        backgroundColor: "completed-light",
        iconColor: "completed-dark",
        Icon: CompletedSvg,
      },
      {
        title: "Recorded referrals",
        value: overviewLoading
          ? "…"
          : overview.totalReferralEventsRecorded.toLocaleString(),
        backgroundColor: "processing-light",
        iconColor: "processing-dark",
        Icon: PendingApprovalSvg,
      },
    ],
    [overview, overviewLoading]
  );

  const loadVendorOptions = useCallback(
    (inputValue) =>
      new Promise((resolve) => {
        if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
        const q = (inputValue || "").trim();
        if (q.length < 2) {
          resolve([]);
          return;
        }
        searchDebounceRef.current = setTimeout(async () => {
          try {
            const res = await VendorServices.getPaginatedVendors({
              page: 1,
              limit: 25,
              search: q,
              ...(form.referrerType === "rider" ? { riderOnly: "true" } : {}),
            });
            const vendors = res?.vendors || [];
            resolve(
              vendors.map((v) => ({
                value: String(v._id),
                label: formatVendorLabel(v),
              }))
            );
          } catch {
            resolve([]);
          }
        }, 300);
      }),
    [form.referrerType]
  );

  const loadCustomerOptions = useCallback(
    (inputValue) =>
      new Promise((resolve) => {
        if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
        const q = (inputValue || "").trim();
        if (q.length < 2) {
          resolve([]);
          return;
        }
        searchDebounceRef.current = setTimeout(async () => {
          try {
            const res = await CustomerServices.searchCustomers({
              search: q,
              page: 1,
              limit: 40,
            });
            const customers = res?.customers || [];
            resolve(
              customers.map((c) => ({
                value: String(c._id),
                label: formatCustomerLabel(c),
              }))
            );
          } catch {
            resolve([]);
          }
        }, 300);
      }),
    []
  );

  const openCreate = () => {
    setForm({
      referrerType: "vendor",
      referrerId: "",
      code: "",
      label: "",
    });
    setShowCustomCodeField(false);
    setEntitySelection(null);
    setModalOpen(true);
  };

  const handleCreate = async () => {
    const needsEntity =
      form.referrerType === "vendor" ||
      form.referrerType === "customer";
    const refFromPicker = (entitySelection?.value || "").trim();
    const refManual = (form.referrerId || "").trim();
    const resolvedId = needsEntity ? refFromPicker : refManual;

    if (form.referrerType !== "system" && !resolvedId) {
      notifyError(
        needsEntity
          ? "Search and select a record, or switch type if you need to paste an id."
          : "Referrer id is required for this type."
      );
      return;
    }
    try {
      setSaving(true);
      const body = {
        referrerType: form.referrerType,
        label: form.label?.trim() || "",
      };
      if (form.referrerType !== "system") {
        body.referrerId = resolvedId;
      }
      if (form.code?.trim()) {
        body.code = form.code.trim();
      }
      await referralProgramService.createReferrer(body);
      notifySuccess("Referral code created.");
      setEntitySelection(null);
      setModalOpen(false);
      await fetchOverview();
      await fetchList();
    } catch (e) {
      notifyError(e?.response?.data?.message || "Failed to create referrer");
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (row) => {
    try {
      await referralProgramService.updateReferrer(row._id, {
        isActive: !row.isActive,
      });
      notifySuccess(row.isActive ? "Code deactivated." : "Code activated.");
      await fetchOverview();
      await fetchList();
    } catch (e) {
      notifyError(e?.response?.data?.message || "Update failed");
    }
  };

  const recordOne = async (row) => {
    try {
      await referralProgramService.recordReferral(row._id, { increment: 1 });
      notifySuccess("Referral count recorded (+1).");
      await fetchOverview();
      await fetchList();
    } catch (e) {
      notifyError(e?.response?.data?.message || "Failed to record");
    }
  };

  const confirmDelete = (row) => {
    setPendingDelete(row);
    setDeleteOpen(true);
  };

  const handleDelete = async () => {
    if (!pendingDelete?._id) return;
    try {
      await referralProgramService.deleteReferrer(pendingDelete._id);
      notifySuccess("Referrer removed.");
      setDeleteOpen(false);
      setPendingDelete(null);
      await fetchOverview();
      await fetchList();
    } catch (e) {
      notifyError(e?.response?.data?.message || "Delete failed");
    }
  };

  const filters = [
    {
      isClearButton: true,
      tooltip: "Clear Filters",
      buttonProps: {
        onClick: () => {
          setTypeFilter("all");
          setSearchValue("");
          setPagination((p) => ({ ...p, page: 1 }));
        },
      },
    },
    {
      name: "referrer_type",
      label: "Type",
      type: "select",
      isClearable: false,
      value: typeFilter,
      onChange: (value) => {
        setTypeFilter(value || "all");
        setPagination((p) => ({ ...p, page: 1 }));
      },
      options: typeFilterOptions,
    },
  ];

  const headers = ["Code", "Type", "Referrer", "Label", "Count", "Status", "Actions"];

  const renderRow = (row) => {
    const statusLabel = row?.isActive ? "Active" : "Inactive";
    const badge = row?.isActive
      ? "bg-emerald-100 text-emerald-800"
      : "bg-gray-100 text-gray-700";
    const referrerLabel = getReferrerDisplayLabel(row);
    const typeNorm = String(row?.referrerType || "").trim().toLowerCase();

    return (
      <tr key={row?._id} className="hover:bg-gray-50">
        <td className="px-6 py-4">
          <p className="font-mono font-semibold text-gray-900">{row?.code || "—"}</p>
        </td>
        <td className="px-6 py-4 text-gray-800 capitalize">{row?.referrerType || "—"}</td>
        <td
          className="px-6 py-4 max-w-[280px]"
          title={row?.referrerId ? `Id: ${String(row.referrerId)}` : undefined}
        >
          {referrerLabel ? (
            <span className="text-gray-900 font-medium">{referrerLabel}</span>
          ) : typeNorm === "system" ? (
            <span className="text-gray-800">System</span>
          ) : row?.referrerId ? (
            <span className="text-xs text-gray-500 font-mono break-all">
              {String(row.referrerId)}
            </span>
          ) : (
            "—"
          )}
        </td>
        <td className="px-6 py-4 text-gray-800">{row?.label || "—"}</td>
        <td className="px-6 py-4 text-gray-900 font-medium">
          {row?.referralCount ?? 0}
        </td>
        <td className="px-6 py-4">
          <span
            className={`inline-flex px-2.5 py-1 rounded-full text-xs font-semibold ${badge}`}
          >
            {statusLabel}
          </span>
        </td>
        <td className="px-6 py-4">
          <ActionButtons
            items={[
              {
                action: ACTION_BUTTON_TYPES.TOGGLE_ACTIVE,
                title: row?.isActive ? "Deactivate code" : "Activate code",
                onClick: () => toggleActive(row),
                permission: true,
              },
              {
                action: ACTION_BUTTON_TYPES.ADD_COUNT,
                title: "Record +1 referral",
                onClick: () => recordOne(row),
                permission: true,
              },
              {
                action: ACTION_BUTTON_TYPES.DELETE,
                title: "Delete",
                onClick: () => confirmDelete(row),
                permission: true,
              },
            ]}
          />
        </td>
      </tr>
    );
  };

  return (
    <Page>
      <div className="mt-6"> </div>
      <div className="mb-6">
        <PageHeader
          title="Referral program"
          showAddButton
          addButtonText="Add referral code"
          onAddNew={openCreate}
        />
        <p className="text-sm text-gray-600 mt-2 max-w-3xl">
          Manage referral codes and counts. This module is independent today; later you can
          attach riders or other entities and record conversions from signup or payment flows.
        </p>
      </div>

      <div className="mb-8">
        <SummaryCards cards={summaryCardsData} columnsCount={3} />
      </div>

      <DataTable
        headers={headers}
        data={items}
        loading={loading}
        currentPage={pagination.page}
        totalRecords={pagination.total}
        totalPages={pagination.pages || 1}
        recordsPerPage={pagination.limit}
        onPageChange={(page) => setPagination((p) => ({ ...p, page }))}
        onRecordsPerPageChange={(val) => {
          setPagination((p) => ({ ...p, limit: val, page: 1 }));
        }}
        searchValue={searchValue}
        onSearch={(value) => {
          setSearchValue(value);
          setPagination((p) => ({ ...p, page: 1 }));
        }}
        searchPlaceholder="Search code or label…"
        filters={filters}
        renderRow={renderRow}
        emptyMessage="No referral codes yet."
        isCollapsible={false}
        colWidths={{
          Code: "140px",
          Type: "100px",
          Referrer: "240px",
          Label: "160px",
          Count: "90px",
          Status: "110px",
          Actions: "220px",
        }}
      />

      <CustomModal
        open={modalOpen}
        onClose={() => !saving && setModalOpen(false)}
        title="Add referral code"
        width="520px"
        showActions
        actions={[
          { label: "Cancel", secondary: true, onClick: () => !saving && setModalOpen(false) },
          {
            label: saving ? "Saving…" : "Create",
            onClick: handleCreate,
          },
        ]}
      >
        <div className="space-y-4">
          <FormInput
            label="Referrer type"
            name="referrerType"
            type="select"
            direction="column"
            value={form.referrerType}
            onChange={(value) => {
              const t = value || "vendor";
              setEntitySelection(null);
              setForm((f) => ({ ...f, referrerType: t, referrerId: "" }));
            }}
            options={CREATE_REFERRER_TYPES}
          />
          {form.referrerType === "system" ? (
            <p className="text-sm text-gray-600">
              System-wide referral codes do not need a person or company selected.
            </p>
          ) : null}

          {form.referrerType === "vendor" ? (
            <div className="space-y-1">
              <label className="block text-sm font-medium text-gray-700">
                Select vendor
              </label>
              <AsyncSelect
                key={`vendor-${form.referrerType}`}
                instanceId={`referral-vendor-${form.referrerType}`}
                cacheOptions={false}
                defaultOptions={false}
                loadOptions={loadVendorOptions}
                filterOption={asyncFilterNone}
                value={entitySelection}
                onChange={(opt) => {
                  setEntitySelection(opt);
                  setForm((f) => ({ ...f, referrerId: opt?.value || "" }));
                }}
                placeholder="Type at least 2 letters — search by name or email"
                styles={asyncSelectStyles}
                isClearable
                classNamePrefix="react-select"
                menuPortalTarget={typeof document !== "undefined" ? document.body : null}
                menuPosition="fixed"
                menuShouldScrollIntoView={false}
              />
              {/* <p className="text-xs text-gray-500">
                Shows vendor records from Purchase → Vendors.
              </p> */}
            </div>
          ) : null}

          {form.referrerType === "customer" ? (
            <div className="space-y-1">
              <label className="block text-sm font-medium text-gray-700">
                Select customer
              </label>
              <AsyncSelect
                key="customer-picker"
                instanceId="referral-customer"
                cacheOptions={false}
                defaultOptions={false}
                loadOptions={loadCustomerOptions}
                filterOption={asyncFilterNone}
                value={entitySelection}
                onChange={(opt) => {
                  setEntitySelection(opt);
                  setForm((f) => ({ ...f, referrerId: opt?.value || "" }));
                }}
                placeholder="Type at least 2 letters — search by name or email"
                styles={asyncSelectStyles}
                isClearable
                classNamePrefix="react-select"
                menuPortalTarget={typeof document !== "undefined" ? document.body : null}
                menuPosition="fixed"
                menuShouldScrollIntoView={false}
              />
            </div>
          ) : null}

          {form.referrerType === "other" ? (
            <div className="space-y-1">
              <FormInput
                label="Linked record id"
                name="referrerId"
                direction="column"
                value={form.referrerId}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    referrerId: e?.target?.value ?? "",
                  }))
                }
                placeholder="Paste a valid MongoDB ObjectId"
              />
              <p className="text-xs text-gray-500">
                Use this only for integrations or rare cases. Prefer Vendor / Rider / Customer
                types when possible.
              </p>
            </div>
          ) : null}
          <div className="flex items-center justify-end">
            <button
              type="button"
              className="text-xs text-gray-500 hover:text-gray-700"
              // title="Want to add custom code? Click to show this optional field."
              onClick={() =>
                setShowCustomCodeField((prev) => {
                  if (prev) {
                    setForm((f) => ({ ...f, code: "" }));
                  }
                  return !prev;
                })
              }
            >
              {showCustomCodeField ? "Hide custom code" : "Want to add custom code?"}
            </button>
          </div>
          {showCustomCodeField ? (
            <FormInput
              label="Custom code (optional)"
              name="code"
              direction="column"
              value={form.code}
              onChange={(e) => setForm((f) => ({ ...f, code: e.target.value }))}
              placeholder="Leave blank to auto-generate"
            />
          ) : null}
          <FormInput
            label="Label (optional)"
            name="label"
            direction="column"
            value={form.label}
            onChange={(e) => setForm((f) => ({ ...f, label: e.target.value }))}
            placeholder="Internal note"
          />
        </div>
      </CustomModal>

      <CustomModal
        open={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        title="Remove referral code"
        showActions
        actions={[
          { label: "Cancel", secondary: true, onClick: () => setDeleteOpen(false) },
          { label: "Delete", failure: true, onClick: handleDelete },
        ]}
      >
        <p className="text-sm text-gray-700">
          Delete referral code{" "}
          <span className="font-mono font-semibold">{pendingDelete?.code}</span>? This cannot
          be undone.
        </p>
      </CustomModal>
    </Page>
  );
}
