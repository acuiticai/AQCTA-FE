/** Shared toolbar height for POS admin filters (Tables Summary, Reports, etc.) */
export const POS_FILTER_BAR_HEIGHT = 36;

/** Makes react-select fill a fixed-height wrapper (pair with `h-9` on parent). */
export const posFilterBarSelectStyles = {
  control: (provided, state) => ({
    ...provided,
    minHeight: "100%",
    height: "100%",
    boxSizing: "border-box",
  }),
  container: (provided) => ({
    ...provided,
    height: `${POS_FILTER_BAR_HEIGHT}px`,
  }),
  valueContainer: (provided) => ({
    ...provided,
    height: "100%",
    padding: "0 4px",
    display: "flex",
    alignItems: "center",
  }),
  indicatorsContainer: (provided) => ({
    ...provided,
    height: "100%",
    alignItems: "center",
  }),
};
