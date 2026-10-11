import React, { useState, useEffect, useMemo, useRef, useContext } from "react";
import axios from "axios";
import { useHistory, useParams } from "react-router-dom";
import { Plus, Trash2 } from "lucide-react";
import { AdminContext } from "@/context/AdminContext";
import { PageHeader, useFormScreenExit, Form, Button, DropdownBasic } from "@/page-layouts/index";
import { notifyError } from "@/utils/toast";
import { syncAssignedBusinessesFromApi } from "@/utils/sessionAssignedBusinesses";
import { useTranslation } from "react-i18next";

const Base_URL = import.meta.env.VITE_APP_API_BASE_URL;

const emptyIngredientRow = () => ({
  ingredientItem: "",
  quantity: "",
  unit: "",
});

const RecipeForm = () => {
  const { t } = useTranslation();
  const history = useHistory();
  const { id } = useParams();
  const exitRecipesScreen = useFormScreenExit("/recipes");
  const { state } = useContext(AdminContext);
  const { adminInfo } = state;
  const headers = useMemo(
    () => ({
      "Content-Type": "application/json",
      authorization: `Bearer ${adminInfo?.token}`,
    }),
    [adminInfo?.token],
  );

  const [businesses, setBusinesses] = useState([]);
  const [businessesLoading, setBusinessesLoading] = useState(true);
  const [items, setItems] = useState([]);
  const [existingRecipes, setExistingRecipes] = useState([]);
  const [isLoadingRecipe, setIsLoadingRecipe] = useState(!!id);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState({});

  const [formData, setFormData] = useState({
    business: "",
    menuItem: "",
    status: "Active",
  });
  const [ingredients, setIngredients] = useState([emptyIngredientRow()]);

  const prevBusinessRef = useRef(null);

  const tWithFallback = (key, fallback) => {
    const translated = t(key, { defaultValue: fallback });
    return translated && translated !== key ? translated : fallback;
  };

  // Load assigned businesses; default to the first one when creating
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const list = await syncAssignedBusinessesFromApi(Base_URL);
      if (cancelled) return;
      setBusinesses(list);
      setBusinessesLoading(false);
      if (!id) {
        setFormData((prev) => ({
          ...prev,
          business: prev.business || list?.[0]?._id || "",
        }));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id]);

  // Load the existing recipe when editing
  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    (async () => {
      try {
        setIsLoadingRecipe(true);
        const response = await axios.get(`${Base_URL}/recipes/${id}`, { headers });
        if (cancelled) return;
        const recipe = response.data?.data;
        if (!recipe) {
          notifyError(
            t("recipe.messages.notFound", { defaultValue: "Recipe not found." }),
          );
          history.push("/recipes");
          return;
        }
        prevBusinessRef.current = recipe.business?._id || recipe.business || "";
        setFormData({
          business: recipe.business?._id || recipe.business || "",
          menuItem: recipe.menuItem?._id || recipe.menuItem || "",
          status: recipe.status || "Active",
        });
        setIngredients(
          recipe.ingredients?.length > 0
            ? recipe.ingredients.map((ing) => ({
                ingredientItem: ing.ingredientItem?._id || ing.ingredientItem || "",
                quantity: ing.quantity ?? "",
                unit: ing.unit || "",
              }))
            : [emptyIngredientRow()],
        );
      } catch (err) {
        console.error("Error fetching recipe:", err);
        notifyError(
          t("recipe.messages.loadFailed", {
            defaultValue: "Failed to load recipe.",
          }),
        );
        history.push("/recipes");
      } finally {
        if (!cancelled) setIsLoadingRecipe(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id, headers, history, t]);

  // Reset menu item / ingredients when the business changes while creating a new recipe
  useEffect(() => {
    if (id) return;
    if (
      prevBusinessRef.current != null &&
      prevBusinessRef.current !== formData.business
    ) {
      setFormData((prev) => ({ ...prev, menuItem: "" }));
      setIngredients([emptyIngredientRow()]);
    }
    prevBusinessRef.current = formData.business;
  }, [formData.business, id]);

  // Fetch items for the selected business (menu item / ingredient dropdowns)
  useEffect(() => {
    if (!formData.business) {
      setItems([]);
      return;
    }
    const controller = new AbortController();
    axios
      .get(`${Base_URL}/items`, {
        headers,
        params: { businessId: formData.business },
        signal: controller.signal,
      })
      .then((response) => {
        const data = Array.isArray(response.data)
          ? response.data
          : response.data?.items || [];
        setItems(data);
      })
      .catch(() => {
        if (!controller.signal.aborted) setItems([]);
      });
    return () => controller.abort();
  }, [formData.business, headers]);

  // Fetch existing recipes for the selected business so we can exclude menu
  // items that already have a recipe (a menu item can only have one recipe)
  useEffect(() => {
    if (!formData.business) {
      setExistingRecipes([]);
      return;
    }
    const controller = new AbortController();
    axios
      .get(`${Base_URL}/recipes`, {
        headers,
        params: { businessId: formData.business },
        signal: controller.signal,
      })
      .then((response) => {
        setExistingRecipes(response.data?.data || []);
      })
      .catch(() => {
        if (!controller.signal.aborted) setExistingRecipes([]);
      });
    return () => controller.abort();
  }, [formData.business, headers]);

  // Items without an explicit itemKind predate this feature and are sellable dishes
  const menuItemOptions = useMemo(
    () =>
      items
        .filter((it) => !it.itemKind || it.itemKind === "sale")
        .map((it) => ({ label: it.name, value: it._id })),
    [items],
  );

  const ingredientOptions = useMemo(
    () =>
      items
        .filter(
          (it) =>
            it.itemKind === "raw_material" || it.itemKind === "sub_ingredient",
        )
        .map((it) => ({
          label: it.name,
          value: it._id,
          unit: it.unit || it.uom || "",
        })),
    [items],
  );

  const existingMenuItemIds = useMemo(
    () =>
      new Set(
        existingRecipes
          .filter((r) => !id || r._id !== id)
          .map((r) => r.menuItem?._id || r.menuItem)
          .filter(Boolean),
      ),
    [existingRecipes, id],
  );

  const availableMenuItemOptions = useMemo(
    () => menuItemOptions.filter((opt) => !existingMenuItemIds.has(opt.value)),
    [menuItemOptions, existingMenuItemIds],
  );

  const handleIngredientChange = (index, field, value) => {
    setIngredients((prev) =>
      prev.map((row, i) => {
        if (i !== index) return row;
        const updated = { ...row, [field]: value };
        if (field === "ingredientItem" && !row.unit) {
          const opt = ingredientOptions.find((o) => o.value === value);
          if (opt?.unit) updated.unit = opt.unit;
        }
        return updated;
      }),
    );
  };

  const addIngredientRow = () => {
    setIngredients((prev) => [...prev, emptyIngredientRow()]);
  };

  const removeIngredientRow = (index) => {
    setIngredients((prev) => prev.filter((_, i) => i !== index));
  };

  const businessOptions = businesses.map((b) => ({ label: b.name, value: b._id }));

  const handleSubmit = async () => {
    const newErrors = {};
    if (!formData.business) {
      newErrors.business = tWithFallback(
        "recipe.validation.businessRequired",
        "Business is required",
      );
    }
    if (!formData.menuItem) {
      newErrors.menuItem = tWithFallback(
        "recipe.validation.menuItemRequired",
        "Menu item is required",
      );
    }

    const validIngredients = ingredients.filter((ing) => ing.ingredientItem);
    if (validIngredients.length === 0) {
      newErrors.ingredients = tWithFallback(
        "recipe.validation.ingredientRequired",
        "At least one ingredient is required",
      );
    }

    ingredients.forEach((ing, idx) => {
      if (ing.ingredientItem && (!ing.quantity || parseFloat(ing.quantity) <= 0)) {
        newErrors[`quantity_${idx}`] = tWithFallback(
          "recipe.validation.quantityGreaterThanZero",
          "Quantity must be greater than 0",
        );
      }
    });

    setErrors(newErrors);
    if (Object.keys(newErrors).length > 0) {
      throw new Error(
        tWithFallback(
          "recipe.validation.fixErrors",
          "Please fix the highlighted errors before saving.",
        ),
      );
    }

    const payload = {
      business: formData.business,
      menuItem: formData.menuItem,
      ingredients: validIngredients.map((ing) => ({
        ingredientItem: ing.ingredientItem,
        quantity: parseFloat(ing.quantity) || 0,
        unit: ing.unit || "",
      })),
      status: formData.status,
    };

    try {
      setSaving(true);
      if (id) {
        await axios.put(`${Base_URL}/recipes/${id}`, payload, { headers });
      } else {
        await axios.post(`${Base_URL}/recipes`, payload, { headers });
      }
      return { success: true };
    } catch (err) {
      console.error("Error saving recipe:", err);
      throw new Error(
        err.response?.data?.message ||
          tWithFallback("recipe.messages.saveFailed", "Failed to save recipe."),
      );
    } finally {
      setSaving(false);
    }
  };

  const formFields = [
    {
      label: t("Business"),
      name: "business",
      type: "select",
      required: true,
      value: formData.business,
      onChange: (value) =>
        setFormData((prev) => ({ ...prev, business: value || "" })),
      placeholder: t("Select Business"),
      isClearable: false,
      disabled: businessesLoading || !!id || businesses.length === 1,
      error: errors.business,
      shouldShowError: !!errors.business,
      options: businessOptions,
    },
    {
      label: tWithFallback("recipe.menuItem", "Product"),
      name: "menuItem",
      type: "select",
      required: true,
      value: formData.menuItem,
      onChange: (value) =>
        setFormData((prev) => ({ ...prev, menuItem: value || "" })),
      placeholder: tWithFallback("recipe.selectMenuItem", "Select product"),
      isClearable: false,
      disabled: !formData.business || !!id,
      error: errors.menuItem,
      shouldShowError: !!errors.menuItem,
      options: availableMenuItemOptions,
    },
    {
      label: t("Status"),
      name: "status",
      type: "select",
      value: formData.status,
      onChange: (value) =>
        setFormData((prev) => ({ ...prev, status: value || "Active" })),
      isClearable: false,
      options: [
        { label: t("common.active"), value: "Active" },
        { label: t("common.inactive"), value: "Inactive" },
      ],
    },
  ];

  const ingredientsSection = (
    <div className="bg-white rounded-xl border border-gray-200 p-4">
      <div className="flex items-center justify-between mb-2">
        <label className="block text-sm font-medium text-gray-700">
          {tWithFallback("recipe.ingredients", "Components")}
        </label>
        <Button
          onClick={addIngredientRow}
          secondary
          style={{ padding: "4px 12px", fontSize: "12px" }}
          type="button"
        >
          <span className="flex items-center gap-1">
            <Plus size={14} />{" "}
            {tWithFallback("recipe.addIngredient", "Add Component")}
          </span>
        </Button>
      </div>
      {errors.ingredients && (
        <p className="text-red-500 text-xs mb-2">{errors.ingredients}</p>
      )}
      <div className="space-y-2">
        {ingredients.map((row, index) => (
          <div key={index} className="flex gap-2 items-start">
            <div className="flex-1">
              <DropdownBasic
                options={ingredientOptions}
                value={row.ingredientItem}
                onChange={(value) =>
                  handleIngredientChange(index, "ingredientItem", value)
                }
                placeholder={tWithFallback(
                  "recipe.selectIngredient",
                  "Select component",
                )}
                isClearable={false}
                isDisabled={!formData.business}
              />
            </div>
            <div className="w-24">
              <input
                type="number"
                min="0"
                step="any"
                value={row.quantity}
                onChange={(e) =>
                  handleIngredientChange(index, "quantity", e.target.value)
                }
                placeholder={tWithFallback("recipe.quantityShort", "Qty")}
                className={`w-full rounded-xl border px-3 py-2 text-sm bg-gray-100 ${
                  errors[`quantity_${index}`]
                    ? "border-red-500 border-2"
                    : "border-gray-300"
                }`}
              />
            </div>
            <div className="w-24">
              <input
                type="text"
                value={row.unit}
                onChange={(e) =>
                  handleIngredientChange(index, "unit", e.target.value)
                }
                placeholder={tWithFallback("recipe.unit", "Unit")}
                className="w-full rounded-xl border border-gray-300 px-3 py-2 text-sm bg-gray-100"
              />
            </div>
            <button
              type="button"
              onClick={() => removeIngredientRow(index)}
              disabled={ingredients.length === 1}
              className="p-2 text-gray-400 hover:text-red-500 disabled:opacity-30 disabled:cursor-not-allowed"
              title={tWithFallback("recipe.removeIngredient", "Remove component")}
            >
              <Trash2 size={16} />
            </button>
          </div>
        ))}
      </div>
    </div>
  );

  if (isLoadingRecipe) {
    return (
      <div className="p-6 bg-white min-h-screen flex items-center justify-center">
        <div className="w-16 h-16 border-4 border-t-4 border-gray-200 border-t-blue-600 rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="py-6 px-6 min-h-screen">
      <PageHeader
        title={
          id
            ? tWithFallback("recipe.edit", "Edit Composition")
            : tWithFallback("recipe.add", "Add Composition")
        }
        description={tWithFallback(
          "recipe.formDescription",
          "Define which components are consumed when one unit of this product is sold or produced.",
        )}
        showBackButton
        onBackClick={exitRecipesScreen}
        backFallbackPath="/recipes"
      />
      <Form
        formFields={formFields}
        handleSubmit={handleSubmit}
        handleCancel={exitRecipesScreen}
        isSubmitting={saving}
        submitSuccessMessage={
          id
            ? tWithFallback(
                "recipe.messages.updatedSuccess",
                "Composition updated successfully",
              )
            : tWithFallback(
                "recipe.messages.createdSuccess",
                "Composition created successfully",
              )
        }
        afterSubmit={() => history.push("/recipes")}
        isOpen={true}
        saveButtonText={t("Save")}
        cancelButtonText={t("Cancel")}
        labelAndFieldDirection="column"
        customLabelWidth="w-full"
        fieldsPerRow={2}
        formOuterSpacingClassName="space-y-4 mt-3"
        fieldsStackSpacingClassName="space-y-4"
        fieldsRowGapClassName="gap-4"
        beforeFooter={ingredientsSection}
      />
    </div>
  );
};

export default RecipeForm;
