import DropdownBasic from "../DropdownBasic";

/**
 * Default select for DataTable `filters` (except business picker, date, text, checkbox, custom).
 * Gray rounded control — same styling app-wide in filter rows.
 */
const FilterDropdown = ({
  options = [],
  value,
  onChange,
  placeholder = "Select",
  isClearable = true,
  isMulti = false,
  className = "",
  customClassName = "",
  size = "md",
  sortOptions = true,
  ...rest
}) => (
  <div className="w-full min-w-0">
    <DropdownBasic
      options={options}
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      appearance="filterPill"
      isClearable={isClearable}
      isMulti={isMulti}
      className={className}
      customClassName={customClassName}
      size={size}
      sortOptions={sortOptions}
      width="100%"
      style={{ width: "100%" }}
      {...rest}
    />
  </div>
);

export default FilterDropdown;
