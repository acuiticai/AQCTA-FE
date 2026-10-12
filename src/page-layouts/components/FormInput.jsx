import ColorPicker from "@/components/document_template/color-picker";
import FileUpload from "@/components/document_template/file-upload";
import InputFieldWithLabel from "./InputFieldWithLabel";
import DropdownBasic from "./DropdownBasic";
import DropdownWithAddNewForm from "./DropdownAddNewForm";
import InputField from "./InputField";
import MultiField from "./MultiField";
import Checkbox from "./Checkbox";
import CustomDatePicker from "./CustomDatePicker";
import LabelValue from "./LabelValue";
import TextArea from "./TextArea";
import CustomRangePicker from "./CustomRangePicker";
import DateRangeComponent from "./DateRangeComponent";
import { EmptyCellContainer } from "./EmptyCellContainer";
import ObjectFormRenderer from "./ObjectFormRenderer";
import DropdownWithAddNewHtml from "./DropdownAddNewHtml";
import DynamicField from "./DynamicField";
import ReactQuill from "react-quill";
import "react-quill/dist/quill.snow.css";
import { useEffect } from "react";
import useSingleBusinessMode from "@/hooks/useSingleBusinessMode";

const BusinessSelectFormField = ({
  inputProps,
  defaultRequired,
  description,
  icon,
  ...props
}) => {
  const { isSingleBusiness, singleBusinessId } = useSingleBusinessMode();
  const onChange = props?.businessDropdownProps?.onChange;
  const selectedBusiness = props?.businessDropdownProps?.selectedBusiness;

  useEffect(() => {
    if (!isSingleBusiness || !singleBusinessId || !onChange) return;
    if (selectedBusiness) return;
    onChange(singleBusinessId);
  }, [isSingleBusiness, singleBusinessId, selectedBusiness, onChange]);

  if (isSingleBusiness) return null;

  return (
    <InputFieldWithLabel
      {...props}
      {...props?.businessDropdownProps}
      shouldShowError={props.shouldShowError ?? !!props.error}
      description={description}
      icon={icon}
      disabled={props?.disabled || props?.options?.length === 0}
      Input={
        <DropdownBasic
          {...props}
          {...inputProps}
          required={defaultRequired}
          shouldShowError={props.shouldShowError ?? !!props.error}
          showErrorText={false} // Error text handled by InputFieldWithLabel
          isDisabled={props?.disabled || false}
          isBusinessDropdown={true}
          businessDropdownProps={props?.businessDropdownProps || {}}
        />
      }
    />
  );
};

const FormInputComponent = ({
  inputProps,
  defaultRequired,
  description,
  icon,
  rowHeadroom = 0,
  ...props
}) => {
  switch (props.type || "text") {
    case "label":
      return (
        <InputFieldWithLabel
          {...props}
          {...inputProps}
          description={description}
          icon={icon}
          Input={
            <LabelValue
              {...props}
              {...inputProps}
              label={props.label}
              value={props.value}
            />
          }
        />
      );
    case "text":
    case "email":
    case "tel":
    case "number":
    case "password":
      return (
        <InputFieldWithLabel
          {...props}
          shouldShowError={props.shouldShowError ?? !!props.error}
          description={description}
          icon={icon}
          Input={
            <InputField
              {...props}
              {...inputProps}
              required={defaultRequired}
              shouldShowError={props.shouldShowError ?? !!props.error}
              showErrorText={false} // Error text handled by InputFieldWithLabel
            />
          }
        />
      );
    case "datetime-local":
      return (
        <InputFieldWithLabel
          {...props}
          shouldShowError={props.shouldShowError ?? !!props.error}
          description={description}
          icon={icon}
          Input={
            <CustomDatePicker
              {...props}
              {...inputProps}
              required={defaultRequired}
              showTimeSelect={true}
              showErrorText={false} // Error text handled by InputFieldWithLabel
            />
          }
        />
      );
    case "range":
      return (
        <InputFieldWithLabel
          {...props}
          description={description}
          icon={icon}
          Input={
            <CustomRangePicker
              {...props}
              {...inputProps}
              required={defaultRequired}
            />
          }
        />
      );
    case "date-range":
      return (
        <InputFieldWithLabel
          {...props}
          description={description}
          icon={icon}
          Input={
            <DateRangeComponent
              {...props}
              {...inputProps}
              required={defaultRequired}
            />
          }
        />
      );
    case "textarea":
      return (
        <InputFieldWithLabel
          {...props}
          shouldShowError={props.shouldShowError ?? !!props.error}
          description={description}
          icon={icon}
          Input={
            <TextArea
              rows={props.rows}
              {...props}
              {...inputProps}
              required={defaultRequired}
              shouldShowError={props.shouldShowError ?? !!props.error}
              showErrorText={false} // Error text handled by InputFieldWithLabel
            />
          }
        />
      );
    case "date":
      return (
        <InputFieldWithLabel
          {...props}
          description={description}
          icon={icon}
          Input={
            <CustomDatePicker
              {...props}
              {...inputProps}
              required={defaultRequired}
              showErrorText={false} // Error text handled by InputFieldWithLabel
            />
          }
        />
      );
    case "month":
      return (
        <InputFieldWithLabel
          {...props}
          description={description}
          icon={icon}
          Input={
            <InputField
              {...props}
              {...inputProps}
              required={defaultRequired}
              type="month"
              showErrorText={false} // Error text handled by InputFieldWithLabel
            />
          }
        />
      );
    case "select":
      if (props?.isBusinessDropdown) {
        return (
          <BusinessSelectFormField
            {...props}
            inputProps={inputProps}
            defaultRequired={defaultRequired}
            description={description}
            icon={icon}
          />
        );
      }
      const selectDisabled =
        Boolean(props?.disabled) ||
        (Array.isArray(props?.options) &&
          props.options.length === 0 &&
          !props?.isCreatable);
      return (
        <InputFieldWithLabel
          label={props.label}
          required={props.required}
          direction={props.direction}
          customLabelWidth={props.customLabelWidth}
          tightLabelInputSpacing={props.tightLabelInputSpacing}
          labelOnTop={props.labelOnTop}
          noLabel={props.noLabel}
          width={props.width}
          error={props.error}
          shouldShowError={props.shouldShowError ?? !!props.error}
          description={description || props.helpText}
          icon={icon}
          disabled={selectDisabled}
          Input={
            <DropdownBasic
              {...inputProps}
              options={props.options}
              value={props.value}
              onChange={props.onChange}
              onBlur={props.onBlur}
              placeholder={props.placeholder}
              name={props.name}
              id={props.id}
              inputId={props.inputId || props.id}
              required={defaultRequired}
              error={props.error}
              shouldShowError={props.shouldShowError ?? !!props.error}
              showErrorText={false}
              isDisabled={selectDisabled}
              isMulti={props.isMulti}
              isCreatable={props.isCreatable}
              isClearable={props.isClearable}
              sortOptions={props.sortOptions}
              grouped={props.grouped}
              appearance={props.appearance}
              className={props.className}
              customClassName={props.customClassName}
              styles={props.styles}
              multiValueSourceOptions={props.multiValueSourceOptions}
              isBusinessDropdown={props?.isBusinessDropdown || false}
              businessDropdownProps={props?.businessDropdownProps || {}}
            />
          }
        />
      );
    case "select-dropdown-with-add-new":
      return (
        <InputFieldWithLabel
          {...props}
          description={description}
          icon={icon}
          disabled={props?.disabled || props?.options?.length === 0}
          Input={
            <DropdownWithAddNewForm
              {...props}
              {...inputProps}
              required={defaultRequired}
            />
          }
        />
      );
    case "select-dropdown-with-add-new-html":
      return (
        <InputFieldWithLabel
          {...props}
          description={description}
          icon={icon}
          disabled={props?.disabled || props?.options?.length === 0}
          Input={
            <DropdownWithAddNewHtml
              {...props}
              {...inputProps}
              noLabel={props?.noLabel || true}
              required={defaultRequired}
            />
          }
        />
      );
    case "multi-field":
      return (
        <InputFieldWithLabel
          {...props}
          description={description}
          icon={icon}
          error={
            props.error || props?.fields?.find((field) => field?.error)?.error
          }
          shouldShowError={
            props.shouldShowError ||
            props?.fields?.find((field) => field?.shouldShowError)
              ?.shouldShowError
          }
          Input={
            <MultiField
              {...props}
              {...inputProps}
              required={defaultRequired}
              direction={
                props?.rowLayout
                  ? undefined
                  : props?.multiFieldDirection || props?.direction
              }
            />
          }
        />
      );
    case "color":
      return (
        <InputFieldWithLabel
          {...props}
          description={description}
          icon={icon}
          Input={
            <ColorPicker
              {...props}
              {...inputProps}
              required={defaultRequired}
            />
          }
        />
      );
    case "file":
      return (
        <InputFieldWithLabel
          {...props}
          description={description}
          icon={icon}
          Input={
            <FileUpload {...props} {...inputProps} required={defaultRequired} />
          }
        />
      );
    case "custom":
      return (
        <InputFieldWithLabel
          {...props}
          description={description}
          icon={icon}
          Input={props.component ? props.component() : null}
        />
      );
    case "raw-custom":
      return props.component ? props.component({ rowHeadroom }) : null;
    case "toggle":
      return (
        <InputFieldWithLabel
          {...props}
          description={description}
          icon={icon}
          Input={
            props.toggle || props.enableToggle ? (
              <div className="flex items-center space-x-2">
                {props.toggleLabels?.false && (
                  <span className="text-sm text-gray-500 dark:text-gray-300">
                    {props.toggleLabels.false}
                  </span>
                )}
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    className="sr-only peer"
                    checked={props.value}
                    onChange={props.onChange}
                  />
                  <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-transparent dark:peer-focus:ring-p-blue rounded-full peer dark:bg-gray-700 peer-checked:bg-p-blue transition-colors"></div>
                  <div className="absolute left-0.5 top-0.5 bg-white w-5 h-5 rounded-full transition-transform transform peer-checked:translate-x-full"></div>
                </label>
                {props.toggleLabels?.true && (
                  <span className="text-sm text-gray-500 dark:text-gray-300">
                    {props.toggleLabels.true}
                  </span>
                )}
              </div>
            ) : (
              <Checkbox {...props} {...inputProps} required={defaultRequired} />
            )
          }
        />
      );

    case "checkbox":
      return (
        <InputFieldWithLabel
          {...props}
          description={description}
          icon={icon}
          Input={
            <Checkbox {...props} {...inputProps} required={defaultRequired} />
          }
        />
      );
    case "dynamic-field":
      return (
        <InputFieldWithLabel
          {...props}
          description={description}
          icon={icon}
          Input={
            <DynamicField
              {...props}
              {...(inputProps || {})}
              required={defaultRequired}
            />
          }
        />
      );
    case "html":
      return (
        <InputFieldWithLabel
          {...props}
          description={description}
          icon={icon}
          Input={
            <div
              className={`${props.fullHeight ? "quill-full-height" : ""} ${
                props.background ? "custom-quill-background" : ""
              }`}
              style={
                props.fullHeight
                  ? { height: "100%", display: "flex", flexDirection: "column" }
                  : {}
              }
            >
              <ReactQuill
                value={props.value || ""}
                onChange={(value) => {
                  props?.onChange?.(value);
                }}
                theme="snow"
                modules={{
                  toolbar: [
                    [{ header: "1" }, { header: "2" }, { font: [] }],
                    [{ size: [] }],
                    ["bold", "italic", "underline", "strike", "blockquote"],
                    [
                      { list: "ordered" },
                      { list: "bullet" },
                      { indent: "-1" },
                      { indent: "+1" },
                    ],
                    ["link"],
                    ["clean"],
                  ],
                }}
                formats={[
                  "header",
                  "font",
                  "size",
                  "bold",
                  "italic",
                  "underline",
                  "strike",
                  "blockquote",
                  "list",
                  "bullet",
                  "indent",
                  "link",
                ]}
                placeholder={props.placeholder || "Enter content..."}
                readOnly={props.disabled}
                style={{
                  minHeight: props.fullHeight ? "100%" : "140px",
                  maxHeight: props.fullHeight ? "100%" : "280px",
                  flex: props.fullHeight ? "1" : "none",
                  backgroundColor: props.background || "white",
                }}
                {...inputProps}
              />
              {props.fullHeight && (
                <style jsx>{`
                  .custom-quill-background .ql-container {
                    background-color: ${props.background || "white"} !important;
                  }
                  .quill-full-height .ql-container {
                    flex: 1 !important;
                    height: auto !important;
                    max-height: none !important;
                  }
                  .quill-full-height .ql-editor {
                    height: 100% !important;
                    max-height: none !important;
                    overflow-y: auto !important;
                  }
                  .quill-full-height {
                    height: 100% !important;
                  }
                `}</style>
              )}
            </div>
          }
        />
      );
    case "img":
      return (
        <InputFieldWithLabel
          {...props}
          description={description}
          icon={icon}
          Input={
            props.value && props.value.trim() !== "" ? (
              <img
                src={props.value}
                alt="Image"
                onError={(e) => {
                  e.target.style.display = "none";
                  e.target.nextSibling.style.display = "block";
                }}
                {...props}
                {...inputProps}
                required={defaultRequired}
              />
            ) : (
              <EmptyCellContainer />
            )
          }
        />
      );
    case "object-form":
      return (
        <InputFieldWithLabel
          {...props}
          description={description}
          icon={icon}
          Input={
            <ObjectFormRenderer
              {...props}
              {...inputProps}
              required={defaultRequired}
            />
          }
        />
      );
    default:
      return null;
  }
};

const FormInput = ({
  rows,
  inputProps,
  defaultRequired,
  show = true,
  description,
  icon = null,
  ...props
}) => {
  if (!show) return null;

  return (
    <div
      className={`${props.inActive && "pointer-events-none text-p-blue-dark"}`}
    >
      <FormInputComponent
        {...props}
        rows={rows}
        inputProps={inputProps}
        defaultRequired={defaultRequired}
        description={description}
        icon={icon}
      />
    </div>
  );
};

export default FormInput;
