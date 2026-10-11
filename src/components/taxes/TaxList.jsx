import React, { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { getTaxes, deleteTax } from "../../services/taxServices";
import { useHistory, useLocation } from "react-router-dom";
import Header from "@/components/header/Header";
import AppLayout from "../../pages/Settings/app-layout";
import SettingsOrgBanner from "@/pages/Settings/SettingsOrgBanner";
import { useRouteModulePermissions } from "@/utils/permissionUtils";
import { DataTable, ActionButtons } from "@/page-layouts";
import { ACTION_BUTTON_TYPES } from "@/utils/constants";

// Delete Confirmation Modal component
const DeleteConfirmationModal = ({
  isOpen,
  onClose,
  onConfirm,
  taxName,
  isMultiple,
  count,
  t,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-md mx-4 transform transition-all">
        <div className="text-center">
          <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-red-100 mb-4">
            <TrashIcon className="h-6 w-6 text-red-600" />
          </div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">
            {isMultiple ? t("accountsSettings.taxes.deleteTaxes", "Delete Taxes") : t("accountsSettings.taxes.deleteTax", "Delete Tax")}
          </h3>
          <p className="text-sm text-gray-500 mb-6">
            {isMultiple
              ? t("accountsSettings.taxes.deleteMultipleConfirm", "Are you sure you want to delete {{count}} selected taxes? This action cannot be undone.", { count })
              : t("accountsSettings.taxes.deleteSingleConfirm", 'Are you sure you want to delete "{{name}}"? This action cannot be undone.', { name: taxName })}
          </p>
        </div>
        <div className="flex justify-end space-x-3">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500"
          >
            {t("Cancel")}
          </button>
          <button
            onClick={onConfirm}
            className="px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-md focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
          >
            {t("Delete")}
          </button>
        </div>
      </div>
    </div>
  );
};

const TaxList = () => {
  const { t } = useTranslation();
  const [taxes, setTaxes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedTaxes, setSelectedTaxes] = useState([]);
  const history = useHistory();
  const location = useLocation();
  const { canAdd, canUpdate, canDelete } = useRouteModulePermissions();

  const [searchTerm, setSearchTerm] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [recordsPerPage, setRecordsPerPage] = useState(() => {
    try {
      const c = localStorage.getItem("configurations");
      if (c) {
        const parsed = JSON.parse(c);
        const p = parsed && parsed.table_entries_per_page;
        if (Number.isFinite(p) && p > 0) return Number(p);
      }
    } catch (_) {}
    return 10;
  });

  const filteredTaxes = taxes.filter((tax) => {
    const nameMatch = tax.name ? tax.name.toLowerCase().includes(searchTerm.toLowerCase()) : false;
    const rateMatch = tax.rate !== undefined ? String(tax.rate).includes(searchTerm) : false;
    return nameMatch || rateMatch;
  });

  const paginatedTaxes = filteredTaxes.slice(
    (currentPage - 1) * recordsPerPage,
    currentPage * recordsPerPage
  );

  const handleSearch = (searchValue) => {
    setSearchTerm(searchValue ? searchValue.trim() : "");
    setCurrentPage(1);
  };

  // State for organization
  const [organization, setOrganization] = useState(null);

  // State for delete confirmation modal
  const [deleteModal, setDeleteModal] = useState({
    isOpen: false,
    taxId: null,
    taxName: "",
    isMultiple: false,
  });

  // Get organization from URL on component mount
  useEffect(() => {
    const searchParams = new URLSearchParams(location.search);
    const selectedOrg = searchParams.get("selectedOrg");

    if (selectedOrg) {
      setOrganization(selectedOrg);
    }
  }, [location]);

  // Fetch taxes when organization is available
  useEffect(() => {
    if (organization) {
      fetchTaxes();
    }
  }, [organization]);

  const fetchTaxes = async () => {
    if (!organization) return; // Don't fetch if organization is not available

    try {
      setLoading(true);
      const response = await getTaxes(organization);
      setTaxes(response.data);
      setLoading(false);
    } catch (error) {
      console.error("Error fetching taxes:", error);
      setLoading(false);
    }
  };

  const handleSelectAll = (e) => {
    if (e.target.checked) {
      setSelectedTaxes(taxes.map((tax) => tax._id));
    } else {
      setSelectedTaxes([]);
    }
  };

  const handleSelect = (taxId) => {
    if (selectedTaxes.includes(taxId)) {
      setSelectedTaxes(selectedTaxes.filter((id) => id !== taxId));
    } else {
      setSelectedTaxes([...selectedTaxes, taxId]);
    }
  };

  // Open confirmation for single tax deletion
  const handleDelete = (taxId, taxName) => {
    setDeleteModal({
      isOpen: true,
      taxId,
      taxName,
      isMultiple: false,
    });
  };

  // Open confirmation modal for bulk deletion
  const handleBulkDelete = () => {
    if (selectedTaxes.length === 0) return;

    setDeleteModal({
      isOpen: true,
      taxId: null,
      taxName: "",
      isMultiple: true,
    });
  };

  // Handle confirmation to delete single tax
  const confirmSingleDelete = async () => {
    try {
      await deleteTax(deleteModal.taxId);
      fetchTaxes();
      closeDeleteModal();
    } catch (error) {
      console.error("Error deleting tax:", error);
      closeDeleteModal();
    }
  };

  // Handle confirmation to delete multiple taxes
  const confirmBulkDelete = async () => {
    try {
      await Promise.all(selectedTaxes.map((id) => deleteTax(id)));
      fetchTaxes();
      setSelectedTaxes([]);
      closeDeleteModal();
    } catch (error) {
      console.error("Error deleting taxes:", error);
      closeDeleteModal();
    }
  };

  // Close delete modal
  const closeDeleteModal = () => {
    setDeleteModal({
      isOpen: false,
      taxId: null,
      taxName: "",
      isMultiple: false,
    });
  };

  // Confirm action based on whether it's single or bulk delete
  const confirmDelete = () => {
    if (deleteModal.isMultiple) {
      confirmBulkDelete();
    } else {
      confirmSingleDelete();
    }
  };

  return (
    <AppLayout>
      <Header title={t("accountsSettings.taxes.title", "Taxes")} />
      <div className="bg-white rounded-lg shadow m-10 max-h-[85vh] overflow-y-auto pb-6">
        <div className="flex justify-between items-center p-4 border-b">
          <div className="text-lg font-semibold text-gray-700 flex items-center">
            {t("accountsSettings.taxes.activeTaxes", "Active taxes")}
          </div>
          <div className="flex gap-2">
            {canDelete && selectedTaxes.length > 0 && (
              <button
                onClick={handleBulkDelete}
                className="px-3 py-2 bg-red-500 text-white rounded hover:bg-red-600 transition-all"
              >
                {t("accountsSettings.taxes.deleteSelected", "Delete Selected")}
              </button>
            )}
            {canAdd && (
              <button
                onClick={() =>
                  history.push(`/taxes/new?organization=${organization}`)
                }
                className="inline-flex items-center px-4 py-2 bg-[var(--p-blue)] hover:bg-[var(--p-blue)] text-white font-medium rounded transition-all"
              >
                <span className="mr-1">+</span> {t("accountsSettings.taxes.newTax", "New Tax")}
              </button>
            )}
          </div>
        </div>
       <div className="p-4">
         <SettingsOrgBanner />
       </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 min-w-0 max-w-full overflow-hidden">
          <DataTable
            wideTable={true}
            loading={loading}
            searchValue={searchTerm}
            onSearch={handleSearch}
            searchPlaceholder={t("accountsSettings.taxes.searchPlaceholder", "Search taxes...")}
            selectable={canDelete}
            onSelectionChange={(selected) => {
              setSelectedTaxes(selected.map((item) => item._id));
            }}
            totalRecords={filteredTaxes.length}
            recordsPerPage={recordsPerPage}
            onRecordsPerPageChange={(perPage) => {
              setRecordsPerPage(perPage);
              setCurrentPage(1);
            }}
            totalPages={Math.ceil(filteredTaxes.length / recordsPerPage)}
            currentPage={currentPage}
            onPageChange={(page) => setCurrentPage(page)}
            headers={[t("accountsSettings.taxes.taxName", "TAX NAME"), t("accountsSettings.taxes.rate", "RATE (%)"), t("Actions")]}
            data={paginatedTaxes}
            renderRow={(tax) => (
              <tr key={tax._id} className="border-b hover:bg-gray-50">
                <td className="p-4 text-sm font-medium text-gray-900">
                  {canUpdate ? (
                    <Link
                      to={`/taxes/edit/${tax._id}?organization=${organization}`}
                      className="hover:underline text-[var(--p-blue)]"
                    >
                      {tax.name}
                    </Link>
                  ) : (
                    tax.name
                  )}
                </td>
                <td className="p-4 text-sm text-gray-700">{tax.rate}</td>
                <td className="p-4 text-sm text-gray-500">
                  <div className="flex space-x-2 items-center">
                    <ActionButtons
                      rbac={{
                        canUpdate,
                        canDelete,
                      }}
                      items={[
                        {
                          tooltip: t("Edit"),
                          action: ACTION_BUTTON_TYPES.EDIT,
                          onClick: () =>
                            history.push(
                              `/taxes/edit/${tax._id}?organization=${organization}`
                            ),
                        },
                        {
                          tooltip: t("Delete"),
                          action: ACTION_BUTTON_TYPES.DELETE,
                          onClick: () => handleDelete(tax._id, tax.name),
                        },
                      ]}
                    />
                  </div>
                </td>
              </tr>
            )}
          />
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      <DeleteConfirmationModal
        isOpen={deleteModal.isOpen}
        onClose={closeDeleteModal}
        onConfirm={confirmDelete}
        taxName={deleteModal.taxName}
        isMultiple={deleteModal.isMultiple}
        count={selectedTaxes.length}
        t={t}
      />
    </AppLayout>
  );
};

export default TaxList;
