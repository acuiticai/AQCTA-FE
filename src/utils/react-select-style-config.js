// Primary accent from theme (--p-blue is set by applyThemeColorVars from Configurations)
const accentColor = "var(--p-blue)";
const accentActive = "var(--p-blue-dark)";

const config = {
  control: (base, state) => ({
    ...base,
    backgroundColor: "var(--input-background-gray)",
    borderWidth: "2px",
    borderColor: state.isFocused ? accentColor : "transparent",
    boxShadow: "none",
    "&:hover": { borderColor: state.isFocused ? accentColor : "transparent" },
    borderRadius: "12px",
    minHeight: "2.5rem",
    padding: "0px 4px",
  }),
  option: (base, state) => ({
    ...base,
    backgroundColor: state.isFocused ? accentColor : "white",
    color: state.isFocused ? "#fff" : "#1f2937",
    "&:active": { backgroundColor: accentActive },
  }),
  menu: (base) => ({
    ...base,
    backgroundColor: "white",
    borderRadius: "0.5rem",
    boxShadow: "0 4px 6px rgba(0, 0, 0, 0.1)",
    zIndex: 9999,
  }),
  input: (base) => ({
    ...base,
    outline: "none",
    border: "none",
    boxShadow: "none",
  }),
};

/** Above react-responsive-modal stack (~20001) so menus show inside modals */
export const MODAL_SELECT_MENU_Z_INDEX = 21050;

export function getModalReactSelectStyles(baseConfig = config) {
  return {
    ...baseConfig,
    menuPortal: (base, state) => ({
      ...(typeof baseConfig.menuPortal === "function"
        ? baseConfig.menuPortal(base, state)
        : base),
      zIndex: MODAL_SELECT_MENU_Z_INDEX,
    }),
    menu: (base, state) => ({
      ...(typeof baseConfig.menu === "function"
        ? baseConfig.menu(base, state)
        : base),
      zIndex: MODAL_SELECT_MENU_Z_INDEX,
    }),
  };
}

export default config;
