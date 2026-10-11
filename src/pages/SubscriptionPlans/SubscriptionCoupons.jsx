import React, { useEffect, useState } from "react";
import { useHistory } from "react-router-dom";
import { FiTrash2 } from "react-icons/fi";
import { Button, Modal, ModalBody, ModalFooter } from "@windmill/react-ui";
import SubscriptionCouponServices from "@/services/SubscriptionCouponServices";
import { notifyError, notifySuccess } from "@/utils/toast";
import spinnerLoadingImage from "@/assets/img/spinner.gif";
import { Loader, PageHeader, ActionButtons } from "@/page-layouts/index";
import { ACTION_BUTTON_TYPES } from "@/utils/constants";
import {
  formatSubscriptionCents,
  getSubscriptionCurrencyDisplayCode,
} from "@/utils/subscriptionCurrency";
import "./subscriptionPlans.css";

const formatDiscount = (coupon, currency) => {
  if (coupon.discountType === "percentage") {
    return `${coupon.discountValue}%`;
  }
  return formatSubscriptionCents(coupon.discountValue, currency);
};

const formatDiscountType = (type) =>
  type === "percentage" ? "Percentage" : "Fixed amount";

const formatDuration = (coupon) => {
  const duration = String(coupon.duration || "once").toLowerCase();
  if (duration === "forever") return "Forever";
  if (duration === "repeating") {
    const cycles = Math.max(1, Number(coupon.billingCycles) || 1);
    return `${cycles} cycle${cycles === 1 ? "" : "s"}`;
  }
  return "Once";
};

const SubscriptionCoupons = ({ embedded = false } = {}) => {
  const history = useHistory();
  const [loading, setLoading] = useState(true);
  const [coupons, setCoupons] = useState([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [couponToDelete, setCouponToDelete] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const currency = getSubscriptionCurrencyDisplayCode();

  const loadCoupons = async () => {
    setLoading(true);
    try {
      const res = await SubscriptionCouponServices.list();
      setCoupons(res.coupons || []);
    } catch (err) {
      notifyError(
        err?.response?.data?.message || "Failed to load coupons.",
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCoupons();
  }, []);

  const closeModal = () => {
    setIsModalOpen(false);
    setCouponToDelete(null);
  };

  const handleDelete = (coupon) => {
    setCouponToDelete(coupon);
    setIsModalOpen(true);
  };

  const handleDeleteItem = async () => {
    if (!couponToDelete?._id && !couponToDelete?.id) return;
    try {
      setIsSubmitting(true);
      const id = couponToDelete._id || couponToDelete.id;
      await SubscriptionCouponServices.remove(id);
      notifySuccess("Coupon deleted.");
      setCoupons((prev) =>
        prev.filter((c) => (c._id || c.id) !== id),
      );
      closeModal();
    } catch (err) {
      notifyError(err?.response?.data?.message || "Failed to delete coupon.");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="sp-page">
        <div className="sp-loading">
          <Loader color="var(--p-blue)" />
        </div>
      </div>
    );
  }

  return (
    <div className="sp-page">
      <PageHeader
        variant="large"
        title="Coupons"
        description="Promo codes customers can apply at checkout."
        renderActions={
          <div className="sp-header__actions">
            <button
              type="button"
              className="sp-btn sp-btn--ghost"
              onClick={() => history.push("/subscription-catalog")}
            >
              Back to plans
            </button>
            <button
              type="button"
              className="sp-btn sp-btn--primary"
              onClick={() =>
                history.push("/subscription-catalog/coupons/create")
              }
            >
              + Create Coupon
            </button>
          </div>
        }
      />

      {coupons.length === 0 ? (
        <div className="sp-empty">
          <p className="sp-empty__title">No coupons yet</p>
          <p>Create a user-level coupon and assign it to specific users.</p>
          <div style={{ marginTop: 18 }}>
            <button
              type="button"
              className="sp-btn sp-btn--primary"
              onClick={() =>
                history.push("/subscription-catalog/coupons/create")
              }
            >
              + Create Coupon
            </button>
          </div>
        </div>
      ) : (
        <div className="sp-table-card">
          <table className="sp-table">
            <thead>
              <tr>
                <th>Code</th>
                <th>Title</th>
                <th>Discount</th>
                <th>Duration</th>
                <th>Users</th>
                <th>Usage</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {coupons.map((coupon) => {
                const id = coupon._id || coupon.id;
                const userCount = Array.isArray(coupon.applicableUsers)
                  ? coupon.applicableUsers.length
                  : 0;
                const usageLabel =
                  coupon.usageLimit != null
                    ? `${coupon.usedCount || 0} / ${coupon.usageLimit}`
                    : `${coupon.usedCount || 0}`;
                return (
                  <tr key={id}>
                    <td>
                      <span className="sp-coupon-code">{coupon.code}</span>
                    </td>
                    <td>
                      <div className="sp-table__plan-name">{coupon.title}</div>
                      {coupon.description ? (
                        <p className="sp-coupon-list-desc">{coupon.description}</p>
                      ) : null}
                    </td>
                    <td>
                      <div className="sp-coupon-discount-cell">
                        <strong>{formatDiscount(coupon, currency)}</strong>
                        <span className="sp-table__badge sp-table__badge--muted">
                          {formatDiscountType(coupon.discountType)}
                        </span>
                      </div>
                    </td>
                    <td>
                      <span className="sp-table__badge">{formatDuration(coupon)}</span>
                    </td>
                    <td>
                      <span className="sp-coupon-count">{userCount}</span>
                    </td>
                    <td>{usageLabel}</td>
                    <td>
                      <span
                        className={
                          coupon.isActive ? "sp-stripe-ok" : "sp-stripe-missing"
                        }
                      >
                        {coupon.isActive ? "Active" : "Inactive"}
                      </span>
                    </td>
                    <td>
                      <ActionButtons
                        items={[
                          {
                            action: ACTION_BUTTON_TYPES.EDIT,
                            tooltip: "Edit coupon",
                            onClick: () =>
                              history.push(
                                `/subscription-catalog/coupons/edit/${id}`,
                              ),
                          },
                          {
                            action: ACTION_BUTTON_TYPES.DELETE,
                            tooltip: "Delete coupon",
                            loading:
                              isSubmitting &&
                              (couponToDelete?._id || couponToDelete?.id) === id,
                            onClick: () => handleDelete(coupon),
                          },
                        ]}
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <Modal isOpen={isModalOpen} onClose={closeModal}>
        <ModalBody className="text-center custom-modal px-8 pt-6 pb-4">
          <span className="flex justify-center text-3xl mb-6 text-red-500">
            <FiTrash2 />
          </span>
          <h2 className="text-xl font-medium mb-2">
            Delete coupon{" "}
            <span className="text-red-500">{couponToDelete?.code}</span>?
          </h2>
          <p>
            This cannot be undone. Existing usage records are kept for audit.
          </p>
        </ModalBody>
        <ModalFooter className="justify-center pb-10">
          <Button
            className="w-full sm:w-auto hover:bg-white hover:border-gray-50"
            layout="outline"
            onClick={closeModal}
          >
            Cancel
          </Button>
          <div className="flex justify-end">
            {isSubmitting ? (
              <Button
                disabled
                type="button"
                className="w-full h-12 sm:w-auto bg-p-blue hover:bg-p-blue-dark"
              >
                <img
                  src={spinnerLoadingImage}
                  alt="Loading"
                  width={20}
                  height={10}
                />
                <span className="font-serif ml-2 font-light">Processing…</span>
              </Button>
            ) : (
              <Button
                onClick={handleDeleteItem}
                className="w-full h-12 sm:w-auto bg-p-blue hover:bg-p-blue-dark"
              >
                Yes, delete
              </Button>
            )}
          </div>
        </ModalFooter>
      </Modal>
    </div>
  );
};

export default SubscriptionCoupons;
