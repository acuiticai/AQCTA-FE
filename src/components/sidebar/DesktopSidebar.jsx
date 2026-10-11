import React, { useContext } from "react";
import SidebarContent from "@/components/sidebar/SidebarContent";
import { SidebarContext } from "@/context/SidebarContext";

const DesktopSidebar = () => {
  const { isSidebarCollapsed } = useContext(SidebarContext);

  return (
    <aside
      className={`z-20 hidden h-full flex-shrink-0 border-r border-[#e2eaf2] bg-white shadow-sm transition-all duration-300 lg:block ${
        isSidebarCollapsed ? "w-100" : "w-fit-content"
      }`}
      style={{ backgroundColor: "#ffffff" }}
    >
      <SidebarContent />
    </aside>
  );
};

export default DesktopSidebar;
