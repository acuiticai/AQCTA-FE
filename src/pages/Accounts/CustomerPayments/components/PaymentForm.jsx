import React, { useState, useEffect } from "react";
import { X } from "lucide-react";
import { formatDate } from "@/components/formatAmount";
import { useForm } from "react-hook-form";
import { toast } from "react-hot-toast";

const PaymentForm = ({ payment, onClose, onSubmit, customers, banks }) => {
  const [paymentMode, setPaymentMode] = useState(
    payment?.paymentMode || "Bank Transfer"
  );
  const [selectedCustomer, setSelectedCustomer] = useState(
    payment?.customer_id || null
  );
  const [selectedBank, setSelectedBank] = useState(payment?.depositTo || null);
  const [attachment, setAttachment] = useState(payment?.attachment || null);

  const {
    register,
    handleSubmit,
    formState: { errors },
    setValue,
    watch,
  } = useForm({
    defaultValues: {
      invoice_number: payment?.invoice_number || "",
      contract_no: payment?.contract_no || "",
      paymentDate: payment?.paymentDate
        ? formatDate(payment.paymentDate)
        : formatDate(new Date()),
      amount: payment?.amount || "",
      currency: payment?.currency || "USD",
      reference: payment?.reference || "",
      bankCharges: payment?.bankCharges || "",
      taxDeducted: payment?.taxDeducted || false,
      tdsType: payment?.tdsType || "",
      notes: payment?.notes || "",
      collectionDate: payment?.collectionDate
        ? formatDate(payment.collectionDate)
        : formatDate(new Date()),
      collectionTime: payment?.collectionTime || "",
      collectionAddress: payment?.collectionAddress || "",
      moneyChangerName: payment?.moneyChangerName || "",
    },
  });

  const watchTaxDeducted = watch("taxDeducted");

  useEffect(() => {
    if (selectedCustomer) {
      setValue("customer_id", selectedCustomer._id);
    }
  }, [selectedCustomer, setValue]);

  useEffect(() => {
    if (selectedBank) {
      setValue("depositTo", selectedBank._id);
    }
  }, [selectedBank, setValue]);

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setAttachment({
        name: file.name,
        file: file,
      });
    }
  };

  const handleFormSubmit = async (data) => {
    try {
      // Ensure paymentDate is always sent - default to current date if missing
      if (!data.paymentDate) {
        data.paymentDate = formatDate(new Date());
      }

      const formData = new FormData();

      // Append all form fields
      Object.keys(data).forEach((key) => {
        if (data[key] !== undefined && data[key] !== null) {
          formData.append(key, data[key]);
        }
      });

      // Append attachment if exists
      if (attachment?.file) {
        formData.append("attachment", attachment.file);
      }

      await onSubmit(formData);
      onClose();
    } catch (error) {
      toast.error("Failed to save payment");
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl p-8 relative animate-fade-in">
        <button
          className="absolute top-3 right-3 text-gray-400 hover:text-gray-700 text-2xl focus:outline-none focus:ring-2 focus:ring-[var(--p-blue)]"
          onClick={onClose}
          aria-label="Close"
        >
          <X size={24} />
        </button>

        <h2 className="text-2xl font-bold mb-6 text-gray-800">
          {payment ? "Edit Payment" : "Add New Payment"}
        </h2>

        <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-6">
          {/* Customer Selection */}
          <div className="space-y-4">
            <label className="block text-sm font-medium text-gray-700">
              Customer
            </label>
            <select
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[var(--p-blue)] focus:border-[var(--p-blue)]"
              value={selectedCustomer?._id || ""}
              onChange={(e) => {
                const customer = customers.find(
                  (c) => c._id === e.target.value
                );
                setSelectedCustomer(customer);
              }}
            >
              <option value="">Select Customer</option>
              {customers.map((customer) => (
                <option key={customer._id} value={customer._id}>
                  {customer.basicInformation.customerDisplayName}
                </option>
              ))}
            </select>
          </div>

          {/* Invoice and Contract Details */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">
                Invoice Number
              </label>
              <input
                type="text"
                {...register("invoice_number", {
                  required: "Invoice number is required",
                })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[var(--p-blue)] focus:border-[var(--p-blue)]"
              />
              {errors.invoice_number && (
                <p className="mt-1 text-sm text-red-600">
                  {errors.invoice_number.message}
                </p>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">
                Contract Number
              </label>
              <input
                type="text"
                {...register("contract_no", {
                  required: "Contract number is required",
                })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[var(--p-blue)] focus:border-[var(--p-blue)]"
              />
              {errors.contract_no && (
                <p className="mt-1 text-sm text-red-600">
                  {errors.contract_no.message}
                </p>
              )}
            </div>
          </div>

          {/* Payment Details */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">
                Payment Date
              </label>
              <input
                type="date"
                {...register("paymentDate", {
                  required: "Payment date is required",
                })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[var(--p-blue)] focus:border-[var(--p-blue)]"
              />
              {errors.paymentDate && (
                <p className="mt-1 text-sm text-red-600">
                  {errors.paymentDate.message}
                </p>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">
                Payment Mode
              </label>
              <select
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[var(--p-blue)] focus:border-[var(--p-blue)]"
                value={paymentMode}
                onChange={(e) => setPaymentMode(e.target.value)}
              >
                <option value="Bank Transfer">Bank Transfer</option>
                <option value="Money Changer">Money Changer</option>
              </select>
            </div>
          </div>

          {/* Amount and Currency */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">
                Amount
              </label>
              <input
                type="number"
                step="0.01"
                {...register("amount", { required: "Amount is required" })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[var(--p-blue)] focus:border-[var(--p-blue)]"
              />
              {errors.amount && (
                <p className="mt-1 text-sm text-red-600">
                  {errors.amount.message}
                </p>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">
                Currency
              </label>
              <select
                {...register("currency", { required: "Currency is required" })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[var(--p-blue)] focus:border-[var(--p-blue)]"
              >
                <option value="USD">USD</option>
                <option value="EUR">EUR</option>
                <option value="GBP">GBP</option>
                <option value="AED">AED</option>
              </select>
              {errors.currency && (
                <p className="mt-1 text-sm text-red-600">
                  {errors.currency.message}
                </p>
              )}
            </div>
          </div>

          {/* Bank Transfer Details */}
          {paymentMode === "Bank Transfer" && (
            <div className="space-y-4">
              <label className="block text-sm font-medium text-gray-700">
                Bank Account
              </label>
              <select
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[var(--p-blue)] focus:border-[var(--p-blue)]"
                value={selectedBank?._id || ""}
                onChange={(e) => {
                  const bank = banks.find((b) => b._id === e.target.value);
                  setSelectedBank(bank);
                }}
              >
                <option value="">Select Bank Account</option>
                {banks.map((bank) => (
                  <option key={bank._id} value={bank._id}>
                    {bank.bankName} - {bank.accountName}
                  </option>
                ))}
              </select>

              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Reference Number
                </label>
                <input
                  type="text"
                  {...register("reference")}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[var(--p-blue)] focus:border-[var(--p-blue)]"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Bank Charges
                </label>
                <input
                  type="number"
                  step="0.01"
                  {...register("bankCharges")}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[var(--p-blue)] focus:border-[var(--p-blue)]"
                />
              </div>
            </div>
          )}

          {/* Money Changer Details */}
          {paymentMode === "Money Changer" && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Collection Date
                  </label>
                  <input
                    type="date"
                    {...register("collectionDate")}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[var(--p-blue)] focus:border-[var(--p-blue)]"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">
                    Collection Time
                  </label>
                  <input
                    type="time"
                    {...register("collectionTime")}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[var(--p-blue)] focus:border-[var(--p-blue)]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Collection Address
                </label>
                <input
                  type="text"
                  {...register("collectionAddress")}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[var(--p-blue)] focus:border-[var(--p-blue)]"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Money Changer Name
                </label>
                <input
                  type="text"
                  {...register("moneyChangerName")}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[var(--p-blue)] focus:border-[var(--p-blue)]"
                />
              </div>
            </div>
          )}

          {/* Tax Details */}
          <div className="space-y-4">
            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                id="taxDeducted"
                {...register("taxDeducted")}
                className="w-4 h-4 text-[var(--p-blue)] border-gray-300 rounded focus:ring-[var(--p-blue)]"
              />
              <label
                htmlFor="taxDeducted"
                className="text-sm font-medium text-gray-700"
              >
                Tax Deducted
              </label>
            </div>

            {watchTaxDeducted && (
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  TDS Type
                </label>
                <select
                  {...register("tdsType")}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[var(--p-blue)] focus:border-[var(--p-blue)]"
                >
                  <option value="">Select TDS Type</option>
                  <option value="Section 194C">Section 194C</option>
                  <option value="Section 194J">Section 194J</option>
                  <option value="Section 194I">Section 194I</option>
                </select>
              </div>
            )}
          </div>

          {/* Notes */}
          <div>
            <label className="block text-sm font-medium text-gray-700">
              Notes
            </label>
            <textarea
              {...register("notes")}
              rows="3"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[var(--p-blue)] focus:border-[var(--p-blue)]"
            />
          </div>

          {/* Attachment */}
          <div>
            <label className="block text-sm font-medium text-gray-700">
              Attachment
            </label>
            <input
              type="file"
              onChange={handleFileChange}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[var(--p-blue)] focus:border-[var(--p-blue)]"
            />
            {attachment && (
              <p className="mt-1 text-sm text-gray-600">{attachment.name}</p>
            )}
          </div>

          {/* Submit Button */}
          <div className="flex justify-end space-x-4">
            <button
              type="button"
              onClick={onClose}
              className="px-6 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 font-medium focus:outline-none focus:ring-2 focus:ring-[var(--p-blue)]"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-6 py-2 bg-[var(--p-blue)] text-white rounded-lg hover:bg-[#7fa02a] font-medium focus:outline-none focus:ring-2 focus:ring-[var(--p-blue)]"
            >
              {payment ? "Update Payment" : "Add Payment"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default PaymentForm;
