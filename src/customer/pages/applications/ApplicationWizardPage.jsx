import React, { useEffect, useMemo, useRef, useState } from "react";
import { useHistory, useLocation, useParams } from "react-router-dom";

import ApplicationWizard, {
  StepNote,
} from "../../components/wizard/ApplicationWizard";
import FieldStep from "./steps/FieldStep";
import ProductDetailsStep, {
  getRequiredCategoryFieldKeys,
} from "./steps/ProductDetailsStep";
import {
  CertificationDocumentsStep,
  CertificationTechnicalStep,
  InspectionTechnicalStep,
  ReviewStep,
  formatApprovalDisplay,
} from "./steps/BespokeSteps";
import {
  addressGpsByStep,
  certificationFields,
  inspectionFields,
  requiredByStep,
} from "./steps/stepFields";
import { getApplicationType } from "../../config/applicationTypes";
import { useAccount } from "../../context/AccountContext";
import { customerPath } from "../../routes/paths";
import { isEmail, isFilled, isUrl } from "../../utils/validation";
import { formatMultiValue, normalizeProductFormValues } from "../../utils/productMultiFields";
import CustomerApplicationServices from "../../services/applicationService";
import CustomerProfileServices from "../../services/profileService";
import CustomerDocumentTypeServices from "../../services/documentTypeService";
import CustomerFieldOptionServices from "../../services/fieldOptionService";
import AuthorisedContactsSection from "./steps/AuthorisedContactsSection";
import InspectionContactSection from "./steps/InspectionContactSection";
import { profileSeed } from "@/utils/applicationProfileSeed";
import {
  buildApplicationFormData,
  downloadAxiosBlob,
  resolveDocumentDownloadTemplateKey,
} from "@/utils/certificationFormData";
import {
  groupFieldOptions,
  resolveStepFields,
} from "../../utils/applicationFieldOptions";

const EMPTY_CERT_TECHNICAL = {
  components: [],
  equipment: [],
  processFlows: [],
  qcCheckpoints: [],
};

const EMPTY_INSPECTION_TECHNICAL = {};

/** Map legacy technical.references rows onto the documents checklist shape. */
const normalizeLegacyReferencesToDocuments = (refs = []) =>
  (refs || [])
    .filter((row) => row && !Array.isArray(row) && typeof row === "object")
    .map((row) => ({
      documentTypeId: row.documentTypeId || row.referenceTypeId,
      typeName: row.typeName || row.name,
      name: row.typeName || row.name,
      description: row.description || "",
      requirement: row.requirement || "Optional",
      documentName: row.documentName || row.reference || "",
      fileName: row.fileName || "",
      url: row.url || "",
      s3Key: row.s3Key || "",
      file_type: row.file_type || "",
      file_size: row.file_size || 0,
      attached: Boolean(row.attached && (row.url || row.s3Key)),
    }));

/** Normalize legacy array-of-arrays seed / older drafts into object rows. */
const normalizeCertificationTechnical = (raw = {}) => {
  const toComponents = (list) => {
    if (!Array.isArray(list) || !list.length) return [];
    return list.map((row) => {
      if (row && !Array.isArray(row) && typeof row === "object") {
        return {
          id: row.id || `cmp-${Math.random().toString(36).slice(2, 8)}`,
          item: row.item || "",
          modelBrand: row.modelBrand || "",
          specification: row.specification || "",
          manufacturer: row.manufacturer || "",
          approval: row.approval || "",
          approvalOther: row.approvalOther || "",
        };
      }
      const cells = Array.isArray(row) ? row : [];
      return {
        id: `cmp-${Math.random().toString(36).slice(2, 8)}`,
        item: cells[0] || "",
        modelBrand: "",
        specification: cells[1] || "",
        manufacturer: cells[2] || "",
        approval: cells[3] || "",
        approvalOther: "",
      };
    });
  };

  const toEquipment = (list) => {
    if (!Array.isArray(list) || !list.length) return [];
    return list.map((row) => {
      if (row && !Array.isArray(row) && typeof row === "object") {
        return {
          id: row.id || `eq-${Math.random().toString(36).slice(2, 8)}`,
          equipment: row.equipment || "",
          serialNo: row.serialNo || "",
          workingRange: row.workingRange || "",
          calibration: row.calibration || "",
        };
      }
      const cells = Array.isArray(row) ? row : [];
      return {
        id: `eq-${Math.random().toString(36).slice(2, 8)}`,
        equipment: cells[0] || "",
        serialNo: cells[1] || "",
        workingRange: cells[2] || "",
        calibration: cells[3] || "",
      };
    });
  };

  const processFlows = Array.isArray(raw.processFlows)
    ? raw.processFlows.map((f, index) =>
        typeof f === "object" && f
          ? {
              id: f.id || `flow-${index}`,
              flowName:
                f.flowName ||
                String(f.name || `Process flow ${index + 1}`)
                  .replace(/\.[^.]+$/, "")
                  .trim() ||
                `Process flow ${index + 1}`,
              name: f.name || `Process flow ${index + 1}`,
              url: f.url || "",
              s3Key: f.s3Key || "",
              file_type: f.file_type || "",
              file_size: f.file_size || 0,
            }
          : null,
      ).filter(Boolean)
    : [];

  let qcCheckpoints = [];
  if (Array.isArray(raw.qcCheckpoints)) {
    qcCheckpoints = raw.qcCheckpoints.map((cp, index) => {
      if (typeof cp === "object" && cp) {
        return {
          id: cp.id || `qc-${index}`,
          title: cp.title || "",
          description: cp.description || "",
          documents: Array.isArray(cp.documents)
            ? cp.documents.map((doc, docIndex) => ({
                id: doc.id || `qc-doc-${index}-${docIndex}`,
                name: doc.name || `Document ${docIndex + 1}`,
                url: doc.url || "",
                s3Key: doc.s3Key || "",
                file_type: doc.file_type || "",
                file_size: doc.file_size || 0,
              }))
            : [],
        };
      }
      return {
        id: `qc-${index}`,
        title: String(cp || ""),
        description: "",
        documents: [],
      };
    });
  } else if (typeof raw.qcCheckpoints === "number" && raw.qcCheckpoints > 0) {
    qcCheckpoints = Array.from({ length: raw.qcCheckpoints }, (_, index) => ({
      id: `qc-${index}`,
      title: "",
      description: "",
      documents: [],
    }));
  }

  return {
    components: toComponents(raw.components),
    equipment: toEquipment(raw.equipment),
    processFlows,
    qcCheckpoints,
  };
};

const mergeDocumentsWithTypes = (types = [], existing = []) => {
  const byTypeId = new Map();
  const byName = new Map();
  (existing || []).forEach((doc) => {
    const typeId = doc?.documentTypeId || doc?.referenceTypeId;
    if (typeId) {
      byTypeId.set(String(typeId), doc);
    }
    if (doc?.typeName || doc?.name) {
      byName.set(String(doc.typeName || doc.name).toLowerCase(), doc);
    }
  });

  return (types || []).map((type) => {
    const prev =
      byTypeId.get(String(type._id)) ||
      byName.get(String(type.name || "").toLowerCase()) ||
      {};
    return {
      documentTypeId: type._id,
      typeName: type.name,
      name: type.name,
      description: type.description || "",
      requirement: type.requirement || "Required",
      templateKey: type.templateKey || "",
      templateFile: type.templateFile || null,
      hasTemplate: Boolean(type.hasTemplate),
      documentName: prev.documentName || prev.reference || "",
      documentDescription: prev.documentDescription || "",
      fileName: prev.fileName || "",
      url: prev.url || "",
      s3Key: prev.s3Key || "",
      file_type: prev.file_type || "",
      file_size: prev.file_size || 0,
      attached: Boolean(prev.attached && (prev.url || prev.s3Key)),
    };
  });
};

const DECLARATIONS = {
  certification:
    "I confirm that the information and supporting evidence are accurate and I am authorised to submit this conformity assessment application.",
  inspection: `In connection with this application, I/we:
(a) undertake to supply all information required by AQC Technical Assessors (M) Sdn. Bhd. for the purpose of evaluation of the product(s) to be inspected;
(b) undertake to make samples of product(s) and materials available to AQC Technical Assessors (M) Sdn. Bhd. for evaluation and testing purposes;
(c) undertake to pay AQC Technical Assessors (M) Sdn. Bhd. all costs of processing this application;
(d) agree that AQC Technical Assessors (M) Sdn. Bhd. may release information obtained in the course of processing the application to the regulatory authorities so far as is prudent to warn in the opinion of AQC Technical Assessors (M) Sdn. Bhd.;
(e) where applicable, undertake to grant AQC Technical Assessors (M) Sdn. Bhd. to provide regulatory authorities with access to client sites to enable assessment of conformity assessment activities, subject to the protection of confidentiality and the safeguarding of impartiality.`,
};

/**
 * Drives whichever wizard the `:type` route segment names.
 *
 * Declarative steps come from `stepFields.js`; the handful that need tables or
 * checklists render their own component. Both services therefore share one
 * page, one draft state and one footer.
 */
export default function ApplicationWizardPage() {
  const history = useHistory();
  const location = useLocation();
  const { type } = useParams();
  const account = useAccount();

  const config = getApplicationType(type);
  const existingId = location.state?.applicationId || null;
  const enquiryId = location.state?.enquiryId || null;
  const schemeFromState = String(
    location.state?.scheme || location.state?.profileSeed?.scheme || "",
  ).trim();

  const [step, setStep] = useState(0);
  const [values, setValues] = useState(() => {
    const seeded = profileSeed(account);
    const fromNav = location.state?.profileSeed || {};
    return {
      ...seeded,
      ...fromNav,
      ...(schemeFromState
        ? { scheme: schemeFromState, enquiringFor: schemeFromState }
        : {}),
    };
  });
  const [errors, setErrors] = useState({});
  const [documents, setDocuments] = useState([]);
  const [documentsLoading, setDocumentsLoading] = useState(true);
  const [documentsError, setDocumentsError] = useState("");
  const [savedDocuments, setSavedDocuments] = useState([]);
  const [technical, setTechnical] = useState(() =>
    type === "certification"
      ? EMPTY_CERT_TECHNICAL
      : EMPTY_INSPECTION_TECHNICAL,
  );
  const [agreed, setAgreed] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [savingDraft, setSavingDraft] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [applicationId, setApplicationId] = useState(existingId);
  const [referenceLabel, setReferenceLabel] = useState("");
  const [statusLabel, setStatusLabel] = useState("Draft");
  const [loadingExisting, setLoadingExisting] = useState(Boolean(existingId));
  const [profileReady, setProfileReady] = useState(Boolean(existingId));
  const [reviewBanner, setReviewBanner] = useState(null);
  const [fieldOptionsMap, setFieldOptionsMap] = useState({});
  const [fieldOptionsError, setFieldOptionsError] = useState("");
  /** Prevent profile prefill from re-applying and wiping in-progress edits. */
  const didApplyProfileSeedRef = useRef(Boolean(existingId));
  const accountRef = useRef(account);
  accountRef.current = account;

  /** Admin field options → wizard select dropdowns. */
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setFieldOptionsError("");
      try {
        const res = await CustomerFieldOptionServices.getActiveOptions();
        const rows = res?.data?.data;
        if (!cancelled) {
          setFieldOptionsMap(groupFieldOptions(Array.isArray(rows) ? rows : []));
        }
      } catch (err) {
        if (!cancelled) {
          setFieldOptionsMap({});
          setFieldOptionsError(
            err?.response?.data?.message ||
              "Failed to load application dropdown options.",
          );
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  /** Admin document types → supporting documents checklist (certification & inspection). */
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setDocumentsLoading(true);
      setDocumentsError("");
      try {
        const res = await CustomerDocumentTypeServices.getActiveTypes({
          serviceType: type === "inspection" ? "inspection" : "certification",
        });
        const types = res?.data?.data;
        if (!cancelled) {
          setDocuments(
            mergeDocumentsWithTypes(
              Array.isArray(types) ? types : [],
              savedDocuments,
            ),
          );
        }
      } catch (err) {
        if (!cancelled) {
          setDocuments([]);
          setDocumentsError(
            err?.response?.data?.message ||
              "Failed to load supporting document types.",
          );
        }
      } finally {
        if (!cancelled) setDocumentsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [type, savedDocuments]);

  /** Fresh customer profile → prefill company + contacts (inspection picker). */
  useEffect(() => {
    if (existingId && type !== "inspection") return undefined;
    let cancelled = false;
    (async () => {
      try {
        const res = await CustomerProfileServices.getMyProfile();
        const profile = res?.data?.data;
        if (!cancelled && profile) {
          const seeded = profileSeed(profile, accountRef.current);
          setValues((prev) => {
            // Existing draft / Action Required: only refresh the contact picker list.
            if (existingId) {
              return {
                ...prev,
                customerContacts: seeded.customerContacts,
              };
            }
            // New application: full prefill once. Later fetches must not overwrite typing.
            if (didApplyProfileSeedRef.current) {
              return {
                ...prev,
                customerContacts: seeded.customerContacts,
              };
            }
            didApplyProfileSeedRef.current = true;
            const navSeed = location.state?.profileSeed || {};
            const scheme =
              String(location.state?.scheme || navSeed.scheme || prev.scheme || "").trim();
            return {
              ...prev,
              ...seeded,
              ...navSeed,
              ...(scheme ? { scheme, enquiringFor: scheme } : {}),
            };
          });
        }
      } catch {
        /* Keep session seed if profile fetch fails. */
      } finally {
        if (!cancelled) setProfileReady(true);
      }
    })();
    return () => {
      cancelled = true;
    };
    // `account` intentionally omitted: session object is only a fallback inside
    // profileSeed; listing it re-ran this effect on every keystroke and wiped edits.
  }, [existingId, type, location.state]);

  useEffect(() => {
    if (!existingId) return undefined;
    let cancelled = false;
    (async () => {
      setLoadingExisting(true);
      setSubmitError("");
      try {
        const res =
          await CustomerApplicationServices.getMyApplicationById(existingId);
        const row = res?.data?.data;
        if (!row) {
          if (!cancelled) setSubmitError("Application not found.");
          return;
        }
        if (!row.canEdit) {
          if (!cancelled) {
            setSubmitError("This application can no longer be edited.");
          }
          return;
        }
        if (!cancelled) {
          setApplicationId(row._id);
          setReferenceLabel(row.applicationNumber || row.id || "");
          setStatusLabel(row.status || "Draft");
          setValues((prev) => ({
            ...prev,
            ...normalizeProductFormValues(row.formData || {}),
          }));
          if (Array.isArray(row.documents) && row.documents.length) {
            setSavedDocuments(row.documents);
          } else if (
            (row.type === "inspection" || type === "inspection") &&
            row.technical &&
            typeof row.technical === "object" &&
            Array.isArray(row.technical.references) &&
            row.technical.references.length
          ) {
            setSavedDocuments(
              normalizeLegacyReferencesToDocuments(row.technical.references),
            );
          }
          if (row.technical && typeof row.technical === "object") {
            if (row.type === "certification" || type === "certification") {
              setTechnical(normalizeCertificationTechnical(row.technical));
            } else {
              setTechnical(EMPTY_INSPECTION_TECHNICAL);
            }
          }
          setAgreed(Boolean(row.declarationAgreed));
          if (row.status === "Rejected") {
            const reason =
              row.rejectionReason ||
              [...(row.reviewHistory || [])]
                .reverse()
                .find((e) => e?.action === "rejected")?.remarks ||
              "";
            setReviewBanner({
              tone: "danger",
              title: "This application was rejected",
              body:
                reason ||
                "Please fix the issues and resubmit your application.",
            });
          } else if (row.status === "Action Required") {
            const info = row.additionalInfoRequest || {};
            setReviewBanner({
              tone: "warning",
              title: "Additional information required",
              body: [info.remarks, info.requiredInfo]
                .filter(Boolean)
                .join("\n\n") ||
                "Please update the requested sections and resubmit.",
            });
          } else {
            setReviewBanner(null);
          }
          const maxStep = Math.max(0, (config?.steps?.length || 1) - 1);
          const savedStep = Number(row.currentStep);
          setStep(
            Number.isFinite(savedStep)
              ? Math.min(Math.max(0, Math.floor(savedStep)), maxStep)
              : 0,
          );
        }
      } catch (err) {
        if (!cancelled) {
          setSubmitError(
            err?.response?.data?.message || "Failed to load application.",
          );
        }
      } finally {
        if (!cancelled) setLoadingExisting(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [existingId, config?.steps?.length]);

  const reference = useMemo(() => {
    const base =
      referenceLabel ||
      `${config?.referencePrefix || "APP"} · Pending reference`;
    return enquiryId ? `${base} · Linked to enquiry` : base;
  }, [config, enquiryId, referenceLabel]);

  if (!config) {
    history.replace(customerPath.applicationsNew);
    return null;
  }

  const stepKey = config.steps[step].key;
  const isLast = step === config.steps.length - 1;

  const setValue = (name, value) => {
    if (name && typeof name === "object" && value === undefined) {
      const patch = name;
      setValues((prev) => ({ ...prev, ...patch }));
      setErrors((prev) => {
        const next = { ...prev };
        Object.keys(patch).forEach((key) => {
          next[key] = undefined;
        });
        if ("categoryId" in patch || "categoryFieldValues" in patch) {
          Object.keys(next).forEach((key) => {
            if (key.startsWith("categoryField:")) next[key] = undefined;
          });
        }
        return next;
      });
      return;
    }
    setValues((prev) => ({ ...prev, [name]: value }));
    setErrors((prev) => {
      const next = { ...prev, [name]: undefined };
      // Type(s) / Model(s) share an "at least one" rule
      if (name === "types" || name === "models") {
        next.types = undefined;
        next.models = undefined;
      }
      return next;
    });
  };

  const validateStep = () => {
    const required = requiredByStep[config.id]?.[stepKey] || [];
    const nextErrors = {};
    required.forEach((name) => {
      if (!isFilled(values[name])) nextErrors[name] = "This field is required";
    });

    // Address must come from Google Places — GPS is hidden but required.
    const addressGpsPairs = addressGpsByStep[config.id]?.[stepKey] || [];
    addressGpsPairs.forEach(({ address, gps }) => {
      if (!isFilled(values[address])) return;
      if (!isFilled(values[gps])) {
        nextErrors[address] =
          "Select an address from the Google suggestions";
      }
    });

    if (config.id === "certification" && stepKey === "applicant") {
      if (
        isFilled(values.companyEmail) &&
        !isEmail(values.companyEmail) &&
        !nextErrors.companyEmail
      ) {
        nextErrors.companyEmail = "Enter a valid email";
      }
      if (
        isFilled(values.contactEmail) &&
        !isEmail(values.contactEmail) &&
        !nextErrors.contactEmail
      ) {
        nextErrors.contactEmail = "Enter a valid email";
      }
      if (
        isFilled(values.website) &&
        !isUrl(values.website) &&
        !nextErrors.website
      ) {
        nextErrors.website = "Enter a valid website address";
      }
      if (
        values.showSecondContact &&
        isFilled(values.contact2Email) &&
        !isEmail(values.contact2Email)
      ) {
        nextErrors.contact2Email = "Enter a valid email";
      }
    }

    if (config.id === "certification" && stepKey === "product") {
      if (!isFilled(values.types) && !isFilled(values.models)) {
        nextErrors.types = "Add at least one type or model";
      }
      const dynKeys = getRequiredCategoryFieldKeys(values.categoryProductFields);
      const dynValues = values.categoryFieldValues || {};
      const dynFields = values.categoryProductFields || [];
      dynKeys.forEach((key) => {
        const field = dynFields.find((f) => f.key === key);
        const raw = dynValues[key];
        const filled = field?.allowMultiple
          ? isFilled(Array.isArray(raw) ? raw : raw != null && raw !== "" ? [raw] : [])
          : isFilled(raw);
        if (!filled) {
          nextErrors[`categoryField:${key}`] = "This field is required";
        }
      });
    }

    if (config.id === "certification" && stepKey === "documents") {
      const missing = documents.filter(
        (doc) => doc.requirement === "Required" && !doc.attached,
      );
      if (missing.length) {
        nextErrors.documents = `Upload required documents: ${missing
          .map((d) => d.typeName || d.name)
          .join(", ")}`;
      }
    }

    if (config.id === "inspection" && stepKey === "technical") {
      const missing = documents.filter(
        (doc) => doc.requirement === "Required" && !doc.attached,
      );
      if (missing.length) {
        nextErrors.documents = `Upload required documents: ${missing
          .map((d) => d.typeName || d.name)
          .join(", ")}`;
      }
    }

    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const buildPayload = (submit) => {
    const technicalPayload =
      config.id === "certification"
        ? {
            components: (technical.components || []).filter(
              (row) =>
                row.item ||
                row.modelBrand ||
                row.specification ||
                row.manufacturer ||
                row.approval ||
                row.approvalOther,
            ),
            equipment: (technical.equipment || []).filter(
              (row) =>
                row.equipment ||
                row.serialNo ||
                row.workingRange ||
                row.calibration,
            ),
            processFlows: technical.processFlows || [],
            qcCheckpoints: (technical.qcCheckpoints || []).filter(
              (row) =>
                row.title ||
                row.description ||
                (Array.isArray(row.documents) && row.documents.length > 0),
            ),
          }
        : {};

    return {
      type: config.id,
      enquiryId: enquiryId || undefined,
      formData: normalizeProductFormValues(values),
      documents,
      technical: technicalPayload,
      declarationAgreed: agreed,
      currentStep: step,
      submit,
      ...(submit
        ? {
            customerResponseRemark: location.state?.responseRemark || "",
          }
        : {}),
    };
  };

  const persist = async (submit) => {
    const payload = buildPayload(submit);
    if (applicationId) {
      const res = await CustomerApplicationServices.updateMyApplication(
        applicationId,
        payload,
      );
      return res?.data?.data;
    }
    const res = await CustomerApplicationServices.createMyApplication(payload);
    return res?.data?.data;
  };

  const handleSaveDraft = async () => {
    if (savingDraft || submitting) return;
    setSavingDraft(true);
    setSubmitError("");
    try {
      const saved = await persist(false);
      if (saved?._id) setApplicationId(saved._id);
      if (saved?.applicationNumber) setReferenceLabel(saved.applicationNumber);
      setStatusLabel(saved?.status || "Draft");
      history.push(customerPath.applications);
    } catch (err) {
      setSubmitError(
        err?.response?.data?.message || "Failed to save draft.",
      );
    } finally {
      setSavingDraft(false);
    }
  };

  const handleContinue = async () => {
    if (!validateStep()) return;

    if (!isLast) {
      setStep((current) => current + 1);
      return;
    }

    if (!agreed) {
      setErrors({ declaration: "Agree to the declaration to submit" });
      return;
    }

    setSubmitting(true);
    setSubmitError("");
    try {
      await persist(true);
      history.push(customerPath.applications);
    } catch (err) {
      setSubmitError(
        err?.response?.data?.message || "Failed to submit application.",
      );
    } finally {
      setSubmitting(false);
    }
  };

  const reviewSections = (() => {
    if (config.id === "inspection") {
      return [
        {
          title: "A. Applicant Information",
          step: 0,
          fields: [
            { label: "Company Name", value: values.companyName },
            { label: "Registration No.", value: values.registrationNumber },
            { label: "Company Address", value: values.companyAddress },
            { label: "Street", value: values.companyStreet },
            { label: "Block / Unit", value: values.companyBlock },
            { label: "Contact Person", value: values.contactPerson },
            { label: "Email", value: values.email },
            { label: "Tel.", value: values.telephone },
            { label: "Designation", value: values.contactPosition },
          ],
        },
        {
          title: "A2. Inspection Site",
          step: 1,
          fields: [
            { label: "Site Name", value: values.siteName },
            { label: "Registration No.", value: values.siteRegNo },
            { label: "Site Address", value: values.siteAddress },
            { label: "Street", value: values.siteStreet },
            { label: "Block / Unit", value: values.siteBlock },
            { label: "Tel.", value: values.siteTelephone },
          ],
        },
        {
          title: "B. Project Information",
          step: 2,
          fields: [
            { label: "Project Name", value: values.projectName },
            { label: "Requested Service", value: values.requestedService },
            { label: "Inspection Category", value: values.inspectionCategory },
            { label: "Description", value: values.projectDescription },
            {
              label: "Reference drawings / specs",
              value: values.referenceDrawings,
            },
            { label: "Standard Number", value: values.standardNumber },
            { label: "Standard Title", value: values.standardTitle },
            {
              label: "Additional standard(s) / notes",
              value: values.applicableStandards,
            },
          ],
        },
        {
          title: "Supporting Documents",
          step: 3,
          table: {
            columns: [
              { key: "reference", label: "Reference" },
              { key: "typeName", label: "Type" },
              { key: "fileValue", label: "File / Value" },
              { key: "status", label: "Status" },
            ],
            rows: documents.map((row) => ({
              id: row.documentTypeId || row.name,
              reference: row.documentName || "—",
              typeName: row.typeName || row.name || "—",
              fileValue: row.attached
                ? row.fileName || "Attached"
                : "—",
              status: row.attached ? "Attached" : "Missing",
            })),
          },
        },
        {
          title: "Commercial References",
          step: 3,
          fields: [
            {
              label: "Purchase Order / Letter of Award",
              value: values.purchaseOrder,
            },
            { label: "Quotation Reference", value: values.quotationReference },
          ],
        },
      ];
    }

    const categoryValues = values.categoryFieldValues || {};
    const fieldDefs = Array.isArray(values.categoryProductFields)
      ? values.categoryProductFields
      : [];
    const categoryFields = Object.entries(categoryValues)
      .filter(([, value]) => {
        if (value === undefined || value === null) return false;
        if (Array.isArray(value)) return value.some((v) => String(v ?? "").trim());
        return String(value).trim() !== "";
      })
      .map(([key, value]) => {
        const def = fieldDefs.find((f) => f.key === key);
        return {
          label: def?.label || key,
          value: formatMultiValue(value) || String(value),
        };
      });

    const components = (technical.components || [])
      .filter(
        (row) =>
          row.item ||
          row.modelBrand ||
          row.specification ||
          row.manufacturer ||
          row.approval ||
          row.approvalOther,
      )
      .map((row) => ({
        ...row,
        approval: formatApprovalDisplay(row),
      }));
    const equipment = (technical.equipment || []).filter(
      (row) =>
        row.equipment || row.serialNo || row.workingRange || row.calibration,
    );
    const qcCheckpoints = (technical.qcCheckpoints || []).filter(
      (row) =>
        row.title ||
        row.description ||
        (Array.isArray(row.documents) && row.documents.length > 0),
    );

    return [
      {
        title: "Application Details",
        step: 0,
        fields: [
          { label: "Purpose", value: values.purpose },
          { label: "Certification Type", value: values.certificationType },
        ],
      },
      {
        title: "Applicant Company",
        step: 1,
        fields: [
          { label: "Company Name", value: values.companyName },
          { label: "Registration No.", value: values.registrationNumber },
          { label: "Company Email", value: values.companyEmail },
          { label: "Website", value: values.website },
          {
            label: "Authorised Contact",
            value: [values.contactPerson, values.contactPosition]
              .filter(Boolean)
              .join(" · "),
          },
          { label: "Contact Phone", value: values.contactPhone },
          { label: "Contact Email", value: values.contactEmail },
          ...(values.showSecondContact
            ? [
                {
                  label: "Second Contact",
                  value: [values.contact2Person, values.contact2Position]
                    .filter(Boolean)
                    .join(" · "),
                },
              ]
            : []),
        ],
      },
      {
        title: "Manufacturer / Factory",
        step: 2,
        fields: [
          { label: "Manufacturer", value: values.manufacturerName },
          { label: "Registration No.", value: values.manufacturerRegNo },
          { label: "Factory Address", value: values.factoryAddress },
          { label: "Street", value: values.factoryStreet },
          { label: "Block / Unit", value: values.factoryBlock },
          { label: "City / State", value: values.factoryCityState },
          { label: "Contact", value: values.factoryContact },
          { label: "Position", value: values.factoryPosition },
          { label: "Phone", value: values.factoryPhone },
          { label: "Email", value: values.factoryEmail },
        ],
      },
      {
        title: "Product Details",
        step: 3,
        fields: [
          { label: "Product", value: values.productName },
          { label: "Standard Number", value: values.standardNumber },
          { label: "Standard Title", value: values.standardTitle },
          { label: "Type(s)", value: formatMultiValue(values.types) },
          { label: "Model(s)", value: formatMultiValue(values.models) },
          { label: "Rating(s)", value: formatMultiValue(values.ratings) },
          { label: "Size(s)", value: formatMultiValue(values.sizes) },
          {
            label: "Trademark(s) / Brand name(s)",
            value: formatMultiValue(values.brands) || values.brand,
          },
          {
            label: "Class / Category",
            value: values.category || values.categoryId,
          },
          ...categoryFields,
        ],
      },
      {
        title: "Items / Components",
        step: 4,
        table: {
          columns: [
            { key: "item", label: "Item" },
            { key: "modelBrand", label: "Model/Brand" },
            { key: "specification", label: "Technical Data (Specification)" },
            { key: "manufacturer", label: "Manufacturer" },
            { key: "approval", label: "Approval" },
          ],
          rows: components,
        },
      },
      {
        title: "Test Equipment",
        step: 4,
        table: {
          columns: [
            { key: "equipment", label: "Equipment" },
            { key: "serialNo", label: "Serial No." },
            { key: "workingRange", label: "Working Range" },
            { key: "calibration", label: "Calibration" },
          ],
          rows: equipment,
        },
      },
      {
        title: "Process Flows",
        step: 4,
        checkpoints: qcCheckpoints,
      },
      {
        title: "Supporting Documents",
        step: 5,
        documents,
      },
    ];
  })();

  const renderStep = () => {
    if (config.id === "certification" && stepKey === "product") {
      const spec = certificationFields.product;
      return (
        <ProductDetailsStep
          title={spec.heading.title}
          subtitle={spec.heading.subtitle}
          values={values}
          errors={errors}
          onChange={setValue}
          note={spec.note}
        />
      );
    }

    const spec =
      config.id === "certification"
        ? certificationFields[stepKey]
        : inspectionFields[stepKey];

    if (spec) {
      const hasSelectOptions = spec.fields?.some((field) => field.optionsKey);
      return (
        <>
          {fieldOptionsError && hasSelectOptions ? (
            <StepNote title="Configuration notice">{fieldOptionsError}</StepNote>
          ) : null}
          <FieldStep
            title={spec.heading.title}
            subtitle={spec.heading.subtitle}
            fields={resolveStepFields(spec.fields, fieldOptionsMap)}
            values={values}
            errors={errors}
            onChange={setValue}
            note={spec.note}
          >
            {stepKey === "manufacturer" && (
              <SameAsApplicant
                checked={Boolean(values.sameAsApplicant)}
                label="Same as applicant company"
                onChange={(checked) => {
                  setValue("sameAsApplicant", checked);
                  if (checked) {
                    setValues((prev) => ({
                      ...prev,
                      manufacturerName: prev.companyName,
                      manufacturerRegNo: prev.registrationNumber,
                      factoryAddress: prev.companyAddress,
                      factoryStreet: prev.companyStreet || prev.companyAddress || "",
                      factoryBlock: prev.companyBlock || "",
                      factoryGpsCoordinates: prev.companyGpsCoordinates,
                      factoryContact: prev.contactPerson,
                      factoryPosition: prev.contactPosition,
                      factoryPhone: prev.contactPhone || prev.telephone,
                      factoryEmail: prev.contactEmail || prev.companyEmail,
                    }));
                  }
                }}
              />
            )}
            {stepKey === "site" && (
              <SameAsApplicant
                checked={Boolean(values.siteSameAsApplicant)}
                label="Inspection site is the same as applicant address"
                onChange={(checked) => {
                  setValue("siteSameAsApplicant", checked);
                  if (checked) {
                    setValues((prev) => ({
                      ...prev,
                      siteName: prev.companyName,
                      siteRegNo: prev.registrationNumber,
                      siteAddress: prev.companyAddress,
                      siteStreet: prev.companyStreet || prev.companyAddress || "",
                      siteBlock: prev.companyBlock || "",
                      siteGpsCoordinates: prev.companyGpsCoordinates,
                      siteTelephone: prev.telephone || prev.contactPhone,
                    }));
                  }
                }}
              />
            )}
          </FieldStep>
          {config.id === "certification" && stepKey === "applicant" && (
            <AuthorisedContactsSection
              values={values}
              errors={errors}
              onChange={setValue}
            />
          )}
          {config.id === "inspection" && stepKey === "applicant" && (
            <InspectionContactSection
              values={values}
              errors={errors}
              onChange={setValue}
            />
          )}
        </>
      );
    }

    if (stepKey === "technical") {
      return config.id === "certification" ? (
        <CertificationTechnicalStep
          data={technical}
          onChange={setTechnical}
        />
      ) : (
        <>
          <InspectionTechnicalStep
            documents={documents}
            values={values}
            onChange={setValue}
            onDocumentsChange={setDocuments}
            loading={documentsLoading}
            loadError={documentsError}
            onDownloadForm={async (doc) => {
              const res = await CustomerDocumentTypeServices.downloadForm({
                documentTypeId: doc.documentTypeId,
                templateKey: resolveDocumentDownloadTemplateKey(doc),
                applicationData: buildApplicationFormData(
                  config.id,
                  values,
                  documents,
                ),
              });
              downloadAxiosBlob(
                res,
                resolveDocumentDownloadTemplateKey(doc) === "FOR-06-04"
                  ? "Application-for-Engineering-Inspection.pdf"
                  : doc.templateFile?.fileName ||
                      `${doc.typeName || doc.name || "document"}.pdf`,
              );
            }}
          />
          {errors.documents ? (
            <p className="epc-field__error" role="alert">
              {errors.documents}
            </p>
          ) : null}
        </>
      );
    }

    if (stepKey === "documents") {
      const handleDownloadForm = async (doc) => {
        const res = await CustomerDocumentTypeServices.downloadForm({
          documentTypeId: doc.documentTypeId,
          templateKey: resolveDocumentDownloadTemplateKey(doc),
          applicationData: buildApplicationFormData(
            config.id,
            values,
            documents,
          ),
        });
        downloadAxiosBlob(
          res,
          resolveDocumentDownloadTemplateKey(doc) === "FOR-06-04"
            ? "Application-for-Engineering-Inspection.pdf"
            : doc.templateFile?.fileName ||
                `${doc.typeName || doc.name || "document"}.pdf`,
        );
      };

      return (
        <>
          <CertificationDocumentsStep
            documents={documents}
            onChange={setDocuments}
            loading={documentsLoading}
            loadError={documentsError}
            onDownloadForm={handleDownloadForm}
          />
          {errors.documents ? (
            <p className="epc-field__error" role="alert">
              {errors.documents}
            </p>
          ) : null}
        </>
      );
    }

    return (
      <ReviewStep
        sections={reviewSections}
        declaration={DECLARATIONS[config.id]}
        agreed={agreed}
        onAgree={setAgreed}
        onEdit={setStep}
      />
    );
  };

  const copy = config.stepCopy[stepKey];

  if (loadingExisting || !profileReady) {
    return (
      <ApplicationWizard
        title={copy.title}
        subtitle="Loading your application…"
        steps={config.steps}
        current={0}
        reference={reference}
        statusLabel={statusLabel}
        onStepClick={() => {}}
        onBack={() => {}}
        onExit={() => history.push(customerPath.applications)}
        onSaveDraft={() => {}}
        onContinue={() => {}}
        submitting
      >
        <p className="epc-placeholder__text">
          {loadingExisting ? "Loading draft…" : "Loading your company profile…"}
        </p>
      </ApplicationWizard>
    );
  }

  return (
    <ApplicationWizard
      title={copy.title}
      subtitle={copy.subtitle}
      steps={config.steps}
      current={step}
      reference={reference}
      statusLabel={statusLabel}
      onStepClick={setStep}
      onBack={() => setStep((current) => Math.max(0, current - 1))}
      onExit={() => history.push(customerPath.applications)}
      onSaveDraft={handleSaveDraft}
      onContinue={handleContinue}
      continueDisabled={isLast && !agreed}
      submitting={submitting || savingDraft}
    >
      {reviewBanner ? (
        <StepNote title={reviewBanner.title}>{reviewBanner.body}</StepNote>
      ) : null}
      {renderStep()}
      {errors.declaration && (
        <p className="epc-field__error" role="alert">
          {errors.declaration}
        </p>
      )}
      {submitError && (
        <p className="epc-field__error" role="alert">
          {submitError}
        </p>
      )}
    </ApplicationWizard>
  );
}

/** Checkbox row that copies applicant details into the block below it. */
function SameAsApplicant({ checked, label, onChange }) {
  return (
    <label className="epc-choicerow">
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange?.(event.target.checked)}
      />
      <span className="epc-choicerow__box" aria-hidden="true" />
      {label}
    </label>
  );
}
