import React, { useCallback, useEffect, useRef, useState } from "react";
import { useHistory } from "react-router-dom";

import CustomerNotificationServices from "../../services/notificationService";
import {
  BellIcon,
  ClipboardIcon,
  DocumentIcon,
  InvoiceIcon,
} from "../ui/icons";

/** The kinds a notification can be about, and how each one reads. */
const CATEGORY_ICONS = {
  contract_review: DocumentIcon,
  quotation: ClipboardIcon,
  audit: ClipboardIcon,
  invoice: InvoiceIcon,
  general: BellIcon,
};

const relativeTime = (value) => {
  if (!value) return "";
  const then = new Date(value).getTime();
  if (Number.isNaN(then)) return "";
  const minutes = Math.round((Date.now() - then) / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(value).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
  });
};

/**
 * The portal's notification bell.
 *
 * PC&I already emails a customer at each milestone — contract review decided,
 * a quotation issued, the acceptance letter, the audit notice. An email is
 * easy to miss, and until now the bell had nothing behind it: the badge was
 * hard-wired to zero and clicking it did nothing. This is the same milestones,
 * kept in the portal, where they are still there when the customer next looks.
 *
 * Owns its own data rather than routing it through the account session: the
 * count changes as things are read, and the session is persisted to
 * localStorage, which is the wrong place for something that moves.
 */
export default function NotificationBell() {
  const history = useHistory();
  const [items, setItems] = useState([]);
  const [unread, setUnread] = useState(0);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const wrapRef = useRef(null);

  const load = useCallback(async () => {
    try {
      const res = await CustomerNotificationServices.getMyNotifications();
      setItems(Array.isArray(res?.data?.data) ? res.data.data : []);
      setUnread(Number(res?.data?.unreadCount || 0));
    } catch {
      /* The bell is not worth an error message of its own — an empty bell is
         a smaller problem than a toast on every page load. */
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  /* Refresh while the portal is open, so a quotation issued during the
     session shows up without a reload. Paused while the tab is hidden. */
  useEffect(() => {
    const tick = () => {
      if (document.visibilityState === "visible") load();
    };
    const timer = setInterval(tick, 120000);
    document.addEventListener("visibilitychange", tick);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", tick);
    };
  }, [load]);

  useEffect(() => {
    if (!open) return undefined;
    const onPointerDown = (event) => {
      if (wrapRef.current && !wrapRef.current.contains(event.target)) {
        setOpen(false);
      }
    };
    const onKeyDown = (event) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  const toggle = async () => {
    const next = !open;
    setOpen(next);
    if (next) {
      setLoading(true);
      await load();
      setLoading(false);
    }
  };

  const openItem = async (item) => {
    setOpen(false);
    if (!item.isRead) {
      /* Marked read locally first: the panel closes immediately, and waiting
         on the round trip would leave the badge stale for that moment. */
      setItems((prev) =>
        prev.map((n) => (n._id === item._id ? { ...n, isRead: true } : n)),
      );
      setUnread((prev) => Math.max(0, prev - 1));
      try {
        await CustomerNotificationServices.markRead(item._id);
      } catch {
        load();
      }
    }
    if (item.link) history.push(item.link);
  };

  const readAll = async () => {
    setItems((prev) => prev.map((n) => ({ ...n, isRead: true })));
    setUnread(0);
    try {
      await CustomerNotificationServices.markAllRead();
    } catch {
      load();
    }
  };

  return (
    <div className="epc-notifs" ref={wrapRef}>
      <button
        type="button"
        className="epc-iconbtn"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={unread ? `Notifications, ${unread} unread` : "Notifications"}
        onClick={toggle}
      >
        <BellIcon size={18} />
        {unread > 0 && <span className="epc-iconbtn__dot" aria-hidden="true" />}
      </button>

      {open && (
        <div className="epc-notifs__panel" role="menu">
          <header className="epc-notifs__head">
            <span className="epc-notifs__title">Notifications</span>
            {unread > 0 ? (
              <button
                type="button"
                className="epc-notifs__readall"
                onClick={readAll}
              >
                Mark all read
              </button>
            ) : null}
          </header>

          <div className="epc-notifs__list">
            {loading && items.length === 0 ? (
              <p className="epc-notifs__empty">Loading…</p>
            ) : items.length === 0 ? (
              <p className="epc-notifs__empty">
                Nothing yet. Updates on your applications, quotations and audits
                appear here.
              </p>
            ) : (
              items.map((item) => {
                const Icon = CATEGORY_ICONS[item.category] || BellIcon;
                return (
                  <button
                    key={item._id}
                    type="button"
                    role="menuitem"
                    className={`epc-notifs__item${item.isRead ? "" : " is-unread"}`}
                    onClick={() => openItem(item)}
                  >
                    <span className="epc-notifs__icon" aria-hidden="true">
                      <Icon size={15} />
                    </span>
                    <span className="epc-notifs__text">
                      <span className="epc-notifs__itemtitle">{item.title}</span>
                      {item.body ? (
                        <span className="epc-notifs__body">{item.body}</span>
                      ) : null}
                      <span className="epc-notifs__time">
                        {relativeTime(item.createdAt)}
                      </span>
                    </span>
                    {!item.isRead && (
                      <span className="epc-notifs__unread" aria-hidden="true" />
                    )}
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
