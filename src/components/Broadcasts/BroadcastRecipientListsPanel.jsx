import React, { useEffect, useState } from "react";
import { Building } from "lucide-react";
import { DataTable, ActionButtons, CustomModal } from "@/page-layouts";
import { ACTION_BUTTON_TYPES } from "@/utils/constants";
import { notifyError, notifySuccess } from "@/utils/toast";
import BroadcastServices from "@/services/BroadcastServices";
import BroadcastRecipientListModal from "@/components/Broadcasts/BroadcastRecipientListModal";
import { isSingleAssignedBusiness } from "@/utils/sessionAssignedBusinesses";

export default function BroadcastRecipientListsPanel({
  businesses = [],
  businessFilter = "",
  authHeaders,
  adminToken,
  checkTokenExpired,
  routePerms,
}) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [localBusinessFilter, setLocalBusinessFilter] = useState(businessFilter);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [recordsPerPage, setRecordsPerPage] = useState(10);

  const [modalOpen, setModalOpen] = useState(false);
  const [editListId, setEditListId] = useState(null);
  const [viewOnly, setViewOnly] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteItem, setDeleteItem] = useState(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    setLocalBusinessFilter(businessFilter);
  }, [businessFilter]);

  const fetchLists = async () => {
    if (!authHeaders?.authorization || businesses.length === 0) {
      setLoading(false);
      setRows([]);
      return;
    }

    try {
      setLoading(true);
      const params = {
        page: currentPage,
        limit: recordsPerPage,
        search: searchTerm || undefined,
      };
      if (localBusinessFilter) {
        params.business_id = localBusinessFilter;
      } else {
        params.business_ids = businesses.map((b) => b._id).join(",");
      }

      const res = await BroadcastServices.listRecipientLists(params, authHeaders);
      if (checkTokenExpired?.(res)) return;
      setRows(res.data?.data || []);
      setTotal(res.data?.total || 0);
      setTotalPages(res.data?.totalPages || 1);
    } catch (error) {
      notifyError(error.response?.data?.error || "Failed to load recipient lists");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLists();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [localBusinessFilter, currentPage, recordsPerPage, businesses.length]);

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      setCurrentPage(1);
      fetchLists();
    }, 500);
    return () => clearTimeout(timeoutId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchTerm]);

  const openCreate = () => {
    setEditListId(null);
    setViewOnly(false);
    setModalOpen(true);
  };

  const openEdit = (row) => {
    setEditListId(row._id);
    setViewOnly(false);
    setModalOpen(true);
  };

  const openView = (row) => {
    setEditListId(row._id);
    setViewOnly(true);
    setModalOpen(true);
  };

  const handleExport = async (row) => {
    if ((row.memberCount ?? 0) <= 0) {
      notifyError("No members to export");
      return;
    }
    try {
      const res = await BroadcastServices.exportRecipientList(row._id, authHeaders);
      if (checkTokenExpired?.(res)) return;
      const safeName = (row.name || "list")
        .trim()
        .replace(/[^a-z0-9_-]+/gi, "_")
        .slice(0, 60);
      const blob = new Blob([res.data], {
        type:
          res.headers["content-type"] ||
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });
      const urlObj = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = urlObj;
      a.download = `${safeName}_members.xlsx`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(urlObj);
      notifySuccess(`Exported ${row.memberCount} member(s)`);
    } catch (error) {
      notifyError(error.response?.data?.error || "Export failed");
    }
  };

  const confirmDelete = async () => {
    if (!deleteItem?._id) return;
    try {
      setDeleting(true);
      const res = await BroadcastServices.deleteRecipientList(deleteItem._id, authHeaders);
      if (checkTokenExpired?.(res)) return;
      notifySuccess("List deleted");
      setDeleteOpen(false);
      setDeleteItem(null);
      fetchLists();
    } catch (error) {
      notifyError(error.response?.data?.error || "Failed to delete list");
    } finally {
      setDeleting(false);
    }
  };

  const filters = [
    {
      isClearButton: true,
      buttonProps: {
        onClick: () => {
          setSearchTerm("");
          setLocalBusinessFilter(businesses.length === 1 ? businesses[0]._id : "");
          setCurrentPage(1);
        },
      },
    },
    ...(!isSingleAssignedBusiness()
      ? [
          {
            label: "Business",
            value: localBusinessFilter,
            onChange: (value) => {
              setLocalBusinessFilter(value);
              setCurrentPage(1);
            },
            options: [
              ...(businesses.length > 1
                ? [{ value: "", label: "All Businesses" }]
                : []),
              ...businesses.map((b) => ({ value: b._id, label: b.name })),
            ],
            placeholder:
              businesses.length > 1 ? "All Businesses" : "Select Business",
            icon: Building,
          },
        ]
      : []),
  ];

  const headers = ["List name", "Members", "Description", "Updated", "Actions"];

  return (
    <>
      <div className="mb-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <p className="text-sm text-gray-600">
          Create reusable lists (e.g. drivers) and select them when building a campaign.
        </p>
        {routePerms?.canAdd ? (
          <button
            type="button"
            className="px-5 py-2.5 bg-[var(--p-blue)] text-white rounded-lg text-sm hover:opacity-90 shrink-0"
            onClick={openCreate}
          >
            New list
          </button>
        ) : null}
      </div>

      <DataTable
        onSearch={(v) => setSearchTerm(v)}
        searchValue={searchTerm}
        searchPlaceholder="Search list name or description…"
        filters={filters}
        headers={headers}
        data={rows}
        totalRecords={total}
        loading={loading}
        currentPage={currentPage}
        totalPages={totalPages}
        recordsPerPage={recordsPerPage}
        onPageChange={setCurrentPage}
        onRecordsPerPageChange={(perPage) => {
          setRecordsPerPage(perPage);
          setCurrentPage(1);
        }}
        renderRow={(row) => {
          const items = [
            {
              action: ACTION_BUTTON_TYPES.VIEW,
              title: "View members",
              onClick: () => openView(row),
            },
          ];
          if (routePerms?.canUpdate) {
            items.push({
              action: ACTION_BUTTON_TYPES.EDIT,
              title: "Edit list",
              onClick: () => openEdit(row),
            });
          }
          if ((row.memberCount ?? 0) > 0) {
            items.push({
              action: ACTION_BUTTON_TYPES.EXPORT,
              title: "Export members",
              onClick: () => handleExport(row),
            });
          }
          if (routePerms?.canDelete) {
            items.push({
              action: ACTION_BUTTON_TYPES.DELETE,
              title: "Delete list",
              onClick: () => {
                setDeleteItem(row);
                setDeleteOpen(true);
              },
            });
          }

          return (
            <tr key={row._id} className="border-b">
              <td className="py-2 px-4 font-medium">{row.name || "—"}</td>
              <td className="py-2 px-4">
                <button
                  type="button"
                  onClick={() => openView(row)}
                  className="text-sm text-[var(--p-blue)] hover:underline"
                >
                  {row.memberCount ?? 0}
                </button>
              </td>
              <td className="py-2 px-4 max-w-xs truncate text-gray-600" title={row.description}>
                {row.description || "—"}
              </td>
              <td className="py-2 px-4 text-sm text-gray-500">
                {row.updatedAt
                  ? new Date(row.updatedAt).toLocaleDateString(undefined, {
                      year: "numeric",
                      month: "short",
                      day: "numeric",
                    })
                  : "—"}
              </td>
              <td className="py-2 px-4">
                <ActionButtons maxVisibleActions={2} isCell items={items} />
              </td>
            </tr>
          );
        }}
      />

      <BroadcastRecipientListModal
        open={modalOpen}
        onClose={() => {
          setModalOpen(false);
          setEditListId(null);
          setViewOnly(false);
        }}
        listId={editListId}
        businesses={businesses}
        defaultBusinessId={
          localBusinessFilter || (businesses.length === 1 ? businesses[0]._id : "")
        }
        authHeaders={authHeaders}
        adminToken={adminToken}
        checkTokenExpired={checkTokenExpired}
        readOnly={viewOnly}
        onSaved={() => fetchLists()}
      />

      <CustomModal
        open={deleteOpen}
        onClose={() => {
          setDeleteOpen(false);
          setDeleteItem(null);
        }}
        title="Delete recipient list"
        width="480px"
        showActions
        actions={[
          {
            label: "Cancel",
            secondary: true,
            onClick: () => {
              setDeleteOpen(false);
              setDeleteItem(null);
            },
          },
          {
            label: deleting ? "Deleting…" : "Delete",
            primary: true,
            onClick: confirmDelete,
            disabled: deleting,
            style: { backgroundColor: "#dc2626", borderColor: "#dc2626" },
          },
        ]}
      >
        <p className="text-sm text-gray-600">
          Delete <strong>{deleteItem?.name}</strong>? Campaigns that already used this list
          are not affected.
        </p>
      </CustomModal>
    </>
  );
}
