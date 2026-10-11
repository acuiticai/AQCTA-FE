import { useState, useEffect, useCallback, useContext } from "react";
import PosServices from "@/services/PosServices";
import { AdminContext } from "@/context/AdminContext";
import { notifyError } from "@/utils/toast";

const usePosData = (businessId) => {
  const { state } = useContext(AdminContext);
  const token = state?.adminInfo?.token;

  const headers = token
    ? { Authorization: `Bearer ${token}` }
    : {};

  // ── Tables ────────────────────────────────────────────────
  const [tables, setTables] = useState([]);
  const [floors, setFloors] = useState(["All"]);
  const [tablesLoading, setTablesLoading] = useState(!!businessId);

  const fetchTables = useCallback(
    async (floor) => {
      if (!businessId) return;
      setTablesLoading(true);
      try {
        const res = await PosServices.getTables(
          { business: businessId, floor: floor === "All" ? "" : floor },
          headers
        );
        if (res.data?.success) {
          setTables(res.data.data || []);
          setFloors(res.data.floors || ["All"]);
        }
      } catch (err) {
        notifyError(err?.response?.data?.message || "Failed to load tables");
      } finally {
        setTablesLoading(false);
      }
    },
    [businessId, token]
  );

  // ── Categories ────────────────────────────────────────────
  const [categories, setCategories] = useState([]);
  const [categoriesLoading, setCategoriesLoading] = useState(false);

  const fetchCategories = useCallback(async () => {
    if (!businessId) return;
    setCategoriesLoading(true);
    try {
      const res = await PosServices.getCategories(
        { business: businessId },
        headers
      );
      if (res.data?.success) {
        setCategories(res.data.data || []);
      }
    } catch (err) {
      notifyError(err?.response?.data?.message || "Failed to load categories");
    } finally {
      setCategoriesLoading(false);
    }
  }, [businessId, token]);

  // ── Items ─────────────────────────────────────────────────
  const [items, setItems] = useState([]);
  const [itemsLoading, setItemsLoading] = useState(!!businessId);
  const [itemsTotal, setItemsTotal] = useState(0);

  const fetchItems = useCallback(
    async (category, search, page = 1) => {
      if (!businessId) return;
      setItemsLoading(true);
      try {
        const params = { business: businessId, page, limit: 50 };
        if (category) params.category = category;
        if (search) params.search = search;

        const res = await PosServices.getItems(params, headers);
        if (res.data?.success) {
          setItems(res.data.data || []);
          setItemsTotal(res.data.total || 0);
        }
      } catch (err) {
        notifyError(err?.response?.data?.message || "Failed to load items");
      } finally {
        setItemsLoading(false);
      }
    },
    [businessId, token]
  );

  // ── Customers ─────────────────────────────────────────────
  const [customers, setCustomers] = useState([]);
  const [customersLoading, setCustomersLoading] = useState(false);

  // ── Payment methods (from Settings) ──────────────────────
  const [paymentMethods, setPaymentMethods] = useState([]);
  const [paymentMethodsLoading, setPaymentMethodsLoading] = useState(false);
  const [salesChannels, setSalesChannels] = useState([]);
  const [salesChannelsLoading, setSalesChannelsLoading] = useState(false);

  const searchCustomers = useCallback(
    async (q) => {
      if (!businessId) return;
      setCustomersLoading(true);
      try {
        const res = await PosServices.searchCustomers(
          { business: businessId, q },
          headers
        );
        if (res.data?.success) {
          setCustomers(res.data.data || []);
        }
      } catch (err) {
        notifyError(
          err?.response?.data?.message || "Failed to search customers"
        );
      } finally {
        setCustomersLoading(false);
      }
    },
    [businessId, token]
  );

  const fetchPaymentMethods = useCallback(async () => {
    if (!businessId) return;
    setPaymentMethodsLoading(true);
    try {
      const res = await PosServices.getBusinessPaymentMethods(
        businessId,
        headers
      );
      if (res.data?.success) {
        setPaymentMethods(res.data.data || []);
      } else {
        setPaymentMethods([]);
      }
    } catch (_) {
      setPaymentMethods([]);
    } finally {
      setPaymentMethodsLoading(false);
    }
  }, [businessId, token]);

  const fetchSalesChannels = useCallback(async () => {
    if (!businessId) return;
    setSalesChannelsLoading(true);
    try {
      const res = await PosServices.getBusinessSalesChannels(businessId, headers);
      if (res.data?.success) setSalesChannels(res.data.data || []);
      else setSalesChannels([]);
    } catch (_) {
      setSalesChannels([]);
    } finally {
      setSalesChannelsLoading(false);
    }
  }, [businessId, token]);

  // Silent background poll — updates table status badges without a loading spinner
  const pollTables = useCallback(async () => {
    if (!businessId) return;
    try {
      const res = await PosServices.getTables({ business: businessId }, headers);
      if (res.data?.success) {
        setTables(res.data.data || []);
        setFloors(res.data.floors || ["All"]);
      }
    } catch (_) { /* ignore transient poll errors */ }
  }, [businessId, token]);

  // ── Initial load ──────────────────────────────────────────
  useEffect(() => {
    if (businessId) {
      fetchTables();
      fetchCategories();
      fetchItems();
      fetchPaymentMethods();
      fetchSalesChannels();
    }
  }, [businessId]);

  // Poll every 15 s so NEW / BILL badges stay current even if a socket event is missed
  useEffect(() => {
    if (!businessId) return;
    const id = setInterval(pollTables, 15_000);
    return () => clearInterval(id);
  }, [businessId, pollTables]);

  return {
    tables,
    floors,
    tablesLoading,
    fetchTables,
    categories,
    categoriesLoading,
    fetchCategories,
    items,
    itemsLoading,
    itemsTotal,
    fetchItems,
    customers,
    customersLoading,
    searchCustomers,
    paymentMethods,
    paymentMethodsLoading,
    fetchPaymentMethods,
    salesChannels,
    salesChannelsLoading,
    fetchSalesChannels,
    headers,
  };
};

export default usePosData;
