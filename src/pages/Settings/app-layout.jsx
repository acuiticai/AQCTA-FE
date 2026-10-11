"use client";

import { useState, useEffect } from "react";
import Sidebar from "./sidebar";
import { useMainShell } from "@/context/MainShellContext";
// import { fetchConfiguration } from "@/components/formatAmount";

const AppLayout = ({ children }) => {
  const inMainShell = useMainShell();
  const [isSidebarOpen, setIsSidebarOpen] = useState(
    () => window.innerWidth >= 1024,
  );

  // Product settings live under the main System Settings sidebar — skip the
  // duplicate settings chrome when already inside Layout.
  useEffect(() => {
    if (inMainShell) return undefined;
    console.log("Message fetchConfiguration: ");
    // fetchConfiguration(adminInfo?.token);
  }, [inMainShell]);

  // Close sidebar on mobile when resizing below lg breakpoint
  useEffect(() => {
    if (inMainShell) return undefined;
    const handleResize = () => {
      if (window.innerWidth < 1024) setIsSidebarOpen(false);
      else setIsSidebarOpen(true);
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [inMainShell]);

  // Allow the existing top header hamburger to toggle the settings sidebar
  useEffect(() => {
    if (inMainShell) return undefined;
    const handleToggleSettingsSidebar = () => {
      setIsSidebarOpen((prev) => !prev);
    };

    window.addEventListener(
      "toggle-settings-sidebar",
      handleToggleSettingsSidebar,
    );

    return () => {
      window.removeEventListener(
        "toggle-settings-sidebar",
        handleToggleSettingsSidebar,
      );
    };
  }, [inMainShell]);

  if (inMainShell) {
    return <>{children}</>;
  }

  return (
    <div className="min-h-screen bg-gray-100">
      <Sidebar
        isOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
        onOpen={() => setIsSidebarOpen(true)}
      />

      <div
        className={`transition-all duration-300 ${
          isSidebarOpen ? "lg:ml-72" : "ml-0"
        }`}
      >
        <main>{children}</main>
      </div>
    </div>
  );
};

export default AppLayout;
