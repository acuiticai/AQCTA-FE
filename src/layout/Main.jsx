import React from "react";
import { useLocation } from "react-router-dom";

const Main = ({ children }) => {
  const location = useLocation();
  const isHome = location.pathname === "/home";
  const isDashboard = location.pathname === "/dashboard";
  const fullBleed = isHome || isDashboard;

  return (
    <main
      id="main-content"
      className={`min-h-0 min-w-0 max-w-full flex-1 ${
        isHome ? "overflow-hidden" : "overflow-x-hidden overflow-y-auto"
      }`}
      style={{
        background: isHome
          ? undefined
          : "linear-gradient(180deg, #F4F7FB 0%, #F8FAFC 55%, #F4F7FB 100%)",
        fontFamily: '"Plus Jakarta Sans", "Outfit", "Segoe UI", sans-serif',
      }}
    >
      <div
        className={`min-w-0 w-full max-w-full ${
          fullBleed ? "h-full px-0" : "mx-auto px-2 sm:container sm:px-3"
        }`}
      >
        {children}
      </div>
    </main>
  );
};

export default Main;
