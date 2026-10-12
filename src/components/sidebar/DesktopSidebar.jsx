import React, { useContext } from "react";
import SidebarContent from "@/components/sidebar/SidebarContent";
import { SidebarContext } from "@/context/SidebarContext";

const DesktopSidebar = () => {
  const { isSidebarCollapsed } = useContext(SidebarContext);

  return (
    <aside
      className={`admin-shell__aside admin-shell__aside--desktop z-20 hidden h-full flex-shrink-0 transition-all duration-300 lg:block ${
        isSidebarCollapsed ? "admin-shell__aside--collapsed" : ""
      }`}
      style={isSidebarCollapsed ? { width: 72 } : undefined}
    >
      <SidebarContent />
    </aside>
  );
};

export default DesktopSidebar;
