import React, { useState, useEffect, useMemo, useCallback, useRef, useContext } from "react";
import { useHistory, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import axios from "axios";
import { notifySuccess, notifyError } from "@/utils/toast";
import useButtonColor from "@/hooks/useButtonColor";
import {
  PageHeader,
  useFormScreenExit,
  Form,
} from "@/page-layouts/index";
import ItemImageUpload from "@/components/ItemImageUpload";
import { AdminContext } from "@/context/AdminContext";
import DynamicCustomFieldsForm from "@/components/custom-fields/DynamicCustomFieldsForm";
import {
  fetchDefinitions,
  upsertValues,
} from "@/services/customFieldServices";
import { validateCustomFieldValues } from "@/utils/customFieldValidation";
const Base_URL = import.meta.env.VITE_APP_API_BASE_URL;

function getSelectedBusinessIds(business) {
  if (!business) return [];
  if (Array.isArray(business)) {
    return business
      .map((b) => (typeof b === "object" && b !== null ? b._id ?? b.value : b))
      .filter(Boolean)
      .map(String);
  }
  return [String(business)].filter((x) => x && x !== "undefined");
}

/** Multi-business category option value: `${businessId}::${categoryId}` */
const CATEGORY_SCOPE_SEP = "::";

// Common measuring units (hard-coded as per requirement)
const MEASURING_UNITS = [
  "kg",
  "g",
  "lb",
  "oz",
  "ton",
  "mt",
  "piece",
  "box",
  "carton",
  "pack",
  "set",
  "pair",
  "dozen",
  "meter",
  "cm",
  "inch",
  "foot",
  "yard",
  "liter",
  "ml",
  "gallon",
  "hour",
  "day",
  "month",
  "year",
  "Others",
];

/** Derive Odoo productType from legacy type + stock when productType is missing. */
const deriveProductType = (item = {}) => {
  if (item.productType && ["stockable", "consumable", "service"].includes(item.productType)) {
    return item.productType;
  }
  if (item.type === "Service") return "service";
  if (item.stockInformation?.enabled) return "stockable";
  return "consumable";
};

const productTypeToLegacy = (productType) => {
  if (productType === "service") {
    return { type: "Service", stockEnabled: false };
  }
  if (productType === "stockable") {
    return { type: "Goods", stockEnabled: true };
  }
  return { type: "Goods", stockEnabled: false };
};

const EditItemScreen = () => {
  const { t } = useTranslation();
  const history = useHistory();
  const exitItemsScreen = useFormScreenExit("/items");
  const { id } = useParams();
  const buttonColor = useButtonColor();
  const { state } = useContext(AdminContext);
  const { adminInfo } = state;
  const headers = useMemo(
    () => ({
      "Content-Type": "application/json",
      authorization: `Bearer ${adminInfo?.token}`,
    }),
    [adminInfo?.token],
  );

  const [formData, setFormData] = useState({
    business: "",
    category: "",
    itemCode: "",
    barcode: "",
    name: "",
    type: "Goods",
    productType: "consumable",
    unit: "",
    uom: "",
    purchaseUnit: "",
    weight: "",
    trackingMethod: "none",
    costingMethod: "average",
    itemKind: "sale",
    inventory: {
      reorderLevel: "",
      reorderQty: "",
      maxStock: "",
      preferredVendor: "",
    },
    parentIngredient: "",
    conversionFactor: "",
    images: [],
    featuredImage: "",
    salesInformation: {
      enabled: false,
      sellingPrice: "",
      description: "",
      taxOnItem: "",
    },
    purchaseInformation: {
      enabled: false,
      costPrice: "",
      description: "",
      taxOnItem: "",
      vendorProductCode: "",
      leadTimeDays: "",
    },
    stockInformation: {
      enabled: false,
      stock: "",
    },
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [businesses, setBusinesses] = useState([]);
  const [categories, setCategories] = useState([]);
  const [categoriesByBusiness, setCategoriesByBusiness] = useState({});
  const [categoryByBusiness, setCategoryByBusiness] = useState({});
  const [taxes, setTaxes] = useState([]);
  /** Suppliers for the primary business — used for the "Preferred Vendor" dropdown. */
  const [vendors, setVendors] = useState([]);
  /** Raw-material items for the primary business — used for the "Parent Ingredient" dropdown. */
  const [rawMaterialItems, setRawMaterialItems] = useState([]);
  const [isLoading, setIsLoading] = useState({
    business: false,
    categories: false,
    taxes: false,
    form: false,
  });
  const [errors, setErrors] = useState({});
  const [customFieldValues, setCustomFieldValues] = useState({});

  const selectedBusinessIds = useMemo(
    () => getSelectedBusinessIds(formData.business),
    [formData.business],
  );

  const primaryBusinessId = selectedBusinessIds[0] || "";

  const itemBusinessId = useMemo(() => {
    const b = formData.business;
    if (!b) return "";
    if (Array.isArray(b)) return b[0] ? String(b[0]) : "";
    return typeof b === "object" ? b._id || "" : String(b);
  }, [formData.business]);

  const prevPrimaryBusinessRef = useRef(null);

  const buildBusinessCategoryMappingsPayload = () =>
    selectedBusinessIds.map((bid) => ({
      businessId: bid,
      categoryId: categoryByBusiness[bid],
    }));

  const isMultiBusinessCategory = selectedBusinessIds.length > 1;

  const categoryFieldValue = useMemo(() => {
    if (isMultiBusinessCategory) {
      return selectedBusinessIds
        .filter((bid) => categoryByBusiness[bid])
        .map(
          (bid) => `${bid}${CATEGORY_SCOPE_SEP}${categoryByBusiness[bid]}`,
        );
    }
    const bid = selectedBusinessIds[0];
    return bid ? categoryByBusiness[bid] || "" : "";
  }, [isMultiBusinessCategory, selectedBusinessIds, categoryByBusiness]);

  const clearFieldError = (fieldName) => {
    if (errors[fieldName]) {
      setErrors((prev) => ({ ...prev, [fieldName]: "" }));
    }
  };

  const handleCategoryChange = useCallback(
    (value) => {
      const incoming = Array.isArray(value) ? value : value ? [value] : [];
      const next = {};
      incoming.forEach((scoped) => {
        const raw = String(scoped || "");
        if (!raw) return;
        let bid;
        let cid;
        if (raw.includes(CATEGORY_SCOPE_SEP)) {
          [bid, cid] = raw.split(CATEGORY_SCOPE_SEP);
        } else if (selectedBusinessIds.length === 1) {
          bid = selectedBusinessIds[0];
          cid = raw;
        }
        if (
          bid &&
          cid &&
          selectedBusinessIds.some((x) => String(x) === String(bid))
        ) {
          next[bid] = cid;
        }
      });
      setCategoryByBusiness(next);
      clearFieldError("category");
    },
    [selectedBusinessIds],
  );

  useEffect(() => {
    const fetchData = async () => {
      setIsLoading((prev) => ({ ...prev, form: true }));

      // Load businesses from localStorage
      const storedBusinesses = localStorage.getItem("businesses");
      if (storedBusinesses) {
        const parsedBusinesses = JSON.parse(storedBusinesses);
        setBusinesses(parsedBusinesses);
      }

      // Fetch item data for editing
      if (id) {
      try {
          const response = await axios.get(`${Base_URL}/items/${id}`);
        const itemData = response.data;

          const loadedBusinessId =
            itemData.business?._id || itemData.business || "";
          const loadedCategoryId =
            itemData.category?._id || itemData.category || "";
          const mappingMap = {};
          const mappingBusinessIds = [];
          if (Array.isArray(itemData.businessCategoryMappings)) {
            itemData.businessCategoryMappings.forEach((m) => {
              const bid = m.businessId?._id || m.businessId;
              const cid = m.categoryId?._id || m.categoryId;
              if (bid && cid) {
                mappingMap[String(bid)] = String(cid);
                if (!mappingBusinessIds.includes(String(bid))) {
                  mappingBusinessIds.push(String(bid));
                }
              }
            });
          }
          if (
            !Object.keys(mappingMap).length &&
            loadedBusinessId &&
            loadedCategoryId
          ) {
            mappingMap[String(loadedBusinessId)] = String(loadedCategoryId);
          }
          setCategoryByBusiness(mappingMap);

          const businessValue =
            mappingBusinessIds.length > 1
              ? mappingBusinessIds
              : loadedBusinessId;

          const loadedProductType = deriveProductType(itemData);
          setFormData({
            business: businessValue,
            category: loadedCategoryId,
            itemCode: itemData.itemCode || "",
            barcode: itemData.barcode || "",
            name: itemData.name || "",
            type: itemData.type || "Goods",
            productType: loadedProductType,
            unit: itemData.unit || "",
            uom: itemData.uom || "",
            purchaseUnit: itemData.purchaseUnit || "",
            weight: itemData.weight ?? "",
            trackingMethod: itemData.trackingMethod || "none",
            costingMethod: itemData.costingMethod || "average",
            itemKind: itemData.itemKind || "sale",
            inventory: {
              reorderLevel: itemData.inventory?.reorderLevel ?? "",
              reorderQty: itemData.inventory?.reorderQty ?? "",
              maxStock: itemData.inventory?.maxStock ?? "",
              preferredVendor:
                itemData.inventory?.preferredVendor?._id ||
                itemData.inventory?.preferredVendor ||
                "",
            },
            parentIngredient:
              itemData.parentIngredient?._id ||
              itemData.parentIngredient ||
              "",
            conversionFactor: itemData.conversionFactor ?? "",
            images: itemData.images || [],
            featuredImage: itemData.featuredImage || "",
            salesInformation: {
              enabled: itemData.salesInformation?.enabled || false,
              sellingPrice: itemData.salesInformation?.sellingPrice || "",
              description: itemData.salesInformation?.description || "",
              taxOnItem: itemData.salesInformation?.taxOnItem?._id || itemData.salesInformation?.taxOnItem || "",
            },
            purchaseInformation: {
              enabled: itemData.purchaseInformation?.enabled || false,
              costPrice: itemData.purchaseInformation?.costPrice || "",
              description: itemData.purchaseInformation?.description || "",
              taxOnItem: itemData.purchaseInformation?.taxOnItem?._id || itemData.purchaseInformation?.taxOnItem || "",
              vendorProductCode: itemData.purchaseInformation?.vendorProductCode || "",
              leadTimeDays: itemData.purchaseInformation?.leadTimeDays ?? "",
            },
            stockInformation: {
              enabled: itemData.stockInformation?.enabled || false,
              stock: itemData.stockInformation?.stock || itemData.stockInformation?.stock === 0 ? itemData.stockInformation.stock : "",
            },
          });

          const idsToLoad =
            mappingBusinessIds.length > 0
              ? mappingBusinessIds
              : loadedBusinessId
                ? [String(loadedBusinessId)]
                : [];
          if (idsToLoad.length) {
            await fetchTaxes(idsToLoad[0]);
            const nextByBiz = {};
            await Promise.all(
              idsToLoad.map(async (bid) => {
                try {
                  const response = await axios.get(
                    `${Base_URL}/categories?businessId=${bid}&purpose=inventory`,
                    { headers },
                  );
                  nextByBiz[bid] =
                    response.data.categories || response.data || [];
                } catch {
                  nextByBiz[bid] = [];
                }
              }),
            );
            setCategoriesByBusiness(nextByBiz);
            setCategories(nextByBiz[idsToLoad[0]] || []);
            prevPrimaryBusinessRef.current = idsToLoad[0];
          }
        } catch (err) {
          notifyError(t("item.loadDataFailed"));
        }
      }

      setIsLoading((prev) => ({ ...prev, form: false }));
    };

    fetchData();
  }, [id, t]);

  // Fetch taxes when business changes
  const fetchTaxes = async (businessId) => {
    if (!businessId) {
      setTaxes([]);
      return;
    }

    try {
      setIsLoading((prev) => ({ ...prev, taxes: true }));
      const response = await axios.get(`${Base_URL}/taxes?business=${businessId}`);
      setTaxes(response.data || []);
    } catch (err) {
      console.error("Error fetching taxes:", err);
      setTaxes([]);
    } finally {
      setIsLoading((prev) => ({ ...prev, taxes: false }));
    }
  };

  useEffect(() => {
    if (!selectedBusinessIds.length) {
      setTaxes([]);
      setCategories([]);
      setCategoriesByBusiness({});
      prevPrimaryBusinessRef.current = null;
      return;
    }

    fetchTaxes(primaryBusinessId);

    const controller = new AbortController();
    const ids = [...selectedBusinessIds];

    (async () => {
      setIsLoading((prev) => ({ ...prev, categories: true }));
      const nextByBiz = {};
      try {
        await Promise.all(
          ids.map(async (bid) => {
            try {
              const response = await axios.get(
                `${Base_URL}/categories?businessId=${bid}&purpose=inventory`,
                { headers, signal: controller.signal },
              );
              nextByBiz[bid] = response.data.categories || response.data || [];
            } catch (e) {
              if (controller.signal.aborted) return;
              nextByBiz[bid] = [];
            }
          }),
        );
      } finally {
        if (!controller.signal.aborted) {
          setCategoriesByBusiness(nextByBiz);
          setCategories(nextByBiz[ids[0]] || []);
          setIsLoading((prev) => ({ ...prev, categories: false }));
        }
      }
    })();

    if (
      prevPrimaryBusinessRef.current != null &&
      prevPrimaryBusinessRef.current !== primaryBusinessId
    ) {
      setFormData((prev) => ({
        ...prev,
        salesInformation: { ...prev.salesInformation, taxOnItem: "" },
        purchaseInformation: { ...prev.purchaseInformation, taxOnItem: "" },
      }));
    }
    prevPrimaryBusinessRef.current = primaryBusinessId;

    return () => controller.abort();
  }, [selectedBusinessIds.join(","), primaryBusinessId, headers]);

  useEffect(() => {
    setCategoryByBusiness((prev) => {
      const next = {};
      selectedBusinessIds.forEach((bid) => {
        if (prev[bid]) next[bid] = prev[bid];
      });
      if (Object.keys(prev).length === Object.keys(next).length) {
        const same = selectedBusinessIds.every(
          (bid) => prev[bid] === next[bid],
        );
        if (same) return prev;
      }
      return next;
    });
  }, [selectedBusinessIds.join(",")]);

  // Fetch suppliers + raw-material items for the primary business (used by the
  // Inventory/Recipe role fields below)
  useEffect(() => {
    if (!primaryBusinessId) {
      setVendors([]);
      setRawMaterialItems([]);
      return;
    }

    const controller = new AbortController();

    axios
      .get(`${Base_URL}/vendors/all/${primaryBusinessId}`, {
        headers,
        signal: controller.signal,
      })
      .then((response) => setVendors(response.data?.data || []))
      .catch(() => {
        if (!controller.signal.aborted) setVendors([]);
      });

    axios
      .get(`${Base_URL}/items`, {
        headers,
        params: { businessId: primaryBusinessId, itemKind: "raw_material" },
        signal: controller.signal,
      })
      .then((response) => {
        const items = Array.isArray(response.data)
          ? response.data
          : response.data?.items || [];
        setRawMaterialItems(items.filter((it) => String(it._id) !== String(id)));
      })
      .catch(() => {
        if (!controller.signal.aborted) setRawMaterialItems([]);
      });

    return () => controller.abort();
  }, [primaryBusinessId, headers, id]);

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;

    if (name.startsWith("salesInformation.")) {
      const field = name.split(".")[1];
      setFormData((prev) => ({
        ...prev,
        salesInformation: {
          ...prev.salesInformation,
          [field]: type === "checkbox" ? checked : value,
        },
      }));
    } else if (name.startsWith("purchaseInformation.")) {
      const field = name.split(".")[1];
      setFormData((prev) => ({
        ...prev,
        purchaseInformation: {
          ...prev.purchaseInformation,
          [field]: type === "checkbox" ? checked : value,
        },
      }));
    } else if (name.startsWith("stockInformation.")) {
      const field = name.split(".")[1];
      setFormData((prev) => ({
        ...prev,
        stockInformation: {
          ...prev.stockInformation,
          [field]: type === "checkbox" ? checked : value,
        },
      }));
    } else if (name.startsWith("inventory.")) {
      const field = name.split(".")[1];
      setFormData((prev) => ({
        ...prev,
        inventory: {
          ...prev.inventory,
          [field]: type === "checkbox" ? checked : value,
        },
      }));
    } else {
      setFormData((prev) => ({
        ...prev,
        [name]: type === "checkbox" ? checked : value,
      }));
    }
  };

  // Handler for checkbox components that pass boolean directly
  const handleCheckboxChange = (name, checked) => {
    if (name.startsWith("salesInformation.")) {
      const field = name.split(".")[1];
      setFormData((prev) => ({
        ...prev,
        salesInformation: {
          ...prev.salesInformation,
          [field]: checked,
        },
      }));
    } else if (name.startsWith("purchaseInformation.")) {
      const field = name.split(".")[1];
      setFormData((prev) => ({
        ...prev,
        purchaseInformation: {
          ...prev.purchaseInformation,
          [field]: checked,
        },
      }));
    } else if (name.startsWith("stockInformation.")) {
      const field = name.split(".")[1];
      setFormData((prev) => {
        const next = {
          ...prev,
          stockInformation: {
            ...prev.stockInformation,
            [field]: checked,
          },
        };
        if (field === "enabled" && prev.productType !== "service") {
          next.productType = checked ? "stockable" : "consumable";
          next.type = "Goods";
        }
        return next;
      });
    } else {
      setFormData((prev) => ({
        ...prev,
        [name]: checked,
      }));
    }
  };

  const handleDropdownChange = (name, value) => {
    if (name === "productType") {
      const legacy = productTypeToLegacy(value);
      setFormData((prev) => ({
        ...prev,
        productType: value,
        type: legacy.type,
        stockInformation: {
          ...prev.stockInformation,
          enabled: legacy.stockEnabled,
          stock: legacy.stockEnabled ? prev.stockInformation.stock : prev.stockInformation.stock,
        },
        trackingMethod:
          value === "stockable" ? prev.trackingMethod || "none" : "none",
      }));
      return;
    }
    if (name.startsWith("salesInformation.")) {
      const field = name.split(".")[1];
      setFormData((prev) => ({
        ...prev,
        salesInformation: {
          ...prev.salesInformation,
          [field]: value,
        },
      }));
    } else if (name.startsWith("purchaseInformation.")) {
      const field = name.split(".")[1];
      setFormData((prev) => ({
        ...prev,
        purchaseInformation: {
          ...prev.purchaseInformation,
          [field]: value,
        },
      }));
    } else if (name.startsWith("inventory.")) {
      const field = name.split(".")[1];
      setFormData((prev) => ({
        ...prev,
        inventory: {
          ...prev.inventory,
          [field]: value,
        },
      }));
    } else {
      setFormData((prev) => ({ ...prev, [name]: value }));
    }
  };

  const validateForm = () => {
    const newErrors = {};

    if (selectedBusinessIds.length === 0) {
      newErrors.business = t("Business is required");
    }

    const name = formData.name?.trim() || "";
    if (!name) {
      newErrors.name = t("Item name is required");
    } else if (name.length > 200) {
      newErrors.name = t("Item name must be 200 characters or less");
    }

    if (!formData.productType && !formData.type) {
      newErrors.productType = t("Product type is required");
    }

    if (!formData.unit || formData.unit.trim() === "") {
      newErrors.unit = t("Unit is required");
    }

    if (formData.itemKind === "sub_ingredient" && !formData.parentIngredient) {
      newErrors.parentIngredient = t("Parent component is required");
    }

    const missingCategoryBusinesses = selectedBusinessIds.filter(
      (bid) => !categoryByBusiness[bid],
    );
    if (missingCategoryBusinesses.length > 0) {
      newErrors.category =
        selectedBusinessIds.length > 1
          ? t("Select one category for each selected business")
          : t("Category is required");
    }

    // Sales Information - price required when enabled (same as New Item)
    if (formData.salesInformation.enabled) {
      const sellingPrice = formData.salesInformation.sellingPrice;
      const priceNum =
        sellingPrice === "" || sellingPrice === null || sellingPrice === undefined
          ? NaN
          : parseFloat(sellingPrice);
      if (Number.isNaN(priceNum)) {
        newErrors["salesInformation.sellingPrice"] = t("Selling price is required");
      } else if (priceNum < 0) {
        newErrors["salesInformation.sellingPrice"] = t("Selling price cannot be negative");
      }
    }

    // Purchase Information - price required when enabled (same as New Item)
    if (formData.purchaseInformation.enabled) {
      const costPrice = formData.purchaseInformation.costPrice;
      const costNum =
        costPrice === "" || costPrice === null || costPrice === undefined
          ? NaN
          : parseFloat(costPrice);
      if (Number.isNaN(costNum)) {
        newErrors["purchaseInformation.costPrice"] = t("Cost price is required");
      } else if (costNum < 0) {
        newErrors["purchaseInformation.costPrice"] = t("Cost price cannot be negative");
      }
    }

    // Stock Information - quantity required when enabled (same as New Item)
    if (formData.stockInformation.enabled) {
      const stock = formData.stockInformation.stock;
      const stockNum =
        stock === "" || stock === null || stock === undefined
          ? NaN
          : parseFloat(stock);
      if (Number.isNaN(stockNum)) {
        newErrors["stockInformation.stock"] = t("Stock quantity is required");
      } else if (stockNum < 0) {
        newErrors["stockInformation.stock"] = t("Stock quantity cannot be negative");
      }
    }

    setErrors(newErrors);
    const isValid = Object.keys(newErrors).length === 0;
    if (!isValid) {
      notifyError(t("Please fill in all required fields correctly"));
    }
    return isValid;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    if (itemBusinessId) {
      try {
        const defs = await fetchDefinitions(
          {
            businessId: itemBusinessId,
            module: "inventory",
            screen: "item",
          },
          headers,
        );
        const cfErr = validateCustomFieldValues(defs, customFieldValues);
        if (cfErr) {
          notifyError(cfErr);
          return;
        }
      } catch (e) {
        notifyError(
          e?.response?.data?.message || t("Could not validate custom fields"),
        );
        return;
      }
    }

    setLoading(true);
    setError("");

    try {
      // Prepare data for API
      const mappingsPayload = buildBusinessCategoryMappingsPayload();
      const recordBusinessId = itemBusinessId || selectedBusinessIds[0] || "";
      const resolvedCategory =
        categoryByBusiness[recordBusinessId] ||
        mappingsPayload.find(
          (m) => String(m.businessId) === String(recordBusinessId),
        )?.categoryId ||
        null;

      const submitData = {
        business: recordBusinessId,
        category: resolvedCategory,
        businessCategoryMappings: mappingsPayload,
        itemCode: formData.itemCode?.trim() || "",
        barcode: formData.barcode?.trim() || "",
        name: formData.name.trim(),
        type: formData.type || productTypeToLegacy(formData.productType).type,
        productType: formData.productType || deriveProductType(formData),
        unit: formData.unit,
        uom: formData.uom || "",
        purchaseUnit: formData.purchaseUnit || "",
        weight: parseFloat(formData.weight) || 0,
        trackingMethod: formData.trackingMethod || "none",
        costingMethod: formData.costingMethod || "average",
        itemKind: formData.itemKind || "sale",
        inventory: {
          reorderLevel: parseFloat(formData.inventory?.reorderLevel) || 0,
          reorderQty: parseFloat(formData.inventory?.reorderQty) || 0,
          maxStock: parseFloat(formData.inventory?.maxStock) || 0,
          preferredVendor: formData.inventory?.preferredVendor || null,
        },
        parentIngredient: formData.parentIngredient || null,
        conversionFactor: parseFloat(formData.conversionFactor) || 1,
        images: formData.images || [],
        featuredImage: formData.featuredImage || "",
        salesInformation: formData.salesInformation.enabled
          ? {
              enabled: true,
              sellingPrice: parseFloat(formData.salesInformation.sellingPrice) || 0,
              description: formData.salesInformation.description || "",
              taxOnItem: formData.salesInformation.taxOnItem || null,
            }
          : {
              enabled: false,
              sellingPrice: 0,
              description: "",
              taxOnItem: null,
            },
        purchaseInformation: formData.purchaseInformation.enabled
          ? {
              enabled: true,
              costPrice: parseFloat(formData.purchaseInformation.costPrice) || 0,
              description: formData.purchaseInformation.description || "",
              taxOnItem: formData.purchaseInformation.taxOnItem || null,
              vendorProductCode: formData.purchaseInformation.vendorProductCode || "",
              leadTimeDays: parseFloat(formData.purchaseInformation.leadTimeDays) || 0,
            }
          : {
              enabled: false,
              costPrice: 0,
              description: "",
              taxOnItem: null,
              vendorProductCode: "",
              leadTimeDays: 0,
            },
        stockInformation: formData.stockInformation.enabled
          ? {
              enabled: true,
              stock: parseFloat(formData.stockInformation.stock) || 0,
            }
          : {
              enabled: false,
              stock: 0,
            },
      };

      await axios.put(`${Base_URL}/items/${id}`, submitData);
      if (itemBusinessId && id) {
        try {
          await upsertValues(
            {
              business_id: itemBusinessId,
              module: "inventory",
              screen: "item",
              record_id: String(id),
              values: customFieldValues,
            },
            headers,
          );
        } catch (cfErr) {
          notifyError(
            cfErr?.response?.data?.message ||
              t("Item saved but custom fields failed to save"),
          );
        }
      }
      notifySuccess(t("item.updatedSuccess"));
      history.push("/items");
    } catch (err) {
      if (err.response?.status === 400) {
        notifyError(err.response?.data?.message || t("item.validation.allFieldsRequired"));
      } else if (err.response?.status === 409) {
        notifyError(err.response?.data?.message || t("Item already exists!"));
      } else {
        notifyError(err.response?.data?.message || t("item.messages.updateFailed"));
      }
    } finally {
      setLoading(false);
    }
  };

  // Build form fields array with proper ordering (memoized to update when formData changes)
  const formFields = useMemo(() => {
    const multiBizCategory = selectedBusinessIds.length > 1;

    const categorySelectOptions = multiBizCategory
      ? selectedBusinessIds.flatMap((bid) => {
          const b = businesses.find((x) => String(x._id) === String(bid));
          const labelPrefix = b?.name ? `${b.name} — ` : "";
          const list = categoriesByBusiness[bid] || [];
          const active = list.filter(
            (c) => c.status === "Active" || c.status === "active",
          );
          const opts = active.map((c) => ({
            value: `${bid}${CATEGORY_SCOPE_SEP}${c._id}`,
            label: `${labelPrefix}${c.name}`,
            key: `${bid}-${c._id}`,
          }));
          const selectedId = categoryByBusiness[bid];
          if (
            selectedId &&
            !active.find((a) => String(a._id) === String(selectedId))
          ) {
            const current = list.find((c) => String(c._id) === String(selectedId));
            if (current) {
              opts.push({
                value: `${bid}${CATEGORY_SCOPE_SEP}${current._id}`,
                label: `${labelPrefix}${current.name} (${t("common.inactive")})`,
                key: `${bid}-${current._id}-inactive`,
              });
            }
          }
          return opts;
        })
      : (() => {
          const bid = selectedBusinessIds[0];
          const list =
            categoriesByBusiness[bid] ||
            categories ||
            [];
          const active = list.filter(
            (c) => c.status === "Active" || c.status === "active",
          );
          const opts = active.map((c) => ({
            value: c._id,
            label: c.name,
            key: c._id,
          }));
          const selectedId = bid ? categoryByBusiness[bid] : "";
          if (
            selectedId &&
            !active.find((a) => String(a._id) === String(selectedId))
          ) {
            const current = list.find((c) => String(c._id) === String(selectedId));
            if (current) {
              opts.push({
                value: current._id,
                label: `${current.name} (${t("common.inactive")})`,
                key: current._id,
              });
            }
          }
          return opts;
        })();

    const fields = [
    {
      label: t("Business"),
      name: "business",
      type: "select",
      required: true,
      value:
        businesses.length === 1
          ? Array.isArray(formData.business)
            ? formData.business?.[0] ?? ""
            : formData.business ?? ""
          : formData.business,
      onChange: (value) => {
        if (businesses.length === 1) {
          handleDropdownChange("business", value ? [value] : []);
          return;
        }
        handleDropdownChange("business", value);
      },
      placeholder: t("Select Business"),
      disabled: isLoading.business || businesses.length === 1,
      isMulti: businesses.length > 1,
      error: errors.business,
      shouldShowError: !!errors.business,
      options: businesses.map((b) => ({
        value: b._id,
        label: b.name,
        key: b._id,
      })),
    },
    {
      label: t("category.title"),
      name: "category",
      type: "select",
      required: true,
      value: categoryFieldValue,
      onChange: handleCategoryChange,
      placeholder: multiBizCategory
        ? t("Select one category per business")
        : t("Select Category"),
      disabled: !selectedBusinessIds.length || isLoading.categories,
      isMulti: multiBizCategory,
      error: errors.category,
      shouldShowError: !!errors.category,
      helpText: multiBizCategory
        ? t("Pick one category from each business (e.g. Business A → Pizza, Business B → Shawarma)")
        : undefined,
      options: categorySelectOptions,
      sortOptions: false,
    },
    {
      label: t("item.code"),
      name: "itemCode",
      type: "text",
      required: false,
      placeholder: t("Leave empty for auto-generation"),
      value: formData.itemCode,
      onChange: handleInputChange,
      helpText: t("SKU / Internal Reference — leave empty to auto-generate"),
    },
    {
      label: t("Barcode"),
      name: "barcode",
      type: "text",
      required: false,
      placeholder: t("Enter barcode"),
      value: formData.barcode,
      onChange: handleInputChange,
      helpText: t("Used for scanning in receiving, picking, and inventory counts"),
    },
    {
      label: t("category.name"),
      name: "name",
      type: "text",
      required: true,
      placeholder: t("item.validation.enterName"),
      value: formData.name,
      onChange: handleInputChange,
    },
    {
      label: t("Product Type"),
      name: "productType",
      type: "select",
      required: true,
      value: formData.productType || "consumable",
      onChange: (value) => handleDropdownChange("productType", value),
      placeholder: t("Select Product Type"),
      helpText: t("Stockable = tracked inventory · Consumable = not tracked · Service = non-physical"),
      options: [
        { value: "stockable", label: t("Stockable Product (inventory tracked)") },
        { value: "consumable", label: t("Consumable Product (not tracked)") },
        { value: "service", label: t("Service (non-physical)") },
      ],
    },
    {
      label: t("Unit"),
      name: "unit",
      type: "select",
      required: true,
      value: formData.unit,
      onChange: (value) => handleDropdownChange("unit", value),
      placeholder: t("Select Unit"),
      options: MEASURING_UNITS.map((unit) => ({
        value: unit,
        label: unit,
      })),
    },
    {
      label: t("UOM"),
      name: "uom",
      type: "text",
      required: false,
      placeholder: t("Enter UOM (Unit of Measure)"),
      value: formData.uom,
      onChange: handleInputChange,
    },
    {
      label: t("Purchase Unit"),
      name: "purchaseUnit",
      type: "select",
      required: false,
      value: formData.purchaseUnit,
      onChange: (value) => handleDropdownChange("purchaseUnit", value),
      placeholder: t("Select Purchase Unit"),
      helpText: t("Unit this item is ordered from a vendor in (defaults to the stock unit)."),
      options: [
        { value: "", label: t("Same as stock unit") },
        ...MEASURING_UNITS.map((unit) => ({ value: unit, label: t(unit) })),
      ],
    },
    {
      label: t("Weight"),
      name: "weight",
      type: "number",
      required: false,
      placeholder: t("e.g. 1.5"),
      value: formData.weight,
      onChange: handleInputChange,
      min: 0,
      step: "0.01",
      helpText: t("Optional product weight for logistics"),
    },
    ...(formData.productType === "stockable"
      ? [
          {
            label: t("Tracking Method"),
            name: "trackingMethod",
            type: "select",
            required: false,
            value: formData.trackingMethod || "none",
            onChange: (value) => handleDropdownChange("trackingMethod", value),
            helpText: t("Lot / Serial tracking will be used in warehouse operations"),
            options: [
              { value: "none", label: t("No Tracking") },
              { value: "lot", label: t("By Lot Number") },
              { value: "serial", label: t("By Serial Number") },
            ],
          },
          {
            label: t("Costing Method"),
            name: "costingMethod",
            type: "select",
            required: false,
            value: formData.costingMethod || "average",
            onChange: (value) => handleDropdownChange("costingMethod", value),
            helpText: t(
              "Average updates cost from receipts; Standard keeps catalog cost price",
            ),
            options: [
              { value: "average", label: t("Average Cost (AVCO)") },
              { value: "standard", label: t("Standard Cost") },
            ],
          },
        ]
      : []),
    {
      label: t("Inventory Role"),
      name: "itemKind",
      type: "select",
      required: false,
      value: formData.itemKind || "sale",
      onChange: (value) => handleDropdownChange("itemKind", value),
      placeholder: t("Select Inventory Role"),
      helpText: t("Determines how this product is used for inventory & compositions"),
      options: [
        { value: "sale", label: t("Finished Product (sold to customers)") },
        { value: "raw_material", label: t("Component / Raw Material (purchased)") },
        { value: "sub_ingredient", label: t("Component Variant (portion of a component)") },
      ],
    },
    ...(formData.itemKind === "raw_material"
      ? [
          {
            label: t("Reorder Level"),
            name: "inventory.reorderLevel",
            type: "number",
            required: false,
            placeholder: t("e.g. 10"),
            value: formData.inventory.reorderLevel,
            onChange: handleInputChange,
            min: 0,
            step: "0.01",
            helpText: t("Minimum stock level that triggers reordering"),
          },
          {
            label: t("Maximum Stock"),
            name: "inventory.maxStock",
            type: "number",
            required: false,
            placeholder: t("e.g. 100"),
            value: formData.inventory.maxStock,
            onChange: handleInputChange,
            min: 0,
            step: "0.01",
            helpText: t(
              "Target stock — suggested order qty = max − current (unless fixed reorder qty is set)",
            ),
          },
          {
            label: t("Reorder Quantity"),
            name: "inventory.reorderQty",
            type: "number",
            required: false,
            placeholder: t("e.g. 50"),
            value: formData.inventory.reorderQty,
            onChange: handleInputChange,
            min: 0,
            step: "0.01",
            helpText: t(
              "Optional fixed quantity to order (overrides max − current when set)",
            ),
          },
          {
            label: t("Preferred Vendor"),
            name: "inventory.preferredVendor",
            type: "select",
            required: false,
            value: formData.inventory.preferredVendor,
            onChange: (value) =>
              handleDropdownChange("inventory.preferredVendor", value),
            placeholder: t("Select Vendor"),
            disabled: !primaryBusinessId,
            options: [
              { value: "", label: t("Select Vendor") },
              ...vendors.map((v) => ({
                value: v._id,
                label:
                  v.basicInformation?.vendorDisplayName ||
                  v.basicInformation?.companyName ||
                  t("Unnamed Vendor"),
                key: v._id,
              })),
            ],
          },
        ]
      : []),
    ...(formData.itemKind === "sub_ingredient"
      ? [
          {
            label: t("Parent Component"),
            name: "parentIngredient",
            type: "select",
            required: true,
            value: formData.parentIngredient,
            onChange: (value) => handleDropdownChange("parentIngredient", value),
            placeholder: t("Select Component"),
            disabled: !primaryBusinessId,
            helpText: t("The component this variant is a portion of"),
            error: errors.parentIngredient,
            shouldShowError: !!errors.parentIngredient,
            options: [
              { value: "", label: t("Select Component") },
              ...rawMaterialItems.map((it) => ({
                value: it._id,
                label: `${it.name}${it.unit ? ` (${it.unit})` : ""}`,
                key: it._id,
              })),
            ],
          },
          {
            label: t("Conversion Factor"),
            name: "conversionFactor",
            type: "number",
            required: false,
            placeholder: t("e.g. 0.25"),
            value: formData.conversionFactor,
            onChange: handleInputChange,
            min: 0,
            step: "0.0001",
            helpText:
              t("How many units of the parent component equal 1 unit of this item (e.g. 1 Quarter = 0.25 Whole)"),
          },
        ]
      : []),
    ...(itemBusinessId
      ? [
          {
            type: "raw-custom",
            name: "__cf_uom_inline__",
            fullWidth: false,
            colSpan: 2,
            component: () => (
              <DynamicCustomFieldsForm
                businessId={itemBusinessId}
                module="inventory"
                screen="item"
                recordId={id || undefined}
                values={customFieldValues}
                onValuesChange={setCustomFieldValues}
                headers={headers}
                columns={2}
              />
            ),
          },
        ]
      : []),
    ];

    // Sales Information Section - checkbox first (NOT fullWidth to keep order)
    fields.push({
      label: t("Sales Information"),
      name: "salesInformation.enabled",
      type: "checkbox",
      required: false,
      value: formData.salesInformation.enabled,
      onChange: (checked) => handleCheckboxChange("salesInformation.enabled", checked),
      helpText: t("Enable to add sales information"),
      // Removed fullWidth to keep it with related fields
    });

    // Sales Information fields - only if enabled (all in sequence)
    if (formData.salesInformation.enabled) {
      fields.push(
        {
          label: t("item.sellingPrice"),
          name: "salesInformation.sellingPrice",
          type: "number",
          required: true,
          placeholder: t("Enter Selling Price"),
          value: formData.salesInformation.sellingPrice,
          onChange: handleInputChange,
          min: "0",
          step: "0.01",
          error: errors["salesInformation.sellingPrice"],
          shouldShowError: !!errors["salesInformation.sellingPrice"],
        },
        {
          label: t("category.description"),
          name: "salesInformation.description",
          type: "textarea",
          required: false,
          placeholder: t("stock.group.enterDescription"),
          value: formData.salesInformation.description,
          onChange: handleInputChange,
          // Removed fullWidth to keep it with Sales Information section
        },
        {
          label: t("Tax on this item"),
          name: "salesInformation.taxOnItem",
          type: "select",
          required: false,
          placeholder: t("Select Tax"),
          value: formData.salesInformation.taxOnItem,
          onChange: (value) => {
            setFormData((prev) => ({
              ...prev,
              salesInformation: {
                ...prev.salesInformation,
                taxOnItem: value,
              },
            }));
          },
          disabled: !selectedBusinessIds.length || isLoading.taxes,
          options: [
            { value: "", label: t("Select Tax") },
            ...taxes.map((t) => ({
              value: t._id,
              label: `${t.name} (${t.rate}%)`,
              key: t._id,
            })),
          ],
        }
      );
    }

    // Purchase Information Section - checkbox first (NOT fullWidth to keep order)
    fields.push({
      label: t("Purchase Information"),
      name: "purchaseInformation.enabled",
      type: "checkbox",
      required: false,
      value: formData.purchaseInformation.enabled,
      onChange: (checked) => handleCheckboxChange("purchaseInformation.enabled", checked),
      helpText: t("Enable to add purchase information"),
      // Removed fullWidth to keep it with related fields
    });

    // Purchase Information fields - only if enabled (all in sequence)
    if (formData.purchaseInformation.enabled) {
      fields.push(
        {
          label: t("item.costPrice"),
          name: "purchaseInformation.costPrice",
          type: "number",
          required: true,
          placeholder: t("Enter Cost Price"),
          value: formData.purchaseInformation.costPrice,
          onChange: handleInputChange,
          min: "0",
          step: "0.01",
          error: errors["purchaseInformation.costPrice"],
          shouldShowError: !!errors["purchaseInformation.costPrice"],
        },
    {
          label: t("category.description"),
          name: "purchaseInformation.description",
          type: "textarea",
          required: false,
          placeholder: t("stock.group.enterDescription"),
          value: formData.purchaseInformation.description,
          onChange: handleInputChange,
          // Removed fullWidth to keep it with Purchase Information section
        },
        {
          label: t("Tax on this item"),
          name: "purchaseInformation.taxOnItem",
          type: "select",
          required: false,
          placeholder: t("Select Tax"),
          value: formData.purchaseInformation.taxOnItem,
          onChange: (value) => {
            setFormData((prev) => ({
              ...prev,
              purchaseInformation: {
                ...prev.purchaseInformation,
                taxOnItem: value,
              },
            }));
          },
          disabled: !selectedBusinessIds.length || isLoading.taxes,
          options: [
            { value: "", label: t("Select Tax") },
            ...taxes.map((t) => ({
              value: t._id,
              label: `${t.name} (${t.rate}%)`,
              key: t._id,
            })),
          ],
        },
        {
          label: t("Vendor Product Code"),
          name: "purchaseInformation.vendorProductCode",
          type: "text",
          required: false,
          placeholder: t("Vendor's SKU / product code"),
          value: formData.purchaseInformation.vendorProductCode || "",
          onChange: handleInputChange,
          helpText: t("Supplier's own code for this product"),
        },
        {
          label: t("Lead Time (Days)"),
          name: "purchaseInformation.leadTimeDays",
          type: "number",
          required: false,
          placeholder: t("e.g. 7"),
          value: formData.purchaseInformation.leadTimeDays || "",
          onChange: handleInputChange,
          min: 0,
          step: "1",
          helpText: t("Expected days from order to receipt"),
        }
      );
    }

    // Stock Information — only for physical products (not services)
    if (formData.productType !== "service") {
      fields.push({
        label: t("Enable Inventory"),
        name: "stockInformation.enabled",
        type: "checkbox",
        required: false,
        value: formData.stockInformation.enabled,
        onChange: (checked) => handleCheckboxChange("stockInformation.enabled", checked),
        helpText: t("Enable inventory tracking (Stockable). Disable for Consumable products."),
      });

      if (formData.stockInformation.enabled) {
        fields.push({
          label: t("Stock Quantity"),
          name: "stockInformation.stock",
          type: "number",
          required: true,
          placeholder: t("Enter stock quantity"),
          value: formData.stockInformation.stock,
          onChange: handleInputChange,
          helpText: t("On-hand quantity for this product"),
          min: 0,
          step: "0.01",
          error: errors["stockInformation.stock"],
          shouldShowError: !!errors["stockInformation.stock"],
        });
      }
    }

    // Images field at the end
    fields.push({
      label: t("Images"),
      name: "images",
      type: "custom",
      component: () => (
        <ItemImageUpload
          images={formData.images}
          onImagesChange={(newImages) => {
            setFormData((prev) => ({ ...prev, images: newImages }));
          }}
          featuredImage={formData.featuredImage}
          onFeaturedImageChange={(newFeaturedImage) => {
            setFormData((prev) => ({ ...prev, featuredImage: newFeaturedImage }));
          }}
          maxImages={10}
        />
      ),
    });

    return fields;
  }, [
    formData,
    businesses,
    categories,
    categoriesByBusiness,
    categoryByBusiness,
    categoryFieldValue,
    handleCategoryChange,
    selectedBusinessIds,
    taxes,
    errors,
    isLoading.business,
    isLoading.categories,
    isLoading.taxes,
    itemBusinessId,
    id,
    customFieldValues,
    headers,
    vendors,
    rawMaterialItems,
    t,
  ]);

  if (isLoading.form) {
    return (
      <div className="p-6 bg-white min-h-screen flex items-center justify-center">
        <div className="w-16 h-16 border-4 border-t-4 border-gray-200 border-t-blue-600 rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="py-6 px-6 min-h-screen">
      <PageHeader
        title={t("item.edit")}
        showBackButton
        backFallbackPath="/items"
      />
      <Form
        formFields={formFields}
        handleSubmit={handleSubmit}
        handleCancel={exitItemsScreen}
        loading={loading}
        buttonColor={buttonColor}
        isOpen={true}
        saveButtonText={t("Save")}
        cancelButtonText={t("Cancel")}
        labelAndFieldDirection="column"
        customLabelWidth="w-full"
        fieldsPerRow={2}
        formOuterSpacingClassName="space-y-4 mt-3"
        fieldsStackSpacingClassName="space-y-4"
        fieldsRowGapClassName="gap-4"
      />
    </div>
  );
};

export default EditItemScreen;
