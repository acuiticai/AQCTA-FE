import React, { useState, useEffect, useMemo, useContext } from "react";
import axios from "axios";
import { useHistory } from "react-router-dom";
import { Plus } from "lucide-react";
import { AdminContext } from "@/context/AdminContext";
import { useRouteModulePermissions } from "@/utils/permissionUtils";
import {
  DataTable,
  ActionButtons,
  ToggleSwitch,
  Button,
  BackButton,
} from "@/page-layouts";
import { Modal, ModalHeader, ModalBody, ModalFooter } from "@windmill/react-ui";
import { notifyError, notifySuccess } from "@/utils/toast";
import { ACTION_BUTTON_TYPES } from "@/utils/constants";
import useCheckTokenExpired from "@/hooks/useCheckTokenExpired";
import { syncAssignedBusinessesFromApi } from "@/utils/sessionAssignedBusinesses";
import { useTranslation } from "react-i18next";

const Base_URL = import.meta.env.VITE_APP_API_BASE_URL;

const RecipesScreen = () => {
  const { t } = useTranslation();
  const checkTokenExpired = useCheckTokenExpired();
  const history = useHistory();
  const { state } = useContext(AdminContext);
  const { adminInfo } = state;
  const headers = useMemo(
    () => ({
      "Content-Type": "application/json",
      authorization: `Bearer ${adminInfo?.token}`,
    }),
    [adminInfo?.token],
  );

  const recipeModulePerms = useRouteModulePermissions();
  const { canAdd, canUpdate, canDelete } = recipeModulePerms;

  const [businesses, setBusinesses] = useState([]);
  const [businessesLoading, setBusinessesLoading] = useState(true);
  const [selectedBusinesses, setSelectedBusinesses] = useState([]); // multi-select

  const [recipes, setRecipes] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("");

  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [recipeToDelete, setRecipeToDelete] = useState(null);

  const tWithFallback = (key, fallback, options = {}) => {
    const translated = t(key, { ...options, defaultValue: fallback });
    return translated && translated !== key ? translated : fallback;
  };

  // Load assigned businesses
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const list = await syncAssignedBusinessesFromApi(Base_URL);
      if (cancelled) return;
      setBusinesses(list);
      setBusinessesLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const fetchRecipes = async (
    businessIds = selectedBusinesses,
    search = searchTerm,
    status = statusFilter,
  ) => {
    try {
      setLoading(true);
      setError(null);

      const params = {};
      if (Array.isArray(businessIds) && businessIds.length > 0) {
        params.businessIds = businessIds.join(",");
      } else {
        const assignedIds = businesses.map((b) => b._id).filter(Boolean);
        if (assignedIds.length === 0) {
          setRecipes([]);
          setLoading(false);
          return;
        }
        if (assignedIds.length === 1) {
          params.businessId = assignedIds[0];
        } else {
          params.businessIds = assignedIds.join(",");
        }
      }

      if (search && search.trim() !== "") params.search = search.trim();
      if (status === "Active" || status === "Inactive") params.status = status;

      const response = await axios.get(`${Base_URL}/recipes`, {
        headers,
        params,
      });
      if (checkTokenExpired(response)) return;
      setRecipes(response.data?.data || []);
    } catch (err) {
      console.error("Error fetching recipes:", err);
      setError(tWithFallback("recipe.messages.fetchFailed", "Failed to fetch recipes."));
      setRecipes([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (businessesLoading) return;
    fetchRecipes(selectedBusinesses, searchTerm, statusFilter);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [businessesLoading, businesses, selectedBusinesses, statusFilter]);

  const handleSearch = (searchValue) => {
    const trimmedSearch = searchValue ? searchValue.trim() : "";
    setSearchTerm(trimmedSearch);
    fetchRecipes(selectedBusinesses, trimmedSearch, statusFilter);
  };

  const handleBusinessChange = (ids) => {
    setSelectedBusinesses(Array.isArray(ids) ? ids : []);
  };

  const handleStatusFilterChange = (value) => {
    setStatusFilter(value || "");
  };

  const clearAllFilters = () => {
    setSelectedBusinesses([]);
    setStatusFilter("");
    setSearchTerm("");
  };

  const handleAdd = () => {
    history.push("/recipes/create", { from: "/recipes" });
  };

  const handleEdit = (recipe) => {
    if (!canUpdate) return;
    history.push(`/recipes/edit/${recipe._id}`, { from: "/recipes" });
  };

  const openDeleteModal = (recipe) => {
    setRecipeToDelete(recipe);
    setDeleteModalOpen(true);
  };

  const closeDeleteModal = () => {
    setRecipeToDelete(null);
    setDeleteModalOpen(false);
  };

  const handleDelete = async () => {
    if (!recipeToDelete) return;
    try {
      setLoading(true);
      const response = await axios.delete(
        `${Base_URL}/recipes/${recipeToDelete._id}`,
        { headers },
      );
      if (checkTokenExpired(response)) return;
      notifySuccess(
        tWithFallback("recipe.messages.deletedSuccess", "Recipe deleted successfully"),
      );
      fetchRecipes();
    } catch (err) {
      console.error("Error deleting recipe:", err);
      notifyError(
        tWithFallback("recipe.messages.deleteFailed", "Failed to delete recipe."),
      );
    } finally {
      setLoading(false);
      closeDeleteModal();
    }
  };

  const handleToggleStatus = async (recipe) => {
    if (!canUpdate) return;
    try {
      const newStatus = recipe.status === "Active" ? "Inactive" : "Active";
      const response = await axios.put(
        `${Base_URL}/recipes/${recipe._id}`,
        { status: newStatus },
        { headers },
      );
      if (checkTokenExpired(response)) return;
      notifySuccess(
        `${t("common.statusUpdatedTo")} ${
          newStatus === "Active" ? t("common.active") : t("common.inactive")
        }`,
      );
      fetchRecipes();
    } catch (err) {
      console.error("Error updating recipe status:", err);
      notifyError(t("common.statusUpdateFailed"));
    }
  };

  const tableHeaders = [
    tWithFallback("recipe.menuItem", "Product"),
    t("Business"),
    tWithFallback("recipe.ingredients", "Components"),
    t("Status"),
    t("common.action"),
  ];

  const filters = [
    {
      isClearButton: true,
      buttonProps: {
        onClick: clearAllFilters,
      },
    },
    {
      isBusinessDropdown: true,
      businessDropdownProps: {
        selectionMode: "multiple",
        selectedBusinesses,
        onChange: handleBusinessChange,
        placeholder: t("item.selectBusinesses"),
      },
    },
    {
      value: statusFilter || "",
      onChange: handleStatusFilterChange,
      placeholder: t("common.selectStatus"),
      options: [
        { value: "", label: t("common.allStatuses") },
        { value: "Active", label: t("common.active") },
        { value: "Inactive", label: t("common.inactive") },
      ],
    },
  ];

  return (
    <div className="bg-gray-50 min-h-screen w-full max-w-full overflow-x-hidden">
      <div className="w-full max-w-full mx-auto px-6 py-8 min-w-0 overflow-x-hidden">
        <div className="mb-8">
          <BackButton
            onClick={() => history.push("/items")}
            fallbackPath="/items"
            className="mb-4 !mt-0"
          />
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">{t("item.recipes")}</h1>
              <p className="text-gray-600 mt-2">
                {tWithFallback(
                  "recipe.description",
                  "Define which components are consumed when a finished product is sold or produced.",
                )}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-3 lg:gap-4 shrink-0">
              <button
                type="button"
                onClick={() => history.push("/purchase-planning")}
                className="px-4 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-100 transition-colors"
              >
                {t("item.purchasePlanning")}
              </button>
              {canAdd && (
                <button
                  type="button"
                  onClick={handleAdd}
                  className="flex items-center gap-2 px-6 py-3 bg-[var(--p-blue)] text-white rounded-lg hover:bg-[var(--p-blue-dark)] transition-colors shadow-sm"
                >
                  <Plus size={20} />
                  {tWithFallback("recipe.add", "Add Composition")}
                </button>
              )}
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 min-w-0 max-w-full overflow-hidden">
          <DataTable
            onSearch={handleSearch}
            searchValue={searchTerm}
            searchPlaceholder={tWithFallback(
              "recipe.searchPlaceholder",
              "Search by product name...",
            )}
            filters={filters}
            loading={loading || businessesLoading}
            headers={tableHeaders}
            data={recipes}
            noPagination
            tableError={error}
            emptyMessage={tWithFallback(
              "recipe.emptyMessage",
              "No compositions found. Add one to track component consumption.",
            )}
            renderRow={(recipe) => (
              <tr
                key={recipe._id}
                className="border-b"
                style={{ fontSize: "12px", fontWeight: "400" }}
              >
                <td className="py-2 px-4" style={{ fontSize: "14px", fontWeight: "400" }}>
                  {recipe.menuItem?.name || "-"}
                </td>
                <td className="py-2 px-4" style={{ fontSize: "14px", fontWeight: "400" }}>
                  {recipe.business?.name || "-"}
                </td>
                <td className="py-2 px-4" style={{ fontSize: "14px", fontWeight: "400" }}>
                  {(recipe.ingredients || [])
                    .map(
                      (ing) =>
                        `${ing.ingredientItem?.name || "-"} (${ing.quantity}${
                          ing.unit ? ` ${ing.unit}` : ""
                        })`,
                    )
                    .join(", ")}
                </td>
                <td className="py-2 px-4">
                  <div className="flex items-center justify-center">
                    <ToggleSwitch
                      isOn={recipe.status === "Active"}
                      handleToggle={() => handleToggleStatus(recipe)}
                      disabled={!canUpdate}
                    />
                  </div>
                </td>
                <td className="py-2 px-4">
                  <div className="flex space-x-2 items-center">
                    <ActionButtons
                      rbac={{ canUpdate, canDelete }}
                      items={[
                        {
                          tooltip: t("Edit"),
                          action: ACTION_BUTTON_TYPES.EDIT,
                          onClick: () => handleEdit(recipe),
                        },
                        {
                          tooltip: t("Delete"),
                          action: ACTION_BUTTON_TYPES.DELETE,
                          onClick: () => openDeleteModal(recipe),
                        },
                      ]}
                    />
                  </div>
                </td>
              </tr>
            )}
          />
        </div>

        {/* Delete Recipe Modal */}
        <Modal
          style={{ width: "auto", padding: "24px" }}
          isOpen={deleteModalOpen}
          onClose={closeDeleteModal}
        >
          <ModalHeader style={{ marginTop: 0 }}>
            {tWithFallback("recipe.delete", "Delete Recipe")}
          </ModalHeader>
          <ModalBody style={{ marginBottom: "12px" }}>
            {recipeToDelete && (
              <div className="flex gap-4 py-2 pb-4 items-center">
                <p>
                  {tWithFallback(
                    "recipe.deleteConfirm",
                    "Are you sure you want to delete the recipe for {{name}}?",
                    { name: recipeToDelete.menuItem?.name },
                  )}
                </p>
              </div>
            )}
          </ModalBody>
          <ModalFooter style={{ padding: "12px 24px" }}>
            <Button onClick={closeDeleteModal} secondary>
              {t("Cancel")}
            </Button>
            <Button
              danger
              onClick={handleDelete}
              style={{ backgroundColor: "#e53e3e", color: "#fff" }}
            >
              {t("Delete")}
            </Button>
          </ModalFooter>
        </Modal>
      </div>
    </div>
  );
};

export default RecipesScreen;
