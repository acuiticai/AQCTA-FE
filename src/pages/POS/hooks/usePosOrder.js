import { useState, useCallback, useContext, useRef } from "react";
import PosServices from "@/services/PosServices";
import { AdminContext } from "@/context/AdminContext";
import { notifyError, notifySuccess } from "@/utils/toast";

function calcLineAmount(qty, rate, discountPct) {
  const base = qty * rate;
  return Math.round(base * (1 - (discountPct || 0) / 100) * 100) / 100;
}

// Malaysia F&B SST calculation (mirrors posOrderController.js logic):
//   Tax is exclusive and calculated only on taxable items.
//   Service charge is calculated on afterDiscount and is NEVER taxed.
function recalcTotals(
  items,
  discountType,
  discountValue,
  _taxRate,      // unused — tax is now 100% per-item, no outlet rate
  {
    serviceChargeEnabled,
    serviceChargeType = "percentage",
    serviceChargeValue,
    serviceChargeRate = 0,
    serviceChargeDineInOnly = true,
    serviceType = "pickup",
  } = {},
) {
  const subtotal = Math.round(items.reduce((sum, it) => sum + (it.amount || 0), 0) * 100) / 100;

  let discountAmount;
  if (discountType === "percentage") {
    discountAmount = Math.round(subtotal * ((discountValue || 0) / 100) * 100) / 100;
  } else {
    discountAmount = Math.min(discountValue || 0, subtotal);
  }
  const afterDiscount = Math.round((subtotal - discountAmount) * 100) / 100;

  // Per-item taxable split (taxApplicable defaults to true)
  const taxableRaw = Math.round(
    items.reduce((sum, it) => sum + (it.taxApplicable !== false ? (it.amount || 0) : 0), 0) * 100,
  ) / 100;

  const taxableAfterDiscount =
    subtotal > 0
      ? Math.round((afterDiscount * (taxableRaw / subtotal)) * 100) / 100
      : 0;
  const nonTaxableAfterDiscount = Math.round((afterDiscount - taxableAfterDiscount) * 100) / 100;

  // ── Tax: purely item-driven, no outlet gate ────────────────────
  // Items carry their own taxRate (snapshotted from catalog taxOnItem).
  // Items with taxRate=0 or taxApplicable=false contribute nothing.
  const taxBreakdown = [];
  let taxAmount = 0;

  {
    const groups = new Map(); // taxRate → { taxName, taxableRaw }
    for (const it of items) {
      if (it.taxApplicable === false) continue;
      const rate = typeof it.taxRate === "number" ? it.taxRate : 0;
      if (rate === 0) continue;
      const name = it.taxName || "";
      const g = groups.get(rate);
      if (g) {
        g.taxableRaw += it.amount || 0;
      } else {
        groups.set(rate, { taxName: name, taxableRaw: it.amount || 0 });
      }
    }
    for (const [rate, g] of groups) {
      const groupAfterDiscount =
        subtotal > 0
          ? Math.round(afterDiscount * (g.taxableRaw / subtotal) * 100) / 100
          : 0;
      const groupTaxAmt = Math.round(groupAfterDiscount * (rate / 100) * 100) / 100;
      taxAmount += groupTaxAmt;
      taxBreakdown.push({
        taxRate: rate,
        taxName: g.taxName,
        taxableAmount: groupAfterDiscount,
        taxAmount: groupTaxAmt,
      });
    }
    taxAmount = Math.round(taxAmount * 100) / 100;
  }

  // Service charge: on afterDiscount, never taxed per Malaysia F&B SST
  const safeServiceValue = Number(
    serviceChargeValue !== undefined ? serviceChargeValue : serviceChargeRate || 0,
  );
  const effectiveServiceEnabled =
    serviceChargeEnabled === undefined ? safeServiceValue > 0 : Boolean(serviceChargeEnabled);
  const isDineInLike = serviceType === "dine_in" || serviceType === "qr_table";
  const applyService = effectiveServiceEnabled && (isDineInLike || !serviceChargeDineInOnly);
  const serviceChargeAmount = applyService
    ? serviceChargeType === "fixed"
      ? Math.round(safeServiceValue * 100) / 100
      : Math.round(afterDiscount * (safeServiceValue / 100) * 100) / 100
    : 0;

  const total = Math.round((afterDiscount + taxAmount + serviceChargeAmount) * 100) / 100;

  return {
    subtotal,
    discountAmount,
    taxableAmount: taxableAfterDiscount,
    nonTaxableAmount: nonTaxableAfterDiscount,
    taxBreakdown,
    serviceChargeAmount,
    taxAmount,
    total,
  };
}

// Serialize items into the shape expected by the updateOrderItems API
function serializeItems(items) {
  return items.map((it) => {
    // Normalize itemId to a plain string — ObjectId vs string mismatch is the
    // primary cause of Mongoose OptimisticLockingError when QR and POS race.
    const rawId = it.itemId?._id || it.itemId;
    const itemId = rawId ? String(rawId) : "";
    // Temp _ids (e.g. "temp-1234-abc") exist only in local state; never send
    // them to the backend or it will try to match a subdocument that doesn't
    // exist and trigger a version conflict.
    const subdocId =
      it._id && !String(it._id).startsWith("temp-") ? { _id: it._id } : {};

    return {
      ...subdocId,
      itemId,
      name: it.name,
      quantity: it.quantity,
      rate: it.rate,
      discount: it.discount,
      amount: it.amount,
      note: it.note,
      lineSource: it.lineSource || "pos_staff",
      linePaymentState: it.linePaymentState || "unpaid",
      // Send tax fields so the backend doesn't need to re-derive and overwrite
      // them — re-deriving causes taxBreakdown to appear in modifiedPaths and
      // triggers the optimistic-lock version bump on every cart save.
      taxApplicable: it.taxApplicable !== false,
      taxRate: it.taxRate || 0,
      taxName: it.taxName || "",
    };
  });
}

const usePosOrder = (businessId) => {
  const { state } = useContext(AdminContext);
  const token = state?.adminInfo?.token;
  const headers = token ? { Authorization: `Bearer ${token}` } : {};

  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(false);
  const [checkoutLoading, setCheckoutLoading] = useState(false);

  // B3 fix: debounced persist so rapid taps merge into one API call.
  // latestItemsRef always holds the freshest items array regardless of closure age.
  const latestItemsRef = useRef(null);
  const persistTimerRef = useRef(null);
  const [syncState, setSyncState] = useState("idle"); // "idle" | "saving" | "saved" | "error"
  const savedTimerRef = useRef(null);

  // scheduleItemPersist takes NO items argument.
  // Each mutation sets latestItemsRef.current INSIDE its functional updater
  // (runs synchronously during React's render phase, always before the 250ms timer).
  // This avoids the React 18 issue where setState's functional updater is called
  // asynchronously and capturedItems closures are always null.
  const scheduleItemPersist = useCallback(
    (orderId) => {
      if (persistTimerRef.current) clearTimeout(persistTimerRef.current);
      if (savedTimerRef.current) clearTimeout(savedTimerRef.current);
      setSyncState("saving");
      persistTimerRef.current = setTimeout(async () => {
        const toSend = latestItemsRef.current;
        if (!toSend) return;
        try {
          const res = await PosServices.updateOrderItems(
            orderId,
            serializeItems(toSend),
            headers,
          );
          if (res.data?.success) {
            setOrder(res.data.data);
            latestItemsRef.current = null;
            setSyncState("saved");
            savedTimerRef.current = setTimeout(() => setSyncState("idle"), 2000);
          }
        } catch (err) {
          const msg = String(err?.response?.data?.message || "");
          // Optimistic-lock conflict: QR or another tab updated the order between
          // our read and write. Re-fetch the fresh document, merge our POS-staff
          // changes on top of the authoritative QR lines, then retry once.
          const isConflict =
            msg.includes("No matching document found") ||
            msg.includes("version") ||
            err?.response?.status === 409;

          if (isConflict) {
            try {
              const fresh = await PosServices.getOrder(orderId, headers);
              if (fresh.data?.success) {
                const freshOrder = fresh.data.data;
                const pending = latestItemsRef.current; // may have changed since timer fired
                if (pending) {
                  // Authoritative QR items come from the server; POS-added items
                  // come from our pending buffer.
                  const freshQr = (freshOrder.items || []).filter(
                    (it) => it.lineSource === "qr_customer",
                  );
                  const pendingPos = pending.filter(
                    (it) => (it.lineSource || "pos_staff") !== "qr_customer",
                  );
                  const merged = [...freshQr, ...pendingPos];
                  const retryRes = await PosServices.updateOrderItems(
                    orderId,
                    serializeItems(merged),
                    headers,
                  );
                  if (retryRes.data?.success) {
                    setOrder(retryRes.data.data);
                    latestItemsRef.current = null;
                    setSyncState("saved");
                    savedTimerRef.current = setTimeout(() => setSyncState("idle"), 2000);
                    return;
                  }
                } else {
                  // Nothing pending — just sync to fresh state
                  setOrder(freshOrder);
                  setSyncState("idle");
                  return;
                }
              }
            } catch (_retryErr) {
              // retry itself failed — fall through to error state
            }
            setSyncState("error");
            notifyError("Order was updated by another device. Please re-check your items.");
          } else {
            setSyncState("error");
            notifyError(msg || "Failed to update cart");
          }
        }
      }, 250);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [token],
  );

  // ── Create or resume order ────────────────────────────────
  const openOrder = useCallback(
    async (tableId, { forceNew = false, guestCount, guestPhones } = {}) => {
      if (!businessId) return null;
      setLoading(true);
      try {
        const res = await PosServices.createOrder(
          {
            business: businessId,
            tableId,
            ...(forceNew ? { forceNew: true } : {}),
            ...(guestCount !== undefined ? { guestCount } : {}),
            ...(guestPhones !== undefined ? { guestPhones } : {}),
          },
          headers,
        );
        if (res.data?.success) {
          latestItemsRef.current = null; // discard any stale pending items from prior order
          if (persistTimerRef.current) clearTimeout(persistTimerRef.current);
          setOrder(res.data.data);
          return res.data.data;
        }
        notifyError(res.data?.message || "Failed to open order");
        return null;
      } catch (err) {
        notifyError(err?.response?.data?.message || "Failed to open order");
        return null;
      } finally {
        setLoading(false);
      }
    },
    [businessId, token],
  );

  // ── Load a specific existing order by ID (multi-order table support) ────
  const loadOrder = useCallback(
    async (orderId) => {
      if (!orderId) return null;
      setLoading(true);
      try {
        const res = await PosServices.getOrder(orderId, headers);
        if (res.data?.success) {
          latestItemsRef.current = null;
          if (persistTimerRef.current) clearTimeout(persistTimerRef.current);
          setOrder(res.data.data);
          return res.data.data;
        }
        notifyError(res.data?.message || "Failed to load order");
        return null;
      } catch (err) {
        notifyError(err?.response?.data?.message || "Failed to load order");
        return null;
      } finally {
        setLoading(false);
      }
    },
    [token],
  );

  // ── Create order without a table (walk-in) ────────────────
  const openWalkinOrder = useCallback(async (salesChannelId = null) => {
    if (!businessId) return null;
    setLoading(true);
    try {
      const res = await PosServices.createOrder(
        { business: businessId, ...(salesChannelId ? { salesChannelId } : {}) },
        headers,
      );
      if (res.data?.success) {
        latestItemsRef.current = null;
        if (persistTimerRef.current) clearTimeout(persistTimerRef.current);
        setOrder(res.data.data);
        return res.data.data;
      }
      notifyError(res.data?.message || "Failed to create order");
      return null;
    } catch (err) {
      notifyError(err?.response?.data?.message || "Failed to create order");
      return null;
    } finally {
      setLoading(false);
    }
  }, [businessId, token]);

  // ── Add item to cart ──────────────────────────────────────
  // latestItemsRef.current is set INSIDE the updater (runs synchronously during
  // React's render phase, always before the 250ms persist timer fires).
  // Using `latestItemsRef.current ?? prev.items` means rapid taps accumulate
  // correctly: tap 2 builds on tap 1's items even before React re-renders.
  const addItem = useCallback(
    (item) => {
      if (!order) return;
      const orderId = order._id;

      setOrder((prev) => {
        if (!prev) return prev;
        // B3: use latest in-flight items, not just prev.items from stale render
        const baseItems = latestItemsRef.current ?? prev.items;

        const existing = baseItems.find(
          (it) =>
            String(it.itemId?._id || it.itemId) === String(item._id) &&
            (it.lineSource || "pos_staff") === "pos_staff",
        );

        let newItems;
        if (existing) {
          newItems = baseItems.map((it) => {
            if (
              String(it.itemId?._id || it.itemId) === String(item._id) &&
              (it.lineSource || "pos_staff") === "pos_staff"
            ) {
              const newQty = it.quantity + 1;
              return { ...it, quantity: newQty, amount: calcLineAmount(newQty, it.rate, it.discount) };
            }
            return it;
          });
        } else {
          const rate = item.salesInformation?.sellingPrice || 0;
          const itemTaxOnItem = item.salesInformation?.taxOnItem;
          newItems = [
            ...baseItems,
            {
              _id: `temp-${Date.now()}-${Math.random().toString(36).slice(2)}`,
              itemId: item._id,
              name: item.name,
              quantity: 1,
              rate,
              discount: 0,
              amount: calcLineAmount(1, rate, 0),
              note: "",
              taxApplicable: item.salesInformation?.taxApplicable !== false,
              taxRate: typeof itemTaxOnItem?.rate === "number" ? itemTaxOnItem.rate : 0,
              taxName: itemTaxOnItem?.name || "",
              lineSource: "pos_staff",
              linePaymentState: "unpaid",
            },
          ];
        }

        latestItemsRef.current = newItems; // persist timer reads this
        const totals = recalcTotals(newItems, prev.discountType, prev.discountValue, prev.taxRate, prev);
        return { ...prev, items: newItems, ...totals };
      });

      scheduleItemPersist(orderId);
    },
    [order, scheduleItemPersist],
  );

  // ── Update item quantity ──────────────────────────────────
  // B2 fix: match by _id ONLY (not itemId fallback).
  const updateItemQty = useCallback(
    (itemRef, newQty) => {
      if (!order) return;
      const orderId = order._id;

      setOrder((prev) => {
        if (!prev) return prev;
        const baseItems = latestItemsRef.current ?? prev.items;
        const matches = (it) => String(it._id || "") === String(itemRef);
        const newItems =
          newQty <= 0
            ? baseItems.filter((it) => !matches(it))
            : baseItems.map((it) =>
                matches(it)
                  ? { ...it, quantity: newQty, amount: calcLineAmount(newQty, it.rate, it.discount) }
                  : it,
              );

        latestItemsRef.current = newItems;
        const totals = recalcTotals(newItems, prev.discountType, prev.discountValue, prev.taxRate, prev);
        return { ...prev, items: newItems, ...totals };
      });

      scheduleItemPersist(orderId);
    },
    [order, scheduleItemPersist],
  );

  // ── Remove item ───────────────────────────────────────────
  const removeItem = useCallback(
    (itemRef) => {
      updateItemQty(itemRef, 0);
    },
    [updateItemQty],
  );

  // ── Update item note ──────────────────────────────────────
  const updateItemNote = useCallback(
    (itemRef, note) => {
      if (!order) return;
      const orderId = order._id;

      setOrder((prev) => {
        if (!prev) return prev;
        const baseItems = latestItemsRef.current ?? prev.items;
        const matches = (it) => String(it._id || "") === String(itemRef);
        const newItems = baseItems.map((it) => (matches(it) ? { ...it, note } : it));
        latestItemsRef.current = newItems;
        return { ...prev, items: newItems };
      });

      scheduleItemPersist(orderId);
    },
    [order, scheduleItemPersist],
  );

  // ── Update staff notes ────────────────────────────────────
  const updateStaffNotes = useCallback(
    async (notes) => {
      if (!order) return;
      setOrder((prev) => (prev ? { ...prev, staffNotes: notes } : prev));
      try {
        await PosServices.updateOrder(order._id, { staffNotes: notes }, headers);
      } catch (err) {
        notifyError(err?.response?.data?.message || "Failed to save staff notes");
      }
    },
    [order, token],
  );

  // ── Update guest count (pax) ──────────────────────────────
  const updateGuestCount = useCallback(
    async (guestCount) => {
      if (!order) return;
      const prevCount = order.guestCount;
      const prevConfirmed = order.guestCountConfirmed;
      setOrder((prev) =>
        prev ? { ...prev, guestCount, guestCountConfirmed: true } : prev,
      );
      try {
        await PosServices.updateOrder(order._id, { guestCount }, headers);
      } catch (err) {
        setOrder((prev) =>
          prev
            ? { ...prev, guestCount: prevCount, guestCountConfirmed: prevConfirmed }
            : prev,
        );
        notifyError(err?.response?.data?.message || "Failed to update guest count");
      }
    },
    [order, token],
  );

  // ── Mark guest count as confirmed without changing its value ──
  // Used when staff dismisses the first-touch headcount prompt without
  // adjusting the count — avoids re-prompting on every subsequent table tap.
  const confirmGuestCount = useCallback(async () => {
    if (!order || order.guestCountConfirmed) return;
    setOrder((prev) => (prev ? { ...prev, guestCountConfirmed: true } : prev));
    try {
      await PosServices.updateOrder(order._id, { guestCountConfirmed: true }, headers);
    } catch (err) {
      setOrder((prev) => (prev ? { ...prev, guestCountConfirmed: false } : prev));
    }
  }, [order, token]);

  // ── Update discount ───────────────────────────────────────
  const updateDiscount = useCallback(
    async (discountType, discountValue) => {
      if (!order) return;

      const totals = recalcTotals(
        order.items,
        discountType,
        discountValue,
        order.taxRate,
        order,
      );

      setOrder((prev) => ({
        ...prev,
        discountType,
        discountValue,
        ...totals,
      }));

      try {
        await PosServices.updateOrder(
          order._id,
          { discountType, discountValue },
          headers,
        );
      } catch (err) {
        notifyError(
          err?.response?.data?.message || "Failed to update discount",
        );
      }
    },
    [order, token],
  );

  // ── Update customer ───────────────────────────────────────
  const updateCustomer = useCallback(
    async (customerId) => {
      if (!order) return;
      try {
        const res = await PosServices.updateOrder(
          order._id,
          { customer: customerId },
          headers,
        );
        if (res.data?.success && res.data?.data) {
          setOrder(res.data.data);
        }
      } catch (err) {
        notifyError(
          err?.response?.data?.message || "Failed to update customer",
        );
      }
    },
    [order, token],
  );

  const updateSalesChannel = useCallback(
    async (salesChannelId) => {
      if (!order) return;
      try {
        const res = await PosServices.updateOrder(
          order._id,
          { salesChannelId: salesChannelId || null },
          headers,
        );
        if (res.data?.success && res.data?.data) {
          setOrder(res.data.data);
        }
      } catch (err) {
        notifyError(
          err?.response?.data?.message || "Failed to update sales channel",
        );
      }
    },
    [order, token],
  );

  // ── Checkout ──────────────────────────────────────────────
  // Pass force=true to skip the active-ticket block after manager confirmation.
  const checkout = useCallback(
    async (
      payments,
      cashTendered,
      {
        force = false,
        customerPhone,
        stockWarehouseId,
        stockLocationId,
      } = {},
    ) => {
      if (!order) return null;
      setCheckoutLoading(true);
      try {
        const res = await PosServices.checkoutOrder(
          order._id,
          {
            payments,
            cashTendered,
            force,
            customerPhone,
            warehouseId: stockWarehouseId,
            locationId: stockLocationId,
          },
          headers,
        );
        if (res.data?.success) {
          setOrder(res.data.data);
          return res.data;
        }
        notifyError(res.data?.message || "Checkout failed");
        return null;
      } catch (err) {
        // 409: active kitchen tickets — return structured signal so PosPage can
        // offer a manager-override confirmation instead of a plain error toast.
        if (err?.response?.status === 409 && err.response.data?.data?.blocked) {
          return {
            blocked: true,
            activeTickets: err.response.data.data.activeTickets || [],
            payments,
            cashTendered,
          };
        }
        notifyError(err?.response?.data?.message || "Checkout failed");
        return null;
      } finally {
        setCheckoutLoading(false);
      }
    },
    [order, token],
  );

  const collectPayment = useCallback(
    async (payments = []) => {
      if (!order) return null;
      try {
        const res = await PosServices.collectOrderPayment(
          order._id,
          { payments },
          headers,
        );
        if (res.data?.success) {
          setOrder(res.data.data);
          return res.data.data;
        }
        notifyError(res.data?.message || "Failed to collect payment");
        return null;
      } catch (err) {
        notifyError(err?.response?.data?.message || "Failed to collect payment");
        return null;
      }
    },
    [order, token],
  );

  const sendToKitchen = useCallback(async () => {
    if (!order) return null;

    // Flush any debounced cart persist before firing to kitchen.
    // If the user taps "Send to Kitchen" within the 250ms debounce window,
    // the server still has the old (possibly empty) items — flush first.
    if (persistTimerRef.current) {
      clearTimeout(persistTimerRef.current);
      persistTimerRef.current = null;
    }
    const pendingItems = latestItemsRef.current;
    if (pendingItems) {
      try {
        setSyncState("saving");
        const flushRes = await PosServices.updateOrderItems(
          order._id,
          serializeItems(pendingItems),
          headers,
        );
        if (flushRes.data?.success) {
          setOrder(flushRes.data.data);
          latestItemsRef.current = null;
          setSyncState("saved");
        }
      } catch {
        setSyncState("error");
        notifyError("Failed to save cart before sending to kitchen");
        return null;
      }
    }

    try {
      const res = await PosServices.fireOrderToKitchen(order._id, headers);
      if (res.data?.success) {
        setOrder(res.data.data);
        return res.data.data;
      }
      notifyError(res.data?.message || "Failed to send order to kitchen");
      return null;
    } catch (err) {
      notifyError(err?.response?.data?.message || "Failed to send order to kitchen");
      return null;
    }
  }, [order, token]);

  // ── Hold / Resume ─────────────────────────────────────────
  const holdOrder = useCallback(async () => {
    if (!order) return null;
    try {
      const res = await PosServices.holdOrder(order._id, headers);
      if (res.data?.success) {
        setOrder(res.data.data);
        return res.data.data;
      }
      notifyError(res.data?.message || "Failed to hold order");
      return null;
    } catch (err) {
      notifyError(err?.response?.data?.message || "Failed to hold order");
      return null;
    }
  }, [order, token]);

  const resumeOrder = useCallback(async () => {
    if (!order) return null;
    try {
      const res = await PosServices.resumeOrder(order._id, headers);
      if (res.data?.success) {
        setOrder(res.data.data);
        return res.data.data;
      }
      notifyError(res.data?.message || "Failed to resume order");
      return null;
    } catch (err) {
      notifyError(err?.response?.data?.message || "Failed to resume order");
      return null;
    }
  }, [order, token]);

  // ── Transfer to another table ─────────────────────────────
  const transferTable = useCallback(
    async (targetTableId) => {
      if (!order) return null;
      try {
        const res = await PosServices.transferTable(order._id, targetTableId, headers);
        if (res.data?.success) {
          setOrder(res.data.data);
          return res.data.data;
        }
        notifyError(res.data?.message || "Transfer failed");
        return null;
      } catch (err) {
        notifyError(err?.response?.data?.message || "Transfer failed");
        return null;
      }
    },
    [order, token],
  );

  // ── Void ──────────────────────────────────────────────────
  const voidOrder = useCallback(async (reason) => {
    if (!order) return;
    latestItemsRef.current = null;
    if (persistTimerRef.current) clearTimeout(persistTimerRef.current);
    try {
      const payload = reason ? { reason } : {};
      const res = await PosServices.voidOrder(order._id, payload, headers);
      if (res.data?.success) {
        notifySuccess("Order voided");
        setOrder(null);
      }
    } catch (err) {
      notifyError(err?.response?.data?.message || "Failed to void order");
    }
  }, [order, token]);

  // ── Clear local order (after finishing) ───────────────────
  const clearOrder = useCallback(() => {
    latestItemsRef.current = null;
    if (persistTimerRef.current) clearTimeout(persistTimerRef.current);
    setOrder(null);
  }, []);

  // ── Soft-refresh from socket events ──────────────────────
  // Used by the POS socket handler when an external change (e.g. QR order:fired)
  // comes in for the current table. Unlike openOrder this does NOT clear pending
  // cart items or cancel the persist timer — it merges fresh QR items from the
  // server on top of any unsaved POS changes so neither source loses data.
  const softRefreshOrder = useCallback(
    async (orderId) => {
      if (!orderId) return;
      try {
        const res = await PosServices.getOrder(orderId, headers);
        if (!res.data?.success) return;
        const fresh = res.data.data;
        setOrder((prev) => {
          if (!prev) return fresh;
          const pending = latestItemsRef.current;
          if (!pending) return fresh; // no pending POS edits — just use server state
          // Keep QR items from the authoritative server response; keep POS items from
          // the in-flight pending buffer so unsaved additions are not lost.
          const freshQr = (fresh.items || []).filter((it) => it.lineSource === "qr_customer");
          const localPos = pending.filter((it) => (it.lineSource || "pos_staff") !== "qr_customer");
          const merged = [...freshQr, ...localPos];
          latestItemsRef.current = merged;
          const totals = recalcTotals(merged, fresh.discountType, fresh.discountValue, fresh.taxRate, fresh);
          return { ...fresh, items: merged, ...totals };
        });
      } catch (_) {
        // Silently ignore — a failed refresh just means POS shows cached state
      }
    },
    [token],
  );

  return {
    order,
    setOrder,
    loading,
    checkoutLoading,
    syncState,
    openOrder,
    loadOrder,
    openWalkinOrder,
    softRefreshOrder,
    addItem,
    updateItemQty,
    removeItem,
    updateItemNote,
    updateStaffNotes,
    updateGuestCount,
    confirmGuestCount,
    holdOrder,
    resumeOrder,
    transferTable,
    updateDiscount,
    updateCustomer,
    updateSalesChannel,
    collectPayment,
    sendToKitchen,
    checkout,
    voidOrder,
    clearOrder,
  };
};

export default usePosOrder;
