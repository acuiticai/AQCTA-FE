import React, { useState, useEffect, useMemo, useContext, useRef } from "react";
import { useTranslation } from "react-i18next";
import { useParams, useHistory, useLocation } from "react-router-dom";
import axios from "axios";
import BasicInformation, {
  buildPciBasicInformationPayload,
} from "./components/BasicInformation";
import {
  mergeEInvoiceLocationFromAddresses,
  alignEInvoiceBuyerTypeWithClientType,
} from "./components/CustomerEInvoiceInfo";
import OtherDetailsWithTabs from "./components/OtherDetailsWithTabs";
import { notifySuccess, notifyError } from "@/utils/toast";
import { AdminContext } from "@/context/AdminContext";
import { persistCustomFieldValuesByBusiness } from "@/utils/customFieldPersistence";
import { useEInvoiceEnabledMap } from "@/hooks/useBusinessEInvoiceEnabled";
import { CustomerBrandingProvider } from "@/customer/branding";
import { DetailHeader } from "@/customer/components/ui/DetailBlocks";
import "@/customer/styles/index.css";

const Base_URL = import.meta.env.VITE_APP_API_BASE_URL;

function normalizeBusinessIdList(businessData) {
  if (!businessData) return [];
  if (Array.isArray(businessData)) {
    return businessData
      .map((b) =>
        typeof b === "object" && b !== null ? b?.value ?? b?._id : b,
      )
      .filter(Boolean)
      .map(String);
  }
  return [String(businessData)].filter((id) => id && id !== "undefined");
}

/** POST /customers or /customers/multiple-businesses response → new/linked customer id */
function extractCustomerIdFromCreateResponse(response) {
  const body = response?.data;
  if (!body) return null;
  if (body.data?._id) return String(body.data._id);
  const first = body.details?.createdCustomers?.[0];
  if (first?.customerId) return String(first.customerId);
  return null;
}

const NewCustomerScreen = () => {
  const { t } = useTranslation();
  const history = useHistory();
  const location = useLocation();
  const { id } = useParams();
  const { state } = useContext(AdminContext);
  const { adminInfo } = state;
  const headers = useMemo(
    () => ({
      "Content-Type": "application/json",
      authorization: `Bearer ${adminInfo?.token}`,
    }),
    [adminInfo?.token],
  );
  const [isEditMode, setIsEditMode] = useState(false);
  const [loading, setLoading] = useState(true);
  const [config, setConfig] = useState(null);

  const [formData, setFormData] = useState({
    basicInformation: {},
    // otherDetails: {},
    companyInfo: {},
    keyContacts: [],
    shareHolders: [],
    relatedBusinesses: [],
    principleBankers: [],
    tradeReferences: [],
    business: [], // Changed from string to array for multi-select
    eInvoiceInfo: {},
    addresses: [],
  });

  useEffect(() => {
    axios
      .get(`${Base_URL}/configuration`)
      .then((response) => {
        if (response.data && response.data.length > 0) {
          console.log("📡 Configuration Fetched:", response.data[0]);
          setConfig(response.data[0]);
        }
      })
      .catch((error) => {
        notifyError(t("customer.configFetchFailed"));
        console.error("Configuration fetch error:", error);
      });
  }, []);

  // Auto scroll down effect when component mounts
  useEffect(() => {
    const scrollDown = () => {
      // Check if there's enough content to scroll
      const documentHeight = document.documentElement.scrollHeight;
      const windowHeight = window.innerHeight;

      if (documentHeight > windowHeight) {
        window.scrollTo({
          top: 50,
          behavior: 'smooth'
        });
      } else {
        // If not enough content, scroll to a percentage of available height
        window.scrollTo({
          top: Math.min(300, documentHeight * 0.3),
          behavior: 'smooth'
        });
      }
    };

    // Try multiple times with different delays to ensure it works
    const timer1 = setTimeout(scrollDown, 100);
    const timer2 = setTimeout(scrollDown, 500);
    const timer3 = setTimeout(scrollDown, 1000);

    return () => {
      clearTimeout(timer1);
      clearTimeout(timer2);
      clearTimeout(timer3);
    };
  }, []);

  const [businesses, setBusinesses] = useState([]);


  useEffect(() => {
    if (id) {
      setIsEditMode(true);
      fetchCustomerDetails(id);
    } else {
      setLoading(false);
    }

    const storedBusinesses = localStorage.getItem("businesses");
    if (storedBusinesses) {
      try {
        setBusinesses(JSON.parse(storedBusinesses));
      } catch (error) {
        console.error("Error parsing businesses from localStorage:", error);
      }
    }
  }, [id]);

  console.log("rendering...");

  const [relatedRecords, setRelatedRecords] = useState([]); // { _id, business } for add/remove
  /** E-invoice row saved when switching Individual → Company; restored on switch back. */
  const individualEInvoiceSnapshotRef = useRef(null);

  useEffect(() => {
    individualEInvoiceSnapshotRef.current = null;
  }, [id]);

  const businessIdsForEInvoice = useMemo(
    () => normalizeBusinessIdList(formData.business),
    [formData.business],
  );
  const { eInvoiceByBusiness } = useEInvoiceEnabledMap(businessIdsForEInvoice);
  const showEInvoiceForCustomer = useMemo(() => {
    if (!businessIdsForEInvoice.length) return false;
    return businessIdsForEInvoice.some((bid) => eInvoiceByBusiness[bid] !== false);
  }, [businessIdsForEInvoice, eInvoiceByBusiness]);

  const otherDetailsInitialTab =
    location.state?.openTab === "addresses"
      ? showEInvoiceForCustomer
        ? 2
        : 1
      : 0;

  const fetchCustomerDetails = async (customerId) => {
    try {
      individualEInvoiceSnapshotRef.current = null;
      const [customerRes, relatedRes] = await Promise.all([
        axios.get(`${Base_URL}/customers/${customerId}`),
        axios.get(`${Base_URL}/customers/${customerId}/related-businesses`),
      ]);
      const customer = customerRes.data?.data ?? customerRes.data;
      if (!customer) {
        notifyError(t("customer.fetchDetailsFailed"));
        setLoading(false);
        return;
      }

      const { businessIds = [], records = [] } = relatedRes.data || {};
      setRelatedRecords(records);

      const rawAddresses = customer.addresses;
      const addresses = Array.isArray(rawAddresses)
        ? rawAddresses.map((a) => ({
          _id: a._id,
          addressType: a.addressType || "",
          addressLine1: a.addressLine1 || "",
          addressLine2: a.addressLine2 || "",
          city: a.city || "",
          state: a.state || "",
          zipCode: a.zipCode || "",
          country: a.country || "",
          phone: a.phone || "",
          fax: a.fax || "",
        }))
        : [];

      const allBusinessIds = businessIds.length > 0 ? businessIds : (customer.business?._id || customer.business ? [String(customer.business?._id || customer.business)] : []);

      const storedBiz = localStorage.getItem("businesses");
      let accessibleIds = [];
      try {
        accessibleIds = storedBiz ? JSON.parse(storedBiz).map((b) => (b._id || b).toString()) : [];
      } catch (_) {}
      const businessValue = allBusinessIds.filter((bid) => accessibleIds.includes(String(bid)));

      const basicInfo = customer.basicInformation || {};
      const rawEInvoice = customer.eInvoiceInfo || {};
      setFormData({
        basicInformation: {
          ...basicInfo,
          status: customer.status || "Active",
        },
        companyInfo: customer.companyInfo || {},
        keyContacts: (customer.keyContacts || []).map((c) => ({
          _id: c._id,
          id: c.id,
          name: c.name || "",
          position: c.position || c.designation || "",
          phone: c.phone || c.contactNumber || "",
          mobile: c.mobile || "",
          fax: c.fax || "",
          email: c.email || "",
        })),
        addresses,
        shareHolders: customer.shareholderInfo || [],
        relatedBusinesses: customer.relatedBusinesses || [],
        principleBankers: customer.principleBankers || [],
        tradeReferences: customer.tradeReferences || [],
        business: businessValue,
        eInvoiceInfo: alignEInvoiceBuyerTypeWithClientType(
          { ...rawEInvoice },
          basicInfo.client_type || "Company",
        ),
        customerFirstName:
          customer.basicInformation?.primaryContact?.firstName || "",
        status: customer.status || "Active",
      });

      setLoading(false);
    } catch (error) {
      notifyError(t("customer.fetchDetailsFailed"));
      setLoading(false);
    }
  };

  const handleBasicInfoSave = async (dataFromForm, options = {}) => {
    const { customFieldValuesByBusiness = {} } = options;
    try {
      const source = dataFromForm || {
        ...formData.basicInformation,
        business: formData.business,
        status: formData.status,
        password: "",
      };

      // Only PCI Basic Info fields go into basicInformation (explicit map)
      const basicInfoData = buildPciBasicInformationPayload(source);
      const businessData = source.business || formData.business;
      const statusValue = source.status || formData.status || "Active";
      const password = source.password || "";

      // Check if business is selected (array or string)
      const businessIsValid = Array.isArray(businessData)
        ? businessData.length > 0
        : businessData && businessData.toString().trim() !== "";

      if (!businessIsValid) {
        notifyError(t("customer.selectAtLeastOneBusiness"));
        return;
      }

      const withAuthFields = (payload) => {
        const next = { ...payload, status: statusValue };
        if (password && String(password).trim()) {
          next.password = String(password).trim();
        }
        return next;
      };

      console.log("💾 Saving PCI basicInformation:", basicInfoData);

      if (!id) {
        // Creating new customer
        if (Array.isArray(businessData) && businessData.length === 1) {
          // Single business - use regular endpoint
          const payload = withAuthFields({
            business: businessData[0],
            basicInformation: basicInfoData,
          });

          console.log("🚀 Saving Single Business ID:", businessData[0]);

          const response = await axios.post(`${Base_URL}/customers`, payload, {
            headers,
          });

          console.log("response customers", response);
          const newCustomerId = extractCustomerIdFromCreateResponse(response);
          const cfBusinessIds = normalizeBusinessIdList(businessData);
          if (newCustomerId && cfBusinessIds.length) {
            try {
              await persistCustomFieldValuesByBusiness({
                headers,
                recordId: newCustomerId,
                businessIds: cfBusinessIds,
                valuesByBusiness: customFieldValuesByBusiness,
                module: "sales",
                screen: "customer",
              });
            } catch (cfErr) {
              notifyError(
                cfErr?.response?.data?.message ||
                  t("customer.customFieldsCreateFailed"),
              );
              return;
            }
          }
          notifySuccess(
            response?.data?.generatedPassword
              ? t("customer.createdWithPassword", {
                  password: response.data.generatedPassword,
                })
              : t("customer.createdSuccess"),
          );
          history.push(`/customers`);
        } else {
          // Multiple businesses - use new endpoint
          const payload = withAuthFields({
            business: businessData,
            basicInformation: basicInfoData,
          });

          console.log("🚀 Saving Multiple Business IDs:", businessData);

          const response = await axios.post(
            `${Base_URL}/customers/multiple-businesses`,
            payload,
            {
              headers,
            },
          );

          const { summary, details } = response.data;

          const getConciseReason = (skipped) => {
            const reasons = [
              ...new Set(
                skipped.map((s) => {
                  if (s.reason.includes(" – "))
                    return s.reason.split(" – ")[1].trim();
                  return s.reason.trim();
                }),
              ),
            ];

            if (reasons.length === 0) return "customer already exists";

            const formattedReasons = reasons.map((r) => {
              const lower = r.toLowerCase();
              if (lower.includes("email already exists"))
                return "customer email already exists";
              if (
                lower.includes("registration number already exists") ||
                lower.includes("reg number already exists")
              )
                return "company registration number already exists";
              return r.charAt(0).toLowerCase() + r.slice(1);
            });

            return [...new Set(formattedReasons)].join(" and ");
          };

          const skippedBusinesses = details.skippedBusinesses || [];
          const reasonText = getConciseReason(skippedBusinesses);

          if (summary.created > 0 || summary.linked > 0) {
            const count = summary.created > 0 ? summary.created : summary.linked;
            const newCustomerId = extractCustomerIdFromCreateResponse(response);
            const cfBusinessIds = normalizeBusinessIdList(businessData);
            if (newCustomerId && cfBusinessIds.length) {
              try {
                await persistCustomFieldValuesByBusiness({
                  headers,
                  recordId: newCustomerId,
                  businessIds: cfBusinessIds,
                  valuesByBusiness: customFieldValuesByBusiness,
                  module: "sales",
                  screen: "customer",
                });
              } catch (cfErr) {
                notifyError(
                  cfErr?.response?.data?.message ||
                    t("customer.customFieldsSaveFailed"),
                );
                return;
              }
            }
            if (summary.skipped > 0) {
              notifySuccess(
                response?.data?.generatedPassword
                  ? `${t("customer.multiBusinessAdded", {
                      count,
                      unit:
                        count === 1
                          ? t("customer.businessUnit")
                          : t("customer.businessesUnit"),
                      skipped: summary.skipped,
                      reason: reasonText,
                    })} ${t("customer.tempPasswordSuffix", {
                      password: response.data.generatedPassword,
                    })}`
                  : t("customer.multiBusinessAdded", {
                      count,
                      unit:
                        count === 1
                          ? t("customer.businessUnit")
                          : t("customer.businessesUnit"),
                      skipped: summary.skipped,
                      reason: reasonText,
                    }),
              );
            } else {
              notifySuccess(
                response?.data?.generatedPassword
                  ? t("customer.createdWithPassword", {
                      password: response.data.generatedPassword,
                    })
                  : t("customer.addedToAllBusinesses"),
              );
            }

            history.push("/customers");
          } else {
            // All businesses were skipped
            if (reasonText.includes("email already exists")) {
              notifyError(t("customer.emailExistsAllBusinesses"));
            } else if (
              reasonText.includes("registration number already exists")
            ) {
              notifyError(t("customer.regNumberExistsAllBusinesses"));
            } else {
              notifyError(
                t("customer.existsAllBusinesses", { reason: reasonText }),
              );
            }
          }
        }
      } else {
        // Editing existing customer - handle multi-business add/remove
        const newBusinessIds = Array.isArray(businessData)
          ? businessData
              .map((b) =>
                (typeof b === "object" ? b?.value ?? b?._id : b)?.toString(),
              )
              .filter(Boolean)
          : businessData
            ? [businessData.toString()]
            : [];
        // Collect all business IDs from both `business` and `businesses` fields (single-record model)
        const prevBusinessIds = [];
        relatedRecords.forEach((r) => {
          const bid = (r.business?._id || r.business)?.toString();
          if (bid && !prevBusinessIds.includes(bid)) prevBusinessIds.push(bid);
          if (Array.isArray(r.businesses)) {
            r.businesses.forEach((b) => {
              const bId = (b._id || b)?.toString();
              if (bId && !prevBusinessIds.includes(bId))
                prevBusinessIds.push(bId);
            });
          }
        });

        const userAccessibleBusinessIds = businesses.map((b) =>
          (b._id || b).toString(),
        );
        const toRemove = prevBusinessIds.filter(
          (bid) =>
            !newBusinessIds.includes(bid) &&
            userAccessibleBusinessIds.includes(bid),
        );
        const toAdd = newBusinessIds.filter(
          (bid) => !prevBusinessIds.includes(bid),
        );

        if (newBusinessIds.length === 0) {
          notifyError(t("customer.atLeastOneBusinessRequired"));
          return;
        }

        const mainRecord = relatedRecords[0];
        for (const businessId of toRemove) {
          const recordWithBusiness = relatedRecords.find(
            (r) => (r.business?._id || r.business)?.toString() === businessId,
          );

          if (
            recordWithBusiness?._id &&
            mainRecord?._id &&
            recordWithBusiness._id.toString() !== mainRecord._id.toString()
          ) {
            await axios.delete(
              `${Base_URL}/customers/${recordWithBusiness._id}`,
            );
            continue;
          }

          if (mainRecord?._id) {
            await axios.delete(
              `${Base_URL}/customers/${mainRecord._id}/businesses/${businessId}`,
            );
          }
        }

        if (toAdd.length > 0) {
          const addPayload = withAuthFields({
            business: toAdd,
            basicInformation: basicInfoData,
          });
          await axios.post(
            `${Base_URL}/customers/multiple-businesses`,
            addPayload,
            { headers },
          );
        }

        // Update only PCI Basic Info (+ status/password) — details tabs later
        const updatePayload = withAuthFields({
          basicInformation: basicInfoData,
        });
        const updateId = mainRecord?._id || id;
        if (updateId) {
          await axios.put(`${Base_URL}/customers/${updateId}`, updatePayload, {
            headers,
          });
        }

        const recordIdForCf = id || mainRecord?._id;
        if (recordIdForCf) {
          try {
            await persistCustomFieldValuesByBusiness({
              headers,
              recordId: recordIdForCf,
              businessIds: newBusinessIds,
              valuesByBusiness: customFieldValuesByBusiness,
              module: "sales",
              screen: "customer",
            });
          } catch (cfErr) {
            notifyError(
              cfErr?.response?.data?.message ||
                t("customer.customFieldsUpdateFailed"),
            );
            return;
          }
        }

        notifySuccess(t("customer.basicInfoUpdated"));
        history.push(`/customers`);
      }
    } catch (error) {
      console.log("customer error", error);
      notifyError(
        error?.response?.data?.message || t("customer.saveBasicInfoFailed"),
      );
    }
  };

  // const handleTabSave = async (key, data) => {
  //   console.log("📡 Sending Data to API:", { key, data });

  //   try {
  //     await axios.put(`${Base_URL}/customers/${id}`, { [key]: data });

  //     console.log("✅ Successfully Updated:", key);
  //     notifySuccess(`${key.replace(/([a-z])([A-Z])/g, "$1 $2")} updated successfully!`);
  //   } catch (error) {
  //     console.error("❌ API Update Error:", error.response?.data || error);
  //     notifyError(`Failed to update ${key}.`);
  //   }
  // };

  const handleTabSave = async (key, data) => {
    console.log("📡 Sending Data to API:", { key, data });

    try {
      let requestBody;
      let eInvoicePayloadForSync = null;

      if (key === "eInvoiceInfo") {
        const payload = mergeEInvoiceLocationFromAddresses(
          data,
          formData.addresses || [],
          formData.basicInformation?.customerPhone,
        );
        requestBody = { eInvoiceInfo: payload };
        eInvoicePayloadForSync = payload;
      } else if (key === "addresses") {
        const mergedEInvoice = mergeEInvoiceLocationFromAddresses(
          formData.eInvoiceInfo || {},
          data,
          formData.basicInformation?.customerPhone,
        );
        requestBody = { addresses: data, eInvoiceInfo: mergedEInvoice };
        eInvoicePayloadForSync = mergedEInvoice;
      } else {
        requestBody = { [key]: data };
      }

      const response = await axios.put(`${Base_URL}/customers/${id}`, requestBody);
      const responseData = response.data?.data ?? response.data;

      console.log("✅ Successfully Updated:", key);

      // Update parent formData with server response so keyContacts/addresses have _id for delete to work
      if (responseData && (key === "keyContacts" || key === "addresses")) {
        const serverArray = responseData[key];
        if (Array.isArray(serverArray)) {
          setFormData((prev) => ({ ...prev, [key]: serverArray }));
        }
      }
      if (responseData && key === "eInvoiceInfo") {
        setFormData((prev) => ({
          ...prev,
          eInvoiceInfo: responseData.eInvoiceInfo ?? eInvoicePayloadForSync,
        }));
      }
      if (key === "addresses" && eInvoicePayloadForSync) {
        setFormData((prev) => ({
          ...prev,
          eInvoiceInfo: responseData?.eInvoiceInfo ?? eInvoicePayloadForSync,
        }));
      }

      // ✅ Format the key for the success message
      const formattedKey = key.replace(/([a-z])([A-Z])/g, "$1 $2"); // Add spaces between camelCase words
      const capitalizedKey =
        formattedKey.charAt(0).toUpperCase() + formattedKey.slice(1); // Capitalize the first letter

      notifySuccess(t("customer.sectionUpdated", { section: capitalizedKey }));
    } catch (error) {
      console.error("❌ API Update Error:", error.response?.data || error);

      const formattedKey = key.replace(/([a-z])([A-Z])/g, "$1 $2");
      const capitalizedKey =
        formattedKey.charAt(0).toUpperCase() + formattedKey.slice(1);

      notifyError(t("customer.sectionUpdateFailed", { section: capitalizedKey }));
    }
  };

  return (
    <CustomerBrandingProvider className="epc-admin-wizard-root">
      <div className="epc-admin-wizard">
        <DetailHeader
          title={
            isEditMode
              ? t("customer.editCustomer")
              : t("customer.newCustomer")
          }
          subtitle={
            isEditMode
              ? t("customer.editCustomerSubtitle", {
                  defaultValue:
                    "Update company details and related information for this customer.",
                })
              : t("customer.newCustomerSubtitle", {
                  defaultValue:
                    "Add company details so this customer can be used across sales and applications.",
                })
          }
          onBack={() => history.push("/customers")}
        />

        <BasicInformation
          onChange={(data) => {
            const nextBasic = buildPciBasicInformationPayload(data);
            setFormData((prev) => ({
              ...prev,
              business: data.business || prev.business,
              status: data.status || prev.status || "Active",
              basicInformation: nextBasic,
            }));
          }}
          businesses={businesses}
          initialData={{
            ...formData.basicInformation,
            business: formData.business,
            status:
              formData.status ||
              formData.basicInformation?.status ||
              "Active",
          }}
          isEditMode={isEditMode}
          onSave={handleBasicInfoSave}
          customerId={id || undefined}
        />

        {isEditMode && !loading && (
          <section className="epc-card-panel mt-4">
            <OtherDetailsWithTabs
              key={id}
              initialData={{
                eInvoiceInfo: formData.eInvoiceInfo || {},
                keyContacts: formData.keyContacts || [],
                addresses: formData.addresses || [],
              }}
              onEInvoiceInfoChange={(next) =>
                setFormData((prev) => ({ ...prev, eInvoiceInfo: next }))
              }
              clientType={formData.basicInformation?.client_type}
              customerPhone={formData.basicInformation?.customerPhone}
              customerId={id}
              businessId={
                Array.isArray(formData.business)
                  ? formData.business[0]
                  : formData.business
              }
              customerFirstName={formData.customerFirstName}
              config={config}
              onTabSave={handleTabSave}
              initialActiveTabIndex={otherDetailsInitialTab}
              showEInvoiceTab={showEInvoiceForCustomer}
            />
          </section>
        )}
      </div>
    </CustomerBrandingProvider>
  );
};

export default NewCustomerScreen;
