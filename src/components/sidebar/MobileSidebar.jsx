import React, { useContext, useEffect } from "react";
import { Transition, Backdrop } from "@windmill/react-ui";

//internal import
import SidebarContent from "@/components/sidebar/SidebarContent";
import { SidebarContext } from "@/context/SidebarContext";

function MobileSidebar() {
  const { isSidebarOpen, closeSidebar, windowDimension } =
    useContext(SidebarContext);

  // Desktop uses the persistent sidebar — dismiss the overlay if we cross `lg`
  useEffect(() => {
    if (windowDimension >= 1024) {
      closeSidebar();
    }
  }, [windowDimension, closeSidebar]);

  return (
    <Transition show={isSidebarOpen}>
      <>
        <Transition
          enter="transition ease-in-out duration-150"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="transition ease-in-out duration-150"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <Backdrop onClick={closeSidebar} />
        </Transition>

        <Transition
          enter="transition ease-in-out duration-200"
          enterFrom="opacity-0 transform -translate-x-full"
          enterTo="opacity-100 transform translate-x-0"
          leave="transition ease-in-out duration-150"
          leaveFrom="opacity-100 transform translate-x-0"
          leaveTo="opacity-0 transform -translate-x-full"
        >
          <aside
            className="admin-shell__aside admin-shell__aside--mobile fixed inset-y-0 left-0 z-50 mt-16 w-[min(100vw-3rem,var(--acu-sidebar-width))] flex-shrink-0 overflow-y-auto lg:hidden"
            aria-label="Navigation menu"
          >
            <SidebarContent forceExpanded />
          </aside>
        </Transition>
      </>
    </Transition>
  );
}

export default MobileSidebar;
