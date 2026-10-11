import React from "react";
import { DateRangeComponent } from "@/page-layouts/index";

// As this being used in multiple places,
// that's why we re route this to the DateRangeComponent
// to avoid code duplication
export default function DateRangePicker({ ...props }) {
  return <DateRangeComponent {...props} />;
}
