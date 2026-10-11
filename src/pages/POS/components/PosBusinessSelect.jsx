import React, { useContext, useMemo, useState } from "react";
import { useHistory } from "react-router-dom";
import {
  ArrowRight,
  LogOut,
  Search,
  Store,
  Building2,
  LayoutDashboard,
} from "lucide-react";
import { AdminContext } from "@/context/AdminContext";
import { resolveBusinessLogoUrl } from "../utils/branding";

const PosBusinessSelect = ({ businesses = [], onSelect, logo = "" }) => {
  const {
    state: { adminInfo },
  } = useContext(AdminContext);
  const history = useHistory();
  const [search, setSearch] = useState("");

  const cashierName =
    adminInfo?.name || adminInfo?.email?.split("@")[0] || "Cashier";

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return businesses;
    return businesses.filter(
      (b) =>
        (b.name || "").toLowerCase().includes(q) ||
        (b.email || "").toLowerCase().includes(q),
    );
  }, [businesses, search]);

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-gradient-to-br from-slate-50 via-white to-indigo-50/40 overflow-hidden">
      {/* Top bar — minimal */}
      <div className="flex items-center justify-between px-5 py-3 border-b border-gray-200 bg-white/80 backdrop-blur-sm shrink-0">
        <div className="flex items-center gap-2.5">
          {logo ? (
            <img
              src={logo}
              alt="logo"
              className="h-8 w-auto object-contain"
              onError={(e) => {
                e.currentTarget.style.display = "none";
              }}
            />
          ) : (
            <div className="p-1.5 rounded-lg bg-[var(--p-blue)]/10 text-[var(--p-blue)]">
              <Store size={16} />
            </div>
          )}
          <span className="text-sm font-bold text-gray-800 tracking-tight">
            POS
          </span>
        </div>

        <button
          type="button"
          onClick={() => history.push("/dashboard")}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg text-gray-600 hover:text-gray-800 hover:bg-gray-100 transition-colors"
        >
          <LayoutDashboard size={14} />
          Back to Dashboard
        </button>
      </div>

      {/* Main content */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-5xl mx-auto px-5 py-8 sm:py-12">
          {/* Hero */}
          <div className="text-center mb-8">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[var(--p-blue)]/10 text-[var(--p-blue)] text-[11px] font-semibold mb-4 uppercase tracking-wider">
              <Store size={12} />
              POS Terminal
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 tracking-tight">
              Welcome back, {cashierName}
            </h1>
            <p className="text-sm text-gray-500 mt-2">
              Select a business to start taking orders
            </p>
          </div>

          {/* Search */}
          {businesses.length > 4 && (
            <div className="relative max-w-md mx-auto mb-6">
              <Search
                size={15}
                className="absolute left-1 top-1/2 -translate-y-1/2 text-gray-400"
              />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search businesses..."
                className="w-full pl-10 pr-3 py-2.5 text-sm bg-gray-50 outline-none border-2 border-gray-200 rounded-xl focus:border-[var(--p-blue)] focus:bg-white transition-all"
              />
            </div>
          )}

          {/* Business cards */}
          {businesses.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="p-5 rounded-full bg-gray-100 text-gray-400 mb-4">
                <Building2 size={36} />
              </div>
              <h3 className="text-base font-semibold text-gray-700">
                No businesses available
              </h3>
              <p className="text-xs text-gray-500 mt-1 max-w-sm">
                Your account is not linked to any business. Contact your
                administrator to get access.
              </p>
              <button
                type="button"
                onClick={() => history.push("/dashboard")}
                className="mt-5 inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
              >
                <LogOut size={13} />
                Return to Dashboard
              </button>
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-10">
              <p className="text-sm text-gray-500">
                No businesses match{" "}
                <span className="font-semibold text-gray-700">"{search}"</span>
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {filtered.map((biz) => {
                const bizLogo = resolveBusinessLogoUrl(biz);
                return (
                  <button
                    key={biz._id}
                    type="button"
                    onClick={() => onSelect(biz._id)}
                    className="group relative flex flex-col p-5 rounded-2xl bg-white border border-gray-200 hover:border-[var(--p-blue)] hover:shadow-lg hover:shadow-[var(--p-blue)]/5 transition-all duration-200 text-left overflow-hidden focus:outline-none focus:ring-2 focus:ring-[var(--p-blue)]/30"
                  >
                    {/* Subtle hover gradient */}
                    <div className="absolute inset-0 bg-gradient-to-br from-[var(--p-blue)]/0 to-[var(--p-blue)]/0 group-hover:from-[var(--p-blue)]/[0.03] group-hover:to-transparent transition-all" />

                    <div className="relative flex items-start justify-between mb-3">
                      <div className="flex items-center justify-center h-16 w-16 rounded-xl bg-white border border-gray-200 shadow-sm overflow-hidden shrink-0 p-1.5">
                        {bizLogo ? (
                          <img
                            src={bizLogo}
                            alt={biz.name}
                            className="h-full w-full object-contain"
                            onError={(e) => {
                              e.currentTarget.style.display = "none";
                              const parent = e.currentTarget.parentElement;
                              if (parent && !parent.querySelector("svg")) {
                                const icon = document.createElement("div");
                                icon.className = "text-gray-400";
                                icon.innerHTML =
                                  '<svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 21h18"/><path d="M3 7l9-4 9 4"/><path d="M3 7v14"/><path d="M21 7v14"/><path d="M9 21V11"/><path d="M15 21V11"/></svg>';
                                parent.appendChild(icon);
                              }
                            }}
                          />
                        ) : (
                          <Building2 size={22} className="text-gray-400" />
                        )}
                      </div>
                      <div className="opacity-0 group-hover:opacity-100 transition-opacity p-1.5 rounded-full bg-[var(--p-blue)] text-white">
                        <ArrowRight size={13} />
                      </div>
                    </div>

                    <div className="relative">
                      <h3 className="text-sm font-bold text-gray-900 leading-tight line-clamp-2">
                        {biz.name || "Unnamed Business"}
                      </h3>
                      {biz.email && (
                        <p className="text-[11px] text-gray-500 mt-1 truncate">
                          {biz.email}
                        </p>
                      )}
                      {(biz.tel || biz.address) && (
                        <p className="text-[11px] text-gray-400 mt-1.5 truncate">
                          {biz.tel || biz.address}
                        </p>
                      )}
                    </div>

                    <div className="relative mt-4 pt-3 border-t border-gray-100 flex items-center justify-between text-[11px] text-gray-500">
                      <span>Enter terminal</span>
                      <span className="font-semibold text-[var(--p-blue)] group-hover:translate-x-0.5 transition-transform">
                        Open →
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default React.memo(PosBusinessSelect);
