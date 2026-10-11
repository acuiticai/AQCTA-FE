import React, { useState, useEffect, useCallback } from "react";
import { useParams, useHistory } from "react-router-dom";
import { FiAlertTriangle } from "react-icons/fi";
import {
  PageHeader,
  BackButton,
  FormInput,
  CustomDatePicker,
} from "@/page-layouts/index";
import { formatDate } from "@/components/formatAmount";
import { notifyError, notifySuccess } from "@/utils/toast";
import BankReconciliationServices from "@/services/BankReconciliationServices";
import BankManagementServices from "@/services/BankManagementServices";

/** End of the month a given date falls in. */
const endOfMonth = (date) =>
  new Date(date.getFullYear(), date.getMonth() + 1, 0);

/**
 * Serves both starting a reconciliation and editing a draft's period or closing
 * balance — the fields are identical, so the only differences are what is loaded
 * on mount and which endpoint the submit hits.
 */
const InitiateReconciliation = () => {
  const { accountId, id } = useParams();
  const history = useHistory();
  const isEdit = Boolean(id);

  const [account, setAccount] = useState(null);
  const [startDate, setStartDate] = useState(null);
  const [endDate, setEndDate] = useState(null);
  const [closingBalance, setClosingBalance] = useState("");
  const [openingBalance, setOpeningBalance] = useState(null);
  const [isFirstEver, setIsFirstEver] = useState(false);
  const [lastEndDate, setLastEndDate] = useState(null);
  const [gapWarning, setGapWarning] = useState("");
  const [errors, setErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const listRoute = `/bank-management/${accountId}/reconciliations`;

  const fieldLabel = (text, required) => (
    <label className="block text-sm font-medium text-gray-700 mb-1">
      {text} {required && <span className="text-red-500">*</span>}
    </label>
  );

  const errorMsg = (msg) =>
    msg ? <p className="text-red-500 text-xs mt-1">{msg}</p> : null;

  /**
   * The next period starts the day after the last one on this account, whatever
   * its status — a period that was reconciled and later reversed still covers
   * those dates. The opening balance, by contrast, can only come from a period
   * that is actually reconciled.
   */
  const prefill = useCallback(async () => {
    try {
      const [accountsRes, latestRes, lastReconciledRes] = await Promise.all([
        BankManagementServices.getAllAccounts(),
        BankReconciliationServices.getReconciliations(accountId, { limit: 1 }),
        BankReconciliationServices.getReconciliations(accountId, {
          limit: 1,
          status: "reconciled",
        }),
      ]);

      const found = (accountsRes?.accounts || []).find((a) => a._id === accountId);
      if (found) setAccount(found);

      const latest = (latestRes?.reconciliations || [])[0];
      const lastReconciled = (lastReconciledRes?.reconciliations || [])[0];

      if (lastReconciled) {
        setOpeningBalance(lastReconciled.closingBalance);
        setLastEndDate(lastReconciled.endDate);
        setIsFirstEver(false);
      } else {
        setOpeningBalance(found?.openingBalance ?? 0);
        setIsFirstEver(true);
      }

      if (isEdit) {
        const detail = await BankReconciliationServices.getDetail(id);
        const rec = detail?.reconciliation;
        if (!rec) return;
        if (rec.status !== "draft") {
          notifyError(
            "Only a draft can be edited. Un-reconcile this period first."
          );
          history.push(listRoute);
          return;
        }
        setStartDate(new Date(rec.startDate));
        setEndDate(new Date(rec.endDate));
        setClosingBalance(String(rec.closingBalance ?? ""));
        setOpeningBalance(rec.openingBalance);
        return;
      }

      if (latest) {
        const next = new Date(latest.endDate);
        next.setDate(next.getDate() + 1);
        setStartDate(next);
        setEndDate(endOfMonth(next));
      } else {
        const today = new Date();
        setStartDate(new Date(today.getFullYear(), today.getMonth(), 1));
        setEndDate(endOfMonth(today));
      }
    } catch (error) {
      console.error("Error preparing reconciliation form:", error);
    }
  }, [accountId, id, isEdit, history, listRoute]);

  useEffect(() => {
    if (accountId) prefill();
  }, [accountId, prefill]);

  // Moving the start date so it no longer follows the last reconciled period
  // leaves days uncovered. Allowed — statement cycles rarely align to calendar
  // months — but worth flagging before the period is committed.
  useEffect(() => {
    if (!startDate || !lastEndDate) {
      setGapWarning("");
      return;
    }
    const expected = new Date(lastEndDate);
    expected.setDate(expected.getDate() + 1);
    const sameDay =
      expected.getFullYear() === startDate.getFullYear() &&
      expected.getMonth() === startDate.getMonth() &&
      expected.getDate() === startDate.getDate();

    setGapWarning(
      sameDay
        ? ""
        : `The previous period ended on ${formatDate(lastEndDate)}. This one does not ` +
            `start the following day, so some days will be left uncovered. You can ` +
            `continue if that is intentional.`
    );
  }, [startDate, lastEndDate]);

  const validate = () => {
    const next = {};
    if (!startDate) next.startDate = "Start date is required";
    if (!endDate) next.endDate = "End date is required";
    if (startDate && endDate && startDate > endDate) {
      next.endDate = "End date cannot be before the start date";
    }
    if (closingBalance === "" || isNaN(Number(closingBalance))) {
      next.closingBalance = "Enter the closing balance from your bank statement";
    }
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!validate()) return;

    try {
      setIsSubmitting(true);

      if (isEdit) {
        const res = await BankReconciliationServices.updateReconciliation(id, {
          startDate,
          endDate,
          closingBalance: Number(closingBalance),
        });
        notifySuccess("Reconciliation updated");
        if (res?.droppedFromSelection > 0) {
          notifyError(
            `${res.droppedFromSelection} ticked transaction(s) fell outside the new period and were deselected.`
          );
        }
        history.push(`${listRoute}/${id}`);
        return;
      }

      const payload = {
        // The server takes the business from the bank account itself.
        bankAccount: accountId,
        startDate,
        endDate,
        closingBalance: Number(closingBalance),
      };
      // Only the first reconciliation on an account may set its own opening balance.
      if (isFirstEver && openingBalance !== null) {
        payload.openingBalance = Number(openingBalance);
      }

      const res = await BankReconciliationServices.createReconciliation(payload);
      if (res?.warning) notifyError(res.warning);
      notifySuccess("Reconciliation started");
      history.push(`${listRoute}/${res.reconciliation._id}`);
    } catch (error) {
      const data = error?.response?.data;
      notifyError(
        data?.message ||
          (isEdit
            ? "Unable to update this reconciliation"
            : "Unable to start reconciliation")
      );
      // A draft already exists — offer to pick it up instead of dead-ending.
      if (data?.draftId) history.push(`${listRoute}/${data.draftId}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const currency = account?.currencyType || "";

  return (
    <div className="py-6 px-4 sm:px-6 min-h-screen">
      <BackButton onClick={() => history.push(listRoute)} />
      <PageHeader
        title={`${account?.accountName || "Bank Account"} - ${
          isEdit ? "Edit Reconciliation" : "Reconciliation"
        }`}
      />

      <form onSubmit={handleSubmit} className="space-y-6 mt-4 max-w-3xl">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="flex flex-col">
            {fieldLabel("Start Date", true)}
            <div
              className={
                errors.startDate ? "border-2 border-red-500 rounded-lg" : ""
              }
            >
              <CustomDatePicker
                value={startDate}
                onChange={setStartDate}
                placeholder="Start Date"
                error={errors.startDate}
                shouldShowError={!!errors.startDate}
                showErrorText={false}
              />
            </div>
            {errorMsg(errors.startDate)}
            {!isEdit && lastEndDate && (
              <p className="text-xs text-gray-500 mt-1">
                Suggested from the last period, which ended{" "}
                {formatDate(lastEndDate)}. You can change it.
              </p>
            )}
          </div>

          <div className="flex flex-col">
            {fieldLabel("End Date", true)}
            <div
              className={
                errors.endDate ? "border-2 border-red-500 rounded-lg" : ""
              }
            >
              <CustomDatePicker
                value={endDate}
                onChange={setEndDate}
                placeholder="End Date"
                minDate={startDate}
                error={errors.endDate}
                shouldShowError={!!errors.endDate}
                showErrorText={false}
              />
            </div>
            {errorMsg(errors.endDate)}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="flex flex-col">
            {fieldLabel(`Closing Balance ${currency ? `(${currency})` : ""}`, true)}
            <FormInput
              type="number"
              step="0.01"
              name="closingBalance"
              value={closingBalance}
              onChange={(e) => setClosingBalance(e.target.value)}
              placeholder="0.00"
              error={errors.closingBalance}
              shouldShowError={!!errors.closingBalance}
              noLabel
            />
            <p className="text-xs text-gray-500 mt-1">
              Copy this from your bank statement for the end date.
            </p>
          </div>

          <div className="flex flex-col">
            {fieldLabel(`Opening Balance ${currency ? `(${currency})` : ""}`)}
            {isFirstEver && !isEdit ? (
              <>
                <FormInput
                  type="number"
                  step="0.01"
                  name="openingBalance"
                  value={openingBalance ?? ""}
                  onChange={(e) => setOpeningBalance(e.target.value)}
                  placeholder="0.00"
                  noLabel
                />
                <p className="text-xs text-gray-500 mt-1">
                  First reconciliation on this account. This is our estimate of
                  the balance at the start of the period — confirm it against the
                  opening balance on your bank statement. Later periods carry
                  forward automatically.
                </p>
              </>
            ) : (
              <>
                <p className="text-sm text-gray-800 py-2">
                  {currency} {Number(openingBalance ?? 0).toFixed(2)}
                </p>
                <p className="text-xs text-gray-500">
                  Carried forward from the previous reconciled period.
                </p>
              </>
            )}
          </div>
        </div>

        {isEdit && (
          <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 text-amber-800 rounded-lg px-3 py-2 text-sm">
            <FiAlertTriangle className="mt-0.5 shrink-0" />
            <span>
              Changing the period changes which transactions fall inside it, so
              anything already ticked on this draft will be cleared.
            </span>
          </div>
        )}

        {gapWarning && (
          <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 text-amber-800 rounded-lg px-3 py-2 text-sm">
            <FiAlertTriangle className="mt-0.5 shrink-0" />
            <span>{gapWarning}</span>
          </div>
        )}

        <div className="flex flex-wrap justify-end gap-3 mt-8">
          <button
            type="button"
            onClick={() => history.push(listRoute)}
            className="w-[133px] h-[40px] px-4 py-2 bg-[#F5F5F5] text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isSubmitting}
            className="px-6 py-2 bg-[var(--p-blue)] text-white rounded-lg hover:bg-[var(--p-blue-dark)] transition-colors disabled:opacity-50"
          >
            {isSubmitting ? (
              <span className="flex items-center gap-2">
                <span className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></span>
                {isEdit ? "Saving..." : "Starting..."}
              </span>
            ) : isEdit ? (
              "Save Changes"
            ) : (
              "Start Reconciliation"
            )}
          </button>
        </div>
      </form>
    </div>
  );
};

export default InitiateReconciliation;
