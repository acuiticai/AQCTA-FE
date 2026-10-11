import { Loader } from "../index";
import { useRef, useLayoutEffect } from "react";

export default function Button({
  label,
  onClick,
  className = "",
  secondary = false,
  gray = false,
  success = false,
  failure = false,
  size = "md",
  startIcon = null,
  loading = false,
  ...props
}) {
  const btnRef = useRef(null);

  useLayoutEffect(() => {
    if (!btnRef.current) return;
    btnRef.current.style.width = "";
    // eslint-disable-next-line
    void btnRef.current.offsetWidth;
    if (loading) {
      btnRef.current.style.width = btnRef.current.scrollWidth + "px";
    } else {
      btnRef.current.style.width = "";
    }
  }, [loading, label, props.children]);

  const minWidth = size === "sm" ? "80px" : "150px";

  const hasCustomBackground = Boolean(props.style?.backgroundColor);

  const getClassName = () => {
    if (success) {
      return "text-base text-p-white bg-paid active:bg-paid hover:bg-paid-dark";
    }
    if (failure) {
      return "text-base text-p-white bg-rejected active:bg-rejected hover:bg-rejected-dark";
    }
    if (secondary) {
      return "text-base text-p-black bg-p-white active:bg-p-gray-dark hover:bg-p-gray-dark";
    }
    if (gray) {
      return "text-base text-p-white bg-p-gray active:bg-p-gray hover:bg-p-gray-dark2";
    }
    // Theme / inline backgroundColor wins — skip hardcoded p-blue
    if (hasCustomBackground) {
      return "text-base text-p-white shadow-[0_10px_22px_rgba(11,120,232,0.28)] hover:opacity-90";
    }
    return "acu-btn-primary text-base text-p-white hover:brightness-105";
  };

  return (
    <button
      {...props}
      ref={btnRef}
      onClick={onClick}
      style={{
        minWidth,
        transition: "width 0.2s",
        pointerEvents: loading ? "none" : undefined,
        height: "auto",
        ...props.style,
      }}
      className={`flex items-center justify-${
        startIcon ? "start" : "center"
      } h-[32px] px-[16px] py-[8px] rounded-[12px] ${className} ${getClassName()}`}
      disabled={props.disabled}
    >
      {loading && (
        <span className="mr-2 flex items-center">
          <Loader
            color={gray || success || failure || secondary ? null : "white"}
          />
        </span>
      )}
      {!loading && startIcon && (
        <span className="mr-2 flex items-center">{startIcon}</span>
      )}
      {/* Remove opacity-70 so text color does not change on loading */}
      <span className="flex gap-2 items-center">{label || props.children}</span>
    </button>
  );
}
