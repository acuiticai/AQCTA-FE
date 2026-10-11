import React, { useContext, useEffect, useMemo, useState } from "react";
import { useHistory } from "react-router-dom";
import axios from "axios";

import { CustomerBrandingProvider } from "@/customer/branding";
import { DetailHeader } from "@/customer/components/ui/DetailBlocks";
import { StepHeading } from "@/customer/components/wizard/ApplicationWizard";
import Combobox from "@/customer/components/ui/Combobox";
import Button from "@/customer/components/ui/Button";
import { APPLICATION_TYPE_OPTIONS } from "@/customer/config/applicationTypes";
import { notifyError } from "@/utils/toast";
import { AdminContext } from "@/context/AdminContext";
import {
  isSingleAssignedBusiness,
  syncAssignedBusinessesFromApi,
} from "@/utils/sessionAssignedBusinesses";
import {
  customerLabel,
  nCustomerToProfile,
  profileSeed,
} from "@/utils/applicationProfileSeed";
import "@/customer/styles/index.css";

const Base_URL = import.meta.env.VITE_APP_API_BASE_URL;

/**
 * Admin entry: pick customer + AQCTA scheme, then open certification wizard
 * with scheme prefilled (same 4 options as Enquiring For).
 */
export default function AdminCreateApplication() {
  const history = useHistory();
  const { state } = useContext(AdminContext);
  const adminInfo =
    state?.adminInfo ||
    (localStorage.getItem("adminInfo")
      ? JSON.parse(localStorage.getItem("adminInfo"))
      : null);

  const authHeaders = useMemo(
    () => ({
      "Content-Type": "application/json",
      authorization: `Bearer ${adminInfo?.token}`,
    }),
    [adminInfo?.token],
  );

  const [businesses, setBusinesses] = useState([]);
  const [businessId, setBusinessId] = useState("");
  const [customers, setCustomers] = useState([]);
  const [customersLoading, setCustomersLoading] = useState(false);
  const [customerId, setCustomerId] = useState("");
  const [scheme, setScheme] = useState("");
  const [errors, setErrors] = useState({});
  const [loadingCustomer, setLoadingCustomer] = useState(false);

  const showBusiness = !isSingleAssignedBusiness();

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const list = await syncAssignedBusinessesFromApi(Base_URL);
      if (cancelled) return;
      setBusinesses(list || []);
      if (list?.length) {
        setBusinessId(String(list[0]._id || list[0].id || ""));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!businessId || !adminInfo?.token) {
      setCustomers([]);
      return undefined;
    }
    let cancelled = false;
    (async () => {
      setCustomersLoading(true);
      try {
        const res = await axios.get(`${Base_URL}/customers`, {
          headers: authHeaders,
          params: { businessId, limit: 9999 },
        });
        const list = res.data?.customers || res.data?.data || res.data || [];
        if (!cancelled) {
          setCustomers(Array.isArray(list) ? list : []);
        }
      } catch (err) {
        if (!cancelled) {
          setCustomers([]);
          notifyError(
            err?.response?.data?.message || "Failed to load customers",
          );
        }
      } finally {
        if (!cancelled) setCustomersLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [businessId, adminInfo?.token, authHeaders]);

  const businessOptions = useMemo(
    () =>
      businesses.map((b) => ({
        value: String(b._id || b.id),
        label: b.name || b.businessName || "Business",
      })),
    [businesses],
  );

  const customerOptions = useMemo(
    () =>
      customers.map((c) => {
        const email = c?.basicInformation?.customerEmail || "";
        const label = customerLabel(c);
        return {
          value: String(c._id),
          label: email ? `${label} (${email})` : label,
        };
      }),
    [customers],
  );

  const startWizard = async () => {
    const nextErrors = {};
    if (!businessId) nextErrors.businessId = "Business is required";
    if (!customerId) nextErrors.customerId = "Customer is required";
    if (!scheme) nextErrors.scheme = "AQCTA scheme is required";
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) return;

    setLoadingCustomer(true);
    try {
      const res = await axios.get(`${Base_URL}/customers/${customerId}`, {
        headers: authHeaders,
      });
      const customer = res.data?.data || res.data;
      if (!customer?._id) {
        notifyError("Customer not found");
        return;
      }
      const seed = {
        ...profileSeed(nCustomerToProfile(customer), {}),
        scheme,
        enquiringFor: scheme,
      };
      history.push(`/applications/certification/new`, {
        mode: "admin",
        customerId: String(customer._id),
        businessId,
        profileSeed: seed,
        customerLabel: customerLabel(customer),
        scheme,
      });
    } catch (err) {
      notifyError(
        err?.response?.data?.message || "Failed to load customer details",
      );
    } finally {
      setLoadingCustomer(false);
    }
  };

  return (
    <CustomerBrandingProvider className="epc-admin-wizard-root">
      <div className="epc-admin-wizard">
        <DetailHeader
          title="Create Application"
          subtitle="Select a customer and AQCTA scheme. Customer company details will prefill the form."
          onBack={() => history.push("/applications")}
        />

        <section className="epc-card-panel">
          <StepHeading
            title="Select Customer & AQCTA Scheme"
            subtitle="Choose who the application is for, then select the MDA CAB scheme (same options as Enquiring For)."
          />

          <div className="epc-typepicker epc-typepicker--stack">
            {showBusiness ? (
              <Combobox
                label="Business *"
                name="businessId"
                placeholder="Select business"
                searchPlaceholder="Search business…"
                options={businessOptions}
                value={businessId}
                clearable={false}
                error={errors.businessId}
                onChange={(next) => {
                  setBusinessId(next);
                  setCustomerId("");
                  setErrors((prev) => ({ ...prev, businessId: "" }));
                }}
              />
            ) : null}

            <Combobox
              label="Customer *"
              name="customerId"
              placeholder={
                customersLoading ? "Loading customers…" : "Select customer"
              }
              searchPlaceholder="Search customer…"
              options={customerOptions}
              value={customerId}
              disabled={!businessId || customersLoading}
              clearable={false}
              error={errors.customerId}
              hint="Applicant information will be loaded from the selected customer record."
              onChange={(next) => {
                setCustomerId(next);
                setErrors((prev) => ({ ...prev, customerId: "" }));
              }}
            />

            <Combobox
              label="Application For *"
              name="scheme"
              placeholder="Select AQCTA scheme"
              searchPlaceholder="Search scheme…"
              options={APPLICATION_TYPE_OPTIONS}
              value={scheme}
              clearable={false}
              error={errors.scheme}
              hint="ISO 13485 / MDQMS · GDPMD · CoAWOV · Technical Documentation CA"
              onChange={(next) => {
                setScheme(next);
                setErrors((prev) => ({ ...prev, scheme: "" }));
              }}
            />

            <p className="epc-typepicker__hint">
              You will be taken to the conformity assessment application stepper
              with the selected scheme prefilled.
            </p>
          </div>
        </section>

        <footer className="epc-card-panel epc-wizard__foot">
          <Button
            variant="secondary"
            onClick={() => history.push("/applications")}
          >
            Cancel
          </Button>
          <div className="epc-wizard__foot-right">
            <Button onClick={startWizard} loading={loadingCustomer}>
              Continue
            </Button>
          </div>
        </footer>
      </div>
    </CustomerBrandingProvider>
  );
}
