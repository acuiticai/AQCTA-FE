import React from "react";
import { Loader } from "@/page-layouts/index";

const ThemeSuspense = () => {
  return (
    <div
      className="fixed top-0 left-0 w-full h-full flex items-center justify-center z-50 pointer-events-none"
      style={{ backgroundColor: "transparent" }}
    >
      <div className="pointer-events-auto">
        <Loader color="var(--p-blue)" />
      </div>
    </div>
  );
};

export default ThemeSuspense;
