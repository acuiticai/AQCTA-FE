import { useEffect } from "react";
import useSingleBusinessMode from "@/hooks/useSingleBusinessMode";

/**
 * Hides children (label + business picker) when only one business is assigned,
 * and auto-selects that business via onAutoSelect.
 */
export default function SingleBusinessField({
  children,
  onAutoSelect,
  selectedValue,
  className,
}) {
  const { isSingleBusiness, singleBusinessId } = useSingleBusinessMode();

  useEffect(() => {
    if (!isSingleBusiness || !singleBusinessId || !onAutoSelect) return;
    if (selectedValue) return;
    onAutoSelect(singleBusinessId);
  }, [isSingleBusiness, singleBusinessId, selectedValue, onAutoSelect]);

  if (isSingleBusiness) return null;
  if (!children) return null;
  return className ? <div className={className}>{children}</div> : children;
}
