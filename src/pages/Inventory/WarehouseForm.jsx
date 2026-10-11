import React, { useState, useEffect, useMemo, useContext, useRef } from "react";
import axios from "axios";
import { useHistory, useParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { AdminContext } from "@/context/AdminContext";
import {
  PageHeader,
  useFormScreenExit,
  Form,
} from "@/page-layouts/index";
import { notifyError } from "@/utils/toast";
import { syncAssignedBusinessesFromApi } from "@/utils/sessionAssignedBusinesses";

const Base_URL = import.meta.env.VITE_APP_API_BASE_URL;

const WarehouseForm = () => {
  const { t } = useTranslation();
  const history = useHistory();
  const { id } = useParams();
  const exitScreen = useFormScreenExit("/warehouses");
  const { state } = useContext(AdminContext);
  const { adminInfo } = state;
  const headers = useMemo(
    () => ({
      "Content-Type": "application/json",
      authorization: `Bearer ${adminInfo?.token}`,
    }),
    [adminInfo?.token],
  );

  const tWithFallback = (key, fallback) => {
    const translated = t(key, { defaultValue: fallback });
    return translated && translated !== key ? translated : fallback;
  };

  const [businesses, setBusinesses] = useState([]);
  const [businessesLoading, setBusinessesLoading] = useState(true);
  const [isLoadingForm, setIsLoadingForm] = useState(!!id);
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState({});
  const [locations, setLocations] = useState([]);

  const [formData, setFormData] = useState({
    business: "",
    name: "",
    code: "",
    address: "",
    phone: "",
    isDefault: false,
    status: "Active",
  });

  const prevBusinessRef = useRef(null);

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

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    (async () => {
      try {
        setIsLoadingForm(true);
        const response = await axios.get(`${Base_URL}/warehouses/${id}`, {
          headers,
        });
        if (cancelled) return;
        const wh = response.data?.data;
        if (!wh) {
          notifyError(
            tWithFallback("warehouse.messages.notFound", "Warehouse not found."),
          );
          history.push("/warehouses");
          return;
        }
        prevBusinessRef.current = wh.business?._id || wh.business || "";
        setFormData({
          business: wh.business?._id || wh.business || "",
          name: wh.name || "",
          code: wh.code || "",
          address: wh.address || "",
          phone: wh.phone || "",
          isDefault: Boolean(wh.isDefault),
          status: wh.status || "Active",
        });
        setLocations(wh.locations || []);
      } catch (err) {
        notifyError(
          err?.response?.data?.message ||
            tWithFallback("warehouse.messages.fetchFailed", "Failed to load warehouse."),
        );
        history.push("/warehouses");
      } finally {
        if (!cancelled) setIsLoadingForm(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id]);

  const clearFieldError = (field) => {
    if (errors[field]) setErrors((prev) => ({ ...prev, [field]: "" }));
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    clearFieldError(name);
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const validate = () => {
    const next = {};
    if (!formData.business) {
      next.business = t("Business is required") || "Business is required";
    }
    if (!formData.name?.trim()) {
      next.name = tWithFallback("warehouse.nameRequired", "Warehouse name is required");
    }
    if (!formData.code?.trim()) {
      next.code = tWithFallback("warehouse.codeRequired", "Warehouse code is required");
    }
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleSubmit = async () => {
    if (!validate()) return false;
    setSaving(true);
    try {
      const payload = {
        business: formData.business,
        name: formData.name.trim(),
        code: formData.code.trim().toUpperCase(),
        address: formData.address?.trim() || "",
        phone: formData.phone?.trim() || "",
        isDefault: Boolean(formData.isDefault),
        status: formData.status,
      };
      if (id) {
        await axios.put(`${Base_URL}/warehouses/${id}`, payload, { headers });
      } else {
        await axios.post(`${Base_URL}/warehouses`, payload, { headers });
      }
      return { success: true };
    } catch (err) {
      throw new Error(
        err?.response?.data?.message ||
          tWithFallback(
            "warehouse.messages.saveFailed",
            "Failed to save warehouse.",
          ),
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
      onChange: (value) => {
        clearFieldError("business");
        setFormData((prev) => ({ ...prev, business: value || "" }));
      },
      placeholder: t("Select Business"),
      disabled: businessesLoading || !!id || businesses.length === 1,
      error: errors.business,
      shouldShowError: !!errors.business,
      options: [
        { value: "", label: t("Select Business") },
        ...businesses.map((b) => ({
          value: b._id,
          label: b.name,
          key: b._id,
        })),
      ],
    },
    {
      label: tWithFallback("warehouse.name", "Warehouse Name"),
      name: "name",
      type: "text",
      required: true,
      value: formData.name,
      onChange: handleInputChange,
      placeholder: tWithFallback("warehouse.namePlaceholder", "e.g. Warehouse Lahore"),
      error: errors.name,
      shouldShowError: !!errors.name,
    },
    {
      label: tWithFallback("warehouse.code", "Warehouse Code"),
      name: "code",
      type: "text",
      required: true,
      value: formData.code,
      onChange: handleInputChange,
      placeholder: tWithFallback("warehouse.codePlaceholder", "e.g. WH-LHR"),
      helpText: tWithFallback(
        "warehouse.codeHelp",
        "Short unique code used for locations (e.g. WH-LHR/Stock)",
      ),
      error: errors.code,
      shouldShowError: !!errors.code,
      disabled: !!id,
    },
    {
      label: tWithFallback("warehouse.address", "Address"),
      name: "address",
      type: "textarea",
      required: false,
      value: formData.address,
      onChange: handleInputChange,
      placeholder: tWithFallback("warehouse.addressPlaceholder", "Warehouse address"),
    },
    {
      label: t("Phone") || "Phone",
      name: "phone",
      type: "text",
      required: false,
      value: formData.phone,
      onChange: handleInputChange,
      placeholder: t("Enter phone") || "Enter phone",
    },
    {
      label: tWithFallback("warehouse.isDefault", "Default Warehouse"),
      name: "isDefault",
      type: "checkbox",
      required: false,
      value: formData.isDefault,
      onChange: (checked) =>
        setFormData((prev) => ({ ...prev, isDefault: checked })),
      helpText: tWithFallback(
        "warehouse.defaultHelp",
        "Used as the default warehouse for stock operations in this business",
      ),
    },
    {
      label: t("Status"),
      name: "status",
      type: "select",
      value: formData.status,
      onChange: (value) =>
        setFormData((prev) => ({ ...prev, status: value || "Active" })),
      options: [
        { value: "Active", label: t("common.active") || "Active" },
        { value: "Inactive", label: t("common.inactive") || "Inactive" },
      ],
    },
  ];

  if (isLoadingForm) {
    return (
      <div className="p-6 bg-white min-h-screen flex items-center justify-center">
        <div className="w-16 h-16 border-4 border-t-4 border-gray-200 border-t-blue-600 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="py-6 px-6 min-h-screen">
      <PageHeader
        title={
          id
            ? tWithFallback("warehouse.edit", "Edit Warehouse")
            : tWithFallback("warehouse.add", "Add Warehouse")
        }
        description={tWithFallback(
          "warehouse.formDescription",
          "Create a warehouse. Add racks, shelves, and bins yourself under Locations.",
        )}
        showBackButton
        onBackClick={exitScreen}
        backFallbackPath="/warehouses"
      />
      <Form
        formFields={formFields}
        handleSubmit={handleSubmit}
        handleCancel={exitScreen}
        isSubmitting={saving}
        submitSuccessMessage={
          id
            ? tWithFallback(
                "warehouse.messages.updatedSuccess",
                "Warehouse updated successfully",
              )
            : tWithFallback(
                "warehouse.messages.createdSuccess",
                "Warehouse created successfully",
              )
        }
        afterSubmit={exitScreen}
      />

      {id && locations.length > 0 && (
        <div className="mt-8 bg-white rounded-xl border border-gray-200 p-4">
          <h3 className="text-lg font-semibold text-gray-900 mb-2">
            {tWithFallback("warehouse.locations", "Storage Locations")}
          </h3>
          <p className="text-sm text-gray-500 mb-4">
            {tWithFallback(
              "warehouse.locationsHelp",
              "Default locations created with this warehouse. More location management coming next.",
            )}
          </p>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b text-left text-gray-600">
                  <th className="py-2 px-3">Name</th>
                  <th className="py-2 px-3">Code</th>
                  <th className="py-2 px-3">Type</th>
                </tr>
              </thead>
              <tbody>
                {locations.map((loc) => (
                  <tr key={loc._id} className="border-b">
                    <td className="py-2 px-3">{loc.name}</td>
                    <td className="py-2 px-3 font-mono text-xs">{loc.code}</td>
                    <td className="py-2 px-3 capitalize">{loc.locationType}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

export default WarehouseForm;
