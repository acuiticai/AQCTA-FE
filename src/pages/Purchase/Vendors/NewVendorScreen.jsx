import React, { useState, useEffect, useRef, useMemo, useContext } from "react";
import { useTranslation } from "react-i18next";
import { useParams, useHistory } from "react-router-dom";
import axios from "axios";
import BasicInformation from "./components/BasicInformation";
import OtherDetailsWithTabs from "./components/OtherDetailsWithTabs";
import { notifySuccess, notifyError } from "@/utils/toast";
import { PageHeader, CustomModal } from "@/page-layouts";
import { FiCheckCircle, FiKey, FiShield, FiCopy, FiCheck } from "react-icons/fi";
import { Tooltip } from "react-tooltip";
import ModuleAccessGate from "@/components/ModuleAccessGate";
import {
  PERMISSION_ACTION,
} from "@/utils/permissionUtils";
import { AdminContext } from "@/context/AdminContext";
import { persistCustomFieldValuesByBusiness } from "@/utils/customFieldPersistence";

const Base_URL = import.meta.env.VITE_APP_API_BASE_URL;

function normalizeBusinessIdList(businessData) {
  if (!businessData) return [];
  if (Array.isArray(businessData)) {
    return businessData
      .map((b) =>
        typeof b === "object" && b !== null ? b?.value ?? b?._id ?? b?.id : b,
      )
      .filter(Boolean)
      .map(String);
  }
  return [String(businessData)].filter((id) => id && id !== "undefined");
}

/** Normalize vendor business field to string[] for multi-select and API payloads. */
function normalizeVendorBusinessIds(businessIdsFromApi, vendorDataBusiness) {
  const toStrings = (arr) =>
    (Array.isArray(arr) ? arr : [])
      .map((x) => {
        if (x == null || x === "") return null;
        if (typeof x === "object") return String(x._id ?? x.value ?? x.id ?? "");
        return String(x);
      })
      .filter((id) => id && id !== "undefined");

  if (businessIdsFromApi?.length) {
    return toStrings(businessIdsFromApi);
  }
  const vb = vendorDataBusiness;
  if (Array.isArray(vb) && vb.length > 0) {
    return toStrings(vb);
  }
  if (vb && typeof vb === "object" && (vb._id || vb.value || vb.id)) {
    return [String(vb._id ?? vb.value ?? vb.id)].filter(Boolean);
  }
  if (vb != null && vb !== "") {
    return [String(vb)].filter((id) => id && id !== "undefined");
  }
  return [];
}

function extractVendorIdFromCreateResponse(response) {
  const body = response?.data;
  if (!body) return null;
  if (body.data?._id) return String(body.data._id);
  const first = body.details?.createdVendors?.[0];
  if (first?.vendorId) return String(first.vendorId);
  return null;
}

// Omit companyRegistrationNumber when empty or when vendor type is Individual (avoids E11000 unique index)
const getBasicInfoForPayload = (basicInfoData) => {
  if (!basicInfoData) return basicInfoData;
  const payload = { ...basicInfoData };
  const isIndividual = payload.vendorType === "Individual";
  const crnEmpty = !payload.companyRegistrationNumber?.trim();
  if (isIndividual || crnEmpty) {
    delete payload.companyRegistrationNumber;
  } else {
    payload.companyRegistrationNumber = payload.companyRegistrationNumber.trim();
  }
  return payload;
};

const NewVendorScreen = () => {
  const { t } = useTranslation();
  const history = useHistory();
  const { id: vendorId } = useParams();
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
  console.log("new vendor screen");

  console.log("vendorId", vendorId);

  const [formData, setFormData] = useState({
    business: [], // Changed from string to array for multi-select
    basicInformation: {
      business: [], // Changed from string to array
      primaryContact: { salutation: "", firstName: "", lastName: "" },
      vendorType: "",
      companyName: "",
      vendorDisplayName: "",
      vendorEmail: "",
      vendorPhone: { workPhone: "", mobile: "" },
      currency: "",
      vendorCode: "",
    },
    companyInfo: {},
    keyContacts: [],
    bankInfo: {},
    riderDetails: {
      icNumber: "",
      bikeRegistrationNumber: "",
    },
    documents: [],
  });

  const [businesses, setBusinesses] = useState([]);
  const [relatedRecords, setRelatedRecords] = useState([]);
  const submittingRef = useRef(false);
  const [credentialModalOpen, setCredentialModalOpen] = useState(false);
  const [generatedCredential, setGeneratedCredential] = useState(null);
  const [isGeneratingCredential, setIsGeneratingCredential] = useState(false);
  const [copiedCredential, setCopiedCredential] = useState(false);

  // ✅ Fetch businesses from localStorage
  useEffect(() => {
    const storedBusinesses = localStorage.getItem("businesses");
    if (storedBusinesses) {
      try {
        setBusinesses(JSON.parse(storedBusinesses));
      } catch (error) {
        console.error("Error parsing businesses from localStorage:", error);
      }
    }
  }, []);

  // ✅ Fetch vendor details if editing
  useEffect(() => {
    if (vendorId) {
      setIsEditMode(true);
      fetchVendorData(vendorId);
    } else {
      setLoading(false);
    }
  }, [vendorId]);

  // Clear dependent fields when business selection changes
  useEffect(() => {
    // Check if business is empty based on whether we're editing or creating
    const isBusinessEmpty = vendorId
      ? !formData.business ||
        formData.business === "" ||
        (Array.isArray(formData.business) && formData.business.length === 0)
      : !formData.business || formData.business.length === 0;

    if (isBusinessEmpty && !vendorId) {
      setFormData((prev) => ({
        ...prev,
        basicInformation: {
          business: [],
          primaryContact: { salutation: "", firstName: "", lastName: "" },
          vendorType: "",
          companyName: "",
          vendorDisplayName: "",
          vendorEmail: "",
          vendorPhone: { workPhone: "", mobile: "" },
          vendorCode: "",
        },
      }));
    }
  }, [formData.business, vendorId]);
  const fetchVendorData = async (id) => {
    try {
      const [vendorRes, relatedRes] = await Promise.all([
        axios.get(`${Base_URL}/vendors/${id}`),
        axios.get(`${Base_URL}/vendors/${id}/related-businesses`),
      ]);
      const vendorData = vendorRes.data?.data;

      if (!vendorData) {
        notifyError(t("vendor.vendorNotFound"));
        return;
      }

      const { businessIds = [], records = [] } = relatedRes.data || {};
      setRelatedRecords(records);

      const businessValue = normalizeVendorBusinessIds(
        businessIds,
        vendorData.business,
      );

      setFormData({
        ...vendorData,
        business: businessValue,
        basicInformation: {
          ...vendorData.basicInformation,
          business: businessValue,
        },
        vendorFirstName:
          vendorData.basicInformation?.primaryContact?.firstName || "",
        riderDetails: {
          icNumber: vendorData?.riderDetails?.icNumber || "",
          bikeRegistrationNumber:
            vendorData?.riderDetails?.bikeRegistrationNumber || "",
        },
      });

      setLoading(false);
    } catch (error) {
      notifyError(t("vendor.fetchDetailsFailed"));
      setLoading(false);
    }
  };
  const handleBasicInformationChange = (data) => {
    console.log("🔄 Business Updated in Parent Component:", data.business);
    console.log('🔄 Vendor BasicInformation onChange called with:', {
      region: data.region,
      regionCoordinates: data.regionCoordinates,
      allData: data
    })

    const { riderDetails, ...basicInfoData } = data;
    setFormData((prev) => ({
      ...prev,
      business: basicInfoData.business || prev.business, // ✅ Ensure business updates
      basicInformation: { ...prev.basicInformation, ...basicInfoData },
      riderDetails: {
        ...(prev.riderDetails || {}),
        ...(riderDetails || {}),
      },
    }));
  };

  // ✅ Save Basic Information Separately
  const handleBasicInfoSave = async (dataFromForm, options = {}) => {
    const { customFieldValuesByBusiness = {} } = options;
    if (submittingRef.current) return;
    submittingRef.current = true;
    try {
      // Merge form data - use dataFromForm if provided, otherwise use formData
      const { riderDetails: riderDetailsFromForm, ...basicInfoFromForm } =
        dataFromForm || {};
      const basicInfoData = dataFromForm
        ? { ...formData.basicInformation, ...basicInfoFromForm }
        : formData.basicInformation;
      const riderDetailsData = {
        ...(formData.riderDetails || {}),
        ...(riderDetailsFromForm || {}),
      };
      const businessData = dataFromForm?.business || formData.business
      
      if (!businessData || (Array.isArray(businessData) && businessData.length === 0)) {
        notifyError(t("vendor.selectAtLeastOneBusiness"));
        submittingRef.current = false;
        return;
      }

      console.log('💾 Saving vendor with region data:', {
        region: basicInfoData.region,
        regionCoordinates: basicInfoData.regionCoordinates,
        fullBasicInfo: basicInfoData
      })

      if (!vendorId) {
        // Creating new vendor(s)
        const basicInfoForApi = getBasicInfoForPayload(basicInfoData);
        if (Array.isArray(businessData) && businessData.length === 1) {
          // Single business - use existing endpoint
          const payload = {
            business: businessData[0],
            basicInformation: {
              ...basicInfoForApi,
              business: businessData[0],
            },
            riderDetails: riderDetailsData,
          };

          console.log("🚀 Saving Single Business ID:", businessData[0]);

          const response = await axios.post(`${Base_URL}/vendors`, payload, {
            headers,
          });

          console.log("response vendors", response);
          const newVendorId = extractVendorIdFromCreateResponse(response);
          const cfBids = normalizeBusinessIdList(businessData);
          if (newVendorId && cfBids.length) {
            try {
              await persistCustomFieldValuesByBusiness({
                headers,
                recordId: newVendorId,
                businessIds: cfBids,
                valuesByBusiness: customFieldValuesByBusiness,
                module: "purchase",
                screen: "customer",
              });
            } catch (cfErr) {
              notifyError(
                cfErr?.response?.data?.message ||
                  t("vendor.customFieldsCreateFailed"),
              );
              submittingRef.current = false;
              return;
            }
          }
          notifySuccess(t("vendor.createdSuccess"));
          // Redirect to vendor list screen
          history.push("/Vendors");
        } else {
          // Multiple businesses - use new endpoint
          const payload = {
            business: businessData,
            basicInformation: {
              ...basicInfoForApi,
              business: businessData,
            },
            riderDetails: riderDetailsData,
          };

          console.log("🚀 Saving Multiple Business IDs:", formData.business);

          const response = await axios.post(
            `${Base_URL}/vendors/multiple-businesses`,
            payload,
            {
              headers,
            }
          );

          const { summary, results } = response.data;
          if (summary.created > 0 || summary.linked > 0) {
            const count = summary.created > 0 ? summary.created : summary.linked;
            const newVId = extractVendorIdFromCreateResponse(response);
            const cfBids = normalizeBusinessIdList(businessData);
            if (newVId && cfBids.length) {
              try {
                await persistCustomFieldValuesByBusiness({
                  headers,
                  recordId: newVId,
                  businessIds: cfBids,
                  valuesByBusiness: customFieldValuesByBusiness,
                  module: "purchase",
                  screen: "customer",
                });
              } catch (cfErr) {
                notifyError(
                  cfErr?.response?.data?.message ||
                    t("vendor.customFieldsSaveFailed"),
                );
                submittingRef.current = false;
                return;
              }
            }
            notifySuccess(
              summary.skipped > 0
                ? t("vendor.multiBusinessAdded", { count, skipped: summary.skipped })
                : t("vendor.addedToAllBusinesses")
            );
            history.push("/Vendors");
          } else {
            const firstMessage = results?.[0]?.message || response.data?.message;
            notifyError(firstMessage || t("vendor.existsInBusinesses"));
          }
        }
      } else {
        // Editing existing vendor - handle multi-business add/remove
        const newBusinessIds = Array.isArray(businessData)
          ? businessData.map((b) => (typeof b === "object" ? b?.value ?? b?._id : b)?.toString()).filter(Boolean)
          : businessData ? [businessData.toString()] : [];
        // Collect all business IDs from both `business` and `businesses` fields (single-record model)
        const prevBusinessIds = [];
        relatedRecords.forEach((r) => {
          const bid = (r.business?._id || r.business)?.toString();
          if (bid && !prevBusinessIds.includes(bid)) prevBusinessIds.push(bid);
          if (Array.isArray(r.businesses)) {
            r.businesses.forEach((b) => {
              const bId = (b._id || b)?.toString();
              if (bId && !prevBusinessIds.includes(bId)) prevBusinessIds.push(bId);
            });
          }
        });

        const toRemove = prevBusinessIds.filter((bid) => !newBusinessIds.includes(bid));
        const toAdd = newBusinessIds.filter((bid) => !prevBusinessIds.includes(bid));

        if (newBusinessIds.length === 0) {
          notifyError(t("vendor.atLeastOneBusinessRequired"));
          submittingRef.current = false;
          return;
        }

        const basicInfoForApi = getBasicInfoForPayload(basicInfoData);

        // 1. Unlink businesses from the single vendor record (do NOT delete the whole record)
        const mainRecord = relatedRecords[0];
        for (const businessId of toRemove) {
          if (mainRecord?._id) {
            await axios.delete(`${Base_URL}/vendors/${mainRecord._id}/businesses/${businessId}`);
          }
        }

        // 2. Add to new businesses
        if (toAdd.length > 0) {
          const addPayload = {
            business: toAdd,
            basicInformation: { ...basicInfoForApi, business: toAdd },
            companyInfo: formData.companyInfo,
            keyContacts: formData.keyContacts,
            bankInfo: formData.bankInfo,
            riderDetails: riderDetailsData,
          };
          await axios.post(`${Base_URL}/vendors/multiple-businesses`, addPayload, {
            headers,
          });
        }

        // 3. Update the single vendor record
        const updatePayload = {
          basicInformation: basicInfoForApi,
          companyInfo: formData.companyInfo,
          keyContacts: formData.keyContacts,
          bankInfo: formData.bankInfo,
          riderDetails: riderDetailsData,
        };
        if (mainRecord?._id) {
          await axios.put(`${Base_URL}/vendors/${mainRecord._id}`, updatePayload, {
            headers,
          });
        }

        const recordIdForCf = vendorId || mainRecord?._id;
        if (recordIdForCf) {
          try {
            await persistCustomFieldValuesByBusiness({
              headers,
              recordId: recordIdForCf,
              businessIds: newBusinessIds,
              valuesByBusiness: customFieldValuesByBusiness,
              module: "purchase",
              screen: "customer",
            });
          } catch (cfErr) {
            notifyError(
              cfErr?.response?.data?.message ||
                t("vendor.customFieldsUpdateFailed"),
            );
            submittingRef.current = false;
            return;
          }
        }

        notifySuccess(t("vendor.basicInfoUpdated"));
        history.push("/Vendors");
      }
    } catch (error) {
      const msg = error.response?.data?.message;
        if (error.response?.status === 409 || (msg && msg.toLowerCase().includes("already exists"))) {
          notifyError(msg || t("vendor.existsInBusinesses"));
        } else {
          notifyError(msg || t("vendor.saveBasicInfoFailed"));
        }
    } finally {
      submittingRef.current = false;
    }
  };

  const handleTabSave = async (key, data, options = {}) => {
    try {
      let updatedFormData = { ...formData, [key]: data };

      if (!vendorId) {
        const response = await axios.post(
          `${Base_URL}/vendors`,
          updatedFormData,
          {
            headers: { "Content-Type": "application/json" },
          }
        );
        console.log("response vendors", response);
        notifySuccess(t("vendor.createdSuccess"));
        // Redirect to vendor list screen
        history.push("/Vendors");
      } else {
        await axios.put(
          `${Base_URL}/vendors/${vendorId}`,
          { [key]: data },
          {
            headers: { "Content-Type": "application/json" },
          }
        );

        setFormData((prev) => ({ ...prev, [key]: data }));

        // Use custom success message if provided (e.g. for bank info delete)
        const successMessage = options.successMessage;
        if (successMessage) {
          notifySuccess(successMessage);
        } else {
          const formattedKey = key.replace(/([a-z])([A-Z])/g, "$1 $2");
          const capitalizedKey =
            formattedKey.charAt(0).toUpperCase() + formattedKey.slice(1);
          notifySuccess(t("vendor.sectionUpdated", { section: capitalizedKey }));
        }
      }
    } catch (error) {
      const formattedKey = key.replace(/([a-z])([A-Z])/g, "$1 $2");
      const capitalizedKey =
        formattedKey.charAt(0).toUpperCase() + formattedKey.slice(1);

      notifyError(t("vendor.sectionUpdateFailed", { section: capitalizedKey }));
    }
  };

  const handleSendCredential = async () => {
    if (!vendorId) return;
    try {
      setIsGeneratingCredential(true);
      const response = await axios.post(
        `${Base_URL}/vendors/${vendorId}/send-rider-credential`
      );

      const payload = response?.data?.data;
      if (!payload?.username || !payload?.password) {
        notifyError(t("vendor.credential.incompleteResponse"));
        return;
      }

      setGeneratedCredential({
        vendorName: formData?.basicInformation?.vendorDisplayName || "Vendor",
        username: payload.username,
        password: payload.password,
        maxActiveSlots: payload.maxActiveSlots,
      });
      setCredentialModalOpen(true);

      setFormData((prev) => ({
        ...prev,
        riderAuth: {
          ...(prev?.riderAuth || {}),
          username: payload.username,
          isEnabled: true,
        },
      }));

      notifySuccess(t("vendor.credential.generatedSuccess"));
    } catch (error) {
      notifyError(error?.response?.data?.message || t("vendor.credential.generateFailed"));
    } finally {
      setIsGeneratingCredential(false);
    }
  };

  const handleCopyCredential = async () => {
    if (!generatedCredential) return;
    const credentialText = [
      `Vendor: ${generatedCredential.vendorName || ""}`,
      `Username: ${generatedCredential.username || ""}`,
      `Password: ${generatedCredential.password || ""}`,
      `Max Active Slots: ${generatedCredential.maxActiveSlots ?? ""}`,
    ].join("\n");

    try {
      await navigator.clipboard.writeText(credentialText);
      notifySuccess(t("vendor.credential.credentialCopied"));
      setCopiedCredential(true);
      setTimeout(() => setCopiedCredential(false), 1800);
    } catch (error) {
      notifyError(t("vendor.credential.copyFailed"));
    }
  };

  const otherDetailsTabInitialData = useMemo(
    () => ({
      keyContacts: formData.keyContacts || [],
      addresses: formData.addresses || [],
      bankInfo: formData.bankInfo || {},
      documents: formData.documents || [],
    }),
    [
      formData.keyContacts,
      formData.addresses,
      formData.bankInfo,
      formData.documents,
    ],
  );

  return (
    <ModuleAccessGate
      moduleName="Purchase"
      subModuleName="Vendors"
      title={t("vendor.title")}
      requiredPermission={
        vendorId ? PERMISSION_ACTION.UPDATE : PERMISSION_ACTION.ADD
      }
    >
    <div className="py-6 px-6 min-h-screen max-w-full min-w-0 overflow-x-hidden">
      <PageHeader
        title={isEditMode ? t("vendor.editVendor") : t("vendor.newVendor")}
        showBackButton
        backFallbackPath="/Vendors"
      />

      <BasicInformation
        onChange={handleBasicInformationChange}
        onSave={handleBasicInfoSave}
        businesses={businesses}
        initialData={{
          ...formData.basicInformation,
          riderDetails: formData.riderDetails || {},
          business: formData.business ?? formData.basicInformation?.business ?? (isEditMode ? "" : []),
        }}
        isEditMode={isEditMode}
        vendorId={vendorId || undefined}
        className="mb-5"
      />
      {/*
      {isEditMode && (
        <div className="my-6 flex items-center justify-between gap-3 rounded-md border border-gray-200 bg-gray-50 p-3">
          <div className="flex items-center gap-2 text-sm">
            {formData?.riderAuth?.isEnabled ? (
              <>
                <FiCheckCircle className="text-emerald-600" />
                <span className="font-medium text-emerald-700">
                  Rider Portal Access Enabled
                </span>
              </>
            ) : (
              <>
                <FiShield className="text-amber-600" />
                <span className="font-medium text-amber-700">
                  Rider Portal Access Not Enabled
                </span>
              </>
            )}
          </div>
          <button
            type="button"
            className="inline-flex items-center gap-2 rounded-md bg-[var(--p-blue)] px-3 py-1.5 text-sm text-white disabled:opacity-60"
            onClick={handleSendCredential}
            disabled={isGeneratingCredential}
          >
            <FiKey />
            {isGeneratingCredential
              ? "Generating..."
              : formData?.riderAuth?.isEnabled
              ? "Regenerate Credential"
              : "Enable Portal"}
          </button>
        </div>
      )}
      */}

      {isEditMode && !loading && (
        <div className="mt-4">
          <OtherDetailsWithTabs
            initialData={otherDetailsTabInitialData}
            businessId={Array.isArray(formData.business) ? formData.business[0] : formData.business}
            vendorId={vendorId}
            customerId={vendorId}
            onTabSave={handleTabSave}
            vendorFirstName={formData.vendorFirstName}
          />
        </div>
      )}

      <CustomModal
        open={credentialModalOpen}
        onClose={() => {
          setCredentialModalOpen(false);
          setCopiedCredential(false);
        }}
        title={t("vendor.credential.title")}
        width="380px"
        showActions={true}
        actions={[
          {
            label: t("common.close"),
            secondary: true,
            onClick: () => {
              setCredentialModalOpen(false);
              setCopiedCredential(false);
            },
          },
        ]}
      >
        {generatedCredential ? (
          <div className="space-y-2 text-sm">
            <div className="flex justify-end">
              <button
                type="button"
                data-tooltip-id="copy-credential-tooltip-edit"
                data-tooltip-content={
                  copiedCredential ? t("vendor.credential.copied") : t("vendor.credential.copyCredentials")
                }
                onClick={handleCopyCredential}
                className={`inline-flex items-center justify-center w-9 h-9 rounded-md border transition-colors ${
                  copiedCredential
                    ? "text-emerald-600 border-emerald-200 bg-emerald-50"
                    : "text-gray-600 border-gray-300 hover:bg-gray-100"
                }`}
              >
                {copiedCredential ? <FiCheck /> : <FiCopy />}
              </button>
              <Tooltip
                id="copy-credential-tooltip-edit"
                place="top"
                delayShow={150}
                noArrow
                className="!bg-white !text-gray-800 !border !border-gray-300 !opacity-100"
                style={{ zIndex: 10000 }}
              />
            </div>
            <p>
              <strong>{t("vendor.credential.vendor")}:</strong> {generatedCredential.vendorName}
            </p>
            <p>
              <strong>{t("vendor.credential.username")}:</strong> {generatedCredential.username}
            </p>
            <p>
              <strong>{t("vendor.credential.password")}:</strong> {generatedCredential.password}
            </p>
            <p>
              <strong>{t("vendor.credential.maxActiveSlots")}:</strong> {generatedCredential.maxActiveSlots}
            </p>
          </div>
        ) : null}
      </CustomModal>
    </div>
    </ModuleAccessGate>
  );
};

export default NewVendorScreen;
