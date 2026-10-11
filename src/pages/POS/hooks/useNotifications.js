import { useState, useCallback, useEffect } from "react";

const MAX_NOTIFICATIONS = 50;
const LS_KEY = "pos.notifications";

const SOURCE_LABEL = {
  qr_table: "QR",
  qr: "QR",
  dine_in: "POS",
  walkin: "POS",
  pos: "POS",
  pos_staff: "POS",
  mixed: "Mixed",
};

const STATUS_LABEL = {
  new: "New",
  preparing: "Preparing",
  ready: "Ready",
  served: "Served",
  cancelled: "Cancelled",
  open: "Open",
  completed: "Completed",
  voided: "Voided",
  held: "Held",
};

function buildLabel(event) {
  const nextStatus = event.nextStatus ? STATUS_LABEL[event.nextStatus] || event.nextStatus : null;

  switch (event.type) {
    case "order:created":       return "New order opened";
    case "order:fired":         return "Order sent to kitchen";
    case "order:completed":     return "Order completed";
    case "order:voided":        return "Order voided";
    case "order:items_updated": return "Items updated";
    case "order:payment_collected": return "Payment collected";
    case "order:held":          return "Order parked";
    case "order:resumed":       return "Order resumed";
    case "order:transferred":   return "Table transferred";
    case "kitchen:ticket:new":  return "Kitchen ticket created";
    case "kitchen:ticket:status": {
      const statusPart = nextStatus ? ` → ${nextStatus}` : "";
      return `Ticket status${statusPart}`;
    }
    case "kitchen:ticket:priority": return "Ticket marked urgent";
    default:                    return event.type;
  }
}

const EVENT_ICONS = {
  "order:created": "🧾",
  "order:fired": "🔥",
  "order:completed": "✅",
  "order:voided": "❌",
  "order:items_updated": "✏️",
  "order:payment_collected": "💰",
  "order:held": "⏸️",
  "order:resumed": "▶️",
  "order:transferred": "↔️",
  "kitchen:ticket:new": "🍽️",
  "kitchen:ticket:status": "🔔",
  "kitchen:ticket:priority": "⚡",
};

export function useNotifications() {
  const [notifications, setNotifications] = useState(() => {
    try {
      const saved = localStorage.getItem(LS_KEY);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  const [unreadCount, setUnreadCount] = useState(() => {
    try {
      const saved = localStorage.getItem(LS_KEY + ".unread");
      return saved ? Number(saved) : 0;
    } catch {
      return 0;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(LS_KEY, JSON.stringify(notifications));
    } catch {
      // quota exceeded — skip
    }
  }, [notifications]);

  useEffect(() => {
    try {
      localStorage.setItem(LS_KEY + ".unread", String(unreadCount));
    } catch {
      // ignore
    }
  }, [unreadCount]);

  const addEvent = useCallback((event) => {
    const src = SOURCE_LABEL[event.serviceType || event.source] || null;
    const notif = {
      id: `${event.type}-${event.ts || Date.now()}-${Math.random().toString(36).slice(2)}`,
      type: event.type,
      icon: EVENT_ICONS[event.type] || "📡",
      label: buildLabel(event),
      orderId: event.orderId || null,
      orderNumber: event.orderNumber || null,
      ticketId: event.ticketId || null,
      ticketNumber: event.ticketNumber || null,
      tableId: event.tableId || null,
      source: src,
      nextStatus: event.nextStatus ? (STATUS_LABEL[event.nextStatus] || event.nextStatus) : null,
      sectionName: event.sectionName || null,
      ts: event.ts || new Date().toISOString(),
      read: false,
    };
    setNotifications((prev) => [notif, ...prev].slice(0, MAX_NOTIFICATIONS));
    setUnreadCount((n) => n + 1);
  }, []);

  const markAllRead = useCallback(() => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    setUnreadCount(0);
  }, []);

  const clearAll = useCallback(() => {
    setNotifications([]);
    setUnreadCount(0);
    try {
      localStorage.removeItem(LS_KEY);
      localStorage.removeItem(LS_KEY + ".unread");
    } catch {
      // ignore
    }
  }, []);

  return { notifications, unreadCount, addEvent, markAllRead, clearAll };
}
